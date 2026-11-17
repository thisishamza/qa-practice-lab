// Hint ladder & gated solution reveal (P4-M2 WP1) — the learning-experience
// endpoints. Routes live here; ALL content is loaded from the server-only
// registries (src/server/hints.ts, src/server/reveals.ts) after the
// appropriate authorization check. No hint text, reveal content or defect
// id ever appears in a pre-authorization payload, in a hunt summary
// endpoint, or in any client bundle (this module is server-only).
//
// Endpoints (all resolved from the caller's `mpl_session` cookie; attempt
// ids and defect identifiers are never accepted from the client):
//   POST /api/v1/practice/hunts/:huntId/hints  — unlock one progressive
//       hint. Body: { level: 1|2|3 }. Level N requires level N−1 already
//       used on the attempt (409 `hint_level_locked` otherwise — the ladder
//       cannot be skipped by editing the request). Re-requesting an
//       unlocked level is idempotent (200, no double count, via the
//       attempt row's hint_mask bitset). Progress persists on the attempt
//       row, so it survives refreshes and session continuation.
//       200 → { level, hint, hintsUsed } · 400 invalid_level ·
//       401 session_required · 404 hunt_not_found · 429 rate_limited (backstop)
//   GET  /api/v1/practice/hunts/:huntId/reveal — the gated solution for
//       this attempt. 200 only when the attempt's report has been
//       submitted OR the attempt is already revealed (an explicit
//       give-up); otherwise 403 `reveal_locked`. Never mints an attempt.
//       → { huntId, title, expected, actual, rootCause, reproduction[],
//           verification[], concepts[], commonMisconceptions[], attempt }
//   POST /api/v1/practice/hunts/:huntId/reveal — the explicit, confirmed
//       give-up path ("Show the solution"). Body: { confirm: true }
//       (anything else → 400). Atomically marks an in_progress attempt
//       `revealed` (revealed_at stamped once; a submitted attempt stays
//       submitted) and returns the same payload as the GET. Idempotent:
//       repeating the request preserves prior state and returns the same
//       payload. Never awards discovery; submission history, best score
//       and discovered are preserved untouched.
//
// Security model:
// - Everything resolves from the `mpl_session` cookie. Ownership is the
//   practice session (plus the customer binding stamped at submit time for
//   other surfaces — hint state and reveal state stay session-scoped, so a
//   different session of the same learner cannot read this attempt's
//   hints or reveal).
// - Hints never unlock the reveal; a high report score never unlocks the
//   reveal on its own; the reveal unlocks from the attempt STATUS
//   (submitted via the report batch, or revealed via this POST) — one
//   attempt, scoped per hunt. Give-up on one hunt never reveals another
//   hunt.
// - Discovery remains governed exclusively by the deterministic evaluator's
//   finding check (WP3); nothing in this module sets `discovered`.
// - Viewing hints sets only the hint_mask bits. No response before unlock
//   carries any reveal content; error responses carry only learner-safe
//   envelopes ({ error, message }).
// - Rate limiting: these are mutating/backstop-covered endpoints (global
//   120/min per-IP cap applies); no scoped budget is needed. Limits are
//   abuse controls, not security boundaries. The 32 KB global body cap
//   applies.

