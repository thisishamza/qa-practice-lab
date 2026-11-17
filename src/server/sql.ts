// Phase 6 M2 SQL lab routes — see docs/phase-6-database-testing-plan.md §10.3/§10.4.
//
// Endpoints (all resolved from the caller's `mpl_session` cookie; no attempt,
// exercise, hunt or defect id is ever accepted from outside the path param +
// registry contract):
//   POST /api/v1/sql/exercises/:exerciseId/start — idempotent attempt creation
//        for clean exercises (mirrors hunt-start idempotency). Mints a clean
//        guest session when the browser has none; 404 unknown exercise.
//        Not rate-capped beyond the global backstop.
//   POST /api/v1/sql/evaluate — result-envelope evaluation for one exercise.
//        Never accepts learner SQL; compares the submitted { columns, rows }
//        envelope against the compiled expected spec. 401 no session,
//        404 unknown exercise, 400 malformed envelope, 413 oversize,
//        429 sql-eval:iphash 30/min. On a pass it stamps the caller's attempt
//        (status submitted, best score running max) in the same path; on a
//        fail the attempt stays in_progress.
//   GET  /api/v1/sql/hunts/:huntId/seed — bug-hunt corruption delta for a
//        registered SQL hunt, in bug-hunt mode only. 401 no session,
//        403 not_hunt_mode in clean mode / for non-SQL hunts (the same
//        response either way — existence of the delta is not disclosed),
//        404 unknown hunt, 429 sql-seed:iphash 30/min. Idempotent; no D1
//        writes. The delta is compiled code, never read from D1.
//
// Security model: D1 carries control-plane rows only (attempts). No route
// accepts SQL text, table names or identifiers. The caller's evaluation
// envelope is compared and discarded — nothing is logged or stored.

import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type {
  SqlEvaluateRequest,
  SqlEvaluateCell,
  SqlEvaluateResponse,
} from '../shared/sql'
import {
  SQL_EVALUATE_MAX_CELL,
  SQL_EVALUATE_MAX_COLUMNS,
  SQL_EVALUATE_MAX_ROWS,
} from '../shared/sql'
import type { AppEnv } from './app'
import {
  attemptView,
  ensureLiveAttempt,
  resolveActiveCustomerId,
  resolveAttemptForSubmission,
  resolveAttemptForView,
  submissionStatements,
  type AttemptRow,
} from './attempts'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionWithCart,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'
import { findHunt, HUNT_ID_PATTERN } from './hunts'
import { evaluateSubmission } from './sqlEvaluate'
import { findSqlExercise } from './sqlExercises'
import { findContractExercise } from './contractExercises'
import { findSqlDelta } from './sqlSeedDelta'
import { clientIp, consumeRateLimit, sha256Hex } from './rateLimit'

const SQL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/

export const sqlRoutes = new Hono<AppEnv>()

async function resolveCallerSession(c: import('hono').Context<AppEnv>) {
  const presented = getCookie(c, SESSION_COOKIE)
  if (!presented || !isTokenFormat(presented)) {
    return null
  }
  return findLiveSession(c.env.DB, await hashSessionToken(presented))
}

// ---------------------------------------------------------------------------
// POST /api/v1/sql/exercises/:exerciseId/start
// ---------------------------------------------------------------------------
sqlRoutes.post('/sql/exercises/:exerciseId/start', async (c) => {
  const exerciseId = c.req.param('exerciseId') ?? ''
  // Phase 7: the start semantic is exercise-generic — a contract exercise
  // id mints its attempt identically. No new route is introduced; the
  // OpenAPI document describes both dialects on this path.
  const knownExercise = findSqlExercise(exerciseId) || findContractExercise(exerciseId)
  if (!SQL_ID_PATTERN.test(exerciseId) || !knownExercise) {
    return c.json(
      { error: 'exercise_not_found', message: 'No such practice exercise exists.' },
      404,
    )
  }
  // Mint a clean practice session for a fresh guest — same semantics as a
  // hunt start (a browser without a live session gets one; nothing about a
  // signed-in customer or an existing session changes).
  const live = await resolveCallerSession(c)
  let sessionId: number
  if (!live) {
    const fresh = await createSessionWithCart(c.env.DB, { mode: 'clean' })
    setCookie(c, SESSION_COOKIE, fresh.token, {
      httpOnly: true,
      path: '/',
      sameSite: 'Strict',
      maxAge: SESSION_TTL_SECONDS,
      secure: new URL(c.req.url).protocol === 'https:',
    })
    sessionId = fresh.sessionId
  } else {
    sessionId = live.id
  }
  // Idempotent — re-starting a live attempt returns the same row.
  const attempt = await ensureLiveAttempt(c.env.DB, sessionId, exerciseId)
  return c.json({ attempt: attemptView(attempt) })
})

