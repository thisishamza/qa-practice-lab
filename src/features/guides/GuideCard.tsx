import { Link } from 'react-router-dom'
import type { Guide } from '../../data/types'
import { getTrack } from '../../data/tracks'
import { formatMinutes, pluralize } from '../../lib/labels'
import { LevelMeter } from '../../components/ui/LevelMeter'
import { Meta } from '../../components/ui/Meta'
import { Tag } from '../../components/ui/Tag'
import { Icon } from '../../components/ui/Icon'

export function GuideCard({ guide }: { guide: Guide }) {
  const track = getTrack(guide.trackId)

  return (
    <article className="guide-card">
      <div className="guide-card-top">
        <span className="guide-icon" aria-hidden="true">
          <Icon name="book" size={18} />
        </span>
        <Tag tone="neutral">{track?.name ?? 'Guide'}</Tag>
      </div>

      <h3>
        <Link to={`/guides/${guide.id}`}>{guide.title}</Link>
      </h3>
      <p className="guide-summary">{guide.summary}</p>

      <Meta>
        <LevelMeter level={guide.level} />
        <span className="meta-item">{formatMinutes(guide.readingMinutes)} read</span>
        <span className="meta-item">{pluralize(guide.concepts.length, 'concept')}</span>
      </Meta>
    </article>
  )
}
