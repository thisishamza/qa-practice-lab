// Fixed-window rate limiting for the /api/v1 surface (P3-M9).
//
// Design constraints:
// - Cloudflare free tier / D1: at most ONE statement per consume call
//   (an upsert with RETURNING). No per-request "prune old rows" query;
//   row expiry is handled by the maintenance sweep.
// - Fixed windows aligned to the unix minute (window_start = floor(now/60)).
//   A caller sees its counter reset on the minute boundary; there is no
//   sliding-window precision, and that is deliberate — this is an abuse
//   control, not an exact metering system.
// - Only a SHA-256 hash of the client IP is stored (never the raw address),
//   matching the hunt-start cap convention. The trusted source is
//   `cf-connecting-ip` (set/overwritten by Cloudflare at the edge);
//   `x-forwarded-for` is never trusted because it is client-controllable.
//   When no edge IP is visible (local development) the limiters are
//   skipped entirely — they are a soft abuse control, not an authentication
//   boundary.
// - Callers decide what "consume" means: the generic mutation limiter counts
//   every mutating request; the login limiter counts only failures and is
//   reset on success; the checkout limiter counts placements; the report
//   limiter counts submissions (see reports.ts).
//
// Buckets are keyed `<scope>:<ipHash>` — 'login' (failures), 'checkout'
// (placements), 'report' (bug-report submissions) and 'mutate' (every
// mutating /api/v1 endpoint).

import type { Context } from 'hono'
import type { AppEnv } from './app'

/**
 * Backstop for total mutating churn per IP per minute. Deliberately
 * generous (a fast-clicking learner never approaches it); the scoped caps
 * below are the actual abuse controls. 60 would be tighter but rejects
 * legitimate rapid clicking; 120 still bounds scripted floods to 2 rps.
 */
export const MUTATE_LIMIT = 120
export const LOGIN_FAILURE_LIMIT = 5 // failed sign-ins per IP per minute
export const CHECKOUT_LIMIT = 30 // order placements per IP per minute
// Bug-report submissions per IP per minute (Phase 4, P4-M1 WP2). Report
// submission stores free text, so churn is capped like checkout placements;
// the hint/reveal paths stay under the global mutation backstop.
export const REPORT_LIMIT = 30
const WINDOW_SECONDS = 60

/**
 * Best-effort client IP: `cf-connecting-ip` only — the header Cloudflare
 * overwrites at the edge on every proxied request, so it cannot be forged
 * by the caller. `x-forwarded-for` is client-controllable and is therefore
 * never trusted; without a visible edge IP the limiters are skipped
 * entirely (local development posture, documented as such).
 */
export function clientIp(c: Context<AppEnv>): string | null {
  const direct = c.req.header('cf-connecting-ip')?.trim()
  return direct || null
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export interface RateLimitDecision {
  allowed: boolean
  /** Seconds until the current window closes. */
  retryAfterSeconds: number
  /** Requests counted in the current window (after this call, if allowed). */
  count: number
}

/**
 * Atomically consumes one slot in `<scope>:<ipHash>` for the current window.
 * Uses a single INSERT … ON CONFLICT … RETURNING upsert, so concurrent
 * callers cannot both slip past the limit (the counter increment is part of
 * the same statement that reports the count).
 *
 * Callers without a visible client IP are always allowed (see module docs).
 */
export async function consumeRateLimit(
  db: D1Database,
  scope: string,
  ipHash: string | null,
  limit: number,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  if (ipHash === null) {
    return { allowed: true, retryAfterSeconds: 0, count: 0 }
  }
  const epochSeconds = Math.floor(now.getTime() / 1000)
  const windowStart = Math.floor(epochSeconds / WINDOW_SECONDS)
  const retryAfterSeconds = WINDOW_SECONDS - (epochSeconds - windowStart * WINDOW_SECONDS)
  const key = `${scope}:${ipHash}`

  const row = await db
    .prepare(
      `INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>()

  const count = row?.count ?? 1
  return { allowed: count <= limit, retryAfterSeconds, count }
}

/** Read-only check: how many slots are used in the current window? */
export async function peekRateLimit(
  db: D1Database,
  scope: string,
  ipHash: string | null,
  now: Date = new Date(),
): Promise<{ count: number; retryAfterSeconds: number }> {
  if (ipHash === null) {
    return { count: 0, retryAfterSeconds: 0 }
  }
  const epochSeconds = Math.floor(now.getTime() / 1000)
  const windowStart = Math.floor(epochSeconds / WINDOW_SECONDS)
  const retryAfterSeconds = WINDOW_SECONDS - (epochSeconds - windowStart * WINDOW_SECONDS)
  const key = `${scope}:${ipHash}`

  const row = await db
    .prepare('SELECT count FROM rate_limit_buckets WHERE key = ? AND window_start = ?')
    .bind(key, windowStart)
    .first<{ count: number }>()

  return { count: row?.count ?? 0, retryAfterSeconds }
}

/** Deletes every bucket row for a scope+IP (used on successful login). */
export async function resetRateLimit(
  db: D1Database,
  scope: string,
  ipHash: string | null,
): Promise<void> {
  if (ipHash === null) {
    return
  }
  await db.prepare('DELETE FROM rate_limit_buckets WHERE key = ?').bind(`${scope}:${ipHash}`).run()
}
