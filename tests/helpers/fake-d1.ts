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

function adapt(sqlite: DatabaseSync) {
  const statement = (sql: string): D1PreparedStatementLike => {
    const runWith = (params: unknown[]) => sqlite.prepare(sql).run(...(params as never[]))
    const allWith = <T,>(params: unknown[]) =>
      sqlite.prepare(sql).all(...(params as never[])) as unknown as T[]
    const getWith = <T,>(params: unknown[]) =>
      (sqlite.prepare(sql).get(...(params as never[])) as unknown as T | undefined) ?? null

    return {
      bind(...params: unknown[]) {
        return {
          all: async <T = unknown>() => ({ results: allWith<T>(params) }),
          first: async <T = unknown>() => getWith<T>(params),
          run: async () => ({ meta: { changes: runWith(params).changes } }),
        }
      },
      all: async <T = unknown>() => ({ results: allWith<T>([]) }),
      first: async <T = unknown>() => getWith<T>([]),
      run: async () => ({ meta: { changes: runWith([]).changes } }),
    }
  }

  return { prepare: statement }
}

export interface MigratedD1 {
  db: D1Database
  sqlite: DatabaseSync
}

export function createMigratedD1(): MigratedD1 {
  const sqlite = new DatabaseSync(':memory:')
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    sqlite.exec(readFileSync(path.join(migrationsDir, file), 'utf8'))
  }

  return {
    db: adapt(sqlite) as unknown as D1Database,
    sqlite,
  }
}
