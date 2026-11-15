// Fetch helpers for the practice-session mode engine (P3-M7).
// Errors surface as typed results so pages can render honest states; nothing
// here invents session state client-side. The mode is decided by the server
// from the HttpOnly `mpl_session` cookie — never from browser storage.

import type { PracticeSessionResponse } from '../../shared/practice'

export class PracticeApiError extends Error {
  readonly status: number
  /** Machine-readable code from the server envelope, when present. */
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'PracticeApiError'
    this.status = status
    this.code = code
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new PracticeApiError('The server returned an unreadable response.', response.status)
  }
}

async function errorFrom(response: Response, fallback: string): Promise<PracticeApiError> {
  const body = await readJson<{ message?: string; error?: string }>(response).catch(() => null)
  return new PracticeApiError(
    typeof body?.message === 'string' ? body.message : fallback,
    response.status,
    typeof body?.error === 'string' ? body.error : null,
  )
}

export async function fetchPracticeSession(signal?: AbortSignal): Promise<PracticeSessionResponse> {
  const response = await fetch('/api/v1/practice/session', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The practice mode could not be loaded.')
  }
  return readJson<PracticeSessionResponse>(response)
}

export async function startHunt(huntId: string): Promise<PracticeSessionResponse> {
  const response = await fetch(`/api/v1/practice/hunts/${encodeURIComponent(huntId)}/start`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The hunt could not be started.')
  }
  return readJson<PracticeSessionResponse>(response)
}

export async function resetPracticeSession(): Promise<PracticeSessionResponse> {
  const response = await fetch('/api/v1/practice/session/reset', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The practice session could not be reset.')
  }
  return readJson<PracticeSessionResponse>(response)
}
