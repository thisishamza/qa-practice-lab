// Synthetic customer identities and authentication simulation (P3-M5).
//
// There are TWO distinct, independent concepts in this application:
//
//   Practice session (`mpl_session` cookie, see session.ts)
//     - Opaque 128-bit token; only its SHA-256 hash is stored in
//       `practice_sessions`. Owns the cart and unassociated orders.
//       Remains the isolation boundary for exercises. Deleting the cookie
//       starts a fresh anonymous practice session.
//
//   Simulated customer identity (`mpl_customer` cookie, this module)
//     - Represents a fictional Meridian Outfitters customer signing in for
//       the QA training scenario. The `mpl_customer` token is a separate
//       opaque 128-bit token; only its SHA-256 hash is stored in
//       `customer_sessions`, which also records the practice session that
//       established it. The two cookies are never interchangeable: a live
//       customer session is honoured only while its practice session is
//       live in the same browser. A customer signed in on one practice
//       session is NOT signed in on another.
//
//   Practice API token (`Authorization: Bearer …`, see apiTokens.ts)
//     - A separate, synthetic opaque 256-bit credential minted by
//       `POST /api/v1/auth/token`. SHA-256 hash at rest in `api_tokens`;
//       NOT bound to a practice session (an API credential must outlive
//       the tab that minted it) but bound to the customer row. When a
//       Bearer header is present it wins over the cookie; when it is
//       absent (or malformed) the cookie pair is used exactly as before.
//       Roles and status come from the stored customer row in both paths —
//       never from the credential. Expired Bearer tokens answer
//       401 token_expired; revoked/unknown/malformed credentials answer
//       401 unauthorized.
//
// Token lifecycle:
//   - Login mints a BRAND-NEW token and inserts it (hashed) together with a
//     fresh expiry. Before inserting, every customer_sessions row for the
//     current practice session is deleted, so the token presented at login
//     can never be replayed and fixated sessions are impossible: a token
//     held by the browser before sign-in is destroyed, not adopted.
//   - Logout deletes the presented token's row (idempotent) and clears the
//     cookie. Expired rows are deleted on first contact.
//   - Cookies: HttpOnly, SameSite=Strict, Path=/, Max-Age = 8 hours,
//     `Secure` only over HTTPS (same convention as mpl_session).
//   - Tokens and hashes are never returned to the client; hashes are never
//     leaves this module's queries.
//
// Passwords: PBKDF2-HMAC-SHA256, 100,000 iterations, 8-byte fixed salts
// (deterministic fixtures for repeatable migrations; see
// db/migrations/0005_customers.sql). Verification uses Web Crypto
// (crypto.subtle), which the Cloudflare Workers runtime provides. Unknown
// emails are verified against a fixed dummy hash so the response time and
// the error payload do not reveal whether an account exists.
//
// Suspended customers (status = 'suspended') cannot sign in (403
// account_suspended); if a customer is suspended mid-session, protected
// endpoints answer 403 as well. Guests always get 401 from protected
// endpoints.

import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { AppEnv } from './app'
import type { CustomerProfile, CustomerRole, CustomerStatus } from '../shared/commerce'
import {
  SESSION_COOKIE,
  createSessionWithCart,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'
import { findLiveApiToken, hashApiToken, isApiTokenFormat } from './apiTokens'

export const CUSTOMER_COOKIE = 'mpl_customer'
export const CUSTOMER_SESSION_TTL_SECONDS = 8 * 60 * 60

const TOKEN_PATTERN = /^[a-f0-9]{32}$/
/** Dummy hash verified for unknown emails so timing cannot enumerate accounts. */
const DUMMY_PASSWORD_HASH =
  'pbkdf2:100000:0a1b2c3d4e5f6a7b:f86bff20be3eb6774bb2883cf88adb381450d3561a22cf35e35ebe873decc353'

export function generateCustomerToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashCustomerToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isCustomerTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}

export function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === 'https:'
}

export function customerCookieOptions(secure: boolean, maxAge: number) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'Strict' as const,
    maxAge,
    secure,
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison of two hex strings (best effort outside native code). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export interface CustomerRow {
  id: number
  email: string
  name: string
  password_hash: string
  role: CustomerRole
  status: CustomerStatus
  address_line: string
  address_city: string
  address_postcode: string
  created_at: string
}

export function toCustomerProfile(row: CustomerRow): CustomerProfile {
  return {
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    addressLine: row.address_line,
    addressCity: row.address_city,
    addressPostcode: row.address_postcode,
    memberSince: row.created_at,
  }
}

