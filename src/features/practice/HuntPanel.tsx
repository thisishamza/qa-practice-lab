// Bug-hunt controls for the /practice page (P3-M7, expanded in P3-M8).
//
// Learner-facing and honest: it lists the hunts from the server registry
// (GET /api/v1/practice/hunts), starts or resets them through the
// server-controlled activation flow, and never reveals what the defect is
// or where it lives. Defect ids never reach the browser. A hunt id is the
// only client-selectable value; the server re-validates everything else.

import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePracticeSession } from './usePracticeSession'
import { fetchPracticeHunts, fetchAttempt } from './api'
import { BugReportForm } from './BugReportForm'
import { HintLadder } from './HintLadder'
import { RevealPanel } from './RevealPanel'
import { AttemptStatusChip } from './AttemptStatusChip'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Tag } from '../../components/ui/Tag'
import { SectionHeader } from '../../components/ui/PageChrome'
import { scenarios } from '../../data/scenarios'
import { PracticeApiError } from './api'
import type { HuntSummary } from '../../shared/practice'
import type { AttemptView } from '../../shared/learning'

type HuntsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; hunts: HuntSummary[] }

export function HuntPanel() {
  const { loadState, mode, hunt, busy, actionError, startHunt, resetSession } =
    usePracticeSession()
  const [justStarted, setJustStarted] = useState(false)
  const [justReset, setJustReset] = useState(false)
  const [huntsState, setHuntsState] = useState<HuntsState>({ status: 'loading' })
  const [huntsAttempt, setHuntsAttempt] = useState(0)
  /** Attempt status per hunt id; 'unavailable' when the fetch fails. */
  const [statuses, setStatuses] = useState<Record<string, AttemptView | 'unavailable'>>({})
  const [statusNonce, setStatusNonce] = useState(0)
  const [revealNonce, setRevealNonce] = useState(0)
  const refreshStatuses = () => setStatusNonce((n) => n + 1)
  const refreshAfterReport = () => {
    setStatusNonce((n) => n + 1)
    setRevealNonce((n) => n + 1)
  }

  // Attempt-status chips for the hunt cards. Source of truth is the server;
  // any failure maps to an explicit "unavailable" placeholder, never a guess.
  useEffect(() => {
    if (huntsState.status !== 'ready') {
      return
    }
    const controller = new AbortController()
    Promise.all(
      huntsState.hunts.map(async (entry) => {
        try {
          const view = await fetchAttempt(entry.id, controller.signal)
          return [entry.id, view] as const
        } catch {
          return [entry.id, 'unavailable'] as const
        }
      }),
    ).then((pairs) => {
      if (controller.signal.aborted) {
        return
      }
      setStatuses(Object.fromEntries(pairs))
    })
    return () => controller.abort()
  }, [huntsState, statusNonce])

  useEffect(() => {
    const controller = new AbortController()
    fetchPracticeHunts(controller.signal)
      .then((hunts) => setHuntsState({ status: 'ready', hunts }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setHuntsState({
          status: 'error',
          message:
            error instanceof PracticeApiError
              ? error.message
              : 'The available hunts could not be loaded.',
        })
      })
    return () => controller.abort()
  }, [huntsAttempt])

  const bugHuntActive = mode === 'bug_hunt' && hunt !== null

  // The ModeBanner can change the mode from outside this component. Clear
  // any local "just started/reset" notice during render when the mode
  // changed (React-endorsed alternative to a setState-in-effect) so it
  // can't contradict the context.
  const [previousMode, setPreviousMode] = useState(mode)
  if (previousMode !== mode) {
    setPreviousMode(mode)
    setJustStarted(false)
    setJustReset(false)
  }

  return (
    <section className="content-section" aria-labelledby="bug-hunt-title">
      <SectionHeader
        id="bug-hunt-title"
        title="Bug-hunt mode"
        description="Practise against a deliberately broken shop. Defects are deterministic, scoped to your browser session, and never affect other learners."
        action={
          huntsState.status === 'ready' ? (
            <Tag tone="warn" icon="bug">
              {huntsState.hunts.length} hunt{huntsState.hunts.length === 1 ? '' : 's'} available
            </Tag>
          ) : undefined
        }
      />

      {loadState.status === 'error' ? (
        <p className="panel-note" role="alert">
          The practice mode could not be loaded. {loadState.message}
        </p>
      ) : (
        <div className="panel hunt-panel">
          <div className="hunt-panel-status">
            {bugHuntActive ? (
              <Tag tone="warn" icon="bug">
                Bug-hunt mode
              </Tag>
            ) : (
              <Tag tone="ready">Clean mode</Tag>
            )}
          </div>

          {huntsState.status === 'loading' ? (
            <p className="panel-note" role="status">
              Loading the available hunts…
            </p>
          ) : huntsState.status === 'error' ? (
            <div role="alert" className="hunt-panel-error">
              <p>
                <Icon name="alert" size={16} /> The available hunts could not be loaded.{' '}
                {huntsState.message}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setHuntsAttempt((n) => n + 1)}>
                <Icon name="reset" size={15} />
                Try again
              </Button>
            </div>
          ) : (
            <ul className="hunt-list" aria-label="Available bug-hunt exercises">
              {huntsState.hunts.map((entry) => {
                const isActive = bugHuntActive && hunt.id === entry.id
                const statusEntry = statuses[entry.id]
                const statusView =
                  statusEntry === undefined || statusEntry === 'unavailable' ? null : statusEntry
                const scenario = entry.scenarioId
                  ? scenarios.find((candidate) => candidate.id === entry.scenarioId)
                  : undefined
                return (
                  <li key={entry.id} className="hunt-row" aria-current={isActive ? 'true' : undefined}>
                    <div className="hunt-row-body">
                      <span className="hunt-row-title">
                        {isActive ? <Tag tone="warn" icon="bug">Active</Tag> : null}
                        {entry.title}
                        {statusEntry === undefined ? null : (
                          <AttemptStatusChip
                            status={statusView === null ? null : statusView.status}
                            bestQualityScore={statusView === null ? null : statusView.bestQualityScore}
                          />
                        )}
                      </span>
                      <span className="hunt-row-summary">{entry.summary}</span>
                      {scenario ? (
                        <Link className="hunt-row-link" to={`/scenarios/${scenario.id}`}>
                          Scenario: {scenario.title}
                          <Icon name="chevron-right" size={14} />
                        </Link>
                      ) : null}
                      {entry.id.startsWith('hunt-db-') ? (
                        <Link className="hunt-row-link" to="/database/playground">
                          Investigate in the SQL playground
                          <Icon name="chevron-right" size={14} />
                        </Link>
                      ) : null}
                    </div>
                    <div className="hunt-row-actions">
                      {isActive ? (
                        <Button
                          variant="secondary"
                          loading={busy === 'reset'}
                          onClick={() => {
                            void resetSession().then((ok) => {
                              if (ok) {
                                setJustReset(true)
                                setJustStarted(false)
                                refreshStatuses()
                              }
                            })
                          }}
                        >
                          <Icon name="reset" size={16} />
                          Reset to clean mode
                        </Button>
                      ) : (
                        <Button
                          loading={busy === 'start'}
                          variant={bugHuntActive ? 'secondary' : 'primary'}
                          onClick={() => {
                            void startHunt(entry.id).then((ok) => {
                              if (ok) {
                                setJustStarted(true)
                                setJustReset(false)
                                refreshStatuses()
                              }
                            })
                          }}
                        >
                          <Icon name="bug" size={16} />
                          {bugHuntActive ? 'Switch to this hunt' : 'Start this hunt'}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {bugHuntActive ? (
            <p className="panel-note">
              The defect is live for this browser session only — your cart, orders and sign-in
              are untouched. Resetting returns the shop to clean behaviour; your cart and orders
              are kept.
            </p>
          ) : (
            <p className="panel-note">
              Start a hunt to put the shop into a known-broken state. Work out what is wrong,
              collect evidence, then reset. Nothing about the hunt ever leaks into other
              sessions.
            </p>
          )}

          {justStarted ? (
            <p className="hunt-panel-success" role="status">
              <Icon name="check" size={16} />
              Bug-hunt mode is on for this browser. Open the{' '}
              <Link to="/shop">shop</Link> and start investigating.
            </p>
          ) : null}
          {justReset ? (
            <p className="hunt-panel-success" role="status">
              <Icon name="check" size={16} />
              Clean mode restored. The shop behaves as specified again.
            </p>
          ) : null}

          {actionError ? (
            <p className="hunt-panel-error" role="alert">
              <Icon name="alert" size={16} />
              {actionError}
            </p>
          ) : null}

          {bugHuntActive ? (
            <div className="learning-block" key={hunt.id}>
              <HintLadder huntId={hunt.id} />
              <div className="bug-report-block">
                <h3>File a report</h3>
                <BugReportForm huntId={hunt.id} onSubmitted={refreshAfterReport} />
              </div>
              <RevealPanel huntId={hunt.id} onRevealed={refreshStatuses} refreshToken={revealNonce} />
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
