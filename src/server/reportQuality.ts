// Phase 4 (P4-M1 WP3) — deterministic bug-report evaluator.
//
// Pure module. No I/O, no clock, no randomness, no network, no external
// service. Same input always produces the same output, so the function is
// trivially unit-testable and free-tier CPU-safe. The rubric is exactly
// plan §6.4 (docs/phase-4-learning-intelligence-plan.md); do not alter
// point allocations or add checks without a plan change.
//
// Security model:
// - Everything here is server-side. Finding-check term groups, synonym
//   alternates and matching rules stay in this module; they are never sent
//   to the client, never persisted, and never appear in learner feedback.
// - Feedback messages describe the *report*, never the fault location, the
//   hiding spot, or the expected answer. The `finding` check is boolean
//   with a generic message ("Identifies which behaviour is incorrect").
// - No check reads a defect id. The hunt id only selects the hunt's
//   curated term group; unknown hunts fail the check defensively.
// - Environment and preconditions are NOT discovery evidence: `finding`
//   evaluates title + steps + expected + actual only.
// - No hint penalties. Severity and priority are validated against their
//   own enums only and are never derived from each other.

import type { ReportEvaluation } from '../shared/learning'
import {
  EVALUATION_RUBRIC,
  EVALUATION_TOTAL_POINTS,
  type RubricCheckId,
} from '../shared/evaluationRubric'

/** Evaluated input. Validation runs in src/server/reports.ts; enums and
 * length caps are re-checked here so the evaluator stays honest for any
 * caller. `preconditions` is deliberately absent — it is never evaluated. */
export interface EvaluateReportInput {
  huntId: string
  title: string
  environment: string
  steps: string
  expected: string
  actual: string
  /** Enum-checked by validation; re-validated here case-insensitively. */
  severity: string
  /** Enum-checked by validation; re-validated here case-insensitively. */
  priority: string
}

/** The full evaluator output, ready to persist and to embed in a response. */
export interface ReportEvaluationResult extends ReportEvaluation {
  /** True when the finding check passed. Sticky once earned — the caller
   * (src/server/attempts.ts) keeps it 1 forever. */
  discovered: boolean
}

export type ReportVerdict = ReportEvaluation['verdict']

/**
 * The full evaluator rubric, re-exported from the canonical learner-safe
 * module (src/shared/evaluationRubric.ts) so the published transparency
 * surfaces and the implemented checks can never drift apart. Point weights
 * are exactly plan §6.4.
 */
export const RUBRIC_CHECKS = EVALUATION_RUBRIC

export type { RubricCheckId }

/** Total of all check weights; 100 for the approved §6.4 rubric. */
export const RUBRIC_TOTAL_POINTS = EVALUATION_TOTAL_POINTS

const POINTS: Readonly<Record<RubricCheckId, number>> = Object.fromEntries(
  RUBRIC_CHECKS.map((check) => [check.id, check.points]),
) as Record<RubricCheckId, number>

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const
const PRIORITIES = ['p1', 'p2', 'p3', 'p4'] as const

// ---------------------------------------------------------------------------
// Normalization — one pipeline used by every check (§6.4 "normalized
// consistently"; the finding check and expected-actual-distinct both rely on
// it). Case-folded, diacritics stripped, punctuation collapsed to single
// spaces, whitespace normalized. Deterministic by construction.
// ---------------------------------------------------------------------------

