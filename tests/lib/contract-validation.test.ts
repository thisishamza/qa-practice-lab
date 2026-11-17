// Wrapper tests (Phase 7, plan §12.1.1) — the shared validation boundary.
// Every keyword class × pass/fail, dialect selection, $ref handling,
// complexity budgets and deterministic ordering. Browser and server share
// this exact code path (src/shared/contractValidation.ts), so this suite is
// the parity gate for both planes.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  assertPayloadBudget,
  compileSchema,
  normalizeSchema,
  validatePayload,
  validatePayloadDetailed,
  ContractValidationError,
  CONTRACT_MAX_SCHEMA_NODES,
} from '../../src/shared/contractValidation'

const SCHEMA_2020 = { $schema: 'https://json-schema.org/draft/2020-12/schema' } as const

function schema(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...SCHEMA_2020, type: 'object', ...overrides }
}

describe('compileSchema — dialect and compile-time guards', () => {
  it('compiles a 2020-12 schema without $schema by stamping the dialect', () => {
    const compiled = compileSchema({ type: 'object', properties: { n: { type: 'integer' } } })
    expect(compiled.normalized.$schema).toBe(SCHEMA_2020.$schema)
    expect(compiled.validate({ n: 1 }).valid).toBe(true)
    expect(compiled.validate({ n: 'one' }).valid).toBe(false)
  })

  it('collects ALL errors (shortCircuit disabled), not just the first', () => {
    const bad = validatePayload(
      schema({ required: ['a', 'b', 'c'] }),
      {},
    )
    const requiredFailures = bad.filter((assertion) => assertion.keyword === 'required')
    expect(requiredFailures.length).toBe(3)
  })

  it('rejects unevaluatedProperties explicitly as unsupported', () => {
    expect(() => compileSchema(schema({ unevaluatedProperties: false }))).toThrow(ContractValidationError)
    expect(() => compileSchema(schema({ unevaluatedItems: false }))).toThrow(ContractValidationError)
  })

  it('rejects remote $ref at parse time with invalid_schema', () => {
    expect(() =>
      compileSchema(schema({ properties: { x: { $ref: 'https://evil.example.com/schema.json' } } })),
    ).toThrow(ContractValidationError)
    expect(() =>
      compileSchema(schema({ properties: { x: { $ref: 'http://evil.example.com/schema.json' } } })),
    ).toThrow(ContractValidationError)
    expect(() =>
      compileSchema(schema({ properties: { x: { $ref: 'other-file.json#/x' } } })),
    ).toThrow(ContractValidationError)
  })

  it('rejects cyclic $ref at resolution time', () => {
    const cyclic = {
      ...SCHEMA_2020,
      type: 'object',
      properties: { child: { $ref: '#' } },
    }
    expect(() => compileSchema(cyclic)).toThrow(ContractValidationError)
  })

  it('rejects $ref chains deeper than 32 hops', () => {
    // A chain of 33 distinct refs: a → b → c → ... → never resolves cleanly.
    const names = Array.from({ length: 40 }, (_, index) => `level-${index}`)
    const components: Record<string, unknown> = {}
    names.forEach((name, index) => {
      components[name] = index === names.length - 1
        ? { type: 'string' }
        : { $ref: `#/components/schemas/${names[index + 1]}` }
    })
    expect(() =>
      compileSchema({ ...SCHEMA_2020, components: { schemas: components }, $ref: '#/components/schemas/level-0' }),
    ).toThrow(ContractValidationError)
  })

  it('rejects payloads over the node budget', () => {
    expect(() => assertPayloadBudget({ deep: { deeper: Array.from({ length: 5001 }, () => 1) } })).toThrow(
      ContractValidationError,
    )
  })

  it('rejects payloads nested beyond the depth budget', () => {
    let nested: unknown = 'leaf'
    for (let index = 0; index < 40; index += 1) {
      nested = { next: nested }
    }
    expect(() => assertPayloadBudget(nested)).toThrow(ContractValidationError)
  })

  it('rejects schemas deeper than 16 levels', () => {
    let nested: Record<string, unknown> = { type: 'string' }
    for (let index = 0; index < 20; index += 1) {
      nested = { type: 'object', properties: { child: nested } }
    }
    expect(() => compileSchema(nested)).toThrow(ContractValidationError)
  })

  it('rejects patterns longer than 256 characters', () => {
    expect(() =>
      compileSchema(schema({ properties: { x: { type: 'string', pattern: 'a'.repeat(257) } } })),
    ).toThrow(ContractValidationError)
  })
})

