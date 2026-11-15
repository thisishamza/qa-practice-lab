import { Link } from 'react-router-dom'
import { Icon } from '../../components/ui/Icon'

/**
 * Pagination that navigates through the catalogue with real links, so page
 * changes are shareable and work with Back/Forward. The parent owns the
 * search-param building.
 */
export function Pagination({
  page,
  totalPages,
  buildPageTo,
  label = 'Products',
}: {
  page: number
  totalPages: number
  buildPageTo: (page: number) => string
  label?: string
}) {
  if (totalPages <= 1) {
    return null
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <nav className="pagination" aria-label={`${label} pages`}>
      {page > 1 ? (
        <Link className="pagination-step" to={buildPageTo(page - 1)} rel="prev">
          <Icon name="chevron-right" size={15} className="pagination-flip" />
          Previous
        </Link>
      ) : (
        <span className="pagination-step is-disabled" aria-hidden="true">
          <Icon name="chevron-right" size={15} className="pagination-flip" />
          Previous
        </span>
      )}

      <ol className="pagination-pages">
        {pages.map((entry) => (
          <li key={entry}>
            <Link
              to={buildPageTo(entry)}
              className={`pagination-page${entry === page ? ' is-current' : ''}`}
              aria-current={entry === page ? 'page' : undefined}
              aria-label={entry === page ? `Page ${entry}, current page` : `Page ${entry}`}
            >
              {entry}
            </Link>
          </li>
        ))}
      </ol>

      {page < totalPages ? (
        <Link className="pagination-step" to={buildPageTo(page + 1)} rel="next">
          Next
          <Icon name="chevron-right" size={15} />
        </Link>
      ) : (
        <span className="pagination-step is-disabled" aria-hidden="true">
          Next
          <Icon name="chevron-right" size={15} />
        </span>
      )}
    </nav>
  )
}
