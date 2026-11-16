import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { Icon } from '../components/ui/Icon'

const DATASET_FACTS: readonly { key: string; value: string }[] = [
  { key: 'Tables', value: '8' },
  { key: 'Rows', value: '1,419' },
  { key: 'Seed size', value: '~120 KB' },
  { key: 'Engine', value: 'SQLite (WebAssembly)' },
]

const HOW_STEPS = [
  {
    title: 'Inspect before you query',
    detail: 'Open the schema explorer: eight tables, foreign keys, indexes and CHECK constraints. Read the DDL — the planner thinks the same way.',
  },
  {
    title: 'Write, run, read',
    detail: 'Ctrl/⌘ + Enter executes. Results appear per statement, errors name the failing statement, and runaway queries are killed at 3 seconds.',
  },
  {
    title: 'Reset freely',
    detail: 'The database lives only in this page. Reset restores the frozen snapshot — nothing you do is saved, uploaded or shared.',
  },
] as const

/**
 * Phase 6 hub. M1 ships the dataset overview and the playground; the
 * exercise catalogue, evaluation and bug hunts arrive with M2 (see
 * docs/phase-6-database-testing-plan.md §15).
 */
export function DatabaseHubPage() {
  useDocumentTitle('Database Testing')

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Database Testing' }]} />

      <PageHeader
        eyebrow="Learn · Database testing"
        title="Database Testing"
        description="Practice the query-and-compare loop behind every database test: map the schema, reconcile the numbers, catch the inconsistencies the UI hides — against a realistic, isolated commerce snapshot."
        actions={
          <Link className="button" to="/database/playground">
            Open the SQL playground
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

      <Callout tone="neutral" title="What ships in this build">
        This build contains the Meridian Outfitters SQL playground: the full practice snapshot, the
        schema explorer and guarded query execution. The guided exercise catalogue, QA database-testing
        scenarios and database bug hunts arrive in Phase 6 M2 — until then there is nothing to
        "check off" here, and this page will not pretend otherwise.
      </Callout>

      <div className="database-hub-grid">
        <section className="workspace-panel database-dataset-card" aria-labelledby="database-dataset-title">
          <div className="workspace-head">
            <h2 id="database-dataset-title" className="workspace-title">The practice snapshot</h2>
            <span className="workspace-status workspace-status-ok">
              <span className="workspace-dot" aria-hidden="true" />
              Synthetic
            </span>
          </div>
          <div className="workspace-body">
            <p className="workspace-line">
              <strong>Meridian Outfitters</strong> — an outdoors retailer, fictional to the last row:
              118 customers, ~220 orders across 2025–2026, line items, synthetic payments and addresses.
              Integer-cent money, ISO-8601 UTC timestamps, foreign keys and CHECK constraints enforced.
            </p>
            <div className="workspace-facts">
              {DATASET_FACTS.map((fact) => (
                <div key={fact.key}>
                  <span className="workspace-key">{fact.key}</span>
                  <span className="workspace-value">{fact.value}</span>
                </div>
              ))}
            </div>
            <p className="workspace-line database-dataset-note">
              The snapshot also carries deliberate, documented data-quality quirks (mismatched totals,
              duplicate-looking customers, stale pending orders) — the raw material for the M2 exercises.
            </p>
          </div>
        </section>

        <section className="content-section database-howto" aria-labelledby="database-howto-title">
          <h2 id="database-howto-title" className="database-section-title">How to practice</h2>
          <ol className="database-steps">
            {HOW_STEPS.map((step, index) => (
              <li key={index} className="database-step">
                <span className="database-step-index" aria-hidden="true">{index + 1}</span>
                <span>
                  <strong>{step.title}.</strong> {step.detail}
                </span>
              </li>
            ))}
          </ol>
          <div className="database-links">
            <Link className="button button-secondary" to="/tracks/database-testing">
              Database Testing track
            </Link>
            <Link className="button button-ghost" to="/scenarios?track=database-testing">
              Scenario catalogue
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
