import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAttempt,
  fetchPracticeHunts,
  fetchPracticeSession,
  fetchReveal,
  giveUpAndReveal,
  requestHint,
  resetPracticeSession,
  startHunt,
  submitReport,
  PracticeApiError,
} from '../../src/features/practice/api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPracticeSession', () => {
  it('parses a clean session', async () => {
    stubFetch(async () => jsonResponse({ mode: 'clean', hunt: null }))
    await expect(fetchPracticeSession()).resolves.toEqual({ mode: 'clean', hunt: null })
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toBe('/api/v1/practice/session')
  })

  it('parses a bug-hunt session with its summary', async () => {
    const hunt = { id: 'hunt-catalogue-001', title: 'Catalogue search under-matches', summary: 's' }
    stubFetch(async () => jsonResponse({ mode: 'bug_hunt', hunt }))
    await expect(fetchPracticeSession()).resolves.toEqual({ mode: 'bug_hunt', hunt })
  })

  it('throws PracticeApiError with the server message on HTTP errors', async () => {
    stubFetch(async () =>
      jsonResponse({ error: 'internal_error', message: 'D1 unavailable' }, 500),
    )
    await expect(fetchPracticeSession()).rejects.toMatchObject({
      name: 'PracticeApiError',
      status: 500,
      message: 'D1 unavailable',
    })
  })
})

describe('startHunt', () => {
  it('POSTs to the hunt start endpoint with no body or defect ids', async () => {
    stubFetch(async () =>
      jsonResponse({
        mode: 'bug_hunt',
        hunt: { id: 'hunt-catalogue-001', title: 't', summary: 's' },
      }),
    )
    const result = await startHunt('hunt-catalogue-001')
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe('/api/v1/practice/hunts/hunt-catalogue-001/start')
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(result.mode).toBe('bug_hunt')
  })

  it('encodes the hunt id in the path', async () => {
    stubFetch(async () => jsonResponse({ error: 'hunt_not_found', message: 'No such practice hunt exists.' }, 404))
    await expect(startHunt('hunt-nope-999')).rejects.toMatchObject({
      name: 'PracticeApiError',
      status: 404,
      code: 'hunt_not_found',
    })
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toBe('/api/v1/practice/hunts/hunt-nope-999/start')
  })
})

describe('resetPracticeSession', () => {
  it('POSTs to the reset endpoint and parses the clean response', async () => {
    stubFetch(async () => jsonResponse({ mode: 'clean', hunt: null }))
    await expect(resetPracticeSession()).resolves.toEqual({ mode: 'clean', hunt: null })
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe('/api/v1/practice/session/reset')
    expect(init.method).toBe('POST')
  })

  it('throws PracticeApiError on failure', async () => {
    stubFetch(async () => jsonResponse({ error: 'internal_error', message: 'nope' }, 500))
    await expect(resetPracticeSession()).rejects.toBeInstanceOf(PracticeApiError)
  })
})


describe('fetchPracticeHunts', () => {
  it('returns the registered hunt list', async () => {
    const data = [
      { id: 'hunt-catalogue-001', title: 't', summary: 's', scenarioId: 'manual-shop-search' },
    ]
    stubFetch(async () => jsonResponse({ data }))
    await expect(fetchPracticeHunts()).resolves.toEqual(data)
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toBe('/api/v1/practice/hunts')
  })

  it('returns an empty list when the envelope is malformed', async () => {
    stubFetch(async () => jsonResponse({}))
    await expect(fetchPracticeHunts()).resolves.toEqual([])
  })

  it('throws PracticeApiError on HTTP errors', async () => {
    stubFetch(async () => jsonResponse({ error: 'internal_error', message: 'D1 unavailable' }, 500))
    await expect(fetchPracticeHunts()).rejects.toMatchObject({
      name: 'PracticeApiError',
      status: 500,
    })
  })
})

