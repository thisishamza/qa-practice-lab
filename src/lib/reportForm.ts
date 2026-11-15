// P4-M2 WP2 — pure logic for the structured bug-report form. No I/O, no DOM,
// no React: everything here is unit-testable in plain Node. The form
// component (src/features/practice/BugReportForm.tsx) is a thin shell over
// these helpers plus the typed API client.
//
// Security model:
// - `toSubmission` constructs the POST body with exactly the nine
//   client-allowed keys — nothing else can leak onto the wire (there is no
//   score/feedback/discovery field to smuggle in).
// - Client-side validation is a convenience only; the server remains
//   authoritative and its per-field errors are displayed beside the fields.
// - `submitReportFlow` is injected with the transport so tests can stub it;
//   failure outcomes carry no evaluation payload.
// - The downloadable markdown is generated from the *submitted* report and
//   the server's evaluation — never from hidden evaluator state. User text
//   is escaped so it cannot alter the document's structure or inject markup,
//   and no internal ids ever reach the file.

import type {
  BugReportSubmission,
  BugReportView,
  ReportEvaluation,
  ReportPriority,
  ReportReproducibility,
  ReportSeverity,
  ReportSubmissionResponse,
} from '../shared/learning'

/** Form values as held in component state (all strings; selects included). */
export interface ReportFormValues {
  title: string
  environment: string
  preconditions: string
  steps: string
  expected: string
  actual: string
  severity: '' | ReportSeverity
  priority: '' | ReportPriority
  reproducibility: ReportReproducibility
}

export const EMPTY_REPORT_FORM_VALUES: ReportFormValues = {
  title: '',
  environment: '',
  preconditions: '',
  steps: '',
  expected: '',
  actual: '',
  severity: '',
  priority: '',
  reproducibility: 'always',
}

/** Length caps mirrored from the server validation (src/server/reports.ts). */
export const REPORT_FIELD_LIMITS = {
  title: 200,
  environment: 200,
  preconditions: 1000,
  steps: 4000,
  expected: 2000,
  actual: 2000,
} as const

export type ReportFieldName = keyof ReportFormValues

export const REPORT_FIELD_ORDER: readonly ReportFieldName[] = [
  'title',
  'environment',
  'preconditions',
  'steps',
  'expected',
  'actual',
  'severity',
  'priority',
  'reproducibility',
]

export const REPORT_FIELD_LABELS: Record<ReportFieldName, string> = {
  title: 'Report title',
  environment: 'Environment',
  preconditions: 'Preconditions',
  steps: 'Steps to reproduce',
  expected: 'Expected result',
  actual: 'Actual result',
  severity: 'Severity',
  priority: 'Priority',
  reproducibility: 'Reproducibility',
}

export const REPORT_FIELD_IDS: Record<ReportFieldName, string> = {
  title: 'report-title',
  environment: 'report-environment',
  preconditions: 'report-preconditions',
  steps: 'report-steps',
  expected: 'report-expected',
  actual: 'report-actual',
  severity: 'report-severity',
  priority: 'report-priority',
  reproducibility: 'report-reproducibility',
}

const REQUIRED_MESSAGE = 'This field is required.'

function overCap(value: string, cap: number, label: string): string | undefined {
  return value.trim().length > cap ? `Keep ${label} within ${cap} characters.` : undefined
}

/**
 * Validate the form for submission (and for blur checks). Returns a map of
 * field → message for every problem found; empty map means valid. Required
 * fields must be non-empty after trimming and within the server caps; enums
 * must be one of their allowed values. This deliberately adds no extra
 * rules — the server is authoritative.
 */