/**
 * Verifies a password against a stored `pbkdf2:<iterations>:<salt_hex>:<hash_hex>`
 * digest. Returns false for malformed digests so a corrupted row can never
 * authenticate anyone.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false
  }
  const iterations = Number.parseInt(parts[1], 10)
  const saltHex = parts[2]
  const expectedHex = parts[3]
  if (
    !Number.isFinite(iterations) ||
    iterations < 1 ||
    iterations > 1_000_000 ||
    saltHex.length === 0 ||
    saltHex.length % 2 !== 0 ||
    expectedHex.length !== 64 ||
    !/^[0-9a-f]+$/i.test(saltHex) ||
    !/^[0-9a-f]{64}$/i.test(expectedHex)
  ) {
    return false
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex) as BufferSource, iterations },
    key,
    256,
  )
  return timingSafeEqualHex(bytesToHex(new Uint8Array(bits)), expectedHex.toLowerCase())
}

export { DUMMY_PASSWORD_HASH }

interface CustomerSessionRow {
  customer_session_id: number
  practice_session_id: number
  expires_at: string
  customer_id: number
}

/** Looks up the caller's live customer session. Expired rows are deleted in passing. */
async function findLiveCustomerSession(
  db: D1Database,
  tokenHash: string,
): Promise<{ customerSessionId: number; practiceSessionId: number; customer: CustomerRow } | null> {
  const now = new Date().toISOString()
  const row = await db
    .prepare(
      'SELECT id AS customer_session_id, practice_session_id, customer_id, expires_at FROM customer_sessions WHERE token_hash = ?',
    )
    .bind(tokenHash)
    .first<CustomerSessionRow>()

  if (!row) {
    return null
  }
  if (row.expires_at <= now) {
    await db.prepare('DELETE FROM customer_sessions WHERE id = ?').bind(row.customer_session_id).run()
    return null
  }
  const customer = await db
    .prepare('SELECT * FROM customers WHERE id = ?')
    .bind(row.customer_id)
    .first<CustomerRow>()
  if (!customer) {
    // Customer row vanished — drop the orphaned session rather than trust it.
    await db.prepare('DELETE FROM customer_sessions WHERE id = ?').bind(row.customer_session_id).run()
    return null
  }
  return {
    customerSessionId: row.customer_session_id,
    practiceSessionId: row.practice_session_id,
    customer,
  }
}

export type CustomerResolution =
  | { kind: 'ok'; customer: CustomerRow; practiceSessionId: number | null }
  | { kind: 'none'; clearCookie: boolean }
  /** A well-formed Bearer token was presented but has expired (401 token_expired). */
  | { kind: 'bearer-expired' }

/**
 * Resolves an `Authorization: Bearer` credential against `api_tokens`.
 * Returns 'ok' with the bound customer row, 'expired' when the presented
 * token is past its TTL, or 'unusable' in every other failure mode. Roles
 * and status come from the database-backed customer row — never from the
 * token or any client-supplied claim.
 */
async function resolveApiToken(
  db: D1Database,
  presented: string,
): Promise<{ kind: 'ok'; customer: CustomerRow } | { kind: 'expired' } | { kind: 'unusable' }> {
  if (!isApiTokenFormat(presented)) {
    return { kind: 'unusable' }
  }
  const lookup = await findLiveApiToken(db, await hashApiToken(presented))
  if (lookup.kind === 'expired') {
    return { kind: 'expired' }
  }
  if (lookup.kind !== 'live') {
    return { kind: 'unusable' }
  }
  const customer = await db
    .prepare('SELECT * FROM customers WHERE id = ?')
    .bind(lookup.token.customerId)
    .first<CustomerRow>()
  if (!customer) {
    // Orphaned token (customer row vanished) — drop it rather than trust it.
    await db.prepare('DELETE FROM api_tokens WHERE id = ?').bind(lookup.token.id).run()
    return { kind: 'unusable' }
  }
  return { kind: 'ok', customer }
}

const BEARER_PATTERN = /^Bearer\s+(\S+)\s*$/i

/**
 * Resolves the caller's customer identity for this request. When an
 * `Authorization: Bearer` header is present it is authoritative and the
 * cookie is never consulted; otherwise the cookie pair (`mpl_customer` +
 * `mpl_session`) is resolved exactly as before. An expired Bearer token
 * answers `bearer-expired`; any other Bearer failure answers `none` —
 * callers must NOT fall back to the cookie in either case (a presented
 * credential that cannot be honoured fails closed).
 */
