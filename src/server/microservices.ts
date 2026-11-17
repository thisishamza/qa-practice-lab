// Microservices & Event-Driven Testing lab — the controlled, deterministic
// EVENT SIMULATION behind /microservices (final development phase).
//
// Read this first (also surfaced in the UI and docs): this is a SIMULATION
// written on D1 for practice purposes. It is NOT a production-grade message
// broker, there is no real network I/O anywhere (webhook "delivery" is a
// scripted outcome), and Cloudflare Queues/DO are deliberately not used —
// the learner-triggered `process` endpoint plays the role of the consumer
// worker, bounded at 10 due events per call.
//
// Determinism: every handler outcome is a pure function of (event payload,
// attempts, session state). No randomness, no wall-clock dependence in the
// decision paths; wall clock only decides *when* a due event may be handled
// (available_at backoff). Defect branches are static (see defects.ts).
//
// Isolation: every row is keyed on the caller's practice_sessions row with
// ON DELETE CASCADE. No id from the client is ever trusted — event ids are
// validated against the caller's session. Defects activate only in
// bug_hunt sessions (isDefectActive). Synthetic data only; nothing here
// touches shared or production data.
//
// Endpoints (all resolved from the caller's `mpl_session` cookie):
//   GET  /api/v1/microservices/overview            — counts, DLQ depth,
//        service-state projection, session quota. Empty payload when no
//        live session (404-free, matching /practice/attempts).
//   POST /api/v1/microservices/publish             — synthesize an event.
//        Body { type, drill?, quantity?, totalCents?, correlationId? };
//        type ∈ {order.created, inventory.reserved, payment.processed,
//        webhook.deliver}; drill ∈ {none, inventory-short, inventory-delay,
//        payment-decline, payment-transient, payment-always-fails,
//        webhook-timeout, webhook-always-fail, poison}. Payload is BUILT
//        server-side — learners never submit raw payloads. 20/min/IP.
//        429 when the per-session quota (100 events) is exhausted.
//   POST /api/v1/microservices/process             — handle ≤ 10 DUE
//        events (available_at ≤ now) across all four handler types.
//        Returns per-event outcomes + how many are still waiting.
//   POST /api/v1/microservices/events/:id/retry    — re-queue ONE
//        failed/dead event (available_at = now). 409 when pending/processed.
//   POST /api/v1/microservices/events/replay       — re-queue ALL dead
//        events (≤ 10). Returns the replayed count.
//   POST /api/v1/microservices/reset               — delete the caller
//        session's simulation state. Idempotent.
//   GET  /api/v1/microservices/trace/:correlationId — ordered event +
//        webhook timeline for one correlation. 404 unknown correlation.
//   GET  /api/v1/microservices/consistency         — deterministic checks:
//        paid-without-reservation, overcapture, paid-without-webhook.
//
// Retry semantics: exponential backoff available_at = now + min(1s × 2^n,
// 8s) where n = attempts AFTER this failure (1s, 2s, 4s, 8s). Defect
// EVT-002 collapses the backoff to 0 (retry-storm smell, still capped by
// max_attempts = 3). Poison drills bypass retries entirely.
//
// Idempotency: handlers record dedup:<eventId> in service_state; a
// redelivered event is a no-op returning duplicate: true. Defect EVT-001
// skips the payment handler's dedup check. Ordering: an unprepared
// payment.processed (no reservation on the order) is rejected to dead with
// out_of_order_payment; defect EVT-003 applies it anyway.

import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { AppEnv } from './app'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionWithCart,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'
import { isSecureRequest } from './customer'
import { clientIp, consumeRateLimit, sha256Hex } from './rateLimit'
import { isDefectActive } from './defects'

export const microservicesRoutes = new Hono<AppEnv>()

const CORRELATION_PATTERN = /^corr_[a-z0-9]{6,24}$/
const EVENT_ID_PATTERN = /^evt_[a-z0-9-]{8,40}$/
const MAX_BATCH = 10
const SESSION_EVENT_QUOTA = 100
const MAX_PAYLOAD_BYTES = 512
const MAX_QTY = 999
const MAX_TOTAL_CENTS = 2_000_000
const WEBHOOK_TARGET = 'https://hooks.meridian-practice.test/storefront'
const SYNTHETIC_SKU = 'ridgeline-2p-tent'
const SYNTHETIC_STOCK = 25

export const EVENT_TYPES = ['order.created', 'inventory.reserved', 'payment.processed', 'webhook.deliver'] as const
export type EventType = (typeof EVENT_TYPES)[number]
export const DRILLS = [
  'none',
  'inventory-short',
  'inventory-delay',
  'payment-decline',
  'payment-transient',
  'payment-always-fails',
  'webhook-timeout',
  'webhook-always-fail',
  'poison',
] as const
export type Drill = (typeof DRILLS)[number]

interface EventRow {
  id: string
  practice_session_id: number
  correlation_id: string
  seq: number
  type: EventType
  payload_json: string
  status: 'pending' | 'processed' | 'failed' | 'dead'
  attempts: number
  max_attempts: number
  available_at: string
  last_error: string | null
  created_at: string
  updated_at: string
}

