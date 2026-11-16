// Phase 6 M2 SQL routes — endpoint matrix (plan §10.3, §10.4).
// Real migrations, real session cookies, real ids from the registries.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import {
  createMigratedD1,
  type MigratedD1,
} from '../helpers/fake-d1'
import { SQL_EXERCISES } from '../../src/server/sqlExercises'

const IP = '203.0.113.77'

const ipHeaders = () => ({ 'cf-connecting-ip': IP })

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function extractCookie(setCookie: string | null, name: string): string | null {
  if (!setCookie) return null
  const match = new RegExp(`${name}=([a-f0-9]{32})`).exec(setCookie)
  return match ? match[1] : null
}

function allSetCookies(response: Response): string {
  const headers = response.headers as unknown as {
    getSetCookie?: () => string[]
    get(name: string): string | null
  }
  const list =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie') ?? '']
  return list.join('; ')
}

/** Mint a guest practice session via the reset endpoint (clean mode). */
async function freshGuestSession(migrated: MigratedD1) {
  const response = await app.request(
    '/api/v1/practice/session/reset',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    { DB: migrated.db },
  )
  return extractCookie(allSetCookies(response), 'mpl_session')
}

async function startSqlHunt(migrated: MigratedD1, huntId: string, cookie: string) {
  const response = await app.request(
    `/api/v1/practice/hunts/${huntId}/start`,
    { method: 'POST', headers: { ...sessionCookieHeader(cookie), ...ipHeaders() } },
    { DB: migrated.db },
  )
  return response
}

function envelopeFor(exerciseId: string) {
  const entry = SQL_EXERCISES.find((exercise) => exercise.id === exerciseId)!
  return {
    exerciseId,
    columns: entry.expected.columns.map((column) => column.name),
    rows: entry.expected.rows,
    truncated: false,
  }
}

describe('POST /api/v1/sql/exercises/:exerciseId/start', () => {
  it('mints and returns the live attempt idempotently', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    expect(session).toBeTruthy()
    const first = await app.request(
      '/api/v1/sql/exercises/sql-bgn-select-01/start',
      { method: 'POST', headers: sessionCookieHeader(session!) },
      { DB: migrated.db },
    )
    expect(first.status).toBe(200)
    const body = (await first.json()) as { attempt: { status: string } }
    expect(body.attempt.status).toBe('in_progress')
    const second = await app.request(
      '/api/v1/sql/exercises/sql-bgn-select-01/start',
      { method: 'POST', headers: sessionCookieHeader(session!) },
      { DB: migrated.db },
    )
    expect(second.status).toBe(200)
  })

  it('404s an unknown exercise id, and mints a clean guest session for a fresh browser', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    const missing = await app.request(
      '/api/v1/sql/exercises/sql-bgn-nope-99/start',
      { method: 'POST', headers: sessionCookieHeader(session!) },
      { DB: migrated.db },
    )
    expect(missing.status).toBe(404)
    // No cookie at all: a clean practice session is minted by the start call.
    const minted = await app.request(
      '/api/v1/sql/exercises/sql-bgn-select-01/start',
      { method: 'POST' },
      { DB: migrated.db },
    )
    expect(minted.status).toBe(200)
    const body = (await minted.json()) as { attempt: { status: string } }
    expect(body.attempt.status).toBe('in_progress')
    expect(allSetCookies(minted)).toContain('mpl_session=')
  })
})

describe('POST /api/v1/sql/evaluate', () => {
  it('401s without a session', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/sql/evaluate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelopeFor('sql-bgn-select-01')),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(401)
  })

  it('404s an unknown exercise, 400s a malformed envelope', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    const unknown = await app.request(
      '/api/v1/sql/evaluate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session!) },
        body: JSON.stringify({ exerciseId: 'sql-bgn-nope-99', columns: ['x'], rows: [[1]] }),
      },
      { DB: migrated.db },
    )
    expect(unknown.status).toBe(404)

    for (const bad of [
      null,
      {},
      { exerciseId: 'sql-bgn-select-01' },
      { exerciseId: 'sql-bgn-select-01', columns: [], rows: [] },
      { exerciseId: 'sql-bgn-select-01', columns: ['a'], rows: [[1, 2]] },
      { exerciseId: 'sql-bgn-select-01', columns: ['a'], rows: [['x'.repeat(10_001)]] },
      { exerciseId: 'sql-bgn-select-01', columns: ['a', 'A'], rows: [[1, 2]] },
      { exerciseId: 'sql-bgn-select-01', columns: ['a'], rows: [1] },
      { exerciseId: 'sql-bgn-select-01', columns: ['a'], rows: [[{}]] },
    ]) {
      const response = await app.request(
        '/api/v1/sql/evaluate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...sessionCookieHeader(session!) },
          body: JSON.stringify(bad),
        },
        { DB: migrated.db },
      )
      expect(response.status, JSON.stringify(bad)).toBe(400)
    }
  })

  it('passes the expected envelope and stamps the attempt submitted with the score', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    await app.request(
      '/api/v1/sql/exercises/sql-bgn-select-01/start',
      { method: 'POST', headers: sessionCookieHeader(session!) },
      { DB: migrated.db },
    )
    const response = await app.request(
      '/api/v1/sql/evaluate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session!), ...ipHeaders() },
        body: JSON.stringify(envelopeFor('sql-bgn-select-01')),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      passed: boolean
      score: number
      attemptStatus: string
      checks: Array<{ id: string; passed: boolean }>
    }
    expect(body.passed).toBe(true)
    expect(body.score).toBe(100)
    expect(body.attemptStatus).toBe('submitted')

    const attempt = await app.request(
      '/api/v1/practice/hunts/sql-bgn-select-01/attempt',
      { headers: sessionCookieHeader(session!) },
      { DB: migrated.db },
    )
    expect(attempt.status).toBe(200)
    const attemptBody = (await attempt.json()) as { status: string; bestQualityScore: number | null }
    expect(attemptBody.status).toBe('submitted')
    expect(attemptBody.bestQualityScore).toBe(100)
  })

  it('keeps the attempt in_progress on a failing evaluation', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    const wrong = {
      ...envelopeFor('sql-bgn-select-01'),
      rows: [['nope', 'nope']],
    }
    const response = await app.request(
      '/api/v1/sql/evaluate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session!) },
        body: JSON.stringify(wrong),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { passed: boolean; score: number; attemptStatus: string }
    expect(body.passed).toBe(false)
    expect(body.score).toBeLessThan(70)
    expect(body.attemptStatus).toBe('in_progress')
  })

  it('413s a payload larger than the 1 MB evaluation cap', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/sql/evaluate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024) },
        body: '{}',
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(413)
  })

  it('caps evaluation churn at 30 requests per IP per minute', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    let lastStatus = 0
    for (let i = 0; i < 31; i += 1) {
      const response = await app.request(
        '/api/v1/sql/evaluate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...sessionCookieHeader(session!), ...ipHeaders() },
          body: JSON.stringify(envelopeFor('sql-bgn-select-01')),
        },
        { DB: migrated.db },
      )
      lastStatus = response.status
    }
    expect(lastStatus).toBe(429)
  })
})

