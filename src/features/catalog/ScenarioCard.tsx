import { Link } from 'react-router-dom'
import type { Scenario } from '../../data/types'
import { getTrack } from '../../data/tracks'
import { testingCategoriesById } from '../../data/categories'
import { formatMinutes } from '../../lib/labels'
import {
  DifficultyBadge,
  ModeBadge,
  StatusBadge,
} from '../../components/ui/DomainBadges'
import { Icon } from '../../components/ui/Icon'

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const track = getTrack(scenario.trackId)
  const category = testingCategoriesById.get(scenario.categoryId)

  return (
    <article className="scenario-card">
      <div className="scenario-badges">
        <DifficultyBadge difficulty={scenario.difficulty} />
        <ModeBadge mode={scenario.mode} />
        <StatusBadge status={scenario.status} />
      </div>

      <h3>
        <Link to={`/scenarios/${scenario.id}`}>{scenario.title}</Link>
      </h3>
      <p className="scenario-summary">{scenario.summary}</p>

      <div className="scenario-meta">
        <span>
          <Icon name="target" size={14} />
          {track?.name ?? scenario.trackId}
        </span>
        <span>
          <Icon name="clock" size={14} />
          {formatMinutes(scenario.estimatedMinutes)}
        </span>
        {category ? <span className="muted-inline">{category.name}</span> : null}
      </div>

      <Link className="card-foot-link" to={`/scenarios/${scenario.id}`}>
        View scenario
        <Icon name="arrow-right" size={15} />
      </Link>
    </article>
  )
}
