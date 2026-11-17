import { useCallback, useEffect, useState } from 'react'
import { fetchAttempt, PracticeApiError } from '../practice/api'
import { HintLadder } from '../practice/HintLadder'
import { RevealPanel } from '../practice/RevealPanel'
import { AttemptStatusChip } from '../practice/AttemptStatusChip'
import { Icon } from '../../components/ui/Icon'
import type { AttemptStatusView, AttemptView } from '../../shared/learning'
import type { LabExerciseDef } from '../../data/labTypes'
import { evaluateLab, startLabExercise, type LabEvaluateResponse } from './api'

function attemptFromView(view: AttemptView | null): { status: AttemptStatusView | null; bestScore: number | null } {
  if (!view) return { status: null, bestScore: null }
  if (view.status === 'none') return { status: 'none', bestScore: null }
  return { status: view.status, bestScore: view.bestQualityScore }
}

export function LabExerciseWorkspace({ exercise }: { exercise: LabExerciseDef }) {
  const [selections, setSelections] = useState<string[]>([])
  const [attempt, setAttempt] = useState<{ status: AttemptStatusView | null; bestScore: number | null }>({
    status: null,
    bestScore: null,
  })
  const [evaluating, setEvaluating] = useState(false)
  const [result, setResult] = useState<Pick<LabEvaluateResponse, 'passed' | 'score' | 'feedback' | 'checks'> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revealToken, setRevealToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    startLabExercise(exercise.id)
      .then(() => fetchAttempt(exercise.id, controller.signal))
      .then((view) => {
        if (!cancelled) setAttempt(attemptFromView(view))
      })
      .catch(() => {
        if (!cancelled) setAttempt({ status: null, bestScore: null })
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [exercise])

  useEffect(() => {
    // Re-sync the attempt chip after a reveal give-up or check-work.
    const controller = new AbortController()
    fetchAttempt(exercise.id, controller.signal)
      .then((view) => setAttempt(attemptFromView(view)))
      .catch(() => setAttempt({ status: null, bestScore: null }))
    return () => controller.abort()
  }, [exercise, revealToken])

  const toggle = useCallback((id: string) => {
    setSelections((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
    setResult(null)
  }, [])

  const onCheckWork = useCallback(async () => {
    setEvaluating(true)
    setError(null)
    setResult(null)
    try {
      const response = await evaluateLab(exercise.id, selections)
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
      setError(caught instanceof PracticeApiError ? caught.message : 'The answer could not be evaluated. Try again.')
    } finally {
      setEvaluating(false)
    }
  }, [exercise, selections])

  return (
    <div className="stack">
      <div className="contract-exercise-layout">
        <section className="workspace-panel" aria-labelledby="exercise-brief-title">
          <div className="workspace-head">
            <h2 id="exercise-brief-title" className="workspace-title">Brief</h2>
            <AttemptStatusChip status={attempt.status} bestQualityScore={attempt.bestScore} />
          </div>
          <div className="workspace-body">
            <p className="body-copy">{exercise.qaScenario}</p>
            <p className="panel-note"><strong>Objective</strong> — {exercise.objective}</p>
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
            <div className="checklist" role="group" aria-label="Select every option that applies">
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
            {error ? (
              <p className="contract-inline-error" role="alert"><Icon name="alert" size={16} /> {error}</p>
            ) : null}
            <div className="button-row">
              <button type="button" className="button" onClick={onCheckWork} disabled={evaluating || selections.length === 0}>
                {evaluating ? 'Checking…' : 'Check work'}
              </button>
              <button type="button" className="button button-ghost" onClick={() => { setSelections([]); setResult(null); setError(null) }}>
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
