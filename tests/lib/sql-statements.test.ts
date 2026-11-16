import { describe, expect, it } from 'vitest'
import { splitStatements, stripLiteralsAndComments } from '../../src/lib/sql/statements'

describe('splitStatements', () => {
  it('splits simple statements on top-level semicolons', () => {
    const statements = splitStatements('SELECT 1; SELECT 2; SELECT 3')
    expect(statements.map((s) => s.text)).toEqual(['SELECT 1', 'SELECT 2', 'SELECT 3'])
  })

  it('ignores semicolons inside string literals', () => {
    const statements = splitStatements("SELECT 'a;b'; SELECT 2")
    expect(statements).toHaveLength(2)
    expect(statements[0].text).toBe("SELECT 'a;b'")
  })

  it('handles doubled single-quotes as an escape, not a terminator', () => {
    const statements = splitStatements("SELECT 'it''s; here'; SELECT 2")
    expect(statements).toHaveLength(2)
    expect(statements[0].text).toBe("SELECT 'it''s; here'")
  })

  it('ignores semicolons inside double-quoted identifiers', () => {
    const statements = splitStatements('SELECT * FROM "weird;table"; SELECT 2')
    expect(statements).toHaveLength(2)
  })

  it('ignores semicolons inside bracket identifiers', () => {
    const statements = splitStatements('SELECT * FROM [weird;table]; SELECT 2')
    expect(statements).toHaveLength(2)
  })

  it('ignores semicolons inside line comments', () => {
    const sql = 'SELECT 1 -- drop table orders; oops\n; SELECT 2'
    const statements = splitStatements(sql)
    expect(statements).toHaveLength(2)
  })

  it('ignores semicolons inside block comments', () => {
    const statements = splitStatements('SELECT 1 /* ; ; ; */; SELECT 2')
    expect(statements).toHaveLength(2)
  })

  it('drops empty statements and trailing semicolons', () => {
    const statements = splitStatements(';; SELECT 1;;;')
    expect(statements.map((s) => s.text)).toEqual(['SELECT 1'])
  })

  it('handles CRLF line endings', () => {
    const statements = splitStatements('SELECT 1;\r\nSELECT 2;\r\n')
    expect(statements).toHaveLength(2)
  })

  it('emits the unterminated remainder as a final statement', () => {
    const statements = splitStatements("SELECT 'unterminated")
    expect(statements).toHaveLength(1)
    expect(statements[0].text).toBe("SELECT 'unterminated")
  })

  it('reports character offsets for the failing statement', () => {
    const statements = splitStatements('SELECT 1;\nSELECT 2')
    expect(statements[1].start).toBe(10)
  })
})

describe('stripLiteralsAndComments', () => {
  it('removes string contents so keywords inside them are inert', () => {
    expect(stripLiteralsAndComments("SELECT 'ATTACH'")).not.toMatch(/attach/i)
  })

  it('removes comments', () => {
    expect(stripLiteralsAndComments('SELECT 1 -- ATTACH me\n')).not.toMatch(/attach/i)
    expect(stripLiteralsAndComments('SELECT 1 /* VACUUM INTO */')).not.toMatch(/vacuum/i)
  })

  it('keeps real keywords', () => {
    expect(stripLiteralsAndComments('ATTACH DATABASE x AS y')).toMatch(/attach/i)
  })
})
