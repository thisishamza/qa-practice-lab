// Progressive hints (P4-M2 WP1) — CODE, not data. Compiled with the
// Worker; the browser never receives more than one hint text at a time,
// and only for an unambiguously unlocked level.
//
// Three levels per runnable hunt, in a strict ladder:
//   Level 1 — Orient: which surface/flow to observe, what normal looks like.
//   Level 2 — Focus:  which comparison/boundary to probe (still not the fault).
//   Level 3 — Narrow: the precise condition to test (one step from the
//                     answer — the learner still executes and recognises it).
//
// Rules (enforced by src/server/learning.ts routes, not by this file):
//   - Hints guide, never disclose; no hint may name a defect id, an internal
//     defect title, an implementation detail (SQL, function names, files) or
//     a complete solution.
//   - Requesting level N requires level N−1 already used on the attempt
//     (levels are served cumulatively; the learner may re-read an unlocked
//     level for free).
//   - Usage is tracked as a bitmask on the attempt row (hint_mask bit
//     0/1/2 = level 1/2/3); re-requests are idempotent and never
//     double-counted.
//   - Viewing hints never unlocks the solution reveal.
//
// Hint text must not overlap the reveal registry (src/server/reveals.ts);
// tests/server/hints-reveal.test.ts asserts a content lint for that.

export type HintLevel = 1 | 2 | 3

export interface HuntHints {
  level1: string
  level2: string
  level3: string
}

