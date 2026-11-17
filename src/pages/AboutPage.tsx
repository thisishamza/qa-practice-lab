import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader, Breadcrumbs } from '../components/ui/PageChrome'
import { Callout } from '../components/ui/Callout'
import { EvaluationTransparency } from '../features/evaluation/EvaluationTransparency'

export function AboutPage() {
  useDocumentTitle('About & scoring')
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
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'About & scoring' }]} />

      <PageHeader
        eyebrow="About"
        title="About & scoring"
        description="QA Practice Lab is a learner-facing environment for practising software testing end to end. This page records what is real today, what is only planned, and how every report is scored."
      />

      <nav className="about-toc" aria-label="On this page">
        <span className="about-toc-label">On this page</span>
        <ul>
          <li>
            <a href="#what-works">What works today</a>
          </li>
          <li>
            <a href="#what-comes-next">What comes next</a>
          </li>
          <li>
            <a href="#durability">How long progress lasts</a>
          </li>
          <li>
            <a href="#evaluation">Learning &amp; evaluation</a>
          </li>
        </ul>
      </nav>

      <div className="split-grid">
        <section
          id="what-works"
          className="content-section"
          aria-labelledby="real-title"
          tabIndex={-1}
        >
          <SectionHeader
            id="real-title"
            title="What works today"
            description="The shell, the shop, the scored labs, and 34 runnable bug-hunt exercises."
          />
          <div className="panel panel-sunken">
            <p className="panel-note">
              Navigation, search, tracks, the scenario catalogue, and the written guides are
              implemented and usable. The catalogue supports filtering and carries a query in the
              URL, so a search can be linked or shared.
            </p>
            <p className="panel-note">
              Thirty-four bug-hunt exercises are runnable against the fictional Meridian Outfitters
              shop — defects are deterministic, scoped to your browser session, and never affect
              anyone else. Thirty-nine of the 53 catalogued scenarios are ready to run, alongside
              five clean (non-hunt) exercises such as catalogue pagination, session expiry and the
              contract-consumer drills. The five hands-on labs — SQL, contract, performance,
              security and microservices — ship 96 scored exercises between them. The remaining
              14 catalogue scenarios are labelled placeholders and are not runnable yet.
            </p>
            <p className="panel-note">
              Progress is real on this server: the progress page and the dashboard show your own
              attempts, scores, discoveries and hint usage — never sample data.
            </p>
          </div>
        </section>

        <section
          id="what-comes-next"
          className="content-section"
          aria-labelledby="planned-title"
          tabIndex={-1}
        >
          <SectionHeader
            id="planned-title"
            title="What comes next"
            description="Planned work, labelled as planned — nothing below is available today."
          />
          <div className="panel panel-sunken">
            <p className="panel-note">
              <strong>Planned — not shipped.</strong> Follow-on work adds more defects to the
              library, accessibility exercises, and richer accounts. Every target will be
              first-party, synthetic, and bounded by the project safety rules. Until an item
              moves into “What works today”, treat it as a direction, not a deliverable.
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

      <section
        id="durability"
        className="content-section"
        aria-labelledby="durability-title"
        tabIndex={-1}
      >
        <SectionHeader
          id="durability-title"
          title="How long your progress lasts"
          description="Two kinds of durability, stated plainly."
        />
        <div className="split-grid">
          <div className="panel panel-sunken">
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
          <div className="panel panel-sunken">
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
        <nav className="about-scoring-nav" aria-label="Scoring sections">
          <a href="#rubric-checks">The ten checks</a>
          <a href="#verdict-bands">Verdict bands</a>
          <a href="#discovery-vs-score">Discovery vs score</a>
          <a href="#hints-and-reveals">Hints &amp; reveals</a>
        </nav>
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
