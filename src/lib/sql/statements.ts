// Statement splitter — a small state machine, not a parser.
//
// Used for two different, non-security purposes:
//   1. classify.ts — pre-flight UX guardrails (statement count, forbidden words)
//   2. engine.ts   — executing one statement at a time so multi-statement
//      batches can report the exact failing statement index
//
// It is NOT a validation layer and NOT a security boundary. The WASM cage and
// the worker protocol are the security boundary (plan §6.4).

export interface SqlStatement {
  /** Trimmed statement text, comments retained. */
  text: string
  /** Character offset of the statement's first character in the input. */
  start: number
}

type State = 'code' | 'string' | 'quotedIdent' | 'bracketIdent' | 'lineComment' | 'blockComment'

/**
 * Split SQL into statements on top-level semicolons. Semicolons inside string
 * literals, quoted identifiers, bracket identifiers and comments do not split.
 * Empty statements are dropped.
 */
export function splitStatements(sql: string): SqlStatement[] {
  const statements: SqlStatement[] = []
  let state: State = 'code'
  let start = 0
  let i = 0
  const n = sql.length

  const push = (end: number) => {
    const text = sql.slice(start, end).trim()
    if (text.length > 0) {
      let offset = start
      while (offset < end && /\s/.test(sql[offset])) offset += 1
      statements.push({ text, start: offset })
    }
  }

  while (i < n) {
    const ch = sql[i]
    const next = i + 1 < n ? sql[i + 1] : ''

    if (state === 'code') {
      if (ch === '-' && next === '-') { state = 'lineComment'; i += 2; continue }
      if (ch === '/' && next === '*') { state = 'blockComment'; i += 2; continue }
      if (ch === "'") { state = 'string'; i += 1; continue }
      if (ch === '"') { state = 'quotedIdent'; i += 1; continue }
      if (ch === '[') { state = 'bracketIdent'; i += 1; continue }
      if (ch === ';') { push(i); state = 'code'; i += 1; start = i; continue }
      i += 1
      continue
    }
    if (state === 'string') {
      if (ch === "'") {
        if (next === "'") { i += 2; continue } // escaped quote
        state = 'code'; i += 1; continue
      }
      i += 1; continue
    }
    if (state === 'quotedIdent') {
      if (ch === '"') {
        if (next === '"') { i += 2; continue }
        state = 'code'; i += 1; continue
      }
      i += 1; continue
    }
    if (state === 'bracketIdent') {
      if (ch === ']') { state = 'code'; i += 1; continue }
      i += 1; continue
    }
    if (state === 'lineComment') {
      if (ch === '\n') { state = 'code' }
      i += 1; continue
    }
    // blockComment
    if (ch === '*' && next === '/') { state = 'code'; i += 2; continue }
    i += 1
  }
  push(n)
  return statements
}

/**
 * Remove comments and string/identifier contents, leaving bare code. Used by
 * the classifier so a literal like 'ATTACH' never trips the forbidden-word
 * scan. Not used for execution.
 */
export function stripLiteralsAndComments(sql: string): string {
  let state: State = 'code'
  let out = ''
  let i = 0
  const n = sql.length
  while (i < n) {
    const ch = sql[i]
    const next = i + 1 < n ? sql[i + 1] : ''
    if (state === 'code') {
      if (ch === '-' && next === '-') { state = 'lineComment'; i += 2; out += ' '; continue }
      if (ch === '/' && next === '*') { state = 'blockComment'; i += 2; out += ' '; continue }
      if (ch === "'") { state = 'string'; i += 1; out += "''"; continue }
      if (ch === '"') { state = 'quotedIdent'; i += 1; out += '""'; continue }
      if (ch === '[') { state = 'bracketIdent'; i += 1; out += '[]'; continue }
      out += ch
      i += 1
      continue
    }
    if (state === 'string') {
      if (ch === "'") {
        if (next === "'") { i += 2; continue }
        state = 'code'; i += 1; out += "'"; continue
      }
      i += 1; continue
    }
    if (state === 'quotedIdent') {
      if (ch === '"') {
        if (next === '"') { i += 2; continue }
        state = 'code'; i += 1; out += '"'; continue
      }
      i += 1; continue
    }
    if (state === 'bracketIdent') {
      if (ch === ']') { state = 'code'; i += 1; out += ']'; continue }
      i += 1; continue
    }
    if (state === 'lineComment') {
      if (ch === '\n') { state = 'code'; out += '\n' }
      i += 1; continue
    }
    if (ch === '*' && next === '/') { state = 'code'; i += 2; out += ' '; continue }
    i += 1
  }
  return out
}
