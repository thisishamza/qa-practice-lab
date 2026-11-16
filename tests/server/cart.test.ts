import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { createMigratedD1, type MigratedD1 } from '../helpers/fake-d1'

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

interface CartBody {
  items: Array<{
    id: number
    slug: string
    name: string
    unitPriceCents: number
    quantity: number
    lineTotalCents: number
    productActive: boolean
    availableStock: number
    exceedsStock: boolean
    available: boolean
    stockStatus: string
  }>
  itemCount: number
  subtotalCents: number
  totalCents: number
  currency: string
  hasUnavailableItems: boolean
}

function extractSessionCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /mpl_session=([a-f0-9]{32})/.exec(setCookie)
  return match ? match[1] : null
}

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

async function cartGet(migrated: MigratedD1, token?: string) {
  const headers = token ? sessionCookieHeader(token) : {}
  return app.request('/api/v1/cart', { headers }, { DB: migrated.db })
}

async function cartAdd(
  migrated: MigratedD1,
  body: unknown,
  token?: string,
  rawBody?: string,
) {
  return app.request(
    '/api/v1/cart/items',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? sessionCookieHeader(token) : {}),
      },
      body: rawBody ?? JSON.stringify(body),
    },
    { DB: migrated.db },
  )
}

async function cartPatch(
  migrated: MigratedD1,
  id: number | string,
  body: unknown,
  token?: string,
) {
  return app.request(
    `/api/v1/cart/items/${id}`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(token ? sessionCookieHeader(token) : {}),
      },
      body: JSON.stringify(body),
    },
    { DB: migrated.db },
  )
}

async function cartDeleteItem(migrated: MigratedD1, id: number | string, token?: string) {
  return app.request(
    `/api/v1/cart/items/${id}`,
    { method: 'DELETE', headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
}

async function cartClear(migrated: MigratedD1, token?: string) {
  return app.request(
    '/api/v1/cart',
    { method: 'DELETE', headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
}

async function readBody(response: Response): Promise<CartBody> {
  return (await response.json()) as CartBody
}

/** Adds `slug` × `quantity` and returns { response, token }. */
async function addAndExtract(
  migrated: MigratedD1,
  slug: string,
  quantity?: number,
  token?: string,
) {
  const response = await cartAdd(migrated, quantity === undefined ? { slug } : { slug, quantity }, token)
  const newToken = extractSessionCookie(response.headers.get('set-cookie')) ?? token
  return { response, token: newToken }
}

describe('cart migration and schema', () => {
  const { sqlite } = createMigratedD1()

  it('records schema version 11 and creates the cart tables', () => {
    const row = sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('12')

    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('practice_sessions', 'carts', 'cart_items')",
      )
      .all() as { name: string }[]
    expect(tables.map((t) => t.name).sort()).toEqual(['cart_items', 'carts', 'practice_sessions'])
  })

  it('enforces the line quantity CHECK constraint in the database', () => {
    expect(() =>
      sqlite.prepare('INSERT INTO practice_sessions (token_hash, expires_at) VALUES (?, ?)').run(
        'a'.repeat(64),
        '2999-01-01T00:00:00.000Z',
      ),
    ).not.toThrow()
    const session = sqlite
      .prepare('SELECT id FROM practice_sessions WHERE token_hash = ?')
      .get('a'.repeat(64)) as { id: number }
    const cart = sqlite
      .prepare('INSERT INTO carts (session_id) VALUES (?) RETURNING id')
      .get(session.id) as { id: number }
    expect(() =>
      sqlite
        .prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)')
        .run(cart.id, 1, 0),
    ).toThrow()
    expect(() =>
      sqlite
        .prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)')
        .run(cart.id, 1, 100),
    ).toThrow()
  })

  it('rolls back a failed D1 batch instead of committing it partially', async () => {
    const { db } = createMigratedD1()
    await expect(
      db.batch([
        db.prepare('INSERT INTO practice_sessions (token_hash, expires_at) VALUES (?, ?)').bind(
          'b'.repeat(64),
          '2999-01-01T00:00:00.000Z',
        ),
        // Violates the quantity CHECK — the whole batch must fail.
        db.prepare(
          "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (1, 1, 0)",
        ),
      ]),
    ).rejects.toThrow()

    const session = await db
      .prepare('SELECT id FROM practice_sessions WHERE token_hash = ?')
      .bind('b'.repeat(64))
      .first()
    expect(session).toBeNull()
  })
})

describe('GET /api/v1/cart', () => {
  it('returns an empty cart without creating a session', async () => {
    const migrated = createMigratedD1()
    const response = await cartGet(migrated)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await readBody(response)).toMatchObject({
      items: [],
      itemCount: 0,
      subtotalCents: 0,
      totalCents: 0,
      currency: 'USD',
      hasUnavailableItems: false,
    })

    const sessions = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM practice_sessions')
      .get() as { n: number }
    expect(sessions.n).toBe(0)
  })

  it('clears a malformed session cookie and answers empty', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/cart',
      { headers: { cookie: 'mpl_session=not-a-token!' } },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    expect(await readBody(response)).toMatchObject({ items: [], itemCount: 0 })
    const cleared = response.headers.get('set-cookie') ?? ''
    expect(cleared).toContain('mpl_session=')
    expect(cleared).toMatch(/max-age=0/i)
  })

  it('clears a well-formed but unknown session token', async () => {
    const migrated = createMigratedD1()
    const response = await cartGet(migrated, 'f'.repeat(32))
    expect(response.status).toBe(200)
    expect(await readBody(response)).toMatchObject({ items: [] })
    expect(response.headers.get('set-cookie')).toMatch(/max-age=0/i)
  })

  it('treats an expired session as absent, purges it and clears the cookie', async () => {
    const migrated = createMigratedD1()
    const token = 'd'.repeat(32)
    const tokenHash = sha256Hex(token)

    // Seed an expired session with a line in its cart.
    migrated.sqlite
      .prepare('INSERT INTO practice_sessions (token_hash, expires_at) VALUES (?, ?)')
      .run(tokenHash, '2000-01-01T00:00:00.000Z')
    const session = migrated.sqlite
      .prepare('SELECT id FROM practice_sessions WHERE token_hash = ?')
      .get(tokenHash) as { id: number }
    migrated.sqlite.prepare('INSERT INTO carts (session_id) VALUES (?)').run(session.id)
    const cart = migrated.sqlite
      .prepare('SELECT id FROM carts WHERE session_id = ?')
      .get(session.id) as { id: number }
    migrated.sqlite
      .prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(cart.id, 1, 1)

    const response = await cartGet(migrated, token)
    expect(response.status).toBe(200)
    expect(await readBody(response)).toMatchObject({ items: [], itemCount: 0 })
    expect(response.headers.get('set-cookie')).toMatch(/max-age=0/i)

    // The expired session (and, by cascade, its cart) is purged.
    const sessions = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM practice_sessions')
      .get() as { n: number }
    expect(sessions.n).toBe(0)
    const carts = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM carts').get() as {
      n: number
    }
    expect(carts.n).toBe(0)
  })
})

