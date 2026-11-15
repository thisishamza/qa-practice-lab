import { useCallback, useEffect, useState } from 'react'
import { ProgressDashboard } from '../features/progress/ProgressDashboard'
import type { ProgressDashboardState } from '../features/progress/ProgressDashboard'
import { fetchProgress } from '../features/practice/api'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function ProgressPage() {
  useDocumentTitle('Progress')

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

  // Fetches on mount — route entries remount the page, so returning to
  // /progress always re-reads from the server — and whenever a refresh is
  // requested. Aborts clean up on unmount.
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

  return <ProgressDashboard state={state} />
}
