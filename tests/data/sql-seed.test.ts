// Seed integrity for the Phase 6 Meridian Outfitters practice snapshot.
//
// Validates the committed public/datasets/meridian-outfitters.sql: table
// counts, structural integrity (PK/FK/UNIQUE/NOT NULL/CHECK), presence of the
// deliberate logical anomalies (DQ-01..DQ-12) and byte-identity with the
// generator (deterministic regeneration).
import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildSeedSql } from '../../scripts/generate-sql-seed.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEED_PATH = join(ROOT, 'public', 'datasets', 'meridian-outfitters.sql')

function loadDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(SEED_PATH, 'utf8'))
  return db
}

const one = (db: DatabaseSync, sql: string): number =>
  (db.prepare(sql).all()[0] as { c: number }).c

describe('meridian-outfitters seed', () => {
  it('is byte-identical to a fresh deterministic generation', () => {
    expect(readFileSync(SEED_PATH, 'utf8')).toBe(buildSeedSql())
  })

  it('is within the 300 KB budget', () => {
    expect(statSync(SEED_PATH).size).toBeLessThanOrEqual(300 * 1024)
  })

  it('loads with FK enforcement and has the expected table row counts', () => {
    const db = loadDb()
    expect(one(db, 'SELECT count(*) c FROM categories')).toBe(8)
    expect(one(db, 'SELECT count(*) c FROM products')).toBe(42)
    expect(one(db, 'SELECT count(*) c FROM inventory')).toBe(42)
    expect(one(db, 'SELECT count(*) c FROM customers')).toBe(118)
    expect(one(db, 'SELECT count(*) c FROM addresses')).toBeGreaterThanOrEqual(140)
    expect(one(db, 'SELECT count(*) c FROM orders')).toBeGreaterThanOrEqual(220)
    expect(one(db, 'SELECT count(*) c FROM order_items')).toBeGreaterThanOrEqual(550)
    expect(one(db, 'SELECT count(*) c FROM payments')).toBe(one(db, 'SELECT count(*) c FROM orders'))
    db.close()
  })

  it('has zero structural integrity violations', () => {
    const db = loadDb()
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0)
    expect(one(db, 'SELECT count(*) c FROM (SELECT email FROM customers GROUP BY email HAVING count(*) > 1)')).toBe(0)
    expect(one(db, 'SELECT count(*) c FROM (SELECT order_number FROM orders GROUP BY 1 HAVING count(*) > 1)')).toBe(0)
    expect(one(db, 'SELECT count(*) c FROM (SELECT provider_ref FROM payments GROUP BY 1 HAVING count(*) > 1)')).toBe(0)
    expect(one(db, 'SELECT count(*) c FROM (SELECT customer_id FROM addresses WHERE is_default = 1 GROUP BY 1 HAVING count(*) > 1)')).toBe(0)
    expect(one(db, 'SELECT count(*) c FROM (SELECT slug FROM products GROUP BY slug HAVING count(*) > 1)')).toBe(0)
    db.close()
  })

  it('enforces CHECK constraints at load time (negative price rejected)', () => {
    const db = loadDb()
    expect(() =>
      db.exec("INSERT INTO products (id, slug, name, description, category_id, price_cents, active) VALUES (999, 'bad', 'Bad', 'x', 1, -1, 1)"),
    ).toThrow()
    db.close()
  })

  it('enforces FK constraints at load time (orphan line item rejected)', () => {
    const db = loadDb()
    expect(() =>
      db.exec("INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents) VALUES (999999, 999999, 1, 'x', 100, 1, 100)"),
    ).toThrow()
    db.close()
  })

  it('contains every documented logical anomaly (DQ-01..DQ-12)', () => {
    const db = loadDb()
    // DQ-01: line totals ignoring quantity
    expect(one(db, 'SELECT count(*) c FROM order_items WHERE line_total_cents != quantity * unit_price_cents')).toBeGreaterThanOrEqual(5)
    // DQ-02: order totals not equal to subtotal+shipping+tax
    expect(one(db, 'SELECT count(*) c FROM orders WHERE total_cents != subtotal_cents + shipping_cents + tax_cents')).toBeGreaterThanOrEqual(5)
    // DQ-03: case-variant duplicate emails
    expect(one(db, "SELECT count(*) c FROM customers WHERE lower(email) = 'amara.okafor@example.com'")).toBeGreaterThanOrEqual(2)
    // DQ-04: same full name on two different accounts
    expect(one(db, "SELECT count(*) c FROM customers WHERE first_name = 'Priya' AND last_name = 'Nair'")).toBeGreaterThanOrEqual(2)
    // DQ-05: orders pending/placed for more than 30 days
    expect(one(db, "SELECT count(*) c FROM orders WHERE status IN ('pending','placed') AND placed_at < '2026-10-17T00:00:00Z'")).toBe(8)
    // DQ-06: cancelled orders with unrefunded approved payments
    expect(one(db, "SELECT count(*) c FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.status = 'cancelled' AND p.status = 'approved'")).toBeGreaterThanOrEqual(4)
    // DQ-07: payments whose amount differs from the order total
    expect(one(db, 'SELECT count(*) c FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.amount_cents != o.total_cents')).toBeGreaterThanOrEqual(4)
    // DQ-08: zero-stock products with recent orders
    expect(one(db, "SELECT count(DISTINCT oi.product_id) c FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN inventory i ON i.product_id = oi.product_id WHERE i.quantity = 0 AND o.placed_at >= '2026-09-01T00:00:00Z'")).toBeGreaterThanOrEqual(2)
    // DQ-09: gold loyalty tier with no orders
    expect(one(db, "SELECT count(*) c FROM customers cu WHERE cu.loyalty_tier = 'gold' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = cu.id)")).toBeGreaterThanOrEqual(1)
    // DQ-10: opted-in customers without any address
    expect(one(db, "SELECT count(*) c FROM customers cu WHERE cu.marketing_opt_in = 1 AND NOT EXISTS (SELECT 1 FROM addresses a WHERE a.customer_id = cu.id)")).toBeGreaterThanOrEqual(2)
    // DQ-11: missing and mixed-format phones
    expect(one(db, 'SELECT count(*) c FROM customers WHERE phone IS NULL')).toBeGreaterThanOrEqual(10)
    expect(one(db, "SELECT count(*) c FROM customers WHERE phone LIKE '+1-555-%'")).toBeGreaterThanOrEqual(10)
    expect(one(db, "SELECT count(*) c FROM customers WHERE phone LIKE '(555)%'")).toBeGreaterThanOrEqual(10)
    // DQ-12: duplicate-looking orders (same customer, day and total)
    expect(one(db, "SELECT count(*) c FROM (SELECT customer_id, substr(placed_at, 1, 10) d, total_cents FROM orders GROUP BY 1, 2, 3 HAVING count(*) > 1)")).toBeGreaterThanOrEqual(3)
    db.close()
  })

  it('carries provenance comments and no dangerous constructs', () => {
    const sql = readFileSync(SEED_PATH, 'utf8')
    expect(sql).toContain('mulberry32 seed 20261117')
    expect(sql).not.toMatch(/load_extension/i)
    expect(sql).not.toMatch(/\bATTACH\b/i)
    expect(sql).toContain('BEGIN;')
    expect(sql).toContain('COMMIT;')
  })
})