export function normalizeForEvaluation(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Token list of the normalized text. */
function tokens(value: string): string[] {
  const normalized = normalizeForEvaluation(value)
  return normalized.length === 0 ? [] : normalized.split(' ')
}

/** Token-boundary containment of a normalized term in normalized text. */
function containsTerm(normalizedHaystack: string, normalizedTerm: string): boolean {
  if (normalizedHaystack.length === 0 || normalizedTerm.length === 0) {
    return false
  }
  return ` ${normalizedHaystack} `.includes(` ${normalizedTerm} `)
}

// ---------------------------------------------------------------------------
// Curated term lists (maintainer-owned; changing them is a code change with
// review, not a data edit). None of these names a defect, a fault location
// or an answer — they describe *which report content* earns credit.
// ---------------------------------------------------------------------------

/** Placeholders that never pass the title check (all normalized forms). */
const TITLE_PLACEHOLDERS: ReadonlySet<string> = new Set([
  'test', 'testing', 'tester', 'tests',
  'placeholder', 'title', 'todo', 'fix', 'bug', 'bugfix', 'issue', 'problem',
  'lorem', 'ipsum', 'lorem ipsum',
  'asdf', 'qwerty', 'abc', 'xyz', 'xxx', 'aaa', 'na', 'n a', 'none', 'unknown',
  'stuff', 'thing', 'here', 'untitled', 'no title',
])

/** Curated environment terms: browser, OS, device, build/version, practice shop. */
const ENVIRONMENT_TERMS: readonly string[] = [
  // Browsers
  'firefox', 'chrome', 'chromium', 'safari', 'edge', 'mozilla', 'opera', 'brave', 'browser',
  // Operating systems / platforms
  'windows', 'macos', 'mac os', 'osx', 'linux', 'ubuntu', 'debian', 'fedora', 'arch', 'mint',
  'android', 'ios', 'ipados', 'operating system',
  // Devices
  'laptop', 'desktop', 'mobile', 'tablet', 'phone', 'iphone', 'ipad', 'device',
  // Build / version markers
  'build', 'version', 'release', 'commit', 'sha',
  // The practice shop itself
  'practice shop', 'practice-shop', 'storefront', 'meridian', 'shop', 'store',
]

/** Curated action verbs for the steps check (single tokens, normalized). */
const ACTION_VERBS: ReadonlySet<string> = new Set([
  'open', 'opens', 'opened', 'opening',
  'click', 'clicks', 'clicked', 'clicking',
  'tap', 'taps', 'tapped', 'tapping',
  'press', 'presses', 'pressed', 'pressing',
  'add', 'adds', 'added', 'adding',
  'place', 'places', 'placed', 'placing',
  'search', 'searches', 'searched', 'searching',
  'browse', 'browses', 'browsed', 'browsing',
  'select', 'selects', 'selected', 'selecting',
  'choose', 'chooses', 'chose', 'chosen', 'choosing',
  'navigate', 'navigates', 'navigated', 'navigating',
  'submit', 'submits', 'submitted', 'submitting',
  'enter', 'enters', 'entered', 'entering',
  'type', 'types', 'typed', 'typing',
  'check', 'checks', 'checked', 'checking',
  'compare', 'compares', 'compared', 'comparing',
  'change', 'changes', 'changed', 'changing',
])

/** Curated multi-word action phrases for the steps check. */
const ACTION_PHRASES: readonly string[] = ['sign in', 'log in', 'go to', 'sign up', 'sign out', 'add to cart']

/**
 * Finding-check term groups (plan §6.4 / §14 decision 1). Curated,
 * per-hunt, server-side. Terms are behaviour-area vocabulary a learner
 * would legitimately use to name the behaviour showing the problem —
 * never the fault location, never a defect id, never an answer string.
 * Single tokens and multi-word phrases; matched after normalization with
 * token boundaries, so "researcher" does not match "search".
 *
 * Exported for the server and its test suite only — the client bundle
 * must never import this module. Treat any change here as an answer-scheme
 * change requiring review.
 */
export const FINDING_GROUPS: Readonly<Record<string, readonly string[]>> = {
  'hunt-catalogue-001': [
    'search', 'searches', 'searching', 'searched',
    'query', 'queries',
    'find', 'finds', 'finding', 'found',
    'lookup',
    'term', 'terms', 'keyword', 'keywords',
    'description', 'descriptions', 'described',
    'match', 'matches', 'matching', 'matched',
  ],
  'hunt-catalogue-002': [
    'category', 'categories', 'categorised', 'categorized',
    'filter', 'filters', 'filtering', 'filtered',
    'narrow', 'narrows', 'narrowing', 'narrowed',
    'slug',
    'every category', 'all categories', 'category filter', 'chosen category', 'selected category',
  ],
  'hunt-cart-001': [
    'quantity', 'quantities', 'qty',
    'accumulate', 'accumulates', 'accumulated', 'accumulating', 'accumulation',
    'increment', 'increments', 'incremented',
    'add again', 'adding again', 'repeatedly adding',
    'replace', 'replaced', 'replaces', 'replacing',
    'reset', 'resets', 'reset it',
    'revert', 'reverts',
    'overwrite', 'overwrites', 'overwritten',
    'same item', 'existing line', 'existing quantity', 'adds up',
    're add', 're adding', 'readded', 'readding',
  ],
  'hunt-inventory-001': [
    'stock',
    'in stock', 'out of stock',
    'inventory',
    'availability', 'available',
    'available stock', 'remaining', 'remaining stock',
    'exact stock', 'exact quantity', 'exact amount',
    'last unit', 'last units',
    'insufficient', 'not enough', 'enough stock', 'enough units',
  ],
  'hunt-pricing-001': [
    'total', 'totals', 'totalled', 'totaled', 'grand total',
    'subtotal', 'subtotals',
    'line total', 'line price', 'unit price',
    'price', 'prices', 'pricing',
    'multiply', 'multiplies', 'multiplied', 'multiplying', 'multiplication',
    'times', 'times quantity', 'times the quantity', 'times unit price', 'times the unit price',
  ],
  'hunt-checkout-001': [
    'name',
    'customer name', 'blank name', 'empty name', 'blank customer', 'blank customer name',
    'name field', 'customer details',
    'validation', 'validate', 'validates', 'validated', 'validating',
    'required', 'blank', 'empty', 'whitespace',
  ],
  'hunt-authz-001': [
    'ownership', 'owner',
    'other account', 'another account', 'different account',
    'other customer', 'another customer', 'other user', 'another user',
    'someone else', 'someone else s',
    'not yours', 'not your',
    'own order', 'own account',
    'account boundary', 'cross account', 'cross-account',
    'permission', 'permissions',
    'authorization', 'authorisation', 'authorized', 'authorised',
    'unauthorized', 'unauthorised',
    'access control',
    'reference', 'order reference',
  ],
  'hunt-authn-001': [
    'token', 'tokens', 'bearer',
    'api token', 'access token', 'practice token',
    'replay', 'replayed', 'replays',
    'logout', 'log out', 'sign out', 'signout',
    'revoke', 'revoked', 'revocation',
    'expire', 'expired', 'expiry', 'expiration',
    'still works', 'still valid', 'still resolves',
    'authorization header',
  ],
  'hunt-rbac-001': [
    'role', 'roles', 'role boundary',
    'staff', 'staff only', 'staff access',
    'customer role', 'admin', 'inventory',
    'authorization', 'authorisation', 'authorized', 'authorised',
    'unauthorized', 'unauthorised',
    'permission', 'permissions',
    'staff_required', 'forbidden',
    'wrong role', 'non staff', 'non staff account',
  ],
  'hunt-mass-001': [
    'total', 'totals',
    'line total', 'order total', 'cart total', 'grand total',
    'subtotal', 'subtotals',
    'totalcents', 'total cents',
    'client supplied', 'client provided', 'client sent', 'client value', 'client figure', 'client total',
    'mass assignment', 'mass-assignment',
    'request body',
    'forged', 'tampered', 'manipulated', 'fabricated',
  ],
}

const NORMALIZED_FINDING_GROUPS: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(FINDING_GROUPS).map(([huntId, terms]) => [
    huntId,
    terms.map(normalizeForEvaluation).filter((term) => term.length > 0),
  ]),
)

