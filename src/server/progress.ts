// Learner progress (P4-M3 WP1) — GET /api/v1/practice/progress.
//
// Endpoint (resolved from the caller's `mpl_session` cookie; attempt ids
// and customer ids are never accepted from the client):
//   GET /api/v1/practice/progress
//     200 → { persistence: 'session'|'customer', hunts: [...], recent: [...], totals: {...} }
//     200 with an empty payload when no live practice session exists
//           (persistence 'session', all hunts `none`, zeroed totals) —
//           learner-safe and 404-free, matching GET /practice/attempts.
//
// Scope (the same ownership rule as attempts/history):
// - rows whose practice_session_id is the caller's live session, OR
// - rows stamped with the caller's active customer binding at submission
//   time (when signed in). `OR` on one table: no join, so a row can never
//   be counted twice. There is no cross-customer and no admin read path;
//   the staff role gains nothing here.
// - persistence is 'customer' exactly when that active binding exists.
//
// Aggregation rules (all derived from persisted rows; nothing recomputed):
// - totals.attempts/inProgress/submitted/revealed count attempts by status
//   (status buckets stay pure: attempts = inProgress + submitted + revealed).
// - totals.reports counts bug_reports rows in scope — one row per submission.
//   An incomplete or unsubmitted report does not exist server-side, so it
//   can never be scored or counted.
// - totals.discovered counts DISTINCT hunt_ids with a discovered attempt.
//   Discovery is the evaluator's finding-check result, persisted sticky on
//   the attempt — never derived from a score, never set by a reveal, and
//   independent of score totals. A reveal alone can never produce a
//   discovery, and a revealed-status attempt never confers discovery
//   credit (a give-up that comes first keeps the attempt revealed even if
//   a report is filed afterwards). Discovery credit requires a non-revealed
//   attempt with the persisted flag set. Sticky semantics are unchanged:
//   submit-then-reveal keeps the attempt `submitted` and keeps its credit.
// - totals.hintsUsed sums the popcount of hint_mask (reuses
//   hintsUsedFromMask — one implementation).
// - totals.bestScore is MAX(best_quality_score) over scored attempts;
//   totals.averageBestScore is the integer mean of scored attempt best
//   scores (Math.round, half up) and is NULL until at least one attempt is
//   scored. Unscored attempts (in_progress, never submitted) are excluded
//   from both.
// - hunts: one entry per wired hunt in registry order. status is the
//   latest attempt's status (rows are scanned newest-first) or 'none';
//   discovered is sticky across the hunt's attempts; bestScore is the max
//   across the hunt's attempts; hintsUsed sums across all its attempts;
//   attempts counts them; lastSubmittedAt is the latest submitted_at.
// - recent: the 10 newest bug_reports in scope (ORDER BY report id DESC).
//   The verdict is the persisted quality_score mapped through the §6.4
//   bands via verdictForScore — the same bands the evaluator uses, never a
//   re-evaluation. No attempt ids, no report ids, no customer ids, no
//   evaluator internals.
//
// Bounded: hunts is fixed at the wired registry size (7) and recent at 10.
// The aggregate scan reads one row per attempt in scope (indexed on
// practice_session_id; attempts are bounded by learner action and by the
// 7-day session TTL via cascade). Recents and totals never expose more
// than that. No migration: reads only (migration 0010 provides everything).