describe('POST /api/v1/cart/items', () => {
  it('adds a product and mints the session cookie', async () => {
    const migrated = createMigratedD1()
    const { response, token } = await addAndExtract(migrated, 'sequoia-sleeping-bag', 2)

    expect(response.status).toBe(200)
    expect(token).toMatch(/^[a-f0-9]{32}$/)

    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('mpl_session=')
    expect(setCookie).toMatch(/httponly/i)
    expect(setCookie).toMatch(/samesite=strict/i)
    expect(setCookie).toMatch(/path=\//i)
    expect(setCookie).toMatch(/max-age=604800/i)

    const body = await readBody(response)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({
      slug: 'sequoia-sleeping-bag',
      quantity: 2,
      unitPriceCents: 12950,
      lineTotalCents: 25900,
      available: true,
    })
    expect(body.itemCount).toBe(2)
    expect(body.subtotalCents).toBe(25900)
    expect(body.totalCents).toBe(25900)
    expect(body.currency).toBe('USD')
  })

  it('defaults quantity to 1 when omitted', async () => {
    const migrated = createMigratedD1()
    const { response } = await addAndExtract(migrated, 'sequoia-sleeping-bag')
    expect((await readBody(response)).items[0].quantity).toBe(1)
  })

  it('ignores client-supplied price, total, name and stock fields', async () => {
    const migrated = createMigratedD1()
    const response = await cartAdd(
      migrated,
      undefined,
      undefined,
      JSON.stringify({
        slug: 'sequoia-sleeping-bag',
        quantity: 2,
        priceCents: 1,
        unitPriceCents: 1,
        totalCents: 0,
        lineTotalCents: 0,
        name: 'Free Tent',
        availableStock: 99999,
        productId: 999,
      }),
    )
    expect(response.status).toBe(200)
    const body = await readBody(response)
    expect(body.items[0].unitPriceCents).toBe(12950)
    expect(body.totalCents).toBe(25900)
    expect(body.items[0].name).toBe('Sequoia Sleeping Bag')
  })

  it('rejects malformed JSON bodies', async () => {
    const migrated = createMigratedD1()
    const response = await cartAdd(migrated, undefined, undefined, '{ not json')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_request' })
  })

  it('rejects a non-object body', async () => {
    const migrated = createMigratedD1()
    for (const body of ['"sequoia-sleeping-bag"', '[1,2]', '42', 'null']) {
      const response = await cartAdd(migrated, undefined, undefined, body)
      expect(response.status).toBe(400)
    }
  })

  it('rejects unknown and malformed slugs without minting a session', async () => {
    const migrated = createMigratedD1()
    for (const slug of ['no-such-product', 'BAD SLUG!', '', 'x'.repeat(200)]) {
      const response = await cartAdd(migrated, { slug })
      expect([400, 404]).toContain(response.status)
      const body = (await response.json()) as { error?: unknown }
      expect(body.error).toBeDefined()
    }
    const sessions = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM practice_sessions')
      .get() as { n: number }
    expect(sessions.n).toBe(0)
  })

  it('rejects unknown products with a 404 envelope', async () => {
    const migrated = createMigratedD1()
    const response = await cartAdd(migrated, { slug: 'no-such-product' })
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: 'not_found' })
  })

  it('rejects inactive products with a 404 envelope', async () => {
    const migrated = createMigratedD1()
    for (const slug of ['nightbeam-legacy-torch', 'expedition-map-case']) {
      const response = await cartAdd(migrated, { slug })
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ error: 'not_found' })
    }
  })

  it('rejects out-of-stock products with a 422 out_of_stock envelope', async () => {
    const migrated = createMigratedD1()
    const response = await cartAdd(migrated, { slug: 'driftline-gravel-frameset' })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'out_of_stock' })
    const sessions = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM practice_sessions')
      .get() as { n: number }
    expect(sessions.n).toBe(0)
  })

  it('rejects invalid quantities: zero, negative, fractional, strings, excessive', async () => {
    const migrated = createMigratedD1()
    for (const quantity of [0, -1, 1.5, '2', 100, Number.MAX_SAFE_INTEGER, null, {}, []]) {
      const response = await cartAdd(migrated, { slug: 'sequoia-sleeping-bag', quantity })
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: 'invalid_request' })
    }
  })

  it('enforces the stock ceiling on adds', async () => {
    const migrated = createMigratedD1()
    // Lumen USB Bike Light Set: inventory quantity 4.
    const tooMany = await cartAdd(migrated, { slug: 'lumen-usb-bike-light-set', quantity: 5 })
    expect(tooMany.status).toBe(422)
    expect(await tooMany.json()).toMatchObject({
      error: 'insufficient_stock',
      availableStock: 4,
      maxQuantity: 4,
    })

    const exact = await addAndExtract(migrated, 'lumen-usb-bike-light-set', 4)
    expect(exact.response.status).toBe(200)

    const oneMore = await cartAdd(
      migrated,
      { slug: 'lumen-usb-bike-light-set', quantity: 1 },
      exact.token,
    )
    expect(oneMore.status).toBe(422)
    expect(await oneMore.json()).toMatchObject({ error: 'insufficient_stock', maxQuantity: 4 })

    const body = await readBody(await cartGet(migrated, exact.token))
    expect(body.items[0].quantity).toBe(4)
  })

  it('accumulates quantity on repeat adds (single line per product)', async () => {
    const migrated = createMigratedD1()
    const first = await addAndExtract(migrated, 'sequoia-sleeping-bag', 1)
    const second = await cartAdd(migrated, { slug: 'sequoia-sleeping-bag', quantity: 2 }, first.token)
    const body = await readBody(second)
    expect(body.items).toHaveLength(1)
    expect(body.items[0].quantity).toBe(3)
  })

  it('recomputes prices from the database even if the price changed after the add', async () => {
    const migrated = createMigratedD1()
    const { token } = await addAndExtract(migrated, 'sequoia-sleeping-bag', 2)

    migrated.sqlite
      .prepare('UPDATE products SET price_cents = 9999 WHERE slug = ?')
      .run('sequoia-sleeping-bag')

    const body = await readBody(await cartGet(migrated, token))
    expect(body.items[0].unitPriceCents).toBe(9999)
    expect(body.items[0].lineTotalCents).toBe(19998)
    expect(body.totalCents).toBe(19998)
  })

  it('flags lines whose product was deactivated after being added', async () => {
    const migrated = createMigratedD1()
    const { token } = await addAndExtract(migrated, 'sequoia-sleeping-bag', 1)

    migrated.sqlite
      .prepare('UPDATE products SET active = 0 WHERE slug = ?')
      .run('sequoia-sleeping-bag')

    const body = await readBody(await cartGet(migrated, token))
    expect(body.items[0].productActive).toBe(false)
    expect(body.items[0].available).toBe(false)
    expect(body.hasUnavailableItems).toBe(true)
    // The line stays in the cart with the database-derived price.
    expect(body.totalCents).toBe(12950)
  })

  it('flags lines when stock drops below the line quantity', async () => {
    const migrated = createMigratedD1()
    const { token } = await addAndExtract(migrated, 'sequoia-sleeping-bag', 3)

    migrated.sqlite
      .prepare('UPDATE inventory SET quantity = 1 WHERE product_id = (SELECT id FROM products WHERE slug = ?)')
      .run('sequoia-sleeping-bag')

    const body = await readBody(await cartGet(migrated, token))
    expect(body.items[0].exceedsStock).toBe(true)
    expect(body.items[0].available).toBe(false)
    expect(body.hasUnavailableItems).toBe(true)
  })
})

