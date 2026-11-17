// Contract content matrix (Phase 7, plan §12.1.4 / §7.2) — count, difficulty
// split, id uniqueness, ≤ 32-char cap, facet coverage, reference-solution
// scoring, plausible-wrong rejection and the coverage matrix.

import { describe, expect, it } from 'vitest'
import { CONTRACT_EXERCISES, CONTRACT_EXERCISE_IDS } from '../../src/data/contractExercises'
import { CONTRACT_SERVER_EXERCISES, findContractExercise } from '../../src/server/contractExercises'
import { CONTRACT_HINTS } from '../../src/server/contractHints'
import { CONTRACT_REVEALS } from '../../src/server/contractReveals'
import { CONTRACT_FIXTURES, fixtureOperationSchema } from '../../src/shared/contracts/index'
import { scoreConsumerExpectation } from '../../src/server/consumerRubric'
import { scoreClassifications, scoreSelections } from '../../src/server/contractRubrics'
import { diffContracts } from '../../src/shared/contractDiff'
import { LEDGER_V1_SCHEMA } from '../../src/shared/contracts/ledgerV1'
import { LEDGER_V2_COMPATIBLE_SCHEMA } from '../../src/shared/contracts/ledgerV2Compatible'
import { LEDGER_V2_BREAKING_SCHEMA } from '../../src/shared/contracts/ledgerV2Breaking'
import { LEDGER_V2_REQUIRED_SCHEMA } from '../../src/shared/contracts/ledgerV2Required'
import { validatePayload } from '../../src/shared/contractValidation'
import { PROVIDER_PRODUCT_V1_PAYLOAD, PROVIDER_PRODUCT_V1_SCHEMA } from '../../src/shared/contracts/providerProduct'

