// Bug-hunt defect set & scenario wiring (P3-M8): every registered defect's
// clean AND bug-hunt branches, hunt→scenario association, correct-hunt-only
// activation, per-IP daily start cap, isolation between two learners on
// different hunts, and reset restoring clean behaviour.
//
// Runs against the real migrations via the node:sqlite harness — no SQL is
// mocked. The M7 engine tests live in tests/server/hunt.test.ts.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { DEFECTS } from '../../src/server/defects'
import { HUNTS } from '../../src/server/hunts'
import { createMigratedD1, type MigratedD1 } from '../helpers/fake-d1'

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function bothCookies(session: string | null, customer: string | null) {
  return [
    session ? `mpl_session=${session}` : null,
    customer ? `mpl_customer=${customer}` : null,
  ]
    .filter(Boolean)
    .join('; ')
}

function extractSessionCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /mpl_session=([a-f0-9]{32})/.exec(setCookie)
  return match ? match[1] : null
}

async function startHunt(
  migrated: MigratedD1,
  huntId: string,
  options: { token?: string; ip?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(options.token ? sessionCookieHeader(options.token) : {}),
    ...(options.ip ? { 'cf-connecting-ip': options.ip } : {}),
  }
  return app.request(
    `/api/v1/practice/hunts/${huntId}/start`,
    {
      method: 'POST',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    },
    { DB: migrated.db },
  )
}

async function resetSession(migrated: MigratedD1, token?: string) {
  return app.request(
    '/api/v1/practice/session/reset',
    { method: 'POST', headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
}

async function addToCart(
  migrated: MigratedD1,
  slug: string,
  token?: string,
  quantity = 1,
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
  const newToken = extractSessionCookie(response.headers.get('set-cookie')) ?? token ?? null
  return { response, token: newToken }
}

async function checkout(
  migrated: MigratedD1,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await app.request(
    '/api/v1/checkout',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...sessionCookieHeader(token) },
      body: JSON.stringify({
        customerName: 'Ada Lovelace',
        customerEmail: 'ada@example.com',
        shippingLine: '12 Analytical Engine Way',
        shippingCity: 'London',
        shippingPostcode: 'N1 9GU',
        paymentSimulation: 'approved',
        ...overrides,
      }),
    },
    { DB: migrated.db },
  )
  return { response, body: (await response.json()) as Record<string, unknown> }
}

