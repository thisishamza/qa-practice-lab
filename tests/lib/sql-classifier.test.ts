import { describe, expect, it } from 'vitest'
import { classify } from '../../src/lib/sql/classify'
import { SQL_LIMITS } from '../../src/shared/sql'

describe('classify', () => {
  it('accepts an ordinary query', () => {
    const result = classify('SELECT name FROM products WHERE price_cents > 100 ORDER BY name LIMIT 5;')
    expect(result.ok).toBe(true)
    expect(result.statementCount).toBe(1)
    expect(result.issues).toEqual([])
  })

  it('counts statements and enforces the 50-statement cap', () => {
    const fifty = Array.from({ length: 50 }, () => 'SELECT 1').join(';')
    const fiftyOne = Array.from({ length: 51 }, () => 'SELECT 1').join(';')
    expect(classify(fifty).ok).toBe(true)
    const over = classify(fiftyOne)
    expect(over.ok).toBe(false)
    expect(over.statementCount).toBe(51)
    expect(over.issues.join(' ')).toContain('50')
  })

  it('rejects queries longer than 100 KB', () => {
    const huge = `SELECT '${'x'.repeat(SQL_LIMITS.maxQueryLength)}'`
    const result = classify(huge)
    expect(result.ok).toBe(false)
    expect(result.issues.join(' ')).toContain('KB')
  })

  it('blocks ATTACH and DETACH (case-insensitive)', () => {
    expect(classify('ATTACH DATABASE ":memory:" AS x').forbidden).toContain('attach')
    expect(classify('attach database "x.db" as x').forbidden).toContain('attach')
    expect(classify('DETACH DATABASE x').forbidden).toContain('detach')
  })

  it('blocks VACUUM INTO but allows plain VACUUM', () => {
    expect(classify("VACUUM INTO 'out.db'").forbidden).toContain('vacuum-into')
    expect(classify('VACUUM').forbidden).toEqual([])
    expect(classify('vacuum').ok).toBe(true)
  })

  it('blocks writable_schema and load_extension(...)', () => {
    expect(classify('PRAGMA writable_schema = ON').forbidden).toContain('writable-schema')
    expect(classify('SELECT load_extension("x")').forbidden).toContain('load-extension')
  })

  it('does not flag keywords inside string literals', () => {
    expect(classify("SELECT 'ATTACH DATABASE x'").forbidden).toEqual([])
    expect(classify("SELECT 'VACUUM INTO y'").forbidden).toEqual([])
    expect(classify("SELECT 'writable_schema'").forbidden).toEqual([])
  })

  it('does not flag keywords inside comments', () => {
    expect(classify('SELECT 1 -- ATTACH\n').forbidden).toEqual([])
    expect(classify('SELECT 1 /* DETACH */').forbidden).toEqual([])
  })

  it('blocks keywords split across line comments only when actually bare', () => {
    expect(classify('AT/*x*/TACH DATABASE ":memory:" AS x').ok).toBe(true) // advisory layer; see plan §6.4
    expect(classify('ATTACH/* inline */DATABASE ":memory:" AS x').forbidden).toContain('attach')
  })

  it('allows read-only pragmas and foreign_keys toggling', () => {
    expect(classify('PRAGMA foreign_keys = ON').ok).toBe(true)
    expect(classify('PRAGMA table_info(orders)').ok).toBe(true)
    expect(classify('PRAGMA index_list(products)').ok).toBe(true)
  })

  it('allows EXPLAIN QUERY PLAN', () => {
    expect(classify('EXPLAIN QUERY PLAN SELECT 1').ok).toBe(true)
  })
})
