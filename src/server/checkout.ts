// Checkout and orders (P3-M4).
//
// Endpoints:
//   GET  /api/v1/checkout           — cart-derived summary for the checkout page
//   POST /api/v1/checkout           — place a simulated order (atomic, idempotent)
//   GET  /api/v1/orders             — the current session's order history (newest first, ≤50)
//   GET  /api/v1/orders/:reference  — an immutable order confirmation (session-scoped)
//   POST /api/v1/orders/:reference/cancel — cancel a placed order (P3-M6):
//        exactly-once, restores stock once, idempotent on retry
//
// Security model:
// - Everything is resolved from the `mpl_session` cookie (see session.ts); only
//   a SHA-256 hash of the opaque token is stored. Order references are opaque
//   (`ORD-` + 16 uppercase hex chars); sequential database ids never leave
//   the server. An order is readable only by the session that placed it, or
//   (when signed in) by the customer account that owns it (P3-M5 policy).
// - The client never dictates prices, stock or totals. Authoritative figures
//   are recomputed from the catalogue/inventory tables at placement time.
// - Only the minimum synthetic checkout details are stored (name, email,
//   street line, city, postcode). No card, banking or personal-record data
//   is accepted or stored — payment is a deterministic simulation.
//
// Transaction design (D1 has no interactive transactions; `batch()` is
// all-or-nothing, matching SQLite semantics):
// 1. Read-only validation first (cart lines, active status, stock, totals).
//    Failures here write nothing.
// 2. Approved payments run as ONE batch: INSERT order, INSERT immutable
//    order_items snapshots, unguarded-but-CHECK-protected inventory
//    decrements (`inventory.quantity >= 0` — a violated CHECK aborts the
//    statement which aborts the whole batch), DELETE the cart lines,
//    INSERT the idempotency record. Any statement failure rolls back ALL of
//    it — never a partial order, never stock without an order, never a
//    cleared cart after a failed checkout.
// 3. Declined payments write nothing except the idempotency record (a
//    single statement). Cart and stock stay untouched.
// 4. If the batch fails, the idempotency row is re-read: a concurrent twin
//    already won → replay its recorded outcome. Otherwise stock/availability
//    is re-read and the learner gets an honest 422; anything else is a 500.
//
// Idempotency: the client may send an `Idempotency-Key` header (or
// `idempotencyKey` in the body) matching `^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$`;
// one is generated when absent. (session_id, idempotency_key) is the PRIMARY
// KEY of checkout_idempotency, so concurrent duplicates cannot both commit.
// The request hash binds the key to the validated checkout payload (details
// + payment outcome). It deliberately excludes the cart's contents: the
// first placement legitimately empties the cart, and a legitimate retry of
// the same logical submission (e.g. after a network timeout) must replay the
// recorded outcome verbatim — 201 + the original order, or the recorded
// decline — flagged with the `Idempotent-Replay: true` response header.
// Replaying a key against a materially different payload (different details
// or payment outcome) is rejected with 409. If the learner wants to place a
// *new* order after changing the cart, the client rotates the key after
// every settled response.

