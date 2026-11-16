// Gated solution reveals (P4-M2 WP1) — CODE, not data. Compiled with the
// Worker; this module is imported ONLY by src/server/learning.ts, which
// serves these payloads after (and only after) server-side reveal
// eligibility is satisfied: the attempt's report was submitted, or the
// learner explicitly confirmed an unlock ("give up").
//
// Every entry is learner-facing prose about observable behaviour. Reveals
// must NOT cite defect registry ids, internal defect titles, file paths,
// function or table names, SQL fragments or any other implementation detail
// — they explain what is wrong at the behaviour level and how to verify a
// fix, so a learner can act on them without touching the codebase.
//
// `title` is the hunt's learner-safe title. The 21 non-runnable placeholder
// scenarios have no entry here on purpose; a reveal is served only for a
// registered hunt. tests/server/hints-reveal.test.ts asserts the registry
// covers exactly the registered runnable hunts.

export interface RevealDefinition {
  expected: string
  actual: string
  rootCause: string
  reproduction: readonly string[]
  verification: readonly string[]
  concepts: readonly string[]
  commonMisconceptions: readonly string[]
}

export const REVEALS: Record<string, RevealDefinition> = {
  'hunt-catalogue-001': {
    expected:
      'Searching the shop should match products whose name, description or category contains the search term (case-insensitive), so description-only matches appear in the results with the correct total.',
    actual:
      'Only products whose name or category contains the term are returned. Description-only matches never appear, and the reported total count excludes them.',
    rootCause:
      "The search matches text against the product's name and category but never against the description, so a whole class of legitimate matches silently disappears from the results.",
    reproduction: [
      'Open the shop in a bug-hunt session.',
      "Search for 'vestibules' — a term that appears only in one product's description.",
      'Observe the empty result set and a total of zero.',
      'Compare with the same search in a clean session, which returns that product.',
    ],
    verification: [
      'In a clean session, re-run a description-only query and confirm the described product appears with the correct total.',
      'Spot-check that name and category searches behave the same in both modes.',
    ],
    concepts: [
      'Test design using where a term appears',
      'Result-set completeness versus result-set correctness',
      'Comparative testing against a known-good reference',
    ],
    commonMisconceptions: [
      'Assuming the product is out of stock or unlisted rather than unmatched.',
      'Assuming the search is broken in general, when only description terms fail.',
    ],
  },
  'hunt-catalogue-002': {
    expected:
      'Choosing a category should narrow the listing to active products in that category, and both the returned rows and the reported total should respect the filter.',
    actual:
      'The full active catalogue is returned no matter which category is selected; the filter renders and accepts input but has no effect on the results.',
    rootCause:
      'The category selection never reaches the matching logic — the listing is produced without applying it, so the chosen value has no effect anywhere.',
    reproduction: [
      'Open the shop in a bug-hunt session.',
      'Select the Climbing category in the filter.',
      'Observe that the listing still contains every product, with the unfiltered total.',
      'Compare with a clean session, where only climbing products appear.',
    ],
    verification: [
      'In a clean session, select the same category and confirm only its products are listed and the total matches.',
      'Switch between two categories and confirm the listing and total both change.',
    ],
    concepts: [
      'Filter application versus parameter presence',
      'Response-level verification (rows and totals)',
      'Differential testing between filter values',
    ],
    commonMisconceptions: [
      'Concluding the catalogue itself is wrong, when only the filtering layer ignores the selection.',
      'Assuming the interface is merely slow to update, when the underlying listing is genuinely unfiltered.',
    ],
  },
  'hunt-cart-001': {
    expected:
      'Adding an item already in the cart should accumulate the quantities (existing plus newly added), subject to stock limits and per-line maximums — re-adding is an addition, not a replacement.',
    actual:
      'The stored line quantity is replaced by the newly added quantity instead of accumulated, so re-adding the same product leaves the line at the last-added quantity rather than the sum.',
    rootCause:
      'The add operation treats an existing line as something to overwrite rather than to extend, so repeated adds lose the previously stored quantity.',
    reproduction: [
      'In a bug-hunt session, add any product (quantity 2) to the cart twice in a row.',
      'Observe the line quantity shows 2 instead of the accumulated 4.',
      'Compare with a clean session, which shows 4.',
    ],
    verification: [
      'In a clean session, repeat the double-add and confirm the line accumulates to 4.',
      'Confirm a single add on a fresh cart behaves identically in both modes.',
    ],
    concepts: [
      'State-transition and idempotency reasoning',
      'Accumulate versus overwrite semantics',
      'Before/after evidence at each step',
    ],
    commonMisconceptions: [
      'Assuming the quantity display is stale, when the stored line is genuinely replaced.',
      'Blaming stock limits, which are not involved here.',
    ],
  },
  'hunt-inventory-001': {
    expected:
      'Checkout should accept a line whose quantity exactly equals the remaining stock, rejecting only quantities above what is available.',
    actual:
      'Checkout rejects an order for exactly the remaining units with an insufficient-stock error, even though the stock covers the order precisely.',
    rootCause:
      'The stock comparison is stricter than it should be at the exact boundary — equality with available stock is treated as insufficient rather than as sufficient.',
    reproduction: [
      'Find a product with very low remaining stock (for example 4 units).',
      'Add exactly that many units to the cart.',
      'Attempt checkout and observe the refusal with an insufficient-stock reason.',
      'Compare with a clean session, where the same order is accepted.',
    ],
    verification: [
      'In a clean session, order exactly the remaining stock and confirm the order is placed.',
      'Confirm quantities one unit above remaining stock are still rejected in both modes.',
    ],
    concepts: [
      'Boundary-value analysis (at, below and above the limit)',
      'Off-by-one reasoning',
      'Reading structured error envelopes',
    ],
    commonMisconceptions: [
      'Assuming stock was already reserved by someone else.',
      'Treating any quantity as equally affected — only the exact boundary is wrong.',
    ],
  },
  'hunt-pricing-001': {
    expected:
      'Each order line total should equal unit price times quantity, and the order confirmation should show line values consistent with the cart, the checkout summary and the order totals.',
    actual:
      'The placed order records each line total as just the unit price, ignoring the quantity, while the cart, checkout summary and order subtotal/total all remain correct.',
    rootCause:
      "The order snapshot stores the unit price as the line total instead of unit price times quantity — the quantity never enters the per-line calculation, even though everything upstream computes it correctly.",
    reproduction: [
      'Add a product with quantity 3 and confirm the checkout summary shows unit price times 3.',
      'Place the approved order and open the confirmation.',
      'Observe the per-line total equals the unit price while the order total is correct.',
      'Compare with a clean session, where the confirmation shows unit price times 3 per line.',
    ],
    verification: [
      'In a clean session, place a multi-unit order and confirm each line total equals unit price times quantity.',
      'Confirm the line totals, subtotal and order total are mutually consistent.',
    ],
    concepts: [
      'Cross-surface consistency checking',
      'Arithmetic verification with quantities greater than one',
      'Snapshot integrity for stored orders',
    ],
    commonMisconceptions: [
      'Assuming the whole order total is wrong — the totals are correct; only the per-line snapshot is not.',
      'Assuming tax or fees explain the gap.',
    ],
  },
  'hunt-checkout-001': {
    expected:
      'Checkout should reject a blank or whitespace-only customer name (the name must satisfy the documented 2–100 letter pattern), with a per-field validation error like every other invalid field.',
    actual:
      'A blank customer name passes validation and the order is placed with no name recorded; every other field is validated normally.',
    rootCause:
      "The name field's validation rule is never applied, so the value can be empty while every sibling field still enforces its own rules.",
    reproduction: [
      'Call POST /api/v1/checkout with a blank customer name and all other fields valid.',
      'Observe the order being placed in the bug-hunt session.',
      'Compare with a clean session, which answers with a validation error naming the customer name field.',
    ],
    verification: [
      'In a clean session, resubmit a blank name and confirm the per-field validation error appears.',
      'Confirm a valid name is accepted identically in both modes.',
    ],
    concepts: [
      'Boundary-value analysis for text fields',
      'Field-isolated validation probing',
      'Equivalence partitioning of valid and invalid inputs',
    ],
    commonMisconceptions: [
      'Assuming all fields are leniently validated, when only the name rule is missing.',
      'Assuming a missing name is a follow-up step rather than an accepted order.',
    ],
  },
  'hunt-authz-001': {
    expected:
      'Order detail should be served only when the caller owns the order; an unknown or not-owned reference should produce the identical not-found response so existence is concealed.',
    actual:
      'Any signed-in customer can open any existing order by reference; unknown references still answer with the not-found response as before.',
    rootCause:
      'The ownership condition is missing from the lookup, so possession of a reference — not ownership — is treated as sufficient to read the order.',
    reproduction: [
      'Sign in as one demo customer and place an order; note its reference.',
      'Sign out and sign in as a different demo customer.',
      'Open the order detail page (or request) for that reference.',
      'Observe the full order being returned; compare with a clean session, which answers not found.',
    ],
    verification: [
      'In a clean session, repeat the cross-account probe and confirm the identical not-found response used for unknown references.',
      'Confirm the owner can still open their own order in both modes.',
    ],
    concepts: [
      'Object-level authorization versus authentication',
      'Existence concealment via identical not-found responses',
      'Cross-account differential testing with synthetic accounts',
    ],
    commonMisconceptions: [
      'Assuming sign-in was bypassed — sign-in still works; the ownership check is what is missing.',
      'Assuming the data is public, when only possession of the reference is required.',
    ],
  },
  'hunt-authn-001': {
    expected:
      'Signing out should invalidate every credential issued for the account, including practice API tokens, so a token replayed after logout answers the same unauthorized response as any other signed-out request.',
    actual:
      'Signing out invalidates the browser session but leaves the account’s practice API tokens valid, so a token captured before sign-out still authenticates protected requests afterwards.',
    rootCause:
      'Logout ends the browser session without revoking the account’s separately issued API credentials, so possessing a previously minted token is enough to keep acting as the account.',
    reproduction: [
      'Sign in as a synthetic demo account and mint a practice API token.',
      'Make one protected request with the token to confirm it works.',
      'Sign out, then replay the same request with the same token.',
      'Observe the request still resolving the account; compare with a clean session, which answers unauthorized.',
    ],
    verification: [
      'In a clean session, sign out and replay the token — confirm the request answers with the same unauthorized response as a signed-out request.',
      'Confirm a freshly minted token works in both modes, and that signing out and minting a new token behaves identically everywhere else.',
    ],
    concepts: [
      'Server-side revocation versus client-side session clearing',
      'Credential lifecycle testing: mint, use, expire, revoke',
      'Differential testing across authentication paths (cookie versus token)',
    ],
    commonMisconceptions: [
      'Assuming signing out also destroys API tokens, when it only ends the browser session.',
      'Assuming the token expired on its own — the TTL is unaffected by sign-out.',
    ],
  },
  'hunt-rbac-001': {
    expected:
      'The staff inventory view should require the staff role: a customer-role account — however it authenticates — should receive the same forbidden response it gets everywhere else, and no inventory figures should be returned.',
    actual:
      'The read-only inventory list is served to any authenticated active account regardless of role; the restock action remains properly forbidden for non-staff accounts.',
    rootCause:
      'The role boundary is enforced on the state-changing action but missing on the read-only view, a classic per-route authorization gap: the check exists on one route and was never applied to its sibling.',
    reproduction: [
      'Sign in as a customer-role synthetic account.',
      'Request the staff inventory list with that account’s credentials.',
      'Observe the full inventory payload being returned; compare with a clean session, which answers with the same forbidden response as before.',
      'Attempt the restock action as the same account and confirm it is refused in both modes.',
    ],
    verification: [
      'In a clean session, repeat the list request as the customer-role account — confirm it is refused with the same response as before.',
      'Confirm the staff account can read and restock in both modes, and the customer-role account remains barred from restocking.',
    ],
    concepts: [
      'Per-route versus per-surface authorization design',
      'Read paths are authorization boundaries too',
      'Contrast testing across sister routes sharing a data surface',
    ],
    commonMisconceptions: [
      'Assuming sign-in was enough for staff tools, when authentication and authorization are separate checks.',
      'Assuming the restock path is equally exposed — it is not; only the read side is affected.',
    ],
  },
  'hunt-mass-001': {
    expected:
      'The order total should always be computed server-side from the catalogue. No client-supplied figure in the checkout request should change what the order stores or reports.',
    actual:
      'A non-negative integer totalCents sent in the checkout request body is stored as the order’s total while the subtotal and line totals stay server-computed, so the confirmation disagrees with the cart, the checkout summary and its own line items.',
    rootCause:
      'The server binds a client-controlled figure for the order total instead of deriving it exclusively from the catalogue, so any caller who edits the request body dictates what the order claims to cost.',
    reproduction: [
      'Add products to the cart and note the checkout summary total.',
      'Send the checkout request with a valid payload plus an extra body field carrying a different total.',
      'Open the confirmation and the order detail request; note the stored total.',
      'Compare with a clean session, where the same extra field is ignored and the server-computed total is stored.',
    ],
    verification: [
      'In a clean session, repeat the request with the extra field — confirm the server-computed total is stored regardless.',
      'Confirm the confirmation figures, the subtotal and the line totals agree with each other in all sessions.',
    ],
    concepts: [
      'Mass assignment: binding client fields the contract never declared',
      'Server-authoritative pricing and totals',
      'Response-vs-source-of-truth consistency checks',
    ],
    commonMisconceptions: [
      'Assuming the cart or the summary was wrong — the cart is always consistent; only the stored order total is believed from the client.',
      'Assuming the forged total propagates everywhere — the subtotal and line totals are unaffected.',
    ],
  },
}

/** Server-only lookup. Unknown hunt ids resolve to null. */
export function findReveal(huntId: string): RevealDefinition | null {
  return REVEALS[huntId] ?? null
}
