import { learningTracks } from '../data/tracks'
import { scenarios } from '../data/scenarios'
import { countScenariosByTrack, countScenariosByStatus } from '../lib/catalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { TrackCard } from '../features/tracks/TrackCard'

export function TracksPage() {
  useDocumentTitle('Learning tracks')

  const counts = countScenariosByTrack(scenarios)
  const availability = countScenariosByStatus(scenarios)
  const totalPlanned = learningTracks.reduce(
    (sum, track) => sum + track.plannedExerciseCount,
    0,
  )

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Learning paths' }]} />

      <PageHeader
        eyebrow="Curriculum"
        title="Learning tracks"
        description="Twelve testing disciplines with objectives, a getting-started path, and a representative set of scenarios. Pick a track to see how it is structured."
      />

      <p className="tracks-note">
        {totalPlanned} exercises are mapped across the twelve tracks. Availability is labelled on
        every page — {availability.ready} of the {scenarios.length} catalogued scenarios are
        runnable today.
      </p>

      <h2 className="sr-only">Learning tracks</h2>
      <div className="track-grid">
        {learningTracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            listedScenarios={counts[track.id] ?? 0}
          />
        ))}
      </div>
    </div>
  )
}