import { Hono, type Context } from 'hono'
import { getCookie } from 'hono/cookie'
import {
  COMMERCE_CURRENCY,
  PAYMENT_SIMULATIONS,
  type CheckoutSummary,
  type OrderDetail,
  type OrderItemSnapshot,
  type OrderListResponse,
  type OrderPaymentStatus,
  type OrderStatus,
  type OrderSummary,
  type PaymentSimulation,
} from '../shared/commerce'
import type { AppEnv } from './app'
import { resolveCustomerContext } from './customer'
import {
  SESSION_COOKIE,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'

/** Opaque order reference format, e.g. ORD-1A2B3C4D5E6F7089. */
export const ORDER_REFERENCE_PATTERN = /^ORD-[0-9A-F]{16}$/
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME_PATTERN = /^[\p{L}][\p{L} .,'-]{1,99}$/u
const CITY_PATTERN = /^[\p{L}][\p{L} .,'-]{1,79}$/u
const LINE_PATTERN = /^[^\r\n]{4,120}$/
const POSTCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\- ]{2,11}$/
const MAX_LIST_LIMIT = 50

function errorJson(
  c: Context<AppEnv>,
  status: 400 | 404 | 409 | 422 | 500,
  error: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return c.json({ error, message, ...extra }, status)
}

interface SessionResolution {
  sessionId: number
  cartId: number
}

/** Resolves the caller's session/cart without ever minting one. */
async function resolveCheckoutSession(
  c: Context<AppEnv>,
): Promise<SessionResolution | null> {
  const presented = getCookie(c, SESSION_COOKIE)
  if (!presented || !isTokenFormat(presented)) {
    return null
  }
  const live = await findLiveSession(c.env.DB, await hashSessionToken(presented))
  if (!live) {
    return null
  }
  const cart = await c.env.DB.prepare('INSERT OR IGNORE INTO carts (session_id) VALUES (?)')
    .bind(live.id)
    .run()
    .then(async () =>
      c.env.DB.prepare('SELECT id FROM carts WHERE session_id = ?')
        .bind(live.id)
        .first<{ id: number }>(),
    )
  if (!cart) {
    return null
  }
  return { sessionId: live.id, cartId: cart.id }
}

interface FulfillableLine {
  id: number
  productId: number
  slug: string
  name: string
  unitPriceCents: number
  quantity: number
  productActive: boolean
  availableStock: number
}

async function readFulfillableLines(
  db: D1Database,
  cartId: number,
): Promise<FulfillableLine[]> {
  const rows = await db
    .prepare(
      `SELECT
         ci.id,
         ci.product_id,
         p.slug,
         p.name,
         p.price_cents,
         ci.quantity,
         p.active AS product_active,
         i.quantity AS available_stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN inventory i ON i.product_id = p.id
       WHERE ci.cart_id = ?
       ORDER BY ci.id ASC`,
    )
    .bind(cartId)
    .all<{
      id: number
      product_id: number
      slug: string
      name: string
      price_cents: number
      quantity: number
      product_active: number
      available_stock: number
    }>()

  return rows.results.map((row) => ({
    id: row.id,
    productId: row.product_id,
    slug: row.slug,
    name: row.name,
    unitPriceCents: row.price_cents,
    quantity: row.quantity,
    productActive: row.product_active === 1,
    availableStock: row.available_stock,
  }))
}

type LineProblem =
  | { slug: string; name: string; reason: 'inactive' | 'insufficient_stock' | 'out_of_stock'; availableStock: number }

function blockingProblems(lines: FulfillableLine[]): LineProblem[] {
  const problems: LineProblem[] = []
  for (const line of lines) {
    if (!line.productActive) {
      problems.push({ slug: line.slug, name: line.name, reason: 'inactive', availableStock: line.availableStock })
    } else if (line.availableStock === 0) {
      problems.push({ slug: line.slug, name: line.name, reason: 'out_of_stock', availableStock: 0 })
    } else if (line.quantity > line.availableStock) {
      problems.push({
        slug: line.slug,
        name: line.name,
        reason: 'insufficient_stock',
        availableStock: line.availableStock,
      })
    }
  }
  return problems
}

function totalsFor(lines: FulfillableLine[]) {
  const items = lines.map((line) => ({
    ...line,
    lineTotalCents: line.unitPriceCents * line.quantity,
  }))
  const subtotalCents = items.reduce((sum, line) => sum + line.lineTotalCents, 0)
  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0)
  return { items, subtotalCents, itemCount }
}

function emptySummary(): CheckoutSummary {
  return {
    items: [],
    itemCount: 0,
    subtotalCents: 0,
    totalCents: 0,
    currency: COMMERCE_CURRENCY,
    hasUnavailableItems: false,
    checkoutable: false,
  }
}

async function readSummary(
  db: D1Database,
  cartId: number,
): Promise<CheckoutSummary> {
  const rows = await db
    .prepare(
      `SELECT
         ci.id,
         ci.product_id,
         p.slug,
         p.name,
         p.price_cents,
         ci.quantity,
         p.active AS product_active,
         i.quantity AS available_stock,
         i.low_stock_threshold AS low_stock_threshold
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN inventory i ON i.product_id = p.id
       WHERE ci.cart_id = ?
       ORDER BY ci.id ASC`,
    )
    .bind(cartId)
    .all<{
      id: number
      product_id: number
      slug: string
      name: string
      price_cents: number
      quantity: number
      product_active: number
      available_stock: number
      low_stock_threshold: number
    }>()

  const items = rows.results.map((row) => {
    const lineTotalCents = row.price_cents * row.quantity
    const available = row.product_active === 1 && row.available_stock >= row.quantity
    return {
      id: row.id,
      productId: row.product_id,
      slug: row.slug,
      name: row.name,
      unitPriceCents: row.price_cents,
      currency: COMMERCE_CURRENCY as typeof COMMERCE_CURRENCY,
      quantity: row.quantity,
      lineTotalCents,
      stockStatus:
        row.available_stock === 0
          ? ('out_of_stock' as const)
          : row.available_stock <= row.low_stock_threshold
            ? ('low_stock' as const)
            : ('in_stock' as const),
      productActive: row.product_active === 1,
      availableStock: row.available_stock,
      exceedsStock: row.quantity > row.available_stock,
      available,
    }
  })

  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0)
  const subtotalCents = items.reduce((sum, line) => sum + line.lineTotalCents, 0)
  const hasUnavailableItems = items.some((line) => !line.available)

  return {
    items,
    itemCount,
    subtotalCents,
    totalCents: subtotalCents,
    currency: COMMERCE_CURRENCY,
    hasUnavailableItems,
    checkoutable: items.length > 0 && !hasUnavailableItems,
  }
}

