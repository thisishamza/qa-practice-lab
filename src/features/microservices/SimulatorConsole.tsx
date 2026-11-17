import { useCallback, useEffect, useState } from 'react'
import {
  fetchConsistency,
  fetchEvents,
  fetchOverview,
  fetchTrace,
  publishEvent,
  processEvents,
  resetSimulator,
  replayDead,
  redeliverEvent,
  retryEvent,
  type ConsistencyResponse,
  type Drill,
  type EventHistoryItem,
  type EventType,
  type ProcessOutcome,
  type SimulatorOverview,
  type TraceResponse,
} from './api'
import { PracticeApiError } from '../practice/api'

const EVENT_TYPES: ReadonlyArray<{ value: EventType; label: string }> = [
  { value: 'order.created', label: 'order.created — order accepted, reserve stock' },
  { value: 'inventory.reserved', label: 'inventory.reserved — stock held, charge payment' },
  { value: 'payment.processed', label: 'payment.processed — notify + deliver webhook' },
  { value: 'webhook.deliver', label: 'webhook.deliver — deliver webhook directly' },
]

const DRILLS: ReadonlyArray<{ value: Drill; label: string; group: string }> = [
  { value: 'none', label: 'none — happy path', group: 'Normal' },
  { value: 'inventory-short', label: 'inventory-short — insufficient synthetic stock (rejection)', group: 'Failure drills' },
  { value: 'inventory-delay', label: 'inventory-delay — reservation arrives 5 s late (eventual consistency)', group: 'Timing drills' },
  { value: 'payment-decline', label: 'payment-decline — non-retryable decline', group: 'Failure drills' },
  { value: 'payment-transient', label: 'payment-transient — gateway timeout ×2, succeeds on attempt 3', group: 'Retry drills' },
  { value: 'payment-always-fails', label: 'payment-always-fails — gateway always down (dead-letters after 3 attempts)', group: 'Retry drills' },
  { value: 'webhook-timeout', label: 'webhook-timeout — delivery times out twice, then succeeds', group: 'Webhook drills' },
  { value: 'webhook-always-fail', label: 'webhook-always-fail — webhook never lands (dead-letters after 3 attempts)', group: 'Webhook drills' },
  { value: 'poison', label: 'poison — unparseable message for this step (rejected without retry)', group: 'Failure drills' },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'pending',
  processed: 'processed',
  failed: 'failed (retry)',
  dead: 'dead-letter',
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const delta = Math.round((Date.now() - then) / 1000)
  if (delta < 5) return 'just now'
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  return new Date(then).toLocaleTimeString()
}