export async function resolveCustomerContext(c: Context<AppEnv>): Promise<CustomerResolution> {
  const authHeader = c.req.header('Authorization')
  if (authHeader !== undefined) {
    const match = BEARER_PATTERN.exec(authHeader.trim())
    const presented = match?.[1]
    if (presented === undefined) {
      return { kind: 'none', clearCookie: false }
    }
    const resolved = await resolveApiToken(c.env.DB, presented)
    if (resolved.kind === 'expired') {
      return { kind: 'bearer-expired' }
    }
    if (resolved.kind !== 'ok') {
      return { kind: 'none', clearCookie: false }
    }
    // The Bearer token is not practice-session bound; when the browser also
    // presents a live practice session it is reused for audit attribution.
    const practiceCookie = getCookie(c, SESSION_COOKIE)
    let practiceSessionId: number | null = null
    if (practiceCookie && isTokenFormat(practiceCookie)) {
      const practice = await findLiveSession(c.env.DB, await hashSessionToken(practiceCookie))
      practiceSessionId = practice?.id ?? null
    }
    return { kind: 'ok', customer: resolved.customer, practiceSessionId }
  }

  const presented = getCookie(c, CUSTOMER_COOKIE)
  if (!presented || !isCustomerTokenFormat(presented)) {
    // Malformed tokens are treated as absent; a presented one is cleared.
    return { kind: 'none', clearCookie: presented !== undefined }
  }

  const practiceCookie = getCookie(c, SESSION_COOKIE)
  if (!practiceCookie || !isTokenFormat(practiceCookie)) {
    return { kind: 'none', clearCookie: true }
  }
  const practice = await findLiveSession(c.env.DB, await hashSessionToken(practiceCookie))
  if (!practice) {
    return { kind: 'none', clearCookie: true }
  }

  const live = await findLiveCustomerSession(c.env.DB, await hashCustomerToken(presented))
  if (!live) {
    return { kind: 'none', clearCookie: true }
  }
  if (live.practiceSessionId !== practice.id) {
    // Right customer token, wrong practice session — never valid here.
    return { kind: 'none', clearCookie: true }
  }
  return {
    kind: 'ok',
    customer: live.customer,
    practiceSessionId: practice.id,
  }
}

/** Clears a stale customer cookie when the presented one cannot be honoured. */
export function applyCustomerCookieClear(c: Context<AppEnv>) {
  setCookie(c, CUSTOMER_COOKIE, '', customerCookieOptions(isSecureRequest(c.req.url), 0))
}

/**
 * Shared guard for protected customer endpoints. Returns the active customer
 * or a ready-to-send error response:
 *   401 unauthorized       — no/invalid/revoked/cross-practice-session credential
 *   401 token_expired      — a presented Bearer token is past its TTL
 *   403 account_suspended  — the customer was suspended after sign-in
 */
export async function requireActiveCustomer(
  c: Context<AppEnv>,
): Promise<{ kind: 'ok'; customer: CustomerRow; practiceSessionId: number | null } | { kind: 'error'; response: Response }> {
  const resolution = await resolveCustomerContext(c)
  if (resolution.kind === 'bearer-expired') {
    return {
      kind: 'error',
      response: c.json(
        {
          error: 'token_expired',
          message:
            'This practice API token has expired. Mint a new one — there is no renewal flow by design.',
        },
        401,
      ),
    }
  }
  if (resolution.kind !== 'ok') {
    if (resolution.kind === 'none' && resolution.clearCookie) {
      applyCustomerCookieClear(c)
    }
    return {
      kind: 'error',
      response: c.json(
        { error: 'unauthorized', message: 'Sign in to access protected customer resources.' },
        401,
      ),
    }
  }
  if (resolution.customer.status !== 'active') {
    return {
      kind: 'error',
      response: c.json(
        {
          error: 'account_suspended',
          message: 'This synthetic training account is suspended and cannot access customer resources.',
        },
        403,
      ),
    }
  }
  return { kind: 'ok', customer: resolution.customer, practiceSessionId: resolution.practiceSessionId }
}

/**
 * Ensures a live practice session exists for the login flow: reuses the
 * caller's if any, otherwise mints a fresh one (with its cart) and returns
 * the raw token so the login response can carry the new `mpl_session` cookie.
 */
export async function resolveOrCreatePracticeSession(
  c: Context<AppEnv>,
): Promise<{ practiceSessionId: number; newSessionCookie?: string }> {
  const presented = getCookie(c, SESSION_COOKIE)
  if (presented && isTokenFormat(presented)) {
    const live = await findLiveSession(c.env.DB, await hashSessionToken(presented))
    if (live) {
      return { practiceSessionId: live.id }
    }
  }
  const fresh = await createSessionWithCart(c.env.DB)
  return { practiceSessionId: fresh.sessionId, newSessionCookie: fresh.token }
}

/** Sets the customer cookie after login. */
export function applyCustomerLoginCookie(c: Context<AppEnv>, token: string) {
  setCookie(
    c,
    CUSTOMER_COOKIE,
    token,
    customerCookieOptions(isSecureRequest(c.req.url), CUSTOMER_SESSION_TTL_SECONDS),
  )
}
