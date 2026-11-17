// Phase 4 (P4-M3 WP1) — GET /api/v1/practice/progress.
//
// End-to-end coverage of the progress aggregate: empty/no-session payloads,
// guest isolation, signed-in customer attribution (including across
// sessions and through customer deletion), ownership scoping, bounded and
// deterministic output, learner-safe payloads, and the aggregation rules
// (status buckets, sticky discovery with the revealed-status exclusion,
// running best score, average over scored attempts only, idempotency).
// Runs against the real migration SQL — nothing is mocked.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import {
  averageBestScore,
  buildHuntEntries,
  summarizeProgressAttempts,
  type ProgressAttemptRow,
} from '../../src/server/progress'
import { allAttemptTargets } from '../../src/server/attemptTargets'
import {
  createMigratedD1,
  type MigratedD1,
} from '../helpers/fake-d1'

const AMARA = { email: 'amara.okafor@example.com', password: 'demo-amara-1001' }
const IP = '203.0.113.91'

const DEFECT_IDS = [
  'CATALOGUE-001',
  'CATALOGUE-002',
  'CART-001',
  'INVENTORY-001',
  'PRICING-001',
  'CHECKOUT-001',
  'AUTHZ-001',
]

const INTERNAL_MARKERS = [
  'attempt_id',
  'customer_id',
  'practice_session',
  'hint_mask',
  'best_quality_score',
  'bug_reports',
  'hunt_attempts',
  'quality_score',
  'mpl_session',
  'mpl_customer',
  'finding-check',
  ...DEFECT_IDS,
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
    steps:
      '1. Open the shop\n2. Add 3 units of Ridgeline 2-Person Tent\n3. Place the order',
    expected: 'Each line total equals unit price times quantity.',
    actual: 'The line total ignores the quantity and shows the single-unit price.',
    severity: 'high',
    priority: 'p2',
    reproducibility: 'always',
    ...overrides,
  }
}

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

const NON_FINDING_STRONG_REPORT = {
  title: 'Figures on the order confirmation are off',
  environment: 'Firefox 132 on Ubuntu 24.04, practice shop build 2026.11',
  preconditions: 'A product is in the cart.',
  steps: '1. Open the shop\n2. Add 3 units of Ridgeline 2-Person Tent\n3. Place the order',
  expected: 'The summary figure should equal the configured value.',
  actual: 'A mismatched figure is printed on screen instead.',
  severity: 'high',
  priority: 'p2',
  reproducibility: 'always',
}

async function submitReport(
  migrated: MigratedD1,
  huntId: string,
  cookie: string,
  overrides: Record<string, unknown> = {},
) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/report`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookie.includes('mpl_session') ? cookie : `mpl_session=${cookie}`,
      },
      body: JSON.stringify(validReport(overrides)),
    },
    { DB: migrated.db },
  )
}

async function giveUp(migrated: MigratedD1, huntId: string, cookie: string) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/reveal`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...sessionCookieHeader(cookie) },
      body: JSON.stringify({ confirm: true }),
    },
    { DB: migrated.db },
  )
}

async function getProgress(migrated: MigratedD1, cookie?: string) {
  const header = cookie
    ? cookie.includes('mpl_session')
      ? cookie
      : `mpl_session=${cookie}`
    : undefined
  return app.request(
    '/api/v1/practice/progress',
    { headers: header ? { cookie: header } : {} },
    { DB: migrated.db },
  )
}

interface ProgressBody {
  persistence: 'session' | 'customer'
  hunts: Array<{
    huntId: string
    scenarioId: string
    title: string
    status: 'none' | 'in_progress' | 'submitted' | 'revealed'
    discovered: boolean
    bestScore: number | null
    hintsUsed: number
    attempts: number
    lastSubmittedAt: string | null
  }>
  recent: Array<{ huntId: string; title: string; score: number; verdict: string; createdAt: string }>
  totals: {
    attempts: number
    inProgress: number
    submitted: number
    revealed: number
    reports: number
    discovered: number
    hintsUsed: number
    bestScore: number | null
    averageBestScore: number | null
  }
}

