// Wrapper tests (Phase 7, plan §12.1.1) — the shared validation boundary.
// Every keyword class × pass/fail, dialect selection, $ref handling,
// complexity budgets and deterministic ordering. Browser and server share
// this exact code path (src/shared/contractValidation.ts), so this suite is
// the parity gate for both planes.

import { describe, expect, it } from 'vitest'
import {
  assertPayloadBudget,
  compileSchema,
  normalizeSchema,
  validatePayload,
  validatePayloadDetailed,
  ContractValidationError,
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