interface OrderRecord {
  orderId: string
  quantity: number
  totalCents: number
  drill: Drill
  reserved: boolean
  paid: boolean
  paymentStatus: 'none' | 'declined' | 'paid' | 'failed'
  capturedCents: number
}

export interface PublishRequest {
  type?: unknown
  drill?: unknown
  quantity?: unknown
  totalCents?: unknown
  correlationId?: unknown
}

async function resolveCallerSession(c: Context<AppEnv>): Promise<{ id: number } | null> {
  const presented = getCookie(c, SESSION_COOKIE)
  if (!presented || !isTokenFormat(presented)) {
    return null
  }
  const live = await findLiveSession(c.env.DB, await hashSessionToken(presented))
  return live ? { id: live.id } : null
}

/**
 * Resolve the caller's live practice session, minting a clean one when the
 * browser has none — the same zero-onboarding semantic as a hunt start.
 * Only publish and process use this: reads never mint, and the
 * retry/replay/reset verbs act on an existing session by definition.
 */
async function resolveOrMintSession(c: Context<AppEnv>): Promise<{ id: number; newCookie?: string }> {
  const live = await resolveCallerSession(c)
  if (live) {
    return live
  }
  const fresh = await createSessionWithCart(c.env.DB)
  return { id: fresh.sessionId, newCookie: fresh.token }
}

function applyMintedSessionCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'Strict' as const,
    maxAge: SESSION_TTL_SECONDS,
    secure: isSecureRequest(c.req.url),
  })
}

function nowIso(nowMs: number): string {
  return new Date(nowMs).toISOString()
}

function shortId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

/** Exponential backoff in milliseconds; defect EVT-002 collapses it to 0. */
export function backoffMs(attemptsAfterFailure: number, collapse: boolean): number {
  if (collapse) {
    return 0
  }
  return Math.min(1000 * 2 ** Math.max(0, attemptsAfterFailure - 1), 8000)
}

// ---------------------------------------------------------------------------
// service_state helpers
// ---------------------------------------------------------------------------
async function stateGet(c: Context<AppEnv>, sessionId: number, service: string, key: string): Promise<string | null> {
  const row = await c.env.DB.prepare(
    'SELECT state_value FROM service_state WHERE practice_session_id = ? AND service = ? AND state_key = ?',
  )
    .bind(sessionId, service, key)
    .first<{ state_value: string }>()
  return row?.state_value ?? null
}

async function stateSet(
  c: Context<AppEnv>,
  sessionId: number,
  service: string,
  key: string,
  value: string,
  nowMs: number,
): Promise<void> {
  await c.env.DB.prepare(
    `INSERT INTO service_state (practice_session_id, service, state_key, state_value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (practice_session_id, service, state_key)
     DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at`,
  )
    .bind(sessionId, service, key, value, nowIso(nowMs))
    .run()
}

async function stateBump(c: Context<AppEnv>, sessionId: number, service: string, key: string, by: number, nowMs: number): Promise<number> {
  const current = Number((await stateGet(c, sessionId, service, key)) ?? '0')
  const next = (Number.isFinite(current) ? current : 0) + by
  await stateSet(c, sessionId, service, key, String(next), nowMs)
  return next
}

async function readOrder(c: Context<AppEnv>, sessionId: number, correlationId: string): Promise<OrderRecord | null> {
  const raw = await stateGet(c, sessionId, 'orders', correlationId)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as OrderRecord
  } catch {
    return null
  }
}

async function writeOrder(c: Context<AppEnv>, sessionId: number, correlationId: string, order: OrderRecord, nowMs: number): Promise<void> {
  await stateSet(c, sessionId, 'orders', correlationId, JSON.stringify(order), nowMs)
}

async function insertEvent(
  c: Context<AppEnv>,
  sessionId: number,
  correlationId: string,
  seq: number,
  type: EventType,
  payload: Record<string, unknown>,
  nowMs: number,
  availableAtMs = nowMs,
): Promise<void> {
  const payloadJson = JSON.stringify(payload)
  if (payloadJson.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Synthesized payload exceeded the 512-byte budget.')
  }
  await c.env.DB.prepare(
    `INSERT INTO events (id, practice_session_id, correlation_id, seq, type, payload_json, status, attempts, max_attempts, available_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, 3, ?, ?, ?)`,
  )
    .bind(shortId('evt'), sessionId, correlationId, seq, type, payloadJson, nowIso(availableAtMs), nowIso(nowMs), nowIso(nowMs))
    .run()
}

