// Pure logic for the in-browser API Lab console (`/api-lab`, P5-M1).
//
// Security posture (belt and braces on top of the browser's same-origin
// model): the console can only ever issue requests to this origin's
// `/api/v1` namespace. Absolute URLs, non-`/api/v1` paths, scheme-prefixed
// strings, `..` segments and control characters are refused before any
// fetch happens. Response bodies are treated as untrusted text, clipped to
// a hard byte cap, and never rendered as HTML.
//
// Everything here is pure and unit-tested; the React layer only wires
// these functions to the UI.

export const MAX_BODY_DISPLAY_BYTES = 64 * 1024
export const HISTORY_LIMIT = 10
const MAX_QUERY_LENGTH = 512
const MAX_HEADER_VALUE_LENGTH = 2048

export const CONSOLE_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const
export type ConsoleMethod = (typeof CONSOLE_METHODS)[number]

export interface HeaderRow {
  id: string
  name: string
  value: string
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/
// Deliberate: rejecting C0/C1 control characters is the security control.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_PATTERN = /[\u0000-\u001f\u007f-\u009f]/
const PATH_PATTERN = /^\/api\/v1(\/|$)/

/**
 * Validates the path portion of a console request. Accepts only
 * same-origin `/api/v1` paths; everything else is refused with a
 * learner-friendly reason.
 */
export function validatePath(raw: string): ValidationResult<string> {
  const path = raw.trim()
  if (path.length === 0) {
    return { ok: false, error: 'Enter a path, such as /api/v1/products.' }
  }
  if (SCHEME_PATTERN.test(path) || path.startsWith('//')) {
    return {
      ok: false,
      error: 'Only this app’s /api/v1 endpoints can be called from the console.',
    }
  }
  if (CONTROL_CHARS_PATTERN.test(path) || /\s/.test(path)) {
    return { ok: false, error: 'Paths must not contain whitespace or control characters.' }
  }
  if (path.includes('?') || path.includes('#')) {
    return { ok: false, error: 'Put the query string in the query field, not in the path.' }
  }
  if (path.includes('\\')) {
    return { ok: false, error: 'Paths must use forward slashes.' }
  }
  if (!PATH_PATTERN.test(path)) {
    return {
      ok: false,
      error: 'The console can only call this origin’s /api/v1 endpoints.',
    }
  }
  const segments = path.split('/')
  if (segments.includes('..')) {
    return { ok: false, error: 'Paths must not contain “..” segments.' }
  }
  return { ok: true, value: path }
}

/** Validates the raw query string (without the leading `?`). */
export function validateQuery(raw: string): ValidationResult<string> {
  const query = raw.trim().replace(/^\?/, '')
  if (query.length === 0) {
    return { ok: true, value: '' }
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `Query strings are limited to ${MAX_QUERY_LENGTH} characters.` }
  }
  if (CONTROL_CHARS_PATTERN.test(query)) {
    return { ok: false, error: 'The query string must not contain control characters.' }
  }
  if (/\s/.test(query)) {
    return { ok: false, error: 'Encode spaces in the query string as %20.' }
  }
  return { ok: true, value: query }
}

/** RFC 7230 token characters for a header field-name. */
export const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export interface HeaderValidationIssue {
  rowId: string
  message: string
}

/**
 * Validates header rows and reduces them to a name → value record.
 * Fully-empty rows are skipped; rows with a value but no name are an
 * error; CR/LF in names or values is an error (header injection).
 * Duplicate names (case-insensitive) resolve to the last row, matching
 * common client behaviour.
 */
export function buildHeaders(rows: readonly HeaderRow[]): {
  headers: Record<string, string>
  issues: HeaderValidationIssue[]
} {
  const issues: HeaderValidationIssue[] = []
  const byLower = new Map<string, { name: string; value: string }>()

  for (const row of rows) {
    const name = row.name.trim()
    const value = row.value.trim()
    if (name === '' && value === '') {
      continue
    }
    if (name === '') {
      issues.push({ rowId: row.id, message: 'This header row has a value but no name.' })
      continue
    }
    if (!HEADER_NAME_PATTERN.test(name)) {
      issues.push({ rowId: row.id, message: `"${name}" is not a valid header name.` })
      continue
    }
    if (CONTROL_CHARS_PATTERN.test(value) || /[\r\n]/.test(value)) {
      issues.push({ rowId: row.id, message: `The value for "${name}" contains control characters.` })
      continue
    }
    if (value.length > MAX_HEADER_VALUE_LENGTH) {
      issues.push({
        rowId: row.id,
        message: `The value for "${name}" exceeds ${MAX_HEADER_VALUE_LENGTH} characters.`,
      })
      continue
    }
    byLower.set(name.toLowerCase(), { name, value })
  }

  const headers: Record<string, string> = {}
  for (const { name, value } of byLower.values()) {
    headers[name] = value
  }
  return { headers, issues }
}

/** Joins a validated path and query into the request target. */
export function buildRequestTarget(path: string, query: string): string {
  return query.length > 0 ? `${path}?${query}` : path
}

