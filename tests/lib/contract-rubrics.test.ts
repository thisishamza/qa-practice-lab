// Rubric family boundary tests (Phase 7, plan §12.1.4, §16.16).

import { describe, expect, it } from 'vitest'
import {
  CONTRACT_PASS_SCORE,
  scoreClassifications,
  scoreSelections,
  scoreStructured,
} from '../../src/server/contractRubrics'

describe('selections family — 69/70 boundary', () => {
  const expected = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

  it('6/10 hits with perfect precision (no distractors) passes at 72', () => {
    const target = scoreSelections(expected, ['a', 'b', 'c', 'd', 'e', 'f'], 100)
    expect(target.points).toBe(72)
    expect(target.points).toBeGreaterThanOrEqual(CONTRACT_PASS_SCORE)
  })

  it('5/10 hits with perfect precision lands at 65 — rejected', () => {
    const target = scoreSelections(expected, ['a', 'b', 'c', 'd', 'e'], 100)
    expect(target.points).toBe(65)
    expect(target.points).toBeLessThan(CONTRACT_PASS_SCORE)
  })

  it('distractors cost precision — recall 1.0 with 50% precision still passes (85)', () => {
    const selections = [...expected, ...Array.from({ length: 10 }, (_, i) => `junk-${i}`)]
    const target = scoreSelections(expected, selections, 100)
    expect(target.points).toBe(85)
  })

  it('structured family boundary: 6/10 passes at 72, 5/10 fails at 65', () => {
    const pass = scoreStructured(expected, ['a', 'b', 'c', 'd', 'e', 'f'])
    const fail = scoreStructured(expected, ['a', 'b', 'c', 'd', 'e'])
    expect(pass.passed).toBe(true)
    expect(pass.score).toBe(72)
    expect(fail.passed).toBe(false)
    expect(fail.score).toBe(65)
  })
})

describe('compare family — 69/70 boundary', () => {
  const expected = { a: 'breaking' as const, b: 'breaking' as const, c: 'review' as const, d: 'compatible' as const }

  it('3 of 4 correct with full completeness scores 83 — passes', () => {
    const result = scoreClassifications(expected, { a: 'breaking', b: 'review', c: 'review', d: 'compatible' })
    expect(result.score).toBe(83)
    expect(result.passed).toBe(true)
  })

  it('1 of 4 correct with full completeness scores 48 — rejected', () => {
    const result = scoreClassifications(expected, { a: 'breaking', b: 'compatible', c: 'compatible', d: 'review' })
    expect(result.score).toBe(48)
    expect(result.passed).toBe(false)
  })

  it('half addressed halves the completeness share', () => {
    const result = scoreClassifications(expected, { a: 'breaking', b: 'compatible' })
    expect(result.score).toBe(33)
    expect(result.passed).toBe(false)
  })

  it('all wrong but fully addressed scores 30 (completeness only)', () => {
    const result = scoreClassifications(expected, { a: 'compatible', b: 'compatible', c: 'compatible', d: 'breaking' })
    expect(result.score).toBe(30)
  })

  it('11 of 20 correct with full completeness scores exactly 69 — rejected', () => {
    const twenty = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`finding-${index}`, 'breaking' as const]),
    )
    const elevenCorrect = Object.fromEntries(
      Object.entries(twenty).map(([id], index) => [id, index < 11 ? 'breaking' : 'compatible']),
    )
    const result = scoreClassifications(twenty, elevenCorrect)
    expect(result.score).toBe(69)
    expect(result.passed).toBe(false)
  })

  it('12 of 20 correct with full completeness scores exactly 72 — passes', () => {
    const twenty = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`finding-${index}`, 'breaking' as const]),
    )
    const twelveCorrect = Object.fromEntries(
      Object.entries(twenty).map(([id], index) => [id, index < 12 ? 'breaking' : 'compatible']),
    )
    const result = scoreClassifications(twenty, twelveCorrect)
    expect(result.score).toBe(72)
    expect(result.passed).toBe(true)
  })

  it('all correct scores 100', () => {
    const result = scoreClassifications(expected, { a: 'breaking', b: 'breaking', c: 'review', d: 'compatible' })
    expect(result.score).toBe(100)
  })
})
