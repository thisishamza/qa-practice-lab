// Ordered "Recommended path" for /practice (P4-M3 WP2). Data-driven from the
// wired curriculum registry — never a duplicated curriculum — with live
// completion state from GET /api/v1/practice/progress (via useProgress).
//
// Completion follows the approved plan definition: at least one bug report
// submitted against the hunt (`lastSubmittedAt !== null` in the WP1
// progress payload). Discovery is shown separately and is never inferred
// from score, hints, status or reveal. Placeholder scenarios are not listed
// here at all — the wired, runnable hunts are the path.

import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { getRecommendedPath, completionForEntry, progressByHuntId } from '../../lib/recommendedPath'
import type { RecommendedCompletion } from '../../lib/recommendedPath'
import { difficultyLabels } from '../../lib/labels'
import { useProgress } from '../progress/useProgress'
import type { ProgressDashboardState } from '../progress/ProgressDashboard'
import { SectionHeader } from '../../components/ui/PageChrome'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Tag } from '../../components/ui/Tag'
import type { ProgressHuntEntry } from '../../shared/learning'

const items = getRecommendedPath()

const completionDisplay: Record<
  RecommendedCompletion,
  { label: string; tone: 'ready' | 'in-design' | 'planned' | 'neutral'; description: string }
> = {
  completed: {
    label: 'Completed',
    tone: 'ready',
    description: 'Report submitted. Completion counts the submission, not the score.',
  },
  in_progress: {
    label: 'In progress',
    tone: 'in-design',
    description: 'You have started this exercise. Your investigation is still open.',
  },
  solution_viewed: {
    label: 'Solution viewed',
    tone: 'planned',
    description:
      'The solution was unlocked. Viewing it is not a completion and never counts as discovering the defect.',
  },
  not_started: {
    label: 'Not started',
    tone: 'neutral',
    description: 'No attempt at this exercise yet.',
  },
}

function completionChip(entry: ProgressHuntEntry) {
  const display = completionDisplay[completionForEntry(entry)]
  return (
    <Tag tone={display.tone} className="recommended-status-chip">
      {display.label}
      <span className="sr-only"> — {display.description}</span>
    </Tag>
  )
}

function statusCluster(entry: ProgressHuntEntry | undefined): ReactNode {
  if (!entry) {
    return null
  }
  return (
    <span className="recommended-step-status">
      {completionChip(entry)}
      {entry.discovered ? (
        <Tag tone="ready" icon="check">
          Discovered
        </Tag>
      ) : null}
      {entry.bestScore !== null ? (
        <span className="recommended-step-score">
          <span aria-hidden="true">Best {entry.bestScore}</span>
          <span className="sr-only">Best score {entry.bestScore} out of 100</span>
        </span>
      ) : null}
    </span>
  )
}

export function RecommendedPathView({ state }: { state: ProgressDashboardState }) {
  const progressByHunt =
    state.status === 'ready' ? progressByHuntId(state.data.hunts) : null

  return (
    <section className="content-section" aria-labelledby="recommended-path-title">
      <SectionHeader
        id="recommended-path-title"
        title="Recommended path"
        description="A suggested order through the runnable hunt scenarios — manual basics first, access control last. Select one to open it."
      />

      {state.status === 'loading' ? (
        <p className="panel-note" role="status">
          Checking your progress…
        </p>
      ) : null}
      {state.status === 'error' ? (
        <div className="recommended-progress-unavailable" role="alert">
          <p className="panel-note">
            Your live progress could not be loaded, so completion states are hidden rather than
            guessed. The path below is unchanged. {state.message}
          </p>
          <Button variant="secondary" size="sm" onClick={state.onRetry}>
            <Icon name="reset" size={15} />
            Try again
          </Button>
        </div>
      ) : null}

      <ol className="start-path-list">
        {items.map(({ position, scenario, huntId, curriculum }) => (
          <li key={scenario.id}>
            <Link className="start-step recommended-step" to={`/scenarios/${scenario.id}`}>
              <span className="start-step-number" aria-hidden="true">
                {String(position).padStart(2, '0')}
              </span>
              <span className="start-step-copy">
                <span className="start-step-kicker">
                  {difficultyLabels[scenario.difficulty]} · {curriculum.skillArea}
                </span>
                <span className="start-step-title">{scenario.title}</span>
                <span className="start-step-detail">
                  You will be able to: {curriculum.expectedOutcomes[0]}
                </span>
                <span className="recommended-step-concepts">
                  Concepts practised: {curriculum.conceptsPracticed.slice(0, 3).join(' · ')}
                </span>
              </span>
              {progressByHunt ? statusCluster(progressByHunt.get(huntId)) : null}
              <Icon name="arrow-right" size={16} />
            </Link>
          </li>
        ))}
      </ol>
      <p className="panel-note">
        The remaining 18 catalogue scenarios are labelled placeholders — they are not runnable and
        cannot be completed yet. Completion means a report was submitted; discovery means the
        finding check passed. The two are never the same signal, and neither is a score or a
        revealed solution.{' '}
        <Link to="/about#evaluation">How reports are evaluated</Link>.
      </p>
    </section>
  )
}

export function RecommendedPath() {
  const state = useProgress()
  return <RecommendedPathView state={state} />
}
