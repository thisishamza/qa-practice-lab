// Shared fetch state for GET /api/v1/practice/progress (P4-M3 WP1+WP2).
// One fetch on mount — route entries remount the page, so returning to
// /progress or /practice always re-reads from the server — plus a manual
// retry/refresh. Aborts cleanly on unmount. No polling, no duplicate
// requests while one is in flight.

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchProgress } from '../practice/api'
import type { ProgressDashboardState } from './progress-types'
import type { ProgressResponse } from '../../shared/learning'

export type ProgressFetchOutcome =
  | { kind: 'success'; data: ProgressResponse }
  | { kind: 'error'; message: string }

/**
 * Pure state resolution for a fetch outcome. A failure with a previously
 * rendered payload keeps that payload on screen (marked with `refreshError`)
 * instead of wiping a populated dashboard; a failure with nothing to show
 * resolves to the full-page error state. Exported for tests.
 */
export function resolveProgressState(
  lastGood: ProgressResponse | null,
  outcome: ProgressFetchOutcome,
  reload: () => void,
): ProgressDashboardState {
  if (outcome.kind === 'success') {
    return { status: 'ready', data: outcome.data, refreshing: false, refreshError: null, onRefresh: reload }
  }
  if (lastGood) {
    return {
      status: 'ready',
      data: lastGood,
      refreshing: false,
      refreshError: outcome.message,
      onRefresh: reload,
    }
  }
  return { status: 'error', message: outcome.message, onRetry: reload }
}

export function useProgress(): ProgressDashboardState {
  const [state, setState] = useState<ProgressDashboardState>({ status: 'loading' })
  const [refreshToken, setRefreshToken] = useState(0)
  // The last payload we successfully rendered, kept so a failed refresh never
  // wipes a populated dashboard — the learner sees the stale numbers plus an
  // inline retry note instead of losing them.
  const lastGoodRef = useRef<ProgressResponse | null>(null)

  // A user action, not an effect side effect: flag the in-flight state here
  // and bump the token that triggers the fetch effect below.
  const reload = useCallback(() => {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, refreshing: true, refreshError: null }
        : { status: 'loading' },
    )
    setRefreshToken((token) => token + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchProgress(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        lastGoodRef.current = data
        setState(
          resolveProgressState(
            lastGoodRef.current,
            { kind: 'success', data },
            reload,
          ),
        )
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message =
          error instanceof Error ? error.message : 'Your progress could not be loaded.'
        setState(resolveProgressState(lastGoodRef.current, { kind: 'error', message }, reload))
      })
    return () => controller.abort()
  }, [refreshToken, reload])

  return state
}
