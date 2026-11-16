// Practice API tokens (P5-M2) — migration 0011, minting, resolution and the
// AUTHN-001 replay hunt. Runs against the real migrations via the
// node:sqlite harness.
import { describe, expect, it } from 'vitest'
import { app } from '../../src/server/app'
import { createMigratedD1, applyRemainingMigrations, type MigratedD1 } from '../helpers/fake-d1'
import {
  API_TOKEN_TTL_DEFAULT,
  API_TOKEN_TTL_MAX,
  API_TOKEN_TTL_MIN,
  hashApiToken,
  isApiTokenFormat,
  parseExpiresInSeconds,
} from '../../src/server/apiTokens'
import { sweepExpiredData } from '../../src/server/maintenance'

const AMARA = { email: 'amara.okafor@example.com', password: 'demo-amara-1001' }
const BEN = { email: 'ben.whitmore@example.net', password: 'demo-ben-1002' }
const DANA = { email: 'dana.reyes@example.com', password: 'demo-dana-1004' } // suspended
const ROWAN = { email: 'rowan.ellison@example.com', password: 'demo-rowan-9001' } // staff

function bothCookies(session: string | null, customer: string | null) {
  return [
    session ? `mpl_session=${session}` : null,
    customer ? `mpl_customer=${customer}` : null,
  ]
    .filter(Boolean)
    .join('; ')
}

function extractCookie(setCookie: string | null, name: string): string | null {
  if (!setCookie) return null
  const match = new RegExp(`${name}=([a-f0-9]{32})`).exec(setCookie)
  return match ? match[1] : null
}

function setCookies(headers: Headers): string {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie
  if (typeof getSetCookie === 'function') {
    return getSetCookie.call(headers).join('; ')
  }
  return headers.get('set-cookie') ?? ''
}

/** Signs a customer in; returns the fresh cookie pair for this browser. */
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
  const joined = setCookies(response.headers)
  return {
    response,
    session: extractCookie(joined, 'mpl_session'),
    customer: extractCookie(joined, 'mpl_customer'),
  }
}

async function mintToken(
  migrated: MigratedD1,
  body: Record<string, unknown>,
  options: { ip?: string } = {},
) {
  return app.request(
    '/api/v1/auth/token',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.ip ? { 'cf-connecting-ip': options.ip } : {}),
      },
      body: JSON.stringify(body),
    },
    { DB: migrated.db },
  )
}

async function protectedGet(
  migrated: MigratedD1,
  path: string,
  options: { cookie?: string; bearer?: string } = {},
) {
  const headers: Record<string, string> = {}
  if (options.cookie) headers.cookie = options.cookie
  if (options.bearer) headers.authorization = `Bearer ${options.bearer}`
  return app.request(path, { headers }, { DB: migrated.db })
}

async function startHunt(migrated: MigratedD1, huntId: string, token?: string) {
  return app.request(
    `/api/v1/practice/hunts/${huntId}/start`,
    {
      method: 'POST',
      headers: token ? { cookie: `mpl_session=${token}` } : {},
    },
    { DB: migrated.db },
  )
}

async function resetSession(migrated: MigratedD1, token: string) {
  return app.request(
    '/api/v1/practice/session/reset',
    { method: 'POST', headers: { cookie: `mpl_session=${token}` } },
    { DB: migrated.db },
  )
}

async function mintFor(
  migrated: MigratedD1,
  account: { email: string; password: string },
): Promise<{ token: string; expiresIn: number; expiresAt: string }> {
  const response = await mintToken(migrated, account)
  expect(response.status).toBe(201)
  return (await response.json()) as { token: string; expiresIn: number; expiresAt: string }
}