async function progressBody(migrated: MigratedD1, cookie?: string) {
  const response = await getProgress(migrated, cookie)
  expect(response.status).toBe(200)
  return (await response.json()) as ProgressBody
}

describe('GET /api/v1/practice/progress — no session and empty states', () => {
  it('returns a 200 empty payload when no practice session exists', async () => {
    const migrated = createMigratedD1()
    const response = await getProgress(migrated)
    expect(response.status).toBe(200)
    const body = (await response.json()) as ProgressBody
    expect(body.persistence).toBe('session')
    expect(body.hunts).toHaveLength(allAttemptTargets().length)
    expect(body.hunts.map((hunt) => hunt.status)).toEqual(allAttemptTargets().map(() => 'none'))
    expect(body.hunts.map((hunt) => hunt.huntId)).toEqual(allAttemptTargets().map((target) => target.id))
    expect(body.totals).toEqual({
      attempts: 0,
      inProgress: 0,
      submitted: 0,
      revealed: 0,
      reports: 0,
      discovered: 0,
      hintsUsed: 0,
      bestScore: null,
      averageBestScore: null,
    })
    expect(body.recent).toEqual([])
  })

  it('reports an in-progress attempt with no scored submission', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const body = await progressBody(migrated, session as string)
    expect(body.totals.attempts).toBe(1)
    expect(body.totals.inProgress).toBe(1)
    expect(body.totals.submitted).toBe(0)
    expect(body.totals.revealed).toBe(0)
    expect(body.totals.reports).toBe(0)
    expect(body.totals.bestScore).toBeNull()
    expect(body.totals.averageBestScore).toBeNull()
    const hunt = body.hunts.find((entry) => entry.huntId === 'hunt-pricing-001')
    expect(hunt?.status).toBe('in_progress')
    expect(hunt?.attempts).toBe(1)
    expect(hunt?.bestScore).toBeNull()
    expect(hunt?.lastSubmittedAt).toBeNull()
  })

  it('uses the live session scope only when signed out, even with a bound attempt row', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password, IP)
    await startHunt(migrated, 'hunt-pricing-001', `${session as string}`)
    // The hunt started unsigned-in stays guest-bound... submit while signed in.
    const signedInCookie = bothCookies(session, customer)
    const response = await submitReport(migrated, 'hunt-pricing-001', signedInCookie)
    expect(response.status).toBe(201)

    const body = await progressBody(migrated, `${session as string}`)
    expect(body.persistence).toBe('session')
    // The row belongs to this practice session, so it is still visible —
    // but persistence honestly reports the guest scope.
    expect(body.totals.attempts).toBe(1)
  })
})

