import { describe, expect, it } from 'vitest'
import {
  cellToString,
  escapeCsvCell,
  escapeTsvCell,
  guardCell,
  serializeResultSet,
  serializeResultSets,
  totalRowsCopied,
} from '../../src/lib/copy'
import type { SqlResultSet } from '../../src/shared/sql'

const makeSet = (overrides: Partial<SqlResultSet> = {}): SqlResultSet => ({
  statementIndex: 0,
  statement: 'SELECT 1',
  columns: ['id', 'name'],
  rows: [
    [1, 'Tent'],
    [2, 'Lantern'],
  ],
  rowCount: 2,
  truncated: false,
  changes: null,
  elapsedMs: 1,
  ...overrides,
})

describe('guardCell (formula-injection guard)', () => {
  it('prefixes dangerous leading characters with a single quote', () => {
    expect(guardCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(guardCell('+cmd')).toBe("'+cmd")
    expect(guardCell('-2+3')).toBe("'-2+3")
    expect(guardCell('@mention')).toBe("'@mention")
  })

  it('leaves ordinary values unchanged', () => {
    expect(guardCell('Tent')).toBe('Tent')
    expect(guardCell('42')).toBe('42')
    expect(guardCell('')).toBe('')
  })
})

describe('escapeCsvCell (RFC 4180)', () => {
  it('quotes cells containing commas, quotes or newlines and doubles internal quotes', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('she said "hi"')).toBe('"she said ""hi"""')
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('leaves plain cells unquoted', () => {
    expect(escapeCsvCell('Tent')).toBe('Tent')
  })
})

describe('escapeTsvCell', () => {
  it('strips tabs and newlines so columns never shift', () => {
    expect(escapeTsvCell('a\tb')).toBe('a b')
    expect(escapeTsvCell('a\nb')).toBe('a b')
  })
})

describe('serializeResultSet', () => {
  it('emits a header row then data rows (TSV)', () => {
    expect(serializeResultSet(makeSet(), 'tsv')).toBe('id\tname\n1\tTent\n2\tLantern')
  })

  it('emits RFC 4180 output (CSV)', () => {
    const set = makeSet({ rows: [[1, 'Tent, blue']] })
    expect(serializeResultSet(set, 'csv')).toBe('id,name\n1,"Tent, blue"')
  })

  it('renders NULL as an empty cell', () => {
    const set = makeSet({ rows: [[1, null]] })
    expect(serializeResultSet(set, 'tsv')).toBe('id\tname\n1\t')
  })
})

describe('cellToString', () => {
  it('stringifies numbers and preserves NULL as empty', () => {
    expect(cellToString(1299)).toBe('1299')
    expect(cellToString(null)).toBe('')
  })
})

describe('serializeResultSets', () => {
  it('separates statements with provenance comment headers', () => {
    const sets = [
      makeSet({ statementIndex: 0, statement: 'SELECT 1' }),
      makeSet({ statementIndex: 1, statement: 'SELECT 2' }),
    ]
    const text = serializeResultSets(sets, 'tsv')
    expect(text).toContain('-- Statement 1 (2 rows)')
    expect(text).toContain('-- Statement 2 (2 rows)')
  })

  it('notes truncation in the provenance header', () => {
    const sets = [makeSet({ truncated: true })]
    expect(serializeResultSets(sets, 'tsv')).toContain('truncated')
  })

  it('summarizes DML-only batches as an affected-row count', () => {
    const set = makeSet({ columns: [], rows: [], rowCount: 0, changes: 3 })
    expect(serializeResultSets([set], 'csv')).toBe('-- 3 row(s) affected')
  })

  it('totals rows across sets', () => {
    const sets = [makeSet(), makeSet({ statementIndex: 1 })]
    expect(totalRowsCopied(sets)).toBe(4)
  })
})