/** Generates an opaque public order reference: ORD- + 16 uppercase hex chars. */
function generateOrderReference(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return (
    'ORD-' +
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

interface CheckoutDetails {
  customerName: string
  customerEmail: string
  shippingLine: string
  shippingCity: string
  shippingPostcode: string
  paymentSimulation: PaymentSimulation
}

/** True when the string contains a C0/C1 control character or DEL. */
function containsControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true
    }
  }
  return false
}

function validateDetails(raw: unknown): { details?: CheckoutDetails; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { fields: { body: 'Expected a JSON object with the checkout details.' } }
  }
  const body = raw as Record<string, unknown>

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim().replace(/\s+/g, ' ') : ''
  if (!NAME_PATTERN.test(customerName)) {
    fields.customerName = 'Enter a name (2–100 letters).'
  }

  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : ''
  if (customerEmail.length === 0 || customerEmail.length > 254 || !EMAIL_PATTERN.test(customerEmail)) {
    fields.customerEmail = 'Enter a valid email address.'
  }

  const shippingLineRaw = typeof body.shippingLine === 'string' ? body.shippingLine : ''
  if (containsControlCharacter(shippingLineRaw)) {
    fields.shippingLine = 'Enter a single-line street address (4–120 characters).'
  }
  const shippingLine = shippingLineRaw.trim().replace(/\s+/g, ' ')
  if (!fields.shippingLine && !LINE_PATTERN.test(shippingLine)) {
    fields.shippingLine = 'Enter a street address (4–120 characters).'
  }

  const shippingCity =
    typeof body.shippingCity === 'string' ? body.shippingCity.trim().replace(/\s+/g, ' ') : ''
  if (!CITY_PATTERN.test(shippingCity)) {
    fields.shippingCity = 'Enter a city (2–80 letters).'
  }

  const shippingPostcode =
    typeof body.shippingPostcode === 'string' ? body.shippingPostcode.trim().toUpperCase() : ''
  if (!POSTCODE_PATTERN.test(shippingPostcode)) {
    fields.shippingPostcode = 'Enter a postcode (3–12 letters, digits, spaces or dashes).'
  }

  const rawPayment = body.paymentSimulation
  const paymentSimulation =
    typeof rawPayment === 'string' && (PAYMENT_SIMULATIONS as readonly string[]).includes(rawPayment)
      ? (rawPayment as PaymentSimulation)
      : null
  if (!paymentSimulation) {
    fields.paymentSimulation = 'Choose a simulated payment outcome: approved or declined.'
  }

  if (Object.keys(fields).length > 0) {
    return { fields }
  }
  return {
    details: {
      customerName,
      customerEmail,
      shippingLine,
      shippingCity,
      shippingPostcode,
      paymentSimulation: paymentSimulation!,
    },
    fields,
  }
}

