import type { KeyboardEvent } from 'react'
import type { CategorySummary, ProductSort } from '../../shared/commerce'
import { shopSortLabels } from '../../lib/shop'
import { Icon } from '../../components/ui/Icon'
import { Button } from '../../components/ui/Button'

const sortOrder: ProductSort[] = ['newest', 'name', 'price_asc', 'price_desc']

interface ShopFilterBarProps {
  query: string
  onQueryChange: (value: string) => void
  category: string
  categories: CategorySummary[] | null
  categoriesFailed: boolean
  onRetryCategories: () => void
  onCategoryChange: (slug: string) => void
  sort: ProductSort
  onSortChange: (sort: ProductSort) => void
  onClearAll: () => void
  hasActiveControls: boolean
  resultCount: number | null
}

/**
 * Controlled storefront toolbar. The page owns the URL; this component only
 * renders the controls and reports intent.
 */
export function ShopFilterBar({
  query,
  onQueryChange,
  category,
  categories,
  categoriesFailed,
  onRetryCategories,
  onCategoryChange,
  sort,
  onSortChange,
  onClearAll,
  hasActiveControls,
  resultCount,
}: ShopFilterBarProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      onQueryChange('')
    }
  }

  return (
    <div className="filter-panel shop-filters">
      <div className="shop-filter-row">
        <div className="filter-field shop-search" role="search" aria-label="Search products">
          <label htmlFor="shop-search-input">Search products</label>
          <div className="search-input">
            <Icon name="search" size={17} />
            <input
              id="shop-search-input"
              type="text"
              value={query}
              placeholder="Tent, pack, lantern…"
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => onQueryChange('')}
                aria-label="Clear search"
              >
                <Icon name="close" size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="filter-field">
          <label htmlFor="shop-category">Category</label>
          {categoriesFailed ? (
            <div className="shop-category-error" role="alert">
              <span>Categories unavailable.</span>
              <button type="button" className="link-button" onClick={onRetryCategories}>
                Try again
              </button>
            </div>
          ) : (
            <select
              id="shop-category"
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              disabled={categories === null}
            >
              <option value="all">All categories</option>
              {(categories ?? []).map((entry) => (
                <option key={entry.id} value={entry.slug}>
                  {entry.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="filter-field">
          <label htmlFor="shop-sort">Sort</label>
          <select
            id="shop-sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ProductSort)}
          >
            {sortOrder.map((option) => (
              <option key={option} value={option}>
                {shopSortLabels[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-footer">
        <p className="filter-count" aria-live="polite">
          {resultCount === null ? (
            'Loading products…'
          ) : (
            <>
              <strong>{resultCount}</strong> {resultCount === 1 ? 'product' : 'products'}
            </>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={onClearAll} disabled={!hasActiveControls}>
          <Icon name="reset" size={15} />
          Clear all
        </Button>
      </div>
    </div>
  )
}
