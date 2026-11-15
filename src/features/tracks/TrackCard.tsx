import { Link } from 'react-router-dom'
import type { LearningTrack } from '../../data/types'
import { pluralize } from '../../lib/labels'
import { LevelMeter } from '../../components/ui/LevelMeter'
import { Icon } from '../../components/ui/Icon'

interface TrackCardProps {
  track: LearningTrack
  listedScenarios: number
}

/**
 * Compact, scannable track card: single-tone icon, level meter, name, tagline,
 * one meta line, and exactly one link (the track name).
 */
export function TrackCard({ track, listedScenarios }: TrackCardProps) {
  return (
    <article className="track-card">
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

      <p className="track-meta-line">
        {pluralize(track.plannedExerciseCount, 'exercise')} planned
        <span className="meta-sep" aria-hidden="true">
          ·
        </span>
        {pluralize(listedScenarios, 'listed', 'listed')}
      </p>
    </article>
  )
}
