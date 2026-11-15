import { Hono } from 'hono'
import type { HealthResponse } from '../shared/health'
import { catalogueRoutes } from './catalogue'
import { cartRoutes } from './cart'
import { checkoutRoutes } from './checkout'
import { authRoutes } from './auth'
import { inventoryRoutes } from './inventory'
import { practiceRoutes } from './practice'
import { attemptRoutes } from './attempts'
import { reportRoutes } from './reports'
import { learningRoutes } from './learning'
import { progressRoutes } from './progress'
import { maintenanceRoutes } from './maintenance'
import { clientIp, consumeRateLimit, sha256Hex, MUTATE_LIMIT } from './rateLimit'

export interface Bindings {
  DB: D1Database
}

export type AppEnv = {
  Bindings: Bindings
}

const SERVICE_NAME = 'qa-practice-lab'
// Keep in sync with package.json.
const SERVICE_VERSION = '0.2.0'

/** Mutating requests never carry a large payload in this API; cap them. */
const MAX_BODY_BYTES = 32 * 1024
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

export const app = new Hono<AppEnv>().basePath('/api')

// Body-size guard: reject oversized payloads before any parsing happens.
// Reads Content-Length only; requests without one (chunked) fall through to
// the platform's own limits. 32 KB is generous for JSON bodies here.
app.use('*', async (c, next) => {
  const declared = c.req.header('content-length')
  if (declared !== undefined) {
    const size = Number(declared)
    if (!Number.isFinite(size) || size < 0) {
      return c.json({ error: 'invalid_request', message: 'Invalid Content-Length.' }, 400)
    }
    if (size > MAX_BODY_BYTES) {
      return c.json(
        { error: 'payload_too_large', message: 'The request body is larger than the 32 KB limit.' },
        413,
      )
    }
  }
  await next()
})

app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
  await next()
})

// Global mutating-endpoint abuse control (soft, per IP per minute). Login
// additionally consumes its own failure budget, checkout its own placement
// budget; both share this bucket with everything else, which is intentional
// — the global cap bounds total churn, the scoped caps bound their specific
// abuse surfaces. No visible IP (local development) means no cap.
app.use('/v1/*', async (c, next) => {
  if (!MUTATING_METHODS.has(c.req.method)) {
    await next()
    return
  }
  const ip = clientIp(c)
  if (ip === null) {
    await next()
    return
  }
  const decision = await consumeRateLimit(c.env.DB, 'mutate', await sha256Hex(ip), MUTATE_LIMIT)
  if (!decision.allowed) {
    c.header('Retry-After', String(decision.retryAfterSeconds))
    return c.json(
      {
        error: 'rate_limited',
        message: 'Too many requests from this network. Wait a moment and try again.',
      },
      429,
    )
  }
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
app.route('/v1', authRoutes)
app.route('/v1', inventoryRoutes)
app.route('/v1', practiceRoutes)
app.route('/v1', attemptRoutes)
app.route('/v1', reportRoutes)
app.route('/v1', learningRoutes)
app.route('/v1', progressRoutes)
app.route('/v1', maintenanceRoutes)

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