/** True when any finding-group term for the hunt appears in the *finding
 * fields* (title + steps + expected + actual) treated together. Never reads
 * environment, preconditions, hunt summaries or any client-supplied hint. */
export function hasFindingEvidence(
  huntId: string,
  findingText: string,
): boolean {
  const group = NORMALIZED_FINDING_GROUPS.get(huntId)
  if (!group) {
    return false
  }
  const normalized = normalizeForEvaluation(findingText)
  return group.some((term) => containsTerm(normalized, term))
}

// ---------------------------------------------------------------------------
// Individual check helpers (deterministic, total over all string inputs).
// ---------------------------------------------------------------------------

/** True for placeholder / junk titles ("test", "aaaa", "lorem ipsum", …). */
export function isPlaceholderTitle(title: string): boolean {
  const normalized = normalizeForEvaluation(title)
  if (normalized.length === 0) {
    return true
  }
  if (TITLE_PLACEHOLDERS.has(normalized)) {
    return true
  }
  const parts = normalized.split(' ')
  if (parts.length >= 2 && parts.every((part) => /^(.)\1{2,}$/.test(part))) {
    return true
  }
  if (parts.length >= 3 && parts.every((part) => part === parts[0])) {
    // All tokens identical ("blank blank blank…") — a placeholder pattern.
    return true
  }
  const compact = normalized.replace(/\s+/g, '')
  return /^(.)\1{2,}$/.test(compact)
}

