// Phase 7 contract-testing routes — see docs/phase-7-contract-testing-plan.md.
//
// Exactly four endpoints (plan §5.1), all resolved from the caller's
// `mpl_session` cookie; no attempt, defect, hunt or exercise id is ever
// accepted from outside the path/registry contract:
//   POST /api/v1/contract/validate         — exploratory validation.
//        404 unknown fixture (indistinguishable from an unknown operation),
//        400 malformed JSON / out-of-subset schema / over-budget payload,
//        429 contract-validate:iphash 30/min. No session required — pure
//        computation, no D1 reads, no writes.
//   POST /api/v1/contract/compare          — base/candidate diff (named
//        fixture pair or learner-pasted inline candidate). 400 on
//        out-of-subset schema, 404 unknown fixture, 429 contract-compare:iphash.
//   POST /api/v1/contract/verify-consumer  — consumer expectation vs canned
//        provider fixture. The `provider-product-v2-latest` alias resolves
//        server-side by the caller's live session (hunt-contract-007
//        bug-hunt ⇒ drift; everywhere else additive). Assertions only —
//        the raw delta never crosses the wire. 400 unknown fixture id,
//        429 contract-verify:iphash.
//   POST /api/v1/contract/evaluate         — scored, server-authoritative.
//        401 no session, 404 unknown exercise (id shape checked against
//        HUNT_ID_PATTERN), 400 malformed answer per family, 429
//        contract-eval:iphash, 413 via the global 32 KB cap. A pass stamps
//        the caller's attempt; a fail leaves it in_progress. The payload
//        itself is never stored.
//
// Security model: every route is data-in/verdict-out — no learner input is
// compiled, evaluated or fetched. Complexity budgets are enforced by the
// shared wrapper (src/shared/contractValidation.ts): ≤ 2,000 schema nodes,
// ≤ 5,000 payload nodes, depth ≤ 16/32, local `$ref` only (≤ 32 hops),
// `pattern` ≤ 256 chars. No route fetches a URL, executes code or touches
// SQL. Rate buckets are hashed-IP scoped (`contract-*`), coexisting with
// the global 120/min mutate backstop.

