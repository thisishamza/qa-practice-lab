// Migration 0012 — app_meta schema_version 11 -> 12, intentional no-DDL bump.
// Fresh install and upgrade paths; pre-existing data must survive verbatim.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyRemainingMigrations,
  createMigratedD1,
} from '../helpers/fake-d1'

const migrationsDir = resolve(__dirname, '../../db/migrations')

describe('migration 0012 (sql_lab_schema)', () => {
  it('applies on a fresh database and reports schema_version 13', () => {
    const migrated = createMigratedD1()
    const row = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('14')
    // The attempts/report control-plane tables still exist, untouched.
    const tables = migrated.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('hunt_attempts', 'bug_reports') ORDER BY name",
      )
      .all() as Array<{ name: string }>
    expect(tables.map((t) => t.name)).toEqual(['bug_reports', 'hunt_attempts'])
  })

  it('upgrades a v11 database, preserves existing rows and stamps 12', () => {
    const migrated = createMigratedD1({ through: 11 })
    const before = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(before.value).toBe('11')

    migrated.sqlite.exec(`
      INSERT INTO customers (id, email, name, password_hash, role, status, address_line, address_city, address_postcode, created_at)
      VALUES (4242, 'keeper@example.com', 'Keep Er', 'pbkdf2$test', 'customer', 'active', '1 Safe Row', 'Aldermere', 'AL1 1AA', '2026-01-01T00:00:00Z');
      INSERT INTO practice_sessions (token_hash, created_at, expires_at, mode)
      VALUES ('ab' || printf('%030d', 1), '2026-11-01T00:00:00.000Z', '2027-11-01T00:00:00.000Z', 'clean');
    `)

    applyRemainingMigrations(migrated, 11)

    const after = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(after.value).toBe('14')

    const customer = migrated.sqlite
      .prepare('SELECT email, role FROM customers WHERE id = 4242')
      .get() as { email: string; role: string }
    expect(customer).toEqual({ email: 'keeper@example.com', role: 'customer' })
    const session = migrated.sqlite
      .prepare("SELECT mode FROM practice_sessions WHERE token_hash = 'ab' || printf('%030d', 1)")
      .get() as { mode: string }
    expect(session.mode).toBe('clean')
  })

  it('introduces zero DDL — the table set is identical before and after 0012', () => {
    const migrated = createMigratedD1({ through: 11 })
    const tables = (db: typeof migrated.sqlite) =>
      (db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>)
        .map((t) => t.name)
    const before = tables(migrated.sqlite)
    // Apply ONLY 0012 — 0013/0014 add/remove nothing either, but 0014 adds
    // the simulation tables on purpose.
    migrated.sqlite.exec(readFileSync(join(migrationsDir, '0012_sql_lab_schema.sql'), 'utf8'))
    const after = tables(migrated.sqlite)
    expect(after).toEqual(before)
  })
})
