// Lab exercise evaluation (final phase) — POST /api/v1/labs/evaluate.
//
// One scored endpoint for the performance, security and microservices lab
// exercise catalogues. All three share the selection rubric (recall 70% +
// precision 30%, pass ≥ 70 — same maths as the contract structured family).
// Scoring is deterministic and server-authoritative; the checks list is
// returned for the learner-facing transparency panel.
//
// Security model:
// - Resolved from the caller's `mpl_session` cookie; never accepts defect,
//   hunt, attempt or customer identifiers from the client.
// - Unknown exercise id → 404 exercise_not_found (indistinguishable for the
//   three catalogues). Answer selection ids must exist in the exercise's
//   checklist — out-of-set ids answer 400 (they carry no signal anyway).
// - Payload is never stored. A pass stamps the caller's attempt via the
//   shared submission path (same as SQL/contract evaluation): status →
//   submitted, best score running max.
// - Scoped cap `labs-eval:iphash` 30/min, coexisting with the global
//   120/min mutate backstop. 32 KB global body cap applies.

import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AppEnv } from './app'
import {
  SESSION_COOKIE,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'
import { clientIp, consumeRateLimit, sha256Hex } from './rateLimit'
import { findLabExercise, labChecklistIds } from './labExercises'
import { scoreSelections } from './contractRubrics'
import {
  resolveActiveCustomerId,
  resolveAttemptForSubmission,
  resolveAttemptForView,
  submissionStatements,
} from './attempts'

export const labsRoutes = new Hono<AppEnv>()

const LAB_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/
const MAX_SELECTIONS = 40
const MAX_SELECTION_LENGTH = 96
const PASS_SCORE = 70

async function resolveCallerSession(c: import('hono').Context<AppEnv>) {
  const presented = getCookie(c, SESSION_COOKIE)
  if (!presented || !isTokenFormat(presented)) {
    return null
  }
  return findLiveSession(c.env.DB, await hashSessionToken(presented))
}

labsRoutes.post('/labs/evaluate', async (c) => {
  const ip = clientIp(c)
  if (ip) {
    const decision = await consumeRateLimit(c.env.DB, 'labs-eval', await sha256Hex(ip), 30)
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds))
      return c.json(
        { error: 'rate_limited', message: 'Too many evaluation requests from this network. Wait a minute and try again.' },
        429,
      )
    }
  }

  const live = await resolveCallerSession(c)
  if (!live) {
    return c.json({ error: 'session_required', message: 'Start the exercise before checking your work.' }, 401)
  }

  const body = (await c.req.json().catch(() => null)) as
    | { exerciseId?: unknown; selections?: unknown }
    | null
  if (!body || typeof body.exerciseId !== 'string') {
    return c.json({ error: 'invalid_request', message: 'Expected { exerciseId, selections }.' }, 400)
  }
  const exerciseId = body.exerciseId
  if (!LAB_ID_PATTERN.test(exerciseId)) {
    return c.json({ error: 'exercise_not_found', message: 'No such practice exercise exists.' }, 404)
  }
  const exercise = findLabExercise(exerciseId)
  if (!exercise) {
    return c.json({ error: 'exercise_not_found', message: 'No such practice exercise exists.' }, 404)
  }

  if (!Array.isArray(body.selections)) {
    return c.json({ error: 'invalid_request', message: 'selections must be an array of option ids.' }, 400)
  }
  if (body.selections.length > MAX_SELECTIONS) {
    return c.json({ error: 'invalid_request', message: `Too many selections (max ${MAX_SELECTIONS}).` }, 400)
  }
  const selections: string[] = []
  for (const item of body.selections) {
    if (typeof item !== 'string' || item.length === 0 || item.length > MAX_SELECTION_LENGTH) {
      return c.json({ error: 'invalid_request', message: 'Each selection must be a short string.' }, 400)
    }
    selections.push(item)
  }
  const uniqueSelections = [...new Set(selections)]
  const allowed = new Set(labChecklistIds(exerciseId) ?? [])
  for (const id of uniqueSelections) {
    if (!allowed.has(id)) {
      return c.json({ error: 'invalid_request', message: `Unknown option id: ${id}.` }, 400)
    }
  }

  const selectionResult = scoreSelections(exercise.expected, uniqueSelections, 100)
  const score = Math.max(0, Math.min(100, selectionResult.points))
  const passed = score >= PASS_SCORE
  const check = {
    id: 'selections',
    passed: selectionResult.check.passed,
    message: selectionResult.check.message,
    points: score,
  }

  let attemptStatus: 'in_progress' | 'submitted' | 'revealed' | 'none'
  if (passed) {
    const customerId = await resolveActiveCustomerId(c)
    const attempt = await resolveAttemptForSubmission(c.env.DB, live.id, exercise.id)
    const now = new Date().toISOString()
    const stamp = submissionStatements(attempt.id, customerId, now, {
      score,
      discovered: false,
    })
    await c.env.DB.batch([c.env.DB.prepare(stamp.sql).bind(...stamp.binds)])
    const updated = await resolveAttemptForView(c.env.DB, live.id, exercise.id)
    attemptStatus = (updated ?? attempt).status
  } else {
    const attempt = await resolveAttemptForSubmission(c.env.DB, live.id, exercise.id)
    attemptStatus = attempt.status
  }

  return c.json({
    passed,
    score,
    checks: [check],
    feedback: passed
      ? 'Passed. Deterministic checks passed — nice work.'
      : selectionResult.check.message,
    attemptStatus,
  })
})
