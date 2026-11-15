// Fetch helpers for the practice-session mode engine (P3-M7).
// Errors surface as typed results so pages can render honest states; nothing
// here invents session state client-side. The mode is decided by the server
// from the HttpOnly `mpl_session` cookie — never from browser storage.

import type {
  HuntListResponse,
  HuntSummary,
  PracticeSessionResponse,
} from '../../shared/practice'
import type {
  BugReportSubmission,
  ReportSubmissionResponse,
} from '../../shared/learning'

export class PracticeApiError extends Error {
  readonly status: number
  /** Machine-readable code from the server envelope, when present. */
  readonly code: string | null
  /** Per-field validation messages, when the server returned them (400). */
  readonly fields: Record<string, string> | null

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    fields: Record<string, string> | null = null,
  ) {
    super(message)
    this.name = 'PracticeApiError'
    this.status = status
    this.code = code
    this.fields = fields
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
  const body = await readJson<{ message?: string; error?: string; fields?: Record<string, string> }>(
    response,
  ).catch(() => null)
  return new PracticeApiError(
    typeof body?.message === 'string' ? body.message : fallback,
    response.status,
    typeof body?.error === 'string' ? body.error : null,
    body?.fields && typeof body.fields === 'object' ? body.fields : null,
  )
}

export async function fetchPracticeHunts(signal?: AbortSignal): Promise<HuntSummary[]> {
  const response = await fetch('/api/v1/practice/hunts', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The available hunts could not be loaded.')
  }
  const body = await readJson<HuntListResponse>(response)
  return Array.isArray(body.data) ? body.data : []
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

/**
 * Submit a structured bug report for a hunt. The report is evaluated
 * synchronously server-side; ownership resolves from the HttpOnly session
 * cookie — the client never sends an attempt id, defect id, score or any
 * feedback field. Errors surface as PracticeApiError with the server's
 * per-field `fields` attached on 400 responses.
 */
export async function submitReport(
  huntId: string,
  submission: BugReportSubmission,
): Promise<ReportSubmissionResponse> {
  const response = await fetch(`/api/v1/practice/hunts/${encodeURIComponent(huntId)}/report`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(submission),
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The report could not be submitted.')
  }
  return readJson<ReportSubmissionResponse>(response)
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
