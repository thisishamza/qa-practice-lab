import { Link } from 'react-router-dom'
import { learningTracks } from '../data/tracks'
import { scenarios } from '../data/scenarios'
import { countScenariosByTrack } from '../lib/catalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { Icon } from '../components/ui/Icon'
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
        actions={
          <Link className="button button-secondary" to="/scenarios">
            <Icon name="search" size={16} />
            Search the catalogue
          </Link>
        }
      />

      <Callout tone="info" title="A curriculum preview, not a finished course">
        {totalPlanned} exercises are planned across the twelve tracks. Each track lists two
        representative placeholders so the content model and navigation can be reviewed
        before exercises are implemented.
      </Callout>

      <div className="track-grid track-grid-wide">
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
