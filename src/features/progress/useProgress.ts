// Shared fetch state for GET /api/v1/practice/progress (P4-M3 WP1+WP2).
// One fetch on mount — route entries remount the page, so returning to
// /progress or /practice always re-reads from the server — plus a manual
// retry/refresh. Aborts cleanly on unmount. No polling, no duplicate
// requests while one is in flight.

import { useCallback, useEffect, useState } from 'react'
import { fetchProgress } from '../practice/api'
import type { ProgressDashboardState } from './ProgressDashboard'

export function useProgress(): ProgressDashboardState {
  const [state, setState] = useState<ProgressDashboardState>({ status: 'loading' })
  const [refreshToken, setRefreshToken] = useState(0)

  // A user action, not an effect side effect: flag the in-flight state here
  // and bump the token that triggers the fetch effect below.
  const reload = useCallback(() => {
    setState((current) =>
      current.status === 'ready' ? { ...current, refreshing: true } : { status: 'loading' },
    )
    setRefreshToken((token) => token + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchProgress(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setState({ status: 'ready', data, refreshing: false, onRefresh: reload })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message =
          error instanceof Error ? error.message : 'Your progress could not be loaded.'
        setState({ status: 'error', message, onRetry: reload })
      })
    return () => controller.abort()
  }, [refreshToken, reload])

  return state
}
