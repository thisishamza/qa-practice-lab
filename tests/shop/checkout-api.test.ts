import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CheckoutApiError,
  fetchCheckoutSummary,
  fetchOrder,
  fetchOrders,
  placeOrder,
} from '../../src/features/checkout/api'

const summary = {
  items: [],
  itemCount: 0,
  subtotalCents: 0,
  totalCents: 0,
  currency: 'USD',
  hasUnavailableItems: false,
  checkoutable: false,
}

const order = {
  reference: 'ORD-0011223344556677',
  status: 'placed',
  paymentStatus: 'approved',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  shippingLine: '12 Analytical Engine Way',
  shippingCity: 'London',
  shippingPostcode: 'N1 9GU',
  subtotalCents: 50948,
  totalCents: 50948,
  itemCount: 3,
  currency: 'USD',
  createdAt: '2026-11-15T12:00:00.000Z',
  items: [
    {
      id: 1,
      productId: 1,
      productSlug: 'ridgeline-2-person-tent',
      productName: 'Ridgeline 2-Person Tent',
      unitPriceCents: 18999,
      currency: 'USD',
      quantity: 2,
      lineTotalCents: 37998,
    },
  ],
}

const details = {
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  shippingLine: '12 Analytical Engine Way',
  shippingCity: 'London',
  shippingPostcode: 'N1 9GU',
  paymentSimulation: 'approved' as const,
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

describe('fetchCheckoutSummary', () => {
  it('GETs the checkout endpoint and returns the parsed summary', async () => {
    stubFetch(async () => jsonResponse(summary))
    const result = await fetchCheckoutSummary()
    expect(result).toEqual(summary)
    const [url, init] = lastCall()
    expect(url).toBe('/api/v1/checkout')
    expect(init?.method).toBeUndefined()
  })
})

describe('placeOrder', () => {
  it('POSTs the details with the idempotency key header and returns the order', async () => {
    stubFetch(async () => jsonResponse(order, 201))
    const result = await placeOrder(details, 'key-abc12345')
    expect(result).toEqual(order)
    const [url, init] = lastCall()
    expect(url).toBe('/api/v1/checkout')
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('key-abc12345')
    expect(JSON.parse(String(init?.body))).toEqual(details)
  })

  it('maps a declined payment to a typed CheckoutApiError with the server code', async () => {
    stubFetch(async () =>
      jsonResponse({ error: 'payment_declined', message: 'The simulated payment was declined.' }, 422),
    )
    const failure = await placeOrder(details, 'key-def67890').catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(CheckoutApiError)
    expect(failure).toMatchObject({ status: 422, code: 'payment_declined' })
  })

  it('maps a cart_unavailable response to lines for per-line messaging', async () => {
    const lines = [
      { slug: 'kestrel-dry-bag-20l', name: 'Kestrel Dry Bag 20L', reason: 'out_of_stock', availableStock: 0 },
    ]
    stubFetch(async () =>
      jsonResponse({ error: 'cart_unavailable', message: 'Some lines can no longer be fulfilled.', lines }, 422),
    )
    const failure = await placeOrder(details, 'key-ghi11223').catch((e: unknown) => e)
    expect(failure).toMatchObject({ status: 422, code: 'cart_unavailable', lines })
  })

  it('maps invalid_request to per-field messages', async () => {
    const fields = { customerEmail: 'Enter a valid email address.' }
    stubFetch(async () =>
      jsonResponse({ error: 'invalid_request', message: 'Check the highlighted fields.', fields }, 400),
    )
    const failure = await placeOrder(details, 'key-jkl44556').catch((e: unknown) => e)
    expect(failure).toMatchObject({ status: 400, code: 'invalid_request', fields })
  })
})

describe('fetchOrder', () => {
  it('returns the order for a valid reference', async () => {
    stubFetch(async () => jsonResponse(order))
    const result = await fetchOrder('ORD-0011223344556677')
    expect(result).toEqual(order)
    const [url] = lastCall()
    expect(url).toBe('/api/v1/orders/ORD-0011223344556677')
  })

  it('maps a 404 to null rather than throwing', async () => {
    stubFetch(async () => jsonResponse({ error: 'not_found', message: 'Order not found.' }, 404))
    await expect(fetchOrder('ORD-0000000000000000')).resolves.toBeNull()
  })

  it('url-encodes the reference segment', async () => {
    stubFetch(async () => jsonResponse(order))
    await fetchOrder('ORD-XYZ/../../etc')
    const [url] = lastCall()
    expect(url).toBe('/api/v1/orders/ORD-XYZ%2F..%2F..%2Fetc')
  })
})

describe('fetchOrders', () => {
  it('returns the session order history payload', async () => {
    const history = { data: [order] }
    stubFetch(async () => jsonResponse(history))
    const result = await fetchOrders()
    expect(result).toEqual(history)
  })
})
