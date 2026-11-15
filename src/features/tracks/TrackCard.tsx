import { Link } from 'react-router-dom'
import type { LearningTrack } from '../../data/types'
import { pluralize } from '../../lib/labels'
import { LevelMeter } from '../../components/ui/LevelMeter'
import { Icon } from '../../components/ui/Icon'

interface TrackCardProps {
  track: LearningTrack
  listedScenarios: number
  compact?: boolean
}

export function TrackCard({ track, listedScenarios, compact = false }: TrackCardProps) {
  return (
    <article className={`track-card${compact ? ' track-card-compact' : ''}`}>
      <div className="track-card-top">
        <span className="track-icon" aria-hidden="true">
          <Icon name={track.icon} size={20} />
        </span>
        <LevelMeter level={track.difficulty} />
      </div>

      <h3>
        <Link to={`/tracks/${track.id}`}>{track.name}</Link>
      </h3>
      <p className="track-tagline">{track.tagline}</p>

      {compact ? null : <p className="track-description">{track.description}</p>}

      <dl className="track-meta">
        <div>
          <dt>Planned</dt>
          <dd>{pluralize(track.plannedExerciseCount, 'exercise')}</dd>
        </div>
        <div>
          <dt>Listed now</dt>
          <dd>{pluralize(listedScenarios, 'placeholder')}</dd>
        </div>
      </dl>
    </article>
  )
}
