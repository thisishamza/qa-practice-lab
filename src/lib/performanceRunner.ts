// Performance runner (final phase) — bounded, same-origin, measured.
//
// Every number this produces is MEASURED in the browser with
// performance.now() against the platform's own GET endpoints. No external
// URLs are reachable (the allowlist is enforced before any fetch), no
// arbitrary targets, no unbounded concurrency:
//
//   VUs ≤ 8 · duration ≤ 30 s · ramp-up ≤ 10 s · ≤ 150 requests per run
//   · per-request timeout 5 s · requests-per-second guard (token bucket)
//
// The runner stops at the request cap or the deadline, whichever comes
// first. Nothing is persisted server-side; run history lives in this
// browser's localStorage only (the component labels it as such).

export interface PerformanceEndpoint {
  id: string
  label: string
  path: string
  note: string
}

export const PERFORMANCE_ENDPOINTS: readonly PerformanceEndpoint[] = [
  { id: 'health', label: 'GET /api/health', path: '/api/health', note: 'Infrastructure liveness — the cheapest target.' },
  { id: 'products', label: 'GET /api/v1/products', path: '/api/v1/products', note: 'Full catalogue page (12 items).' },
  { id: 'products-small', label: 'GET /api/v1/products?perPage=4', path: '/api/v1/products?perPage=4', note: 'Small list payload.' },
  { id: 'categories', label: 'GET /api/v1/categories', path: '/api/v1/categories', note: 'Small read-only list.' },
  { id: 'cart', label: 'GET /api/v1/cart', path: '/api/v1/cart', note: 'Session-scoped cart; may be empty.' },
]

export interface RunnerConfig {
  endpointId: string
  virtualUsers: number
  durationSeconds: number
  rampUpSeconds: number
  maxRps: number
}

export const RUNNER_LIMITS = {
  maxVus: 8,
  maxDurationSeconds: 30,
  maxRampUpSeconds: 10,
  maxRequests: 150,
  requestTimeoutMs: 5000,
  maxRpsCeiling: 100,
} as const

export interface RunnerSample {
  /** ms since the run started (performance.now() base). */
  startedAt: number
  durationMs: number
  ok: boolean
  /** null for network errors / timeouts. */
  status: number | null
  timeout: boolean
  error: string | null
}

export interface RunnerResult {
  endpoint: PerformanceEndpoint
  config: RunnerConfig
  samples: RunnerSample[]
  elapsedMs: number
  startedAtIso: string
  cappedByRequestLimit: boolean
}

export function resolveEndpoint(id: string): PerformanceEndpoint | null {
  return PERFORMANCE_ENDPOINTS.find((endpoint) => endpoint.id === id) ?? null
}

export function validateConfig(config: RunnerConfig): string | null {
  if (!resolveEndpoint(config.endpointId)) {
    return 'Choose one of the allowlisted endpoints.'
  }
  if (!Number.isInteger(config.virtualUsers) || config.virtualUsers < 1 || config.virtualUsers > RUNNER_LIMITS.maxVus) {
    return `Virtual users must be an integer between 1 and ${RUNNER_LIMITS.maxVus}.`
  }
  if (!Number.isFinite(config.durationSeconds) || config.durationSeconds < 5 || config.durationSeconds > RUNNER_LIMITS.maxDurationSeconds) {
    return `Duration must be between 5 and ${RUNNER_LIMITS.maxDurationSeconds} seconds.`
  }
  if (!Number.isFinite(config.rampUpSeconds) || config.rampUpSeconds < 0 || config.rampUpSeconds > RUNNER_LIMITS.maxRampUpSeconds) {
    return `Ramp-up must be between 0 and ${RUNNER_LIMITS.maxRampUpSeconds} seconds.`
  }
  if (!Number.isInteger(config.maxRps) || config.maxRps < 1 || config.maxRps > RUNNER_LIMITS.maxRpsCeiling) {
    return `Request rate must be an integer between 1 and ${RUNNER_LIMITS.maxRpsCeiling} per second.`
  }
  return null
}

export interface RunHooks {
  /** Called after every completed request (for live progress). */
  onSample?: (sample: RunnerSample, total: number) => void
  /** Cooperative cancellation from the UI. */
  signal?: AbortSignal
}

const NEXT_SLOT = { next: 0 }

async function nextSlot(rps: number, state: { next: number }): Promise<void> {
  const spacing = 1000 / rps
  const now = performance.now()
  const target = Math.max(now, state.next)
  state.next = target + spacing
  if (target <= now) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, target - now))
}

/**
 * Execute the run. Resolves with the raw samples; never throws for
 * request-level failures (those are recorded as samples). Throws only for
 * programmer errors (invalid config, unknown endpoint).
 */
export async function runLoadTest(config: RunnerConfig, hooks: RunHooks = {}): Promise<RunnerResult> {
  const problem = validateConfig(config)
  if (problem) {
    throw new Error(problem)
  }
  const endpoint = resolveEndpoint(config.endpointId)!
  const timeoutMs = RUNNER_LIMITS.requestTimeoutMs
  const totalMs = config.durationSeconds * 1000
  const samples: RunnerSample[] = []
  const bucket = { ...NEXT_SLOT, next: 0 }
  const startedAtIso = new Date().toISOString()
  const startedAt = performance.now()
  const deadline = startedAt + totalMs
  let stop = false

  async function virtualUser(vuIndex: number): Promise<void> {
    // Stagger VU starts across the ramp-up window.
    const stagger =
      config.virtualUsers <= 1
        ? 0
        : (config.rampUpSeconds * 1000 * vuIndex) / (config.virtualUsers - 1)
    if (stagger > 0) {
      await new Promise((resolve) => setTimeout(resolve, stagger))
    }
    while (!stop && performance.now() < deadline) {
      if (samples.length >= RUNNER_LIMITS.maxRequests) {
        stop = true
        return
      }
      if (hooks.signal?.aborted) {
        stop = true
        return
      }
      await nextSlot(config.maxRps, bucket)
      if (performance.now() >= deadline || stop) {
        return
      }
      const requestStart = performance.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(endpoint.path, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })
        clearTimeout(timer)
        const duration = performance.now() - requestStart
        const sample: RunnerSample = {
          startedAt: requestStart - startedAt,
          durationMs: Math.round(duration * 10) / 10,
          ok: response.ok,
          status: response.status,
          timeout: false,
          error: response.ok ? null : `HTTP ${response.status}`,
        }
        samples.push(sample)
        hooks.onSample?.(sample, samples.length)
      } catch (error) {
        clearTimeout(timer)
        const duration = performance.now() - requestStart
        const aborted = error instanceof DOMException && error.name === 'AbortError'
        const sample: RunnerSample = {
          startedAt: requestStart - startedAt,
          durationMs: Math.round(duration * 10) / 10,
          ok: false,
          status: null,
          timeout: aborted,
          error: aborted ? 'timeout' : 'network error',
        }
        samples.push(sample)
        hooks.onSample?.(sample, samples.length)
      }
    }
  }

  await Promise.all(Array.from({ length: config.virtualUsers }, (_, index) => virtualUser(index)))

  const finishedAt = performance.now()
  return {
    endpoint,
    config: { ...config },
    samples,
    elapsedMs: Math.round((finishedAt - startedAt) * 10) / 10,
    startedAtIso,
    cappedByRequestLimit: samples.length >= RUNNER_LIMITS.maxRequests,
  }
}
