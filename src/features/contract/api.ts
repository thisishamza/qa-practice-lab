// Contract lab browser client (Phase 7). Transport only — every scored
// decision is made server-side; the browser renders what the server says.
// Validation runs in-browser through the shared wrapper for instant
// feedback, but scores come only from POST /api/v1/contract/evaluate.

import { PracticeApiError } from '../practice/api'
import type {
  ContractCompareRequest,
  ContractCompareResponse,
  ContractEvaluateRequest,
  ContractEvaluateResponse,
  ContractValidateRequest,
  ContractValidateResponse,
  ContractVerifyConsumerRequest,
  ContractVerifyConsumerResponse,
} from '../../shared/contractApi'
import type { AttemptView } from '../../shared/learning'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function postJson<TResponse>(
  url: string,
  body: unknown,
  fallback: string,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
  const parsed = (await parseJson(response)) as
    | (Partial<TResponse> & { error?: string; message?: string })
    | null
  if (!response.ok) {
    throw new PracticeApiError(
      (typeof parsed?.message === 'string' && parsed.message) || fallback,
      response.status,
      typeof parsed?.error === 'string' ? parsed.error : null,
    )
  }
  return parsed as TResponse
}

/** Start (idempotently) an attempt on a practice exercise — shared with SQL exercises. */
export async function startContractExercise(exerciseId: string): Promise<AttemptView> {
  const response = await fetch(`/api/v1/sql/exercises/${encodeURIComponent(exerciseId)}/start`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: '{}',
  })
  const body = (await parseJson(response)) as { attempt?: AttemptView; error?: string; message?: string } | null
  if (!response.ok) {
    throw new PracticeApiError(
      body?.message ?? 'The exercise could not be started.',
      response.status,
      body?.error ?? null,
    )
  }
  return (body as { attempt: AttemptView }).attempt
}

/** Exploratory validation against a fixture (never scored). */
export async function validateContract(
  request: ContractValidateRequest,
): Promise<ContractValidateResponse> {
  return postJson('/api/v1/contract/validate', request, 'The payload could not be validated.')
}

/** Diff two contract versions (named pair or inline candidate). */
export async function compareContracts(
  request: ContractCompareRequest,
): Promise<ContractCompareResponse> {
  return postJson('/api/v1/contract/compare', request, 'The contracts could not be compared.')
}

/** Verify a consumer expectation against a canned provider fixture. */
export async function verifyConsumer(
  request: ContractVerifyConsumerRequest,
): Promise<ContractVerifyConsumerResponse> {
  return postJson(
    '/api/v1/contract/verify-consumer',
    request,
    'The expectation could not be verified.',
  )
}

/** Scored evaluation of one exercise answer (pass ≥ 70). */
export async function evaluateContract(
  request: ContractEvaluateRequest,
): Promise<ContractEvaluateResponse> {
  return postJson(
    '/api/v1/contract/evaluate',
    request,
    'The answer could not be evaluated.',
  )
}