describe('validatePayload — keyword matrix', () => {
  const cases: Array<{
    label: string
    schema: Record<string, unknown>
    payload: unknown
    expectPaths: string[]
    expectKeywords: string[]
  }> = [
    { label: 'type integer ok', schema: { ...SCHEMA_2020, type: 'object', properties: { n: { type: 'integer' } } }, payload: { n: 3 }, expectPaths: [], expectKeywords: [] },
    { label: 'type integer given string', schema: { ...SCHEMA_2020, type: 'object', properties: { n: { type: 'integer' } } }, payload: { n: '3' }, expectPaths: ['/n'], expectKeywords: ['type'] },
    { label: 'type string given number', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: 'string' } } }, payload: { s: 3 }, expectPaths: ['/s'], expectKeywords: ['type'] },
    { label: 'type number given non-number', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: 'number' } } }, payload: { s: '3' }, expectPaths: ['/s'], expectKeywords: ['type'] },
    { label: 'type boolean given string', schema: { ...SCHEMA_2020, type: 'object', properties: { b: { type: 'boolean' } } }, payload: { b: 'true' }, expectPaths: ['/b'], expectKeywords: ['type'] },
    { label: 'type null ok', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: 'null' } } }, payload: { s: null }, expectPaths: [], expectKeywords: [] },
    { label: 'type array ok', schema: { ...SCHEMA_2020, type: 'object', properties: { a: { type: 'array' } } }, payload: { a: [1] }, expectPaths: [], expectKeywords: [] },
    { label: 'type union with null member', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: ['string', 'null'] } } }, payload: { s: null }, expectPaths: [], expectKeywords: [] },
    { label: 'type union rejects other kinds', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: ['string', 'null'] } } }, payload: { s: 42 }, expectPaths: ['/s'], expectKeywords: ['type'] },
    { label: 'string items type mismatch', schema: { ...SCHEMA_2020, type: 'object', properties: { a: { type: 'array', items: { type: 'integer' } } } }, payload: { a: [1, 'two'] }, expectPaths: ['/a/1'], expectKeywords: ['type'] },
    { label: 'required present ok', schema: { ...SCHEMA_2020, type: 'object', required: ['x'] }, payload: { x: 1 }, expectPaths: [], expectKeywords: [] },
    { label: 'required missing', schema: { ...SCHEMA_2020, type: 'object', required: ['x'] }, payload: {}, expectPaths: ['/x'], expectKeywords: ['required'] },
    { label: 'additionalProperties absent allows extras', schema: { ...SCHEMA_2020, type: 'object', properties: { x: { type: 'integer' } } }, payload: { x: 1, extra: true }, expectPaths: [], expectKeywords: [] },
    { label: 'additionalProperties false rejects extras', schema: { ...SCHEMA_2020, type: 'object', properties: { x: { type: 'integer' } }, additionalProperties: false }, payload: { x: 1, extra: true }, expectPaths: ['/extra'], expectKeywords: ['additionalProperties'] },
    { label: 'additionalProperties true allows extras', schema: { ...SCHEMA_2020, type: 'object', properties: { x: { type: 'integer' } }, additionalProperties: true }, payload: { x: 1, extra: true }, expectPaths: [], expectKeywords: [] },
    { label: 'minimum respected', schema: { ...SCHEMA_2020, type: 'object', properties: { n: { type: 'integer', minimum: 1 } } }, payload: { n: 0 }, expectPaths: ['/n'], expectKeywords: ['minimum'] },
    { label: 'minimum ok at boundary', schema: { ...SCHEMA_2020, type: 'object', properties: { n: { type: 'integer', minimum: 1 } } }, payload: { n: 1 }, expectPaths: [], expectKeywords: [] },
    { label: 'maximum respected', schema: { ...SCHEMA_2020, type: 'object', properties: { n: { type: 'integer', maximum: 10 } } }, payload: { n: 11 }, expectPaths: ['/n'], expectKeywords: ['maximum'] },
    { label: 'exclusiveMinimum 2020-12 numeric', schema: { ...SCHEMA_2020, type: 'object', properties: { n: { type: 'integer', exclusiveMinimum: 1 } } }, payload: { n: 1 }, expectPaths: ['/n'], expectKeywords: ['exclusiveMinimum'] },
    { label: 'exclusiveMaximum 2020-12 numeric', schema: { ...SCHEMA_2020, type: 'object', properties: { n: { type: 'integer', exclusiveMaximum: 10 } } }, payload: { n: 10 }, expectPaths: ['/n'], expectKeywords: ['exclusiveMaximum'] },
    { label: 'minLength', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: 'string', minLength: 3 } } }, payload: { s: 'ab' }, expectPaths: ['/s'], expectKeywords: ['minLength'] },
    { label: 'maxLength', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: 'string', maxLength: 3 } } }, payload: { s: 'abcd' }, expectPaths: ['/s'], expectKeywords: ['maxLength'] },
    { label: 'minItems', schema: { ...SCHEMA_2020, type: 'object', properties: { a: { type: 'array', minItems: 2 } } }, payload: { a: [1] }, expectPaths: ['/a'], expectKeywords: ['minItems'] },
    { label: 'maxItems', schema: { ...SCHEMA_2020, type: 'object', properties: { a: { type: 'array', maxItems: 2 } } }, payload: { a: [1, 2, 3] }, expectPaths: ['/a'], expectKeywords: ['maxItems'] },
    { label: 'enum hit', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { enum: ['a', 'b'] } } }, payload: { s: 'b' }, expectPaths: [], expectKeywords: [] },
    { label: 'enum miss', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { enum: ['a', 'b'] } } }, payload: { s: 'c' }, expectPaths: ['/s'], expectKeywords: ['enum'] },
    { label: 'const hit', schema: { ...SCHEMA_2020, type: 'object', properties: { c: { const: 'USD' } } }, payload: { c: 'USD' }, expectPaths: [], expectKeywords: [] },
    { label: 'const miss', schema: { ...SCHEMA_2020, type: 'object', properties: { c: { const: 'USD' } } }, payload: { c: 'usd' }, expectPaths: ['/c'], expectKeywords: ['const'] },
    { label: 'pattern hit', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: 'string', pattern: '^LE-[0-9A-Z]{8}$' } } }, payload: { s: 'LE-0A1B2C3D' }, expectPaths: [], expectKeywords: [] },
    { label: 'pattern miss', schema: { ...SCHEMA_2020, type: 'object', properties: { s: { type: 'string', pattern: '^LE-[0-9A-Z]{8}$' } } }, payload: { s: 'nope' }, expectPaths: ['/s'], expectKeywords: ['pattern'] },
    { label: 'format email ok', schema: { ...SCHEMA_2020, type: 'object', properties: { e: { type: 'string', format: 'email' } } }, payload: { e: 'a@b.co' }, expectPaths: [], expectKeywords: [] },
    { label: 'format email reject', schema: { ...SCHEMA_2020, type: 'object', properties: { e: { type: 'string', format: 'email' } } }, payload: { e: 'nope' }, expectPaths: ['/e'], expectKeywords: ['format'] },
    { label: 'format date-time ok', schema: { ...SCHEMA_2020, type: 'object', properties: { t: { type: 'string', format: 'date-time' } } }, payload: { t: '2026-11-16T00:00:00Z' }, expectPaths: [], expectKeywords: [] },
    { label: 'format date-time reject', schema: { ...SCHEMA_2020, type: 'object', properties: { t: { type: 'string', format: 'date-time' } } }, payload: { t: '16 November 2026' }, expectPaths: ['/t'], expectKeywords: ['format'] },
    { label: 'nested object ok', schema: { ...SCHEMA_2020, type: 'object', properties: { o: { type: 'object', properties: { n: { type: 'integer', minimum: 1 } }, required: ['n'], additionalProperties: false } } }, payload: { o: { n: 3 } }, expectPaths: [], expectKeywords: [] },
    { label: 'nested object failure path', schema: { ...SCHEMA_2020, type: 'object', properties: { o: { type: 'object', properties: { n: { type: 'integer', minimum: 1 } }, required: ['n'], additionalProperties: false } } }, payload: { o: { n: 0 } }, expectPaths: ['/o/n'], expectKeywords: ['minimum'] },
  ]

  for (const testCase of cases) {
    it(testCase.label, () => {
      const assertions = validatePayload(testCase.schema, testCase.payload)
      expect(assertions.map((assertion) => assertion.path)).toEqual(testCase.expectPaths)
      expect(assertions.map((assertion) => assertion.keyword)).toEqual(testCase.expectKeywords)
    })
  }

  it('assertion shape is the documented five-field contract', () => {
    const [assertion] = validatePayload(
      schema({ properties: { n: { type: 'integer' } } }),
      { n: 'one' },
    )
    expect(typeof assertion.path).toBe('string')
    expect(typeof assertion.keyword).toBe('string')
    expect(typeof assertion.expected).toBe('string')
    expect(typeof assertion.actual).toBe('string')
    expect(typeof assertion.message).toBe('string')
  })
})

