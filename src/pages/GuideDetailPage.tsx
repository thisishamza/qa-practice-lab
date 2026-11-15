import { Link, useParams } from 'react-router-dom'
import { getGuide, getGuidesForTrack } from '../data/guides'
import { getScenario } from '../data/scenarios'
import { getTrack } from '../data/tracks'
import { difficultyLabels, formatMinutes } from '../lib/labels'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { FactList } from '../components/ui/FactList'
import { LevelMeter } from '../components/ui/LevelMeter'
import { Tag } from '../components/ui/Tag'
import { Callout } from '../components/ui/Callout'
import { EmptyState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'

const sections = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'concepts', label: 'Concepts' },
  { id: 'examples', label: 'Examples' },
  { id: 'steps', label: 'Step by step' },
  { id: 'expected-results', label: 'Expected results' },
  { id: 'common-mistakes', label: 'Common mistakes' },
  { id: 'related-exercises', label: 'Related exercises' },
]

export function GuideDetailPage() {
  const { guideId } = useParams()
  const guide = guideId ? getGuide(guideId) : undefined

  useDocumentTitle(guide?.title ?? 'Guide not found')

  if (!guide) {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Guides', to: '/guides' },
            { label: 'Not found' },
          ]}
        />
        <EmptyState
          title="That guide does not exist"
          description="The guide may not be published yet, or the link may be incomplete."
          icon="book"
          action={
            <Link className="button" to="/guides">
              Back to the guide library
            </Link>
          }
        />
      </div>
    )
  }

  const track = getTrack(guide.trackId)
  const relatedScenarios = guide.relatedScenarioIds.flatMap((scenarioId) => {
    const scenario = getScenario(scenarioId)
    return scenario ? [scenario] : []
  })
  const siblingGuides = getGuidesForTrack(guide.trackId).filter(
    (entry) => entry.id !== guide.id,
  )

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Guides', to: '/guides' },
          { label: guide.title },
        ]}
      />

      <PageHeader
        eyebrow={track ? `Guide · ${track.name}` : 'Guide'}
        title={guide.title}
        description={guide.summary}
      />

      <div className="meta-row">
        <LevelMeter level={guide.level} />
        <span className="meta-item">
          <Icon name="clock" size={15} />
          {formatMinutes(guide.readingMinutes)} read
        </span>
        <span className="meta-item">{guide.concepts.length} concepts</span>
        <span className="meta-item">{guide.steps.length} steps</span>
      </div>

      <div className="detail-layout guide-layout">
        <article className="detail-main guide-article">
          <section id="introduction" className="content-section guide-section">
            <h2>Introduction</h2>
            {guide.introduction.map((paragraph) => (
              <p key={paragraph} className="body-copy">
                {paragraph}
              </p>
            ))}
          </section>

          <section id="concepts" className="content-section guide-section">
            <h2>Concepts</h2>
            <dl className="concept-list">
              {guide.concepts.map((concept) => (
                <div key={concept.term} className="concept-item">
                  <dt>{concept.term}</dt>
                  <dd>{concept.explanation}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="examples" className="content-section guide-section">
            <h2>Practical examples</h2>
            <div className="example-list">
              {guide.examples.map((example) => (
                <figure key={example.title} className="code-example">
                  <figcaption>
                    <span>{example.title}</span>
                    <Tag tone="neutral">{example.language}</Tag>
                  </figcaption>
                  <p>{example.description}</p>
                  <pre>
                    <code>{example.code}</code>
                  </pre>
                </figure>
              ))}
            </div>
          </section>

          <section id="steps" className="content-section guide-section">
            <h2>Step by step</h2>
            <ol className="step-list">
              {guide.steps.map((step, index) => (
                <li key={step.title}>
                  <span className="step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>
                    <strong>{step.title}</strong>
                    <span className="step-detail">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section id="expected-results" className="content-section guide-section">
            <h2>Expected results</h2>
            <ul className="check-list">
              {guide.expectedResults.map((result) => (
                <li key={result}>
                  <span className="check-list-icon" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  <span>{result}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="common-mistakes" className="content-section guide-section">
            <h2>Common mistakes</h2>
            <ul className="mistake-list">
              {guide.commonMistakes.map((mistake) => (
                <li key={mistake}>
                  <span className="mistake-icon" aria-hidden="true">
                    <Icon name="alert" size={14} />
                  </span>
                  <span>{mistake}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="related-exercises" className="content-section guide-section">
            <h2>Related exercises</h2>
            {relatedScenarios.length > 0 ? (
              <ul className="related-list">
                {relatedScenarios.map((scenario) => (
                  <li key={scenario.id}>
                    <Link to={`/scenarios/${scenario.id}`}>
                      <span>
                        <strong>{scenario.title}</strong>
                        <span>{scenario.summary}</span>
                      </span>
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="body-copy">
                No exercises are linked to this guide yet.
              </p>
            )}
          </section>

          <Callout tone="neutral" title="Exercises are still placeholders">
            Reading a guide does not require a runnable exercise. When the related
            scenarios become available, this page will link directly to their launch
            controls.
          </Callout>
        </article>

        <aside className="detail-aside guide-aside">
          <nav className="guide-toc" aria-label="On this page">
            <p className="guide-toc-title">On this page</p>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="panel">
            <h2>Guide facts</h2>
            <FactList
              items={[
                { label: 'Discipline', value: track?.name ?? guide.trackId },
                { label: 'Level', value: difficultyLabels[guide.level] },
                { label: 'Reading time', value: formatMinutes(guide.readingMinutes) },
                { label: 'Related exercises', value: relatedScenarios.length },
              ]}
            />
          </div>

          {siblingGuides.length > 0 ? (
            <div className="panel">
              <h2>More in this discipline</h2>
              <ul className="aside-link-list">
                {siblingGuides.map((entry) => (
                  <li key={entry.id}>
                    <Link to={`/guides/${entry.id}`}>
                      <Icon name="book" size={15} />
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
