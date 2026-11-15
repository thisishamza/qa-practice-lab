import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { createMigratedD1 } from '../helpers/fake-d1'

function request(path: string) {
  const { db } = createMigratedD1()
  return app.request(path, {}, { DB: db })
}

describe('commerce migration and seed data', () => {
  const { sqlite } = createMigratedD1()

  it('records schema version 7', () => {
    const row = sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('8')
  })

  it('seeds eight categories, forty-two products and forty-two inventory rows', () => {
    const categories = sqlite.prepare('SELECT COUNT(*) AS n FROM categories').get() as {
      n: number
    }
    const products = sqlite.prepare('SELECT COUNT(*) AS n FROM products').get() as {
      n: number
    }
    const active = sqlite
      .prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1')
      .get() as { n: number }
    const inventory = sqlite.prepare('SELECT COUNT(*) AS n FROM inventory').get() as {
      n: number
    }
    expect([categories.n, products.n, active.n, inventory.n]).toEqual([8, 42, 40, 42])
  })
})

describe('GET /api/v1/products', () => {
  it('returns the first page of active products with pagination metadata', async () => {
    const response = await request('/api/v1/products')
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      data: Array<{ active?: boolean; currency: string; stockStatus: string }>
      page: number
      perPage: number
      total: number
      totalPages: number
    }
    expect(body.page).toBe(1)
    expect(body.perPage).toBe(12)
    expect(body.total).toBe(40)
    expect(body.totalPages).toBe(4)
    expect(body.data).toHaveLength(12)
    for (const product of body.data) {
      expect(product.active).toBeUndefined()
      expect(product.currency).toBe('USD')
      expect(['in_stock', 'low_stock', 'out_of_stock']).toContain(product.stockStatus)
    }
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('honours perPage, caps it at 48 and derives the next page', async () => {
    const five = (await (await request('/api/v1/products?perPage=5')).json()) as {
      data: unknown[]
      perPage: number
      totalPages: number
    }
    expect(five.data).toHaveLength(5)
    expect(five.perPage).toBe(5)
    expect(five.totalPages).toBe(8)

    const capped = (await (await request('/api/v1/products?perPage=500')).json()) as {
      perPage: number
    }
    expect(capped.perPage).toBe(48)
  })

  it('falls back to defaults for non-integer page/perPage values', async () => {
    const body = (await (
      await request('/api/v1/products?page=abc&perPage=1.5')
    ).json()) as { page: number; perPage: number }
    expect(body).toMatchObject({ page: 1, perPage: 12 })
  })

  it('serves a non-overlapping second page', async () => {
    const one = (await (await request('/api/v1/products?perPage=12&page=1')).json()) as {
      data: Array<{ id: number }>
    }
    const two = (await (await request('/api/v1/products?perPage=12&page=2')).json()) as {
      data: Array<{ id: number }>
    }
    const idsOne = new Set(one.data.map((p) => p.id))
    for (const product of two.data) {
      expect(idsOne.has(product.id)).toBe(false)
    }
  })

  it('filters by category slug and returns nothing for unknown slugs', async () => {
    const camping = (await (await request('/api/v1/products?category=camping')).json()) as {
      data: Array<{ categorySlug: string }>
      total: number
    }
    expect(camping.total).toBe(5)
    expect(camping.data.every((p) => p.categorySlug === 'camping')).toBe(true)

    const unknown = (await (await request('/api/v1/products?category=nope')).json()) as {
      data: unknown[]
      total: number
      totalPages: number
    }
    expect(unknown).toMatchObject({ total: 0, totalPages: 0 })
    expect(unknown.data).toEqual([])
  })

  it('handles SQL-significant category input safely', async () => {
    const response = await request("/api/v1/products?category=camping'%20OR%20'1'='1")
    expect(response.status).toBe(200)
    const body = (await response.json()) as { total: number }
    expect(body.total).toBe(0)
  })

  it('sorts by price ascending and descending', async () => {
    const asc = (await (await request('/api/v1/products?sort=price_asc&perPage=48')).json()) as {
      data: Array<{ priceCents: number }>
    }
    const prices = asc.data.map((p) => p.priceCents)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)

    const desc = (await (await request('/api/v1/products?sort=price_desc&perPage=48')).json()) as {
      data: Array<{ priceCents: number }>
    }
    const descPrices = desc.data.map((p) => p.priceCents)
    expect([...descPrices].sort((a, b) => b - a)).toEqual(descPrices)
  })

  it('falls back to the default sort for unknown sort values', async () => {
    const fallback = (await (await request('/api/v1/products?sort=bogus')).json()) as {
      data: Array<{ id: number }>
    }
    const newest = (await (await request('/api/v1/products?sort=newest')).json()) as {
      data: Array<{ id: number }>
    }
    expect(fallback.data.map((p) => p.id)).toEqual(newest.data.map((p) => p.id))
  })

  it('derives stock status from inventory quantities', async () => {
    const bySlug = async (slug: string) =>
      ((await (await request(`/api/v1/products/${slug}`)).json()) as {
        stockStatus: string
      }).stockStatus

    expect(await bySlug('ridgeline-2-person-tent')).toBe('in_stock')
    expect(await bySlug('ember-led-lantern')).toBe('low_stock')
    expect(await bySlug('strata-trail-runners')).toBe('low_stock')
    expect(await bySlug('driftline-gravel-frameset')).toBe('out_of_stock')
  })
})