async function products(
  migrated: MigratedD1,
  query: string,
  token?: string,
) {
  const response = await app.request(
    `/api/v1/products?${query}`,
    { headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
  return { response, body: (await response.json()) as Record<string, unknown> }
}

async function signIn(migrated: MigratedD1, email: string, password: string) {
  const response = await app.request(
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    { DB: migrated.db },
  )
  const setCookie = response.headers.get('set-cookie') ?? ''
  const customer = /mpl_customer=([a-f0-9]{32})/.exec(setCookie)?.[1] ?? null
  const practice = /mpl_session=([a-f0-9]{32})/.exec(setCookie)?.[1] ?? null
  return { response, customer, practice }
}

/** Seed facts relied on below: product 5 (Ember LED Lantern) has exactly 4 in stock. */
const EXACT_STOCK_SLUG = 'ember-led-lantern'
const EXACT_STOCK = 4

describe('registries (code, not data) — P3-M8 set', () => {
  it('registers ten hunts, one per defect, each wired to a scenario', () => {
    expect(HUNTS.length).toBe(10)
    expect(DEFECTS.length).toBe(10)
    const defectIds = new Set(DEFECTS.map((defect) => defect.id))
    for (const hunt of HUNTS) {
      expect(hunt.defectIds.length).toBe(1)
      for (const defectId of hunt.defectIds) {
        expect(defectIds.has(defectId)).toBe(true)
      }
      expect(hunt.scenarioId).toBeTruthy()
    }
  })

  it('never leaks defect ids into learner-safe registry output', () => {
    for (const hunt of HUNTS) {
      const leaked = DEFECTS.some((defect) => hunt.summary.includes(defect.id) || hunt.title.includes(defect.id))
      expect(leaked, `${hunt.id} leaks a defect id`).toBe(false)
    }
  })
})

describe('GET /api/v1/practice/hunts', () => {
  it('lists the registered hunts with learner-safe fields only', async () => {
    const migrated = createMigratedD1()
    const response = await app.request('/api/v1/practice/hunts', {}, { DB: migrated.db })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Array<Record<string, unknown>> }
    expect(body.data.length).toBe(10)
    for (const entry of body.data) {
      expect(Object.keys(entry).sort()).toEqual(['curriculum', 'id', 'scenarioId', 'summary', 'title'])
      expect(typeof entry.scenarioId).toBe('string')
    }
    const raw = JSON.stringify(body)
    for (const defect of DEFECTS) {
      expect(raw).not.toContain(defect.id)
    }
  })

  it('returns the learner-safe curriculum with every hunt entry', async () => {
    const migrated = createMigratedD1()
    const response = await app.request('/api/v1/practice/hunts', {}, { DB: migrated.db })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<Record<string, unknown> & {
        curriculum: {
          skillArea: string
          difficulty: string
          conceptsPracticed: string[]
          expectedOutcomes: string[]
          investigationFocus: string[]
          reportFocus: string[]
        }
      }>
    }
    expect(body.data.length).toBe(10)
    for (const entry of body.data) {
      expect(entry.curriculum).toBeDefined()
      expect(typeof entry.curriculum.skillArea).toBe('string')
      expect(entry.curriculum.skillArea.length).toBeGreaterThan(10)
      expect(['beginner', 'intermediate', 'advanced']).toContain(entry.curriculum.difficulty)
      expect(entry.curriculum.conceptsPracticed.length).toBeGreaterThanOrEqual(3)
      expect(entry.curriculum.expectedOutcomes.length).toBeGreaterThanOrEqual(3)
      expect(entry.curriculum.investigationFocus.length).toBeGreaterThanOrEqual(4)
      expect(entry.curriculum.reportFocus.length).toBeGreaterThanOrEqual(4)
    }
    // The curriculum is the only new field — no evaluator internals leak.
    const raw = JSON.stringify(body)
    for (const defect of DEFECTS) {
      expect(raw).not.toContain(defect.id)
      expect(raw).not.toContain(defect.title)
    }
    for (const term of ['finding-check', 'quality_score', 'hint_mask', 'hunt_attempts']) {
      expect(raw).not.toContain(term)
    }
  })
})

describe('CATALOGUE-002 — category filter silently ignored', () => {
  it('clean mode narrows the catalogue; bug-hunt mode ignores the filter', async () => {
    const migrated = createMigratedD1()

    const clean = await products(migrated, 'category=climbing&perPage=48')
    expect(clean.body.total).toBe(5)
    expect(
      (clean.body.data as Array<{ categorySlug: string }>).every((row) => row.categorySlug === 'climbing'),
    ).toBe(true)

    const hunt = await startHunt(migrated, 'hunt-catalogue-002')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    const inHunt = await products(migrated, 'category=climbing&perPage=48', token)
    expect(inHunt.body.total).toBe(40)
    const other = await products(migrated, 'category=water&perPage=48', token)
    expect(other.body.total).toBe(40)

    // Another visitor is unaffected.
    const guest = await products(migrated, 'category=climbing&perPage=48')
    expect(guest.body.total).toBe(5)

    await resetSession(migrated, token)
    const afterReset = await products(migrated, 'category=climbing&perPage=48', token)
    expect(afterReset.body.total).toBe(5)
  })
})

