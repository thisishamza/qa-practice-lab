// P3-M9 — hardening, lifecycle and exit-audit tests.
//
// Covers: the 0009 rate-limit schema (fresh and upgrade paths), request
// body-size guard, the global mutation limiter, per-IP login brute-force
// protection, the per-IP checkout placement cap, the exact atomic hunt-start
// cap (stale-day reset included), and the maintenance sweep (bounded,
// idempotent, never touches active data or the audit trail). Runs against
// the real migration SQL — no SQL is mocked.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { sha256Hex } from '../../src/server/rateLimit'
import { createMigratedD1, applyRemainingMigrations, type MigratedD1 } from '../helpers/fake-d1'

const AMARA = { email: 'amara.okafor@example.com', password: 'demo-amara-1001' }
const ROWAN = { email: 'rowan.ellison@example.com', password: 'demo-rowan-9001' } // staff
const IP = '203.0.113.50'

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
  const list =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie') ?? '']
  return list.join('; ')
}

async function signIn(migrated: MigratedD1, email: string, password: string, ip?: string) {
  const response = await app.request(
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ip ? { 'cf-connecting-ip': ip } : {}),
      },
      body: JSON.stringify({ email, password }),
    },
    { DB: migrated.db },
  )
  const joined = allSetCookies(response)
  return {
    response,
    session: extractCookie(joined, 'mpl_session'),
    customer: extractCookie(joined, 'mpl_customer'),
  }
}

function cookies(session: string | null, customer: string | null = null) {
  return [session ? `mpl_session=${session}` : null, customer ? `mpl_customer=${customer}` : null]
    .filter(Boolean)
    .join('; ')
}

async function seedExpiredSession(migrated: MigratedD1) {
  migrated.sqlite.exec(`
    INSERT INTO practice_sessions (token_hash, created_at, expires_at, mode)
    VALUES ('deadbeef' || printf('%024d', 1), '2020-01-01T00:00:00.000Z', '2020-01-08T00:00:00.000Z', 'clean');
    INSERT INTO carts (session_id) SELECT id FROM practice_sessions WHERE token_hash = 'deadbeef' || printf('%024d', 1);
    INSERT INTO cart_items (cart_id, product_id, quantity)
      SELECT carts.id, 1, 2 FROM carts JOIN practice_sessions ps ON ps.id = carts.session_id
      WHERE ps.token_hash = 'deadbeef' || printf('%024d', 1);
    INSERT INTO orders (session_id, reference, status, payment_status, customer_name, customer_email,
                        shipping_line, shipping_city, shipping_postcode, subtotal_cents, total_cents)
      SELECT id, 'ORD-DEADBEEF00000001', 'placed', 'approved', 'Ghost', 'ghost@example.com',
             '1 Nowhere', 'Nowhere', 'NW1 1AA', 100, 100
      FROM practice_sessions WHERE token_hash = 'deadbeef' || printf('%024d', 1);
    INSERT INTO order_items (order_id, product_id, product_slug, product_name, unit_price_cents, quantity, line_total_cents)
      SELECT o.id, 1, 'ridgeline-2-person-tent', 'Ridgeline 2-Person Tent', 18999, 2, 37998
      FROM orders o WHERE o.reference = 'ORD-DEADBEEF00000001';
    INSERT INTO order_cancellations (order_id, session_id)
      SELECT o.id, o.session_id FROM orders o WHERE o.reference = 'ORD-DEADBEEF00000001';
  `)
  return null
}

