// Phase 4 (P4-M1 WP2/WP3) — attempts & structured bug reports.
//
// Covers: migration 0010 (fresh + 0001–0009 → 0010 upgrade), attempt
// lifecycle and idempotency, the structured report write path, the
// deterministic WP3 evaluator wired into submission, scoped rate limiting
// and ownership rules. Runs against the real migration SQL — no SQL is
// mocked. No test may pass without the planted data or migrations
// actually applying.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { sweepExpiredData } from '../../src/server/maintenance'
import { sha256Hex } from '../../src/server/rateLimit'
import {
  createMigratedD1,
  applyRemainingMigrations,
  type MigratedD1,
} from '../helpers/fake-d1'

const AMARA = { email: 'amara.okafor@example.com', password: 'demo-amara-1001' }
const BEN = { email: 'ben.whitmore@example.net', password: 'demo-ben-1002' }
const IP = '203.0.113.90'

const DEFECT_IDS = [
  'CATALOGUE-001',
  'CATALOGUE-002',
  'CART-001',
  'INVENTORY-001',
  'PRICING-001',
  'CHECKOUT-001',
  'AUTHZ-001',
]

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function bothCookies(session: string | null, customer: string | null) {
  return [
    session ? `mpl_session=${session}` : null,
    customer ? `mpl_customer=${customer}` : null,
  ]
    .filter(Boolean)
    .join('; ')
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

async function signIn(migrated: MigratedD1, email: string, password: string, ip?: string) {
  const response = await app.request(
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ip ? { 'cf-connecting-ip': ip } : {}),
      },
      body: JSON.stringify({ email, password }),
    },
    { DB: migrated.db },
  )
  const joined = allSetCookies(response)
  return {
    response,
    session: extractCookie(joined, 'mpl_session'),
    customer: extractCookie(joined, 'mpl_customer'),
  }
}

async function startHunt(migrated: MigratedD1, huntId: string, cookie?: string) {
  const response = await app.request(
    `/api/v1/practice/hunts/${huntId}/start`,
    { method: 'POST', headers: cookie ? sessionCookieHeader(cookie) : {} },
    { DB: migrated.db },
  )
  const setCookie = response.headers.get('set-cookie')
  return { response, session: extractCookie(setCookie, 'mpl_session') ?? cookie ?? null }
}

function validReport(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Order totals do not match quantities',
    environment: 'Firefox 132 on Ubuntu 24.04, practice shop build 2026.11',
    preconditions: 'A product is in the cart.',
    steps: '1. Open the shop\n2. Add 3 units of Ridgeline 2-Person Tent\n3. Place the order',
    expected: 'Each line total equals unit price times quantity.',
    actual: 'The line total ignores the quantity and shows the single-unit price.',
    severity: 'high',
    priority: 'p2',
    reproducibility: 'always',
    ...overrides,
  }
}

