// Pre-flight classifier — advisory UX guardrails only (plan §6.4).
//
// NOT a security boundary. It gives the learner fast, specific feedback and
// protects the worker from pathological batches. The actual containment is
// the WASM cage + the worker protocol. Forbidden-word matches on
// comment/string/identifier-stripped SQL only — a literal like 'ATTACH' is
// never flagged.

import { SQL_LIMITS } from '../../shared/sql'
import { splitStatements, stripLiteralsAndComments } from './statements'

export interface Classification {
  ok: boolean
  /** Non-empty statements found. */
  statementCount: number
  /** Ids of forbidden constructs found (empty when ok). */
  forbidden: string[]
  /** Human-readable issues (length, count, forbidden). Empty when ok. */
  issues: string[]
}

interface ForbiddenRule {
  id: string
  pattern: RegExp
  message: string
}

const FORBIDDEN: readonly ForbiddenRule[] = [
  { id: 'attach', pattern: /\battach\b/i, message: 'ATTACH is not available — the practice database lives entirely in this page.' },
  { id: 'detach', pattern: /\bdetach\b/i, message: 'DETACH is not available — there is nothing to detach.' },
  { id: 'vacuum-into', pattern: /\bvacuum\s+into\b/i, message: 'VACUUM INTO would write a file; only the in-memory practice database exists.' },
  { id: 'writable-schema', pattern: /\bwritable_schema\b/i, message: 'writable_schema can corrupt the database and is blocked.' },
  { id: 'load-extension', pattern: /\bload_extension\s*\(/i, message: 'Extensions cannot be loaded in the practice sandbox.' },
]

export function classify(sql: string): Classification {
  const issues: string[] = []
  const forbidden: string[] = []

  if (sql.length > SQL_LIMITS.maxQueryLength) {
    issues.push(`Query exceeds the ${Math.round(SQL_LIMITS.maxQueryLength / 1024)} KB limit.`)
  }

  const stripped = stripLiteralsAndComments(sql)
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(stripped)) {
      forbidden.push(rule.id)
      issues.push(rule.message)
    }
  }

  const statementCount = splitStatements(sql).length
  if (statementCount > SQL_LIMITS.maxStatementsPerRun) {
    issues.push(`Too many statements — ${statementCount} found, at most ${SQL_LIMITS.maxStatementsPerRun} per run.`)
  }

  return { ok: issues.length === 0, statementCount, forbidden, issues }
}
