import { Link } from 'react-router-dom'
import type { IconName } from '../data/types'
import { HealthStatus } from '../features/system/HealthStatus'
import { HuntPanel } from '../features/practice/HuntPanel'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader } from '../components/ui/PageChrome'
import { Tag } from '../components/ui/Tag'
import { Icon } from '../components/ui/Icon'

const startSteps: {
  kicker: string
  title: string
  detail: string
  to: string
}[] = [
  {
    kicker: 'Guide',
    title: 'Read the manual-testing guide',
    detail: 'Test design, oracles, and evidence — the foundation every track builds on.',
    to: '/guides/guide-manual-test-design',
  },
  {
    kicker: 'Scenario',
    title: 'Inspect the cart-totals scenario',
    detail: 'Objectives, prerequisites, and its real availability status — exercises are labelled, never faked.',
    to: '/scenarios/manual-cart-totals',
  },
  {
    kicker: 'Track',
    title: 'Browse the API testing track',
    detail: 'What the track covers, what is usable today, and where it goes next.',
    to: '/tracks/api-testing',
  },
]

const plannedFormats: { title: string; description: string; icon: IconName }[] = [
  {
    title: 'Manual testing lab',
    description: 'A commerce journey with requirements and deliberately seeded states.',
    icon: 'manual',
  },
  {
    title: 'API request console',
    description: 'First-party endpoints with documented contracts and safe test data.',
    icon: 'api',
  },
  {
    title: 'UI automation target',
    description: 'Stable locators and deterministic flows for browser automation.',
    icon: 'ui',
  },
  {
    title: 'Browser SQL sandbox',
    description: 'A browser-isolated SQLite database, never the shared platform D1.',
    icon: 'database',
  },
  {
    title: 'Performance baseline',
    description: 'Allowlisted local targets with controlled, first-party load profiles.',
    icon: 'performance',
  },
  {
    title: 'Accessibility audit',
    description: 'Keyboard and screen-reader journeys with evidence capture.',
    icon: 'accessibility',
  },
]

export function PracticePage() {
  useDocumentTitle('Practice environment')

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Practice"
        title="Practice environment"
        description="What you can work through today, what is being built, and what the runtime reports — all in one place."
        actions={
          <Link className="button" to="/scenarios">
            Explore the catalogue
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

      <section className="content-section" aria-labelledby="available-now-title">
        <SectionHeader
          id="available-now-title"
          title="Available now"
          description="Real content you can work through today — no runtime required."
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

      <HuntPanel />

      <HealthStatus />

      <section className="content-section" aria-labelledby="formats-title">
        <SectionHeader
          id="formats-title"
          title="Practice formats"
          description="Planned exercise targets, in build order. Nothing here launches an exercise yet."
          action={<Tag tone="planned">Planned</Tag>}
        />
        <div className="format-grid">
          {plannedFormats.map((format) => (
            <div key={format.title} className="format-card">
              <span className="format-icon" aria-hidden="true">
                <Icon name={format.icon} size={18} />
              </span>
              <h3>{format.title}</h3>
              <p>{format.description}</p>
              <Tag tone="neutral" icon="lock">
                Not available
              </Tag>
            </div>
          ))}
        </div>
      </section>

      <section className="content-section" aria-labelledby="boundaries-title">
        <SectionHeader
          id="boundaries-title"
          title="Safety boundaries"
          description="Non-negotiable constraints for later practice features."
        />
        <ul className="check-list">
          <li>
            <span className="check-list-icon" aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            <span>No user-supplied URLs or arbitrary targets on the server.</span>
          </li>
          <li>
            <span className="check-list-icon" aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            <span>No user code executed on Cloudflare Workers.</span>
          </li>
          <li>
            <span className="check-list-icon" aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            <span>SQL practice is isolated in the browser, never the shared D1.</span>
          </li>
          <li>
            <span className="check-list-icon" aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            <span>Synthetic accounts and data only; no real payments or records.</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
