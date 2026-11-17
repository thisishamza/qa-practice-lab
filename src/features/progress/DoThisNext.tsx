// "Do this next" for the /progress page (R3). The one prioritised action on
// the page: the first exercise on the canonical recommended path with no
// submitted report yet. Derived from the same data the dashboard path uses
// (findNextPathItem) — a fixed order plus the learner's own submissions,
// not personalisation. Guests and first-time users get a starting point;
// signed-in users get the same rule with account attribution.
//
// This component is pure: all progress data flows in via props from the
// already-loaded dashboard state — no second fetch, no invented counts.

import { Link } from 'react-router-dom'
import {
  getRecommendedPath,
  completionForEntry,
  progressByHuntId,
  findNextPathItem,
} from '../../lib/recommendedPath'
import { difficultyLabels } from '../../lib/labels'
import type { ProgressResponse } from '../../shared/learning'
import { SectionHeader } from '../../components/ui/PageChrome'
import { Tag } from '../../components/ui/Tag'
import { Icon } from '../../components/ui/Icon'

const pathLength = getRecommendedPath().length

export function DoThisNext({ data }: { data: ProgressResponse }) {
  const progressByHunt = progressByHuntId(data.hunts)
  const next = findNextPathItem(progressByHunt)
  const isZero = data.totals.attempts === 0
  const isGuest = data.persistence === 'session'

  return (
    <section className="content-section" aria-labelledby="do-this-next-title">
      <SectionHeader
        id="do-this-next-title"
        title="Do this next"
        description="One concrete step, picked from a fixed order through the hunt curriculum and your own submissions — nothing personalised, nothing invented."
      />
      <div className="panel next-step-panel do-this-next-panel">
        {next === null ? (
          <>
            <div className="next-step-meta">
              <Tag tone="ready" icon="check">
                Recommended path complete
              </Tag>
            </div>
            <h3 className="next-step-title">Every recommended exercise has a submitted report</h3>
            <p className="panel-note">
              The recommended path is done — each step counts by a submitted report, not by the
              score you got. Keep going with the scored labs (SQL, contract, performance,
              security, microservices) or revisit an exercise and improve your report.
            </p>
            <div className="button-row">
              <Link className="button" to="/scenarios">
                Browse all exercises
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link className="button button-secondary" to="/database">
                Open the SQL playground
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="next-step-meta">
              <span className="start-step-kicker">
                {isZero ? 'Start here' : `Step ${next.position} of ${pathLength}`} ·{' '}
                {difficultyLabels[next.scenario.difficulty]} · {next.curriculum.skillArea}
              </span>
              {progressByHunt && completionForEntry(progressByHunt.get(next.huntId)) === 'in_progress' ? (
                <Tag tone="in-design">In progress</Tag>
              ) : progressByHunt &&
                completionForEntry(progressByHunt.get(next.huntId)) === 'solution_viewed' ? (
                <Tag tone="planned">Solution viewed</Tag>
              ) : (
                <Tag tone="neutral">Not started</Tag>
              )}
            </div>
            {isZero ? (
              <p className="panel-note do-this-next-zero">
                Nothing recorded yet — your first hunt takes about fifteen minutes.
              </p>
            ) : null}
            <h3 className="next-step-title">{next.scenario.title}</h3>
            <p className="panel-note">You will be able to: {next.curriculum.expectedOutcomes[0]}</p>
            <div className="button-row">
              <Link className="button" to={`/scenarios/${next.scenario.id}`}>
                Open the exercise
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link className="button button-secondary" to="/practice">
                See the full path
              </Link>
            </div>
          </>
        )}
        <p className="panel-note next-step-durability">
          {isGuest ? (
            <>
              Progress lives in this browser for 7 days as a guest.{' '}
              <Link to="/login">Sign in</Link> to keep new reports permanently.
            </>
          ) : (
            <>
              Signed in — new reports are attributed to your synthetic training account at
              submission time. Reports made as a guest stay with their session.
            </>
          )}{' '}
          This suggestion follows a fixed order and your submissions — it is not intelligent
          personalisation.
        </p>
      </div>
    </section>
  )
}
