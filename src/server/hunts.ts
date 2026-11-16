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
  /**
   * 'ui' (default) = interactive UI/API/shop hunt with server-enforced
   * defects; consumes the per-IP daily hunt-start cap. 'sql' = database bug
   * hunt; the defect lives in a server-side data delta applied to the
   * learner's browser sandbox (see sqlSeedDelta.ts); it never consumes the
   * daily cap and can never activate a UI defect.
   */
  kind?: 'ui' | 'sql'
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
  // Phase 6 M2 — SQL database bug hunts (kind: 'sql'). The defect lives in a
  // server-side data delta applied to the learner's browser sandbox
  // (src/server/sqlSeedDelta.ts); no code-path defect exists for these, so
  // defectIds stays empty and isDefectActive() is always false for them.
  {
    id: 'hunt-db-001',
    title: 'Order items without products',
    summary:
      'Some line items reference products that are not in the catalogue. Find them and report what they break downstream.',
    scenarioId: 'db-orphaned-carts',
    defectIds: [],
    kind: 'sql',
  },
  {
    id: 'hunt-db-002',
    title: 'The signup email lookalikes',
    summary:
      'Support sees one person with several customer rows. Track down the lookalikes and report how you would identify them safely.',
    scenarioId: 'db-duplicate-customers',
    defectIds: [],
    kind: 'sql',
  },
  {
    id: 'hunt-db-003',
    title: 'The order that drifted',
    summary:
      'A delivered order’s stored total does not reconcile with its own parts. Find it and quantify the drift.',
    scenarioId: 'db-order-total-drift',
    defectIds: [],
    kind: 'sql',
  },
  {
    id: 'hunt-db-004',
    title: 'Stock that lied',
    summary:
      'The on-hand figure for one product disagrees with everything else the data can tell you. Find the bad row.',
    scenarioId: 'db-stock-audit',
    defectIds: [],
    kind: 'sql',
  },
  {
    id: 'hunt-db-005',
    title: 'The silent payment',
    summary:
      'A delivered order is missing its payment record. Find it without assuming where it went.',
    scenarioId: 'db-missing-payment',
    defectIds: [],
    kind: 'sql',
  },
  {
    id: 'hunt-db-006',
    title: 'Line totals that ignore quantity',
    summary:
      'Revenue under-counts in ways the UI never shows. Recompute the line math and find the broken rows.',
    scenarioId: 'db-line-totals',
    defectIds: [],
    kind: 'sql',
  },
  {
    id: 'hunt-db-007',
    title: 'The boundary that would not checkout',
    summary:
      'One product sits exactly on the seam between “enough stock” and “not enough”. Find it and explain why that row class is dangerous.',
    scenarioId: 'db-stock-boundary',
    defectIds: [],
    kind: 'sql',
  },
  {
    id: 'hunt-db-008',
    title: 'The customer who vanished',
    summary:
      'Some orders point at a customer who is no longer in the data. Find the orphaned history and bound the damage.',
    scenarioId: 'db-vanished-customer',
    defectIds: [],
    kind: 'sql',
  },
]

/** Learner-safe shape of a hunt id path segment (`hunt-topic-001`). */
export const HUNT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/

export function findHunt(id: string): HuntDefinition | null {
  return HUNTS.find((hunt) => hunt.id === id) ?? null
}
