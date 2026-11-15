// Structured bug reports (P4-M1 WP2) — persistence, validation and the
// submission endpoint. The deterministic evaluator lands in WP3; until then
// every stored report carries the WP2 placeholder (`quality_score = 0`,
// empty feedback checklist) and the response omits `evaluation`.
//
// Endpoint:
//   POST /api/v1/practice/hunts/:huntId/report
//     Body: { title, environment, preconditions?, steps, expected, actual,
//             severity, priority, reproducibility? }
//     201 → { attempt, report } (learner-safe; no ids, no evaluator data)
//     400 invalid_request (+ per-field `fields`) — body/validation failures
//     401 session_required                       — no live practice session
//     404 hunt_not_found                         — unknown/forged hunt id
//     429 rate_limited (+ Retry-After)           — > 30 submissions/IP/min
//
// Security model:
// - Everything resolves from the `mpl_session` cookie. The client never
//   sends an attempt id, defect id or owner; ownership is enforced by
//   scoping every query to the caller's live session (plus the signed-in
//   customer binding resolved server-side).
// - `report:<iphash>` fixed-window rate limit (30/min) is consumed before
//   the body is parsed, so malformed-traffic churn is bounded too. Only a
//   SHA-256 hash of the IP is stored — never the raw address — and the
//   limiter is skipped entirely when no IP is visible (local development).
// - Validation is layered: type checks → control-character rejection →
//   length caps → enum checks, at both the application layer (here) and the
//   database (migration 0010 CHECKs). Severity/priority/reproducibility are
//   matched case-insensitively and stored lowercase; nothing else is
//   silently rewritten beyond trimming and single-line whitespace collapse
//   (multi-line fields keep their line structure).
// - Report text is learner data: synthetic by policy, stored tied to the
//   session, cascade-deleted with it, never logged. No endpoint accepts a
//   client-supplied defect id, and no response carries one.

import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type {
  AttemptView,
  BugReportView,
  ReportPriority,
  ReportReproducibility,
  ReportSeverity,
  ReportSubmissionResponse,
} from '../shared/learning'
import type { AppEnv } from './app'
import {
  attemptView,
  resolveActiveCustomerId,
  resolveAttemptForSubmission,
  submissionStatements,
} from './attempts'
import { HUNT_ID_PATTERN, findHunt } from './hunts'
import { clientIp, consumeRateLimit, sha256Hex, REPORT_LIMIT } from './rateLimit'
import {
  SESSION_COOKIE,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'

export const SINGLE_LINE_MAX = 200
export const PRECONDITIONS_MAX = 1000
export const STEPS_MAX = 4000
export const PROSE_MAX = 2000
/** Cap on the stored JSON feedback payload (the evaluator emits ≤ 32 checks). */
export const FEEDBACK_MAX = 16384

const SEVERITIES: readonly ReportSeverity[] = ['critical', 'high', 'medium', 'low']
const PRIORITIES: readonly ReportPriority[] = ['p1', 'p2', 'p3', 'p4']
const REPRODUCIBILITY: readonly ReportReproducibility[] = ['always', 'sometimes', 'once']

/** True when the string contains a C0/C1 control character or DEL. */
function hasForbiddenControlChar(value: string, allowMultiline: boolean): boolean {
  for (const char of value) {
    if (allowMultiline && (char === '\n' || char === '\t')) {
      continue
    }
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true
    }
  }
  return false
}

type FieldResult = { value: string } | { error: string }

/** Single-line field: trim, collapse whitespace runs, reject control characters. */
function singleLine(raw: unknown, max: number, message: string): FieldResult {
  if (typeof raw !== 'string') {
    return { error: message }
  }
  if (hasForbiddenControlChar(raw, false)) {
    return { error: message }
  }
  const value = raw.trim().replace(/\s+/g, ' ')
  if (value.length === 0 || value.length > max) {
    return { error: message }
  }
  return { value }
}

/**
 * Multi-line field: normalize line endings to LF, trim, keep interior line
 * structure. Tabs and newlines are permitted; every other control character
 * is rejected. Length is measured after normalization.
 */
