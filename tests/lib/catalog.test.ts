import { describe, expect, it } from 'vitest'
import {
  buildSearchParams,
  countScenariosByCategory,
  countScenariosByTrack,
  countScenariosByStatus,
  defaultScenarioFilters,
  filterScenarios,
  filtersFromSearchParams,
  hasActiveFilters,
  sortFromSearchParams,
  sortScenarios,
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

  it('filters by category', () => {
    const result = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      category: 'exploratory',
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((scenario) => scenario.categoryId === 'exploratory')).toBe(true)
  })

  it('combines filters', () => {
    const result = filterScenarios(scenarios, {
      ...defaultScenarioFilters,
      trackId: 'api-testing',
      difficulty: 'beginner',
      mode: 'clean',
      status: 'ready',
    })

    expect(result.map((scenario) => scenario.id)).toEqual(['api-catalog-pagination'])
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
    expect(hasActiveFilters({ ...defaultScenarioFilters, category: 'exploratory' })).toBe(
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
    expect(counts['manual-testing']).toBe(4)
  })

  it('counts scenarios per category', () => {
    const counts = countScenariosByCategory(scenarios)
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

    expect(total).toBe(scenarios.length)
  })
})

describe('URL search-param state', () => {
  it('parses valid params and defaults the rest', () => {
    const params = new URLSearchParams(
      'q=cart&track=manual-testing&difficulty=beginner&mode=clean&status=planned&category=functional&sort=title',
    )
    const filters = filtersFromSearchParams(params)

    expect(filters).toEqual({
      query: 'cart',
      trackId: 'manual-testing',
      difficulty: 'beginner',
      mode: 'clean',
      status: 'planned',
      category: 'functional',
      hunt: 'all',
    })
    expect(sortFromSearchParams(params)).toBe('title')
  })

  it('falls back to defaults for missing or invalid params', () => {
    const params = new URLSearchParams(
      'track=not-a-track&difficulty=expert&mode=nope&status=bogus&category=made-up&sort=popularity',
    )
    const filters = filtersFromSearchParams(params)

    expect(filters.trackId).toBe('all')
    expect(filters.difficulty).toBe('all')
    expect(filters.mode).toBe('all')
    expect(filters.status).toBe('all')
    expect(filters.category).toBe('all')
    expect(sortFromSearchParams(params)).toBe('recommended')
  })

  it('round-trips through buildSearchParams, dropping defaults', () => {
    const original = new URLSearchParams('q=cart&track=api-testing&sort=difficulty')
    const filters = filtersFromSearchParams(original)
    const sort = sortFromSearchParams(original)
    const rebuilt = buildSearchParams(filters, sort)

    expect(rebuilt.get('q')).toBe('cart')
    expect(rebuilt.get('track')).toBe('api-testing')
    expect(rebuilt.get('sort')).toBe('difficulty')
    expect(rebuilt.get('difficulty')).toBeNull()
    expect(rebuilt.get('status')).toBeNull()
  })

  it('buildSearchParams omits q when the query is only whitespace', () => {
    const params = buildSearchParams({ ...defaultScenarioFilters, query: '   ' })

    expect(params.toString()).toBe('')
  })

  it('buildSearchParams keeps only active facets', () => {
    const params = buildSearchParams({
      ...defaultScenarioFilters,
      status: 'in-design',
      category: 'exploratory',
    })

    expect(params.get('status')).toBe('in-design')
    expect(params.get('category')).toBe('exploratory')
    expect(params.toString()).toBe('status=in-design&category=exploratory')
  })
})

describe('sortScenarios', () => {
  it('recommended preserves the authored order', () => {
    const result = sortScenarios(scenarios, 'recommended')

    expect(result.map((scenario) => scenario.id)).toEqual(
      scenarios.map((scenario) => scenario.id),
    )
  })

  it('title sorts alphabetically by title', () => {
    const result = sortScenarios(scenarios, 'title')
    const titles = result.map((scenario) => scenario.title)

    expect([...titles].sort((a, b) => a.localeCompare(b))).toEqual(titles)
  })

  it('difficulty orders beginner before intermediate before advanced', () => {
    const result = sortScenarios(scenarios, 'difficulty')
    const ranks = result.map((scenario) =>
      ['beginner', 'intermediate', 'advanced'].indexOf(scenario.difficulty),
    )

    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('time orders by estimated minutes ascending', () => {
    const result = sortScenarios(scenarios, 'time')
    const minutes = result.map((scenario) => scenario.estimatedMinutes)

    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes)
  })
})

describe('countScenariosByStatus', () => {
  it('counts every scenario exactly once', () => {
    const counts = countScenariosByStatus(scenarios)
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

    expect(total).toBe(scenarios.length)
    expect(counts['in-design']).toBe(scenarios.filter((s) => s.status === 'in-design').length)
    expect(counts.planned).toBe(scenarios.filter((s) => s.status === 'planned').length)
    expect(counts.ready).toBe(12)
  })
})


describe('hunt filter', () => {
  it('parses ?hunt=available and drops unknown values', () => {
    expect(filtersFromSearchParams(new URLSearchParams('hunt=available')).hunt).toBe('available')
    expect(filtersFromSearchParams(new URLSearchParams('hunt=bogus')).hunt).toBe('all')
    expect(filtersFromSearchParams(new URLSearchParams('')).hunt).toBe('all')
  })

  it('round-trips through buildSearchParams, dropping the default', () => {
    expect(
      buildSearchParams({ ...defaultScenarioFilters, hunt: 'available' }).toString(),
    ).toBe('hunt=available')
    expect(buildSearchParams(defaultScenarioFilters).toString()).toBe('')
  })

  it('keeps only scenarios wired to a bug-hunt exercise', () => {
    const wired = filterScenarios(scenarios, { ...defaultScenarioFilters, hunt: 'available' })
    expect(wired.length).toBeGreaterThan(0)
    expect(wired.every((scenario) => Boolean(scenario.huntId))).toBe(true)
  })
})
