import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { createMigratedD1, type MigratedD1 } from '../helpers/fake-d1'

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function extractCookie(setCookie: string | null, name: string): string | null {
  if (!setCookie) return null
  const match = new RegExp(`${name}=([a-f0-9]{32})`).exec(setCookie)
  return match ? match[1] : null
}

function cookieHeader(...pairs: Array<[string, string | null]>): string {
  return pairs
    .filter((pair): pair is [string, string] => pair[1] !== null)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function bothCookies(session: string | null, customer: string | null) {
  return cookieHeader(['mpl_session', session], ['mpl_customer', customer])
}

async function login(
  migrated: MigratedD1,
  email: unknown,
  password: unknown,
  cookie?: string,
) {
  return app.request(
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

async function checkout(migrated: MigratedD1, cookie: string) {
  return app.request(
    '/api/v1/checkout',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        customerName: 'Amara Okafor',
        customerEmail: 'amara.okafor@example.com',
        shippingLine: '48 Fellside Lane',
        shippingCity: 'Aldermere',
        shippingPostcode: 'AL9 4QT',
        paymentSimulation: 'approved',
      }),
    },
    { DB: migrated.db },
  )
}

/** Signs a customer in and returns the fresh cookie pair for this browser. */
async function signIn(
  migrated: MigratedD1,
  email: string,
  password: string,
  cookie?: string,
) {
  const response = await login(migrated, email, password, cookie)
  const setCookie = response.headers.get('set-cookie') ?? ''
  // hono may emit multiple Set-Cookie headers joined; split defensively.
  const headers = response.headers
  const all = typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
    ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
    : [setCookie]
  const joined = all.join('; ')
  const session = extractCookie(joined, 'mpl_session') ?? extractCookie(cookie ?? null, 'mpl_session')
  const customer = extractCookie(joined, 'mpl_customer')
  return { response, session, customer }
}

async function placeOrderAs(
  migrated: MigratedD1,
  email: string,
  password: string,
  slug = 'ridgeline-2-person-tent',
) {
  const { session, customer } = await signIn(migrated, email, password)
  const cookie = bothCookies(session, customer)
  const added = await addToCart(migrated, slug, cookie)
  expect(added.status).toBeLessThan(300)
  const cookieAfterAdd =
    extractCookie(added.headers.get('set-cookie'), 'mpl_session') ?? session
  const finalCookie = bothCookies(cookieAfterAdd, customer)
  const placed = await checkout(migrated, finalCookie)
  const body = (await placed.json()) as { reference?: string }
  return { reference: body.reference ?? null, session: cookieAfterAdd, customer }
}

const AMARA = { email: 'amara.okafor@example.com', password: 'demo-amara-1001' }
const BEN = { email: 'ben.whitmore@example.net', password: 'demo-ben-1002' }
const DANA = { email: 'dana.reyes@example.com', password: 'demo-dana-1004' }
const ROWAN = { email: 'rowan.ellison@example.com', password: 'demo-rowan-9001' }

describe('GET /api/v1/auth/accounts', () => {
  it('lists the synthetic demo accounts without any secrets', async () => {
    const migrated = createMigratedD1()
    const response = await app.request('/api/v1/auth/accounts', {}, { DB: migrated.db })
    expect(response.status).toBe(200)
    const raw = await response.text()
    expect(raw).not.toContain('pbkdf2')
    expect(raw).not.toContain('password')
    const body = JSON.parse(raw) as { data: Array<{ email: string; role: string; status: string }> }
    expect(body.data).toHaveLength(5)
    expect(body.data.map((a) => a.email)).toContain(AMARA.email)
    expect(body.data.find((a) => a.email === DANA.email)?.status).toBe('suspended')
    expect(body.data.find((a) => a.email === ROWAN.email)?.role).toBe('staff')
  })
})

