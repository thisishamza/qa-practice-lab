// Copy-as-TSV / copy-as-CSV for query results.
//
// CSV follows RFC 4180 (quote when the cell contains a comma, double quote,
// or newline; double internal quotes). Cells that begin with a formula
// trigger character (= + - @) are prefixed with a single quote so pasting
// into a spreadsheet never evaluates them (formula-injection guard).

import type { SqlResultSet } from '../shared/sql'

export type CopyMode = 'tsv' | 'csv'

const FORMULA_TRIGGERS = /^[=+\-@]/

export function guardCell(value: string): string {
  return FORMULA_TRIGGERS.test(value) ? `'` + value : value
}

export function escapeCsvCell(value: string): string {
  const guarded = guardCell(value)
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`
  }
  return guarded
}

export function escapeTsvCell(value: string): string {
  // TSV has no quoting layer; strip tabs/newlines so columns never shift.
  return guardCell(value).replace(/[\t\r\n]+/g, ' ').trim()
}

export function cellToString(value: number | string | null): string {
  if (value === null) return ''
  return String(value)
}

/** Serialize one result set. Includes the column header row. */
export function serializeResultSet(set: SqlResultSet, mode: CopyMode): string {
  const escape = mode === 'csv' ? escapeCsvCell : escapeTsvCell
  const delimiter = mode === 'csv' ? ',' : '\t'
  const lines: string[] = []
  if (set.columns.length > 0) {
    lines.push(set.columns.map(escape).join(delimiter))
  }
  for (const row of set.rows) {
    lines.push(row.map((cell) => escape(cellToString(cell))).join(delimiter))
  }
  return lines.join('\n')
}

/**
 * Serialize every row-returning result set in a batch. Statements are
 * separated by a comment line naming the originating statement index and are
 * prefixed with the statement text as a comment — pasting into a document or
 * spreadsheet keeps the provenance.
 */
export function serializeResultSets(sets: readonly SqlResultSet[], mode: CopyMode): string {
  const rowSets = sets.filter((set) => set.columns.length > 0)
  if (rowSets.length === 0) {
    const totalChanges = sets.reduce((acc, set) => acc + (set.changes ?? 0), 0)
    return `-- ${totalChanges} row(s) affected`
  }
  return rowSets
    .map((set) => {
      const header = `-- Statement ${set.statementIndex + 1} (${set.rowCount} row${set.rowCount === 1 ? '' : 's'}${set.truncated ? ', truncated' : ''})`
      return `${header}\n${serializeResultSet(set, mode)}`
    })
    .join('\n\n')
}

export function totalRowsCopied(sets: readonly SqlResultSet[]): number {
  return sets.reduce((acc, set) => acc + (set.columns.length > 0 ? set.rowCount : 0), 0)
}
