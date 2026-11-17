import { describe, expect, it } from 'vitest'
import { groupHunts } from '../../src/features/practice/huntGroups'
import type { HuntSummary } from '../../src/shared/practice'

function hunt(id: string): HuntSummary {
  return { id, title: id, summary: `${id} summary`, scenarioId: null }
}

describe('groupHunts', () => {
  it('groups by first-party surface and preserves registry order within groups', () => {
    const hunts = [
      hunt('hunt-catalogue-001'),
      hunt('hunt-db-001'),
      hunt('hunt-cart-001'),
      hunt('hunt-authz-001'),
      hunt('hunt-db-002'),
      hunt('hunt-perf-001'),
      hunt('hunt-contract-001'),
      hunt('hunt-sec-001'),
      hunt('hunt-event-001'),
    ]
    const groups = groupHunts(hunts)
    expect(groups.map((group) => group.id)).toEqual([
      'storefront',
      'access',
      'database',
      'contract',
      'performance',
      'security',
      'events',
    ])
    expect(groups.find((group) => group.id === 'database')?.hunts.map((h) => h.id)).toEqual([
      'hunt-db-001',
      'hunt-db-002',
    ])
    expect(groups.find((group) => group.id === 'storefront')?.hunts.map((h) => h.id)).toEqual([
      'hunt-catalogue-001',
      'hunt-cart-001',
    ])
  })

  it('omits empty groups and buckets unknown ids under More hunts', () => {
    const groups = groupHunts([hunt('hunt-pricing-001'), hunt('hunt-future-001')])
    expect(groups.map((group) => group.id)).toEqual(['storefront', 'more'])
    expect(groups[1].hunts.map((h) => h.id)).toEqual(['hunt-future-001'])
  })

  it('returns no groups for an empty list', () => {
    expect(groupHunts([])).toEqual([])
  })
})
