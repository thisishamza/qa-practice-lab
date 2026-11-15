import { Link, useParams } from 'react-router-dom'
import { getTrack, learningTracks } from '../data/tracks'
import { getScenariosForTrack } from '../data/scenarios'
import { getGuide } from '../data/guides'
import { testingCategoriesById } from '../data/categories'
import { difficultyLabels, pluralize } from '../lib/labels'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Breadcrumbs, SectionHeader } from '../components/ui/PageChrome'
import { LevelMeter } from '../components/ui/LevelMeter'
import { Tag } from '../components/ui/Tag'
import { EmptyState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { ScenarioCard } from '../features/catalog/ScenarioCard'

export function TrackDetailPage() {
  const { trackId } = useParams()
  const track = trackId ? getTrack(trackId) : undefined

  useDocumentTitle(track?.name ?? 'Track not found')

  if (!track) {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Learning tracks', to: '/tracks' },
            { label: 'Not found' },
          ]}
        />
        <EmptyState
          title="That learning track does not exist"
          description="The track may have been renamed, or the link may be incomplete."
          icon="tracks"
          action={
            <Link className="button" to="/tracks">
              Back to all tracks
            </Link>
          }
        />
      </div>
    )
  }

  const trackScenarios = getScenariosForTrack(track.id)
  const guide = track.gettingStarted.guideId
    ? getGuide(track.gettingStarted.guideId)
    : undefined
  const relatedTracks = learningTracks
    .filter(
      (entry) =>
        entry.id !== track.id &&
        entry.categoryIds.some((categoryId) => track.categoryIds.includes(categoryId)),
    )
    .slice(0, 3)

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Learning tracks', to: '/tracks' },
          { label: track.name },
        ]}
      />

      <PageHeader
        eyebrow="Learning track"
        title={track.name}
        description={track.tagline}
      />

      <div className="meta-row">
        <LevelMeter level={track.difficulty} />
        <span className="meta-item">
          <Icon name="target" size={15} />
          {pluralize(track.plannedExerciseCount, 'exercise')} planned
        </span>
        <span className="meta-item">
          <Icon name="scenarios" size={15} />
          {pluralize(trackScenarios.length, 'listed', 'listed')}
        </span>
        {track.categoryIds.map((categoryId) => {
          const category = testingCategoriesById.get(categoryId)
          return category ? (
            <Tag key={categoryId} tone="neutral">
              {category.name}
            </Tag>
          ) : null
        })}
      </div>

      <p className="tracks-note">
        Objectives and listed scenarios are real; exercises are not runnable yet — each
        scenario carries its own availability status.
      </p>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="content-section" aria-labelledby="track-about">
            <SectionHeader id="track-about" title="About this track" />
            <p className="body-copy">{track.description}</p>
          </section>

          <section className="content-section" aria-labelledby="track-objectives">
            <SectionHeader
              id="track-objectives"
              title="Learning objectives"
              description="What you should be able to do after working through the track."
            />
            <ul className="check-list">
              {track.objectives.map((objective) => (
                <li key={objective}>
                  <span className="check-list-icon" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="content-section" aria-labelledby="track-start">
            <SectionHeader
              id="track-start"
              title="Getting started"
              description={track.gettingStarted.summary}
            />
            <ol className="step-list">
              {track.gettingStarted.steps.map((step, index) => (
                <li key={step}>
                  <span className="step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="content-section" aria-labelledby="track-scenarios">
            <SectionHeader
              id="track-scenarios"
              title="Scenarios in this track"
              description="Representative placeholders from the scenario catalogue."
              action={
                <Link className="text-link" to={`/scenarios?track=${track.id}`}>
                  {pluralize(trackScenarios.length, 'scenario')} in the catalogue
                  <Icon name="arrow-right" size={14} />
                </Link>
              }
            />
            {trackScenarios.length > 0 ? (
              <div className="card-stack">
                {trackScenarios.map((scenario) => (
                  <ScenarioCard key={scenario.id} scenario={scenario} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No scenarios listed yet"
                description="This track has objectives but no representative scenario entries."
                icon="scenarios"
              />
            )}
          </section>
        </div>

        <aside className="detail-aside">
          <div className="panel">
            <h2>Starting guide</h2>
            {guide ? (
              <>
                <p className="panel-note">
                  This track pairs with a full introductory guide.
                </p>
                <Link className="guide-inline" to={`/guides/${guide.id}`}>
                  <Icon name="book" size={16} />
                  <span>{guide.title}</span>
                </Link>
              </>
            ) : (
              <p className="panel-note">
                A dedicated guide for this track is scheduled. The getting-started steps above
                are enough to begin reviewing the material.
              </p>
            )}
          </div>

          {relatedTracks.length > 0 ? (
            <div className="panel">
              <h2>Related tracks</h2>
              <p className="panel-note">Shares testing categories with this track.</p>
              <ul className="aside-link-list">
                {relatedTracks.map((entry) => (
                  <li key={entry.id}>
                    <Link to={`/tracks/${entry.id}`}>
                      <Icon name={entry.icon} size={15} />
                      <span>
                        {entry.name}
                        <span className="aside-link-meta">
                          {difficultyLabels[entry.difficulty]} ·{' '}
                          {pluralize(entry.plannedExerciseCount, 'exercise')} planned
                        </span>
                      </span>
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
