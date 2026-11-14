import { describe, expect, it } from 'vitest'
import {
  countScenariosByCategory,
  countScenariosByTrack,
  defaultScenarioFilters,
  filterScenarios,
  hasActiveFilters,
} from '../../src/lib/catalog'
import { scenarios } from '../../src/data/scenarios'

describe('filterScenarios', () => {
  it('returns the whole catalogue with default filters', () => {
    const result = filterScenarios(scenarios, defaultScenarioFilters)

    expect(result).toHaveLength(scenarios.length)
  })

  it('matches a case-insensitive keyword in the title', () => {
    const result = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      query: 'PAGINATION',
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.map((scenario) => scenario.id)).toContain('api-catalog-pagination')
  })

  it('searches objectives and prerequisites as well as titles', () => {
    const result = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      query: 'keyboard',
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((scenario) => scenario.id.startsWith('a11y-'))).toBe(true)
  })

  it('matches spaced track and mode names', () => {
    const trackResult = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      query: 'ui automation',
    })
    const modeResult = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      query: 'bug hunt',
    })

    expect(trackResult.length).toBeGreaterThan(0)
    expect(trackResult.every((scenario) => scenario.trackId === 'ui-automation')).toBe(
      true,
    )
    expect(modeResult.length).toBeGreaterThan(0)
    expect(modeResult.every((scenario) => scenario.mode === 'bug-hunt')).toBe(true)
  })

  it('filters by track', () => {
    const result = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      trackId: 'manual-testing',
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((scenario) => scenario.trackId === 'manual-testing')).toBe(true)
  })

  it('filters by difficulty', () => {
    const result = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      difficulty: 'advanced',
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((scenario) => scenario.difficulty === 'advanced')).toBe(true)
  })

  it('filters by clean or bug-hunt mode', () => {
    const clean = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      mode: 'clean',
    })
    const bugHunt = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      mode: 'bug-hunt',
    })

    expect(clean.length).toBeGreaterThan(0)
    expect(bugHunt.length).toBeGreaterThan(0)
    expect(clean.every((scenario) => scenario.mode === 'clean')).toBe(true)
    expect(bugHunt.every((scenario) => scenario.mode === 'bug-hunt')).toBe(true)
    expect(clean.length + bugHunt.length).toBe(scenarios.length)
  })

  it('filters by non-runnable status', () => {
    const planned = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      status: 'planned',
    })
    const inDesign = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      status: 'in-design',
    })

    expect(planned.length).toBeGreaterThan(0)
    expect(inDesign.length).toBeGreaterThan(0)
    expect(planned.every((scenario) => scenario.status === 'planned')).toBe(true)
    expect(inDesign.every((scenario) => scenario.status === 'in-design')).toBe(true)
  })

  it('combines filters', () => {
    const result = filterScenarios(scenarios, {
      query: '',
      trackId: 'manual-testing',
      difficulty: 'beginner',
      mode: 'clean',
      status: 'planned',
    })

    expect(result.map((scenario) => scenario.id)).toEqual(['manual-cart-totals'])
  })

  it('returns an empty list when nothing matches', () => {
    const result = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      query: 'zzzz-no-such-scenario',
    })

    expect(result).toEqual([])
  })
})

describe('hasActiveFilters', () => {
  it('is false for the default filter set', () => {
    expect(hasActiveFilters(defaultScenarioFilters)).toBe(false)
  })

  it('detects each kind of active filter', () => {
    expect(hasActiveFilters({ ...defaultScenarioFilters, query: 'cart' })).toBe(true)
    expect(hasActiveFilters({ ...defaultScenarioFilters, trackId: 'api-testing' })).toBe(
      true,
    )
    expect(hasActiveFilters({ ...defaultScenarioFilters, difficulty: 'advanced' })).toBe(
      true,
    )
    expect(hasActiveFilters({ ...defaultScenarioFilters, mode: 'bug-hunt' })).toBe(true)
    expect(hasActiveFilters({ ...defaultScenarioFilters, status: 'in-design' })).toBe(
      true,
    )
  })

  it('ignores whitespace-only queries', () => {
    expect(hasActiveFilters({ ...defaultScenarioFilters, query: '   ' })).toBe(false)
  })
})

describe('catalogue counts', () => {
  it('counts scenarios per track', () => {
    const counts = countScenariosByTrack(scenarios)
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

    expect(total).toBe(scenarios.length)
    expect(counts['manual-testing']).toBe(2)
  })

  it('counts scenarios per category', () => {
    const counts = countScenariosByCategory(scenarios)
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

    expect(total).toBe(scenarios.length)
  })
})
