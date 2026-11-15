// P3-M6 — inventory integrity, staff authorization and order cancellation.
// These tests run against the real migration SQL (node:sqlite harness), not
// hand-written stubs, so the CHECK constraints and batch rollback semantics
// under test are the ones production relies on.

import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { createMigratedD1, type MigratedD1 } from '../helpers/fake-d1'

const AMARA = { email: 'amara.okafor@example.com', password: 'demo-amara-1001' }
const BEN = { email: 'ben.whitmore@example.net', password: 'demo-ben-1002' }
const ROWAN = { email: 'rowan.ellison@example.com', password: 'demo-rowan-9001' } // staff
const DANA = { email: 'dana.reyes@example.com', password: 'demo-dana-1004' } // suspended

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function bothCookies(session: string | null, customer: string | null) {
  return [
    session ? `mpl_session=${session}` : null,
    customer ? `mpl_customer=${customer}` : null,
  ]
    .filter((value): value is string => value !== null)
    .join('; ')
}

function extractCookie(setCookie: string | null, name: string): string | null {
  if (!setCookie) return null
  const match = new RegExp(`${name}=([a-f0-9]{32})`).exec(setCookie)
  return match ? match[1] : null
}

function allSetCookies(response: Response): string {
  const headers = response.headers as unknown as {
    getSetCookie?: () => string[]
    get(name: string): string | null
  }
  const list = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie') ?? '']
  return list.join('; ')
}

async function signIn(migrated: MigratedD1, email: string, password: string, cookie?: string) {
  const response = await app.request(
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ email, password }),
    },
    { DB: migrated.db },
  )
  const joined = allSetCookies(response)
  const session = extractCookie(joined, 'mpl_session') ?? extractCookie(cookie ?? null, 'mpl_session')
  const customer = extractCookie(joined, 'mpl_customer')
  return { response, session, customer }
}

async function addToCart(migrated: MigratedD1, slug: string, cookie?: string) {
  return app.request(
    '/api/v1/cart/items',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ slug, quantity: 1 }),
    },
    { DB: migrated.db },
  )
}

function validDetails() {
  return {
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    shippingLine: '12 Analytical Engine Way',
    shippingCity: 'London',
    shippingPostcode: 'N1 9GU',
    paymentSimulation: 'approved',
  }
}

/** Places an order end-to-end as the given browser session; returns the reference. */
async function placeOrder(
  migrated: MigratedD1,
  slug: string,
  cookies?: string,
): Promise<{ reference: string | null; cookie: string }> {
  const added = await addToCart(migrated, slug, cookies)
  const session = extractCookie(allSetCookies(added), 'mpl_session')
  const finalCookie = cookies && cookies.includes('mpl_session') ? cookies : `mpl_session=${session ?? ''}`
  const placed = await app.request(
    '/api/v1/checkout',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: finalCookie },
      body: JSON.stringify(validDetails()),
    },
    { DB: migrated.db },
  )
  const body = (await placed.json()) as { reference?: string }
  return { reference: body.reference ?? null, cookie: finalCookie }
}

function inventoryQuantity(migrated: MigratedD1, productId: number): number {
  const row = migrated.sqlite
    .prepare('SELECT quantity FROM inventory WHERE product_id = ?')
    .get(productId) as { quantity: number }
  return row.quantity
}

/** Signs Rowan (staff) in and returns the fresh cookie pair. */
async function staffCookies(migrated: MigratedD1) {
  const { response, session, customer } = await signIn(migrated, ROWAN.email, ROWAN.password)
  expect(response.status).toBe(200)
  return bothCookies(session, customer)
}

async function restock(
  migrated: MigratedD1,
  productId: number | string,
  body: unknown,
  cookie?: string,
) {
  return app.request(
    `/api/v1/admin/inventory/${productId}`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    },
    { DB: migrated.db },
  )
}

async function cancelOrder(migrated: MigratedD1, reference: string, cookie?: string) {
  return app.request(
    `/api/v1/orders/${reference}/cancel`,
    { method: 'POST', headers: cookie ? { cookie } : {} },
    { DB: migrated.db },
  )
}

