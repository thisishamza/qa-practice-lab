// Engine boundary tests (plan §12.1): the identical openDatabase code path
// the worker uses, exercised in Node against the committed practice seed.
import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  applyResultPayloadCap,
  openDatabase,
  type EngineDatabase,
} from '../../src/lib/sql/engine'
import { SQL_LIMITS, type SqlRunOutput } from '../../src/shared/sql'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEED_PATH = join(ROOT, 'public', 'datasets', 'meridian-outfitters.sql')
const WASM_PATH = join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

let seedSql: string
let wasmBytes: Uint8Array

beforeAll(() => {
  seedSql = readFileSync(SEED_PATH, 'utf8')
  wasmBytes = new Uint8Array(readFileSync(WASM_PATH))
})

async function freshDb(): Promise<EngineDatabase> {
  const db = await openDatabase(wasmBytes)
  db.execAll(seedSql)
  return db
}

describe('engine — execution', () => {
  it('opens and reports sqlite_version() = 3.54.1 (recorded at M1 kickoff)', async () => {
    const db = await freshDb()
    expect(db.sqliteVersion()).toBe('3.54.1')
    db.close()
  })

  it('executes a simple SELECT against the canonical seed', async () => {
    const db = await freshDb()
    const out = db.execAll("SELECT count(*) AS n FROM customers WHERE loyalty_tier = 'gold'")
    expect(out.ok).toBe(true)
    expect(out.resultSets).toHaveLength(1)
    expect(out.resultSets[0].columns).toEqual(['n'])
    expect(out.resultSets[0].rows[0][0]).toBeGreaterThanOrEqual(1)
    db.close()
  })

  it('returns one result set per statement with statementIndex populated', async () => {
    const db = await freshDb()
    const out = db.execAll('SELECT 1 AS a; SELECT 2 AS b; SELECT 3 AS c')
    expect(out.ok).toBe(true)
    expect(out.resultSets.map((s) => s.statementIndex)).toEqual([0, 1, 2])
    expect(out.resultSets.map((s) => s.rows[0][0])).toEqual([1, 2, 3])
    db.close()
  })

  it('stops at the first failing statement and reports its index; earlier sets survive', async () => {
    const db = await freshDb()
    const out = db.execAll('SELECT 1 AS ok; SELECT * FROM no_such_table; SELECT 3 AS never')
    expect(out.ok).toBe(false)
    expect(out.error?.statementIndex).toBe(1)
    expect(out.error?.message.length).toBeGreaterThan(0)
    expect(out.resultSets).toHaveLength(1)
    expect(out.resultSets[0].rows[0][0]).toBe(1)
    db.close()
  })

  it('caps rows at 1,000 per statement and flags truncated', async () => {
    const db = await freshDb()
    const out = db.execAll(
      'WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < 2000) SELECT x FROM cnt',
    )
    expect(out.ok).toBe(true)
    expect(out.resultSets[0].rows.length).toBe(SQL_LIMITS.maxRowsPerStatement)
    expect(out.resultSets[0].truncated).toBe(true)
    expect(out.resultSets[0].rowCount).toBe(SQL_LIMITS.maxRowsPerStatement)
    db.close()
  })

  it('truncates cells larger than 10 KB with the marker', async () => {
    const db = await freshDb()
    const out = db.execAll("SELECT hex(zeroblob(6000)) AS big")
    const cell = out.resultSets[0].rows[0][0] as string
    expect(cell.length).toBeGreaterThan(SQL_LIMITS.maxCellBytes)
    expect(cell.length).toBeLessThanOrEqual(SQL_LIMITS.maxCellBytes + 20)
    expect(cell).toContain('[truncated]')
    db.close()
  })

  it('reports row counts for DML statements without result columns', async () => {
    const db = await freshDb()
    const out = db.execAll(
      "UPDATE inventory SET quantity = 999 WHERE product_id = 1; UPDATE inventory SET quantity = 24 WHERE product_id = 1",
    )
    expect(out.ok).toBe(true)
    expect(out.resultSets[0].changes).toBe(1)
    expect(out.resultSets[0].columns).toEqual([])
    db.close()
  })

  it('honours explicit transaction rollback end-to-end', async () => {
    const db = await freshDb()
    db.execAll('BEGIN')
    db.execAll("UPDATE inventory SET quantity = 0 WHERE product_id = 1")
    db.execAll('ROLLBACK')
    const out = db.execAll('SELECT quantity FROM inventory WHERE product_id = 1')
    expect(out.resultSets[0].rows[0][0]).toBe(24)
    db.close()
  })

  it('enforces FK constraints in the engine (orphan line item rejected)', async () => {
    const db = await freshDb()
    const out = db.execAll(
      "INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents) VALUES (999999, 999999, 1, 'x', 100, 1, 100)",
    )
    expect(out.ok).toBe(false)
    db.close()
  })
})

