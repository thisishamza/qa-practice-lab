import type { Guide } from './types'

/**
 * Introductory guides for Phase 2. Content is original and tool-agnostic where
 * possible so future exercises can link to it without rewriting.
 */
export const guides: Guide[] = [
  {
    id: 'guide-manual-test-design',
    title: 'Design manual tests that find real problems',
    trackId: 'manual-testing',
    level: 'beginner',
    readingMinutes: 9,
    summary:
      'A practical method for turning requirements and risk into a small, high-value set of manual checks.',
    introduction: [
      'Manual testing is not “clicking around until something looks wrong”. It is a deliberate search for information about risk. The most useful manual testers decide what to learn before they start, then keep notes good enough for someone else to reproduce.',
      'This guide uses the Aster Market cart as a worked example. The same approach applies to any feature: understand the states, choose the risky boundaries, and make every observation reproducible.',
    ],
    concepts: [
      {
        term: 'Test charter',
        explanation:
          'A short statement of what you will explore and why. A charter is time-boxed and focused on a risk, not a list of clicks.',
      },
      {
        term: 'Equivalence partitioning',
        explanation:
          'Group inputs that should behave the same way. Testing one value from each group is usually more valuable than testing many values from one group.',
      },
      {
        term: 'Boundary value analysis',
        explanation:
          'Errors cluster at the edges of a rule: zero, one, the maximum, and the value just beyond it.',
      },
      {
        term: 'Oracle',
        explanation:
          'The source of truth you compare against. It might be a requirement, a calculation, or an invariant such as “the total equals the sum of line items”.',
      },
    ],
    examples: [
      {
        title: 'Charter for cart pricing',
        description:
          'A charter names the area, the risk, and the evidence you will collect.',
        language: 'text',
        code: 'Explore: cart pricing\nRisk: totals drift when quantity or discount changes\nTime box: 25 minutes\nEvidence: item price, line total, subtotal, tax, grand total',
      },
      {
        title: 'Boundary table for quantity',
        description:
          'Derive the smallest set of values that exercises each rule and its edges.',
        language: 'text',
        code: 'Quantity | Why it matters\n0        | empty or rejected\n1        | minimum purchasable\nmax      | stock or policy limit\nmax + 1  | must be rejected',
      },
    ],
    steps: [
      {
        title: 'Read the requirement and list states',
        detail:
          'Write down every state a cart can be in: empty, single item, multiple items, discounted, invalid quantity, and ready for checkout.',
      },
      {
        title: 'Choose risks, not screens',
        detail:
          'Pick two or three risks that would hurt a real user. Pricing drift and lost items are stronger risks than cosmetic spacing.',
      },
      {
        title: 'Write a short charter',
        detail:
          'State the area, the risk, the time box, and the evidence you will capture. Keep it small enough to finish in one sitting.',
      },
      {
        title: 'Execute and record as you go',
        detail:
          'For each observation, record steps, expected result, actual result, and environment. Note questions separately from defects.',
      },
    ],
    expectedResults: [
      'You can explain which risks your session covered and which it did not.',
      'Every defect has numbered steps and a reproducible expected-versus-actual comparison.',
      'Your notes let another tester repeat the session without asking you what you meant.',
    ],
    commonMistakes: [
      'Testing many values of the same kind while ignoring a boundary.',
      'Writing “cart is broken” instead of stating the input, expectation, and observed result.',
      'Treating an ambiguous requirement as a defect without recording the question first.',
    ],
    relatedScenarioIds: ['manual-cart-totals', 'manual-address-edge-cases'],
  },
  {
    id: 'guide-api-request-response',
    title: 'Read an API response like a tester',
    trackId: 'api-testing',
    level: 'intermediate',
    readingMinutes: 11,
    summary:
      'How to evaluate status codes, headers, payload shape, and behaviour together instead of checking only the body.',
    introduction: [
      'An API response is more than JSON. The status code, headers, timing, and body all describe one outcome. A test that checks only a 200 status is a smoke check, not a verification.',
      'This guide builds a repeatable review loop you can apply to any documented endpoint in the lab.',
    ],
    concepts: [
      {
        term: 'Contract',
        explanation:
          'The documented promise about paths, parameters, status codes, and payload shape. You test both the happy path and the documented failure modes.',
      },
      {
        term: 'Status semantics',
        explanation:
          '2xx means success, 4xx means the caller must change something, and 5xx means the server failed. A 200 with an error body is usually a defect.',
      },
      {
        term: 'Pagination',
        explanation:
          'Page-based or cursor-based paging must never duplicate or skip records across boundaries. Test the first page, an interior page, and the reported end.',
      },
      {
        term: 'Idempotency',
        explanation:
          'Repeating the same request should not create a second effect when the operation is declared idempotent. Retries make this a real user risk.',
      },
    ],
    examples: [
      {
        title: 'Baseline request',
        description: 'Start with the smallest valid request and capture every part of the response.',
        language: 'bash',
        code: 'curl -i "https://lab.example/api/v1/catalogue?limit=2"\n\n# Record: status, content-type, cache headers, body, timing',
      },
      {
        title: 'Vary one input',
        description:
          'Change a single parameter so a failure has an unambiguous cause.',
        language: 'bash',
        code: 'curl -i "https://lab.example/api/v1/catalogue?limit=0"\n# Expect a documented 400 with a stable error envelope',
      },
      {
        title: 'The same requests in the API Lab',
        description:
          'No curl required — the lab ships a same-origin request console with the raw answer, and a downloadable copy of the contract.',
        language: 'text',
        code: '1. Open /api-reference — read the contract for GET /api/v1/products\n2. Open /api-lab — method GET, path /api/v1/products, query perPage=3&sort=price_asc\n3. Send — watch status, headers, elapsed ms and the pretty-printed body\n4. Try page=0, perPage=999, sort=bogus and category=bogus — the documented capping answers\n5. Copy as curl to keep the exact request for your terminal',
      },
    ],
    steps: [
      {
        title: 'Read the endpoint contract',
        detail:
          'List required and optional inputs, success statuses, error statuses, and the documented response shape.',
      },
      {
        title: 'Send a baseline request',
        detail:
          'Capture status, headers, body, and timing. Confirm the response matches the documented shape before varying anything.',
      },
      {
        title: 'Vary one axis at a time',
        detail:
          'Test missing fields, wrong types, boundary values, unauthorised access, and pagination edges in separate requests.',
      },
      {
        title: 'Compare behaviour with the contract',
        detail:
          'Record the request, response, and expectation together. If the contract is silent, record a question rather than inventing a defect.',
      },
      {
        title: 'Repeat the loop in the API Lab',
        detail:
          'Open /api-lab and replay the baseline and one varied request. Read status, headers and body in the response panel — note how the documented envelope, capping and empty-set behaviour show up in the raw answer. Copy any request as curl when you need it in a terminal, and reset the changes with the clear button; history is kept only in the page and never persisted.',
      },
    ],
    expectedResults: [
      'Each case has a saved request and a response captured with status and headers.',
      'Failure cases return the documented error envelope, not a success status with an error body.',
      'Pagination and filtering results are consistent across pages and totals.',
    ],
    commonMistakes: [
      'Checking only the status code and ignoring the payload shape.',
      'Changing several parameters in one request, which hides the cause of a failure.',
      'Treating an undocumented but plausible behaviour as automatically correct.',
      'Reading only the pretty body in the API Lab and skipping the status line and headers.',
    ],
    relatedScenarioIds: [
      'api-catalog-pagination',
      'api-order-idempotency',
      'api-automation-schema-suite',
      'api-automation-token-refresh',
    ],
  },
  {
    id: 'guide-ui-automation-first-test',
    title: 'Your first reliable UI automation test',
    trackId: 'ui-automation',
    level: 'beginner',
    readingMinutes: 10,
    summary:
      'Choose user-facing locators, wait for conditions, and assert outcomes that survive a redesign.',
    introduction: [
      'A UI test should describe user intent. If the test breaks when a CSS class changes, it was coupled to implementation rather than behaviour. Reliable tests are independent, deterministic, and honest about what they prove.',
      'This guide uses the sign-in journey because it is short, familiar, and exposes the core patterns: locate, act, wait, assert, clean up.',
    ],
    concepts: [
      {
        term: 'Accessible locator',
        explanation:
          'A query by role, label, or visible name. It mirrors how assistive technology finds the control and tends to survive markup changes.',
      },
      {
        term: 'Web-first assertion',
        explanation:
          'An assertion that retries until the expected state appears or times out. It replaces fixed sleeps and reduces flakiness.',
      },
      {
        term: 'Test independence',
        explanation:
          'The test creates or selects its own data and does not depend on another test running first.',
      },
      {
        term: 'Failure evidence',
        explanation:
          'A trace, screenshot, and clear assertion message that let someone diagnose the failure later.',
      },
    ],
    examples: [
      {
        title: 'Intent-revealing test shape',
        description:
          'The test reads as a user story: go to sign-in, provide credentials, expect the account state.',
        language: 'text',
        code: 'open sign-in page\nfill "Email" with a synthetic account\nfill "Password" with its password\nclick the button named "Sign in"\nexpect the page to show "Signed in as"',
      },
    ],
    steps: [
      {
        title: 'Inspect the accessible names',
        detail:
          'Use the browser accessibility tree to confirm the role and name of each control before writing a locator.',
      },
      {
        title: 'Write the smallest complete journey',
        detail:
          'One test should cover one intention. Avoid mixing sign-in, cart changes, and checkout in a single test.',
      },
      {
        title: 'Replace every sleep with a condition',
        detail:
          'Wait for the specific state the next step needs, such as a visible heading or a completed network response.',
      },
      {
        title: 'Run it repeatedly and alone',
        detail:
          'Run the test three times and then run it in isolation. If it only passes in a particular order, the independence is broken.',
      },
    ],
    expectedResults: [
      'The test passes when run alone and as part of the suite.',
      'Failures point at the broken expectation, not at an arbitrary timeout.',
      'The test still passes after unrelated visual styling changes.',
    ],
    commonMistakes: [
      'Using brittle CSS selectors copied from the browser inspector.',
      'Adding a longer sleep instead of waiting for the correct condition.',
      'Sharing a signed-in session across tests without resetting state.',
    ],
    relatedScenarioIds: ['ui-signin-smoke', 'ui-cart-flakiness'],
  },
  {
    id: 'guide-contract-testing-basics',
    title: 'Contract testing without the ceremony',
    trackId: 'contract-testing',
    level: 'intermediate',
    readingMinutes: 12,
    summary:
      'Capture the promises that matter between a consumer and a provider, then verify them fast.',
    introduction: [
      'Contract testing asks a narrow question: can this consumer and this provider still understand each other? It does not replace end-to-end tests, and it does not verify business rules. Its value is early, precise feedback when an interface changes.',
      'This lab ships three workspaces and a guided catalogue: the validate workspace (assertion-level diagnostics against a fixture or the live contract), the compare workspace (breaking / compatible / review with per-finding rationale), and the consumer workspace (write a minimal expectation and watch the provider verify against it). The best first exercise is contract-bgn-required-01; the best advanced one is contract-adv-consumer-expect-01.',
    ],
    concepts: [
      {
        term: 'Consumer',
        explanation:
          'The application or service that depends on a response. Its needs define the contract.',
      },
      {
        term: 'Provider',
        explanation:
          'The service that supplies the response. It must satisfy every contract that its consumers publish.',
      },
      {
        term: 'Consumer-driven contract',
        explanation:
          'A contract written from the consumer’s perspective. It prevents providers from breaking real usage while still allowing unused fields to change.',
      },
      {
        term: 'Breaking change',
        explanation:
          'A change that removes or alters something a consumer relies on, such as a field rename, type change, or status-code change. Classify it: breaking, backward-compatible, or review-required.',
      },
      {
        term: 'Compatibility rule table',
        explanation:
          'R1–R21: request-side required additions break (R1); response-side property removal breaks (R3); type narrowing breaks (R6); enum widening is always review (R9); annotation-only deltas are never findings (R21).',
      },
    ],
    examples: [
      {
        title: 'Minimal consumer expectation',
        description:
          'Only the fields the POS adapter reads are included — nothing else.',
        language: 'json',
        code: '{\n  "type": "object",\n  "required": ["slug", "name", "priceCents", "currency", "stockStatus"],\n  "properties": {\n    "slug": { "type": "string" },\n    "name": { "type": "string" },\n    "priceCents": { "type": "integer", "minimum": 0 },\n    "currency": { "const": "USD" },\n    "stockStatus": { "enum": ["in_stock", "low_stock", "out_of_stock"] }\n  }\n}',
      },
      {
        title: 'An enum widening is review, never silently compatible',
        description:
          'A provider adding a value is additive; your consumer’s closed switch is what breaks.',
        language: 'text',
        code: 'status: posted | pending | reversed  →  + scheduled\nverdict: REVIEW REQUIRED — closed-set consumers hit the unknown value',
      },
    ],
    steps: [
      {
        title: 'List what the consumer actually reads',
        detail:
          'Trace the consumer code and record only the fields, types, and statuses it depends on.',
      },
      {
        title: 'Write the contract at that boundary',
        detail:
          'Keep the expectation minimal — the rubric (C1–C7) enforces it. Do not include fields that merely happen to exist in a sample response.',
      },
      {
        title: 'Verify the provider',
        detail:
          'Run provider verification against the expectation. A failure should name the field or behaviour that no longer matches — see contract-adv-consumer-broken-01.',
      },
      {
        title: 'Diff the versions before you ship',
        detail:
          'Use the compare workspace on any contract pair (or a pasted candidate) and apply the rule table. Any breaking finding means BREAKING — no voting.',
      },
    ],
    expectedResults: [
      'The contract records the consumer’s real needs, not the provider’s full schema.',
      'Provider verification fails with a precise message on a breaking change.',
      'Adding an unused provider field does not fail the contract.',
      'A compatibility review names rule, path, classification and both perspectives.',
    ],
    commonMistakes: [
      'Copying an entire response example into the contract.',
      'Using contract tests to verify business calculations.',
      'Letting one contract speak for consumers with different needs.',
      'Calling an enum widening "compatible" because the provider only added a value.',
    ],
    relatedScenarioIds: [
      'contract-catalog-consumer',
      'contract-breaking-change',
      'microservices-order-trace',
    ],
  },
  {
    id: 'guide-consumer-driven-contracts',
    title: 'Consumer-driven contracts end to end',
    trackId: 'contract-testing',
    level: 'advanced',
    readingMinutes: 14,
    summary:
      'Write a minimal consumer expectation, verify the provider fixture, and triage the drift when it happens.',
    introduction: [
      'Consumer-driven contracts invert the usual direction: the consumer declares what it needs, and the provider verifies against that declaration. Nothing about the provider’s other fields matters to this contract — the provider may change or drop them freely.',
      'The whole technique stands on one habit: pin only what you read. This guide walks the complete loop with the Meridian Ledger fixtures — author, verify, break, triage.',
    ],
    concepts: [
      {
        term: 'Expectation',
        explanation:
          'The consumer’s JSON Schema (2020-12) over the payload it reads: required critical fields, correct types/consts/enums, no extra pins. It is deliberately open — additionalProperties stays absent.',
      },
      {
        term: 'Verification',
        explanation:
          'The provider fixture payload is validated against your expectation. Pass means this consumer survives this provider today; fail means somebody moved something — the assertion list says where.',
      },
      {
        term: 'Break/fix',
        explanation:
          'Swapping the provider fixture v1 → v2-latest in the workspace shows the same expectation passing, then failing — drill contract-adv-consumer-broken-01 encodes the exact triage.',
      },
      {
        term: 'The C1–C7 rubric',
        explanation:
          'Compiles (10), critical fields required (25), no non-critical required (15), types match (20), open contract (10), passes provider v1 (10), fails the drift (10). 100 is the complete answer; 70 or less is a failing contract.',
      },
    ],
    examples: [
      {
        title: 'The working expectation',
        description:
          'Five critical fields, nothing else — the answer to contract-adv-consumer-expect-01.',
        language: 'json',
        code: '{\n  "type": "object",\n  "required": ["slug", "name", "priceCents", "currency", "stockStatus"],\n  "properties": {\n    "slug": { "type": "string" },\n    "name": { "type": "string" },\n    "priceCents": { "type": "integer", "minimum": 0 },\n    "currency": { "const": "USD" },\n    "stockStatus": { "enum": ["in_stock", "low_stock", "out_of_stock"] }\n  }\n}',
      },
      {
        title: 'Triage when the provider drifts',
        description:
          'Read the failing assertion before you conclude anything.',
        language: 'text',
        code: 'assertion: /categoryName — required — missing\ntriage: the provider renamed the category field (R3) and re-cased an enum member (R9).\nverdict: the expectation is the pin; the fix is provider-side.\naction: coordinate the rename or restore the field; never weaken the pin.',
      },
    ],
    steps: [
      {
        title: 'Author the expectation',
        detail:
          'In /contract/consumer, use guided mode (check the critical fields) or write the raw schema. Verify against provider-product-v1 — it must pass.',
      },
      {
        title: 'Break it on purpose',
        detail:
          'Switch the fixture selector to v2 latest in bug-hunt mode (hunt-contract-007) or to the named drift drill. Read the failing assertions — required and enum — before concluding anything.',
      },
      {
        title: 'Classify and comment',
        detail:
          'R3 (property rename), a provider-side break. The one-line reviewer comment names the side that moved and the fix — restore the documented field or coordinate a version boundary.',
      },
      {
        title: 'Know when not to do this',
        detail:
          'Contract tests do not replace end-to-end tests. They pin interface promises; business correctness belongs elsewhere. When a contract fails, believe it — and check who moved what.',
      },
    ],
    expectedResults: [
      'Your expectation passes provider-product-v1 and fails the drifted payload.',
      'You can say, from the assertion list alone, which side of the contract moved.',
      'Your report names the R-rule and the fix — without touching the expectation.',
    ],
    commonMistakes: [
      'Pinning the entire provider document — minimalism is the technique, not a style.',
      'Weakening the expectation to get a green run — the red run is the evidence.',
      'Using contract verification as an integration test — it checks interface, not business logic.',
      'Blaming the consumer for a provider-side rename.',
    ],
    relatedScenarioIds: [
      'contract-catalog-consumer',
      'contract-breaking-change',
      'contract-hunt-consumer-drift',
    ],
  },
  {
    id: 'guide-auth-session-testing',
    title: 'Testing sessions and access boundaries',
    trackId: 'auth-testing',
    level: 'intermediate',
    readingMinutes: 11,
    summary:
      'Separate authentication from authorisation and test both at the object level.',
    introduction: [
      'Authentication answers “who are you?”. Authorisation answers “what may you do?”. Many test suites check the first and assume the second, which is why object-level access defects survive.',
      'This guide uses two synthetic accounts so every access check has a clear owner and a clear outsider.',
    ],
    concepts: [
      {
        term: 'Session lifetime',
        explanation:
          'The period during which a credential is accepted. Renewal windows and absolute expiry are separate rules.',
      },
      {
        term: 'Rotation',
        explanation:
          'Issuing a new session token after sign-in or renewal. Old tokens should stop working.',
      },
      {
        term: 'Horizontal escalation',
        explanation:
          'A user accesses another user’s object at the same privilege level, usually by changing an identifier.',
      },
      {
        term: 'Vertical escalation',
        explanation:
          'A lower-privilege user performs an action reserved for a higher role.',
      },
    ],
    examples: [
      {
        title: 'Object ownership matrix',
        description:
          'Write the expected outcome before sending any request.',
        language: 'text',
        code: 'Actor        Object            Expected\nAccount A    own order         200\nAccount B    Account A order   403 or 404\nSupport      refund action     403\nSeller       own product edit  200',
      },
    ],
    steps: [
      {
        title: 'Prepare two synthetic accounts',
        detail:
          'Give each account at least one object it owns. Record the identifiers so you can compare outcomes precisely.',
      },
      {
        title: 'Test authentication paths',
        detail:
          'Try valid, invalid, expired, and missing credentials. Capture the exact status and user-facing message.',
      },
      {
        title: 'Test authorisation per object',
        detail:
          'Attempt to read and mutate another account’s object. Check both the UI and the API; hiding a button is not enforcement.',
      },
      {
        title: 'Test logout and renewal',
        detail:
          'Confirm that renewed sessions rotate and that logout invalidates the old credential, not only the local UI state.',
      },
    ],
    expectedResults: [
      'Unauthorised object access is rejected even when the request is sent directly to the API.',
      'Expired sessions fail explicitly and cannot be renewed indefinitely.',
      'Authorisation decisions are consistent across UI and API surfaces.',
    ],
    commonMistakes: [
      'Testing only that a button is hidden, not that the action is rejected.',
      'Reusing one account for every role and missing boundary checks.',
      'Treating a 404 on another user’s object as a failure when it is a valid non-disclosure response.',
    ],
    relatedScenarioIds: [
      'auth-session-expiry',
      'auth-role-boundaries',
      'security-object-access',
      'security-search-input',
      'api-automation-token-refresh',
    ],
  },
  {
    id: 'guide-accessibility-keyboard',
    title: 'Keyboard-first accessibility checks',
    trackId: 'accessibility-testing',
    level: 'beginner',
    readingMinutes: 9,
    summary:
      'A fast, tool-light routine for finding the accessibility problems that block real tasks.',
    introduction: [
      'Accessibility is not a checklist bolted on at the end. If a person cannot complete checkout with a keyboard, the feature is broken for them regardless of how it looks.',
      'This guide starts with keyboard operation because it needs no special software and exposes structural problems quickly. Screen-reader checks add detail once the keyboard path works.',
    ],
    concepts: [
      {
        term: 'Focus order',
        explanation:
          'The sequence in which interactive elements receive focus. It should follow the visual and logical reading order.',
      },
      {
        term: 'Focus visibility',
        explanation:
          'A clearly visible indicator on the currently focused element. Removing outlines without a replacement is a blocker.',
      },
      {
        term: 'Accessible name',
        explanation:
          'The label assistive technology announces for a control. An icon-only button without a name is unusable.',
      },
      {
        term: 'Focus management',
        explanation:
          'Moving focus deliberately when content changes, such as opening a dialog or submitting a form with errors.',
      },
    ],
    examples: [
      {
        title: 'Keyboard route through checkout',
        description:
          'Record the actual focus sequence rather than a general impression.',
        language: 'text',
        code: 'Tab 1 -> skip link\nTab 2 -> brand link\nTab 3 -> cart link\nTab 4 -> quantity field\nEnter -> update quantity\nTab ... -> place order',
      },
    ],
    steps: [
      {
        title: 'Navigate without a pointer',
        detail:
          'Start at the page top, use Tab and Shift+Tab, and try to complete the journey. Do not use the mouse to recover.',
      },
      {
        title: 'Record every focus stop',
        detail:
          'Note the element, whether focus is visible, and whether the order matches the visual layout.',
      },
      {
        title: 'Check custom controls',
        detail:
          'Menus, dialogs, and filter chips must be operable with Enter, Space, Escape, and arrow keys where expected.',
      },
      {
        title: 'Repeat with a screen reader',
        detail:
          'Listen for names, roles, and state. Confirm that result updates and errors are announced without stealing focus.',
      },
    ],
    expectedResults: [
      'Every interactive control is reachable and operable by keyboard.',
      'Focus is always visible and follows a logical order.',
      'Dialogs and menus can be dismissed with Escape and return focus sensibly.',
    ],
    commonMistakes: [
      'Testing with a mouse “just to get unstuck” and hiding the blockage.',
      'Checking that focus exists but not whether it is visible.',
      'Reporting a rule violation without describing the user task it blocks.',
    ],
    relatedScenarioIds: ['a11y-checkout-keyboard', 'a11y-catalog-screenreader'],
  },
  {
    id: 'guide-database-testing-sql',
    title: 'Test databases with queries, not hope',
    trackId: 'database-testing',
    level: 'intermediate',
    readingMinutes: 12,
    summary:
      'A QA-first method for using SQL to prove or disprove data integrity: reconciliation, orphan and duplicate detection, plus the exercise loop used throughout the lab.',
    introduction: [
      'Every screen you test is a rendering of rows you have never seen. Database testing is the discipline of querying those rows directly — before, during and after a user journey — instead of trusting what the interface chose to show.',
      'This guide uses the Meridian Outfitters practice snapshot (the same one you meet in /database) as the worked example: orders, line items, payments and customers, all synthetic and all deliberately seeded with a few documented defects.',
      'The method is always the same four moves: enumerate the invariant, recompute it from the raw parts, diff against what is stored, and bound the blast radius. Everything in this guide is an instance of that loop.',
    ],
    concepts: [
      {
        term: 'Invariant',
        explanation:
          'A statement that must be true for the data to make sense — “total equals subtotal plus shipping and tax”, “every line item references a product”. Tests exist to catch violated invariants, not to admire correct rows.',
      },
      {
        term: 'Reconciliation',
        explanation:
          'Recomputing a stored figure from its parts and comparing. Aggregation errors hide permanently unless you recompute; the stored number can always look plausible on its own.',
      },
      {
        term: 'Anti-join',
        explanation:
          'The pattern for “rows on the left with no matching row on the right” — NOT EXISTS or a LEFT JOIN with the null side selected. This is how orphans and missing children are found.',
      },
      {
        term: 'Normalization for comparison',
        explanation:
          'lower(), trim(), date() and similar functions fold cosmetic differences so duplicates and mismatches become groupable. Raw comparison against unnormalized text misses most real defects.',
      },
      {
        term: 'Blast radius',
        explanation:
          'How much of the dataset is affected — count the broken rows, sum their money, list their ids. A defect report without a blast radius cannot be triaged.',
      },
    ],
    examples: [
      {
        title: 'Reconcile one order',
        description:
          'Recompute the total from parts and diff against storage.',
        language: 'sql',
        code: "SELECT order_number,\n       total_cents,\n       subtotal_cents + shipping_cents + tax_cents AS expected_cents\nFROM orders\nWHERE total_cents <> subtotal_cents + shipping_cents + tax_cents;",
      },
      {
        title: 'Find orphaned line items',
        description:
          'An anti-join is the shortest honest proof of missing references.',
        language: 'sql',
        code: "SELECT oi.id, oi.order_id, oi.product_id\nFROM order_items oi\nWHERE NOT EXISTS (\n  SELECT 1 FROM products p WHERE p.id = oi.product_id\n);",
      },
      {
        title: 'Spot duplicate-looking customers',
        description:
          'Normalize before grouping, or the constraint saves you from seeing them.',
        language: 'sql',
        code: "SELECT lower(trim(email)) AS email_key, count(*) AS copies\nFROM customers\nGROUP BY email_key\nHAVING count(*) > 1;",
      },
    ],
    steps: [
      {
        title: 'Enumerate the invariants',
        detail:
          'Before opening a tool, list what must be true: totals reconcile, references resolve, statuses are legal, money is integer cents, timestamps are ISO-8601 UTC. Five lines is enough.',
      },
      {
        title: 'Recompute from the parts',
        detail:
          'Write the query that derives the expected value from raw inputs — never compare a stored figure to itself, and never compare line totals to order totals without going through subtotal.',
      },
      {
        title: 'Diff and bound',
        detail:
          'Filter to the disagreements, count them, sum their money, and list the ids. That four-tuple — ids, count, sum, shape — is the defect report the business can act on.',
      },
      {
        title: 'Reset and verify the boundary',
        detail:
          'Use the lab’s reset to confirm the same drift class appears (or does not) in the clean snapshot. Deterministic reproduction beats anecdotal evidence.',
      },
    ],
    expectedResults: [
      'You can state every invariant you checked, and which query proves it.',
      'Every anomaly you report carries count, ids and summed impact.',
      'Your clone of the check passes on the clean snapshot and fails on the broken one.',
    ],
    commonMistakes: [
      'Trusting aggregates because they “look right” — plausibility is not verification.',
      'Counting rows instead of testing invariants — a clean count can still hide a consistent lie.',
      'Comparing stored text without normalizing — case and whitespace hide the real duplicates.',
      'Reporting one exemplar row instead of the full affected cohort.',
    ],
    relatedScenarioIds: ['db-order-consistency', 'db-orphaned-carts', 'db-line-totals'],
  },
  {
    id: 'guide-performance-testing',
    title: 'Measure first: the performance testing ladder',
    trackId: 'performance-testing',
    level: 'beginner',
    readingMinutes: 11,
    summary:
      'A practical ladder from baseline to stress testing, with the metrics that actually decide release readiness — and the honest limits of browser-measured runs.',
    introduction: [
      'Performance work starts before anyone is allowed to be excited: first you prove what normal looks like, then you change something, then you prove whether normal still holds. This guide is the ladder — baseline, load, stress, spike, soak — and the reading of the numbers at each rung.',
      'The worked example is the Meridian Outfitters catalogue: the same endpoints you measure in /performance. The runner there is real and bounded (≤ 8 virtual users, ≤ 30 seconds, first-party allowlist) — everything in this guide is doable with it.',
      'Two habits separate useful performance testers from loud ones. First, every number gets conditions attached (endpoint, data, environment, duration). Second, tail metrics — p95 and p99 — decide arguments, not averages.',
    ],
    concepts: [
      {
        term: 'Baseline',
        explanation:
          'A fixed, comparable measurement of the unchanged system: same endpoint, same data, same environment, recorded p50/p95 and error rate. Without it, every later number is vibes.',
      },
      {
        term: 'Saturation knee',
        explanation:
          'The concurrency at which throughput stops rising while latency keeps climbing. It is the single most useful “how much can we take” signal you can draw on a graph.',
      },
      {
        term: 'Tail latency',
        explanation:
          'p95 leaves 5% of requests above it; p99 leaves 1%. Tail values expose what averages hide — and below ~20 samples they are noise, not evidence.',
      },
      {
        term: 'Error budget',
        explanation:
          'The tolerated share of failed requests for a change to ship. Every run in this lab reports the status-class split so the budget can be read honestly.',
      },
    ],
    examples: [
      {
        title: 'Reading your first run',
        description:
          'A 2-VU run shows avg 180 ms, median 150 ms, p95 420 ms, p99 n/a (n=14), 0.4% errors. Honest read: typical experience is fine, tail risk is unknown, errors are low but must be classified by status before any ship decision.',
        language: 'text',
        code: 'avg 180 ms · median 150 ms · p95 420 ms · p99 n/a (n=14) · errors 0.4%',
      },
      {
        title: 'The page-9 cliff',
        description:
          'Page 1: 80 ms. Page 9: 900 ms for the same 12 rows. Offset pagination discards 96 rows before returning; keyset pagination seeks instead. This is the defect class hunt-perf-002 reproduces.',
        language: 'text',
        code: 'page=1 → 80 ms · page=4 → 700 ms · page=9 → 900 ms (same 12 rows)',
      },
    ],
    steps: [
      {
        title: 'Pin the conditions',
        detail: 'Choose the endpoint, the dataset, the environment and the duration — write them down before you run anything.',
      },
      {
        title: 'Run the ladder in order',
        detail: 'Baseline (1 VU) → load (2–4 VUs) → stress (6–8 VUs) → spike (jump to max fast) → soak-lite (30 s window). One change at a time.',
      },
      {
        title: 'Classify the failures',
        detail: 'Split errors by status class and count timeouts separately — a fast-failing error budget is not free, and a timeout consumes resources without producing a response.',
      },
      {
        title: 'Report with conditions',
        detail: 'Quote median + p95 together, the sample size, and the exact run configuration. Download the Markdown report; attach conditions to every number.',
      },
    ],
    expectedResults: [
      'A baseline table with p50/p95 and error split for the unchanged endpoint.',
      'A stress run showing the saturation knee and the error budget consumption at it.',
      'A report that names its conditions, sample size and limitations.',
    ],
    commonMistakes: [
      'Optimising before the baseline exists.',
      'Quoting the average and ignoring the tail shape entirely.',
      'Locking onto throughput while the error budget quietly burns.',
      'Claiming capacity without naming conditions, or from a single peak run.',
    ],
    relatedScenarioIds: ['perf-slow-catalogue', 'perf-deep-pagination', 'perf-n-plus-one'],
  },
  {
    id: 'guide-security-testing',
    title: 'Break it safely: a field method for security testing',
    trackId: 'security-testing',
    level: 'beginner',
    readingMinutes: 12,
    summary:
      'How to hunt the vulnerability classes that recur in real applications — authn, authz, sessions, input and exposure — using only synthetic targets, and how to write the finding so it gets fixed.',
    introduction: [
      'Security testing is not a bag of payloads; it is a set of claims about what the system must never allow, verified adversarially. This guide walks the classes that recur in web APIs — broken access control, weak session handling, input handling, sensitive data exposure, and missing rate limiting — all against synthetic targets.',
      'The worked environment is the Meridian Outfitters practice shop, with its three security bug hunts: an overshared profile response, an unenforced login failure budget, and internal diagnostics leaking into error responses. Each activates only in your bug-hunt session.',
      'Two rules are not negotiable in this lab: you test only what you were given, and you report what you can prove. A finding without reproduction steps is a rumour; evidence is the difference between a ticket and a fix.',
    ],
    concepts: [
      {
        term: 'BOLA (IDOR)',
        explanation:
          'Broken object-level authorization: the API checks that you are signed in but not that the object is yours. Two synthetic accounts and one guessable reference is the whole test.',
      },
      {
        term: 'Excessive data exposure',
        explanation:
          'The response carries more than the client needs — other users’ references, internal annotations, diagnostics. The fix is allowlist serialization at the boundary, not CSS.',
      },
      {
        term: 'Failure budget',
        explanation:
          'A hard per-IP/account cap on failed attempts (here: 5/minute). When the cap is skipped, credential stuffing replaces guessing. That is hunt-sec-002.',
      },
      {
        term: 'Evidence-driven reporting',
        explanation:
          'Steps, observed vs expected, impact, remediation — scored on evidence quality. “It seems insecure” is not a finding; a diffed response body is.',
      },
    ],
    examples: [
      {
        title: 'The two-account probe',
        description:
          'Account A creates an order. Account B requests it by reference. Correct server: non-enumerable 404 or equivalent. Hunt-session server: the order arrives. That single request pair proves BOLA or its absence.',
        language: 'text',
        code: 'A: POST /api/v1/checkout → ORD-DEMO-1 · B: GET /api/v1/auth/me — B: GET /api/v1/account/orders/ORD-DEMO-1 → 404 (clean) / 200 (hunt)',
      },
      {
        title: 'The tenth wrong password',
        description:
          'Fire nine wrong passwords at the demo login. In clean mode the sixth is refused with 429. In hunt mode all ten are answered 401 — the budget is decorative, not enforced.',
        language: 'text',
        code: 'attempts 1–5: 401 · attempt 6 (clean): 429 login_rate_limited · (hunt): 401 … 1..10 all 401',
      },
    ],
    steps: [
      {
        title: 'Inventory the boundary',
        detail: 'List the routes, then mark each: authenticated? authorized for whom? what does it return?',
      },
      {
        title: 'Probe with two accounts',
        detail: 'Every object-scoped route gets called as its owner and as a stranger. Diff the two responses.',
      },
      {
        title: 'Push the edges',
        detail: 'Wrong credentials past the budget, verbose error paths, overshared profile fields — attack the shape, not the payload.',
      },
      {
        title: 'Report like an engineer',
        detail: 'Steps, observed vs expected, classification, impact, remediation — and verify the fix in clean mode.',
      },
    ],
    expectedResults: [
      'A two-account authorization matrix with pass/fail per object verb.',
      'A captured diff of the overshared profile response.',
      'A bug report whose evidence would convince a skeptical reviewer.',
    ],
    commonMistakes: [
      'Testing only as the happy-path user.',
      'Calling a leak “cosmetic” because the field looks harmless.',
      'Reporting without reproduction steps and observed-vs-expected.',
      'Forgetting to verify the fix landed in clean mode.',
    ],
    relatedScenarioIds: ['security-overexposed-profile', 'security-brute-force', 'security-verbose-errors'],
  },
  {
    id: 'guide-event-driven-testing',
    title: 'Testing events, not just APIs: a distributed-systems field guide',
    trackId: 'async-testing',
    level: 'intermediate',
    readingMinutes: 12,
    summary:
      'Why request/response testing misses the failures that page you at 3 a.m. — and how to test delivery, idempotency, ordering, retries, dead letters and eventual consistency in a deterministic simulator.',
    introduction: [
      'Event-driven systems fail differently: messages arrive twice, arrive early, or never arrive — and the ledger silently disagrees with the warehouse. This guide covers the mechanics: at-least-once delivery, idempotent consumers, backoff-with-cap retry, poison messages, dead-letter queues, correlation ids, and eventual consistency you can audit.',
      'The worked environment is the Meridian Outfitters order pipeline in /microservices/simulator: order.created → inventory.reserved → payment.processed → webhook delivery. It is a deterministic simulation on this site’s database — not a production broker — built exactly so every failure below is reproducible on demand.',
      'Learn the probe moves: publish with a drill, process, redeliver, replay, audit. That is the whole craft; the rest is reading what the counters tell you.',
    ],
    concepts: [
      {
        term: 'At-least-once delivery',
        explanation:
          'Messages are never lost but may arrive more than once. Exactly-once is not a wire property — it is at-least-once plus idempotent consumers.',
      },
      {
        term: 'Idempotent consumer',
        explanation:
          'Processing the same event twice must equal processing it once. The dedup marker (event id) must commit in the same transaction as the side effect.',
      },
      {
        term: 'Dead-letter queue',
        explanation:
          'Where undeliverable messages go to be triaged: poison (never retries), transient (retries with cap, then DLQ), data (fix the data, replay). DLQ depth is an alert, not a bin.',
      },
      {
        term: 'Eventual consistency',
        explanation:
          'Services converge after a bounded delay. The window is a design input: pending states in the UI, read-your-writes for the buyer, and a periodic consistency audit to catch drift.',
      },
    ],
    examples: [
      {
        title: 'The double-charged payment',
        description:
          'Process an order to capture; press Retry on the reservation event; process again. In clean mode the dedup marker no-ops; in hunt-event-001 the marker is skipped — captured_count and cents climb twice.',
        language: 'text',
        code: 'process → captured 1 · retry reservation · process → captured 2 (hunt) / captured 1 (clean)',
      },
      {
        title: 'The retry storm',
        description:
          'payment-always-fails with collapsed backoff: every process call schedules the retry immediately. Against a sick gateway, that is the difference between recovery and outage amplification.',
        language: 'text',
        code: 'attempt 1 fails → attempt 2 due immediately (hunt) / +1s (clean) · attempt 3 → +2s',
      },
    ],
    steps: [
      {
        title: 'Drive the happy path',
        detail: 'Publish order.created and process until the payment is captured and the webhook is delivered — watch the counters and the trace.',
      },
      {
        title: 'Inject one failure at a time',
        detail: 'Transient payment (2 failures then success), always-fails (DLQ after 3), webhook-timeout (2 timeouts then delivery), inventory-delay (5-second convergence window).',
      },
      {
        title: 'Redeliver and replay',
        detail: 'Force a duplicate and watch the dedup marker answer it; replay the DLQ after the dependency “recovers”.',
      },
      {
        title: 'Audit the invariant',
        detail: 'Run the consistency check: paid ∧ reserved, captured ≤ total, webhook delivered for every captured payment. Fix, re-audit, prove.',
      },
    ],
    expectedResults: [
      'A correlated trace of one full order pipeline with all four event types.',
      'A duplicate delivery observed as a no-op (clean) and as a double-apply (hunt).',
      'A consistency report before and after remediation.',
    ],
    commonMistakes: [
      'Treating exactly-once as a broker flag to switch on.',
      'Writing the dedup marker after the side effect instead of with it.',
      'Replaying a DLQ blind — retry is a decision, not a button.',
      'Declaring consistency fixed without re-running the audit.',
    ],
    relatedScenarioIds: ['event-duplicate-payment', 'event-retry-storm', 'event-out-of-order'],
  },
]

export const guidesById = new Map(guides.map((guide) => [guide.id, guide]))

export function getGuide(guideId: string): Guide | undefined {
  return guidesById.get(guideId)
}

export function getGuidesForTrack(trackId: string): Guide[] {
  return guides.filter((guide) => guide.trackId === trackId)
}

export function getGuidesForScenario(scenarioId: string): Guide[] {
  return guides.filter((guide) => guide.relatedScenarioIds.includes(scenarioId))
}
