import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCategories, fetchProduct, fetchProducts, ShopApiError } from '../../src/features/shop/api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchProducts', () => {
  it('builds the expected query string', async () => {
    stubFetch(async () =>
      jsonResponse({ data: [], page: 2, perPage: 12, total: 0, totalPages: 0 }),
    )
    await fetchProducts({ query: 'fire steel', category: 'camping', sort: 'price_asc', page: 2 })

    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toContain('/api/v1/products?')
    expect(url).toContain('page=2')
    expect(url).toContain('perPage=12')
    expect(url).toContain('sort=price_asc')
    expect(url).toContain('category=camping')
    expect(url).toContain('q=fire+steel')
  })

  it('omits q and category for defaults', async () => {
    stubFetch(async () =>
      jsonResponse({ data: [], page: 1, perPage: 12, total: 0, totalPages: 0 }),
    )
    await fetchProducts({ query: '', category: 'all', sort: 'newest', page: 1 })

    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).not.toContain('q=')
    expect(url).not.toContain('category=')
  })

  it('throws ShopApiError with the server message on HTTP errors', async () => {
    stubFetch(async () => jsonResponse({ error: 'server_error', message: 'D1 unavailable' }, 500))
    await expect(
      fetchProducts({ query: '', category: 'all', sort: 'newest', page: 1 }),
    ).rejects.toMatchObject({ name: 'ShopApiError', status: 500, message: 'D1 unavailable' })
  })

  it('throws ShopApiError when the network fails', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(
      fetchProducts({ query: '', category: 'all', sort: 'newest', page: 1 }),
    ).rejects.toBeInstanceOf(TypeError)
  })

  it('throws ShopApiError on malformed JSON', async () => {
    stubFetch(async () => new Response('not json', { status: 200 }))
    await expect(
      fetchProducts({ query: '', category: 'all', sort: 'newest', page: 1 }),
    ).rejects.toMatchObject({ name: 'ShopApiError', status: 200 })
  })
})

describe('fetchProduct', () => {
  it('returns the product on success', async () => {
    const product = {
      id: 1,
      slug: 'ridgeline-2-person-tent',
      name: 'Ridgeline 2-Person Tent',
      description: 'Freestanding 3-season dome tent.',
      categorySlug: 'camping',
      categoryName: 'Camping',
      priceCents: 18999,
      currency: 'USD',
      stockStatus: 'in_stock',
    }
    stubFetch(async () => jsonResponse(product))
    await expect(fetchProduct('ridgeline-2-person-tent')).resolves.toEqual(product)
  })

  it('returns null for a 404 envelope (unknown or inactive slug)', async () => {
    stubFetch(async () => jsonResponse({ error: 'not_found', message: 'Product not found' }, 404))
    await expect(fetchProduct('does-not-exist')).resolves.toBeNull()
  })

  it('throws ShopApiError for non-404 HTTP errors', async () => {
    stubFetch(async () => jsonResponse({ error: 'server_error', message: 'boom' }, 500))
    await expect(fetchProduct('ridgeline-2-person-tent')).rejects.toMatchObject({
      name: 'ShopApiError',
      status: 500,
    })
  })

  it('URL-encodes the slug', async () => {
    stubFetch(async () => jsonResponse({ error: 'not_found', message: 'Product not found' }, 404))
    await fetchProduct('a b/c')
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toBe('/api/v1/products/a%20b%2Fc')
  })
})

describe('fetchCategories', () => {
  it('returns the category list on success', async () => {
    stubFetch(async () =>
      jsonResponse({
        data: [{ id: 1, slug: 'camping', name: 'Camping', description: 'Tents', sortOrder: 10 }],
      }),
    )
    await expect(fetchCategories()).resolves.toEqual([
      { id: 1, slug: 'camping', name: 'Camping', description: 'Tents', sortOrder: 10 },
    ])
  })

  it('throws ShopApiError on failure', async () => {
    stubFetch(async () => jsonResponse({ error: 'server_error', message: 'nope' }, 503))
    await expect(fetchCategories()).rejects.toMatchObject({
      name: 'ShopApiError',
      status: 503,
    })
  })
})

describe('ShopApiError', () => {
  it('is an Error subclass with a status', () => {
    expect(new ShopApiError('x', 418)).toBeInstanceOf(Error)
  })
})
