import type { LearningTrack, TrackId } from './types'

/**
 * Phase 2 content. All exercises are placeholders; no track is connected to a
 * runnable practice application yet.
 */
export const learningTracks: LearningTrack[] = [
  {
    id: 'manual-testing',
    name: 'Manual Testing',
    shortName: 'Manual',
    tagline: 'Think like a user before you automate.',
    description:
      'Explore Aster Market by hand, design risk-based test charters, and record reproducible evidence. Manual testing anchors every other discipline in this lab because it forces you to articulate what “correct” means.',
    difficulty: 'beginner',
    icon: 'manual',
    categoryIds: ['functional', 'exploratory'],
    objectives: [
      'Turn a product requirement into a prioritised, testable checklist.',
      'Use equivalence partitioning and boundary values to reduce redundant cases.',
      'Write a bug report a developer can reproduce without asking follow-up questions.',
      'Separate observed behaviour from assumptions and personal preference.',
    ],
    plannedExerciseCount: 8,
    gettingStarted: {
      summary:
        'Start with the cart journey. It touches pricing, persistence, and validation, so it exposes several kinds of risk in one flow.',
      steps: [
        'Read the cart and checkout requirements, then list the states a cart can be in.',
        'Write five test charters that cover quantities, discounts, and empty carts.',
        'Execute one charter and record each observation with steps, expected result, and actual result.',
      ],
      guideId: 'guide-manual-test-design',
    },
  },
  {
    id: 'api-testing',
    name: 'API Testing',
    shortName: 'API',
    tagline: 'Read the contract, then challenge it.',
    description:
      'Work directly with Aster Market JSON endpoints. You will inspect request and response shapes, verify status codes and headers, and test behaviour that the UI hides.',
    difficulty: 'intermediate',
    icon: 'api',
    categoryIds: ['functional', 'integration'],
    objectives: [
      'Send crafted requests and evaluate status, headers, and body together.',
      'Validate happy paths, boundary values, and negative request payloads.',
      'Recognise idempotency, pagination, and filtering behaviour in a REST API.',
      'Distinguish an API defect from an incorrect test expectation.',
    ],
    plannedExerciseCount: 8,
    gettingStarted: {
      summary:
        'Begin with catalogue search. It is read-only, safe to explore, and demonstrates pagination and filtering clearly.',
      steps: [
        'Read the endpoint contract and identify every required and optional field.',
        'Send a baseline request, then vary one parameter at a time.',
        'Capture status code, headers, and body for both a valid and an invalid request.',
      ],
      guideId: 'guide-api-request-response',
    },
  },
  {
    id: 'ui-automation',
    name: 'UI Automation',
    shortName: 'UI automation',
    tagline: 'Automate user intent, not implementation details.',
    description:
      'Build browser automation against stable, user-facing locators. Exercises cover smoke paths, waiting strategies, and diagnosing flaky tests without hiding them behind retries.',
    difficulty: 'intermediate',
    icon: 'ui',
    categoryIds: ['automation', 'functional'],
    objectives: [
      'Select resilient locators based on roles and accessible names.',
      'Replace fixed sleeps with condition-based waiting.',
      'Design independent tests with deterministic setup and teardown.',
      'Investigate flakiness using traces and failure evidence.',
    ],
    plannedExerciseCount: 7,
    gettingStarted: {
      summary:
        'Start with the sign-in smoke path. It is short enough to finish in one session and establishes the locator and assertion patterns used later.',
      steps: [
        'Identify the accessible names of the sign-in form controls.',
        'Write a test that signs in and asserts the signed-in state.',
        'Run it three times and confirm it is independent of test order.',
      ],
      guideId: 'guide-ui-automation-first-test',
    },
  },
  {
    id: 'api-automation',
    name: 'API Automation',
    shortName: 'API automation',
    tagline: 'Turn one-off requests into a maintainable suite.',
    description:
      'Move from manual API checks to reusable automation. Exercises focus on request builders, schema assertions, fixtures, and handling authentication without duplicating code.',
    difficulty: 'advanced',
    icon: 'api-automation',
    categoryIds: ['automation', 'integration'],
    objectives: [
      'Structure API tests around reusable clients and typed payload builders.',
      'Assert schema, status, and domain meaning rather than snapshots alone.',
      'Control test data so suites can run in any order.',
      'Report failures with the exact request and response context.',
    ],
    plannedExerciseCount: 6,
    gettingStarted: {
      summary:
        'Begin with the response-schema suite. It teaches a reusable assertion layer that later exercises extend.',
      steps: [
        'Group endpoints by resource and define one client per resource.',
        'Add a schema assertion helper and apply it to a single endpoint.',
        'Refactor a duplicated happy-path check to use the helper.',
      ],
      guideId: 'guide-api-request-response',
    },
  },
  {
    id: 'database-testing',
    name: 'Database Testing',
    shortName: 'Database',
    tagline: 'Verify what the interface never shows.',
    description:
      'Test the data layer of a commerce platform: SQL fundamentals, joins, subqueries, transactions — then reconciliation, orphan and duplicate detection, blind to the UI. Thirty-six checked exercises and eight deliberately broken snapshots live in the SQL lab.',
    difficulty: 'intermediate',
    icon: 'database',
    categoryIds: ['data', 'functional'],
    objectives: [
      'Trace a user action to the rows it creates or mutates.',
      'Validate constraints and referential integrity after multi-step flows.',
      'Detect orphaned or duplicated records that the UI masks.',
      'Design queries that prove a state change without assuming implementation.',
    ],
    plannedExerciseCount: 36,
    gettingStarted: {
      summary:
        'Start with the beginner exercises and the consistency scenario — the query-and-compare loop every later exercise reuses.',
      steps: [
        'Open /database and skim the schema explorer: eight tables, constraints and indexes.',
        'Complete the beginner fundamentals until the habit is second nature.',
        'Move to the QA scenarios — reconciliation, orphans, duplicates — then the bug hunts.',
      ],
      guideId: 'guide-database-testing-sql',
    },
  },
  {
    id: 'contract-testing',
    name: 'Contract Testing',
    shortName: 'Contract',
    tagline: 'Catch integration breakage before deployment.',
    description:
      'Test the promises between services and their consumers. Exercises cover consumer-driven contracts, provider verification, and spotting breaking changes that still pass happy-path tests.',
    difficulty: 'advanced',
    icon: 'contract',
    categoryIds: ['integration', 'automation'],
    objectives: [
      'Express a consumer expectation as a minimal, verifiable contract.',
      'Verify a provider against contracts without full end-to-end setup.',
      'Classify changes as additive, breaking, or review-required using a rule table.',
      'Decide when a contract test is better than an integration test.',
    ],
    plannedExerciseCount: 24,
    gettingStarted: {
      summary:
        'Begin with a live contract test, then graduate to the compatibility review and the consumer drift drill.',
      steps: [
        'Capture the live /api/v1/products response and validate it in /contract/validate.',
        'Diff Meridian Ledger v1 against v2 in /contract/compare and classify every finding.',
        'Write the minimal consumer expectation for getProduct in /contract/consumer — then break it on purpose.',
      ],
      guideId: 'guide-contract-testing-basics',
    },
  },
  {
    id: 'performance-testing',
    name: 'Performance Testing',
    shortName: 'Performance',
    tagline: 'Measure first, optimise second.',
    description:
      'Establish baselines for Aster Market endpoints and journeys, then investigate regressions with evidence. Exercises stay inside first-party allowlisted targets and avoid real load against shared infrastructure.',
    difficulty: 'advanced',
    icon: 'performance',
    categoryIds: ['nonfunctional'],
    objectives: [
      'Define latency and throughput goals that reflect user expectations.',
      'Design a load profile with warm-up, steady state, and ramp-down.',
      'Separate client-side, network, and server-side causes of slowness.',
      'Report performance findings with percentiles instead of averages alone.',
    ],
    plannedExerciseCount: 5,
    gettingStarted: {
      summary:
        'Start with the catalogue baseline. It is read-only and establishes the measurement discipline before you touch checkout.',
      steps: [
        'Define p50, p95, and error-rate goals for the endpoint.',
        'Run a short baseline against the local lab target only.',
        'Record the environment, load profile, and results together.',
      ],
      guideId: null,
    },
  },
  {
    id: 'security-testing',
    name: 'Security Testing',
    shortName: 'Security',
    tagline: 'Test boundaries, not infrastructure.',
    description:
      'Practise defensive, bounded security testing on synthetic data. Exercises focus on access control, input handling, and session behaviour without probing third-party systems or using destructive payloads.',
    difficulty: 'advanced',
    icon: 'security',
    categoryIds: ['security-access'],
    objectives: [
      'Test authorisation at object level, not only at route level.',
      'Recognise common input-handling weaknesses in a safe lab setting.',
      'Evaluate session lifetime, rotation, and logout behaviour.',
      'Write findings with impact, evidence, and a realistic severity.',
    ],
    plannedExerciseCount: 5,
    gettingStarted: {
      summary:
        'Begin with horizontal privilege escalation. It teaches a repeatable boundary-checking pattern with two synthetic accounts.',
      steps: [
        'Create two synthetic accounts with different roles.',
        'Capture a resource identifier owned by the first account.',
        'Attempt access with the second account and record the exact response.',
      ],
      guideId: 'guide-auth-session-testing',
    },
  },
  {
    id: 'microservices-testing',
    name: 'Microservices Testing',
    shortName: 'Microservices',
    tagline: 'Follow the request across service boundaries.',
    description:
      'Trace Aster Market flows across catalogue, cart, payments, and notifications. Exercises cover service isolation, partial failure, and the difference between a passing service and a working journey.',
    difficulty: 'advanced',
    icon: 'microservices',
    categoryIds: ['integration', 'nonfunctional'],
    objectives: [
      'Map a user journey to the services and messages it touches.',
      'Test a service in isolation with controlled collaborators.',
      'Verify graceful degradation when a dependency is slow or unavailable.',
      'Correlate logs and traces to locate a failure boundary.',
    ],
    plannedExerciseCount: 5,
    gettingStarted: {
      summary:
        'Start by tracing the order flow. Draw the path before touching a tool; the diagram becomes the test plan.',
      steps: [
        'List each service involved from checkout to confirmation.',
        'Identify synchronous calls and asynchronous events separately.',
        'Break one dependency and record how the journey behaves.',
      ],
      guideId: 'guide-contract-testing-basics',
    },
  },
  {
    id: 'async-testing',
    name: 'Event-Driven and Asynchronous Testing',
    shortName: 'Async',
    tagline: 'Test what happens after the response.',
    description:
      'Validate events, queues, and background jobs in Aster Market. Exercises focus on eventual consistency, duplicate delivery, ordering, and the observability needed to prove an event actually arrived.',
    difficulty: 'advanced',
    icon: 'async',
    categoryIds: ['integration', 'nonfunctional'],
    objectives: [
      'Define the observable outcome that proves an event was processed.',
      'Test duplicate delivery and out-of-order handling without flaky timeouts.',
      'Distinguish eventual consistency from a missing update.',
      'Use correlation identifiers to follow a message through the system.',
    ],
    plannedExerciseCount: 5,
    gettingStarted: {
      summary:
        'Begin with order-confirmation notifications. They have a clear user-visible outcome and a short processing window.',
      steps: [
        'List the events emitted after a successful checkout.',
        'Define the user-visible state that proves each event was handled.',
        'Introduce a duplicate event and observe whether the outcome changes.',
      ],
      guideId: null,
    },
  },
  {
    id: 'auth-testing',
    name: 'Authentication and Authorisation Testing',
    shortName: 'Auth',
    tagline: 'Prove who you are, then prove what you may do.',
    description:
      'Test Aster Market sign-in, sessions, and role boundaries. Exercises separate authentication failures from authorisation failures and cover expiry, renewal, and logout across synthetic accounts.',
    difficulty: 'intermediate',
    icon: 'auth',
    categoryIds: ['security-access', 'functional'],
    objectives: [
      'Test valid, invalid, and expired credential paths.',
      'Verify role and object-level authorisation across accounts.',
      'Check session rotation and post-logout invalidation.',
      'Report access-control defects with a precise reproduction path.',
    ],
    plannedExerciseCount: 6,
    gettingStarted: {
      summary:
        'Start with session expiry. It combines authentication state, refresh behaviour, and clear expected outcomes.',
      steps: [
        'Sign in with a synthetic account and capture the session state.',
        'Shorten the session window in the lab configuration.',
        'Verify renewal succeeds before expiry and fails afterwards.',
      ],
      guideId: 'guide-auth-session-testing',
    },
  },
  {
    id: 'accessibility-testing',
    name: 'Accessibility Testing',
    shortName: 'Accessibility',
    tagline: 'If it only works with a mouse, it does not work.',
    description:
      'Evaluate Aster Market against practical accessibility expectations. Exercises cover keyboard operation, focus order, screen-reader naming, contrast, and accessible error recovery.',
    difficulty: 'beginner',
    icon: 'accessibility',
    categoryIds: ['accessibility', 'functional'],
    objectives: [
      'Complete core journeys using only a keyboard.',
      'Evaluate accessible names, roles, and state for custom controls.',
      'Check focus order, focus visibility, and error announcement.',
      'Write accessibility findings tied to user impact, not only rule IDs.',
    ],
    plannedExerciseCount: 6,
    gettingStarted: {
      summary:
        'Begin with the keyboard checkout. It reveals focus traps and unreachable controls quickly, without special tooling.',
      steps: [
        'Put the pointer aside and navigate from the catalogue to checkout.',
        'Record every point where focus is lost, hidden, or out of order.',
        'Repeat with a screen reader and compare the announced labels.',
      ],
      guideId: 'guide-accessibility-keyboard',
    },
  },
]

export const learningTracksById = new Map<TrackId, LearningTrack>(
  learningTracks.map((track) => [track.id, track]),
)

export function getTrack(trackId: string): LearningTrack | undefined {
  return learningTracksById.get(trackId as TrackId)
}
