import { Hono } from 'hono'
import {
  COMMERCE_CURRENCY,
  PRODUCT_SORTS,
  type CategoryListResponse,
  type CategorySummary,
  type Product,
  type ProductListResponse,
  type ProductSort,
  type StockStatus,
} from '../shared/commerce'
import type { AppEnv } from './app'
import { isDefectActive } from './defects'

interface ProductRow {
  id: number
  slug: string
  name: string
  description: string
  category_slug: string
  category_name: string
  price_cents: number
  stock_status: StockStatus
}

interface CategoryRow {
  id: number
  slug: string
  name: string
  description: string
  sort_order: number
}

const SORT_SQL: Record<ProductSort, string> = {
  newest: 'p.id DESC',
  name: 'p.name COLLATE NOCASE ASC, p.id ASC',
  price_asc: 'p.price_cents ASC, p.id ASC',
  price_desc: 'p.price_cents DESC, p.id ASC',
}

const PRODUCT_SELECT = `
  SELECT
    p.id,
    p.slug,
    p.name,
    p.description,
    c.slug AS category_slug,
    c.name AS category_name,
    p.price_cents,
    CASE
      WHEN i.quantity = 0 THEN 'out_of_stock'
      WHEN i.quantity <= i.low_stock_threshold THEN 'low_stock'
      ELSE 'in_stock'
    END AS stock_status
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN inventory i ON i.product_id = p.id
`

function parseSearchQuery(raw: string | undefined): string | undefined {
  const query = raw?.replace(/\s+/g, ' ').trim().slice(0, 80)
  return query || undefined
}

/** Escape LIKE wildcards so user input matches literally. Pairs with `ESCAPE '\'`. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min) return fallback
  return Math.min(value, max)
}

function parseCategorySlug(raw: string | undefined): string | undefined {
  const slug = raw?.trim().toLowerCase().slice(0, 64)
  // No format rejection: the value is always bound as a parameter, so
  // SQL-significant input simply matches zero rows.
  return slug || undefined
}

function parseSort(raw: string | undefined): ProductSort {
  return raw && PRODUCT_SORTS.has(raw) ? (raw as ProductSort) : 'newest'
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    priceCents: row.price_cents,
    currency: COMMERCE_CURRENCY,
    stockStatus: row.stock_status,
  }
}

/**
 * BUG-HUNT DEFECTS CONTRACT-001/002/003/005 (hunts hunt-contract-001/002/003/005):
 * in a bug-hunt session carrying the matching defect, the named product
 * response builder is corrupted at serialization time — read-time only,
 * nothing is persisted, and clean mode serializes byte-identically.
 * Exactly one isDefectActive branch per defect id lives here; the loci
 * gates below keep each defect on its documented surface:
 *   CONTRACT-001 (detail only) — stockStatus omitted
 *   CONTRACT-002 (list + detail) — priceCents serialized as a string
 *   CONTRACT-003 (list only) — stockStatus UPPERCASE casing drift
 *   CONTRACT-005 (list only) — undocumented supplierCostCents added
 */
async function toProductResponse(
  c: Parameters<typeof isDefectActive>[0],
  row: ProductRow,
  locus: 'list' | 'detail',
): Promise<Record<string, unknown>> {
  const product: Record<string, unknown> = { ...toProduct(row) }
  if (await isDefectActive(c, 'CONTRACT-002')) {
    product.priceCents = String(row.price_cents)
  }
  if (locus === 'list' && (await isDefectActive(c, 'CONTRACT-003'))) {
    product.stockStatus =
      row.stock_status === 'out_of_stock'
        ? 'OUT_OF_STOCK'
        : row.stock_status === 'low_stock'
          ? 'LOW_STOCK'
          : 'IN_STOCK'
  }
  if (locus === 'list' && (await isDefectActive(c, 'CONTRACT-005'))) {
    product.supplierCostCents = Math.round(row.price_cents * 0.6)
  }
  if (locus === 'detail' && (await isDefectActive(c, 'CONTRACT-001'))) {
    delete product.stockStatus
  }
  return product
}

function toCategory(row: CategoryRow): CategorySummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
  }
}

export const catalogueRoutes = new Hono<AppEnv>()

