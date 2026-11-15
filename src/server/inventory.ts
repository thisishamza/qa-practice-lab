// Staff-only inventory management (P3-M6).
//
// Endpoints (mounted under /api/v1):
//   GET   /admin/inventory               — current stock for the staff view
//   PATCH /admin/inventory/:productId    — restock (adds units) with audit trail
//
// Authorization is exclusively server-side via requireStaff — the client's
// role is never consulted. See staff.ts for the 401/403 matrix.
//
// Stock accounting:
// - Available stock is `inventory.quantity`; there is NO reservation model
//   (the phase plan prefers guarded writes to a reservation framework — a
//   learner's cart never holds stock).
// - A restock adds a validated positive integer (1..MAX_RESTOCK_QUANTITY per
//   adjustment) and never lets the total exceed MAX_INVENTORY_QUANTITY.
// - The UPDATE and the audit INSERT run as ONE all-or-nothing batch; the
//   audit INSERT is guarded by `changes() = 1`, so if the guarded UPDATE
//   matched nothing (cap exceeded) no phantom adjustment is recorded.
// - Every adjustment is recorded in inventory_adjustments: product, signed
//   delta, reason, optional note, acting customer, acting practice session,
//   time. Rows are never mutated by the application.

import { Hono, type Context } from 'hono'
import {
  COMMERCE_CURRENCY,
  MAX_ADJUSTMENT_NOTE_LENGTH,
  MAX_INVENTORY_QUANTITY,
  MAX_RESTOCK_QUANTITY,
  type AdminInventoryItem,
  type AdminInventoryListResponse,
  type AdminRestockResponse,
  type StockStatus,
} from '../shared/commerce'
import type { AppEnv } from './app'
import { requireStaff } from './staff'

function errorJson(
  c: Context<AppEnv>,
  status: 400 | 401 | 403 | 404 | 422 | 500,
  error: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return c.json({ error, message, ...extra }, status)
}

interface InventoryRow {
  id: number
  slug: string
  name: string
  category_name: string
  price_cents: number
  active: number
  quantity: number
  low_stock_threshold: number
  stock_status: string
}

function toAdminItem(row: InventoryRow): AdminInventoryItem {
  return {
    productId: row.id,
    slug: row.slug,
    name: row.name,
    categoryName: row.category_name,
    priceCents: row.price_cents,
    currency: COMMERCE_CURRENCY,
    active: row.active === 1,
    quantity: row.quantity,
    lowStockThreshold: row.low_stock_threshold,
    stockStatus: row.stock_status as StockStatus,
  }
}

const INVENTORY_SELECT = `SELECT
    p.id, p.slug, p.name, c.name AS category_name, p.price_cents, p.active,
    i.quantity, i.low_stock_threshold,
    CASE
      WHEN i.quantity = 0 THEN 'out_of_stock'
      WHEN i.quantity <= i.low_stock_threshold THEN 'low_stock'
      ELSE 'in_stock'
    END AS stock_status
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN inventory i ON i.product_id = p.id`

export const inventoryRoutes = new Hono<AppEnv>()

inventoryRoutes.get('/admin/inventory', async (c) => {
  const staff = await requireStaff(c)
  if (staff.kind === 'error') {
    return staff.response
  }

  // Bounded catalogue (≤ a few hundred rows): return everything, ordered.
  const rows = await c.env.DB.prepare(`${INVENTORY_SELECT} ORDER BY p.id ASC`).all<InventoryRow>()

  const data = rows.results.map(toAdminItem)
  return c.json({ data, total: data.length } satisfies AdminInventoryListResponse)
})

const PRODUCT_ID_PATTERN = /^[0-9]{1,10}$/
const RESTOCK_NOTE_MAX = MAX_ADJUSTMENT_NOTE_LENGTH

function containsControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true
    }
  }
  return false
}

interface RestockBody {
  quantity: number
  note: string | null
}

function validateRestockBody(raw: unknown): { body?: RestockBody; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { fields: { body: 'Expected a JSON object with quantity (and optionally note).' } }
  }
  const body = raw as Record<string, unknown>

  const rawQuantity = body.quantity
  let quantity: number | null = null
  if (typeof rawQuantity !== 'number' || !Number.isFinite(rawQuantity) || !Number.isInteger(rawQuantity)) {
    fields.quantity = 'Enter a whole number of units.'
  } else if (rawQuantity < 1) {
    fields.quantity = 'Restock at least 1 unit.'
  } else if (rawQuantity > MAX_RESTOCK_QUANTITY) {
    fields.quantity = `Restock at most ${MAX_RESTOCK_QUANTITY.toLocaleString()} units per adjustment.`
  } else {
    quantity = rawQuantity
  }

  let note: string | null = null
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      fields.note = 'The note must be a single line of text.'
    } else if (containsControlCharacter(body.note)) {
      fields.note = 'The note must not contain control characters.'
    } else {
      const trimmed = body.note.trim().replace(/\s+/g, ' ')
      if (trimmed.length > RESTOCK_NOTE_MAX) {
        fields.note = `Keep the note under ${RESTOCK_NOTE_MAX} characters.`
      } else {
        note = trimmed.length > 0 ? trimmed : null
      }
    }
  }

  if (Object.keys(fields).length > 0 || quantity === null) {
    return { fields }
  }
  return { body: { quantity, note }, fields }
}