/** Counts discrete steps: one per newline, plus explicit numbered markers
 * that appear inline ("1. … 2. …" on a single line). */
export function countSteps(steps: string): number {
  const numberedMarker = /(?:^|\s)(?:step\s*)?\d{1,2}\s*[.):-]\s+/gim
  let count = 0
  for (const rawLine of steps.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }
    const markers = line.match(numberedMarker)
    count += markers ? markers.length : 1
  }
  return count
}

/** True when the steps text carries at least one curated action verb. */
export function stepsHaveActionVerb(steps: string): boolean {
  const tokenSet = new Set(tokens(steps))
  for (const verb of ACTION_VERBS) {
    if (tokenSet.has(verb)) {
      return true
    }
  }
  const normalized = normalizeForEvaluation(steps)
  return ACTION_PHRASES.some((phrase) => containsTerm(normalized, normalizeForEvaluation(phrase)))
}

/** True when the steps text carries at least one concrete token: a number,
 * a quoted string, or a URL-ish path. Checked against the raw text because
 * normalization strips punctuation such as quotes and slashes. */
export function stepsHaveConcreteToken(steps: string): boolean {
  return (
    /\d/.test(steps) ||
    /"[^"\n]{2,}"|'[^'\n]{2,}'/.test(steps) ||
    /\/[a-z0-9][a-z0-9\-/_]*/i.test(steps)
  )
}

/** Curated environment vocabulary, case-insensitive, normalized matching. */
export function environmentHasTerm(environment: string): boolean {
  const normalized = normalizeForEvaluation(environment)
  const tokenSet = new Set(tokens(environment))
  return ENVIRONMENT_TERMS.some((term) => {
    const normalizedTerm = normalizeForEvaluation(term)
    return normalizedTerm.includes(' ')
      ? containsTerm(normalized, normalizedTerm)
      : tokenSet.has(normalizedTerm)
  })
}

/**
 * Token-set distance between two normalized texts: 1 − |A ∩ B| / |A ∪ B|.
 * ≥ 0.6 means at least 60% of the combined vocabulary is disjoint.
 */
export function tokenDisjointness(a: string, b: string): number {
  const setA = new Set(tokens(a))
  const setB = new Set(tokens(b))
  if (setA.size === 0 || setB.size === 0) {
    return 0
  }
  const union = new Set([...setA, ...setB])
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1
    }
  }
  return 1 - intersection / union.size
}

// ---------------------------------------------------------------------------
// The evaluator.
// ---------------------------------------------------------------------------

