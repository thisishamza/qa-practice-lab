import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumbs } from '../../components/ui/PageChrome'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tag } from '../../components/ui/Tag'
import { Icon } from '../../components/ui/Icon'
import { scenarios } from '../../data/scenarios'
import { fetchProgress } from '../practice/api'
import { difficultyLabels } from '../../lib/labels'
import type { LabExerciseDef, LabDifficulty } from '../../data/labTypes'
import type { ProgressResponse } from '../../shared/learning'

const BANDS: readonly { difficulty: LabDifficulty; label: string; blurb: string }[] = [
  { difficulty: 'beginner', label: 'Beginner', blurb: 'Foundations — the vocabulary and the first measurements.' },
  { difficulty: 'intermediate', label: 'Intermediate', blurb: 'Applied work — attribution, interpretation and safe technique.' },
  { difficulty: 'advanced', label: 'Advanced', blurb: 'Judgement calls — triage, capacity and trade-off analysis.' },
]

export interface LabHubStep {
  title: string
  detail: string
}

export interface LabHubAction {
  to: string
  label: string
}

export interface LabHubProps {
  trackLabel: string
  title: string
  description: string
  facts: ReadonlyArray<{ key: string; value: string }>
  howSteps: readonly LabHubStep[]
  introPanel: ReactNode
  exercises: readonly LabExerciseDef[]
  facets: ReadonlyArray<{ id: 'all' | string; label: string }>
  exerciseBasePath: string
  /** Prefix used to discover this lab's wired bug-hunt scenarios. */
  huntScenarioPrefix: string
  /** Tag tone per difficulty passed through to cards. */
  guideLink: LabHubAction
  capabilitiesTitle: string
  capabilities: ReadonlyArray<{ to: string; title: string; copy: string }>
  trackLink: string
  primaryAction: LabHubAction
}

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

export function LabHub({
  trackLabel,
  title,
  description,
  facts,
  howSteps,
  introPanel,
  exercises,
  facets,
  exerciseBasePath,
  huntScenarioPrefix,
  guideLink,
  capabilitiesTitle,
  capabilities,
  trackLink,
  primaryAction,
}: LabHubProps) {
  const [facet, setFacet] = useState<string>('all')
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
    () => (facet === 'all' ? exercises : exercises.filter((exercise) => exercise.facet === facet)),
    [facet, exercises],
  )

  const hunts = useMemo(
    () =>
      scenarios
        .filter((scenario) => scenario.huntId?.startsWith(huntScenarioPrefix))
        .sort((a, b) => (a.huntId ?? '').localeCompare(b.huntId ?? '')),
    [huntScenarioPrefix],
  )

  const bandProgress = useMemo(() => {
    const entries = progress?.hunts ?? []
    const byId = new Map(entries.map((entry) => [entry.huntId, entry]))
    const result = new Map<LabDifficulty, { done: number; total: number }>()
    for (const band of BANDS) {
      const bandExercises = exercises.filter((exercise) => exercise.difficulty === band.difficulty)
      const done = bandExercises.filter((exercise) => {
        const entry = byId.get(exercise.id)
        return entry !== undefined && (entry.status === 'submitted' || (entry.bestScore ?? 0) >= 70)
      }).length
      result.set(band.difficulty, { done, total: bandExercises.length })
    }
    return result
  }, [progress, exercises])

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: title }]} />

      <PageHeader
        eyebrow={`Learn · ${trackLabel}`}
        className="lab-hub"
        title={title}
        description={description}
        actions={
          <Link className="button" to={primaryAction.to}>
            {primaryAction.label}
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

      <div className="database-hub-grid">
        <section className="workspace-panel database-dataset-card" aria-labelledby={`${exerciseBasePath.slice(1)}-brief-title`}>
          <div className="workspace-head">
            <h2 id={`${exerciseBasePath.slice(1)}-brief-title`} className="workspace-title">The environment</h2>
            <span className="workspace-status workspace-status-ok">
              <span className="workspace-dot" aria-hidden="true" />
              Clean
            </span>
          </div>
          <div className="workspace-body">
            {introPanel}
            <div className="workspace-facts">
              {facts.map((fact) => (
                <div key={fact.key} className="workspace-fact">
                  <span className="workspace-key">{fact.key}</span>
                  <span className="workspace-value">{fact.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="content-section database-howto" aria-labelledby={`${exerciseBasePath.slice(1)}-howto-title`}>
          <h2 id={`${exerciseBasePath.slice(1)}-howto-title`} className="database-section-title">How to practice</h2>
          <ol className="database-steps">
            {howSteps.map((step, index) => (
              <li key={step.title} className="database-step">
                <span className="database-step-index" aria-hidden="true">{index + 1}</span>
                <span className="database-step-copy">
                  <strong>{step.title}.</strong> {step.detail}
                </span>
              </li>
            ))}
          </ol>
          <div className="database-links">
            <Link className="button button-secondary" to={trackLink}>
              The track behind this lab
            </Link>
            <Link className="button button-ghost" to={guideLink.to}>
              {guideLink.label}
            </Link>
          </div>
        </section>
      </div>

      <section className="content-section" aria-labelledby={`${exerciseBasePath.slice(1)}-capabilities-title`}>
        <h2 id={`${exerciseBasePath.slice(1)}-capabilities-title`} className="database-section-title">{capabilitiesTitle}</h2>
        <div className="contract-grid">
          {capabilities.map((capability) => (
            <Link key={capability.to + capability.title} className="contract-capability-card" to={capability.to}>
              <h3 className="contract-capability-title">{capability.title}</h3>
              <p className="contract-capability-copy">{capability.copy}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="content-section" aria-labelledby={`${exerciseBasePath.slice(1)}-exercises-title`}>
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
          <h2 id={`${exerciseBasePath.slice(1)}-exercises-title`} className="database-section-title">Exercises</h2>
          <div className="filter-chips" role="group" aria-label="Filter exercises">
            {facets.map((entry) => (
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
              <Link className="contract-exercise-card" to={`${exerciseBasePath}/${exercise.id}`}>
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

      <section className="content-section" aria-labelledby={`${exerciseBasePath.slice(1)}-hunts-title`}>
        <div className="database-exercises-head">
          <h2 id={`${exerciseBasePath.slice(1)}-hunts-title`} className="database-section-title">Bug hunts</h2>
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
