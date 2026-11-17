// Gated solution reveal (P4-M2 WP3). "Show the solution" is the give-up
// path: it always asks for explicit confirmation through an accessible
// WAI-modal dialog before any request is made. The server is the only
// authority on whether the reveal exists — this component renders reveal
// content only when the server returns it (via GET after authorization, or
// via the POST give-up response). A 403 leaves the panel locked with no
// content of any kind.
//
// Accessibility: the dialog traps focus, closes on Escape and restores
// focus to the trigger on close; cancel makes no request. After a
// user-initiated reveal, focus moves to the revealed panel's heading.
// The reveal payload is never cached in browser storage.
//
// RevealPanelView is exported so the locked/revealed markup states can be
// tested without a DOM; RevealPanel is the state/effectful shell over it.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Icon } from '../../components/ui/Icon'
import { Modal } from '../../components/ui/Modal'
import { createSingleFlight, confirmGiveUpFlow, fetchRevealFlow } from '../../lib/hintReveal'
import { fetchReveal, giveUpAndReveal } from './api'
import type { RefObject } from 'react'
import type { RevealResponse } from '../../shared/learning'

export type RevealState =
  | { phase: 'loading' }
  | { phase: 'locked' }
  | { phase: 'error'; message: string }
  | { phase: 'revealed'; reveal: RevealResponse }

export interface RevealPanelViewProps {
  baseId: string
  state: RevealState
  dialogOpen: boolean
  giveUpError: string | null
  giveUpInFlight: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  cancelRef: RefObject<HTMLButtonElement | null>
  onRetry: () => void
  onOpenDialog: () => void
  onCancelGiveUp: () => void
  onConfirmGiveUp: () => void
}

export function RevealPanelView({
  baseId,
  state,
  dialogOpen,
  giveUpError,
  giveUpInFlight,
  headingRef,
  cancelRef,
  onRetry,
  onOpenDialog,
  onCancelGiveUp,
  onConfirmGiveUp,
}: RevealPanelViewProps) {
  return (
    <section className="reveal-panel" aria-labelledby={`${baseId}-title`}>
      <h3 id={`${baseId}-title`} ref={headingRef} tabIndex={-1} className="reveal-panel-title">
        The solution
      </h3>

      {state.phase === 'loading' ? (
        <p className="panel-note" role="status">
          Checking whether the solution is available…
        </p>
      ) : null}

      {state.phase === 'error' ? (
        <div className="hunt-panel-error" role="alert">
          <p>
            <Icon name="alert" size={16} /> {state.message}
          </p>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <Icon name="reset" size={16} />
            Try again
          </Button>
        </div>
      ) : null}

      {state.phase === 'locked' ? (
        <>
          <Callout tone="info" title="Still locked">
            The solution stays hidden until this attempt is finished — submit a bug report, or
            give up on this attempt, and it will unlock. Giving up ends your investigation and
            does not count as discovering the defect.
          </Callout>
          <div className="button-row">
            <Button variant="secondary" onClick={onOpenDialog}>
              <Icon name="book" size={16} />
              Show the solution
            </Button>
          </div>
        </>
      ) : null}

      {state.phase === 'revealed' ? <RevealContent reveal={state.reveal} /> : null}

      <Modal
        open={dialogOpen}
        title="Show the solution?"
        description="Revealing the solution ends your investigation for this attempt. It does not count as discovering the defect — your report score, best score and discovery status are left unchanged."
        onClose={onCancelGiveUp}
        initialFocusRef={cancelRef}
      >
        {giveUpError ? (
          <Callout tone="danger" title="The solution could not be revealed">
            <span role="alert">{giveUpError}</span>
          </Callout>
        ) : null}
        <div className="modal-actions">
          <Button ref={cancelRef} variant="secondary" onClick={onCancelGiveUp} disabled={giveUpInFlight}>
            Keep investigating
          </Button>
          <Button
            variant="danger"
            onClick={onConfirmGiveUp}
            loading={giveUpInFlight}
            disabled={giveUpInFlight}
          >
            <Icon name="book" size={16} />
            {giveUpInFlight ? 'Revealing…' : 'Show the solution'}
          </Button>
        </div>
      </Modal>
    </section>
  )
}