async function setEventOutcome(
  c: Context<AppEnv>,
  eventId: string,
  outcome: { status: 'processed' | 'failed' | 'dead'; error: string | null; availableAtMs: number | null },
  attempts: number,
  nowMs: number,
): Promise<void> {
  await c.env.DB.prepare(
    `UPDATE events SET status = ?, last_error = ?, attempts = ?, available_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(
      outcome.status,
      outcome.error,
      attempts,
      outcome.availableAtMs === null ? nowIso(nowMs) : nowIso(outcome.availableAtMs),
      nowIso(nowMs),
      eventId,
    )
    .run()
}

// ---------------------------------------------------------------------------
// Handlers. Each returns a learner-safe outcome record for the process log.
// ---------------------------------------------------------------------------
export interface ProcessOutcome {
  eventId: string
  type: EventType
  correlationId: string
  seq: number
  result: 'processed' | 'duplicate' | 'failed' | 'dead' | 'out_of_order'
  detail: string
}

async function handleOrderCreated(
  c: Context<AppEnv>,
  sessionId: number,
  event: EventRow,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<ProcessOutcome> {
  const base = { eventId: event.id, type: event.type, correlationId: event.correlation_id, seq: event.seq }
  const drill = (payload.drill as Drill) ?? 'none'
  const quantity = Number(payload.quantity ?? 1)
  const totalCents = Number(payload.totalCents ?? 0)

  if (drill === 'poison') {
    await setEventOutcome(c, event.id, { status: 'dead', error: 'poison_message', availableAtMs: null }, event.attempts, nowMs)
    return { ...base, result: 'dead', detail: 'Rejected without retry: poison message.' }
  }

  const dedup = await stateGet(c, sessionId, 'dedup', event.id)
  if (dedup) {
    await setEventOutcome(c, event.id, { status: 'processed', error: null, availableAtMs: null }, event.attempts, nowMs)
    return { ...base, result: 'duplicate', detail: 'Redelivery acknowledged; no state changed (idempotent).' }
  }

  const existing = await readOrder(c, sessionId, event.correlation_id)
  const order: OrderRecord = existing ?? {
    orderId: String(payload.orderId ?? 'ORD-0000'),
    quantity,
    totalCents,
    drill,
    reserved: false,
    paid: false,
    paymentStatus: 'none',
    capturedCents: 0,
  }

  if (drill === 'inventory-short') {
    order.reserved = false
    await writeOrder(c, sessionId, event.correlation_id, order, nowMs)
    await stateBump(c, sessionId, 'inventory', 'reservation_failures', 1, nowMs)
    await stateSet(c, sessionId, 'dedup', event.id, '1', nowMs)
    await setEventOutcome(c, event.id, { status: 'processed', error: 'inventory_rejected', availableAtMs: null }, event.attempts, nowMs)
    return { ...base, result: 'processed', detail: `Reservation rejected: synthetic stock is ${SYNTHETIC_STOCK}/SKU.` }
  }

  order.reserved = true
  await writeOrder(c, sessionId, event.correlation_id, order, nowMs)
  await stateBump(c, sessionId, 'inventory', 'units_reserved', quantity, nowMs)
  await stateSet(c, sessionId, 'dedup', event.id, '1', nowMs)
  const delay = drill === 'inventory-delay' ? 5000 : 0
  await insertEvent(
    c,
    sessionId,
    event.correlation_id,
    event.seq + 1,
    'inventory.reserved',
    { orderId: order.orderId, quantity, totalCents, drill },
    nowMs,
    nowMs + delay,
  )
  await setEventOutcome(c, event.id, { status: 'processed', error: null, availableAtMs: null }, event.attempts, nowMs)
  return { ...base, result: 'processed', detail: delay > 0 ? 'Reserved; downstream event delayed (eventual consistency).' : 'Inventory reserved; downstream event queued.' }
}

async function handleInventoryReserved(
  c: Context<AppEnv>,
  sessionId: number,
  event: EventRow,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<ProcessOutcome> {
  const base = { eventId: event.id, type: event.type, correlationId: event.correlation_id, seq: event.seq }
  const drill = (payload.drill as Drill) ?? 'none'
  const totalCents = Number(payload.totalCents ?? 0)
  const collapse = await isDefectActive(c, 'EVT-002')
  const idempotencyDefect = await isDefectActive(c, 'EVT-001')

  if (!idempotencyDefect) {
    const dedup = await stateGet(c, sessionId, 'dedup', event.id)
    if (dedup) {
      await setEventOutcome(c, event.id, { status: 'processed', error: null, availableAtMs: null }, event.attempts, nowMs)
      return { ...base, result: 'duplicate', detail: 'Redelivery acknowledged; payment not re-applied (idempotent).' }
    }
  }

  const order = await readOrder(c, sessionId, event.correlation_id)
  if (!order || !order.reserved) {
    // Unprepared message: no reservation exists for this correlation.
    const applied = await isDefectActive(c, 'EVT-003')
    if (!applied) {
      await setEventOutcome(c, event.id, { status: 'dead', error: 'out_of_order_payment', availableAtMs: null }, event.attempts, nowMs)
      return { ...base, result: 'out_of_order', detail: 'Rejected: no reservation exists for this order (out-of-order message).' }
    }
    // Defect EVT-003: apply the unprepared payment anyway — and record it,
    // so the inconsistency is real and the audit can find it.
    const paidOrder: OrderRecord = order ?? {
      orderId: String(payload.orderId ?? 'ORD-ORPHAN'),
      quantity: Number(payload.quantity ?? 1),
      totalCents,
      drill,
      reserved: false,
      paid: false,
      paymentStatus: 'none',
      capturedCents: 0,
    }
    paidOrder.paid = true
    paidOrder.paymentStatus = 'paid'
    paidOrder.capturedCents = (Number(paidOrder.capturedCents) || 0) + totalCents
    await writeOrder(c, sessionId, event.correlation_id, paidOrder, nowMs)
    await stateBump(c, sessionId, 'payments', 'captured_count', 1, nowMs)
    await stateBump(c, sessionId, 'payments', 'captured_cents_total', totalCents, nowMs)
    await stateSet(c, sessionId, 'dedup', event.id, '1', nowMs)
    await setEventOutcome(c, event.id, { status: 'processed', error: null, availableAtMs: null }, event.attempts, nowMs)
    return { ...base, result: 'processed', detail: 'Payment applied without a reservation (unprepared message accepted).' }
  }

  // Deterministic payment outcome.
  const declined = drill === 'payment-decline' || totalCents > 250_000
  if (declined) {
    order.paymentStatus = 'declined'
    await writeOrder(c, sessionId, event.correlation_id, order, nowMs)
    await stateBump(c, sessionId, 'payments', 'declined_count', 1, nowMs)
    await stateSet(c, sessionId, 'dedup', event.id, '1', nowMs)
    await setEventOutcome(c, event.id, { status: 'processed', error: 'card_declined', availableAtMs: null }, event.attempts, nowMs)
    return { ...base, result: 'processed', detail: 'Payment declined (non-retryable): card_declined.' }
  }

  const transientFailure = drill === 'payment-transient' && event.attempts < 2
  const alwaysFails = drill === 'payment-always-fails'
  if (transientFailure || alwaysFails) {
    const attempts = event.attempts + 1
    const terminal = attempts >= event.max_attempts
    order.paymentStatus = terminal ? 'failed' : order.paymentStatus
    await writeOrder(c, sessionId, event.correlation_id, order, nowMs)
    if (terminal) {
      await stateBump(c, sessionId, 'payments', 'failed_count', 1, nowMs)
    }
    const delay = terminal ? null : backoffMs(attempts, collapse)
    await setEventOutcome(
      c,
      event.id,
      { status: terminal ? 'dead' : 'failed', error: 'gateway_timeout', availableAtMs: terminal ? null : nowMs + (delay ?? 0) },
      attempts,
      nowMs,
    )
    return {
      ...base,
      result: terminal ? 'dead' : 'failed',
      detail: terminal ? `Gateway timed out ${attempts}×; message dead-lettered.` : `Gateway timeout (attempt ${attempts}/${event.max_attempts}); retry scheduled.`,
    }
  }

  order.paid = true
  order.paymentStatus = 'paid'
  order.capturedCents = (Number(order.capturedCents) || 0) + totalCents
  await writeOrder(c, sessionId, event.correlation_id, order, nowMs)
  await stateBump(c, sessionId, 'payments', 'captured_count', 1, nowMs)
  await stateBump(c, sessionId, 'payments', 'captured_cents_total', totalCents, nowMs)
  await stateSet(c, sessionId, 'dedup', event.id, '1', nowMs)
  await insertEvent(
    c,
    sessionId,
    event.correlation_id,
    event.seq + 1,
    'payment.processed',
    { orderId: order.orderId, totalCents, quantity: order.quantity, drill },
    nowMs,
  )
  await setEventOutcome(c, event.id, { status: 'processed', error: null, availableAtMs: null }, event.attempts, nowMs)
  return { ...base, result: 'processed', detail: 'Payment captured; downstream event queued.' }
}

async function handlePaymentProcessed(
  c: Context<AppEnv>,
  sessionId: number,
  event: EventRow,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<ProcessOutcome> {
  const base = { eventId: event.id, type: event.type, correlationId: event.correlation_id, seq: event.seq }
  const drill = (payload.drill as Drill) ?? 'none'

  const dedup = await stateGet(c, sessionId, 'dedup', event.id)
  if (dedup) {
    await setEventOutcome(c, event.id, { status: 'processed', error: null, availableAtMs: null }, event.attempts, nowMs)
    return { ...base, result: 'duplicate', detail: 'Redelivery acknowledged; notification not re-sent (idempotent).' }
  }

  const order = await readOrder(c, sessionId, event.correlation_id)
  if (!order || !order.paid) {
    // Payment without capture evidence — out-of-order/orphan message.
    const applied = await isDefectActive(c, 'EVT-003')
    if (!applied) {
      await setEventOutcome(c, event.id, { status: 'dead', error: 'orphan_payment', availableAtMs: null }, event.attempts, nowMs)
      return { ...base, result: 'out_of_order', detail: 'Rejected: no captured payment exists for this order.' }
    }
    // Defect EVT-003: apply the orphan payment and record it, so the audit
    // can find the inconsistency.
    const paidOrder: OrderRecord = order ?? {
      orderId: String(payload.orderId ?? 'ORD-ORPHAN'),
      quantity: Number(payload.quantity ?? 1),
      totalCents: Number(payload.totalCents ?? 0),
      drill,
      reserved: false,
      paid: false,
      paymentStatus: 'none',
      capturedCents: 0,
    }
    paidOrder.paid = true
    paidOrder.paymentStatus = 'paid'
    paidOrder.capturedCents = (Number(paidOrder.capturedCents) || 0) + Number(payload.totalCents ?? 0)
    await writeOrder(c, sessionId, event.correlation_id, paidOrder, nowMs)
    await stateBump(c, sessionId, 'payments', 'captured_count', 1, nowMs)
    await stateBump(c, sessionId, 'payments', 'captured_cents_total', Number(payload.totalCents ?? 0), nowMs)
  }

  await stateBump(c, sessionId, 'notifications', 'sent_count', 1, nowMs)
  const webhookEvent: Record<string, unknown> = { orderId: order?.orderId ?? 'ORD-0000', totalCents: Number(payload.totalCents ?? 0), drill }
  await insertEvent(c, sessionId, event.correlation_id, event.seq + 1, 'webhook.deliver', webhookEvent, nowMs)
  await stateSet(c, sessionId, 'dedup', event.id, '1', nowMs)
  await setEventOutcome(c, event.id, { status: 'processed', error: null, availableAtMs: null }, event.attempts, nowMs)
  return { ...base, result: 'processed', detail: 'Notification sent; webhook delivery queued.' }
}

async function handleWebhookDeliver(
  c: Context<AppEnv>,
  sessionId: number,
  event: EventRow,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<ProcessOutcome> {
  const base = { eventId: event.id, type: event.type, correlationId: event.correlation_id, seq: event.seq }
  const drill = (payload.drill as Drill) ?? 'none'
  const collapse = await isDefectActive(c, 'EVT-002')

  const receiptKey = `receipt:${event.correlation_id}:${event.seq}`
  const seen = await stateGet(c, sessionId, 'webhooks', receiptKey)

  const attemptNumber = event.attempts + 1
  const timeout =
    drill === 'webhook-always-fail' || (drill === 'webhook-timeout' && attemptNumber < 3)

  const webhookRow = await c.env.DB.prepare(
    'SELECT id, attempts FROM webhook_deliveries WHERE event_id = ?',
  )
    .bind(event.id)
    .first<{ id: string; attempts: number }>()

  if (timeout) {
    if (webhookRow) {
      await c.env.DB.prepare(
        `UPDATE webhook_deliveries SET status = 'failed', attempts = ?, last_error = 'webhook_timeout', updated_at = ? WHERE id = ?`,
      )
        .bind(attemptNumber, nowIso(nowMs), webhookRow.id)
        .run()
    } else {
      await c.env.DB.prepare(
        `INSERT INTO webhook_deliveries (id, practice_session_id, event_id, target, status, attempts, max_attempts, http_status, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'failed', ?, 3, NULL, 'webhook_timeout', ?, ?)`,
      )
        .bind(shortId('whk'), sessionId, event.id, WEBHOOK_TARGET, attemptNumber, nowIso(nowMs), nowIso(nowMs))
        .run()
    }
    const terminal = attemptNumber >= event.max_attempts
    const delay = terminal ? null : backoffMs(attemptNumber, collapse)
    await setEventOutcome(
      c,
      event.id,
      { status: terminal ? 'dead' : 'failed', error: 'webhook_timeout', availableAtMs: terminal ? null : nowMs + (delay ?? 0) },
      attemptNumber,
      nowMs,
    )
    if (terminal) {
      await stateBump(c, sessionId, 'webhooks', 'dead_count', 1, nowMs)
      if (webhookRow) {
        await c.env.DB.prepare(
          `UPDATE webhook_deliveries SET status = 'dead', updated_at = ? WHERE id = ?`,
        )
          .bind(nowIso(nowMs), webhookRow.id)
          .run()
      }
    }
    return {
      ...base,
      result: terminal ? 'dead' : 'failed',
      detail: terminal ? `Webhook timed out ${attemptNumber}×; dead-lettered.` : `Webhook timeout (attempt ${attemptNumber}/${event.max_attempts}); retry scheduled.`,
    }
  }

  // Delivered. A receipt already present means this is a duplicate delivery.
  if (seen) {
    await stateBump(c, sessionId, 'webhooks', 'duplicates', 1, nowMs)
  } else {
    await stateSet(c, sessionId, 'webhooks', receiptKey, '1', nowMs)
    await stateBump(c, sessionId, 'webhooks', 'delivered_count', 1, nowMs)
  }
  if (webhookRow) {
    await c.env.DB.prepare(
      `UPDATE webhook_deliveries SET status = 'delivered', attempts = ?, http_status = 200, last_error = NULL, updated_at = ? WHERE id = ?`,
    )
      .bind(attemptNumber, nowIso(nowMs), webhookRow.id)
      .run()
  } else {
    await c.env.DB.prepare(
      `INSERT INTO webhook_deliveries (id, practice_session_id, event_id, target, status, attempts, max_attempts, http_status, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'delivered', ?, 3, 200, NULL, ?, ?)`,
    )
      .bind(shortId('whk'), sessionId, event.id, WEBHOOK_TARGET, attemptNumber, nowIso(nowMs), nowIso(nowMs))
      .run()
  }
  await setEventOutcome(c, event.id, { status: 'processed', error: null, availableAtMs: null }, attemptNumber, nowMs)
  return { ...base, result: 'processed', detail: seen ? 'Webhook re-delivered (duplicate; receiver deduped).' : 'Webhook delivered (HTTP 200, simulated).' }
}

const HANDLERS = {
  'order.created': handleOrderCreated,
  'inventory.reserved': handleInventoryReserved,
  'payment.processed': handlePaymentProcessed,
  'webhook.deliver': handleWebhookDeliver,
} as const

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
microservicesRoutes.get('/microservices/overview', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({
      persistence: 'session' as const,
      quota: { used: 0, limit: SESSION_EVENT_QUOTA },
      events: { total: 0, pending: 0, processed: 0, failed: 0, dead: 0 },
      webhooks: { delivered: 0, duplicates: 0, dead: 0 },
      state: {},
      orders: [],
    })
  }

  const counts = await c.env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM events WHERE practice_session_id = ? GROUP BY status`,
  )
    .bind(session.id)
    .all<{ status: string; n: number }>()
  const byStatus = { total: 0, pending: 0, processed: 0, failed: 0, dead: 0 }
  for (const row of counts.results) {
    const n = Number(row.n) || 0
    if (row.status === 'pending') byStatus.pending = n
    else if (row.status === 'processed') byStatus.processed = n
    else if (row.status === 'failed') byStatus.failed = n
    else if (row.status === 'dead') byStatus.dead = n
    byStatus.total += n
  }

  const stateRows = await c.env.DB.prepare(
    'SELECT service, state_key, state_value FROM service_state WHERE practice_session_id = ? ORDER BY service, state_key LIMIT 200',
  )
    .bind(session.id)
    .all<{ service: string; state_key: string; state_value: string }>()

  const state: Record<string, Record<string, string>> = {}
  const orders: Array<OrderRecord & { correlationId: string }> = []
  for (const row of stateRows.results) {
    if (row.service === 'orders') {
      try {
        orders.push({ correlationId: row.state_key, ...(JSON.parse(row.state_value) as OrderRecord) })
      } catch {
        // Skip unparseable projection rows — overview stays readable.
      }
      continue
    }
    if (row.service === 'dedup') {
      continue
    }
    state[row.service] = state[row.service] ?? {}
    state[row.service][row.state_key] = row.state_value
  }

  const webhooks = {
    delivered: Number(state.webhooks?.delivered_count ?? '0') || 0,
    duplicates: Number(state.webhooks?.duplicates ?? '0') || 0,
    dead: Number(state.webhooks?.dead_count ?? '0') || 0,
  }

  return c.json({
    persistence: 'session' as const,
    quota: { used: byStatus.total, limit: SESSION_EVENT_QUOTA },
    events: byStatus,
    webhooks,
    state,
    orders: orders.slice(0, 20),
  })
})

