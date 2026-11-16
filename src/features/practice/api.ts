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
  AttemptView,
  BugReportSubmission,
  HintLevel,
  HintResponse,
  ProgressResponse,
  ReportSubmissionResponse,
  RevealResponse,
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

/**
 * The caller's attempt view for one hunt. Status is the server's source of
 * truth (`none` when the caller has no attempt yet). Ownership resolves from
 * the HttpOnly session cookie — no attempt id is ever sent.
 */
export async function fetchAttempt(huntId: string, signal?: AbortSignal): Promise<AttemptView> {
  const response = await fetch(`/api/v1/practice/hunts/${encodeURIComponent(huntId)}/attempt`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The attempt status could not be loaded.')
  }
  return readJson<AttemptView>(response)
}

/**
 * Unlock (or idempotently re-read) one hint level. Level N requires level
 * N−1 already used on the attempt — enforced server-side. Re-requesting an
 * unlocked level returns it again without double counting.
 */
export async function requestHint(huntId: string, level: HintLevel): Promise<HintResponse> {
  const response = await fetch(`/api/v1/practice/hunts/${encodeURIComponent(huntId)}/hints`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ level }),
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The hint could not be unlocked.')
  }
  return readJson<HintResponse>(response)
}

/**
 * Retrieve the reveal for this attempt. Available only after the server
 * authorizes it (report submitted or give-up recorded); otherwise the server
 * answers 403 `reveal_locked` and no reveal content exists on the wire.
 */
export async function fetchReveal(huntId: string, signal?: AbortSignal): Promise<RevealResponse> {
  const response = await fetch(`/api/v1/practice/hunts/${encodeURIComponent(huntId)}/reveal`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The solution could not be loaded.')
  }
  return readJson<RevealResponse>(response)
}

/**
 * The explicit, confirmed give-up path ("Show the solution"). Always requires
 * confirm: true; the server marks the attempt `revealed` (never discovered,
 * never submitted) and returns the reveal. Idempotent.
 */
export async function giveUpAndReveal(huntId: string): Promise<RevealResponse> {
  const response = await fetch(`/api/v1/practice/hunts/${encodeURIComponent(huntId)}/reveal`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The solution could not be revealed.')
  }
  return readJson<RevealResponse>(response)
}

/**
 * The caller's aggregated progress across every hunt in scope — the
 * session's own attempts, plus customer-bound attempts when signed in.
 * Ownership resolves from the HttpOnly session cookie; no attempt, report
 * or customer id is ever sent. An empty payload (not an error) is returned
 * when there is no live practice session.
 */
export async function fetchProgress(signal?: AbortSignal): Promise<ProgressResponse> {
  const response = await fetch('/api/v1/practice/progress', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw await errorFrom(response, 'Your progress could not be loaded.')
  }
  return readJson<ProgressResponse>(response)
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
