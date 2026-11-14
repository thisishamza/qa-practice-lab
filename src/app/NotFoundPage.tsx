import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="note" aria-labelledby="not-found-title">
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">That page does not exist yet.</h1>
      <p>
        Only the Phase 1 foundation is live. The scenario catalogue and guides arrive in a later
        phase.
      </p>
      <Link className="button" to="/">
        Back to the foundation page
      </Link>
    </section>
  )
}
