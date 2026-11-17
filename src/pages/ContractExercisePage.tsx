import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { findContractExercise, type ContractExerciseDef } from '../data/contractExercises'
import { startContractExercise, evaluateContract, verifyConsumer } from '../features/contract/api'
import { fetchAttempt, PracticeApiError } from '../features/practice/api'
import { HintLadder } from '../features/practice/HintLadder'
import { RevealPanel } from '../features/practice/RevealPanel'
import { AttemptStatusChip } from '../features/practice/AttemptStatusChip'
import type { AttemptView, AttemptStatusView } from '../shared/learning'
import type { ContractEvaluateAnswer } from '../shared/contractApi'

const CLASSIFICATIONS = ['breaking', 'compatible', 'review'] as const

function attemptFromView(view: AttemptView | null): { status: AttemptStatusView | null; bestScore: number | null } {
  if (!view) return { status: null, bestScore: null }
  if (view.status === 'none') return { status: 'none', bestScore: null }
  return { status: view.status, bestScore: view.bestQualityScore }
}

function ExpectationEditor({
  answer,
  setAnswer,
}: {
  exercise: ContractExerciseDef
  answer: ContractEvaluateAnswer
  setAnswer: (next: ContractEvaluateAnswer) => void
}) {
  // The consumer exercise ships a deliberately empty scaffold; the learner
  // fills it in — the C1–C7 rubric grades the result server-side.
  const text = answer.kind === 'consumer' ? JSON.stringify(answer.expectation, null, 2) : ''
  const [verifyState, setVerifyState] = useState<'idle' | 'checking' | 'done' | 'error'>('idle')
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; mismatchSummary?: string } | null>(null)
  return (
    <div className="stack">
      <label className="contract-field">
        <span className="contract-field-label">Expectation (JSON Schema)</span>
        <textarea
          className="contract-textarea"
          aria-label="Expectation (JSON Schema)"
          spellCheck={false}
          value={text}
          onChange={(event) => {
            try {
              setAnswer({ kind: 'consumer', expectation: JSON.parse(event.target.value) })
            } catch {
              setAnswer({ kind: 'consumer', expectation: {} })
            }
          }}
        />
      </label>
      <div className="button-row">
        <button
          type="button"
          className="button button-secondary"
          disabled={verifyState === 'checking'}
          onClick={() => {
            setVerifyState('checking')
            setVerifyResult(null)
            verifyConsumer({
              expectation: answer.kind === 'consumer' ? answer.expectation : {},
              providerFixtureId: 'provider-product-v1',
            })
              .then((response) => {
                setVerifyResult(response)
                setVerifyState('done')
              })
              .catch(() => setVerifyState('error'))
          }}
        >
          {verifyState === 'checking' ? 'Verifying…' : 'Verify against the provider fixture'}
        </button>
      </div>
      {verifyResult ? (
        <p className="panel-note" role="status">
          {verifyResult.valid
            ? 'The expectation holds against provider-product-v1.'
            : `Fails the provider fixture: ${verifyResult.mismatchSummary ?? 'see the assertion list'}.`}
        </p>
      ) : null}
      {verifyState === 'error' ? (
        <p className="contract-inline-error" role="alert">
          <Icon name="alert" size={16} /> The verification request failed.
        </p>
      ) : null}
    </div>
  )
}