describe('GET /api/v1/practice/progress — ownership and attribution', () => {
  it('isolates sessions: one learner never sees another’s rows', async () => {
    const migrated = createMigratedD1()
    const first = await startHunt(migrated, 'hunt-pricing-001')
    const second = await startHunt(migrated, 'hunt-catalogue-001')
    await submitReport(migrated, 'hunt-pricing-001', first.session as string)

    const body = await progressBody(migrated, second.session as string)
    expect(body.totals.attempts).toBe(1)
    expect(body.totals.reports).toBe(0)
    expect(body.hunts.find((hunt) => hunt.huntId === 'hunt-pricing-001')?.status).toBe('none')
    expect(body.hunts.find((hunt) => hunt.huntId === 'hunt-catalogue-001')?.status).toBe(
      'in_progress',
    )

    const firstBody = await progressBody(migrated, first.session as string)
    expect(firstBody.totals.submitted).toBe(1)
    expect(firstBody.totals.reports).toBe(1)
  })

  it('counts a row matching both scopes exactly once when signed in', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password, IP)
    await startHunt(migrated, 'hunt-pricing-001', `${session as string}`)
    const response = await submitReport(migrated, 'hunt-pricing-001', bothCookies(session, customer))
    expect(response.status).toBe(201)

    const signedIn = await progressBody(migrated, bothCookies(session, customer))
    expect(signedIn.persistence).toBe('customer')
    expect(signedIn.totals.attempts).toBe(1)
    expect(signedIn.totals.reports).toBe(1)
  })

  it('shows customer-bound attempts from the customer’s other session when signed in', async () => {
    const migrated = createMigratedD1()
    const first = await signIn(migrated, AMARA.email, AMARA.password, IP)
    await startHunt(migrated, 'hunt-pricing-001', `${first.session as string}`)
    const submitted = await submitReport(
      migrated,
      'hunt-pricing-001',
      bothCookies(first.session, first.customer),
    )
    expect(submitted.status).toBe(201)

    // A completely fresh session for the same customer sees the bound row.
    const second = await signIn(migrated, AMARA.email, AMARA.password, IP)
    const body = await progressBody(migrated, bothCookies(second.session, second.customer))
    expect(body.persistence).toBe('customer')
    expect(body.totals.attempts).toBe(1)
    expect(body.totals.submitted).toBe(1)
    expect(body.hunts.find((hunt) => hunt.huntId === 'hunt-pricing-001')?.status).toBe('submitted')
  })

  it('hides customer-bound attempts from other visitors', async () => {
    const migrated = createMigratedD1()
    const first = await signIn(migrated, AMARA.email, AMARA.password, IP)
    await startHunt(migrated, 'hunt-pricing-001', `${first.session as string}`)
    await submitReport(
      migrated,
      'hunt-pricing-001',
      bothCookies(first.session, first.customer),
    )

    const visitor = await startHunt(migrated, 'hunt-catalogue-001')
    const body = await progressBody(migrated, visitor.session as string)
    expect(body.persistence).toBe('session')
    expect(body.totals.submitted).toBe(0)
    expect(body.hunts.find((hunt) => hunt.huntId === 'hunt-pricing-001')?.status).toBe('none')
  })

  it('keeps rows visible to their own session (not lost) when the customer binding is removed', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password, IP)
    await startHunt(migrated, 'hunt-pricing-001', `${session as string}`)
    await submitReport(migrated, 'hunt-pricing-001', bothCookies(session, customer))

    // Simulate the customer row being removed: ON DELETE SET NULL detaches
    // the binding; the attempt row itself survives in its own session.
    migrated.sqlite.prepare('DELETE FROM customers WHERE email = ?').run(AMARA.email)
    const gone = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM customers WHERE email = ?')
      .get(AMARA.email) as { count: number }
    expect(gone.count).toBe(0)

    const body = await progressBody(migrated, session as string)
    expect(body.persistence).toBe('session')
    expect(body.totals.attempts).toBe(1)
    expect(body.totals.reports).toBe(1)
  })
})

