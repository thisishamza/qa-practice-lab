// Collapsible lab section for the /progress dashboard (R3). Native
// <details>/<summary>: keyboard- and screen-reader-accessible out of the
// box (expanded/collapsed state is exposed by the summary's implicit
// button semantics), reduced-motion safe, and no JavaScript required to
// disclose. Sections where the learner has no attempts start collapsed so
// the page stays short; sections with activity start expanded.

import { Icon } from '../../components/ui/Icon'
import { ProgressEntryRow } from './ProgressEntryRow'
import { summarizeEntries, summaryLabel, shouldStartOpen } from './progressGroups'
import type { ProgressHuntEntry } from '../../shared/learning'

export function ProgressDisclosureSection({
  title,
  description,
  entries,
  hrefFor,
}: {
  title: string
  description: string
  entries: readonly ProgressHuntEntry[]
  hrefFor: (entry: ProgressHuntEntry) => string
}) {
  const summary = summarizeEntries(entries)
  return (
    <details className="progress-disclosure" open={shouldStartOpen(entries)}>
      <summary className="progress-disclosure-summary" aria-label={`${title} — ${summaryLabel(summary)}`}>
        <Icon name="chevron-right" size={16} className="progress-disclosure-chevron" />
        <span className="progress-disclosure-copy">
          <span className="progress-disclosure-title">{title}</span>
          <span className="progress-disclosure-counts" aria-hidden="true">
            {summaryLabel(summary)}
          </span>
        </span>
        <span className="progress-disclosure-badge" aria-hidden="true">
          {summary.reported}/{summary.total} reported
        </span>
      </summary>
      <div className="progress-disclosure-body">
        <p className="progress-disclosure-description">{description}</p>
        {entries.length > 0 ? (
          <ul className="progress-exercise-list" data-density="compact">
            {entries.map((entry) => (
              <ProgressEntryRow key={entry.huntId} entry={entry} hrefFor={hrefFor} />
            ))}
          </ul>
        ) : (
          <p className="progress-empty-note">No attemptable exercises in this lab yet.</p>
        )}
      </div>
    </details>
  )
}
