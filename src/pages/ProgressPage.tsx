import { Link } from 'react-router-dom'
import { learningTracks } from '../data/tracks'
import { demoDisclaimer, demoProgress } from '../data/demo'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader } from '../components/ui/PageChrome'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Tag } from '../components/ui/Tag'
import { Icon } from '../components/ui/Icon'

const trackedFeatures: { title: string; detail: string }[] = [
  {
    title: 'Exercise completion',
    detail: 'Which scenarios you finish, per track, once the exercise runtime exists.',
  },
  {
    title: 'Attempts and scoring',
    detail: 'Bug-hunt attempts, scores, and debrief answers for each exercise.',
  },
  {
    title: 'Recently visited',
    detail: 'The last guides and scenarios you opened, with dates, so you can pick up where you left off.',
  },
  {
    title: 'Streaks and rhythm',
    detail: 'Consecutive days of practice against a weekly goal you set.',
  },
]

const startSteps: {
  kicker: string
  title: string
  detail: string
  to: string
}[] = [
  {
    kicker: 'Guide',
    title: 'Read the manual-testing guide',
    detail: 'The best first step in every track — test design, oracles, and evidence.',
    to: '/guides/guide-manual-test-design',
  },
  {
    kicker: 'Scenario',
    title: 'Inspect the cart-totals scenario',
    detail: 'Objectives, prerequisites, and its real availability status.',
    to: '/scenarios/manual-cart-totals',
  },
  {
    kicker: 'Track',
    title: 'Browse the API testing track',
    detail: 'What the track covers and what is usable today.',
    to: '/tracks/api-testing',
  },
]

export function ProgressPage() {
  useDocumentTitle('Progress')

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Learning record"
        title="Progress"
        description="Nothing on this page is saved yet. This is what the progress experience will become — and where to go instead today."
      />

      <p className="progress-note">
        No activity is recorded in this build. Your theme preference is the only thing this
        browser stores.
      </p>

      <section className="content-section" aria-labelledby="preview-title">
        <SectionHeader
          id="preview-title"
          title="What progress will look like"
          description="Sample values so the intended view is concrete — demonstration data, not yours."
          action={<Tag tone="warn">Sample</Tag>}
        />
        <div className="panel">
          <div className="progress-list">
            {demoProgress.tracks.map((item) => {
              const track = learningTracks.find((entry) => entry.id === item.trackId)

              return (
                <div key={item.trackId} className="progress-row">
                  <ProgressBar
                    label={track?.name ?? item.trackId}
                    value={item.completed}
                    max={item.total}
                  />
                  {track ? (
                    <Link
                      className="progress-row-link"
                      to={`/tracks/${track.id}`}
                      aria-label={`Open ${track.name}`}
                    >
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
          <p className="panel-note">{demoDisclaimer}</p>
        </div>
      </section>

      <div className="split-grid">
        <section className="content-section" aria-labelledby="tracked-title">
          <SectionHeader
            id="tracked-title"
            title="What will be tracked"
            description="Planned capabilities — none of these save anything yet."
            action={<Tag tone="planned">Planned</Tag>}
          />
          <ul className="tracked-list">
            {trackedFeatures.map((feature, index) => (
              <li key={feature.title}>
                <span className="tracked-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="tracked-copy">
                  <strong>{feature.title}</strong>
                  <span>{feature.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="content-section" aria-labelledby="start-title">
          <SectionHeader
            id="start-title"
            title="While you wait"
            description="Real content you can work through today."
          />
          <ol className="start-path-list">
            {startSteps.map((step, index) => (
              <li key={step.to}>
                <Link className="start-step" to={step.to}>
                  <span className="start-step-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="start-step-copy">
                    <span className="start-step-kicker">{step.kicker}</span>
                    <span className="start-step-title">{step.title}</span>
                    <span className="start-step-detail">{step.detail}</span>
                  </span>
                  <Icon name="arrow-right" size={16} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