describe('staff restock authorization', () => {
  it('answers 401 to a cookieless guest', async () => {
    const migrated = createMigratedD1()
    const response = await restock(migrated, 1, { quantity: 5 })
    expect(response.status).toBe(401)
    expect(((await response.json()) as { error: string }).error).toBe('unauthorized')
    expect(inventoryQuantity(migrated, 1)).toBe(24)
  })

  it('answers 401 to a guest who only holds an anonymous practice session', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, 'ridgeline-2-person-tent')
    const session = extractCookie(allSetCookies(added), 'mpl_session')
    const response = await restock(
      migrated,
      1,
      { quantity: 5 },
      sessionCookieHeader(session!).cookie,
    )
    expect(response.status).toBe(401)
    expect(inventoryQuantity(migrated, 1)).toBe(24)
  })

  it('answers 403 staff_required to an active customer, even with a forged role in the body', async () => {
    const migrated = createMigratedD1()
    const { response, session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    expect(response.status).toBe(200)
    const cookie = bothCookies(session, customer)

    const plain = await restock(migrated, 1, { quantity: 5 }, cookie)
    expect(plain.status).toBe(403)
    expect(((await plain.json()) as { error: string }).error).toBe('staff_required')

    const forged = await restock(
      migrated,
      1,
      { quantity: 5, role: 'staff', customerId: 5, actorCustomerId: 5 },
      cookie,
    )
    expect(forged.status).toBe(403)
    expect(((await forged.json()) as { error: string }).error).toBe('staff_required')
    expect(inventoryQuantity(migrated, 1)).toBe(24)

    // No adjustment rows were written by the rejected attempts.
    const adjustments = migrated.sqlite
      .prepare("SELECT COUNT(*) AS n FROM inventory_adjustments WHERE reason = 'restock'")
      .get() as { n: number }
    expect(adjustments.n).toBe(0)
  })

  it('answers 403 account_suspended to a suspended account', async () => {
    const migrated = createMigratedD1()
    const { response } = await signIn(migrated, DANA.email, DANA.password)
    // Dana is seeded suspended — sign-in itself is refused with 403.
    expect(response.status).toBe(403)
    expect(((await response.json()) as { error: string }).error).toBe('account_suspended')
    // Suspending Rowan mid-session also flips protected endpoints to 403.
    const staffer = await signIn(migrated, ROWAN.email, ROWAN.password)
    migrated.sqlite.prepare("UPDATE customers SET status = 'suspended' WHERE email = ?").run(ROWAN.email)
    const cookie = bothCookies(staffer.session, staffer.customer)
    const suspended = await restock(migrated, 1, { quantity: 5 }, cookie)
    expect(suspended.status).toBe(403)
    expect(((await suspended.json()) as { error: string }).error).toBe('account_suspended')
  })

  it('rejects a staff customer session replayed against another practice session', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, ROWAN.email, ROWAN.password)
    // Mint an unrelated practice session B.
    const added = await addToCart(migrated, 'ridgeline-2-person-tent')
    const sessionB = extractCookie(allSetCookies(added), 'mpl_session')
    expect(sessionB).toBeTruthy()
    expect(sessionB).not.toBe(session)

    const replayed = await restock(
      migrated,
      1,
      { quantity: 5 },
      bothCookies(sessionB, customer),
    )
    expect(replayed.status).toBe(401)
    expect(inventoryQuantity(migrated, 1)).toBe(24)
  })

  it('allows staff and records the actor in an immutable adjustment', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)

    const response = await restock(migrated, 5, { quantity: 7, note: 'Stocktake recount' }, cookie)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      inventory: { quantity: number; stockStatus: string }
      adjustment: { id: number; quantityDelta: number; reason: string; note: string | null; actorCustomerId: number }
    }
    expect(body.inventory.quantity).toBe(11)
    expect(body.adjustment.quantityDelta).toBe(7)
    expect(body.adjustment.reason).toBe('restock')
    expect(body.adjustment.note).toBe('Stocktake recount')
    expect(body.adjustment.actorCustomerId).toBe(5) // Rowan, not a body-supplied id

    const adjustment = migrated.sqlite
      .prepare("SELECT product_id, quantity_delta, reason, note, actor_customer_id FROM inventory_adjustments WHERE reason = 'restock'")
      .get() as {
      product_id: number
      quantity_delta: number
      reason: string
      note: string | null
      actor_customer_id: number
    }
    expect(adjustment.product_id).toBe(5)
    expect(adjustment.quantity_delta).toBe(7)
    expect(adjustment.actor_customer_id).toBe(5)

    expect(inventoryQuantity(migrated, 5)).toBe(11)
  })

  it('catalogue detail reflects the restocked quantity without a re-seed', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)
    // Product 5 starts at 4 units (low_stock) — restock to comfortably in_stock.
    const before = await app.request('/api/v1/products/ember-led-lantern', {}, { DB: migrated.db })
    expect(((await before.json()) as { stockStatus: string }).stockStatus).toBe('low_stock')

    const response = await restock(migrated, 5, { quantity: 30 }, cookie)
    expect(response.status).toBe(200)

    const after = await app.request('/api/v1/products/ember-led-lantern', {}, { DB: migrated.db })
    expect(((await after.json()) as { stockStatus: string }).stockStatus).toBe('in_stock')
  })
})

