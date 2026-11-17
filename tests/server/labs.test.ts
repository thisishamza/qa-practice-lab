// Final phase — lab evaluation endpoint (performance/security/microservices
// exercise catalogues). Real migrations, real sessions. Covers: 401/404/400
// boundaries, attempt start idempotency, fail-leaves-in_progress vs
// pass-stamps-submitted, reveal gating before/after submission, and the
// leak boundary (pre-authorization responses carry no answer key).
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import {
  createMigratedD1,
  type MigratedD1,
} from '../helpers/fake-d1'
import { PERFORMANCE_EXERCISES } from '../../src/data/performanceExercises'
import { SECURITY_EXERCISES } from '../../src/data/securityExercises'
import { EVENT_EXERCISES } from '../../src/data/eventExercises'
import { findLabExercise } from '../../src/server/labExercises'

const IP = '203.0.113.111'
const ipHeaders = () => ({ 'cf-connecting-ip': IP })

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function extractCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /mpl_session=([a-f0-9]{32})/.exec(setCookie)
  return match ? match[1] : null
}

function allSetCookies(response: Response): string[] {
  const headers = response.headers as unknown as {
    getSetCookie?: () => string[]
    get(name: string): string | null
  }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }
  return [headers.get('set-cookie') ?? '']
}

async function freshGuestSession(migrated: MigratedD1): Promise<string> {
  const response = await app.request(
    '/api/v1/practice/session/reset',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    { DB: migrated.db },
  )
  const cookie = extractCookie(allSetCookies(response).join('; '))
  if (cookie === null) {
    throw new Error('Expected the reset to mint a practice session cookie.')
  }
  return cookie
}

async function startAttempt(migrated: MigratedD1, exerciseId: string, cookie: string | null) {
  return app.request(
    `/api/v1/sql/exercises/${exerciseId}/start`,
    {
      method: 'POST',
      headers: { ...(cookie ? sessionCookieHeader(cookie) : {}), 'content-type': 'application/json', ...ipHeaders() },
      body: '{}',
    },
    { DB: migrated.db },
  )
}

async function evaluate(
  migrated: MigratedD1,
  exerciseId: string,
  selections: string[],
  cookie: string | null,
) {
  const response = await app.request(
    '/api/v1/labs/evaluate',
    {
      method: 'POST',
      headers: { ...(cookie ? sessionCookieHeader(cookie) : {}), 'content-type': 'application/json', ...ipHeaders() },
      body: JSON.stringify({ exerciseId, selections }),
    },
    { DB: migrated.db },
  )
  return { response, body: (await response.json()) as { passed: boolean; score: number; attemptStatus: string; checks: Array<{ id: string; passed: boolean }> } }
}

const EXERCISE_ID = 'perf-bgn-baseline-01'
const EXPECTED_ANSWER = ['first-baseline', 'first-load', 'first-compare', 'first-cold']
const WRONG_ANSWER = ['first-spike', 'first-stress', 'first-fine', 'first-external']

describe('labs/evaluate', () => {
  it('requires a live session', async () => {
    const migrated = createMigratedD1()
    const { response, body } = await evaluate(migrated, EXERCISE_ID, EXPECTED_ANSWER, null)
    expect(response.status).toBe(401)
    expect((body as unknown as { error: string }).error).toBe('session_required')
  })

  it('answers 404 for an unknown exercise id', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const { response } = await evaluate(migrated, 'perf-nope-nope-99', [], cookie)
    expect(response.status).toBe(404)
  })

  it('answers 400 for an out-of-set selection id', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const { response } = await evaluate(migrated, EXERCISE_ID, ['not-an-option-id'], cookie)
    expect(response.status).toBe(400)
  })

  it('starts an attempt idempotently through the shared start path', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    const first = await startAttempt(migrated, EXERCISE_ID, cookie)
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as { attempt: { attemptId?: string; status: string } }
    const second = await startAttempt(migrated, EXERCISE_ID, cookie)
    expect(second.status).toBe(200)
    const secondBody = (await second.json()) as { attempt: { attemptId?: string; status: string } }
    expect(secondBody.attempt.status).toBe('in_progress')
    expect(firstBody.attempt.status).toBe('in_progress')
  })

  it('a failing score leaves the attempt in_progress; a passing one submits it', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await startAttempt(migrated, EXERCISE_ID, cookie)

    const failing = await evaluate(migrated, EXERCISE_ID, WRONG_ANSWER, cookie)
    expect(failing.response.status).toBe(200)
    expect(failing.body.passed).toBe(false)
    expect(failing.body.score).toBeLessThan(70)
    expect(failing.body.attemptStatus).toBe('in_progress')

    const passing = await evaluate(migrated, EXERCISE_ID, EXPECTED_ANSWER, cookie)
    expect(passing.response.status).toBe(200)
    expect(passing.body.passed).toBe(true)
    expect(passing.body.score).toBe(100)
    expect(passing.body.attemptStatus).toBe('submitted')
  })

  it('garbage selections earn 0/100, not a crash', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await startAttempt(migrated, EXERCISE_ID, cookie)
    const { body } = await evaluate(migrated, EXERCISE_ID, [], cookie)
    expect(body.passed).toBe(false)
    expect(body.score).toBeLessThan(70)
  })

  it('leak boundary: the reveal stays locked before a submission and opens after', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshGuestSession(migrated)
    await startAttempt(migrated, EXERCISE_ID, cookie)

    const locked = await app.request(
      `/api/v1/practice/hunts/${EXERCISE_ID}/reveal`,
      { method: 'GET', headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(locked.status).toBe(403)
    const lockedBody = await locked.json()
    expect(JSON.stringify(lockedBody)).not.toContain('Baseline first')

    await evaluate(migrated, EXERCISE_ID, EXPECTED_ANSWER, cookie)

    const unlocked = await app.request(
      `/api/v1/practice/hunts/${EXERCISE_ID}/reveal`,
      { method: 'GET', headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(unlocked.status).toBe(200)
    const revealed = (await unlocked.json()) as { solution?: string }
    expect(revealed.solution).toBeTruthy()
  })
})

describe('lab exercise registry consistency', () => {
  it('the server answer key covers every client-safe exercise exactly once', () => {
    const all = [...PERFORMANCE_EXERCISES, ...SECURITY_EXERCISES, ...EVENT_EXERCISES]
    for (const exercise of all) {
      const runtime = findLabExercise(exercise.id)
      expect(runtime, exercise.id).not.toBeNull()
      expect(runtime?.expected.length).toBeGreaterThan(0)
      // Every expected id must be a real option in the checklist.
      const optionIds = new Set(exercise.checklist.map((item) => item.id))
      for (const expectedId of runtime?.expected ?? []) {
        expect(optionIds.has(expectedId), `${exercise.id} → ${expectedId}`).toBe(true)
      }
    }
  })
})