describe('cart/checkout fail-closed on missing inventory rows (LEFT JOIN)', () => {
  it('flags the line unavailable and rejects checkout with 422; staff view shows 0 units rather than hiding the product', async () => {
    const migrated = createMigratedD1()
    const added = await app.request(
      '/api/v1/cart/items',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: 'ridgeline-2-person-tent', quantity: 1 }),
      },
      { DB: migrated.db },
    )
    const cookie = added.headers.get('set-cookie') ?? ''
    const session = /mpl_session=([a-f0-9]{32})/.exec(cookie)?.[1] ?? ''

    // Simulate the out-of-band precondition: product row exists, inventory row is gone.
    migrated.sqlite.prepare('DELETE FROM inventory WHERE product_id = 1').run()

    const cart = await app.request(
      '/api/v1/cart',
      { headers: { cookie: `mpl_session=${session}` } },
      { DB: migrated.db },
    )
    const cartBody = (await cart.json()) as {
      hasUnavailableItems: boolean
      items: Array<{ available: boolean; availableStock: number; stockStatus: string }>
    }
    expect(cartBody.hasUnavailableItems).toBe(true)
    expect(cartBody.items[0]!.available).toBe(false)
    expect(cartBody.items[0]!.availableStock).toBe(0)
    expect(cartBody.items[0]!.stockStatus).toBe('out_of_stock')

    const checkout = await app.request(
      '/api/v1/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `mpl_session=${session}` },
        body: JSON.stringify({
          customerName: 'Ada Lovelace',
          customerEmail: 'ada@example.com',
          shippingLine: '12 Analytical Engine Way',
          shippingCity: 'London',
          shippingPostcode: 'N1 9GU',
          paymentSimulation: 'approved',
        }),
      },
      { DB: migrated.db },
    )
    expect(checkout.status).toBe(422)
    expect(((await checkout.json()) as { error: string }).error).toBe('cart_unavailable')
    const orders = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }
    expect(orders.n).toBe(0)

    // Staff inventory view stays complete and honest.
    const rowan = await signIn(migrated, ROWAN.email, ROWAN.password)
    const admin = await app.request(
      '/api/v1/admin/inventory',
      { headers: { cookie: cookies(rowan.session, rowan.customer) } },
      { DB: migrated.db },
    )
    expect(admin.status).toBe(200)
    const adminBody = (await admin.json()) as { data: Array<{ productId: number; quantity: number; stockStatus: string }> }
    const product = adminBody.data.find((item) => item.productId === 1)
    expect(product?.quantity).toBe(0)
    expect(product?.stockStatus).toBe('out_of_stock')
  })
})

describe('cart item id pattern is bounded', () => {
  it('rejects absurdly long ids with 400 instead of silently mismatching', async () => {
    const migrated = createMigratedD1()
    const oversized = '9'.repeat(20)
    for (const method of ['PATCH', 'DELETE'] as const) {
      const response = await app.request(
        `/api/v1/cart/items/${oversized}`,
        {
          method,
          headers: { 'content-type': 'application/json' },
          body: method === 'PATCH' ? JSON.stringify({ quantity: 1 }) : undefined,
        },
        { DB: migrated.db },
      )
      expect(response.status).toBe(400)
      expect(((await response.json()) as { error: string }).error).toBe('invalid_request')
    }

    // A 17-digit id still fails the bound — never silently mis-matches an order.
    const over = '1'.repeat(17)
    const response = await app.request(
      `/api/v1/cart/items/${over}`,
      { method: 'DELETE' },
      { DB: migrated.db },
    )
    expect(response.status).toBe(400)
  })
})

describe('migration 0009 (rate_limit_buckets)', () => {
  it('applies cleanly on a fresh database (schema_version 10, bucket usable)', async () => {
    const migrated = createMigratedD1()
    const row = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('10')

    const tables = migrated.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rate_limit_buckets'")
      .all() as Array<{ name: string }>
    expect(tables).toHaveLength(1)

    await migrated.db
      .prepare('INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, 1)')
      .bind('mutate:test', 1)
      .run()
  })

  it('upgrades an existing Phase 3 (0001-0008) database without touching data', () => {
    const migrated = createMigratedD1({ through: 8 })
    const before = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(before.value).toBe('8')

    seedExpiredSession(migrated)
    applyRemainingMigrations(migrated, 8)

    const after = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(after.value).toBe('10')

    // Pre-existing rows survived the additive migration.
    const orders = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM orders WHERE reference = ?')
      .get('ORD-DEADBEEF00000001') as { count: number }
    expect(orders.count).toBe(1)
  })
})

describe('request body size guard', () => {
  it('rejects oversized payloads with 413 before parsing', async () => {
    const response = await app.request(
      '/api/v1/cart/items',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '40000' },
        body: '{}',
      },
      { DB: createMigratedD1().db },
    )
    expect(response.status).toBe(413)
    expect(((await response.json()) as { error: string }).error).toBe('payload_too_large')
  })

  it('accepts small payloads normally', async () => {
    const response = await app.request('/api/v1/cart', { method: 'GET' }, { DB: createMigratedD1().db })
    expect(response.status).toBe(200)
  })
})

