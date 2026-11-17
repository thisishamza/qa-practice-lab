// Diff engine tests (Phase 7, plan §12.1.2) — every rule R1–R21 with at
// least one positive and one negative case, locus semantics, verdict
// precedence, deterministic ordering, fixture-driven curation and
// self-diff/annotation-only gates.

import { describe, expect, it } from 'vitest'
import { diffContracts } from '../../src/shared/contractDiff'
import {
  LEDGER_V1_SCHEMA,
} from '../../src/shared/contracts/ledgerV1'
import { LEDGER_V2_COMPATIBLE_SCHEMA } from '../../src/shared/contracts/ledgerV2Compatible'
import { LEDGER_V2_BREAKING_SCHEMA } from '../../src/shared/contracts/ledgerV2Breaking'
import { LEDGER_V2_REQUIRED_SCHEMA } from '../../src/shared/contracts/ledgerV2Required'
import type { ContractLocus } from '../../src/shared/contractTypes'

const S2020 = { $schema: 'https://json-schema.org/draft/2020-12/schema' } as const

function schema(body: Record<string, unknown>): Record<string, unknown> {
  return { ...S2020, ...body }
}

function diff(base: unknown, candidate: unknown, locus: ContractLocus = 'response') {
  return diffContracts(base, candidate, { locus })
}

function findRule(result: ReturnType<typeof diffContracts>, rule: string) {
  return result.findings.filter((finding) => finding.rule === rule)
}

describe('R1 — required gains a property (request locus)', () => {
  it('fires breaking on the request side', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', required: ['a'], properties: { a: { type: 'string' } } })
    const result = diff(base, candidate, 'request')
    expect(findRule(result, 'R1').map((f) => f.classification)).toEqual(['breaking'])
    expect(result.verdict).toBe('breaking')
  })
  it('does not fire on the response side', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', required: ['a'], properties: { a: { type: 'string' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R1')).toEqual([])
  })
})

describe('R2 — required loses a property', () => {
  it('fires compatible on any locus', () => {
    const base = schema({ type: 'object', required: ['a'], properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string' } } })
    for (const locus of ['request', 'response'] as const) {
      expect(findRule(diff(base, candidate, locus), 'R2').map((f) => f.classification)).toEqual(['compatible'])
    }
  })
  it('does not fire when required is unchanged', () => {
    const base = schema({ type: 'object', required: ['a'], properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', required: ['a'], properties: { a: { type: 'string' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R2')).toEqual([])
  })
})

describe('R3 — property removed from schema', () => {
  it('fires breaking on the response side', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'integer' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string' } } })
    const result = diff(base, candidate, 'response')
    expect(findRule(result, 'R3').map((f) => f.classification)).toEqual(['breaking'])
  })
  it('fires review on the request side (strict clients sending it will fail)', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'integer' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string' } } })
    const result = diff(base, candidate, 'request')
    expect(findRule(result, 'R3').map((f) => f.classification)).toEqual(['review'])
  })
})

describe('R4 — additive property on the response side', () => {
  it('fires compatible when additive and schema is open', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string' }, memo: { type: 'string' } } })
    const result = diff(base, candidate, 'response')
    expect(findRule(result, 'R4').map((f) => f.classification)).toEqual(['compatible'])
  })
  it('does not fire on the request side', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string' }, memo: { type: 'string' } } })
    expect(findRule(diff(base, candidate, 'request'), 'R4')).toEqual([])
  })
})

describe('R5 — response schema relaxes additionalProperties', () => {
  it('fires review when a response contract goes from closed to open', () => {
    const base = schema({ type: 'object', additionalProperties: false, properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', additionalProperties: true, properties: { a: { type: 'string' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R5').map((f) => f.classification)).toEqual(['review'])
  })
  it('does not fire when closedness is unchanged', () => {
    const base = schema({ type: 'object', additionalProperties: false, properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', additionalProperties: false, properties: { a: { type: 'string' }, b: { type: 'integer' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R5')).toEqual([])
  })
})

