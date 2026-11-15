// Session-keyed practice cart (P3-M3).
//
// Endpoints:
//   GET    /api/v1/cart            — read the current cart (empty if none)
//   POST   /api/v1/cart/items      — add a product (mints the session)
//   PATCH  /api/v1/cart/items/:id  — set a line's quantity
//   DELETE /api/v1/cart/items/:id  — remove a line
//   DELETE /api/v1/cart            — remove every line
//
// Security model:
// - The cart is resolved from the `mpl_session` cookie (HttpOnly,
//   SameSite=Strict, Path=/, 7-day expiry). Only a SHA-256 hash of the
//   opaque token is stored server-side. There is no way to ask for another
//   session's cart — every query is scoped to the caller's session/cart id.
// - Prices, totals and stock are always recomputed from the database. The
//   client sends only `{ slug, quantity }`; any price/total fields are
//   ignored by construction.
// - Quantity is an integer 1..99 (also a CHECK constraint) and within the
//   inventory row's quantity; the upsert/update carry the stock guard as a
//   WHERE clause so a lost race rejects instead of overselling.
// - Money is always integer cents; totals equal the sum of line totals.
//
// Checkout (M4, src/server/checkout.ts) rejects carts containing unavailable
// lines. Unavailable lines (deactivated product or
// stock below the line quantity) are kept and flagged — `available: false`
// per line, `hasUnavailableItems: true` per cart — never silently dropped
// or silently repriced.

import { Hono, type Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import {
  COMMERCE_CURRENCY,
  MAX_LINE_QUANTITY,
  type CartLine,
  type CartResponse,
  type StockStatus,
} from '../shared/commerce'
import type { AppEnv } from './app'
import { isDefectActive } from './defects'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionWithCart,
  ensureCart,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'

type CartContext =
  | { kind: 'ok'; cartId: number; newToken?: string }
  | { kind: 'none'; clearCookie: boolean }

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'Strict' as const,
    maxAge: SESSION_TTL_SECONDS,
    secure,
  }
}

function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === 'https:'
}

/**
 * Resolves the caller's cart context. Read paths never mint a session
 * (`create: false`): an unknown, malformed or missing cookie yields
 * `kind: 'none'` and the caller answers with an empty cart, clearing the
 * stale cookie when one was presented. Mutation paths mint a fresh session
 * and cart on first use.
 */
async function resolveCartContext(
  c: Context<AppEnv>,
  { create }: { create: boolean },
): Promise<CartContext> {
  const presented = getCookie(c, SESSION_COOKIE)

  if (presented && isTokenFormat(presented)) {
    const tokenHash = await hashSessionToken(presented)
    const live = await findLiveSession(c.env.DB, tokenHash)
    if (live) {
      return { kind: 'ok', cartId: await ensureCart(c.env.DB, live.id) }
    }
    // Unknown or expired: fall through to a fresh start.
  }
  // Malformed token: treated as absent.

  if (!create) {
    return { kind: 'none', clearCookie: presented !== undefined }
  }

  const fresh = await createSessionWithCart(c.env.DB)
  return { kind: 'ok', cartId: fresh.cartId, newToken: fresh.token }
}

/** Sets the session cookie after a mint, or clears a stale one. Never both. */
function applyCookie(c: Context<AppEnv>, context: CartContext) {
  const secure = isSecureRequest(c.req.url)
  if (context.kind === 'ok' && context.newToken !== undefined) {
    setCookie(c, SESSION_COOKIE, context.newToken, cookieOptions(secure))
    return
  }
  if (context.kind === 'none' && context.clearCookie) {
    setCookie(c, SESSION_COOKIE, '', { ...cookieOptions(secure), maxAge: 0 })
  }
}

function emptyCart(): CartResponse {
  return {
    items: [],
    itemCount: 0,
    subtotalCents: 0,
    totalCents: 0,
    currency: COMMERCE_CURRENCY,
    hasUnavailableItems: false,
  }
}

interface CartLineRow {
  id: number
  product_id: number
  slug: string
  name: string
  price_cents: number
  quantity: number
  stock_status: StockStatus
  product_active: number
  available_stock: number
}