describe('GET /api/v1/practice/progress — aggregation rules', () => {
  it('awards no score and no discovery for a reveal alone', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const revealed = await giveUp(migrated, 'hunt-pricing-001', session as string)
    expect(revealed.status).toBe(200)

    const body = await progressBody(migrated, session as string)
    expect(body.totals.revealed).toBe(1)
    expect(body.totals.submitted).toBe(0)
    expect(body.totals.reports).toBe(0)
    expect(body.totals.discovered).toBe(0)
    expect(body.totals.bestScore).toBeNull()
    expect(body.totals.averageBestScore).toBeNull()
    const hunt = body.hunts.find((entry) => entry.huntId === 'hunt-pricing-001')
    expect(hunt?.status).toBe('revealed')
    expect(hunt?.discovered).toBe(false)
    expect(body.recent).toEqual([])
  })

  it('counts discovered hunts independently of score (weak discovery, strong non-finding)', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    // Weak finding-only report: discovery awarded, quality incomplete.
    const weak = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${session as string}` },
        body: JSON.stringify({
          title: 'totals are off',
          environment: 'zzzzzzzz',
          steps: 'do it\nsee it',
          expected: 'short',
          actual: 'short',
          severity: 'low',
          priority: 'p4',
        }),
      },
      { DB: migrated.db },
    )
    expect(weak.status).toBe(201)

    await startHunt(migrated, 'hunt-catalogue-001', session as string)
    const strong = await submitReport(migrated, 'hunt-catalogue-001', session as string, {
      title: NON_FINDING_STRONG_REPORT.title,
      environment: NON_FINDING_STRONG_REPORT.environment,
      steps: NON_FINDING_STRONG_REPORT.steps,
      expected: NON_FINDING_STRONG_REPORT.expected,
      actual: NON_FINDING_STRONG_REPORT.actual,
    })
    expect(strong.status).toBe(201)

    const body = await progressBody(migrated, session as string)
    expect(body.totals.reports).toBe(2)
    expect(body.totals.discovered).toBe(1)
    const catalogue = body.hunts.find((hunt) => hunt.huntId === 'hunt-catalogue-001')
    expect(catalogue?.discovered).toBe(false)
    const pricing = body.hunts.find((hunt) => hunt.huntId === 'hunt-pricing-001')
    expect(pricing?.discovered).toBe(true)
  })

  it('excludes revealed-status attempts from discovery, even with a later passing report', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const revealed = await giveUp(migrated, 'hunt-pricing-001', session as string)
    expect(revealed.status).toBe(200)

    // A later report on the revealed attempt is stored and scored, but the
    // attempt keeps its revealed status — discovery is not awarded.
    const response = await submitReport(migrated, 'hunt-pricing-001', session as string)
    expect(response.status).toBe(201)
    const submitted = (await response.json()) as { evaluation: { score: number } }
    expect(submitted.evaluation.score).toBe(100)

    const body = await progressBody(migrated, session as string)
    expect(body.totals.revealed).toBe(1)
    expect(body.totals.reports).toBe(1)
    expect(body.totals.discovered).toBe(0)
    expect(body.totals.averageBestScore).toBe(100)
    const hunt = body.hunts.find((entry) => entry.huntId === 'hunt-pricing-001')
    expect(hunt?.status).toBe('revealed')
    expect(hunt?.discovered).toBe(false)
    expect(hunt?.bestScore).toBe(100)
  })

  it('preserves discovery credit when the reveal happened after submission', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    await submitReport(migrated, 'hunt-pricing-001', session as string)
    const revealed = await giveUp(migrated, 'hunt-pricing-001', session as string)
    expect(revealed.status).toBe(200)

    const body = await progressBody(migrated, session as string)
    expect(body.totals.submitted).toBe(1)
    expect(body.totals.discovered).toBe(1)
    expect(body.totals.reports).toBe(1)
  })

  it('keeps repeated submissions on one attempt under a running-max best score', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const first = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${session}` },
        body: JSON.stringify(WEAK_VALID_REPORT),
      },
      { DB: migrated.db },
    )
    expect(first.status).toBe(201)
    await submitReport(migrated, 'hunt-pricing-001', session as string)

    const body = await progressBody(migrated, session as string)
    expect(body.totals.attempts).toBe(1)
    expect(body.totals.reports).toBe(2)
    expect(body.totals.bestScore).toBe(100)
    expect(body.totals.averageBestScore).toBe(100)
    expect(body.recent).toHaveLength(2)
  })

  it('aggregates multiple attempts on the same hunt by running best', async () => {
    const migrated = createMigratedD1()
    const first = await startHunt(migrated, 'hunt-pricing-001')
    await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/report',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${first.session}` },
        body: JSON.stringify(WEAK_VALID_REPORT),
      },
      { DB: migrated.db },
    )
    // No live attempt remains; a fresh start mints a second attempt.
    const second = await startHunt(migrated, 'hunt-pricing-001', first.session as string)
    expect(second.session).toBe(first.session)
    await submitReport(migrated, 'hunt-pricing-001', first.session as string)

    const body = await progressBody(migrated, first.session as string)
    expect(body.totals.attempts).toBe(2)
    expect(body.totals.reports).toBe(2)
    const hunt = body.hunts.find((entry) => entry.huntId === 'hunt-pricing-001')
    expect(hunt?.attempts).toBe(2)
    expect(hunt?.bestScore).toBe(100)
    expect(hunt?.status).toBe('submitted')
    // Mean of attempt best scores: 10 and 100 → 55.
    expect(body.totals.averageBestScore).toBe(55)
    expect(body.totals.bestScore).toBe(100)
  })

  it('is idempotent for hunt starts and hint unlocks — no double counting', async () => {
    const migrated = createMigratedD1()
    const first = await startHunt(migrated, 'hunt-pricing-001')
    const second = await startHunt(migrated, 'hunt-pricing-001', first.session as string)
    expect(second.response.status).toBeLessThan(300)

    await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/hints',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${first.session}` },
        body: JSON.stringify({ level: 1 }),
      },
      { DB: migrated.db },
    )
    await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/hints',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${first.session}` },
        body: JSON.stringify({ level: 1 }),
      },
      { DB: migrated.db },
    )

    const body = await progressBody(migrated, first.session as string)
    expect(body.totals.attempts).toBe(1)
    expect(body.totals.hintsUsed).toBe(1)
    expect(body.hunts.find((hunt) => hunt.huntId === 'hunt-pricing-001')?.hintsUsed).toBe(1)
  })

  it('returns recent submissions newest-first, capped at 10', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    for (let index = 0; index < 12; index += 1) {
      const response = await submitReport(migrated, 'hunt-pricing-001', session as string)
      expect(response.status).toBe(201)
    }

    const body = await progressBody(migrated, session as string)
    expect(body.recent).toHaveLength(10)
    expect(body.totals.reports).toBe(12)
    const timestamps = body.recent.map((entry) => entry.createdAt)
    const sorted = [...timestamps].sort().reverse()
    expect(timestamps).toEqual(sorted)
    for (const entry of body.recent) {
      expect(entry.huntId).toBe('hunt-pricing-001')
      expect(entry.verdict).toBe('solid')
    }
  })

  it('reports hunts with no records as none with null score fields', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const body = await progressBody(migrated, session as string)
    for (const hunt of body.hunts) {
      if (hunt.huntId === 'hunt-pricing-001') {
        expect(hunt.status).toBe('in_progress')
      } else {
        expect(hunt.status).toBe('none')
        expect(hunt.attempts).toBe(0)
        expect(hunt.bestScore).toBeNull()
        expect(hunt.hintsUsed).toBe(0)
        expect(hunt.discovered).toBe(false)
        expect(hunt.lastSubmittedAt).toBeNull()
      }
    }
  })
})

