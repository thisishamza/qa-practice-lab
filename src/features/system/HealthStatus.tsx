import { useCallback, useEffect, useState } from 'react'
import type { HealthResponse } from '../../shared/health'
import { Button } from '../../components/ui/Button'

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthResponse }
  | { status: 'error'; message: string }

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    headers: { Accept: 'application/json' },
  })
  const data = (await response.json()) as HealthResponse

  if (!response.ok || data.status !== 'ok') {
    throw new Error('database check failed')
  }

  return data
}

export function HealthStatus() {
  const [state, setState] = useState<HealthState>({ status: 'loading' })

  const load = useCallback(() => {
    setState({ status: 'loading' })

    fetchHealth()
      .then((data) => setState({ status: 'ok', data }))
      .catch(() =>
        setState({
          status: 'error',
          message: 'The practice API could not be reached.',
        }),
      )
  }, [])

  // Continuation-based updates keep the effect free of synchronous setState.
  useEffect(() => {
    let cancelled = false

    fetchHealth()
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ok', data })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'The practice API could not be reached.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const statusLabel =
    state.status === 'ok'
      ? 'Operational'
      : state.status === 'loading'
        ? 'Checking'
        : 'Needs attention'

  return (
    <section data-surface="workspace" className="workspace-panel" aria-labelledby="runtime-title">
      <div className="workspace-head">
        <h2 id="runtime-title" className="workspace-title">
          Runtime status
        </h2>
        <span className={`workspace-status workspace-status-${state.status}`}>
          <span className="workspace-dot" aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <div className="workspace-body" aria-live="polite">
        {state.status === 'loading' ? (
          <p className="workspace-line">Contacting /api/health…</p>
        ) : null}

        {state.status === 'ok' ? (
          <>
            <p className="workspace-line">
              The Hono API reached D1 and read the migrated schema.
            </p>
            <div className="workspace-facts">
              <div>
                <span className="workspace-key">Service version</span>
                <span className="workspace-value">{state.data.version}</span>
              </div>
              <div>
                <span className="workspace-key">Schema version</span>
                <span className="workspace-value">{state.data.schemaVersion}</span>
              </div>
              <div>
                <span className="workspace-key">Checked at</span>
                <span className="workspace-value">
                  {new Date(state.data.checkedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              <div>
                <span className="workspace-key">Exercise targets</span>
                <span className="workspace-value">Not implemented</span>
              </div>
            </div>
          </>
        ) : null}

        {state.status === 'error' ? (
          <p className="workspace-line">
            The practice API could not be reached. Learning content still works — only this
            runtime check fails.
          </p>
        ) : null}

        <Button
          size="sm"
          variant="secondary"
          onClick={load}
          loading={state.status === 'loading'}
        >
          Check again
        </Button>
      </div>
    </section>
  )
}
