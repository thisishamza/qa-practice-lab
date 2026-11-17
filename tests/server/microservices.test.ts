// Final phase — microservices/event simulation endpoint matrix. Real
// migrations, real session cookies, real ids. Covers: overview with and
// without a session, publish validation and quota plumbing, the full
// order → inventory → payment → webhook pipeline, transient retry with
// backoff (asserted via available_at), always-fails → dead letter → replay,
// poison, idempotent redelivery vs hunt defect double-apply, out-of-order
// orphan rejection vs applied-defect, consistency violations, trace,
// redeliver/retry/replay boundaries and session isolation.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { sha256Hex } from '../../src/server/rateLimit'
import {
  createMigratedD1,
  type MigratedD1,
} from '../helpers/fake-d1'

const IP = '203.0.113.99'
const ipHeaders = () => ({ 'cf-connecting-ip': IP })

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function extractCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /mpl_session=([a-f0-9]{32})/.exec(setCookie)
  return match ? match[1] : null
}

function allSetCookies(response: Response): string[] {
  const headers = response.headers as unknown as {
    getSetCookie?: () => string[]
    get(name: string): string | null
  }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }
  return [headers.get('set-cookie') ?? '']
}

async function freshGuestSession(migrated: MigratedD1): Promise<string> {
  const response = await app.request(
    '/api/v1/practice/session/reset',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    { DB: migrated.db },
  )
  const cookie = extractCookie(allSetCookies(response).join('; '))
  if (cookie === null) {
    throw new Error('Expected the reset to mint a practice session cookie.')
  }
  return cookie
}

