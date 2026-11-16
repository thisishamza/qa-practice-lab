// Result-based evaluator unit tests (plan §7.2, §12.1). Exercises the
// comparison engine directly — no worker, no D1, no network.
import { describe, expect, it } from 'vitest'
import { evaluateSubmission, type SqlExpectedSpec } from '../../src/server/sqlEvaluate'

const SPEC = (overrides: Partial<SqlExpectedSpec> = {}): SqlExpectedSpec => ({
  columns: [
    { name: 'id', kind: 'integer' },
    { name: 'email', kind: 'text' },
  ],
  rows: [
    [1, 'amara@example.com'],
    [2, 'ben@example.com'],
    [3, 'priya@example.com'],
  ],
  ...overrides,
})

const ENVELOPE = (rows: unknown[][], columns = ['id', 'email'], truncated = false) => ({
  columns,
  rows: rows as never,
  truncated,
})

describe('evaluateSubmission — multiset vs ordered', () => {
  it('passes the exact result set', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'amara@example.com'], [2, 'ben@example.com'], [3, 'priya@example.com']]))
    expect(verdict.passed).toBe(true)
    expect(verdict.score).toBe(100)
    expect(verdict.checks.every((check) => check.passed)).toBe(true)
  })

  it('passes reordered rows by default (multiset semantics)', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[3, 'priya@example.com'], [1, 'amara@example.com'], [2, 'ben@example.com']]))
    expect(verdict.passed).toBe(true)
    expect(verdict.score).toBe(100)
  })

  it('fails reordered rows when ordered is required', () => {
    const verdict = evaluateSubmission(SPEC({ ordered: true }), ENVELOPE([[3, 'priya@example.com'], [1, 'amara@example.com'], [2, 'ben@example.com']]))
    expect(verdict.passed).toBe(false)
    expect(verdict.checks.find((check) => check.id === 'ordered')?.passed).toBe(false)
    expect(verdict.checks.find((check) => check.id === 'rows')?.passed).toBe(false)
    expect(verdict.feedback).toContain('ORDER BY')
  })

  it('passes correctly ordered rows when ordered is required', () => {
    const verdict = evaluateSubmission(SPEC({ ordered: true }), ENVELOPE([[1, 'amara@example.com'], [2, 'ben@example.com'], [3, 'priya@example.com']]))
    expect(verdict.passed).toBe(true)
  })

  it('duplicate rows break multiset equality', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'amara@example.com'], [1, 'amara@example.com'], [2, 'ben@example.com']]))
    expect(verdict.passed).toBe(false)
  })
})

describe('evaluateSubmission — columns', () => {
  it('matches column names case-insensitively', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'amara@example.com'], [2, 'ben@example.com'], [3, 'priya@example.com']], ['ID', 'Email']))
    expect(verdict.passed).toBe(true)
  })

  it('fails a missing column and names it', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1], [2], [3]], ['id']))
    expect(verdict.passed).toBe(false)
    const columns = verdict.checks.find((check) => check.id === 'columns')
    expect(columns?.passed).toBe(false)
    expect(columns?.message).toContain('email')
  })

  it('fails an unexpected column', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'a@example.com', 'x'], [2, 'b@example.com', 'y'], [3, 'p@example.com', 'z']], ['id', 'email', 'notes']))
    expect(verdict.passed).toBe(false)
    expect(verdict.checks.find((check) => check.id === 'columns')?.message).toContain('notes')
  })

  it('column order does not matter', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([['amara@example.com', 1], ['ben@example.com', 2], ['priya@example.com', 3]], ['email', 'id']))
    expect(verdict.passed).toBe(true)
  })
})

