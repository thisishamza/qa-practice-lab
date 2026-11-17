// Migration 0014 — final phase lab. Fresh install and upgrade paths; adds
// exactly three session-scoped simulation tables; pre-existing data and the
// control-plane tables survive verbatim.
import { describe, expect, it } from 'vitest'
import {
  applyRemainingMigrations,
  createMigratedD1,
} from '../helpers/fake-d1'

describe('migration 0014 (final_phase_lab)', () => {
  it('applies on a fresh database and reports schema_version 14', () => {
    const migrated = createMigratedD1()
    const row = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(row.value).toBe('14')
    const tables = migrated.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('events', 'service_state', 'webhook_deliveries') ORDER BY name",
      )
      .all() as Array<{ name: string }>
    expect(tables.map((t) => t.name)).toEqual(['events', 'service_state', 'webhook_deliveries'])
    // The learning control plane is untouched.
    const learning = migrated.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('hunt_attempts', 'bug_reports') ORDER BY name",
      )
      .all() as Array<{ name: string }>
    expect(learning.map((t) => t.name)).toEqual(['bug_reports', 'hunt_attempts'])
  })

  it('upgrades a v13 database, preserves existing rows and stamps 14', () => {
    const migrated = createMigratedD1({ through: 13 })
    const before = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(before.value).toBe('13')

    migrated.sqlite.exec(`
      INSERT INTO customers (id, email, name, password_hash, role, status, address_line, address_city, address_postcode, created_at)
      VALUES (4343, 'keeper14@example.com', 'Keep Er', 'pbkdf2$test', 'customer', 'active', '1 Safe Row', 'Aldermere', 'AL1 1AA', '2026-01-01T00:00:00Z');
      INSERT INTO practice_sessions (token_hash, created_at, expires_at, mode)
      VALUES ('de' || printf('%030d', 4), '2026-11-01T00:00:00.000Z', '2027-11-01T00:00:00.000Z', 'clean');
    `)

    applyRemainingMigrations(migrated, 13)

    const after = migrated.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(after.value).toBe('14')

    const customer = migrated.sqlite
      .prepare("SELECT email FROM customers WHERE id = 4343")
      .get() as { email: string }
    expect(customer.email).toBe('keeper14@example.com')

    // The new tables exist and enforce their shape.
    const fk = migrated.sqlite
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'events'")
      .get() as { sql: string }
    expect(fk.sql).toContain('ON DELETE CASCADE')
    expect(fk.sql).toContain("CHECK (status IN ('pending', 'processed', 'failed', 'dead'))")
  })

  it('cascades simulation rows away with their practice session', () => {
    const migrated = createMigratedD1()
    migrated.sqlite.exec(`
      INSERT INTO practice_sessions (id, token_hash, created_at, expires_at, mode)
      VALUES (990001, 'ff' || printf('%030d', 9), '2026-11-01T00:00:00.000Z', '2027-11-01T00:00:00.000Z', 'clean');
      INSERT INTO events (id, practice_session_id, correlation_id, seq, type, payload_json, status, attempts, max_attempts, available_at, created_at, updated_at)
      VALUES ('evt_cascadetest123', 990001, 'corr_cascadetest', 1, 'order.created', '{"orderId":"ORD-C"}', 'pending', 0, 3, '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
      INSERT INTO service_state (practice_session_id, service, state_key, state_value, updated_at)
      VALUES (990001, 'orders', 'corr_cascadetest', '{}', '2026-11-01T00:00:00.000Z');
      INSERT INTO webhook_deliveries (id, practice_session_id, event_id, target, status, attempts, max_attempts, created_at, updated_at)
      VALUES ('whk_cascadetest123', 990001, 'evt_cascadetest123', 'https://hooks.meridian-practice.test/storefront', 'pending', 0, 3, '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
    `)
    migrated.sqlite.exec('DELETE FROM practice_sessions WHERE id = 990001')
    const events = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM events WHERE practice_session_id = 990001').get() as { n: number }
    const state = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM service_state WHERE practice_session_id = 990001').get() as { n: number }
    const webhooks = migrated.sqlite.prepare('SELECT COUNT(*) AS n FROM webhook_deliveries WHERE practice_session_id = 990001').get() as { n: number }
    expect(events.n).toBe(0)
    expect(state.n).toBe(0)
    expect(webhooks.n).toBe(0)
  })
})
