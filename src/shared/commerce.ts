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

/** Deterministic simulated payment outcomes. No real gateway is involved. */
export const PAYMENT_SIMULATIONS = ['approved', 'declined'] as const
export type PaymentSimulation = (typeof PAYMENT_SIMULATIONS)[number]

/** Order lifecycle. Only 'placed' exists today; M6 may add more. */
export type OrderStatus = 'placed'
export type OrderPaymentStatus = 'approved' | 'declined'

export interface CheckoutSummary extends CartResponse {
  /** False when the cart is empty or any line cannot be fulfilled. */
  checkoutable: boolean
}

/** One immutable order-item snapshot taken at placement time. */
export interface OrderItemSnapshot {
  id: number
  /** Null if the product row was later deleted — the snapshot survives. */
  productId: number | null
  productSlug: string
  productName: string
  unitPriceCents: number
  currency: typeof COMMERCE_CURRENCY
  quantity: number
  lineTotalCents: number
}

/** Order summary for the session's order history. */
export interface OrderSummary {
  reference: string
  status: OrderStatus
  paymentStatus: OrderPaymentStatus
  itemCount: number
  totalCents: number
  currency: typeof COMMERCE_CURRENCY
  createdAt: string
}

/** Safe projection of a customer — never any password material. */
export type CustomerRole = 'customer' | 'staff'
export type CustomerStatus = 'active' | 'suspended'

export interface CustomerProfile {
  name: string
  email: string
  role: CustomerRole
  status: CustomerStatus
  addressLine: string
  addressCity: string
  addressPostcode: string
  memberSince: string
}

/** A synthetic demo account, safe to expose for the training login UI. */
export interface DemoAccount {
  name: string
  email: string
  role: CustomerRole
  status: CustomerStatus
}

export interface DemoAccountListResponse {
  data: DemoAccount[]
}

export interface AuthResponse {
  customer: CustomerProfile
}

export interface AccountOrderListResponse {
  data: OrderSummary[]
}

/** Full order confirmation payload (immutable snapshot). */
export interface OrderDetail extends OrderSummary {
  customerName: string
  customerEmail: string
  shippingLine: string
  shippingCity: string
  shippingPostcode: string
  subtotalCents: number
  items: OrderItemSnapshot[]
}

export interface OrderListResponse {
  data: OrderSummary[]
}

/**
 * A cart line as recomputed server-side from the current catalogue. The
 * client never dictates prices or totals; every figure here is derived from
 * `products.price_cents` and `inventory` at read time.
 *
 * `available` is false when the product was deactivated or does not have
 * enough stock to cover the line. Such lines stay in the cart (honestly
 * flagged) and block checkout with a `422 cart_unavailable` envelope until
 * they are adjusted.
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
 * shipping, discounts or tax exist yet); `totalCents` is kept so shipping
 * can be added later without breaking the contract. Money is integer cents.
 */
export interface CartResponse {
  items: CartLine[]
  itemCount: number
  subtotalCents: number
  totalCents: number
  currency: typeof COMMERCE_CURRENCY
  hasUnavailableItems: boolean
}