microservicesRoutes.post('/microservices/publish', async (c) => {
  // Mint a clean guest session on demand (hunt-start semantics) so the
  // simulator works for a first-time browser without a sign-in step.
  const session = await resolveOrMintSession(c)
  if (session.newCookie) {
    applyMintedSessionCookie(c, session.newCookie)
  }
  const ip = clientIp(c)
  if (ip) {
    const decision = await consumeRateLimit(c.env.DB, 'events-publish', await sha256Hex(ip), 20)
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds))
      return c.json({ error: 'rate_limited', message: 'Too many publish requests. Wait a minute and try again.' }, 429)
    }
  }

  const body = (await c.req.json().catch(() => null)) as PublishRequest | null
  const type = typeof body?.type === 'string' ? body.type : ''
  const drill = typeof body?.drill === 'string' ? body.drill : 'none'
  if (!(EVENT_TYPES as readonly string[]).includes(type)) {
    return c.json({ error: 'invalid_request', message: `type must be one of: ${EVENT_TYPES.join(', ')}.` }, 400)
  }
  if (!(DRILLS as readonly string[]).includes(drill)) {
    return c.json({ error: 'invalid_request', message: `drill must be one of: ${DRILLS.join(', ')}.` }, 400)
  }
  const quantity = body?.quantity === undefined ? 1 : Number(body.quantity)
  const totalCents = body?.totalCents === undefined ? 12900 : Number(body.totalCents)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
    return c.json({ error: 'invalid_request', message: `quantity must be an integer between 1 and ${MAX_QTY}.` }, 400)
  }
  if (!Number.isInteger(totalCents) || totalCents < 0 || totalCents > MAX_TOTAL_CENTS) {
    return c.json({ error: 'invalid_request', message: `totalCents must be an integer between 0 and ${MAX_TOTAL_CENTS}.` }, 400)
  }
  let correlationId = typeof body?.correlationId === 'string' && CORRELATION_PATTERN.test(body.correlationId)
    ? body.correlationId
    : null

  const quotaRow = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE practice_session_id = ?')
    .bind(session.id)
    .first<{ n: number }>()
  if ((quotaRow?.n ?? 0) >= SESSION_EVENT_QUOTA) {
    return c.json({ error: 'rate_limited', message: 'This practice session has reached the 100-event quota. Reset the simulator to continue.' }, 429)
  }

  const nowMs = Date.now()
  if (correlationId === null) {
    correlationId = shortId('corr')
  }
  const seqRow = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(seq), 0) AS max_seq FROM events WHERE practice_session_id = ? AND correlation_id = ?',
  )
    .bind(session.id, correlationId)
    .first<{ max_seq: number }>()
  const seq = Number(seqRow?.max_seq ?? 0) + 1
  const orderId = `ORD-${correlationId.slice(5, 11).toUpperCase()}${seq}`
  const payload = { orderId, sku: SYNTHETIC_SKU, quantity, totalCents, drill }
  await insertEvent(c, session.id, correlationId, seq, type as EventType, payload, nowMs)
  return c.json({ correlationId, seq, type, drill, status: 'pending' }, 201)
})

