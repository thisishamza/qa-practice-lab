import { HealthStatus } from '../features/system/HealthStatus'

const foundationItems = [
  {
    label: 'React + TypeScript shell',
    detail: 'Responsive layout, accessible landmarks, and a Vite production build.',
  },
  {
    label: 'Hono API on Pages Functions',
    detail: 'One catch-all Function serving /api with JSON errors and no-store headers.',
  },
  {
    label: 'Cloudflare D1 wiring',
    detail: 'Versioned SQL migration plus a live database check from the API.',
  },
]

export function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Practice environment · in progress</p>
        <h1 id="hero-title">A safe place to practise software testing.</h1>
        <p className="lede">
          QA Practice Lab is being built one verifiable phase at a time. This first slice proves
          that the frontend, API, and database wiring work end to end — without exposing any
          unfinished practice surface.
        </p>
        <div className="hero-actions">
          <a className="button" href="#foundation">
            See what is wired
          </a>
          <a
            className="button button-secondary"
            href="https://developers.cloudflare.com/pages/"
            rel="noreferrer"
            target="_blank"
          >
            Cloudflare Pages docs
          </a>
        </div>
      </section>

      <section id="foundation" className="panel-grid" aria-labelledby="foundation-title">
        <div className="panel">
          <h2 id="foundation-title">Foundation status</h2>
          <ul className="checklist">
            {foundationItems.map((item) => (
              <li key={item.label}>
                <span className="checkmark" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <span className="check-detail">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <HealthStatus />
      </section>

      <section className="note" aria-labelledby="next-title">
        <h2 id="next-title">What this phase deliberately leaves out</h2>
        <p>
          No commerce scenarios, authentication, bug-hunt mode, SQL playground, performance
          tests, or security challenges yet. Phase 2 adds the learning-track shell and the
          structured guide experience on top of this foundation.
        </p>
      </section>
    </>
  )
}
