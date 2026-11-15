import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { createMigratedD1, type MigratedD1 } from '../helpers/fake-d1'

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function extractSessionCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /mpl_session=([a-f0-9]{32})/.exec(setCookie)
  return match ? match[1] : null
}

function validDetails(overrides: Record<string, unknown> = {}) {
  return {
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    shippingLine: '12 Analytical Engine Way',
    shippingCity: 'London',
    shippingPostcode: 'N1 9GU',
    paymentSimulation: 'approved',
    ...overrides,
  }
}

function idemKey(seed: string) {
  return `key-${seed.padStart(16, '0').slice(0, 16)}x`
}

async function addAndGetToken(
  migrated: MigratedD1,
  slug: string,
  quantity: number,
  token?: string,
) {
  const response = await app.request(
    '/api/v1/cart/items',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? sessionCookieHeader(token) : {}),
      },
      body: JSON.stringify({ slug, quantity }),
    },
    { DB: migrated.db },
  )
  const newToken = extractSessionCookie(response.headers.get('set-cookie')) ?? token
  return { response, token: newToken }
}

async function seedCheckoutCart(migrated: MigratedD1) {
  const first = await addAndGetToken(migrated, 'ridgeline-2-person-tent', 2)
  const token = first.token!
  const second = await addAndGetToken(migrated, 'sequoia-sleeping-bag', 1, token)
  expect(second.response.status).toBe(200)
  return token
}

async function checkout(
  migrated: MigratedD1,
  body: unknown,
  token?: string,
  idempotencyKey?: string,
  rawBody?: string,
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(token ? sessionCookieHeader(token) : {}),
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  }
  return app.request(
    '/api/v1/checkout',
    { method: 'POST', headers, body: rawBody ?? JSON.stringify(body) },
    { DB: migrated.db },
  )
}

async function getCheckout(migrated: MigratedD1, token?: string) {
  return app.request(
    '/api/v1/checkout',
    { headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
}

async function getOrder(migrated: MigratedD1, reference: string, token?: string) {
  return app.request(
    `/api/v1/orders/${reference}`,
    { headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
}

async function getOrders(migrated: MigratedD1, token?: string) {
  return app.request(
    '/api/v1/orders',
    { headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
}

interface OrderBody {
  reference: string
  status: string
  paymentStatus: string
  customerName: string
  customerEmail: string
  shippingLine: string
  shippingCity: string
  shippingPostcode: string
  subtotalCents: number
  totalCents: number
  itemCount: number
  currency: string
  createdAt: string
  items: Array<{
    id: number
    productId: number | null
    productSlug: string
    productName: string
    unitPriceCents: number
    currency: string
    quantity: number
    lineTotalCents: number
  }>
}

function stockOf(source: { sqlite: import('node:sqlite').DatabaseSync }, productId: number): number {
  const row = source.sqlite
    .prepare('SELECT quantity FROM inventory WHERE product_id = ?')
    .get(productId) as { quantity: number }
  return row.quantity
}

function orderCount(source: { sqlite: import('node:sqlite').DatabaseSync }): number {
  const row = source.sqlite.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }
  return row.n
}

function itemCountRows(source: { sqlite: import('node:sqlite').DatabaseSync }): number {
  const row = source.sqlite.prepare('SELECT COUNT(*) AS n FROM order_items').get() as {
    n: number
  }
  return row.n
}

describe('order schema and migration', () => {
  const { sqlite } = createMigratedD1()

  it('records schema version 4 and creates the order tables', () => {
    const row = sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('4')

    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('orders', 'order_items', 'checkout_idempotency')",
      )
      .all() as { name: string }[]
    expect(tables.map((t) => t.name).sort()).toEqual([
      'checkout_idempotency',
      'order_items',
      'orders',
    ])
  })

  it('enforces opaque, unique order references and session-scoped idempotency keys', () => {
    const session = sqlite
      .prepare("INSERT INTO practice_sessions (token_hash, expires_at) VALUES (?, ?)")
      .run('c'.repeat(64), '2999-01-01T00:00:00.000Z')
    void session
    const sid = (
      sqlite.prepare('SELECT id FROM practice_sessions WHERE token_hash = ?').get('c'.repeat(64)) as {
        id: number
      }
    ).id

    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO orders (session_id, reference, status, payment_status, customer_name, customer_email, shipping_line, shipping_city, shipping_postcode, subtotal_cents, total_cents) VALUES (?, ?, 'placed', 'approved', 'A', 'a@b.c', '1 Street', 'City', 'P1', 100, 100)",
        )
        .run(sid, 'ORD-DEADBEEF12345678'),
    ).not.toThrow()

    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO orders (session_id, reference, status, payment_status, customer_name, customer_email, shipping_line, shipping_city, shipping_postcode, subtotal_cents, total_cents) VALUES (?, ?, 'placed', 'approved', 'A', 'a@b.c', '1 Street', 'City', 'P1', 100, 100)",
        )
        .run(sid, 'ORD-DEADBEEF12345678'),
    ).toThrow()

    sqlite
      .prepare(
        "INSERT INTO checkout_idempotency (session_id, idempotency_key, request_hash, outcome) VALUES (?, 'key-one', 'hash-one', 'declined')",
      )
      .run(sid)
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO checkout_idempotency (session_id, idempotency_key, request_hash, outcome) VALUES (?, 'key-one', 'hash-two', 'declined')",
        )
        .run(sid),
    ).toThrow()
  })
})

