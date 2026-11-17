import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Tag } from '../components/ui/Tag'
import { Icon } from '../components/ui/Icon'
import { CONTRACT_EXERCISES, type ContractHubFacet } from '../data/contractExercises'
import { scenarios } from '../data/scenarios'
import { fetchProgress } from '../features/practice/api'
import { difficultyLabels } from '../lib/labels'
import type { ProgressResponse } from '../shared/learning'

const FACETS: readonly { id: 'all' | ContractHubFacet; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fundamentals', label: 'Fundamentals' },
  { id: 'compatibility', label: 'Compatibility' },
  { id: 'consumer', label: 'Consumer-driven' },
  { id: 'multi-operation', label: 'Multi-operation' },
]

const BANDS: readonly { difficulty: 'beginner' | 'intermediate' | 'advanced'; label: string; blurb: string }[] = [
  { difficulty: 'beginner', label: 'Beginner', blurb: 'Eight fundamentals — required fields, types, formats, enums and the first live contract test.' },
  { difficulty: 'intermediate', label: 'Intermediate', blurb: 'Nine — nesting, refs, constraints, nullables and your first compatibility reviews.' },
  { difficulty: 'advanced', label: 'Advanced', blurb: 'Seven — breaking-change drills, consumer expectations and the full compatibility review.' },
]

const HOW_STEPS = [
  {
    title: 'Pick a lane',
    detail:
      'Validate any fixture (or the live platform contract) against a payload and read the assertion list; diff two Ledger versions and classify every finding; or write the smallest consumer contract that still bites.',
  },
  {
    title: 'Fix, diff, verify',
    detail:
      'Exploratory feedback runs in your browser through the shared engine; scoring happens server-side. Nothing you type leaves this site.',
  },
  {
    title: 'Check and track',
    detail:
      '“Check work” scores your answer server-side with a compiled rubric. Passes are recorded against your practice session and appear on /progress.',
  },
] as const