describe('global mutation rate limit (120/min per IP)', () => {
  it('answers 429 rate_limited once the bucket is full', async () => {
    const migrated = createMigratedD1()
    const ipHash = await sha256Hex(IP)
    const now = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(now / 60)
    migrated.sqlite
      .prepare('INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, 120)')
      .run(`mutate:${ipHash}`, windowStart)

    const response = await app.request(
      '/api/v1/cart/items',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: JSON.stringify({ slug: 'ember-led-lantern', quantity: 1 }),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(429)
    expect(((await response.json()) as { error: string }).error).toBe('rate_limited')
    expect(response.headers.get('retry-after')).toBeTruthy()
  })

  it('never trusts x-forwarded-for, even with a full bucket for the spoofed address', async () => {
    const migrated = createMigratedD1()
    const spoofed = '203.0.113.99'
    const ipHash = await sha256Hex(spoofed)
    const now = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(now / 60)
    migrated.sqlite
      .prepare('INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, 120)')
      .run(`mutate:${ipHash}`, windowStart)

    const response = await app.request(
      '/api/v1/cart/items',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': spoofed },
        body: JSON.stringify({ slug: 'ember-led-lantern', quantity: 1 }),
      },
      { DB: migrated.db },
    )
    // The limiter must not have consulted the spoofable header: the request
    // reaches the route instead of being rejected with 429.
    expect(response.status).not.toBe(429)
  })

  it('does not cap requests without a visible client IP', async () => {
    const migrated = createMigratedD1()
    const ipHash = await sha256Hex(IP)
    const now = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(now / 60)
    migrated.sqlite
      .prepare('INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, 120)')
      .run(`mutate:${ipHash}`, windowStart)

    const response = await app.request(
      '/api/v1/cart',
      { method: 'GET' },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
  })
})

describe('checkout rate limit (30 placements per IP per minute)', () => {
  it('rejects the 31st placement attempt with 429', async () => {
    const migrated = createMigratedD1()
    const ipHash = await sha256Hex(IP)
    const now = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(now / 60)
    migrated.sqlite
      .prepare('INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (?, ?, 30)')
      .run(`checkout:${ipHash}`, windowStart)

    const response = await app.request(
      '/api/v1/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: JSON.stringify({
          customerName: 'Ada Lovelace',
          customerEmail: 'ada@example.com',
          shippingLine: '12 Analytical Engine Way',
          shippingCity: 'London',
          shippingPostcode: 'N1 9GU',
          paymentSimulation: 'approved',
        }),
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(429)
    expect(((await response.json()) as { error: string }).error).toBe('rate_limited')
  })
})

describe('login brute-force protection (5 failures per IP per minute)', () => {
  it('blocks the 6th failure — even with the correct password — until the window rolls', async () => {
    const migrated = createMigratedD1()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
          body: JSON.stringify({ email: AMARA.email, password: 'demo-wrong' }),
        },
        { DB: migrated.db },
      )
      expect(wrong.status).toBe(401)
    }
    // The 6th attempt is short-circuited before any PBKDF2 work happens.
    const blocked = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
        body: JSON.stringify({ email: AMARA.email, password: AMARA.password }),
      },
      { DB: migrated.db },
    )
    expect(blocked.status).toBe(429)
    expect(((await blocked.json()) as { error: string }).error).toBe('login_rate_limited')
    expect(blocked.headers.get('retry-after')).toBeTruthy()
  })

  it('does not affect a different IP address', async () => {
    const migrated = createMigratedD1()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
          body: JSON.stringify({ email: AMARA.email, password: 'demo-wrong' }),
        },
        { DB: migrated.db },
      )
    }
    const response = await signIn(migrated, AMARA.email, AMARA.password, '203.0.113.51')
    expect(response.response.status).toBe(200)
  })

  it('resets the failure budget on a successful sign-in', async () => {
    const migrated = createMigratedD1()
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
          body: JSON.stringify({ email: AMARA.email, password: 'demo-wrong' }),
        },
        { DB: migrated.db },
      )
    }
    const success = await signIn(migrated, AMARA.email, AMARA.password, IP)
    expect(success.response.status).toBe(200)

    // Budget is clear: four more failures fit before the limit engages.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP },
          body: JSON.stringify({ email: AMARA.email, password: 'demo-wrong' }),
        },
        { DB: migrated.db },
      )
      expect(wrong.status).toBe(401)
    }
  })
})

