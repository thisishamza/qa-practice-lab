// One row of a /progress exercise list (R3). Shared by the collapsible lab
// sections. Rendering contract is unchanged from the P4-M3 dashboard:
// scenario-wired hunts link to their scenario page; exercise entries link
// to their lab route; discovery, attempt status, best score and hints are
// rendered exactly as before.

import { Link } from 'react-router-dom'
import { AttemptStatusChip } from '../practice/AttemptStatusChip'
import { Tag } from '../../components/ui/Tag'
import { Icon } from '../../components/ui/Icon'
import { formatProgressDate } from '../../lib/progressDates'
import type { ProgressHuntEntry } from '../../shared/learning'

function attemptCountLabel(attempts: number): string {
  return attempts === 1 ? '1 attempt' : `${attempts} attempts`
}

export function ProgressEntryRow({
  entry,
  hrefFor,
}: {
  entry: ProgressHuntEntry
  hrefFor: (entry: ProgressHuntEntry) => string
}) {
  const href = hrefFor(entry)
  const hasDestination = Boolean(href)
  return (
    <li className="progress-exercise">
      <div className="progress-exercise-body">
        {hasDestination ? (
          <Link className="progress-exercise-title" to={href}>
            {entry.title}
          </Link>
        ) : (
          <span className="progress-exercise-title">{entry.title}</span>
        )}
        <span className="progress-exercise-meta">
          {attemptCountLabel(entry.attempts)} ·{' '}
          {entry.lastSubmittedAt
            ? `last submitted ${formatProgressDate(entry.lastSubmittedAt)}`
            : 'not submitted yet'}
        </span>
      </div>
      <div className="progress-exercise-flags">
        {entry.discovered ? (
          <Tag tone="ready" icon="check">
            Discovered
          </Tag>
        ) : (
          <Tag tone="neutral">Not discovered</Tag>
        )}
        <AttemptStatusChip status={entry.status} bestQualityScore={entry.bestScore} />
        <span className="progress-exercise-stat">
          {entry.bestScore !== null ? (
            <>
              <span aria-hidden="true">Best {entry.bestScore}</span>
              <span className="sr-only">Best score {entry.bestScore} out of 100</span>
            </>
          ) : (
            <>
              <span aria-hidden="true">Best —</span>
              <span className="sr-only">No score yet</span>
            </>
          )}
        </span>
        <span className="progress-exercise-stat">
          {entry.hintsUsed === 1 ? '1 hint' : `${entry.hintsUsed} hints`}
        </span>
      </div>
      {hasDestination ? (
        <Link
          className="progress-exercise-go"
          to={href}
          aria-label={`Open ${entry.title}`}
        >
          <Icon name="chevron-right" size={16} />
        </Link>
      ) : null}
    </li>
  )
}
