// Result-based evaluation engine (plan §7.2, §10.3) — CODE, not data.
//
// Compares a learner's submitted result envelope ({ columns, rows }) against
// a compiled, server-only expected spec. Exact-string SQL matching is never
// used. Rules:
//   - Column NAMES are matched case-insensitively (trimmed); every expected
//     column must be present and no unexpected column may appear.
//   - Column ORDER is not significant; rows are compared as multisets by
//     default, or in order when the spec declares `ordered: true`.
//   - Values are canonicalized: NULL stays NULL (never equal to ''), integers
//     compare exactly, strings trim and compare case-insensitively when the
//     spec sets collate: 'nocase', ISO-8601 timestamps compare lexicographically
//     (they are the same byte order), and numerics honour `numericTolerance`.
//   - The truncation flag fails the rows check: an incomplete result set can
//     never pass evaluation.
//   - Feedback names the column/row and a concrete next step; no lorem.
//
// The pass threshold is 70. Scores come only from the compiled rubric;
// nothing the client sends can raise the score.

import type { SqlCell } from '../shared/sql'

export type SqlExpectedKind =
  | 'integer'
  | 'integer_cents'
  | 'number'
  | 'text'
  | 'iso_text'
  | 'boolean'

export interface SqlExpectedColumn {
  /** Expected column name (compared case-insensitively). */
  name: string
  kind?: SqlExpectedKind
}

export interface SqlRubric {
  columns: number
  rows: number
  ordered: number
}

export interface SqlExpectedSpec {
  columns: SqlExpectedColumn[]
  rows: SqlCell[][]
  /** Rows must arrive in exactly this order. Default false (multiset). */
  ordered?: boolean
  /** 'nocase' compares text values case-insensitively; 'binary' (default) is exact. */
  collate?: 'binary' | 'nocase'
  /** Absolute tolerance for non-integer numerics. Exact integer comparison ignores it. */
  numericTolerance?: number
  /** Override the default rubric. Binary checks use allOrNothing instead. */
  rubric?: Partial<SqlRubric>
  /** Score 100 only when every check passes, else 0 (rollback verification etc.). */
  allOrNothing?: boolean
}

export interface SqlEvaluationCheck {
  id: 'columns' | 'rows' | 'ordered'
  passed: boolean
  message: string
}

export interface SqlEvaluation {
  passed: boolean
  score: number
  checks: SqlEvaluationCheck[]
  feedback: string
}

export const SQL_EVALUATE_PASS_SCORE = 70

interface CanonNumeric {
  t: 'n'
  v: number
}
interface CanonText {
  t: 's'
  v: string
}
interface CanonNull {
  t: 'null'
}
type Canon = CanonNumeric | CanonText | CanonNull

const TRUE_STRINGS = new Set(['true', 't', 'yes', 'y', '1'])
const FALSE_STRINGS = new Set(['false', 'f', 'no', 'n', '0'])

/** Canonicalize one expected-or-submitted cell using the expected column's kind. */
function canonCell(
  value: unknown,
  kind: SqlExpectedKind | undefined,
  nocase: boolean,
): Canon {
  if (value === null || value === undefined) {
    return { t: 'null' }
  }
  const numericKinds: SqlExpectedKind[] = ['integer', 'integer_cents', 'number', 'boolean']
  const wantsNumeric = kind !== undefined && numericKinds.includes(kind)

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { t: 'n', v: Number.NaN }
    }
    return { t: 'n', v: value }
  }
  if (typeof value === 'boolean') {
    return { t: 'n', v: value ? 1 : 0 }
  }
  if (typeof value !== 'string') {
    return { t: 's', v: String(value) }
  }
  const trimmed = value.trim()
  if (wantsNumeric) {
    const lowerWord = trimmed.toLowerCase()
    if (TRUE_STRINGS.has(lowerWord)) return { t: 'n', v: 1 }
    if (FALSE_STRINGS.has(lowerWord)) return { t: 'n', v: 0 }
    const parsed = Number(trimmed)
    if (trimmed !== '' && Number.isFinite(parsed)) {
      return { t: 'n', v: parsed }
    }
    // Fall through to text comparison when the submission is not numeric.
    return { t: 's', v: nocase ? trimmed.toLowerCase() : trimmed }
  }
  // Booleans tolerate spelled-out values.
  const lower = trimmed.toLowerCase()
  if (TRUE_STRINGS.has(lower)) return { t: 'n', v: 1 }
  if (FALSE_STRINGS.has(lower)) return { t: 'n', v: 0 }
  return { t: 's', v: nocase ? trimmed.toLowerCase() : trimmed }
}