describe('staff restock validation', () => {
  it('rejects zero, negative, fractional, textual and missing quantities with 400', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)
    for (const body of [
      { quantity: 0 },
      { quantity: -3 },
      { quantity: 2.5 },
      { quantity: '10' },
      {},
      { note: 'no quantity at all' },
    ]) {
      const response = await restock(migrated, 1, body, cookie)
      expect(response.status).toBe(400)
      expect(((await response.json()) as { error: string }).error).toBe('invalid_request')
    }
    expect(inventoryQuantity(migrated, 1)).toBe(24)
  })

  it('rejects excessive quantities with 400', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)
    const response = await restock(migrated, 1, { quantity: 10_001 }, cookie)
    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: string }).error).toBe('invalid_request')
    expect(inventoryQuantity(migrated, 1)).toBe(24)
  })

  it('rejects a restock that would exceed the absolute inventory ceiling (422, no adjustment recorded)', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)
    migrated.sqlite.prepare('UPDATE inventory SET quantity = 999999 WHERE product_id = 1').run()

    const response = await restock(migrated, 1, { quantity: 10 }, cookie)
    expect(response.status).toBe(422)
    expect(((await response.json()) as { error: string }).error).toBe('stock_limit_exceeded')
    expect(inventoryQuantity(migrated, 1)).toBe(999_999)

    const adjustments = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM inventory_adjustments')
      .get() as { n: number }
    expect(adjustments.n).toBe(0)
  })

  it('rejects oversized or control-character notes with 400', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)
    const tooLong = await restock(migrated, 1, { quantity: 1, note: 'x'.repeat(201) }, cookie)
    expect(tooLong.status).toBe(400)
    const control = await restock(migrated, 1, { quantity: 1, note: 'line\nbreak' }, cookie)
    expect(control.status).toBe(400)
    expect(inventoryQuantity(migrated, 1)).toBe(24)
  })

  it('answers 404 for an unknown product id and 400 for a malformed one', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)
    const missing = await restock(migrated, 9999, { quantity: 1 }, cookie)
    expect(missing.status).toBe(404)
    const malformed = await restock(migrated, 'abc', { quantity: 1 }, cookie)
    expect(malformed.status).toBe(400)
  })

  it('allows restocking a discontinued (inactive) product', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)
    // Product 41 is seeded inactive; historical orders must stay serviceable.
    const response = await restock(migrated, 41, { quantity: 3 }, cookie)
    expect(response.status).toBe(200)
    expect(inventoryQuantity(migrated, 41)).toBe(103)
  })

  it('serves the staff inventory list to staff only', async () => {
    const migrated = createMigratedD1()
    const cookie = await staffCookies(migrated)
    const staffList = await app.request('/api/v1/admin/inventory', { headers: { cookie } }, { DB: migrated.db })
    expect(staffList.status).toBe(200)
    const body = (await staffList.json()) as { data: Array<{ productId: number; quantity: number; stockStatus: string }>; total: number }
    expect(body.total).toBeGreaterThanOrEqual(42)
    expect(body.data.find((item) => item.productId === 1)?.quantity).toBe(24)

    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    const denied = await app.request(
      '/api/v1/admin/inventory',
      { headers: { cookie: bothCookies(amara.session, amara.customer) } },
      { DB: migrated.db },
    )
    expect(denied.status).toBe(403)

    const guest = await app.request('/api/v1/admin/inventory', {}, { DB: migrated.db })
    expect(guest.status).toBe(401)
  })
})

