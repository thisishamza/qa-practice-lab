import { Link } from 'react-router-dom'
import type { Guide } from '../../data/types'
import { formatMinutes, pluralize } from '../../lib/labels'
import { LevelMeter } from '../../components/ui/LevelMeter'
import { Meta } from '../../components/ui/Meta'
import { Icon } from '../../components/ui/Icon'

export function GuideCard({ guide }: { guide: Guide }) {
  return (
    <article className="guide-row">
      <div className="guide-row-copy">
        <h3>
          <Link to={`/guides/${guide.id}`}>{guide.title}</Link>
        </h3>
        <p className="guide-summary">{guide.summary}</p>
        <Meta>
          <LevelMeter level={guide.level} />
          <span>{formatMinutes(guide.readingMinutes)} read</span>
          <span>{pluralize(guide.concepts.length, 'concept')}</span>
          <span>{pluralize(guide.steps.length, 'step')}</span>
        </Meta>
      </div>
      <Icon name="chevron-right" size={16} />
    </article>
  )
}
