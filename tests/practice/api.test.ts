import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPracticeHunts,
  fetchPracticeSession,
  resetPracticeSession,
  startHunt,
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
