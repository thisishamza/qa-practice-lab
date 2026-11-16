// Shared, learner-safe curriculum metadata for the runnable bug-hunt hunts
// (Phase 4, WP1; extended in Phase 5 P5-M2). CODE, not data — compiled with the bundle like the hunt
// registries. This module is the single source of truth for the curriculum
// payload: the server attaches it to the learner-safe hunt summary
// (src/shared/practice.ts `HuntSummary.curriculum`) and the client renders
// it on the scenario detail page. Nothing here may name a defect, a fix,
// the affected implementation, a hidden finding-check term, or any content
// that is not safe to show before reveal authorization — by construction,
// it describes what to practise and how to investigate, never the answer.
//
// Every entry is keyed by hunt id. The wired scenarios mirror the same
// difficulty; tests/data/content.test.ts enforces completeness, internal
// consistency and learner-safety.

export type CurriculumDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface HuntCurriculum {
  /** The QA skill/category this exercise practises, e.g. 'API testing · filtering'. */
  skillArea: string
  /** Mirrors the wired scenario's difficulty; asserted by content tests. */
  difficulty: CurriculumDifficulty
  /** QA concepts and techniques the investigation exercises. */
  conceptsPracticed: string[]
  /** What the learner should be able to do afterwards. */
  expectedOutcomes: string[]
  /** Where to aim the investigation. Process guidance, never the fault. */
  investigationFocus: string[]
  /** What a strong report for this hunt covers. */
  reportFocus: string[]
}