const MESSAGES: Readonly<Record<RubricCheckId, { pass: string; fail: string }>> = {
  'title-present': {
    pass: 'Title describes the problem.',
    fail: 'Give the report a title of 10–120 characters that describes the problem (avoid placeholders like "test").',
  },
  'environment-present': {
    pass: 'Environment identifies where the problem was seen.',
    fail: 'Describe the environment — browser, operating system, device, build/version or the practice shop (at least 8 characters).',
  },
  'steps-present': {
    pass: 'Steps are discrete and reproducible.',
    fail: 'List at least two discrete steps to reproduce the problem — at least 40 characters overall.',
  },
  'steps-quality': {
    pass: 'Steps describe concrete actions and values.',
    fail: 'Steps should include an action verb (open, click, add, place, …) and a concrete token — a number, a quoted value or a path such as /cart.',
  },
  'expected-present': {
    pass: 'Expected behaviour is stated.',
    fail: 'State the expected behaviour — what should happen instead (at least 12 characters).',
  },
  'actual-present': {
    pass: 'Actual behaviour is stated.',
    fail: 'State the actual behaviour — what actually happens when you follow the steps (at least 12 characters).',
  },
  'expected-actual-distinct': {
    pass: 'Expected and actual behaviour are clearly different.',
    fail: 'Expected and actual look the same — describe how the behaviour differs from what is expected.',
  },
  'severity-valid': {
    pass: 'Severity is a valid impact level.',
    fail: 'Severity must be one of critical, high, medium or low (impact on the application).',
  },
  'priority-valid': {
    pass: 'Priority is a valid urgency.',
    fail: 'Priority must be one of p1, p2, p3 or p4 (urgency in the tracker — independent of severity).',
  },
  finding: {
    pass: 'Identifies which behaviour is incorrect.',
    fail: 'Does not identify which behaviour is incorrect — describe the behaviour that shows the problem.',
  },
}

/**
 * Maps a persisted deterministic score onto its verdict band
 * (≥80 solid · 50–79 needs-work · <50 incomplete). Used both by the
 * evaluator and by read paths that re-present a persisted score; the
 * bands live here so the two can never drift.
 */
export function verdictForScore(score: number): ReportVerdict {
  return score >= 80 ? 'solid' : score >= 50 ? 'needs-work' : 'incomplete'
}

/**
 * Evaluates one structured report against the plan §6.4 rubric.
 * Deterministic: no clock, no randomness, no I/O. Output score is an
 * integer 0–100; verdict bands are ≥80 solid · 50–79 needs-work · <50
 * incomplete. `discovered` is true exactly when the finding check passed.
 */
export function evaluateReport(input: EvaluateReportInput): ReportEvaluationResult {
  const title = input.title.trim()
  const environment = input.environment.trim()
  const steps = input.steps.trim()
  const expected = input.expected.trim()
  const actual = input.actual.trim()

  const titleOk =
    title.length >= 10 && title.length <= 120 && !isPlaceholderTitle(title)
  const environmentOk = environment.length >= 8 && environmentHasTerm(environment)
  const stepsOk = countSteps(steps) >= 2 && steps.length >= 40
  const stepsQualityOk = stepsHaveActionVerb(steps) && stepsHaveConcreteToken(steps)
  const expectedOk = expected.length >= 12
  const actualOk = actual.length >= 12
  const expectedNormalized = normalizeForEvaluation(expected)
  const actualNormalized = normalizeForEvaluation(actual)
  const distinctOk =
    expectedNormalized.length > 0 &&
    actualNormalized.length > 0 &&
    expectedNormalized !== actualNormalized &&
    tokenDisjointness(expected, actual) >= 0.6
  const severityOk = (SEVERITIES as readonly string[]).includes(
    input.severity.trim().toLowerCase(),
  )
  const priorityOk = (PRIORITIES as readonly string[]).includes(
    input.priority.trim().toLowerCase(),
  )
  const findingOk = hasFindingEvidence(
    input.huntId,
    [title, steps, expected, actual].join(' '),
  )

  const passedById: Readonly<Record<RubricCheckId, boolean>> = {
    'title-present': titleOk,
    'environment-present': environmentOk,
    'steps-present': stepsOk,
    'steps-quality': stepsQualityOk,
    'expected-present': expectedOk,
    'actual-present': actualOk,
    'expected-actual-distinct': distinctOk,
    'severity-valid': severityOk,
    'priority-valid': priorityOk,
    finding: findingOk,
  }

  let score = 0
  const checks = RUBRIC_CHECKS.map(({ id, label }) => {
    const passed = passedById[id]
    if (passed) {
      score += POINTS[id]
    }
    return { id, label, passed, message: passed ? MESSAGES[id].pass : MESSAGES[id].fail }
  })

  const verdict: ReportVerdict = verdictForScore(score)

  return { score, verdict, discovered: findingOk, checks }
}
