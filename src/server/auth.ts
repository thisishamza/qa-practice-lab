// Authentication and protected account routes (P3-M5) — synthetic customers
// only. This is a QA training simulation, NOT a production identity system:
// no registration, password reset, MFA, roles beyond customer|staff, or
// external identity provider exists or is intended.
//
// Endpoints (mounted under /api/v1):
//   GET  /api/v1/auth/accounts             — safe list of the demo accounts
//   POST /api/v1/auth/login                — sign in a synthetic customer
//   POST /api/v1/auth/logout               — sign out (idempotent)
//   GET  /api/v1/auth/me                   — current customer or 401
//   GET  /api/v1/account                   — own full profile (protected)
//   GET  /api/v1/account/orders            — own order history (protected)
//   GET  /api/v1/account/orders/:reference — own order details (protected)
//
// Security model:
// - Bearer material lives ONLY in the `mpl_customer` cookie (HttpOnly,
//   SameSite=Strict, Path=/, 8h Max-Age, Secure over HTTPS). Only the
//   SHA-256 hash of the token is stored, in `customer_sessions`, bound to
//   the practice session that established it.
// - The client never supplies a customer id as proof of identity; every
//   resolution goes Cookie → hash → join → practice-session binding check.
// - Login errors are indistinguishable: unknown email and wrong password
//   both answer 401 `invalid_credentials` with the same message, and the
//   unknown-email path still performs a PBKDF2 verification against a
//   dummy hash so response timing does not enumerate accounts.
// - Suspended accounts cannot sign in, and a customer suspended mid-session
//   gets 403 `account_suspended` from protected endpoints.
// - Ownership policy (documented in README.md):
//     account order history  = orders with this customer_id (any practice session)
//     account order details  = orders with BOTH reference AND customer_id
//   Unknown reference and not-owned reference answer the identical 404
//   envelope, concealing existence — consistent with the session-scoped
//   /api/v1/orders/:reference policy. 401 = not authenticated, 403 =
//   authenticated but forbidden (suspended), 404 = concealed/missing.
// - No response ever carries password hashes, token hashes or raw tokens.

import { Hono, type Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import {
  COMMERCE_CURRENCY,
  type AuthResponse,
  type CustomerRole,
  type CustomerStatus,
  type DemoAccount,
  type DemoAccountListResponse,
  type OrderPaymentStatus,
  type OrderStatus,
  type OrderSummary,
  type AccountOrderListResponse,
} from '../shared/commerce'
import type { AppEnv } from './app'
import { isDefectActive } from './defects'
import { ORDER_REFERENCE_PATTERN, orderDetailById } from './checkout'
import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_TTL_SECONDS,
  DUMMY_PASSWORD_HASH,
  applyCustomerLoginCookie,
  customerCookieOptions,
  generateCustomerToken,
  hashCustomerToken,
  isSecureRequest,
  requireActiveCustomer,
  resolveOrCreatePracticeSession,
  toCustomerProfile,
  verifyPassword,
  type CustomerRow,
} from './customer'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from './session'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_LIST_LIMIT = 50

function errorJson(
  c: Context<AppEnv>,
  status: 400 | 401 | 403 | 404 | 500,
  error: string,
  message: string,
) {
  return c.json({ error, message }, status)
}

export const authRoutes = new Hono<AppEnv>()