function AnswerPanel({
  exercise,
  answer,
  setAnswer,
  payloadText,
  setPayloadText,
}: {
  exercise: ContractExerciseDef
  answer: ContractEvaluateAnswer
  setAnswer: (next: ContractEvaluateAnswer) => void
  payloadText: string
  setPayloadText: (text: string) => void
}) {
  const { kind } = exercise

  // --- selections-driven kinds (structured + single-stage validate) -----------
  if (kind === 'structured' || (kind === 'validate' && !exercise.payloadFix)) {
    const selections = 'selections' in answer && Array.isArray(answer.selections) ? answer.selections : []
    const toggle = (id: string) => {
      const next = selections.includes(id)
        ? selections.filter((entry) => entry !== id)
        : [...selections, id]
      setAnswer({ kind: kind === 'structured' ? 'structured' : 'validate', selections: next })
    }
    return (
      <div className="checklist" role="group" aria-label="Select every option that applies">
        {exercise.checklist?.map((item) => (
          <button
            key={item.id}
            type="button"
            className="checklist-item"
            aria-pressed={selections.includes(item.id)}
            onClick={() => toggle(item.id)}
          >
            <Icon name={selections.includes(item.id) ? 'check' : 'grid'} size={15} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    )
  }

  // --- two-stage validate (selections + corrected payload) --------------------
  if (kind === 'validate' && exercise.payloadFix) {
    const validateAnswer = answer.kind === 'validate' ? answer : { kind: 'validate' as const, selections: [] }
    const selections = validateAnswer.selections ?? []
    const toggle = (id: string) => {
      const next = selections.includes(id)
        ? selections.filter((entry) => entry !== id)
        : [...selections, id]
      setAnswer({ ...validateAnswer, selections: next })
    }
    return (
      <div className="stack">
        {exercise.checklist ? (
          <>
            <p className="panel-note"><strong>Stage 1</strong> — select the assertion(s) that fire:</p>
            <div className="checklist" role="group" aria-label="Select the assertion(s) that fire">
              {exercise.checklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="checklist-item"
                  aria-pressed={selections.includes(item.id)}
                  onClick={() => toggle(item.id)}
                >
                  <Icon name={selections.includes(item.id) ? 'check' : 'grid'} size={15} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <p className="panel-note"><strong>Stage 2</strong> — submit the corrected payload (JSON):</p>
        <textarea
          className="contract-textarea"
          aria-label="Corrected payload"
          spellCheck={false}
          value={payloadText}
          onChange={(event) => {
            const value = event.target.value
            setPayloadText(value)
            try {
              const parsed = JSON.parse(value || '{}') as Record<string, unknown>
              setAnswer({ ...validateAnswer, payload: parsed })
            } catch {
              setAnswer({ ...validateAnswer })
            }
          }}
        />
      </div>
    )
  }

  // --- compare -----------------------------------------------------------------
  if (kind === 'compare') {
    const compareAnswer =
      answer.kind === 'compare' ? answer : { kind: 'compare' as const, classifications: {}, choices: {} }
    const classifications = compareAnswer.classifications
    const graded = exercise.grade?.classifications ?? []
    const choiceTarget = exercise.grade?.choiceTarget
    const choiceOptions = exercise.grade?.choiceOptions ?? []
    const classificationLabel = (id: string) => exercise.findings?.find((finding) => finding.id === id)?.label ?? id
    return (
      <div className="compare-findings-form">
        {graded.map((id) => {
          const current = classifications[id] ?? ''
          return (
            <div key={id} className="compare-finding-row">
              <div>
                <code className="finding-path">{id}</code>
                <p className="finding-change">{classificationLabel(id)}</p>
              </div>
              <label className="contract-field">
                <span className="contract-field-label">Verdict</span>
                <select
                  id={`classify-${id}`}
                  className="contract-select"
                  value={current}
                  onChange={(event) => {
                    const value = event.target.value
                    const next = { ...classifications }
                    if (value === '') {
                      delete next[id]
                    } else {
                      next[id] = value
                    }
                    setAnswer({ ...compareAnswer, classifications: next })
                  }}
                >
                  <option value="">Choose…</option>
                  {CLASSIFICATIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )
        })}
        {choiceTarget && choiceOptions.length > 0 ? (
          <fieldset className="contract-field">
            <legend className="contract-field-label">Consumer impact</legend>
            {choiceOptions.map((id) => {
              const label = exercise.findings?.find((finding) => finding.id === id)?.label ?? id
              return (
                <label key={id} className="checklist-item" style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="choice"
                    checked={(compareAnswer.choices ?? {})[choiceTarget] === id}
                    onChange={() => setAnswer({ ...compareAnswer, choices: { ...(compareAnswer.choices ?? {}), [choiceTarget]: id } })}
                  />
                  <span>{label}</span>
                </label>
              )
            })}
          </fieldset>
        ) : null}
      </div>
    )
  }

  // --- consumer -----------------------------------------------------------------
  return <ExpectationEditor exercise={exercise} answer={answer} setAnswer={setAnswer} />
}

export function ContractExercisePage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const exercise = exerciseId ? findContractExercise(exerciseId) : undefined
  useDocumentTitle(exercise ? `Contract exercise · ${exercise.title}` : 'Exercise not found')

  const [answer, setAnswer] = useState<ContractEvaluateAnswer>(() => {
    if (!exercise) return { kind: 'structured', selections: [] }
    if (exercise.kind === 'compare') {
      return { kind: 'compare', classifications: {}, choices: {} }
    }
    if (exercise.kind === 'consumer') {
      return {
        kind: 'consumer',
        expectation: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          required: ['slug', 'name', 'priceCents', 'currency', 'stockStatus'],
          properties: {},
        },
      }
    }
    if (exercise.kind === 'structured') return { kind: 'structured', selections: [] }
    return exercise.starterPayload
      ? { kind: 'validate', selections: [], payload: exercise.starterPayload }
      : { kind: 'validate', selections: [] }
  })

  const [attempt, setAttempt] = useState<{ status: AttemptStatusView | null; bestScore: number | null }>({ status: null, bestScore: null })
  const [payloadText, setPayloadText] = useState(() => (exercise?.starterPayload ? JSON.stringify(exercise.starterPayload, null, 2) : '{}'))
  const [evaluating, setEvaluating] = useState(false)
  const [result, setResult] = useState<{
    passed: boolean
    score: number
    feedback: string
    checks: { id: string; passed: boolean; message: string; points: number }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revealToken, setRevealToken] = useState(0)

  useEffect(() => {
    if (!exercise) return
    const controller = new AbortController()
    startContractExercise(exercise.id)
      .then(() => fetchAttempt(exercise.id, controller.signal))
      .then((view) => setAttempt(attemptFromView(view)))
      .catch(() => setAttempt({ status: null, bestScore: null }))
    return () => controller.abort()
  }, [exercise])

  useEffect(() => {
    // Re-sync the attempt after a reveal give-up.
    if (!exercise) return
    const controller = new AbortController()
    fetchAttempt(exercise.id, controller.signal)
      .then((view) => setAttempt(attemptFromView(view)))
      .catch(() => setAttempt({ status: null, bestScore: null }))
    return () => controller.abort()
  }, [exercise, revealToken])

  const onCheckWork = useCallback(async () => {
    if (!exercise) return
    setEvaluating(true)
    setError(null)
    setResult(null)
    try {
      const response = await evaluateContract({ exerciseId: exercise.id, answer })
      setResult({
        passed: response.passed,
        score: response.score,
        feedback: response.feedback,
        checks: response.checks,
      })
      setRevealToken((n) => n + 1)
      const view = await fetchAttempt(exercise.id)
      setAttempt(attemptFromView(view))
    } catch (caught) {
      if (caught instanceof PracticeApiError) {
        setError(caught.message)
      } else {
        setError('The answer could not be evaluated. Try again.')
      }
    } finally {
      setEvaluating(false)
    }
  }, [answer, exercise])

  if (!exercise) {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Contract Testing', to: '/contract' },
            { label: 'Not found' },
          ]}
        />
        <EmptyState
          title="No such contract exercise"
          description="The link may be outdated. The full catalogue lives on the contract hub."
          icon="contract"
          action={<Link className="button" to="/contract">Back to the contract hub</Link>}
        />
      </div>
    )
  }

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Contract Testing', to: '/contract' },
          { label: exercise.title },
        ]}
      />
      <PageHeader
        eyebrow={`Practice · ${exercise.difficulty} · ${exercise.estimatedMinutes} min`}
        title={exercise.title}
        description={exercise.summary}
      />

      <div className="contract-exercise-layout">
        <section className="workspace-panel" aria-labelledby="exercise-brief-title">
          <div className="workspace-head">
            <h2 id="exercise-brief-title" className="workspace-title">Brief</h2>
            <AttemptStatusChip status={attempt.status} bestQualityScore={attempt.bestScore} />
          </div>
          <div className="workspace-body">
            <p className="body-copy">{exercise.qaScenario}</p>
            <p className="panel-note"><strong>Your task</strong> — {exercise.task}</p>
            <div className="contract-chips">
              {exercise.chips.map((chip) => (
                <span key={chip} className="chip">{chip}</span>
              ))}
            </div>
            <p className="panel-note"><strong>Evidence</strong> — {exercise.exampleEvidence}</p>
          </div>
        </section>

        <section className="workspace-panel" aria-labelledby="exercise-answer-title">
          <div className="workspace-head">
            <h2 id="exercise-answer-title" className="workspace-title">Your answer</h2>
          </div>
          <div className="workspace-body">
            <AnswerPanel exercise={exercise} answer={answer} setAnswer={setAnswer} payloadText={payloadText} setPayloadText={setPayloadText} />
            {error ? (
              <p className="contract-inline-error" role="alert"><Icon name="alert" size={16} /> {error}</p>
            ) : null}
            <div className="button-row">
              <button type="button" className="button" onClick={onCheckWork} disabled={evaluating}>
                {evaluating ? 'Checking…' : 'Check work'}
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  setAnswer(initialAnswerFor(exercise))
                  setPayloadText(exercise.starterPayload ? JSON.stringify(exercise.starterPayload, null, 2) : '{}')
                }}
              >
                Reset
              </button>
            </div>
            {result ? (
              <>
                <p className={`callout ${result.passed ? 'callout-success' : 'callout-warning'}`} role="status">
                  <span className="callout-text">
                    {result.passed
                      ? `Passed — ${result.score}/100. ${result.feedback}`
                      : `Not yet — ${result.score}/100. ${result.feedback}`}
                  </span>
                </p>
                <ul className="checklist" aria-label="Per-check results">
                  {result.checks.map((check) => (
                    <li key={check.id} className="checklist-item" aria-pressed={check.passed}>
                      <Icon name={check.passed ? 'check' : 'alert'} size={15} />
                      <span>
                        <strong>{check.id}</strong> — {check.points} pts — {check.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </section>
      </div>

      <HintLadder huntId={exercise.id} />
      <RevealPanel huntId={exercise.id} onRevealed={() => setRevealToken((n) => n + 1)} refreshToken={revealToken} />
    </div>
  )
}

function initialAnswerFor(exercise: ContractExerciseDef): ContractEvaluateAnswer {
  if (exercise.kind === 'compare') return { kind: 'compare', classifications: {}, choices: {} }
  if (exercise.kind === 'consumer') {
    return {
      kind: 'consumer',
      expectation: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        required: ['slug', 'name', 'priceCents', 'currency', 'stockStatus'],
        properties: {},
      },
    }
  }
  if (exercise.kind === 'structured') return { kind: 'structured', selections: [] }
  return exercise.starterPayload
    ? { kind: 'validate', selections: [], payload: exercise.starterPayload }
    : { kind: 'validate', selections: [] }
}
