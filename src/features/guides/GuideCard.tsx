import { Link } from 'react-router-dom'
import type { Guide } from '../../data/types'
import { getTrack } from '../../data/tracks'
import { formatMinutes, difficultyLabels, pluralize } from '../../lib/labels'
import { Badge } from '../../components/ui/Badge'
import { Icon } from '../../components/ui/Icon'

export function GuideCard({ guide }: { guide: Guide }) {
  const track = getTrack(guide.trackId)

  return (
    <article className="guide-card">
      <div className="guide-card-top">
        <span className="guide-icon" aria-hidden="true">
          <Icon name="book" size={18} />
        </span>
        <Badge tone="accent">{track?.name ?? 'Guide'}</Badge>
      </div>

      <h3>
        <Link to={`/guides/${guide.id}`}>{guide.title}</Link>
      </h3>
      <p className="guide-summary">{guide.summary}</p>

      <div className="guide-meta">
        <span>{difficultyLabels[guide.level]}</span>
        <span>{formatMinutes(guide.readingMinutes)} read</span>
        <span>{pluralize(guide.concepts.length, 'concept')}</span>
      </div>

      <Link className="card-foot-link" to={`/guides/${guide.id}`}>
        Read guide
        <Icon name="arrow-right" size={15} />
      </Link>
    </article>
  )
}