import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type {
  HintLevel,
  HintResponse,
  RevealResponse,
} from '../shared/learning'
import type { AppEnv } from './app'
import {
  attemptView,
  hintsUsedFromMask,
  resolveAttemptForSubmission,
  resolveAttemptForView,
  type AttemptRow,
} from './attempts'
import { HUNT_ID_PATTERN } from './hunts'
import { resolveAttemptTarget } from './attemptTargets'
import { requireHint } from './hints'
import { sqlHintText } from './sqlHints'
import { contractHintText } from './contractHints'
import { contractRevealDefinition } from './contractReveals'
import { findReveal } from './reveals'
import { findSqlReveal } from './sqlReveals'
import { labHintText, labRevealDefinition } from './labLearning'
import {
  SESSION_COOKIE,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'

const HINT_BITS: Record<HintLevel, number> = { 1: 1, 2: 2, 3: 4 }

function buildRevealResponse(huntId: string, title: string, row: AttemptRow): RevealResponse {
  // SQL exercises and SQL hunts reveal the reference/finding query as well;
  // contract exercises and contract hunts reveal the reference mechanism
  // and fix; Phase 3/4 hunts never carry one.
  const contractReveal = contractRevealDefinition(huntId)
  if (contractReveal) {
    return {
      huntId,
      title,
      expected: contractReveal.expected,
      actual: contractReveal.actual,
      rootCause: contractReveal.rootCause,
      reproduction: [...contractReveal.reproduction],
      verification: [...contractReveal.verification],
      concepts: [...contractReveal.concepts],
      commonMisconceptions: [...contractReveal.commonMisconceptions],
      solution: contractReveal.solution,
      explanation: contractReveal.explanation,
      attempt: attemptView(row),
    }
  }
  const labReveal = labRevealDefinition(huntId)
  if (labReveal) {
    return {
      huntId,
      title,
      expected: labReveal.expected,
      actual: labReveal.actual,
      rootCause: labReveal.rootCause,
      reproduction: [...labReveal.reproduction],
      verification: [...labReveal.verification],
      concepts: [...labReveal.concepts],
      commonMisconceptions: [...labReveal.commonMisconceptions],
      solution: labReveal.solution,
      explanation: labReveal.explanation,
      attempt: attemptView(row),
    }
  }
  const sqlReveal = findSqlReveal(huntId)
  if (sqlReveal) {
    return {
      huntId,
      title,
      expected: sqlReveal.expected,
      actual: sqlReveal.actual,
      rootCause: sqlReveal.rootCause,
      reproduction: [...sqlReveal.reproduction],
      verification: [...sqlReveal.verification],
      concepts: [...sqlReveal.concepts],
      commonMisconceptions: [...sqlReveal.commonMisconceptions],
      solution: sqlReveal.solution,
      explanation: sqlReveal.explanation,
      attempt: attemptView(row),
    }
  }
  const reveal = findReveal(huntId)
  if (!reveal) {
    // Registry and target registry are compile-time checked to cover the
    // same ids; this is unreachable for registered targets.
    throw new Error('Reveal registry is missing a runnable exercise or hunt.')
  }
  return {
    huntId,
    title,
    expected: reveal.expected,
    actual: reveal.actual,
    rootCause: reveal.rootCause,
    reproduction: [...reveal.reproduction],
    verification: [...reveal.verification],
    concepts: [...reveal.concepts],
    commonMisconceptions: [...reveal.commonMisconceptions],
    attempt: attemptView(row),
  }
}

/** Hint lookup unified across the Phase 3/4, Phase 6 SQL, Phase 7 contract and final-phase lab registries. */
function requireAnyHint(id: string, level: HintLevel): string {
  const labHint = labHintText(id, level)
  if (labHint !== null) {
    return labHint
  }
  const sqlHint = sqlHintText(id, level)
  if (sqlHint !== null) {
    return sqlHint
  }
  const contractHint = contractHintText(id, level)
  if (contractHint !== null) {
    return contractHint
  }
  return requireHint(id, level)
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

function huntLookup(c: import('hono').Context<AppEnv>) {
  const huntId = c.req.param('huntId') ?? ''
  if (!HUNT_ID_PATTERN.test(huntId)) {
    return { error: { error: 'invalid_request', message: 'A hunt id looks like hunt-topic-001.' } as const, status: 400 as const }
  }
  // SQL exercise/hunt ids are valid attemptable targets too.
  const target = resolveAttemptTarget(huntId)
  if (!target) {
    return { error: { error: 'hunt_not_found', message: 'No such practice hunt exists.' } as const, status: 404 as const }
  }
  return { target }
}

export const learningRoutes = new Hono<AppEnv>()

learningRoutes.post('/practice/hunts/:huntId/hints', async (c) => {
  const lookup = huntLookup(c)
  if ('error' in lookup) {
    return c.json(lookup.error, lookup.status)
  }
  const { target } = lookup

  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json(
      { error: 'session_required', message: 'Start the exercise before asking for a hint.' },
      401,
    )
  }

  const body = await c.req.json().catch(() => null)
  const level = (body as { level?: unknown } | null)?.level
  if (level !== 1 && level !== 2 && level !== 3) {
    return c.json(
      { error: 'invalid_level', message: 'Choose a hint level: 1, 2 or 3.' },
      400,
    )
  }

  // One attempt per (session, hunt); created on demand, consistent with the
  // report path (a hunt start normally creates it first).
  const attempt = await resolveAttemptForSubmission(c.env.DB, session.id, target.id)
  const now = new Date().toISOString()
  const bit = HINT_BITS[level]

  // The ladder is only writable while the attempt is in progress. After
  // submission or a confirmed give-up, already-unlocked levels stay
  // re-readable (the idempotent branch below), but no NEW level unlocks.
  if ((attempt.hint_mask & bit) !== 0) {
    // Idempotent re-read of an already-unlocked level: serve the text
    // again, never double count, and never write.
    const hint = requireAnyHint(target.id, level)
    return c.json(
      { level, hint, hintsUsed: hintsUsedFromMask(attempt.hint_mask) } satisfies HintResponse,
      200,
    )
  }

  if (attempt.status !== 'in_progress') {
    return c.json(
      {
        error: 'hint_attempt_completed',
        message: 'This attempt is complete. Start the hunt again to unlock the remaining hints.',
      },
      409,
    )
  }

  const prerequisite = level === 1 ? null : HINT_BITS[(level - 1) as HintLevel]
  if (prerequisite !== null && (attempt.hint_mask & prerequisite) === 0) {
    return c.json(
      {
        error: 'hint_level_locked',
        message: 'Use the previous hint first — levels unlock in order.',
      },
      409,
    )
  }

  // Atomic single-bit set, guarded against a concurrent unlock of the same
  // level. If we lose the race we fall through to the re-read below, which
  // serves the now-unlocked hint idempotently.
  await c.env.DB.prepare(
    `UPDATE hunt_attempts
     SET hint_mask = hint_mask | ?, updated_at = ?
     WHERE id = ? AND (hint_mask & ?) = 0 AND status = 'in_progress'`,
  )
    .bind(bit, now, attempt.id, bit)
    .run()

  const updated = await resolveAttemptForView(c.env.DB, session.id, target.id)
  const settledMask = updated?.hint_mask ?? (attempt.hint_mask | bit)
  if ((settledMask & bit) === 0) {
    // The attempt closed between our check and our write (a report or
    // give-up committed first) — no hint is recorded or disclosed here.
    return c.json(
      {
        error: 'hint_attempt_completed',
        message: 'This attempt is complete. Start the hunt again to unlock the remaining hints.',
      },
      409,
    )
  }
  const hint = requireAnyHint(target.id, level)
  return c.json(
    { level, hint, hintsUsed: hintsUsedFromMask(settledMask) } satisfies HintResponse,
    200,
  )
})

learningRoutes.get('/practice/hunts/:huntId/reveal', async (c) => {
  const lookup = huntLookup(c)
  if ('error' in lookup) {
    return c.json(lookup.error, lookup.status)
  }
  const { target } = lookup

  const session = await resolveCallerSession(c)
  if (!session) {
    return revealLocked(c)
  }

  const attempt = await resolveAttemptForView(c.env.DB, session.id, target.id)
  if (!attempt || (attempt.status !== 'submitted' && attempt.status !== 'revealed')) {
    return revealLocked(c)
  }
  return c.json(buildRevealResponse(target.id, target.title, attempt), 200)
})

learningRoutes.post('/practice/hunts/:huntId/reveal', async (c) => {
  const lookup = huntLookup(c)
  if ('error' in lookup) {
    return c.json(lookup.error, lookup.status)
  }
  const { target } = lookup

  const session = await resolveCallerSession(c)
  if (!session) {
    return c.json(
      { error: 'session_required', message: 'Start the exercise before revealing the solution.' },
      401,
    )
  }

  const body = await c.req.json().catch(() => null)
  const confirm = (body as { confirm?: unknown } | null)?.confirm
  if (confirm !== true) {
    return c.json(
      {
        error: 'invalid_request',
        message: 'Confirm explicitly that you want the solution revealed.',
      },
      400,
    )
  }

  // The give-up path is always available with an explicit confirm flag; it
  // attaches to the caller's attempt (live, else latest, else a fresh one —
  // consistent with the report path). It never flips `discovered` and
  // preserves submissions, best score and discovery status.
  const attempt = await resolveAttemptForSubmission(c.env.DB, session.id, target.id)
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    `UPDATE hunt_attempts
     SET status = CASE WHEN status = 'in_progress' THEN 'revealed' ELSE status END,
         revealed_at = COALESCE(revealed_at, ?),
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(now, now, attempt.id)
    .run()

  const updated = await resolveAttemptForView(c.env.DB, session.id, target.id)
  const row = updated ?? { ...attempt, status: attempt.status === 'in_progress' ? 'revealed' : attempt.status }
  return c.json(buildRevealResponse(target.id, target.title, row), 200)
})

function revealLocked(c: import('hono').Context<AppEnv>) {
  return c.json(
    {
      error: 'reveal_locked',
      message: 'Submit a bug report for this attempt, or explicitly give up, to unlock the solution.',
    },
    403,
  )
}
