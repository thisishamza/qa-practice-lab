import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getGuide, getGuidesForTrack, guides } from '../data/guides'
import { getScenario } from '../data/scenarios'
import { getTrack } from '../data/tracks'
import { formatMinutes } from '../lib/labels'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Breadcrumbs, SectionHeader } from '../components/ui/PageChrome'
import { LevelMeter } from '../components/ui/LevelMeter'
import { Tag } from '../components/ui/Tag'
import { Callout } from '../components/ui/Callout'
import { EmptyState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { GuideCard } from '../features/guides/GuideCard'

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
  const [activeSection, setActiveSection] = useState(sections[0].id)

  useDocumentTitle(guide?.title ?? 'Guide not found')

  // Scrollspy: highlight the section currently in view.
  useEffect(() => {
    if (!guide) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )

    for (const section of sections) {
      const element = document.getElementById(section.id)
      if (element) {
        observer.observe(element)
      }
    }

    return () => observer.disconnect()
  }, [guide])

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
        <h1 className="sr-only">Guide not found</h1>
        <EmptyState
          title="That guide does not exist"
          description="The guide may not be published yet, or the link may be incomplete."
          icon="book"
          action={
            <Link className="button button-secondary" to="/guides">
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
  const libraryIndex = guides.findIndex((entry) => entry.id === guide.id)
  const previousGuide = libraryIndex > 0 ? guides[libraryIndex - 1] : undefined
  const nextGuide = libraryIndex < guides.length - 1 ? guides[libraryIndex + 1] : undefined

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
          <Icon name="clock" size={16} />
          {formatMinutes(guide.readingMinutes)} read
        </span>
        <span className="meta-item">{guide.concepts.length} concepts</span>
        <span className="meta-item">{guide.steps.length} steps</span>
      </div>

      {/* Mobile table of contents, above the article */}
      <details className="toc-mobile">
        <summary>On this page</summary>
        <ol>
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={activeSection === section.id ? 'true' : undefined}
                className={activeSection === section.id ? 'is-active' : undefined}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ol>
      </details>

      <div className="detail-layout guide-layout">
        <article className="detail-main guide-article" data-density="spacious">
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
                    <Icon name="check" size={16} />
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
                    <Icon name="alert" size={16} />
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

          {siblingGuides.length > 0 ? (
            <section className="content-section guide-section" aria-labelledby="more-in-discipline">
              <SectionHeader
                id="more-in-discipline"
                title="More in this discipline"
                description={`Other introductory guides for ${track?.name ?? guide.trackId}.`}
              />
              <div className="guide-list">
                {siblingGuides.map((entry) => (
                  <GuideCard key={entry.id} guide={entry} />
                ))}
              </div>
            </section>
          ) : null}

          <nav className="guide-pager" aria-label="Guide library">
            {previousGuide ? (
              <Link className="guide-pager-link" to={`/guides/${previousGuide.id}`}>
                <span className="guide-pager-kicker">Previous guide</span>
                <span className="guide-pager-title">{previousGuide.title}</span>
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            {nextGuide ? (
              <Link className="guide-pager-link is-next" to={`/guides/${nextGuide.id}`}>
                <span className="guide-pager-kicker">Next guide</span>
                <span className="guide-pager-title">{nextGuide.title}</span>
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>

          <Callout tone="neutral" title="Put the guide to work">
            The exercises linked above carry their real availability status — ready
            scenarios launch directly; the rest stay labelled as placeholders until they
            are implemented.
          </Callout>
        </article>

        <aside className="detail-aside guide-aside">
          <nav className="guide-toc" aria-label="On this page">
            <p className="guide-toc-title">On this page</p>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={activeSection === section.id ? 'true' : undefined}
                    className={activeSection === section.id ? 'is-active' : undefined}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      </div>
    </div>
  )
}