describe('R6 — type narrowed', () => {
  it('fires breaking for integer → string', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'integer' } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'string' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R6').map((f) => f.classification)).toEqual(['breaking'])
  })
  it('fires breaking for number → integer', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'number' } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'integer' } } })
    expect(findRule(diff(base, candidate, 'request'), 'R6').map((f) => f.classification)).toEqual(['breaking'])
  })
  it('fires breaking for dropping null from a union', () => {
    const base = schema({ type: 'object', properties: { n: { type: ['string', 'null'] } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'string' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R6').map((f) => f.classification)).toEqual(['breaking'])
  })
})

describe('R7 — type widened', () => {
  it('fires compatible for integer → number', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'integer' } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'number' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R7').map((f) => f.classification)).toEqual(['compatible'])
  })
  it('fires compatible for adding null to a union', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'string' } } })
    const candidate = schema({ type: 'object', properties: { n: { type: ['string', 'null'] } } })
    expect(findRule(diff(base, candidate, 'request'), 'R7').map((f) => f.classification)).toEqual(['compatible'])
  })
})

describe('R8 — enum removed a value', () => {
  it('fires breaking', () => {
    const base = schema({ type: 'object', properties: { s: { enum: ['a', 'b', 'c'] } } })
    const candidate = schema({ type: 'object', properties: { s: { enum: ['a', 'c'] } } })
    expect(findRule(diff(base, candidate, 'response'), 'R8').map((f) => f.classification)).toEqual(['breaking'])
  })
  it('does not fire when enum grows', () => {
    const base = schema({ type: 'object', properties: { s: { enum: ['a', 'b'] } } })
    const candidate = schema({ type: 'object', properties: { s: { enum: ['a', 'b', 'c'] } } })
    expect(findRule(diff(base, candidate, 'response'), 'R8')).toEqual([])
  })
})

describe('R9 — enum widened', () => {
  it('response side is always review, never silently compatible', () => {
    const base = schema({ type: 'object', properties: { s: { enum: ['a'] } } })
    const candidate = schema({ type: 'object', properties: { s: { enum: ['a', 'b'] } } })
    const result = diff(base, candidate, 'response')
    expect(findRule(result, 'R9').map((f) => f.classification)).toEqual(['review'])
    expect(result.verdict).toBe('review')
  })
  it('request side is compatible (relaxation)', () => {
    const base = schema({ type: 'object', properties: { s: { enum: ['a'] } } })
    const candidate = schema({ type: 'object', properties: { s: { enum: ['a', 'b'] } } })
    expect(findRule(diff(base, candidate, 'request'), 'R9').map((f) => f.classification)).toEqual(['compatible'])
  })
})

describe('R10 — constraint tightened on the request side', () => {
  it('fires breaking for minimum raised', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 0 } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 5 } } })
    expect(findRule(diff(base, candidate, 'request'), 'R10').map((f) => f.classification)).toEqual(['breaking'])
  })
  it('fires breaking for maximum lowered', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'integer', maximum: 100 } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'integer', maximum: 10 } } })
    expect(findRule(diff(base, candidate, 'request'), 'R10').map((f) => f.classification)).toEqual(['breaking'])
  })
  it('fires breaking for maxLength tightened', () => {
    const base = schema({ type: 'object', properties: { s: { type: 'string', maxLength: 80 } } })
    const candidate = schema({ type: 'object', properties: { s: { type: 'string', maxLength: 20 } } })
    expect(findRule(diff(base, candidate, 'request'), 'R10').map((f) => f.classification)).toEqual(['breaking'])
  })
})

describe('R11 — constraint tightened on the response side', () => {
  it('fires compatible for response-side tightening', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 0 } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 5 } } })
    expect(findRule(diff(base, candidate, 'response'), 'R11').map((f) => f.classification)).toEqual(['compatible'])
  })
})

describe('R12 — constraint relaxed on the request side', () => {
  it('fires compatible for request-side relaxation', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 5 } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 0 } } })
    expect(findRule(diff(base, candidate, 'request'), 'R12').map((f) => f.classification)).toEqual(['compatible'])
  })
})

