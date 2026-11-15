import { Link, useParams } from 'react-router-dom'
import { getScenario, getScenariosForTrack } from '../data/scenarios'
import { getTrack } from '../data/tracks'
import { getGuide } from '../data/guides'
import { testingCategoriesById } from '../data/categories'
import { difficultyLabels, formatMinutes, scenarioModeLabels } from '../lib/labels'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Breadcrumbs, SectionHeader } from '../components/ui/PageChrome'
import { FactList } from '../components/ui/FactList'
import { StatusTag } from '../components/ui/Tag'
import { LevelMeter } from '../components/ui/LevelMeter'
import { Callout } from '../components/ui/Callout'
import { EmptyState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'

export function ScenarioDetailPage() {
  const { scenarioId } = useParams()
  const scenario = scenarioId ? getScenario(scenarioId) : undefined

  useDocumentTitle(scenario?.title ?? 'Scenario not found')

  if (!scenario) {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Scenario catalog', to: '/scenarios' },
            { label: 'Not found' },
          ]}
        />
        <EmptyState
          title="That scenario does not exist"
          description="It may have been renamed or removed from the catalogue."
          icon="scenarios"
          action={
            <Link className="button" to="/scenarios">
              Back to the catalogue
            </Link>
          }
        />
      </div>
    )
  }

  const track = getTrack(scenario.trackId)
  const category = testingCategoriesById.get(scenario.categoryId)
  const relatedGuides = scenario.relatedGuideIds.flatMap((guideId) => {
    const guide = getGuide(guideId)
    return guide ? [guide] : []
  })
  const relatedScenarios = getScenariosForTrack(scenario.trackId).filter(
    (entry) => entry.id !== scenario.id,
  )

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Scenario catalog', to: '/scenarios' },
          ...(track ? [{ label: track.shortName, to: `/tracks/${track.id}` }] : []),
          { label: scenario.title },
        ]}
      />

      <PageHeader
        eyebrow={track ? `Scenario · ${track.name}` : 'Scenario'}
        title={scenario.title}
        description={scenario.summary}
      />

      <div className="meta-row">
        <StatusTag status={scenario.status} />
        <LevelMeter level={scenario.difficulty} />
        <span className="meta-item">{scenarioModeLabels[scenario.mode]}</span>
        <span className="meta-item">
          <Icon name="clock" size={15} />
          {formatMinutes(scenario.estimatedMinutes)}
        </span>
        {category ? <span className="meta-item">{category.name}</span> : null}
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="content-section" aria-labelledby="scenario-overview">
            <SectionHeader id="scenario-overview" title="Scenario overview" />
            <p className="body-copy">{scenario.description}</p>
          </section>

          <section className="content-section" aria-labelledby="scenario-objectives">
            <SectionHeader
              id="scenario-objectives"
              title="Learning objectives"
              description="What this exercise is designed to teach."
            />
            <ul className="check-list">
              {scenario.objectives.map((objective) => (
                <li key={objective}>
                  <span className="check-list-icon" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="content-section" aria-labelledby="scenario-prerequisites">
            <SectionHeader id="scenario-prerequisites" title="Prerequisites" />
            <ul className="plain-list">
              {scenario.prerequisites.map((prerequisite) => (
                <li key={prerequisite}>
                  <Icon name="target" size={14} />
                  {prerequisite}
                </li>
              ))}
            </ul>
          </section>

          {relatedGuides.length > 0 ? (
            <section className="content-section" aria-labelledby="scenario-guides">
              <SectionHeader
                id="scenario-guides"
                title="Related guidance"
                description="Read the background before attempting the exercise when it becomes available."
              />
              <ul className="guide-link-list">
                {relatedGuides.map((guide) => (
                  <li key={guide.id}>
                    <Link to={`/guides/${guide.id}`}>
                      <span className="guide-link-icon" aria-hidden="true">
                        <Icon name="book" size={17} />
                      </span>
                      <span>
                        <strong>{guide.title}</strong>
                        <span>{guide.summary}</span>
                      </span>
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="detail-aside">
          <div className="panel">
            <h2>Scenario facts</h2>
            <FactList
              items={[
                {
                  label: 'Track',
                  value: track ? (
                    <Link to={`/tracks/${track.id}`}>{track.name}</Link>
                  ) : (
                    scenario.trackId
                  ),
                },
                { label: 'Category', value: category?.name ?? scenario.categoryId },
                { label: 'Difficulty', value: difficultyLabels[scenario.difficulty] },
                { label: 'Estimated time', value: formatMinutes(scenario.estimatedMinutes) },
                {
                  label: 'Availability',
                  value: scenario.runnable ? 'Runnable' : 'Not runnable yet',
                },
              ]}
            />
          </div>

          <Callout tone="warning" title="This exercise is not runnable yet">
            The description, objectives, and prerequisites are reviewable now. A launch
            control, target environment, and scoring will be added in a later phase.
          </Callout>

          {relatedScenarios.length > 0 ? (
            <div className="panel">
              <h2>More in this track</h2>
              <ul className="aside-link-list">
                {relatedScenarios.map((entry) => (
                  <li key={entry.id}>
                    <Link to={`/scenarios/${entry.id}`}>
                      <Icon name="scenarios" size={15} />
                      {entry.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