describe('POST /api/v1/auth/login', () => {
  it('signs in with valid credentials and sets both cookies', async () => {
    const migrated = createMigratedD1()
    const { response, session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { customer: Record<string, unknown> }
    expect(body.customer.email).toBe(AMARA.email)
    expect(body.customer.role).toBe('customer')
    // No password material anywhere in the payload.
    expect(JSON.stringify(body)).not.toContain('pbkdf2')
    expect(JSON.stringify(body)).not.toContain('password')
    expect(session).not.toBeNull()
    expect(customer).not.toBeNull()

    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/mpl_customer=[a-f0-9]{32}/)
    expect(setCookie).toMatch(/httponly/i)
    expect(setCookie).toMatch(/samesite=strict/i)
    expect(setCookie).toMatch(/path=\//i)
    expect(setCookie).toMatch(/max-age=28800/i)
    expect(setCookie).not.toMatch(/secure/i) // http request → no Secure flag
  })

  it('answers an identical 401 for unknown email and wrong password', async () => {
    const migrated = createMigratedD1()
    const wrongPassword = await login(migrated, AMARA.email, 'not-the-password')
    const unknownEmail = await login(migrated, 'nobody@example.com', 'whatever-password')
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    const a = (await wrongPassword.json()) as { error: string; message: string }
    const b = (await unknownEmail.json()) as { error: string; message: string }
    expect(a.error).toBe('invalid_credentials')
    expect(b.error).toBe('invalid_credentials')
    expect(a.message).toBe(b.message)
    // Neither response reveals which half failed.
    expect(a.message).not.toContain(AMARA.email)
    expect(b.message).not.toContain('nobody@example.com')
  })

  it('rejects malformed bodies with 400', async () => {
    const migrated = createMigratedD1()
    expect((await login(migrated, 'not-an-email', 'demo-amara-1001')).status).toBe(400)
    expect((await login(migrated, AMARA.email, '')).status).toBe(400)
    expect((await login(migrated, 123, 'demo-amara-1001')).status).toBe(400)
  })

  it('stores only the SHA-256 hash of the customer token', async () => {
    const migrated = createMigratedD1()
    const { customer } = await signIn(migrated, AMARA.email, AMARA.password)
    expect(customer).not.toBeNull()
    const rows = migrated.sqlite
      .prepare('SELECT token_hash FROM customer_sessions')
      .all() as unknown as Array<{ token_hash: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).not.toBe(customer)
    expect(rows[0].token_hash).toBe(sha256Hex(customer as string))
  })

  it('rotates the token on every login — a pre-login customer token never survives', async () => {
    const migrated = createMigratedD1()
    const first = await signIn(migrated, AMARA.email, AMARA.password)
    const firstCookie = bothCookies(first.session, first.customer)

    // Re-login presenting the first customer cookie (fixation attempt).
    const second = await login(migrated, AMARA.email, AMARA.password, firstCookie)
    expect(second.status).toBe(200)
    const secondCustomer = extractCookie(second.headers.get('set-cookie'), 'mpl_customer')
    expect(secondCustomer).not.toBeNull()
    expect(secondCustomer).not.toBe(first.customer)

    // The presented pre-login token is destroyed server-side.
    const replay = await app.request(
      '/api/v1/auth/me',
      { headers: { cookie: bothCookies(first.session, first.customer) } },
      { DB: migrated.db },
    )
    expect(replay.status).toBe(401)
  })

  it('keeps per-practice-session customer sessions independent on re-login elsewhere', async () => {
    const migrated = createMigratedD1()
    // Browser A signs in.
    const a = await signIn(migrated, AMARA.email, AMARA.password)
    // Browser B (fresh practice session) signs in as the same customer.
    const b = await signIn(migrated, AMARA.email, AMARA.password)
    expect(a.session).not.toBe(b.session)
    expect(a.customer).not.toBe(b.customer)
    // Both remain valid in their own browsers.
    for (const browser of [a, b]) {
      const me = await app.request(
        '/api/v1/auth/me',
        { headers: { cookie: bothCookies(browser.session, browser.customer) } },
        { DB: migrated.db },
      )
      expect(me.status).toBe(200)
    }
  })

  it('rejects a suspended account with 403, and accepts staff with 200', async () => {
    const migrated = createMigratedD1()
    const dana = await login(migrated, DANA.email, DANA.password)
    expect(dana.status).toBe(403)
    const body = (await dana.json()) as { error: string }
    expect(body.error).toBe('account_suspended')

    const rowan = await login(migrated, ROWAN.email, ROWAN.password)
    expect(rowan.status).toBe(200)
    const staff = (await rowan.json()) as { customer: { role: string } }
    expect(staff.customer.role).toBe('staff')
  })

  it('mints a practice session pair when the browser had neither cookie', async () => {
    const migrated = createMigratedD1()
    const response = await login(migrated, AMARA.email, AMARA.password)
    expect(response.status).toBe(200)
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/mpl_session=[a-f0-9]{32}/)
    expect(setCookie).toMatch(/mpl_customer=[a-f0-9]{32}/)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('destroys the server-side session and clears the cookie', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(session, customer)

    const response = await app.request(
      '/api/v1/auth/logout',
      { method: 'POST', headers: { cookie } },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/mpl_customer=;|mpl_customer=""/)
    expect(response.headers.get('set-cookie')).toMatch(/max-age=0/i)

    const rows = migrated.sqlite.prepare('SELECT id FROM customer_sessions').all()
    expect(rows).toHaveLength(0)

    const me = await app.request(
      '/api/v1/auth/me',
      { headers: { cookie } },
      { DB: migrated.db },
    )
    expect(me.status).toBe(401)
  })

  it('is idempotent with no cookies presented', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/auth/logout',
      { method: 'POST' },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    expect(((await response.json()) as { ok: boolean }).ok).toBe(true)
  })

  it('clears a malformed customer cookie without touching the practice session', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/auth/logout',
      { method: 'POST', headers: { cookie: 'mpl_customer=not-a-real-token!@' } },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/max-age=0/i)
  })
})

