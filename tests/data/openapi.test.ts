// Contract test for public/openapi.json (P5-M1).
//
// The OpenAPI document is the machine-checkable description of the /api/v1
// surface. This suite pins: the document's shape, full route coverage in
// both directions (spec ↔ curated registry ↔ server source), local $ref
// integrity, the documented error-code vocabulary, and a leak lint proving
// no internal identifiers or evaluator internals reach the document.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DEFECTS } from '../../src/server/defects'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

interface OpenApiOperation {
  operationId?: string
  summary?: string
  description?: string
  responses: Record<string, unknown>
  [key: string]: unknown
}
interface OpenApiDocument {
  openapi: string
  info: { title: string; version: string; description: string }
  servers: Array<{ url: string }>
  tags: Array<{ name: string }>
  paths: Record<string, Record<string, OpenApiOperation>>
  components: {
    schemas: Record<string, unknown>
    responses: Record<string, unknown>
    securitySchemes: Record<string, unknown>
  }
}

const spec = JSON.parse(
  readFileSync(join(repoRoot, 'public', 'openapi.json'), 'utf8'),
) as OpenApiDocument

/** The curated registry of every /api/v1 operation the server implements. */
const EXPECTED_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['get', '/api/v1/products'],
  ['get', '/api/v1/products/{slug}'],
  ['get', '/api/v1/categories'],
  ['get', '/api/v1/cart'],
  ['delete', '/api/v1/cart'],
  ['post', '/api/v1/cart/items'],
  ['patch', '/api/v1/cart/items/{id}'],
  ['delete', '/api/v1/cart/items/{id}'],
  ['get', '/api/v1/checkout'],
  ['post', '/api/v1/checkout'],
  ['get', '/api/v1/orders'],
  ['get', '/api/v1/orders/{reference}'],
  ['post', '/api/v1/orders/{reference}/cancel'],
  ['get', '/api/v1/auth/accounts'],
  ['post', '/api/v1/auth/login'],
  ['post', '/api/v1/auth/token'],
  ['post', '/api/v1/auth/logout'],
  ['get', '/api/v1/auth/me'],
  ['get', '/api/v1/account'],
  ['get', '/api/v1/account/orders'],
  ['get', '/api/v1/account/orders/{reference}'],
  ['get', '/api/v1/admin/inventory'],
  ['patch', '/api/v1/admin/inventory/{productId}'],
  ['get', '/api/v1/practice/hunts'],
  ['get', '/api/v1/practice/session'],
  ['post', '/api/v1/practice/hunts/{huntId}/start'],
  ['post', '/api/v1/practice/session/reset'],
  ['get', '/api/v1/practice/hunts/{huntId}/attempt'],
  ['get', '/api/v1/practice/attempts'],
  ['post', '/api/v1/practice/hunts/{huntId}/report'],
  ['post', '/api/v1/practice/hunts/{huntId}/hints'],
  ['get', '/api/v1/practice/hunts/{huntId}/reveal'],
  ['post', '/api/v1/practice/hunts/{huntId}/reveal'],
  ['get', '/api/v1/practice/progress'],
  ['post', '/api/v1/admin/maintenance/sweep'],
]

const HTTP_METHODS = new Set(['get', 'post', 'patch', 'put', 'delete'])

function serverSource(): string {
  const dir = join(repoRoot, 'src', 'server')
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n')
}

/** Convert an OpenAPI path (`{param}`) to the server-source form (`:param`). */
function toSourcePath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ':$1')
}

function toSourceRoute(path: string): string {
  return toSourcePath(path).replace(/^\/api\/v1/, '')
}

function* walk(node: unknown): Generator<unknown> {
  if (Array.isArray(node)) {
    for (const item of node) {
      yield* walk(item)
    }
    return
  }
  if (node && typeof node === 'object') {
    yield node
    for (const value of Object.values(node)) {
      yield* walk(value)
    }
  }
}

describe('openapi.json — document shape', () => {
  it('is OpenAPI 3.1.x with info, same-origin server and the documented tags', () => {
    expect(spec.openapi).toMatch(/^3\.1\./)
    expect(spec.info.title).toContain('QA Practice Lab')
    expect(spec.info.version).toBeTruthy()
    expect(spec.servers).toEqual([{ url: '/', description: expect.any(String) }])
    const tags = spec.tags.map((tag) => tag.name).sort()
    expect(tags).toEqual(
      ['account', 'admin', 'auth', 'cart', 'catalogue', 'checkout', 'orders', 'practice'].sort(),
    )
  })

  it('describes the global no-store rule and the envelope in info.description', () => {
    expect(spec.info.description).toContain('Cache-Control: no-store')
    expect(spec.info.description).toContain('{ "error": string, "message": string }')
  })
})