describe('hunt-start cap (exact, atomic)', () => {
  it('never lets the counter pass 20, even with seeded stale-day rows at the cap', async () => {
    const migrated = createMigratedD1()
    const ipHash = await sha256Hex('203.0.113.60')
    migrated.sqlite
      .prepare("INSERT INTO hunt_start_caps (ip_hash, day, starts) VALUES (?, '2000-01-01', 20)")
      .run(ipHash)

    const response = await app.request(
      '/api/v1/practice/hunts/hunt-pricing-001/start',
      {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.60' },
      },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    const row = migrated.sqlite
      .prepare('SELECT day, starts FROM hunt_start_caps WHERE ip_hash = ?')
      .get(ipHash) as { day: string; starts: number }
    expect(row.starts).toBe(1)
  })
})

describe('maintenance sweep', () => {
  it('rejects guests and customers, allows staff', async () => {
    const migrated = createMigratedD1()
    const guest = await app.request(
      '/api/v1/admin/maintenance/sweep',
      { method: 'POST' },
      { DB: migrated.db },
    )
    expect(guest.status).toBe(401)

    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    const customer = await app.request(
      '/api/v1/admin/maintenance/sweep',
      { method: 'POST', headers: { cookie: cookies(amara.session, amara.customer) } },
      { DB: migrated.db },
    )
    expect(customer.status).toBe(403)
    expect(((await customer.json()) as { error: string }).error).toBe('staff_required')

    const rowan = await signIn(migrated, ROWAN.email, ROWAN.password)
    const staff = await app.request(
      '/api/v1/admin/maintenance/sweep',
      { method: 'POST', headers: { cookie: cookies(rowan.session, rowan.customer) } },
      { DB: migrated.db },
    )
    expect(staff.status).toBe(200)
  })

  it('deletes expired rows, preserves active and audit data, and is idempotent', async () => {
    const migrated = createMigratedD1()
    seedExpiredSession(migrated)
    const activeHash = 'a'.repeat(64)
    const otherSeed = 'b'.repeat(64)
    migrated.sqlite.exec(`
      INSERT INTO practice_sessions (token_hash, created_at, expires_at, mode)
      VALUES ('${activeHash}', '2026-11-14T00:00:00.000Z', '2099-11-14T00:00:00.000Z', 'bug_hunt');
      INSERT INTO hunt_start_caps (ip_hash, day, starts) VALUES ('${otherSeed}', '2000-01-01', 3);
      INSERT INTO rate_limit_buckets (key, window_start, count) VALUES ('mutate:${otherSeed}', 0, 7);
      INSERT INTO inventory_adjustments (product_id, quantity_delta, reason)
      VALUES (1, 5, 'restock');
    `)

    const rowan = await signIn(migrated, ROWAN.email, ROWAN.password)
    const sweep = await app.request(
      '/api/v1/admin/maintenance/sweep',
      { method: 'POST', headers: { cookie: cookies(rowan.session, rowan.customer) } },
      { DB: migrated.db },
    )
    expect(sweep.status).toBe(200)
    const body = (await sweep.json()) as {
      ok: boolean
      deleted: { customerSessions: number; practiceSessions: number; huntStartCaps: number; rateLimitBuckets: number }
    }
    expect(body.ok).toBe(true)
    expect(body.deleted.practiceSessions).toBeGreaterThanOrEqual(1)
    expect(body.deleted.huntStartCaps).toBeGreaterThanOrEqual(1)
    expect(body.deleted.rateLimitBuckets).toBeGreaterThanOrEqual(1)

    // The expired session and its cascaded children are gone.
    const sessions = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM practice_sessions')
      .get() as { count: number }
    expect(sessions.count).toBe(2) // active fixture + staff session from signIn
    const orders = migrated.sqlite
      .prepare("SELECT COUNT(*) AS count FROM orders WHERE reference = 'ORD-DEADBEEF00000001'")
      .get() as { count: number }
    expect(orders.count).toBe(0)
    const items = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM order_items')
      .get() as { count: number }
    expect(items.count).toBe(0)
    const cancellations = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM order_cancellations')
      .get() as { count: number }
    expect(cancellations.count).toBe(0)

    // The active bug-hunt session and the append-only audit trail survive.
    const preserved = migrated.sqlite
      .prepare("SELECT mode FROM practice_sessions WHERE token_hash = '" + activeHash + "'")
      .get() as { mode: string }
    expect(preserved.mode).toBe('bug_hunt')
    const adjustments = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM inventory_adjustments')
      .get() as { count: number }
    expect(adjustments.count).toBe(1)

    // Idempotent: a second sweep removes nothing.
    const again = await app.request(
      '/api/v1/admin/maintenance/sweep',
      { method: 'POST', headers: { cookie: cookies(rowan.session, rowan.customer) } },
      { DB: migrated.db },
    )
    const second = (await again.json()) as {
      deleted: { practiceSessions: number; huntStartCaps: number; rateLimitBuckets: number }
    }
    // The staff sign-in created its own live session; the sweep must not
    // touch it. Nothing expired remains, so every count is zero.
    expect(second.deleted.practiceSessions).toBe(0)
    expect(second.deleted.huntStartCaps).toBe(0)
    expect(second.deleted.rateLimitBuckets).toBe(0)
  })
})
