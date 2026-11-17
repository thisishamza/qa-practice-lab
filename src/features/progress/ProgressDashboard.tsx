// Presentational shell of the real /progress dashboard (P4-M3 WP1,
// re-structured in R3). Pure: every value comes from the caller (the
// ProgressPage container fetches it from GET /api/v1/practice/progress).
// Discovery is never inferred from scores; attempt status uses the shared
// chip vocabulary; guest vs signed-in durability copy is chosen from the
// server's `persistence` field, never from browser state.
//
// R3 structure: one prioritised next step ("Do this next"), a compact
// activity overview, then collapsible per-lab sections that start
// collapsed until the learner has an attempt in them — the page no longer
// renders every row by default.

import { Link } from 'react-router-dom'
import type { ProgressResponse } from '../../shared/learning'
import type { ProgressDashboardState } from './progress-types'

export type { ProgressDashboardState } from './progress-types'
import { ProgressDisclosureSection } from './ProgressDisclosureSection'
import { DoThisNext } from './DoThisNext'
import { splitProgressEntries } from './progressGroups'
import { formatProgressDateTime } from '../../lib/progressDates'
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
              <Icon name="reset" size={16} />
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const { data, refreshing, onRefresh, refreshError } = state
  const { totals } = data
  const exerciseCount = data.hunts.length
  // Discovery only exists on wired bug-hunt targets (ids `hunt-*`); scored
  // lab exercises carry no defects, so they would inflate the ceiling.
  const wiredHuntCount = data.hunts.filter((entry) => entry.huntId.startsWith('hunt-')).length
  const huntScenarioIds = new Map(data.hunts.map((hunt) => [hunt.huntId, hunt.scenarioId]))
  const reportedCount = data.hunts.filter((entry) => entry.lastSubmittedAt !== null).length
  const groups = splitProgressEntries(data.hunts)

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Progress' }]} />
      <PageHeader
        eyebrow="Learning record"
        title="Progress"
        description="Real numbers from your own practice attempts on this server — nothing sampled, nothing stored beyond the practice session."
        actions={
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
            <Icon name="reset" size={16} />
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
            <Icon name="reset" size={16} />
            Try again
          </Button>
        </div>
      ) : null}

      <DoThisNext data={data} />

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
            value={`${totals.discovered} of ${wiredHuntCount}`}
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
        <p className="panel-note progress-overview-note">
          You have submitted at least one report on{' '}
          <strong>
            {reportedCount} of {exerciseCount}
          </strong>{' '}
          attemptable exercises — each section below keeps its own count.
        </p>
        <div className="progress-discovery">
          <ProgressBar
            label="Defects discovered"
            value={totals.discovered}
            max={wiredHuntCount}
            tone="success"
          />
        </div>
      </section>

      <section className="content-section" aria-labelledby="lab-progress-title">
        <SectionHeader
          id="lab-progress-title"
          title="Your work by area"
          description="Collapsed until you open an attempt. Expand a section to see every exercise with your own state."
        />
        {groups.map((group) => (
          <ProgressDisclosureSection
            key={group.id}
            title={group.title}
            description={group.description}
            entries={group.entries}
            hrefFor={group.hrefFor}
          />
        ))}
      </section>

      <section className="content-section" aria-labelledby="recent-title">
        <SectionHeader
          id="recent-title"
          title="Recent submissions"
          description="Your 10 newest reports, with the score the deterministic evaluator persisted. Older reports stay recorded but are not listed here — there is no full history view yet."
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
