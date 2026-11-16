// The single boundary between the app and sql.js (plan §4.3).
//
// This module is pure TypeScript with no wasm-path imports, so the identical
// code path runs in the browser worker and under Vitest in Node. The caller
// supplies the wasm bytes (from fetch(?url) in the browser, from fs in
// tests). Nothing else in the codebase imports 'sql.js'.

import initSqlJs from 'sql.js'
import type { Database, SqlValue } from 'sql.js'
import {
  SQL_LIMITS,
  TRUNCATED_CELL_MARKER,
  type SchemaColumn,
  type SchemaConstraint,
  type SchemaForeignKey,
  type SchemaIndex,
  type SchemaInfo,
  type SchemaTable,
  type SqlCell,
  type SqlResultSet,
  type SqlRunOutput,
} from '../../shared/sql'
import { splitStatements } from './statements'

export interface EngineDatabase {
  execAll(sql: string): SqlRunOutput
  exportBytes(): Uint8Array
  schema(): SchemaInfo
  sqliteVersion(): string
  close(): void
}

export async function openDatabase(wasmBytes: Uint8Array): Promise<EngineDatabase> {
  const wasmBinary =
    wasmBytes.byteOffset === 0 && wasmBytes.byteLength === wasmBytes.buffer.byteLength
      ? (wasmBytes.buffer as ArrayBuffer)
      : (wasmBytes.buffer.slice(
          wasmBytes.byteOffset,
          wasmBytes.byteOffset + wasmBytes.byteLength,
        ) as ArrayBuffer)
  const SQL = await initSqlJs({ wasmBinary })
  const db = new SQL.Database()
  db.run('PRAGMA foreign_keys = ON')
  return new SqlEngineDatabase(db)
}

function normalizeCell(value: SqlValue): SqlCell {
  if (value === null) return null
  if (value instanceof Uint8Array) return `[blob ${value.byteLength} bytes]`
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    return value
  }
  if (typeof value === 'string') {
    if (value.length > SQL_LIMITS.maxCellBytes) {
      return value.slice(0, SQL_LIMITS.maxCellBytes) + TRUNCATED_CELL_MARKER
    }
    return value
  }
  return String(value)
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

class SqlEngineDatabase implements EngineDatabase {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  sqliteVersion(): string {
    const result = this.db.exec('SELECT sqlite_version()')
    const value = result[0]?.values[0]?.[0]
    return typeof value === 'string' ? value : 'unknown'
  }

  execAll(sql: string): SqlRunOutput {
    const started = Date.now()
    const statements = splitStatements(sql)
    const resultSets: SqlResultSet[] = []

    for (let i = 0; i < statements.length; i += 1) {
      const statement = statements[i]
      const statementStarted = Date.now()
      let stmt
      try {
        stmt = this.db.prepare(statement.text)
      } catch (err) {
        return {
          ok: false,
          resultSets,
          elapsedMs: Date.now() - started,
          error: { statementIndex: i, message: errorMessage(err) },
        }
      }
      try {
        const columns = stmt.getColumnNames()
        const rows: SqlCell[][] = []
        let truncated = false
        while (stmt.step()) {
          if (rows.length >= SQL_LIMITS.maxRowsPerStatement) {
            truncated = true
            break
          }
          rows.push(stmt.get().map(normalizeCell))
        }
        const changes = columns.length > 0 ? null : this.db.getRowsModified()
        resultSets.push({
          statementIndex: i,
          statement: statement.text,
          columns,
          rows,
          rowCount: rows.length,
          truncated,
          changes,
          elapsedMs: Date.now() - statementStarted,
        })
      } catch (err) {
        return {
          ok: false,
          resultSets,
          elapsedMs: Date.now() - started,
          error: { statementIndex: i, message: errorMessage(err) },
        }
      } finally {
        stmt.free()
      }
    }

    return { ok: true, resultSets, elapsedMs: Date.now() - started, error: null }
  }

  exportBytes(): Uint8Array {
    return this.db.export()
  }

