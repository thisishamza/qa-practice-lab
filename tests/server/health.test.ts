import { afterEach, describe, expect, it, vi } from 'vitest'
import { app, type Bindings } from '../../src/server/app'

function createEnv(first: () => Promise<unknown>): Bindings {
  return {
    DB: {
      prepare: vi.fn(() => ({ first })),
    },
  } as unknown as Bindings
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/health', () => {
  it('reports ok when the schema version is readable', async () => {
    const env = createEnv(async () => ({ value: '1' }))

    const response = await app.request('/api/health', {}, env)
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      status: 'ok',
      service: 'qa-practice-lab',
      version: '0.2.0',
      database: 'ok',
      schemaVersion: '1',
    })
    expect(body.checkedAt).toEqual(expect.any(String))
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('reports degraded with 503 when the database is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = createEnv(async () => {
      throw new Error('no such table: app_meta')
    })

    const response = await app.request('/api/health', {}, env)
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      status: 'degraded',
      database: 'unavailable',
      schemaVersion: null,
    })
  })

  it('reports degraded when the schema version row is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = createEnv(async () => null)

    const response = await app.request('/api/health', {}, env)

    expect(response.status).toBe(503)
  })
})

describe('unknown API routes', () => {
  it('returns a JSON 404 envelope', async () => {
    const env = createEnv(async () => ({ value: '1' }))

    const response = await app.request('/api/does-not-exist', {}, env)
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(404)
    expect(body).toMatchObject({ error: 'not_found' })
  })
})