describe('session hygiene: expiry and malformed cookies', () => {
  it('rejects and purges an expired customer session', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    migrated.sqlite
      .prepare("UPDATE customer_sessions SET expires_at = '2000-01-01T00:00:00.000Z'")
      .run()
    const me = await app.request(
      '/api/v1/auth/me',
      { headers: { cookie: bothCookies(session, customer) } },
      { DB: migrated.db },
    )
    expect(me.status).toBe(401)
    expect(me.headers.get('set-cookie')).toMatch(/max-age=0/i)
    const rows = migrated.sqlite.prepare('SELECT id FROM customer_sessions').all()
    expect(rows).toHaveLength(0)
  })

  it('rejects a malformed customer cookie and clears it', async () => {
    const migrated = createMigratedD1()
    const me = await app.request(
      '/api/v1/auth/me',
      { headers: { cookie: 'mpl_customer=garbage!!' } },
      { DB: migrated.db },
    )
    expect(me.status).toBe(401)
    expect(me.headers.get('set-cookie')).toMatch(/max-age=0/i)
  })

  it('scopes the customer session to the owning practice session', async () => {
    const migrated = createMigratedD1()
    // Browser A signs in.
    const a = await signIn(migrated, AMARA.email, AMARA.password)
    // Browser B establishes a separate practice session (cart add mints it).
    const added = await addToCart(migrated, 'ridgeline-2-person-tent')
    const bSession = extractCookie(added.headers.get('set-cookie'), 'mpl_session')
    expect(bSession).not.toBeNull()

    // A's customer token replayed against B's practice session is rejected.
    const replay = await app.request(
      '/api/v1/auth/me',
      { headers: { cookie: bothCookies(bSession, a.customer) } },
      { DB: migrated.db },
    )
    expect(replay.status).toBe(401)
    expect(replay.headers.get('set-cookie')).toMatch(/max-age=0/i)

    // And with A's own practice session it works.
    const legit = await app.request(
      '/api/v1/auth/me',
      { headers: { cookie: bothCookies(a.session, a.customer) } },
      { DB: migrated.db },
    )
    expect(legit.status).toBe(200)
  })

  it('rejects a customer cookie presented without its practice session', async () => {
    const migrated = createMigratedD1()
    const { customer } = await signIn(migrated, AMARA.email, AMARA.password)
    const me = await app.request(
      '/api/v1/auth/me',
      { headers: { cookie: `mpl_customer=${customer}` } },
      { DB: migrated.db },
    )
    expect(me.status).toBe(401)
  })
})

