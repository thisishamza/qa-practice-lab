// Contract exercise catalogue — Phase 7 (plan §7). CLIENT-SAFE definitions.
//
// Every exercise here is safe to ship in the browser bundle: prompt, task,
// chips, evidence hints and the (learner-facing) checklist labels. Compiled
// rubrics, expected fingerprint sets, reference answers and explanations are
// server-only (src/server/contractExercises.ts, contractHints.ts,
// contractReveals.ts) and reached through the evaluation and gated reveal
// endpoints.
//
// Shared ids: `contract-<level>-<topic>-<nn>`, ≤ 32 characters.
// tests/data/contract-exercises.test.ts enforces the matrix (8 beginner +
// 9 intermediate + 7 advanced = 24), id uniqueness and the ≤ 32 cap.

export type ContractExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type ContractExerciseKind = 'validate' | 'compare' | 'consumer' | 'structured'
export type ContractExerciseLocus = 'request' | 'response'

export interface ContractChecklistItem {
  /** Opaque id transmitted back on submit — carries no answer signal. */
  id: string
  /** Learner-facing label (rendered as a checkbox row). */
  label: string
}

export type ContractHubFacet = 'fundamentals' | 'compatibility' | 'consumer' | 'multi-operation'

export interface ContractExerciseDef {
  id: string
  title: string
  difficulty: ContractExerciseDifficulty
  estimatedMinutes: number
  /** One line for cards and hub grids. */
  summary: string
  /** One-paragraph QA-oriented framing — why a tester runs this. */
  qaScenario: string
  objective: string
  /** The specific learner task (imperative). */
  task: string
  kind: ContractExerciseKind
  locus?: ContractExerciseLocus
  fixtureId:
    | 'ledger-v1'
    | 'ledger-v2-compatible'
    | 'ledger-v2-breaking'
    | 'ledger-v2-required'
    | 'checkout-flow'
    | 'provider-product-v1'
    | 'platform'
  /** Named operation inside the fixture (Ledger/checkout docs). */
  operationId?: string
  /** Opaque selection options for checklist-driven (validate/structured) exercises. */
  checklist?: ContractChecklistItem[]
  /** Opaque finding handles for compare exercises. */
  findings?: ContractChecklistItem[]
  /** Which finding ids are graded as classifications vs single-choice impact reasons. */
  grade?: { classifications: string[]; choiceTarget?: string; choiceOptions?: string[] }
  /** Client-visible starter for two-stage validate exercises (the broken payload the learner fixes). */
  starterPayload?: Record<string, unknown>
  /** Two-stage validate: selections (40) + corrected payload (60). */
  payloadFix?: boolean
  /** Constraint/vocabulary chips shown in the instructions panel. */
  chips: string[]
  exampleEvidence: string
  relatedGuideIds: string[]
  track: 'contract-testing'
  /** Hub facet. */
  facet: ContractHubFacet
}