describe('order cancellation', () => {
  it('cancels a placed order, restores stock exactly once and is idempotent on retry', async () => {
    const migrated = createMigratedD1()
    const before = inventoryQuantity(migrated, 1)

    const { reference, cookie } = await placeOrder(migrated, 'ridgeline-2-person-tent')
    expect(reference).not.toBeNull()
    expect(inventoryQuantity(migrated, 1)).toBe(before - 1)

    const cancelled = await cancelOrder(migrated, reference!, cookie)
    expect(cancelled.status).toBe(200)
    const body = (await cancelled.json()) as { status: string; cancelledAt: string | null }
    expect(body.status).toBe('cancelled')
    expect(body.cancelledAt).toBeTruthy()
    expect(inventoryQuantity(migrated, 1)).toBe(before)

    // Retry: same HTTP 200, no further stock movement, no duplicate marker.
    const again = await cancelOrder(migrated, reference!, cookie)
    expect(again.status).toBe(200)
    expect(((await again.json()) as { status: string }).status).toBe('cancelled')
    expect(inventoryQuantity(migrated, 1)).toBe(before)

    const markers = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM order_cancellations')
      .get() as { n: number }
    expect(markers.n).toBe(1)

    const restores = migrated.sqlite
      .prepare("SELECT COUNT(*) AS n, SUM(quantity_delta) AS units FROM inventory_adjustments WHERE reason = 'order_cancellation'")
      .get() as { n: number; units: number }
    expect(restores.n).toBe(1)
    expect(restores.units).toBe(1)
  })

  it('shows the cancelled status on session confirmation, history and account history', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    const { reference, cookie } = await placeOrder(
      migrated,
      'ridgeline-2-person-tent',
      bothCookies(session, customer),
    )

    await cancelOrder(migrated, reference!, cookie)

    const confirmation = await app.request(
      `/api/v1/orders/${reference}`,
      { headers: { cookie } },
      { DB: migrated.db },
    )
    expect(((await confirmation.json()) as { status: string }).status).toBe('cancelled')

    const history = await app.request('/api/v1/orders', { headers: { cookie } }, { DB: migrated.db })
    const historyBody = (await history.json()) as { data: Array<{ reference: string; status: string }> }
    expect(historyBody.data.find((order) => order.reference === reference)?.status).toBe('cancelled')

    const accountHistory = await app.request(
      '/api/v1/account/orders',
      { headers: { cookie } },
      { DB: migrated.db },
    )
    const accountBody = (await accountHistory.json()) as { data: Array<{ reference: string; status: string }> }
    expect(accountBody.data.find((order) => order.reference === reference)?.status).toBe('cancelled')
  })

  it('restores every line of a multi-item order, recorded with the order id', async () => {
    const migrated = createMigratedD1()
    const first = inventoryQuantity(migrated, 1)
    const second = inventoryQuantity(migrated, 3)

    const { response: login, session, customer } = await signIn(migrated, BEN.email, BEN.password)
    expect(login.status).toBe(200)
    const cookie = bothCookies(session, customer)
    await addToCart(migrated, 'ridgeline-2-person-tent', cookie)
    const addedBag = await addToCart(migrated, 'sequoia-sleeping-bag', cookie)
    expect(addedBag.status).toBe(200)
    const placed = await app.request(
      '/api/v1/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(validDetails()),
      },
      { DB: migrated.db },
    )
    const reference = ((await placed.json()) as { reference: string }).reference

    expect(inventoryQuantity(migrated, 1)).toBe(first - 1)
    expect(inventoryQuantity(migrated, 3)).toBe(second - 1)

    const cancelled = await cancelOrder(migrated, reference, cookie)
    expect(cancelled.status).toBe(200)
    expect(inventoryQuantity(migrated, 1)).toBe(first)
    expect(inventoryQuantity(migrated, 3)).toBe(second)

    const rows = migrated.sqlite
      .prepare("SELECT product_id, quantity_delta FROM inventory_adjustments WHERE reason = 'order_cancellation' ORDER BY product_id")
      .all() as Array<{ product_id: number; quantity_delta: number }>
    expect(rows).toEqual([
      { product_id: 1, quantity_delta: 1 },
      { product_id: 3, quantity_delta: 1 },
    ])
  })

  it('cannot be performed by a foreign session (404 concealed)', async () => {
    const migrated = createMigratedD1()
    const { reference } = await placeOrder(migrated, 'ridgeline-2-person-tent')

    const foreign = await addToCart(migrated, 'sequoia-sleeping-bag')
    const foreignSession = extractCookie(allSetCookies(foreign), 'mpl_session')!
    const response = await cancelOrder(
      migrated,
      reference!,
      sessionCookieHeader(foreignSession).cookie,
    )
    expect(response.status).toBe(404)
    expect(inventoryQuantity(migrated, 1)).toBe(23)
  })

  it('cannot be performed by a foreign customer (404 concealed)', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    const { reference } = await placeOrder(
      migrated,
      'ridgeline-2-person-tent',
      bothCookies(session, customer),
    )
    const ben = await signIn(migrated, BEN.email, BEN.password)
    const response = await cancelOrder(migrated, reference!, bothCookies(ben.session, ben.customer))
    expect(response.status).toBe(404)
    expect(inventoryQuantity(migrated, 1)).toBe(23)
  })

  it('can be performed by the owning customer from a fresh practice session', async () => {
    const migrated = createMigratedD1()
    const first = await signIn(migrated, AMARA.email, AMARA.password)
    const { reference } = await placeOrder(
      migrated,
      'ridgeline-2-person-tent',
      bothCookies(first.session, first.customer),
    )
    // Sign in again in what is, from the server's perspective, a new browser
    // on a new practice session — the customer binding still owns the order.
    const second = await signIn(migrated, AMARA.email, AMARA.password)
    const response = await cancelOrder(migrated, reference!, bothCookies(second.session, second.customer))
    expect(response.status).toBe(200)
    expect(((await response.json()) as { status: string }).status).toBe('cancelled')
  })

  it('answers 404 for an unknown reference and 400 for a malformed one', async () => {
    const migrated = createMigratedD1()
    const malformed = await cancelOrder(migrated, 'ORD-XYZ', undefined)
    expect(malformed.status).toBe(400)
    const unknown = await cancelOrder(migrated, 'ORD-0000000000000000', undefined)
    expect(unknown.status).toBe(404)
  })
})