import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type {
  ContractCompareRequest,
  ContractEvaluateAnswer,
  ContractEvaluateRequest,
  ContractValidateRequest,
  ContractVerifyConsumerRequest,
} from '../shared/contractApi'
import type { ContractEvaluateResponse } from '../shared/contractTypes'
import type { AppEnv } from './app'
import {
  SESSION_COOKIE,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'
import { HUNT_ID_PATTERN } from './hunts'
import { clientIp, consumeRateLimit, sha256Hex } from './rateLimit'
import { findContractFixture, fixtureOperationSchema } from '../shared/contracts/index'
import {
  CONTRACT_MAX_INPUT_BYTES,
  ContractValidationError,
  validatePayload,
} from '../shared/contractValidation'
import { selectProviderFixture, PROVIDER_FIXTURE_IDS } from './contractDeltas'
import { diffContracts } from '../shared/contractDiff'
import { scoreConsumerExpectation } from './consumerRubric'
import {
  scoreSelections,
  scoreStructured,
} from './contractRubrics'
import {
  findContractExercise,
  type ContractExerciseDefinition,
  type ContractPayloadSchemaRef,
} from './contractExercises'
import {
  resolveActiveCustomerId,
  resolveAttemptForSubmission,
  resolveAttemptForView,
  submissionStatements,
} from './attempts'
import type { ContractEvaluationCheck } from '../shared/contractTypes'

export const contractRoutes = new Hono<AppEnv>()

const CONTRACT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/

async function resolveCallerSession(c: import('hono').Context<AppEnv>) {
  const presented = getCookie(c, SESSION_COOKIE)
  if (!presented || !isTokenFormat(presented)) {
    return null
  }
  return findLiveSession(c.env.DB, await hashSessionToken(presented))
}

/** Scoped rate cap; returns a 429 response when the budget is exhausted, else null. */
async function scopedCap(
  c: import('hono').Context<AppEnv>,
  scope: 'contract-validate' | 'contract-compare' | 'contract-verify' | 'contract-eval',
): Promise<Response | null> {
  const ip = clientIp(c)
  if (!ip) {
    return null
  }
  const decision = await consumeRateLimit(c.env.DB, scope, await sha256Hex(ip), 30)
  if (decision.allowed) {
    return null
  }
  c.header('Retry-After', String(decision.retryAfterSeconds))
  return c.json(
    { error: 'rate_limited', message: 'Too many contract requests from this network. Wait a minute and try again.' },
    429,
  )
}

/** Learner-supplied schema candidates/expectations must fit the 24 KB budget. */
function inlineNodeWithinBudget(node: unknown): boolean {
  try {
    return JSON.stringify(node).length <= CONTRACT_MAX_INPUT_BYTES
  } catch {
    return false
  }
}

function contractError(c: import('hono').Context<AppEnv>, error: unknown): Response {
  if (error instanceof ContractValidationError) {
    const status = error.code === 'invalid_schema' ? 400 : 400
    return c.json({ error: 'invalid_request', message: error.message }, status)
  }
  throw error
}

// ---------------------------------------------------------------------------
// POST /api/v1/contract/validate
// ---------------------------------------------------------------------------
contractRoutes.post('/contract/validate', async (c) => {
  const capped = await scopedCap(c, 'contract-validate')
  if (capped) {
    return capped
  }
  const body = (await c.req.json().catch(() => null)) as Partial<ContractValidateRequest> | null
  if (!body || typeof body.fixtureId !== 'string' || body.payload === undefined) {
    return c.json(
      { error: 'invalid_request', message: 'Expected { fixtureId, operationId?, payload }.' },
      400,
    )
  }
  if (!CONTRACT_ID_PATTERN.test(body.fixtureId)) {
    return c.json({ error: 'invalid_request', message: 'fixtureId looks like ledger-v1.' }, 400)
  }
  const target = fixtureOperationSchema(body.fixtureId, typeof body.operationId === 'string' ? body.operationId : undefined)
  if (!target) {
    return c.json({ error: 'not_found', message: 'No such contract fixture or operation exists.' }, 404)
  }
  if (!inlineNodeWithinBudget(body.payload)) {
    return c.json(
      { error: 'invalid_request', message: 'The payload is larger than the 24 KB limit.' },
      400,
    )
  }
  try {
    const assertions = validatePayload(target.schema, body.payload)
    return c.json({
      fixtureId: body.fixtureId,
      operationId: target.label,
      locus: 'both',
      valid: assertions.length === 0,
      assertions,
    })
  } catch (error) {
    return contractError(c, error)
  }
})

// ---------------------------------------------------------------------------
// POST /api/v1/contract/compare
// ---------------------------------------------------------------------------
contractRoutes.post('/contract/compare', async (c) => {
  const capped = await scopedCap(c, 'contract-compare')
  if (capped) {
    return capped
  }
  const body = (await c.req.json().catch(() => null)) as Partial<ContractCompareRequest> | null
  if (
    !body ||
    typeof body.baseFixtureId !== 'string' ||
    (body.locus !== 'request' && body.locus !== 'response') ||
    !CONTRACT_ID_PATTERN.test(body.baseFixtureId)
  ) {
    return c.json(
      { error: 'invalid_request', message: 'Expected { baseFixtureId, locus: request|response, candidateFixtureId } or { ..., candidateSchema }.' },
      400,
    )
  }
  const base = findContractFixture(body.baseFixtureId)
  if (!base) {
    return c.json({ error: 'not_found', message: 'No such contract fixture exists.' }, 404)
  }
  const hasInline = body.candidateSchema !== undefined
  const hasNamed = body.candidateFixtureId !== undefined
  if (hasInline === hasNamed) {
    // Neither or both — mutually exclusive per the contract.
    return c.json(
      { error: 'invalid_request', message: 'Provide exactly one of candidateFixtureId or candidateSchema.' },
      400,
    )
  }
  let candidateSchema: unknown
  let candidateFixtureId: string | undefined
  if (hasNamed) {
    if (typeof body.candidateFixtureId !== 'string' || !CONTRACT_ID_PATTERN.test(body.candidateFixtureId)) {
      return c.json({ error: 'invalid_request', message: 'candidateFixtureId looks like ledger-v2-breaking.' }, 400)
    }
    const candidate = findContractFixture(body.candidateFixtureId)
    if (!candidate) {
      return c.json({ error: 'not_found', message: 'No such contract fixture exists.' }, 404)
    }
    candidateSchema = candidate.schema
    candidateFixtureId = candidate.id
  } else {
    if (!inlineNodeWithinBudget(body.candidateSchema)) {
      return c.json(
        { error: 'invalid_request', message: 'The candidate schema is larger than the 24 KB limit.' },
        400,
      )
    }
    candidateSchema = body.candidateSchema
  }
  try {
    const { verdict, findings } = diffContracts(base.schema, candidateSchema, { locus: body.locus })
    return c.json({
      baseFixtureId: base.id,
      ...(candidateFixtureId ? { candidateFixtureId } : {}),
      locus: body.locus,
      verdict,
      findings,
    })
  } catch (error) {
    return contractError(c, error)
  }
})

// ---------------------------------------------------------------------------
// POST /api/v1/contract/verify-consumer
// ---------------------------------------------------------------------------
contractRoutes.post('/contract/verify-consumer', async (c) => {
  const capped = await scopedCap(c, 'contract-verify')
  if (capped) {
    return capped
  }
  const body = (await c.req.json().catch(() => null)) as Partial<ContractVerifyConsumerRequest> | null
  if (
    !body ||
    body.expectation === undefined ||
    typeof body.providerFixtureId !== 'string' ||
    !(PROVIDER_FIXTURE_IDS as readonly string[]).includes(body.providerFixtureId)
  ) {
    return c.json(
      { error: 'invalid_request', message: 'Expected { expectation, providerFixtureId } with a known provider fixture id.' },
      400,
    )
  }
  if (!inlineNodeWithinBudget(body.expectation)) {
    return c.json(
      { error: 'invalid_request', message: 'The expectation is larger than the 24 KB limit.' },
      400,
    )
  }
  const live = await resolveCallerSession(c)
  const hunt007Active = live !== null && live.mode === 'bug_hunt' && live.huntId === 'hunt-contract-007'
  const payload = selectProviderFixture(body.providerFixtureId as Parameters<typeof selectProviderFixture>[0], hunt007Active)
  try {
    const assertions = validatePayload(body.expectation, payload)
    const valid = assertions.length === 0
    const first = assertions[0]
    return c.json({
      valid,
      statusOk: true,
      assertions,
      ...(valid
        ? {}
        : {
            mismatchSummary: `${first.path} — ${first.keyword} — expected ${first.expected}, actual ${first.actual}`,
          }),
    })
  } catch (error) {
    return contractError(c, error)
  }
})

// ---------------------------------------------------------------------------
// POST /api/v1/contract/evaluate
// ---------------------------------------------------------------------------

const CLASSIFICATIONS = new Set(['breaking', 'compatible', 'review'])

function parseSelections(value: unknown, message: string): { ok: true; selections: string[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return { ok: false, message }
  }
  if (value.length > 64) {
    return { ok: false, message: 'Too many selections.' }
  }
  const selections: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 96) {
      return { ok: false, message }
    }
    selections.push(item)
  }
  return { ok: true, selections }
}

