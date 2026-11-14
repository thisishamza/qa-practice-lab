import { Link } from 'react-router-dom'
import { learningTracks } from '../data/tracks'
import { scenarios, getScenario } from '../data/scenarios'
import { guides } from '../data/guides'
import { testingCategories } from '../data/categories'
import {
  demoActivities,
  demoDisclaimer,
  demoProgress,
  recommendedScenarioIds,
} from '../data/demo'
import { countScenariosByCategory, countScenariosByTrack } from '../lib/catalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { pluralize } from '../lib/labels'
import { Callout } from '../components/ui/Callout'
import { Icon } from '../components/ui/Icon'
import { StatCard } from '../components/ui/StatCard'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SectionHeader } from '../components/ui/PageChrome'
import { Badge } from '../components/ui/Badge'
import { TrackCard } from '../features/tracks/TrackCard'
import { ScenarioCard } from '../features/catalog/ScenarioCard'

export function DashboardPage() {
  useDocumentTitle('Dashboard')

  const scenariosPerTrack = countScenariosByTrack(scenarios)
  const scenariosPerCategory = countScenariosByCategory(scenarios)

  const recommended = recommendedScenarioIds.flatMap((id) => {
    const scenario = getScenario(id)
    return scenario ? [scenario] : []
  })

  const recent = demoActivities.flatMap((activity) => {
    const scenario = getScenario(activity.scenarioId)
    return scenario ? [{ activity, scenario }] : []
  })

  return (
    <div className="stack">
      <section className="hero-panel" aria-labelledby="dashboard-title">
        <div className="hero-copy">
          <p className="eyebrow">QA learning environment</p>
          <h1 id="dashboard-title">
            Learn testing across the
            <span className="hero-accent"> whole stack.</span>
          </h1>
          <p className="page-lede">
            Twelve structured tracks, a catalogue of reusable scenarios, and practical
            guides. This phase builds the learning interface; the practice targets
            themselves arrive later.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/scenarios">
              Explore scenarios
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link className="button button-secondary" to="/tracks">
              Browse learning tracks
            </Link>
          </div>
          <ul className="hero-points">
            <li>
              <Icon name="check" size={15} />
              Typed, reusable scenario and guide content
            </li>
            <li>
              <Icon name="check" size={15} />
              Search and filters across every track
            </li>
            <li>
              <Icon name="check" size={15} />
              Keyboard-friendly, theme-aware interface
            </li>
          </ul>
        </div>

        <div className="hero-aside" aria-label="What is available now">
          <p className="hero-aside-label">Available now</p>
          <div className="hero-aside-row">
            <span>Learning tracks</span>
            <strong>{learningTracks.length}</strong>
          </div>
          <div className="hero-aside-row">
            <span>Scenario placeholders</span>
            <strong>{scenarios.length}</strong>
          </div>
          <div className="hero-aside-row">
            <span>Introductory guides</span>
            <strong>{guides.length}</strong>
          </div>
          <p className="hero-aside-note">
            No exercise is runnable yet. Every scenario is labelled with its real status.
          </p>
        </div>
      </section>

      <Callout tone="info" title="Phase 2 · learning structure preview">
        The dashboard, catalogue, tracks, and guides are complete as an interface. Progress
        and recent activity are sample data, and the practice environment is not connected
        to a runnable commerce app.
      </Callout>

      <section className="content-section" aria-labelledby="snapshot-title">
        <SectionHeader
          id="snapshot-title"
          title="Your learning snapshot"
          description="A quick view of the lab. The progress figure is clearly labelled demo data."
          action={
            <Link className="text-link" to="/progress">
              View progress
              <Icon name="arrow-right" size={14} />
            </Link>
          }
        />
        <div className="stats-grid">
          <StatCard
            label="Learning tracks"
            value={learningTracks.length}
            hint="Manual through accessibility"
            icon="tracks"
          />
          <StatCard
            label="Scenario placeholders"
            value={scenarios.length}
            hint="Structured, not runnable yet"
            icon="scenarios"
          />
          <StatCard
            label="Guides"
            value={guides.length}
            hint="Concepts, examples, and steps"
            icon="guides"
          />
          <StatCard
            label="Completed (demo)"
            value={demoProgress.completedExercises}
            hint={`${demoProgress.inProgressExercises} in progress · sample only`}
            icon="progress"
          />
        </div>
      </section>

      <section className="content-section" aria-labelledby="tracks-title">
        <SectionHeader
          id="tracks-title"
          title="Learning tracks"
          description="Twelve disciplines, each with objectives, a getting-started path, and listed scenarios."
          action={
            <Link className="text-link" to="/tracks">
              All 12 tracks
              <Icon name="arrow-right" size={14} />
            </Link>
          }
        />
        <div className="track-grid">
          {learningTracks.slice(0, 6).map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              listedScenarios={scenariosPerTrack[track.id] ?? 0}
              compact
            />
          ))}
        </div>
      </section>

      <section className="content-section" aria-labelledby="categories-title">
        <SectionHeader
          id="categories-title"
          title="Testing categories"
          description="Cross-cutting categories make it easy to choose the kind of testing you want to practise."
        />
        <div className="category-grid">
          {testingCategories.map((category) => {
            const trackCount = learningTracks.filter((track) =>
              track.categoryIds.includes(category.id),
            ).length

            return (
              <Link key={category.id} className="category-card" to="/scenarios">
                <span className="category-icon" aria-hidden="true">
                  <Icon name={category.icon} size={18} />
                </span>
                <span className="category-copy">
                  <strong>{category.name}</strong>
                  <span>{category.description}</span>
                </span>
                <span className="category-count">
                  {pluralize(scenariosPerCategory[category.id] ?? 0, 'scenario')}
                  {' · '}
                  {pluralize(trackCount, 'track')}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <div className="split-grid">
        <section className="content-section" aria-labelledby="recommended-title">
          <SectionHeader
            id="recommended-title"
            title="Recommended starting points"
            description="Three broad scenarios that show the range of the catalogue."
            action={
              <Link className="text-link" to="/scenarios">
                Browse all
                <Icon name="arrow-right" size={14} />
              </Link>
            }
          />
          <div className="card-stack">
            {recommended.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </section>

        <section className="content-section" aria-labelledby="progress-title">
          <SectionHeader
            id="progress-title"
            title="Learning progress"
            description="Sample progress used to validate the progress interface."
            action={<Badge tone="warning">Demo data</Badge>}
          />
          <div className="panel">
            <p className="panel-note">{demoDisclaimer}</p>
            <div className="demo-stat-row">
              <div>
                <span className="demo-stat-value">{demoProgress.completedExercises}</span>
                <span className="demo-stat-label">completed</span>
              </div>
              <div>
                <span className="demo-stat-value">{demoProgress.inProgressExercises}</span>
                <span className="demo-stat-label">in progress</span>
              </div>
              <div>
                <span className="demo-stat-value">{demoProgress.streakDays}</span>
                <span className="demo-stat-label">day streak</span>
              </div>
            </div>

            <div className="progress-list">
              {demoProgress.tracks.map((item) => {
                const track = learningTracks.find((entry) => entry.id === item.trackId)

                return (
                  <ProgressBar
                    key={item.trackId}
                    label={track?.name ?? item.trackId}
                    value={item.completed}
                    max={item.total}
                  />
                )
              })}
            </div>

            <Link className="card-foot-link" to="/progress">
              Open progress page
              <Icon name="arrow-right" size={15} />
            </Link>
          </div>
        </section>
      </div>

      <div className="split-grid">
        <section className="content-section" aria-labelledby="recent-title">
          <SectionHeader
            id="recent-title"
            title="Recently visited"
            description="Latest sample activity."
            action={<Badge tone="warning">Demo data</Badge>}
          />
          <ul className="activity-list">
            {recent.map(({ activity, scenario }) => (
              <li key={activity.scenarioId}>
                <span className="activity-icon" aria-hidden="true">
                  <Icon name="clock" size={16} />
                </span>
                <span className="activity-copy">
                  <Link to={`/scenarios/${scenario.id}`}>{scenario.title}</Link>
                  <span>
                    {activity.note} · {activity.visitedLabel}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="content-section" aria-labelledby="practice-title">
          <SectionHeader
            id="practice-title"
            title="Quick practice access"
            description="Check the local API and see what the practice environment will include."
          />
          <div className="panel quick-practice">
            <span className="quick-practice-icon" aria-hidden="true">
              <Icon name="practice" size={22} />
            </span>
            <h3>Practice environment</h3>
            <p>
              The runtime health check is live. Exercise targets, sandboxes, and scoring
              are deliberately not built in Phase 2.
            </p>
            <Link className="button button-secondary button-small" to="/practice">
              Open practice status
              <Icon name="arrow-right" size={15} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