export function RevealPanel({
  huntId,
  onRevealed,
  refreshToken,
}: {
  huntId: string
  /** Called after a reveal is granted (give-up or refresh) so attempt-status chips can refresh. */
  onRevealed?: () => void
  /** Bumped by the parent after a successful report submission so the panel re-checks eligibility. */
  refreshToken?: number
}) {
  const [state, setState] = useState<RevealState>({ phase: 'loading' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [giveUpError, setGiveUpError] = useState<string | null>(null)
  const [giveUpInFlight, setGiveUpInFlight] = useState(false)
  const flightRef = useRef(createSingleFlight())
  const cancelRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusHeadingAfterReveal = useRef(false)
  const mountedRef = useRef(true)
  const baseId = useId()

  // No state updates after unmount; the abort guard only covers callers
  // that pass a signal (the retry path passes none).
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadReveal = useCallback(
    (signal?: AbortSignal) => {
      if (signal?.aborted) {
        return Promise.resolve()
      }
      return fetchRevealFlow({ huntId, fetchReveal: () => fetchReveal(huntId, signal) }).then(
        (outcome) => {
          if (signal?.aborted || !mountedRef.current) {
            return
          }
          if (outcome.kind === 'revealed') {
            setState({ phase: 'revealed', reveal: outcome.reveal })
          } else if (outcome.kind === 'locked') {
            setState({ phase: 'locked' })
          } else {
            setState({ phase: 'error', message: outcome.message })
          }
        },
      )
    },
    [huntId],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadReveal(controller.signal)
    return () => controller.abort()
  }, [loadReveal, refreshToken])

  // Move focus to the revealed heading after a user-initiated give-up.
  useEffect(() => {
    if (state.phase === 'revealed' && focusHeadingAfterReveal.current) {
      focusHeadingAfterReveal.current = false
      headingRef.current?.focus()
    }
  }, [state])

  function openDialog() {
    setGiveUpError(null)
    setDialogOpen(true)
  }

  function cancelGiveUp() {
    // While the give-up request is in flight the dialog stays open; dismissing
    // it would look like the give-up never happened when it lands moments later.
    if (giveUpInFlight) {
      return
    }
    setDialogOpen(false)
    setGiveUpError(null)
  }

  async function confirmGiveUp() {
    if (!flightRef.current.tryAcquire()) {
      return
    }
    setGiveUpInFlight(true)
    setGiveUpError(null)
    try {
      const outcome = await confirmGiveUpFlow({ giveUp: () => giveUpAndReveal(huntId) })
      if (outcome.kind === 'failure') {
        if (mountedRef.current) {
          setGiveUpError(outcome.message)
        }
        return
      }
      focusHeadingAfterReveal.current = true
      if (mountedRef.current) {
        setDialogOpen(false)
        setState({ phase: 'revealed', reveal: outcome.reveal })
        onRevealed?.()
      }
    } finally {
      flightRef.current.release()
      if (mountedRef.current) {
        setGiveUpInFlight(false)
      }
    }
  }

  return (
    <RevealPanelView
      baseId={baseId}
      state={state}
      dialogOpen={dialogOpen}
      giveUpError={giveUpError}
      giveUpInFlight={giveUpInFlight}
      headingRef={headingRef}
      cancelRef={cancelRef}
      onRetry={() => {
        setState({ phase: 'loading' })
        void loadReveal()
      }}
      onOpenDialog={openDialog}
      onCancelGiveUp={cancelGiveUp}
      onConfirmGiveUp={() => void confirmGiveUp()}
    />
  )
}

function RevealContent({ reveal }: { reveal: RevealResponse }) {
  const gaveUp = reveal.attempt.status === 'revealed'
  return (
    <div className="reveal-content">
      <Callout
        tone={gaveUp ? 'warning' : 'info'}
        title={gaveUp ? 'Revealed — give-up' : 'Revealed — report submitted'}
      >
        {gaveUp ? (
          <>
            You gave up on this attempt, so the solution is shown below. A reveal is not a
            discovery — it does not mark this exercise as found, and any report you submit
            afterwards keeps your score but can never change that this reveal happened.
          </>
        ) : (
          <>
            You submitted a report for this attempt. Your evaluation and any discovery credit
            are kept exactly as the server recorded them — the solution below is for comparison,
            not a reset.
          </>
        )}
      </Callout>

      <p className="reveal-framing">
        This exercise is complete for you now. Review the reasoning; if you want the practice
        back, reset the shop and the exercise starts fresh — the solution stays hidden until
        the next reveal is earned.
      </p>

      <dl className="reveal-facts">
        <div className="reveal-fact">
          <dt>Expected behaviour</dt>
          <dd>{reveal.expected}</dd>
        </div>
        <div className="reveal-fact">
          <dt>Actual behaviour</dt>
          <dd>{reveal.actual}</dd>
        </div>
        <div className="reveal-fact">
          <dt>Root cause</dt>
          <dd>{reveal.rootCause}</dd>
        </div>
      </dl>

      <div className="reveal-section">
        <h4>Reproduction steps</h4>
        <ol>
          {reveal.reproduction.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="reveal-section">
        <h4>How to verify the fix</h4>
        <ol>
          {reveal.verification.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="reveal-section">
        <h4>Concepts you practiced</h4>
        <ul>
          {reveal.concepts.map((concept, index) => (
            <li key={index}>{concept}</li>
          ))}
        </ul>
      </div>

      <div className="reveal-section">
        <h4>Common wrong turns</h4>
        <ul>
          {reveal.commonMisconceptions.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
