import { describe, expect, it } from 'vitest'
import {
  buildShopSearchParams,
  defaultShopFilters,
  defaultShopSort,
  filtersFromSearchParams,
  formatPriceCents,
  hasActiveShopFilters,
  pageFromSearchParams,
  shopSortLabels,
  sortFromSearchParams,
  stockStatusLabels,
} from '../../src/lib/shop'

describe('shop URL state — parse', () => {
  it('falls back to defaults for empty params', () => {
    const params = new URLSearchParams()
    expect(filtersFromSearchParams(params)).toEqual({ query: '', category: 'all' })
    expect(sortFromSearchParams(params)).toBe('newest')
    expect(pageFromSearchParams(params)).toBe(1)
  })

  it('parses valid values', () => {
    const params = new URLSearchParams('q=tent&category=camping&sort=price_asc&page=3')
    expect(filtersFromSearchParams(params)).toEqual({ query: 'tent', category: 'camping' })
    expect(sortFromSearchParams(params)).toBe('price_asc')
    expect(pageFromSearchParams(params)).toBe(3)
  })

  it('normalizes whitespace in queries', () => {
    const params = new URLSearchParams('q=fire   steel')
    expect(filtersFromSearchParams(params).query).toBe('fire steel')
  })

  it('falls back for invalid category, sort and page values', () => {
    const params = new URLSearchParams('category=%27%3BDROP&sort=bogus&page=-4')
    expect(filtersFromSearchParams(params).category).toBe('all')
    expect(sortFromSearchParams(params)).toBe('newest')
    expect(pageFromSearchParams(params)).toBe(1)

    expect(pageFromSearchParams(new URLSearchParams('page=abc'))).toBe(1)
    expect(pageFromSearchParams(new URLSearchParams('page=2.5'))).toBe(1)
    expect(pageFromSearchParams(new URLSearchParams('page=0'))).toBe(1)
    // Categories are normalized to lowercase; anything that is not a plain
    // slug falls back to 'all' rather than reaching the API.
    expect(filtersFromSearchParams(new URLSearchParams('category=Travel')).category).toBe(
      'travel',
    )
    expect(
      filtersFromSearchParams(new URLSearchParams('category=%27%3BDROP%20TABLE')).category,
    ).toBe('all')
  })

  it('clamps absurd page numbers', () => {
    expect(pageFromSearchParams(new URLSearchParams('page=99999'))).toBe(10_000)
  })
})

describe('shop URL state — serialize', () => {
  it('omits default values from the URL', () => {
    expect(buildShopSearchParams(defaultShopFilters, defaultShopSort, 1).toString()).toBe('')
  })

  it('round-trips state through the URL', () => {
    const filters = { query: 'lantern', category: 'camping' }
    const params = buildShopSearchParams(filters, 'price_desc', 2)
    expect(params.get('q')).toBe('lantern')
    expect(params.get('category')).toBe('camping')
    expect(params.get('sort')).toBe('price_desc')
    expect(params.get('page')).toBe('2')

    const parsed = filtersFromSearchParams(params)
    expect(parsed).toEqual(filters)
    expect(sortFromSearchParams(params)).toBe('price_desc')
    expect(pageFromSearchParams(params)).toBe(2)
  })

  it('drops page 1 and trims the query', () => {
    const params = buildShopSearchParams({ query: '  tent  ', category: 'all' }, 'newest', 1)
    expect(params.get('q')).toBe('tent')
    expect(params.get('page')).toBeNull()
    expect(sortFromSearchParams(params)).toBe('newest')
  })

  it('detects active controls including non-default page', () => {
    expect(hasActiveShopFilters(defaultShopFilters, defaultShopSort, 1)).toBe(false)
    expect(hasActiveShopFilters({ query: 'tent', category: 'all' }, defaultShopSort, 1)).toBe(
      true,
    )
    expect(hasActiveShopFilters(defaultShopFilters, 'price_asc', 1)).toBe(true)
    expect(hasActiveShopFilters(defaultShopFilters, defaultShopSort, 2)).toBe(true)
  })
})

describe('shop formatting and labels', () => {
  it('formats integer cents as USD', () => {
    expect(formatPriceCents(0)).toBe('$0.00')
    expect(formatPriceCents(18999)).toBe('$189.99')
    expect(formatPriceCents(129900)).toBe('$1,299.00')
    expect(formatPriceCents(1590)).toBe('$15.90')
  })

  it('labels every stock status and sort option', () => {
    expect(Object.keys(stockStatusLabels).sort()).toEqual([
      'in_stock',
      'low_stock',
      'out_of_stock',
    ])
    expect(Object.keys(shopSortLabels).sort()).toEqual(
      ['name', 'newest', 'price_asc', 'price_desc'].sort(),
    )
    for (const label of Object.values(stockStatusLabels)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })
})