describe('normalized schema determinism', () => {
  it('normalizeSchema yields byte-stable output for identical input', () => {
    const a = JSON.stringify(normalizeSchema({ type: 'object', properties: { b: { type: 'string' }, a: { type: 'integer' } } }))
    const b = JSON.stringify(normalizeSchema({ type: 'object', properties: { b: { type: 'string' }, a: { type: 'integer' } } }))
    expect(a).toBe(b)
  })

  it('resolvers follow local $refs transitively', () => {
    const doc = {
      ...SCHEMA_2020,
      components: {
        schemas: {
          A: { type: 'object', properties: { target: { $ref: '#/components/schemas/B' } } },
          B: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
        },
      },
      $ref: '#/components/schemas/A',
    }
    const assertions = validatePayload(doc, { target: {} })
    expect(assertions.some((assertion) => assertion.keyword === 'required')).toBe(true)
  })

  it('validatePayloadDetailed agrees with validatePayload', () => {
    const a = validatePayload(schema({ required: ['x'] }), {})
    const b = validatePayloadDetailed(schema({ required: ['x'] }), {})
    expect(b.valid).toBe(false)
    expect(b.assertions).toEqual(a)
  })
})

describe('Finding 6 — prototype keys and inherited members fail safely', () => {
  it('a properties.__proto__ key is rejected at preflight with a deterministic error', () => {
    // JSON.parse keeps own __proto__ keys — simulate exactly that path.
    const malicious = JSON.parse('{"type":"object","properties":{"__proto__":{"type":"string"},"a":{"type":"string"}}}')
    expect(() => compileSchema(malicious)).toThrow(ContractValidationError)
    expect(() => compileSchema(malicious)).toThrowError(/__proto__/)
  })

  it('nested __proto__ keys anywhere in the schema are rejected', () => {
    const nested = JSON.parse('{"type":"object","properties":{"a":{"type":"object","properties":{"__proto__":{"const":1}}}}}')
    expect(() => compileSchema(nested)).toThrow(ContractValidationError)
  })

  it('supplied x-ref-source markers cannot be injected by learner schemas', () => {
    const forged = JSON.parse('{"type":"object","x-ref-source":"#/definitions/forged"}')
    expect(() => compileSchema(forged)).toThrow(ContractValidationError)
  })

  it('$ref to #/constructor is rejected, not resolved to an inherited member', () => {
    expect(() => compileSchema({ properties: { a: { $ref: '#/constructor' } } })).toThrow(ContractValidationError)
  })

  it('$ref to #/__proto__ is rejected', () => {
    expect(() => compileSchema({ properties: { a: { $ref: '#/__proto__' } } })).toThrow(ContractValidationError)
  })

  it('$ref to #/__proto__/constructor is rejected', () => {
    expect(() => compileSchema({ properties: { a: { $ref: '#/__proto__/constructor' } } })).toThrow(ContractValidationError)
  })

  it('$ref to #/prototype is rejected', () => {
    expect(() => compileSchema({ properties: { a: { $ref: '#/prototype' } } })).toThrow(ContractValidationError)
  })

  it('array indices in refs resolve to own indices only', () => {
    const schema = {
      type: 'object',
      properties: {
        items: { type: 'array', items: [{ type: 'string' }, { type: 'integer' }] },
        x: { $ref: '#/properties/items/items/1' },
      },
    }
    expect(() => compileSchema(schema)).not.toThrow()
    expect(() =>
      compileSchema({ ...schema, properties: { ...schema.properties, x: { $ref: '#/properties/items/items/length' } } }),
    ).toThrow(ContractValidationError)
    expect(() =>
      compileSchema({ ...schema, properties: { ...schema.properties, x: { $ref: '#/properties/items/items/-1' } } }),
    ).toThrow(ContractValidationError)
  })

  it('an own property legitimately named "constructor" works end to end', () => {
    const schema = {
      type: 'object',
      properties: {
        constructor: { type: 'string' },
      },
      required: ['constructor'],
    }
    const compiled = compileSchema(schema)
    expect(compiled.validate({ constructor: 'x' }).valid).toBe(true)
    expect(compiled.validate({}).valid).toBe(false)
    // And a $ref to that own property resolves.
    const named = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        constructor: { type: 'string', minLength: 2 },
        refTarget: { $ref: '#/properties/constructor' },
      },
    }
    expect(() => compileSchema(named)).not.toThrow()
  })

  it('an own property legitimately named "prototype" works end to end', () => {
    const schema = { type: 'object', properties: { prototype: { type: 'integer' } } }
    expect(compileSchema(schema).validate({ prototype: 1 }).valid).toBe(true)
  })

  it('the normalized document carries no function values after dereferencing', () => {
    const compiled = compileSchema({ properties: { a: { $ref: '#/definitions/shared' } }, definitions: { shared: { type: 'object', properties: { ok: { const: 'yes' } } } } })
    const walk = (node: unknown): void => {
      expect(typeof node).not.toBe('function')
      if (Array.isArray(node)) {
        node.forEach(walk)
      } else if (node && typeof node === 'object') {
        Object.values(node).forEach(walk)
      }
    }
    walk(compiled.normalized)
  })
})