async function readCart(db: D1Database, cartId: number): Promise<CartResponse> {
  const rows = await db
    .prepare(
      `SELECT
         ci.id,
         ci.product_id,
         p.slug,
         p.name,
         p.price_cents,
         ci.quantity,
         CASE
           WHEN COALESCE(i.quantity, 0) = 0 THEN 'out_of_stock'
           WHEN COALESCE(i.quantity, 0) <= COALESCE(i.low_stock_threshold, 0) THEN 'low_stock'
           ELSE 'in_stock'
         END AS stock_status,
         p.active AS product_active,
         COALESCE(i.quantity, 0) AS available_stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE ci.cart_id = ?
       ORDER BY ci.id ASC`,
    )
    .bind(cartId)
    .all<CartLineRow>()

  const items: CartLine[] = rows.results.map((row) => {
    const lineTotalCents = row.price_cents * row.quantity
    const available = row.product_active === 1 && row.available_stock >= row.quantity
    return {
      id: row.id,
      productId: row.product_id,
      slug: row.slug,
      name: row.name,
      unitPriceCents: row.price_cents,
      currency: COMMERCE_CURRENCY,
      quantity: row.quantity,
      lineTotalCents,
      stockStatus: row.stock_status,
      productActive: row.product_active === 1,
      availableStock: row.available_stock,
      exceedsStock: row.quantity > row.available_stock,
      available,
    }
  })

  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0)
  const subtotalCents = items.reduce((sum, line) => sum + line.lineTotalCents, 0)

  return {
    items,
    itemCount,
    subtotalCents,
    totalCents: subtotalCents,
    currency: COMMERCE_CURRENCY,
    hasUnavailableItems: items.some((line) => !line.available),
  }
}