describe('PATCH /api/v1/cart/items/:id', () => {
  async function seededCart() {
    const migrated = createMigratedD1()
    const { token } = await addAndExtract(migrated, 'sequoia-sleeping-bag', 2)
    const body = await readBody(await cartGet(migrated, token))
    return { migrated, token: token!, lineId: body.items[0].id }
  }

  it('sets the quantity and recomputes totals', async () => {
    const { migrated, token, lineId } = await seededCart()
    const response = await cartPatch(migrated, lineId, { quantity: 4 }, token)
    expect(response.status).toBe(200)
    const body = await readBody(response)
    expect(body.items[0].quantity).toBe(4)
    expect(body.subtotalCents).toBe(51800)
  })

  it('rejects invalid quantities', async () => {
    const { migrated, token, lineId } = await seededCart()
    for (const quantity of [0, -2, 1.5, '3', 100, null, 'abc']) {
      const response = await cartPatch(migrated, lineId, { quantity }, token)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: 'invalid_request' })
    }
  })

  it('rejects malformed item ids', async () => {
    const { migrated, token } = await seededCart()
    for (const id of ['abc', '0', '-1', '1.5', '1e3']) {
      const response = await cartPatch(migrated, id, { quantity: 1 }, token)
      expect(response.status).toBe(400)
    }
  })

  it('returns 404 for unknown items', async () => {
    const { migrated, token } = await seededCart()
    const response = await cartPatch(migrated, 999999, { quantity: 1 }, token)
    expect(response.status).toBe(404)
  })

  it('enforces the stock ceiling on updates', async () => {
    const migrated = createMigratedD1()
    // Ember LED Lantern: inventory quantity 4.
    const { token } = await addAndExtract(migrated, 'ember-led-lantern', 2)
    const body = await readBody(await cartGet(migrated, token))
    const response = await cartPatch(migrated, body.items[0].id, { quantity: 5 }, token)
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'insufficient_stock', maxQuantity: 4 })
  })

  it('ignores any client-supplied price or total on update', async () => {
    const { migrated, token, lineId } = await seededCart()
    const response = await cartPatch(
      migrated,
      lineId,
      { quantity: 1, unitPriceCents: 1, totalCents: 0 },
      token,
    )
    const body = await readBody(response)
    expect(body.items[0].unitPriceCents).toBe(12950)
    expect(body.totalCents).toBe(12950)
  })
})

