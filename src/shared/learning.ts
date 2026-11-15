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

export interface AttemptHistoryResponse {
  data: AttemptHistoryEntry[]
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