describe('CART-001 — re-adding replaces the line quantity', () => {
  it('clean mode accumulates; bug-hunt mode replaces; other sessions unaffected', async () => {
    const migrated = createMigratedD1()

    const cleanAdd1 = await addToCart(migrated, 'sequoia-sleeping-bag', undefined, 2)
    const cleanAdd2 = await addToCart(migrated, 'sequoia-sleeping-bag', cleanAdd1.token!, 2)
    expect(cleanAdd2.response.status).toBe(200)
    const cleanCart = (await cleanAdd2.response.json()) as {
      items: Array<{ quantity: number }>
    }
    expect(cleanCart.items[0]?.quantity).toBe(4)

    const hunt = await startHunt(migrated, 'hunt-cart-001')
    const huntToken = extractSessionCookie(hunt.headers.get('set-cookie'))!
    await addToCart(migrated, 'traverse-camp-kitchen-set', huntToken, 2)
    const huntAdd2 = await addToCart(migrated, 'traverse-camp-kitchen-set', huntToken, 2)
    const huntCart = (await huntAdd2.response.json()) as {
      items: Array<{ quantity: number; slug: string }>
    }
    expect(huntCart.items.find((item) => item.slug === 'traverse-camp-kitchen-set')?.quantity).toBe(2)

    // A second learner keeps clean semantics.
    const bobAdd1 = await addToCart(migrated, 'traverse-camp-kitchen-set', undefined, 2)
    const bobAdd2 = await addToCart(migrated, 'traverse-camp-kitchen-set', bobAdd1.token!, 2)
    const bobCart = (await bobAdd2.response.json()) as {
      items: Array<{ quantity: number }>
    }
    expect(bobCart.items[0]?.quantity).toBe(4)

    await resetSession(migrated, huntToken)
    const afterReset = await addToCart(migrated, 'traverse-camp-kitchen-set', huntToken, 2)
    const afterResetCart = (await afterReset.response.json()) as {
      items: Array<{ quantity: number; slug: string }>
    }
    expect(
      afterResetCart.items.find((item) => item.slug === 'traverse-camp-kitchen-set')?.quantity,
    ).toBe(4)
  })
})

describe('INVENTORY-001 — exact-stock checkout boundary', () => {
  it('clean mode accepts ordering the exact remaining stock', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, EXACT_STOCK_SLUG, undefined, EXACT_STOCK)
    expect(added.response.status).toBe(200)
    const { response, body } = await checkout(migrated, added.token!)
    expect(response.status).toBe(201)
    expect(body.paymentStatus).toBe('approved')
  })

  it('bug-hunt mode rejects it with 422 cart_unavailable; reset restores the boundary', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-inventory-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    const added = await addToCart(migrated, EXACT_STOCK_SLUG, token, EXACT_STOCK)
    expect(added.response.status).toBe(200)
    const { response, body } = await checkout(migrated, token)
    expect(response.status).toBe(422)
    expect(body.error).toBe('cart_unavailable')
    const lines = body.lines as Array<{ slug: string; reason: string; availableStock: number }>
    expect(lines).toEqual([
      expect.objectContaining({ slug: EXACT_STOCK_SLUG, reason: 'insufficient_stock', availableStock: EXACT_STOCK }),
    ])

    await resetSession(migrated, token)
    const retry = await checkout(migrated, token)
    expect(retry.response.status).toBe(201)
  })
})

describe('PRICING-001 — stored line totals ignore quantity', () => {
  it('clean mode stores unit price × quantity on the line snapshot', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, 'sequoia-sleeping-bag', undefined, 3)
    expect(added.response.status).toBe(200)
    const { response, body } = await checkout(migrated, added.token!)
    expect(response.status).toBe(201)
    const items = body.items as Array<{ quantity: number; unitPriceCents: number; lineTotalCents: number }>
    expect(items[0]?.lineTotalCents).toBe(items[0]!.unitPriceCents * 3)
    expect(body.totalCents).toBe(items[0]!.lineTotalCents)
  })

  it('bug-hunt mode stores the unit price as the line total; reset restores correct totals', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-pricing-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    await addToCart(migrated, 'sequoia-sleeping-bag', token, 3)
    const { response, body } = await checkout(migrated, token)
    expect(response.status).toBe(201)
    const items = body.items as Array<{ quantity: number; unitPriceCents: number; lineTotalCents: number }>
    expect(items[0]?.quantity).toBe(3)
    expect(items[0]?.lineTotalCents).toBe(items[0]!.unitPriceCents)
    // The order-level figures stay internally consistent.
    expect(body.subtotalCents).toBe(items[0]!.unitPriceCents * 3)

    await resetSession(migrated, token)
    await addToCart(migrated, 'traverse-camp-kitchen-set', token, 2)
    const retry = await checkout(migrated, token, { customerEmail: 'ada@example.net' })
    expect(retry.response.status).toBe(201)
    const items2 = retry.body.items as Array<{ unitPriceCents: number; lineTotalCents: number }>
    expect(items2[0]?.lineTotalCents).toBe(items2[0]!.unitPriceCents * 2)
  })
})