describe('GET /api/v1/checkout', () => {
  it('returns an empty, non-checkoutable summary without creating a session', async () => {
    const migrated = createMigratedD1()
    const response = await getCheckout(migrated)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await response.json()).toMatchObject({ items: [], checkoutable: false })
  })

  it('reports checkoutable with current totals for a fulfullable cart', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const response = await getCheckout(migrated, token)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      itemCount: 3,
      checkoutable: true,
      hasUnavailableItems: false,
      // 2 × 18999 + 1 × 12950
      subtotalCents: 50948,
      totalCents: 50948,
    })
  })

  it('reports checkoutable false when a line became unavailable', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    migrated.sqlite.prepare('UPDATE products SET active = 0 WHERE id = 3').run()
    const response = await getCheckout(migrated, token)
    expect(await response.json()).toMatchObject({
      checkoutable: false,
      hasUnavailableItems: true,
    })
  })
})

describe('POST /api/v1/checkout — success', () => {
  it('places an order atomically: snapshot, stock decrement, cart cleared', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)

    const before = stockOf(migrated, 1) // 24
    const response = await checkout(migrated, validDetails(), token, idemKey('success1'))
    expect(response.status).toBe(201)

    const order = (await response.json()) as OrderBody
    expect(order.reference).toMatch(/^ORD-[0-9A-F]{16}$/)
    expect(order.reference).not.toMatch(/^[0-9]+$/) // opaque, not sequential
    expect(order.status).toBe('placed')
    expect(order.paymentStatus).toBe('approved')
    expect(order.itemCount).toBe(3)
    expect(order.subtotalCents).toBe(50948)
    expect(order.totalCents).toBe(50948)
    expect(order.currency).toBe('USD')
    expect(order.items).toHaveLength(2)

    const lines = new Map(order.items.map((item) => [item.productSlug, item]))
    expect(lines.get('ridgeline-2-person-tent')).toMatchObject({
      productName: 'Ridgeline 2-Person Tent',
      unitPriceCents: 18999,
      quantity: 2,
      lineTotalCents: 37998,
    })
    expect(lines.get('sequoia-sleeping-bag')).toMatchObject({
      productName: 'Sequoia Sleeping Bag',
      unitPriceCents: 12950,
      quantity: 1,
      lineTotalCents: 12950,
    })

    // Stock decremented exactly once.
    expect(stockOf(migrated, 1)).toBe(before - 2)
    expect(stockOf(migrated, 3)).toBe(29)

    // Cart cleared.
    const cartAfter = await app.request(
      '/api/v1/cart',
      { headers: sessionCookieHeader(token) },
      { DB: migrated.db },
    )
    expect(await cartAfter.json()).toMatchObject({ items: [], itemCount: 0 })
    expect(orderCount(migrated)).toBe(1)
    expect(itemCountRows(migrated)).toBe(2)
  })

  it('recomputes totals from the database when the price changed after cart addition', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    migrated.sqlite.prepare('UPDATE products SET price_cents = 15000 WHERE id = 1').run()

    const response = await checkout(migrated, validDetails(), token, idemKey('pricechange'))
    expect(response.status).toBe(201)
    const order = (await response.json()) as OrderBody
    const tent = order.items.find((item) => item.productSlug === 'ridgeline-2-person-tent')!
    // The snapshot holds the price at placement time, not the price seen in the cart.
    expect(tent.unitPriceCents).toBe(15000)
    expect(tent.lineTotalCents).toBe(30000)
    expect(order.subtotalCents).toBe(30000 + 12950)
  })

  it('keeps the snapshot when the product is renamed, repriced, deactivated and deleted', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const response = await checkout(migrated, validDetails(), token, idemKey('history1'))
    expect(response.status).toBe(201)
    const placed = (await response.json()) as OrderBody

    migrated.sqlite.prepare("UPDATE products SET name = 'Renamed Tent', price_cents = 1, active = 0 WHERE id = 1").run()
    migrated.sqlite.prepare('DELETE FROM products WHERE id = 1').run()

    const fetched = await getOrder(migrated, placed.reference, token)
    expect(fetched.status).toBe(200)
    const order = (await fetched.json()) as OrderBody
    const tent = order.items.find((item) => item.productSlug === 'ridgeline-2-person-tent')!
    expect(tent.productName).toBe('Ridgeline 2-Person Tent')
    expect(tent.unitPriceCents).toBe(18999)
    expect(tent.productId).toBeNull() // product row deleted; snapshot survives
  })

  it('lists the order in the session history, newest first, with item count', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    await checkout(migrated, validDetails(), token, idemKey('history2'))

    const response = await getOrders(migrated, token)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<{ reference: string; itemCount: number; totalCents: number; paymentStatus: string }>
    }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ itemCount: 3, totalCents: 50948, paymentStatus: 'approved' })
    expect(body.data[0].reference).toMatch(/^ORD-[0-9A-F]{16}$/)
  })
})

