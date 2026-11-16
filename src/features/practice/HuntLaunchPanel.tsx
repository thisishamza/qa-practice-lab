// Launch panel for the Phase 3 hunt scenarios (P3-M8). Shown on the scenario
// detail page in place of the "not runnable yet" callout. It loads the hunt
// summary from the server registry (the source of truth), then starts or
// resets the exercise through the shared server-controlled activation flow —
// never from a client-supplied id. No defect ids, hints or solutions reach
// the browser.

import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Scenario } from '../../data/types'
import { fetchPracticeHunts } from './api'
import { PracticeApiError } from './api'
import type { HuntSummary } from '../../shared/practice'
import { usePracticeSession } from './usePracticeSession'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Tag } from '../../components/ui/Tag'
import { BugReportForm } from './BugReportForm'
import { HintLadder } from './HintLadder'
import { RevealPanel } from './RevealPanel'

export function HuntLaunchPanel({ scenario }: { scenario: Scenario }) {
  const { loadState, mode, hunt, busy, actionError, startHunt, resetSession } =
    usePracticeSession()
  const [huntState, setHuntState] = useState<
    { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; hunt: HuntSummary } | { status: 'missing' }
  >({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchPracticeHunts(controller.signal)
      .then((hunts) => {
        const match = scenario.huntId ? hunts.find((entry) => entry.id === scenario.huntId) : undefined
        setHuntState(match ? { status: 'ready', hunt: match } : { status: 'missing' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setHuntState({
          status: 'error',
          message:
            error instanceof PracticeApiError
              ? error.message
              : 'The exercise could not be loaded.',
        })
      })
    return () => controller.abort()
  }, [scenario.huntId, attempt])

  const activeThisHunt = mode === 'bug_hunt' && hunt?.id === scenario.huntId
  const [reportNonce, setReportNonce] = useState(0)

  return (
    <div className="panel hunt-launch" aria-labelledby="hunt-launch-title">
      <div className="hunt-launch-head">
        <h2 id="hunt-launch-title">Bug-hunt exercise</h2>
        {activeThisHunt ? (
          <Tag tone="warn" icon="bug">
            Bug-hunt mode on
          </Tag>
        ) : (
          <Tag tone="ready">Available</Tag>
        )}
      </div>

      {huntState.status === 'loading' ? (
        <p className="panel-note" role="status">
          Loading the exercise…
        </p>
      ) : huntState.status === 'error' ? (
        <div role="alert" className="hunt-panel-error">
          <p>
            <Icon name="alert" size={16} /> The exercise could not be loaded. {huntState.message}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setAttempt((n) => n + 1)}>
            <Icon name="reset" size={15} />
            Try again
          </Button>
        </div>
      ) : huntState.status === 'missing' ? (
        <p className="panel-note" role="alert">
          This exercise is unavailable right now. The practice shop itself is unaffected — try{' '}
          <Link to="/practice">/practice</Link> for the current list of hunts.
        </p>
      ) : (
        <>
          <p className="hunt-launch-hunt">
            <span className="hunt-launch-hunt-title">{huntState.hunt.title}</span>
            <span className="hunt-launch-hunt-summary">{huntState.hunt.summary}</span>
          </p>
          <p className="panel-note">
            Start it to put this browser session into bug-hunt mode against the practice shop.
            Defects are deterministic, scoped to your session, and disappear when you reset —
            your cart, orders and sign-in are kept either way.
          </p>
          <div className="button-row">
            {activeThisHunt && scenario.huntId?.startsWith('hunt-db-') ? (
              <Link className="button button-secondary" to="/database/playground">
                <Icon name="database" size={16} />
                Investigate in the SQL playground
              </Link>
            ) : null}
            {activeThisHunt ? (
              <Button
                variant="secondary"
                loading={busy === 'reset'}
                onClick={() => {
                  void resetSession()
                }}
              >
                <Icon name="reset" size={16} />
                Reset to clean mode
              </Button>
            ) : (
              <Button
                loading={busy === 'start'}
                disabled={loadState.status === 'error'}
                onClick={() => {
                  void startHunt(huntState.hunt.id)
                }}
              >
                <Icon name="bug" size={16} />
                Start the bug-hunt exercise
              </Button>
            )}
            <Link className="button button-ghost" to="/practice">
              Open /practice
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
          {actionError ? (
            <p className="hunt-panel-error" role="alert">
              <Icon name="alert" size={16} />
              {actionError}
            </p>
          ) : null}
        </>
      )}
      {activeThisHunt && scenario.huntId ? (
        <div className="learning-block" key={scenario.huntId}>
          <HintLadder huntId={scenario.huntId} />
          <div className="bug-report-block">
            <h3>File a report</h3>
            <BugReportForm huntId={scenario.huntId} onSubmitted={() => setReportNonce((n) => n + 1)} />
          </div>
          <RevealPanel huntId={scenario.huntId} refreshToken={reportNonce} />
        </div>
      ) : null}
    </div>
  )
}