describe('CHECKOUT-001 — blank customer name passes validation', () => {
  it('clean mode rejects a blank name with 400 invalid_request', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, 'sequoia-sleeping-bag', undefined, 1)
    expect(added.response.status).toBe(200)
    const { response, body } = await checkout(migrated, added.token!, { customerName: '   ' })
    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
    const fields = body.fields as Record<string, string>
    expect(fields.customerName).toBeTruthy()
  })

  it('bug-hunt mode accepts it, while every other field stays enforced; reset restores 400', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-checkout-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    await addToCart(migrated, 'sequoia-sleeping-bag', token, 1)
    const { response, body } = await checkout(migrated, token, { customerName: '   ' })
    expect(response.status).toBe(201)
    expect(body.customerName).toBe('')

    // Control: the email rule is still enforced in the same hunt session.
    await addToCart(migrated, 'traverse-camp-kitchen-set', token, 1)
    const badEmail = await checkout(migrated, token, {
      customerName: '   ',
      customerEmail: 'not-an-email',
    })
    expect(badEmail.response.status).toBe(400)
    expect((badEmail.body.fields as Record<string, string>).customerEmail).toBeTruthy()

    await resetSession(migrated, token)
    await addToCart(migrated, 'tarn-waterproof-shell', token, 1)
    const afterReset = await checkout(migrated, token, { customerName: '   ' })
    expect(afterReset.response.status).toBe(400)
  })
})

describe('AUTHZ-001 — account order detail drops the ownership check', () => {
  async function placeOrderAsAmara(migrated: MigratedD1) {
    const amara = await signIn(migrated, 'amara.okafor@example.com', 'demo-amara-1001')
    expect(amara.practice).toBeTruthy()
    await addToCart(migrated, 'sequoia-sleeping-bag', amara.practice!, 1)
    const { response, body } = await checkout(migrated, amara.practice!)
    expect(response.status).toBe(201)
    return { reference: body.reference as string, amara }
  }

  async function benReadsOrder(migrated: MigratedD1, reference: string) {
    const ben = await signIn(migrated, 'ben.whitmore@example.net', 'demo-ben-1002')
    expect(ben.practice).toBeTruthy()
    const read = await app.request(
      `/api/v1/account/orders/${reference}`,
      { headers: { cookie: bothCookies(ben.practice, ben.customer) } },
      { DB: migrated.db },
    )
    return { ben, read }
  }

  it('clean mode conceals the order from another customer (404)', async () => {
    const migrated = createMigratedD1()
    const { reference } = await placeOrderAsAmara(migrated)
    const { read } = await benReadsOrder(migrated, reference)
    expect(read.status).toBe(404)
    expect(((await read.json()) as { error: string }).error).toBe('not_found')
  })

  it('bug-hunt mode returns the order; reset conceals it again', async () => {
    const migrated = createMigratedD1()
    const { reference } = await placeOrderAsAmara(migrated)

    // Ben enters the hunt in his own browser session.
    const ben = await signIn(migrated, 'ben.whitmore@example.net', 'demo-ben-1002')
    const hunt = await startHunt(migrated, 'hunt-authz-001', { token: ben.practice! })
    expect(hunt.status).toBe(200)

    const read = await app.request(
      `/api/v1/account/orders/${reference}`,
      { headers: { cookie: bothCookies(ben.practice, ben.customer) } },
      { DB: migrated.db },
    )
    expect(read.status).toBe(200)
    const order = (await read.json()) as { reference: string; customerName: string }
    expect(order.reference).toBe(reference)
    expect(order.customerName).toBe('Ada Lovelace')

    await resetSession(migrated, ben.practice!)
    const afterReset = await app.request(
      `/api/v1/account/orders/${reference}`,
      { headers: { cookie: bothCookies(ben.practice, ben.customer) } },
      { DB: migrated.db },
    )
    expect(afterReset.status).toBe(404)
  })

  it('unknown references stay 404 even in the hunt', async () => {
    const migrated = createMigratedD1()
    const ben = await signIn(migrated, 'ben.whitmore@example.net', 'demo-ben-1002')
    await startHunt(migrated, 'hunt-authz-001', { token: ben.practice! })
    const read = await app.request(
      '/api/v1/account/orders/ORD-0000000000000000',
      { headers: { cookie: bothCookies(ben.practice, ben.customer) } },
      { DB: migrated.db },
    )
    expect(read.status).toBe(404)
  })
})