microservicesRoutes.post('/microservices/process', async (c) => {
  // Same mint-on-first-use semantic as publish.
  const session = await resolveOrMintSession(c)
  if (session.newCookie) {
    applyMintedSessionCookie(c, session.newCookie)
  }
  const nowMs = Date.now()
  const due = await c.env.DB.prepare(
    `SELECT * FROM events
     WHERE practice_session_id = ? AND status IN ('pending', 'failed') AND available_at <= ?
     ORDER BY created_at ASC, seq ASC
     LIMIT ?`,
  )
    .bind(session.id, nowIso(nowMs), MAX_BATCH)
    .all<EventRow>()

  const outcomes: ProcessOutcome[] = []
  for (const event of due.results) {
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(event.payload_json) as Record<string, unknown>
    } catch {
      // Corrupt payload rows are poison: dead-letter without retry.
      await setEventOutcome(c, event.id, { status: 'dead', error: 'poison_message', availableAtMs: null }, event.attempts, nowMs)
      outcomes.push({ eventId: event.id, type: event.type, correlationId: event.correlation_id, seq: event.seq, result: 'dead', detail: 'Rejected without retry: unparseable payload.' })
      continue
    }
    const handler = HANDLERS[event.type]
    outcomes.push(await handler(c, session.id, event, payload, nowMs))
  }

  const waitingRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM events WHERE practice_session_id = ? AND status IN ('pending', 'failed') AND available_at > ?`,
  )
    .bind(session.id, nowIso(nowMs))
    .first<{ n: number }>()
  const deadRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM events WHERE practice_session_id = ? AND status = 'dead'`,
  )
    .bind(session.id)
    .first<{ n: number }>()

  return c.json({ processed: outcomes, waiting: Number(waitingRow?.n ?? 0), dead: Number(deadRow?.n ?? 0) })
})

