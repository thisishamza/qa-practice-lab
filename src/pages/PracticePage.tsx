import { Link } from 'react-router-dom'
import type { IconName } from '../data/types'
import { HealthStatus } from '../features/system/HealthStatus'
import { HuntPanel } from '../features/practice/HuntPanel'
import { RecommendedPath } from '../features/practice/RecommendedPath'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader, Breadcrumbs } from '../components/ui/PageChrome'
import { Tag } from '../components/ui/Tag'
import { Icon } from '../components/ui/Icon'

const practiceFormats: {
  title: string
  description: string
  icon: IconName
  status: 'ready' | 'planned'
}[] = [
  {
    title: 'Manual testing lab',
    description: 'A commerce journey with requirements and deliberately seeded states.',
    icon: 'manual',
    status: 'ready',
  },
  {
    title: 'API request console',
    description: 'First-party endpoints with documented contracts and safe test data.',
    icon: 'api',
    status: 'ready',
  },
  {
    title: 'UI automation target',
    description: 'Stable locators and deterministic flows for browser automation.',
    icon: 'ui',
    status: 'planned',
  },
  {
    title: 'Browser SQL sandbox',
    description: 'A browser-isolated SQLite database, never the shared platform D1.',
    icon: 'database',
    status: 'ready',
  },
  {
    title: 'Performance baseline',
    description: 'Allowlisted local targets with controlled, first-party load profiles.',
    icon: 'performance',
    status: 'ready',
  },
  {
    title: 'Accessibility audit',
    description: 'Keyboard and screen-reader journeys with evidence capture.',
    icon: 'accessibility',
    status: 'planned',
  },
]

export function PracticePage() {
  useDocumentTitle('Bug hunts')

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Bug hunts' }]} />

      <PageHeader
        eyebrow="Bug hunts"
        title="Bug hunts"
        description="Deterministic, seeded-defect exercises against the fictional Meridian Outfitters shop. Learn the two modes below, then start a hunt — defects stay scoped to your browser session."
        actions={
          <Link className="button" to="/scenarios">
            Explore the catalogue
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

      <section className="content-section" aria-labelledby="modes-title">
        <SectionHeader
          id="modes-title"
          title="Two modes, one shop"
          description="The same fictional shop runs in both modes — clean mode behaves as specified; bug-hunt mode enables deliberate defects."
        />
        <div className="split-grid">
          <div className="panel mode-card">
            <h3 className="mode-card-title">
              <Icon name="check" size={16} /> Clean mode
            </h3>
            <p className="panel-note">
              Shop normally. The commerce app behaves as specified; no deliberate
              defects are enabled. Use clean mode to learn a journey — browse,
              cart, checkout, account — and to see expected behaviour for
              comparison.
            </p>
            <p className="panel-note mode-card-note">
              Nothing is broken. If something looks wrong in clean mode, that
              is a real defect worth reporting — or your session needs a reset.
            </p>
          </div>
          <div className="panel mode-card">
            <h3 className="mode-card-title">
              <Icon name="bug" size={16} /> Bug-hunt mode
            </h3>
            <p className="panel-note">
              Explore the same app with deliberate defects enabled. Find and report
              unexpected behaviour — wrong totals, stale stock, broken filters,
              boundary slips.
            </p>
            <p className="panel-note mode-card-note">
              Defects are scoped to your browser session only and never affect
              other learners. Resetting returns the shop to clean behaviour;
              your cart and orders are kept.
            </p>
          </div>
        </div>
        <ol className="mode-steps">
          <li><span className="mode-step-number" aria-hidden="true">1</span><span><strong>Start a hunt</strong> from the list below (or from any wired scenario page).</span></li>
          <li><span className="mode-step-number" aria-hidden="true">2</span><span><strong>Investigate the shop.</strong> Poking around is the exercise — hints (three levels) are available on the panel and never lower your score.</span></li>
          <li><span className="mode-step-number" aria-hidden="true">3</span><span><strong>File a report</strong> with steps, expected vs actual and severity. A deterministic evaluator scores every submission; finding the defect is tracked separately as discovery.</span></li>
          <li><span className="mode-step-number" aria-hidden="true">4</span><span><strong>Reset to clean</strong> whenever you want — nothing is permanent and nothing leaves your session.</span></li>
        </ol>
      </section>

      <RecommendedPath />

      <HuntPanel />

      <HealthStatus />

      <section className="content-section" aria-labelledby="formats-title">
        <SectionHeader
          id="formats-title"
          title="Practice formats"
          description="What each format is and where it lives today — four ship now, two are still being built."
          action={<Tag tone="neutral">{practiceFormats.filter((format) => format.status === 'ready').length} of {practiceFormats.length} live</Tag>}
        />
        <div className="format-grid">
          {practiceFormats.map((format) => (
            <div key={format.title} className="format-card">
              <span className="format-icon" aria-hidden="true">
                <Icon name={format.icon} size={20} />
              </span>
              <h3>{format.title}</h3>
              <p>{format.description}</p>
              {format.status === 'ready' ? (
                <Tag tone="ready">Available</Tag>
              ) : (
                <Tag tone="planned">Not available</Tag>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="content-section" aria-labelledby="boundaries-title">
        <SectionHeader
          id="boundaries-title"
          title="Safety boundaries"
          description="Non-negotiable constraints the practice features honour."
        />
        <ul className="check-list">
          <li>
            <span className="check-list-icon" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
            <span>No user-supplied URLs or arbitrary targets on the server.</span>
          </li>
          <li>
            <span className="check-list-icon" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
            <span>No user code executed on Cloudflare Workers.</span>
          </li>
          <li>
            <span className="check-list-icon" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
            <span>SQL practice is isolated in the browser, never the shared D1.</span>
          </li>
          <li>
            <span className="check-list-icon" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
            <span>Synthetic accounts and data only; no real payments or records.</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
