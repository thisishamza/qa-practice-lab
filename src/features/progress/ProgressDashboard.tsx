// Presentational shell of the real /progress dashboard (P4-M3 WP1). Pure:
// every value comes from the caller (the ProgressPage container fetches it
// from GET /api/v1/practice/progress). Discovery is never inferred from
// scores; attempt status uses the shared chip vocabulary; guest vs
// signed-in durability copy is chosen from the server's `persistence`
// field, never from browser state.

import { Link } from 'react-router-dom'
import type { ProgressResponse } from '../../shared/learning'
import type { ProgressDashboardState } from './progress-types'

export type { ProgressDashboardState } from './progress-types'
import { LabProgressSection } from './LabProgressSection'
import { recommendedHuntScenarioIds, getScenario } from '../../data/scenarios'
import { formatProgressDate, formatProgressDateTime } from '../../lib/progressDates'
import { verdictDisplay } from '../../lib/reportForm'
import { Breadcrumbs, SectionHeader } from '../../components/ui/PageChrome'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState, ErrorState } from '../../components/ui/States'
import { Callout } from '../../components/ui/Callout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { StatTile } from '../../components/ui/StatTile'
import { Tag } from '../../components/ui/Tag'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { AttemptStatusChip } from '../practice/AttemptStatusChip'

const firstRecommended = getScenario(recommendedHuntScenarioIds[0] ?? '')

function attemptCountLabel(attempts: number): string {
  return attempts === 1 ? '1 attempt' : `${attempts} attempts`
}

function persistenceBanner(persistence: ProgressResponse['persistence']) {
  if (persistence === 'customer') {
    return (
      <Callout tone="success" title="Signed in — attributed progress">
        Reports submitted while signed in are attributed to your synthetic training account — the
        account associated at submission time — and stay visible to it. Attempts and reports made
        while you were a guest remain tied to the practice session that made them and never
        transfer into the account.
      </Callout>
    )
  }
  return (
    <Callout tone="info" title="Guest progress — temporary by design">
      Everything on this page belongs to this browser&rsquo;s anonymous practice session and
      expires with it (7 days, then deleted). It is never copied into an account and never carries
      over when you sign in. Sign in with a demo account to attribute new reports to that account.
    </Callout>
  )
}

function zeroState() {
  return (
    <Callout tone="info" title="Nothing recorded yet">
      No attempt at any hunt exists yet. Your statuses, scores and discoveries will appear here
      once you start a hunt and submit a report.{' '}
      {firstRecommended ? (
        <Link to={`/scenarios/${firstRecommended.id}`}>
          Start with {firstRecommended.title}
        </Link>
      ) : (
        <Link to="/practice">Go to the practice environment</Link>
      )}
    </Callout>
  )
}

