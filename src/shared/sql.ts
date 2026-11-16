// Shared contracts for the Phase 6 SQL engine (client-side only — see
// docs/phase-6-database-testing-plan.md §6). Nothing here ever crosses the
// server boundary; learner SQL touches only the browser worker.

/** Hard safeguards (plan §6.3). Single source of truth for UI and engine. */
export const SQL_LIMITS = {
  /** Wall-clock per Run; enforced by the client via worker termination. */
  runTimeoutMs: 3_000,
  /** Milliseconds allowed for the automatic reseed that follows a timeout. */
  reseedGraceMs: 1_500,
  /** Maximum rows serialized per statement. */
  maxRowsPerStatement: 1_000,
  /** Maximum non-empty statements executed per Run. */
  maxStatementsPerRun: 50,
  /** Maximum characters of SQL text accepted per Run. */
  maxQueryLength: 100_000,
  /** Maximum characters kept per cell value. */
  maxCellBytes: 10_000,
  /** Maximum serialized result payload per Run, bytes (JSON length proxy). */
  maxResultBytes: 1_048_576,
} as const

/** Marker appended to cell values truncated by SQL-LIMITS.maxCellBytes. */
export const TRUNCATED_CELL_MARKER = '… [truncated]'

/** Raw value shapes we normalize to for display and tests. */
export type SqlCell = number | string | null

export interface SqlResultSet {
  /** Index of the originating statement inside the submitted batch. */
  statementIndex: number
  /** The statement text itself (trimmed), useful in the UI. */
  statement: string
  columns: string[]
  rows: SqlCell[][]
  /** Rows actually returned (after any cap). */
  rowCount: number
  truncated: boolean
  /** Rows changed by this statement when it returns no rows (INSERT/UPDATE/…). */
  changes: number | null
  elapsedMs: number
}

export interface SqlRunOutput {
  ok: boolean
  resultSets: SqlResultSet[]
  elapsedMs: number
  /** Present when ok=false; statementIndex points into the batch. */
  error: { statementIndex: number; message: string } | null
}

export interface SchemaColumn {
  name: string
  type: string
  notNull: boolean
  primaryKey: boolean
  defaultValue: string | null
}

export interface SchemaIndex {
  name: string
  columns: string[]
  unique: boolean
  partial: boolean
}

export interface SchemaForeignKey {
  from: string
  table: string
  to: string
}

export interface SchemaConstraint {
  kind: 'unique' | 'check' | 'notnull'
  detail: string
}

export interface SchemaTable {
  name: string
  ddl: string
  columns: SchemaColumn[]
  indexes: SchemaIndex[]
  foreignKeys: SchemaForeignKey[]
  constraints: SchemaConstraint[]
}

export interface SchemaInfo {
  tables: SchemaTable[]
  sqliteVersion: string
}

// ---------------------------------------------------------------------------
// Phase 6 M2 — evaluation contracts (learner-safe).
// The server compares these envelopes against compiled, server-only expected
// specs (src/server/sqlExercises.ts). Learner SQL is never sent to the
// server; only the result envelope below crosses the boundary.
// ---------------------------------------------------------------------------

/** Maximum rows accepted in an evaluation envelope (matches SQL_LIMITS). */
export const SQL_EVALUATE_MAX_ROWS = SQL_LIMITS.maxRowsPerStatement
/** Maximum columns accepted in an evaluation envelope. */
export const SQL_EVALUATE_MAX_COLUMNS = 64
/** Maximum characters accepted per cell value in an evaluation envelope. */
export const SQL_EVALUATE_MAX_CELL = SQL_LIMITS.maxCellBytes

export type SqlEvaluateCell = number | string | null

export interface SqlEvaluateRequest {
  exerciseId: string
  columns: string[]
  rows: SqlEvaluateCell[][]
  truncated?: boolean
}

export interface SqlEvaluateCheck {
  id: 'columns' | 'rows' | 'ordered'
  passed: boolean
  message: string
}

export interface SqlEvaluateResponse {
  passed: boolean
  /** 0–100. Pass threshold is 70. Computed only server-side. */
  score: number
  checks: SqlEvaluateCheck[]
  feedback: string
  /** Lifecycle status of the caller's attempt after the pass/fail stamp. */
  attemptStatus: 'in_progress' | 'submitted' | 'revealed' | 'none'
}