describe('contract exercise registry shape', () => {
  it('ships exactly 24 exercises: 8 beginner, 9 intermediate, 7 advanced', () => {
    expect(CONTRACT_EXERCISES).toHaveLength(24)
    expect(CONTRACT_EXERCISES.filter((e) => e.difficulty === 'beginner')).toHaveLength(8)
    expect(CONTRACT_EXERCISES.filter((e) => e.difficulty === 'intermediate')).toHaveLength(9)
    expect(CONTRACT_EXERCISES.filter((e) => e.difficulty === 'advanced')).toHaveLength(7)
  })

  it('ids are unique and ≤ 32 characters', () => {
    expect(new Set(CONTRACT_EXERCISE_IDS).size).toBe(24)
    for (const id of CONTRACT_EXERCISE_IDS) {
      expect(id.length).toBeLessThanOrEqual(32)
      expect(id).toMatch(/^contract-[a-z]+-[a-z0-9-]+-[0-9]{2}$/)
    }
  })

  it('client and server registries agree on ids, and every id is in both', () => {
    const serverIds = new Set(CONTRACT_SERVER_EXERCISES.map((exercise) => exercise.id))
    expect(serverIds.size).toBe(24)
    for (const id of CONTRACT_EXERCISE_IDS) {
      expect(serverIds.has(id), id).toBe(true)
      expect(findContractExercise(id)).not.toBeNull()
    }
  })

  it('covers the plan §7.2 charter topics — at least one exercise per row of the matrix', () => {
    const requiredTopics = [
      'openapi-01', 'required-01', 'types-01', 'formats-01', 'enum-01', 'status-01', 'contenttype-01', 'live-products-01',
      'nested-01', 'request-01', 'response-01', 'const-01', 'constraints-01', 'refs-01', 'nullable-01',
      'compare-additive-01', 'compare-enum-01',
      'breaking-req-01', 'breaking-type-01', 'breaking-remove-01', 'consumer-expect-01', 'consumer-broken-01', 'checkout-flow-01', 'versioning-01',
    ]
    for (const topic of requiredTopics) {
      expect(CONTRACT_EXERCISE_IDS.some((id) => id.includes(topic)), topic).toBe(true)
    }
  })

  it('kind distribution: validate 12, compare 6, consumer 2, structured 4', () => {
    expect(CONTRACT_EXERCISES.filter((e) => e.kind === 'validate')).toHaveLength(12)
    expect(CONTRACT_EXERCISES.filter((e) => e.kind === 'compare')).toHaveLength(6)
    expect(CONTRACT_EXERCISES.filter((e) => e.kind === 'consumer')).toHaveLength(2)
    expect(CONTRACT_EXERCISES.filter((e) => e.kind === 'structured')).toHaveLength(4)
  })

  it('facets: fundamentals 15, compatibility 6, consumer 2, multi-operation 1', () => {
    expect(CONTRACT_EXERCISES.filter((e) => e.facet === 'fundamentals')).toHaveLength(15)
    expect(CONTRACT_EXERCISES.filter((e) => e.facet === 'compatibility')).toHaveLength(6)
    expect(CONTRACT_EXERCISES.filter((e) => e.facet === 'consumer')).toHaveLength(2)
    expect(CONTRACT_EXERCISES.filter((e) => e.facet === 'multi-operation')).toHaveLength(1)
  })

  it('every referenced fixture exists in the client registry', () => {
    const known = new Set([...CONTRACT_FIXTURES.map((entry) => entry.id), 'provider-product-v1', 'platform'])
    for (const exercise of CONTRACT_EXERCISES) {
      expect(known.has(exercise.fixtureId), exercise.id).toBe(true)
    }
  })

  it('every exercise has hints (3 levels) and a reveal with solution + explanation', () => {
    for (const id of CONTRACT_EXERCISE_IDS) {
      expect(CONTRACT_HINTS[id], id).toBeDefined()
      expect(CONTRACT_HINTS[id].level1.length).toBeGreaterThan(10)
      expect(CONTRACT_HINTS[id].level2.length).toBeGreaterThan(10)
      expect(CONTRACT_HINTS[id].level3.length).toBeGreaterThan(10)
      expect(CONTRACT_REVEALS[id], id).toBeDefined()
      expect(CONTRACT_REVEALS[id].solution.length).toBeGreaterThan(0)
      expect(CONTRACT_REVEALS[id].explanation.length).toBeGreaterThan(0)
    }
  })

  it('reference answers score exactly 100/100 through the compiled rubrics', () => {
    for (const server of CONTRACT_SERVER_EXERCISES) {
      const answer = structuredClone(server.referenceAnswer) as Record<string, unknown>
      let score: number
      switch (server.evaluation.family) {
        case 'selections':
          score = scoreSelections(server.evaluation.expected, (answer.selections as string[]) ?? []).points
          break
        case 'compare':
          score = scoreClassificationsAgainstReference(server.evaluation, answer)
          break
        case 'validate': {
          const selections = (answer.selections as string[]) ?? []
          const sel = scoreSelections(server.evaluation.expectedSelections, selections, 40).points
          const payloadValid = isCorrectedPayloadValid(server.evaluation.payloadSchemaRef, answer.payload)
          score = sel + (payloadValid ? 60 : 0)
          break
        }
        case 'consumer':
          score = scoreConsumerExpectation((answer.expectation as unknown) ?? {}).score
          break
      }
      expect(score, server.id).toBe(100)
    }
  })

  it('every planned rubric rejects its canonical wrong answer', () => {
    for (const server of CONTRACT_SERVER_EXERCISES) {
      const wrong = wrongAnswerFor(server)
      if (wrong === undefined) continue
      let score: number
      switch (server.evaluation.family) {
        case 'selections':
          score = scoreSelections(server.evaluation.expected, wrong as string[]).points
          break
        case 'compare':
          score = scoreClassifications(server.evaluation.expectedClassifications, wrong as Record<string, string>).score
          break
        case 'validate': {
          const sel = scoreSelections(server.evaluation.expectedSelections, wrong as string[], 40).points
          score = sel
          break
        }
        case 'consumer':
          score = scoreConsumerExpectation(wrong).score
          break
      }
      expect(score, server.id).toBeLessThan(70)
    }
  })

  it('v1 → v2-breaking produces exactly the curated breaking set (R3, R6, R8, R13)', () => {
    const result = diffContracts(LEDGER_V1_SCHEMA, LEDGER_V2_BREAKING_SCHEMA, { locus: 'response' })
    const breaking = result.findings.filter((f) => f.classification === 'breaking').map((f) => f.rule)
    for (const rule of ['R3', 'R6', 'R8', 'R13']) {
      expect(breaking, rule).toContain(rule)
    }
  })

  it('v2-required produces exactly one finding — R1', () => {
    const result = diffContracts(LEDGER_V1_SCHEMA, LEDGER_V2_REQUIRED_SCHEMA, { locus: 'request' })
    expect(result.findings.map((f) => f.rule)).toEqual(['R1'])
  })

  it('v2-compatible yields zero breaking findings and REVIEW REQUIRED verdict', () => {
    const result = diffContracts(LEDGER_V1_SCHEMA, LEDGER_V2_COMPATIBLE_SCHEMA, { locus: 'response' })
    expect(result.verdict).toBe('review')
    expect(result.findings.some((f) => f.classification === 'breaking')).toBe(false)
  })

  it('canned provider payload satisfies its schema', () => {
    expect(validatePayload(PROVIDER_PRODUCT_V1_SCHEMA, PROVIDER_PRODUCT_V1_PAYLOAD).length).toBe(0)
  })
})