catalogueRoutes.get('/products', async (c) => {
  const page = parseBoundedInt(c.req.query('page'), 1, 1, 10_000)
  const perPage = parseBoundedInt(c.req.query('perPage'), 12, 1, 48)
  const category = parseCategorySlug(c.req.query('category'))
  const sort = parseSort(c.req.query('sort'))
  const query = parseSearchQuery(c.req.query('q'))

  // BUG-HUNT DEFECT PERF-001 (hunt-perf-001): in a bug-hunt session carrying
  // this defect, every list response pays a flat artificial stall. Clean
  // mode is unchanged.
  if (await isDefectActive(c, 'PERF-001')) {
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  // BUG-HUNT DEFECT PERF-002 (hunt-perf-002): pages beyond 3 pay an extra
  // artificial stall (un-indexed deep OFFSET represented safely).
  if (page > 3 && (await isDefectActive(c, 'PERF-002'))) {
    await new Promise((resolve) => setTimeout(resolve, 600))
  }

  const conditions = ['p.active = 1']
  const bindings: string[] = []
  if (category) {
    // BUG-HUNT DEFECT CATALOGUE-002 (hunt-catalogue-002): in a bug-hunt
    // session carrying this defect, the category predicate is silently
    // dropped so the filter changes nothing. Clean mode always narrows
    // the result set (and the count, which shares the conditions).
    if (!(await isDefectActive(c, 'CATALOGUE-002'))) {
      conditions.push('c.slug = ?')
      bindings.push(category)
    }
  }
  if (query) {
    const pattern = `%${escapeLike(query)}%`
    // BUG-HUNT DEFECT CATALOGUE-001 (hunt-catalogue-001): in a bug-hunt
    // session carrying this defect, the description facet of the search
    // predicate is dropped. Clean mode always matches name OR description
    // OR category. Only this branch differs; count and rows stay consistent
    // because both queries share the same conditions/bindings.
    if (await isDefectActive(c, 'CATALOGUE-001')) {
      conditions.push(`(p.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')`)
      bindings.push(pattern, pattern)
    } else {
      conditions.push(
        `(p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')`,
      )
      bindings.push(pattern, pattern, pattern)
    }
  }
  const where = conditions.join(' AND ')

  // BUG-HUNT DEFECT PERF-003 (hunt-perf-003): the list assembler performs
  // sequential per-product work instead of one pass. Clean mode assembles
  // in a single Promise.all.
  const perf003 = await isDefectActive(c, 'PERF-003')

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id WHERE ${where}`,
  )
    .bind(...bindings)
    .first<{ total: number }>()
  const total = countRow?.total ?? 0

  const rows = await c.env.DB.prepare(
    `${PRODUCT_SELECT} WHERE ${where} ORDER BY ${SORT_SQL[sort]} LIMIT ? OFFSET ?`,
  )
    .bind(...bindings, perPage, (page - 1) * perPage)
    .all<ProductRow>()

  const assembled: Record<string, unknown>[] = []
  if (perf003) {
    for (const row of rows.results) {
      await new Promise((resolve) => setTimeout(resolve, 120))
      assembled.push(await toProductResponse(c, row, 'list'))
    }
  } else {
    assembled.push(...(await Promise.all(rows.results.map((row) => toProductResponse(c, row, 'list')))))
  }

  const body: ProductListResponse = {
    data: assembled as unknown as ProductListResponse['data'],
    page,
    perPage,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / perPage),
  }

  return c.json(body)
})

catalogueRoutes.get('/products/:slug', async (c) => {
  const slug = c.req.param('slug')?.toLowerCase()
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) {
    return c.json({ error: 'not_found', message: 'Product not found' }, 404)
  }

  const row = await c.env.DB.prepare(
    `${PRODUCT_SELECT} WHERE p.active = 1 AND p.slug = ?`,
  )
    .bind(slug)
    .first<ProductRow>()

  if (!row) {
    return c.json({ error: 'not_found', message: 'Product not found' }, 404)
  }

  return c.json(await toProductResponse(c, row, 'detail'))
})

catalogueRoutes.get('/categories', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT id, slug, name, description, sort_order FROM categories ORDER BY sort_order ASC, id ASC',
  ).all<CategoryRow>()

  const body: CategoryListResponse = {
    data: rows.results.map(toCategory),
  }

  return c.json(body)
})