describe('hunt start cap (per IP per UTC day)', () => {
  const IP = '203.0.113.10'

  it('allows 20 starts then answers 429; a different IP is unaffected', async () => {
    const migrated = createMigratedD1()
    // Alternate between two hunts so every entry counts (same-hunt re-starts are idempotent).
    const hunts = ['hunt-catalogue-001', 'hunt-cart-001']
    let token: string | undefined
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await startHunt(migrated, hunts[attempt % 2]!, { token, ip: IP })
      expect(response.status).toBe(200)
      token = extractSessionCookie(response.headers.get('set-cookie')) ?? token
    }
    const capped = await startHunt(migrated, hunts[0]!, { token, ip: IP })
    expect(capped.status).toBe(429)
    expect(((await capped.json()) as { error: string }).error).toBe('hunt_start_cap_reached')
    expect(capped.headers.get('retry-after')).toBeTruthy()

    const otherIp = await startHunt(migrated, hunts[0]!, { token, ip: '203.0.113.99' })
    expect(otherIp.status).toBe(200)
  })

  it('counts entries into a hunt, not idempotent re-starts; resets are free', async () => {
    const migrated = createMigratedD1()
    const first = await startHunt(migrated, 'hunt-catalogue-001', { ip: IP })
    expect(first.status).toBe(200)
    const token = extractSessionCookie(first.headers.get('set-cookie'))!

    // 30 same-hunt re-starts while it is active: none of these count.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const again = await startHunt(migrated, 'hunt-catalogue-001', { token, ip: IP })
      expect(again.status).toBe(200)
    }
    const afterIdempotent = migrated.sqlite
      .prepare('SELECT starts FROM hunt_start_caps')
      .get() as { starts: number }
    expect(afterIdempotent.starts).toBe(1)

    // 19 more entries from clean mode (reset is not a start): total hits the cap of 20.
    for (let attempt = 1; attempt < 20; attempt += 1) {
      await resetSession(migrated, token)
      const response = await startHunt(
        migrated,
        attempt % 2 === 0 ? 'hunt-cart-001' : 'hunt-catalogue-001',
        { token, ip: IP },
      )
      expect(response.status).toBe(200)
    }
    const afterEntries = migrated.sqlite
      .prepare('SELECT starts FROM hunt_start_caps')
      .get() as { starts: number }
    expect(afterEntries.starts).toBe(20)

    // The next entry, even after a reset, is rejected.
    await resetSession(migrated, token)
    const capped = await startHunt(migrated, 'hunt-inventory-001', { token, ip: IP })
    expect(capped.status).toBe(429)
  })

  it('resets the counter on the next UTC day', async () => {
    const migrated = createMigratedD1()
    let token: string | undefined
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await startHunt(migrated, attempt % 2 === 0 ? 'hunt-cart-001' : 'hunt-catalogue-001', {
        token,
        ip: IP,
      })
      token = extractSessionCookie(response.headers.get('set-cookie')) ?? token
    }
    // Simulate the previous day's row by rewriting the stored day.
    migrated.sqlite.exec("UPDATE hunt_start_caps SET day = '2000-01-01'")
    const response = await startHunt(migrated, 'hunt-pricing-001', { token, ip: IP })
    expect(response.status).toBe(200)
  })

  it('skips the cap when no client IP is visible (local development)', async () => {
    const migrated = createMigratedD1()
    let token: string | undefined
    for (let attempt = 0; attempt < 22; attempt += 1) {
      const response = await startHunt(
        migrated,
        attempt % 2 === 0 ? 'hunt-cart-001' : 'hunt-catalogue-001',
        { token },
      )
      expect(response.status).toBe(200)
      token = extractSessionCookie(response.headers.get('set-cookie')) ?? token
    }
  })
})

