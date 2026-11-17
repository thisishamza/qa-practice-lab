// "Your next step" for the dashboard (R2). One canonical recommended path —
// derived from the existing curriculum registry and live progress, never
// re-declared. The full path stays on /practice; this panel answers only
// "what should I do right now?" for first-time and returning users alike.

import { Link } from 'react-router-dom'
import {
  getRecommendedPath,
  completionForEntry,
  progressByHuntId,
  findNextPathItem,
} from '../../lib/recommendedPath'
import { difficultyLabels } from '../../lib/labels'
import { useProgress } from '../progress/useProgress'
import { SectionHeader } from '../../components/ui/PageChrome'
import { Button } from '../../components/ui/Button'
import { Tag } from '../../components/ui/Tag'
import { Icon } from '../../components/ui/Icon'

const items = getRecommendedPath()

export function NextStepPanel() {
  const state = useProgress()

  const progressByHunt = state.status === 'ready' ? progressByHuntId(state.data.hunts) : null
  const persistence = state.status === 'ready' ? state.data.persistence : null
  const next =
    state.status === 'ready' && progressByHunt ? findNextPathItem(progressByHunt) : items[0] ?? null
  const nextCompletion =
    next && progressByHunt ? completionForEntry(progressByHunt.get(next.huntId)) : null

  return (
    <section className="content-section" aria-labelledby="next-step-title">
      <SectionHeader
        id="next-step-title"
        title="Your next step"
        description="The recommended order through the bug-hunt curriculum — first incomplete exercise, based on your progress on this server."
        action={
          <Link className="text-link" to="/practice">
            See the full path
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

      {state.status === 'loading' ? (
        <p className="panel-note" role="status">
          Checking your progress…
        </p>
      ) : null}

      {state.status === 'error' ? (
        <div className="recommended-progress-unavailable" role="alert">
          <p className="panel-note">
            Your live progress could not be loaded, so the next step is not guessed. The full
            path is still available on Bug hunts. {state.message}
          </p>
          <Button variant="secondary" size="sm" onClick={state.onRetry}>
            <Icon name="reset" size={16} />
            Try again
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' && next === null ? (
        <div className="panel next-step-panel">
          <p className="panel-note">
            Every exercise on the recommended path has a submitted report — nice work. Pick any
            lab, or revisit where you scored best on{' '}
            <Link to="/progress">Progress</Link>.
          </p>
        </div>
      ) : null}

      {state.status === 'ready' && next !== null ? (
        <div className="panel next-step-panel">
          <div className="next-step-meta">
            <span className="start-step-kicker">
              Step {next.position} · {difficultyLabels[next.scenario.difficulty]} ·{' '}
              {next.curriculum.skillArea}
            </span>
            {nextCompletion === 'in_progress' ? (
              <Tag tone="in-design">In progress</Tag>
            ) : nextCompletion === 'solution_viewed' ? (
              <Tag tone="planned">Solution viewed</Tag>
            ) : (
              <Tag tone="neutral">Not started</Tag>
            )}
          </div>
          <h3 className="next-step-title">{next.scenario.title}</h3>
          <p className="panel-note">You will be able to: {next.curriculum.expectedOutcomes[0]}</p>
          <div className="button-row">
            <Link className="button button-secondary" to={`/scenarios/${next.scenario.id}`}>
              Open the exercise
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link className="button button-secondary" to="/scenarios">
              Browse all exercises
            </Link>
          </div>
          {persistence === 'session' ? (
            <p className="panel-note next-step-durability">
              Progress is stored for this browser session — seven days as a guest.{' '}
              <Link to="/login">Sign in</Link> to keep it permanently.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