describe('submitReport', () => {
  const submission = {
    title: 'Cart shows the wrong line total',
    environment: 'Meridian practice shop, Chrome on Linux',
    preconditions: null,
    steps: '1. Open /shop\n2. Add two copies\n3. Open /cart',
    expected: 'Line total should be 84.00.',
    actual: 'Line total shows 42.00.',
    severity: 'high' as const,
    priority: 'p2' as const,
    reproducibility: 'always' as const,
  }

  const responseBody = {
    attempt: {
      status: 'submitted' as const,
      hintsUsed: 0,
      bestQualityScore: 64,
      discovered: false,
      submittedAt: '2026-11-16T10:20:30.000Z',
    },
    report: { ...submission, qualityScore: 64, feedback: [], createdAt: '2026-11-16T10:20:30.000Z' },
    evaluation: {
      score: 64,
      verdict: 'needs-work' as const,
      checks: [{ id: 'finding', label: 'Finding', passed: false, message: 'Does not identify which behaviour is incorrect.' }],
    },
  }

  it('POSTs exactly the submission body and returns the server response', async () => {
    stubFetch(async () => jsonResponse(responseBody, 201))
    const result = await submitReport('hunt-cart-001', submission)
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe('/api/v1/practice/hunts/hunt-cart-001/report')
    expect(init.method).toBe('POST')
    const parsed = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(Object.keys(parsed).sort()).toEqual(
      ['actual', 'environment', 'expected', 'preconditions', 'priority', 'reproducibility', 'severity', 'steps', 'title'].sort(),
    )
    expect(parsed).not.toHaveProperty('qualityScore')
    expect(parsed).not.toHaveProperty('huntId')
    expect(parsed).not.toHaveProperty('attemptId')
    expect(result.evaluation.score).toBe(64)
    expect(result.report.qualityScore).toBe(64)
  })

  it('encodes the hunt id in the path', async () => {
    stubFetch(async () => jsonResponse({ error: 'hunt_not_found', message: 'No such practice hunt exists.' }, 404))
    await expect(submitReport('hunt-nope-999', submission)).rejects.toMatchObject({
      name: 'PracticeApiError',
      status: 404,
      code: 'hunt_not_found',
    })
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toBe('/api/v1/practice/hunts/hunt-nope-999/report')
  })

  it('attaches per-field messages on a 400 response', async () => {
    stubFetch(async () =>
      jsonResponse(
        { error: 'invalid_request', message: 'Check the highlighted fields and try again.', fields: { title: 'Enter a title.' } },
        400,
      ),
    )
    await expect(submitReport('hunt-cart-001', submission)).rejects.toMatchObject({
      name: 'PracticeApiError',
      status: 400,
      code: 'invalid_request',
      fields: { title: 'Enter a title.' },
    })
  })

  it('surfaces 401 session_required with the server message', async () => {
    stubFetch(async () =>
      jsonResponse({ error: 'session_required', message: 'Start the exercise before submitting a report.' }, 401),
    )
    await expect(submitReport('hunt-cart-001', submission)).rejects.toMatchObject({
      name: 'PracticeApiError',
      status: 401,
      code: 'session_required',
      fields: null,
    })
  })

  it('surfaces 429 rate_limited with the server message and no invented retry duration', async () => {
    stubFetch(async () =>
      jsonResponse({ error: 'rate_limited', message: 'Too many report submissions from this network. Wait a minute and try again.' }, 429),
    )
    try {
      await submitReport('hunt-cart-001', submission)
      expect.unreachable('submitReport should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(PracticeApiError)
      const apiError = error as PracticeApiError
      expect(apiError.status).toBe(429)
      expect(apiError.code).toBe('rate_limited')
      expect(apiError.message).toBe('Too many report submissions from this network. Wait a minute and try again.')
    }
  })

  it('falls back to a safe message on unexpected 5xx without leaking internals', async () => {
    stubFetch(async () => jsonResponse({ error: 'internal_error' }, 500))
    try {
      await submitReport('hunt-cart-001', submission)
      expect.unreachable('submitReport should have thrown')
    } catch (error) {
      const apiError = error as PracticeApiError
      expect(apiError.status).toBe(500)
      expect(apiError.message).toBe('The report could not be submitted.')
    }
  })
})

describe('fetchAttempt', () => {
  it('GETs the attempt endpoint and parses the view', async () => {
    const view = { status: 'submitted', hintsUsed: 2, bestQualityScore: 74, discovered: false, submittedAt: '2026-11-16T10:20:30.000Z' }
    stubFetch(async () => jsonResponse(view))
    await expect(fetchAttempt('hunt-cart-001')).resolves.toEqual(view)
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toBe('/api/v1/practice/hunts/hunt-cart-001/attempt')
  })

  it('parses the 404-free none view when the caller has no attempt', async () => {
    const view = { status: 'none', hintsUsed: 0, bestQualityScore: null, discovered: false, submittedAt: null }
    stubFetch(async () => jsonResponse(view))
    await expect(fetchAttempt('hunt-cart-001')).resolves.toEqual(view)
  })

  it('encodes the hunt id and throws PracticeApiError on errors', async () => {
    stubFetch(async () => jsonResponse({ error: 'hunt_not_found', message: 'No such practice hunt exists.' }, 404))
    await expect(fetchAttempt('hunt-nope-999')).rejects.toMatchObject({ status: 404, code: 'hunt_not_found' })
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toBe('/api/v1/practice/hunts/hunt-nope-999/attempt')
  })
})

describe('requestHint', () => {
  it('POSTs exactly { level } — no ids of any kind', async () => {
    stubFetch(async () => jsonResponse({ level: 1, hint: 'server hint', hintsUsed: 1 }))
    const result = await requestHint('hunt-cart-001', 1)
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/practice/hunts/hunt-cart-001/hints')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ level: 1 })
    expect(result).toEqual({ level: 1, hint: 'server hint', hintsUsed: 1 })
  })

  it('encodes the hunt id in the path', async () => {
    stubFetch(async () => jsonResponse({ error: 'hunt_not_found', message: 'No such practice hunt exists.' }, 404))
    await expect(requestHint('hunt-nope-999', 1)).rejects.toMatchObject({ status: 404, code: 'hunt_not_found' })
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toBe('/api/v1/practice/hunts/hunt-nope-999/hints')
  })

  it('surfaces 409 hint_level_locked with the server message', async () => {
    stubFetch(async () =>
      jsonResponse({ error: 'hint_level_locked', message: 'Use the previous hint first — levels unlock in order.' }, 409),
    )
    await expect(requestHint('hunt-cart-001', 3)).rejects.toMatchObject({
      status: 409,
      code: 'hint_level_locked',
      message: 'Use the previous hint first — levels unlock in order.',
    })
  })

  it('surfaces 401 session_required', async () => {
    stubFetch(async () => jsonResponse({ error: 'session_required', message: 'Start the exercise before asking for a hint.' }, 401))
    await expect(requestHint('hunt-cart-001', 1)).rejects.toMatchObject({ status: 401, code: 'session_required' })
  })

  it('surfaces 429 rate_limited with the server message and no invented duration client-side', async () => {
    stubFetch(async () => jsonResponse({ error: 'rate_limited', message: 'Too many attempts. Wait a moment and try again.' }, 429))
    await expect(requestHint('hunt-cart-001', 1)).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      message: 'Too many attempts. Wait a moment and try again.',
    })
  })
})