export function validateReportValues(
  values: ReportFormValues,
): Partial<Record<ReportFieldName, string>> {
  const fields: Partial<Record<ReportFieldName, string>> = {}

  if (values.title.trim().length === 0) {
    fields.title = REQUIRED_MESSAGE
  } else {
    const error = overCap(values.title, REPORT_FIELD_LIMITS.title, 'the title')
    if (error) fields.title = error
  }

  if (values.environment.trim().length === 0) {
    fields.environment = REQUIRED_MESSAGE
  } else {
    const error = overCap(values.environment, REPORT_FIELD_LIMITS.environment, 'the environment')
    if (error) fields.environment = error
  }

  if (values.preconditions.trim().length > REPORT_FIELD_LIMITS.preconditions) {
    fields.preconditions = overCap(
      values.preconditions,
      REPORT_FIELD_LIMITS.preconditions,
      'the preconditions',
    )
  }

  if (values.steps.trim().length === 0) {
    fields.steps = REQUIRED_MESSAGE
  } else {
    const error = overCap(values.steps, REPORT_FIELD_LIMITS.steps, 'the steps')
    if (error) fields.steps = error
  }

  if (values.expected.trim().length === 0) {
    fields.expected = REQUIRED_MESSAGE
  } else {
    const error = overCap(values.expected, REPORT_FIELD_LIMITS.expected, 'the expected result')
    if (error) fields.expected = error
  }

  if (values.actual.trim().length === 0) {
    fields.actual = REQUIRED_MESSAGE
  } else {
    const error = overCap(values.actual, REPORT_FIELD_LIMITS.actual, 'the actual result')
    if (error) fields.actual = error
  }

  if (values.severity !== 'critical' && values.severity !== 'high'
      && values.severity !== 'medium' && values.severity !== 'low') {
    fields.severity = 'Choose a severity.'
  }

  if (values.priority !== 'p1' && values.priority !== 'p2' && values.priority !== 'p3'
      && values.priority !== 'p4') {
    fields.priority = 'Choose a priority.'
  }

  if (values.reproducibility !== 'always' && values.reproducibility !== 'sometimes'
      && values.reproducibility !== 'once') {
    fields.reproducibility = 'Choose a reproducibility.'
  }

  return fields
}

/** Build the POST body with exactly the client-allowed keys. */
export function toSubmission(values: ReportFormValues): BugReportSubmission {
  const preconditions = values.preconditions.trim()
  return {
    title: values.title.trim(),
    environment: values.environment.trim(),
    preconditions: preconditions.length > 0 ? preconditions : null,
    steps: values.steps.trim(),
    expected: values.expected.trim(),
    actual: values.actual.trim(),
    severity: values.severity as ReportSeverity,
    priority: values.priority as ReportPriority,
    reproducibility: values.reproducibility,
  }
}

// ---------------------------------------------------------------------------
// Submission flow (framework-free; the transport is injected)
// ---------------------------------------------------------------------------

/** Minimal shape of the API errors we understand without importing the client. */
export interface SubmitErrorLike {
  status?: unknown
  code?: unknown
  message?: unknown
  fields?: unknown
}

export type ReportSubmitOutcome =
  | { kind: 'blocked' }
  | { kind: 'invalid'; fields: Partial<Record<ReportFieldName, string>> }
  | { kind: 'success'; response: ReportSubmissionResponse }
  | {
      kind: 'failure'
      /** Safe, learner-facing message; never a raw exception or stack. */
      message: string
      /** Per-field messages from a 400 response, when the server sent them. */
      fields: Partial<Record<ReportFieldName, string>> | null
      status: number | null
      code: string | null
    }

function asFieldMap(raw: unknown): Partial<Record<ReportFieldName, string>> | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entries = Object.entries(raw as Record<string, unknown>)
  const fields: Partial<Record<ReportFieldName, string>> = {}
  for (const [key, value] of entries) {
    if ((REPORT_FIELD_ORDER as readonly string[]).includes(key) && typeof value === 'string') {
      fields[key as ReportFieldName] = value
    }
  }
  return Object.keys(fields).length > 0 ? fields : null
}

/**
 * Map an unknown thrown value to a safe learner-facing outcome. Raw
 * exceptions, stack traces and server internals never reach the UI.
 */