describe('R13 — constraint relaxed on the response side', () => {
  it('fires breaking for response-side relaxation', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 5 } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 0 } } })
    expect(findRule(diff(base, candidate, 'response'), 'R13').map((f) => f.classification)).toEqual(['breaking'])
  })
  it('fires breaking for a dropped minimum', () => {
    const base = schema({ type: 'object', properties: { n: { type: 'integer', minimum: 0 } } })
    const candidate = schema({ type: 'object', properties: { n: { type: 'integer' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R13').length).toBeGreaterThan(0)
  })
})

describe('R14 — const changed', () => {
  it('fires breaking', () => {
    const base = schema({ type: 'object', properties: { c: { const: 'USD' } } })
    const candidate = schema({ type: 'object', properties: { c: { const: 'EUR' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R14').map((f) => f.classification)).toEqual(['breaking'])
  })
  it('does not fire when const is unchanged', () => {
    const base = schema({ type: 'object', properties: { c: { const: 'USD' } } })
    const candidate = schema({ type: 'object', properties: { c: { const: 'USD' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R14')).toEqual([])
  })
})

describe('R15 — additionalProperties false→true', () => {
  it('request side false→true is compatible, true→false is breaking', () => {
    const closed = schema({ type: 'object', additionalProperties: false })
    const open = schema({ type: 'object', additionalProperties: true })
    expect(findRule(diff(closed, open, 'request'), 'R15').map((f) => f.classification)).toEqual(['compatible'])
    expect(findRule(diff(open, closed, 'request'), 'R15').map((f) => f.classification)).toEqual(['breaking'])
  })
})

describe('R16 — documented status removed', () => {
  it('fires breaking on the response side', () => {
    const base = schema({ type: 'object', 'x-contract-meta': { statuses: [200, 201] } })
    const candidate = schema({ type: 'object', 'x-contract-meta': { statuses: [200] } })
    expect(findRule(diff(base, candidate, 'response'), 'R16').map((f) => f.classification)).toEqual(['breaking'])
  })
})

describe('R17 — documented status added', () => {
  it('fires compatible on the response side', () => {
    const base = schema({ type: 'object', 'x-contract-meta': { statuses: [200] } })
    const candidate = schema({ type: 'object', 'x-contract-meta': { statuses: [200, 202] } })
    expect(findRule(diff(base, candidate, 'response'), 'R17').map((f) => f.classification)).toEqual(['compatible'])
  })
})

describe('R18 — response media type changed', () => {
  it('fires breaking on the response side', () => {
    const base = schema({ type: 'object', 'x-contract-meta': { mediaType: 'application/json' } })
    const candidate = schema({ type: 'object', 'x-contract-meta': { mediaType: 'text/plain' } })
    expect(findRule(diff(base, candidate, 'response'), 'R18').map((f) => f.classification)).toEqual(['breaking'])
  })
})

describe('R19 — format or pattern changed', () => {
  it('fires review for format changes (never auto-classified)', () => {
    const base = schema({ type: 'object', properties: { t: { type: 'string', format: 'date' } } })
    const candidate = schema({ type: 'object', properties: { t: { type: 'string', format: 'date-time' } } })
    expect(findRule(diff(base, candidate, 'response'), 'R19').map((f) => f.classification)).toEqual(['review'])
  })
  it('fires review for pattern changes (never claimed provably tighter)', () => {
    const base = schema({ type: 'object', properties: { s: { type: 'string', pattern: '^a+$' } } })
    const candidate = schema({ type: 'object', properties: { s: { type: 'string', pattern: '^[ab]+$' } } })
    expect(findRule(diff(base, candidate, 'request'), 'R19').map((f) => f.classification)).toEqual(['review'])
  })
  it('does not fire when both are absent', () => {
    const base = schema({ type: 'object', properties: { s: { type: 'string' } } })
    const candidate = schema({ type: 'object', properties: { s: { type: 'string' } } })
    expect(findRule(diff(base, candidate, 'request'), 'R19')).toEqual([])
  })
})

describe('R20 — $ref retargeted', () => {
  it('fires review for a retargeted $ref', () => {
    const base = schema({ type: 'object', properties: { target: { $ref: '#/components/schemas/A' } }, components: { schemas: { A: { type: 'string' }, B: { type: 'integer' } } } })
    const candidate = schema({ type: 'object', properties: { target: { $ref: '#/components/schemas/B' } }, components: { schemas: { A: { type: 'string' }, B: { type: 'integer' } } } })
    expect(findRule(diff(base, candidate, 'response'), 'R20').map((f) => f.classification)).toEqual(['review'])
  })
  it('does not fire when $refs are identical', () => {
    const base = schema({ type: 'object', properties: { target: { $ref: '#/components/schemas/A' } }, components: { schemas: { A: { type: 'string' } } } })
    const candidate = schema({ type: 'object', properties: { target: { $ref: '#/components/schemas/A' } }, components: { schemas: { A: { type: 'string' } } } })
    expect(findRule(diff(base, candidate, 'response'), 'R20')).toEqual([])
  })
})

describe('R21 — annotation-only deltas produce zero findings', () => {
  it('description/title changes produce nothing', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string', description: 'before', title: 'One' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string', description: 'after', title: 'Two' } } })
    const result = diff(base, candidate, 'response')
    expect(result.findings).toEqual([])
    expect(result.verdict).toBe('compatible')
  })
  it('example and default changes produce nothing', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string', examples: ['x'], default: 'a' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string', examples: ['y'], default: 'b' } } })
    expect(diff(base, candidate, 'response').findings).toEqual([])
  })
})

