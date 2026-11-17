// Migration 0013 — app_meta schema_version 12 -> 13, intentional no-DDL bump.
// Fresh install and upgrade paths; pre-existing data must survive verbatim.
// Phase 7 adds no tables: contract fixtures are compiled-in modules, and
// learning state reuses hunt_attempts exactly as it is.
import { describe, expect, it } from 'vitest'
import {
  applyRemainingMigrations,
  createMigratedD1,
} from '../helpers/fake-d1'

describe('migration 0013 (contract_lab_schema)', () => {
  it('applies on a fresh database and reports schema_version 13', () => {
    const migrated = createMigratedD1()
    const row = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('13')
    // The attempts/report control-plane tables still exist, untouched.
    const tables = migrated.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('hunt_attempts', 'bug_reports') ORDER BY name",
      )
      .all() as Array<{ name: string }>
    expect(tables.map((t) => t.name)).toEqual(['bug_reports', 'hunt_attempts'])
  })

  it('upgrades a v12 database, preserves existing rows and stamps 13', () => {
    const migrated = createMigratedD1({ through: 12 })
    const before = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(before.value).toBe('12')

    migrated.sqlite.exec(`
      INSERT INTO customers (id, email, name, password_hash, role, status, address_line, address_city, address_postcode, created_at)
      VALUES (4243, 'keeper13@example.com', 'Keep Er', 'pbkdf2$test', 'customer', 'active', '1 Safe Row', 'Aldermere', 'AL1 1AA', '2026-01-01T00:00:00Z');
      INSERT INTO practice_sessions (token_hash, created_at, expires_at, mode)
      VALUES ('cd' || printf('%030d', 2), '2026-11-01T00:00:00.000Z', '2027-11-01T00:00:00.000Z', 'clean');
    `)

    applyRemainingMigrations(migrated, 12)

    const after = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(after.value).toBe('13')

    const customer = migrated.sqlite
      .prepare("SELECT email FROM customers WHERE id = 4243")
      .get() as { email: string }
    expect(customer.email).toBe('keeper13@example.com')
    const session = migrated.sqlite
      .prepare("SELECT mode FROM practice_sessions WHERE token_hash = 'cd' || printf('%030d', 2)")
      .get() as { mode: string }
    expect(session.mode).toBe('clean')
  })

  it('introduces zero DDL — the table set is identical before and after 0013', () => {
    const migrated = createMigratedD1({ through: 12 })
    const tables = (db: typeof migrated.sqlite) =>
      (db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>)
        .map((t) => t.name)
    const before = tables(migrated.sqlite)
    applyRemainingMigrations(migrated, 12)
    const after = tables(migrated.sqlite)
    expect(after).toEqual(before)
  })
})