describe('GET /api/v1/practice/progress — learner-safe payload', () => {
  it('never carries internal identifiers, evaluator internals or defect ids', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password, IP)
    await startHunt(migrated, 'hunt-pricing-001', `${session as string}`)
    await submitReport(migrated, 'hunt-pricing-001', bothCookies(session, customer))

    const response = await getProgress(migrated, session as string)
    const text = await response.text()
    for (const marker of INTERNAL_MARKERS) {
      expect(text).not.toContain(marker)
    }
    // No numeric database ids anywhere: huntId is the only id-shaped field.
    const body = JSON.parse(text) as ProgressBody
    expect(Object.keys(body).sort()).toEqual(['hunts', 'persistence', 'recent', 'totals'])
    expect(Object.keys(body.totals).sort()).toEqual(
      [
        'attempts',
        'averageBestScore',
        'bestScore',
        'discovered',
        'hintsUsed',
        'inProgress',
        'reports',
        'revealed',
        'submitted',
      ].sort(),
    )
    for (const hunt of body.hunts) {
      const isExercise =
        hunt.huntId.startsWith('sql-')
        || hunt.huntId.startsWith('perf-')
        || hunt.huntId.startsWith('sec-')
        || hunt.huntId.startsWith('evt-')
        || (hunt.huntId.startsWith('contract-') && !hunt.huntId.startsWith('hunt-contract-'))
      const base = [
        'attempts',
        'bestScore',
        'discovered',
        'hintsUsed',
        'huntId',
        'lastSubmittedAt',
        'status',
        'title',
      ]
      // SQL exercise entries carry no scenarioId (plain text in the UI).
      expect(Object.keys(hunt).sort()).toEqual(
        [...base, ...(isExercise ? [] : ['scenarioId'])].sort(),
      )
      if (!isExercise) {
        expect(hunt.scenarioId?.length).toBeGreaterThan(0)
      }
    }
    for (const entry of body.recent) {
      expect(Object.keys(entry).sort()).toEqual(
        ['createdAt', 'huntId', 'score', 'title', 'verdict'].sort(),
      )
    }
  })
})

