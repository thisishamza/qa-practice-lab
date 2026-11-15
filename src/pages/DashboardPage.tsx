import { Link } from 'react-router-dom'
import { learningTracks, getTrack } from '../data/tracks'
import { scenarios, getScenario } from '../data/scenarios'
import { guides } from '../data/guides'
import {
  recommendedScenarioIds,
} from '../data/demo'
import { countScenariosByTrack } from '../lib/catalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { difficultyLabels, formatMinutes, pluralize } from '../lib/labels'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader } from '../components/ui/PageChrome'
import { StatusTag } from '../components/ui/Tag'
import { Meta } from '../components/ui/Meta'
import { Icon } from '../components/ui/Icon'

const startSteps: {
  kicker: string
  title: string
  detail: string
  to: string
}[] = [
  {
    kicker: 'Guide',
    title: 'Read the manual-testing guide',
    detail: 'Test design, oracles, and evidence — the foundation every track builds on.',
    to: '/guides/guide-manual-test-design',
  },
  {
    kicker: 'Scenario',
    title: 'Inspect the cart-totals scenario',
    detail: 'Objectives, prerequisites, and its real availability status — exercises are labelled, never faked.',
    to: '/scenarios/manual-cart-totals',
  },
  {
    kicker: 'Track',
    title: 'Review the API testing track',
    detail: 'What the track covers, what is usable today, and where it goes next.',
    to: '/tracks/api-testing',
  },
]

export function DashboardPage() {
  useDocumentTitle('Dashboard')

  const scenariosPerTrack = countScenariosByTrack(scenarios)

  const featured = learningTracks.slice(0, 6)
  const recommended = recommendedScenarioIds.flatMap((id) => {
    const scenario = getScenario(id)
    return scenario ? [scenario] : []
  })

  return (
    <div className="stack">
      <PageHeader
        eyebrow="QA learning environment"
        title="Practise testing across the whole stack."
        description="Twelve learning tracks, twenty-four catalogued scenarios, and six practical guides. Start with the path below — every page is labelled with exactly what is usable today."
        actions={
          <div className="button-row">
            <Link className="button" to="/scenarios">
              Find a scenario
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link className="button button-secondary" to="/tracks">
              Browse tracks
            </Link>
          </div>
        }
      />

      <section className="content-section" aria-labelledby="start-path-title">
        <SectionHeader
          id="start-path-title"
          title="Your start path"
          description="Three steps, in order. Guides and tracks are readable now."
        />
        <ol className="start-path-list">
          {startSteps.map((step, index) => (
            <li key={step.to}>
              <Link className="start-step" to={step.to}>
                <span className="start-step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="start-step-copy">
                  <span className="start-step-kicker">{step.kicker}</span>
                  <span className="start-step-title">{step.title}</span>
                  <span className="start-step-detail">{step.detail}</span>
                </span>
                <Icon name="arrow-right" size={16} />
              </Link>
            </li>
          ))}
        </ol>
        <p className="dashboard-note">
          Scenario exercises are catalogued but are not runnable yet — each scenario
          page carries its real status.
        </p>
      </section>

      <section className="content-section" aria-labelledby="curriculum-title">
        <SectionHeader
          id="curriculum-title"
          title="Curriculum"
          description="Manual testing through accessibility — objectives, getting-started steps, and listed scenarios per track."
          action={
            <Link className="text-link" to="/tracks">
              All 12 tracks
              <Icon name="arrow-right" size={14} />
            </Link>
          }
        />
        <ul className="track-row-list">
          {featured.map((track) => (
            <li key={track.id}>
              <Link className="track-row" to={`/tracks/${track.id}`}>
                <span className="track-icon" aria-hidden="true">
                  <Icon name={track.icon} size={18} />
                </span>
                <span className="track-row-copy">
                  <strong>{track.name}</strong>
                  <span className="track-row-tagline">{track.tagline}</span>
                </span>
                <span className="track-row-meta">
                  {difficultyLabels[track.difficulty]}
                  <span className="meta-sep" aria-hidden="true">
                    ·
                  </span>
                  {pluralize(track.plannedExerciseCount, 'exercise')} planned
                  <span className="meta-sep" aria-hidden="true">
                    ·
                  </span>
                  {scenariosPerTrack[track.id] ?? 0} listed
                </span>
                <Icon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-section" aria-labelledby="catalogue-title">
        <SectionHeader
          id="catalogue-title"
          title="Scenario catalogue"
          description="Structured placeholders for every planned exercise."
          action={
            <Link className="text-link" to="/scenarios">
              Open the catalogue
              <Icon name="arrow-right" size={14} />
            </Link>
          }
        />
        <p className="catalogue-counts">
          {pluralize(scenarios.length, 'scenario')}
          <span className="meta-sep" aria-hidden="true">
            ·
          </span>
          {pluralize(learningTracks.length, 'track')}
          <span className="meta-sep" aria-hidden="true">
            ·
          </span>
          {pluralize(guides.length, 'guide')}
        </p>
        <ul className="scenario-row-list">
          {recommended.map((scenario) => {
            const track = getTrack(scenario.trackId)

            return (
              <li key={scenario.id}>
                <Link className="scenario-row" to={`/scenarios/${scenario.id}`}>
                  <span className="scenario-row-copy">
                    <strong>{scenario.title}</strong>
                    <Meta>
                      <span>{track?.name ?? scenario.trackId}</span>
                      <span>{difficultyLabels[scenario.difficulty]}</span>
                      <span>{formatMinutes(scenario.estimatedMinutes)}</span>
                    </Meta>
                  </span>
                  <StatusTag status={scenario.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
