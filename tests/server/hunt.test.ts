// Bug-hunt engine v1 (P3-M7): registry, activation, isolation, reset.
// Runs against the real migrations via the node:sqlite harness.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { DEFECTS, findDefect } from '../../src/server/defects'
import { HUNTS, findHunt } from '../../src/server/hunts'
import { createMigratedD1, type MigratedD1 } from '../helpers/fake-d1'

function sessionCookieHeader(token: string) {
  return { cookie: `mpl_session=${token}` }
}

function extractSessionCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /mpl_session=([a-f0-9]{32})/.exec(setCookie)
  return match ? match[1] : null
}

function bothCookies(session: string | null, customer: string | null) {
  return [
    session ? `mpl_session=${session}` : null,
    customer ? `mpl_customer=${customer}` : null,
  ]
    .filter(Boolean)
    .join('; ')
}

async function searchProducts(migrated: MigratedD1, q: string, token?: string) {
  return app.request(
    `/api/v1/products?q=${encodeURIComponent(q)}`,
    { headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
}

async function addToCart(migrated: MigratedD1, slug: string, token?: string) {
  const response = await app.request(
    '/api/v1/cart/items',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? sessionCookieHeader(token) : {}),
      },
      body: JSON.stringify({ slug, quantity: 1 }),
    },
    { DB: migrated.db },
  )
  const newToken = extractSessionCookie(response.headers.get('set-cookie')) ?? token ?? null
  return { response, token: newToken }
}

