// The canonical shared evaluation rubric must stay identical to the
// implemented server evaluator's rubric (plan §6.4) and add up to 100.
import { describe, expect, it } from 'vitest'
import {
  EVALUATION_RUBRIC,
  EVALUATION_TOTAL_POINTS,
  VERDICT_BANDS,
} from '../../src/shared/evaluationRubric'
import { RUBRIC_CHECKS, RUBRIC_TOTAL_POINTS } from '../../src/server/reportQuality'

describe('shared evaluation rubric (canonical)', () => {
  it('carries exactly the ten §6.4 checks in plan order', () => {
    expect(EVALUATION_RUBRIC.map((check) => check.id)).toEqual([
      'title-present',
      'environment-present',
      'steps-present',
      'steps-quality',
      'expected-present',
      'actual-present',
      'expected-actual-distinct',
      'severity-valid',
      'priority-valid',
      'finding',
    ])
  })

  it('weights match the approved plan exactly', () => {
    expect(EVALUATION_RUBRIC.map(({ id, points }) => [id, points])).toEqual([
      ['title-present', 10],
      ['environment-present', 10],
      ['steps-present', 15],
      ['steps-quality', 10],
      ['expected-present', 8],
      ['actual-present', 8],
      ['expected-actual-distinct', 7],
      ['severity-valid', 5],
      ['priority-valid', 5],
      ['finding', 22],
    ])
  })

  it('totals exactly 100 points', () => {
    expect(EVALUATION_TOTAL_POINTS).toBe(100)
    expect(EVALUATION_RUBRIC.reduce((sum, check) => sum + check.points, 0)).toBe(100)
  })

  it('mirrors the server evaluator point-for-point', () => {
    expect(RUBRIC_CHECKS.map(({ id, points }) => [id, points])).toEqual(
      EVALUATION_RUBRIC.map(({ id, points }) => [id, points]),
    )
    expect(RUBRIC_TOTAL_POINTS).toBe(EVALUATION_TOTAL_POINTS)
  })

  it('every check carries learner-facing copy', () => {
    for (const check of EVALUATION_RUBRIC) {
      expect(check.label.length).toBeGreaterThan(0)
      expect(check.summary.length).toBeGreaterThan(15)
    }
  })
})

describe('verdict bands (§6.4)', () => {
  it('covers 0–100 without gaps or overlaps', () => {
    expect(VERDICT_BANDS.map((band) => band.id)).toEqual(['solid', 'needs-work', 'incomplete'])
    expect(VERDICT_BANDS[0]).toMatchObject({ minimum: 80, maximum: 100 })
    expect(VERDICT_BANDS[1]).toMatchObject({ minimum: 50, maximum: 79 })
    expect(VERDICT_BANDS[2]).toMatchObject({ minimum: 0, maximum: 49 })
  })
})
