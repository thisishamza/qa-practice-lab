import { Hono } from 'hono'
import type { HealthResponse } from '../shared/health'
import { catalogueRoutes } from './catalogue'
import { cartRoutes } from './cart'
import { checkoutRoutes } from './checkout'

export interface Bindings {
  DB: D1Database
}

export type AppEnv = {
  Bindings: Bindings
}

const SERVICE_NAME = 'qa-practice-lab'
// Keep in sync with package.json.
const SERVICE_VERSION = '0.2.0'

export const app = new Hono<AppEnv>().basePath('/api')

app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
  await next()
})

app.get('/health', async (c) => {
  const checkedAt = new Date().toISOString()

  try {
    const row = await c.env.DB.prepare(
      "SELECT value FROM app_meta WHERE key = 'schema_version'",
    ).first<{ value: string }>()

    if (!row?.value) {
      throw new Error('Schema version row is missing')
    }

    const body: HealthResponse = {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      database: 'ok',
      schemaVersion: row.value,
      checkedAt,
    }

    return c.json(body)
  } catch (error) {
    console.error('[api] Health check failed', error)

    const body: HealthResponse = {
      status: 'degraded',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      database: 'unavailable',
      schemaVersion: null,
      checkedAt,
    }

    return c.json(body, 503)
  }
})

app.route('/v1', catalogueRoutes)
app.route('/v1', cartRoutes)
app.route('/v1', checkoutRoutes)

app.notFound((c) =>
  c.json({ error: 'not_found', message: 'API route not found' }, 404),
)

app.onError((error, c) => {
  console.error('[api] Unhandled error', error)
  return c.json(
    { error: 'internal_error', message: 'An unexpected error occurred' },
    500,
  )
})
