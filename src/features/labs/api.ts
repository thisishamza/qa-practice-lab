// Browser client for the lab evaluation endpoint (final phase). Transport
// only — every scored decision is made server-side.

import { PracticeApiError } from '../practice/api'
import type { AttemptView } from '../../shared/learning'

export interface LabEvaluationCheck {
  id: string
  passed: boolean
  message: string
  points: number
}

export interface LabEvaluateResponse {
  passed: boolean
  score: number
  checks: LabEvaluationCheck[]
  feedback: string
  attemptStatus: 'in_progress' | 'submitted' | 'revealed' | 'none'
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Start (idempotently) an attempt on a lab exercise — same path as SQL/contract exercises. */
export async function startLabExercise(exerciseId: string): Promise<AttemptView> {
  const response = await fetch(`/api/v1/sql/exercises/${encodeURIComponent(exerciseId)}/start`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: '{}',
  })
  const body = (await response.json().catch(() => null)) as
    | { attempt?: AttemptView; message?: string; error?: string }
    | null
  if (!response.ok || !body?.attempt) {
    throw new PracticeApiError(
      body?.message ?? 'The exercise could not be started.',
      response.status,
      body?.error ?? null,
    )
  }
  return body.attempt
}

/** Score a selections answer server-side. */
export async function evaluateLab(
  exerciseId: string,
  selections: string[],
): Promise<LabEvaluateResponse> {
  const response = await fetch('/api/v1/labs/evaluate', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ exerciseId, selections }),
  })
  const body = (await response.json().catch(() => null)) as
    | (Partial<LabEvaluateResponse> & { error?: string; message?: string })
    | null
  if (!response.ok) {
    throw new PracticeApiError(
      body?.message ?? 'The answer could not be evaluated.',
      response.status,
      body?.error ?? null,
    )
  }
  return body as LabEvaluateResponse
}