/** Safe demo-account directory for the training login UI. Never returns secrets. */
authRoutes.get('/auth/accounts', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT name, email, role, status FROM customers
     ORDER BY id ASC`,
  ).all<{ name: string; email: string; role: CustomerRole; status: CustomerStatus }>()

  const data: DemoAccount[] = rows.results.map((row) => ({
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
  }))
  return c.json({ data } satisfies DemoAccountListResponse)
})

interface LoginBody {
  email: string
  password: string
}

function parseLoginBody(raw: unknown): LoginBody | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null
  }
  const body = raw as Record<string, unknown>
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!EMAIL_PATTERN.test(email) || password.length === 0 || password.length > 256) {
    return null
  }
  return { email, password }
}

authRoutes.post('/auth/login', async (c) => {
  const raw = await c.req.json().catch(() => null)
  const body = parseLoginBody(raw)
  if (!body) {
    return errorJson(
      c,
      400,
      'invalid_request',
      'Provide a valid email address and the synthetic account password.',
    )
  }

  // Resolve (or lazily mint) the practice session this customer session will
  // be bound to. Login therefore always leaves the browser with a live pair
  // of cookies.
  const { practiceSessionId, newSessionCookie } = await resolveOrCreatePracticeSession(c)
  const secure = isSecureRequest(c.req.url)
  if (newSessionCookie) {
    setCookie(
      c,
      SESSION_COOKIE,
      newSessionCookie,
      {
        httpOnly: true,
        path: '/',
        sameSite: 'Strict' as const,
        maxAge: SESSION_TTL_SECONDS,
        secure,
      },
    )
  }

  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE email = ?')
    .bind(body.email)
    .first<CustomerRow>()

  // Unknown emails verify against a dummy digest so timing and payload do
  // not reveal account existence.
  const passwordOk = await verifyPassword(
    body.password,
    customer?.password_hash ?? DUMMY_PASSWORD_HASH,
  )
  if (!customer || !passwordOk) {
    return errorJson(
      c,
      401,
      'invalid_credentials',
      'The email address or password is not correct.',
    )
  }
  if (customer.status !== 'active') {
    return errorJson(
      c,
      403,
      'account_suspended',
      'This synthetic training account is suspended. Try one of the other demo accounts.',
    )
  }

  // Fixation protection: rotate. Any customer session bound to this
  // practice session is destroyed before the fresh one is minted, so a
  // pre-existing browser token can never remain valid after sign-in.
  await c.env.DB.prepare('DELETE FROM customer_sessions WHERE practice_session_id = ?')
    .bind(practiceSessionId)
    .run()

  const token = generateCustomerToken()
  const tokenHash = await hashCustomerToken(token)
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_SECONDS * 1000).toISOString()
  await c.env.DB.prepare(
    `INSERT INTO customer_sessions (token_hash, customer_id, practice_session_id, expires_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(tokenHash, customer.id, practiceSessionId, expiresAt)
    .run()

  applyCustomerLoginCookie(c, token)
  return c.json({ customer: toCustomerProfile(customer) } satisfies AuthResponse)
})

authRoutes.post('/auth/logout', async (c) => {
  const presented = getCookie(c, CUSTOMER_COOKIE)
  if (presented && /^[a-f0-9]{32}$/.test(presented)) {
    const tokenHash = await hashCustomerToken(presented)
    await c.env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run()
  }
  setCookie(c, CUSTOMER_COOKIE, '', customerCookieOptions(isSecureRequest(c.req.url), 0))
  return c.json({ ok: true })
})

async function meHandler(c: Context<AppEnv>) {
  const guard = await requireActiveCustomer(c)
  if (guard.kind === 'error') {
    return guard.response
  }
  return c.json({ customer: toCustomerProfile(guard.customer) } satisfies AuthResponse)
}

authRoutes.get('/auth/me', meHandler)
authRoutes.get('/account', meHandler)

authRoutes.get('/account/orders', async (c) => {
  const guard = await requireActiveCustomer(c)
  if (guard.kind === 'error') {
    return guard.response
  }
  const rows = await c.env.DB.prepare(
    `SELECT o.reference, o.status, o.payment_status, o.total_cents, o.created_at,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count,
            oc.created_at AS cancelled_at
     FROM orders o
     LEFT JOIN order_cancellations oc ON oc.order_id = o.id
     WHERE o.customer_id = ?
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT ${MAX_LIST_LIMIT}`,
  )
    .bind(guard.customer.id)
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
  return c.json({ data } satisfies AccountOrderListResponse)
})

authRoutes.get('/account/orders/:reference', async (c) => {
  const reference = c.req.param('reference') ?? ''
  if (!ORDER_REFERENCE_PATTERN.test(reference)) {
    return errorJson(
      c,
      400,
      'invalid_request',
      'An order reference looks like ORD- followed by 16 hexadecimal characters.',
    )
  }
  const guard = await requireActiveCustomer(c)
  if (guard.kind === 'error') {
    return guard.response
  }
  // BUG-HUNT DEFECT AUTHZ-001 (hunt-authz-001): in a bug-hunt session
  // carrying this defect, the customer_id predicate is dropped from the
  // lookup, so any active customer can read any existing order by its
  // reference. Clean mode always requires the caller's customer_id.
  const ownershipDropped = await isDefectActive(c, 'AUTHZ-001')
  const order = ownershipDropped
    ? await c.env.DB.prepare('SELECT id FROM orders WHERE reference = ?')
        .bind(reference)
        .first<{ id: number }>()
    : await c.env.DB.prepare(
        'SELECT id FROM orders WHERE reference = ? AND customer_id = ?',
      )
        .bind(reference, guard.customer.id)
        .first<{ id: number }>()

  if (!order) {
    // Unknown reference and not-owned reference alike — conceal existence,
    // consistent with the session-scoped confirmation endpoint.
    return errorJson(c, 404, 'not_found', 'Order not found.')
  }
  const detail = await orderDetailById(c.env.DB, order.id)
  if (!detail) {
    return errorJson(c, 500, 'internal_error', 'The order could not be read.')
  }
  return c.json(detail)
})