describe('parseExpiresInSeconds', () => {
  it('defaults to 900 and accepts the inclusive 15–900 range', () => {
    expect(parseExpiresInSeconds(undefined)).toEqual({ ok: true, seconds: 900 })
    expect(parseExpiresInSeconds(null)).toEqual({ ok: true, seconds: 900 })
    expect(parseExpiresInSeconds(15)).toEqual({ ok: true, seconds: 15 })
    expect(parseExpiresInSeconds(900)).toEqual({ ok: true, seconds: 900 })
    expect(parseExpiresInSeconds(60)).toEqual({ ok: true, seconds: 60 })
  })

  it('clamps out-of-range and truncates fractional values', () => {
    expect(parseExpiresInSeconds(0)).toEqual({ ok: true, seconds: API_TOKEN_TTL_MIN })
    expect(parseExpiresInSeconds(-120)).toEqual({ ok: true, seconds: API_TOKEN_TTL_MIN })
    expect(parseExpiresInSeconds(9999)).toEqual({ ok: true, seconds: API_TOKEN_TTL_MAX })
    expect(parseExpiresInSeconds(90.9)).toEqual({ ok: true, seconds: 90 })
  })

  it('rejects non-finite and non-number input', () => {
    expect(parseExpiresInSeconds(Number.NaN).ok).toBe(false)
    expect(parseExpiresInSeconds(Number.POSITIVE_INFINITY).ok).toBe(false)
    expect(parseExpiresInSeconds('60').ok).toBe(false)
    expect(parseExpiresInSeconds(true).ok).toBe(false)
  })

  it('pins the approved clamp constants', () => {
    expect(API_TOKEN_TTL_MIN).toBe(15)
    expect(API_TOKEN_TTL_MAX).toBe(900)
    expect(API_TOKEN_TTL_DEFAULT).toBe(900)
  })
})

describe('isApiTokenFormat', () => {
  it('accepts exactly 64 lowercase hex characters', () => {
    expect(isApiTokenFormat('a'.repeat(64))).toBe(true)
    expect(isApiTokenFormat('A'.repeat(64))).toBe(false)
    expect(isApiTokenFormat('a'.repeat(63))).toBe(false)
    expect(isApiTokenFormat('a'.repeat(65))).toBe(false)
    expect(isApiTokenFormat('zz'.repeat(32))).toBe(false)
  })
})

describe('migration 0011 (api_tokens)', () => {
  it('applies cleanly on a fresh database (schema_version 11)', () => {
    const migrated = createMigratedD1()
    const row = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('11')

    const tables = migrated.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'api_tokens'")
      .get() as { name: string } | undefined
    expect(tables?.name).toBe('api_tokens')

    const indexes = migrated.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_api_tokens%' ORDER BY name")
      .all() as Array<{ name: string }>
    expect(indexes.map((entry) => entry.name)).toEqual(['idx_api_tokens_customer', 'idx_api_tokens_expiry'])
  })

  it('upgrades an existing 0001-0010 database without touching data', () => {
    const migrated = createMigratedD1({ through: 10 })
    const before = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(before.value).toBe('10')

    migrated.sqlite.exec(`
      INSERT INTO practice_sessions (token_hash, created_at, expires_at, mode, hunt_id)
      VALUES ('cafe' || printf('%028d', 7), '2026-11-01T00:00:00.000Z', '2027-11-01T00:00:00.000Z', 'clean', NULL);
      INSERT INTO carts (session_id) SELECT id FROM practice_sessions WHERE token_hash = 'cafe' || printf('%028d', 7);
    `)

    applyRemainingMigrations(migrated, 10)

    const after = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(after.value).toBe('11')

    const tables = migrated.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'api_tokens'")
      .get() as { name: string } | undefined
    expect(tables?.name).toBe('api_tokens')

    const sessions = migrated.sqlite
      .prepare("SELECT COUNT(*) AS count FROM practice_sessions WHERE token_hash = 'cafe' || printf('%028d', 7)")
      .get() as { count: number }
    expect(sessions.count).toBe(1)
  })

  it('enforces the foreign key and the hash uniqueness', () => {
    const migrated = createMigratedD1()
    expect(() =>
      migrated.sqlite
        .prepare("INSERT INTO api_tokens (token_hash, customer_id, expires_at) VALUES ('h', 999, '2027-11-01T00:00:00.000Z')")
        .run(),
    ).toThrow()

    const customer = migrated.sqlite
      .prepare('SELECT id FROM customers ORDER BY id ASC LIMIT 1')
      .get() as { id: number }
    migrated.sqlite
      .prepare("INSERT INTO api_tokens (token_hash, customer_id, expires_at) VALUES ('dupe', ?, '2027-11-01T00:00:00.000Z')")
      .run(customer.id)
    expect(() =>
      migrated.sqlite
        .prepare("INSERT INTO api_tokens (token_hash, customer_id, expires_at) VALUES ('dupe', ?, '2027-11-01T00:00:00.000Z')")
        .run(customer.id),
    ).toThrow()
  })
})

