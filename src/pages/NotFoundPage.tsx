import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Icon } from '../components/ui/Icon'

const helpfulLinks = [
  {
    to: '/scenarios',
    label: 'Scenario catalog',
    detail: 'Search every planned exercise',
    icon: 'scenarios' as const,
  },
  {
    to: '/tracks',
    label: 'Learning tracks',
    detail: 'Browse the twelve disciplines',
    icon: 'tracks' as const,
  },
  {
    to: '/guides',
    label: 'Guides',
    detail: 'Read concepts and worked examples',
    icon: 'guides' as const,
  },
]

export function NotFoundPage() {
  useDocumentTitle('Page not found')

  return (
    <div className="stack">
      <section className="not-found" aria-labelledby="not-found-title">
        <p className="not-found-code">404</p>
        <h1 id="not-found-title">That page is not part of the lab.</h1>
        <p className="page-lede">
          The link may be incomplete, or the page may not have been built yet. The
          learning tracks, scenario catalog, and guides are all available.
        </p>
        <div className="button-row">
          <Link className="button" to="/">
            Back to the dashboard
          </Link>
          <Link className="button button-secondary" to="/scenarios">
            Search scenarios
          </Link>
        </div>
      </section>

      <div className="category-grid">
        {helpfulLinks.map((item) => (
          <Link key={item.to} className="category-card" to={item.to}>
            <span className="category-icon" aria-hidden="true">
              <Icon name={item.icon} size={18} />
            </span>
            <span className="category-copy">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </span>
            <Icon name="arrow-right" size={16} />
          </Link>
        ))}
      </div>
    </div>
  )
}