describe('POST /api/v1/checkout — stock and availability revalidation', () => {
  it('rejects when the product was deactivated after being added', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    migrated.sqlite.prepare('UPDATE products SET active = 0 WHERE id = 1').run()

    const response = await checkout(migrated, validDetails(), token, idemKey('block1'))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: 'cart_unavailable',
      lines: [expect.objectContaining({ slug: 'ridgeline-2-person-tent', reason: 'inactive' })],
    })
    // Full rollback: no order, no stock move, cart intact.
    expect(orderCount(migrated)).toBe(0)
    expect(stockOf(migrated, 1)).toBe(24)
    expect((migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM cart_items').get() as { n: number }).n).toBe(2)
  })

  it('rejects when stock dropped below the line quantity after being added', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    migrated.sqlite.prepare('UPDATE inventory SET quantity = 1 WHERE product_id = 1').run()

    const response = await checkout(migrated, validDetails(), token, idemKey('block2'))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: 'cart_unavailable',
      lines: [
        expect.objectContaining({ slug: 'ridgeline-2-person-tent', reason: 'insufficient_stock', availableStock: 1 }),
      ],
    })
    expect(orderCount(migrated)).toBe(0)
    expect(stockOf(migrated, 1)).toBe(1)
    expect((migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM cart_items').get() as { n: number }).n).toBe(2)
  })

  it('rejects when a line became completely out of stock', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    migrated.sqlite.prepare('UPDATE inventory SET quantity = 0 WHERE product_id = 3').run()

    const response = await checkout(migrated, validDetails(), token, idemKey('block3'))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: 'cart_unavailable',
      lines: [expect.objectContaining({ slug: 'sequoia-sleeping-bag', reason: 'out_of_stock' })],
    })
    expect(orderCount(migrated)).toBe(0)
    expect(stockOf(migrated, 3)).toBe(0)
  })

  it('a CHECK-violating mid-batch decrement rolls the whole batch back', async () => {
    // Proves the safety net the API relies on: if stock can't cover the
    // decrement at write time, the bad statement fails and D1/SQLite roll
    // back the order insert with it. No partial orders ever.
    const { db, sqlite } = createMigratedD1()
    sqlite
      .prepare(
        "INSERT INTO practice_sessions (token_hash, expires_at) VALUES (?, '2999-01-01T00:00:00.000Z')",
      )
      .run('d'.repeat(64))
    const sessionId = Number(
      (sqlite.prepare('SELECT id FROM practice_sessions WHERE token_hash = ?').get('d'.repeat(64)) as { id: number }).id,
    )
    const outcome = await db
      .batch([
        db.prepare(
          "INSERT INTO orders (session_id, reference, status, payment_status, customer_name, customer_email, shipping_line, shipping_city, shipping_postcode, subtotal_cents, total_cents) VALUES (?, 'ORD-0000000000000001', 'placed', 'approved', 'A', 'a@b.c', '1 Street', 'City', 'P1', 100, 100)",
        ).bind(sessionId),
        // Product 1 has stock 24; ask for more than that → CHECK (quantity >= 0) fails.
        db.prepare('UPDATE inventory SET quantity = quantity - 25 WHERE product_id = 1'),
      ])
      .then(
        () => 'committed',
        () => 'rolled-back',
      )
    expect(outcome).toBe('rolled-back')
    expect(orderCount({ sqlite } as never)).toBe(0)
    expect(stockOf({ sqlite } as never, 1)).toBe(24)
  })
})