// ---------------------------------------------------------------------------
// POST /api/v1/sql/evaluate
// ---------------------------------------------------------------------------

interface Envelope {
  exerciseId: string
  columns: string[]
  rows: SqlEvaluateCell[][]
  truncated: boolean
}

type EnvelopeResult = { ok: true; envelope: Envelope } | { ok: false; message: string }

function validateCell(value: unknown): SqlEvaluateCell | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    return value.length <= SQL_EVALUATE_MAX_CELL ? value : undefined
  }
  return undefined
}

function validateEnvelope(body: unknown): EnvelopeResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: 'Expected a JSON evaluation object.' }
  }
  const input = body as Partial<SqlEvaluateRequest>
  if (typeof input.exerciseId !== 'string' || input.exerciseId.length > 64) {
    return { ok: false, message: 'exerciseId is required and must be a short string.' }
  }
  if (!Array.isArray(input.columns) || input.columns.length === 0 || input.columns.length > SQL_EVALUATE_MAX_COLUMNS) {
    return { ok: false, message: `columns must be an array of 1–${SQL_EVALUATE_MAX_COLUMNS} names.` }
  }
  const columns: string[] = []
  const seen = new Set<string>()
  for (const column of input.columns) {
    if (typeof column !== 'string' || column.length === 0 || column.length > 128) {
      return { ok: false, message: 'Every column name must be a non-empty string of at most 128 characters.' }
    }
    const key = column.trim().toLowerCase()
    if (seen.has(key)) {
      return { ok: false, message: 'Column names must be unique (case-insensitive).' }
    }
    seen.add(key)
    columns.push(column)
  }
  if (!Array.isArray(input.rows) || input.rows.length > SQL_EVALUATE_MAX_ROWS) {
    return { ok: false, message: `rows must be an array of at most ${SQL_EVALUATE_MAX_ROWS} rows.` }
  }
  const rows: SqlEvaluateCell[][] = []
  for (const row of input.rows) {
    if (!Array.isArray(row) || row.length !== columns.length) {
      return { ok: false, message: 'Every row must carry exactly as many cells as there are columns.' }
    }
    const cells: SqlEvaluateCell[] = []
    for (const cell of row) {
      const cleaned = validateCell(cell)
      if (cleaned === undefined) {
        return { ok: false, message: 'Cells must be numbers, strings (≤ 10,000 characters), booleans or null.' }
      }
      cells.push(cleaned)
    }
    rows.push(cells)
  }
  return { ok: true, envelope: { exerciseId: input.exerciseId, columns, rows, truncated: input.truncated === true } }
}