describe('POST /api/v1/auth/token', () => {
  it('mints a 201 token with the default TTL and returns the raw token once', async () => {
    const migrated = createMigratedD1()
    const response = await mintToken(migrated, AMARA)
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      token: string
      tokenType: string
      expiresIn: number
      expiresAt: string
    }
    expect(body.tokenType).toBe('Bearer')
    expect(body.expiresIn).toBe(900)
    expect(isApiTokenFormat(body.token)).toBe(true)
    expect(new Date(body.expiresAt).toString()).not.toBe('Invalid Date')

    // Only the SHA-256 hash is stored — never the raw token.
    const row = migrated.sqlite
      .prepare('SELECT token_hash FROM api_tokens')
      .get() as { token_hash: string }
    expect(row.token_hash).toBe(await hashApiToken(body.token))
    expect(row.token_hash).not.toBe(body.token)
  })

  it('clamps expiresInSeconds to the 15–900 range', async () => {
    const migrated = createMigratedD1()
    for (const [input, expected] of [
      [1, 15],
      [15, 15],
      [60, 60],
      [900, 900],
      [999999, 900],
    ] as const) {
      const response = await mintToken(migrated, { ...AMARA, expiresInSeconds: input })
      expect(response.status).toBe(201)
      const body = (await response.json()) as { expiresIn: number }
      expect(body.expiresIn).toBe(expected)
    }
  })

  it('rejects a non-numeric expiresInSeconds with 400', async () => {
    const migrated = createMigratedD1()
    const response = await mintToken(migrated, { ...AMARA, expiresInSeconds: '60' })
    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: string }).error).toBe('invalid_request')
  })

  it('rejects unknown emails and wrong passwords with the login envelope', async () => {
    const migrated = createMigratedD1()
    const unknown = await mintToken(migrated, { email: 'ghost@example.org', password: 'nope' })
    expect(unknown.status).toBe(401)
    expect(((await unknown.json()) as { error: string }).error).toBe('invalid_credentials')

    const wrong = await mintToken(migrated, { ...AMARA, password: 'wrong-password' })
    expect(wrong.status).toBe(401)
    expect(((await wrong.json()) as { error: string }).error).toBe('invalid_credentials')
  })

  it('refuses suspended accounts with 403 account_suspended', async () => {
    const migrated = createMigratedD1()
    const response = await mintToken(migrated, DANA)
    expect(response.status).toBe(403)
    expect(((await response.json()) as { error: string }).error).toBe('account_suspended')
  })

  it('shares the login failure budget: five failures lock both endpoints', async () => {
    const migrated = createMigratedD1()
    const ip = '198.51.100.44'
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await mintToken(migrated, { email: 'nobody@example.org', password: 'x' }, { ip })
      expect(response.status).toBe(401)
    }
    const locked = await mintToken(migrated, { email: 'nobody@example.org', password: 'x' }, { ip })
    expect(locked.status).toBe(429)
    expect(((await locked.json()) as { error: string }).error).toBe('login_rate_limited')

    // The shared budget means a correct password is also refused now.
    const alsoLocked = await mintToken(migrated, AMARA, { ip })
    expect(alsoLocked.status).toBe(429)
  })

  it('a successful mint clears the shared login budget', async () => {
    const migrated = createMigratedD1()
    const ip = '198.51.100.45'
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await mintToken(migrated, { email: 'nobody@example.org', password: 'x' }, { ip })
    }
    const ok = await mintToken(migrated, AMARA, { ip })
    expect(ok.status).toBe(201)
    const again = await mintToken(migrated, AMARA, { ip })
    expect(again.status).toBe(201)
  })
})