describe('GET /api/v1/products?q= (search)', () => {
  it('matches on product name, case-insensitively', async () => {
    const body = (await (await request('/api/v1/products?q=tent')).json()) as {
      data: Array<{ name: string }>
      total: number
    }
    expect(body.total).toBe(2)
    expect(body.data.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Ridgeline 2-Person Tent', 'Halcyon 4-Season Tent']),
    )

    const upper = (await (await request('/api/v1/products?q=TENT')).json()) as {
      total: number
    }
    expect(upper.total).toBe(2)
  })

  it('matches on description', async () => {
    const body = (await (await request('/api/v1/products?q=vestibules')).json()) as {
      data: Array<{ slug: string }>
      total: number
    }
    expect(body.total).toBe(1)
    expect(body.data[0]?.slug).toBe('ridgeline-2-person-tent')
  })

  it('matches on category name', async () => {
    const body = (await (await request('/api/v1/products?q=camping')).json()) as {
      data: Array<{ categorySlug: string }>
      total: number
    }
    expect(body.total).toBe(5)
    expect(body.data.every((p) => p.categorySlug === 'camping')).toBe(true)
  })

  it('returns an empty page for queries with no matches', async () => {
    const response = await request('/api/v1/products?q=zzzz-no-such-product')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: unknown[]
      total: number
      totalPages: number
    }
    expect(body).toMatchObject({ total: 0, totalPages: 0 })
    expect(body.data).toEqual([])
  })

  it('treats LIKE wildcards in the query literally', async () => {
    for (const pattern of ['%', '_', '%%', 'tent%']) {
      const response = await request(`/api/v1/products?q=${encodeURIComponent(pattern)}`)
      expect(response.status).toBe(200)
      const body = (await response.json()) as { total: number }
      // No product text contains a literal '%' or '_' wildcard position, and
      // 'tent%' must not behave as a prefix wildcard.
      expect(body.total).toBe(pattern === 'tent%' ? 0 : 0)
    }
  })

  it('combines with the category filter', async () => {
    const body = (await (
      await request('/api/v1/products?q=tent&category=camping')
    ).json()) as { total: number }
    expect(body.total).toBe(2)

    const none = (await (
      await request('/api/v1/products?q=tent&category=hiking')
    ).json()) as { total: number }
    expect(none.total).toBe(0)
  })

  it('combines with sort and pagination metadata', async () => {
    const body = (await (
      await request('/api/v1/products?q=tent&sort=price_asc&perPage=1&page=2')
    ).json()) as { page: number; perPage: number; total: number; data: Array<{ priceCents: number }> }
    expect(body.page).toBe(2)
    expect(body.perPage).toBe(1)
    expect(body.total).toBe(2)
    expect(body.data[0]?.priceCents).toBe(34999)
  })
})

describe('GET /api/v1/products/:slug', () => {
  it('returns the product for a known slug', async () => {
    const response = await request('/api/v1/products/ridgeline-2-person-tent')
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      slug: 'ridgeline-2-person-tent',
      name: 'Ridgeline 2-Person Tent',
      categorySlug: 'camping',
      priceCents: 18999,
      currency: 'USD',
      stockStatus: 'in_stock',
    })
  })

  it('returns a 404 envelope for unknown slugs', async () => {
    const response = await request('/api/v1/products/does-not-exist')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: 'not_found',
      message: 'Product not found',
    })
  })

  it('hides inactive products', async () => {
    const response = await request('/api/v1/products/nightbeam-legacy-torch')
    expect(response.status).toBe(404)
  })

  it('rejects malformed slugs with a 404 envelope', async () => {
    const response = await request('/api/v1/products/UPPER%20CASE')
    expect(response.status).toBe(404)
  })
})

describe('GET /api/v1/categories', () => {
  it('returns eight categories ordered by sortOrder', async () => {
    const response = await request('/api/v1/categories')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<{ slug: string; sortOrder: number }>
    }
    expect(body.data).toHaveLength(8)
    expect(body.data.map((c) => c.slug)).toEqual([
      'camping',
      'hiking',
      'climbing',
      'cycling',
      'water',
      'fireside',
      'travel',
      'accessories',
    ])
  })
})