export const HINTS: Record<string, HuntHints> = {
  'hunt-catalogue-001': {
    level1:
      'Open the shop search and get a feel for what a normal search looks like. Pick products with distinctive text in their name, their description and their category, and try searching a few terms of each kind. Note how many results each query returns.',
    level2:
      "Search a term that appears in exactly one product's description and in no product name or category, then search a term that appears only in a product name. Compare the two result sets and the total counts. Repeat with two or three more description-only terms before drawing a conclusion.",
    level3:
      'If description-only terms consistently return nothing while name and category terms work, pin down whether the pattern holds for every description-only term you try — and whether the missing products are absent from the results only, or from the total count as well. Your report is strongest when it names the exact class of terms that fail and shows one request-response pair for each class.',
  },
  'hunt-catalogue-002': {
    level1:
      "Open the shop and use the category filter. Choose a category and look at what is listed, then repeat with a different category. Next, ask the catalogue endpoint directly (browser dev tools or an HTTP client) the same two questions and compare what you see.",
    level2:
      "Replay the catalogue request with the category parameter set and with it omitted. Compare the number of rows returned and the total the response reports. Try a second, unrelated category value for contrast, and check whether the interface's displayed count agrees with the response's total.",
    level3:
      'Determine precisely what the category value changes: whether the response acknowledges the parameter at all, and whether the row set and total differ between any two category values you can name. If no difference is observable, that itself is your finding — capture the two requests and their full responses.',
  },
  'hunt-cart-001': {
    level1:
      'Add the same product to the cart several times in a row, keeping everything else constant, and write down the quantity shown after every single add — not just the final number. One product at a time is all you need.',
    level2:
      'Compare two sequences side by side: three adds of quantity 2 each, versus one add of quantity 6. Then compare what the cart page shows with what persists after a reload or a navigation away and back.',
    level3:
      'Narrow down when the number goes wrong: at the moment of the add, or when the cart is re-rendered. Add a product already in the cart and immediately read the quantity back versus after a refresh. Quantify the difference — that is what your report needs.',
  },
  'hunt-inventory-001': {
    level1:
      'Find a product with very low remaining stock (a handful of units). Note the exact number the shop offers you, and test checkout at quantities below, exactly at and just above that number. The boundary is where to look.',
    level2:
      'Add exactly the remaining units of that low-stock product and attempt checkout. Read the full error body, not just the status code — including any per-line reasons it reports. Compare with a submission one unit below the boundary.',
    level3:
      'Characterise the boundary precisely: for exactly the remaining quantity, what does the response say, and which line does it blame? Compare the exact-failure quantity against stock-minus-one and stock-plus-one so your report can state the rule the shop appears to be applying.',
  },
  'hunt-pricing-001': {
    level1:
      'Place an order using quantities greater than one and follow the same figures from cart, to checkout summary, to the order confirmation. Keep one product and one quantity per observation so you can see exactly which number is off.',
    level2:
      'For one order, record unit price, quantity, line total and the order totals at each stage. Check whether the cart and the checkout summary agree with each other, and whether the confirmation is consistent with both.',
    level3:
      "Check the confirmation's internal arithmetic: is each line's total consistent with the order's own subtotal and total? If the order as a whole adds up but individual lines do not, you have localised the break — note exactly which figures agree and which do not.",
  },
  'hunt-checkout-001': {
    level1:
      'Probe the checkout’s required fields with degenerate values — empty, or spaces only — one field at a time, keeping every other field valid. See what the form rejects and what it quietly accepts.',
    level2:
      'For the customer name specifically, contrast accepted and rejected inputs side by side: a valid name, whitespace only, a single letter, names with punctuation. Note the exact boundary between what passes and what fails, and what an accepted order looks like afterwards.',
    level3:
      'Isolate the scope: is the leniency limited to the name field, or do other required fields behave the same way? An order that completes with a blank name is strong evidence — capture the exact request payload and the confirmation that resulted.',
  },
  'hunt-authz-001': {
    level1:
      "Use two synthetic customer accounts. Place an order as one account and note its reference. Then, signed in as the other account, open that order's detail page (or the matching order-detail request) and see what happens.",
    level2:
      'Compare three cases as the second account: an order reference you own, the reference created by the first account, and a reference that does not exist at all. Record the status and body of each response — wording, fields, and whether anything about existence is revealed.',
    level3:
      'Decide what the unowned-reference response proves: whether the second account sees order contents it should not, and whether unknown references are handled identically. Keep the probe to those three cases and capture the exact responses — that is enough for a complete, honest report.',
  },
  'hunt-authn-001': {
    level1:
      'Sign in as a synthetic demo account, mint a practice API token from the API Lab, and make one protected request with it so you know the token works. Then sign out and try the exact same request again — and think about what “signing out” actually changed.',
    level2:
      'Work through the token lifecycle one step at a time: mint (the response is shown once), use successfully, sign out, replay. After signing out, compare what happens with the cookie session versus with the API token — both are credentials for the same account, and they may not be treated identically.',
    level3:
      'Narrow it to the step that lied: does signing out invalidate everything it issued, or only the browser session? Replay the token after sign-out and record the exact status and body. If it still resolves the account, check whether other protected surfaces behave the same before you write the report.',
  },
  'hunt-rbac-001': {
    level1:
      'Look at the staff-only inventory view while signed in as a customer-role synthetic account and again as the staff synthetic account. Note what each can see — and remember the shop has both a list view and a restock action, which may not be governed identically.',
    level2:
      'Use the API Lab to replay the inventory list request as the customer-role account: first with the cookie, then with an API token for the same account if you have one. Then attempt the restock (PATCH) action as the same account and compare the two outcomes carefully.',
    level3:
      'Isolate which half is enforced and which half is not: read versus write, for the same non-staff account, holding every other variable constant. Capture both request-response pairs — the one that is allowed and the one that is refused — and state precisely which role boundary is missing.',
  },
  'hunt-mass-001': {
    level1:
      'Place an order and follow the same figures from the cart, to the checkout summary, to the order confirmation and its order-detail request. The contract says the client only sends details and a payment outcome — start by checking whether everything on the order actually came from the server.',
    level2:
      'Replay the checkout request from the API Lab with an edited body: keep the valid details and payment outcome, but add an extra field claiming a different order total. Compare the confirmation you receive with the checkout summary and with the sum of the line totals.',
    level3:
      'Confirm the boundary: does the acceptance depend on the value’s type or sign, and does the subtotal behave the same way, or only the final total? Capture the exact request you sent and the figures on the resulting order — your report should show which number the server invented and which it believed.',
  },
}

/** Server-only lookup. Unknown hunt ids resolve to null. */
export function findHints(huntId: string): HuntHints | null {
  return HINTS[huntId] ?? null
}

/** The hint text for one level of one hunt, or null for an unknown hunt. */
export function hintText(huntId: string, level: HintLevel): string | null {
  const hints = HINTS[huntId]
  if (!hints) {
    return null
  }
  return level === 1 ? hints.level1 : level === 2 ? hints.level2 : hints.level3
}

/**
 * Fail-closed hint lookup. The registries are compile-time aligned and unit
 * tested, so an unknown id means the code is inconsistent — throwing routes
 * the failure to onError (500) instead of serving HTTP 200 with a null hint.
 */
export function requireHint(huntId: string, level: HintLevel): string {
  const hint = hintText(huntId, level)
  if (hint === null) {
    throw new Error('Hint registry is missing a runnable hunt.')
  }
  return hint
}
