import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CartApiError,
  addToCart,
  clearCart,
  fetchCart,
  removeCartItem,
  setCartItemQuantity,
} from '../../src/features/cart/api'

const emptyCart = {
  items: [],
  itemCount: 0,
  subtotalCents: 0,
  totalCents: 0,
  currency: 'USD',
  hasUnavailableItems: false,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

function lastCall() {
  const mock = fetch as unknown as ReturnType<typeof vi.fn>
  return mock.mock.calls[mock.mock.calls.length - 1] as unknown as [string, RequestInit?]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchCart', () => {
  it('GETs the cart endpoint and returns the parsed cart', async () => {
    stubFetch(async () => jsonResponse(emptyCart))
    const cart = await fetchCart()
    expect(cart).toEqual(emptyCart)
    const [url, init] = lastCall()
    expect(url).toBe('/api/v1/cart')
    expect(init?.method).toBeUndefined()
    expect((init?.headers as Record<string, string>).Accept).toBe('application/json')
  })

  it('throws CartApiError with the server message on HTTP errors', async () => {
    stubFetch(async () => jsonResponse({ error: 'internal_error', message: 'D1 unavailable' }, 503))
    await expect(fetchCart()).rejects.toMatchObject({
      name: 'CartApiError',
      status: 503,
      message: 'D1 unavailable',
    })
  })
})

describe('addToCart', () => {
  it('POSTs slug and quantity to the items endpoint', async () => {
    stubFetch(async () =>
      jsonResponse({
        ...emptyCart,
        items: [{ id: 1, slug: 'sequoia-sleeping-bag', quantity: 2 }],
        itemCount: 2,
      }),
    )
    await addToCart('sequoia-sleeping-bag', 2)
    const [url, init] = lastCall()
    expect(url).toBe('/api/v1/cart/items')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ slug: 'sequoia-sleeping-bag', quantity: 2 })
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('surfaces insufficient_stock envelopes with status, code and maxQuantity', async () => {
    stubFetch(async () =>
      jsonResponse(
        {
          error: 'insufficient_stock',
          message: 'Only 2 more can be added — stock limit reached.',
          maxQuantity: 4,
          currentQuantity: 2,
        },
        422,
      ),
    )
    const error = (await addToCart('lumen-usb-bike-light-set', 3).catch((e: unknown) => e)) as CartApiError
    expect(error).toBeInstanceOf(CartApiError)
    expect(error.status).toBe(422)
    expect(error.code).toBe('insufficient_stock')
    expect(error.message).toContain('Only 2 more')
    expect(error.maxQuantity).toBe(4)
  })
})

describe('setCartItemQuantity', () => {
  it('PATCHes the line resource with the new quantity', async () => {
    stubFetch(async () => jsonResponse(emptyCart))
    await setCartItemQuantity(42, 5)
    const [url, init] = lastCall()
    expect(url).toBe('/api/v1/cart/items/42')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ quantity: 5 })
  })

  it('throws CartApiError when the line cannot be updated', async () => {
    stubFetch(async () => jsonResponse({ error: 'not_found', message: 'Cart item not found.' }, 404))
    await expect(setCartItemQuantity(999, 1)).rejects.toMatchObject({
      name: 'CartApiError',
      status: 404,
      message: 'Cart item not found.',
    })
  })
})

describe('removeCartItem and clearCart', () => {
  it('DELETEs the line resource', async () => {
    stubFetch(async () => jsonResponse(emptyCart))
    await removeCartItem(7)
    const [url, init] = lastCall()
    expect(url).toBe('/api/v1/cart/items/7')
    expect(init?.method).toBe('DELETE')
  })

  it('clears the whole cart with DELETE /api/v1/cart', async () => {
    stubFetch(async () => jsonResponse(emptyCart))
    const cart = await clearCart()
    expect(cart.items).toEqual([])
    const [url, init] = lastCall()
    expect(url).toBe('/api/v1/cart')
    expect(init?.method).toBe('DELETE')
  })
})

describe('resilience', () => {
  it('maps non-JSON error bodies to a safe CartApiError', async () => {
    stubFetch(async () => new Response('<html>error</html>', { status: 500 }))
    await expect(fetchCart()).rejects.toMatchObject({ name: 'CartApiError', status: 500 })
  })

  it('propagates network failures to the caller', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(fetchCart()).rejects.toBeInstanceOf(TypeError)
  })
})