export const CONTRACT_EXERCISES: readonly ContractExerciseDef[] = [
  // ------------------------------------------------------------------ BEGINNER (8)
  {
    id: 'contract-bgn-openapi-01',
    title: 'Read the contract like a tester',
    difficulty: 'beginner',
    estimatedMinutes: 8,
    summary: 'Map operations to response schemas and spot the dangling $ref.',
    qaScenario:
      'Every API test plan starts from the contract. Before you can test a response, you have to know which schema documents it — and whether the document itself is sound. Broken $refs mean the contract lies before any traffic flows.',
    objective: 'Navigate paths → $refs → components.schemas and verify reference integrity.',
    task: 'The mini contract below has five operations. Select the five correct operation → schema mappings AND the two dangling $refs. Distractors are plausible-but-wrong pairings.',
    kind: 'structured',
    fixtureId: 'ledger-v1',
    checklist: [
      { id: 'map-products', label: 'GET /products → ProductListResponse' },
      { id: 'map-product-detail', label: 'GET /products/{slug} → Product' },
      { id: 'map-categories', label: 'GET /categories → CategoryListResponse' },
      { id: 'map-cart', label: 'GET /cart → CartResponse' },
      { id: 'map-checkout', label: 'POST /checkout → OrderDetail' },
      { id: 'map-products-cart', label: 'GET /products → CartResponse' },
      { id: 'map-product-detail-list', label: 'GET /products/{slug} → ProductListResponse' },
      { id: 'map-categories-summary', label: 'GET /categories → CategorySummary' },
      { id: 'ref-dangling-productlist', label: '$ref to #/components/schemas/ProductList does not resolve' },
      { id: 'ref-dangling-ordr', label: '$ref to #/components/schemas/Ordr does not resolve' },
      { id: 'ref-valid-product', label: '$ref to #/components/schemas/Product resolves' },
    ],
    chips: ['components/schemas', '$ref integrity', 'paths → operations → responses'],
    exampleEvidence: 'A good submission names every mapping and the refs that fail to resolve — evidence quality is completeness.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-bgn-required-01',
    title: 'Which properties are required?',
    difficulty: 'beginner',
    estimatedMinutes: 6,
    summary: 'Spot the required assertion fired by a payload missing amountCents.',
    qaScenario:
      'Most money bugs I get paged for are a missing required field silently defaulting somewhere. The contract is the first place to check — if the payload cannot satisfy it, nothing downstream can be trusted.',
    objective: 'Read `required` and name the failing assertion for a broken payload.',
    task: 'This LedgerEntry payload is missing one required property. Select the assertion that fires.',
    kind: 'validate',
    fixtureId: 'ledger-v1',
    operationId: 'LedgerEntry',
    checklist: [
      { id: 'assert-amountCents-required', label: 'amountCents — required — missing' },
      { id: 'assert-amountCents-type', label: 'amountCents — type — integer expected' },
      { id: 'assert-entryId-pattern', label: 'entryId — pattern — ^LE-[0-9A-Z]{8}$' },
      { id: 'assert-currency-const', label: 'currency — const — USD' },
      { id: 'assert-status-enum', label: 'status — enum — posted|pending|reversed' },
    ],
    starterPayload: {
      entryId: 'LE-0A1B2C3D',
      currency: 'USD',
      direction: 'debit',
      status: 'posted',
      merchant: 'Ridgeline Outfitters',
      postedAt: '2026-11-16T00:00:00Z',
      settledAt: null,
    },
    chips: ['required', 'JSON Pointer', 'assertion diagnostics'],
    exampleEvidence: 'One field fails one keyword; nothing else in the payload breaks.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-bgn-types-01',
    title: 'Spot the type lie',
    difficulty: 'beginner',
    estimatedMinutes: 7,
    summary: 'A money field serialized as a string — find it, then fix the payload.',
    qaScenario:
      'JavaScript-tolerant consumers render "4250" happily until the day someone adds two of them. The contract says integer; a contract test is the only thing that catches this before production.',
    objective: 'Identify a `type` assertion failure and produce the corrected payload.',
    task: 'Two-stage: (1) select the assertion that fires on this payload; (2) submit the corrected payload.',
    kind: 'validate',
    fixtureId: 'ledger-v1',
    operationId: 'LedgerEntry',
    checklist: [
      { id: 'assert-amountCents-type', label: 'amountCents — type — expected integer, actual string' },
      { id: 'assert-amountCents-minimum', label: 'amountCents — minimum — expected ≥ 0' },
      { id: 'assert-direction-enum', label: 'direction — enum — debit|credit' },
      { id: 'assert-merchant-minLength', label: 'merchant — minLength — expected ≥ 1' },
      { id: 'assert-postedAt-format', label: 'postedAt — format — expected date-time' },
    ],
    starterPayload: {
      entryId: 'LE-0A1B2C3D',
      amountCents: '2400',
      currency: 'USD',
      direction: 'debit',
      status: 'posted',
      merchant: 'Ridgeline Outfitters',
      postedAt: '2026-11-16T00:00:00Z',
      settledAt: '2026-11-17T00:00:00Z',
    },
    payloadFix: true,
    chips: ['type', 'integer vs string', 'money is integer cents'],
    exampleEvidence: 'One keyword fires on the same field in both stages — read the assertion, name the keyword, fix the value.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-bgn-formats-01',
    title: 'Dates and emails are not strings',
    difficulty: 'beginner',
    estimatedMinutes: 7,
    summary: 'Two format violations — one date-time, one email — find both.',
    qaScenario:
      'Date parsing is where "it worked on my machine" goes to die. The contract pins the format; anything else is a string that merely looks like a date.',
    objective: 'Recognize `format` assertions (date-time, email) in real payloads.',
    task: 'Two payloads, two format violations. Select the assertions that fire (both of them).',
    kind: 'validate',
    fixtureId: 'checkout-flow',
    operationId: 'OrderDetail',
    checklist: [
      { id: 'assert-createdAt-format', label: 'createdAt — format — expected date-time' },
      { id: 'assert-customerEmail-format', label: 'customerEmail — format — expected email' },
      { id: 'assert-customerName-pattern', label: 'customerName — pattern — letters only' },
      { id: 'assert-cancelledAt-nullable', label: 'cancelledAt — type — expected string|null' },
      { id: 'assert-totalCents-minimum', label: 'totalCents — minimum — expected ≥ 0' },
      { id: 'assert-reference-pattern', label: 'reference — pattern — ^ORD-[0-9A-F]{16}$' },
    ],
    chips: ['format: date-time', 'format: email', 'string ≠ date ≠ mailbox'],
    exampleEvidence: 'The two failures share a keyword family, not a field — read the assertions, not the values.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-bgn-enum-01',
    title: 'Only these values exist',
    difficulty: 'beginner',
    estimatedMinutes: 6,
    summary: 'An out-of-enum status value — identify it and name the valid set.',
    qaScenario:
      'Enumerations are closed vocabularies. When a player starts emitting IN_STOCK, every exhaustive switch in the fleet silently drops the row — this is why the contract says enum.',
    objective: 'Spot enum drift and restate the complete valid value set.',
    task: 'The LedgerEntry carries `status: "IN_STOCK"`. Select the enum assertion that fires, and the complete valid set.',
    kind: 'validate',
    fixtureId: 'ledger-v1',
    operationId: 'LedgerEntry',
    checklist: [
      { id: 'assert-status-enum', label: 'status — enum — IN_STOCK is not one of the documented values' },
      { id: 'enum-posted-pending-reversed', label: 'Valid set: posted, pending, reversed' },
      { id: 'enum-in-stock', label: 'Valid set: IN_STOCK, LOW_STOCK, OUT_OF_STOCK' },
      { id: 'enum-posted-only', label: 'Valid set: posted only' },
      { id: 'assert-direction-enum', label: 'direction — enum — debit|credit' },
      { id: 'enum-in-stock-case-insensitive', label: 'Valid set: case-insensitive posted, pending, reversed' },
    ],
    starterPayload: {
      entryId: 'LE-0A1B2C3D',
      amountCents: 4250,
      currency: 'USD',
      direction: 'debit',
      status: 'IN_STOCK',
      merchant: 'Ridgeline Outfitters',
      postedAt: '2026-11-16T00:00:00Z',
      settledAt: null,
    },
    chips: ['enum', 'closed vocabulary', 'casing matters'],
    exampleEvidence: 'The vocabulary is closed and the value set must be restated exactly — case included.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-bgn-status-01',
    title: 'The right number for the job',
    difficulty: 'beginner',
    estimatedMinutes: 6,
    summary: 'Match documented endpoint behaviour to the correct status code.',
    qaScenario:
      'Status codes are part of the contract — a 204 with a body, a 201 without a Location, a 200 where the client expects 404: each is a contract violation your tests must pin.',
    objective: 'Recall the documented (clean-mode) status codes for the core operations.',
    task: 'Select the six correct operation → status code pairs. Distractors include the classic mistakes.',
    kind: 'structured',
    fixtureId: 'ledger-v1',
    checklist: [
      { id: 'pair-products-200', label: 'GET /api/v1/products → 200' },
      { id: 'pair-checkout-201', label: 'POST /api/v1/checkout → 201' },
      { id: 'pair-token-201', label: 'POST /api/v1/auth/token → 201' },
      { id: 'pair-cancel-200', label: 'POST /api/v1/orders/{reference}/cancel → 200' },
      { id: 'pair-unknown-slug-404', label: 'GET /api/v1/products/{slug} (unknown) → 404' },
      { id: 'pair-checkout-invalid-400', label: 'POST /api/v1/checkout (invalid body) → 400' },
      { id: 'pair-cancel-204', label: 'POST /api/v1/orders/{reference}/cancel → 204' },
      { id: 'pair-checkout-200', label: 'POST /api/v1/checkout → 200' },
      { id: 'pair-login-500', label: 'POST /api/v1/auth/login (wrong password) → 500' },
      { id: 'pair-unknown-slug-410', label: 'GET /api/v1/products/{slug} (unknown) → 410' },
    ],
    chips: ['201 Created', '200 OK', '400 invalid_request', '404'],
    exampleEvidence: 'The documented behaviour is in the contract — match behaviour to its documented outcome, not its vibe.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-bgn-contenttype-01',
    title: 'JSON is a media type, not a vibe',
    difficulty: 'beginner',
    estimatedMinutes: 6,
    summary: 'Identify which of four responses breaks the documented media type.',
    qaScenario:
      'Clients parse by Content-Type, not by inspecting the bytes. A 200 with text/plain from a JSON operation is a contract break that no schema check catches until the parser throws.',
    objective: 'Recognize content-type as part of the contract, enforced by clients.',
    task: 'Four responses follow. Select the one that violates the documented media type — and select the rule it breaks.',
    kind: 'structured',
    fixtureId: 'ledger-v1',
    checklist: [
      { id: 'violation-text-plain', label: '200 + Content-Type: text/plain with a JSON body — breaks the documented application/json contract' },
      { id: 'ok-json-charset', label: '200 + Content-Type: application/json; charset=utf-8 — fine' },
      { id: 'ok-json', label: '200 + Content-Type: application/json — fine' },
      { id: 'ok-problem-json', label: '400 + application/json error envelope — fine' },
      { id: 'rule-media-type', label: 'Breaks: the documented response media type (application/json)' },
      { id: 'rule-status-code', label: 'Breaks: the documented status code' },
      { id: 'rule-body-schema', label: 'Breaks: the response body schema' },
    ],
    chips: ['Content-Type', 'application/json', '415', 'parser failure beats schema failure'],
    exampleEvidence: 'Exactly one response contradicts the negotiated media type — the rule is what matters, not the code.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-bgn-live-products-01',
    title: 'Your first live contract test',
    difficulty: 'beginner',
    estimatedMinutes: 9,
    summary: 'Capture a real response and choose the three assertions worth pinning.',
    qaScenario:
      'The best regression tests are one-line invariants copied from production truth. You do not need the whole schema — you need the three assertions that would have caught last quarter\'s outage.',
    objective: 'Extract a minimal, high-signal assertion set from a live capture.',
    task: 'Capture a real GET /api/v1/products response (the workspace does this for you), review its shape, then select the THREE assertions worth pinning as a regression test.',
    kind: 'validate',
    fixtureId: 'platform',
    checklist: [
      { id: 'pin-priceCents-integer', label: 'priceCents is an integer ≥ 0' },
      { id: 'pin-stockStatus-enum', label: 'stockStatus is one of in_stock | low_stock | out_of_stock' },
      { id: 'pin-currency-const', label: 'currency is exactly "USD"' },
      { id: 'pin-description-present', label: 'description is present' },
      { id: 'pin-id-integer', label: 'id is an integer' },
      { id: 'pin-name-length', label: 'name is non-empty' },
      { id: 'pin-supplier-cost-absent', label: 'supplierCostCents is absent' },
      { id: 'pin-categoryName-any', label: 'categoryName can be anything' },
    ],
    starterPayload: {
      id: 1,
      slug: 'ridgeline-2-person-tent',
      name: 'Ridgeline 2-Person Tent',
      description: 'A three-season dome tent with a vestibule and full-coverage rainfly.',
      categorySlug: 'camping',
      categoryName: 'Camping',
      priceCents: 34900,
      currency: 'USD',
      stockStatus: 'in_stock',
    },
    chips: ['regression pin', 'minimal assertion set', 'priceCents · stockStatus · currency'],
    exampleEvidence: 'The load-bearing invariants are the ones whose drift would page someone — name them from the contract, not from instinct.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  // -------------------------------------------------------------- INTERMEDIATE (9)
  {
    id: 'contract-int-nested-01',
    title: 'Into the array',
    difficulty: 'intermediate',
    estimatedMinutes: 8,
    summary: 'A nested violation — items[1].quantity — find the path, fix the payload.',
    qaScenario:
      'Nested payloads are where shallow validators go blind. The assertion path — /items/1/quantity — is the whole diagnosis: it names the element, the field and the broken rule.',
    objective: 'Read nested assertion paths and fix what fired.',
    task: 'Two-stage: (1) select the assertion that fires — `items[1]` has a quantity violation; (2) submit the corrected payload.',
    kind: 'validate',
    fixtureId: 'checkout-flow',
    operationId: 'OrderDetail',
    checklist: [
      { id: 'assert-items-1-quantity-minimum', label: 'items/1/quantity — minimum — expected ≥ 1' },
      { id: 'assert-items-length', label: 'items — minItems — expected ≥ 1' },
      { id: 'assert-lineTotal-minimum', label: 'items/0/lineTotalCents — minimum — expected ≥ 0' },
      { id: 'assert-totalCents-minimum', label: 'totalCents — minimum — expected ≥ 0' },
      { id: 'assert-reference-pattern', label: 'reference — pattern — ^ORD-[0-9A-F]{16}$' },
    ],
    starterPayload: {
      reference: 'ORD-0A1B2C3D4E5F6078',
      status: 'placed',
      totalCents: 71690,
      currency: 'USD',
      createdAt: '2026-11-16T14:03:00Z',
      cancelledAt: null,
      items: [
        {
          productSlug: 'ridgeline-2-person-tent',
          quantity: 2,
          unitPriceCents: 34900,
          lineTotalCents: 69800,
        },
        {
          productSlug: 'quartz-chalk-bag',
          quantity: 0,
          unitPriceCents: 1890,
          lineTotalCents: 0,
        },
      ],
    },
    payloadFix: true,
    chips: ['items[]', 'JSON Pointer', 'nested diagnostics'],
    exampleEvidence: 'One nested item violates one constraint — the pointer in the assertion names the element, the field and the rule.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-int-request-01',
    title: 'The request is also a contract',
    difficulty: 'intermediate',
    estimatedMinutes: 7,
    summary: 'A request violating minimum and required — find both.',
    qaScenario:
      'Provider rejection is a contract outcome too. Before you blame the deployment, prove the client payload against the documented request schema — usually the contract tells you exactly which field lied.',
    objective: 'Validate a request body and name every failing assertion.',
    task: 'This CreateEntryRequest asks for amountCents −50 and omits entryId. Select BOTH failing assertions.',
    kind: 'validate',
    fixtureId: 'ledger-v1',
    operationId: 'CreateEntryRequest',
    checklist: [
      { id: 'assert-amountCents-minimum', label: 'amountCents — minimum — expected ≥ 0' },
      { id: 'assert-entryId-required', label: 'entryId — required — missing' },
      { id: 'assert-entryId-pattern', label: 'entryId — pattern — ^LE-[0-9A-Z]{8}$' },
      { id: 'assert-currency-const', label: 'currency — const — USD' },
      { id: 'assert-direction-enum', label: 'direction — enum — debit|credit' },
      { id: 'assert-postedAt-format', label: 'postedAt — format — date-time' },
    ],
    starterPayload: {
      amountCents: -50,
      currency: 'USD',
      direction: 'debit',
      merchant: 'Ridgeline Outfitters',
      postedAt: '2026-11-16T00:00:00Z',
    },
    chips: ['request contract', 'minimum', 'required'],
    exampleEvidence: 'Two assertions fire on this payload — name both, they cover different keywords.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-int-response-01',
    title: 'The response lies by omission',
    difficulty: 'intermediate',
    estimatedMinutes: 6,
    summary: 'An OrderDetail-shaped payload missing createdAt — find what fires.',
    qaScenario:
      'Missing fields are the silent killer — the payload is valid JSON, the client reads undefined for the one date it was told to render, and nobody tickets it until a customer does.',
    objective: 'Detect required-property omission in a response body.',
    task: 'This OrderDetail payload omits createdAt. Select every assertion that fires.',
    kind: 'validate',
    fixtureId: 'checkout-flow',
    operationId: 'OrderDetail',
    checklist: [
      { id: 'assert-createdAt-required', label: 'createdAt — required — missing' },
      { id: 'assert-totalCents-minimum', label: 'totalCents — minimum — expected ≥ 0' },
      { id: 'assert-cancelledAt-format', label: 'cancelledAt — format — expected date-time' },
      { id: 'assert-reference-pattern', label: 'reference — pattern — ^ORD-[0-9A-F]{16}$' },
      { id: 'assert-currency-const', label: 'currency — const — USD' },
    ],
    starterPayload: {
      reference: 'ORD-0A1B2C3D4E5F6078',
      status: 'placed',
      totalCents: 71690,
      currency: 'USD',
      cancelledAt: null,
      items: [
        {
          productSlug: 'ridgeline-2-person-tent',
          quantity: 2,
          unitPriceCents: 34900,
          lineTotalCents: 69800,
        },
      ],
    },
    chips: ['required', 'partial payloads', 'the happy-path lie'],
    exampleEvidence: 'One assertion fires on this payload — nothing else.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-int-const-01',
    title: 'One constant to rule them all',
    difficulty: 'intermediate',
    estimatedMinutes: 7,
    summary: 'Lowercase currency and a stray debug field — two keyword violations.',
    qaScenario:
      'Closed-schema contracts fail hardest at the edges: a casing drift in a const, and a debug field someone left in after a demo. Both are one assertion each — and both decide whether your payload ships.',
    objective: 'Detect `const` and `additionalProperties` violations together.',
    task: 'This LedgerEntry asks for \'currency: "usd"\' and adds a \'debug\' property the schema forbids. Select the assertions that fire (both).',
    kind: 'validate',
    fixtureId: 'ledger-v1',
    operationId: 'LedgerEntry',
    checklist: [
      { id: 'assert-currency-const', label: 'currency — const — expected "USD"' },
      { id: 'assert-debug-additionalProperties', label: 'debug — additionalProperties — unexpected property' },
      { id: 'assert-status-enum', label: 'status — enum — posted|pending|reversed' },
      { id: 'assert-amountCents-type', label: 'amountCents — type — expected integer' },
      { id: 'assert-merchant-minLength', label: 'merchant — minLength — expected ≥ 1' },
    ],
    starterPayload: {
      entryId: 'LE-0A1B2C3D',
      amountCents: 4250,
      currency: 'usd',
      direction: 'debit',
      status: 'posted',
      merchant: 'Ridgeline Outfitters',
      postedAt: '2026-11-16T00:00:00Z',
      settledAt: null,
      debug: true,
    },
    chips: ['const', 'additionalProperties: false', 'closed schemas'],
    exampleEvidence: 'Two different keywords fire — one about a fixed identity, one about a closed shape.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-int-constraints-01',
    title: 'Numbers with opinions',
    difficulty: 'intermediate',
    estimatedMinutes: 8,
    summary: 'Four constraint violations — minimum, pattern, minLength, maxLength.',
    qaScenario:
      'Bounds are the cheapest contract insurance you will ever write. This payload breaks four of them at once — the validator will name every one, and you will learn to read that list like a checklist.',
    objective: 'Match violation to keyword across numeric and string constraints.',
    task: 'Four violations hide in this payload. Select all four — one item per violation.',
    kind: 'validate',
    fixtureId: 'ledger-v1',
    operationId: 'CreateEntryRequest',
    starterPayload: {
      entryId: 'LE-7Q2',
      amountCents: -5,
      currency: 'USD',
      direction: 'debit',
      merchant: '',
      postedAt: '2026-11-16T00:00:00Z',
      clientRef: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    checklist: [
      { id: 'assert-amountCents-minimum', label: 'amountCents — minimum — negative amount' },
      { id: 'assert-entryId-pattern', label: 'entryId — pattern — malformed id' },
      { id: 'assert-merchant-minLength', label: 'merchant — minLength — empty merchant' },
      { id: 'assert-clientRef-maxLength', label: 'clientRef — maxLength — over 64 characters' },
      { id: 'assert-merchant-maxLength', label: 'merchant — maxLength — too long' },
      { id: 'assert-amountCents-maximum', label: 'amountCents — maximum — ceiling breach' },
      { id: 'assert-direction-enum', label: 'direction — enum — debit|credit' },
      { id: 'assert-postedAt-format', label: 'postedAt — format — date-time' },
    ],
    chips: ['minimum', 'pattern', 'minLength', 'maxLength'],
    exampleEvidence: 'Four violations, four different keywords — each bound is exactly one keyword.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-int-refs-01',
    title: 'Follow the reference',
    difficulty: 'intermediate',
    estimatedMinutes: 8,
    summary: 'Resolve three $ref chains by hand — schemas behind schemas.',
    qaScenario:
      'Reading contracts fluently means chasing $refs without opening a browser tab per hop. If you can resolve the chain on paper, you can defend the contract in review.',
    objective: 'Resolve local $ref pointers transitively, by hand.',
    task: 'Three reference chains, three endpoints — select the correct terminal schema for each.',
    kind: 'structured',
    fixtureId: 'ledger-v1',
    checklist: [
      { id: 'ref-list-to-entry', label: 'EntryListResponse.data.items → LedgerEntry (required merchant)' },
      { id: 'ref-entry-status', label: 'LedgerEntry.status → enum posted|pending|reversed' },
      { id: 'ref-error-chain', label: 'Error.code → pattern ^LEDG-[0-9]{3}$' },
      { id: 'ref-list-to-create', label: 'EntryListResponse.data.items → CreateEntryRequest' },
      { id: 'ref-entry-settled', label: 'LedgerEntry.settledAt → string|null, unconstrained' },
      { id: 'ref-error-message', label: 'Error.message → format date-time' },
    ],
    chips: ['$ref', 'transitive resolution', 'components/schemas'],
    exampleEvidence: 'Three chains, three terminal schemas — the skill is reading, not remembering.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-int-nullable-01',
    title: 'The honest null',
    difficulty: 'intermediate',
    estimatedMinutes: 6,
    summary: 'cancelledAt null vs missing vs number — pick the three true statements.',
    qaScenario:
      'null is a value the contract either allows or does not. "I thought the field was optional" is not a schema position — type arrays are the honest way to say it.',
    objective: 'Reason about type arrays and optional-vs-nullable distinctions.',
    task: 'Three statements are true, three are not. Select the true statements about `cancelledAt`.',
    kind: 'validate',
    fixtureId: 'checkout-flow',
    operationId: 'OrderDetail',
    checklist: [
      { id: 'stmt-null-valid', label: 'cancelledAt: null validates against the documented type array' },
      { id: 'stmt-absent-valid', label: 'cancelledAt absent validates — the field is not required' },
      { id: 'stmt-number-invalid', label: 'cancelledAt: 1763308800 fails — integer is not the documented type' },
      { id: 'stmt-absent-invalid', label: 'cancelledAt absent fails — nullable means required' },
      { id: 'stmt-null-invalid', label: 'cancelledAt: null fails — null is not a string' },
      { id: 'stmt-number-valid', label: 'cancelledAt: 1763308800 validates — integers are dates' },
    ],
    chips: ['type: ["string","null"]', 'optional vs nullable', 'honest nulls'],
    exampleEvidence: 'Three statements are true, three are not — distinguish optionality from nullability.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'fundamentals',
  },
  {
    id: 'contract-int-compare-additive-01',
    title: 'The change that broke nothing',
    difficulty: 'intermediate',
    estimatedMinutes: 8,
    summary: 'Classify the two v1→v2-compatible findings.',
    qaScenario:
      'Comparing contracts is a two-sided skill: spot what changed, and decide whether it matters. Most releases are boring — your job is to prove they are boring, in writing, before the deploy.',
    objective: 'Classify additive and enum-widening findings with the right buckets.',
    task: 'The v2.0.0 candidate adds an optional memo and widens the status enum. Classify both findings (breaking / compatible / review).',
    kind: 'compare',
    fixtureId: 'ledger-v1',
    locus: 'response',
    findings: [
      { id: 'finding-memo', label: 'LedgerEntry gains optional `memo` (schema addition)' },
      { id: 'finding-status', label: '`status` enum gains `scheduled` (widening)' },
    ],
    grade: { classifications: ['finding-memo', 'finding-status'] },
    chips: ['additive change', 'R4', 'R9', 'verdict precedence'],
    exampleEvidence: 'Two findings, classified on their own merits — nothing passes because it is small.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'compatibility',
  },
  {
    id: 'contract-int-compare-enum-01',
    title: 'Wider enum, worried consumers',
    difficulty: 'intermediate',
    estimatedMinutes: 8,
    summary: 'Classify the enum widening — and pick the reason it is review, not compatible.',
    qaScenario:
      'An enum that grows is never automatically safe: the consumer with a closed switch statement is now wrong sometimes. This is the R9 rule — widening is review, always.',
    objective: 'Apply R9 and articulate the consumer-impact reason.',
    task: 'Classify the `status: enum gains scheduled` finding, and select why it cannot be silently compatible.',
    kind: 'compare',
    fixtureId: 'ledger-v1',
    locus: 'response',
    findings: [
      { id: 'finding-status', label: 'status — enum — gains "scheduled"' },
      { id: 'reason-closed-switch', label: 'Closed-set consumers hit an unhandled value — silent drops until the switch is updated' },
      { id: 'reason-invalid-data', label: 'scheduled is not a real status — the provider is broken' },
      { id: 'reason-backwards-incompatible', label: 'Any enum change is by definition breaking' },
      { id: 'reason-cost', label: 'Verification costs CPU time' },
    ],
    grade: { classifications: ['finding-status'], choiceTarget: 'finding-status', choiceOptions: ['reason-closed-switch', 'reason-invalid-data', 'reason-backwards-incompatible', 'reason-cost'] },
    chips: ['R9', 'always review', 'closed switches', 'consumer impact'],
    exampleEvidence: 'The reason must name who breaks and why; the bucket follows from the reason.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'compatibility',
  },
  // ------------------------------------------------------------------ ADVANCED (7)
  {
    id: 'contract-adv-breaking-req-01',
    title: 'New rule, no warning',
    difficulty: 'advanced',
    estimatedMinutes: 9,
    summary: 'v2.1.0 adds required clientRequestId — classify it for a living client base.',
    qaScenario:
      'This is the compatibility review that keeps you on call. Nothing looks broken in the diff — one new required field — and every client in the fleet starts 400ing on Tuesday.',
    objective: 'Apply R1 (request-side required addition) and state the impact honestly.',
    task: 'Classify the CreateEntryRequest finding: a new required `clientRequestId`.',
    kind: 'compare',
    fixtureId: 'ledger-v1',
    locus: 'request',
    findings: [
      { id: 'finding-clientRequestId', label: 'CreateEntryRequest — required — gains "clientRequestId"' },
      { id: 'reason-client-break', label: 'Previously-valid requests are rejected at the provider — clients must migrate first' },
      { id: 'reason-acceptable', label: 'Providers may tighten required sets at any time' },
      { id: 'reason-docs-only', label: 'Documentation changed, wire did not' },
    ],
    grade: { classifications: ['finding-clientRequestId'], choiceTarget: 'finding-clientRequestId', choiceOptions: ['reason-client-break', 'reason-acceptable', 'reason-docs-only'] },
    chips: ['R1', 'request-side tightening', 'rejection surface grows'],
    exampleEvidence: 'One new obligation, one class of client who feels it — pick the bucket and the reason together.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'compatibility',
  },
  {
    id: 'contract-adv-breaking-type-01',
    title: 'When the number became a string',
    difficulty: 'advanced',
    estimatedMinutes: 8,
    summary: 'Classify the type-change findings: the wire changed, the doc tells you.',
    qaScenario:
      'Type narrowing is the silent money bug. A string-serialized integer renders fine, sums wrong, and surfaces in a finance reconciliation three weeks later.',
    objective: 'Apply R6 (and R13/R19 where they ride along) to a type change.',
    task: 'Classify the three type-family findings in the v2.0.0 breaking candidate.',
    kind: 'compare',
    fixtureId: 'ledger-v1',
    locus: 'response',
    findings: [
      { id: 'finding-type', label: 'amountCents — type — integer → string' },
      { id: 'finding-pattern', label: 'amountCents — pattern — gains ^[0-9]+$' },
      { id: 'finding-minimum', label: 'amountCents — minimum — bound removed' },
    ],
    grade: { classifications: ['finding-type', 'finding-pattern', 'finding-minimum'] },
    chips: ['R6', 'R13', 'R19', 'integer cents', 'verdict precedence'],
    exampleEvidence: 'Three findings in one change family — classify each on its own keyword, not on the theme.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'compatibility',
  },
  {
    id: 'contract-adv-breaking-remove-01',
    title: 'The property that vanished',
    difficulty: 'advanced',
    estimatedMinutes: 8,
    summary: 'settledAt is gone — classify the removal and the enum narrowing.',
    qaScenario:
      'Property removal is the hardest break to notice in a review because nothing errors — everything just quietly stops being true. This diff is why checksums on contracts exist.',
    objective: 'Apply R3 and R8 to a property removal.',
    task: 'Classify the settledAt removal, and the enum narrowing (pending removed) that rides along.',
    kind: 'compare',
    fixtureId: 'ledger-v1',
    locus: 'response',
    findings: [
      { id: 'finding-settledAt', label: 'settledAt — property — removed from schema' },
      { id: 'finding-enum', label: 'status — enum — "pending" removed' },
    ],
    grade: { classifications: ['finding-settledAt', 'finding-enum'] },
    chips: ['R3', 'R8', 'absent ≠ unknown', 'bonus finding'],
    exampleEvidence: 'Two findings ride along in the same candidate — classify both, not just the loudest one.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'compatibility',
  },
  {
    id: 'contract-adv-consumer-expect-01',
    title: 'Write the smallest contract that bites',
    difficulty: 'advanced',
    estimatedMinutes: 12,
    summary: 'Author a minimal consumer expectation for getProduct.',
    qaScenario:
      'Consumer-driven contracts invert the usual power dynamic: the consumer declares what it reads, the provider verifies against it. The exercise teaches the skill that makes the whole thing work — pinning only what you read.',
    objective: 'Express a consumer expectation as minimal JSON Schema.',
    task: 'Write a minimal consumer expectation for getProduct. Require every consumer-critical field (slug, name, priceCents, currency, stockStatus) with the right types, keep the contract open, and catch the drift. The rubric scores C1–C7.',
    kind: 'consumer',
    fixtureId: 'provider-product-v1',
    chips: ['minimalism', 'C1–C7', 'additionalProperties omitted', 'const USD'],
    exampleEvidence: 'C1–C7 = 100 — minimal, critical-field-complete, drift-catching.',
    relatedGuideIds: ['guide-consumer-driven-contracts', 'guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'consumer',
  },
  {
    id: 'contract-adv-consumer-broken-01',
    title: 'Who broke the contract?',
    difficulty: 'advanced',
    estimatedMinutes: 10,
    summary: 'The v2 provider drifted — triage consumer vs provider before filing.',
    qaScenario:
      'A red contract test means somebody moved something — the question in the stand-up is who. This drill trains the triage: read the failing assertion, know which side you own, classify the drift, and write the one-line reviewer comment a provider can act on.',
    objective: 'Triage a provider drift: failing assertions, R-rule, reviewer comment.',
    task: 'The v2 provider drifted (the workspace can swap to the drifted payload for this drill). Submit an expectation that (a) compiles, (b) covers the critical five, (c) fails the drifted payload — then use the workspace verdict to triage: which assertion fired, which side moved, which R-rule applies.',
    kind: 'consumer',
    fixtureId: 'provider-product-v1',
    chips: ['R3 rename', 'triage: consumer vs provider', 'reviewer comment', 'keep the pin'],
    exampleEvidence: 'C1–C7 = 100 against the drift — and the triage names which side moved.',
    relatedGuideIds: ['guide-consumer-driven-contracts', 'guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'consumer',
  },
  {
    id: 'contract-adv-checkout-flow-01',
    title: 'The whole journey, three contracts',
    difficulty: 'advanced',
    estimatedMinutes: 14,
    summary: 'Eight seeded violations across the summary → request → detail captures.',
    qaScenario:
      'Contract tests earn their keep at the seams. Three captures, three contracts, eight violations — this is the reconciliation you run when checkout breaks and nobody can reproduce it.',
    objective: 'Validate a multi-contract journey end to end.',
    task: 'Three canned captures (summary → request → detail) carry eight seeded violations total. Select every one.',
    kind: 'validate',
    fixtureId: 'checkout-flow',
    checklist: [
      { id: 'cap-a-unitPrice', label: 'summary.items[0].unitPriceCents — type — expected integer, actual string' },
      { id: 'cap-a-total', label: 'summary.totalCents — minimum — expected ≥ 0, actual −100' },
      { id: 'cap-b-email', label: 'request.customerEmail — format — not an email' },
      { id: 'cap-b-payment', label: 'request.paymentSimulation — enum — expected approved|declined, actual "maybe"' },
      { id: 'cap-c-createdAt', label: 'detail.createdAt — format — expected date-time, actual 1763308800' },
      { id: 'cap-c-reference', label: 'detail.reference — pattern — ^ORD-[0-9A-F]{16}$ fails' },
      { id: 'cap-c-lineTotal', label: 'detail.items[0].lineTotalCents — type — expected integer, actual string' },
      { id: 'cap-c-cancelledAt', label: 'detail.cancelledAt — type — expected string|null, actual 1763308800' },
      { id: 'cap-a-currency-ok', label: 'summary.currency is exactly "USD" (correct — do not select)' },
      { id: 'cap-b-name-ok', label: 'request.customerName is valid (correct — do not select)' },
      { id: 'cap-c-status-ok', label: 'detail.status is "placed" (correct — do not select)' },
      { id: 'cap-a-quantity-ok', label: 'summary.items[0].quantity is 2 (correct — do not select)' },
    ],
    chips: ['summary → request → detail', 'eight violations', 'per-capture assertion lists'],
    exampleEvidence: 'Every seeded violation is caught and the intact captures stay untouched.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'multi-operation',
  },
  {
    id: 'contract-adv-versioning-01',
    title: 'The compatibility review',
    difficulty: 'advanced',
    estimatedMinutes: 12,
    summary: 'Full v1 → v2-breaking review — every finding, both perspectives.',
    qaScenario:
      'This is the document you attach to the release PR when a breaking schema change ships: what changed, what breaks, who must migrate, in which order. Reviewers trust it because every line is checkable against the diff.',
    objective: 'Produce a complete compatibility classification, with impact notes.',
    task: 'Classify ALL SIX findings from the v1 → v2-breaking diff (breaking / compatible / review).',
    kind: 'compare',
    fixtureId: 'ledger-v1',
    locus: 'response',
    findings: [
      { id: 'finding-type', label: 'amountCents — type — integer → string' },
      { id: 'finding-minimum', label: 'amountCents — minimum — bound removed' },
      { id: 'finding-pattern', label: 'amountCents — pattern — gains ^[0-9]+$' },
      { id: 'finding-settledAt', label: 'settledAt — property — removed' },
      { id: 'finding-enum', label: 'status — enum — "pending" removed' },
      { id: 'finding-required', label: 'required — settledAt no longer required (relaxation)' },
    ],
    grade: { classifications: ['finding-type', 'finding-minimum', 'finding-pattern', 'finding-settledAt', 'finding-enum', 'finding-required'] },
    chips: ['full review', 'R3 R6 R8 R13 R19 R2', 'both perspectives', 'verdict: BREAKING'],
    exampleEvidence: 'Six findings, one verdict, two perspectives — every line is checkable against the diff.',
    relatedGuideIds: ['guide-contract-testing-basics'],
    track: 'contract-testing',
    facet: 'compatibility',
  },
]

export const CONTRACT_EXERCISE_IDS = CONTRACT_EXERCISES.map((exercise) => exercise.id)
export const CONTRACT_EXERCISE_BY_ID = new Map(CONTRACT_EXERCISES.map((exercise) => [exercise.id, exercise]))

export function findContractExercise(id: string): ContractExerciseDef | null {
  return CONTRACT_EXERCISE_BY_ID.get(id) ?? null
}