function multiLine(raw: unknown, max: number, message: string): FieldResult {
  if (typeof raw !== 'string') {
    return { error: message }
  }
  const normalized = raw.replace(/\r\n?/g, '\n')
  if (hasForbiddenControlChar(normalized, true)) {
    return { error: message }
  }
  const value = normalized.trim()
  if (value.length === 0 || value.length > max) {
    return { error: message }
  }
  return { value }
}

/** Optional multi-line field: absent/empty → null; otherwise as multiLine. */
function optionalMultiLine(
  raw: unknown,
  max: number,
  message: string,
): { value: string | null } | { error: string } {
  if (raw === undefined || raw === null) {
    return { value: null }
  }
  if (typeof raw !== 'string') {
    return { error: message }
  }
  const normalized = raw.replace(/\r\n?/g, '\n')
  if (hasForbiddenControlChar(normalized, true)) {
    return { error: message }
  }
  const value = normalized.trim()
  if (value.length > max) {
    return { error: message }
  }
  return { value: value.length === 0 ? null : value }
}

function enumValue<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  message: string,
): { value: T } | { error: string } {
  if (typeof raw !== 'string') {
    return { error: message }
  }
  const normalized = raw.trim().toLowerCase()
  return (allowed as readonly string[]).includes(normalized)
    ? { value: normalized as T }
    : { error: message }
}

export interface ValidatedReport {
  title: string
  environment: string
  preconditions: string | null
  steps: string
  expected: string
  actual: string
  severity: ReportSeverity
  priority: ReportPriority
  reproducibility: ReportReproducibility
}

export function validateReportBody(
  raw: unknown,
): { report: ValidatedReport; fields: Record<string, string> } | { fields: Record<string, string> } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { fields: { body: 'Expected a JSON object with the report details.' } }
  }
  const body = raw as Record<string, unknown>
  const fields: Record<string, string> = {}

  const title = singleLine(body.title, SINGLE_LINE_MAX, `Enter a title (1–${SINGLE_LINE_MAX} characters).`)
  if ('error' in title) fields.title = title.error

  const environment = singleLine(body.environment, SINGLE_LINE_MAX, `Enter an environment (1–${SINGLE_LINE_MAX} characters).`)
  if ('error' in environment) fields.environment = environment.error

  const preconditions = optionalMultiLine(body.preconditions, PRECONDITIONS_MAX, `Keep preconditions within ${PRECONDITIONS_MAX} characters and free of control characters.`)
  if ('error' in preconditions) fields.preconditions = preconditions.error

  const steps = multiLine(body.steps, STEPS_MAX, `Enter the steps to reproduce (1–${STEPS_MAX} characters).`)
  if ('error' in steps) fields.steps = steps.error

  const expected = multiLine(body.expected, PROSE_MAX, `Enter the expected behaviour (1–${PROSE_MAX} characters).`)
  if ('error' in expected) fields.expected = expected.error

  const actual = multiLine(body.actual, PROSE_MAX, `Enter the actual behaviour (1–${PROSE_MAX} characters).`)
  if ('error' in actual) fields.actual = actual.error

  const severity = enumValue(body.severity, SEVERITIES, 'Choose a severity: critical, high, medium or low.')
  if ('error' in severity) fields.severity = severity.error

  const priority = enumValue(body.priority, PRIORITIES, 'Choose a priority: p1, p2, p3 or p4.')
  if ('error' in priority) fields.priority = priority.error

  const reproducibility =
    body.reproducibility === undefined || body.reproducibility === null
      ? { value: 'always' as ReportReproducibility }
      : enumValue(body.reproducibility, REPRODUCIBILITY, 'Choose a reproducibility: always, sometimes or once.')
  if ('error' in reproducibility) fields.reproducibility = reproducibility.error

  if (Object.keys(fields).length > 0) {
    return { fields }
  }
  return {
    report: {
      title: (title as { value: string }).value,
      environment: (environment as { value: string }).value,
      preconditions: (preconditions as { value: string | null }).value,
      steps: (steps as { value: string }).value,
      expected: (expected as { value: string }).value,
      actual: (actual as { value: string }).value,
      severity: (severity as { value: ReportSeverity }).value,
      priority: (priority as { value: ReportPriority }).value,
      reproducibility: (reproducibility as { value: ReportReproducibility }).value,
    },
    fields,
  }
}