describe('openapi.json — route coverage', () => {
  it('documents exactly the curated set of 35 operations', () => {
    const documented: string[] = []
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const method of Object.keys(item)) {
        if (HTTP_METHODS.has(method)) {
          documented.push(`${method} ${path}`)
        }
      }
    }
    expect(documented.sort()).toEqual(EXPECTED_ROUTES.map(([m, p]) => `${m} ${p}`).sort())
    expect(documented).toHaveLength(35)
  })

  it('every documented operation is registered in the server source', () => {
    const source = serverSource()
    for (const [method, path] of EXPECTED_ROUTES) {
      const registered = `.${method}('${toSourceRoute(path)}'`
      expect(
        source.includes(registered),
        `${method.toUpperCase()} ${path} (${registered}) is not registered in src/server`,
      ).toBe(true)
    }
  })

  it('every server /v1 route registration is documented', () => {
    const source = serverSource()
    const routePattern = /\.(get|post|patch|put|delete)\('(\/[^']*)'/g
    const documented = new Set(EXPECTED_ROUTES.map(([m, p]) => `${m} ${toSourceRoute(p)}`))
    for (const match of source.matchAll(routePattern)) {
      const [, method, route] = match
      // app.ts registers GET /health under /api (infrastructure, not the
      // versioned practice API); everything else mounts at /api/v1.
      if (route === '/health') {
        continue
      }
      if (!documented.has(`${method} ${route}`)) {
        throw new Error(`Undocumented server route: ${method.toUpperCase()} ${route}`)
      }
    }
  })
})

describe('openapi.json — operation hygiene', () => {
  it('gives every operation an id, a summary, a description and responses', () => {
    const ids = new Set<string>()
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(item)) {
        if (!HTTP_METHODS.has(method)) {
          continue
        }
        expect(operation.operationId, `${method} ${path} operationId`).toBeTruthy()
        expect(ids.has(operation.operationId as string)).toBe(false)
        ids.add(operation.operationId as string)
        expect(operation.summary).toBeTruthy()
        expect(operation.description).toBeTruthy()
        const codes = Object.keys(operation.responses)
        expect(
          codes.some((code) => code.startsWith('2')),
          `${method} ${path} has no 2xx response`,
        ).toBe(true)
      }
    }
  })

  it('resolves every local $ref to a defined component', () => {
    for (const node of walk(spec)) {
      if (
        node &&
        typeof node === 'object' &&
        typeof (node as { $ref?: unknown }).$ref === 'string'
      ) {
        const ref = (node as { $ref: string }).$ref
        const match = /^#\/components\/(schemas|responses|securitySchemes)\/(.+)$/.exec(ref)
        expect(match, `unsupported ref ${ref}`).not.toBeNull()
        const [, section, name] = match as RegExpExecArray
        expect(
          name in spec.components[section as keyof OpenApiDocument['components']],
          `unresolved ref ${ref}`,
        ).toBe(true)
      }
    }
  })
})

describe('openapi.json — leak lint', () => {
  const blob = JSON.stringify(spec)
  const lower = blob.toLowerCase()

  it('contains no internal exercise identifiers', () => {
    for (const defect of DEFECTS) {
      expect(blob).not.toContain(defect.id)
      expect(blob).not.toContain(defect.title)
      expect(lower).not.toContain(defect.fix.toLowerCase())
    }
  })

  it('contains no defect vocabulary at all', () => {
    expect(lower).not.toContain('defect')
    for (const token of ['hunt-authn', 'hunt-rbac', 'hunt-mass', 'finding_check', 'findingcheck']) {
      expect(lower).not.toContain(token)
    }
  })

  it('contains no evaluator internals or hint/reveal content markers', () => {
    for (const token of ['hint_mask', 'best_quality_score', 'quality_score', 'reveal_locked_content']) {
      expect(lower).not.toContain(token)
    }
  })

  it('does not claim which sessions carry hunts', () => {
    expect(lower).not.toContain('bug-hunt session')
    expect(lower).not.toContain('bug_hunt session')
  })
})

describe('openapi.json — error-code vocabulary', () => {
  const enumCodes = (spec.components.schemas.ErrorCode as { enum: string[] }).enum

  it('documents a non-empty ErrorCode enum', () => {
    expect(enumCodes.length).toBeGreaterThanOrEqual(20)
    expect(new Set(enumCodes).size).toBe(enumCodes.length)
  })

  it('every documented error code appears literally in the server source', () => {
    const source = serverSource()
    for (const code of enumCodes) {
      expect(source.includes(`'${code}'`), `error code ${code} is not used by the server`).toBe(true)
    }
  })

  it('every error code the server emits is documented', () => {
    const source = serverSource()
    const observed = new Set<string>()
    for (const match of source.matchAll(/'((?:invalid_request|invalid_level|invalid_credentials|not_found|internal_error|payload_too_large|rate_limited|login_rate_limited|account_suspended|unauthorized|staff_required|out_of_stock|insufficient_stock|stock_limit_exceeded|empty_cart|cart_unavailable|payment_declined|idempotency_conflict|hunt_not_found|hunt_start_cap_reached|session_required|hint_level_locked|hint_attempt_completed|reveal_locked|token_expired))'/g)) {
      observed.add(match[1])
    }
    for (const code of observed) {
      expect(enumCodes, `server error code ${code} is not documented`).toContain(code)
    }
  })
})