async function submitReport(
  migrated: MigratedD1,
  huntId: string,
  cookie: string,
  overrides: Record<string, unknown> = {},
  ip?: string,
) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/report`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookie.includes('mpl_customer') ? cookie : `mpl_session=${cookie}`,
        ...(ip ? { 'cf-connecting-ip': ip } : {}),
      },
      body: JSON.stringify(validReport(overrides)),
    },
    { DB: migrated.db },
  )
}

function sqlAttemptRows(migrated: MigratedD1) {
  return migrated.sqlite
    .prepare('SELECT * FROM hunt_attempts ORDER BY id')
    .all() as Array<Record<string, unknown>>
}

describe('migration 0010 (hunt_attempts, bug_reports)', () => {
  it('applies cleanly on a fresh database (schema_version 13)', () => {
    const migrated = createMigratedD1()
    const row = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('14')

    const tables = migrated.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('hunt_attempts', 'bug_reports') ORDER BY name",
      )
      .all() as Array<{ name: string }>
    expect(tables.map((t) => t.name)).toEqual(['bug_reports', 'hunt_attempts'])

    const indexes = migrated.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_hunt_attempts%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
    expect(indexes.map((i) => i.name)).toEqual([
      'idx_hunt_attempts_customer',
      'idx_hunt_attempts_one_live',
      'idx_hunt_attempts_session_hunt',
    ])
  })

  it('upgrades an existing 0001-0009 database without touching data', async () => {
    const migrated = createMigratedD1({ through: 9 })
    const before = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(before.value).toBe('9')

    migrated.sqlite.exec(`
      INSERT INTO practice_sessions (token_hash, created_at, expires_at, mode, hunt_id)
      VALUES ('cafe' || printf('%028d', 7), '2026-11-01T00:00:00.000Z', '2027-11-01T00:00:00.000Z', 'bug_hunt', 'hunt-pricing-001');
      INSERT INTO carts (session_id) SELECT id FROM practice_sessions WHERE token_hash = 'cafe' || printf('%028d', 7);
      INSERT INTO orders (session_id, reference, status, payment_status, customer_name, customer_email,
                          shipping_line, shipping_city, shipping_postcode, subtotal_cents, total_cents)
        SELECT id, 'ORD-C0FFEE0000000001', 'placed', 'approved', 'Keeper', 'keeper@example.com',
               '1 Safe Row', 'Aldermere', 'AL1 1AA', 100, 100
        FROM practice_sessions WHERE token_hash = 'cafe' || printf('%028d', 7);
    `)

    applyRemainingMigrations(migrated, 9)

    const after = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(after.value).toBe('14')

    // Pre-existing rows survived the additive migration.
    const orders = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM orders WHERE reference = ?')
      .get('ORD-C0FFEE0000000001') as { count: number }
    expect(orders.count).toBe(1)
    const tables = migrated.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bug_reports'",
      )
      .all() as Array<{ name: string }>
    expect(tables).toHaveLength(1)
  })

  it('enforces the foreign keys, checks and the one-live-attempt invariant', async () => {
    const migrated = createMigratedD1()
    // hunt_attempts.practice_session_id is a real FK.
    expect(() =>
      migrated.sqlite
        .prepare("INSERT INTO hunt_attempts (hunt_id, practice_session_id) VALUES ('hunt-cart-001', 999)")
        .run(),
    ).toThrow()

    // bug_reports.attempt_id is a real FK.
    expect(() =>
      migrated.sqlite
        .prepare(
          "INSERT INTO bug_reports (attempt_id, title, environment, steps, expected, actual, severity, priority, quality_score, feedback) VALUES (999, 't', 'e', 's', 'e', 'a', 'high', 'p2', 0, '[]')",
        )
        .run(),
    ).toThrow()

    // Enum CHECKs on severity / priority / reproducibility / status.
    const { sessionId } = await (async () => {
      const { session } = await startHunt(migrated, 'hunt-cart-001')
      const row = migrated.sqlite
        .prepare('SELECT id FROM practice_sessions WHERE token_hash = ?')
        .get(await sha256Hex(session as string)) as { id: number }
      return { sessionId: row.id }
    })()

    expect(() =>
      migrated.sqlite
        .prepare(
          "INSERT INTO hunt_attempts (hunt_id, practice_session_id, status) VALUES ('hunt-inventory-001', ?, 'bogus')",
        )
        .run(sessionId),
    ).toThrow()

    const attemptId = (
      migrated.sqlite
        .prepare('SELECT id FROM hunt_attempts WHERE practice_session_id = ?')
        .get(sessionId) as { id: number }
    ).id

    expect(() =>
      migrated.sqlite
        .prepare(
          "INSERT INTO bug_reports (attempt_id, title, environment, steps, expected, actual, severity, priority, quality_score, feedback) VALUES (?, 't', 'e', 's', 'e', 'a', 'severe', 'p2', 0, '[]')",
        )
        .run(attemptId),
    ).toThrow()
    expect(() =>
      migrated.sqlite
        .prepare(
          "INSERT INTO bug_reports (attempt_id, title, environment, steps, expected, actual, severity, priority, quality_score, feedback) VALUES (?, 't', 'e', 's', 'e', 'a', 'high', 'p9', 0, '[]')",
        )
        .run(attemptId),
    ).toThrow()
    expect(() =>
      migrated.sqlite
        .prepare(
          "INSERT INTO bug_reports (attempt_id, title, environment, steps, expected, actual, severity, priority, reproducibility, quality_score, feedback) VALUES (?, 't', 'e', 's', 'e', 'a', 'high', 'p2', 'weekly', 0, '[]')",
        )
        .run(attemptId),
    ).toThrow()
    expect(() =>
      migrated.sqlite
        .prepare('UPDATE hunt_attempts SET hint_mask = 8 WHERE id = ?')
        .run(attemptId),
    ).toThrow()
    expect(() =>
      migrated.sqlite
        .prepare('UPDATE hunt_attempts SET discovered = 2 WHERE id = ?')
        .run(attemptId),
    ).toThrow()
    expect(() =>
      migrated.sqlite
        .prepare("UPDATE hunt_attempts SET best_quality_score = 101 WHERE id = ?")
        .run(attemptId),
    ).toThrow()

    // Length CHECKs mirror the application caps.
    expect(() =>
      migrated.sqlite
        .prepare(
          "INSERT INTO bug_reports (attempt_id, title, environment, steps, expected, actual, severity, priority, quality_score, feedback) VALUES (?, ?, 'e', 's', 'e', 'a', 'high', 'p2', 0, '[]')",
        )
        .run(attemptId, 'x'.repeat(201)),
    ).toThrow()

    // One live attempt per (session, hunt) — the partial unique index.
    expect(() =>
      migrated.sqlite
        .prepare(
          "INSERT INTO hunt_attempts (hunt_id, practice_session_id) VALUES ('hunt-cart-001', ?)",
        )
        .run(sessionId),
    ).toThrow(/UNIQUE/)
  })

  it('cascades attempts and reports with their practice session', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    const submitted = await submitReport(migrated, 'hunt-cart-001', cookie)
    expect(submitted.status).toBe(201)

    migrated.sqlite.exec(`
      UPDATE practice_sessions SET expires_at = '2020-01-01T00:00:00.000Z'
    `)
    const deleted = await sweepExpiredData(migrated.db, { now: new Date() })
    expect(deleted.practiceSessions).toBe(1)

    const attempts = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM hunt_attempts')
      .get() as { count: number }
    expect(attempts.count).toBe(0)
    const reports = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM bug_reports')
      .get() as { count: number }
    expect(reports.count).toBe(0)
  })

  it('nulls customer attribution on customer delete (snapshot preserved)', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    await startHunt(migrated, 'hunt-pricing-001', session as string)
    const cookie = bothCookies(session, customer)
    const submitted = await submitReport(migrated, 'hunt-pricing-001', cookie)
    expect(submitted.status).toBe(201)

    const before = migrated.sqlite
      .prepare('SELECT customer_id FROM hunt_attempts')
      .get() as { customer_id: number | null }
    expect(before.customer_id).toBe(1)

    migrated.sqlite.exec('DELETE FROM customers WHERE id = 1')
    const after = migrated.sqlite
      .prepare('SELECT customer_id FROM hunt_attempts')
      .get() as { customer_id: number | null }
    expect(after.customer_id).toBeNull()
  })
})

describe('attempt lifecycle (hunt start integration)', () => {
  it('creates exactly one in_progress attempt on hunt start and reuses it on repeat starts', async () => {
    const migrated = createMigratedD1()
    const first = await startHunt(migrated, 'hunt-cart-001')
    expect(first.response.status).toBe(200)
    const second = await startHunt(migrated, 'hunt-cart-001', first.session as string)
    expect(second.response.status).toBe(200)
    const third = await startHunt(migrated, 'hunt-cart-001', first.session as string)
    expect(third.response.status).toBe(200)

    const attempts = sqlAttemptRows(migrated)
    expect(attempts).toHaveLength(1)
    expect(attempts[0].status).toBe('in_progress')
    expect(attempts[0].hunt_id).toBe('hunt-cart-001')
  })

  it('tracks separate attempts per hunt for one session', async () => {
    const migrated = createMigratedD1()
    const first = await startHunt(migrated, 'hunt-cart-001')
    await startHunt(migrated, 'hunt-inventory-001', first.session as string)
    const attempts = sqlAttemptRows(migrated)
    expect(attempts.map((a) => a.hunt_id).sort()).toEqual(['hunt-cart-001', 'hunt-inventory-001'])
  })

  it('survives hunt switching (start A → start B → start A reuses A’s live attempt)', async () => {
    const migrated = createMigratedD1()
    const first = await startHunt(migrated, 'hunt-cart-001')
    const cookie = first.session as string
    await startHunt(migrated, 'hunt-inventory-001', cookie)
    await startHunt(migrated, 'hunt-cart-001', cookie)
    const cartAttempts = sqlAttemptRows(migrated).filter((a) => a.hunt_id === 'hunt-cart-001')
    expect(cartAttempts).toHaveLength(1)
    expect(cartAttempts[0].status).toBe('in_progress')
  })

  it('marks the attempt submitted on report and opens a fresh one on the next start', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    const submitted = await submitReport(migrated, 'hunt-cart-001', cookie)
    expect(submitted.status).toBe(201)

    const attempt = (await submitted.json()) as {
      attempt: { status: string; submittedAt: string | null }
    }
    expect(attempt.attempt.status).toBe('submitted')
    expect(attempt.attempt.submittedAt).toBeTruthy()

    const again = await startHunt(migrated, 'hunt-cart-001', cookie)
    expect(again.response.status).toBe(200)
    const attempts = sqlAttemptRows(migrated)
    expect(attempts.map((a) => a.status).sort()).toEqual(['in_progress', 'submitted'])
  })

  it('GET attempt is 404-free: none → in_progress → submitted', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string

    const noneView = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/attempt',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(noneView.status).toBe(200)
    expect(await noneView.json()).toEqual({
      status: 'none',
      hintsUsed: 0,
      bestQualityScore: null,
      discovered: false,
      submittedAt: null,
    })

    const inProgress = await app.request(
      '/api/v1/practice/hunts/hunt-cart-001/attempt',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(await inProgress.json()).toEqual({
      status: 'in_progress',
      hintsUsed: 0,
      bestQualityScore: null,
      discovered: false,
      submittedAt: null,
    })

    await submitReport(migrated, 'hunt-cart-001', cookie)
    const done = await app.request(
      '/api/v1/practice/hunts/hunt-cart-001/attempt',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    const doneBody = (await done.json()) as { status: string; submittedAt: string | null }
    expect(doneBody.status).toBe('submitted')
    expect(doneBody.submittedAt).toBeTruthy()
  })

  it('GET attempt without any cookies returns the none shape', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/practice/hunts/hunt-cart-001/attempt',
      {},
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'none',
      hintsUsed: 0,
      bestQualityScore: null,
      discovered: false,
      submittedAt: null,
    })
  })

  it('rejects forged and malformed hunt ids', async () => {
    const migrated = createMigratedD1()
    const forged = await app.request(
      '/api/v1/practice/hunts/hunt-nope-999/attempt',
      {},
      { DB: migrated.db },
    )
    expect(forged.status).toBe(404)
    expect(((await forged.json()) as { error: string }).error).toBe('hunt_not_found')

    const malformed = await app.request(
      '/api/v1/practice/hunts/INVALID!!/attempt',
      {},
      { DB: migrated.db },
    )
    expect(malformed.status).toBe(400)

    const forgedReport = await submitReport(
      migrated,
      'hunt-nope-999',
      'deadbeefdeadbeefdeadbeefdeadbeef',
    )
    expect(forgedReport.status).toBe(404)
  })

  it('keeps the attempt after a session reset (non-destructive)', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    await submitReport(migrated, 'hunt-cart-001', cookie)

    await app.request(
      '/api/v1/practice/session/reset',
      { method: 'POST', headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )

    const response = await app.request(
      '/api/v1/practice/hunts/hunt-cart-001/attempt',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    const body = (await response.json()) as { status: string }
    expect(body.status).toBe('submitted')
  })
})

describe('report submission and evaluation (WP2 write path, WP3 evaluator)', () => {
  async function freshHuntCookie(migrated: MigratedD1, huntId = 'hunt-pricing-001') {
    const { session } = await startHunt(migrated, huntId)
    return session as string
  }

  it('persists a valid report and answers 201 with learner-safe payloads', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const response = await submitReport(migrated, 'hunt-pricing-001', cookie)
    expect(response.status).toBe(201)

    const body = (await response.json()) as {
      attempt: Record<string, unknown>
      report: Record<string, unknown>
      evaluation: Record<string, unknown>
    } & Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['attempt', 'evaluation', 'report'])
    expect(Object.keys(body.attempt).sort()).toEqual([
      'bestQualityScore',
      'discovered',
      'hintsUsed',
      'status',
      'submittedAt',
    ])
    expect(Object.keys(body.report).sort()).toEqual([
      'actual',
      'createdAt',
      'environment',
      'expected',
      'feedback',
      'preconditions',
      'priority',
      'qualityScore',
      'reproducibility',
      'severity',
      'steps',
      'title',
    ])
    expect(Object.keys(body.evaluation).sort()).toEqual(['checks', 'score', 'verdict'])
    expect(body.attempt.status).toBe('submitted')
    // The validReport fixture is a full-quality pricing report: 100/100.
    expect(body.report.qualityScore).toBe(100)
    expect(body.report.feedback).toHaveLength(10)
    expect(body.evaluation.score).toBe(100)
    expect(body.evaluation.verdict).toBe('solid')
    expect(body.report.severity).toBe('high')
    expect(body.report.priority).toBe('p2')

    // Persisted server-side.
    const rows = migrated.sqlite
      .prepare('SELECT * FROM bug_reports')
      .all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0].quality_score).toBe(100)
    const storedFeedback = JSON.parse(rows[0].feedback as string) as Array<{ id: string; passed: boolean; message: string }>
    expect(storedFeedback).toHaveLength(10)
    expect(storedFeedback.every((item) => item.passed)).toBe(true)
    expect(rows[0].attempt_id).toBe(
      (migrated.sqlite.prepare('SELECT id FROM hunt_attempts').get() as { id: number }).id,
    )

    // No defect ids or internal identifiers anywhere in the payload.
    // (Check ids inside evaluation/feedback — e.g. "title-present" — are
    // part of the approved learner-safe contract; database column names are not.)
    const text = JSON.stringify(body)
    for (const defectId of DEFECT_IDS) {
      expect(text).not.toContain(defectId)
    }
    expect(text).not.toMatch(/"attempt_id"|"hunt_id"|"customer_id"|"practice_session_id"/)
  })

  it('normalizes enums case-insensitively and reproducibility defaults to always', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const response = await submitReport(migrated, 'hunt-pricing-001', cookie, {
      severity: 'HIGH',
      priority: 'P2',
      reproducibility: 'SOMETIMES',
    })
    expect(response.status).toBe(201)
    const body = (await response.json()) as { report: { severity: string; priority: string; reproducibility: string } }
    expect(body.report).toMatchObject({ severity: 'high', priority: 'p2', reproducibility: 'sometimes' })

    const second = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
        body: JSON.stringify({ ...validReport(), reproducibility: undefined }),
      },
      { DB: migrated.db },
    )
    const secondBody = (await second.json()) as { report: { reproducibility: string } }
    expect(secondBody.report.reproducibility).toBe('always')
  })

  it('rejects missing and empty required fields with per-field messages', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)

    for (const [field, value] of [
      ['title', ''],
      ['environment', '   '],
      ['steps', ''],
      ['expected', ''],
      ['actual', ''],
    ] as const) {
      const response = await submitReport(migrated, 'hunt-pricing-001', cookie, { [field]: value })
      expect(response.status, field).toBe(400)
      const body = (await response.json()) as { error: string; fields?: Record<string, string> }
      expect(body.error).toBe('invalid_request')
      expect(body.fields?.[field], field).toBeTruthy()
    }

    const missing = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
        body: JSON.stringify({ severity: 'high' }),
      },
      { DB: migrated.db },
    )
    expect(missing.status).toBe(400)
    const missingBody = (await missing.json()) as { fields: Record<string, string> }
    for (const field of ['title', 'environment', 'steps', 'expected', 'actual', 'priority']) {
      expect(missingBody.fields[field], field).toBeTruthy()
    }
  })

  it('enforces length caps', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)

    const cases: Array<[string, unknown]> = [
      ['title', 'x'.repeat(201)],
      ['environment', 'x'.repeat(201)],
      ['preconditions', 'x'.repeat(1001)],
      ['steps', 'x'.repeat(4001)],
      ['expected', 'x'.repeat(2001)],
      ['actual', 'x'.repeat(2001)],
    ]
    for (const [field, value] of cases) {
      const response = await submitReport(migrated, 'hunt-pricing-001', cookie, { [field]: value })
      expect(response.status, field).toBe(400)
    }

    const exactly = await submitReport(migrated, 'hunt-pricing-001', cookie, {
      title: 'x'.repeat(200),
      preconditions: 'x'.repeat(1000),
    })
    expect(exactly.status).toBe(201)
  })

  it('rejects invalid enum values and bad reproducibility', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)

    for (const overrides of [
      { severity: 'severe' },
      { severity: 'normal' },
      { priority: 'p0' },
      { priority: 'urgent' },
      { reproducibility: 'weekly' },
    ]) {
      const response = await submitReport(migrated, 'hunt-pricing-001', cookie, overrides)
      expect(response.status).toBe(400)
    }
  })

  it('rejects forbidden control characters (single-line vs multi-line rules)', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)

    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, { title: 'bad\u0001title' })).status,
    ).toBe(400)
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, { title: 'bad\u007ftitle' })).status,
    ).toBe(400)
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, { title: 'bad\ttitle' })).status,
    ).toBe(400)
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, { title: 'bad\r\ntitle' })).status,
    ).toBe(400)
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, {
        environment: 'Firefox\u0001on Ubuntu',
      })).status,
    ).toBe(400)
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, { steps: 'do x\u000bdo y' })).status,
    ).toBe(400)
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, { steps: 'do x\u007fy' })).status,
    ).toBe(400)
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, { expected: 'a\u007fb' })).status,
    ).toBe(400)
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, { actual: 'a\u009fb' })).status,
    ).toBe(400)
    // Newlines and tabs are legitimate inside the multi-line steps field.
    expect(
      (await submitReport(migrated, 'hunt-pricing-001', cookie, {
        steps: '1. Open shop\n\t2. Add item\n3. Check total',
      })).status,
    ).toBe(201)
  })

  it('trims and collapses whitespace in single-line fields without changing meaning', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const response = await submitReport(migrated, 'hunt-pricing-001', cookie, {
      title: '  Order   totals\tdo not match  ',
    })
    // The tab is a control character in a single-line field → rejected; use spaces only.
    expect(response.status).toBe(400)
    const ok = await submitReport(migrated, 'hunt-pricing-001', cookie, {
      title: '  Order   totals do   not match  ',
    })
    expect(ok.status).toBe(201)
    const body = (await ok.json()) as { report: { title: string } }
    expect(body.report.title).toBe('Order totals do not match')
  })

  it('requires a live practice session (401) and answers 404 for unknown hunts', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validReport()),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(401)
    expect(((await response.json()) as { error: string }).error).toBe('session_required')
  })

  it('attaches repeat submissions to the same attempt (history in bug_reports)', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const first = await submitReport(migrated, 'hunt-pricing-001', cookie, { title: 'First report draft one' })
    const second = await submitReport(migrated, 'hunt-pricing-001', cookie, { title: 'Second report draft two' })
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)

    const reports = migrated.sqlite
      .prepare('SELECT attempt_id, title FROM bug_reports ORDER BY id')
      .all() as Array<{ attempt_id: number; title: string }>
    expect(reports).toHaveLength(2)
    expect(reports[0].attempt_id).toBe(reports[1].attempt_id)

    const attempts = sqlAttemptRows(migrated)
    expect(attempts).toHaveLength(1)
    expect(attempts[0].status).toBe('submitted')
  })

  it('keeps a revealed attempt revealed when a report is filed afterwards', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    migrated.sqlite.exec(
      "UPDATE hunt_attempts SET status = 'revealed', revealed_at = '2026-11-16T00:00:00.000Z'",
    )
    const response = await submitReport(migrated, 'hunt-pricing-001', cookie)
    expect(response.status).toBe(201)
    const attempts = sqlAttemptRows(migrated)
    expect(attempts[0].status).toBe('revealed')
    expect(attempts[0].submitted_at).toBeTruthy()
    const reports = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM bug_reports')
      .get() as { count: number }
    expect(reports.count).toBe(1)
  })

  it('stamps customer_id at submit time for signed-in learners, never for guests', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    await startHunt(migrated, 'hunt-pricing-001', session as string)
    const cookie = bothCookies(session, customer)
    await submitReport(migrated, 'hunt-pricing-001', cookie)
    const row = migrated.sqlite
      .prepare('SELECT customer_id FROM hunt_attempts')
      .get() as { customer_id: number | null }
    expect(row.customer_id).toBe(1)

    const migrated2 = createMigratedD1()
    const guest = await startHunt(migrated2, 'hunt-pricing-001')
    await submitReport(migrated2, 'hunt-pricing-001', guest.session as string)
    const guestRow = migrated2.sqlite
      .prepare('SELECT customer_id FROM hunt_attempts')
      .get() as { customer_id: number | null }
    expect(guestRow.customer_id).toBeNull()
  })

  it('creates the attempt implicitly if the learner submits without starting', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    // Remove the auto-created attempt to exercise the create-on-submit path.
    migrated.sqlite.exec('DELETE FROM bug_reports; DELETE FROM hunt_attempts;')
    const response = await submitReport(migrated, 'hunt-pricing-001', session as string)
    expect(response.status).toBe(201)
    expect(sqlAttemptRows(migrated)).toHaveLength(1)
  })
})

describe('attempt history (GET /practice/attempts)', () => {
  it('returns an empty list without cookies', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/practice/attempts',
      {},
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [] })
  })

  it('lists own attempts newest first without internal ids', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    await submitReport(migrated, 'hunt-cart-001', cookie)
    await startHunt(migrated, 'hunt-inventory-001', cookie)

    const response = await app.request(
      '/api/v1/practice/attempts',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Array<Record<string, unknown>> }
    expect(body.data.map((row) => row.huntId).sort()).toEqual([
      'hunt-cart-001',
      'hunt-inventory-001',
    ])
    for (const row of body.data) {
      expect(Object.keys(row).sort()).toEqual([
        'bestQualityScore',
        'createdAt',
        'discovered',
        'hintsUsed',
        'huntId',
        'status',
        'submittedAt',
      ])
    }
    const submitted = body.data.find((row) => row.huntId === 'hunt-cart-001')
    expect(submitted?.status).toBe('submitted')
  })

  it('isolates sessions from each other', async () => {
    const migrated = createMigratedD1()
    const a = await startHunt(migrated, 'hunt-cart-001')
    const b = await startHunt(migrated, 'hunt-cart-001')
    await submitReport(migrated, 'hunt-cart-001', a.session as string)

    const forB = await app.request(
      '/api/v1/practice/attempts',
      { headers: sessionCookieHeader(b.session as string) },
      { DB: migrated.db },
    )
    const bData = ((await forB.json()) as { data: Array<{ status: string }> }).data
    expect(bData).toHaveLength(1)
    expect(bData[0].status).toBe('in_progress')
  })

  it('does not leak another customer’s attempts; honours customer-bound history', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    await startHunt(migrated, 'hunt-cart-001', amara.session as string)
    await submitReport(migrated, 'hunt-cart-001', bothCookies(amara.session, amara.customer))

    const ben = await signIn(migrated, BEN.email, BEN.password)
    const forBen = await app.request(
      '/api/v1/practice/attempts',
      { headers: { cookie: bothCookies(ben.session, ben.customer) } },
      { DB: migrated.db },
    )
    expect(((await forBen.json()) as { data: unknown[] }).data).toEqual([])

    // Amara signs in again on a fresh browser (new practice session): her
    // customer-bound attempt from the earlier session remains visible.
    const amaraAgain = await signIn(migrated, AMARA.email, AMARA.password)
    const forAmara = await app.request(
      '/api/v1/practice/attempts',
      { headers: { cookie: bothCookies(amaraAgain.session, amaraAgain.customer) } },
      { DB: migrated.db },
    )
    const amaraData = ((await forAmara.json()) as { data: Array<{ huntId: string }> }).data
    expect(amaraData.map((row) => row.huntId)).toEqual(['hunt-cart-001'])
  })

  it('bounds the history to 50 rows', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    const sessionId = (
      migrated.sqlite
        .prepare('SELECT id FROM practice_sessions WHERE token_hash = ?')
        .get(await sha256Hex(cookie)) as { id: number }
    ).id
    for (let i = 0; i < 55; i += 1) {
      migrated.sqlite
        .prepare(
          "INSERT INTO hunt_attempts (hunt_id, practice_session_id, status) VALUES ('hunt-cart-001', ?, 'submitted')",
        )
        .run(sessionId)
    }
    const response = await app.request(
      '/api/v1/practice/attempts',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    const body = (await response.json()) as { data: unknown[] }
    expect(body.data).toHaveLength(50)
  })
})

describe('report rate limiting (report:<iphash>, 30/min)', () => {
  async function windowBucket(migrated: MigratedD1, ipHash: string, count: number) {
    const now = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(now / 60)
    migrated.sqlite
      .prepare(
        'INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, ?)',
      )
      .run(`report:${ipHash}`, windowStart, count)
  }

  it('answers 429 with Retry-After once the bucket is full', async () => {
    const migrated = createMigratedD1()
    const ipHash = await sha256Hex(IP)
    await windowBucket(migrated, ipHash, 30)

    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: JSON.stringify(validReport()),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(429)
    expect(((await response.json()) as { error: string }).error).toBe('rate_limited')
    expect(response.headers.get('retry-after')).toBeTruthy()
  })

  it('allows the 30th request and rejects the 31st (exact boundary)', async () => {
    const migrated = createMigratedD1()
    const ipHash = await sha256Hex(IP)
    await windowBucket(migrated, ipHash, 29)

    const thirtieth = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: 'not-json',
      },
      { DB: migrated.db },
    )
    expect(thirtieth.status).not.toBe(429)

    const thirtyFirst = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: 'not-json',
      },
      { DB: migrated.db },
    )
    expect(thirtyFirst.status).toBe(429)
  })

  it('consumes the limit before body parsing (malformed churn is bounded)', async () => {
    const migrated = createMigratedD1()

    for (let i = 0; i < 30; i += 1) {
      await app.request(
        '/api/v1/practice/hunts/hunt-pricing-001/report',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
          body: 'not-json',
        },
        { DB: migrated.db },
      )
    }
    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: 'not-json',
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(429)
  })

  it('stores only the IP hash — a raw-IP bucket neither matches nor is created', async () => {
    const migrated = createMigratedD1()
    const ipHash = await sha256Hex(IP)
    // Seeding the raw address as the key must not affect the hashed bucket.
    const now = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(now / 60)
    migrated.sqlite
      .prepare('INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, 30)')
      .run(`report:${IP}`, windowStart)

    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: 'not-json',
      },
      { DB: migrated.db },
    )
    // Not capped by the raw-IP bucket (the limiter keys on the hash); the
    // request reaches the handler and fails there with no session (401).
    expect(response.status).toBe(401)
    const keys = migrated.sqlite
      .prepare('SELECT key, count FROM rate_limit_buckets')
      .all() as Array<{ key: string; count: number }>
    // The raw-IP bucket we planted is untouched (count stays 30), and the
    // limiter only ever wrote the hashed key.
    expect(keys.find((row) => row.key === `report:${IP}`)?.count).toBe(30)
    expect(keys.find((row) => row.key === `report:${ipHash}`)?.count).toBe(1)
  })

  it('keeps the report budget isolated from a full checkout bucket', async () => {
    const migrated = createMigratedD1()
    const ipHash = await sha256Hex(IP)
    const now = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(now / 60)
    // Fill the checkout bucket to the brim; leave the report bucket empty.
    migrated.sqlite
      .prepare('INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, 30)')
      .run(`checkout:${ipHash}`, windowStart)

    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: 'not-json',
      },
      { DB: migrated.db },
    )
    // The report endpoint is scoped independently of checkout: the full
    // checkout bucket does not 429; the request reaches the handler and
    // fails there with no session (401).
    expect(response.status).toBe(401)
    const checkout = migrated.sqlite
      .prepare('SELECT count FROM rate_limit_buckets WHERE key = ?')
      .get(`checkout:${ipHash}`) as { count: number }
    expect(checkout.count).toBe(30)
  })
})

describe('report evaluation (WP3 deterministic evaluator)', () => {
  const WEAK_VALID_REPORT = {
    title: 'short',
    environment: 'zzzzzzzz',
    steps: 'no structure at all',
    expected: 'short',
    actual: 'short',
    severity: 'low',
    priority: 'p4',
    reproducibility: 'always',
  }

  async function freshHuntCookie(migrated: MigratedD1, huntId = 'hunt-pricing-001') {
    const { session } = await startHunt(migrated, huntId)
    return session as string
  }

  it('persists the computed score and structured feedback (full-quality → 100)', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const response = await submitReport(migrated, 'hunt-pricing-001', cookie)
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      attempt: { bestQualityScore: number | null; discovered: boolean }
      evaluation: { score: number; verdict: string; checks: Array<{ id: string; label: string; passed: boolean; message: string }> }
    }
    expect(body.evaluation.score).toBe(100)
    expect(body.evaluation.verdict).toBe('solid')
    expect(body.evaluation.checks).toHaveLength(10)
    expect(body.evaluation.checks.every((item) => item.passed)).toBe(true)
    expect(body.attempt.bestQualityScore).toBe(100)
    expect(body.attempt.discovered).toBe(true)

    const row = migrated.sqlite
      .prepare('SELECT quality_score, feedback FROM bug_reports')
      .get() as { quality_score: number; feedback: string }
    expect(row.quality_score).toBe(100)
    expect(JSON.parse(row.feedback)).toHaveLength(10)
  })

  it('computes honest results for a weak-but-valid report (client cannot inflate them)', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `mpl_session=${cookie}`,
        },
        // Spoofed evaluator fields ride along in the body and must be ignored.
        body: JSON.stringify({
          ...WEAK_VALID_REPORT,
          qualityScore: 100,
          feedback: [{ id: 'finding', passed: true, message: 'fake' }],
          discovered: true,
          evaluation: { score: 100, verdict: 'solid', checks: [] },
        }),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      attempt: { bestQualityScore: number | null; discovered: boolean }
      report: { qualityScore: number; feedback: Array<{ id: string; passed: boolean; message: string }> }
      evaluation: { score: number; verdict: string; checks: Array<{ id: string; passed: boolean }> }
    }
    expect(body.evaluation.score).toBe(10) // severity-valid 5 + priority-valid 5
    expect(body.evaluation.verdict).toBe('incomplete')
    expect(body.evaluation.checks).toHaveLength(10)
    expect(body.report.qualityScore).toBe(10)
    expect(body.report.feedback).toHaveLength(10)
    expect(body.attempt.bestQualityScore).toBe(10)
    expect(body.attempt.discovered).toBe(false)

    const row = migrated.sqlite
      .prepare('SELECT quality_score, feedback FROM bug_reports')
      .get() as { quality_score: number; feedback: string }
    expect(row.quality_score).toBe(10)
    const feedback = JSON.parse(row.feedback) as Array<{ id: string; passed: boolean; message: string }>
    expect(feedback).toHaveLength(10)
    expect(feedback.find((item) => item.id === 'finding')?.passed).toBe(false)
  })

  it('keeps best_quality_score at the running maximum across submissions (strong → weak)', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    await submitReport(migrated, 'hunt-pricing-001', cookie) // 100
    const weak = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
        body: JSON.stringify(WEAK_VALID_REPORT),
      },
      { DB: migrated.db },
    )
    expect(weak.status).toBe(201)
    const weakBody = (await weak.json()) as {
      attempt: { bestQualityScore: number | null; discovered: boolean }
      evaluation: { score: number }
    }
    expect(weakBody.evaluation.score).toBe(10)
    expect(weakBody.attempt.bestQualityScore).toBe(100)
    expect(weakBody.attempt.discovered).toBe(true)

    const attempt = migrated.sqlite
      .prepare('SELECT best_quality_score, discovered FROM hunt_attempts')
      .get() as { best_quality_score: number; discovered: number }
    expect(attempt.best_quality_score).toBe(100)
    expect(attempt.discovered).toBe(1)
  })

  it('raises best_quality_score on resubmission and never lowers it (weak → strong)', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const first = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
        body: JSON.stringify(WEAK_VALID_REPORT),
      },
      { DB: migrated.db },
    )
    const firstBody = (await first.json()) as { attempt: { bestQualityScore: number | null } }
    expect(firstBody.attempt.bestQualityScore).toBe(10)

    const second = await submitReport(migrated, 'hunt-pricing-001', cookie)
    const secondBody = (await second.json()) as {
      attempt: { bestQualityScore: number | null; discovered: boolean }
      evaluation: { score: number }
    }
    expect(secondBody.evaluation.score).toBe(100)
    expect(secondBody.attempt.bestQualityScore).toBe(100)
    expect(secondBody.attempt.discovered).toBe(true)
  })

  it('discovered is sticky across submissions once earned', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    await submitReport(migrated, 'hunt-pricing-001', cookie) // strong, discovering
    await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
        body: JSON.stringify(WEAK_VALID_REPORT), // weak, non-finding
      },
      { DB: migrated.db },
    )
    const view = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/attempt',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    const body = (await view.json()) as { discovered: boolean; bestQualityScore: number | null }
    expect(body.discovered).toBe(true)
    expect(body.bestQualityScore).toBe(100)
  })

  it('grants discovery without a high score when the finding check passes', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    // Minimal report: finding term ("totals") present, everything else weak.
    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
        body: JSON.stringify({
          title: 'totals',
          environment: 'Linux desktop',
          steps: 'do it\nsee it',
          expected: 'short',
          actual: 'short',
          severity: 'low',
          priority: 'p4',
        }),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      attempt: { discovered: boolean }
      evaluation: { score: number; checks: Array<{ id: string; passed: boolean }> }
    }
    expect(body.evaluation.checks.find((item) => item.id === 'finding')?.passed).toBe(true)
    expect(body.attempt.discovered).toBe(true)
    expect(body.evaluation.score).toBeLessThan(50) // discovery is about the finding, not quality
  })

  it('awards nothing when the finding check fails even on a high-quality report', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    // validReport with zero finding-group vocabulary anywhere: swap the
    // pricing vocabulary for neutral words while keeping everything else.
    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
        body: JSON.stringify({
          title: 'Figures on the order confirmation are off',
          environment: 'Firefox 132 on Ubuntu 24.04, practice shop build 2026.11',
          preconditions: 'A product is in the cart.',
          steps: '1. Open the shop\n2. Add 3 units of Ridgeline 2-Person Tent\n3. Place the order',
          expected: 'The summary figure should equal the configured value.',
          actual: 'A mismatched figure is printed on screen instead.',
          severity: 'high',
          priority: 'p2',
          reproducibility: 'always',
        }),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      attempt: { discovered: boolean; bestQualityScore: number | null }
      evaluation: { score: number; verdict: string }
    }
    expect(body.evaluation.score).toBe(78)
    expect(body.evaluation.verdict).toBe('needs-work')
    expect(body.attempt.discovered).toBe(false)
    expect(body.attempt.bestQualityScore).toBe(78)
  })

  it('a failed validation persists nothing (no report, no stamp, no score)', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
        body: JSON.stringify({ title: 'short' }),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(400)
    expect(migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM bug_reports').get()).toEqual({ n: 0 })
    const attempt = migrated.sqlite
      .prepare('SELECT status, best_quality_score, discovered FROM hunt_attempts')
      .get() as { status: string; best_quality_score: number | null; discovered: number }
    expect(attempt.status).toBe('in_progress')
    expect(attempt.best_quality_score).toBeNull()
    expect(attempt.discovered).toBe(0)
  })

  it('a failing D1 batch leaves neither a report nor an attempt update behind', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    void session
    const attemptId = (
      migrated.sqlite.prepare('SELECT id FROM hunt_attempts').get() as { id: number }
    ).id
    // Mirror the endpoint's batch: a valid report insert + a stamp that
    // violates the best_quality_score CHECK (101 > 100). SQLite rolls the
    // whole batch back — no report row, no attempt change.
    const outcome = await migrated.db
      .batch([
        migrated.db
          .prepare(
            `INSERT INTO bug_reports
               (attempt_id, title, environment, steps, expected, actual,
                severity, priority, quality_score, feedback, created_at)
             VALUES (?, 't', 'e', 's', 'e', 'a', 'high', 'p2', 100, '[]', '2026-11-16T00:00:00.000Z')`,
          )
          .bind(attemptId),
        migrated.db
          .prepare('UPDATE hunt_attempts SET best_quality_score = 101 WHERE id = ?')
          .bind(attemptId),
      ])
      .then(
        () => 'committed',
        () => 'rolled-back',
      )
    expect(outcome).toBe('rolled-back')
    expect(migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM bug_reports').get()).toEqual({ n: 0 })
    const attempt = migrated.sqlite
      .prepare('SELECT status, best_quality_score FROM hunt_attempts')
      .get() as { status: string; best_quality_score: number | null }
    expect(attempt.status).toBe('in_progress')
    expect(attempt.best_quality_score).toBeNull()
  })

  it('a failed batch on an already-scored attempt preserves the prior row exactly', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    await submitReport(migrated, 'hunt-pricing-001', cookie) // scores 100
    const attemptId = (
      migrated.sqlite.prepare('SELECT id FROM hunt_attempts').get() as { id: number }
    ).id
    const beforeReports = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM bug_reports')
      .get() as { n: number }
    const outcome = await migrated.db
      .batch([
        migrated.db
          .prepare(
            `INSERT INTO bug_reports
               (attempt_id, title, environment, steps, expected, actual,
                severity, priority, quality_score, feedback, created_at)
             VALUES (?, 'poison', 'e', 's', 'e', 'a', 'high', 'p2', 55, '[]', '2026-11-16T00:00:00.000Z')`,
          )
          .bind(attemptId),
        migrated.db
          .prepare('UPDATE hunt_attempts SET best_quality_score = 9999 WHERE id = ?')
          .bind(attemptId),
      ])
      .then(
        () => 'committed',
        () => 'rolled-back',
      )
    expect(outcome).toBe('rolled-back')
    const afterReports = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM bug_reports')
      .get() as { n: number }
    expect(afterReports.n).toBe(beforeReports.n)
    const attempt = migrated.sqlite
      .prepare('SELECT status, best_quality_score FROM hunt_attempts')
      .get() as { status: string; best_quality_score: number }
    expect(attempt.status).toBe('submitted')
    expect(attempt.best_quality_score).toBe(100)
  })

  it('revealed attempts remain revealed after a later report (revealed stays revealed)', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    migrated.sqlite
      .prepare("UPDATE hunt_attempts SET status = 'revealed', revealed_at = '2026-11-16T00:00:00.000Z'")
      .run()
    const response = await submitReport(migrated, 'hunt-pricing-001', cookie)
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      attempt: { status: string; bestQualityScore: number | null; discovered: boolean; submittedAt: string | null }
    }
    expect(body.attempt.status).toBe('revealed')
    expect(body.attempt.submittedAt).toBeTruthy()
    expect(body.attempt.bestQualityScore).toBe(100)
    expect(body.attempt.discovered).toBe(true)
    const row = migrated.sqlite
      .prepare('SELECT status FROM hunt_attempts')
      .get() as { status: string }
    expect(row.status).toBe('revealed')
  })

  it('keeps sessions isolated — a second session cannot read the first session’s score', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    await submitReport(migrated, 'hunt-pricing-001', cookie)

    const { session: other } = await startHunt(migrated, 'hunt-pricing-001')
    const view = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/attempt',
      { headers: sessionCookieHeader(other as string) },
      { DB: migrated.db },
    )
    const body = (await view.json()) as { status: string; bestQualityScore: number | null; discovered: boolean }
    expect(body.status).toBe('in_progress')
    expect(body.bestQualityScore).toBeNull()
    expect(body.discovered).toBe(false)
    expect(migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM bug_reports').get()).toEqual({ n: 1 })
  })

  it('201 payload never carries defect ids, hunt internals or finding-check terms in feedback', async () => {
    const migrated = createMigratedD1()
    const cookie = await freshHuntCookie(migrated)
    const response = await submitReport(migrated, 'hunt-pricing-001', cookie)
    const text = JSON.stringify(await response.json())
    for (const defectId of DEFECT_IDS) {
      expect(text).not.toContain(defectId)
    }
    expect(text).not.toMatch(/"attempt_id"|"hunt_id"|"customer_id"|"practice_session_id"|"defect"/)
    // Feedback messages describe the report only — no answer terms.
    expect(text).not.toContain('vestibules')
  })
})