describe('POST /api/v1/checkout — simulated payments', () => {
  it('declined payment: no order, stock and cart untouched', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const stockBefore = stockOf(migrated, 1)

    const response = await checkout(
      migrated,
      validDetails({ paymentSimulation: 'declined' }),
      token,
      idemKey('decline1'),
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'payment_declined' })

    expect(orderCount(migrated)).toBe(0)
    expect(itemCountRows(migrated)).toBe(0)
    expect(stockOf(migrated, 1)).toBe(stockBefore)
    expect((migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM cart_items').get() as { n: number }).n).toBe(2)

    const record = migrated.sqlite
      .prepare('SELECT outcome FROM checkout_idempotency WHERE idempotency_key = ?')
      .get(idemKey('decline1')) as { outcome: string }
    expect(record.outcome).toBe('declined')
  })

  it('declined replay with the same key returns the decline, flagged as a replay', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const body = validDetails({ paymentSimulation: 'declined' })
    const first = await checkout(migrated, body, token, idemKey('decline2'))
    expect(first.status).toBe(422)

    const second = await checkout(migrated, body, token, idemKey('decline2'))
    expect(second.status).toBe(422)
    expect(second.headers.get('Idempotent-Replay')).toBe('true')
    expect(await second.json()).toMatchObject({ error: 'payment_declined' })
    expect(orderCount(migrated)).toBe(0)
  })

  it('same key with a materially different payload is rejected with 409', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const first = await checkout(
      migrated,
      validDetails({ paymentSimulation: 'declined' }),
      token,
      idemKey('drift1'),
    )
    expect(first.status).toBe(422)

    const drift = await checkout(
      migrated,
      validDetails({ customerName: 'Grace Hopper', paymentSimulation: 'declined' }),
      token,
      idemKey('drift1'),
    )
    expect(drift.status).toBe(409)
    expect(await drift.json()).toMatchObject({ error: 'idempotency_conflict' })
    expect(orderCount(migrated)).toBe(0)
  })

  it('an unsupported payment simulation value is rejected', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const response = await checkout(
      migrated,
      validDetails({ paymentSimulation: 'yes' }),
      token,
      idemKey('badpayment'),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_request' })
  })
})

