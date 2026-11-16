// SQL lab browser client (Phase 6 M2). Transport only — no SQL ever leaves
// the worker; the only payloads crossing this boundary are result envelopes,
// exercise ids and the delta file bytes for bug-hunt sandboxes.

import { PracticeApiError } from '../practice/api'
import type { SqlEvaluateRequest, SqlEvaluateResponse } from '../../shared/sql'
import type { AttemptView } from '../../shared/learning'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/** Start (idempotently) an attempt on a SQL exercise. */
export async function startSqlExercise(exerciseId: string): Promise<AttemptView> {
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

/** Evaluate a result envelope for one exercise (never sends learner SQL). */
export async function evaluateSql(
  exerciseId: string,
  envelope: Omit<SqlEvaluateRequest, 'exerciseId'> & { truncated?: boolean },
): Promise<SqlEvaluateResponse> {
  const response = await fetch('/api/v1/sql/evaluate', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ exerciseId, ...envelope }),
  })
  const body = (await parseJson(response)) as (Partial<SqlEvaluateResponse> & { error?: string; message?: string }) | null
  if (!response.ok) {
    throw new PracticeApiError(
      body?.message ?? 'The result could not be evaluated.',
      response.status,
      body?.error ?? null,
    )
  }
  return body as SqlEvaluateResponse
}

/** Bug-hunt corruption delta for the active SQL hunt. */
export async function fetchHuntSeed(huntId: string): Promise<{ huntId: string; deltaSql: string }> {
  const response = await fetch(`/api/v1/sql/hunts/${encodeURIComponent(huntId)}/seed`, {
    method: 'GET',
  })
  const body = (await parseJson(response)) as { huntId?: string; deltaSql?: string; error?: string; message?: string } | null
  if (!response.ok) {
    throw new PracticeApiError(
      body?.message ?? 'The bug-hunt sandbox could not be loaded.',
      response.status,
      body?.error ?? null,
    )
  }
  return body as { huntId: string; deltaSql: string }
}
