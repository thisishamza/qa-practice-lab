import { Link } from 'react-router-dom'
import { learningTracks, getTrack } from '../data/tracks'
import { scenarios, getScenario } from '../data/scenarios'
import { guides } from '../data/guides'
import {
  recommendedScenarioIds,
} from '../data/demo'
import { countScenariosByTrack, countScenariosByStatus } from '../lib/catalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { difficultyLabels, formatMinutes, pluralize } from '../lib/labels'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader } from '../components/ui/PageChrome'
import { StatusTag } from '../components/ui/Tag'
import { Meta } from '../components/ui/Meta'
import { Icon } from '../components/ui/Icon'
import { NextStepPanel } from '../features/dashboard/NextStepPanel'

export function DashboardPage() {
  useDocumentTitle('Dashboard')

  const scenariosPerTrack = countScenariosByTrack(scenarios)
  const availability = countScenariosByStatus(scenarios)

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
        description={`Twelve learning tracks, ${scenarios.length} catalogued scenarios — ${availability.ready} ready to run — and ${guides.length} practical guides. Start with the path below — every page is labelled with exactly what is usable today.`}
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

      <NextStepPanel />

      <section className="content-section" aria-labelledby="curriculum-title">
        <SectionHeader
          id="curriculum-title"
          title="Curriculum"
          description="Manual testing through accessibility — objectives, getting-started steps, and listed scenarios per track."
          action={
            <Link className="text-link" to="/tracks">
              All 12 tracks
              <Icon name="arrow-right" size={16} />
            </Link>
          }
        />
        <ul className="track-row-list">
          {featured.map((track) => (
            <li key={track.id}>
              <Link className="track-row" to={`/tracks/${track.id}`}>
                <span className="track-icon" aria-hidden="true">
                  <Icon name={track.icon} size={20} />
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
          description="Every catalogued scenario — search, filter and check each one's real status."
          action={
            <Link className="text-link" to="/scenarios">
              Open the catalogue
              <Icon name="arrow-right" size={16} />
            </Link>
          }
        />
        <p className="catalogue-counts">
          {scenarios.length} scenarios
          <span className="meta-sep" aria-hidden="true">
            ·
          </span>
          {availability.ready} ready to run
          <span className="meta-sep" aria-hidden="true">
            ·
          </span>
          {learningTracks.length} tracks
          <span className="meta-sep" aria-hidden="true">
            ·
          </span>
          {guides.length} guides
        </p>
        <ul className="scenario-row-list" data-density="compact">
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