describe('Finding 8 — the served first-party contract validates end to end', () => {
  const openapiPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'openapi.json')
  const doc = JSON.parse(readFileSync(openapiPath, 'utf8')) as Record<string, unknown>

  it('the live document exceeds the learner budget (why internalDocument exists)', () => {
    const count = (node: unknown): number => {
      let c = 1
      if (Array.isArray(node)) {
        for (const item of node) c += count(item)
      } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) c += count(value)
      }
      return c
    }
    expect(count(doc)).toBeGreaterThan(CONTRACT_MAX_SCHEMA_NODES)
  })

  it('rejects the live document under default learner budgets with complexity_limit', () => {
    expect(() =>
      compileSchema({ ...doc, $ref: '#/components/schemas/Product' }),
    ).toThrow(ContractValidationError)
    expect(() =>
      compileSchema({ ...doc, $ref: '#/components/schemas/Product' }),
    ).toThrow(/complexity_limit|budget/i)
  })

  it('validates a live Product payload against the live document with internalDocument', () => {
    const payload = {
      id: 1,
      slug: 'ridgeline-2-person-tent',
      name: 'Ridgeline 2-Person Tent',
      description: 'A three-season dome tent with a vestibule and a full-coverage rainfly.',
      categorySlug: 'camping',
      categoryName: 'Camping',
      priceCents: 34900,
      currency: 'USD',
      stockStatus: 'in_stock',
    }
    const compiled = compileSchema({ ...doc, $ref: '#/components/schemas/Product' }, { internalDocument: true })
    const result = compiled.validate(payload)
    expect(result.valid).toBe(true)
    const broken = { ...payload, priceCents: 'not-a-number' as unknown as number }
    expect(compiled.validate(broken).valid).toBe(false)
  })

  it('validatePayload accepts options and passes them through', () => {
    const payload = {
      id: 1,
      slug: 'ridgeline-2-person-tent',
      name: 'Ridgeline 2-Person Tent',
      description: 'desc',
      categorySlug: 'camping',
      categoryName: 'Camping',
      priceCents: 34900,
      currency: 'USD',
      stockStatus: 'in_stock',
    }
    expect(() => validatePayload({ ...doc, $ref: '#/components/schemas/Product' }, payload)).toThrow(ContractValidationError)
    expect(validatePayload({ ...doc, $ref: '#/components/schemas/Product' }, payload, { internalDocument: true })).toEqual([])
  })
})
