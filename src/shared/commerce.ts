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

/** Hard cap on a single cart line's quantity (also a CHECK constraint). */
export const MAX_LINE_QUANTITY = 99

/**
 * A cart line as recomputed server-side from the current catalogue. The
 * client never dictates prices or totals; every figure here is derived from
 * `products.price_cents` and `inventory` at read time.
 *
 * `available` is false when the product was deactivated or does not have
 * enough stock to cover the line. Such lines stay in the cart (honestly
 * flagged) and are expected to block checkout once M4 lands.
 */
export interface CartLine {
  id: number
  productId: number
  slug: string
  name: string
  unitPriceCents: number
  currency: typeof COMMERCE_CURRENCY
  quantity: number
  lineTotalCents: number
  stockStatus: StockStatus
  productActive: boolean
  availableStock: number
  exceedsStock: boolean
  available: boolean
}

/**
 * Cart payload. `subtotalCents` and `totalCents` are equal in P3-M3 (no
 * shipping, discounts or tax exist yet); `totalCents` is kept so M4 can add
 * shipping without breaking the contract. Money is always integer cents.
 */
export interface CartResponse {
  items: CartLine[]
  itemCount: number
  subtotalCents: number
  totalCents: number
  currency: typeof COMMERCE_CURRENCY
  hasUnavailableItems: boolean
}