function parseClassifications(
  value: unknown,
): { ok: true; classifications: Record<string, string> } | { ok: false; message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'classifications must be an object of finding → breaking|compatible|review.' }
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0 || entries.length > 64) {
    return { ok: false, message: 'classifications must cover 1–64 findings.' }
  }
  const classifications: Record<string, string> = {}
  for (const [key, got] of entries) {
    if (typeof got !== 'string' || !CLASSIFICATIONS.has(got)) {
      return { ok: false, message: `classifications.${key} must be breaking, compatible or review.` }
    }
    if (key.length === 0 || key.length > 96) {
      return { ok: false, message: 'Finding ids must be short strings.' }
    }
    classifications[key] = got
  }
  return { ok: true, classifications }
}

function parseChoices(value: unknown): Record<string, string> {
  const choices: Record<string, string> = {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return choices
  }
  for (const [key, got] of Object.entries(value as Record<string, unknown>)) {
    if (typeof got === 'string' && got.length > 0 && got.length <= 96) {
      choices[key] = got
    }
  }
  return choices
}

function evaluateAnswer(
  exercise: ContractExerciseDefinition,
  answer: ContractEvaluateAnswer,
): { score: number; passed: boolean; checks: ContractEvaluationCheck[]; feedback: string } {
  const evaluation = exercise.evaluation

  // --- consumer family --------------------------------------------------------
  if (evaluation.family === 'consumer') {
    const result = scoreConsumerExpectation(answer.kind === 'consumer' ? answer.expectation : undefined)
    return {
      passed: result.passed,
      score: result.score,
      checks: result.checks.map((check) => ({
        id: check.id,
        passed: check.passed,
        message: check.message,
        points: check.points,
      })),
      feedback: result.feedback,
    }
  }

  // --- compare family ---------------------------------------------------------
  if (evaluation.family === 'compare') {
    const classifications = answer.kind === 'compare' ? parseClassifications(answer.classifications) : { ok: false as const, message: 'classifications are required for compare exercises.' }
    if (!classifications.ok) {
      throw new ContractValidationError('invalid_schema', classifications.message)
    }
    const choices = answer.kind === 'compare' ? parseChoices(answer.choices) : {}
    const graded = scoreClassificationsAgainst(evaluation, classifications.classifications, choices)
    return graded
  }

  // --- selections / validate / structured --------------------------------------
  const selections =
    answer.kind === 'validate' || answer.kind === 'structured'
      ? parseSelections(answer.selections, 'selections must be an array of short strings.')
      : { ok: false as const, message: 'selections are required for this exercise.' }

  if (evaluation.family === 'selections' || evaluation.family === 'validate') {
    if (!selections.ok) {
      throw new ContractValidationError('invalid_schema', selections.message)
    }
    if (evaluation.family === 'validate') {
      // Two-stage: selections worth 40, payload worth 60.
      const selectionResult = scoreSelections(evaluation.expectedSelections, selections.selections, 40)
      const payloadValid = scorePayloadSide(evaluation.payloadSchemaRef, answer)
      const score = selectionResult.points + payloadValid.points
      const checks: ContractEvaluationCheck[] = [
        {
          id: 'selections',
          passed: selectionResult.points >= 28,
          message: selectionResult.check.message,
          points: selectionResult.points,
        },
        {
          id: 'payload',
          passed: payloadValid.passed,
          message: payloadValid.message,
          points: payloadValid.points,
        },
      ]
      return finalizeChecks(checks, score, 'Fix the payload to the documented schema and resubmit.')
    }
    const result = scoreStructured(evaluation.expected, selections.selections)
    return {
      passed: result.passed,
      score: result.score,
      checks: result.checks,
      feedback: result.feedback,
    }
  }

  throw new ContractValidationError('invalid_schema', 'Unsupported exercise evaluation.')
}

