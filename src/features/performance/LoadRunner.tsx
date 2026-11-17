import { useCallback, useRef, useState } from 'react'
import {
  RUNNER_LIMITS,
  PERFORMANCE_ENDPOINTS,
  resolveEndpoint,
  runLoadTest,
  validateConfig,
  type RunnerResult,
} from '../../lib/performanceRunner'
import {
  MIN_SAMPLE_FOR_TAIL_PERCENTILES,
  renderReportMarkdown,
  summarizeSamples,
  type MetricsSummary,
} from '../../lib/performanceMetrics'

const STORAGE_KEY = 'qa-practice-lab-perf-runs'

interface StoredRun {
  id: string
  label: string
  savedAt: string
  metrics: MetricsSummary
}

type HistoryState = 'idle' | 'ready'

function formatMs(value: number | null): string {
  return value === null ? 'n/a' : `${value} ms`
}

function Bar({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100)
  return (
    <div className="sim-bar" role="img" aria-label={`${label}: ${pct}%`}>
      <div className="sim-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

function percentileContext(metrics: MetricsSummary): string {
  if (metrics.totalRequests >= MIN_SAMPLE_FOR_TAIL_PERCENTILES) {
    return `Tail percentiles computed over n = ${metrics.totalRequests} samples (nearest-rank).`
  }
  return `n = ${metrics.totalRequests} — fewer than ${MIN_SAMPLE_FOR_TAIL_PERCENTILES} samples, so p90/p95/p99 are reported as n/a rather than estimated.`
}

export function LoadRunner() {
  const [endpointId, setEndpointId] = useState('products')
  const [virtualUsers, setVirtualUsers] = useState(2)
  const [durationSeconds, setDurationSeconds] = useState(10)
  const [rampUpSeconds, setRampUpSeconds] = useState(2)
  const [maxRps, setMaxRps] = useState(20)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RunnerResult | null>(null)
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  // Load this-browser history once, lazily (no effect → no cascading render).
  const [history, setHistory] = useState<StoredRun[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return []
      }
      const parsed = JSON.parse(raw) as StoredRun[]
      return Array.isArray(parsed) ? parsed.slice(0, 5) : []
    } catch {
      return []
    }
  })
  const [historyState] = useState<HistoryState>('ready')
  const abortRef = useRef<AbortController | null>(null)

  const persistRun = useCallback((run: RunnerResult, summary: MetricsSummary) => {
    const entry: StoredRun = {
      id: `run-${Date.now()}`,
      label: `${run.endpoint.label} · ${run.config.virtualUsers} VU · ${run.config.durationSeconds}s`,
      savedAt: new Date().toISOString(),
      metrics: summary,
    }
    setHistory((current) => {
      const next = [entry, ...current].slice(0, 5)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage may be unavailable (private mode) — history is a convenience, never a requirement.
      }
      return next
    })
  }, [])

  const onRun = useCallback(async () => {
    setError(null)
    const config = {
      endpointId,
      virtualUsers,
      durationSeconds,
      rampUpSeconds,
      maxRps,
    }
    const problem = validateConfig(config)
    if (problem) {
      setError(problem)
      return
    }
    setRunning(true)
    setProgress(0)
    setResult(null)
    setMetrics(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const run = await runLoadTest(config, { signal: controller.signal, onSample: (_sample, total) => setProgress(total) })
      const summary = summarizeSamples(run.samples, run.elapsedMs)
      setResult(run)
      setMetrics(summary)
      persistRun(run, summary)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The run could not be completed.')
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }, [endpointId, virtualUsers, durationSeconds, rampUpSeconds, maxRps, persistRun])

  const onStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const onDownloadReport = useCallback(() => {
    if (!result || !metrics) return
    const markdown = renderReportMarkdown(result, metrics, new Date().toISOString())
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `performance-report-${result.endpoint.id}-${Date.now()}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [result, metrics])

  const onClearHistory = useCallback(() => {
    setHistory([])
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore — nothing to clean up that matters
    }
  }, [])

  const endpoint = resolveEndpoint(endpointId)
  const successFraction = metrics && metrics.totalRequests > 0 ? metrics.successful / metrics.totalRequests : 0
  const errorFraction = metrics && metrics.totalRequests > 0 ? metrics.failed / metrics.totalRequests : 0
  const maxStatus = metrics ? Math.max(1, ...Object.values(metrics.statusClasses)) : 1

  return (
    <div className="stack">
      {/* ---------------------- Configuration ---------------------- */}
      <section className="workspace-panel" aria-labelledby="runner-config-title">
        <div className="workspace-head">
          <h2 id="runner-config-title" className="workspace-title">Workload configuration</h2>
          <span className="workspace-status">caps: {RUNNER_LIMITS.maxVus} VUs · {RUNNER_LIMITS.maxDurationSeconds}s · {RUNNER_LIMITS.maxRequests} req</span>
        </div>
        <div className="workspace-body">
          <label className="contract-field" htmlFor="runner-endpoint">
            <span className="contract-field-label">Allowlisted endpoint (first-party only)</span>
            <select id="runner-endpoint" className="contract-select" value={endpointId} onChange={(event) => setEndpointId(event.target.value)} disabled={running}>
              {PERFORMANCE_ENDPOINTS.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          </label>
          <p className="panel-note">{endpoint?.note}</p>
          <div className="sim-controls">
            <label className="contract-field sim-control">
              <span className="contract-field-label">Virtual users (1–{RUNNER_LIMITS.maxVus}): <strong>{virtualUsers}</strong></span>
              <input type="range" min={1} max={RUNNER_LIMITS.maxVus} step={1} value={virtualUsers} disabled={running} onChange={(event) => setVirtualUsers(Number(event.target.value))} />
            </label>
            <label className="contract-field sim-control">
              <span className="contract-field-label">Duration (5–{RUNNER_LIMITS.maxDurationSeconds}s): <strong>{durationSeconds}s</strong></span>
              <input type="range" min={5} max={RUNNER_LIMITS.maxDurationSeconds} step={1} value={durationSeconds} disabled={running} onChange={(event) => setDurationSeconds(Number(event.target.value))} />
            </label>
            <label className="contract-field sim-control">
              <span className="contract-field-label">Ramp-up (0–{RUNNER_LIMITS.maxRampUpSeconds}s): <strong>{rampUpSeconds}s</strong></span>
              <input type="range" min={0} max={RUNNER_LIMITS.maxRampUpSeconds} step={1} value={rampUpSeconds} disabled={running} onChange={(event) => setRampUpSeconds(Number(event.target.value))} />
            </label>
            <label className="contract-field sim-control">
              <span className="contract-field-label">Max request rate (1–{RUNNER_LIMITS.maxRpsCeiling} req/s): <strong>{maxRps}</strong></span>
              <input type="range" min={1} max={RUNNER_LIMITS.maxRpsCeiling} step={1} value={maxRps} disabled={running} onChange={(event) => setMaxRps(Number(event.target.value))} />
            </label>
          </div>
          <div className="button-row">
            {running ? (
              <button type="button" className="button button-secondary" onClick={onStop}>Stop after current requests</button>
            ) : (
              <button type="button" className="button" onClick={onRun}>Run the test</button>
            )}
            <span className="panel-note" role="status">
              {running ? `Running… ${progress} request(s) completed` : 'Runs are same-origin, bounded and measured in your browser.'}
            </span>
          </div>
          {error ? <p className="contract-inline-error" role="alert">{error}</p> : null}
        </div>
      </section>

      {/* ---------------------- Results ---------------------- */}
      {metrics && result ? (
        <section className="workspace-panel" aria-labelledby="runner-results-title">
          <div className="workspace-head">
            <h2 id="runner-results-title" className="workspace-title">Measured results</h2>
            <button type="button" className="button button-secondary" onClick={onDownloadReport}>Download report (.md)</button>
          </div>
          <div className="workspace-body">
            <p className="panel-note">{percentileContext(metrics)}{result.cappedByRequestLimit ? ' The 150-request cap stopped the run before the deadline.' : ''}</p>
            <div className="workspace-facts">
              <div className="workspace-fact"><span className="workspace-key">Total requests</span><span className="workspace-value">{metrics.totalRequests}</span></div>
              <div className="workspace-fact"><span className="workspace-key">Successful</span><span className="workspace-value">{metrics.successful}</span></div>
              <div className="workspace-fact"><span className="workspace-key">Failed</span><span className="workspace-value">{metrics.failed} ({metrics.failedRatePercent}%)</span></div>
              <div className="workspace-fact"><span className="workspace-key">Timeouts</span><span className="workspace-value">{metrics.timeouts}</span></div>
              <div className="workspace-fact"><span className="workspace-key">Throughput</span><span className="workspace-value">{metrics.throughputPerSecond} req/s</span></div>
              <div className="workspace-fact"><span className="workspace-key">Elapsed</span><span className="workspace-value">{Math.round(metrics.elapsedMs / 100) / 10}s</span></div>
            </div>
            <dl className="metric-grid" aria-label="Latency percentiles (nearest-rank, measured)">
              <div className="metric-cell"><dt>Average</dt><dd>{formatMs(metrics.avgMs)}</dd></div>
              <div className="metric-cell"><dt>Median (p50)</dt><dd>{formatMs(metrics.medianMs)}</dd></div>
              <div className="metric-cell"><dt>p90</dt><dd>{formatMs(metrics.p90Ms)}</dd></div>
              <div className="metric-cell"><dt>p95</dt><dd>{formatMs(metrics.p95Ms)}</dd></div>
              <div className="metric-cell"><dt>p99</dt><dd>{formatMs(metrics.p99Ms)}</dd></div>
              <div className="metric-cell"><dt>Fastest / slowest</dt><dd>{formatMs(metrics.fastestMs)} / {formatMs(metrics.slowestMs)}</dd></div>
            </dl>
            <div className="sim-bars" aria-label="Outcome split">
              <div className="sim-bar-row"><span className="sim-bar-label">Success rate</span><Bar fraction={successFraction} label="Success rate" /><span className="sim-bar-value">{Math.round(successFraction * 1000) / 10}%</span></div>
              <div className="sim-bar-row"><span className="sim-bar-label">Error rate</span><Bar fraction={errorFraction} label="Error rate" /><span className="sim-bar-value">{metrics.failedRatePercent}%</span></div>
            </div>
            <div className="sim-status" aria-label="Status-class distribution">
              {Object.entries(metrics.statusClasses).map(([klass, count]) => (
                <div key={klass} className="sim-status-row">
                  <span className="sim-status-class">{klass}</span>
                  <Bar fraction={count / maxStatus} label={`${klass} responses`} />
                  <span className="sim-status-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------- History (this browser) ---------------------- */}
      {historyState === 'ready' && history.length > 0 ? (
        <section className="workspace-panel" aria-labelledby="runner-history-title">
          <div className="workspace-head">
            <h2 id="runner-history-title" className="workspace-title">Recent runs (this browser only)</h2>
            <button type="button" className="button button-ghost" onClick={onClearHistory}>Clear history</button>
          </div>
          <div className="workspace-body">
            <ul className="sim-history">
              {history.map((run) => (
                <li key={run.id} className="sim-history-row">
                  <span className="sim-history-label">{run.label}</span>
                  <span className="sim-history-meta">
                    {run.metrics.totalRequests} req · avg {formatMs(run.metrics.avgMs)} · p95 {formatMs(run.metrics.p95Ms)} · err {run.metrics.failedRatePercent}%
                  </span>
                  <time className="sim-history-time" dateTime={run.savedAt}>{new Date(run.savedAt).toLocaleString()}</time>
                </li>
              ))}
            </ul>
            <p className="panel-note">History is stored in this browser’s localStorage, never on the server. Clearing the browser storage erases it.</p>
          </div>
        </section>
      ) : null}
    </div>
  )
}
