// Fetch helpers for checkout and orders. The server is the source of truth:
// totals, stock and order snapshots are all derived server-side. Errors
// surface as typed results so the views can render honest states; nothing
// here invents order data client-side.

import type {
  CheckoutSummary,
  OrderDetail,
  OrderListResponse,
  PaymentSimulation,
} from '../../shared/commerce'

export class CheckoutApiError extends Error {
  readonly status: number
  /** Machine-readable code from the server envelope, when present. */
  readonly code: string | null
  /** Per-field validation messages, when the server returned them. */
  readonly fields: Record<string, string> | null
  /** Blocking cart lines, when the server returned 422 cart_unavailable. */
  readonly lines: Array<{
    slug: string
    name: string
    reason: 'inactive' | 'insufficient_stock' | 'out_of_stock'
    availableStock: number
  }> | null

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    fields: Record<string, string> | null = null,
    lines: CheckoutApiError['lines'] = null,
  ) {
    super(message)
    this.name = 'CheckoutApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.lines = lines
  }
}

export interface CheckoutDetailsInput {
  customerName: string
  customerEmail: string
  shippingLine: string
  shippingCity: string
  shippingPostcode: string
  paymentSimulation: PaymentSimulation
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new CheckoutApiError('The store could not read the server response.', response.status)
  }
}

async function errorFrom(response: Response, fallback: string): Promise<CheckoutApiError> {
  const body = await readJson<{
    message?: string
    error?: string
    fields?: Record<string, string>
    lines?: CheckoutApiError['lines']
  }>(response).catch(() => null)
  return new CheckoutApiError(
    body?.message ?? fallback,
    response.status,
    typeof body?.error === 'string' ? body.error : null,
    body?.fields ?? null,
    body?.lines ?? null,
  )
}

export async function fetchCheckoutSummary(signal?: AbortSignal): Promise<CheckoutSummary> {
  const response = await fetch('/api/v1/checkout', {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The checkout summary could not be loaded.')
  }

  return readJson<CheckoutSummary>(response)
}

export async function placeOrder(
  details: CheckoutDetailsInput,
  idempotencyKey: string,
): Promise<OrderDetail> {
  const response = await fetch('/api/v1/checkout', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(details),
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The order could not be placed.')
  }

  return readJson<OrderDetail>(response)
}

export async function fetchOrder(
  reference: string,
  signal?: AbortSignal,
): Promise<OrderDetail | null> {
  const response = await fetch(`/api/v1/orders/${encodeURIComponent(reference)}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw await errorFrom(response, 'The order could not be loaded.')
  }

  return readJson<OrderDetail>(response)
}

export async function fetchOrders(signal?: AbortSignal): Promise<OrderListResponse> {
  const response = await fetch('/api/v1/orders', {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw await errorFrom(response, 'Your order history could not be loaded.')
  }

  return readJson<OrderListResponse>(response)
}

export async function cancelOrder(reference: string): Promise<OrderDetail> {
  const response = await fetch(`/api/v1/orders/${encodeURIComponent(reference)}/cancel`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The order could not be cancelled. Please try again.')
  }

  return readJson<OrderDetail>(response)
}
