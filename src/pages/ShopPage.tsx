import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { CategorySummary, ProductListResponse } from '../shared/commerce'
import {
  buildShopSearchParams,
  defaultShopFilters,
  defaultShopSort,
  filtersFromSearchParams,
  hasActiveShopFilters,
  pageFromSearchParams,
  sortFromSearchParams,
} from '../lib/shop'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadingState, EmptyState, ErrorState } from '../components/ui/States'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { ProductCard } from '../features/shop/ProductCard'
import { ShopFilterBar } from '../features/shop/ShopFilterBar'
import { Pagination } from '../features/shop/Pagination'
import { fetchCategories, fetchProducts, ShopApiError } from '../features/shop/api'

type CatalogueState =
  | { status: 'loading' }
  | { status: 'ready'; data: ProductListResponse }
  | { status: 'error'; message: string }

export function ShopPage() {
  useDocumentTitle('Shop')

  // The URL is the single source of truth for catalogue state.
  const [searchParams, setSearchParams] = useSearchParams()
  const queryKey = searchParams.toString()
  const filters = filtersFromSearchParams(searchParams)
  const sort = sortFromSearchParams(searchParams)
  const page = pageFromSearchParams(searchParams)

  // Result is keyed to the request that produced it; a key mismatch means a
  // fetch is in flight, which keeps loading state derived instead of stored.
  const [loaded, setLoaded] = useState<{ key: string; state: CatalogueState } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const fetchKey = `${queryKey}#${attempt}`
  const result: CatalogueState =
    loaded && loaded.key === fetchKey ? loaded.state : { status: 'loading' }

  const [categoriesState, setCategoriesState] = useState<
    { status: 'loading' } | { status: 'ready'; data: CategorySummary[] } | { status: 'error' }
  >({ status: 'loading' })
  const [categoriesAttempt, setCategoriesAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams(queryKey)
    const parsed = filtersFromSearchParams(params)
    const request = {
      query: parsed.query,
      category: parsed.category,
      sort: sortFromSearchParams(params),
      page: pageFromSearchParams(params),
    }

    fetchProducts(request, controller.signal)
      .then((data) => setLoaded({ key: `${queryKey}#${attempt}`, state: { status: 'ready', data } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({
          key: `${queryKey}#${attempt}`,
          state: {
            status: 'error',
            message:
              error instanceof ShopApiError
                ? error.message
                : 'The catalogue could not be loaded.',
          },
        })
      })

    return () => controller.abort()
  }, [queryKey, attempt])

  useEffect(() => {
    let cancelled = false

    fetchCategories()
      .then((data) => {
        if (!cancelled) setCategoriesState({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setCategoriesState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [categoriesAttempt])

  // Search input is a local draft; the URL commits after a short debounce.
  const [draft, setDraft] = useState(filters.query)
  const [lastUrlQuery, setLastUrlQuery] = useState(filters.query)
  if (filters.query !== lastUrlQuery) {
    setLastUrlQuery(filters.query)
    setDraft(filters.query)
  }

  useEffect(() => {
    const trimmed = draft.trim()
    if (trimmed === filters.query) return

    const timeout = window.setTimeout(() => {
      setSearchParams(
        buildShopSearchParams({ query: trimmed, category: filters.category }, sort, 1),
        { replace: true },
      )
    }, 200)

    return () => window.clearTimeout(timeout)
  }, [draft, filters.query, filters.category, sort, setSearchParams])

  function handleCategoryChange(category: string) {
    setSearchParams(buildShopSearchParams({ query: filters.query, category }, sort, 1))
  }

  function handleSortChange(nextSort: typeof sort) {
    setSearchParams(
      buildShopSearchParams({ query: filters.query, category: filters.category }, nextSort, 1),
    )
  }

  function handleClearAll() {
    setSearchParams(buildShopSearchParams(defaultShopFilters, defaultShopSort, 1), {
      replace: true,
    })
  }

  function buildPageTo(target: number) {
    const next = buildShopSearchParams(
      { query: filters.query, category: filters.category },
      sort,
      target,
    )
    const suffix = next.toString()
    return `/shop${suffix ? `?${suffix}` : ''}`
  }

  const retry = () => setAttempt((value) => value + 1)
  const retryCategories = () => {
    setCategoriesState({ status: 'loading' })
    setCategoriesAttempt((value) => value + 1)
  }
  const categories = categoriesState.status === 'ready' ? categoriesState.data : null
  const hasActiveControls = hasActiveShopFilters(filters, sort, page)

  const ready = result.status === 'ready' ? result.data : null
  const outOfRange =
    ready !== null && ready.total > 0 && ready.page > ready.totalPages ? ready : null

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Meridian Outfitters"
        title="Shop the catalogue"
        description="Browse the full Meridian Outfitters catalogue. Prices and stock are synthetic — nothing here can be purchased."
      />

      <p className="catalogue-availability">
        Fictional practice storefront · API-backed catalogue · no checkout
      </p>

      <ShopFilterBar
        query={draft}
        onQueryChange={setDraft}
        category={filters.category}
        categories={categories}
        categoriesFailed={categoriesState.status === 'error'}
        onRetryCategories={retryCategories}
        onCategoryChange={handleCategoryChange}
        sort={sort}
        onSortChange={handleSortChange}
        onClearAll={handleClearAll}
        hasActiveControls={hasActiveControls}
        resultCount={ready ? ready.total : null}
      />

      {result.status === 'loading' ? <LoadingState label="Loading products…" /> : null}

      {result.status === 'error' ? (
        <ErrorState
          title="The catalogue could not be loaded"
          description={
            <>
              {result.message} Check that the practice API is running, then try again.
            </>
          }
          action={
            <Button size="sm" onClick={retry}>
              <Icon name="reset" size={15} />
              Try again
            </Button>
          }
        />
      ) : null}

      {ready && outOfRange ? (
        <EmptyState
          title="This page is beyond the end of the catalogue"
          description={`Page ${outOfRange.page} does not exist — the catalogue has ${outOfRange.totalPages} ${outOfRange.totalPages === 1 ? 'page' : 'pages'} for the current filters.`}
          icon="grid"
          action={
            <Link className="button button-secondary button-small" to={buildPageTo(1)}>
              Back to page 1
            </Link>
          }
        />
      ) : null}

      {ready && !outOfRange && ready.data.length > 0 ? (
        <>
          <div className="product-grid">
            {ready.data.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          <Pagination
            page={ready.page}
            totalPages={ready.totalPages}
            buildPageTo={buildPageTo}
            label="Products"
          />
        </>
      ) : null}

      {ready && !outOfRange && ready.data.length === 0 ? (
        <EmptyState
          title="No products match those filters"
          description={
            filters.query
              ? `Nothing matches “${filters.query}”${filters.category !== 'all' ? ' in this category' : ''}. Try a broader term or clear the filters.`
              : 'Nothing matches the current filters. Try clearing them to see the full catalogue.'
          }
          icon="filter"
          action={
            hasActiveControls ? (
              <Button size="sm" onClick={handleClearAll}>
                <Icon name="reset" size={15} />
                Clear all
              </Button>
            ) : undefined
          }
        />
      ) : null}
    </div>
  )
}
