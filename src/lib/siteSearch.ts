// Site-wide search for the top bar (R2). Client-side only — no backend, no
// persistence, no network. Indexes the three content types the redesign
// surfaces: scenarios (the catalogue), guides and labs. Scenario and guide
// data is already bundled with the pages that consume it, so searching it
// adds no new data loading; the labs are a small static destination list.

import { scenarios } from '../data/scenarios'
import { guides } from '../data/guides'

export type SearchResultType = 'exercise' | 'guide' | 'lab' | 'store'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  /** One supporting line shown under the title — never a raw body dump. */
  context: string
  to: string
}

export interface SearchResultGroup {
  type: SearchResultType
  /** Group heading, also used as the group's accessible name. */
  label: string
  results: SearchResult[]
}

const LAB_DESTINATIONS: readonly (SearchResult & { keywords: string })[] = [
  { id: 'lab-api-console', type: 'lab', title: 'API console', context: 'Send requests to the practice API', to: '/api-lab', keywords: 'api console requests lab same-origin' },
  { id: 'lab-api-reference', type: 'lab', title: 'API reference', context: 'The documented API contract', to: '/api-reference', keywords: 'api reference openapi contract documentation' },
  { id: 'lab-sql', type: 'lab', title: 'SQL playground', context: 'Query the practice dataset in your browser', to: '/database', keywords: 'sql database playground query sqlite' },
  { id: 'lab-contract', type: 'lab', title: 'Contract testing', context: 'Validate and diff API contracts', to: '/contract', keywords: 'contract validate diff schema consumer provider' },
  { id: 'lab-performance', type: 'lab', title: 'Performance testing', context: 'Measured load testing, safely bounded', to: '/performance', keywords: 'performance load latency throughput runner' },
  { id: 'lab-security', type: 'lab', title: 'Security testing', context: 'Synthetic security practice', to: '/security', keywords: 'security sqli xss csrf authn demos' },
  { id: 'lab-microservices', type: 'lab', title: 'Microservices & events', context: 'Event-driven simulation and testing', to: '/microservices', keywords: 'microservices events queue simulator order pipeline idempotency' },
]

/** The fictional app under test — a distinct group, never presented as a lab. */
const STORE_DESTINATIONS: readonly (SearchResult & { keywords: string })[] = [
  { id: 'store-shop', type: 'store', title: 'Meridian Storefront', context: 'The fictional app under test — browse the catalogue', to: '/shop', keywords: 'shop meridian outfitters storefront catalogue products browse' },
  { id: 'store-cart', type: 'store', title: 'Cart', context: 'Review your practice basket', to: '/cart', keywords: 'cart basket items quantity' },
  { id: 'store-checkout', type: 'store', title: 'Checkout', context: 'Simulated checkout — nothing is really paid', to: '/checkout', keywords: 'checkout payment order place simulated' },
  { id: 'store-customer-account', type: 'store', title: 'Customer account', context: 'The fictional shopper’s order history', to: '/account/orders', keywords: 'customer account orders order history fictional shopper' },
]

const GROUP_LABELS: Record<SearchResultType, string> = {
  exercise: 'Exercises',
  guide: 'Guides',
  lab: 'Labs',
  store: 'Practice app',
}

/** Per-type caps keep the panel scannable; the catalogue remains the exhaustive index. */
const MAX_PER_TYPE = 4

export function searchSite(query: string): SearchResultGroup[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    return []
  }

  interface Scored {
    result: SearchResult
    score: number
  }
  const grouped: Record<SearchResultType, Scored[]> = {
    exercise: [],
    guide: [],
    lab: [],
    store: [],
  }

  const tokens = needle.split(/\s+/).filter(Boolean)

  const consider = (
    type: SearchResultType,
    result: SearchResult,
    primary: string,
    secondary: string,
  ) => {
    const primaryLower = primary.toLowerCase()
    const secondaryLower = secondary.toLowerCase()
    let score = 0
    for (const token of tokens) {
      const primaryHit = primaryLower.indexOf(token)
      const secondaryHit = secondaryLower.indexOf(token)
      if (primaryHit === -1 && secondaryHit === -1) {
        // AND semantics — every word must match somewhere.
        return
      }
      score +=
        (primaryHit !== -1 ? 1000 - Math.min(primaryHit, 999) : 0) +
        (secondaryHit !== -1 ? 100 - Math.min(secondaryHit, 99) : 0)
    }
    // A contiguous match in the title is a much stronger signal than scattered words.
    if (tokens.length > 1 && primaryLower.includes(needle)) {
      score += 5000
    }
    grouped[type].push({ result, score })
  }

  for (const scenario of scenarios) {
    consider(
      'exercise',
      {
        id: scenario.id,
        type: 'exercise',
        title: scenario.title,
        context: [
          scenario.huntId ? 'Bug-hunt exercise' : 'Clean exercise',
          scenario.status === 'ready' ? 'ready to run' : 'placeholder',
        ].join(' · '),
        to: `/scenarios/${scenario.id}`,
      },
      scenario.title,
      `${scenario.summary} ${scenario.id}`,
    )
  }

  for (const guide of guides) {
    consider(
      'guide',
      {
        id: guide.id,
        type: 'guide',
        title: guide.title,
        context: `Guide · ${guide.readingMinutes} min read`,
        to: `/guides/${guide.id}`,
      },
      guide.title,
      guide.summary,
    )
  }

  for (const lab of LAB_DESTINATIONS) {
    consider(
      'lab',
      {
        id: lab.id,
        type: 'lab',
        title: lab.title,
        context: lab.context,
        to: lab.to,
      },
      lab.title,
      lab.keywords,
    )
  }

  for (const store of STORE_DESTINATIONS) {
    consider(
      'store',
      {
        id: store.id,
        type: 'store',
        title: store.title,
        context: store.context,
        to: store.to,
      },
      store.title,
      store.keywords,
    )
  }

  const groups: SearchResultGroup[] = []
  for (const type of ['exercise', 'guide', 'lab', 'store'] as const) {
    const matches = grouped[type]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_TYPE)
      .map((entry) => entry.result)
    if (matches.length > 0) {
      groups.push({ type, label: GROUP_LABELS[type], results: matches })
    }
  }
  return groups
}