describe('two learners on different hunts at the same time', () => {
  it('each sees only their own defect', async () => {
    const migrated = createMigratedD1()
    // Learner 1: catalogue hunt — description facet missing.
    const hunt1 = await startHunt(migrated, 'hunt-catalogue-001')
    const token1 = extractSessionCookie(hunt1.headers.get('set-cookie'))!
    // Learner 2: cart hunt — quantity replaces instead of accumulating.
    const hunt2 = await startHunt(migrated, 'hunt-cart-001')
    const token2 = extractSessionCookie(hunt2.headers.get('set-cookie'))!
    expect(token1).not.toBe(token2)

    // Learner 1 sees the search defect but not the cart defect.
    const search1 = await products(migrated, 'q=vestibules', token1)
    expect(search1.body.total).toBe(0)
    await addToCart(migrated, 'sequoia-sleeping-bag', token1, 2)
    const cart1Again = await addToCart(migrated, 'sequoia-sleeping-bag', token1, 2)
    const cart1Body = (await cart1Again.response.json()) as {
      items: Array<{ quantity: number }>
    }
    expect(cart1Body.items[0]?.quantity).toBe(4)

    // Learner 2 sees the cart defect but not the search defect.
    const search2 = await products(migrated, 'q=vestibules', token2)
    expect(search2.body.total).toBe(1)
    await addToCart(migrated, 'traverse-camp-kitchen-set', token2, 2)
    const cart2Again = await addToCart(migrated, 'traverse-camp-kitchen-set', token2, 2)
    const cart2Body = (await cart2Again.response.json()) as {
      items: Array<{ quantity: number }>
    }
    expect(cart2Body.items[0]?.quantity).toBe(2)

    // Anonymous browsing stays clean for everyone else.
    const anon = await products(migrated, 'q=vestibules')
    expect(anon.body.total).toBe(1)
  })
})

describe('forged client input across the whole hunt set', () => {
  it('ignores forged defect ids, modes and activation flags for every hunt', async () => {
    for (const hunt of HUNTS) {
      const migrated = createMigratedD1()
      const response = await startHunt(migrated, hunt.id, {
        body: {
          mode: 'clean',
          huntId: 'hunt-ghost-000',
          defectIds: ['NOPE-000'],
          defects: [{ id: 'NOPE-000' }],
          activate: true,
        },
      })
      expect(response.status, hunt.id).toBe(200)
      const body = (await response.json()) as { mode: string; hunt: { id: string } }
      expect(body.mode).toBe('bug_hunt')
      expect(body.hunt.id).toBe(hunt.id)
      expect(JSON.stringify(body)).not.toContain('NOPE-000')
    }
  })
})

describe('reset across the whole hunt set', () => {
  it.each(HUNTS.map((hunt) => hunt.id))('reset after starting %s lands in clean mode', async (huntId) => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, huntId)
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    const before = (await (
      await app.request(
        '/api/v1/practice/session',
        { headers: sessionCookieHeader(token) },
        { DB: migrated.db },
      )
    ).json()) as { mode: string }
    expect(before.mode).toBe('bug_hunt')

    const reset = await resetSession(migrated, token)
    expect(reset.status).toBe(200)
    expect(await reset.json()).toEqual({ mode: 'clean', hunt: null })

    const after = (await (
      await app.request(
        '/api/v1/practice/session',
        { headers: sessionCookieHeader(token) },
        { DB: migrated.db },
      )
    ).json()) as { mode: string; hunt: unknown }
    expect(after).toEqual({ mode: 'clean', hunt: null })
  })
})