export function ProgressDashboard({ state }: { state: ProgressDashboardState }) {
  if (state.status === 'loading') {
    return (
      <div className="stack">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Progress' }]} />
        <PageHeader eyebrow="Learning record" title="Progress" />
        <LoadingState label="Loading your progress…" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="stack">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Progress' }]} />
        <PageHeader eyebrow="Learning record" title="Progress" />
        <ErrorState
          title="Your progress could not be loaded"
          description={`${state.message} Check the practice API is running, then try again.`}
          action={
            <Button size="sm" onClick={state.onRetry}>
              <Icon name="reset" size={15} />
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const { data, refreshing, onRefresh, refreshError } = state
  const { totals } = data
  const isZero = totals.attempts === 0
  const exerciseCount = data.hunts.length
  const huntScenarioIds = new Map(data.hunts.map((hunt) => [hunt.huntId, hunt.scenarioId]))
  // Database Testing groups the SQL exercises and SQL hunts beneath the hunt list.
  const isDatabaseTarget = (id: string) => id.startsWith('sql-') || id.startsWith('hunt-db-')
  const isContractTarget = (id: string) => id.startsWith('contract-') || id.startsWith('hunt-contract-')
  const isPerformanceTarget = (id: string) => id.startsWith('perf-') || id.startsWith('hunt-perf-')
  const isSecurityTarget = (id: string) => id.startsWith('sec-') || id.startsWith('hunt-sec-')
  const isEventTarget = (id: string) => id.startsWith('evt-') || id.startsWith('hunt-event-')
  const labTargets = (id: string) =>
    isDatabaseTarget(id) || isContractTarget(id) || isPerformanceTarget(id) || isSecurityTarget(id) || isEventTarget(id)
  const huntEntries = data.hunts.filter((entry) => !labTargets(entry.huntId))
  const databaseEntries = data.hunts.filter((entry) => isDatabaseTarget(entry.huntId))
  const contractEntries = data.hunts.filter((entry) => isContractTarget(entry.huntId))
  const performanceEntries = data.hunts.filter((entry) => isPerformanceTarget(entry.huntId))
  const securityEntries = data.hunts.filter((entry) => isSecurityTarget(entry.huntId))
  const eventEntries = data.hunts.filter((entry) => isEventTarget(entry.huntId))
  const databaseHref = (entry: { huntId: string }): string =>
    entry.huntId.startsWith('hunt-db-')
      ? `/scenarios/${huntScenarioIds.get(entry.huntId) ?? ''}`
      : `/database/exercises/${entry.huntId}`
  const contractHref = (entry: { huntId: string }): string =>
    entry.huntId.startsWith('hunt-contract-')
      ? `/scenarios/${huntScenarioIds.get(entry.huntId) ?? ''}`
      : `/contract/exercises/${entry.huntId}`
  const performanceHref = (entry: { huntId: string }): string =>
    entry.huntId.startsWith('hunt-perf-')
      ? `/scenarios/${huntScenarioIds.get(entry.huntId) ?? ''}`
      : `/performance/exercises/${entry.huntId}`
  const securityHref = (entry: { huntId: string }): string =>
    entry.huntId.startsWith('hunt-sec-')
      ? `/scenarios/${huntScenarioIds.get(entry.huntId) ?? ''}`
      : `/security/exercises/${entry.huntId}`
  const eventHref = (entry: { huntId: string }): string =>
    entry.huntId.startsWith('hunt-event-')
      ? `/scenarios/${huntScenarioIds.get(entry.huntId) ?? ''}`
      : `/microservices/exercises/${entry.huntId}`

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Progress' }]} />
      <PageHeader
        eyebrow="Learning record"
        title="Progress"
        description="Real numbers from your own practice attempts on this server — nothing sampled, nothing stored beyond the practice session."
        actions={
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
            <Icon name="reset" size={15} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {persistenceBanner(data.persistence)}

      {refreshError ? (
        <div className="hunt-panel-error" role="alert">
          <p>
            <Icon name="alert" size={16} /> The latest numbers could not be refreshed — showing the
            last ones this server returned. ({refreshError})
          </p>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            <Icon name="reset" size={15} />
            Try again
          </Button>
        </div>
      ) : null}

      {isZero ? zeroState() : null}

      <section className="content-section" aria-labelledby="activity-title">
        <SectionHeader
          id="activity-title"
          title="Your activity"
          description="Every number derives from persisted attempts and reports — no estimates, no streaks."
        />
        <div className="stat-grid">
          <StatTile label="Attempts" value={totals.attempts} hint="across all hunts" />
          <StatTile label="Reports submitted" value={totals.reports} hint="one row per submission" />
          <StatTile
            label="Defects discovered"
            value={`${totals.discovered} of ${exerciseCount}`}
            hint="finding-check evidence only"
          />
          <StatTile label="Hints used" value={totals.hintsUsed} hint="never lowers a score" />
          <StatTile
            label="Best score"
            value={totals.bestScore ?? '—'}
            hint="out of 100, over scored attempts"
          />
          <StatTile
            label="Average best score"
            value={totals.averageBestScore ?? '—'}
            hint="over scored attempts"
          />
        </div>
        <div className="progress-discovery">
          <ProgressBar
            label="Defects discovered"
            value={totals.discovered}
            max={exerciseCount}
            tone="success"
          />
        </div>
      </section>

      <section className="content-section" aria-labelledby="exercises-title">
        <SectionHeader
          id="exercises-title"
          title="Your hunts"
          description="Each wired exercise with your own state — select one to open it."
        />
        <ul className="progress-exercise-list">
          {huntEntries.map((hunt) => (
            <li key={hunt.huntId} className="progress-exercise">
              <div className="progress-exercise-body">
                {hunt.scenarioId ? (
                  <Link className="progress-exercise-title" to={`/scenarios/${hunt.scenarioId}`}>
                    {hunt.title}
                  </Link>
                ) : (
                  <span className="progress-exercise-title">{hunt.title}</span>
                )}
                <span className="progress-exercise-meta">
                  {attemptCountLabel(hunt.attempts)} ·{' '}
                  {hunt.lastSubmittedAt
                    ? `last submitted ${formatProgressDate(hunt.lastSubmittedAt)}`
                    : 'not submitted yet'}
                </span>
              </div>
              <div className="progress-exercise-flags">
                {hunt.discovered ? (
                  <Tag tone="ready" icon="check">
                    Discovered
                  </Tag>
                ) : (
                  <Tag tone="neutral">Not discovered</Tag>
                )}
                <AttemptStatusChip status={hunt.status} bestQualityScore={hunt.bestScore} />
                <span className="progress-exercise-stat">
                  {hunt.bestScore !== null ? (
                    <>
                      <span aria-hidden="true">Best {hunt.bestScore}</span>
                      <span className="sr-only">Best score {hunt.bestScore} out of 100</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">Best —</span>
                      <span className="sr-only">No score yet</span>
                    </>
                  )}
                </span>
                <span className="progress-exercise-stat">
                  {hunt.hintsUsed === 1 ? '1 hint' : `${hunt.hintsUsed} hints`}
                </span>
              </div>
              {hunt.scenarioId ? (
                <Link
                  className="progress-exercise-go"
                  to={`/scenarios/${hunt.scenarioId}`}
                  aria-label={`Open the ${hunt.title} exercise`}
                >
                  <Icon name="chevron-right" size={16} />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="content-section" aria-labelledby="database-title">
        <SectionHeader
          id="database-title"
          title="Database Testing"
          description="Your state on the SQL exercises and database bug hunts — practice happens in the isolated SQL lab."
        />
        <ul className="progress-exercise-list">
          {databaseEntries.map((hunt) => (
            <li key={hunt.huntId} className="progress-exercise">
              <div className="progress-exercise-body">
                <Link className="progress-exercise-title" to={databaseHref(hunt)}>
                  {hunt.title}
                </Link>
                <span className="progress-exercise-meta">
                  {attemptCountLabel(hunt.attempts)} ·{' '}
                  {hunt.lastSubmittedAt
                    ? `last submitted ${formatProgressDate(hunt.lastSubmittedAt)}`
                    : 'not submitted yet'}
                </span>
              </div>
              <div className="progress-exercise-flags">
                {hunt.discovered ? (
                  <Tag tone="ready" icon="check">
                    Discovered
                  </Tag>
                ) : (
                  <Tag tone="neutral">Not discovered</Tag>
                )}
                <AttemptStatusChip status={hunt.status} bestQualityScore={hunt.bestScore} />
                <span className="progress-exercise-stat">
                  {hunt.bestScore !== null ? (
                    <>
                      <span aria-hidden="true">Best {hunt.bestScore}</span>
                      <span className="sr-only">Best score {hunt.bestScore} out of 100</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">Best —</span>
                      <span className="sr-only">No score yet</span>
                    </>
                  )}
                </span>
                <span className="progress-exercise-stat">
                  {hunt.hintsUsed === 1 ? '1 hint' : `${hunt.hintsUsed} hints`}
                </span>
              </div>
              <Link
                className="progress-exercise-go"
                to={databaseHref(hunt)}
                aria-label={`Open ${hunt.title}`}
              >
                <Icon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-section" aria-labelledby="contract-title">
        <SectionHeader
          id="contract-title"
          title="Contract Testing"
          description="Your state on the contract exercises and contract bug hunts — validate, diff and consumer-verify in the contract lab."
        />
        <ul className="progress-exercise-list">
          {contractEntries.map((entry) => (
            <li key={entry.huntId} className="progress-exercise">
              <div className="progress-exercise-body">
                <Link className="progress-exercise-title" to={contractHref(entry)}>
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
              <Link
                className="progress-exercise-go"
                to={contractHref(entry)}
                aria-label={`Open ${entry.title}`}
              >
                <Icon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <LabProgressSection
        id="performance-title"
        title="Performance Testing"
        description="Your state on the performance exercises and performance bug hunts — measure in the bounded load runner."
        entries={performanceEntries}
        hrefFor={performanceHref}
      />
      <LabProgressSection
        id="security-title"
        title="Security Testing"
        description="Your state on the security exercises and security bug hunts — inert demos, scored exercises and seeded defects."
        entries={securityEntries}
        hrefFor={securityHref}
      />
      <LabProgressSection
        id="microservices-title"
        title="Microservices & Events"
        description="Your state on the event-driven exercises and event bug hunts — practice happens in the deterministic simulator."
        entries={eventEntries}
        hrefFor={eventHref}
      />
      <section className="content-section" aria-labelledby="recent-title">
        <SectionHeader
          id="recent-title"
          title="Recent submissions"
          description="Your 10 newest reports, with the score the deterministic evaluator persisted."
        />
        {data.recent.length === 0 ? (
          <p className="progress-empty-note">No reports submitted yet.</p>
        ) : (
          <ol className="progress-recent-list">
            {data.recent.map((entry, index) => {
              const verdict = verdictDisplay(entry.verdict)
              const scenarioId = huntScenarioIds.get(entry.huntId)
              return (
                <li
                  key={`${entry.huntId}-${entry.createdAt}-${index}`}
                  className="progress-recent-row"
                >
                  <span className="progress-recent-score">
                    <span aria-hidden="true">{entry.score}</span>
                    <span className="sr-only">Score {entry.score} out of 100</span>
                  </span>
                  <div className="progress-recent-copy">
                    {scenarioId ? (
                      <Link to={`/scenarios/${scenarioId}`}>{entry.title}</Link>
                    ) : (
                      <span>{entry.title}</span>
                    )}
                    <span className="progress-recent-meta">
                      {formatProgressDateTime(entry.createdAt)}
                    </span>
                  </div>
                  <Tag tone={verdict.tone}>{verdict.label}</Tag>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <p className="panel-note">
        Report quality, attempt status and defect discovery are separate signals: a high score is
        not a discovery, revealing the solution never counts as one, and hints never lower a
        score. Guest progress expires with the practice session (7 days).
      </p>
    </div>
  )
}
