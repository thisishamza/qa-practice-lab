// Shared contracts for Phase 4 learning intelligence (P4-M1 WP1–WP3).
// Consumed by the Hono API (src/server/attempts.ts, src/server/reports.ts)
// and, in later milestones, the browser client. Nothing here carries defect
// identifiers, hint content, reveal content, finding-check terms or
// evaluation internals: learner-safe means exactly these fields and no
// more. Numeric database ids and internal defect registry ids never appear
// in any payload below.

/** Lifecycle of one attempt at a hunt. */
export type HuntAttemptStatus = 'in_progress' | 'submitted' | 'revealed'

/** Learner-facing attempt status; `none` means the caller has no attempt yet. */
export type AttemptStatusView = HuntAttemptStatus | 'none'

/** Impact-based severity vocabulary (controlled; see the Phase 4 plan §6.4). */
export type ReportSeverity = 'critical' | 'high' | 'medium' | 'low'

/** Urgency/ordering vocabulary — independent of severity; never derived from it. */
export type ReportPriority = 'p1' | 'p2' | 'p3' | 'p4'

/** How reproducibly the defect was observed. */
export type ReportReproducibility = 'always' | 'sometimes' | 'once'

/** One deterministic evaluator check result. */
export interface ReportFeedbackItem {
  id: string
  passed: boolean
  message: string
}

/** A full evaluator verdict (score 0–100, plan §6.4 rubric). */
export interface ReportEvaluation {
  score: number
  verdict: 'solid' | 'needs-work' | 'incomplete'
  checks: Array<ReportFeedbackItem & { label: string }>
}

/** Learner-safe view of the caller's current attempt, or `none`. */
export interface AttemptView {
  status: AttemptStatusView
  /** Number of distinct hint levels used (0–3). Bit count of the server-side mask. */
  hintsUsed: number
  /** Best deterministic score across this attempt's submissions; null until scored. */
  bestQualityScore: number | null
  /** Sticky: true once any submission's finding check passed. */
  discovered: boolean
  /** First report submission time for this attempt (ISO), else null. */
  submittedAt: string | null
}

/** One row of the bounded attempt history (newest first). */
export interface AttemptHistoryEntry {
  huntId: string
  status: HuntAttemptStatus
  hintsUsed: number
  bestQualityScore: number | null
  discovered: boolean
  /** When this attempt was opened (ISO). */
  createdAt: string
  /** First report submission time for this attempt (ISO), else null. */
  submittedAt: string | null
}

/** Hint level of the three-step ladder. */
export type HintLevel = 1 | 2 | 3

/**
 * Response of POST …/hints. The `hint` text itself is authored server-side
 * (src/server/hints.ts) and served only for the requested unlocked level;
 * no other hint or any reveal content is included.
 */
export interface HintResponse {
  level: HintLevel
  hint: string
  /** Number of distinct hint levels used on this attempt (0–3). */
  hintsUsed: number
}

/**
 * Learner-safe reveal payload, served only after reveal eligibility
 * (submitted report or explicit confirmed give-up). Content lives in the
 * server-only registry (src/server/reveals.ts); these types carry no
 * content of their own.
 */
export interface HuntReveal {
  huntId: string
  /** Learner-safe title (the hunt title); carries no internal identifiers. */
  title: string
  /** The documented clean-mode behaviour, in plain English. */
  expected: string
  /** The observed bug-hunt behaviour, described as behaviour (never code). */
  actual: string
  /** Learner-level explanation of which layer is wrong and why. */
  rootCause: string
  /** Numbered steps that reproduce the defect deterministically. */
  reproduction: string[]
  /** How to confirm the fix in a clean session. */
  verification: string[]
  /** QA concepts exercised by the exercise. */
  concepts: string[]
  /** One or two common wrong turns learners take. */
  commonMisconceptions: string[]
}

/**
 * Response of GET …/reveal (already eligible) and POST …/reveal (the
 * explicit confirmed give-up / unlock path). Includes the learner-safe
 * attempt snapshot; never a numeric attempt id.
 */