describe('Bearer resolution', () => {
  it('resolves the bound customer with no cookie at all', async () => {
    const migrated = createMigratedD1()
    const { token } = await mintFor(migrated, AMARA)
    const me = await protectedGet(migrated, '/api/v1/auth/me', { bearer: token })
    expect(me.status).toBe(200)
    const body = (await me.json()) as { customer: { email: string } }
    expect(body.customer.email).toBe(AMARA.email)
  })

  it('carries roles from the stored customer row, never from the token', async () => {
    const migrated = createMigratedD1()
    const customer = await mintFor(migrated, AMARA)
    const staff = await mintFor(migrated, ROWAN)

    const customerInventory = await protectedGet(migrated, '/api/v1/admin/inventory', {
      bearer: customer.token,
    })
    expect(customerInventory.status).toBe(403)
    expect(((await customerInventory.json()) as { error: string }).error).toBe('staff_required')

    const staffInventory = await protectedGet(migrated, '/api/v1/admin/inventory', {
      bearer: staff.token,
    })
    expect(staffInventory.status).toBe(200)
  })

  it('never falls back to the cookie when a Bearer header is presented', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(amara.session, amara.customer)

    const garbage = await protectedGet(migrated, '/api/v1/auth/me', {
      cookie,
      bearer: 'not-a-real-token',
    })
    expect(garbage.status).toBe(401)
    expect(((await garbage.json()) as { error: string }).error).toBe('unauthorized')
  })

  it('Bearer wins over the cookie when both are present', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(amara.session, amara.customer)
    const benToken = await mintFor(migrated, BEN)

    const me = await protectedGet(migrated, '/api/v1/auth/me', {
      cookie,
      bearer: benToken.token,
    })
    expect(me.status).toBe(200)
    const body = (await me.json()) as { customer: { email: string } }
    expect(body.customer.email).toBe(BEN.email)
  })

  it('rejects malformed and unknown Bearer credentials with 401 unauthorized', async () => {
    const migrated = createMigratedD1()
    for (const header of ['Bearer', 'Basic abc', `Bearer ${'a'.repeat(64)}`, 'bearer']) {
      const me = await app.request(
        '/api/v1/auth/me',
        { headers: { authorization: header } },
        { DB: migrated.db },
      )
      expect(me.status).toBe(401)
      expect(((await me.json()) as { error: string }).error).toBe('unauthorized')
    }
  })

  it('an expired Bearer token answers 401 token_expired and the row is deleted in passing', async () => {
    const migrated = createMigratedD1()
    const { token } = await mintFor(migrated, AMARA)
    migrated.sqlite
      .prepare('UPDATE api_tokens SET expires_at = ?')
      .run(new Date(Date.now() - 1000).toISOString())

    const me = await protectedGet(migrated, '/api/v1/auth/me', { bearer: token })
    expect(me.status).toBe(401)
    expect(((await me.json()) as { error: string }).error).toBe('token_expired')

    const rows = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM api_tokens')
      .get() as { count: number }
    expect(rows.count).toBe(0)
  })

  it('a revoked Bearer token answers 401 unauthorized (fail closed)', async () => {
    const migrated = createMigratedD1()
    const { token } = await mintFor(migrated, AMARA)
    migrated.sqlite
      .prepare('UPDATE api_tokens SET revoked_at = ?')
      .run(new Date().toISOString())

    const me = await protectedGet(migrated, '/api/v1/auth/me', { bearer: token })
    expect(me.status).toBe(401)
    expect(((await me.json()) as { error: string }).error).toBe('unauthorized')
  })

  it('an account suspended mid-token answers 403 account_suspended', async () => {
    const migrated = createMigratedD1()
    const { token } = await mintFor(migrated, AMARA)
    migrated.sqlite.prepare("UPDATE customers SET status = 'suspended' WHERE email = ?").run(AMARA.email)

    const me = await protectedGet(migrated, '/api/v1/auth/me', { bearer: token })
    expect(me.status).toBe(403)
    expect(((await me.json()) as { error: string }).error).toBe('account_suspended')
  })

  it('a token whose customer row vanished cascades away and fails closed', async () => {
    const migrated = createMigratedD1()
    const { token } = await mintFor(migrated, AMARA)
    migrated.sqlite.prepare('DELETE FROM customers WHERE email = ?').run(AMARA.email)

    const me = await protectedGet(migrated, '/api/v1/auth/me', { bearer: token })
    expect(me.status).toBe(401)
    const rows = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM api_tokens')
      .get() as { count: number }
    expect(rows.count).toBe(0)
  })

  it('the maintenance sweep purges expired and revoked tokens and keeps live ones', async () => {
    const migrated = createMigratedD1()
    const live = await mintFor(migrated, AMARA)
    const toExpire = await mintFor(migrated, BEN)
    migrated.sqlite
      .prepare('UPDATE api_tokens SET expires_at = ? WHERE token_hash = ?')
      .run(new Date(Date.now() - 1000).toISOString(), await hashApiToken(toExpire.token))
    const revoked = await mintFor(migrated, BEN)
    migrated.sqlite
      .prepare('UPDATE api_tokens SET revoked_at = ? WHERE token_hash = ?')
      .run(new Date().toISOString(), await hashApiToken(revoked.token))

    const counts = await sweepExpiredData(migrated.db)
    expect(counts.apiTokens).toBeGreaterThanOrEqual(2)

    const remaining = migrated.sqlite
      .prepare('SELECT COUNT(*) AS count FROM api_tokens WHERE token_hash = ?')
      .get(await hashApiToken(live.token)) as { count: number }
    expect(remaining.count).toBe(1)
  })
})