import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type {
  AttemptStatusView,
  ProgressHuntEntry,
  ProgressRecentSubmission,
  ProgressResponse,
  ProgressTotals,
} from '../shared/learning'
import type { AppEnv } from './app'
import { resolveActiveCustomerId, hintsUsedFromMask } from './attempts'
import { HUNTS } from './hunts'
import { verdictForScore } from './reportQuality'
import {
  SESSION_COOKIE,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'

/** Maximum rows in the recent-submissions list. */
export const PROGRESS_RECENT_LIMIT = 10

/** Attempt row shape read for aggregation (id kept for newest-first scan). */
export interface ProgressAttemptRow {
  id: number
  hunt_id: string
  status: 'in_progress' | 'submitted' | 'revealed'
  hint_mask: number
  best_quality_score: number | null
  discovered: number
  submitted_at: string | null
}

/** ISO timestamps compare lexicographically; returns the larger (or null). */
function maxTimestamp(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return a >= b ? a : b
}

/** Mean of scored best scores, rounded to an integer; null when none. */
export function averageBestScore(scores: readonly number[]): number | null {
  if (scores.length === 0) {
    return null
  }
  const total = scores.reduce((sum, score) => sum + score, 0)
  return Math.round(total / scores.length)
}

/** Pure aggregate over attempt rows in scope (any order). */
export function summarizeProgressAttempts(rows: readonly ProgressAttemptRow[]): ProgressTotals {
  let inProgress = 0
  let submitted = 0
  let revealed = 0
  let hintsUsed = 0
  let bestScore: number | null = null
  const scored: number[] = []
  const discoveredHunts = new Set<string>()

  for (const row of rows) {
    if (row.status === 'in_progress') inProgress += 1
    else if (row.status === 'submitted') submitted += 1
    else revealed += 1

    hintsUsed += hintsUsedFromMask(row.hint_mask)
    if (row.discovered === 1 && row.status !== 'revealed') discoveredHunts.add(row.hunt_id)
    if (row.best_quality_score !== null) {
      scored.push(row.best_quality_score)
      if (bestScore === null || row.best_quality_score > bestScore) {
        bestScore = row.best_quality_score
      }
    }
  }

  return {
    attempts: rows.length,
    inProgress,
    submitted,
    revealed,
    reports: 0, // filled by the caller from the bug_reports count
    discovered: discoveredHunts.size,
    hintsUsed,
    bestScore,
    averageBestScore: averageBestScore(scored),
  }
}

/**
 * Per-hunt entries for every wired hunt, in registry order. `rows` must be
 * ordered newest-first (the route scans by id DESC) so the first row seen
 * per hunt is that hunt's latest attempt.
 */
export function buildHuntEntries(rows: readonly ProgressAttemptRow[]): ProgressHuntEntry[] {
  const byHunt = new Map<string, ProgressAttemptRow[]>()
  for (const row of rows) {
    const list = byHunt.get(row.hunt_id)
    if (list) list.push(row)
    else byHunt.set(row.hunt_id, [row])
  }

  return HUNTS.map((hunt): ProgressHuntEntry => {
    const huntRows = byHunt.get(hunt.id) ?? []
    const latest = huntRows[0]

    let bestScore: number | null = null
    let hintsUsed = 0
    let discovered = false
    let lastSubmittedAt: string | null = null

    for (const row of huntRows) {
      hintsUsed += hintsUsedFromMask(row.hint_mask)
      if (row.discovered === 1 && row.status !== 'revealed') discovered = true
      if (row.best_quality_score !== null && (bestScore === null || row.best_quality_score > bestScore)) {
        bestScore = row.best_quality_score
      }
      lastSubmittedAt = maxTimestamp(lastSubmittedAt, row.submitted_at)
    }

    const status: AttemptStatusView = latest ? latest.status : 'none'

    return {
      huntId: hunt.id,
      scenarioId: hunt.scenarioId,
      title: hunt.title,
      status,
      discovered,
      bestScore,
      hintsUsed,
      attempts: huntRows.length,
      lastSubmittedAt,
    }
  })
}

/** Attempt rows scope for the caller. `customerId` null → session only. */
function scopeFor(sessionId: number, customerId: number | null) {
  return customerId === null
    ? { where: 'practice_session_id = ?', binds: [sessionId] as number[] }
    : { where: 'practice_session_id = ? OR customer_id = ?', binds: [sessionId, customerId] as number[] }
}

function emptyProgress(persistence: 'session' | 'customer'): ProgressResponse {
  return {
    persistence,
    hunts: buildHuntEntries([]),
    recent: [],
    totals: {
      attempts: 0,
      inProgress: 0,
      submitted: 0,
      revealed: 0,
      reports: 0,
      discovered: 0,
      hintsUsed: 0,
      bestScore: null,
      averageBestScore: null,
    },
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

export const progressRoutes = new Hono<AppEnv>()

progressRoutes.get('/practice/progress', async (c) => {
  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json(emptyProgress('session') satisfies ProgressResponse)
  }

  const customerId = await resolveActiveCustomerId(c)
  const scope = scopeFor(session.id, customerId)
  const aliasScope = customerId === null
    ? { where: 'a.practice_session_id = ?', binds: [session.id] as number[] }
    : { where: 'a.practice_session_id = ? OR a.customer_id = ?', binds: [session.id, customerId] as number[] }

  const [attemptRows, reportCount, recentRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, hunt_id, status, hint_mask, best_quality_score, discovered, submitted_at
       FROM hunt_attempts
       WHERE ${scope.where}
       ORDER BY id DESC`,
    )
      .bind(...scope.binds)
      .all<ProgressAttemptRow>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM bug_reports b
       JOIN hunt_attempts a ON a.id = b.attempt_id
       WHERE ${aliasScope.where}`,
    )
      .bind(...aliasScope.binds)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT a.hunt_id AS huntId, b.quality_score AS score, b.created_at AS createdAt
       FROM bug_reports b
       JOIN hunt_attempts a ON a.id = b.attempt_id
       WHERE ${aliasScope.where}
       ORDER BY b.id DESC
       LIMIT ?`,
    )
      .bind(...aliasScope.binds, PROGRESS_RECENT_LIMIT)
      .all<{ huntId: string; score: number; createdAt: string }>(),
  ])

  const rows = attemptRows.results
  const totals = summarizeProgressAttempts(rows)

  const recent: ProgressRecentSubmission[] = recentRows.results.flatMap((entry) => {
    const hunt = HUNTS.find((candidate) => candidate.id === entry.huntId)
    if (!hunt) {
      // Registry and rows are compile-time/deploy-time aligned; a stale
      // hunt_id (never expected) is omitted rather than leaked.
      return []
    }
    return [
      {
        huntId: hunt.id,
        title: hunt.title,
        score: entry.score,
        verdict: verdictForScore(entry.score),
        createdAt: entry.createdAt,
      },
    ]
  })

  const body: ProgressResponse = {
    persistence: customerId === null ? 'session' : 'customer',
    hunts: buildHuntEntries(rows),
    recent,
    totals: { ...totals, reports: reportCount?.count ?? 0 },
  }
  return c.json(body)
})