describe('protected endpoints: guests and suspended customers', () => {
  it('rejects guests with 401 on every protected route', async () => {
    const migrated = createMigratedD1()
    for (const path of ['/api/v1/auth/me', '/api/v1/account', '/api/v1/account/orders']) {
      const response = await app.request(path, {}, { DB: migrated.db })
      expect(response.status).toBe(401)
      expect(((await response.json()) as { error: string }).error).toBe('unauthorized')
    }
    const detail = await app.request(
      '/api/v1/account/orders/ORD-0000000000000001',
      {},
      { DB: migrated.db },
    )
    expect(detail.status).toBe(401)
  })

  it('answers 403 (not 401) when the signed-in customer is suspended mid-session', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    migrated.sqlite.prepare("UPDATE customers SET status = 'suspended' WHERE email = ?").run(
      AMARA.email,
    )
    const cookie = bothCookies(session, customer)
    for (const path of ['/api/v1/auth/me', '/api/v1/account', '/api/v1/account/orders']) {
      const response = await app.request(path, { headers: { cookie } }, { DB: migrated.db })
      expect(response.status).toBe(403)
      expect(((await response.json()) as { error: string }).error).toBe('account_suspended')
    }
  })
})

describe('protected endpoints: ownership and authorization', () => {
  it('returns the own profile with no password material', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    const response = await app.request(
      '/api/v1/account',
      { headers: { cookie: bothCookies(session, customer) } },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    const raw = await response.text()
    expect(raw).not.toContain('pbkdf2')
    expect(raw).not.toContain('password')
    expect(raw).not.toContain('hash')
    const body = JSON.parse(raw) as { customer: { email: string; addressLine: string } }
    expect(body.customer.email).toBe(AMARA.email)
    expect(body.customer.addressLine).toBe('48 Fellside Lane')
  })

  it("a customer only sees their own orders in /account/orders", async () => {
    const migrated = createMigratedD1()
    const amara = await placeOrderAs(migrated, AMARA.email, AMARA.password)
    const ben = await placeOrderAs(migrated, BEN.email, BEN.password)

    const amaraList = await app.request(
      '/api/v1/account/orders',
      { headers: { cookie: bothCookies(amara.session, amara.customer) } },
      { DB: migrated.db },
    )
    const amaraBody = (await amaraList.json()) as { data: Array<{ reference: string }> }
    expect(amaraBody.data.map((o) => o.reference)).toContain(amara.reference)
    expect(amaraBody.data.map((o) => o.reference)).not.toContain(ben.reference)

    const benList = await app.request(
      '/api/v1/account/orders',
      { headers: { cookie: bothCookies(ben.session, ben.customer) } },
      { DB: migrated.db },
    )
    const benBody = (await benList.json()) as { data: Array<{ reference: string }> }
    expect(benBody.data.map((o) => o.reference)).toContain(ben.reference)
    expect(benBody.data.map((o) => o.reference)).not.toContain(amara.reference)
  })

  it('conceals other customers’ order details behind an identical 404', async () => {
    const migrated = createMigratedD1()
    const amara = await placeOrderAs(migrated, AMARA.email, AMARA.password)
    const ben = await placeOrderAs(migrated, BEN.email, BEN.password)

    const crossA = await app.request(
      `/api/v1/account/orders/${ben.reference}`,
      { headers: { cookie: bothCookies(amara.session, amara.customer) } },
      { DB: migrated.db },
    )
    const crossB = await app.request(
      `/api/v1/account/orders/${amara.reference}`,
      { headers: { cookie: bothCookies(ben.session, ben.customer) } },
      { DB: migrated.db },
    )
    for (const response of [crossA, crossB]) {
      expect(response.status).toBe(404)
      expect(((await response.json()) as { error: string }).error).toBe('not_found')
    }

    const own = await app.request(
      `/api/v1/account/orders/${amara.reference}`,
      { headers: { cookie: bothCookies(amara.session, amara.customer) } },
      { DB: migrated.db },
    )
    expect(own.status).toBe(200)
    const detail = (await own.json()) as { reference: string }
    expect(detail.reference).toBe(amara.reference)
  })

  it('ignores customer ids supplied by the client — ownership is server-resolved', async () => {
    const migrated = createMigratedD1()
    const amara = await placeOrderAs(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(amara.session, amara.customer)

    // A guessed/submitted identifier never widens access.
    const list = await app.request(
      '/api/v1/account/orders?customerId=2&customer_id=2',
      { headers: { cookie } },
      { DB: migrated.db },
    )
    const body = (await list.json()) as { data: Array<{ reference: string }> }
    expect(body.data.map((o) => o.reference)).toEqual([amara.reference])

    const loginAsBen = await login(migrated, BEN.email, BEN.password, cookie)
    expect(loginAsBen.status).toBe(200)
    // login body may carry anything — it is ignored by design.
    const loginWithId = await login(migrated, BEN.email, BEN.password)
    expect(loginWithId.status).toBe(200)
  })

  it('answers 400 for a malformed order reference', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    const response = await app.request(
      '/api/v1/account/orders/not-a-reference',
      { headers: { cookie: bothCookies(session, customer) } },
      { DB: migrated.db },
    )
    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: string }).error).toBe('invalid_request')
  })

  it('denies ownership checks after logout', async () => {
    const migrated = createMigratedD1()
    const amara = await placeOrderAs(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(amara.session, amara.customer)
    await app.request('/api/v1/auth/logout', { method: 'POST', headers: { cookie } }, { DB: migrated.db })

    const list = await app.request(
      '/api/v1/account/orders',
      { headers: { cookie } },
      { DB: migrated.db },
    )
    expect(list.status).toBe(401)
    const detail = await app.request(
      `/api/v1/account/orders/${amara.reference}`,
      { headers: { cookie } },
      { DB: migrated.db },
    )
    expect(detail.status).toBe(401)
  })
})

