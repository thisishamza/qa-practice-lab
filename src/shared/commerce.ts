// Shared contracts between the Hono API and the (upcoming) storefront UI.
// Money is always integer cents; format only at the edge. Currency is a
// platform-wide constant for the fictional Meridian Outfitters catalogue.

export const COMMERCE_CURRENCY = 'USD'

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface CategorySummary {
  id: number
  slug: string
  name: string
  description: string
  sortOrder: number
}

export interface Product {
  id: number
  slug: string
  name: string
  description: string
  categorySlug: string
  categoryName: string
  priceCents: number
  currency: typeof COMMERCE_CURRENCY
  stockStatus: StockStatus
}

export interface ProductListResponse {
  data: Product[]
  page: number
  perPage: number
  total: number
  totalPages: number
}

export interface CategoryListResponse {
  data: CategorySummary[]
}

export type ProductSort = 'newest' | 'name' | 'price_asc' | 'price_desc'

export const PRODUCT_SORTS: ReadonlySet<string> = new Set([
  'newest',
  'name',
  'price_asc',
  'price_desc',
])
