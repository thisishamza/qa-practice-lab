import { Link } from 'react-router-dom'
import type { LearningTrack } from '../../data/types'
import { difficultyLabels, pluralize } from '../../lib/labels'
import { DifficultyBadge } from '../../components/ui/DomainBadges'
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
        <span className={`track-icon track-icon-${track.id}`} aria-hidden="true">
          <Icon name={track.icon} size={20} />
        </span>
        <DifficultyBadge difficulty={track.difficulty} />
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
        <div>
          <dt>Level</dt>
          <dd>{difficultyLabels[track.difficulty]}</dd>
        </div>
      </dl>

      <Link className="card-foot-link" to={`/tracks/${track.id}`}>
        Open track
        <Icon name="arrow-right" size={15} />
      </Link>
    </article>
  )
}