function scorePayloadSide(
  ref: ContractPayloadSchemaRef,
  answer: ContractEvaluateAnswer,
): { passed: boolean; points: number; message: string } {
  if (answer.kind !== 'validate' || answer.payload === undefined) {
    return { passed: false, points: 0, message: 'Submit the corrected payload to score this part.' }
  }
  const schema = payloadSchemaFor(ref)
  if (!schema) {
    return { passed: false, points: 0, message: 'The payload contract is temporarily unavailable.' }
  }
  try {
    const assertions = validatePayload(schema, answer.payload)
    if (assertions.length === 0) {
      return { passed: true, points: 60, message: 'The corrected payload validates against the documented schema.' }
    }
    const first = assertions[0]
    return {
      passed: false,
      points: 0,
      message: `Payload still fails at ${first.path} (${first.keyword}): expected ${first.expected}, actual ${first.actual}.`,
    }
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return { passed: false, points: 0, message: error.message }
    }
    throw error
  }
}

function payloadSchemaFor(ref: ContractPayloadSchemaRef): Record<string, unknown> | null {
  switch (ref) {
    case 'ledger-v1/LedgerEntry': {
      const target = fixtureOperationSchema('ledger-v1', 'LedgerEntry')
      return target ? target.schema : null
    }
    case 'checkout-flow/OrderDetail': {
      const target = fixtureOperationSchema('checkout-flow', 'OrderDetail')
      return target ? target.schema : null
    }
  }
}

