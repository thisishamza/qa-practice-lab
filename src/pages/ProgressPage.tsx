import { Link } from 'react-router-dom'
import { learningTracks } from '../data/tracks'
import { getScenario } from '../data/scenarios'
import { demoActivities, demoDisclaimer, demoProgress } from '../data/demo'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { pluralize } from '../lib/labels'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { StatCard } from '../components/ui/StatCard'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/PageChrome'
import { Badge } from '../components/ui/Badge'
import { Icon } from '../components/ui/Icon'

export function ProgressPage() {
  useDocumentTitle('Progress')

  const recent = demoActivities.flatMap((activity) => {
    const scenario = getScenario(activity.scenarioId)
    return scenario ? [{ activity, scenario }] : []
  })

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Learning record"
        title="Progress"
        description="A preview of how progress will be presented. The numbers on this page are sample data, not a record of real activity."
      />

      <Callout tone="warning" title="Demo data only">
        {demoDisclaimer} Progress tracking will be connected to a data store and
        runnable exercises in a later phase.
      </Callout>

      <div className="stats-grid">
        <StatCard
          label="Completed (demo)"
          value={demoProgress.completedExercises}
          hint="Sample exercise completions"
          icon="check"
        />
        <StatCard
          label="In progress (demo)"
          value={demoProgress.inProgressExercises}
          hint="Sample unfinished exercises"
          icon="progress"
        />
        <StatCard
          label="Streak (demo)"
          value={`${demoProgress.streakDays} days`}
          hint="Sample consecutive activity"
          icon="sparkles"
        />
        <StatCard
          label="Weekly goal (demo)"
          value={`${demoProgress.completedExercises}/${demoProgress.weeklyGoal}`}
          hint="Sample target, not tracked"
          icon="target"
        />
      </div>

      <div className="split-grid">
        <section className="content-section" aria-labelledby="track-progress-title">
          <SectionHeader
            id="track-progress-title"
            title="Track progress"
            description="A four-track sample of the progress view."
            action={<Badge tone="warning">Demo data</Badge>}
          />
          <div className="panel">
            <div className="progress-list">
              {demoProgress.tracks.map((item) => {
                const track = learningTracks.find((entry) => entry.id === item.trackId)

                return (
                  <div key={item.trackId} className="progress-row">
                    <ProgressBar
                      label={track?.name ?? item.trackId}
                      value={item.completed}
                      max={item.total}
                    />
                    {track ? (
                      <Link
                        className="progress-row-link"
                        to={`/tracks/${track.id}`}
                        aria-label={`Open ${track.name}`}
                      >
                        <Icon name="chevron-right" size={16} />
                      </Link>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <p className="panel-note">
              {pluralize(demoProgress.completedExercises, 'exercise')} completed across the
              sample. The totals include planned exercises that do not exist yet, which is
              exactly why this is labelled as demo data.
            </p>
          </div>
        </section>

        <section className="content-section" aria-labelledby="reality-title">
          <SectionHeader id="reality-title" title="What is real right now" />
          <div className="panel">
            <ul className="reality-list">
              <li>
                <span className="reality-icon reality-real" aria-hidden="true">
                  <Icon name="check" size={14} />
                </span>
                <span>
                  <strong>Real:</strong> tracks, scenarios, guides, filters, navigation,
                  and theme preferences.
                </span>
              </li>
              <li>
                <span className="reality-icon reality-demo" aria-hidden="true">
                  <Icon name="sparkles" size={14} />
                </span>
                <span>
                  <strong>Demo:</strong> completed counts, streaks, weekly goals, and
                  recent activity.
                </span>
              </li>
              <li>
                <span className="reality-icon reality-missing" aria-hidden="true">
                  <Icon name="lock" size={14} />
                </span>
                <span>
                  <strong>Not built:</strong> saved progress, scoring, exercise execution,
                  and accounts.
                </span>
              </li>
            </ul>
            <Link className="card-foot-link" to="/scenarios">
              Explore the real catalogue
              <Icon name="arrow-right" size={15} />
            </Link>
          </div>
        </section>
      </div>

      <section className="content-section" aria-labelledby="activity-title">
        <SectionHeader
          id="activity-title"
          title="Recent activity"
          description="Sample visits used to validate the activity list."
          action={<Badge tone="warning">Demo data</Badge>}
        />
        <ul className="activity-list activity-list-wide">
          {recent.map(({ activity, scenario }) => (
            <li key={activity.scenarioId}>
              <span className="activity-icon" aria-hidden="true">
                <Icon name="clock" size={16} />
              </span>
              <span className="activity-copy">
                <Link to={`/scenarios/${scenario.id}`}>{scenario.title}</Link>
                <span>{activity.note}</span>
              </span>
              <span className="activity-time">{activity.visitedLabel}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
