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
    level: 'advanced',
    readingMinutes: 12,
    summary:
      'Capture the promises that matter between a consumer and a provider, then verify them fast.',
    introduction: [
      'Contract testing asks a narrow question: can this consumer and this provider still understand each other? It does not replace end-to-end tests, and it does not verify business rules. Its value is early, precise feedback when an interface changes.',
      'A good contract is small. It contains what the consumer uses, not everything the provider can return.',
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
          'A change that removes or alters something a consumer relies on, such as a field rename, type change, or status-code change.',
      },
    ],
    examples: [
      {
        title: 'Minimal consumer expectation',
        description:
          'Only the fields the search results screen reads are included.',
        language: 'json',
        code: '{\n  "consumer": "catalogue-search",\n  "provider": "catalogue-api",\n  "request": { "path": "/catalogue", "query": { "category": "audio" } },\n  "response": {\n    "status": 200,\n    "body": { "items": [{ "id": "string", "name": "string", "price": "number" }] }\n  }\n}',
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
          'Keep the expectation minimal. Do not include fields that merely happen to exist in a sample response.',
      },
      {
        title: 'Verify the provider',
        detail:
          'Run provider verification against the contract. A failure should name the field or behaviour that no longer matches.',
      },
      {
        title: 'Change one thing deliberately',
        detail:
          'Rename a field in a safe environment and confirm the contract fails before an end-to-end test does.',
      },
    ],
    expectedResults: [
      'The contract records the consumer’s real needs, not the provider’s full schema.',
      'Provider verification fails with a precise message on a breaking change.',
      'Adding an unused provider field does not fail the contract.',
    ],
    commonMistakes: [
      'Copying an entire response example into the contract.',
      'Using contract tests to verify business calculations.',
      'Letting one contract speak for consumers with different needs.',
    ],
    relatedScenarioIds: [
      'contract-catalog-consumer',
      'contract-breaking-change',
      'microservices-order-trace',
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