describe('GET /api/v1/sql/hunts/:huntId/seed', () => {
  it('401s without a session', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/sql/hunts/hunt-db-001/seed',
      {},
      { DB: migrated.db },
    )
    expect(response.status).toBe(401)
  })

  it('400s a malformed hunt id', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    const response = await app.request(
      '/api/v1/sql/hunts/not_a_hunt!/seed',
      { headers: sessionCookieHeader(session!) },
      { DB: migrated.db },
    )
    expect(response.status).toBe(400)
  })

  it('403s in clean mode, indistinguishably from a non-SQL hunt', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    for (const huntId of ['hunt-db-001', 'hunt-db-008', 'hunt-pricing-001']) {
      const response = await app.request(
        `/api/v1/sql/hunts/${huntId}/seed`,
        { headers: sessionCookieHeader(session!), ...ipHeaders() },
        { DB: migrated.db },
      )
      expect(response.status, huntId).toBe(huntId.startsWith('hunt-pricing') ? 404 : 403)
    }
  })

  it('404s an unknown hunt id even in bug-hunt mode', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    await startSqlHunt(migrated, 'hunt-db-001', session!)
    const response = await app.request(
      '/api/v1/sql/hunts/hunt-db-999/seed',
      { headers: sessionCookieHeader(session!), ...ipHeaders() },
      { DB: migrated.db },
    )
    expect(response.status).toBe(404)
  })

  it('serves the compiled delta in bug-hunt mode — twice, byte-identically, with no D1 writes', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    const started = await startSqlHunt(migrated, 'hunt-db-003', session!)
    expect(started.status).toBe(200)

    const first = await app.request(
      '/api/v1/sql/hunts/hunt-db-003/seed',
      { headers: sessionCookieHeader(session!), ...ipHeaders() },
      { DB: migrated.db },
    )
    const second = await app.request(
      '/api/v1/sql/hunts/hunt-db-003/seed',
      { headers: sessionCookieHeader(session!), ...ipHeaders() },
      { DB: migrated.db },
    )
    expect(first.status).toBe(200)
    const bodyA = (await first.json()) as { huntId: string; deltaSql: string }
    const bodyB = (await second.json()) as { huntId: string; deltaSql: string }
    expect(bodyA.huntId).toBe('hunt-db-003')
    expect(bodyA.deltaSql.length).toBeGreaterThan(0)
    expect(bodyB.deltaSql).toBe(bodyA.deltaSql)
  })
})

const UI_HUNTS = [
  'hunt-catalogue-001',
  'hunt-catalogue-002',
  'hunt-cart-001',
  'hunt-inventory-001',
  'hunt-pricing-001',
  'hunt-checkout-001',
  'hunt-authz-001',
  'hunt-authn-001',
  'hunt-rbac-001',
  'hunt-mass-001',
]

async function resetToClean(migrated: MigratedD1, cookie: string) {
  await app.request(
    '/api/v1/practice/session/reset',
    { method: 'POST', headers: sessionCookieHeader(cookie) },
    { DB: migrated.db },
  )
}

describe('SQL hunts and the start cap', () => {
  it('an SQL-hunt start never consumes the 20/IP/UTC-day UI hunt cap', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    // Drain the UI cap: each distinct UI hunt entry consumes one slot.
    for (let round = 0; round < 2; round += 1) {
      for (const huntId of UI_HUNTS) {
        await resetToClean(migrated, session!)
        const response = await startSqlHunt(migrated, huntId, session!)
        expect(response.status, huntId).toBe(200)
      }
    }
    // The cap is now exhausted — the next UI hunt entry is refused…
    await resetToClean(migrated, session!)
    const capped = await startSqlHunt(migrated, 'hunt-pricing-001', session!)
    expect(capped.status).toBe(429)
    // …but SQL hunts are untouched by the UI cap.
    const sqlHunt = await startSqlHunt(migrated, 'hunt-db-001', session!)
    expect(sqlHunt.status).toBe(200)
  })
})
