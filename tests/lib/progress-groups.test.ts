import { describe, expect, it } from 'vitest'
import {
  summarizeEntries,
  summaryLabel,
  shouldStartOpen,
  splitProgressEntries,
} from '../../src/features/progress/progressGroups'
import type { ProgressHuntEntry } from '../../src/shared/learning'

function entry(partial: Partial<ProgressHuntEntry> & { huntId: string }): ProgressHuntEntry {
  return {
    title: partial.huntId,
    status: 'none',
    discovered: false,
    bestScore: null,
    hintsUsed: 0,
    attempts: 0,
    lastSubmittedAt: null,
    ...partial,
  }
}

describe('summarizeEntries', () => {
  it('returns zeros for an empty section', () => {
    expect(summarizeEntries([])).toEqual({
      total: 0,
      started: 0,
      reported: 0,
      discovered: 0,
      inProgress: 0,
    })
  })

  it('counts started, reported, discovered and in-progress independently', () => {
    const summary = summarizeEntries([
      entry({
        huntId: 'a',
        attempts: 2,
        lastSubmittedAt: '2026-11-01T00:00:00.000Z',
        discovered: true,
        status: 'submitted',
      }),
      entry({ huntId: 'b', attempts: 1, status: 'in_progress' }),
      entry({ huntId: 'c' }),
    ])
    expect(summary).toEqual({ total: 3, started: 2, reported: 1, discovered: 1, inProgress: 1 })
  })
})

describe('summaryLabel', () => {
  it('reads Not started yet when nothing has been attempted', () => {
    expect(summaryLabel(summarizeEntries([entry({ huntId: 'a' })]))).toBe('Not started yet')
  })

  it('renders started/reported/discovered counts', () => {
    const label = summaryLabel(
      summarizeEntries([
        entry({ huntId: 'a', attempts: 1, lastSubmittedAt: '2026-11-01T00:00:00.000Z' }),
        entry({ huntId: 'b', attempts: 1, status: 'in_progress' }),
      ]),
    )
    expect(label).toBe('2 of 2 started · 1 reported · 1 in progress · 0 discovered')
  })
})

describe('shouldStartOpen', () => {
  it('is closed when no attempts exist', () => {
    expect(shouldStartOpen([entry({ huntId: 'a' })])).toBe(false)
    expect(shouldStartOpen([])).toBe(false)
  })

  it('is open once any attempt exists', () => {
    expect(shouldStartOpen([entry({ huntId: 'a', attempts: 1 })])).toBe(true)
  })
})

describe('splitProgressEntries', () => {
  const hunts: ProgressHuntEntry[] = [
    entry({ huntId: 'hunt-pricing-001', scenarioId: 'manual-cart-totals' }),
    entry({ huntId: 'sql-bgn-select-01' }),
    entry({ huntId: 'hunt-db-001', scenarioId: 'db-hunt-clean-01' }),
    entry({ huntId: 'contract-bgn-openapi-01' }),
    entry({ huntId: 'hunt-contract-002', scenarioId: 'contract-hunt-drift' }),
    entry({ huntId: 'perf-bgn-baseline-01' }),
    entry({ huntId: 'sec-bgn-authn-01' }),
    entry({ huntId: 'evt-bgn-guarantee-01' }),
    entry({ huntId: 'hunt-event-001', scenarioId: 'event-hunt-dupe' }),
  ]

  const groups = splitProgressEntries(hunts)

  it('produces the six display groups in order', () => {
    expect(groups.map((group) => group.id)).toEqual([
      'hunts',
      'database',
      'contract',
      'performance',
      'security',
      'events',
    ])
  })

  it('routes exercise entries to lab routes and hunts to scenario pages', () => {
    const byId = Object.fromEntries(groups.map((group) => [group.id, group]))
    expect(byId.hunts.entries.map((e) => e.huntId)).toEqual(['hunt-pricing-001'])
    expect(byId.database.entries.map((e) => e.huntId)).toEqual(['sql-bgn-select-01', 'hunt-db-001'])
    expect(byId.contract.entries.map((e) => e.huntId)).toEqual([
      'contract-bgn-openapi-01',
      'hunt-contract-002',
    ])
    expect(byId.performance.entries.map((e) => e.huntId)).toEqual(['perf-bgn-baseline-01'])
    expect(byId.security.entries.map((e) => e.huntId)).toEqual(['sec-bgn-authn-01'])
    expect(byId.events.entries.map((e) => e.huntId)).toEqual([
      'evt-bgn-guarantee-01',
      'hunt-event-001',
    ])

    expect(byId.hunts.hrefFor(byId.hunts.entries[0])).toBe('/scenarios/manual-cart-totals')
    expect(byId.database.hrefFor(byId.database.entries[0])).toBe('/database/exercises/sql-bgn-select-01')
    expect(byId.database.hrefFor(byId.database.entries[1])).toBe('/scenarios/db-hunt-clean-01')
    expect(byId.contract.hrefFor(byId.contract.entries[0])).toBe(
      '/contract/exercises/contract-bgn-openapi-01',
    )
    expect(byId.events.hrefFor(byId.events.entries[1])).toBe('/scenarios/event-hunt-dupe')
  })

  it('returns an empty href when a hunt has no scenario wiring', () => {
    const [huntsGroup] = splitProgressEntries([entry({ huntId: 'hunt-x-001' })])
    expect(huntsGroup.hrefFor(huntsGroup.entries[0])).toBe('')
  })
})
