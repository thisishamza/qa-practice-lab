// Attempt lifecycle for the Phase 4 learning intelligence (P4-M1 WP2).
//
// Endpoints (all resolved from the caller's `mpl_session` cookie; attempt
// ids are never accepted from the client):
//   GET /api/v1/practice/hunts/:huntId/attempt — the caller's current
//       attempt for one registered hunt: `{ status: 'none' }`-style payload
//       when none exists (404-free by design), otherwise
//       `{ status, hintsUsed, bestQualityScore, discovered, submittedAt }`.
//       Unknown hunt ids still answer `404 hunt_not_found`.
//   GET /api/v1/practice/attempts             — bounded history (≤50, newest
//       first) across hunts for this session, plus customer-bound attempts
//       when signed in. No internal ids.
//
// Lifecycle and idempotency rules:
// - Hunt start (src/server/practice.ts) calls `ensureLiveAttempt`, which
//   returns the caller's live in_progress attempt for the hunt or creates
//   one. Creation is idempotent under retries and concurrency: a partial
//   unique index (migration 0010) allows at most one in_progress attempt
//   per (practice_session_id, hunt_id), and the insert is an
//   ON CONFLICT … DO NOTHING against that index followed by a re-read.
// - After a report is submitted the attempt leaves in_progress, so the next
//   hunt start mints a fresh attempt and the old one is preserved as
//   history. Resubmission does NOT mint a new attempt; it attaches to the
//   live in_progress attempt, or (when resubmission happens long after the
//   fact) to the latest attempt for (session, hunt).
// - Statuses: in_progress → submitted (report persisted, WP2) or revealed
//   (explicit confirmed give-up, P4-M2). `submitted` never goes backwards in
//   this milestone. discovered, once 1, is sticky and never reset here.
// - customer_id is stamped at report submission time when the browser is
//   signed in (mirroring orders.customer_id; ON DELETE SET NULL). Starting a
//   hunt while signed in does not stamp, and signing in never retroactively
//   claims earlier guest rows.
// - Attempts cascade-delete with their practice session (the orders
//   precedent): guest progress lives exactly as long as the session's
//   7-day TTL. `npm run maintenance`/the staff sweep therefore need no
//   attempt-specific work.
//
// No defect ids, hint content, reveal content or evaluation internals are
// stored or returned here.