describe('checkout stock consistency under races', () => {
  it('two concurrent checkouts for the last unit produce exactly one winner', async () => {
    const migrated = createMigratedD1()
    migrated.sqlite.prepare('UPDATE inventory SET quantity = 1 WHERE product_id = 1').run()

    const first = await addToCart(migrated, 'ridgeline-2-person-tent')
    const sessionA = extractCookie(allSetCookies(first), 'mpl_session')!
    const second = await addToCart(migrated, 'ridgeline-2-person-tent')
    const sessionB = extractCookie(allSetCookies(second), 'mpl_session')!

    const [resultA, resultB] = await Promise.all([
      app.request(
        '/api/v1/checkout',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...sessionCookieHeader(sessionA),
          },
          body: JSON.stringify(validDetails()),
        },
        { DB: migrated.db },
      ),
      app.request(
        '/api/v1/checkout',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...sessionCookieHeader(sessionB),
          },
          body: JSON.stringify(validDetails()),
        },
        { DB: migrated.db },
      ),
    ])

    const statuses = [resultA.status, resultB.status].sort()
    expect(statuses).toEqual([201, 422])
    expect(inventoryQuantity(migrated, 1)).toBe(0)

    const orders = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }
    expect(orders.n).toBe(1)
  })

  it('checkout re-checks stock at placement: sold-out after cart add → 422, cart kept', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, 'ridgeline-2-person-tent')
    const session = extractCookie(allSetCookies(added), 'mpl_session')!
    // Someone else buys the whole pool between cart and checkout.
    migrated.sqlite.prepare('UPDATE inventory SET quantity = 0 WHERE product_id = 1').run()

    const placed = await app.request(
      '/api/v1/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...sessionCookieHeader(session) },
        body: JSON.stringify(validDetails()),
      },
      { DB: migrated.db },
    )
    expect(placed.status).toBe(422)
    expect(((await placed.json()) as { error: string }).error).toBe('cart_unavailable')

    const cart = await app.request('/api/v1/cart', { headers: sessionCookieHeader(session) }, { DB: migrated.db })
    const cartBody = (await cart.json()) as { items: Array<{ slug: string }> }
    expect(cartBody.items.map((item) => item.slug)).toContain('ridgeline-2-person-tent')
  })

  it('stock never goes negative: CHECK constraint holds even for a hostile direct update', async () => {
    const migrated = createMigratedD1()
    expect(() =>
      migrated.sqlite.prepare('UPDATE inventory SET quantity = quantity - 25 WHERE product_id = 1').run(),
    ).toThrow(/CHECK/i)
    expect(inventoryQuantity(migrated, 1)).toBe(24)
  })
})