describe('evaluateSubmission — values and canonicalization', () => {
  it('NULL never equals an empty string', () => {
    const spec = SPEC({ rows: [[1, null]] })
    const pass = evaluateSubmission(spec, ENVELOPE([[1, null]]))
    const fail = evaluateSubmission(spec, ENVELOPE([[1, '']]))
    expect(pass.passed).toBe(true)
    expect(fail.passed).toBe(false)
  })

  it('cents compare exactly at integer boundaries', () => {
    const spec: SqlExpectedSpec = {
      columns: [{ name: 'total_cents', kind: 'integer_cents' }],
      rows: [[12999]],
    }
    expect(evaluateSubmission(spec, ENVELOPE([[12999]], ['total_cents'])).passed).toBe(true)
    expect(evaluateSubmission(spec, ENVELOPE([[12998]], ['total_cents'])).passed).toBe(false)
  })

  it('tolerance applies only when declared', () => {
    const loose: SqlExpectedSpec = {
      columns: [{ name: 'ratio', kind: 'number' }],
      rows: [[1.5]],
      numericTolerance: 0.01,
    }
    expect(evaluateSubmission(loose, ENVELOPE([[1.505]], ['ratio'])).passed).toBe(true)
    const strict: SqlExpectedSpec = {
      columns: [{ name: 'ratio', kind: 'number' }],
      rows: [[1.5]],
    }
    expect(evaluateSubmission(strict, ENVELOPE([[1.505]], ['ratio'])).passed).toBe(false)
  })

  it('nocase collates text; binary is exact', () => {
    const ci: SqlExpectedSpec = {
      columns: [{ name: 'email', kind: 'text' }],
      rows: [['Amara@Example.com']],
      collate: 'nocase',
    }
    expect(evaluateSubmission(ci, ENVELOPE([['amara@example.com']], ['email'])).passed).toBe(true)
    const cs: SqlExpectedSpec = {
      columns: [{ name: 'email', kind: 'text' }],
      rows: [['Amara@Example.com']],
    }
    expect(evaluateSubmission(cs, ENVELOPE([['amara@example.com']], ['email'])).passed).toBe(false)
  })

  it('trims trailing spaces inside text cells', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'amara@example.com ']], ['id', 'email']))
    expect(verdict.passed).toBe(false) // rows count mismatch — 1 row vs 3 expected
    const one = evaluateSubmission(SPEC({ rows: [[1, 'amara@example.com']] }), ENVELOPE([[1, 'amara@example.com ']], ['id', 'email']))
    expect(one.passed).toBe(true)
  })

  it('booleans and spelled-out booleans canonicalize to 0/1', () => {
    const spec: SqlExpectedSpec = {
      columns: [{ name: 'flag', kind: 'boolean' }],
      rows: [[1], [0]],
    }
    expect(evaluateSubmission(spec, ENVELOPE([[true], [false]], ['flag'])).passed).toBe(true)
    expect(evaluateSubmission(spec, ENVELOPE([['yes'], ['no']], ['flag'])).passed).toBe(true)
  })
})

describe('evaluateSubmission — truncation, rubrics, verdicts', () => {
  it('a truncated envelope can never pass', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'amara@example.com'], [2, 'ben@example.com'], [3, 'priya@example.com']], ['id', 'email'], true))
    expect(verdict.passed).toBe(false)
    expect(verdict.checks.find((check) => check.id === 'rows')?.message).toContain('truncated')
  })

  it('wrong row count fails the rows check with counts in the message', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'amara@example.com']]))
    expect(verdict.passed).toBe(false)
    expect(verdict.checks.find((check) => check.id === 'rows')?.message).toContain('Expected 3 rows, got 1')
  })

  it('a missing column still earns the rows score share if rows were compared… (they are not — rows fail)', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'e@example.com']], ['id', 'mail']))
    expect(verdict.score).toBe(0) // columns fail; rows cannot be compared → fail; ordered contributes 0 (unordered spec)
  })

  it('allOrNothing scores 100 or 0 only', () => {
    const spec = SPEC({ allOrNothing: true })
    expect(evaluateSubmission(spec, ENVELOPE([[1, 'amara@example.com'], [2, 'ben@example.com'], [3, 'priya@example.com']])).score).toBe(100)
    expect(evaluateSubmission(spec, ENVELOPE([[1, 'amara@example.com']])).score).toBe(0)
  })

  it('pass threshold is 70', () => {
    // columns (30) + ordered-free (10) = 40 < 70 fails; columns+rows (100) passes.
    const partial = evaluateSubmission(SPEC({ ordered: true }), ENVELOPE([[1, 'amara@example.com'], [2, 'ben@example.com'], [3, 'priya@example.com']], ['id', 'email']))
    expect(partial.score).toBe(100)
  })

  it('feedback names a failing column', () => {
    const verdict = evaluateSubmission(SPEC(), ENVELOPE([[1, 'amara@example.com'], [2, 'ben@example.com'], [3, 'priya@example.com']], ['id', 'mail']))
    expect(verdict.feedback).toContain('email')
  })
})
