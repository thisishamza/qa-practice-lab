import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader } from '../components/ui/PageChrome'
import { Callout } from '../components/ui/Callout'
import { EvaluationTransparency } from '../features/evaluation/EvaluationTransparency'

export function AboutPage() {
  useDocumentTitle('About this build')
  const location = useLocation()

  // Client-side navigation to /about#evaluation does not scroll or move
  // focus on its own; honour the hash explicitly once the section exists,
  // including keyboard/screen-reader focus (otherwise callers land on
  // whatever had focus before, usually document.body).
  useEffect(() => {
    const id = location.hash.replace(/^#/, '')
    if (!id) {
      return
    }
    const target = document.getElementById(id)
    target?.scrollIntoView({ block: 'start' })
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true })
    }
  }, [location.hash])

  return (
    <div className="stack">
      <PageHeader
        eyebrow="About"
        title="About this build"
        description="QA Practice Lab is a learner-facing environment for practising software testing end to end. This page records what is real, what is planned, and how the lab is built."
      />

      <div className="split-grid">
        <section className="content-section" aria-labelledby="real-title">
          <SectionHeader
            id="real-title"
            title="What works today"
            description="The shell, the shop, and seven runnable exercises."
          />
          <div className="panel">
            <p className="panel-note">
              Navigation, search, tracks, the scenario catalogue, and the written guides are
              implemented and usable. The catalogue supports filtering and carries a query in the
              URL, so a search can be linked or shared.
            </p>
            <p className="panel-note">
              Seven bug-hunt exercises are runnable against the fictional Meridian Outfitters
              shop — defects are deterministic, scoped to your browser session, and never affect
              anyone else. The other 21 catalogue scenarios are labelled placeholders and are not
              runnable yet.
            </p>
            <p className="panel-note">
              Progress is real on this server: the progress page shows your own attempts, scores,
              discoveries and hint usage — never sample data. The dashboard still shows labelled
              demo figures.
            </p>
          </div>
        </section>

        <section className="content-section" aria-labelledby="planned-title">
          <SectionHeader
            id="planned-title"
            title="What comes next"
            description="Scoped later phases, nothing faked."
          />
          <div className="panel">
            <p className="panel-note">
              Later phases add more defects to the library, a browser-isolated SQL sandbox,
              performance and accessibility exercises, and richer accounts. Every target will be
              first-party, synthetic, and bounded by the project safety rules.
            </p>
            <div className="button-row">
              <Link className="button button-small" to="/tracks">
                Browse tracks
              </Link>
              <Link className="button button-secondary button-small" to="/scenarios">
                Open the catalogue
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section className="content-section" aria-labelledby="durability-title">
        <SectionHeader
          id="durability-title"
          title="How long your progress lasts"
          description="Two kinds of durability, stated plainly."
        />
        <div className="split-grid">
          <div className="panel">
            <h3>As a guest</h3>
            <p className="panel-note">
              Progress belongs to this browser&rsquo;s anonymous practice session. It is
              temporary by design: it lives as long as the session does — seven days — and is
              deleted when the session expires. It is never copied anywhere else.
            </p>
            <p className="panel-note">
              Guest progress does not transfer to an account. Signing in later does not merge or
              migrate earlier guest activity into the account; it stays bound to the session that
              made it.
            </p>
          </div>
          <div className="panel">
            <h3>Signed in</h3>
            <p className="panel-note">
              Reports submitted while signed in are attributed to the synthetic training customer
              associated with you at the moment of submission — the attribution is stamped on the
              attempt, not reconstructed later. Attempts made while you were a guest remain
              session-bound and are never re-attributed.
            </p>
            <p className="panel-note">
              Signing in never merges or migrates earlier guest progress into the account.
              Attribution reflects who you were signed in as when you submitted — nothing more.
            </p>
            <p className="panel-note">
              The accounts are fictional demo accounts for training only — there is no real
              registration, identity provider, or password recovery.
            </p>
          </div>
        </div>
      </section>

      <section
        id="evaluation"
        className="content-section"
        aria-labelledby="evaluation-title"
        tabIndex={-1}
      >
        <SectionHeader
          id="evaluation-title"
          title="Learning and evaluation"
          description="How bug reports are scored, what discovery means, and what hints count for."
        />
        <EvaluationTransparency />
      </section>

      <Callout tone="info" title="No AI service is required">
        The learning content, navigation, progress tracking and scoring all work without an AI
        call. Report evaluation is deterministic and rule-based — every run of a given report
        produces the same score, the same checks and the same verdict.
      </Callout>
    </div>
  )
}