export const reportRoutes = new Hono<AppEnv>()

reportRoutes.post('/practice/hunts/:huntId/report', async (c) => {
  const huntId = c.req.param('huntId') ?? ''
  if (!HUNT_ID_PATTERN.test(huntId)) {
    return c.json(
      { error: 'invalid_request', message: 'A hunt id looks like hunt-topic-001.' },
      400,
    )
  }
  if (!findHunt(huntId)) {
    return c.json(
      { error: 'hunt_not_found', message: 'No such practice hunt exists.' },
      404,
    )
  }

  // Mutation abuse control, counted before the body is parsed so malformed
  // churn is bounded too. Local development without a visible IP is not
  // capped. The global mutation cap still applies on top (app.ts).
  const ip = clientIp(c)
  if (ip) {
    const decision = await consumeRateLimit(c.env.DB, 'report', await sha256Hex(ip), REPORT_LIMIT)
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds))
      return c.json(
        {
          error: 'rate_limited',
          message: 'Too many report submissions from this network. Wait a minute and try again.',
        },
        429,
      )
    }
  }

  const presented = getCookie(c, SESSION_COOKIE)
  const live =
    presented && isTokenFormat(presented)
      ? await findLiveSession(c.env.DB, await hashSessionToken(presented))
      : null
  if (!live) {
    return c.json(
      {
        error: 'session_required',
        message: 'Start the exercise before submitting a report.',
      },
      401,
    )
  }

  const body = await c.req.json().catch(() => null)
  const validated = validateReportBody(body)
  if (!('report' in validated)) {
    return c.json(
      {
        error: 'invalid_request',
        message: 'Check the highlighted fields and try again.',
        fields: validated.fields,
      },
      400,
    )
  }
  const report = validated.report

  // Attach the synthetic customer explicitly, and only when the browser is
  // signed in to an ACTIVE account; otherwise the report and its attempt
  // stay guest-scoped (customer_id NULL, never silently adopted later).
  const customerId = await resolveActiveCustomerId(c)

  const attempt = await resolveAttemptForSubmission(c.env.DB, live.id, huntId)
  const now = new Date().toISOString()

  // Report insert and attempt submission-stamp commit as ONE all-or-nothing
  // D1 batch: a failure anywhere leaves neither a report nor a stamped
  // attempt behind.
  const stamp = submissionStatements(attempt.id, customerId, now)
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO bug_reports
         (attempt_id, title, environment, preconditions, steps, expected, actual,
          severity, priority, reproducibility, quality_score, feedback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', ?)`,
    ).bind(
      attempt.id,
      report.title,
      report.environment,
      report.preconditions,
      report.steps,
      report.expected,
      report.actual,
      report.severity,
      report.priority,
      report.reproducibility,
      now,
    ),
    c.env.DB.prepare(stamp.sql).bind(...stamp.binds),
  ])

  const submittedAt = attempt.submitted_at ?? now
  const attemptResponse: AttemptView = attemptView({
    ...attempt,
    status: attempt.status === 'in_progress' ? 'submitted' : attempt.status,
    submitted_at: submittedAt,
  })
  const reportResponse: BugReportView = {
    title: report.title,
    environment: report.environment,
    preconditions: report.preconditions,
    steps: report.steps,
    expected: report.expected,
    actual: report.actual,
    severity: report.severity,
    priority: report.priority,
    reproducibility: report.reproducibility,
    qualityScore: 0, // WP2 placeholder; WP3 replaces with the real evaluation.
    feedback: [],
    createdAt: now,
  }

  return c.json(
    { attempt: attemptResponse, report: reportResponse } satisfies ReportSubmissionResponse,
    201,
  )
})
