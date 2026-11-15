// Pure helpers for the storefront catalogue. The URL is the single source of
// truth for catalogue state, mirroring src/lib/catalog.ts for scenarios.
// Invalid values fall back to defaults rather than erroring or showing a
// misleading catalogue.

import { COMMERCE_CURRENCY, PRODUCT_SORTS, type ProductSort, type StockStatus } from '../shared/commerce'

export const SHOP_PER_PAGE = 12

export const defaultShopSort: ProductSort = 'newest'
export const defaultShopCategory = 'all'

export interface ShopFilters {
  query: string
  category: string
}

export const defaultShopFilters: ShopFilters = {
  query: '',
  category: defaultShopCategory,
}

export const shopSortLabels: Record<ProductSort, string> = {
  newest: 'Newest',
  name: 'Name A–Z',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
}

export const stockStatusLabels: Record<StockStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
}

const maxPage = 10_000

export function pageFromSearchParams(searchParams: URLSearchParams): number {
  const raw = searchParams.get('page')
  if (raw === null) return 1
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) return 1
  return Math.min(value, maxPage)
}

export function filtersFromSearchParams(searchParams: URLSearchParams): ShopFilters {
  const query = searchParams.get('q')?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? ''
  const category = searchParams.get('category')?.trim().toLowerCase().slice(0, 64) ?? ''
  return {
    query,
    category: category && /^[a-z0-9-]{1,64}$/.test(category) ? category : defaultShopCategory,
  }
}

export function sortFromSearchParams(searchParams: URLSearchParams): ProductSort {
  const raw = searchParams.get('sort')
  return raw && PRODUCT_SORTS.has(raw) ? (raw as ProductSort) : defaultShopSort
}

/** Serialize catalogue state back to the URL, dropping default values. */
export function buildShopSearchParams(
  filters: ShopFilters,
  sort: ProductSort = defaultShopSort,
  page = 1,
): URLSearchParams {
  const params = new URLSearchParams()
  const query = filters.query.trim()

  if (query) {
    params.set('q', query)
  }
  if (filters.category !== defaultShopCategory) {
    params.set('category', filters.category)
  }
  if (sort !== defaultShopSort) {
    params.set('sort', sort)
  }
  if (page > 1) {
    params.set('page', String(page))
  }

  return params
}

export function hasActiveShopFilters(
  filters: ShopFilters,
  sort: ProductSort = defaultShopSort,
  page = 1,
): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.category !== defaultShopCategory ||
    sort !== defaultShopSort ||
    page > 1
  )
}

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: COMMERCE_CURRENCY,
})

export function formatPriceCents(priceCents: number): string {
  return priceFormatter.format(priceCents / 100)
}
