// Phase 6 M2 learning loop — SQL exercise hints, gated reveals, attempt
// lifecycle and progress integration through the shared Phase 4 machinery.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import {
  createMigratedD1,
  type MigratedD1,
} from '../helpers/fake-d1'
import { HINTS } from '../../src/server/hints'
import { SQL_HINTS } from '../../src/server/sqlHints'
import { findSqlReveal } from '../../src/server/sqlReveals'
import { SQL_EXERCISES as SERVER_EXERCISES } from '../../src/server/sqlExercises'
import { SQL_DELTA_HUNT_IDS } from '../../src/server/sqlSeedDelta'
import { SQL_EXERCISES as CLIENT_EXERCISES } from '../../src/data/sqlExercises'

const IP = '203.0.113.88'

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function ipHeaders() {
  return { 'cf-connecting-ip': IP }
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

async function freshGuestSession(migrated: MigratedD1) {
  const response = await app.request(
    '/api/v1/practice/session/reset',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    { DB: migrated.db },
  )
  return extractCookie(allSetCookies(response), 'mpl_session')!
}

describe('SQL hint registry — completeness and separation', () => {
  it('covers every SQL exercise and SQL hunt with three levels', () => {
    const expected = [
      ...CLIENT_EXERCISES.map((exercise) => exercise.id),
      ...SQL_DELTA_HUNT_IDS,
    ]
    expect(Object.keys(SQL_HINTS).sort()).toEqual([...expected].sort())
    for (const id of expected) {
      const hints = SQL_HINTS[id]
      expect(hints.level1.length).toBeGreaterThan(20)
      expect(hints.level2.length).toBeGreaterThan(20)
      expect(hints.level3.length).toBeGreaterThan(20)
    }
  })

  it('does not overlap the Phase 4 hunt registry', () => {
    for (const id of Object.keys(SQL_HINTS)) {
      expect(HINTS[id], `${id} must not appear in the Phase 4 registry`).toBeUndefined()
    }
  })

  it('ships a gated reveal (with solution) for every hint target', () => {
    for (const id of Object.keys(SQL_HINTS)) {
      expect(findSqlReveal(id), `${id} needs a reveal`).not.toBeNull()
      expect(findSqlReveal(id)!.solution.length).toBeGreaterThan(10)
    }
  })
})

describe('SQL exercise hints — the ladder', () => {
  it('serves levels in order, idempotently, and counts usage', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    await app.request(
      '/api/v1/sql/exercises/sql-bgn-select-01/start',
      { method: 'POST', headers: sessionCookieHeader(session) },
      { DB: migrated.db },
    )

    // Level 2 is locked until level 1 is used.
    const early = await app.request(
      '/api/v1/practice/hunts/sql-bgn-select-01/hints',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session) },
        body: JSON.stringify({ level: 2 }),
      },
      { DB: migrated.db },
    )
    expect(early.status).toBe(409)

    const level1 = await app.request(
      '/api/v1/practice/hunts/sql-bgn-select-01/hints',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session) },
        body: JSON.stringify({ level: 1 }),
      },
      { DB: migrated.db },
    )
    expect(level1.status).toBe(200)
    const body = (await level1.json()) as { level: number; hint: string; hintsUsed: number }
    expect(body.hintsUsed).toBe(1)
    expect(body.hint).toBe(SQL_HINTS['sql-bgn-select-01'].level1)

    const again = await app.request(
      '/api/v1/practice/hunts/sql-bgn-select-01/hints',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session) },
        body: JSON.stringify({ level: 1 }),
      },
      { DB: migrated.db },
    )
    expect(((await again.json()) as { hintsUsed: number }).hintsUsed).toBe(1)

    const level2 = await app.request(
      '/api/v1/practice/hunts/sql-bgn-select-01/hints',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session) },
        body: JSON.stringify({ level: 2 }),
      },
      { DB: migrated.db },
    )
    expect(level2.status).toBe(200)
  })

  it('401s without a session and 400s an invalid level', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    const anonymous = await app.request(
      '/api/v1/practice/hunts/sql-bgn-select-01/hints',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ level: 1 }),
      },
      { DB: migrated.db },
    )
    expect(anonymous.status).toBe(401)
    const invalid = await app.request(
      '/api/v1/practice/hunts/sql-bgn-select-01/hints',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session) },
        body: JSON.stringify({ level: 4 }),
      },
      { DB: migrated.db },
    )
    expect(invalid.status).toBe(400)
  })
})