describe('engine — schema', () => {
  it('exposes tables with columns, primary keys, foreign keys and indexes', async () => {
    const db = await freshDb()
    const schema = db.schema()
    expect(schema.sqliteVersion).toBe('3.54.1')
    const names = schema.tables.map((t) => t.name).sort()
    expect(names).toEqual(
      ['addresses', 'categories', 'customers', 'inventory', 'order_items', 'orders', 'payments', 'products'].sort(),
    )
    const orders = schema.tables.find((t) => t.name === 'orders')
    expect(orders).toBeDefined()
    expect(orders?.columns.find((c) => c.name === 'id')?.primaryKey).toBe(true)
    expect(orders?.columns.find((c) => c.name === 'order_number')?.notNull).toBe(true)
    expect(orders?.foreignKeys).toContainEqual(expect.objectContaining({ from: 'customer_id', table: 'customers' }))
    expect(orders?.indexes.map((i) => i.name)).toContain('idx_orders_customer')
    expect(orders?.ddl).toMatch(/CREATE TABLE orders/i)
    db.close()
  })

  it('surfaces UNIQUE constraints declared in the DDL', async () => {
    const db = await freshDb()
    const schema = db.schema()
    const orders = schema.tables.find((t) => t.name === 'orders')
    const customers = schema.tables.find((t) => t.name === 'customers')
    const products = schema.tables.find((t) => t.name === 'products')
    expect(orders?.constraints.some((c) => c.kind === 'unique' && c.detail.includes('order_number'))).toBe(true)
    expect(customers?.constraints.some((c) => c.kind === 'unique' && c.detail.includes('email'))).toBe(true)
    expect(products?.constraints.some((c) => c.kind === 'unique' && c.detail.includes('slug'))).toBe(true)
    db.close()
  })

  it('surfaces CHECK constraints from the DDL text', async () => {
    const db = await freshDb()
    const schema = db.schema()
    const orders = schema.tables.find((t) => t.name === 'orders')
    expect(orders?.constraints.some((c) => c.kind === 'check')).toBe(true)
    db.close()
  })
})

describe('applyResultPayloadCap', () => {
  it('leaves small outputs untouched', () => {
    const output: SqlRunOutput = {
      ok: true,
      resultSets: [
        { statementIndex: 0, statement: 'SELECT 1', columns: ['a'], rows: [[1]], rowCount: 1, truncated: false, changes: null, elapsedMs: 1 },
      ],
      elapsedMs: 1,
      error: null,
    }
    const capped = applyResultPayloadCap(output)
    expect(capped.resultSets[0].rows).toEqual([[1]])
    expect(capped.resultSets[0].truncated).toBe(false)
  })

  it('drops rows from the last row-returning set until under the 1 MB cap', () => {
    const bigCell = 'x'.repeat(1024)
    const rows = Array.from({ length: 1400 }, () => [bigCell, bigCell, bigCell])
    const output: SqlRunOutput = {
      ok: true,
      resultSets: [
        { statementIndex: 0, statement: 'BIG', columns: ['a', 'b', 'c'], rows, rowCount: 1400, truncated: false, changes: null, elapsedMs: 1 },
      ],
      elapsedMs: 1,
      error: null,
    }
    const capped = applyResultPayloadCap(output)
    expect(JSON.stringify(capped.resultSets).length).toBeLessThanOrEqual(SQL_LIMITS.maxResultBytes)
    expect(capped.resultSets[0].rowCount).toBeLessThan(1400)
    expect(capped.resultSets[0].truncated).toBe(true)
    expect(capped.resultSets[0].columns).toEqual(['a', 'b', 'c'])
  })
})

describe('exportBytes', () => {
  it('exports a bytes buffer with the SQLite magic header', async () => {
    const db = await freshDb()
    const bytes = db.exportBytes()
    expect(bytes.length).toBeGreaterThan(1000)
    expect(String.fromCharCode(...bytes.slice(0, 15))).toBe('SQLite format 3')
    db.close()
  })

  it('two independent databases opened from the same seed export byte-identical bytes', async () => {
    const first = await freshDb()
    const second = await freshDb()
    expect(Buffer.from(first.exportBytes()).equals(Buffer.from(second.exportBytes()))).toBe(true)
    first.close()
    second.close()
  })

  it('a mutated database exports different bytes (mutations are real, not cosmetic)', async () => {
    const before = await freshDb()
    const after = await freshDb()
    after.execAll('UPDATE inventory SET quantity = 0 WHERE product_id = 1')
    expect(Buffer.from(before.exportBytes()).equals(Buffer.from(after.exportBytes()))).toBe(false)
    before.close()
    after.close()
  })
})