describe('logout revocation', () => {
  it('clean mode: logout revokes the account’s Bearer tokens', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(amara.session, amara.customer)
    const { token } = await mintFor(migrated, AMARA)

    const before = await protectedGet(migrated, '/api/v1/auth/me', { bearer: token })
    expect(before.status).toBe(200)

    const logout = await app.request(
      '/api/v1/auth/logout',
      { method: 'POST', headers: { cookie } },
      { DB: migrated.db },
    )
    expect(logout.status).toBe(200)

    const after = await protectedGet(migrated, '/api/v1/auth/me', { bearer: token })
    expect(after.status).toBe(401)
    expect(((await after.json()) as { error: string }).error).toBe('unauthorized')
  })

  it('logout is idempotent for guests and unknown cookies', async () => {
    const migrated = createMigratedD1()
    const response = await app.request(
      '/api/v1/auth/logout',
      { method: 'POST' },
      { DB: migrated.db },
    )
    expect(response.status).toBe(200)
    expect(((await response.json()) as { ok: boolean }).ok).toBe(true)
  })
})

describe('AUTHN-001 — token replay after logout', () => {
  it('the token survives logout only while the hunt is active; reset restores clean behaviour', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(amara.session, amara.customer)
    const minted = await mintFor(migrated, AMARA)

    // Activate the hunt for this learner's practice session.
    const hunt = await startHunt(migrated, 'hunt-authn-001', amara.session ?? undefined)
    expect(hunt.status).toBe(200)

    const logout = await app.request(
      '/api/v1/auth/logout',
      { method: 'POST', headers: { cookie } },
      { DB: migrated.db },
    )
    expect(logout.status).toBe(200)

    // Hunt active: the replayed token still resolves.
    const replay = await protectedGet(migrated, '/api/v1/auth/me', { bearer: minted.token })
    expect(replay.status).toBe(200)
    expect(((await replay.json()) as { customer: { email: string } }).customer.email).toBe(AMARA.email)

    // Reset; a fresh mint → sign-out → replay cycle behaves exactly like clean mode.
    expect((await resetSession(migrated, amara.session!)).status).toBe(200)
    const fresh = await signIn(migrated, AMARA.email, AMARA.password)
    const freshCookie = bothCookies(fresh.session, fresh.customer)
    const freshMinted = await mintFor(migrated, AMARA)
    await app.request(
      '/api/v1/auth/logout',
      { method: 'POST', headers: { cookie: freshCookie } },
      { DB: migrated.db },
    )
    const replayAfterReset = await protectedGet(migrated, '/api/v1/auth/me', {
      bearer: freshMinted.token,
    })
    expect(replayAfterReset.status).toBe(401)
  })

  it('the defect never activates for a learner without the hunt', async () => {
    const migrated = createMigratedD1()
    const amara = await signIn(migrated, AMARA.email, AMARA.password)
    const cookie = bothCookies(amara.session, amara.customer)
    const minted = await mintFor(migrated, AMARA)
    // A different hunt is active — AUTHN-001 must not activate.
    const hunt = await startHunt(migrated, 'hunt-cart-001', amara.session ?? undefined)
    expect(hunt.status).toBe(200)
    await app.request('/api/v1/auth/logout', { method: 'POST', headers: { cookie } }, { DB: migrated.db })
    const replay = await protectedGet(migrated, '/api/v1/auth/me', { bearer: minted.token })
    expect(replay.status).toBe(401)
  })
})
