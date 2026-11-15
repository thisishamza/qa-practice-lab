// Bug-hunt controls for the /practice page (P3-M7, engine v1).
//
// Learner-facing and honest: it shows the current mode, starts or resets the
// one available practice hunt, and never reveals what the defect is or where
// it lives. The hunt registry on the server is the source of truth; the
// display copy below intentionally mirrors src/server/hunts.ts without
// including defect ids. P3-M8 will make hunts discoverable from the
// scenario catalogue instead of a hard-coded entry.

import { Link } from 'react-router-dom'
import { useState } from 'react'
import { usePracticeSession } from './usePracticeSession'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Tag } from '../../components/ui/Tag'
import { SectionHeader } from '../../components/ui/PageChrome'

/** Mirrors the single registered hunt in src/server/hunts.ts. No defect ids. */
const AVAILABLE_HUNT = {
  id: 'hunt-catalogue-001',
  title: 'Catalogue search under-matches',
  summary:
    'Shoppers swear the search misses products. Find out what the shop search is failing to match and file a report.',
} as const

export function HuntPanel() {
  const { loadState, mode, hunt, busy, actionError, startHunt, resetSession } =
    usePracticeSession()
  const [justStarted, setJustStarted] = useState(false)
  const [justReset, setJustReset] = useState(false)

  const bugHuntActive = mode === 'bug_hunt' && hunt !== null

  return (
    <section className="content-section" aria-labelledby="bug-hunt-title">
      <SectionHeader
        id="bug-hunt-title"
        title="Bug-hunt mode"
        description="Practice against a deliberately broken shop. Defects are deterministic, scoped to your browser session, and never affect other learners."
        action={
          <Tag tone="warn" icon="bug">
            1 hunt available
          </Tag>
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
            {bugHuntActive ? (
              <p className="hunt-panel-hunt">
                <span className="hunt-panel-hunt-title">{hunt.title}</span>
                <span className="hunt-panel-hunt-summary">{hunt.summary}</span>
              </p>
            ) : (
              <p className="hunt-panel-hunt">
                <span className="hunt-panel-hunt-title">{AVAILABLE_HUNT.title}</span>
                <span className="hunt-panel-hunt-summary">{AVAILABLE_HUNT.summary}</span>
              </p>
            )}
          </div>

          {bugHuntActive ? (
            <>
              <p className="panel-note">
                The defect is live for this browser session only — your cart, orders and
                sign-in are untouched. Resetting returns the shop to clean behaviour; your
                cart and orders are kept.
              </p>
              <div className="button-row">
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
                <Link className="button button-ghost" to="/shop">
                  Open the shop
                  <Icon name="arrow-right" size={16} />
                </Link>
              </div>
              {justStarted ? (
                <p className="hunt-panel-success" role="status">
                  <Icon name="check" size={16} />
                  Bug-hunt mode is on for this browser. Open the{' '}
                  <Link to="/shop">shop</Link> and start investigating.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="panel-note">
                Start the hunt to put the shop into a known-broken state. Work out what is
                wrong, collect evidence, then reset. Nothing about the hunt ever leaks into
                other sessions.
              </p>
              <div className="button-row">
                <Button
                  loading={busy === 'start'}
                  onClick={() => {
                    void startHunt(AVAILABLE_HUNT.id).then((ok) => {
                      if (ok) {
                        setJustStarted(true)
                        setJustReset(false)
                      }
                    })
                  }}
                >
                  <Icon name="bug" size={16} />
                  Start the practice hunt
                </Button>
              </div>
              {justReset ? (
                <p className="hunt-panel-success" role="status">
                  <Icon name="check" size={16} />
                  Clean mode restored. The shop behaves as specified again.
                </p>
              ) : null}
            </>
          )}

          {actionError ? (
            <p className="hunt-panel-error" role="alert">
              <Icon name="alert" size={16} />
              {actionError}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
