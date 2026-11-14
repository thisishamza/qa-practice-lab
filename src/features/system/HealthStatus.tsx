import { useEffect, useState } from 'react'
import type { HealthResponse } from '../../shared/health'

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthResponse }
  | { status: 'error'; message: string }

export function HealthStatus() {
  const [state, setState] = useState<HealthState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const data = (await response.json()) as HealthResponse

        if (!response.ok || data.status !== 'ok') {
          setState({
            status: 'error',
            message: 'The API responded, but the database check failed.',
          })
          return
        }

        setState({ status: 'ok', data })
      } catch {
        if (controller.signal.aborted) {
          return
        }

        setState({
          status: 'error',
          message: 'Could not reach the API. Is the local API server running?',
        })
      }
    }

    void checkHealth()

    return () => controller.abort()
  }, [])

  return (
    <section className="panel health-panel" aria-labelledby="health-title" aria-live="polite">
      <div className="health-heading">
        <h2 id="health-title">Live check</h2>
        <span className={`status-badge status-${state.status}`}>
          {state.status === 'loading' && 'Checking'}
          {state.status === 'ok' && 'Operational'}
          {state.status === 'error' && 'Needs attention'}
        </span>
      </div>

      {state.status === 'loading' && <p className="muted">Contacting /api/health…</p>}

      {state.status === 'ok' && (
        <>
          <p className="muted">The Hono API reached D1 and read the migrated schema.</p>
          <dl className="health-details">
            <div>
              <dt>Service version</dt>
              <dd>{state.data.version}</dd>
            </div>
            <div>
              <dt>Schema version</dt>
              <dd>{state.data.schemaVersion}</dd>
            </div>
            <div>
              <dt>Checked at</dt>
              <dd>
                {new Date(state.data.checkedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </dd>
            </div>
          </dl>
        </>
      )}

      {state.status === 'error' && (
        <>
          <p className="muted">{state.message}</p>
          <p className="hint">
            Run <code>npm run db:migrate:local</code>, then <code>npm run dev</code>. The API
            listens on port 8788 and Vite proxies <code>/api</code> to it.
          </p>
        </>
      )}
    </section>
  )
}
