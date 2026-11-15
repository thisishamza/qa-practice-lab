// Fetch helpers for the session-keyed practice cart. Errors surface as typed
// results so pages can render honest inline states; nothing here invents
// cart data client-side — the server is always the source of truth.

import type { CartResponse } from '../../shared/commerce'
import { MAX_LINE_QUANTITY } from '../../shared/commerce'

export class CartApiError extends Error {
  readonly status: number
  /** Machine-readable code from the server envelope, when present. */
  readonly code: string | null
  readonly maxQuantity: number | null

  constructor(message: string, status: number, code: string | null = null, maxQuantity: number | null = null) {
    super(message)
    this.name = 'CartApiError'
    this.status = status
    this.code = code
    this.maxQuantity = maxQuantity
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new CartApiError('The store could not read the server response.', response.status)
  }
}

async function errorFrom(response: Response, fallback: string): Promise<CartApiError> {
  const body = await readJson<{
    message?: string
    error?: string
    maxQuantity?: number
  }>(response).catch(() => null)
  return new CartApiError(
    body?.message ?? fallback,
    response.status,
    typeof body?.error === 'string' ? body.error : null,
    typeof body?.maxQuantity === 'number' ? body.maxQuantity : null,
  )
}

export { MAX_LINE_QUANTITY }

export async function fetchCart(signal?: AbortSignal): Promise<CartResponse> {
  const response = await fetch('/api/v1/cart', {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The cart could not be loaded.')
  }

  return readJson<CartResponse>(response)
}

export async function addToCart(
  slug: string,
  quantity: number = 1,
): Promise<CartResponse> {
  const response = await fetch('/api/v1/cart/items', {
    method: 'POST',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ slug, quantity }),
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The product could not be added.')
  }

  return readJson<CartResponse>(response)
}

export async function setCartItemQuantity(
  lineId: number,
  quantity: number,
): Promise<CartResponse> {
  const response = await fetch(`/api/v1/cart/items/${lineId}`, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ quantity }),
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The quantity could not be updated.')
  }

  return readJson<CartResponse>(response)
}

export async function removeCartItem(lineId: number): Promise<CartResponse> {
  const response = await fetch(`/api/v1/cart/items/${lineId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The item could not be removed.')
  }

  return readJson<CartResponse>(response)
}

export async function clearCart(): Promise<CartResponse> {
  const response = await fetch('/api/v1/cart', {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The cart could not be cleared.')
  }

  return readJson<CartResponse>(response)
}
