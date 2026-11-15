// Anonymous practice-session support for the cart (P3-M3).
//
// A practice session is an opaque, randomly generated token. Only its
// SHA-256 hash is stored (in practice_sessions); the raw token lives in the
// learner's browser as the `mpl_session` cookie (HttpOnly, SameSite=Strict,
// Path=/). Sessions expire after 7 days. Deleting the cookie starts a fresh
// session — there is nothing to sign in to and no accounts exist until M5.
//
// M7 extends practice_sessions with mode/hunt_id columns (migration 0007);
// the cart only depends on id/token_hash/expires_at, so it is unaffected.
// mode/hunt_id are resolved here so defect activation (defects.ts) can be
// served from the same single lookup instead of a second query.
//
// No cart data or prices are ever stored in browser storage — the server is
// the only source of truth.

export const SESSION_COOKIE = 'mpl_session'
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

const TOKEN_PATTERN = /^[a-f0-9]{32}$/

export function generateSessionToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

export function isTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}

export interface PracticeSession {
  id: number
  expiresAt: string
  /** 'clean' by default; 'bug_hunt' while a hunt is active. */
  mode: 'clean' | 'bug_hunt'
  /** Registry id of the active hunt (src/server/hunts.ts); null in clean mode. */
  huntId: string | null
}

/** Looks up a live session by token hash. Expired rows are deleted in passing. */
export async function findLiveSession(
  db: D1Database,
  tokenHash: string,
): Promise<PracticeSession | null> {
  const now = new Date().toISOString()
  const row = await db
    .prepare('SELECT id, expires_at, mode, hunt_id FROM practice_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ id: number; expires_at: string; mode: 'clean' | 'bug_hunt'; hunt_id: string | null }>()

  if (!row) {
    return null
  }

  if (row.expires_at <= now) {
    // Expired: purge it (cascades to its cart) so state never leaks forward.
    await db.prepare('DELETE FROM practice_sessions WHERE id = ?').bind(row.id).run()
    return null
  }

  return { id: row.id, expiresAt: row.expires_at, mode: row.mode, huntId: row.hunt_id }
}

/**
 * Creates a fresh session and its cart and returns the new raw token. The
 * caller is responsible for setting the cookie. These are two sequential,
 * independent writes rather than a batch: a crash between them can leave an
 * empty session row with an expiry (swept later), never a broken one, and
 * `ensureCart` re-creates a missing cart on the next request. No batch
 * inter-statement visibility assumptions are needed.
 *
 * P3-M7: callers may open the session directly in bug-hunt mode by passing
 * `{ mode: 'bug_hunt', huntId }`; anything unspecified defaults to clean.
 */
export async function createSessionWithCart(
  db: D1Database,
  options: { mode?: 'clean' | 'bug_hunt'; huntId?: string | null } = {},
): Promise<{ sessionId: number; cartId: number; token: string }> {
  const token = generateSessionToken()
  const tokenHash = await hashSessionToken(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
  const mode = options.mode ?? 'clean'
  const huntId = mode === 'bug_hunt' ? (options.huntId ?? null) : null

  await db
    .prepare('INSERT INTO practice_sessions (token_hash, expires_at, mode, hunt_id) VALUES (?, ?, ?, ?)')
    .bind(tokenHash, expiresAt, mode, huntId)
    .run()

  const row = await db
    .prepare('SELECT id FROM practice_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ id: number }>()

  if (!row) {
    throw new Error('Session creation failed')
  }

  await db.prepare('INSERT OR IGNORE INTO carts (session_id) VALUES (?)').bind(row.id).run()

  const cart = await db
    .prepare('SELECT id FROM carts WHERE session_id = ?')
    .bind(row.id)
    .first<{ id: number }>()

  if (!cart) {
    throw new Error('Cart creation failed')
  }

  return { sessionId: row.id, cartId: cart.id, token }
}

/** Returns the cart id for a session, creating the cart if it is missing. */
export async function ensureCart(db: D1Database, sessionId: number): Promise<number> {
  await db.prepare('INSERT OR IGNORE INTO carts (session_id) VALUES (?)').bind(sessionId).run()
  const cart = await db
    .prepare('SELECT id FROM carts WHERE session_id = ?')
    .bind(sessionId)
    .first<{ id: number }>()

  if (!cart) {
    throw new Error('Cart lookup failed')
  }

  return cart.id
}