async function startHunt(migrated: MigratedD1, huntId: string, token?: string, body?: unknown) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/start`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? sessionCookieHeader(token) : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
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

async function getSession(migrated: MigratedD1, token?: string) {
  return app.request(
    '/api/v1/practice/session',
    { headers: token ? sessionCookieHeader(token) : {} },
    { DB: migrated.db },
  )
}

/** 'vestibules' appears only in the Ridgeline 2-Person Tent *description*. */
const DESCRIPTION_ONLY_TERM = 'vestibules'
/** 'tent' appears in the name, so it must match in both modes. */
const NAME_TERM = 'trekking'

describe('hunt and defect registries (code, not data)', () => {
  it('ships the full P3-M8 hunt set whose defects all exist in the defect registry', () => {
    expect(HUNTS.length).toBe(10)
    expect(new Set(HUNTS.map((hunt) => hunt.id)).size).toBe(HUNTS.length)
    for (const hunt of HUNTS) {
      expect(hunt.id).toMatch(/^[a-z0-9][a-z0-9-]{2,63}$/)
      expect(hunt.defectIds.length).toBeGreaterThan(0)
      for (const defectId of hunt.defectIds) {
        expect(findDefect(defectId), `${hunt.id} references missing ${defectId}`).not.toBeNull()
      }
      expect(hunt.scenarioId).toBeTruthy()
    }
  })

  it('registers the full P3-M8 defect catalogue', () => {
    expect(DEFECTS.map((defect) => defect.id)).toEqual([
      'CATALOGUE-001',
      'CATALOGUE-002',
      'CART-001',
      'INVENTORY-001',
      'PRICING-001',
      'CHECKOUT-001',
      'AUTHN-001',
      'RBAC-001',
      'MASS-001',
      'AUTHZ-001',
    ])
    expect(new Set(DEFECTS.map((defect) => defect.id)).size).toBe(DEFECTS.length)
  })

  it('resolves unknown registry ids to null', () => {
    expect(findHunt('hunt-nope-999')).toBeNull()
    expect(findDefect('NOPE-999')).toBeNull()
  })
})

describe('GET /api/v1/practice/session', () => {
  it('reports clean mode for an unknown browser without minting a session', async () => {
    const migrated = createMigratedD1()
    const response = await getSession(migrated)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await response.json()).toEqual({ mode: 'clean', hunt: null })
    const sessions = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM practice_sessions').get() as {
      n: number
    }
    expect(sessions.n).toBe(0)
  })

  it('never leaks defect ids', async () => {
    const migrated = createMigratedD1()
    const started = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(started.headers.get('set-cookie'))!
    const response = await getSession(migrated, token)
    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('CATALOGUE-001')
  })
})

describe('learner-safe curriculum in practice responses', () => {
  it('includes the curriculum on start and session payloads, with no evaluator data', async () => {
    const migrated = createMigratedD1()
    const started = await startHunt(migrated, 'hunt-pricing-001')
    expect(started.status).toBe(200)
    const startBody = (await started.json()) as {
      hunt: { curriculum?: { difficulty: string; conceptsPracticed: string[] } }
    }
    expect(startBody.hunt.curriculum).toBeDefined()
    expect(startBody.hunt.curriculum?.difficulty).toBe('beginner')
    expect(startBody.hunt.curriculum?.conceptsPracticed.length).toBeGreaterThanOrEqual(3)

    const token = extractSessionCookie(started.headers.get('set-cookie'))!
    const session = (await (await getSession(migrated, token)).json()) as {
      hunt: { curriculum?: { difficulty: string } } | null
    }
    expect(session.hunt?.curriculum?.difficulty).toBe('beginner')

    const raw = JSON.stringify([startBody, session])
    for (const id of ['PRICING-001', 'CATALOGUE-001', 'hint_mask', 'quality_score']) {
      expect(raw).not.toContain(id)
    }
  })
})

describe('POST /api/v1/practice/hunts/:huntId/start', () => {
  it('mints a bug-hunt session for an anonymous browser', async () => {
    const migrated = createMigratedD1()
    const response = await startHunt(migrated, 'hunt-catalogue-001')
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie')
    expect(cookie).toContain('mpl_session=')
    expect(cookie).toContain('HttpOnly')
    const body = (await response.json()) as { mode: string; hunt: { id: string; title: string } }
    expect(body.mode).toBe('bug_hunt')
    expect(body.hunt.id).toBe('hunt-catalogue-001')
    expect(JSON.stringify(body)).not.toContain('CATALOGUE-001')
  })

  it('rejects unknown hunt ids with 404 and malformed ones with 400', async () => {
    const migrated = createMigratedD1()
    const unknown = await startHunt(migrated, 'hunt-nope-999')
    expect(unknown.status).toBe(404)
    expect(((await unknown.json()) as { error: string }).error).toBe('hunt_not_found')
    const malformed = await startHunt(migrated, 'BAD_ID!!')
    expect(malformed.status).toBe(400)
    expect(((await malformed.json()) as { error: string }).error).toBe('invalid_request')
    expect((await searchProducts(migrated, DESCRIPTION_ONLY_TERM)).status).toBe(200)
  })

  it('ignores forged defect ids and activation flags sent in the body', async () => {
    const migrated = createMigratedD1()
    const response = await startHunt(migrated, 'hunt-catalogue-001', undefined, {
      mode: 'clean',
      huntId: 'hunt-pricing-001',
      defectIds: ['PRICE-001', 'CATALOGUE-001'],
      defects: [{ id: 'PRICE-001' }],
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { mode: string; hunt: { id: string } }
    // The registered hunt starts anyway, with its own fixed defect list.
    expect(body).toEqual({
      mode: 'bug_hunt',
      hunt: expect.objectContaining({ id: 'hunt-catalogue-001' }),
    })
    expect(JSON.stringify(body)).not.toContain('PRICE-001')
    expect(JSON.stringify(body)).not.toContain('CATALOGUE-001')
  })

  it('cannot be tricked into the clean response by a forged mode in the body', async () => {
    const migrated = createMigratedD1()
    const started = await startHunt(migrated, 'hunt-catalogue-001', undefined, { mode: 'clean' })
    const token = extractSessionCookie(started.headers.get('set-cookie'))!
    const session = (await (await getSession(migrated, token)).json()) as { mode: string }
    expect(session.mode).toBe('bug_hunt')
  })

  it('re-stamps the caller’s live session instead of minting a second one', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, 'ridgeline-2-person-tent')
    const token = added.token!
    const response = await startHunt(migrated, 'hunt-catalogue-001', token)
    expect(response.status).toBe(200)
    // No new cookie is issued — the existing session is re-stamped.
    expect(response.headers.get('set-cookie')).toBeNull()
    const row = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM practice_sessions')
      .get() as { n: number }
    expect(row.n).toBe(1)
    const cart = (await (
      await app.request('/api/v1/cart', { headers: sessionCookieHeader(token) }, { DB: migrated.db })
    ).json()) as { items: unknown[] }
    expect(cart.items).toHaveLength(1)
  })

  it('is idempotent across repeated starts', async () => {
    const migrated = createMigratedD1()
    const first = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(first.headers.get('set-cookie'))!
    const second = await startHunt(migrated, 'hunt-catalogue-001', token)
    expect(second.status).toBe(200)
    expect(((await second.json()) as { mode?: string }).mode).toBe('bug_hunt')
    const row = migrated.sqlite
      .prepare('SELECT COUNT(*) AS n FROM practice_sessions')
      .get() as { n: number }
    expect(row.n).toBe(1)
  })
})

describe('bug-hunt activation is session-scoped', () => {
  it('shows the description-facet defect only to the hunt session (CATALOGUE-001)', async () => {
    const migrated = createMigratedD1()
    const clean = await searchProducts(migrated, DESCRIPTION_ONLY_TERM)
    expect(((await clean.json()) as { total: number }).total).toBe(1)

    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    const inHunt = await searchProducts(migrated, DESCRIPTION_ONLY_TERM, token)
    expect(inHunt.status).toBe(200)
    const body = (await inHunt.json()) as { total: number; data: unknown[] }
    expect(body.total).toBe(0)
    expect(body.data).toHaveLength(0)

    // Name matches still work inside the hunt — only the description facet is broken.
    const nameInHunt = await searchProducts(migrated, NAME_TERM, token)
    expect(((await nameInHunt.json()) as { total: number }).total).toBeGreaterThan(0)
  })

  it('isolates two learners: hunt session is defective, other session is clean', async () => {
    const migrated = createMigratedD1()
    const huntSession = await startHunt(migrated, 'hunt-catalogue-001')
    const huntToken = extractSessionCookie(huntSession.headers.get('set-cookie'))!

    // Give learner B their own session via the cart mint.
    const bob = await addToCart(migrated, 'sequoia-sleeping-bag')
    const bobToken = bob.token!
    expect(bobToken).not.toBe(huntToken)

    const bobSearch = await searchProducts(migrated, DESCRIPTION_ONLY_TERM, bobToken)
    expect(((await bobSearch.json()) as { total: number }).total).toBe(1)
    const huntSearch = await searchProducts(migrated, DESCRIPTION_ONLY_TERM, huntToken)
    expect(((await huntSearch.json()) as { total: number }).total).toBe(0)
  })

  it('leaves unrelated catalogue behaviour untouched in bug-hunt mode', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    const sorted = await app.request(
      '/api/v1/products?sort=price_asc&perPage=3',
      { headers: sessionCookieHeader(token) },
      { DB: migrated.db },
    )
    expect(sorted.status).toBe(200)
    const body = (await sorted.json()) as { data: Array<{ priceCents: number }> }
    const prices = body.data.map((product) => product.priceCents)
    expect([...prices]).toEqual([...prices].sort((a, b) => a - b))
  })

  it('keeps sorting, cart and checkout fully functional in bug-hunt mode', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    const added = await addToCart(migrated, 'ridgeline-2-person-tent', token)
    expect(added.response.status).toBe(200)
    const cart = (await added.response.json()) as { subtotalCents: number; items: unknown[] }
    expect(cart.subtotalCents).toBe(18999)
    expect(cart.items).toHaveLength(1)
  })

  it('resolves a bug-hunt session with an unknown hunt_id to clean behaviour', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    migrated.sqlite.exec("UPDATE practice_sessions SET hunt_id = 'hunt-ghost-999'")
    const session = (await (await getSession(migrated, token)).json()) as {
      mode: string
      hunt: unknown
    }
    expect(session).toEqual({ mode: 'clean', hunt: null })
    const search = await searchProducts(migrated, DESCRIPTION_ONLY_TERM, token)
    expect(((await search.json()) as { total: number }).total).toBe(1)
  })

  it('resolves an expired bug-hunt session to clean and purges it', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    migrated.sqlite.exec("UPDATE practice_sessions SET expires_at = '2000-01-01T00:00:00.000Z'")
    const search = await searchProducts(migrated, DESCRIPTION_ONLY_TERM, token)
    expect(((await search.json()) as { total: number }).total).toBe(1)
    const row = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM practice_sessions').get() as {
      n: number
    }
    expect(row.n).toBe(0)
  })
})

describe('POST /api/v1/practice/session/reset', () => {
  it('restores clean behaviour for the same browser session (non-destructive)', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!

    const reset = await resetSession(migrated, token)
    expect(reset.status).toBe(200)
    expect(await reset.json()).toEqual({ mode: 'clean', hunt: null })

    const search = await searchProducts(migrated, DESCRIPTION_ONLY_TERM, token)
    expect(((await search.json()) as { total: number }).total).toBe(1)

    const row = migrated.sqlite.prepare('SELECT mode, hunt_id FROM practice_sessions').get() as {
      mode: string
      hunt_id: string | null
    }
    expect(row).toEqual({ mode: 'clean', hunt_id: null })
  })

  it('preserves the cart and orders across start and reset', async () => {
    const migrated = createMigratedD1()
    const added = await addToCart(migrated, 'ridgeline-2-person-tent')
    const token = added.token!
    const checkout = await app.request(
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
        }),
      },
      { DB: migrated.db },
    )
    expect(checkout.status).toBe(201)
    const order = (await checkout.json()) as { reference: string }

    await startHunt(migrated, 'hunt-catalogue-001', token)
    await resetSession(migrated, token)

    const orderResponse = await app.request(
      `/api/v1/orders/${order.reference}`,
      { headers: sessionCookieHeader(token) },
      { DB: migrated.db },
    )
    expect(orderResponse.status).toBe(200)
    expect(((await orderResponse.json()) as { reference: string }).reference).toBe(order.reference)
  })

  it('is idempotent across repeated resets', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const reset = await resetSession(migrated, token)
      expect(reset.status).toBe(200)
      expect(await reset.json()).toEqual({ mode: 'clean', hunt: null })
    }
    const row = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM practice_sessions').get() as {
      n: number
    }
    expect(row.n).toBe(1)
  })

  it('mints a clean session for an unknown browser', async () => {
    const migrated = createMigratedD1()
    const reset = await resetSession(migrated)
    expect(reset.status).toBe(200)
    expect(await reset.json()).toEqual({ mode: 'clean', hunt: null })
    const token = extractSessionCookie(reset.headers.get('set-cookie'))
    expect(token).toBeTruthy()
    const session = (await (await getSession(migrated, token!)).json()) as { mode: string }
    expect(session.mode).toBe('clean')
  })

  it('clears the hunt even after a mid-hunt cart mutation', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    await addToCart(migrated, 'sequoia-sleeping-bag', token)
    await resetSession(migrated, token)
    const session = (await (await getSession(migrated, token)).json()) as { mode: string }
    expect(session.mode).toBe('clean')
    const search = await searchProducts(migrated, DESCRIPTION_ONLY_TERM, token)
    expect(((await search.json()) as { total: number }).total).toBe(1)
  })
})

describe('guest and synthetic-account compatibility in bug-hunt mode', () => {
  async function signIn(migrated: MigratedD1, extraCookie?: string) {
    const response = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(extraCookie ? { cookie: extraCookie } : {}),
        },
        body: JSON.stringify({ email: 'amara.okafor@example.com', password: 'demo-amara-1001' }),
      },
      { DB: migrated.db },
    )
    const setCookie = response.headers.get('set-cookie') ?? ''
    const customer = /mpl_customer=([a-f0-9]{32})/.exec(setCookie)?.[1] ?? null
    const practice = /mpl_session=([a-f0-9]{32})/.exec(setCookie)?.[1] ?? null
    return { response, customer, practice }
  }

  it('keeps the signed-in customer bound across hunt start and reset (non-destructive)', async () => {
    const migrated = createMigratedD1()
    const { customer, practice } = await signIn(migrated)
    expect(customer).toBeTruthy()
    expect(practice).toBeTruthy()

    const hunt = await startHunt(migrated, 'hunt-catalogue-001', practice ?? undefined)
    expect(hunt.status).toBe(200)
    const reset = await resetSession(migrated, practice ?? undefined)
    expect(reset.status).toBe(200)

    const me = await app.request(
      '/api/v1/auth/me',
      { headers: { cookie: bothCookies(practice, customer) } },
      { DB: migrated.db },
    )
    expect(me.status).toBe(200)
    const profile = (await me.json()) as { customer: { email: string } }
    expect(profile.customer.email).toBe('amara.okafor@example.com')
  })

  it('lets a guest complete sign-in while a hunt is active', async () => {
    const migrated = createMigratedD1()
    const hunt = await startHunt(migrated, 'hunt-catalogue-001')
    const token = extractSessionCookie(hunt.headers.get('set-cookie'))!
    const { response, customer } = await signIn(migrated, sessionCookieHeader(token).cookie)
    expect(response.status).toBe(200)
    expect(customer).toBeTruthy()
    const account = await app.request(
      '/api/v1/account',
      { headers: { cookie: bothCookies(token, customer) } },
      { DB: migrated.db },
    )
    expect(account.status).toBe(200)
  })
})
