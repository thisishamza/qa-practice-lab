// Shared contract-testing types (Phase 7, plan §4.7, §5) — browser + server.
//
// The assertion model is deliberately small and learner-safe: a path
// (JSON Pointer), the failing JSON Schema keyword, a short expected and
// actual rendering, and a specific message free of fixture internals.

export type ContractLocus = 'request' | 'response'

export type ContractVerdict = 'breaking' | 'review' | 'compatible'

export type RuleClassification = ContractVerdict

export interface ContractAssertion {
  /** JSON Pointer into the payload (`/` for the root). */
  path: string
  /** The JSON Schema keyword that failed (`type`, `enum`, `required`, ...). */
  keyword: string
  /** Short expected rendering (e.g. `integer`, `USD`, `required`). */
  expected: string
  /** Short actual rendering of the offending value (truncated). */
  actual: string
  /** Specific, learner-safe, compile-time-authored message. */
  message: string
}

export interface CompatibilityFinding {
  /** Rule id from the plan's §4.4 table (`R1`…`R21`). */
  rule: string
  /** JSON Pointer of the schema location the finding is about. */
  path: string
  locus: ContractLocus
  classification: RuleClassification
  /** One-line change description (`amountCents: integer → string`). */
  change: string
  consumerImpact: string
  providerImpact: string
}

export interface ContractDiffResult {
  verdict: ContractVerdict
  findings: CompatibilityFinding[]
}

export interface ContractEvaluationCheck {
  id: string
  passed: boolean
  message: string
  /** Points awarded when the check passes (checks sum to 100). */
  points: number
}

export type ContractAttemptStatus = 'in_progress' | 'submitted' | 'revealed' | 'none'

export interface ContractEvaluateResponse {
  passed: boolean
  score: number
  checks: ContractEvaluationCheck[]
  feedback: string
  attemptStatus: ContractAttemptStatus
}
