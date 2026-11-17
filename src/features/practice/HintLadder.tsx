// Progressive hint ladder (P4-M2 WP3). Three levels, unlocked in order,
// rendered as accessible disclosures. The server is the source of truth:
// `hintsUsed` and the hint text both come from the hints endpoint, and the
// server enforces the ladder — this component never unlocks a level the
// server has not granted. Previously unlocked levels are re-fetched from the
// server on mount (the unlock endpoint is idempotent), so refreshing or
// continuing the session restores the ladder exactly as the server holds it.
//
// Accessibility: each unlocked level is a disclosure button with
// aria-expanded + aria-controls; locked levels are disabled buttons with a
// visible lock note and no content. The "N of 3 hints used" counter is a live
// region so unlocks are announced. One request is in flight at a time and
// every unlock control is disabled while it is.
//
// HintLadderView is exported so the markup states can be tested without a
// DOM; HintLadder is the state/effectful shell over it.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import {
  applyHintResponse,
  applyHintsUsed,
  buildLadder,
  createSingleFlight,
  learningErrorMessage,
  restoreLadder,
  unlockHint,
} from '../../lib/hintReveal'
import { requestHint, fetchAttempt } from './api'
import type { HintLevel } from '../../shared/learning'

type RestoreState = 'loading' | 'ready' | 'error'

export interface HintLadderViewProps {
  baseId: string
  hintsUsed: number
  texts: Partial<Record<HintLevel, string>>
  openLevels: Partial<Record<HintLevel, boolean>>
  unlocking: HintLevel | null
  restoreState: RestoreState
  restoreError: string | null
  levelErrors: Partial<Record<HintLevel, string>>
  onUnlock: (level: HintLevel) => void
  onToggle: (level: HintLevel) => void
  onRetryRestore: () => void
}