export function describeSubmitError(error: unknown): Extract<ReportSubmitOutcome, { kind: 'failure' }> {
  const like = (typeof error === 'object' && error !== null ? error : {}) as SubmitErrorLike
  const status = typeof like.status === 'number' ? like.status : null
  const code = typeof like.code === 'string' ? like.code : null
  const serverMessage = typeof like.message === 'string' ? like.message.trim() : ''
  const fields = asFieldMap(like.fields)

  if (status === 400) {
    return {
      kind: 'failure',
      message: serverMessage || 'Check the highlighted fields and try again.',
      fields,
      status,
      code,
    }
  }
  if (status === 401) {
    return {
      kind: 'failure',
      message: serverMessage || 'Start the exercise before submitting a report.',
      fields: null,
      status,
      code,
    }
  }
  if (status === 404) {
    return {
      kind: 'failure',
      message: serverMessage || 'This hunt is not available. Reload the page and try again.',
      fields: null,
      status,
      code,
    }
  }
  if (status === 429) {
    // Never invent a retry duration — the server message stands on its own;
    // the response may carry Retry-After, handled by the caller if present.
    return {
      kind: 'failure',
      message:
        serverMessage ||
        'Too many report submissions from this network. Wait a moment and try again.',
      fields: null,
      status,
      code,
    }
  }
  if (status === null) {
    return {
      kind: 'failure',
      message:
        'The practice API could not be reached. Your report has not been submitted — the text you entered is kept. Check the API is running, then try again.',
      fields: null,
      status,
      code,
    }
  }
  return {
    kind: 'failure',
    message:
      'The report could not be submitted. Your text is kept — try again, and if it keeps failing, reset the exercise and re-open the hunt.',
    fields: null,
    status,
    code,
  }
}

export interface SubmitReportFlowInput {
  huntId: string
  values: ReportFormValues
  /** True while a previous submission is in flight (duplicate guard). */
  inFlight: boolean
  post: (huntId: string, submission: BugReportSubmission) => Promise<ReportSubmissionResponse>
}

/**
 * The whole submission pipeline minus React: duplicate guard → client
 * validation → transport → outcome. Failure outcomes never carry an
 * evaluation; the caller renders the server evaluation only on success.
 */
export async function submitReportFlow(
  input: SubmitReportFlowInput,
): Promise<ReportSubmitOutcome> {
  if (input.inFlight) {
    return { kind: 'blocked' }
  }
  const fields = validateReportValues(input.values)
  if (Object.keys(fields).length > 0) {
    return { kind: 'invalid', fields }
  }
  try {
    const response = await input.post(input.huntId, toSubmission(input.values))
    return { kind: 'success', response }
  } catch (error) {
    return describeSubmitError(error)
  }
}

// ---------------------------------------------------------------------------
// Verdict presentation (display only — the verdict itself comes from the server)
// ---------------------------------------------------------------------------

export interface VerdictDisplay {
  label: string
  /** Tag tone used by the UI ('ready' = solid, 'warn' = needs-work, 'planned' = incomplete). */
  tone: 'ready' | 'warn' | 'planned'
  /** One-line, learner-facing explanation of the band. */
  description: string
}

const VERDICT_DISPLAY: Record<ReportEvaluation['verdict'], VerdictDisplay> = {
  solid: {
    label: 'Solid',
    tone: 'ready',
    description: 'Score 80–100. The report identifies the problem with enough detail to act on.',
  },
  'needs-work': {
    label: 'Needs work',
    tone: 'warn',
    description: 'Score 50–79. The report is on the right track but misses detail a triage engineer would want.',
  },
  incomplete: {
    label: 'Incomplete',
    tone: 'planned',
    description: 'Score below 50. The report does not yet describe a reproducible problem.',
  },
}

export function verdictDisplay(verdict: ReportEvaluation['verdict']): VerdictDisplay {
  return VERDICT_DISPLAY[verdict]
}

