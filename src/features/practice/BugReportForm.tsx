// Structured bug-report form (P4-M2 WP2). Replaces the old local-only
// markdown export with a real report submission against
// POST /api/v1/practice/hunts/:huntId/report. The server is the source of
// truth: it validates, persists, evaluates and returns the result; this
// component adds client-side validation for convenience only, keeps the
// learner's text on failure, and renders the server's evaluation verbatim.
//
// Accessibility: every control has a persistent visible label; required and
// optional fields are marked in text; inline errors use aria-describedby +
// aria-invalid; on a failed submit focus moves to a linked error summary
// (role="alert", tabIndex={-1}); summary links move focus to the control.
// Duplicate submissions are impossible while one is in flight.

import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type FormEvent, type MouseEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import {
  EMPTY_REPORT_FORM_VALUES,
  REPORT_FIELD_IDS,
  REPORT_FIELD_LABELS,
  REPORT_FIELD_LIMITS,
  reportFilename,
  reportMarkdown,
  submitReportFlow,
  validateReportValues,
  type ReportFieldName,
  type ReportFormValues,
} from '../../lib/reportForm'
import { submitReport } from './api'
import { ReportEvaluationView } from './ReportEvaluationView'
import { ReportErrorSummary } from './ReportErrorSummary'
import type { ReportSubmissionResponse } from '../../shared/learning'

const FIELD_IDS = REPORT_FIELD_IDS
const FIELD_LABELS = REPORT_FIELD_LABELS

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical — the shop is unusable, data is lost or compromised' },
  { value: 'high', label: 'High — core functionality is broken with no workaround' },
  { value: 'medium', label: 'Medium — wrong behaviour, but there is a workaround' },
  { value: 'low', label: 'Low — cosmetic or minor friction' },
] as const

const PRIORITY_OPTIONS = [
  { value: 'p1', label: 'P1 — Urgent: fix immediately' },
  { value: 'p2', label: 'P2 — High: fix in the next release' },
  { value: 'p3', label: 'P3 — Normal: schedule as usual' },
  { value: 'p4', label: 'P4 — Low: fix when there is capacity' },
] as const

const REPRODUCIBILITY_OPTIONS = [
  { value: 'always', label: 'Always' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'once', label: 'Once' },
] as const

