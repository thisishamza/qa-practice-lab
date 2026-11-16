// Synthetic practice API tokens (Phase 5, P5-M2) — CODE, not data.
//
// Tokens are opaque 256-bit credentials for the Meridian Outfitters
// synthetic environment. There is no JWT infrastructure here and none is
// intended: a token is a random handle whose SHA-256 hash is stored in
// `api_tokens` (migration 0011). The raw token is returned to the browser
// exactly once — in the 201 response to POST /api/v1/auth/token — and is
// never stored, logged, returned again or bundled into client code.
//
// Lifecycle:
//   - Mint binds the token to a customer (never to a practice session — an
//     API credential must outlive the tab that minted it). TTL is clamped
//     server-side to 15–900 seconds.
//   - Lookup (`findLiveApiToken`) mirrors sessions/customer-sessions: the
//     raw token's hash is looked up, expired rows are deleted in passing,
//     and revoked rows fail closed without being honoured.
//   - Logout deletes the caller's token rows (customer-scoped, deliberately
//     broad — documenting the behaviour), so a replayed Bearer token 401s
//     after sign-out in clean mode.
//   - The operator-invoked maintenance sweep purges expired/revoked rows.
//
// Resolution belongs to src/server/customer.ts (`resolveCustomerContext`),
// which prefers `Authorization: Bearer` when present and falls back to the
// `mpl_customer` cookie otherwise. Roles and permissions always come from
// the stored customer row — never from the token, a header or a claim.

export const API_TOKEN_TTL_MIN = 15
export const API_TOKEN_TTL_MAX = 900
export const API_TOKEN_TTL_DEFAULT = 900

const TOKEN_PATTERN = /^[a-f0-9]{64}$/

export function generateApiToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

export function isApiTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}

/**
 * Validates an `expiresInSeconds` body field and clamps it into the
 * approved 15–900 second range. `undefined`/`null` selects the default.
 * Anything that is not a finite number is rejected (caller answers 400).
 * Fractional values are truncated; out-of-range values are clamped.
 */
export function parseExpiresInSeconds(
  input: unknown,
): { ok: true; seconds: number } | { ok: false } {
  if (input === undefined || input === null) {
    return { ok: true, seconds: API_TOKEN_TTL_DEFAULT }
  }
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return { ok: false }
  }
  const truncated = Math.trunc(input)
  return {
    ok: true,
    seconds: Math.min(Math.max(truncated, API_TOKEN_TTL_MIN), API_TOKEN_TTL_MAX),
  }
}

export interface LiveApiToken {
  id: number
  customerId: number
  expiresAt: string
}

export type ApiTokenLookup =
  | { kind: 'live'; token: LiveApiToken }
  | { kind: 'expired' }
  | { kind: 'unknown' }

/**
 * Looks up a token by its SHA-256 hash. Expired rows are deleted in passing
 * (never returned); revoked rows are treated as unknown (fail closed) and
 * left for the maintenance sweep. A missing or malformed row answers
 * 'unknown' — the caller cannot distinguish why.
 */
export async function findLiveApiToken(
  db: D1Database,
  tokenHash: string,
): Promise<ApiTokenLookup> {
  const now = new Date().toISOString()
  const row = await db
    .prepare(
      'SELECT id, customer_id, expires_at, revoked_at FROM api_tokens WHERE token_hash = ?',
    )
    .bind(tokenHash)
    .first<{ id: number; customer_id: number; expires_at: string; revoked_at: string | null }>()

  if (!row) {
    return { kind: 'unknown' }
  }
  if (row.revoked_at !== null) {
    return { kind: 'unknown' }
  }
  if (row.expires_at <= now) {
    await db.prepare('DELETE FROM api_tokens WHERE id = ?').bind(row.id).run()
    return { kind: 'expired' }
  }
  return {
    kind: 'live',
    token: { id: row.id, customerId: row.customer_id, expiresAt: row.expires_at },
  }
}

/** Mints a token for a customer. Returns the raw token once; only its hash is stored. */
export async function mintApiToken(
  db: D1Database,
  customerId: number,
  expiresInSeconds: number,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateApiToken()
  const tokenHash = await hashApiToken(token)
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
  await db
    .prepare('INSERT INTO api_tokens (token_hash, customer_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, customerId, expiresAt)
    .run()
  return { token, expiresAt }
}

/**
 * Deletes every token bound to a customer. Customer-scoped on purpose:
 * signing out anywhere revokes the account's practice API tokens everywhere.
 * Returns the number of rows removed.
 */
export async function revokeCustomerApiTokens(
  db: D1Database,
  customerId: number,
): Promise<number> {
  const result = await db.prepare('DELETE FROM api_tokens WHERE customer_id = ?').bind(customerId).run()
  return Number(result.meta.changes ?? 0)
}
