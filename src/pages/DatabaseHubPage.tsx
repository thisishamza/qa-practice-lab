import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { Tag } from '../components/ui/Tag'
import { Icon } from '../components/ui/Icon'
import { SQL_EXERCISES, type SqlExerciseDifficulty } from '../data/sqlExercises'
import { scenarios } from '../data/scenarios'
import { fetchProgress } from '../features/practice/api'
import type { ProgressResponse } from '../shared/learning'

type Facet = 'all' | SqlExerciseDifficulty | 'testing'

const DATASET_FACTS: readonly { key: string; value: string }[] = [
  { key: 'Tables', value: '8' },
  { key: 'Rows', value: '1,419' },
  { key: 'Seed size', value: '~120 KB' },
  { key: 'Engine', value: 'SQLite (WebAssembly)' },
]

const HOW_STEPS = [
  {
    title: 'Pick an exercise',
    detail: 'Thirty-six exercises across three levels, framed as the queries a tester runs — reconciliation, orphan detection, duplicate hunts. Hints escalate gradually; solutions unlock after a pass or an honest give-up.',
  },
  {
    title: 'Write, run, read',
    detail: 'Ctrl/⌘ + Enter executes. Results appear per statement, errors name the failing statement, and runaway queries are killed at 3 seconds — the database is rebuilt from the frozen snapshot.',
  },
  {
    title: 'Check and track',
    detail: '“Check work” compares your result set against the expected specification server-side. Passes are recorded against your practice session and appear on /progress.',
  },
] as const

const FACETS: readonly { id: Facet; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'testing', label: 'Testing goals' },
]

const BANDS: readonly { difficulty: SqlExerciseDifficulty; label: string; blurb: string }[] = [
  { difficulty: 'beginner', label: 'Beginner', blurb: 'The 12 query fundamentals a database test starts from.' },
  { difficulty: 'intermediate', label: 'Intermediate', blurb: 'Joins, subqueries, aggregation — and the 13 QA scenarios.' },
  { difficulty: 'advanced', label: 'Advanced', blurb: 'Transactions, integrity, window functions and optimization checks.' },
]

function bandRing(completed: number, total: number) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <span
      className="band-ring"
      role="img"
      aria-label={`${completed} of ${total} passed`}
      style={{ ['--band-pct' as string]: `${pct}%` }}
    >
      <span className="band-ring-value">{pct}%</span>
    </span>
  )
}