  schema(): SchemaInfo {
    const tables: SchemaTable[] = []
    const master = this.db.exec(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    const tableRows = master[0]?.values ?? []
    for (const row of tableRows) {
      const name = String(row[0])
      const ddl = row[1] === null ? '' : String(row[1])
      const table: SchemaTable = {
        name,
        ddl,
        columns: this.columnsOf(name),
        indexes: this.indexesOf(name),
        foreignKeys: this.foreignKeysOf(name),
        constraints: this.constraintsOf(name, ddl),
      }
      tables.push(table)
    }
    return { tables, sqliteVersion: this.sqliteVersion() }
  }

  close(): void {
    this.db.close()
  }

  private columnsOf(table: string): SchemaColumn[] {
    const rows = this.db.exec(`PRAGMA table_info(${quoteIdent(table)})`)[0]?.values ?? []
    return rows.map((row) => ({
      name: String(row[1]),
      type: String(row[2] ?? ''),
      notNull: Number(row[3]) === 1,
      defaultValue: row[4] === null ? null : String(row[4]),
      primaryKey: Number(row[5]) > 0,
    }))
  }

  private indexesOf(table: string): SchemaIndex[] {
    const entries = this.indexEntriesOf(table)
    return entries
      .filter((entry) => entry.origin === 'c')
      .map((entry) => ({
        name: entry.name,
        columns: entry.columns,
        unique: entry.unique,
        partial: entry.partial,
      }))
  }

  private uniqueConstraintsOf(table: string): SchemaConstraint[] {
    const entries = this.indexEntriesOf(table)
    return entries
      .filter((entry) => entry.origin === 'u')
      .map((entry) => ({ kind: 'unique' as const, detail: entry.columns.join(', ') }))
  }

  /** PRAGMA index_list + index_info for one table, classified by origin. */
  private indexEntriesOf(table: string): (SchemaIndex & { origin: string })[] {
    const rows = this.db.exec(`PRAGMA index_list(${quoteIdent(table)})`)[0]?.values ?? []
    return rows.map((row) => {
      const name = String(row[1])
      const unique = Number(row[2]) === 1
      const origin = String(row[3] ?? 'c')
      const partial = Number(row[4] ?? 0) === 1
      const infoRows = this.db.exec(`PRAGMA index_info(${quoteIdent(name)})`)[0]?.values ?? []
      const columns = infoRows.map((info) => String(info[2]))
      return { name, columns, unique, partial, origin }
    })
  }

  private foreignKeysOf(table: string): SchemaForeignKey[] {
    const rows = this.db.exec(`PRAGMA foreign_key_list(${quoteIdent(table)})`)[0]?.values ?? []
    return rows.map((row) => ({
      from: String(row[3]),
      table: String(row[2]),
      to: String(row[4]),
    }))
  }

  private constraintsOf(table: string, ddl: string): SchemaConstraint[] {
    const constraints: SchemaConstraint[] = []
    const notNull = this.columnsOf(table).filter((c) => c.notNull).map((c) => c.name)
    if (notNull.length > 0) {
      constraints.push({ kind: 'notnull', detail: notNull.join(', ') })
    }
    const uniqueIndexes = this.indexesOf(table).filter((i) => i.unique)
    // UNIQUE constraints declared in the DDL (origin='u') and visible unique indexes.
    for (const constraint of this.uniqueConstraintsOf(table)) {
      constraints.push(constraint)
    }
    for (const index of uniqueIndexes) {
      constraints.push({ kind: 'unique', detail: index.columns.join(', ') })
    }
    for (const match of ddl.matchAll(/CHECK\s*\(((?:[^()]|\([^()]*\))+)\)/gi)) {
      constraints.push({ kind: 'check', detail: match[1].trim() })
    }
    return constraints
  }
}

function quoteIdent(identifier: string): string {
  return '"' + identifier.replace(/"/g, '""') + '"'
}

/**
 * Enforce SQL_LIMITS.maxResultBytes on a completed run (plan §6.3).
 * Rows are dropped from the final row-returning statements first, and any
 * statement whose rows were dropped is marked `truncated`. Pure and
 * Node-testable; called by the worker before posting results.
 */
export function applyResultPayloadCap(output: SqlRunOutput): SqlRunOutput {
  const sizeOf = () => JSON.stringify(output.resultSets).length
  if (sizeOf() <= SQL_LIMITS.maxResultBytes) {
    return output
  }
  for (let i = output.resultSets.length - 1; i >= 0; i -= 1) {
    const set = output.resultSets[i]
    if (set.rows.length === 0) continue
    while (set.rows.length > 0 && sizeOf() > SQL_LIMITS.maxResultBytes) {
      set.rows.splice(Math.max(0, set.rows.length - Math.max(1, Math.floor(set.rows.length / 2))))
      set.rowCount = set.rows.length
      set.truncated = true
    }
    if (sizeOf() <= SQL_LIMITS.maxResultBytes) break
  }
  return output
}