describe('POST /api/v1/checkout — idempotency', () => {
  it('same key and same request replays the original order; stock moves once', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const stockBefore = stockOf(migrated, 1)
    const body = validDetails()

    const first = await checkout(migrated, body, token, idemKey('replay1'))
    expect(first.status).toBe(201)
    const firstOrder = (await first.json()) as OrderBody

    const second = await checkout(migrated, body, token, idemKey('replay1'))
    expect(second.status).toBe(201)
    expect(second.headers.get('Idempotent-Replay')).toBe('true')
    const secondOrder = (await second.json()) as OrderBody
    expect(secondOrder.reference).toBe(firstOrder.reference)

    expect(orderCount(migrated)).toBe(1)
    expect(stockOf(migrated, 1)).toBe(stockBefore - 2)
    expect(stockOf(migrated, 3)).toBe(29)
  })

  it('same key with a different checkout payload returns 409 and places nothing new', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const first = await checkout(migrated, validDetails(), token, idemKey('replay2'))
    expect(first.status).toBe(201)

    const drift = await checkout(
      migrated,
      validDetails({ shippingCity: 'Manchester' }),
      token,
      idemKey('replay2'),
    )
    expect(drift.status).toBe(409)
    expect(await drift.json()).toMatchObject({ error: 'idempotency_conflict' })
    expect(orderCount(migrated)).toBe(1)
  })

  it('a different key places a second, independent order', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const first = await checkout(migrated, validDetails(), token, idemKey('replay3a'))
    expect(first.status).toBe(201)

    // The first order cleared the cart — restock it before ordering again.
    const refill = await addAndGetToken(migrated, 'sequoia-sleeping-bag', 1, token)
    expect(refill.response.status).toBe(200)

    const second = await checkout(migrated, validDetails(), token, idemKey('replay3b'))
    expect(second.status).toBe(201)
    const a = (await first.json()) as OrderBody
    const b = (await second.json()) as OrderBody
    expect(a.reference).not.toBe(b.reference)
    expect(orderCount(migrated)).toBe(2)
  })

  it('two identical concurrent submissions create exactly one order', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const body = validDetails()
    const stockBefore = stockOf(migrated, 1)

    const [a, b] = await Promise.all([
      checkout(migrated, body, token, idemKey('concurrent1')),
      checkout(migrated, body, token, idemKey('concurrent1')),
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 201])
    const orderA = (await a.json()) as OrderBody
    const orderB = (await b.json()) as OrderBody
    expect(orderA.reference).toBe(orderB.reference)

    expect(orderCount(migrated)).toBe(1)
    expect(stockOf(migrated, 1)).toBe(stockBefore - 2)
    expect(stockOf(migrated, 3)).toBe(29)
  })

  it('concurrent submissions with the same key but different payloads yield one order and one 409', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const [a, b] = await Promise.all([
      checkout(migrated, validDetails({ customerName: 'Ada Lovelace' }), token, idemKey('concurrent2')),
      checkout(migrated, validDetails({ customerName: 'Grace Hopper' }), token, idemKey('concurrent2')),
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 409])
    expect(orderCount(migrated)).toBe(1)
  })

  it('a retry with the same key after a failed (unavailable) checkout replays cleanly once fixed', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    migrated.sqlite.prepare('UPDATE inventory SET quantity = 1 WHERE product_id = 1').run()

    const failed = await checkout(migrated, validDetails(), token, idemKey('retryfix'))
    expect(failed.status).toBe(422)

    // Fix the blocker (reduce the line quantity in the cart) with the same key.
    const lineId = (
      migrated.sqlite
        .prepare("SELECT ci.id FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE p.slug = 'ridgeline-2-person-tent'")
        .get() as { id: number }
    ).id
    const patch = await app.request(
      `/api/v1/cart/items/${lineId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(token) },
        body: JSON.stringify({ quantity: 1 }),
      },
      { DB: migrated.db },
    )
    expect(patch.status).toBe(200)

    const retried = await checkout(migrated, validDetails(), token, idemKey('retryfix'))
    expect(retried.status).toBe(201)
    expect(orderCount(migrated)).toBe(1)
  })

  it('an invalid Idempotency-Key header is rejected with 400', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const response = await checkout(migrated, validDetails(), token, 'not ok!!')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_request' })
  })
})

describe('POST /api/v1/checkout — input validation', () => {
  it('rejects malformed JSON', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const response = await checkout(migrated, null, token, idemKey('badjson'), '{not json')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_request' })
  })

  it('reports every missing required field', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const response = await checkout(migrated, {}, token, idemKey('missing1'))
    expect(response.status).toBe(400)
    const body = (await response.json()) as { fields: Record<string, string> }
    expect(Object.keys(body.fields).sort()).toEqual([
      'customerEmail',
      'customerName',
      'paymentSimulation',
      'shippingCity',
      'shippingLine',
      'shippingPostcode',
    ])
  })

  it('rejects an invalid email, digit-containing name, bad postcode and newline in the street line', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)

    const badEmail = await checkout(migrated, validDetails({ customerEmail: 'not-an-email' }), token, idemKey('v1'))
    expect(badEmail.status).toBe(400)
    expect(((await badEmail.json()) as { fields: Record<string, string> }).fields.customerEmail).toBeTruthy()

    const badName = await checkout(migrated, validDetails({ customerName: 'Ada 123' }), token, idemKey('v2'))
    expect(badName.status).toBe(400)

    const badPostcode = await checkout(migrated, validDetails({ shippingPostcode: '!!' }), token, idemKey('v3'))
    expect(badPostcode.status).toBe(400)

    const badLine = await checkout(
      migrated,
      validDetails({ shippingLine: '12 Analytical\nEngine Way' }),
      token,
      idemKey('v4'),
    )
    expect(badLine.status).toBe(400)
  })

  it('rejects checkout with an empty cart, and reports a missing session the same way', async () => {
    const migrated = createMigratedD1()
    const noSession = await checkout(migrated, validDetails(), undefined, idemKey('empty1'))
    expect(noSession.status).toBe(422)
    expect(await noSession.json()).toMatchObject({ error: 'empty_cart' })

    const session = await addAndGetToken(migrated, 'ridgeline-2-person-tent', 1)
    const cleared = await app.request(
      '/api/v1/cart',
      { method: 'DELETE', headers: sessionCookieHeader(session.token!) },
      { DB: migrated.db },
    )
    expect(cleared.status).toBe(200)
    const response = await checkout(migrated, validDetails(), session.token, idemKey('empty2'))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'empty_cart' })
    expect(orderCount(migrated)).toBe(0)
  })
})

describe('GET /api/v1/orders — session scoping', () => {
  it('a different session cannot read the order; unknown references are 404', async () => {
    const migrated = createMigratedD1()
    const tokenA = await seedCheckoutCart(migrated)
    const placed = await checkout(migrated, validDetails(), tokenA, idemKey('scope1'))
    const order = (await placed.json()) as OrderBody

    // Session B: neither the reference nor the list reveals A's order.
    const tokenB = await addAndGetToken(migrated, 'sequoia-sleeping-bag', 1).then((r) => r.token!)
    const foreignRead = await getOrder(migrated, order.reference, tokenB)
    expect(foreignRead.status).toBe(404)
    const foreignList = await getOrders(migrated, tokenB)
    expect(await foreignList.json()).toEqual({ data: [] })

    // Owner can read it; the reference is opaque and unguessable by format alone.
    const ownRead = await getOrder(migrated, order.reference, tokenA)
    expect(ownRead.status).toBe(200)
    const unknown = await getOrder(migrated, 'ORD-0000000000000000', tokenA)
    expect(unknown.status).toBe(404)
  })

  it('malformed references are rejected with 400 and never leak existence', async () => {
    const migrated = createMigratedD1()
    const token = await seedCheckoutCart(migrated)
    const response = await getOrder(migrated, '1; DROP TABLE orders;--', token)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_request' })
  })
})