/** Score band copy shown beneath the verdict tag. Never computed client-side. */
export const VERDICT_BANDS_NOTE = 'Verdict bands: 80–100 solid · 50–79 needs work · below 50 incomplete.'

// ---------------------------------------------------------------------------
// Downloadable report (markdown, generated from the submitted data only)
// ---------------------------------------------------------------------------

/**
 * Escape user-supplied text so it stays inert inside the markdown document:
 * backslashes, backticks, ampersands and angle brackets are escaped, and
 * any line that would open a heading is neutralised. Document structure can
 * then only come from this template, never from the learner's text.
 */
export function escapeMarkdownText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/^(#{1,6})(?=\s|$)/gm, '\\$1')
}

/** Severity/priority/reproducibility labels for the download, matching the UI. */
export function severityLabel(value: ReportSeverity): string {
  return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[value]
}

export function priorityLabel(value: ReportPriority): string {
  return { p1: 'P1 — Urgent', p2: 'P2 — High', p3: 'P3 — Normal', p4: 'P4 — Low' }[value]
}

export function reproducibilityLabel(value: ReportReproducibility): string {
  return { always: 'Always', sometimes: 'Sometimes', once: 'Once' }[value]
}

/**
 * File name for the download: `bug-report-<slug>-<yyyy-mm-dd>.md`.
 * Falls back to a dateless name when the timestamp is unusable.
 */
export function reportFilename(title: string, createdAt: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  const base = slug.length > 0 ? `bug-report-${slug}` : 'bug-report'
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(createdAt)?.[1]
  return date ? `${base}-${date}.md` : `${base}.md`
}

/**
 * Build the downloadable markdown from the *submitted* report and the
 * server's evaluation. Contains only learner-entered fields, the enums, the
 * rule-based score/verdict and learner-safe check feedback — no ids, no
 * finding-check terms, no defect data, no evaluator internals.
 */
export function reportMarkdown(
  report: BugReportView,
  evaluation: ReportEvaluation,
): string {
  const title = escapeMarkdownText(report.title.replace(/[\r\n]+/g, ' ').trim())
  const verdict = verdictDisplay(evaluation.verdict)
  const submitted = escapeMarkdownText(report.createdAt)
  const section = (label: string, body: string | null) => [
    `## ${label}`,
    '',
    body && body.trim().length > 0 ? escapeMarkdownText(body) : '_Not provided._',
    '',
  ]
  const checkLines = evaluation.checks.map(
    (check) =>
      `- ${check.passed ? 'PASS' : 'FAIL'} — **${escapeMarkdownText(check.label)}**: ${escapeMarkdownText(check.message)}`,
  )

  return [
    `# Bug report — ${title}`,
    '',
    `- Submitted: ${submitted}`,
    `- Environment: ${escapeMarkdownText(report.environment)}`,
    `- Severity: ${severityLabel(report.severity)}`,
    `- Priority: ${priorityLabel(report.priority)}`,
    `- Reproducibility: ${reproducibilityLabel(report.reproducibility)}`,
    '',
    ...section('Preconditions', report.preconditions),
    ...section('Steps to reproduce', report.steps),
    ...section('Expected result', report.expected),
    ...section('Actual result', report.actual),
    '## Evaluation (deterministic, rule-based — no AI)',
    '',
    `- Score: ${evaluation.score}/100 — ${verdict.label}`,
    ...checkLines,
    '',
    'Report quality and finding the defect are scored separately from each other:',
    'the score above grades the report itself, while discovery is based solely on',
    "whether the report's title, steps, expected and actual results describe the",
    'incorrect behaviour. A high-scoring report does not imply the defect was found,',
    'and a discovered defect does not raise the report-quality score on its own.',
    '',
    '---',
    "Generated in the browser from the report you submitted. It contains only what you",
    'wrote plus the rule-based evaluation — no internal identifiers, hidden defect',
    'details or evaluator internals are included.',
    '',
  ].join('\n')
}