sqlRoutes.post('/sql/evaluate', async (c) => {
  // Abuse control first — before any parsing or evaluation. The global
  // mutation backstop applies on top (app.ts). Local development without a
  // visible IP is not capped.
  const ip = clientIp(c)
  if (ip) {
    const decision = await consumeRateLimit(c.env.DB, 'sql-eval', await sha256Hex(ip), 30)
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds))
      return c.json(
        { error: 'rate_limited', message: 'Too many checks from this network. Wait a minute and try again.' },
        429,
      )
    }
  }

  const live = await resolveCallerSession(c)
  if (!live) {
    return c.json(
      { error: 'session_required', message: 'Start a practice session to check your work.' },
      401,
    )
  }

  const body = await c.req.json().catch(() => null)
  const parsed = validateEnvelope(body)
  if (!parsed.ok) {
    return c.json({ error: 'invalid_request', message: parsed.message }, 400)
  }
  const envelope = parsed.envelope

  const exercise = findSqlExercise(envelope.exerciseId)
  if (!exercise) {
    return c.json(
      { error: 'exercise_not_found', message: 'No such practice exercise exists.' },
      404,
    )
  }

  const evaluation = evaluateSubmission(exercise.expected, envelope)

  // Side effect (plan §10.3): a pass stamps the caller's attempt; a fail
  // leaves it in_progress. Nothing about the submitted rows is persisted
  // or logged.
  let attemptStatus: 'in_progress' | 'submitted' | 'revealed' | 'none'
  if (evaluation.passed) {
    const customerId = await resolveActiveCustomerId(c)
    const attempt = await resolveAttemptForSubmission(c.env.DB, live.id, exercise.id)
    const now = new Date().toISOString()
    const stamp = submissionStatements(attempt.id, customerId, now, {
      score: evaluation.score,
      discovered: false,
    })
    await c.env.DB.batch([c.env.DB.prepare(stamp.sql).bind(...stamp.binds)])
    const updated = await resolveAttemptForView(c.env.DB, live.id, exercise.id)
    attemptStatus = (updated ?? attempt).status
  } else {
    // Consistent with the hint/report paths: any interaction ensures the
    // caller's live attempt exists (in_progress until a pass).
    const attempt: AttemptRow = await resolveAttemptForSubmission(c.env.DB, live.id, exercise.id)
    attemptStatus = attempt.status
  }

  const response: SqlEvaluateResponse = {
    passed: evaluation.passed,
    score: evaluation.score,
    checks: evaluation.checks,
    feedback: evaluation.feedback,
    attemptStatus,
  }
  return c.json(response)
})

// ---------------------------------------------------------------------------
// GET /api/v1/sql/hunts/:huntId/seed
// ---------------------------------------------------------------------------
sqlRoutes.get('/sql/hunts/:huntId/seed', async (c) => {
  const huntId = c.req.param('huntId') ?? ''
  if (!HUNT_ID_PATTERN.test(huntId)) {
    return c.json(
      { error: 'invalid_request', message: 'A hunt id looks like hunt-db-001.' },
      400,
    )
  }
  // Abuse control first — no D1 reads or writes happen before this passes.
  const ip = clientIp(c)
  if (ip) {
    const decision = await consumeRateLimit(c.env.DB, 'sql-seed', await sha256Hex(ip), 30)
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds))
      return c.json(
        { error: 'rate_limited', message: 'Too many requests from this network. Wait a minute and try again.' },
        429,
      )
    }
  }

  const live = await resolveCallerSession(c)
  if (!live) {
    return c.json(
      { error: 'session_required', message: 'Start the hunt first.' },
      401,
    )
  }

  const hunt = findHunt(huntId)
  // Unknown hunts and non-SQL hunts are indistinguishable from SQL hunts in
  // clean mode — existence of the delta is never disclosed (plan §6.5).
  if (!hunt || hunt.kind !== 'sql') {
    return c.json({ error: 'not_found', message: 'No such practice hunt exists.' }, 404)
  }
  if (live.mode !== 'bug_hunt' || live.huntId !== huntId) {
    return c.json(
      { error: 'not_hunt_mode', message: 'Enter this hunt in bug-hunt mode before loading its sandbox.' },
      403,
    )
  }
  const deltaSql = findSqlDelta(huntId)
  if (!deltaSql) {
    // Registry and delta map are compile-time aligned; unreachable.
    return c.json({ error: 'not_found', message: 'No such practice hunt exists.' }, 404)
  }
  return c.json({ huntId, deltaSql })
})
