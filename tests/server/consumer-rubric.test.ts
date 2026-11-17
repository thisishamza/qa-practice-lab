// Consumer rubric tests (Phase 7, plan §12.1.3) — C1–C7 each pass/fail,
// the canonical failure modes (empty, full clone, wrong critical type,
// closed schema) and the 70-point pass gate.

import { describe, expect, it } from 'vitest'
import {
  CONSUMER_RUBRIC_PASS_SCORE,
  scoreConsumerExpectation,
} from '../../src/server/consumerRubric'

const CRITICAL_FIVE = ['slug', 'name', 'priceCents', 'currency', 'stockStatus'] as const

const WORKED_EXAMPLE = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: [...CRITICAL_FIVE],
  properties: {
    slug: { type: 'string' },
    name: { type: 'string' },
    priceCents: { type: 'integer', minimum: 0 },
    currency: { const: 'USD' },
    stockStatus: { enum: ['in_stock', 'low_stock', 'out_of_stock'] },
  },
} as const

const emptyScore = scoreConsumerExpectation({}).score
const fullCloneScore = scoreConsumerExpectation({
  type: 'object',
  required: ['id', ...CRITICAL_FIVE, 'description', 'categorySlug', 'categoryName'],
  properties: {
    id: { type: 'integer' },
    slug: { type: 'string' },
    name: { type: 'string' },
    priceCents: { type: 'integer' },
    currency: { const: 'USD' },
    stockStatus: { enum: ['in_stock', 'low_stock', 'out_of_stock'] },
    description: { type: 'string' },
    categorySlug: { type: 'string' },
    categoryName: { type: 'string' },
  },
}).score

describe('reference answer', () => {
  it('scores 100 and passes', () => {
    const result = scoreConsumerExpectation(WORKED_EXAMPLE)
    expect(result.score).toBe(100)
    expect(result.passed).toBe(true)
    expect(result.checks.every((check) => check.points === check.maxPoints)).toBe(true)
  })
})

describe('C1 — expectation parses and compiles', () => {
  it('valid expectation compiles', () => {
    expect(scoreConsumerExpectation(WORKED_EXAMPLE).checks.find((c) => c.id === 'C1')?.passed).toBe(true)
  })
  it('nonsense schema fails C1 and nothing is credited', () => {
    const result = scoreConsumerExpectation({ type: 'object', properties: { x: { $ref: 'https://evil.example.com/x.json' } } })
    expect(result.checks.find((c) => c.id === 'C1')?.passed).toBe(false)
    expect(result.score).toBe(0)
    expect(result.passed).toBe(false)
  })
  it('non-object expectations fail C1', () => {
    expect(scoreConsumerExpectation('not a schema').checks.find((c) => c.id === 'C1')?.passed).toBe(false)
    expect(scoreConsumerExpectation(null).checks.find((c) => c.id === 'C1')?.passed).toBe(false)
  })
})

describe('C2 — requires every consumer-critical field', () => {
  it('missing one critical requirement deducts 5', () => {
    const expectation = {
      ...structuredClone(WORKED_EXAMPLE),
      required: structuredClone(WORKED_EXAMPLE).required.slice(1),
    }
    const c2 = scoreConsumerExpectation(expectation).checks.find((c) => c.id === 'C2')
    expect(c2?.points).toBe(20)
    expect(c2?.passed).toBe(false)
  })
  it('empty expectation fails C2 and the overall gate', () => {
    const result = scoreConsumerExpectation({})
    expect(result.checks.find((c) => c.id === 'C2')?.points).toBe(0)
    expect(result.score).toBeLessThan(CONSUMER_RUBRIC_PASS_SCORE)
  })
})

describe('C3 — minimalism', () => {
  it('requiring one extra non-critical field deducts and is recorded', () => {
    const expectation = {
      ...structuredClone(WORKED_EXAMPLE),
      required: [...structuredClone(WORKED_EXAMPLE).required, 'description'],
    }
    const c3 = scoreConsumerExpectation(expectation).checks.find((c) => c.id === 'C3')
    expect(c3?.passed).toBe(false)
    expect(c3?.points).toBe(10)
  })
  it('the full provider clone is rejected (score < 70)', () => {
    expect(fullCloneScore).toBeLessThan(CONSUMER_RUBRIC_PASS_SCORE)
  })
})

describe('C4 — critical field types match', () => {
  it('priceCents as string fails C4', () => {
    const expectation = structuredClone(WORKED_EXAMPLE)
    ;(expectation.properties.priceCents as Record<string, unknown>).type = 'string'
    const c4 = scoreConsumerExpectation(expectation).checks.find((c) => c.id === 'C4')
    expect(c4?.passed).toBe(false)
  })
  it('currency const must be USD', () => {
    const expectation = structuredClone(WORKED_EXAMPLE)
    ;(expectation.properties.currency as Record<string, unknown>).const = 'EUR'
    const c4 = scoreConsumerExpectation(expectation).checks.find((c) => c.id === 'C4')
    expect(c4?.passed).toBe(false)
  })
  it('stockStatus enum vocabulary must be a subset of the provider’s', () => {
    const expectation = structuredClone(WORKED_EXAMPLE)
    ;(expectation.properties.stockStatus as Record<string, unknown>).enum = ['in_stock', 'discontinued']
    const c4 = scoreConsumerExpectation(expectation).checks.find((c) => c.id === 'C4')
    expect(c4?.passed).toBe(false)
  })
})

describe('C5 — open contract', () => {
  it('additionalProperties: false is rejected (score < 70)', () => {
    const expectation = { ...WORKED_EXAMPLE, additionalProperties: false as const }
    const result = scoreConsumerExpectation(expectation)
    expect(result.checks.find((c) => c.id === 'C5')?.passed).toBe(false)
    expect(result.score).toBeLessThan(CONSUMER_RUBRIC_PASS_SCORE)
  })
  it('additionalProperties: true passes C5', () => {
    expect(scoreConsumerExpectation({ ...WORKED_EXAMPLE, additionalProperties: true }).checks.find((c) => c.id === 'C5')?.passed).toBe(true)
  })
})

describe('C6/C7 — payload discrimination', () => {
  it('the expectation passes the provider v1 canned payload', () => {
    expect(scoreConsumerExpectation(WORKED_EXAMPLE).checks.find((c) => c.id === 'C6')?.passed).toBe(true)
  })
  it('the expectation fails the drifted payload', () => {
    expect(scoreConsumerExpectation(WORKED_EXAMPLE).checks.find((c) => c.id === 'C7')?.passed).toBe(true)
  })
  it('a vacuous expectation ({}) cannot pass the gate', () => {
    expect(emptyScore).toBeLessThan(CONSUMER_RUBRIC_PASS_SCORE)
    expect(scoreConsumerExpectation({}).checks.find((c) => c.id === 'C7')?.passed).toBe(false)
  })
})

describe('the 70-point pass gate', () => {
  it('rejects a partial-critical expectation that falls below 70', () => {
    const expectation = { type: 'object', required: ['slug', 'name'], properties: { slug: { type: 'string' }, name: { type: 'string' } } }
    expect(scoreConsumerExpectation(expectation).score).toBeLessThan(CONSUMER_RUBRIC_PASS_SCORE)
    expect(scoreConsumerExpectation(expectation).passed).toBe(false)
  })
})