const FACTS: readonly { key: string; value: string }[] = [
  { key: 'Exercises', value: '24' },
  { key: 'Bug hunts', value: '7' },
  { key: 'Fixtures', value: '6' },
  { key: 'Operations', value: '42' },
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

export function ContractHubPage() {
  useDocumentTitle('Contract Testing')
  const [facet, setFacet] = useState<'all' | ContractHubFacet>('all')
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

  const visible = useMemo(
    () => (facet === 'all' ? CONTRACT_EXERCISES : CONTRACT_EXERCISES.filter((exercise) => exercise.facet === facet)),
    [facet],
  )

  const hunts = useMemo(
    () =>
      scenarios
        .filter((scenario) => scenario.huntId?.startsWith('hunt-contract-'))
        .sort((a, b) => (a.huntId ?? '').localeCompare(b.huntId ?? '')),
    [],
  )

  const bandProgress = useMemo(() => {
    const entries = progress?.hunts ?? []
    const byId = new Map(entries.map((entry) => [entry.huntId, entry]))
    const result = new Map<'beginner' | 'intermediate' | 'advanced', { done: number; total: number }>()
    for (const band of BANDS) {
      const bandExercises = CONTRACT_EXERCISES.filter((exercise) => exercise.difficulty === band.difficulty)
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
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Contract Testing' }]} />

      <PageHeader
        eyebrow="Learn · Contract testing"
        title="Contract Testing"
        description="Practise the promise-checking loop behind every API integration — validate payloads against the documented contract, diff contract versions for breaking changes, and verify consumer-driven expectations before your next release ships."
        actions={
          <Link className="button" to="/contract/validate">
            Open the validate workspace
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

      <div className="database-hub-grid">
        <section className="workspace-panel database-dataset-card" aria-labelledby="contract-dataset-title">
          <div className="workspace-head">
            <h2 id="contract-dataset-title" className="workspace-title">The practice contracts</h2>
            <span className="workspace-status workspace-status-ok">
              <span className="workspace-dot" aria-hidden="true" />
              Clean
            </span>
          </div>
          <div className="workspace-body">
            <p className="workspace-line">
              Six synthetic contracts: the live platform <code>/openapi.json</code> and the
              fictional <strong>Meridian Ledger</strong> payments sibling (v1 → v2 candidates,
              plus a products slice for consumer work). Deliberate drift is deterministic and
              scoped to bug-hunt mode.
            </p>
            <div className="workspace-facts">
              {FACTS.map((fact) => (
                <div key={fact.key} className="workspace-fact">
                  <span className="workspace-key">{fact.key}</span>
                  <span className="workspace-value">{fact.value}</span>
                </div>
              ))}
            </div>
            <p className="workspace-line database-dataset-note">
              All data is synthetic. The contract bug hunts activate only in your session —
              leaving the hunt restores clean behaviour everywhere immediately.
            </p>
          </div>
        </section>

        <section className="content-section database-howto" aria-labelledby="contract-howto-title">
          <h2 id="contract-howto-title" className="database-section-title">How to practice</h2>
          <ol className="database-steps">
            {HOW_STEPS.map((step, index) => (
              <li key={step.title} className="database-step">
                <span className="database-step-index" aria-hidden="true">{index + 1}</span>
                <span className="database-step-copy">
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="database-links">
            <Link className="button button-secondary" to="/tracks/contract-testing">
              The contract testing track
            </Link>
            <Link className="button button-ghost" to="/practice">
              See your bug hunts
            </Link>
          </div>
        </section>
      </div>

      <section className="content-section" aria-labelledby="contract-capabilities-title">
        <h2 id="contract-capabilities-title" className="database-section-title">The three capabilities</h2>
        <div className="contract-grid">
          <Link className="contract-capability-card" to="/contract/validate">
            <h3 className="contract-capability-title">A · API contract validation</h3>
            <p className="contract-capability-copy">
              Validate request or response payloads against a fixture — or the live
              /openapi.json — with assertion-level diagnostics (path, keyword, expected,
              actual).
            </p>
          </Link>
          <Link className="contract-capability-card" to="/contract/compare">
            <h3 className="contract-capability-title">B · Schema compatibility review</h3>
            <p className="contract-capability-copy">
              Diff Meridian Ledger v1 against a v2 candidate (or paste your own). Every
              change classified breaking / backward-compatible / review — with consumer
              and provider impact.
            </p>
          </Link>
          <Link className="contract-capability-card" to="/contract/consumer">
            <h3 className="contract-capability-title">C · Consumer-driven verification</h3>
            <p className="contract-capability-copy">
              Write the smallest expectation your consumer needs, watch the provider
              fixture pass — then swap to v2-latest and watch it fail. That is the
              whole technique.
            </p>
          </Link>
        </div>
      </section>

      <section className="content-section" aria-labelledby="contract-exercises-title">
        <div className="database-bands" aria-label="Your completion per difficulty">
          {BANDS.map((band) => {
            const bandTotal = bandProgress.get(band.difficulty)?.total ?? 0
            const bandDone = bandProgress.get(band.difficulty)?.done ?? 0
            return (
              <div key={band.difficulty} className="database-band">
                {progressState === 'ready' ? bandRing(bandDone, bandTotal) : <span className="band-ring band-ring-muted" aria-hidden="true" />}
                <div className="database-band-copy">
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
          <h2 id="contract-exercises-title" className="database-section-title">Exercises</h2>
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
        <ul className="contract-exercise-grid">
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <Link className="contract-exercise-card" to={`/contract/exercises/${exercise.id}`}>
                <div className="contract-exercise-card-top">
                  <Tag tone={exercise.difficulty === 'beginner' ? 'ready' : exercise.difficulty === 'intermediate' ? 'neutral' : 'warn'}>
                    {difficultyLabels[exercise.difficulty]}
                  </Tag>
                  <span className="contract-exercise-meta">{exercise.estimatedMinutes} min</span>
                </div>
                <h3 className="contract-exercise-title">{exercise.title}</h3>
                <p className="contract-exercise-summary">{exercise.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-section" aria-labelledby="contract-hunts-title">
        <div className="database-exercises-head">
          <h2 id="contract-hunts-title" className="database-section-title">Contract bug hunts</h2>
        </div>
        <ul className="contract-exercise-grid">
          {hunts.map((scenario) => (
            <li key={scenario.id}>
              <Link className="contract-exercise-card" to={`/scenarios/${scenario.id}`}>
                <div className="contract-exercise-card-top">
                  <Tag tone="neutral">Bug hunt</Tag>
                  <span className="contract-exercise-meta">{scenario.estimatedMinutes} min</span>
                </div>
                <h3 className="contract-exercise-title">{scenario.title}</h3>
                <p className="contract-exercise-summary">{scenario.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
