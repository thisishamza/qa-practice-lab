/// <reference types="node" />
// Test harness that applies the real D1 migrations to an in-memory SQLite
// database (via node:sqlite) and exposes a minimal D1Database-compatible
// surface. It lets server tests exercise the actual migration SQL and seed
// data instead of hand-written query stubs. Never used in production.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(here, '../../db/migrations')

interface D1PreparedStatementLike {
  bind(...params: unknown[]): {
    all<T = unknown>(): Promise<{ results: T[] }>
    first<T = unknown>(): Promise<T | null>
    run(): Promise<{ meta: { changes: number | bigint } }>
  }
  all<T = unknown>(): Promise<{ results: T[] }>
  first<T = unknown>(): Promise<T | null>
  run(): Promise<{ meta: { changes: number | bigint } }>
}

interface BoundStatement {
  sql: string
  params: unknown[]
  all<T = unknown>(): Promise<{ results: T[] }>
  first<T = unknown>(): Promise<T | null>
  run(): Promise<{ meta: { changes: number | bigint } }>
}

function adapt(sqlite: DatabaseSync) {
  const statement = (sql: string): D1PreparedStatementLike => {
    const allWith = <T,>(params: unknown[]) =>
      sqlite.prepare(sql).all(...(params as never[])) as unknown as T[]
    const getWith = <T,>(params: unknown[]) =>
      (sqlite.prepare(sql).get(...(params as never[])) as unknown as T | undefined) ?? null
    const runWith = (params: unknown[]) => sqlite.prepare(sql).run(...(params as never[]))

    const bound = (params: unknown[]): BoundStatement => ({
      sql,
      params,
      all: async <T = unknown>() => ({ results: allWith<T>(params) }),
      first: async <T = unknown>() => getWith<T>(params),
      run: async () => {
        const info = runWith(params)
        return { meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } }
      }
    })

    return {
      bind(...params: unknown[]) {
        return bound(params)
      },
      ...bound([]),
    }
  }

  return {
    prepare: statement,
    /**
     * Mirrors D1's batch semantics: every statement runs inside one SQLite
     * transaction and the whole call fails (rolling back) if any statement
     * fails. D1 guarantees the same all-or-nothing behaviour.
     */
    batch: async (statements: BoundStatement[]) => {
      sqlite.exec('BEGIN')
      try {
        const results = statements.map((stmt) => {
          if (/^\s*select/i.test(stmt.sql)) {
            const rows = sqlite.prepare(stmt.sql).all(...(stmt.params as never[])) as unknown[]
            return { results: rows, success: true, meta: { changes: 0 } }
          }
          const info = sqlite.prepare(stmt.sql).run(...(stmt.params as never[]))
          return {
            results: [],
            success: true,
            meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
          }
        })
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
}

export interface MigratedD1 {
  db: D1Database
  sqlite: DatabaseSync
}

interface MigratedD1Options {
  /**
   * Apply only migrations with a numeric prefix <= this value. Used by the
   * migration tests to simulate upgrading a database that is already on an
   * older schema version (e.g. the Phase 3 P3-M8 schema, 0001..0008) before
   * applying the latest migration. Defaults to applying everything.
   */
  through?: number
}

/** Applies a subset of the real migrations, in order, to a fresh in-memory D1. */
function applyMigrations(sqlite: DatabaseSync, through?: number) {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  for (const file of files) {
    if (through !== undefined) {
      const prefix = Number.parseInt(file.slice(0, 4), 10)
      if (Number.isFinite(prefix) && prefix > through) {
        continue
      }
    }
    sqlite.exec(readFileSync(path.join(migrationsDir, file), 'utf8'))
  }
}

export function createMigratedD1(options: MigratedD1Options = {}): MigratedD1 {
  const sqlite = new DatabaseSync(':memory:')
  // Match D1, which enforces foreign key constraints (and ON DELETE CASCADE).
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite, options.through)

  return {
    db: adapt(sqlite) as unknown as D1Database,
    sqlite,
  }
}

/** Applies every migration strictly above `through` (already-applied subset expected). */
export function applyRemainingMigrations(
  migrated: MigratedD1,
  through: number,
): void {
  // Re-apply only the files above the given prefix; the database already
  // holds everything up to and including `through`.
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const prefix = Number.parseInt(file.slice(0, 4), 10)
    if (Number.isFinite(prefix) && prefix > through) {
      migrated.sqlite.exec(readFileSync(path.join(migrationsDir, file), 'utf8'))
    }
  }
}