export function DatabaseHubPage() {
  useDocumentTitle('Database Testing')
  const [facet, setFacet] = useState<Facet>('all')
  const [progress, setProgress] = useState<ProgressResponse | null>(null)
  const [progressState, setProgressState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    fetchProgress(controller.signal)
      .then((response) => {
        setProgress(response)
        setProgressState('ready')
      })
      .catch(() => setProgressState('error'))
    return () => controller.abort()
  }, [])

  const visible = useMemo(() => {
    switch (facet) {
      case 'beginner':
      case 'intermediate':
      case 'advanced':
        return SQL_EXERCISES.filter((exercise) => exercise.difficulty === facet)
      case 'testing':
        return SQL_EXERCISES.filter((exercise) => exercise.kind === 'qa')
      default:
        return SQL_EXERCISES
    }
  }, [facet])

  const hunts = useMemo(
    () =>
      scenarios
        .filter((scenario) => scenario.huntId?.startsWith('hunt-db-'))
        .sort((a, b) => (a.huntId ?? '').localeCompare(b.huntId ?? '')),
    [],
  )

  // Per-band completion: an exercise counts once its attempt is submitted or best ≥ 70.
  const bandProgress = useMemo(() => {
    const entries = progress?.hunts ?? []
    const byId = new Map(entries.map((entry) => [entry.huntId, entry]))
    const result = new Map<SqlExerciseDifficulty, { done: number; total: number }>()
    for (const band of BANDS) {
      const bandExercises = SQL_EXERCISES.filter((exercise) => exercise.difficulty === band.difficulty)
      const done = bandExercises.filter((exercise) => {
        const entry = byId.get(exercise.id)
        return entry !== undefined && (entry.status === 'submitted' || (entry.bestScore ?? 0) >= 70)
      }).length
      result.set(band.difficulty, { done, total: bandExercises.length })
    }
    return result
  }, [progress])

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Database Testing' }]} />

      <PageHeader
        eyebrow="Learn · Database testing"
        className="lab-hub"
        title="Database Testing"
        description="Practice the query-and-compare loop behind every database test — reconciliation, orphan detection, duplicate hunts — against a realistic, isolated commerce snapshot, with checked answers and no setup."
        actions={
          <Link className="button" to="/database/playground">
            Open the SQL playground
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

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
              118 customers, 228 orders, line items, synthetic payments and addresses. Integer-cent
              money, ISO-8601 UTC timestamps, foreign keys and CHECK constraints enforced. Every row
              is generated for this lab; no real data lives here.
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
              The snapshot also carries deliberate, documented data-quality quirks — the raw material
              for the QA-tagged exercises and the eight database bug hunts.
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
            <Link className="button button-ghost" to="/practice">
              Bug-hunt panel
            </Link>
          </div>
        </section>
      </div>

      <section className="content-section" aria-labelledby="database-exercises-title">
        <div className="database-bands" aria-label="Your completion per difficulty">
          {BANDS.map((band) => {
            const stats = bandProgress.get(band.difficulty)
            const done = stats?.done ?? 0
            const total = stats?.total ?? 0
            return (
              <div key={band.difficulty} className="database-band">
                {progressState === 'ready' ? bandRing(done, total) : <span className="band-ring band-ring-muted" aria-hidden="true" />}
                <div>
                  <h3 className="database-band-title">{band.label}</h3>
                  <p className="database-band-blurb">{band.blurb}</p>
                  {progressState === 'error' ? (
                    <p className="database-band-note">Progress unavailable — your attempts still count.</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <div className="database-exercises-head">
          <h2 id="database-exercises-title" className="database-section-title">Exercises</h2>
          <div className="filter-chips" role="group" aria-label="Filter exercises">
            {FACETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`filter-chip filter-chip-toggle${facet === entry.id ? ' filter-chip-active' : ''}`}
                aria-pressed={facet === entry.id}
                onClick={() => setFacet(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="database-exercise-grid">
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <Link className="database-exercise-card" to={`/database/exercises/${exercise.id}`}>
                <div className="database-exercise-card-top">
                  <Tag tone="neutral">{exercise.difficulty}</Tag>
                  {exercise.qaId ? <Tag tone="warn" icon="bug">{exercise.qaId}</Tag> : null}
                </div>
                <h3 className="database-exercise-title">{exercise.title}</h3>
                <p className="database-exercise-summary">{exercise.summary}</p>
                <span className="database-exercise-meta">{exercise.estimatedMinutes} min · {exercise.tables.length} {exercise.tables.length === 1 ? 'table' : 'tables'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-section" aria-labelledby="database-hunts-title">
        <h2 id="database-hunts-title" className="database-section-title">Database bug hunts</h2>
        <p className="database-hint">
          Eight deliberately broken snapshots — find the defect with your own queries, then file a
          structured report. Progressive hints and a gated reveal live on each hunt; your report is
          scored deterministically.
        </p>
        <ul className="database-hunt-grid">
          {hunts.map((scenario) => (
            <li key={scenario.id}>
              <Link className="database-hunt-card" to={`/scenarios/${scenario.id}`}>
                <div className="database-exercise-card-top">
                  <Tag tone="warn" icon="bug">Bug hunt</Tag>
                  <Tag tone="neutral">{scenario.difficulty}</Tag>
                </div>
                <h3 className="database-exercise-title">{scenario.title.replace(/^Bug hunt: /, '')}</h3>
                <p className="database-exercise-summary">{scenario.summary}</p>
                <span className="database-exercise-meta">{scenario.estimatedMinutes} min</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Callout tone="neutral" title="Why this cannot touch the real thing">
        Everything here runs inside this page: the practice database lives in a Web Worker (SQLite,
        WebAssembly) in your browser. No query, result or row you produce here ever reaches the lab’s
        own database, and each exercise resets to the frozen snapshot on demand.
      </Callout>
    </div>
  )
}