describe('progress aggregation — pure helpers', () => {
  const row = (overrides: Partial<ProgressAttemptRow> = {}): ProgressAttemptRow => ({
    id: 1,
    hunt_id: 'hunt-pricing-001',
    status: 'submitted',
    hint_mask: 0,
    best_quality_score: null,
    discovered: 0,
    submitted_at: null,
    ...overrides,
  })

  it('averageBestScore returns null for no scored attempts and a rounded mean otherwise', () => {
    expect(averageBestScore([])).toBeNull()
    expect(averageBestScore([100])).toBe(100)
    expect(averageBestScore([10, 100])).toBe(55)
    expect(averageBestScore([60, 85])).toBe(73) // 72.5 rounds half up
  })

  it('summarizeProgressAttempts buckets by status and ignores revealed rows for discovery', () => {
    const summary = summarizeProgressAttempts([
      row({ id: 1, status: 'in_progress', hunt_id: 'hunt-pricing-001' }),
      row({ id: 2, status: 'submitted', hunt_id: 'hunt-pricing-001', best_quality_score: 80, discovered: 1, submitted_at: '2026-11-16T00:00:00.000Z' }),
      row({ id: 3, status: 'revealed', hunt_id: 'hunt-cart-001', best_quality_score: 60, discovered: 1, submitted_at: '2026-11-16T01:00:00.000Z' }),
    ])
    expect(summary.attempts).toBe(3)
    expect(summary.inProgress).toBe(1)
    expect(summary.submitted).toBe(1)
    expect(summary.revealed).toBe(1)
    expect(summary.discovered).toBe(1) // revealed row excluded
    expect(summary.bestScore).toBe(80)
    expect(summary.averageBestScore).toBe(70) // (80 + 60) / 2
    expect(summary.hintsUsed).toBe(0)
  })

  it('summarizeProgressAttempts sums the hint mask popcounts', () => {
    const summary = summarizeProgressAttempts([
      row({ id: 1, hint_mask: 7 }),
      row({ id: 2, hunt_id: 'hunt-cart-001', hint_mask: 5 }),
      row({ id: 3, hunt_id: 'hunt-catalogue-001', hint_mask: 1 }),
    ])
    expect(summary.hintsUsed).toBe(6) // 3 + 2 + 1
  })

  it('buildHuntEntries keeps registry order and picks the newest attempt per hunt', () => {
    const entries = buildHuntEntries([
      row({ id: 9, status: 'submitted', hunt_id: 'hunt-evolution', best_quality_score: 10 }),
      row({ id: 3, status: 'in_progress', hunt_id: 'hunt-pricing-001' }),
      row({ id: 7, status: 'submitted', hunt_id: 'hunt-pricing-001', best_quality_score: 100 }),
    ])
    expect(entries.map((entry) => entry.huntId)).toEqual(allAttemptTargets().map((target) => target.id))
    const pricing = entries.find((entry) => entry.huntId === 'hunt-pricing-001')
    // Newest-first scan: id 7 (the highest id seen list order) wins the status.
    expect(pricing?.bestScore).toBe(100)
    expect(pricing?.attempts).toBe(2)
  })
})
