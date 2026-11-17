// Phase 4 (P4-M2 WP1) — progressive hints & gated solution reveal.
//
// Covers: all hint levels across the registered runnable hunts, hint
// progression/persistence/idempotency, attempt ownership and isolation,
// the gated reveal (403 pre-unlock, 200 post-submit), the explicit
// confirmed give-up path (POST …/reveal), discovery independence, reveal
// persistence across submissions and new attempts, and pre-reveal
// information-leak checks for every learner-facing payload. Runs against
// the real migration SQL — no SQL is mocked.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { HINTS, requireHint } from '../../src/server/hints'
import { REVEALS } from '../../src/server/reveals'
import { LAB_HINTS, LAB_REVEALS } from '../../src/server/labLearning'
import { DEFECTS } from '../../src/server/defects'
import { HUNTS } from '../../src/server/hunts'
import {
  createMigratedD1,
  type MigratedD1,
} from '../helpers/fake-d1'

const AMARA = { email: 'amara.okafor@example.com', password: 'demo-amara-1001' }

const DEFECT_IDS = DEFECTS.map((defect) => defect.id)
const DEFECT_TITLES = DEFECTS.map((defect) => defect.title)
// Phase 4 (kind 'ui' or unspecified) hunts plus the final-phase UI hunts,
// whose hints/reveals live in the lab registry (src/server/labLearning.ts).
const RUNNABLE_IDS = HUNTS.filter((hunt) => hunt.kind === undefined || hunt.kind === 'ui').map((hunt) => hunt.id)

interface FlatHints {
  level1: string
  level2: string
  level3: string
}

interface FlatReveal {
  expected: string
  actual: string
  rootCause: string
  reproduction: string[]
  verification: string[]
  concepts: string[]
  commonMisconceptions: string[]
  solution?: string
  explanation?: string
}

function uiHints(id: string): FlatHints {
  const lab = LAB_HINTS[id]
  if (lab) {
    return { level1: lab[0], level2: lab[1], level3: lab[2] }
  }
  return HINTS[id]
}

function uiReveal(id: string): FlatReveal {
  return (LAB_REVEALS[id] ?? REVEALS[id]) as FlatReveal
}

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
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

function extractCookie(setCookie: string | null, name: string): string | null {
  if (!setCookie) return null
  const match = new RegExp(`${name}=([a-f0-9]{32})`).exec(setCookie)
  return match ? match[1] : null
}

async function signIn(migrated: MigratedD1, email: string, password: string) {
  const response = await app.request(
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    { DB: migrated.db },
  )
  const joined = allSetCookies(response)
  return {
    response,
    session: extractCookie(joined, 'mpl_session'),
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
) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/report`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` },
      body: JSON.stringify(validReport(overrides)),
    },
    { DB: migrated.db },
  )
}

async function postHint(
  migrated: MigratedD1,
  huntId: string,
  level: unknown,
  cookie?: string,
  rawBody?: string,
) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/hints`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? sessionCookieHeader(cookie) : {}) },
      body: rawBody ?? JSON.stringify(level === undefined ? {} : { level }),
    },
    { DB: migrated.db },
  )
}

async function getReveal(migrated: MigratedD1, huntId: string, cookie?: string) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/reveal`,
    { headers: cookie ? sessionCookieHeader(cookie) : {} },
    { DB: migrated.db },
  )
}

