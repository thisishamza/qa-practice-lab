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
import { HuntLaunchPanel } from '../features/practice/HuntLaunchPanel'

export function ScenarioDetailPage() {
  const { scenarioId } = useParams()
  const scenario = scenarioId ? getScenario(scenarioId) : undefined
  const labUrl = `/api-lab?method=GET&path=${encodeURIComponent('/api/v1/products')}&query=${encodeURIComponent('perPage=3&sort=price_asc')}`

  useDocumentTitle(scenario?.title ?? 'Scenario not found')

  if (!scenario) {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Exercises', to: '/scenarios' },
            { label: 'Not found' },
          ]}
        />
        <h1 className="sr-only">Scenario not found</h1>
        <EmptyState
          title="That scenario does not exist"
          description="It may have been renamed or removed from the catalogue."
          icon="scenarios"
          action={
            <Link className="button button-secondary" to="/scenarios">
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
          { label: 'Exercises', to: '/scenarios' },
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
          <Icon name="clock" size={16} />
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
                    <Icon name="check" size={16} />
                  </span>
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </section>

          {scenario.curriculum ? (
            <>
              <section className="content-section" aria-labelledby="scenario-concepts">
                <SectionHeader
                  id="scenario-concepts"
                  title="QA concepts practised"
                  description="Techniques this exercise trains."
                />
                <ul className="check-list">
                  {scenario.curriculum.conceptsPracticed.map((concept) => (
                    <li key={concept}>
                      <span className="check-list-icon" aria-hidden="true">
                        <Icon name="check" size={16} />
                      </span>
                      <span>{concept}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="content-section" aria-labelledby="scenario-focus">
                <SectionHeader
                  id="scenario-focus"
                  title="Suggested investigation focus"
                  description="Where to aim your investigation — method, not answers."
                />
                <ul className="plain-list">
                  {scenario.curriculum.investigationFocus.map((focus) => (
                    <li key={focus}>
                      <Icon name="target" size={16} />
                      {focus}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="content-section" aria-labelledby="scenario-outcomes">
                <SectionHeader
                  id="scenario-outcomes"
                  title="Expected learning outcomes"
                  description="What you should be able to do afterwards."
                />
                <ul className="check-list">
                  {scenario.curriculum.expectedOutcomes.map((outcome) => (
                    <li key={outcome}>
                      <span className="check-list-icon" aria-hidden="true">
                        <Icon name="check" size={16} />
                      </span>
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="content-section" aria-labelledby="scenario-report-focus">
                <SectionHeader
                  id="scenario-report-focus"
                  title="What a good report covers"
                  description="The substance a strong bug report for this exercise has."
                />
                <ul className="plain-list">
                  {scenario.curriculum.reportFocus.map((item) => (
                    <li key={item}>
                      <Icon name="target" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          {scenario.huntId ? (
            <section className="content-section" aria-labelledby="scenario-evaluation">
              <SectionHeader
                id="scenario-evaluation"
                title="How your report is evaluated"
                description="The same ten deterministic checks, worth the same points, on every submission."
              />
              <p className="body-copy">
                Every report filed for this exercise is scored out of 100 against a published
                rubric — completeness, clarity and evidence, with a separate discovery signal for
                whether the incorrect behaviour was identified. Hints never lower the score and
                revealing the solution never counts as discovering it.{' '}
                <Link to="/about#evaluation">
                  See the full rubric, the verdict bands and what discovery means
                </Link>
                .
              </p>
            </section>
          ) : null}

          <section className="content-section" aria-labelledby="scenario-prerequisites">
            <SectionHeader id="scenario-prerequisites" title="Prerequisites" />
            <ul className="plain-list">
              {scenario.prerequisites.map((prerequisite) => (
                <li key={prerequisite}>
                  <Icon name="target" size={16} />
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
                        <Icon name="book" size={16} />
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
                ...(scenario.curriculum
                  ? [{ label: 'Skill area', value: scenario.curriculum.skillArea }]
                  : []),
                { label: 'Difficulty', value: difficultyLabels[scenario.difficulty] },
                { label: 'Estimated time', value: formatMinutes(scenario.estimatedMinutes) },
                {
                  label: 'Availability',
                  value: scenario.runnable
                    ? scenario.huntId
                      ? 'Runnable — bug-hunt'
                      : 'Runnable'
                    : 'Not runnable yet',
                },
              ]}
            />
          </div>

          {scenario.huntId ? (
            <>
              <HuntLaunchPanel scenario={scenario} />
              <Link className="button button-secondary scenario-lab-link" to={labUrl}>
                <Icon name="api" size={16} />
                Open in API Lab
              </Link>
            </>
          ) : scenario.runnable ? (
            <div className="panel">
              <h2>Run this exercise</h2>
              <p>
                Everything you need is built in: open the API Lab and send{' '}
                <code>GET /api/v1/products?perPage=3&amp;sort=price_asc</code>, then vary one
                parameter at a time and compare what you see with the documented contract in the{' '}
                <Link to="/api-reference">API Reference</Link>.
              </p>
              <Link className="button" to={labUrl}>
                <Icon name="api" size={16} />
                Open in API Lab
              </Link>
            </div>
          ) : (
            <Callout tone="warning" title="This exercise is not runnable yet">
              The description, objectives, and prerequisites are reviewable now. A launch
              control, target environment, and scoring will be added in a later phase.
            </Callout>
          )}

          {relatedScenarios.length > 0 ? (
            <div className="panel">
              <h2>More in this track</h2>
              <ul className="aside-link-list">
                {relatedScenarios.map((entry) => (
                  <li key={entry.id}>
                    <Link to={`/scenarios/${entry.id}`}>
                      <Icon name="scenarios" size={16} />
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
