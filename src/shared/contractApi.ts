// Request/response types for the four Phase 7 contract endpoints
// (`/api/v1/contract/*`) — shared by the server and the browser api clients.
// Assertions travel as ContractAssertion (src/shared/contractTypes.ts).

import type {
  CompatibilityFinding,
  ContractAssertion,
  ContractEvaluateResponse,
  ContractVerdict,
} from './contractTypes'

export type { CompatibilityFinding, ContractAssertion, ContractEvaluateResponse, ContractVerdict }

export type ContractLocus = 'request' | 'response'

// ---- POST /api/v1/contract/validate ----------------------------------------
export interface ContractValidateRequest {
  fixtureId: string
  operationId?: string
  payload: unknown
}
export interface ContractValidateResponse {
  fixtureId: string
  operationId: string
  locus: ContractLocus | 'both'
  valid: boolean
  assertions: ContractAssertion[]
}

// ---- POST /api/v1/contract/compare -----------------------------------------
export interface ContractCompareByFixture {
  baseFixtureId: string
  locus: ContractLocus
  candidateFixtureId: string
  candidateSchema?: never
}
export interface ContractCompareInline {
  baseFixtureId: string
  locus: ContractLocus
  candidateSchema: unknown
  candidateFixtureId?: never
}
export type ContractCompareRequest = ContractCompareByFixture | ContractCompareInline
export interface ContractCompareResponse {
  baseFixtureId: string
  candidateFixtureId?: string
  locus: ContractLocus
  verdict: ContractVerdict
  findings: CompatibilityFinding[]
}

// ---- POST /api/v1/contract/verify-consumer ---------------------------------
export interface ContractVerifyConsumerRequest {
  expectation: unknown
  providerFixtureId:
    | 'provider-product-v1'
    | 'provider-product-v2-compatible'
    | 'provider-product-v2-drift'
    | 'provider-product-v2-latest'
}
export interface ContractVerifyConsumerResponse {
  valid: boolean
  statusOk: boolean
  assertions: ContractAssertion[]
  mismatchSummary?: string
}

// ---- POST /api/v1/contract/evaluate ----------------------------------------
export type ContractEvaluateAnswer =
  | { kind: 'validate'; selections?: string[]; payload?: unknown }
  | { kind: 'compare'; classifications: Record<string, string>; choices?: Record<string, string> }
  | { kind: 'consumer'; expectation: unknown }
  | { kind: 'structured'; selections: string[] }
export interface ContractEvaluateRequest {
  exerciseId: string
  answer: ContractEvaluateAnswer
}