export interface RevealResponse extends HuntReveal {
  attempt: AttemptView
  /** SQL exercises and SQL hunts also reveal the reference query. Phase 3/4 hunts never carry it. */
  solution?: string
  explanation?: string
}

export interface AttemptHistoryResponse {
  data: AttemptHistoryEntry[]
}

/** Attribution mode of the progress payload (P4-M3 WP1). */
export type ProgressPersistence = 'session' | 'customer'

/** One wired hunt with the caller's aggregated state across all attempts. */
export interface ProgressHuntEntry {
  huntId: string
  /** The catalogue scenario this hunt is wired to (learner-safe link target); absent for SQL exercise entries. */
  scenarioId?: string
  title: string
  /** Latest attempt's lifecycle status; `none` when the hunt was never attempted. */
  status: AttemptStatusView
  /** Sticky across non-revealed attempts; a revealed attempt never confers discovery. */
  discovered: boolean
  /** Best score across all of this hunt's attempts; null until scored. */
  bestScore: number | null
  /** Total hints used across all attempts on this hunt. */
  hintsUsed: number
  /** Number of attempts opened on this hunt. */
  attempts: number
  /** Latest first-submission time across the hunt's attempts; null when never submitted. */
  lastSubmittedAt: string | null
}

/**
 * One submitted report, newest first. No attempt ids, no report ids, no
 * evaluator internals — the verdict is the persisted score mapped through
 * the §6.4 bands (src/server/reportQuality.ts).
 */
export interface ProgressRecentSubmission {
  huntId: string
  /** Learner-safe hunt title. */
  title: string
  /** Persisted deterministic score 0–100. */
  score: number
  verdict: ReportEvaluation['verdict']
  createdAt: string
}

/** Aggregate counts over the caller's attempts in scope. */
export interface ProgressTotals {
  /** Total attempt rows in scope. */
  attempts: number
  inProgress: number
  /** Attempts whose status is `submitted` (status buckets stay pure: attempts = inProgress + submitted + revealed). */
  submitted: number
  /** Attempts whose status is `revealed` (solution viewed). */
  revealed: number
  /** Submitted bug reports in scope (one row per submission). */
  reports: number
  /** Distinct hunts with at least one discovered attempt (≤ 7) from non-revealed attempts. Never score-derived. */
  discovered: number
  /** Total hints used across all attempts in scope. */
  hintsUsed: number
  /** Best attempt score in scope; null until a report is scored. */
  bestScore: number | null
  /** Mean of scored attempt best scores (integer); null until at least one attempt is scored. */
  averageBestScore: number | null
}

/** Response of GET /api/v1/practice/progress. */
export interface ProgressResponse {
  /** `customer` when the caller is signed in with an active customer binding; else `session`. */
  persistence: ProgressPersistence
  /** One entry per wired hunt, in registry order. */
  hunts: ProgressHuntEntry[]
  /** Newest first, at most 10 rows. */
  recent: ProgressRecentSubmission[]
  totals: ProgressTotals
}

/** Structured bug-report submission body (POST …/report). */
export interface BugReportSubmission {
  title: string
  environment: string
  preconditions?: string | null
  steps: string
  expected: string
  actual: string
  severity: ReportSeverity
  priority: ReportPriority
  reproducibility?: ReportReproducibility
}

/** Learner-safe report view, echoed back on submission. No ids, no evaluator internals. */
export interface BugReportView {
  title: string
  environment: string
  preconditions: string | null
  steps: string
  expected: string
  actual: string
  severity: ReportSeverity
  priority: ReportPriority
  reproducibility: ReportReproducibility
  /**
   * Deterministic rule-based score 0–100, computed server-side by the
   * §6.4 evaluator. Never model-generated; the client can never influence it.
   */
  qualityScore: number
  feedback: ReportFeedbackItem[]
  createdAt: string
}

export interface ReportSubmissionResponse {
  attempt: AttemptView
  report: BugReportView
  /** The synchronous §6.4 evaluation of this submission. */
  evaluation: ReportEvaluation
}