microservicesRoutes.post('/microservices/events/:id/retry', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({ error: 'session_required', message: 'Start the simulator before retrying events.' }, 401)
  }
  const eventId = c.req.param('id') ?? ''
  if (!EVENT_ID_PATTERN.test(eventId)) {
    return c.json({ error: 'invalid_request', message: 'An event id looks like evt_abcdef123456.' }, 400)
  }
  const nowMs = Date.now()
  const row = await c.env.DB.prepare(
    'SELECT status FROM events WHERE id = ? AND practice_session_id = ?',
  )
    .bind(eventId, session.id)
    .first<{ status: string }>()
  if (!row) {
    return c.json({ error: 'not_found', message: 'No such event in this practice session.' }, 404)
  }
  if (row.status === 'pending' || row.status === 'processed') {
    return c.json({ error: 'invalid_request', message: 'Only failed or dead events can be retried.' }, 409)
  }
  await c.env.DB.prepare(
    `UPDATE events SET status = 'pending', available_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(nowIso(nowMs), nowIso(nowMs), eventId)
    .run()
  return c.json({ eventId, status: 'pending' })
})

microservicesRoutes.post('/microservices/events/:id/redeliver', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({ error: 'session_required', message: 'Start the simulator before redelivering events.' }, 401)
  }
  const eventId = c.req.param('id') ?? ''
  if (!EVENT_ID_PATTERN.test(eventId)) {
    return c.json({ error: 'invalid_request', message: 'An event id looks like evt_abcdef123456.' }, 400)
  }
  const nowMs = Date.now()
  const row = await c.env.DB.prepare('SELECT status FROM events WHERE id = ? AND practice_session_id = ?')
    .bind(eventId, session.id)
    .first<{ status: string }>()
  if (!row) {
    return c.json({ error: 'not_found', message: 'No such event in this practice session.' }, 404)
  }
  if (row.status === 'pending') {
    return c.json({ error: 'invalid_request', message: 'Pending events are already queued for delivery.' }, 409)
  }
  // Requeue with the attempt counter preserved — this is the at-least-once
  // duplicate-delivery drill. Handlers dedupe on event id; learners watch
  // for the no-op (or the defect).
  await c.env.DB.prepare(`UPDATE events SET status = 'pending', available_at = ?, updated_at = ? WHERE id = ?`)
    .bind(nowIso(nowMs), nowIso(nowMs), eventId)
    .run()
  return c.json({ eventId, status: 'pending' })
})

microservicesRoutes.post('/microservices/events/replay', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({ error: 'session_required', message: 'Start the simulator before replaying events.' }, 401)
  }
  const nowMs = Date.now()
  const dead = await c.env.DB.prepare(
    `SELECT id FROM events WHERE practice_session_id = ? AND status = 'dead' ORDER BY created_at ASC LIMIT 10`,
  )
    .bind(session.id)
    .all<{ id: string }>()
  for (const row of dead.results) {
    await c.env.DB.prepare(`UPDATE events SET status = 'pending', available_at = ?, updated_at = ? WHERE id = ?`)
      .bind(nowIso(nowMs), nowIso(nowMs), row.id)
      .run()
  }
  return c.json({ replayed: dead.results.length })
})

microservicesRoutes.post('/microservices/reset', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({ error: 'session_required', message: 'Start the simulator before resetting it.' }, 401)
  }
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM webhook_deliveries WHERE practice_session_id = ?').bind(session.id),
    c.env.DB.prepare('DELETE FROM events WHERE practice_session_id = ?').bind(session.id),
    c.env.DB.prepare('DELETE FROM service_state WHERE practice_session_id = ?').bind(session.id),
  ])
  return c.json({ deleted: true })
})

microservicesRoutes.get('/microservices/events', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({ error: 'session_required', message: 'Start the simulator before inspecting events.' }, 401)
  }
  const events = await c.env.DB.prepare(
    `SELECT id, correlation_id, seq, type, status, attempts, max_attempts, last_error, created_at, updated_at, available_at
     FROM events WHERE practice_session_id = ? ORDER BY created_at DESC, seq DESC LIMIT 50`,
  )
    .bind(session.id)
    .all()
  return c.json({ events: events.results })
})

microservicesRoutes.get('/microservices/trace/:correlationId', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({ error: 'session_required', message: 'Start the simulator before inspecting traces.' }, 401)
  }
  const correlationId = c.req.param('correlationId') ?? ''
  if (!CORRELATION_PATTERN.test(correlationId)) {
    return c.json({ error: 'invalid_request', message: 'A correlation id looks like corr_abcdef123456.' }, 400)
  }
  const events = await c.env.DB.prepare(
    `SELECT id, seq, type, status, attempts, max_attempts, last_error, created_at, updated_at, available_at
     FROM events WHERE practice_session_id = ? AND correlation_id = ? ORDER BY seq ASC, created_at ASC LIMIT 50`,
  )
    .bind(session.id, correlationId)
    .all()
  if (events.results.length === 0) {
    return c.json({ error: 'not_found', message: 'No events for that correlation id in this practice session.' }, 404)
  }
  const eventIds = events.results.map((event) => (event as { id: string }).id)
  const placeholders = eventIds.map(() => '?').join(', ')
  const webhooks = await c.env.DB.prepare(
    `SELECT event_id, target, status, attempts, max_attempts, http_status, last_error
     FROM webhook_deliveries WHERE practice_session_id = ? AND event_id IN (${placeholders}) ORDER BY created_at ASC LIMIT 50`,
  )
    .bind(session.id, ...eventIds)
    .all()
  return c.json({ correlationId, events: events.results, webhooks: webhooks.results })
})

microservicesRoutes.get('/microservices/consistency', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({ error: 'session_required', message: 'Start the simulator before checking consistency.' }, 401)
  }
  const orderRows = await c.env.DB.prepare(
    `SELECT state_key, state_value FROM service_state WHERE practice_session_id = ? AND service = 'orders' LIMIT 100`,
  )
    .bind(session.id)
    .all<{ state_key: string; state_value: string }>()
  const violations: Array<{ correlationId: string; kind: string; detail: string }> = []
  for (const row of orderRows.results) {
    try {
      const order = JSON.parse(row.state_value) as OrderRecord
      if (order.paid && !order.reserved) {
        violations.push({ correlationId: row.state_key, kind: 'payment_without_reservation', detail: 'A payment was captured without a matching inventory reservation.' })
      }
      if (order.capturedCents > order.totalCents) {
        violations.push({ correlationId: row.state_key, kind: 'overcapture', detail: `Captured ${order.capturedCents} cents against an order total of ${order.totalCents} cents.` })
      }
      if (order.paid) {
        const webhook = await c.env.DB.prepare(
          `SELECT COUNT(*) AS n FROM webhook_deliveries WHERE practice_session_id = ? AND event_id IN (
             SELECT id FROM events WHERE practice_session_id = ? AND correlation_id = ? AND type = 'webhook.deliver' AND status = 'processed'
           )`,
        )
          .bind(session.id, session.id, row.state_key)
          .first<{ n: number }>()
        if ((Number(webhook?.n ?? 0)) === 0) {
          violations.push({ correlationId: row.state_key, kind: 'paid_without_webhook', detail: 'The payment was captured but no webhook delivery completed.' })
        }
      }
    } catch {
      // Skip unparseable rows; the check stays readable.
    }
  }
  return c.json({ ok: violations.length === 0, checked: orderRows.results.length, violations })
})