describe('fetchReveal', () => {
  const reveal = {
    huntId: 'hunt-cart-001',
    title: 't',
    expected: 'e',
    actual: 'a',
    rootCause: 'r',
    reproduction: ['1'],
    verification: ['1'],
    concepts: ['c'],
    commonMisconceptions: ['m'],
    attempt: { status: 'submitted', hintsUsed: 0, bestQualityScore: null, discovered: false, submittedAt: '2026-11-16T10:20:30.000Z' },
  }

  it('GETs the reveal endpoint and returns the payload', async () => {
    stubFetch(async () => jsonResponse(reveal))
    await expect(fetchReveal('hunt-cart-001')).resolves.toEqual(reveal)
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/practice/hunts/hunt-cart-001/reveal')
    expect(init?.method).toBeUndefined()
  })

  it('surfaces 403 reveal_locked with the server message', async () => {
    stubFetch(async () =>
      jsonResponse({ error: 'reveal_locked', message: 'Submit a bug report for this attempt, or explicitly give up, to unlock the solution.' }, 403),
    )
    await expect(fetchReveal('hunt-cart-001')).rejects.toMatchObject({
      status: 403,
      code: 'reveal_locked',
    })
  })
})

describe('giveUpAndReveal', () => {
  const reveal = {
    huntId: 'hunt-cart-001',
    title: 't',
    expected: 'e',
    actual: 'a',
    rootCause: 'r',
    reproduction: ['1'],
    verification: ['1'],
    concepts: ['c'],
    commonMisconceptions: ['m'],
    attempt: { status: 'revealed', hintsUsed: 0, bestQualityScore: null, discovered: false, submittedAt: null },
  }

  it('POSTs exactly { confirm: true } — no other fields', async () => {
    stubFetch(async () => jsonResponse(reveal))
    const result = await giveUpAndReveal('hunt-cart-001')
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/practice/hunts/hunt-cart-001/reveal')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ confirm: true })
    expect(Object.keys(JSON.parse(String(init.body)))).toEqual(['confirm'])
    expect(result.attempt.status).toBe('revealed')
    expect(result.attempt.discovered).toBe(false)
  })

  it('encodes the hunt id in the path', async () => {
    stubFetch(async () => jsonResponse({ error: 'hunt_not_found', message: 'No such practice hunt exists.' }, 404))
    await expect(giveUpAndReveal('hunt-nope-999')).rejects.toMatchObject({ status: 404, code: 'hunt_not_found' })
  })

  it('surfaces 401 session_required', async () => {
    stubFetch(async () => jsonResponse({ error: 'session_required', message: 'Start the exercise before revealing the solution.' }, 401))
    await expect(giveUpAndReveal('hunt-cart-001')).rejects.toMatchObject({ status: 401, code: 'session_required' })
  })

  it('surfaces 429 rate_limited with the server message', async () => {
    stubFetch(async () => jsonResponse({ error: 'rate_limited', message: 'Too many attempts. Wait a moment and try again.' }, 429))
    await expect(giveUpAndReveal('hunt-cart-001')).rejects.toMatchObject({ status: 429, code: 'rate_limited' })
  })
})
