import { Link } from 'react-router-dom'
import type { IconName } from '../data/types'
import { HealthStatus } from '../features/system/HealthStatus'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { SectionHeader } from '../components/ui/PageChrome'
import { Badge } from '../components/ui/Badge'
import { Icon } from '../components/ui/Icon'

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
        eyebrow="Runtime"
        title="Practice environment"
        description="The lab runtime is live. Exercise targets and launch controls are intentionally not implemented in this phase."
      />

      <Callout tone="warning" title="Nothing on this page launches an exercise">
        Phase 2 delivers the interface and learning structure only. There is no commerce
        application, test API, SQL playground, bug-hunt mode, or scoring yet.
      </Callout>

      <div className="split-grid practice-split">
        <HealthStatus />

        <div className="panel">
          <h2>Environment facts</h2>
          <dl className="fact-list">
            <div>
              <dt>Frontend</dt>
              <dd>React + TypeScript + Vite</dd>
            </div>
            <div>
              <dt>API</dt>
              <dd>Hono on Cloudflare Pages Functions</dd>
            </div>
            <div>
              <dt>Platform data</dt>
              <dd>Cloudflare D1 (health metadata only)</dd>
            </div>
            <div>
              <dt>Exercise targets</dt>
              <dd>Not implemented</dd>
            </div>
          </dl>
          <p className="panel-note">
            The health check is the only live API call in Phase 2. It confirms the
            platform wiring, not an exercise environment.
          </p>
        </div>
      </div>

      <section className="content-section" aria-labelledby="formats-title">
        <SectionHeader
          id="formats-title"
          title="Planned practice formats"
          description="Each format will be added behind a bounded, first-party target."
          action={<Badge tone="neutral">Planned</Badge>}
        />
        <div className="format-grid">
          {plannedFormats.map((format) => (
            <div key={format.title} className="format-card">
              <span className="format-icon" aria-hidden="true">
                <Icon name={format.icon} size={18} />
              </span>
              <h3>{format.title}</h3>
              <p>{format.description}</p>
              <Badge tone="neutral" icon="lock">
                Not available
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <div className="split-grid">
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

        <section className="content-section" aria-labelledby="prepare-title">
          <SectionHeader id="prepare-title" title="Prepare while you wait" />
          <div className="panel">
            <p className="panel-note">
              The learning content is usable now. Review a track, read its starting guide,
              and inspect the scenarios that will become runnable exercises.
            </p>
            <div className="button-row">
              <Link className="button button-small" to="/tracks">
                Browse tracks
              </Link>
              <Link className="button button-secondary button-small" to="/guides">
                Read a guide
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