describe('compatibility with guest cart and checkout', () => {
  it('signed-in checkout attaches the customer and the order shows up in account history', async () => {
    const migrated = createMigratedD1()
    const { session, customer } = await signIn(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(session, customer)
    await addToCart(migrated, 'ridgeline-2-person-tent', cookie)
    const cookieAfterAdd = cookie // no new practice cookie is minted on mutation
    const placed = await checkout(migrated, cookieAfterAdd)
    expect(placed.status).toBe(201)
    const { reference } = (await placed.json()) as { reference: string }

    const list = await app.request(
      '/api/v1/account/orders',
      { headers: { cookie: cookieAfterAdd } },
      { DB: migrated.db },
    )
    expect(((await list.json()) as { data: Array<{ reference: string }> }).data[0]?.reference).toBe(
      reference,
    )

    // Still readable through the pre-existing session-scoped endpoint.
    const legacy = await app.request(
      `/api/v1/orders/${reference}`,
      { headers: { cookie: cookieAfterAdd } },
      { DB: migrated.db },
    )
    expect(legacy.status).toBe(200)
  })

  it('guest orders are never silently adopted by a later login', async () => {
    const migrated = createMigratedD1()
    // Guest adds and checks out without any sign-in.
    const added = await addToCart(migrated, 'ridgeline-2-person-tent')
    const guestSession = extractCookie(added.headers.get('set-cookie'), 'mpl_session')
    expect(guestSession).not.toBeNull()
    const guestCookie = `mpl_session=${guestSession}`
    const placed = await checkout(migrated, guestCookie)
    expect(placed.status).toBe(201)
    const { reference } = (await placed.json()) as { reference: string }

    // Same browser signs in afterwards; the guest order is NOT adopted.
    const signedIn = await login(migrated, AMARA.email, AMARA.password, guestCookie)
    expect(signedIn.status).toBe(200)
    const joined = signedIn.headers.get('set-cookie') ?? ''
    const customer = extractCookie(joined, 'mpl_customer')
    const cookie = bothCookies(guestSession, customer)
    const list = await app.request(
      '/api/v1/account/orders',
      { headers: { cookie } },
      { DB: migrated.db },
    )
    const data = ((await list.json()) as { data: Array<{ reference: string }> }).data
    expect(data.map((o) => o.reference)).not.toContain(reference)

    // The guest order stays readable through the session-scoped endpoint.
    const legacy = await app.request(
      `/api/v1/orders/${reference}`,
      { headers: { cookie } },
      { DB: migrated.db },
    )
    expect(legacy.status).toBe(200)
  })

  it('the cart survives sign-in within the same practice session', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, 'ridgeline-2-person-tent')
    const guestSession = extractCookie(added.headers.get('set-cookie'), 'mpl_session')
    const signedIn = await login(migrated, AMARA.email, AMARA.password, `mpl_session=${guestSession}`)
    const customer = extractCookie(signedIn.headers.get('set-cookie'), 'mpl_customer')

    const cart = await app.request(
      '/api/v1/cart',
      { headers: { cookie: bothCookies(guestSession, customer) } },
      { DB: migrated.db },
    )
    const body = (await cart.json()) as { items: Array<{ slug: string }> }
    expect(body.items.map((line) => line.slug)).toContain('ridgeline-2-person-tent')
  })
})