/**
 * Final belt-and-braces check before fetch: the target must resolve to
 * this origin and stay inside /api/v1. `target` is a relative path built
 * by `buildRequestTarget`; `origin` is `window.location.origin`.
 */
export function assertSameOriginApiUrl(
  target: string,
  origin: string,
): ValidationResult<string> {
  let url: URL
  try {
    url = new URL(target, origin)
  } catch {
    return { ok: false, error: 'That path does not form a valid URL.' }
  }
  if (url.origin !== origin) {
    return { ok: false, error: 'The console can only call this origin.' }
  }
  if (
    url.pathname !== '/api/v1' &&
    !url.pathname.startsWith('/api/v1/')
  ) {
    return { ok: false, error: 'The console can only call this origin’s /api/v1 endpoints.' }
  }
  return { ok: true, value: url.href }
}

/** Bodies are only offered for these methods. */
export function methodAllowsBody(method: ConsoleMethod): boolean {
  return method === 'POST' || method === 'PATCH'
}

/** Single-quote a value for POSIX shells. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export interface CurlInput {
  method: ConsoleMethod
  origin: string
  path: string
  query: string
  headers: Record<string, string>
  body: string
}

/**
 * Builds the copyable curl equivalent of one console request. The URL is
 * absolute (origin + target) because curl has no ambient origin.
 */
export function buildCurlCommand(input: CurlInput): string {
  const target = buildRequestTarget(input.path, input.query)
  const url = `${input.origin}${target}`
  const parts = [`curl -i -X ${input.method} ${shellQuote(url)}`]
  for (const [name, value] of Object.entries(input.headers)) {
    parts.push(`-H ${shellQuote(`${name}: ${value}`)}`)
  }
  const body = input.body.trim()
  if (methodAllowsBody(input.method) && body.length > 0) {
    parts.push(`--data-raw ${shellQuote(input.body)}`)
  }
  return parts.join(' ')
}

export interface ClippedBody {
  text: string
  clipped: boolean
  byteLength: number
}

/** Clips a decoded string to `maxBytes` of UTF-8 (display cap). */
export function clipBody(body: string, maxBytes = MAX_BODY_DISPLAY_BYTES): ClippedBody {
  const bytes = new TextEncoder().encode(body)
  if (bytes.length <= maxBytes) {
    return { text: body, clipped: false, byteLength: bytes.length }
  }
  const slice = bytes.subarray(0, maxBytes)
  return {
    text: new TextDecoder().decode(slice),
    clipped: true,
    byteLength: bytes.length,
  }
}

/**
 * Reads a response body with a hard byte cap. Bodies at or under the cap
 * are returned whole; larger bodies are cancelled mid-stream and returned
 * clipped with `clipped: true`. Byte length of what was read is reported;
 * after an early cancel it is a lower bound.
 */
export async function readCappedText(
  response: Response,
  maxBytes = MAX_BODY_DISPLAY_BYTES,
): Promise<ClippedBody> {
  if (!response.body) {
    const text = await response.text()
    return clipBody(text, maxBytes)
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  let clipped = false
  for (;;) {
    if (received >= maxBytes) {
      clipped = true
      break
    }
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (value) {
      chunks.push(value)
      received += value.byteLength
    }
  }
  if (clipped) {
    await reader.cancel().catch(() => undefined)
  }
  const merged = new Uint8Array(Math.min(received, maxBytes))
  let offset = 0
  for (const chunk of chunks) {
    const remaining = merged.byteLength - offset
    if (remaining <= 0) {
      break
    }
    const slice = chunk.subarray(0, remaining)
    merged.set(slice, offset)
    offset += slice.byteLength
  }
  return {
    text: new TextDecoder().decode(merged),
    clipped,
    byteLength: merged.byteLength,
  }
}

/** Pretty-prints JSON bodies; everything else is returned as-is. */
export function tryPrettyJson(body: string): { pretty: boolean; text: string } {
  const trimmed = body.trim()
  if (trimmed.length > 0 && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
    try {
      return { pretty: true, text: JSON.stringify(JSON.parse(trimmed), null, 2) }
    } catch {
      // fall through — not valid JSON after all
    }
  }
  return { pretty: false, text: body }
}

/** Finds a content-type header case-insensitively, if present. */
export function contentTypeOf(headers: Record<string, string>): string | undefined {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'content-type') {
      return value.toLowerCase()
    }
  }
  return undefined
}

export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return '0 ms'
  }
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`
}

export interface HistoryEntry {
  id: string
  method: ConsoleMethod
  target: string
  status: number
  elapsedMs: number
  at: number
}

/** Newest-first, capped. Component state only — never persisted. */
export function addHistoryEntry(
  entries: readonly HistoryEntry[],
  entry: HistoryEntry,
  limit = HISTORY_LIMIT,
): HistoryEntry[] {
  return [entry, ...entries].slice(0, limit)
}

/** Empty header row factory (ids are supplied by the caller). */
export function emptyHeaderRow(id: string): HeaderRow {
  return { id, name: '', value: '' }
}