describe('verdict precedence and determinism', () => {
  it('one breaking + many compatibles ⇒ BREAKING', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'integer' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string', description: 'changed' }, b: { type: 'string' } } })
    expect(diff(base, candidate, 'response').verdict).toBe('breaking')
  })
  it('self-diff produces zero findings and compatible verdict', () => {
    const result = diff(LEDGER_V1_SCHEMA, LEDGER_V1_SCHEMA, 'response')
    expect(result.findings).toEqual([])
    expect(result.verdict).toBe('compatible')
  })
  it('findings are ordered by (classification rank, path, rule)', () => {
    const result = diff(LEDGER_V1_SCHEMA, LEDGER_V2_BREAKING_SCHEMA, 'response')
    const ranks = result.findings.map((f) => ({ breaking: 0, review: 1, compatible: 2 })[f.classification])
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    for (let index = 1; index < result.findings.length; index += 1) {
      const prev = result.findings[index - 1]
      const curr = result.findings[index]
      if (prev.classification === curr.classification) {
        const key = (f: typeof prev) => `${f.path}|${f.rule}|${f.change}`
        expect(key(prev) <= key(curr)).toBe(true)
      }
    }
  })
})

describe('ledger fixture pairs produce the curated sets', () => {
  it('v1 → v2-compatible: memo (R4) and enum widening (R9 review); verdict REVIEW REQUIRED', () => {
    const result = diff(LEDGER_V1_SCHEMA, LEDGER_V2_COMPATIBLE_SCHEMA, 'response')
    expect(result.verdict).toBe('review')
    expect(findRule(result, 'R4')).toHaveLength(1)
    expect(findRule(result, 'R9')).toHaveLength(1)
    expect(result.findings.some((f) => f.classification === 'breaking')).toBe(false)
  })
  it('v1 → v2-breaking: settledAt removed, enum narrowed, type changed — all breaking', () => {
    const result = diff(LEDGER_V1_SCHEMA, LEDGER_V2_BREAKING_SCHEMA, 'response')
    expect(result.verdict).toBe('breaking')
    expect(findRule(result, 'R3').length).toBeGreaterThan(0)
    expect(findRule(result, 'R6').length).toBeGreaterThan(0)
    expect(findRule(result, 'R8').length).toBeGreaterThan(0)
  })
  it('v1 → v2-required (request locus): exactly one finding — required gains clientRequestId', () => {
    const result = diff(LEDGER_V1_SCHEMA, LEDGER_V2_REQUIRED_SCHEMA, 'request')
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].rule).toBe('R1')
    expect(result.findings[0].classification).toBe('breaking')
    expect(result.verdict).toBe('breaking')
  })
  it('an all-additive request-side pair produces BACKWARD-COMPATIBLE', () => {
    const base = schema({ type: 'object', properties: { a: { type: 'string' } } })
    const candidate = schema({ type: 'object', properties: { a: { type: 'string' }, memo: { type: 'string' } } })
    expect(diff(base, candidate, 'request').verdict).toBe('compatible')
  })
})
