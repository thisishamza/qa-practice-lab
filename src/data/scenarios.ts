import { HUNT_CURRICULUM } from '../shared/huntCurriculum'
import type { Scenario } from './types'

/**
 * Phase 2 catalogue placeholders. Each track lists two representative scenarios so
 * the content structure and UI can be validated before exercises are implemented.
 * Every entry is explicitly non-runnable.
 */
export const scenarios: Scenario[] = [
  {
    id: 'manual-cart-totals',
    title: 'Bug hunt: order line totals at checkout',
    summary:
      'A live defect report says the confirmation line totals do not match the quantities ordered. Investigate and pin down the mismatch.',
    description:
      'Add products to the cart with quantities greater than one and place an order in the Meridian Outfitters practice shop. Compare unit price, quantity and the line totals shown on the order confirmation. The inconsistency is deterministic and reproducible — find it, prove it with evidence, and report it as a bug.',
    trackId: 'manual-testing',
    categoryId: 'exploratory',
    difficulty: 'beginner',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 30,
    objectives: [
      'Compare unit price × quantity with the line totals shown after checkout.',
      'Reproduce the mismatch deterministically and isolate the affected step.',
      'Write a bug report with steps, expected and actual totals, and impact.',
    ],
    prerequisites: ['Start the bug-hunt exercise below', 'No tooling required'],
    runnable: true,
    huntId: 'hunt-pricing-001',
    curriculum: HUNT_CURRICULUM['hunt-pricing-001'],
    relatedGuideIds: ['guide-manual-test-design'],
  },
  {
    id: 'manual-address-edge-cases',
    title: 'Bug hunt: checkout accepts a blank customer name',
    summary:
      'A live defect report says the checkout validation lets a blank customer name through.',
    description:
      'A synthetic defect report claims that some impossible customer names pass checkout validation while everything else is handled normally. Probe the validation boundary with a valid baseline, then find the smallest input that should be rejected but passes. Document it precisely.',
    trackId: 'manual-testing',
    categoryId: 'exploratory',
    difficulty: 'intermediate',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 35,
    objectives: [
      'Reproduce the reported acceptance of an impossible customer name.',
      'Distinguish a validation defect from permissive-but-intended formatting.',
      'Write a bug report with input, environment, expected, and actual results.',
    ],
    prerequisites: ['An HTTP client or browser dev tools', 'Start the bug-hunt exercise below'],
    runnable: true,
    huntId: 'hunt-checkout-001',
    curriculum: HUNT_CURRICULUM['hunt-checkout-001'],
    relatedGuideIds: ['guide-manual-test-design'],
  },
  {
    id: 'manual-shop-search',
    title: 'Bug hunt: shop search misses products that should match',
    summary:
      'A live defect report says the shop search returns nothing for some sensible queries.',
    description:
      'Shoppers report that searching for a phrase which literally appears in a product’s description returns no products, while other queries work fine. Work out which searches fail and why, distinguish it from genuinely absent products, and report the mismatch with evidence.',
    trackId: 'manual-testing',
    categoryId: 'exploratory',
    difficulty: 'intermediate',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 30,
    objectives: [
      'Reproduce the missing results with description-only search terms.',
      'Compare name matches with description matches to bound the fault.',
      'Write a bug report with the query, expected results, and actual results.',
    ],
    prerequisites: ['Start the bug-hunt exercise below', 'Complete the cart totals exercise'],
    runnable: true,
    huntId: 'hunt-catalogue-001',
    curriculum: HUNT_CURRICULUM['hunt-catalogue-001'],
    relatedGuideIds: ['guide-manual-test-design'],
  },
  {
    id: 'api-catalogue-filters',
    title: 'Bug hunt: the category filter changes nothing',
    summary:
      'A live defect report says filtering by category still returns every product.',
    description:
      'Exercise the catalogue endpoint with an explicit category parameter and compare the response with the unfiltered list. The parameter appears in the request and the response shape is normal, but one filter never narrows the result. Find where the narrowing is lost and report it with a minimal request.',
    trackId: 'api-testing',
    categoryId: 'functional',
    difficulty: 'beginner',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 30,
    objectives: [
      'Replay the same request with and without the category parameter.',
      'Confirm the response rows and totals ignore the category narrowing.',
      'Write a bug report with the request, expected, and actual results.',
    ],
    prerequisites: ['An HTTP client or curl', 'Read the catalogue endpoint contract', 'Start the bug-hunt exercise below'],
    runnable: true,
    huntId: 'hunt-catalogue-002',
    curriculum: HUNT_CURRICULUM['hunt-catalogue-002'],
    relatedGuideIds: ['guide-api-request-response'],
  },
  {
    id: 'manual-cart-add-quantity',
    title: 'Bug hunt: adding the same item again does not add up',
    summary:
      'A live defect report says re-adding an item leaves the quantity unchanged.',
    description:
      'Add an item to the cart, then add it again. The quantity should accumulate with each add; instead one shopper-facing action appears to do nothing. Investigate whether the fault is in the page, the request, or the cart state, and report what you find with quantities before and after.',
    trackId: 'manual-testing',
    categoryId: 'functional',
    difficulty: 'beginner',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 25,
    objectives: [
      'Reproduce the non-accumulating quantity deterministically.',
      'Isolate whether the issue is client-side, network, or server-side state.',
      'Write a bug report with steps, expected, actual, and impact.',
    ],
    prerequisites: ['Start the bug-hunt exercise below', 'No tooling required'],
    runnable: true,
    huntId: 'hunt-cart-001',
    curriculum: HUNT_CURRICULUM['hunt-cart-001'],
    relatedGuideIds: ['guide-manual-test-design'],
  },
  {
    id: 'api-checkout-exact-stock',
    title: 'Bug hunt: checkout refuses the exact remaining stock',
    summary:
      'A live defect report says ordering exactly the last units returns a stock error.',
    description:
      'Find a product with a small remaining quantity, order precisely that many units, and place an approved checkout. The error claims insufficient stock even though the cart matches what is available — that contradiction is the evidence. Compare with a lower quantity and document the boundary.',
    trackId: 'api-testing',
    categoryId: 'functional',
    difficulty: 'intermediate',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 35,
    objectives: [
      'Identify a product whose full remaining stock you can order.',
      'Reproduce the rejection for the exact boundary quantity.',
      'Write a bug report with the request, the error envelope, and the impact.',
    ],
    prerequisites: ['An HTTP client or browser dev tools', 'Start the bug-hunt exercise below'],
    runnable: true,
    huntId: 'hunt-inventory-001',
    curriculum: HUNT_CURRICULUM['hunt-inventory-001'],
    relatedGuideIds: ['guide-api-request-response'],
  },
  {
    id: 'api-catalog-pagination',
    title: 'Validate catalogue pagination and filters',
    summary:
      'Exercise list endpoints with page sizes, cursors, and combined filters to verify stable pagination.',
    description:
      'Use the catalogue endpoints to confirm that page boundaries do not duplicate or skip records. Compare filtered results with unfiltered totals and check how the API reports invalid parameters.',
    trackId: 'api-testing',
    categoryId: 'functional',
    difficulty: 'beginner',
    mode: 'clean',
    status: 'ready',
    estimatedMinutes: 30,
    objectives: [
      'Verify page size limits and out-of-range page values.',
      'Check filter combinations for consistent totals and ordering.',
      'Confirm error responses use the documented envelope.',
    ],
    prerequisites: [
      'The API Lab (built into this site) or any HTTP client',
      'Read the catalogue endpoint contract in the API Reference',
    ],
    runnable: true,
    relatedGuideIds: ['guide-api-request-response'],
  },
  {
    id: 'api-order-idempotency',
    title: 'Bug hunt: duplicate orders from retried checkout requests',
    summary:
      'Probe an idempotency claim by replaying checkout requests and inspecting the resulting orders.',
    description:
      'The checkout endpoint advertises idempotent retries. Replay the same request with and without the idempotency key, then compare order counts and response bodies. Decide whether the defect is in the API, the client contract, or the documentation.',
    trackId: 'api-testing',
    categoryId: 'exploratory',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'in-design',
    estimatedMinutes: 45,
    objectives: [
      'Reproduce duplicate order creation with a controlled replay.',
      'Evaluate idempotency-key reuse and conflict handling.',
      'Report the defect with request evidence and expected semantics.',
    ],
    prerequisites: ['Complete the pagination exercise', 'Understand HTTP retry semantics'],
    runnable: false,
    relatedGuideIds: ['guide-api-request-response'],
  },
  {
    id: 'ui-signin-smoke',
    title: 'Automate the account sign-in smoke path',
    summary:
      'Create a first browser test using accessible locators and an explicit signed-in assertion.',
    description:
      'Build a small but resilient sign-in test. The exercise focuses on role-based locators, deterministic setup, and an assertion that proves the session actually changed rather than only that a button was clicked.',
    trackId: 'ui-automation',
    categoryId: 'automation',
    difficulty: 'beginner',
    mode: 'clean',
    status: 'planned',
    estimatedMinutes: 35,
    objectives: [
      'Locate form controls by accessible role and name.',
      'Assert the signed-in state instead of a transient UI detail.',
      'Run the test independently of other scenarios.',
    ],
    prerequisites: ['Node.js and a browser automation runtime', 'Basic TypeScript'],
    runnable: false,
    relatedGuideIds: ['guide-ui-automation-first-test'],
  },
  {
    id: 'ui-cart-flakiness',
    title: 'Bug hunt: diagnose a flaky cart quantity test',
    summary:
      'Investigate an intermittently failing automation test and find the real source of instability.',
    description:
      'A cart test passes locally but fails in CI. Inspect the waits, locators, and shared state, then decide whether the fix belongs in the test, the application, or the test environment. Retrying the failure is not an acceptable answer.',
    trackId: 'ui-automation',
    categoryId: 'exploratory',
    difficulty: 'intermediate',
    mode: 'bug-hunt',
    status: 'in-design',
    estimatedMinutes: 40,
    objectives: [
      'Identify fixed sleeps and race conditions in the test.',
      'Reproduce the failure under constrained timing.',
      'Propose a deterministic fix and explain why it works.',
    ],
    prerequisites: ['Complete the sign-in smoke exercise', 'Ability to read a test trace'],
    runnable: false,
    relatedGuideIds: ['guide-ui-automation-first-test'],
  },
  {
    id: 'api-automation-schema-suite',
    title: 'Build a reusable response-schema assertion suite',
    summary:
      'Create a small typed assertion layer and apply it to several catalogue responses.',
    description:
      'Replace repeated ad-hoc checks with a reusable schema helper. The exercise emphasises failure messages that identify the exact field and endpoint, so the suite is useful when it fails, not only when it passes.',
    trackId: 'api-automation',
    categoryId: 'automation',
    difficulty: 'intermediate',
    mode: 'clean',
    status: 'planned',
    estimatedMinutes: 40,
    objectives: [
      'Encapsulate request setup in a reusable client.',
      'Assert response shape and domain invariants together.',
      'Produce failure output that names the offending field.',
    ],
    prerequisites: ['Complete the API pagination exercise', 'Comfortable with TypeScript generics'],
    runnable: false,
    relatedGuideIds: ['guide-api-request-response'],
  },
  {
    id: 'api-automation-token-refresh',
    title: 'Bug hunt: automation blind spots in token refresh',
    summary:
      'Find why an API suite that passes locally fails after short-lived credentials expire.',
    description:
      'The automation suite assumes a token remains valid for the whole run. Introduce expiry and observe how the client behaves. The defect may be in the suite, but only evidence from the request log can prove it.',
    trackId: 'api-automation',
    categoryId: 'exploratory',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'planned',
    estimatedMinutes: 45,
    objectives: [
      'Reproduce the failure with an expired credential.',
      'Trace where refresh should occur and where it currently does not.',
      'Harden the suite without masking genuine authentication errors.',
    ],
    prerequisites: ['Response-schema suite exercise', 'Understanding of bearer tokens'],
    runnable: false,
    relatedGuideIds: ['guide-api-request-response', 'guide-auth-session-testing'],
  },
  {
    id: 'db-order-consistency',
    title: 'Verify order and line-item consistency',
    summary:
      'Compare checkout results with stored rows and prove that totals reconcile.',
    description:
      'After completing a synthetic order, query the order and line-item records. Check that stored subtotals, tax, and totals reconcile, and that every line item references a valid product snapshot.',
    trackId: 'database-testing',
    categoryId: 'data',
    difficulty: 'intermediate',
    mode: 'clean',
    status: 'planned',
    estimatedMinutes: 35,
    objectives: [
      'Map a checkout action to the rows it creates.',
      'Reconcile stored totals against the order summary.',
      'Check referential integrity for line items and products.',
    ],
    prerequisites: ['Read the database schema', 'Basic SQL SELECT and JOIN'],
    runnable: false,
    relatedGuideIds: [],
  },
  {
    id: 'db-orphaned-carts',
    title: 'Bug hunt: orphaned cart rows after cancellation',
    summary:
      'Investigate records left behind when a checkout is cancelled at different stages.',
    description:
      'Cancel checkout at several points and inspect cart, reservation, and order tables. Determine whether leftover rows are harmless history or evidence of an incomplete state transition.',
    trackId: 'database-testing',
    categoryId: 'exploratory',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'in-design',
    estimatedMinutes: 40,
    objectives: [
      'Reproduce orphaned records with a defined cancellation sequence.',
      'Distinguish intended audit history from leaked state.',
      'Document the defect with before-and-after query output.',
    ],
    prerequisites: ['Order consistency exercise', 'Comfortable writing JOIN queries'],
    runnable: false,
    relatedGuideIds: [],
  },
  {
    id: 'contract-catalog-consumer',
    title: 'Write a consumer contract for catalogue search',
    summary:
      'Capture only the response fields a search consumer truly depends on.',
    description:
      'Model a consumer that lists products by category. Write the smallest contract that still expresses its needs, then verify the provider and confirm unrelated fields can change freely.',
    trackId: 'contract-testing',
    categoryId: 'integration',
    difficulty: 'intermediate',
    mode: 'clean',
    status: 'planned',
    estimatedMinutes: 35,
    objectives: [
      'Identify consumer-critical fields and their types.',
      'Keep the contract minimal and intention-revealing.',
      'Verify the provider against the contract.',
    ],
    prerequisites: ['Read the catalogue API contract', 'Basic JSON schema knowledge'],
    runnable: false,
    relatedGuideIds: ['guide-contract-testing-basics'],
  },
  {
    id: 'contract-breaking-change',
    title: 'Bug hunt: detect a breaking field rename',
    summary:
      'Catch a provider change that passes integration tests but breaks a real consumer.',
    description:
      'A provider renames a response field while keeping an alias for compatibility. Determine whether existing tests detect the change and write the contract that would have failed first.',
    trackId: 'contract-testing',
    categoryId: 'exploratory',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'planned',
    estimatedMinutes: 35,
    objectives: [
      'Classify the rename as additive, breaking, or ambiguous.',
      'Show why the existing integration test still passes.',
      'Add a contract assertion that fails on the breaking change.',
    ],
    prerequisites: ['Consumer contract exercise', 'Experience reading API diffs'],
    runnable: false,
    relatedGuideIds: ['guide-contract-testing-basics'],
  },
  {
    id: 'perf-catalog-baseline',
    title: 'Measure catalogue latency against a defined baseline',
    summary:
      'Establish p50 and p95 latency for catalogue search with a repeatable local profile.',
    description:
      'Define a realistic goal, run a short warm-up and steady-state profile against the first-party lab target, and report results with environment details. Averages alone are not an acceptable result.',
    trackId: 'performance-testing',
    categoryId: 'nonfunctional',
    difficulty: 'intermediate',
    mode: 'clean',
    status: 'planned',
    estimatedMinutes: 40,
    objectives: [
      'Set latency and error-rate goals before measuring.',
      'Run a repeatable load profile with warm-up.',
      'Report percentiles and environment constraints together.',
    ],
    prerequisites: ['A local load-testing tool', 'Read the performance safety rules'],
    runnable: false,
    relatedGuideIds: [],
  },
  {
    id: 'perf-checkout-regression',
    title: 'Bug hunt: investigate a checkout latency regression',
    summary:
      'Find the cause of a slower checkout with evidence from client, server, and data layers.',
    description:
      'Checkout latency has doubled after a release. Compare a baseline against the current build and isolate whether time is spent in the browser, the API, or a dependent query. The exercise rewards a hypothesis-driven approach over broad load generation.',
    trackId: 'performance-testing',
    categoryId: 'exploratory',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'in-design',
    estimatedMinutes: 50,
    objectives: [
      'Reproduce the regression with a comparable load profile.',
      'Localise the slowdown to a specific layer.',
      'Present a finding with before-and-after evidence.',
    ],
    prerequisites: ['Catalogue baseline exercise', 'Ability to read timing traces'],
    runnable: false,
    relatedGuideIds: [],
  },
  {
    id: 'security-object-access',
    title: 'Probe object-level access control',
    summary:
      'Test whether one synthetic account can read another account’s order by changing an identifier.',
    description:
      'Authenticate as two synthetic users and attempt to access each other’s orders through documented endpoints. Focus on object-level authorisation rather than route-level access, and stop as soon as the behaviour is proven.',
    trackId: 'security-testing',
    categoryId: 'security-access',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 40,
    objectives: [
      'Test authorisation per object, not only per route.',
      'Compare responses for owned and unowned identifiers.',
      'Write a finding with impact, evidence, and severity.',
    ],
    prerequisites: ['Two synthetic demo accounts (see the lab README)', 'Start the bug-hunt exercise below'],
    runnable: true,
    huntId: 'hunt-authz-001',
    curriculum: HUNT_CURRICULUM['hunt-authz-001'],
    relatedGuideIds: ['guide-auth-session-testing'],
  },
  {
    id: 'security-search-input',
    title: 'Bug hunt: reflected input handling in catalogue search',
    summary:
      'Evaluate whether search input is safely handled across response, storage, and logs.',
    description:
      'Use bounded, non-destructive payloads to see how the catalogue search reflects and stores input. The goal is to identify unsafe handling and recommend a fix; exploitation beyond proof of concept is out of scope.',
    trackId: 'security-testing',
    categoryId: 'exploratory',
    difficulty: 'intermediate',
    mode: 'bug-hunt',
    status: 'in-design',
    estimatedMinutes: 35,
    objectives: [
      'Identify where input is reflected or persisted.',
      'Prove unsafe handling with a minimal, harmless payload.',
      'Recommend encoding and validation at the correct layer.',
    ],
    prerequisites: ['Object access exercise', 'Understanding of output encoding'],
    runnable: false,
    relatedGuideIds: ['guide-auth-session-testing'],
  },
  {
    id: 'microservices-order-trace',
    title: 'Trace an order across catalogue, cart, and payments',
    summary:
      'Map a single checkout to the services and messages it touches, then verify each boundary.',
    description:
      'Follow one successful order from cart submission to confirmation. Identify synchronous calls, asynchronous events, and the correlation identifiers that tie them together. The deliverable is a traceable map plus boundary-level checks.',
    trackId: 'microservices-testing',
    categoryId: 'integration',
    difficulty: 'advanced',
    mode: 'clean',
    status: 'planned',
    estimatedMinutes: 50,
    objectives: [
      'Draw the service and message path for checkout.',
      'Verify each boundary with a targeted check.',
      'Use correlation identifiers to connect logs and traces.',
    ],
    prerequisites: ['Read the service overview', 'Basic log and trace navigation'],
    runnable: false,
    relatedGuideIds: ['guide-contract-testing-basics'],
  },
  {
    id: 'microservices-payment-timeout',
    title: 'Bug hunt: graceful degradation when payments time out',
    summary:
      'Test what the checkout journey does when a dependency becomes slow and then unavailable.',
    description:
      'Introduce a controlled timeout in the payments dependency and observe the user-facing outcome. Determine whether the system fails safely, retries forever, or leaves an ambiguous order state.',
    trackId: 'microservices-testing',
    categoryId: 'exploratory',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'in-design',
    estimatedMinutes: 50,
    objectives: [
      'Introduce a controlled dependency failure.',
      'Observe user-facing and persisted states during the failure.',
      'Decide whether recovery is safe, ambiguous, or lost.',
    ],
    prerequisites: ['Order trace exercise', 'Access to the lab fault controls'],
    runnable: false,
    relatedGuideIds: [],
  },
  {
    id: 'async-order-confirmation',
    title: 'Verify the order-confirmation event pipeline',
    summary:
      'Prove that a checkout event produces the expected confirmation state without relying on sleeps.',
    description:
      'Checkout emits an order event that feeds confirmation email and order history. Define the observable outcome, wait deterministically for it, and verify that the event is processed exactly once.',
    trackId: 'async-testing',
    categoryId: 'integration',
    difficulty: 'intermediate',
    mode: 'clean',
    status: 'planned',
    estimatedMinutes: 40,
    objectives: [
      'Define a user-visible signal that proves event processing.',
      'Replace fixed delays with deterministic waiting.',
      'Check for exactly-once effects where the domain requires it.',
    ],
    prerequisites: ['Read the event catalogue', 'Basic queue terminology'],
    runnable: false,
    relatedGuideIds: [],
  },
  {
    id: 'async-duplicate-events',
    title: 'Bug hunt: duplicate notification delivery',
    summary:
      'Investigate why a replayed event sends the same confirmation twice.',
    description:
      'Replay a previously processed order event and observe the notification pipeline. Determine whether consumer idempotency is missing, broken, or simply undocumented, then document the user impact.',
    trackId: 'async-testing',
    categoryId: 'exploratory',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'in-design',
    estimatedMinutes: 40,
    objectives: [
      'Reproduce duplicate delivery with a controlled replay.',
      'Inspect consumer state for an idempotency marker.',
      'Report the defect with event identifiers and timestamps.',
    ],
    prerequisites: ['Order confirmation exercise', 'Ability to inspect consumer logs'],
    runnable: false,
    relatedGuideIds: [],
  },
  {
    id: 'auth-session-expiry',
    title: 'Validate API token expiry and revocation',
    summary:
      'Mint a practice API token, use it, watch it expire, and confirm signing out revokes it server-side.',
    description:
      'Sign in as a synthetic account, mint a short-lived practice API token from the API Lab, and use it on a protected endpoint. Let it expire and observe the distinct expired-token response, then sign out and confirm the token no longer resolves. There is no renewal — minting again is the only path, by design.',
    trackId: 'auth-testing',
    categoryId: 'security-access',
    difficulty: 'intermediate',
    mode: 'clean',
    status: 'ready',
    estimatedMinutes: 25,
    objectives: [
      'Mint a short-lived practice API token and use it on a protected endpoint.',
      'Observe the distinct expired-token response after the TTL elapses.',
      'Confirm signing out revokes tokens server-side on protected endpoints.',
    ],
    prerequisites: ['A synthetic demo account (see the lab README)', 'The API Lab built into this site'],
    runnable: true,
    relatedGuideIds: ['guide-auth-session-testing'],
  },
  {
    id: 'auth-role-boundaries',
    title: 'Bug hunt: role boundary gaps in staff tools',
    summary:
      'Look for actions or data a customer-role account can reach inside staff-only surfaces.',
    description:
      'Use synthetic accounts with different roles and attempt staff-only actions through the UI and API. Focus on whether authorisation is enforced server-side on every route, not merely hidden in the interface — including read-only surfaces, which are easy to forget.',
    trackId: 'auth-testing',
    categoryId: 'security-access',
    difficulty: 'intermediate',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 35,
    objectives: [
      'Attempt staff-only reads and actions with a customer-role account.',
      'Check whether the API enforces the same boundary on read and write routes.',
      'Document each gap with role, action, and response.',
    ],
    prerequisites: ['Sign-in as a customer-role synthetic demo account', 'Start the bug-hunt exercise below'],
    runnable: true,
    huntId: 'hunt-rbac-001',
    curriculum: HUNT_CURRICULUM['hunt-rbac-001'],
    relatedGuideIds: ['guide-auth-session-testing'],
  },
  {
    id: 'api-token-replay',
    title: 'Bug hunt: a token that outlives sign-out',
    summary:
      'Find out whether signing out actually ends the practice API token’s life.',
    description:
      'Mint a practice API token, sign out, and replay the token against a protected endpoint. Determine whether logout revokes the credential server-side or merely clears the browser cookie — the distinction decides whether a stolen token is a real incident.',
    trackId: 'auth-testing',
    categoryId: 'security-access',
    difficulty: 'intermediate',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 30,
    objectives: [
      'Trace an API token through mint, use, sign-out, and replay.',
      'Compare cookie authentication with Bearer authentication after sign-out.',
      'Report what logout actually revokes and what it does not.',
    ],
    prerequisites: ['A synthetic demo account', 'Start the bug-hunt exercise below'],
    runnable: true,
    huntId: 'hunt-authn-001',
    curriculum: HUNT_CURRICULUM['hunt-authn-001'],
    relatedGuideIds: ['guide-auth-session-testing'],
  },
  {
    id: 'api-mass-assignment',
    title: 'Bug hunt: checkout believed the client’s total',
    summary:
      'Determine whether the checkout endpoint stores a figure the client made up.',
    description:
      'The checkout contract says the client only sends customer details and a payment outcome — the server computes every figure. Replay the checkout request with an edited body carrying an extra total field and see whether the order on the confirmation page was invented by the server or believed from the client.',
    trackId: 'api-testing',
    categoryId: 'security-access',
    difficulty: 'advanced',
    mode: 'bug-hunt',
    status: 'ready',
    estimatedMinutes: 40,
    objectives: [
      'Compare server-computed figures with the figures the order stores.',
      'Prove whether a client-supplied total reaches the stored order.',
      'Report with the exact edited request and the resulting figures.',
    ],
    prerequisites: ['The API Lab built into this site', 'Start the bug-hunt exercise below'],
    runnable: true,
    huntId: 'hunt-mass-001',
    curriculum: HUNT_CURRICULUM['hunt-mass-001'],
    relatedGuideIds: ['guide-api-request-response'],
  },
  {
    id: 'a11y-checkout-keyboard',
    title: 'Complete checkout using only a keyboard',
    summary:
      'Navigate the full checkout journey with Tab, Shift+Tab, Enter, and Space.',
    description:
      'Put the pointer aside and complete checkout. Record unreachable controls, hidden focus, unexpected focus jumps, and any modal that traps focus without an escape route.',
    trackId: 'accessibility-testing',
    categoryId: 'accessibility',
    difficulty: 'beginner',
    mode: 'clean',
    status: 'planned',
    estimatedMinutes: 30,
    objectives: [
      'Reach and operate every checkout control by keyboard.',
      'Verify focus visibility and logical focus order.',
      'Document blockers with the exact focus sequence.',
    ],
    prerequisites: ['No special tooling', 'A synthetic account'],
    runnable: false,
    relatedGuideIds: ['guide-accessibility-keyboard'],
  },
  {
    id: 'a11y-catalog-screenreader',
    title: 'Audit catalogue filters with a screen reader',
    summary:
      'Check whether filter controls expose accurate names, roles, and result updates.',
    description:
      'Use a screen reader to apply and clear catalogue filters. Verify that controls are announced correctly and that result counts are communicated without stealing focus or flooding the announcement queue.',
    trackId: 'accessibility-testing',
    categoryId: 'accessibility',
    difficulty: 'intermediate',
    mode: 'clean',
    status: 'in-design',
    estimatedMinutes: 40,
    objectives: [
      'Evaluate accessible names and roles for custom filter controls.',
      'Check result-count announcements after filtering.',
      'Report issues in terms of user impact and recovery.',
    ],
    prerequisites: ['Keyboard checkout exercise', 'A screen reader available locally'],
    runnable: false,
    relatedGuideIds: ['guide-accessibility-keyboard'],
  },
]

/**
 * Suggested order through the runnable bug-hunt scenarios: beginner manual
 * and API exercises first, intermediate investigation skills next, the
 * advanced access-control hunt last. Static and data-driven; every id must
 * reference a runnable wired scenario (asserted by content tests).
 */
export const recommendedHuntScenarioIds: string[] = [
  'manual-cart-add-quantity',
  'api-catalogue-filters',
  'manual-cart-totals',
  'manual-shop-search',
  'manual-address-edge-cases',
  'api-checkout-exact-stock',
  'api-token-replay',
  'auth-role-boundaries',
  'security-object-access',
  'api-mass-assignment',
]

export const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))

export function getScenario(scenarioId: string): Scenario | undefined {
  return scenariosById.get(scenarioId)
}

export function getScenariosForTrack(trackId: string): Scenario[] {
  return scenarios.filter((scenario) => scenario.trackId === trackId)
}