import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type {
  AttemptHistoryEntry,
  AttemptHistoryResponse,
  AttemptView,
  HuntAttemptStatus,
} from '../shared/learning'
import type { AppEnv } from './app'
import { resolveCustomerContext } from './customer'
import { HUNT_ID_PATTERN, findHunt } from './hunts'
import {
  SESSION_COOKIE,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'

/** Bounded history page size for GET /practice/attempts. */
export const ATTEMPT_HISTORY_LIMIT = 50

export interface AttemptRow {
  id: number
  hunt_id: string
  status: HuntAttemptStatus
  hint_mask: number
  best_quality_score: number | null
  discovered: number
  created_at: string
  submitted_at: string | null
}

const ATTEMPT_COLUMNS =
  'id, hunt_id, status, hint_mask, best_quality_score, discovered, created_at, submitted_at'

/** Bit count of the server-side hint mask (0–3). */
export function hintsUsedFromMask(mask: number): number {
  let count = 0
  for (let bit = 1; bit <= 4; bit <<= 1) {
    if ((mask & bit) !== 0) {
      count += 1
    }
  }
  return count
}

/** Learner-safe view of an attempt row. Never exposes the numeric id. */
export function attemptView(row: AttemptRow | null): AttemptView {
  if (!row) {
    return {
      status: 'none',
      hintsUsed: 0,
      bestQualityScore: null,
      discovered: false,
      submittedAt: null,
    }
  }
  return {
    status: row.status,
    hintsUsed: hintsUsedFromMask(row.hint_mask),
    bestQualityScore: row.best_quality_score,
    discovered: row.discovered === 1,
    submittedAt: row.submitted_at,
  }
}

async function latestAttemptRow(
  db: D1Database,
  sessionId: number,
  huntId: string,
  liveOnly: boolean,
): Promise<AttemptRow | null> {
  const where = liveOnly ? " AND status = 'in_progress'" : ''
  return db
    .prepare(
      `SELECT ${ATTEMPT_COLUMNS} FROM hunt_attempts
       WHERE practice_session_id = ? AND hunt_id = ?${where}
       ORDER BY id DESC
       LIMIT 1`,
    )
    .bind(sessionId, huntId)
    .first<AttemptRow>()
}

/**
 * Creates (or returns) the caller's live in_progress attempt for a hunt.
 * Idempotent: two concurrent callers can both attempt the insert, one wins
 * the partial unique index, the other reads the winner's row — never two
 * live attempts, never an error for a legitimate retry.
 */
export async function ensureLiveAttempt(
  db: D1Database,
  sessionId: number,
  huntId: string,
): Promise<AttemptRow> {
  const existing = await latestAttemptRow(db, sessionId, huntId, true)
  if (existing) {
    return existing
  }
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO hunt_attempts (hunt_id, practice_session_id, status, created_at, updated_at)
       VALUES (?, ?, 'in_progress', ?, ?)
       ON CONFLICT(practice_session_id, hunt_id) WHERE status = 'in_progress' DO NOTHING`,
    )
    .bind(huntId, sessionId, now, now)
    .run()
  const live = await latestAttemptRow(db, sessionId, huntId, true)
  if (!live) {
    // The insert lost to a concurrent transaction whose row we still cannot
    // see (should not happen on D1). Surface an error rather than guess.
    throw new Error('Failed to establish the in-progress attempt.')
  }
  return live
}

/**
 * Resolves the attempt a report submission should attach to:
 * the live in_progress attempt when one exists (the normal path — hunt
 * start created it), otherwise the latest attempt for (session, hunt) so a
 * resubmission extends that attempt's history. Creates a fresh attempt when
 * none exists (an API client that submits without starting the hunt).
 */
export async function resolveAttemptForSubmission(
  db: D1Database,
  sessionId: number,
  huntId: string,
): Promise<AttemptRow> {
  const live = await latestAttemptRow(db, sessionId, huntId, true)
  if (live) {
    return live
  }
  const latest = await latestAttemptRow(db, sessionId, huntId, false)
  if (latest) {
    return latest
  }
  return ensureLiveAttempt(db, sessionId, huntId)
}

/**
 * Stamps the attempt after its report row has been staged, in the same D1
 * batch as the report insert (all-or-nothing). in_progress → submitted;
 * revealed stays revealed (giving up is never a completion); submitted
 * stays submitted. Only the first submitted_at is kept; any existing
 * customer_id binding is preserved.
 */
export function submissionStatements(
  attemptId: number,
  customerId: number | null,
  now: string,
) {
  return {
    sql: `UPDATE hunt_attempts
          SET status = CASE WHEN status = 'in_progress' THEN 'submitted' ELSE status END,
              submitted_at = COALESCE(submitted_at, ?),
              customer_id = COALESCE(customer_id, ?),
              updated_at = ?
          WHERE id = ?`,
    binds: [now, customerId, now, attemptId],
  }
}

async function resolveCallerSession(
  c: import('hono').Context<AppEnv>,
): Promise<{ id: number } | null> {
  const presented = getCookie(c, SESSION_COOKIE)
  if (!presented || !isTokenFormat(presented)) {
    return null
  }
  const live = await findLiveSession(c.env.DB, await hashSessionToken(presented))
  return live ? { id: live.id } : null
}

/** Resolves the active signed-in customer bound to this session (else null). */
export async function resolveActiveCustomerId(
  c: import('hono').Context<AppEnv>,
): Promise<number | null> {
  const resolution = await resolveCustomerContext(c)
  return resolution.kind === 'ok' && resolution.customer.status === 'active'
    ? resolution.customer.id
    : null
}

export const attemptRoutes = new Hono<AppEnv>()

attemptRoutes.get('/practice/hunts/:huntId/attempt', async (c) => {
  const huntId = c.req.param('huntId') ?? ''
  if (!HUNT_ID_PATTERN.test(huntId)) {
    return c.json(
      { error: 'invalid_request', message: 'A hunt id looks like hunt-topic-001.' },
      400,
    )
  }
  if (!findHunt(huntId)) {
    return c.json(
      { error: 'hunt_not_found', message: 'No such practice hunt exists.' },
      404,
    )
  }

  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json(attemptView(null))
  }

  let row = await latestAttemptRow(c.env.DB, session.id, huntId, true)
  if (!row) {
    row = await latestAttemptRow(c.env.DB, session.id, huntId, false)
  }
  return c.json(attemptView(row))
})

attemptRoutes.get('/practice/attempts', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json({ data: [] } satisfies AttemptHistoryResponse)
  }
  const customerId = await resolveActiveCustomerId(c)

  // Session-scoped rows plus customer-bound rows from the caller's other
  // live sessions (bounded, newest first, no internal ids). Attempts that
  // outlived their practice session do not exist (cascade), so this window
  // is inherently bounded.
  const rows = customerId
    ? await c.env.DB.prepare(
        `SELECT hunt_id, status, hint_mask, best_quality_score, discovered, created_at, submitted_at
         FROM hunt_attempts
         WHERE practice_session_id = ? OR customer_id = ?
         ORDER BY id DESC
         LIMIT ?`,
      )
        .bind(session.id, customerId, ATTEMPT_HISTORY_LIMIT)
        .all<Omit<AttemptRow, 'id'>>()
    : await c.env.DB.prepare(
        `SELECT hunt_id, status, hint_mask, best_quality_score, discovered, created_at, submitted_at
         FROM hunt_attempts
         WHERE practice_session_id = ?
         ORDER BY id DESC
         LIMIT ?`,
      )
        .bind(session.id, ATTEMPT_HISTORY_LIMIT)
        .all<Omit<AttemptRow, 'id'>>()

  const data = rows.results.map((row): AttemptHistoryEntry => ({
    huntId: row.hunt_id,
    status: row.status,
    hintsUsed: hintsUsedFromMask(row.hint_mask),
    bestQualityScore: row.best_quality_score,
    discovered: row.discovered === 1,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
  }))
  return c.json({ data } satisfies AttemptHistoryResponse)
})