async function startHunt(migrated: MigratedD1, huntId: string, cookie: string) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/start`,
    { method: 'POST', headers: { ...sessionCookieHeader(cookie), ...ipHeaders() } },
    { DB: migrated.db },
  )
}

async function publish(
  migrated: MigratedD1,
  cookie: string,
  body: Record<string, unknown>,
) {
  return app.request(
    '/api/v1/microservices/publish',
    {
      method: 'POST',
      headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json', ...ipHeaders() },
      body: JSON.stringify(body),
    },
    { DB: migrated.db },
  )
}

async function processNow(migrated: MigratedD1, cookie: string) {
  const response = await app.request(
    '/api/v1/microservices/process',
    { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
    { DB: migrated.db },
  )
  return { response, body: (await response.json()) as { processed: Array<{ type: string; result: string; correlationId: string; seq: number }>; waiting: number; dead: number } }
}

async function overviewOf(migrated: MigratedD1, cookie: string) {
  const response = await app.request(
    '/api/v1/microservices/overview',
    { method: 'GET', headers: sessionCookieHeader(cookie) },
    { DB: migrated.db },
  )
  return (await response.json()) as {
    quota: { used: number; limit: number }
    events: { total: number; pending: number; processed: number; failed: number; dead: number }
    webhooks: { delivered: number; duplicates: number; dead: number }
    state: Record<string, Record<string, string>>
    orders: Array<{ correlationId: string; paid: boolean; reserved: boolean; capturedCents: number; totalCents: number }>
  }
}

async function eventsOf(migrated: MigratedD1, cookie: string) {
  const response = await app.request(
    '/api/v1/microservices/events',
    { method: 'GET', headers: sessionCookieHeader(cookie) },
    { DB: migrated.db },
  )
  return (await response.json()) as {
    events: Array<{ id: string; type: string; status: string; attempts: number; max_attempts: number; correlation_id: string; seq: number }>
  }
}

/** Backdate every not-yet-due event in the session so retries are due now. */
function backdateAll(migrated: MigratedD1) {
  migrated.sqlite.exec("UPDATE events SET available_at = '2020-01-01T00:00:00.000Z' WHERE status IN ('pending', 'failed')")
}

describe('microservices overview', () => {
  it('returns an empty payload when no live session exists', async () => {
    const migrated = createMigratedD1()
    const response = await app.request('/api/v1/microservices/overview', { method: 'GET' }, { DB: migrated.db })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { events: { total: number }; quota: { used: number } }
    expect(body.events.total).toBe(0)
    expect(body.quota.used).toBe(0)
  })
})

describe('publish + validation', () => {
  it('mints a clean guest session on first publish (hunt-start semantics)', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/microservices/publish',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'order.created' }) },
      { DB: migrated.db },
    )
    expect(response.status).toBe(201)
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('mpl_session=')
  })

  it('rejects unknown types and drills', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const badType = await publish(migrated, cookie, { type: 'passwords.stolen' })
    expect(badType.status).toBe(400)
    const badDrill = await publish(migrated, cookie, { type: 'order.created', drill: 'everything-burns' })
    expect(badDrill.status).toBe(400)
    const badQty = await publish(migrated, cookie, { type: 'order.created', quantity: 1000 })
    expect(badQty.status).toBe(400)
  })

  it('mints a correlation id, assigns seq 1 and leaves quota at exactly one used', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const response = await publish(migrated, cookie, { type: 'order.created' })
    expect(response.status).toBe(201)
    const body = (await response.json()) as { correlationId: string; seq: number; status: string }
    expect(body.correlationId).toMatch(/^corr_[a-z0-9]{6,24}$/)
    expect(body.seq).toBe(1)
    expect(body.status).toBe('pending')
    const overview = await overviewOf(migrated, cookie)
    expect(overview.quota.used).toBe(1)
    expect(overview.events.pending).toBe(1)
  })

  it('ignores a foreign correlation id and a malformed one', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const response = await publish(migrated, cookie, { type: 'order.created', correlationId: 'not a correlation' })
    expect(response.status).toBe(201)
    const body = (await response.json()) as { correlationId: string }
    expect(body.correlationId).toMatch(/^corr_/)
  })
})

describe('publish rate limit (F2: budget enforced before minting)', () => {
  function sessionCount(migrated: MigratedD1): number {
    return (migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM practice_sessions').get() as { n: number }).n
  }
  function currentWindowStart(): number {
    return Math.floor(Math.floor(Date.now() / 1000) / 60)
  }
  async function seedEventsPublishBucket(migrated: MigratedD1, count: number): Promise<void> {
    const ipHash = await sha256Hex(IP)
    migrated.sqlite
      .prepare('INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, ?)')
      .run(`events-publish:${ipHash}`, currentWindowStart(), count)
  }

  it('a rate-limited cookie-less publish answers 429 without minting a session', async () => {
    const migrated = createMigratedD1()
    await seedEventsPublishBucket(migrated, 20)
    const response = await app.request(
      '/api/v1/microservices/publish',
      { method: 'POST', headers: { 'content-type': 'application/json', ...ipHeaders() }, body: JSON.stringify({ type: 'order.created' }) },
      { DB: migrated.db },
    )
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBeTruthy()
    expect(response.headers.get('set-cookie')).toBeNull()
    const body = (await response.json()) as { error: string; message: string }
    expect(body.error).toBe('rate_limited')
    expect(body.message).toBe('Too many publish requests. Wait a minute and try again.')
    expect(sessionCount(migrated)).toBe(0)
  })

  it('a rate-limited existing-session publish answers 429 in the same envelope and mints nothing', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    expect(sessionCount(migrated)).toBe(1)
    await seedEventsPublishBucket(migrated, 20)
    const response = await publish(migrated, cookie, { type: 'order.created' })
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBeTruthy()
    expect(response.headers.get('set-cookie')).toBeNull()
    const body = (await response.json()) as { error: string; message: string }
    expect(body.error).toBe('rate_limited')
    expect(body.message).toBe('Too many publish requests. Wait a minute and try again.')
    expect(sessionCount(migrated)).toBe(1)
  })

  it('a valid cookie-less publish still works and mints exactly one session', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/microservices/publish',
      { method: 'POST', headers: { 'content-type': 'application/json', ...ipHeaders() }, body: JSON.stringify({ type: 'order.created' }) },
      { DB: migrated.db },
    )
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toContain('mpl_session=')
    expect(sessionCount(migrated)).toBe(1)
  })

  it('an existing-session publish is unchanged: nothing minted and the scoped budget is consumed', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const response = await publish(migrated, cookie, { type: 'order.created' })
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(sessionCount(migrated)).toBe(1)
    const ipHash = await sha256Hex(IP)
    const row = migrated.sqlite
      .prepare('SELECT count FROM rate_limit_buckets WHERE key = ? AND window_start = ?')
      .get(`events-publish:${ipHash}`, currentWindowStart()) as { count: number }
    expect(row.count).toBe(1)
  })
})

describe('order → inventory → payment → webhook pipeline', () => {
  it('processes the full pipeline and reaches paid + webhook delivered', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created', quantity: 2, totalCents: 99900 })

    // Step 1: reserve inventory
    const first = await processNow(migrated, cookie)
    expect(first.body.processed).toHaveLength(1)
    expect(first.body.processed[0].type).toBe('order.created')
    expect(first.body.processed[0].result).toBe('processed')

    // Step 2: capture payment
    const second = await processNow(migrated, cookie)
    expect(second.body.processed).toHaveLength(1)
    expect(second.body.processed[0].type).toBe('inventory.reserved')
    expect(second.body.processed[0].result).toBe('processed')

    // Step 3: notification + queue webhook
    const third = await processNow(migrated, cookie)
    expect(third.body.processed).toHaveLength(1)
    expect(third.body.processed[0].type).toBe('payment.processed')
    expect(third.body.processed[0].result).toBe('processed')

    // Step 4: webhook delivery
    const fourth = await processNow(migrated, cookie)
    expect(fourth.body.processed).toHaveLength(1)
    expect(fourth.body.processed[0].type).toBe('webhook.deliver')
    expect(fourth.body.processed[0].result).toBe('processed')

    const overview = await overviewOf(migrated, cookie)
    expect(overview.orders).toHaveLength(1)
    expect(overview.orders[0].reserved).toBe(true)
    expect(overview.orders[0].paid).toBe(true)
    expect(overview.orders[0].capturedCents).toBe(99900)
    expect(overview.webhooks.delivered).toBe(1)
  })

  it('inventory-short drill deterministically rejects the reservation', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created', drill: 'inventory-short', quantity: 999 })
    const first = await processNow(migrated, cookie)
    expect(first.body.processed[0].result).toBe('processed')
    expect(first.body.processed[0].type).toBe('order.created')
    const events = await eventsOf(migrated, cookie)
    // No inventory.reserved event is emitted on the rejection path.
    expect(events.events.filter((event) => event.type === 'inventory.reserved')).toHaveLength(0)
    const overview = await overviewOf(migrated, cookie)
    expect(overview.orders[0].reserved).toBe(false)
    expect(Number(overview.state.inventory?.reservation_failures ?? 0)).toBe(1)
  })

  it('poison drill dead-letters without retry', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created', drill: 'poison' })
    const first = await processNow(migrated, cookie)
    expect(first.body.processed[0].result).toBe('dead')
    expect(first.body.dead).toBe(1)
    // Backdating must NOT resurrect a poison message through normal processing.
    backdateAll(migrated)
    const second = await processNow(migrated, cookie)
    expect(second.body.processed).toHaveLength(0)
  })

  it('payment-transient fails twice with backoff then succeeds', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created', drill: 'payment-transient', totalCents: 12900 })
    await processNow(migrated, cookie) // reserve
    const firstPayment = await processNow(migrated, cookie) // attempt 1 -> gateway timeout
    expect(firstPayment.body.processed[0].result).toBe('failed')
    const events1 = await eventsOf(migrated, cookie)
    const payment = events1.events.find((event) => event.type === 'inventory.reserved')
    expect(payment?.status).toBe('failed')
    expect(payment?.attempts).toBe(1)
    // Backoff gate: an immediate process must NOT run the retry.
    const gated = await processNow(migrated, cookie)
    expect(gated.body.processed).toHaveLength(0)
    expect(gated.body.waiting).toBe(1)
    backdateAll(migrated)
    const secondPayment = await processNow(migrated, cookie) // attempt 2 -> gateway timeout
    expect(secondPayment.body.processed[0].result).toBe('failed')
    backdateAll(migrated)
    const thirdPayment = await processNow(migrated, cookie) // attempt 3 -> success
    expect(thirdPayment.body.processed[0].result).toBe('processed')
    const overview = await overviewOf(migrated, cookie)
    expect(overview.orders[0].paid).toBe(true)
  })

  it('payment-always-fails dead-letters after three attempts; replay re-arms them', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created', drill: 'payment-always-fails', totalCents: 12900 })
    await processNow(migrated, cookie) // reserve
    for (let attempt = 0; attempt < 3; attempt += 1) {
      backdateAll(migrated)
      await processNow(migrated, cookie)
    }
    const events1 = await eventsOf(migrated, cookie)
    const payment = events1.events.find((event) => event.type === 'inventory.reserved')
    expect(payment?.status).toBe('dead')
    expect(payment?.attempts).toBe(3)

    // Replay re-arms all dead events.
    const replay = await app.request(
      '/api/v1/microservices/events/replay',
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    const replayBody = (await replay.json()) as { replayed: number }
    expect(replayBody.replayed).toBeGreaterThan(0)
    const events2 = await eventsOf(migrated, cookie)
    const rearmed = events2.events.find((event) => event.type === 'inventory.reserved')
    expect(rearmed?.status).toBe('pending')
  })

  it('webhook-timeout times out twice then delivers; redelivery logs a duplicate', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created', drill: 'webhook-timeout', totalCents: 12900 })
    await processNow(migrated, cookie) // reserve
    await processNow(migrated, cookie) // capture (default outcome — webhook-timeout only affects the webhook step)
    await processNow(migrated, cookie) // payment.processed -> queue webhook
    backdateAll(migrated)
    const firstWebhook = await processNow(migrated, cookie)
    expect(firstWebhook.body.processed[0].result).toBe('failed') // attempt 1 timeout
    backdateAll(migrated)
    const secondWebhook = await processNow(migrated, cookie)
    expect(secondWebhook.body.processed[0].result).toBe('failed') // attempt 2 timeout
    backdateAll(migrated)
    const thirdWebhook = await processNow(migrated, cookie)
    expect(thirdWebhook.body.processed[0].result).toBe('processed') // attempt 3 delivered
    let overview = await overviewOf(migrated, cookie)
    expect(overview.webhooks.delivered).toBe(1)
    expect(overview.webhooks.duplicates).toBe(0)

    // Redeliver the processed webhook: receiver dedupes, count increments.
    const events = await eventsOf(migrated, cookie)
    const webhook = events.events.find((event) => event.type === 'webhook.deliver')
    expect(webhook?.status).toBe('processed')
    const redeliver = await app.request(
      `/api/v1/microservices/events/${webhook?.id}/redeliver`,
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    expect(redeliver.status).toBe(200)
    await processNow(migrated, cookie)
    overview = await overviewOf(migrated, cookie)
    expect(overview.webhooks.duplicates).toBe(1)
    expect(overview.webhooks.delivered).toBe(1)
  })
})

describe('hunt defects in the simulator', () => {
  it('EVT-001 (hunt-event-001): redelivery double-applies the payment', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const start = await startHunt(migrated, 'hunt-event-001', cookie)
    expect(start.status).toBe(200)
    await publish(migrated, cookie, { type: 'order.created', quantity: 1, totalCents: 12900 })
    await processNow(migrated, cookie) // reserve
    await processNow(migrated, cookie) // capture
    const events = await eventsOf(migrated, cookie)
    const reservation = events.events.find((event) => event.type === 'inventory.reserved')
    // Clean mode would no-op here; the hunt skips the dedup check.
    await app.request(
      `/api/v1/microservices/events/${reservation?.id}/redeliver`,
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    await processNow(migrated, cookie)
    const overview = await overviewOf(migrated, cookie)
    expect(overview.orders[0].capturedCents).toBe(12900 * 2)
    expect(Number(overview.state.payments?.captured_count ?? 0)).toBe(2)
    const audit = await app.request('/api/v1/microservices/consistency', { method: 'GET', headers: sessionCookieHeader(cookie) }, { DB: migrated.db })
    const auditBody = (await audit.json()) as { ok: boolean; violations: Array<{ kind: string }> }
    expect(auditBody.ok).toBe(false)
    expect(auditBody.violations.map((v) => v.kind)).toContain('overcapture')
  })

  it('clean mode: redelivery is a no-op and the audit stays clean', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created', quantity: 1, totalCents: 12900 })
    await processNow(migrated, cookie) // reserve
    await processNow(migrated, cookie) // capture
    await processNow(migrated, cookie) // notification + queue webhook
    await processNow(migrated, cookie) // deliver webhook
    const events = await eventsOf(migrated, cookie)
    const reservation = events.events.find((event) => event.type === 'inventory.reserved')
    await app.request(
      `/api/v1/microservices/events/${reservation?.id}/redeliver`,
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    const outcome = await processNow(migrated, cookie)
    expect(outcome.body.processed[0].result).toBe('duplicate')
    const overview = await overviewOf(migrated, cookie)
    expect(overview.orders[0].capturedCents).toBe(12900)
    const audit = await app.request('/api/v1/microservices/consistency', { method: 'GET', headers: sessionCookieHeader(cookie) }, { DB: migrated.db })
    const auditBody = (await audit.json()) as { ok: boolean }
    expect(auditBody.ok).toBe(true)
  })

  it('EVT-002 (hunt-event-002): backoff collapses and retries fire immediately', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const start = await startHunt(migrated, 'hunt-event-002', cookie)
    expect(start.status).toBe(200)
    await publish(migrated, cookie, { type: 'order.created', drill: 'payment-always-fails', totalCents: 12900 })
    await processNow(migrated, cookie)
    // In clean mode these two calls would be gated by available_at. In the
    // hunt, backoff is 0 ms so attempts advance on back-to-back calls.
    await processNow(migrated, cookie)
    await processNow(migrated, cookie)
    await processNow(migrated, cookie)
    const events = await eventsOf(migrated, cookie)
    const payment = events.events.find((event) => event.type === 'inventory.reserved')
    expect(payment?.attempts).toBe(3)
    expect(payment?.status).toBe('dead')
  })

  it('EVT-003 (hunt-event-003): an unprepared payment is applied, not dead-lettered', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const start = await startHunt(migrated, 'hunt-event-003', cookie)
    expect(start.status).toBe(200)
    await publish(migrated, cookie, { type: 'payment.processed', totalCents: 12900 })
    const outcome = await processNow(migrated, cookie)
    expect(outcome.body.processed[0].result).toBe('processed')
    const audit = await app.request('/api/v1/microservices/consistency', { method: 'GET', headers: sessionCookieHeader(cookie) }, { DB: migrated.db })
    const auditBody = (await audit.json()) as { ok: boolean; violations: Array<{ kind: string }> }
    expect(auditBody.ok).toBe(false)
    expect(auditBody.violations.map((v) => v.kind)).toContain('payment_without_reservation')
  })

  it('clean mode: unprepared payment dead-letters with orphan_payment', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'payment.processed', totalCents: 12900 })
    const outcome = await processNow(migrated, cookie)
    expect(outcome.body.processed[0].result).toBe('out_of_order')
    expect(outcome.body.dead).toBe(1)
  })
})

describe('trace, retry boundaries and session isolation', () => {
  it('returns the ordered timeline for a correlation id', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const published = await publish(migrated, cookie, { type: 'order.created' })
    const { correlationId } = (await published.json()) as { correlationId: string }
    await processNow(migrated, cookie)
    const response = await app.request(
      `/api/v1/microservices/trace/${correlationId}`,
      { method: 'GET', headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    const trace = (await response.json()) as { events: Array<{ type: string; seq: number }> }
    expect(trace.events.map((event) => event.type)).toContain('order.created')
    expect(trace.events.every((event, index, all) => index === 0 || all[index - 1].seq <= event.seq)).toBe(true)
  })

  it('returns 404 for an unknown correlation id and 400 for a malformed one', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const unknown = await app.request(
      '/api/v1/microservices/trace/corr_nope000000',
      { method: 'GET', headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(unknown.status).toBe(404)
    const malformed = await app.request(
      '/api/v1/microservices/trace/not-valid',
      { method: 'GET', headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(malformed.status).toBe(400)
  })

  it('retry refuses pending/processed events with 409, unknown with 404, malformed with 400', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created' })
    const events = await eventsOf(migrated, cookie)
    const eventId = events.events[0].id
    const retryPending = await app.request(
      `/api/v1/microservices/events/${eventId}/retry`,
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    expect(retryPending.status).toBe(409)
    const retryUnknown = await app.request(
      '/api/v1/microservices/events/evt_nope00000000/retry',
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    expect(retryUnknown.status).toBe(404)
    const retryMalformed = await app.request(
      '/api/v1/microservices/events/not-an-id/retry',
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    expect(retryMalformed.status).toBe(400)
  })

  it('redeliver refuses pending events with 409', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created' })
    const events = await eventsOf(migrated, cookie)
    const response = await app.request(
      `/api/v1/microservices/events/${events.events[0].id}/redeliver`,
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    expect(response.status).toBe(409)
  })

  it('a second session cannot see the first session’s events', async () => {
    const migrated = createMigratedD1()
    const first = await freshGuestSession(migrated)
    const published = await publish(migrated, first, { type: 'order.created' })
    const { correlationId } = (await published.json()) as { correlationId: string }
    const second = await freshGuestSession(migrated)
    const events = await eventsOf(migrated, second)
    expect(events.events).toHaveLength(0)
    const overview = await overviewOf(migrated, second)
    expect(overview.events.total).toBe(0)
    const trace = await app.request(
      `/api/v1/microservices/trace/${correlationId}`,
      { method: 'GET', headers: sessionCookieHeader(second) },
      { DB: migrated.db },
    )
    expect(trace.status).toBe(404)
  })

  it('reset deletes the session simulation state', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await publish(migrated, cookie, { type: 'order.created' })
    await processNow(migrated, cookie)
    const reset = await app.request(
      '/api/v1/microservices/reset',
      { method: 'POST', headers: { ...sessionCookieHeader(cookie), 'content-type': 'application/json' }, body: '{}' },
      { DB: migrated.db },
    )
    expect(reset.status).toBe(200)
    const events = await eventsOf(migrated, cookie)
    expect(events.events).toHaveLength(0)
    const overview = await overviewOf(migrated, cookie)
    expect(overview.events.total).toBe(0)
    expect(overview.orders).toHaveLength(0)
  })
})