describe('signed-in customer compatibility in bug-hunt mode', () => {
  it('an order placed inside a hunt is still bound to the customer', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, 'amara.okafor@example.com', 'demo-amara-1001')
    await startHunt(migrated, 'hunt-checkout-001', { token: amara.practice! })
    await addToCart(migrated, 'sequoia-sleeping-bag', amara.practice!, 1)
    // Checkout with both cookies so the order binds to the signed-in customer.
    const placed = await app.request(
      '/api/v1/checkout',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: bothCookies(amara.practice, amara.customer),
        },
        body: JSON.stringify({
          customerName: 'Amara Okafor',
          customerEmail: 'amara.okafor@example.com',
          shippingLine: '12 Analytical Engine Way',
          shippingCity: 'London',
          shippingPostcode: 'N1 9GU',
          paymentSimulation: 'approved',
        }),
      },
      { DB: migrated.db },
    )
    expect(placed.status).toBe(201)
    const placedBody = (await placed.json()) as { reference: string }
    const reference = placedBody.reference
    const history = await app.request(
      '/api/v1/account/orders',
      { headers: { cookie: bothCookies(amara.practice, amara.customer) } },
      { DB: migrated.db },
    )
    const list = (await history.json()) as { data: Array<{ reference: string }> }
    expect(list.data.map((order) => order.reference)).toEqual([reference])
  })
})

describe('RBAC-001 — staff inventory read open to the customer role', () => {
  it('clean mode refuses the customer role on the list (cookie and Bearer)', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, 'amara.okafor@example.com', 'demo-amara-1001')
    const cookie = bothCookies(amara.practice, amara.customer)

    const viaCookie = await app.request(
      '/api/v1/admin/inventory',
      { headers: { cookie } },
      { DB: migrated.db },
    )
    expect(viaCookie.status).toBe(403)
    expect(((await viaCookie.json()) as { error: string }).error).toBe('staff_required')

    const mint = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'amara.okafor@example.com', password: 'demo-amara-1001' }),
      },
      { DB: migrated.db },
    )
    const { token: bearer } = (await mint.json()) as { token: string }
    const viaBearer = await app.request(
      '/api/v1/admin/inventory',
      { headers: { authorization: `Bearer ${bearer}` } },
      { DB: migrated.db },
    )
    expect(viaBearer.status).toBe(403)
  })

  it('bug-hunt mode serves the list to the customer role; PATCH stays 403; reset restores 403', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, 'amara.okafor@example.com', 'demo-amara-1001')
    const cookie = bothCookies(amara.practice, amara.customer)
    const hunt = await startHunt(migrated, 'hunt-rbac-001', { token: amara.practice! })
    expect(hunt.status).toBe(200)

    const list = await app.request(
      '/api/v1/admin/inventory',
      { headers: { cookie } },
      { DB: migrated.db },
    )
    expect(list.status).toBe(200)
    const body = (await list.json()) as { data: Array<Record<string, unknown>> }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)

    // PATCH remains staff-only in both modes.
    const patch = await app.request(
      '/api/v1/admin/inventory/1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ quantity: 1 }),
      },
      { DB: migrated.db },
    )
    expect(patch.status).toBe(403)
    expect(((await patch.json()) as { error: string }).error).toBe('staff_required')

    await resetSession(migrated, amara.practice!)
    const afterReset = await app.request(
      '/api/v1/admin/inventory',
      { headers: { cookie } },
      { DB: migrated.db },
    )
    expect(afterReset.status).toBe(403)
  })

  it('a suspended account stays 403 in the hunt; staff and bystanders behave per role', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, 'amara.okafor@example.com', 'demo-amara-1001')
    await startHunt(migrated, 'hunt-rbac-001', { token: amara.practice! })

    // Mid-session suspension: an account suspended after sign-in is never
    // served, even with the hunt active.
    const amaraSuspended = await signIn(migrated, 'amara.okafor@example.com', 'demo-amara-1001')
    await startHunt(migrated, 'hunt-rbac-001', { token: amaraSuspended.practice! })
    migrated.sqlite
      .prepare("UPDATE customers SET status = 'suspended' WHERE email = ?")
      .run('amara.okafor@example.com')
    const suspendedList = await app.request(
      '/api/v1/admin/inventory',
      { headers: { cookie: bothCookies(amaraSuspended.practice, amaraSuspended.customer) } },
      { DB: migrated.db },
    )
    expect(suspendedList.status).toBe(403)
    expect(((await suspendedList.json()) as { error: string }).error).toBe('account_suspended')
    migrated.sqlite
      .prepare("UPDATE customers SET status = 'active' WHERE email = ?")
      .run('amara.okafor@example.com')

    // Staff role: unaffected in both modes.
    const rowan = await signIn(migrated, 'rowan.ellison@example.com', 'demo-rowan-9001')
    const rowanList = await app.request(
      '/api/v1/admin/inventory',
      { headers: { cookie: bothCookies(rowan.practice, rowan.customer) } },
      { DB: migrated.db },
    )
    expect(rowanList.status).toBe(200)

    // Bystander customer (no hunt): unaffected.
    const ben = await signIn(migrated, 'ben.whitmore@example.net', 'demo-ben-1002')
    const benList = await app.request(
      '/api/v1/admin/inventory',
      { headers: { cookie: bothCookies(ben.practice, ben.customer) } },
      { DB: migrated.db },
    )
    expect(benList.status).toBe(403)
  })
})

