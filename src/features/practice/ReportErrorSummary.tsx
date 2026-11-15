// Error summary for the bug-report form (P4-M2 WP2). Rendered above the
// form on a failed submit: role="alert" + tabIndex={-1} so the caller can
// move focus to it, each entry linking to its control. Presentational only
// — focus management lives in the parent.

import type { MouseEvent, Ref } from 'react'
import { REPORT_FIELD_LABELS, REPORT_FIELD_ORDER, type ReportFieldName } from '../../lib/reportForm'

interface ReportErrorSummaryProps {
  /** Server message to show above the field list (e.g. rate limited), or null. */
  failure: string | null
  errors: Partial<Record<ReportFieldName, string>>
  fieldIds: Record<ReportFieldName, string>
  onNavigate: (name: ReportFieldName) => (event: MouseEvent<HTMLAnchorElement>) => void
  ref?: Ref<HTMLDivElement>
}

export function ReportErrorSummary({
  failure,
  errors,
  fieldIds,
  onNavigate,
  ref,
}: ReportErrorSummaryProps) {
  const entries = (Object.entries(errors) as Array<[ReportFieldName, string]>).sort(
    ([a], [b]) => REPORT_FIELD_ORDER.indexOf(a) - REPORT_FIELD_ORDER.indexOf(b),
  )

  return (
    <div
      className="form-error-summary"
      role="alert"
      tabIndex={-1}
      ref={ref}
      aria-labelledby="report-error-summary-title"
    >
      <h4 id="report-error-summary-title">There is a problem</h4>
      {failure !== null ? <p>{failure}</p> : null}
      {entries.length > 0 ? (
        <ul>
          {entries.map(([name, message]) => (
            <li key={name}>
              <a href={`#${fieldIds[name]}`} onClick={onNavigate(name)}>
                {REPORT_FIELD_LABELS[name]} — {message}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
