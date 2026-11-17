import { describe, expect, it } from 'vitest'
import { searchSite } from '../../src/lib/siteSearch'

describe('searchSite', () => {
  it('returns no groups for an empty or whitespace-only query', () => {
    expect(searchSite('')).toEqual([])
    expect(searchSite('   ')).toEqual([])
  })

  it('matches scenarios by title and routes to the scenario page', () => {
    const groups = searchSite('cart totals')
    const exercises = groups.find((group) => group.type === 'exercise')

    expect(exercises).toBeDefined()
    const hit = exercises?.results.find((result) => result.id === 'manual-cart-totals')
    expect(hit).toBeDefined()
    expect(hit?.to).toBe('/scenarios/manual-cart-totals')
  })

  it('matches guides by title and routes to the guide page', () => {
    const groups = searchSite('manual tests')
    const guides = groups.find((group) => group.type === 'guide')

    expect(guides).toBeDefined()
    const hit = guides?.results.find((result) => result.id === 'guide-manual-test-design')
    expect(hit).toBeDefined()
    expect(hit?.to).toBe('/guides/guide-manual-test-design')
  })

  it('matches store destinations in the Practice app group, not Labs', () => {
    const groups = searchSite('cart')
    const labs = groups.find((group) => group.type === 'lab')
    const store = groups.find((group) => group.type === 'store')

    expect(labs?.results.map((result) => result.id) ?? []).not.toContain('store-cart')
    expect(store?.results.map((result) => result.id)).toContain('store-cart')
    expect(store?.label).toBe('Practice app')
    expect(store?.results.find((result) => result.id === 'store-cart')?.to).toBe('/cart')
  })

  it('matches lab destinations by keyword and routes to the lab', () => {
    const byKeyword = searchSite('sqlite')
    const sql = byKeyword.find((group) => group.type === 'lab')?.results.find((r) => r.id === 'lab-sql')
    expect(sql).toBeDefined()
    expect(sql?.to).toBe('/database')

    const byName = searchSite('performance')
    const perf = byName.find((group) => group.type === 'lab')?.results.find((r) => r.id === 'lab-performance')
    expect(perf).toBeDefined()
  })

  it('caps each group at four results and reports group labels', () => {
    const groups = searchSite('a')

    for (const group of groups) {
      expect(group.results.length).toBeLessThanOrEqual(4)
      expect(['Exercises', 'Guides', 'Labs', 'Practice app']).toContain(group.label)
    }
  })

  it('returns nothing for a query that matches no content', () => {
    expect(searchSite('zzzzqqqqxxyy')).toEqual([])
  })

  it('produces stable ids across groups', () => {
    const groups = searchSite('api')
    const ids = groups.flatMap((group) => group.results.map((result) => result.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