function canonEquals(a: Canon, b: Canon, tolerance: number): boolean {
  if (a.t === 'null' && b.t === 'null') return true
  if (a.t !== b.t) {
    // Tolerate numeric-looking text vs number when one side is numeric.
    if (a.t === 'n' && b.t === 's') return numericTextEquals(a, b, tolerance)
    if (a.t === 's' && b.t === 'n') return numericTextEquals(b, a, tolerance)
    return false
  }
  if (a.t === 'n') {
    const na = a as CanonNumeric
    const nb = b as CanonNumeric
    if (Number.isNaN(na.v) || Number.isNaN(nb.v)) {
      return Number.isNaN(na.v) && Number.isNaN(nb.v)
    }
    // Integer comparison is exact; tolerance applies only to non-integers.
    if (Number.isInteger(na.v) && Number.isInteger(nb.v)) {
      return na.v === nb.v
    }
    return Math.abs(na.v - nb.v) <= tolerance
  }
  return (a as CanonText).v === (b as CanonText).v
}

function numericTextEquals(num: CanonNumeric, text: CanonText, tolerance: number): boolean {
  const parsed = Number(text.v)
  if (text.v === '' || !Number.isFinite(parsed)) {
    return false
  }
  if (Number.isInteger(num.v) && Number.isInteger(parsed)) {
    return num.v === parsed
  }
  return Math.abs(num.v - parsed) <= tolerance
}

function canonKey(row: Canon[]): string {
  return JSON.stringify(row.map((cell) => (cell.t === 'null' ? ['null'] : cell.t === 'n' ? ['n', (cell as CanonNumeric).v] : ['s', (cell as CanonText).v])))
}

function matchColumns(
  expected: readonly SqlExpectedColumn[],
  submittedNames: readonly string[],
): { map: number[] | null; missing: string[]; unexpected: string[] } {
  const used = new Array<boolean>(submittedNames.length).fill(false)
  const map: number[] = []
  const missing: string[] = []
  for (const column of expected) {
    const wanted = column.name.trim().toLowerCase()
    let found = -1
    for (let index = 0; index < submittedNames.length; index += 1) {
      if (used[index]) continue
      if (submittedNames[index].trim().toLowerCase() === wanted) {
        found = index
        break
      }
    }
    if (found === -1) {
      missing.push(column.name)
    } else {
      used[found] = true
      map.push(found)
    }
  }
  const unexpected: string[] = []
  for (let index = 0; index < submittedNames.length; index += 1) {
    if (!used[index]) {
      unexpected.push(submittedNames[index])
    }
  }
  if (missing.length > 0 || unexpected.length > 0) {
    return { map: null, missing, unexpected }
  }
  return { map, missing, unexpected }
}

function normalizeSpec(spec: SqlExpectedSpec): Required<Pick<SqlExpectedSpec, 'collate' | 'numericTolerance'>> & SqlExpectedSpec {
  return {
    ...spec,
    collate: spec.collate ?? 'binary',
    numericTolerance: spec.numericTolerance ?? 0,
  }
}

function defaultRubric(spec: SqlExpectedSpec): SqlRubric {
  const base: SqlRubric = spec.ordered
    ? { columns: 30, rows: 60, ordered: 10 }
    : { columns: 30, rows: 70, ordered: 0 }
  return { ...base, ...spec.rubric }
}

