// Fetch helpers for the storefront's read-only catalogue API. Errors are
// surfaced as typed results so pages can render honest states; nothing here
// invents data.

import type {
  CategoryListResponse,
  CategorySummary,
  Product,
  ProductListResponse,
  ProductSort,
} from '../../shared/commerce'
import { SHOP_PER_PAGE } from '../../lib/shop'

export class ShopApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ShopApiError'
    this.status = status
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ShopApiError('The store could not read the server response.', response.status)
  }
}

export interface ProductQuery {
  query: string
  category: string
  sort: ProductSort
  page: number
}

export async function fetchProducts(
  { query, category, sort, page }: ProductQuery,
  signal?: AbortSignal,
): Promise<ProductListResponse> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('perPage', String(SHOP_PER_PAGE))
  params.set('sort', sort)
  if (category !== 'all') {
    params.set('category', category)
  }
  if (query) {
    params.set('q', query)
  }

  const response = await fetch(`/api/v1/products?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const body = await readJson<{ message?: string }>(response).catch(() => null)
    throw new ShopApiError(
      body?.message ?? 'The catalogue could not be loaded.',
      response.status,
    )
  }

  return readJson<ProductListResponse>(response)
}

/** Returns null when the slug is unknown or the product is inactive (404). */
export async function fetchProduct(
  slug: string,
  signal?: AbortSignal,
): Promise<Product | null> {
  const response = await fetch(`/api/v1/products/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const body = await readJson<{ message?: string }>(response).catch(() => null)
    throw new ShopApiError(body?.message ?? 'That product could not be loaded.', response.status)
  }

  return readJson<Product>(response)
}

export async function fetchCategories(signal?: AbortSignal): Promise<CategorySummary[]> {
  const response = await fetch('/api/v1/categories', {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const body = await readJson<{ message?: string }>(response).catch(() => null)
    throw new ShopApiError(body?.message ?? 'Categories could not be loaded.', response.status)
  }

  const body = await readJson<CategoryListResponse>(response)
  return body.data
}
