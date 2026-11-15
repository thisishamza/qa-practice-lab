import { learningTracks } from '../data/tracks'
import { scenarios } from '../data/scenarios'
import { countScenariosByTrack } from '../lib/catalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { TrackCard } from '../features/tracks/TrackCard'

export function TracksPage() {
  useDocumentTitle('Learning tracks')

  const counts = countScenariosByTrack(scenarios)
  const totalPlanned = learningTracks.reduce(
    (sum, track) => sum + track.plannedExerciseCount,
    0,
  )

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Curriculum"
        title="Learning tracks"
        description="Twelve testing disciplines with objectives, a getting-started path, and a representative set of scenarios. Pick a track to see how it is structured."
      />

      <p className="tracks-note">
        {totalPlanned} exercises are planned across the twelve tracks. Each track lists two
        representative placeholders — exercises are not runnable yet.
      </p>

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