/** Evaluate a submitted envelope against the compiled spec. Pure and deterministic. */
export function evaluateSubmission(
  spec: SqlExpectedSpec,
  envelope: { columns: string[]; rows: unknown[][]; truncated?: boolean },
): SqlEvaluation {
  const normalized = normalizeSpec(spec)
  const nocase = normalized.collate === 'nocase'
  const tolerance = normalized.numericTolerance
  const rubric = defaultRubric(spec)
  const checks: SqlEvaluationCheck[] = []

  const submittedColumns = envelope.columns.map((name) => String(name))
  const { map, missing, unexpected } = matchColumns(normalized.columns, submittedColumns)
  const columnsPassed = map !== null
  checks.push({
    id: 'columns',
    passed: columnsPassed,
    message: columnsPassed
      ? 'Column set matches.'
      : missing.length > 0
        ? `Column \`${missing[0]}\` is missing — re-read what the question asks to return${unexpected.length > 0 ? `; also remove the unexpected column \`${unexpected[0]}\`` : ''}.`
        : `Unexpected column \`${unexpected[0]}\` — return only the asked-for columns.`,
  })

  // Row comparison only happens when columns mapped (values are meaningless otherwise).
  let rowsPassed = false
  let orderedPassed = !spec.ordered
  let rowsMessage: string
  if (!columnsPassed || !map) {
    rowsMessage = 'Fix the columns first — row comparison needs them aligned.'
  } else if (envelope.truncated === true) {
    rowsMessage = 'The result set was truncated — narrow your query (add a WHERE or LIMIT) so it fits completely.'
  } else {
    const expectedCount = normalized.rows.length
    if (envelope.rows.length !== expectedCount) {
      rowsMessage = `Expected ${expectedCount} row${expectedCount === 1 ? '' : 's'}, got ${envelope.rows.length} — re-check the JOIN predicate, the WHERE clause and any aggregation level.`
    } else {
      const canonExpected = normalized.rows.map((row) =>
        row.map((cell, index) => canonCell(cell, normalized.columns[index]?.kind, nocase)),
      )
      const canonSubmitted = envelope.rows.map((row) =>
        normalized.columns.map((_, index) =>
          canonCell(row[map[index]], normalized.columns[index]?.kind, nocase),
        ),
      )
      if (spec.ordered) {
        let mismatchAt = -1
        for (let r = 0; r < canonExpected.length; r += 1) {
          const a = canonExpected[r]
          const b = canonSubmitted[r]
          if (a.length !== b.length) {
            mismatchAt = r
            break
          }
          for (let c = 0; c < a.length; c += 1) {
            if (!canonEquals(a[c], b[c], tolerance)) {
              mismatchAt = r
              break
            }
          }
          if (mismatchAt !== -1) break
        }
        if (mismatchAt === -1) {
          rowsPassed = true
          orderedPassed = true
          rowsMessage = 'Rows and values match, in the required order.'
        } else {
          const column = firstMismatchColumn(canonExpected[mismatchAt], canonSubmitted[mismatchAt], tolerance)
          rowsMessage = `Row count matches; row ${mismatchAt + 1} differs at column \`${normalized.columns[column]?.name ?? column + 1}\` — recompute it from the stored tables, not from an assumption.`
          orderedPassed = false
        }
      } else {
        let ok = true
        if (tolerance > 0) {
          // Fuzzy numerics need direct pairwise comparison, not key hashing.
          const remaining = canonSubmitted.map((row) => [...row])
          for (const a of canonExpected) {
            let found = -1
            for (let i = 0; i < remaining.length; i += 1) {
              const b = remaining[i]
              if (b.length !== a.length) continue
              let all = true
              for (let c = 0; c < a.length; c += 1) {
                if (!canonEquals(a[c], b[c], tolerance)) {
                  all = false
                  break
                }
              }
              if (all) {
                found = i
                break
              }
            }
            if (found === -1) {
              ok = false
              break
            }
            remaining.splice(found, 1)
          }
        } else {
          const remaining = canonSubmitted.map((row) => canonKey(row))
          for (const a of canonExpected) {
            const key = canonKey(a)
            const found = remaining.indexOf(key)
            if (found === -1) {
              ok = false
              break
            }
            remaining.splice(found, 1)
          }
        }
        if (ok) {
          rowsPassed = true
          rowsMessage = 'Rows and values match.'
        } else {
          const detail = findMismatchDetail(canonExpected, canonSubmitted, normalized.columns, tolerance)
          rowsMessage = detail
        }
      }
    }
  }
  const orderedMessage = !spec.ordered
    ? 'No ordering was required by the question.'
    : orderedPassed
      ? 'Ordering matches the required sort.'
      : 'Ordering was required by the question — add the matching ORDER BY.'

  checks.push({ id: 'rows', passed: rowsPassed, message: rowsMessage })
  checks.push({ id: 'ordered', passed: orderedPassed, message: orderedMessage })

  const passedCount = checks.filter((check) => check.passed)
  let score: number
  if (spec.allOrNothing) {
    score = passedCount.length === checks.length ? 100 : 0
  } else {
    score =
      (columnsPassed ? rubric.columns : 0) +
      (rowsPassed ? rubric.rows : 0) +
      (orderedPassed ? rubric.ordered : 0)
  }
  score = Math.max(0, Math.min(100, Math.round(score)))
  const passed = score >= SQL_EVALUATE_PASS_SCORE
  const failed = checks.filter((check) => !check.passed)
  const feedback = passed
    ? 'Passed. The result set matches the expected specification — nice work.'
    : failed.length === 1
      ? failed[0].message
      : failed.map((check) => check.message).join(' ')
  return { passed, score, checks, feedback }
}

function firstMismatchColumn(a: Canon[], b: Canon[], tolerance: number): number {
  for (let c = 0; c < a.length; c += 1) {
    if (!canonEquals(a[c], b[c], tolerance)) {
      return c
    }
  }
  return 0
}

function findMismatchDetail(
  expected: Canon[][],
  submitted: Canon[][],
  columns: readonly SqlExpectedColumn[],
  tolerance: number,
): string {
  // Best-effort diagnosis: locate the first unmatched expected row and the
  // column where its closest submitted neighbour differs.
  const remaining = submitted.map((row) => row.map((cell) => cell))
  for (const expRow of expected) {
    let bestIndex = -1
    let bestScore = Number.POSITIVE_INFINITY
    for (let i = 0; i < remaining.length; i += 1) {
      const subRow = remaining[i]
      let diff = 0
      for (let c = 0; c < expRow.length; c += 1) {
        if (!canonEquals(expRow[c], subRow[c], tolerance)) diff += 1
      }
      if (diff < bestScore) {
        bestScore = diff
        bestIndex = i
      }
    }
    if (bestScore > 0 && bestIndex !== -1) {
      const subRow = remaining[bestIndex]
      const column = firstMismatchColumn(expRow, subRow, tolerance)
      return `Row count matches; values differ at column \`${columns[column]?.name ?? column + 1}\` — check for stale joins or arithmetic drift, and recompute from the stored tables.`
    }
    remaining.splice(bestIndex, 1)
  }
  return 'Row count matches; at least one value differs — re-check the query semantics against the question.'
}