describe('MASS-001 — checkout honours a client-supplied totalCents', () => {
  it('clean mode ignores the field; the stored total is the server-computed figure', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, 'sequoia-sleeping-bag', undefined, 2)
    expect(added.response.status).toBe(200)
    const { response, body } = await checkout(migrated, added.token!, { totalCents: 1 })
    expect(response.status).toBe(201)
    expect(body.totalCents).toBe(body.subtotalCents)
    expect(body.totalCents).not.toBe(1)
  })

  it('bug-hunt mode stores the forged total; the subtotal stays server-computed; reset restores', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-mass-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    await addToCart(migrated, 'sequoia-sleeping-bag', token, 2)
    const { response, body } = await checkout(migrated, token, { totalCents: 1 })
    expect(response.status).toBe(201)
    expect(body.totalCents).toBe(1)
    // The subtotal and the line totals remain server-computed.
    expect(body.subtotalCents).not.toBe(1)
    const items = body.items as Array<{ unitPriceCents: number; quantity: number; lineTotalCents: number }>
    expect(items[0]?.lineTotalCents).toBe(items[0]!.unitPriceCents * items[0]!.quantity)

    // The confirmation endpoint disagrees with the cart summary: 1 vs server figure.
    const reference = body.reference as string
    const detail = await app.request(
      `/api/v1/orders/${reference}`,
      { headers: sessionCookieHeader(token) },
      { DB: migrated.db },
    )
    expect(detail.status).toBe(200)
    const detailBody = (await detail.json()) as { totalCents: number; subtotalCents: number }
    expect(detailBody.totalCents).toBe(1)
    expect(detailBody.subtotalCents).toBe(body.subtotalCents)

    // Reset: the field is ignored again.
    await resetSession(migrated, token)
    await addToCart(migrated, 'traverse-camp-kitchen-set', token, 1)
    const retry = await checkout(migrated, token, { totalCents: 1, customerEmail: 'ada@example.net' })
    expect(retry.response.status).toBe(201)
    expect(retry.body.totalCents).not.toBe(1)
    expect(retry.body.totalCents).toBe(retry.body.subtotalCents)
  })

  it('forged totals never escape the hunting session and stay inside the safe-integer domain', async () => {
    const migrated = createMigratedD1()
    const forged = await startHunt(migrated, 'hunt-mass-001')
    const forgedToken = extractSessionCookie(forged.headers.get('set-cookie'))!
    await addToCart(migrated, 'sequoia-sleeping-bag', forgedToken, 1)

    // Out-of-domain values are ignored even inside the hunt (documented:
    // the orders table carries CHECK (total_cents >= 0)). Each approved
    // checkout empties the cart, so re-add before every attempt.
    let attempt = 0
    for (const bogus of [-5, 2.5, 1e20, '1', null, Number.NaN] as const) {
      attempt += 1
      await addToCart(migrated, 'sequoia-sleeping-bag', forgedToken, 1)
      const { response, body } = await checkout(migrated, forgedToken, {
        totalCents: bogus,
        customerEmail: `ada-mass-${attempt}@example.com`,
      })
      expect(response.status, `totalCents=${String(bogus)}`).toBe(201)
      expect(body.totalCents).toBe(body.subtotalCents)
    }

    // A bystander session in clean mode ignores the same field.
    const added = await addToCart(migrated, 'sequoia-sleeping-bag', undefined, 1)
    const clean = await checkout(migrated, added.token!, { totalCents: 1 })
    expect(clean.body.totalCents).toBe(clean.body.subtotalCents)
  })
})