function scoreClassificationsAgainst(
  evaluation: Extract<ContractExerciseDefinition['evaluation'], { family: 'compare' }>,
  classifications: Record<string, string>,
  choices: Record<string, string>,
): { score: number; passed: boolean; checks: ContractEvaluationCheck[]; feedback: string } {
  const expected = evaluation.expectedClassifications
  const entries = Object.entries(expected)
  let correct = 0
  let addressed = 0
  const wrong: string[] = []
  const missed: string[] = []
  for (const [findingId, wanted] of entries) {
    const got = classifications[findingId]
    if (got === undefined) {
      missed.push(findingId)
      continue
    }
    if (CLASSIFICATIONS.has(got)) {
      addressed += 1
      if (got === wanted) correct += 1
      else wrong.push(findingId)
    } else {
      missed.push(findingId)
    }
  }
  const hasChoices = evaluation.expectedChoices !== undefined && Object.keys(evaluation.expectedChoices).length > 0
  const classificationBudget = hasChoices ? 70 : 100
  const correctness = entries.length === 0 ? 1 : correct / entries.length
  const completeness = entries.length === 0 ? 1 : addressed / entries.length
  const classificationScore = Math.round((correctness * 0.7 + completeness * 0.3) * classificationBudget)

  const checks: ContractEvaluationCheck[] = [
    {
      id: 'classifications',
      passed: correct === entries.length && addressed === entries.length,
      message:
        correct === entries.length && addressed === entries.length
          ? 'All findings classified into the expected buckets.'
          : `Wrong bucket: ${wrong.join(', ') || '—'}${missed.length > 0 ? `; unaddressed: ${missed.join(', ')}` : ''}.`,
      points: classificationScore,
    },
  ]
  let score = classificationScore
  if (hasChoices && evaluation.expectedChoices) {
    const expectedChoices = Object.entries(evaluation.expectedChoices)
    let matched = 0
    for (const [findingId, wanted] of expectedChoices) {
      if (choices[findingId] === wanted) matched += 1
    }
    const choiceScore = Math.round((expectedChoices.length === 0 ? 1 : matched / expectedChoices.length) * 30)
    checks.push({
      id: 'choices',
      passed: matched === expectedChoices.length,
      message:
        matched === expectedChoices.length
          ? 'Impact reason selected correctly.'
          : 'The consumer-impact reason is the contract point here — re-read the finding.',
      points: choiceScore,
    })
    score = classificationScore + choiceScore
  }
  return finalizeChecks(checks, score, 'Breaking is breaking; enum widening is always review.')
}

function finalizeChecks(
  checks: ContractEvaluationCheck[],
  score: number,
  fallbackFeedback: string,
): { score: number; passed: boolean; checks: ContractEvaluationCheck[]; feedback: string } {
  const bounded = Math.max(0, Math.min(100, Math.round(score)))
  const passed = bounded >= 70
  const failed = checks.filter((check) => !check.passed)
  const feedback = passed
    ? 'Passed. Deterministic checks passed — nice work.'
    : failed.map((check) => check.message).join(' ') || fallbackFeedback
  return { score: bounded, passed, checks, feedback }
}

contractRoutes.post('/contract/evaluate', async (c) => {
  const capped = await scopedCap(c, 'contract-eval')
  if (capped) {
    return capped
  }
  const live = await resolveCallerSession(c)
  if (!live) {
    return c.json(
      { error: 'session_required', message: 'Start a practice session to check your work.' },
      401,
    )
  }
  const body = (await c.req.json().catch(() => null)) as Partial<ContractEvaluateRequest> | null
  if (!body || typeof body.exerciseId !== 'string' || typeof body.answer !== 'object' || body.answer === null) {
    return c.json({ error: 'invalid_request', message: 'Expected { exerciseId, answer }.' }, 400)
  }
  const exerciseId = body.exerciseId
  if (!HUNT_ID_PATTERN.test(exerciseId)) {
    return c.json({ error: 'exercise_not_found', message: 'No such practice exercise exists.' }, 404)
  }
  const exercise = findContractExercise(exerciseId)
  if (!exercise) {
    return c.json({ error: 'exercise_not_found', message: 'No such practice exercise exists.' }, 404)
  }

  let evaluation: { score: number; passed: boolean; checks: ContractEvaluationCheck[]; feedback: string }
  try {
    evaluation = evaluateAnswer(exercise, body.answer)
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return c.json({ error: 'invalid_request', message: error.message }, 400)
    }
    throw error
  }

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
    const attempt = await resolveAttemptForSubmission(c.env.DB, live.id, exercise.id)
    attemptStatus = attempt.status
  }

  const response: ContractEvaluateResponse = {
    passed: evaluation.passed,
    score: evaluation.score,
    checks: evaluation.checks.map((check) => ({
      id: check.id,
      passed: check.passed,
      message: check.message,
      points: check.points,
    })),
    feedback: evaluation.feedback,
    attemptStatus,
  }
  return c.json(response)
})