describe('SQL exercise reveal gating', () => {
  const exercise = 'sql-bgn-select-01'

  async function startExercise(migrated: MigratedD1, session: string) {
    await app.request(
      `/api/v1/sql/exercises/${exercise}/start`,
      { method: 'POST', headers: sessionCookieHeader(session) },
      { DB: migrated.db },
    )
  }

  it('locks the reveal before any submission or give-up', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    await startExercise(migrated, session)
    const response = await app.request(
      `/api/v1/practice/hunts/${exercise}/reveal`,
      { headers: sessionCookieHeader(session) },
      { DB: migrated.db },
    )
    expect(response.status).toBe(403)
    const giveUp = await app.request(
      `/api/v1/practice/hunts/${exercise}/reveal`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session) },
        body: JSON.stringify({ confirm: false }),
      },
      { DB: migrated.db },
    )
    expect(giveUp.status).toBe(400)
  })

  it('reveals solution and explanation after an explicit confirmed give-up', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    await startExercise(migrated, session)
    const response = await app.request(
      `/api/v1/practice/hunts/${exercise}/reveal`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session) },
        body: JSON.stringify({ confirm: true }),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      solution: string
      explanation: string
      attempt: { status: string }
    }
    expect(body.solution).toContain('categories')
    expect(body.explanation.length).toBeGreaterThan(20)
    expect(body.attempt.status).toBe('revealed')
  })

  it('reveals after a passing evaluation without a give-up', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    await startExercise(migrated, session)
    const expected = SERVER_EXERCISES.find((entry) => entry.id === exercise)!.expected
    const pass = await app.request(
      '/api/v1/sql/evaluate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session), ...ipHeaders() },
        body: JSON.stringify({
          exerciseId: exercise,
          columns: expected.columns.map((column) => column.name),
          rows: expected.rows,
        }),
      },
      { DB: migrated.db },
    )
    expect(pass.status).toBe(200)
    const response = await app.request(
      `/api/v1/practice/hunts/${exercise}/reveal`,
      { headers: sessionCookieHeader(session) },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { solution: string; attempt: { status: string } }
    expect(body.solution).toContain('categories')
    expect(body.attempt.status).toBe('submitted')
  })
})

describe('SQL exercises flow through progress', () => {
  it('a passed exercise appears on /practice/progress with status submitted', async () => {
    const migrated = createMigratedD1()
    const session = await freshGuestSession(migrated)
    const exercise = 'sql-bgn-select-01'
    await app.request(
      `/api/v1/sql/exercises/${exercise}/start`,
      { method: 'POST', headers: sessionCookieHeader(session) },
      { DB: migrated.db },
    )
    const expected = SERVER_EXERCISES.find((entry) => entry.id === exercise)!.expected
    await app.request(
      '/api/v1/sql/evaluate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session), ...ipHeaders() },
        body: JSON.stringify({
          exerciseId: exercise,
          columns: expected.columns.map((column) => column.name),
          rows: expected.rows,
        }),
      },
      { DB: migrated.db },
    )
    const progress = await app.request(
      '/api/v1/practice/progress',
      { headers: sessionCookieHeader(session) },
      { DB: migrated.db },
    )
    expect(progress.status).toBe(200)
    const body = (await progress.json()) as {
      hunts: Array<{ huntId: string; status: string; bestScore: number | null }>
    }
    const entry = body.hunts.find((candidate) => candidate.huntId === exercise)
    expect(entry).toBeDefined()
    expect(entry?.status).toBe('submitted')
    expect(entry?.bestScore).toBe(100)
  })
})