function validateIdempotencyKey(raw: unknown): string | null | 'invalid' {
  if (raw === undefined || raw === null) {
    return null
  }
  if (typeof raw !== 'string') {
    return 'invalid'
  }
  const trimmed = raw.trim()
  return IDEMPOTENCY_KEY_PATTERN.test(trimmed) ? trimmed : 'invalid'
}

async function requestHashFor(details: CheckoutDetails): Promise<string> {
  const canonical = JSON.stringify({
    v: 1,
    customerName: details.customerName,
    customerEmail: details.customerEmail,
    shippingLine: details.shippingLine,
    shippingCity: details.shippingCity,
    shippingPostcode: details.shippingPostcode,
    paymentSimulation: details.paymentSimulation,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

interface IdempotencyRow {
  request_hash: string
  outcome: 'approved' | 'declined'
  order_id: number | null
}

async function findIdempotencyRecord(
  db: D1Database,
  sessionId: number,
  key: string,
): Promise<IdempotencyRow | null> {
  return db
    .prepare(
      'SELECT request_hash, outcome, order_id FROM checkout_idempotency WHERE session_id = ? AND idempotency_key = ?',
    )
    .bind(sessionId, key)
    .first<IdempotencyRow>()
}

export async function orderDetailById(
  db: D1Database,
  orderId: number,
): Promise<OrderDetail | null> {
  const order = await db
    .prepare(
      `SELECT o.reference, o.status, o.payment_status, o.customer_name, o.customer_email,
              o.shipping_line, o.shipping_city, o.shipping_postcode,
              o.subtotal_cents, o.total_cents, o.created_at,
              oc.created_at AS cancelled_at
       FROM orders o
       LEFT JOIN order_cancellations oc ON oc.order_id = o.id
       WHERE o.id = ?`,
    )
    .bind(orderId)
    .first<{
      reference: string
      status: OrderStatus
      payment_status: OrderPaymentStatus
      customer_name: string
      customer_email: string
      shipping_line: string
      shipping_city: string
      shipping_postcode: string
      subtotal_cents: number
      total_cents: number
      created_at: string
      cancelled_at: string | null
    }>()

  if (!order) {
    return null
  }

  const items = await db
    .prepare(
      `SELECT id, product_id, product_slug, product_name, unit_price_cents, quantity, line_total_cents
       FROM order_items WHERE order_id = ? ORDER BY id ASC`,
    )
    .bind(orderId)
    .all<{
      id: number
      product_id: number | null
      product_slug: string
      product_name: string
      unit_price_cents: number
      quantity: number
      line_total_cents: number
    }>()

  const snapshots: OrderItemSnapshot[] = items.results.map((item) => ({
    id: item.id,
    productId: item.product_id,
    productSlug: item.product_slug,
    productName: item.product_name,
    unitPriceCents: item.unit_price_cents,
    currency: COMMERCE_CURRENCY,
    quantity: item.quantity,
    lineTotalCents: item.line_total_cents,
  }))

  const itemCount = snapshots.reduce((sum, item) => sum + item.quantity, 0)

  return {
    reference: order.reference,
    // 'placed' is all the orders table ever stores; cancellation lives in
    // order_cancellations (append-only) and is derived here.
    status: order.cancelled_at ? 'cancelled' : 'placed',
    paymentStatus: order.payment_status,
    itemCount,
    totalCents: order.total_cents,
    currency: COMMERCE_CURRENCY,
    createdAt: order.created_at,
    cancelledAt: order.cancelled_at,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    shippingLine: order.shipping_line,
    shippingCity: order.shipping_city,
    shippingPostcode: order.shipping_postcode,
    subtotalCents: order.subtotal_cents,
    items: snapshots,
  }
}

export const checkoutRoutes = new Hono<AppEnv>()

checkoutRoutes.get('/checkout', async (c) => {
  const session = await resolveCheckoutSession(c)
  if (!session) {
    return c.json(emptySummary())
  }
  return c.json(await readSummary(c.env.DB, session.cartId))
})

checkoutRoutes.post('/checkout', async (c) => {
  const body = await c.req.json().catch(() => null)
  const { details, fields } = validateDetails(body)
  if (!details) {
    return errorJson(c, 400, 'invalid_request', 'Check the highlighted fields and try again.', {
      fields,
    })
  }

  const headerKey = validateIdempotencyKey(c.req.header('Idempotency-Key'))
  const bodyKey = validateIdempotencyKey(
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).idempotencyKey
      : undefined,
  )
  const rawKey = headerKey !== null && headerKey !== 'invalid' ? headerKey : bodyKey
  if (headerKey === 'invalid' || bodyKey === 'invalid') {
    return errorJson(
      c,
      400,
      'invalid_request',
      'Idempotency-Key must be 8–128 characters of letters, digits, dashes or underscores.',
    )
  }
  const idempotencyKey =
    rawKey ??
    `iks-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')}`

  const session = await resolveCheckoutSession(c)
  if (!session) {
    return errorJson(
      c,
      422,
      'empty_cart',
      'Your cart is empty — add something from the shop before checking out.',
    )
  }

  // Attach the synthetic customer explicitly, and only when the browser is
  // signed in to an ACTIVE account. Orders placed before sign-in keep
  // customer_id NULL and are never silently adopted by a later login.
  const customerResolution = await resolveCustomerContext(c)
  const customerId =
    customerResolution.kind === 'ok' && customerResolution.customer.status === 'active'
      ? customerResolution.customer.id
      : null

  const lines = await readFulfillableLines(c.env.DB, session.cartId)

  const requestHash = await requestHashFor(details)

  // Idempotency pre-check runs BEFORE the empty-cart rejection: after a
  // successful placement the cart is legitimately empty, and a retry of the
  // same submission must replay the original outcome, not 422.
  const existing = await findIdempotencyRecord(c.env.DB, session.sessionId, idempotencyKey)
  if (existing) {
    return replayResponse(c, existing, requestHash)
  }

  if (lines.length === 0) {
    return errorJson(
      c,
      422,
      'empty_cart',
      'Your cart is empty — add something from the shop before checking out.',
    )
  }

  const problems = blockingProblems(lines)
  if (problems.length > 0) {
    return errorJson(
      c,
      422,
      'cart_unavailable',
      'Some lines can no longer be fulfilled. Adjust the cart and try again.',
      { lines: problems },
    )
  }

  const { items, subtotalCents } = totalsFor(lines)
  const totalCents = subtotalCents

  if (details.paymentSimulation === 'declined') {
    // Deterministic simulated decline: nothing is ordered, stock stays
    // untouched, cart stays untouched. The attempt is recorded so a retry
    // with the same key replays this outcome instead of re-executing.
    try {
      await c.env.DB.prepare(
        `INSERT INTO checkout_idempotency (session_id, idempotency_key, request_hash, outcome, order_id)
         VALUES (?, ?, ?, 'declined', NULL)`,
      )
        .bind(session.sessionId, idempotencyKey, requestHash)
        .run()
    } catch {
      const raced = await findIdempotencyRecord(c.env.DB, session.sessionId, idempotencyKey)
      if (raced) {
        return replayResponse(c, raced, requestHash)
      }
      throw new Error('Checkout idempotency record could not be written')
    }
    return errorJson(
      c,
      422,
      'payment_declined',
      'The simulated payment was declined. No order was placed, no stock was reserved and your cart is unchanged.',
      { paymentSimulation: 'declined' },
    )
  }

  const reference = generateOrderReference()

  const decrementStatements = items.map((line) => ({
    sql: 'UPDATE inventory SET quantity = quantity - ? WHERE product_id = ?',
    params: [line.quantity, line.productId],
  }))

  const statements = [
    {
      sql: `INSERT INTO orders (
              session_id, reference, status, payment_status,
              customer_name, customer_email, shipping_line, shipping_city, shipping_postcode,
              subtotal_cents, total_cents, customer_id
            ) VALUES (?, ?, 'placed', 'approved', ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        session.sessionId,
        reference,
        details.customerName,
        details.customerEmail,
        details.shippingLine,
        details.shippingCity,
        details.shippingPostcode,
        subtotalCents,
        totalCents,
        customerId,
      ],
    },
    ...items.map((line) => ({
      sql: `INSERT INTO order_items (
              order_id, product_id, product_slug, product_name,
              unit_price_cents, quantity, line_total_cents
            ) VALUES ((SELECT id FROM orders WHERE reference = ?), ?, ?, ?, ?, ?, ?)`,
      params: [
        reference,
        line.productId,
        line.slug,
        line.name,
        line.unitPriceCents,
        line.quantity,
        line.lineTotalCents,
      ],
    })),
    ...decrementStatements,
    {
      sql: 'DELETE FROM cart_items WHERE cart_id = ?',
      params: [session.cartId],
    },
    {
      sql: `INSERT INTO checkout_idempotency (session_id, idempotency_key, request_hash, outcome, order_id)
            VALUES (?, ?, ?, 'approved', (SELECT id FROM orders WHERE reference = ?))`,
      params: [session.sessionId, idempotencyKey, requestHash, reference],
    },
  ]

  try {
    await c.env.DB.batch(
      statements.map((stmt) => c.env.DB.prepare(stmt.sql).bind(...stmt.params)),
    )
  } catch (error) {
    // The batch rolled back in full — no partial order, no stock movement,
    // cart intact. Work out why, honestly.
    const raced = await findIdempotencyRecord(c.env.DB, session.sessionId, idempotencyKey)
    if (raced) {
      return replayResponse(c, raced, requestHash)
    }
    const rechecked = await readFulfillableLines(c.env.DB, session.cartId)
    const nowBlocking = blockingProblems(rechecked)
    if (nowBlocking.length > 0) {
      return errorJson(
        c,
        422,
        'cart_unavailable',
        'Some lines can no longer be fulfilled. Adjust the cart and try again.',
        { lines: nowBlocking },
      )
    }
    console.error('[api] Checkout batch failed', error)
    return errorJson(c, 500, 'internal_error', 'The order could not be placed. Please try again.')
  }

  const created = await c.env.DB.prepare('SELECT id FROM orders WHERE reference = ?')
    .bind(reference)
    .first<{ id: number }>()
  const order = created ? await orderDetailById(c.env.DB, created.id) : null
  if (!order) {
    console.error('[api] Order missing immediately after commit', reference)
    return errorJson(c, 500, 'internal_error', 'The order could not be read back.')
  }
  return c.json(order, 201)
})

/** Replays a previously recorded idempotency outcome, or rejects payload drift. */
function replayResponse(
  c: Context<AppEnv>,
  record: IdempotencyRow,
  requestHash: string,
) {
  if (record.request_hash !== requestHash) {
    return errorJson(
      c,
      409,
      'idempotency_conflict',
      'That Idempotency-Key was already used for a different checkout. Use a new key for a new order.',
    )
  }
  c.header('Idempotent-Replay', 'true')
  if (record.outcome === 'approved' && record.order_id !== null) {
    return orderDetailById(c.env.DB, record.order_id).then((order) => {
      if (!order) {
        return errorJson(c, 500, 'internal_error', 'The original order could not be read back.')
      }
      return c.json(order, 201)
    })
  }
  // 'declined' outcome (or a missing order row): replay the decline verbatim.
  return errorJson(
    c,
    422,
    'payment_declined',
    'The simulated payment was declined. No order was placed, no stock was reserved and your cart is unchanged.',
    { paymentSimulation: 'declined' },
  )
}

checkoutRoutes.get('/orders', async (c) => {
  const session = await resolveCheckoutSession(c)
  if (!session) {
    return c.json({ data: [] } satisfies OrderListResponse)
  }

  const rows = await c.env.DB.prepare(
    `SELECT o.reference, o.status, o.payment_status, o.total_cents, o.created_at,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count,
            oc.created_at AS cancelled_at
     FROM orders o
     LEFT JOIN order_cancellations oc ON oc.order_id = o.id
     WHERE o.session_id = ?
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT ${MAX_LIST_LIMIT}`,
  )
    .bind(session.sessionId)
    .all<{
      reference: string
      status: OrderStatus
      payment_status: OrderPaymentStatus
      total_cents: number
      created_at: string
      item_count: number
      cancelled_at: string | null
    }>()

  const data: OrderSummary[] = rows.results.map((row) => ({
    reference: row.reference,
    status: row.cancelled_at ? 'cancelled' : 'placed',
    paymentStatus: row.payment_status,
    itemCount: row.item_count,
    totalCents: row.total_cents,
    currency: COMMERCE_CURRENCY,
    createdAt: row.created_at,
  }))

  return c.json({ data } satisfies OrderListResponse)
})

checkoutRoutes.get('/orders/:reference', async (c) => {
  const reference = c.req.param('reference') ?? ''
  if (!ORDER_REFERENCE_PATTERN.test(reference)) {
    return errorJson(
      c,
      400,
      'invalid_request',
      'An order reference looks like ORD- followed by 16 hexadecimal characters.',
    )
  }

  const session = await resolveCheckoutSession(c)
  if (!session) {
    return errorJson(c, 404, 'not_found', 'Order not found.')
  }

  const order = await c.env.DB.prepare(
    'SELECT id FROM orders WHERE reference = ? AND session_id = ?',
  )
    .bind(reference, session.sessionId)
    .first<{ id: number }>()

  if (!order) {
    // Unknown reference and foreign session alike — never reveal which.
    return errorJson(c, 404, 'not_found', 'Order not found.')
  }

  const detail = await orderDetailById(c.env.DB, order.id)
  if (!detail) {
    return errorJson(c, 500, 'internal_error', 'The order could not be read.')
  }
  return c.json(detail)
})

/**
 * Cancel a placed order: `placed → cancelled`, exactly once, restoring stock.
 *
 * Cancellation is recorded as an append-only row in `order_cancellations`
 * (PK on order_id) rather than by mutating `orders.status`, so the order
 * snapshot stays immutable. The cancelling batch inserts the marker row
 * FIRST: any retry or concurrent cancel violates the primary key, the whole
 * batch rolls back, and the handler replays the already-cancelled order
 * verbatim (HTTP 200, no second stock restore). Stock restore and the
 * audit trail (inventory_adjustments, reason 'order_cancellation') commit
 * in the same all-or-nothing batch — a partial cancel is impossible.
 *
 * Authorization mirrors the read policy and is deliberately identical to a
 * read plus an ownership check: the practice session that placed the order,
 * or (when signed in as an active account) the customer that owns it.
 * Unknown, foreign and unauthorised references alike answer 404 — existence
 * is never revealed.
 */
checkoutRoutes.post('/orders/:reference/cancel', async (c) => {
  const reference = c.req.param('reference') ?? ''
  if (!ORDER_REFERENCE_PATTERN.test(reference)) {
    return errorJson(
      c,
      400,
      'invalid_request',
      'An order reference looks like ORD- followed by 16 hexadecimal characters.',
    )
  }

  const session = await resolveCheckoutSession(c)
  const customerResolution = await resolveCustomerContext(c)
  const signedInActiveCustomer =
    customerResolution.kind === 'ok' && customerResolution.customer.status === 'active'
      ? customerResolution.customer
      : null

  const row = await c.env.DB.prepare(
    'SELECT id, session_id, customer_id FROM orders WHERE reference = ?',
  )
    .bind(reference)
    .first<{ id: number; session_id: number; customer_id: number | null }>()

  const sessionOwns = session !== null && row !== null && row.session_id === session.sessionId
  const customerOwns =
    row !== null &&
    signedInActiveCustomer !== null &&
    row.customer_id !== null &&
    row.customer_id === signedInActiveCustomer.id

  if (!row || (!sessionOwns && !customerOwns)) {
    // Unknown reference, foreign session and foreign customer alike.
    return errorJson(c, 404, 'not_found', 'Order not found.')
  }

  const items = await c.env.DB.prepare(
    'SELECT product_id, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC',
  )
    .bind(row.id)
    .all<{ product_id: number | null; quantity: number }>()

  // Items whose product row is gone (product_id SET NULL) cannot restock —
  // there is no inventory row to restore. Everything else restores exactly.
  const restockable = items.results.filter(
    (item): item is { product_id: number; quantity: number } => item.product_id !== null,
  )

  const actorCustomerId = signedInActiveCustomer?.id ?? null
  const actorSessionId = session?.sessionId ?? null

  const statements = [
    {
      sql: `INSERT INTO order_cancellations (order_id, session_id, actor_customer_id)
            VALUES (?, ?, ?)`,
      params: [row.id, actorSessionId, actorCustomerId],
    },
    ...restockable.map((item) => ({
      sql: 'UPDATE inventory SET quantity = quantity + ? WHERE product_id = ?',
      params: [item.quantity, item.product_id],
    })),
    ...restockable.map((item) => ({
      sql: `INSERT INTO inventory_adjustments
              (product_id, quantity_delta, reason, note, actor_customer_id, actor_session_id, order_id)
            VALUES (?, ?, 'order_cancellation', NULL, ?, ?, ?)`,
      params: [item.product_id, item.quantity, actorCustomerId, actorSessionId, row.id],
    })),
  ]

  try {
    await c.env.DB.batch(
      statements.map((stmt) => c.env.DB.prepare(stmt.sql).bind(...stmt.params)),
    )
  } catch (error) {
    // The whole batch rolled back. If the marker row exists now, this cancel
    // is a retry (or lost the race against a twin) — replay it idempotently.
    const cancellation = await c.env.DB.prepare(
      'SELECT created_at FROM order_cancellations WHERE order_id = ?',
    )
      .bind(row.id)
      .first<{ created_at: string }>()
    if (cancellation) {
      const detail = await orderDetailById(c.env.DB, row.id)
      if (!detail) {
        return errorJson(c, 500, 'internal_error', 'The order could not be read back.')
      }
      return c.json(detail, 200)
    }
    console.error('[api] Cancellation batch failed', error)
    return errorJson(c, 500, 'internal_error', 'The order could not be cancelled. Please try again.')
  }

  const detail = await orderDetailById(c.env.DB, row.id)
  if (!detail) {
    console.error('[api] Order missing immediately after cancellation', reference)
    return errorJson(c, 500, 'internal_error', 'The order could not be read back.')
  }
  return c.json(detail, 200)
})
