import { Link } from 'react-router-dom'
import { AttemptStatusChip } from '../practice/AttemptStatusChip'
import { Tag } from '../../components/ui/Tag'
import { Icon } from '../../components/ui/Icon'
import { SectionHeader } from '../../components/ui/PageChrome'
import { formatProgressDate } from '../../lib/progressDates'
import type { ProgressHuntEntry } from '../../shared/learning'

function attemptCountLabel(attempts: number): string {
  return attempts === 1 ? '1 attempt' : `${attempts} attempts`
}

export function LabProgressSection({
  id,
  title,
  description,
  entries,
  hrefFor,
}: {
  id: string
  title: string
  description: string
  entries: readonly ProgressHuntEntry[]
  hrefFor: (entry: { huntId: string }) => string
}) {
  return (
    <section className="content-section" aria-labelledby={id}>
      <SectionHeader id={id} title={title} description={description} />
      <ul className="progress-exercise-list">
        {entries.map((entry) => (
          <li key={entry.huntId} className="progress-exercise">
            <div className="progress-exercise-body">
              <Link className="progress-exercise-title" to={hrefFor(entry)}>
                {entry.title}
              </Link>
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
            <Link className="progress-exercise-go" to={hrefFor(entry)} aria-label={`Open ${entry.title}`}>
              <Icon name="chevron-right" size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