export function BugReportForm({
  huntId,
  onSubmitted,
}: {
  huntId: string
  /** Called after a successful submission so surrounding UI (e.g. status chips) can refresh. */
  onSubmitted?: (response: ReportSubmissionResponse) => void
}) {
  const [values, setValues] = useState<ReportFormValues>(EMPTY_REPORT_FORM_VALUES)
  const [errors, setErrors] = useState<Partial<Record<ReportFieldName, string>>>({})
  /** Server message for the failure shown above the form (null when there is none). */
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ReportSubmissionResponse | null>(null)
  const [summaryNonce, setSummaryNonce] = useState(0)
  const inFlight = useRef(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  // Move focus to the error summary whenever it is (re)raised, on both the
  // client-validation path and the server-validation path.
  useEffect(() => {
    if (summaryNonce > 0) {
      summaryRef.current?.focus()
    }
  }, [summaryNonce])

  function fieldProps(name: ReportFieldName) {
    const error = errors[name]
    return {
      id: FIELD_IDS[name],
      'aria-invalid': error ? ('true' as const) : undefined,
      'aria-describedby': error
        ? `${FIELD_IDS[name]}-error`
        : `${FIELD_IDS[name]}-hint`,
    }
  }

  function setField(name: ReportFieldName, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const name = event.target.name as ReportFieldName
    setField(name, event.target.value)
  }

  function handleBlur(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const name = event.target.name as ReportFieldName
    const found = validateReportValues(values)
    const message = found[name]
    setErrors((prev) => {
      if (message) return { ...prev, [name]: message }
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    setSubmitting(true)
    setFailure(null)
    try {
      const outcome = await submitReportFlow({
        huntId,
        values,
        // The ref above is the real duplicate guard; the controller re-checks
        // so the flow stays honest when called without one.
        inFlight: false,
        post: submitReport,
      })
      if (outcome.kind === 'blocked') {
        return
      }
      if (outcome.kind === 'invalid') {
        setErrors(outcome.fields)
        setResult(null)
        setSummaryNonce((n) => n + 1)
        return
      }
      if (outcome.kind === 'failure') {
        if (outcome.fields) {
          setErrors(outcome.fields)
        }
        setFailure(outcome.message)
        // Keep the learner's text untouched — nothing is cleared here.
        setResult(null)
        setSummaryNonce((n) => n + 1)
        return
      }
      setErrors({})
      setFailure(null)
      setResult(outcome.response)
      onSubmitted?.(outcome.response)
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  function focusField(name: ReportFieldName) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      document.getElementById(FIELD_IDS[name])?.focus()
    }
  }

  function download() {
    if (!result) {
      return
    }
    const markdown = reportMarkdown(result.report, result.evaluation)
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = reportFilename(result.report.title, result.report.createdAt)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const showSummary = Object.keys(errors).length > 0 || failure !== null

  if (result) {
    return (
      <div className="report-block">
        <ReportEvaluationView
          evaluation={result.evaluation}
          attempt={result.attempt}
          onRevise={() => setResult(null)}
          onDownload={download}
        />
      </div>
    )
  }

  return (
    <form className="report-form" noValidate onSubmit={(event) => void onSubmit(event)}>
      <p className="panel-note">
        Found something? Write the report while it is in front of you. It is stored for this
        practice session and evaluated by deterministic rules on the server — no AI, nothing
        leaves your session.
      </p>

      {showSummary ? (
        <ReportErrorSummary
          failure={failure}
          errors={errors}
          fieldIds={FIELD_IDS}
          onNavigate={focusField}
          ref={summaryRef}
        />
      ) : null}

      <div className="report-field">
        <label htmlFor={FIELD_IDS.title}>
          {FIELD_LABELS.title} <span className="field-requirement">(required)</span>
        </label>
        <input
          {...fieldProps('title')}
          name="title"
          type="text"
          autoComplete="off"
          maxLength={REPORT_FIELD_LIMITS.title}
          placeholder="One line: what is broken?"
          value={values.title}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-required="true"
        />
        {errors.title ? (
          <p className="report-field-error" id="report-title-error">{errors.title}</p>
        ) : (
          <p className="field-hint" id="report-title-hint">Up to {REPORT_FIELD_LIMITS.title} characters.</p>
        )}
      </div>

      <div className="report-field">
        <label htmlFor={FIELD_IDS.environment}>
          {FIELD_LABELS.environment} <span className="field-requirement">(required)</span>
        </label>
        <input
          {...fieldProps('environment')}
          name="environment"
          type="text"
          autoComplete="off"
          maxLength={REPORT_FIELD_LIMITS.environment}
          placeholder="e.g. Meridian practice shop, Chrome on Linux"
          value={values.environment}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-required="true"
        />
        {errors.environment ? (
          <p className="report-field-error" id="report-environment-error">{errors.environment}</p>
        ) : (
          <p className="field-hint" id="report-environment-hint">Browser, OS, device, build/version or the practice shop.</p>
        )}
      </div>

      <div className="report-field">
        <label htmlFor={FIELD_IDS.preconditions}>
          {FIELD_LABELS.preconditions} <span className="field-requirement field-optional">(optional)</span>
        </label>
        <textarea
          {...fieldProps('preconditions')}
          name="preconditions"
          rows={2}
          maxLength={REPORT_FIELD_LIMITS.preconditions}
          placeholder="State the shop was in before you started, e.g. empty cart, signed out"
          value={values.preconditions}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        {errors.preconditions ? (
          <p className="report-field-error" id="report-preconditions-error">{errors.preconditions}</p>
        ) : (
          <p className="field-hint" id="report-preconditions-hint">Up to {REPORT_FIELD_LIMITS.preconditions} characters.</p>
        )}
      </div>

      <div className="report-field">
        <label htmlFor={FIELD_IDS.steps}>
          {FIELD_LABELS.steps} <span className="field-requirement">(required)</span>
        </label>
        <textarea
          {...fieldProps('steps')}
          name="steps"
          rows={5}
          maxLength={REPORT_FIELD_LIMITS.steps}
          placeholder={'1. Open /shop\n2. Search for “…”\n3. Note the result'}
          value={values.steps}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-required="true"
        />
        {errors.steps ? (
          <p className="report-field-error" id="report-steps-error">{errors.steps}</p>
        ) : (
          <p className="field-hint" id="report-steps-hint">Number the steps; one action per step. Up to {REPORT_FIELD_LIMITS.steps} characters.</p>
        )}
      </div>

      <div className="report-field">
        <label htmlFor={FIELD_IDS.expected}>
          {FIELD_LABELS.expected} <span className="field-requirement">(required)</span>
        </label>
        <textarea
          {...fieldProps('expected')}
          name="expected"
          rows={2}
          maxLength={REPORT_FIELD_LIMITS.expected}
          placeholder="What should happen, per the specification"
          value={values.expected}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-required="true"
        />
        {errors.expected ? (
          <p className="report-field-error" id="report-expected-error">{errors.expected}</p>
        ) : (
          <p className="field-hint" id="report-expected-hint">Up to {REPORT_FIELD_LIMITS.expected} characters.</p>
        )}
      </div>

      <div className="report-field">
        <label htmlFor={FIELD_IDS.actual}>
          {FIELD_LABELS.actual} <span className="field-requirement">(required)</span>
        </label>
        <textarea
          {...fieldProps('actual')}
          name="actual"
          rows={2}
          maxLength={REPORT_FIELD_LIMITS.actual}
          placeholder="What actually happens when you follow the steps"
          value={values.actual}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-required="true"
        />
        {errors.actual ? (
          <p className="report-field-error" id="report-actual-error">{errors.actual}</p>
        ) : (
          <p className="field-hint" id="report-actual-hint">Up to {REPORT_FIELD_LIMITS.actual} characters.</p>
        )}
      </div>

      <div className="report-field-row">
        <div className="report-field">
          <label htmlFor={FIELD_IDS.severity}>
            {FIELD_LABELS.severity} <span className="field-requirement">(required)</span>
          </label>
          <select
            {...fieldProps('severity')}
            name="severity"
            value={values.severity}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-required="true"
          >
            <option value="">Choose a severity…</option>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.severity ? (
            <p className="report-field-error" id="report-severity-error">{errors.severity}</p>
          ) : (
            <p className="field-hint" id="report-severity-hint">Impact on the application.</p>
          )}
        </div>

        <div className="report-field">
          <label htmlFor={FIELD_IDS.priority}>
            {FIELD_LABELS.priority} <span className="field-requirement">(required)</span>
          </label>
          <select
            {...fieldProps('priority')}
            name="priority"
            value={values.priority}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-required="true"
          >
            <option value="">Choose a priority…</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.priority ? (
            <p className="report-field-error" id="report-priority-error">{errors.priority}</p>
          ) : (
            <p className="field-hint" id="report-priority-hint">Urgency in the tracker — independent of severity; never derived from it.</p>
          )}
        </div>
      </div>

      <div className="report-field">
        <label htmlFor={FIELD_IDS.reproducibility}>
          {FIELD_LABELS.reproducibility}
        </label>
        <select
          {...fieldProps('reproducibility')}
          name="reproducibility"
          value={values.reproducibility}
          onChange={handleChange}
          onBlur={handleBlur}
        >
          {REPRODUCIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {errors.reproducibility ? (
          <p className="report-field-error" id="report-reproducibility-error">{errors.reproducibility}</p>
        ) : (
          <p className="field-hint" id="report-reproducibility-hint">How reliably the defect happens when the steps are followed.</p>
        )}
      </div>

      <div className="button-row">
        <Button type="submit" loading={submitting} disabled={submitting}>
          <Icon name="bug" size={16} />
          {submitting ? 'Submitting the report…' : 'Submit the report'}
        </Button>
      </div>
    </form>
  )
}
