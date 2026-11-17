// Performance metrics (final phase) — pure functions over measured samples.
// Nothing here fabricates: p90/p95/p99 are nearest-rank over the observed
// window and are reported as unavailable when the sample is smaller than 20.

import type { RunnerResult, RunnerSample } from './performanceRunner'

export interface MetricsSummary {
  totalRequests: number
  successful: number
  failed: number
  /** HTTP errors + network errors + timeouts. */
  failedRatePercent: number
  timeouts: number
  avgMs: number | null
  medianMs: number | null
  p90Ms: number | null
  p95Ms: number | null
  p99Ms: number | null
  fastestMs: number | null
  slowestMs: number | null
  /** Completed requests per second over the actual elapsed window. */
  throughputPerSecond: number
  elapsedMs: number
  statusClasses: {
    '2xx': number
    '3xx': number
    '4xx': number
    '5xx': number
    timeoutOrNetwork: number
  }
}

export const MIN_SAMPLE_FOR_TAIL_PERCENTILES = 20

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0
  }
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.max(0, rank - 1)]
}

export function summarizeSamples(samples: readonly RunnerSample[], elapsedMs: number): MetricsSummary {
  const total = samples.length
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b)
  const successful = samples.filter((sample) => sample.ok).length
  const timeouts = samples.filter((sample) => sample.timeout).length
  const failed = total - successful
  const statusClasses = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, timeoutOrNetwork: 0 }
  for (const sample of samples) {
    if (sample.status === null) {
      statusClasses.timeoutOrNetwork += 1
      continue
    }
    const cls = Math.floor(sample.status / 100)
    if (cls === 2) statusClasses['2xx'] += 1
    else if (cls === 3) statusClasses['3xx'] += 1
    else if (cls === 4) statusClasses['4xx'] += 1
    else if (cls === 5) statusClasses['5xx'] += 1
  }
  const tailOk = total >= MIN_SAMPLE_FOR_TAIL_PERCENTILES
  const avg = total === 0 ? null : Math.round((durations.reduce((sum, value) => sum + value, 0) / total) * 10) / 10
  const median = total === 0 ? null : percentile(durations, 50)
  return {
    totalRequests: total,
    successful,
    failed,
    failedRatePercent: total === 0 ? 0 : Math.round((failed / total) * 1000) / 10,
    timeouts,
    avgMs: avg,
    medianMs: median,
    p90Ms: tailOk ? percentile(durations, 90) : null,
    p95Ms: tailOk ? percentile(durations, 95) : null,
    p99Ms: tailOk ? percentile(durations, 99) : null,
    fastestMs: total === 0 ? null : durations[0],
    slowestMs: total === 0 ? null : durations[durations.length - 1],
    throughputPerSecond: elapsedMs <= 0 ? 0 : Math.round((total / (elapsedMs / 1000)) * 100) / 100,
    elapsedMs,
    statusClasses,
  }
}

function ms(value: number | null): string {
  return value === null ? 'n/a' : `${value} ms`
}

export function renderReportMarkdown(result: RunnerResult, metrics: MetricsSummary, generatedAtIso: string): string {
  const { endpoint, config } = result
  const lines = [
    '# Performance test report — QA Practice Lab',
    '',
    `- Target: \`${endpoint.label}\` (same-origin, first-party)`,
    `- Run started: ${result.startedAtIso}`,
    `- Report generated: ${generatedAtIso}`,
    '',
    '## Configuration',
    '',
    `- Virtual users: ${config.virtualUsers}`,
    `- Duration: ${config.durationSeconds}s (ramp-up ${config.rampUpSeconds}s)`,
    `- Request-rate guard: ${config.maxRps} req/s`,
    `- Per-request timeout: 5000 ms`,
    `- Total request cap: 150 (per-run safety limit)`,
    '',
    '## Measured results',
    '',
    `All values below were measured in the browser against the same-origin endpoint. They are not estimates and are not projected.`,
    '',
    `- Total requests: ${metrics.totalRequests}`,
    `- Successful: ${metrics.successful}`,
    `- Failed: ${metrics.failed} (${metrics.failedRatePercent}%)`,
    `- Timeouts: ${metrics.timeouts}`,
    `- Average response time: ${ms(metrics.avgMs)}`,
    `- Median response time: ${ms(metrics.medianMs)}`,
    `- p90: ${ms(metrics.p90Ms)}${metrics.p90Ms === null ? ` (needs ≥ ${MIN_SAMPLE_FOR_TAIL_PERCENTILES} samples)` : ''}`,
    `- p95: ${ms(metrics.p95Ms)}${metrics.p95Ms === null ? ` (needs ≥ ${MIN_SAMPLE_FOR_TAIL_PERCENTILES} samples)` : ''}`,
    `- p99: ${ms(metrics.p99Ms)}${metrics.p99Ms === null ? ` (needs ≥ ${MIN_SAMPLE_FOR_TAIL_PERCENTILES} samples)` : ''}`,
    `- Fastest / slowest: ${ms(metrics.fastestMs)} / ${ms(metrics.slowestMs)}`,
    `- Throughput: ${metrics.throughputPerSecond} req/s over ${Math.round(metrics.elapsedMs / 100) / 10}s elapsed`,
    '',
    '## Status distribution',
    '',
    `- 2xx: ${metrics.statusClasses['2xx']}`,
    `- 3xx: ${metrics.statusClasses['3xx']}`,
    `- 4xx: ${metrics.statusClasses['4xx']}`,
    `- 5xx: ${metrics.statusClasses['5xx']}`,
    `- timeout/network: ${metrics.statusClasses.timeoutOrNetwork}`,
    '',
    '## Scope and limitations',
    '',
    '- Measured client-side in one browser session against the same origin; this is not a dedicated load generator.',
    '- Browser event-loop and connection reuse affect results; treat absolute numbers as session-local, compare runs taken under identical settings.',
    `- ${result.cappedByRequestLimit ? 'The run stopped at the 150-request cap before the deadline.' : 'The run completed its configured duration.'}`,
    '- Exercise datasets in the lab are synthetic. Production capacity planning requires measurements in production-like environments.',
    '',
  ]
  return lines.join('\n')
}
