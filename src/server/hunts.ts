// Hunt registry (P3-M7, expanded in P3-M8) — CODE, not data.
//
// A hunt definition is a typed object compiled with the Worker:
//   { id, title, summary, scenarioId, defectIds }
// Unknown ids resolve to null and the API answers 404; learners can never
// inject defects, SQL, expressions or new hunts, because nothing here comes
// from the database or the request. Hunt summaries are the only thing the
// browser ever sees — defect ids stay inside the server registries.
//
// Every hunt is wired to one scenario in the catalogue (`scenarioId`, a
// learner-safe id). The scenario carries the learning objective and the
// start/reset flow; the hunt carries the fixed server-side defect list.
// src/data/scenarios.ts must mirror `scenarioId` for every hunt here —
// tests/data/content.test.ts enforces the bidirectional wiring.

export interface HuntDefinition {
  /** Stable public id, lowercase-hyphen. Safe to expose. */
  id: string
  title: string
  /** Learner-safe one-line summary. No defect ids, hints or repro steps. */
  summary: string
  /** The scenario in the catalogue this hunt belongs to. Learner-safe id. */
  scenarioId: string
  /** Internal: the fixed defect list for this hunt, resolved only server-side. */
  defectIds: readonly string[]
}

export const HUNTS: readonly HuntDefinition[] = [
  {
    id: 'hunt-catalogue-001',
    title: 'Catalogue search under-matches',
    summary:
      'The shop search appears to miss products. Find out why results come up empty for some queries and report it.',
    scenarioId: 'manual-shop-search',
    defectIds: ['CATALOGUE-001'],
  },
  {
    id: 'hunt-catalogue-002',
    title: 'Category filter changes nothing',
    summary:
      'Choosing a category still shows products from every category. Work out where the narrowing is lost and report it.',
    scenarioId: 'api-catalogue-filters',
    defectIds: ['CATALOGUE-002'],
  },
  {
    id: 'hunt-cart-001',
    title: 'Re-adding an item does not add up',
    summary:
      'Adding an item already in the cart should raise its quantity. Something resets it instead. Investigate and report it.',
    scenarioId: 'manual-cart-add-quantity',
    defectIds: ['CART-001'],
  },
  {
    id: 'hunt-inventory-001',
    title: 'Checkout refuses the exact remaining stock',
    summary:
      'Ordering precisely the last units of a product is rejected at checkout. Find the boundary that is wrong and report it.',
    scenarioId: 'api-checkout-exact-stock',
    defectIds: ['INVENTORY-001'],
  },
  {
    id: 'hunt-pricing-001',
    title: 'Order totals do not add up',
    summary:
      'The order confirmation shows line totals that do not match the quantities ordered. Find the calculation that is wrong and report it.',
    scenarioId: 'manual-cart-totals',
    defectIds: ['PRICING-001'],
  },
  {
    id: 'hunt-checkout-001',
    title: 'Checkout accepts a blank customer name',
    summary:
      'The checkout validation lets a blank customer name through. Find where validation fails and report it.',
    scenarioId: 'manual-address-edge-cases',
    defectIds: ['CHECKOUT-001'],
  },
  {
    id: 'hunt-authz-001',
    title: 'Order details cross account boundaries',
    summary:
      'An order reference opened from another account still shows the order. Find the missing check and report it.',
    scenarioId: 'security-object-access',
    defectIds: ['AUTHZ-001'],
  },
  {
    id: 'hunt-authn-001',
    title: 'Signing out does not end the token’s life',
    summary:
      'A practice API token keeps working after the account signs out. Find where logout falls short and report it.',
    scenarioId: 'api-token-replay',
    defectIds: ['AUTHN-001'],
  },
  {
    id: 'hunt-rbac-001',
    title: 'Staff tools open to the wrong role',
    summary:
      'A customer-role account can read the staff inventory view. Find where the role check is missing and report it.',
    scenarioId: 'auth-role-boundaries',
    defectIds: ['RBAC-001'],
  },
  {
    id: 'hunt-mass-001',
    title: 'Checkout trusts the client’s prices',
    summary:
      'The order total on the confirmation does not match the cart. Find where a client figure is believed and report it.',
    scenarioId: 'api-mass-assignment',
    defectIds: ['MASS-001'],
  },
]

/** Learner-safe shape of a hunt id path segment (`hunt-topic-001`). */
export const HUNT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/

export function findHunt(id: string): HuntDefinition | null {
  return HUNTS.find((hunt) => hunt.id === id) ?? null
}