export const HUNT_CURRICULUM: Record<string, HuntCurriculum> = {
  'hunt-cart-001': {
    skillArea: 'Manual testing · functional & state behaviour',
    difficulty: 'beginner',
    conceptsPracticed: [
      'State-transition reasoning for add-to-cart',
      'Accumulation semantics versus overwrite behaviour',
      'Before/after comparison across repeated actions',
    ],
    expectedOutcomes: [
      'Design a repeated-add sequence that exposes quantity arithmetic errors',
      'Distinguish a display artefact from stored cart state',
      'Report with concrete before/after quantities and a deterministic repro',
    ],
    investigationFocus: [
      'Add the same item several times in a row and record the quantity after each add',
      'Compare what the page shows with what the cart actually holds after checkout',
      'Use one product at a time so exactly one variable changes per observation',
      'Reset the session to clean mode and repeat the sequence for a reference',
    ],
    reportFocus: [
      'The product and the quantities used at each step',
      'Expected versus actual quantity after each repeated add',
      'Where the observable state diverges from the expectation',
      'Why it matters — cart contents and order quantities would be wrong',
    ],
  },
  'hunt-catalogue-002': {
    skillArea: 'API testing · parameters & filtering',
    difficulty: 'beginner',
    conceptsPracticed: [
      'Filtered versus unfiltered response comparison',
      'Parameter presence versus parameter effect',
      'Reading response shape, rows and totals',
    ],
    expectedOutcomes: [
      'Use an HTTP client to replay the endpoint with and without the filter',
      'Confirm a parameter is accepted but ignored',
      'Report with a minimal request and full response evidence',
    ],
    investigationFocus: [
      'Replay the catalogue request with an explicit category and without one',
      'Compare row counts and totals between the two responses',
      'Try more than one category value for contrast',
      'Capture the exact request and the exact response for your report',
    ],
    reportFocus: [
      'The exact request — method, path, and parameters',
      'Row counts and totals with and without the parameter',
      'Expected versus actual result sets',
      'A minimal, copy-pasteable reproduction',
    ],
  },
  'hunt-pricing-001': {
    skillArea: 'Manual testing · calculations & consistency',
    difficulty: 'beginner',
    conceptsPracticed: [
      'Quantity-dependent arithmetic verification',
      'Cross-surface consistency checks (cart, checkout, confirmation)',
      'Evidence gathering with concrete numbers',
    ],
    expectedOutcomes: [
      'Demonstrate a mismatch between ordered quantity and shown values',
      'Isolate which stage of the flow shows inconsistent figures',
      'Write a report with exact amounts at each stage',
    ],
    investigationFocus: [
      'Work with quantities greater than one',
      'Follow the same order of numbers from cart to checkout summary to confirmation',
      'Note precisely where the figures agree and where they diverge',
      'Keep one product at a time and record the exact figures at each stage',
    ],
    reportFocus: [
      'The products and quantities used',
      'The figures shown at each stage, side by side',
      'Expected versus actual line values with exact amounts',
      'Why it matters — customers would see amounts that do not match what they ordered',
    ],
  },
  'hunt-checkout-001': {
    skillArea: 'Manual testing · input validation & boundaries',
    difficulty: 'intermediate',
    conceptsPracticed: [
      'Boundary-value analysis for text fields',
      'Equivalence partitioning of valid and invalid inputs',
      'Distinguishing deliberate leniency from validation defects',
    ],
    expectedOutcomes: [
      'Probe a single validation rule with minimal, controlled inputs',
      'Isolate which field and which rule is at fault',
      'Report an accepted-invalid-input defect precisely',
    ],
    investigationFocus: [
      'Probe required fields with degenerate values such as blanks and whitespace',
      'Keep every other field valid so only one variable changes per submission',
      'Contrast the accepted input with a rejected input in the same field',
      'Note exactly which inputs are rejected and which are accepted',
    ],
    reportFocus: [
      'The exact input that was accepted',
      'A valid baseline submission for contrast',
      'Expected rejection versus actual acceptance',
      'Impact — orders placed without a name on them',
    ],
  },
  'hunt-catalogue-001': {
    skillArea: 'Manual testing · search & text matching',
    difficulty: 'intermediate',
    conceptsPracticed: [
      'Query design for term placement (name vs description vs category)',
      'Distinguishing "absent product" from "unmatched query"',
      'Bounded comparative testing across similar queries',
    ],
    expectedOutcomes: [
      'Construct queries that separate different match fields',
      'Prove that a class of queries wrongly returns nothing',
      'Report with the query, expected results and actual results',
    ],
    investigationFocus: [
      'Try search terms that appear only in product descriptions versus only in names',
      'Compare result counts across several similar queries',
      'Identify which kinds of terms fail and which succeed',
      'Check clean mode with the same query for a reference where possible',
    ],
    reportFocus: [
      'The exact query and the field the term appears in',
      'Which products should match and why',
      'Expected versus actual result sets and totals',
      'The scope of which terms are affected',
    ],
  },
  'hunt-inventory-001': {
    skillArea: 'API testing · boundaries & stock limits',
    difficulty: 'intermediate',
    conceptsPracticed: [
      'Boundary-value analysis at exact limits',
      'Off-by-one error detection',
      'Reading structured error envelopes (per-line reasons)',
    ],
    expectedOutcomes: [
      'Identify the exact-boundary quantity for a limited-stock product',
      'Distinguish a boundary failure from a general refusal',
      'Report with the request, the error envelope and the evidence',
    ],
    investigationFocus: [
      'Find low-stock products and work out their exact remaining quantity',
      'Test one unit below, exactly at, and one unit above the remaining quantity',
      'Read the full error response body, not just the status code',
      'Confirm the cart matches available stock before submitting',
    ],
    reportFocus: [
      'The product, its remaining stock and the exact quantity ordered',
      'The request made and the error envelope received',
      'Expected versus actual outcome at the boundary',
      'Impact — orders for available stock are refused',
    ],
  },
  'hunt-authz-001': {
    skillArea: 'Security testing · access control',
    difficulty: 'advanced',
    conceptsPracticed: [
      'Object-level versus route-level authorisation',
      'Cross-account probing with synthetic fixture accounts',
      'Existence-concealment awareness in 404 versus other responses',
    ],
    expectedOutcomes: [
      'Test ownership enforcement on a single-object endpoint',
      'Compare responses for owned, unowned and unknown references',
      'Write an impact-focused finding for an authorisation failure',
    ],
    investigationFocus: [
      'Use two synthetic customer accounts — order as one, note the reference',
      'Open that reference while signed in as the other account',
      'Compare owned, unowned and unknown references for response differences',
      'Stop as soon as the behaviour is proven — do not extend the probe',
    ],
    reportFocus: [
      'The two accounts involved and the sequence used',
      'The reference and endpoint involved',
      'Expected versus actual response',
      'Impact — which data may be exposed to whom',
    ],
  },
  'hunt-authn-001': {
    skillArea: 'API testing · authentication & tokens',
    difficulty: 'intermediate',
    conceptsPracticed: [
      'Credential lifecycle: mint, use, expiry, revocation',
      'Bearer authentication alongside cookie authentication',
      'Server-side revocation versus client-side cookie clearing',
    ],
    expectedOutcomes: [
      'Trace an API token through its full lifecycle',
      'Replay a credential deliberately after state-changing actions',
      'Distinguish client-side sign-out from server-side revocation',
    ],
    investigationFocus: [
      'Mint a practice API token and prove it works on one protected endpoint',
      'Sign out, then replay the identical request with the token',
      'Compare the cookie path and the token path after sign-out',
      'Confirm whether every protected surface agrees before reporting',
    ],
    reportFocus: [
      'The lifecycle steps — mint, use, sign out, replay',
      'The exact status and body of the replayed request',
      'Expected versus actual behaviour after sign-out',
      'Why it matters — sign-out must end the account’s credentials',
    ],
  },
  'hunt-rbac-001': {
    skillArea: 'Security testing · role-based access control',
    difficulty: 'intermediate',
    conceptsPracticed: [
      'Per-route versus per-surface authorization design',
      'Read paths as authorization boundaries',
      'Contrast testing across sibling routes and credentials',
    ],
    expectedOutcomes: [
      'Probe a staff-only surface with a non-staff synthetic account',
      'Compare list and action endpoints for consistent boundaries',
      'Write a precise finding naming the missing check',
    ],
    investigationFocus: [
      'Request the staff inventory view as a customer-role account',
      'Contrast that response with the restock action for the same account',
      'Replay with and without a Bearer credential for the same account',
      'Characterise exactly which half of the boundary is missing',
    ],
    reportFocus: [
      'The account role used and how it authenticated',
      'The exact request and the response received',
      'The contrast with the restock action (same account)',
      'Impact — which figures a non-staff account can read',
    ],
  },
  'hunt-mass-001': {
    skillArea: 'API testing · input binding & mass assignment',
    difficulty: 'advanced',
    conceptsPracticed: [
      'Mass assignment: client fields bound the contract never declared',
      'Server-authoritative totals and pricing',
      'Response-versus-source-of-truth consistency checks',
    ],
    expectedOutcomes: [
      'Detect server trust of an undeclared client figure',
      'Isolate which figures are server-computed and which are believed',
      'Write an evidence-led finding with a minimal request',
    ],
    investigationFocus: [
      'Follow one order from cart to confirmation and note every total',
      'Replay the checkout request with an edited body claiming a different total',
      'Compare subtotal, line totals and order total on the resulting order',
      'Reset and confirm the field is ignored outside the exercise',
    ],
    reportFocus: [
      'The edited request body and the field it carried',
      'The figures on the resulting order versus the cart and summary',
      'Which values are server-computed and which are believed from the client',
      'Impact — an order placed against a client-dictated total',
    ],
  },
  'hunt-db-001': {
    skillArea: 'Database testing · referential integrity',
    difficulty: 'intermediate',
    conceptsPracticed: [
      'Anti-joins and NOT EXISTS reasoning',
      'What inner joins silently filter out',
      'Orphan detection against a known-good baseline',
    ],
    expectedOutcomes: [
      'Find rows referencing missing parents with one bounded query',
      'Explain why the UI never surfaces the broken rows',
      'Report the count, the ids and the affected orders',
    ],
    investigationFocus: [
      'Join order items to products both ways and compare what each direction yields',
      'Count items whose product reference resolves, and items that do not',
      'Work from the query outward — the data is the only witness here',
      'Reset to clean mode and confirm the query returns an empty set',
    ],
    reportFocus: [
      'The query used to surface the orphaned rows',
      'The orphaned row ids and the orders they belong to',
      'Expected versus actual referential completeness',
      'Why downstream reports would silently drop these lines',
    ],
  },
  'hunt-db-002': {
    skillArea: 'Database testing · duplicate detection & identity',
    difficulty: 'intermediate',
    conceptsPracticed: [
      'Normalized-key deduplication',
      'Case and whitespace insensitivity in identity columns',
      'Grouping and HAVING analysis across a cohort',
    ],
    expectedOutcomes: [
      'Surface same-human/multi-row identities with a normalized key',
      'Quantify the split order history behind the duplicates',
      'Propose a safe deduplication criterion for support follow-up',
    ],
    investigationFocus: [
      'List customers ordered by email and look for near-identical rows',
      'Group by a normalized (lower-cased, trimmed) key and inspect the sizes',
      'For each suspect cluster, join orders to see how history splits',
      'Reset to clean mode and confirm the clusters do not exist there',
    ],
    reportFocus: [
      'The normalization rule that exposes the cluster',
      'The exact rows involved and their differing fields',
      'Impact — inflated counts, split loyalty points, split order history',
      'A recommended merge criterion and what must be preserved',
    ],
  },
  'hunt-db-003': {
    skillArea: 'Database testing · reconciliation & arithmetic drift',
    difficulty: 'intermediate',
    conceptsPracticed: [
      'Reconciliation identities across stored parts and totals',
      'Derived-vs-stored comparison in one query',
      'Incident bounding across a whole table',
    ],
    expectedOutcomes: [
      'Recompute an expected total from an order’s own parts',
      'Enumerate every drifting row instead of stopping at the first',
      'Quantify the total financial exposure precisely',
    ],
    investigationFocus: [
      'Recompute subtotal + shipping + tax for every order and diff against stored totals',
      'List every mismatching order, not only the obvious one',
      'Compare the injected drift against the seeded pattern of acceptable noise',
      'Reset to clean mode and confirm the injected order reconciles there',
    ],
    reportFocus: [
      'The reconciliation query and its mismatch output',
      'The exact order number and the size of the drift',
      'Expected versus actual total for the affected order',
      'How you would sweep for more rows of the same class',
    ],
  },
  'hunt-db-004': {
    skillArea: 'Database testing · inventory consistency',
    difficulty: 'advanced',
    conceptsPracticed: [
      'Ledger-style re-derivation of stored figures',
      'Cross-checking stored state against historical behaviour',
      'Spotting edits that left no audit trail',
    ],
    expectedOutcomes: [
      'Detect a silent single-row rewrite of inventory state',
      'Bound the blast radius of the drift (oversell or phantom scarcity)',
      'Specify the verification that would catch it in a future release',
    ],
    investigationFocus: [
      'Survey inventory quantities for rows that look out of place for their category',
      'Cross-check a suspect row against what order history implies',
      'Look at the low-stock threshold too — it travels with the row',
      'Reset to clean mode and compare the stored figure side by side',
    ],
    reportFocus: [
      'The product and the stored-versus-supported quantity',
      'The evidence chain used to spot the lie',
      'Impact — oversell, phantom scarcity, or both',
      'A monitoring assertion that would alert on the drift',
    ],
  },
  'hunt-db-005': {
    skillArea: 'Database testing · completeness oracles & missing rows',
    difficulty: 'advanced',
    conceptsPracticed: [
      'Anti-join completeness checks',
      '“Every X has a Y” invariant testing',
      'Severity reasoning about silent omissions',
    ],
    expectedOutcomes: [
      'Enumerate delivered orders lacking any payment row',
      'Distinguish an absent payment from a legitimate pending state',
      'Report the missing row with evidence and blast radius',
    ],
    investigationFocus: [
      'Compare delivered orders against approved payments in both directions',
      'Sweep for missing payments with an anti-join, not by scrolling',
      'Confirm the absence is real — check payment ids, not just counts',
      'Reset to clean mode and confirm the anti-join comes back empty',
    ],
    reportFocus: [
      'The anti-join used and its output',
      'The exact order number and its total',
      'Expected versus actual — “every delivered order has a payment”',
      'Finance impact and the webhook/pipeline suspected of dropping it',
    ],
  },
  'hunt-db-006': {
    skillArea: 'Database testing · aggregation correctness',
    difficulty: 'advanced',
    conceptsPracticed: [
      'Recompute-and-diff on stored aggregates',
      'Fingerprinting defect classes by their arithmetic signature',
      'Blast-radius estimation across a table',
    ],
    expectedOutcomes: [
      'Surface every line where line total drops the quantity factor',
      'Quantify the revenue under-count exactly, in cents',
      'Describe the detection query a CI check could run nightly',
    ],
    investigationFocus: [
      'Scan every line item for total ≠ quantity × price',
      'Group the finds by order and size each order’s under-count',
      'Check whether the corruption is disjoint from the baseline noise',
      'Reset to clean mode and re-run to confirm the quieter baseline',
    ],
    reportFocus: [
      'The comparison query and the rows it returns',
      'The per-order and total revenue delta',
      'Expected versus actual per line, in integer cents',
      'Why the storefront never exposed this — aggregates hid it completely',
    ],
  },
  'hunt-db-007': {
    skillArea: 'Database testing · boundary-value data seams',
    difficulty: 'advanced',
    conceptsPracticed: [
      'Boundary-value analysis pushed into stored data',
      'Cross-table equality-seam detection',
      'Consistency oracles for exact-checkout cases',
    ],
    expectedOutcomes: [
      'Find the product whose stock equals an exact demand boundary',
      'Explain why exact-boundary rows are the fault line',
      'Articulate the invariant a checkout guard must enforce',
    ],
    investigationFocus: [
      'Compute each product’s largest single-line ordered quantity',
      'Compare those figures against the stored inventory quantities',
      'The pair that lands exactly on equality is the defect seam',
      'Reset to clean mode and compare the same scan there',
    ],
    reportFocus: [
      'The product and the equality evidence',
      'Expected versus actual at the boundary',
      'Why a strict less-than check silently oversells here',
      'The boundary assertion a regression test should encode',
    ],
  },
  'hunt-db-008': {
    skillArea: 'Database testing · deletion behavior & referential fallout',
    difficulty: 'advanced',
    conceptsPracticed: [
      'Outer-join null-side reading',
      'Bounding damage after an out-of-band delete',
      'Orphan inventory mapping (records with no parent)',
    ],
    expectedOutcomes: [
      'Enumerate all orders whose customer no longer exists',
      'Distinguish intended purges from accidental loss',
      'Bound the blast radius — which accounts, which reporting joins break',
    ],
    investigationFocus: [
      'Left-join orders to customers and read the NULL side',
      'Group the orphans by customer id and count their history',
      'Check the addresses table too — collateral orphans are common',
      'Reset to clean mode and confirm the join is whole there',
    ],
    reportFocus: [
      'The anti-join used and the orphaned order ids',
      'The missing customer’s footprint (orders, totals)',
      'Expected versus actual referential completeness',
      'Which dashboards double-count or silently drop these orders',
    ],
  },
}

export function curriculumForHunt(huntId: string): HuntCurriculum | undefined {
  return HUNT_CURRICULUM[huntId]
}