inventoryRoutes.patch('/admin/inventory/:productId', async (c) => {
  const staff = await requireStaff(c)
  if (staff.kind === 'error') {
    return staff.response
  }

  const productIdParam = c.req.param('productId') ?? ''
  if (!PRODUCT_ID_PATTERN.test(productIdParam)) {
    return errorJson(c, 400, 'invalid_request', 'The product id must be a positive integer.')
  }
  const productId = Number.parseInt(productIdParam, 10)

  const rawBody = await c.req.json().catch(() => null)
  const { body, fields } = validateRestockBody(rawBody)
  if (!body) {
    return errorJson(c, 400, 'invalid_request', 'Check the highlighted fields and try again.', {
      fields,
    })
  }

  // The product must exist; discontinued (inactive) products may still be
  // restocked — historical orders must remain serviceable.
  const existing = await c.env.DB.prepare(
    `${INVENTORY_SELECT} WHERE p.id = ?`,
  )
    .bind(productId)
    .first<InventoryRow>()
  if (!existing) {
    return errorJson(c, 404, 'not_found', 'No product exists with that id.')
  }

  // Guarded update + audit insert in ONE all-or-nothing batch. The audit
  // row is inserted only when the guarded UPDATE actually changed a row
  // (changes() reads the previous statement's outcome), so a rejected
  // adjustment records nothing.
  let results: { meta?: { changes?: number | bigint; last_row_id?: number } }[]
  try {
    results = await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE inventory
           SET quantity = quantity + ?
         WHERE product_id = ? AND quantity + ? <= ?`,
      ).bind(body.quantity, productId, body.quantity, MAX_INVENTORY_QUANTITY),
      c.env.DB.prepare(
        `INSERT INTO inventory_adjustments
           (product_id, quantity_delta, reason, note, actor_customer_id, actor_session_id, order_id)
         SELECT ?, ?, 'restock', ?, ?, ?, NULL
         WHERE changes() = 1`,
      ).bind(productId, body.quantity, body.note, staff.customer.id, staff.practiceSessionId),
    ])
  } catch (error) {
    console.error('[api] Restock batch failed', error)
    return errorJson(c, 500, 'internal_error', 'The adjustment could not be recorded. Please try again.')
  }

  const changed = Number(results[0]?.meta?.changes ?? 0)
  if (changed !== 1) {
    // Product exists (checked above), so the cap is what rejected the write.
    const current = await c.env.DB.prepare(
      'SELECT quantity FROM inventory WHERE product_id = ?',
    )
      .bind(productId)
      .first<{ quantity: number }>()
    return errorJson(
      c,
      422,
      'stock_limit_exceeded',
      `A single product cannot hold more than ${MAX_INVENTORY_QUANTITY.toLocaleString()} units. Lower the quantity or split the adjustment.`,
      { maxQuantity: MAX_INVENTORY_QUANTITY, currentQuantity: current?.quantity ?? null },
    )
  }

  const updated = await c.env.DB.prepare(`${INVENTORY_SELECT} WHERE p.id = ?`)
    .bind(productId)
    .first<InventoryRow>()
  if (!updated) {
    console.error('[api] Inventory row missing immediately after restock', { productId })
    return errorJson(c, 500, 'internal_error', 'The adjustment was recorded but the stock could not be read back.')
  }

  const adjustmentId = Number(results[1]?.meta?.last_row_id ?? 0)
  const adjustmentRow = adjustmentId
    ? await c.env.DB.prepare(
        'SELECT id, created_at FROM inventory_adjustments WHERE id = ?',
      )
        .bind(adjustmentId)
        .first<{ id: number; created_at: string }>()
    : null

  const response: AdminRestockResponse = {
    inventory: toAdminItem(updated),
    adjustment: {
      id: adjustmentRow?.id ?? adjustmentId,
      quantityDelta: body.quantity,
      reason: 'restock',
      note: body.note,
      actorCustomerId: staff.customer.id,
      createdAt: adjustmentRow?.created_at ?? new Date().toISOString(),
    },
  }
  return c.json(response, 200)
})