export function HintLadderView({
  baseId,
  hintsUsed,
  texts,
  openLevels,
  unlocking,
  restoreState,
  restoreError,
  levelErrors,
  onUnlock,
  onToggle,
  onRetryRestore,
}: HintLadderViewProps) {
  const busy = unlocking !== null || restoreState === 'loading'
  const ladder = buildLadder(hintsUsed, texts)

  return (
    <section className="hint-ladder" aria-labelledby={`${baseId}-title`}>
      <h3 id={`${baseId}-title`} className="hint-ladder-title">
        Need a hint?
      </h3>
      <p className="panel-note">
        Hints come in three levels and get progressively more specific. Unlock them in order —
        each level stays readable once unlocked, and the server decides what you can see.
      </p>

      <p className="hint-counter" role="status" aria-live="polite">
        {hintsUsed} of 3 hints used
      </p>

      {restoreState === 'error' ? (
        <div className="hunt-panel-error hint-restore-error" role="alert">
          <p>
            <Icon name="alert" size={16} /> {restoreError}
          </p>
          <Button variant="ghost" size="sm" onClick={onRetryRestore}>
            <Icon name="reset" size={16} />
            Try again
          </Button>
        </div>
      ) : null}

      <ol className="hint-list">
        {ladder.map(({ level, status, hint }) => {
          const panelId = `${baseId}-hint-${level}`
          const error = levelErrors[level]
          return (
            <li key={level} className={`hint-level hint-level-${status}`}>
              {status === 'locked' ? (
                <button type="button" className="hint-toggle" disabled>
                  <span className="hint-toggle-icon" aria-hidden="true">
                    <Icon name="lock" size={16} />
                  </span>
                  <span className="hint-toggle-body">
                    <span className="hint-toggle-label">Hint {level} — locked</span>
                    <span className="hint-toggle-note">Use hint {level - 1} first</span>
                  </span>
                </button>
              ) : status === 'available' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="hint-unlock"
                  disabled={busy}
                  loading={unlocking === level}
                  onClick={() => onUnlock(level)}
                  aria-describedby={error ? `${panelId}-error` : undefined}
                >
                  <Icon name="info" size={16} />
                  {unlocking === level ? `Unlocking hint ${level}…` : `Unlock hint ${level}`}
                </Button>
              ) : (
                <>
                  <button
                    type="button"
                    className="hint-toggle"
                    aria-expanded={openLevels[level] === true}
                    aria-controls={panelId}
                    onClick={() => onToggle(level)}
                  >
                    <span className="hint-toggle-icon" aria-hidden="true">
                      <Icon name="check" size={16} />
                    </span>
                    <span className="hint-toggle-body">
                      <span className="hint-toggle-label">Hint {level}</span>
                      <span className="hint-toggle-note">
                        {openLevels[level] ? 'Hide this hint' : 'Show this hint'}
                      </span>
                    </span>
                    <span className="hint-toggle-chevron" aria-hidden="true">
                      <Icon name="chevron-down" size={16} />
                    </span>
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-label={`Hint ${level}`}
                    className="hint-panel"
                    hidden={openLevels[level] !== true}
                  >
                    {hint ?? (
                      <span className="hint-panel-pending">Loading this hint from the server…</span>
                    )}
                  </div>
                </>
              )}
              {error ? (
                <p className="report-field-error hint-level-error" id={`${panelId}-error`} role="alert">
                  {error}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
      {restoreState === 'loading' ? (
        <p className="panel-note" role="status">
          Checking which hints you have used…
        </p>
      ) : null}
    </section>
  )
}

export function HintLadder({ huntId }: { huntId: string }) {
  const [restoreState, setRestoreState] = useState<RestoreState>('loading')
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [texts, setTexts] = useState<Partial<Record<HintLevel, string>>>({})
  const [openLevels, setOpenLevels] = useState<Partial<Record<HintLevel, boolean>>>({ 1: true })
  const [unlocking, setUnlocking] = useState<HintLevel | null>(null)
  const [levelErrors, setLevelErrors] = useState<Partial<Record<HintLevel, string>>>({})
  const flightRef = useRef(createSingleFlight())
  const mountedRef = useRef(true)
  const baseId = useId()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const restore = useCallback(() => {
    if (!flightRef.current.tryAcquire()) {
      return Promise.resolve()
    }
    return restoreLadder({ huntId, fetchAttempt, requestHint })
      .then((result) => {
        if (!mountedRef.current) return
        setHintsUsed(result.hintsUsed)
        setTexts(result.texts)
        setRestoreState('ready')
      })
      .catch((error: unknown) => {
        if (!mountedRef.current) return
        setRestoreError(learningErrorMessage(error, 'hint'))
        setRestoreState('error')
      })
      .finally(() => {
        flightRef.current.release()
      })
  }, [huntId])

  useEffect(() => {
    void restore()
  }, [restore])

  function retryRestore() {
    setRestoreState('loading')
    setRestoreError(null)
    void restore()
  }

  async function unlock(level: HintLevel) {
    if (!flightRef.current.tryAcquire()) {
      return
    }
    setUnlocking(level)
    setLevelErrors((prev) => {
      if (!prev[level]) return prev
      const next = { ...prev }
      delete next[level]
      return next
    })
    try {
      const outcome = await unlockHint({ huntId, level, request: requestHint })
      if (!mountedRef.current) {
        return
      }
      if (outcome.kind === 'failure') {
        // Never unlock on failure; surface a learner-safe message instead.
        setLevelErrors((prev) => ({ ...prev, [level]: outcome.message }))
        return
      }
      setTexts((prev) => applyHintResponse(prev, outcome.response))
      setHintsUsed((prev) => applyHintsUsed(prev, outcome.response))
      setOpenLevels((prev) => ({ ...prev, [level]: true }))
    } finally {
      flightRef.current.release()
      if (mountedRef.current) {
        setUnlocking(null)
      }
    }
  }

  function toggle(level: HintLevel) {
    setOpenLevels((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  return (
    <HintLadderView
      baseId={baseId}
      hintsUsed={hintsUsed}
      texts={texts}
      openLevels={openLevels}
      unlocking={unlocking}
      restoreState={restoreState}
      restoreError={restoreError}
      levelErrors={levelErrors}
      onUnlock={(level) => void unlock(level)}
      onToggle={toggle}
      onRetryRestore={retryRestore}
    />
  )
}
