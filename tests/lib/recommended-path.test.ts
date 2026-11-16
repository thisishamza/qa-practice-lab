// Recommended-path derivation and the completion-state interpretation
// (P4-M3 WP2). Completion = at least one bug report submitted on the hunt,
// surfaced by the WP1 progress payload as `lastSubmittedAt !== null` —
// sticky, score-independent, and never conferred by a reveal alone.
import { describe, expect, it } from 'vitest'
import {
  completionForEntry,
  getRecommendedPath,
  progressByHuntId,
} from '../../src/lib/recommendedPath'
import { recommendedHuntScenarioIds } from '../../src/data/scenarios'
import type { ProgressHuntEntry } from '../../src/shared/learning'

function entry(overrides: Partial<ProgressHuntEntry>): ProgressHuntEntry {
  return {
    huntId: 'hunt-cart-001',
    scenarioId: 'manual-cart-add-quantity',
    title: 'Re-adding an item does not add up',
    status: 'none',
    discovered: false,
    bestScore: null,
    hintsUsed: 0,
    attempts: 0,
    lastSubmittedAt: null,
    ...overrides,
  }
}

describe('completionForEntry', () => {
  it('treats a hunt with no attempts as not started', () => {
    expect(completionForEntry(undefined)).toBe('not_started')
    expect(completionForEntry(entry({}))).toBe('not_started')
  })

  it('treats an open attempt with no submission as in progress', () => {
    expect(completionForEntry(entry({ status: 'in_progress', attempts: 1 }))).toBe('in_progress')
  })

  it('treats a revealed attempt with no submission as solution viewed, not completed', () => {
    expect(completionForEntry(entry({ status: 'revealed', attempts: 1 }))).toBe('solution_viewed')
  })

  it('treats a submitted report as completed, regardless of score', () => {
    expect(
      completionForEntry(
        entry({
          status: 'submitted',
          attempts: 1,
          bestScore: 12,
          lastSubmittedAt: '2026-11-16T10:00:00.000Z',
        }),
      ),
    ).toBe('completed')
  })

  it('keeps completion sticky when the latest attempt is in progress again', () => {
    expect(
      completionForEntry(
        entry({
          status: 'in_progress',
          attempts: 2,
          bestScore: 78,
          lastSubmittedAt: '2026-11-16T10:00:00.000Z',
        }),
      ),
    ).toBe('completed')
  })

  it('counts a report filed on a revealed attempt as a submission', () => {
    expect(
      completionForEntry(
        entry({
          status: 'revealed',
          attempts: 1,
          lastSubmittedAt: '2026-11-16T10:00:00.000Z',
        }),
      ),
    ).toBe('completed')
  })

  it('does not infer discovery from a high score', () => {
    const view = entry({
      status: 'submitted',
      attempts: 1,
      bestScore: 78,
      lastSubmittedAt: '2026-11-16T10:00:00.000Z',
    })
    expect(view.discovered).toBe(false)
    expect(completionForEntry(view)).toBe('completed')
  })
})

describe('getRecommendedPath', () => {
  const items = getRecommendedPath()

  it('returns exactly the wired hunts in the approved order', () => {
    expect(items.map((item) => item.scenario.id)).toEqual(recommendedHuntScenarioIds)
    expect(items).toHaveLength(10)
  })

  it('numbers positions 1–10 in sequence', () => {
    expect(items.map((item) => item.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('attaches curriculum metadata sourced from the shared registry', () => {
    for (const item of items) {
      expect(item.curriculum.skillArea.length).toBeGreaterThan(0)
      expect(['beginner', 'intermediate', 'advanced']).toContain(item.curriculum.difficulty)
      expect(item.curriculum.conceptsPracticed.length).toBeGreaterThan(0)
      expect(item.curriculum.expectedOutcomes.length).toBeGreaterThan(0)
      expect(item.curriculum.difficulty).toBe(item.scenario.difficulty)
    }
  })

  it('lists no placeholder scenario', () => {
    const ids = items.map((item) => item.scenario.id)
    expect(ids).not.toContain('ui-signin-smoke')
    expect(items.every((item) => item.scenario.runnable)).toBe(true)
  })
})

describe('progressByHuntId', () => {
  it('indexes entries by hunt id', () => {
    const map = progressByHuntId([entry({ huntId: 'hunt-cart-001' })])
    expect(map.get('hunt-cart-001')?.scenarioId).toBe('manual-cart-add-quantity')
    expect(map.get('hunt-authz-001')).toBeUndefined()
  })
})