describe('DELETE /api/v1/cart/items/:id and DELETE /api/v1/cart', () => {
  it('removes a line and is 404 on repeat or cross-session access', async () => {
    const migrated = createMigratedD1()
    const first = await addAndExtract(migrated, 'sequoia-sleeping-bag', 1)
    const second = await cartAdd(migrated, { slug: 'ember-led-lantern' }, first.token)
    const before = await readBody(second)
    expect(before.items).toHaveLength(2)
    const lantern = before.items.find((item) => item.slug === 'ember-led-lantern')!

    const other = await addAndExtract(migrated, 'ember-led-lantern', 1)
    const cross = await cartDeleteItem(migrated, lantern.id, other.token)
    expect(cross.status).toBe(404)

    const removed = await cartDeleteItem(migrated, lantern.id, first.token)
    expect(removed.status).toBe(200)
    const after = await readBody(removed)
    expect(after.items.map((item) => item.slug)).toEqual(['sequoia-sleeping-bag'])

    const repeat = await cartDeleteItem(migrated, lantern.id, first.token)
    expect(repeat.status).toBe(404)
  })

  it('clears every line and is idempotent', async () => {
    const migrated = createMigratedD1()
    const first = await addAndExtract(migrated, 'sequoia-sleeping-bag', 2)
    await cartAdd(migrated, { slug: 'ember-led-lantern' }, first.token)

    const cleared = await cartClear(migrated, first.token)
    expect(cleared.status).toBe(200)
    expect(await readBody(cleared)).toMatchObject({ items: [], itemCount: 0, totalCents: 0 })

    const again = await cartClear(migrated, first.token)
    expect(again.status).toBe(200)
    expect((await readBody(again)).items).toEqual([])
  })

  it('clearing without a session is an idempotent no-op', async () => {
    const migrated = createMigratedD1()
    const response = await cartClear(migrated)
    expect(response.status).toBe(200)
    expect(await readBody(response)).toMatchObject({ items: [], totalCents: 0 })
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})

describe('session isolation between practice sessions', () => {
  it('two browser sessions never see each other’s carts', async () => {
    const migrated = createMigratedD1()
    const a = await addAndExtract(migrated, 'sequoia-sleeping-bag', 2)
    const b = await addAndExtract(migrated, 'ember-led-lantern', 1)
    expect(a.token).not.toBe(b.token)

    const cartA = await readBody(await cartGet(migrated, a.token))
    const cartB = await readBody(await cartGet(migrated, b.token))
    expect(cartA.items.map((i) => i.slug)).toEqual(['sequoia-sleeping-bag'])
    expect(cartB.items.map((i) => i.slug)).toEqual(['ember-led-lantern'])
    expect(cartA.totalCents).toBe(25900)
    expect(cartB.totalCents).toBe(3299 * 1)

    const aLine = cartA.items[0].id
    expect((await cartPatch(migrated, aLine, { quantity: 9 }, b.token)).status).toBe(404)
    expect((await cartDeleteItem(migrated, aLine, b.token)).status).toBe(404)

    const after = await readBody(await cartGet(migrated, a.token))
    expect(after.items[0].quantity).toBe(2)
  })

  it('mints a fresh session for a caller presenting an expired cookie', async () => {
    const migrated = createMigratedD1()
    const token = 'e'.repeat(32)
    migrated.sqlite
      .prepare('INSERT INTO practice_sessions (token_hash, expires_at) VALUES (?, ?)')
      .run(sha256Hex(token), '2000-01-01T00:00:00.000Z')

    const added = await addAndExtract(migrated, 'sequoia-sleeping-bag', 1, token)
    expect(added.response.status).toBe(200)
    expect(added.token).toMatch(/^[a-f0-9]{32}$/)
    expect(added.token).not.toBe(token)

    const persisted = await cartGet(migrated, added.token)
    expect((await readBody(persisted)).items).toHaveLength(1)
  })

  it('does not leak cart lines across sessions even with direct id probing', async () => {
    const migrated = createMigratedD1()
    const a = await addAndExtract(migrated, 'sequoia-sleeping-bag', 1)
    const cartA = await readBody(await cartGet(migrated, a.token))
    const lineId = cartA.items[0].id

    const b = await addAndExtract(migrated, 'ember-led-lantern', 1)
    // Session B probes the known line id for A's cart.
    expect((await cartPatch(migrated, lineId, { quantity: 1 }, b.token)).status).toBe(404)
    expect((await cartDeleteItem(migrated, lineId, b.token)).status).toBe(404)

    // And the anonymous caller (no cookie at all) cannot touch it either.
    expect((await cartPatch(migrated, lineId, { quantity: 1 })).status).toBe(404)
    expect((await cartDeleteItem(migrated, lineId)).status).toBe(404)
  })
})

describe('response headers', () => {
  it('marks cart responses as no-store JSON', async () => {
    const migrated = createMigratedD1()
    const response = await cartGet(migrated)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
  })
})
