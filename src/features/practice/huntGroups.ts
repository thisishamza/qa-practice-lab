// Pure grouping of the server-registered hunt list for discovery on
// /practice (R3). Grouping is by the first-party surface each hunt
// exercises — it never inspects defects, hints or answers, and hunts that
// match no known prefix land in a final "More hunts" bucket rather than
// disappearing.

import type { HuntSummary } from '../../shared/practice'

export interface HuntGroup {
  id: string
  title: string
  hunts: HuntSummary[]
}

const GROUP_DEFS: ReadonlyArray<{ id: string; title: string; prefixes: readonly string[] }> = [
  {
    id: 'storefront',
    title: 'Storefront, cart & checkout',
    prefixes: ['hunt-catalogue-', 'hunt-cart-', 'hunt-inventory-', 'hunt-pricing-', 'hunt-checkout-'],
  },
  {
    id: 'access',
    title: 'Access, roles & accounts',
    prefixes: ['hunt-authz-', 'hunt-authn-', 'hunt-rbac-', 'hunt-mass-'],
  },
  { id: 'database', title: 'Database Testing', prefixes: ['hunt-db-'] },
  { id: 'contract', title: 'Contract Testing', prefixes: ['hunt-contract-'] },
  { id: 'performance', title: 'Performance Testing', prefixes: ['hunt-perf-'] },
  { id: 'security', title: 'Security Testing', prefixes: ['hunt-sec-'] },
  { id: 'events', title: 'Microservices & Events', prefixes: ['hunt-event-'] },
]

export function groupHunts(hunts: readonly HuntSummary[]): HuntGroup[] {
  const assigned = new Set<string>()
  const groups: HuntGroup[] = []

  for (const def of GROUP_DEFS) {
    const matched = hunts.filter(
      (hunt) => def.prefixes.some((prefix) => hunt.id.startsWith(prefix)) && !assigned.has(hunt.id),
    )
    if (matched.length === 0) continue
    for (const hunt of matched) assigned.add(hunt.id)
    groups.push({ id: def.id, title: def.title, hunts: matched })
  }

  const rest = hunts.filter((hunt) => !assigned.has(hunt.id))
  if (rest.length > 0) {
    groups.push({ id: 'more', title: 'More hunts', hunts: rest })
  }

  return groups
}
