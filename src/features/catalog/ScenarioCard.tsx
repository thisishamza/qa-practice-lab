import { Link } from 'react-router-dom'
import type { Scenario } from '../../data/types'
import { getTrack } from '../../data/tracks'
import { testingCategoriesById } from '../../data/categories'
import { difficultyLabels, formatMinutes, scenarioModeLabels } from '../../lib/labels'
import { StatusTag, Tag } from '../../components/ui/Tag'
import { Meta } from '../../components/ui/Meta'
import { Icon } from '../../components/ui/Icon'

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const track = getTrack(scenario.trackId)
  const category = testingCategoriesById.get(scenario.categoryId)

  return (
    <article className="scenario-card">
      <StatusTag status={scenario.status} />

      <h3>
        <Link to={`/scenarios/${scenario.id}`}>{scenario.title}</Link>
      </h3>
      <p className="scenario-summary">{scenario.summary}</p>

      <Meta>
        <span className="meta-item">
          <Icon name="target" size={16} />
          {track?.name ?? scenario.trackId}
        </span>
        <span className="meta-item">{difficultyLabels[scenario.difficulty]}</span>
        <span className="meta-item">{scenarioModeLabels[scenario.mode]}</span>
        <span className="meta-item">
          <Icon name="clock" size={16} />
          {formatMinutes(scenario.estimatedMinutes)}
        </span>
        {category ? <span className="meta-item">{category.name}</span> : null}
        {scenario.huntId ? (
          <span className="meta-item scenario-hunt-badge">
            <Tag tone="warn" icon="bug">
              Bug-hunt exercise
            </Tag>
          </span>
        ) : null}
      </Meta>
    </article>
  )
}
