import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { Icon } from '../components/ui/Icon'

const recoveryLinks = [
  {
    to: '/scenarios',
    kicker: 'Exercises',
    title: 'Exercises',
    detail: 'Search the scenario catalogue',
    icon: 'scenarios' as const,
  },
  {
    to: '/tracks',
    kicker: 'Curriculum',
    title: 'Learning paths',
    detail: 'Browse the twelve disciplines',
    icon: 'tracks' as const,
  },
  {
    to: '/guides',
    kicker: 'Library',
    title: 'Guides',
    detail: 'Read concepts and worked examples',
    icon: 'guides' as const,
  },
]

export function NotFoundPage() {
  useDocumentTitle('Page not found')

  return (
    <div className="stack">
      <Breadcrumbs
        items={[{ label: 'Dashboard', to: '/' }, { label: 'Page not found' }]}
      />
      <section aria-labelledby="not-found-title">
        <PageHeader
          eyebrow="Error · 404"
          title="That page is not part of the lab."
          description="The link may be incomplete, or the page may not have been built yet. Here are three good places to continue."
        />
        <div className="button-row">
          <Link className="button" to="/">
            Back to the dashboard
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link className="button button-secondary" to="/scenarios">
            Search the catalogue
          </Link>
        </div>
      </section>

      <ol className="start-path-list">
        {recoveryLinks.map((item, index) => (
          <li key={item.to}>
            <Link className="start-step" to={item.to}>
              <span className="start-step-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="start-step-copy">
                <span className="start-step-kicker">{item.kicker}</span>
                <span className="start-step-title">{item.title}</span>
                <span className="start-step-detail">{item.detail}</span>
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