function errorJson(
  c: Context<AppEnv>,
  status: 400 | 404 | 409 | 422 | 500,
  error: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return c.json({ error, message, ...extra }, status)
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/
const CART_ITEM_ID_PATTERN = /^[1-9]\d{0,15}$/

function parseQuantity(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null
  return raw
}

async function bumpCartUpdatedAt(db: D1Database, cartId: number): Promise<void> {
  try {
    await db
      .prepare(`UPDATE carts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
      .bind(cartId)
      .run()
  } catch (error) {
    // Informational field only — never fail the mutation over it.
    console.error('[api] Failed to bump cart updated_at', error)
  }
}

export const cartRoutes = new Hono<AppEnv>()

cartRoutes.get('/cart', async (c) => {
  const context = await resolveCartContext(c, { create: false })
  if (context.kind === 'none') {
    applyCookie(c, context)
    return c.json(emptyCart())
  }

  return c.json(await readCart(c.env.DB, context.cartId))
})

cartRoutes.post('/cart/items', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return errorJson(c, 400, 'invalid_request', 'Expected a JSON body with a product slug.')
  }

  const { slug, quantity: rawQuantity } = body as { slug?: unknown; quantity?: unknown }

  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    return errorJson(c, 400, 'invalid_request', 'A valid product slug is required.')
  }

  const quantity = rawQuantity === undefined ? 1 : parseQuantity(rawQuantity)
  if (quantity === null || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    return errorJson(
      c,
      400,
      'invalid_request',
      `Quantity must be a whole number between 1 and ${MAX_LINE_QUANTITY}.`,
    )
  }

  // Validate against the catalogue before minting anything, so failed adds
  // never create empty sessions.
  const product = await c.env.DB.prepare(
    'SELECT id, price_cents, active FROM products WHERE slug = ?',
  )
    .bind(slug)
    .first<{ id: number; price_cents: number; active: number }>()

  if (!product || product.active !== 1) {
    return errorJson(c, 404, 'not_found', 'Product not found.')
  }

  const inventory = await c.env.DB.prepare(
    'SELECT quantity FROM inventory WHERE product_id = ?',
  )
    .bind(product.id)
    .first<{ quantity: number }>()
  const availableStock = inventory?.quantity ?? 0

  if (availableStock === 0) {
    return errorJson(
      c,
      422,
      'out_of_stock',
      'This product is out of stock in the practice catalogue.',
    )
  }

  const context = await resolveCartContext(c, { create: true })
  if (context.kind !== 'ok') {
    return errorJson(c, 500, 'internal_error', 'The cart session could not be created.')
  }
  applyCookie(c, context)

  const existing = await c.env.DB.prepare(
    'SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
  )
    .bind(context.cartId, product.id)
    .first<{ quantity: number }>()
  const existingQuantity = existing?.quantity ?? 0
  const maxAllowed = Math.min(availableStock, MAX_LINE_QUANTITY)

  if (existingQuantity + quantity > maxAllowed) {
    return errorJson(
      c,
      422,
      'insufficient_stock',
      `Only ${Math.max(0, maxAllowed - existingQuantity)} more can be added — stock limit reached.`,
      { availableStock, maxQuantity: maxAllowed, currentQuantity: existingQuantity },
    )
  }

  // BUG-HUNT DEFECT CART-001 (hunt-cart-001): in a bug-hunt session carrying
  // this defect, the upsert sets the line quantity to the newly added
  // quantity instead of accumulating onto the existing line. The stock
  // guard still applies to the resulting quantity. Clean mode always
  // accumulates — the documented idempotent add-to-cart semantics.
  const resetOnAdd = await isDefectActive(c, 'CART-001')
  const write = await c.env.DB.prepare(
    resetOnAdd
      ? `INSERT INTO cart_items (cart_id, product_id, quantity)
         VALUES (?, ?, ?)
         ON CONFLICT (cart_id, product_id) DO UPDATE
           SET quantity = excluded.quantity,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE excluded.quantity <= (SELECT quantity FROM inventory WHERE product_id = excluded.product_id)
             AND excluded.quantity <= ?`
      : `INSERT INTO cart_items (cart_id, product_id, quantity)
         VALUES (?, ?, ?)
         ON CONFLICT (cart_id, product_id) DO UPDATE
           SET quantity = cart_items.quantity + excluded.quantity,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE cart_items.quantity + excluded.quantity <= (SELECT quantity FROM inventory WHERE product_id = excluded.product_id)
             AND cart_items.quantity + excluded.quantity <= ?`,
  )
    .bind(context.cartId, product.id, quantity, MAX_LINE_QUANTITY)
    .run()

  if (Number(write.meta.changes) === 0) {
    // Lost a race against concurrent stock: report honestly, do not clamp.
    return errorJson(c, 422, 'insufficient_stock', 'Not enough stock left to add that quantity.', {
      availableStock,
      maxQuantity: maxAllowed,
    })
  }

  await bumpCartUpdatedAt(c.env.DB, context.cartId)
  return c.json(await readCart(c.env.DB, context.cartId))
})

cartRoutes.patch('/cart/items/:id', async (c) => {
  const idMatch = CART_ITEM_ID_PATTERN.exec(c.req.param('id') ?? '')
  if (!idMatch) {
    return errorJson(c, 400, 'invalid_request', 'Cart item id must be a positive integer.')
  }
  const itemId = Number(idMatch[0])

  const body = await c.req.json().catch(() => null)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return errorJson(c, 400, 'invalid_request', 'Expected a JSON body with a quantity.')
  }
  const quantity = parseQuantity((body as { quantity?: unknown }).quantity)
  if (quantity === null || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    return errorJson(
      c,
      400,
      'invalid_request',
      `Quantity must be a whole number between 1 and ${MAX_LINE_QUANTITY}.`,
    )
  }

  const context = await resolveCartContext(c, { create: false })
  if (context.kind === 'none') {
    applyCookie(c, context)
    return errorJson(c, 404, 'not_found', 'Cart item not found.')
  }

  const line = await c.env.DB.prepare(
    `SELECT ci.id,
            (SELECT quantity FROM inventory WHERE product_id = ci.product_id) AS stock
     FROM cart_items ci
     WHERE ci.id = ? AND ci.cart_id = ?`,
  )
    .bind(itemId, context.cartId)
    .first<{ id: number; stock: number | null }>()

  if (!line) {
    return errorJson(c, 404, 'not_found', 'Cart item not found.')
  }

  const maxAllowed = Math.min(line.stock ?? 0, MAX_LINE_QUANTITY)
  if (quantity > maxAllowed) {
    return errorJson(
      c,
      422,
      'insufficient_stock',
      `Only ${maxAllowed} can be held for this product.`,
      { availableStock: line.stock ?? 0, maxQuantity: maxAllowed },
    )
  }

  const write = await c.env.DB.prepare(
    `UPDATE cart_items
     SET quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND cart_id = ?
       AND ? <= (SELECT quantity FROM inventory WHERE product_id = cart_items.product_id)
       AND ? <= ?`,
  )
    .bind(quantity, itemId, context.cartId, quantity, quantity, MAX_LINE_QUANTITY)
    .run()

  if (Number(write.meta.changes) === 0) {
    return errorJson(c, 422, 'insufficient_stock', 'Not enough stock left for that quantity.', {
      availableStock: line.stock ?? 0,
      maxQuantity: maxAllowed,
    })
  }

  await bumpCartUpdatedAt(c.env.DB, context.cartId)
  return c.json(await readCart(c.env.DB, context.cartId))
})

cartRoutes.delete('/cart/items/:id', async (c) => {
  const idMatch = CART_ITEM_ID_PATTERN.exec(c.req.param('id') ?? '')
  if (!idMatch) {
    return errorJson(c, 400, 'invalid_request', 'Cart item id must be a positive integer.')
  }
  const itemId = Number(idMatch[0])

  const context = await resolveCartContext(c, { create: false })
  if (context.kind === 'none') {
    applyCookie(c, context)
    return errorJson(c, 404, 'not_found', 'Cart item not found.')
  }

  const write = await c.env.DB.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?')
    .bind(itemId, context.cartId)
    .run()

  if (Number(write.meta.changes) === 0) {
    return errorJson(c, 404, 'not_found', 'Cart item not found.')
  }

  await bumpCartUpdatedAt(c.env.DB, context.cartId)
  return c.json(await readCart(c.env.DB, context.cartId))
})

cartRoutes.delete('/cart', async (c) => {
  const context = await resolveCartContext(c, { create: false })
  if (context.kind === 'none') {
    applyCookie(c, context)
    return c.json(emptyCart())
  }

  await c.env.DB.prepare('DELETE FROM cart_items WHERE cart_id = ?')
    .bind(context.cartId)
    .run()
  await bumpCartUpdatedAt(c.env.DB, context.cartId)
  return c.json(await readCart(c.env.DB, context.cartId))
})