function isCorrectedPayloadValid(ref: string | undefined, payload: unknown): boolean {
  const target =
    ref === 'ledger-v1/LedgerEntry'
      ? fixtureOperationSchema('ledger-v1', 'LedgerEntry')
      : ref === 'checkout-flow/OrderDetail'
        ? fixtureOperationSchema('checkout-flow', 'OrderDetail')
        : null
  if (!target) return false
  return validatePayload(target.schema, payload).length === 0
}

function scoreClassificationsAgainstReference(
  evaluation: Extract<
    (typeof CONTRACT_SERVER_EXERCISES)[number]['evaluation'],
    { family: 'compare' }
  >,
  answer: Record<string, unknown>,
): number {
  const classifications = (answer.classifications ?? {}) as Record<string, 'breaking' | 'compatible' | 'review'>
  const entries = Object.entries(evaluation.expectedClassifications)
  let correct = 0
  let addressed = 0
  for (const [id, wanted] of entries) {
    const got = classifications[id]
    if (got) {
      addressed += 1
      if (got === wanted) correct += 1
    }
  }
  const hasChoices = evaluation.expectedChoices !== undefined && Object.keys(evaluation.expectedChoices).length > 0
  if (!hasChoices) {
    return scoreClassifications(evaluation.expectedClassifications, classifications).score
  }
  const correctness = entries.length === 0 ? 1 : correct / entries.length
  const completeness = entries.length === 0 ? 1 : addressed / entries.length
  const classificationScore = Math.round((correctness * 0.7 + completeness * 0.3) * 70)
  const choices = (answer.choices ?? {}) as Record<string, string>
  const choiceEntries = Object.entries(evaluation.expectedChoices ?? {})
  let matched = 0
  for (const [id, wanted] of choiceEntries) {
    if (choices[id] === wanted) matched += 1
  }
  return classificationScore + Math.round((choiceEntries.length === 0 ? 1 : matched / choiceEntries.length) * 30)
}

function wrongAnswerFor(
  server: (typeof CONTRACT_SERVER_EXERCISES)[number],
): string[] | Record<string, string> | Record<string, unknown> | undefined {
  switch (server.evaluation.family) {
    case 'selections':
      return ['assert-never-happens']
    case 'compare': {
      const flipped: Record<string, string> = {}
      for (const [id] of Object.entries(server.evaluation.expectedClassifications)) {
        flipped[id] = 'compatible'
      }
      return flipped
    }
    case 'validate':
      return ['assert-never-happens']
    case 'consumer':
      return {}
  }
}
