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
import { fetchPracticeHunts } from './api'
import { BugReportExport } from './BugReportExport'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Tag } from '../../components/ui/Tag'
import { SectionHeader } from '../../components/ui/PageChrome'
import { scenarios } from '../../data/scenarios'
import { PracticeApiError } from './api'
import type { HuntSummary } from '../../shared/practice'

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
                const scenario = entry.scenarioId
                  ? scenarios.find((candidate) => candidate.id === entry.scenarioId)
                  : undefined
                return (
                  <li key={entry.id} className="hunt-row" aria-current={isActive ? 'true' : undefined}>
                    <div className="hunt-row-body">
                      <span className="hunt-row-title">
                        {isActive ? <Tag tone="warn" icon="bug">Active</Tag> : null}
                        {entry.title}
                      </span>
                      <span className="hunt-row-summary">{entry.summary}</span>
                      {scenario ? (
                        <Link className="hunt-row-link" to={`/scenarios/${scenario.id}`}>
                          Scenario: {scenario.title}
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
            <div className="bug-report-block">
              <h3>File a report</h3>
              <p className="panel-note">
                Found something? Write the report while it is in front of you. It is exported as a
                local markdown file — the lab does not receive it.
              </p>
              <BugReportExport />
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