async function postReveal(
  migrated: MigratedD1,
  huntId: string,
  cookie: string | undefined,
  body?: unknown,
) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/reveal`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? sessionCookieHeader(cookie) : {}) },
      body: body === undefined ? JSON.stringify({ confirm: true }) : JSON.stringify(body),
    },
    { DB: migrated.db },
  )
}

function attemptRow(migrated: MigratedD1, huntId: string) {
  return migrated.sqlite
    .prepare('SELECT * FROM hunt_attempts WHERE hunt_id = ? ORDER BY id DESC')
    .get(huntId) as Record<string, unknown> | undefined
}

const REVEAL_KEYS = [
  'actual',
  'attempt',
  'commonMisconceptions',
  'concepts',
  'expected',
  'huntId',
  'reproduction',
  'rootCause',
  'title',
  'verification',
]

/** Every learner-safe string in a reveal payload — used for leak checks. */
function revealStrings(huntId: string): string[] {
  const reveal = uiReveal(huntId)
  return [
    reveal.expected,
    reveal.actual,
    reveal.rootCause,
    ...reveal.reproduction,
    ...reveal.verification,
    ...reveal.concepts,
    ...reveal.commonMisconceptions,
  ]
}

function hintStrings(): string[] {
  return RUNNABLE_IDS.flatMap((huntId) => {
    const hints = uiHints(huntId)
    return [hints.level1, hints.level2, hints.level3]
  })
}

describe('hint registry (content, completeness, leakage)', () => {
  it('covers exactly the registered runnable hunts with three levels each', () => {
    const coveredHints = new Set([...Object.keys(HINTS), ...Object.keys(LAB_HINTS)])
    const coveredReveals = new Set([...Object.keys(REVEALS), ...Object.keys(LAB_REVEALS)])
    for (const huntId of RUNNABLE_IDS) {
      expect(coveredHints.has(huntId), `hints missing for ${huntId}`).toBe(true)
      expect(coveredReveals.has(huntId), `reveal missing for ${huntId}`).toBe(true)
      const hints = uiHints(huntId)
      const reveal = uiReveal(huntId)
      expect(hints.level1.trim().length).toBeGreaterThan(0)
      expect(hints.level2.trim().length).toBeGreaterThan(0)
      expect(hints.level3.trim().length).toBeGreaterThan(0)
      expect(reveal.expected.trim().length).toBeGreaterThan(0)
      expect(reveal.actual.trim().length).toBeGreaterThan(0)
      expect(reveal.rootCause.trim().length).toBeGreaterThan(0)
      expect(reveal.reproduction.length).toBeGreaterThan(0)
      expect(reveal.verification.length).toBeGreaterThan(0)
      expect(reveal.concepts.length).toBeGreaterThan(0)
      expect(reveal.commonMisconceptions.length).toBeGreaterThan(0)
    }
  })

  it('contains no defect ids or internal defect titles anywhere', () => {
    const corpus = [...hintStrings(), ...RUNNABLE_IDS.flatMap(revealStrings)].join('\n')
    for (const defectId of DEFECT_IDS) {
      expect(corpus).not.toContain(defectId)
    }
    for (const title of DEFECT_TITLES) {
      expect(corpus).not.toContain(title)
    }
  })

  it('contains no implementation identifiers in hints', () => {
    const hintCorpus = hintStrings().join('\n')
    for (const token of [
      'p.description',
      'c.slug',
      'line_total_cents',
      'order_items',
      'cart_items',
      'customer_id',
      'practice_sessions',
      'reportQuality',
      'isDefectActive',
      'NAME_PATTERN',
      'HUNT_',
    ]) {
      expect(hintCorpus).not.toContain(token)
    }
  })

  it('hint text never contains reveal content (content lint)', () => {
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
    for (const huntId of RUNNABLE_IDS) {
      const hints = uiHints(huntId)
      const reveal = uiReveal(huntId)
      const revealBlob = normalize(
        [reveal.expected, reveal.actual, reveal.rootCause, ...reveal.concepts].join(' '),
      )
      for (const level of ['level1', 'level2', 'level3'] as const) {
        expect(revealBlob).not.toContain(normalize(hints[level]))
      }
      const hintBlob = normalize(
        [hints.level1, hints.level2, hints.level3].join(' '),
      )
      expect(hintBlob).not.toContain(normalize(reveal.actual))
      expect(hintBlob).not.toContain(normalize(reveal.rootCause))
    }
  })
})

describe('hint endpoints (progression, persistence, idempotency)', () => {
  it('requires a session (401) and rejects unknown/malformed hunts', async () => {
    const migrated = createMigratedD1()
    expect((await postHint(migrated, 'hunt-cart-001', 1)).status).toBe(401)
    expect((await postHint(migrated, 'hunt-cart-001', 1, 'deadbeef'.repeat(4))).status).toBe(401)

    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    expect((await postHint(migrated, 'hunt-nope-999', 1, cookie)).status).toBe(404)
    expect((await postHint(migrated, 'hunt-cart-001!', 1, cookie)).status).toBe(400)
  })

  it('validates the level strictly (400 invalid_level)', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    for (const body of [{}, { level: 0 }, { level: 4 }, { level: 2.5 }, { level: '1' }, { level: null }, { level: 'level1' }]) {
      const response = await postHint(migrated, 'hunt-cart-001', undefined, cookie, JSON.stringify(body))
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(((await response.json()) as { error: string }).error).toBe('invalid_level')
    }
    const notJson = await postHint(migrated, 'hunt-cart-001', undefined, cookie, 'not-json')
    expect(notJson.status).toBe(400)
  })

  it('serves levels in order and refuses skips (409 hint_level_locked)', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string

    const skipTwo = await postHint(migrated, 'hunt-cart-001', 2, cookie)
    expect(skipTwo.status).toBe(409)
    expect(((await skipTwo.json()) as { error: string }).error).toBe('hint_level_locked')

    const skipThree = await postHint(migrated, 'hunt-cart-001', 3, cookie)
    expect(skipThree.status).toBe(409)

    expect((await postHint(migrated, 'hunt-cart-001', 1, cookie)).status).toBe(200)
    const stillLocked = await postHint(migrated, 'hunt-cart-001', 3, cookie)
    expect(stillLocked.status).toBe(409)

    expect((await postHint(migrated, 'hunt-cart-001', 2, cookie)).status).toBe(200)
    expect((await postHint(migrated, 'hunt-cart-001', 3, cookie)).status).toBe(200)
  })

  it('is idempotent per level and counts distinct levels only', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-inventory-001')
    const cookie = session as string

    const first = (await (await postHint(migrated, 'hunt-inventory-001', 1, cookie)).json()) as { hintsUsed: number; hint: string }
    const second = (await (await postHint(migrated, 'hunt-inventory-001', 1, cookie)).json()) as { hintsUsed: number; hint: string }
    expect(first.hintsUsed).toBe(1)
    expect(second.hintsUsed).toBe(1)
    expect(second.hint).toBe(first.hint)
    expect((attemptRow(migrated, 'hunt-inventory-001'))?.hint_mask).toBe(1)

    await postHint(migrated, 'hunt-inventory-001', 2, cookie)
    await postHint(migrated, 'hunt-inventory-001', 2, cookie)
    expect((attemptRow(migrated, 'hunt-inventory-001'))?.hint_mask).toBe(3)

    await postHint(migrated, 'hunt-inventory-001', 3, cookie)
    const third = (await (await postHint(migrated, 'hunt-inventory-001', 3, cookie)).json()) as { hintsUsed: number }
    expect(third.hintsUsed).toBe(3)
    expect((attemptRow(migrated, 'hunt-inventory-001'))?.hint_mask).toBe(7)

    // Level 2 remains readable after level 3 is unlocked (idempotent).
    const reread = await postHint(migrated, 'hunt-inventory-001', 2, cookie)
    expect(reread.status).toBe(200)
    expect(((await reread.json()) as { hintsUsed: number }).hintsUsed).toBe(3)
  })

  it('persists across requests and shows up in the attempt view', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const cookie = session as string
    await postHint(migrated, 'hunt-pricing-001', 1, cookie)
    await postHint(migrated, 'hunt-pricing-001', 2, cookie)

    const view = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/attempt',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    expect(((await view.json()) as { hintsUsed: number }).hintsUsed).toBe(2)
  })

  it('isolates hint state between hunts on one session', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    await postHint(migrated, 'hunt-cart-001', 1, cookie)
    await startHunt(migrated, 'hunt-inventory-001', cookie)

    const skip = await postHint(migrated, 'hunt-inventory-001', 2, cookie)
    expect(skip.status).toBe(409)
    const fresh = (await (await postHint(migrated, 'hunt-inventory-001', 1, cookie)).json()) as { hintsUsed: number }
    expect(fresh.hintsUsed).toBe(1)
  })

  it('isolates hint state between sessions for the same hunt', async () => {
    const migrated = createMigratedD1()
    const a = await startHunt(migrated, 'hunt-cart-001')
    const b = await startHunt(migrated, 'hunt-cart-001')
    await postHint(migrated, 'hunt-cart-001', 1, a.session as string)
    await postHint(migrated, 'hunt-cart-001', 2, a.session as string)

    const skip = await postHint(migrated, 'hunt-cart-001', 2, b.session as string)
    expect(skip.status).toBe(409)
    const fresh = (await (await postHint(migrated, 'hunt-cart-001', 1, b.session as string)).json()) as { hintsUsed: number }
    expect(fresh.hintsUsed).toBe(1)
  })

  it('follows the same ownership rules for signed-in learners; no cross-session claim', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    const cookie = amara.session as string
    await startHunt(migrated, 'hunt-checkout-001', cookie)
    await postHint(migrated, 'hunt-checkout-001', 1, cookie)

    // A new browser session for the same customer does not inherit the mask.
    const amaraAgain = await signIn(migrated, AMARA.email, AMARA.password)
    const skip = await postHint(migrated, 'hunt-checkout-001', 2, amaraAgain.session as string)
    expect(skip.status).toBe(409)
  })

  it('returns exactly the learner-safe keys and no server-only content', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-authz-001')
    const cookie = session as string
    const response = await postHint(migrated, 'hunt-authz-001', 1, cookie)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['hint', 'hintsUsed', 'level'])
    const text = JSON.stringify(body)
    for (const defectId of DEFECT_IDS) {
      expect(text).not.toContain(defectId)
    }
    for (const leak of revealStrings('hunt-authz-001')) {
      expect(text).not.toContain(leak)
    }
  })

  it('creates an attempt implicitly for a session that never started the hunt', async () => {
    const migrated = createMigratedD1()
    // A live session in clean mode (hunt never started): hint request mints
    // the attempt, consistent with the report path.
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    migrated.sqlite.exec('DELETE FROM bug_reports; DELETE FROM hunt_attempts;')
    const response = await postHint(migrated, 'hunt-cart-001', 1, session as string)
    expect(response.status).toBe(200)
    expect(attemptRow(migrated, 'hunt-cart-001')).toBeDefined()
  })

  it('never unlocks the reveal, no matter how many hints are used', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-catalogue-001')
    const cookie = session as string
    await postHint(migrated, 'hunt-catalogue-001', 1, cookie)
    await postHint(migrated, 'hunt-catalogue-001', 2, cookie)
    await postHint(migrated, 'hunt-catalogue-001', 3, cookie)
    const reveal = await getReveal(migrated, 'hunt-catalogue-001', cookie)
    expect(reveal.status).toBe(403)
  })
})

describe('gated reveal (eligibility, absence pre-unlock)', () => {
  it('answers 403 reveal_locked without a session and without content', async () => {
    const migrated = createMigratedD1()
    const response = await getReveal(migrated, 'hunt-pricing-001')
    expect(response.status).toBe(403)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.error).toBe('reveal_locked')
    expect(Object.keys(body).sort()).toEqual(['error', 'message'])
    const text = JSON.stringify(body)
    for (const leak of revealStrings('hunt-pricing-001')) {
      expect(text).not.toContain(leak)
    }
  })

  it('answers 403 for a session that has not submitted a report', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const response = await getReveal(migrated, 'hunt-pricing-001', session as string)
    expect(response.status).toBe(403)
    expect(((await response.json()) as { error: string }).error).toBe('reveal_locked')
  })

  it('answers 403 for a session that never started the hunt (read mints nothing)', async () => {
    const migrated = createMigratedD1()
    // Mint a clean-mode session via reset, then ask for a reveal without
    // ever touching the hunt.
    const reset = await app.request(
      '/api/v1/practice/session/reset',
      { method: 'POST' },
      { DB: migrated.db },
    )
    const setCookie = reset.headers.get('set-cookie') ?? ''
    const token = extractCookie(setCookie, 'mpl_session') as string
    const response = await getReveal(migrated, 'hunt-pricing-001', token)
    expect(response.status).toBe(403)
    expect(attemptRow(migrated, 'hunt-pricing-001')).toBeUndefined()
  })

  it('unlocks after a submitted report and returns the learner-safe payload', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const cookie = session as string
    expect((await getReveal(migrated, 'hunt-pricing-001', cookie)).status).toBe(403)

    const submitted = await submitReport(migrated, 'hunt-pricing-001', cookie)
    expect(submitted.status).toBe(201)

    const response = await getReveal(migrated, 'hunt-pricing-001', cookie)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(REVEAL_KEYS)
    expect((body.attempt as { status: string }).status).toBe('submitted')
    expect(body.huntId).toBe('hunt-pricing-001')
    const reveal = REVEALS['hunt-pricing-001']
    expect(body.expected).toBe(reveal.expected)
    expect(body.actual).toBe(reveal.actual)
    expect(body.rootCause).toBe(reveal.rootCause)
    expect(body.reproduction).toEqual([...reveal.reproduction])
    expect(body.verification).toEqual([...reveal.verification])
    expect(body.concepts).toEqual([...reveal.concepts])
    expect(body.commonMisconceptions).toEqual([...reveal.commonMisconceptions])

    const text = JSON.stringify(body)
    for (const defectId of DEFECT_IDS) {
      expect(text).not.toContain(defectId)
    }
    for (const title of DEFECT_TITLES) {
      expect(text).not.toContain(title)
    }
  })

  it('a report for one hunt never unlocks another hunt', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    await submitReport(migrated, 'hunt-cart-001', cookie)
    expect((await getReveal(migrated, 'hunt-inventory-001', cookie)).status).toBe(403)
    expect((await getReveal(migrated, 'hunt-cart-001', cookie)).status).toBe(200)
  })

  it('a failed report does not unlock the reveal', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const cookie = session as string
    const rejected = await submitReport(migrated, 'hunt-pricing-001', cookie, { steps: '' })
    expect(rejected.status).toBe(400)
    expect((await getReveal(migrated, 'hunt-pricing-001', cookie)).status).toBe(403)
    expect((attemptRow(migrated, 'hunt-pricing-001'))?.status).toBe('in_progress')
  })

  it('another session cannot see a reveal unlocked by this session', async () => {
    const migrated = createMigratedD1()
    const a = await startHunt(migrated, 'hunt-cart-001')
    const b = await startHunt(migrated, 'hunt-cart-001')
    await submitReport(migrated, 'hunt-cart-001', a.session as string)
    expect((await getReveal(migrated, 'hunt-cart-001', b.session as string)).status).toBe(403)
  })

  it('pre-reveal payloads (hunts, session, start, attempt) contain no reveal or hint content', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const cookie = session as string
    const hunts = await app.request('/api/v1/practice/hunts', {}, { DB: migrated.db })
    const sessionRes = await app.request(
      '/api/v1/practice/session',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    const start = await startHunt(migrated, 'hunt-pricing-001', cookie)
    const attempt = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/attempt',
      { headers: sessionCookieHeader(cookie) },
      { DB: migrated.db },
    )
    for (const response of [hunts, sessionRes, start.response, attempt]) {
      const text = JSON.stringify(await response.json())
      for (const defectId of DEFECT_IDS) {
        expect(text).not.toContain(defectId)
      }
      for (const leak of [...revealStrings('hunt-pricing-001'), ...hintStrings()]) {
        expect(text).not.toContain(leak)
      }
    }
  })
})

describe('give-up (explicit confirmed unlock)', () => {
  it('requires a session (401) and a known hunt (404/400)', async () => {
    const migrated = createMigratedD1()
    expect((await postReveal(migrated, 'hunt-cart-001', undefined)).status).toBe(401)
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    expect((await postReveal(migrated, 'hunt-nope-999', cookie)).status).toBe(404)
    expect((await postReveal(migrated, 'hunt-cart-001!', cookie)).status).toBe(400)
  })

  it('requires the explicit confirm flag (400 otherwise)', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    for (const body of [{}, { confirm: false }, { confirm: 'true' }, { confirm: 1 }, null]) {
      const response = await postReveal(migrated, 'hunt-cart-001', cookie, body)
      expect(response.status, JSON.stringify(body)).toBe(400)
    }
    const notJson = await app.request(
      '/api/v1/practice/hunts/hunt-cart-001/reveal',
      { method: 'POST', headers: { 'content-type': 'application/json', cookie: `mpl_session=${cookie}` }, body: 'nope' },
      { DB: migrated.db },
    )
    expect(notJson.status).toBe(400)
  })

  it('unlocks with zero reports filed; status becomes revealed, never submitted, never discovered', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-inventory-001')
    const cookie = session as string
    const response = await postReveal(migrated, 'hunt-inventory-001', cookie)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(REVEAL_KEYS)
    expect(REVEALS['hunt-inventory-001'].actual).toBe(body.actual)
    const attempt = body.attempt as Record<string, unknown>
    expect(attempt.status).toBe('revealed')
    expect(attempt.discovered).toBe(false)
    expect(attempt.submittedAt).toBeNull()

    const row = attemptRow(migrated, 'hunt-inventory-001')
    expect(row?.status).toBe('revealed')
    expect(row?.revealed_at).toBeTruthy()
    expect(row?.discovered).toBe(0)
    expect(row?.submitted_at).toBeNull()
  })

  it('is idempotent: repeated give-ups preserve state and revealed_at', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-checkout-001')
    const cookie = session as string
    const first = await postReveal(migrated, 'hunt-checkout-001', cookie)
    expect(first.status).toBe(200)
    const firstRow = attemptRow(migrated, 'hunt-checkout-001')
    const second = await postReveal(migrated, 'hunt-checkout-001', cookie)
    expect(second.status).toBe(200)
    const secondRow = attemptRow(migrated, 'hunt-checkout-001')
    expect(secondRow?.revealed_at).toBe(firstRow?.revealed_at)
    expect(secondRow?.status).toBe('revealed')
    const body = (await second.json()) as { attempt: { status: string } }
    expect(body.attempt.status).toBe('revealed')
  })

  it('preserves report history, best score and discovery when the attempt was already submitted', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const cookie = session as string
    const submitted = await submitReport(migrated, 'hunt-pricing-001', cookie)
    expect(submitted.status).toBe(201)
    const before = attemptRow(migrated, 'hunt-pricing-001')
    expect(before?.status).toBe('submitted')
    expect(before?.discovered).toBe(1)

    const giveUp = await postReveal(migrated, 'hunt-pricing-001', cookie)
    expect(giveUp.status).toBe(200)
    const after = attemptRow(migrated, 'hunt-pricing-001')
    expect(after?.status).toBe('submitted') // stays submitted — never downgraded
    expect(after?.discovered).toBe(1)
    expect(after?.best_quality_score).toBe(before?.best_quality_score)
    expect(after?.submitted_at).toBe(before?.submitted_at)
    expect(after?.revealed_at).toBeTruthy() // reveal becomes available, stamped once
    const body = (await giveUp.json()) as { attempt: { status: string; discovered: boolean; bestQualityScore: number } }
    expect(body.attempt.status).toBe('submitted')
    expect(body.attempt.discovered).toBe(true)
    expect(body.attempt.bestQualityScore).toBe(100)
  })

  it('never awards discovery, and discovery stays evaluator-governed after give-up', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    await postReveal(migrated, 'hunt-cart-001', cookie)
    expect((attemptRow(migrated, 'hunt-cart-001'))?.discovered).toBe(0)

    // A full-quality report after giving up still evaluates honestly:
    // the evaluator awards discovery (sticky), the attempt stays revealed.
    const submitted = await submitReport(migrated, 'hunt-cart-001', cookie)
    expect(submitted.status).toBe(201)
    const row = attemptRow(migrated, 'hunt-cart-001')
    expect(row?.status).toBe('revealed')
    expect(row?.discovered).toBe(1)
  })

  it('reveals only the requested hunt, never another', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    await startHunt(migrated, 'hunt-inventory-001', cookie)
    await postReveal(migrated, 'hunt-cart-001', cookie)
    expect((await getReveal(migrated, 'hunt-cart-001', cookie)).status).toBe(200)
    expect((await getReveal(migrated, 'hunt-inventory-001', cookie)).status).toBe(403)
  })

  it('a new attempt does not inherit the prior attempt’s reveal state', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string
    await postReveal(migrated, 'hunt-cart-001', cookie)
    expect((await getReveal(migrated, 'hunt-cart-001', cookie)).status).toBe(200)

    // Start the hunt again — a fresh in_progress attempt is minted.
    await startHunt(migrated, 'hunt-cart-001', cookie)
    const row = attemptRow(migrated, 'hunt-cart-001')
    expect(row?.status).toBe('in_progress')
    expect((await getReveal(migrated, 'hunt-cart-001', cookie)).status).toBe(403)
  })

  it('a revealed attempt stays revealed when another report is filed', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-pricing-001')
    const cookie = session as string
    await postReveal(migrated, 'hunt-pricing-001', cookie)
    await submitReport(migrated, 'hunt-pricing-001', cookie)
    expect((attemptRow(migrated, 'hunt-pricing-001'))?.status).toBe('revealed')
    expect((await getReveal(migrated, 'hunt-pricing-001', cookie)).status).toBe(200)
  })

  it('give-up payload has no defect ids and no foreign hunt content', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-authz-001')
    const cookie = session as string
    const response = await postReveal(migrated, 'hunt-authz-001', cookie)
    const text = JSON.stringify(await response.json())
    for (const defectId of DEFECT_IDS) {
      expect(text).not.toContain(defectId)
    }
    for (const title of DEFECT_TITLES) {
      expect(text).not.toContain(title)
    }
    for (const leak of revealStrings('hunt-cart-001')) {
      expect(text).not.toContain(leak)
    }
  })
})

describe('hints on settled attempts (409 hint_attempt_completed)', () => {
  it('refuses to open any level after a report is submitted; recorded usage is untouched', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string

    const submitted = await submitReport(migrated, 'hunt-cart-001', cookie)
    expect(submitted.status).toBe(201)

    const response = await postHint(migrated, 'hunt-cart-001', 1, cookie)
    expect(response.status).toBe(409)
    expect(((await response.json()) as { error: string }).error).toBe('hint_attempt_completed')
    expect(attemptRow(migrated, 'hunt-cart-001')?.hint_mask).toBe(0)
  })

  it('keeps already-unlocked levels re-readable after a report (200), but no new level opens', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-cart-001')
    const cookie = session as string

    expect((await postHint(migrated, 'hunt-cart-001', 1, cookie)).status).toBe(200)

    const submitted = await submitReport(migrated, 'hunt-cart-001', cookie)
    expect(submitted.status).toBe(201)

    const reread = await postHint(migrated, 'hunt-cart-001', 1, cookie)
    expect(reread.status).toBe(200)
    const body = (await reread.json()) as { hintsUsed: number; hint: string }
    expect(body.hintsUsed).toBe(1)
    expect(body.hint.length).toBeGreaterThan(0)

    const locked = await postHint(migrated, 'hunt-cart-001', 2, cookie)
    expect(locked.status).toBe(409)
    expect(((await locked.json()) as { error: string }).error).toBe('hint_attempt_completed')
    expect(attemptRow(migrated, 'hunt-cart-001')?.hint_mask).toBe(1)
  })

  it('refuses new unlocks after a confirmed give-up (409); the idempotent re-read still works', async () => {
    const migrated = createMigratedD1()
    const { session } = await startHunt(migrated, 'hunt-inventory-001')
    const cookie = session as string

    expect((await postHint(migrated, 'hunt-inventory-001', 1, cookie)).status).toBe(200)
    const giveUp = await postReveal(migrated, 'hunt-inventory-001', cookie)
    expect(giveUp.status).toBe(200)

    const reread = await postHint(migrated, 'hunt-inventory-001', 1, cookie)
    expect(reread.status).toBe(200)

    const fresh = await postHint(migrated, 'hunt-inventory-001', 2, cookie)
    expect(fresh.status).toBe(409)
    expect(((await fresh.json()) as { error: string }).error).toBe('hint_attempt_completed')
    expect(attemptRow(migrated, 'hunt-inventory-001')?.hint_mask).toBe(1)
  })
})

describe('requireHint (fail-closed registry lookup)', () => {
  it('throws for unknown hunts instead of serving a null hint', () => {
    expect(() => requireHint('hunt-nope-999', 1)).toThrow('Hint registry is missing a runnable hunt.')
  })

  it('returns non-empty text for every runnable hunt and every level', () => {
    for (const huntId of Object.keys(HINTS)) {
      for (const level of [1, 2, 3] as const) {
        expect(requireHint(huntId, level).length).toBeGreaterThan(0)
      }
    }
  })
})