export function SimulatorConsole() {
  const [overview, setOverview] = useState<SimulatorOverview | null>(null)
  const [events, setEvents] = useState<EventHistoryItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [log, setLog] = useState<ProcessOutcome[]>([])
  const [processing, setProcessing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [busyEventId, setBusyEventId] = useState<string | null>(null)
  const [trace, setTrace] = useState<TraceResponse | null>(null)
  const [traceCorrelation, setTraceCorrelation] = useState<string | null>(null)
  const [consistency, setConsistency] = useState<ConsistencyResponse | null>(null)
  const [consistencyBusy, setConsistencyBusy] = useState(false)

  const [type, setType] = useState<EventType>('order.created')
  const [drill, setDrill] = useState<Drill>('none')
  const [quantity, setQuantity] = useState(2)
  const [totalCents, setTotalCents] = useState(12900)
  const [correlation, setCorrelation] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [nextOverview, history] = await Promise.all([fetchOverview(), fetchEvents()])
      setOverview(nextOverview)
      setEvents(history.events)
      setLoadError(null)
      setLoaded(true)
    } catch (error) {
      setLoadError(error instanceof PracticeApiError ? error.message : 'The simulator state could not be loaded.')
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    // Deferred so state updates are not synchronous within the effect body.
    const id = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(id)
  }, [refresh])

  const onPublish = useCallback(async () => {
    setPublishing(true)
    setActionError(null)
    try {
      const trimmed = correlation.trim()
      await publishEvent({
        type,
        drill,
        quantity,
        totalCents,
        ...(trimmed ? { correlationId: trimmed } : {}),
      })
      setCorrelation('')
      await refresh()
    } catch (error) {
      setActionError(error instanceof PracticeApiError ? error.message : 'The event could not be published.')
    } finally {
      setPublishing(false)
    }
  }, [type, drill, quantity, totalCents, correlation, refresh])

  const onProcess = useCallback(async () => {
    setProcessing(true)
    setActionError(null)
    try {
      const result = await processEvents()
      setLog(result.processed)
      await refresh()
    } catch (error) {
      setActionError(error instanceof PracticeApiError ? error.message : 'The events could not be processed.')
    } finally {
      setProcessing(false)
    }
  }, [refresh])

  const onRetry = useCallback(
    async (eventId: string) => {
      setBusyEventId(eventId)
      setActionError(null)
      try {
        await retryEvent(eventId)
        await refresh()
      } catch (error) {
        setActionError(error instanceof PracticeApiError ? error.message : 'The event could not be retried.')
      } finally {
        setBusyEventId(null)
      }
    },
    [refresh],
  )

  const onRedeliver = useCallback(
    async (eventId: string) => {
      setBusyEventId(eventId)
      setActionError(null)
      try {
        await redeliverEvent(eventId)
        await refresh()
      } catch (error) {
        setActionError(error instanceof PracticeApiError ? error.message : 'The event could not be redelivered.')
      } finally {
        setBusyEventId(null)
      }
    },
    [refresh],
  )

  const onReplay = useCallback(async () => {
    setProcessing(true)
    setActionError(null)
    try {
      await replayDead()
      await refresh()
    } catch (error) {
      setActionError(error instanceof PracticeApiError ? error.message : 'The dead-letter queue could not be replayed.')
    } finally {
      setProcessing(false)
    }
  }, [refresh])

  const onReset = useCallback(async () => {
    setResetting(true)
    setActionError(null)
    try {
      await resetSimulator()
      setLog([])
      setTrace(null)
      setTraceCorrelation(null)
      setConsistency(null)
      await refresh()
    } catch (error) {
      setActionError(error instanceof PracticeApiError ? error.message : 'The simulator could not be reset.')
    } finally {
      setResetting(false)
    }
  }, [refresh])

  const onConsistency = useCallback(async () => {
    setConsistencyBusy(true)
    setActionError(null)
    try {
      setConsistency(await fetchConsistency())
    } catch (error) {
      setActionError(error instanceof PracticeApiError ? error.message : 'The consistency check could not be run.')
    } finally {
      setConsistencyBusy(false)
    }
  }, [])

  const onTrace = useCallback(async (correlationId: string) => {
    setActionError(null)
    setTraceCorrelation(correlationId)
    try {
      setTrace(await fetchTrace(correlationId))
    } catch (error) {
      setTrace(null)
      setActionError(error instanceof PracticeApiError ? error.message : 'The trace could not be loaded.')
    }
  }, [])

  const orders = overview?.orders ?? []
  const quota = overview?.quota ?? { used: 0, limit: 100 }
  const byStatus = overview?.events ?? { total: 0, pending: 0, processed: 0, failed: 0, dead: 0 }
  const webhooks = overview?.webhooks ?? { delivered: 0, duplicates: 0, dead: 0 }
  const stateEntries = Object.entries(overview?.state ?? {}).filter(([service]) => service !== 'orders')

  if (!loaded) {
    return <p className="panel-note" role="status">Loading the simulator…</p>
  }

  return (
    <div className="stack sim-console">
      {loadError ? (
        <p className="callout callout-danger" role="alert"><span className="callout-text">{loadError}</span></p>
      ) : null}
      {actionError ? (
        <p className="callout callout-warning" role="alert"><span className="callout-text">{actionError}</span></p>
      ) : null}

      {/* ------------------------- Publish ------------------------- */}
      <section className="workspace-panel" aria-labelledby="sim-publish-title">
        <div className="workspace-head">
          <h2 id="sim-publish-title" className="workspace-title">1 · Publish a test event</h2>
          <span className="workspace-status">{quota.used}/{quota.limit} events</span>
        </div>
        <div className="workspace-body">
          <div className="sim-publish-grid">
            <label className="contract-field">
              <span className="contract-field-label">Event type</span>
              <select className="contract-select" value={type} onChange={(event) => setType(event.target.value as EventType)}>
                {EVENT_TYPES.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </label>
            <label className="contract-field">
              <span className="contract-field-label">Scenario drill</span>
              <select className="contract-select" value={drill} onChange={(event) => setDrill(event.target.value as Drill)}>
                {DRILLS.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </label>
            <label className="contract-field">
              <span className="contract-field-label">Quantity</span>
              <input
                className="contract-textarea sim-number"
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Math.min(999, Math.trunc(Number(event.target.value) || 1))))}
              />
            </label>
            <label className="contract-field">
              <span className="contract-field-label">Total (cents)</span>
              <input
                className="contract-textarea sim-number"
                type="number"
                min={0}
                max={2000000}
                step={100}
                value={totalCents}
                onChange={(event) => setTotalCents(Math.max(0, Math.min(2000000, Math.trunc(Number(event.target.value) || 0))))}
              />
            </label>
            <label className="contract-field">
              <span className="contract-field-label">Correlation id (optional)</span>
              <input
                className="contract-textarea sim-number"
                type="text"
                placeholder="corr_… (leave blank for a new one)"
                value={correlation}
                onChange={(event) => setCorrelation(event.target.value)}
              />
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="button" onClick={onPublish} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish event'}
            </button>
            <p className="panel-note sim-hint">
              Payloads are synthesized server-side from these controls — nothing you type is executed. Leave the correlation blank for a new one, or reuse an id to build an out-of-order sequence.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------- Process + replay ------------------------- */}
      <section className="workspace-panel" aria-labelledby="sim-process-title">
        <div className="workspace-head">
          <h2 id="sim-process-title" className="workspace-title">2 · Process the queue</h2>
          <div className="button-row">
            <button type="button" className="button button-secondary" onClick={onReplay} disabled={processing || byStatus.dead === 0}>
              Replay dead letters
            </button>
            <button type="button" className="button button-secondary" onClick={onProcess} disabled={processing}>
              {processing ? 'Processing…' : 'Process due events'}
            </button>
          </div>
        </div>
        <div className="workspace-body">
          <div className="sim-counts" aria-label="Event status counts">
            <span className="chip">pending {byStatus.pending}</span>
            <span className="chip">processed {byStatus.processed}</span>
            <span className="chip">failed (retryable) {byStatus.failed}</span>
            <span className="chip">dead-letter {byStatus.dead}</span>
            <span className="chip">webhooks delivered {webhooks.delivered}</span>
            <span className="chip">webhook duplicates {webhooks.duplicates}</span>
          </div>
          {log.length > 0 ? (
            <ul className="sim-log" aria-label="Per-event outcomes">
              {log.map((outcome) => (
                <li key={outcome.eventId} className={`sim-log-item sim-log-${outcome.result}`}>
                  <code>#{outcome.seq} {outcome.type}</code>
                  <strong>{outcome.result}</strong>
                  <span>{outcome.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-note">No events processed yet. Publish one, then press “Process due events”. Events whose backoff delay has not elapsed are held until due.</p>
          )}
        </div>
      </section>

      {/* ------------------------- Event history ------------------------- */}
      <section className="workspace-panel" aria-labelledby="sim-events-title">
        <div className="workspace-head">
          <h2 id="sim-events-title" className="workspace-title">3 · Event history</h2>
          <button type="button" className="button button-ghost" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <div className="workspace-body">
          {events.length === 0 ? (
            <p className="panel-note">No events in this practice session yet.</p>
          ) : (
            <div className="sql-results-scroll">
              <table className="sql-results-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Type</th>
                    <th scope="col">Correlation</th>
                    <th scope="col">Status</th>
                    <th scope="col">Attempts</th>
                    <th scope="col">Last error</th>
                    <th scope="col">Created</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.seq}</td>
                      <td><code>{event.type}</code></td>
                      <td>
                        <button type="button" className="link-button" onClick={() => void onTrace(event.correlation_id)}>
                          {event.correlation_id}
                        </button>
                      </td>
                      <td>{STATUS_LABEL[event.status] ?? event.status}</td>
                      <td>{event.attempts}/{event.max_attempts}</td>
                      <td>{event.last_error ?? '—'}</td>
                      <td>{timeAgo(event.created_at)}</td>
                      <td>
                        <div className="button-row">
                          {event.status === 'failed' || event.status === 'dead' ? (
                            <button
                              type="button"
                              className="link-button"
                              disabled={busyEventId === event.id}
                              onClick={() => void onRetry(event.id)}
                            >
                              {busyEventId === event.id ? 'Retrying…' : 'Retry'}
                            </button>
                          ) : null}
                          {event.status !== 'pending' ? (
                            <button
                              type="button"
                              className="link-button"
                              disabled={busyEventId === event.id}
                              onClick={() => void onRedeliver(event.id)}
                            >
                              {busyEventId === event.id ? 'Working…' : 'Redeliver'}
                            </button>
                          ) : (
                            '—'
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------- Service state + orders ------------------------- */}
      <section className="workspace-panel" aria-labelledby="sim-state-title">
        <div className="workspace-head">
          <h2 id="sim-state-title" className="workspace-title">4 · Service state &amp; orders</h2>
          <button type="button" className="button button-secondary" onClick={onConsistency} disabled={consistencyBusy}>
            {consistencyBusy ? 'Checking…' : 'Check consistency'}
          </button>
        </div>
        <div className="workspace-body">
          {consistency ? (
            <p className={`callout ${consistency.ok ? 'callout-success' : 'callout-danger'}`} role="status">
              <span className="callout-text">
                {consistency.ok
                  ? `Consistent — ${consistency.checked} order(s) checked, no violations.`
                  : `${consistency.violations.length} violation(s) across ${consistency.checked} order(s).`}
              </span>
            </p>
          ) : null}
          {consistency && !consistency.ok ? (
            <ul className="sim-log" aria-label="Consistency violations">
              {consistency.violations.map((violation, index) => (
                <li key={`${violation.correlationId}-${index}`} className="sim-log-item sim-log-dead">
                  <code>{violation.kind}</code>
                  <span>{violation.correlationId}</span>
                  <span>{violation.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="sim-state-grid">
            <div>
              <h3 className="sim-subtitle">Orders ({orders.length})</h3>
              {orders.length === 0 ? (
                <p className="panel-note">No orders yet — publish an order.created event.</p>
              ) : (
                <div className="sql-results-scroll">
                  <table className="sql-results-table">
                    <thead>
                      <tr>
                        <th scope="col">Correlation</th>
                        <th scope="col">Order</th>
                        <th scope="col">Qty</th>
                        <th scope="col">Total</th>
                        <th scope="col">Reserved</th>
                        <th scope="col">Paid</th>
                        <th scope="col">Captured</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.correlationId}>
                          <td><code>{order.correlationId}</code></td>
                          <td>{order.orderId}</td>
                          <td>{order.quantity}</td>
                          <td>{formatCents(order.totalCents)}</td>
                          <td>{order.reserved ? 'yes' : 'no'}</td>
                          <td>{order.paymentStatus}</td>
                          <td>{formatCents(order.capturedCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h3 className="sim-subtitle">Service counters</h3>
              {stateEntries.length === 0 ? (
                <p className="panel-note">No state recorded yet.</p>
              ) : (
                <dl className="sim-state-list">
                  {stateEntries.flatMap(([service, kv]) =>
                    Object.entries(kv).map(([key, value]) => (
                      <div key={`${service}:${key}`} className="sim-state-row">
                        <dt><code>{service}.{key}</code></dt>
                        <dd>{value}</dd>
                      </div>
                    )),
                  )}
                </dl>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------- Trace ------------------------- */}
      {trace ? (
        <section className="workspace-panel" aria-labelledby="sim-trace-title">
          <div className="workspace-head">
            <h2 id="sim-trace-title" className="workspace-title">Trace · <code>{trace.correlationId}</code></h2>
            <button type="button" className="button button-ghost" onClick={() => { setTrace(null); setTraceCorrelation(null) }}>
              Close trace
            </button>
          </div>
          <div className="workspace-body">
            <ol className="sim-trace">
              {trace.events.map((event) => (
                <li key={event.id} className="sim-trace-item">
                  <span className="sim-trace-seq">seq {event.seq}</span>
                  <div>
                    <code>{event.type}</code> — {STATUS_LABEL[event.status] ?? event.status}
                    {event.last_error ? <span className="sim-trace-error"> · {event.last_error}</span> : null}
                    <span className="sim-trace-meta">attempts {event.attempts}/{event.max_attempts} · created {timeAgo(event.created_at)}</span>
                  </div>
                </li>
              ))}
            </ol>
            {trace.webhooks.length > 0 ? (
              <div className="sql-results-scroll">
                <table className="sql-results-table">
                  <thead>
                    <tr>
                      <th scope="col">Webhook</th>
                      <th scope="col">Target</th>
                      <th scope="col">Status</th>
                      <th scope="col">Attempts</th>
                      <th scope="col">HTTP</th>
                      <th scope="col">Last error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.webhooks.map((webhook, index) => (
                      <tr key={index}>
                        <td>{webhook.event_id}</td>
                        <td><code>{webhook.target}</code></td>
                        <td>{webhook.status}</td>
                        <td>{webhook.attempts}/{webhook.max_attempts}</td>
                        <td>{webhook.http_status ?? '—'}</td>
                        <td>{webhook.last_error ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="panel-note">No webhook deliveries recorded for this correlation yet.</p>
            )}
          </div>
        </section>
      ) : traceCorrelation ? (
        <p className="panel-note" role="status">Loading trace for {traceCorrelation}…</p>
      ) : null}

      {/* ------------------------- Reset ------------------------- */}
      <section className="workspace-panel" aria-labelledby="sim-reset-title">
        <div className="workspace-head">
          <h2 id="sim-reset-title" className="workspace-title">Reset the simulator</h2>
          <button type="button" className="button button-ghost" onClick={onReset} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Reset session state'}
          </button>
        </div>
        <div className="workspace-body">
          <p className="panel-note">
            Deletes every event, webhook delivery and service-state value for this practice session. Hunt mode is unaffected — reset returns the simulator to clean, empty, deterministic state. Nothing outside your session is touched.
          </p>
        </div>
      </section>
    </div>
  )
}
