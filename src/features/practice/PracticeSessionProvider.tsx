// Practice-session mode state shared across the app: the mode banner in the
// app shell and the bug-hunt panel on /practice both read through this
// provider. The server is the source of truth — starting a hunt or resetting
// replaces local state with the server-returned mode/hunt. Refreshing the
// page re-reads /api/v1/practice/session (the HttpOnly cookie decides).
// Nothing is stored in localStorage or sessionStorage.

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { HuntSummary, PracticeSessionMode } from '../../shared/practice'
import {
  PracticeApiError,
  fetchPracticeSession,
  resetPracticeSession,
  startHunt,
} from './api'
import {
  PracticeSessionContext,
  type PracticeAction,
  type PracticeLoadState,
} from './practice-context'

function failureMessage(error: unknown, fallback: string): string {
  if (error instanceof PracticeApiError) {
    return error.message
  }
  return fallback
}

export function PracticeSessionProvider({ children }: { children: ReactNode }) {
  const [loadState, setLoadState] = useState<PracticeLoadState>({ status: 'loading' })
  const [mode, setMode] = useState<PracticeSessionMode>('clean')
  const [hunt, setHunt] = useState<HuntSummary | null>(null)
  const [busy, setBusy] = useState<PracticeAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    fetchPracticeSession(controller.signal)
      .then((session) => {
        setMode(session.mode)
        setHunt(session.hunt)
        setLoadState({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadState({
          status: 'error',
          message: failureMessage(error, 'The practice mode could not be loaded.'),
        })
      })

    return () => controller.abort()
  }, [attempt])

  const refresh = useCallback(() => {
    setLoadState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const start = useCallback(async (huntId: string): Promise<boolean> => {
    setBusy('start')
    setActionError(null)
    try {
      const session = await startHunt(huntId)
      setMode(session.mode)
      setHunt(session.hunt)
      setLoadState({ status: 'ready' })
      return true
    } catch (error) {
      setActionError(failureMessage(error, 'The hunt could not be started. Try again.'))
      return false
    } finally {
      setBusy(null)
    }
  }, [])

  const reset = useCallback(async (): Promise<boolean> => {
    setBusy('reset')
    setActionError(null)
    try {
      const session = await resetPracticeSession()
      setMode(session.mode)
      setHunt(session.hunt)
      setLoadState({ status: 'ready' })
      return true
    } catch (error) {
      setActionError(failureMessage(error, 'The practice session could not be reset.'))
      return false
    } finally {
      setBusy(null)
    }
  }, [])

  return (
    <PracticeSessionContext.Provider
      value={{
        loadState,
        mode,
        hunt,
        busy,
        actionError,
        refresh,
        startHunt: start,
        resetSession: reset,
      }}
    >
      {children}
    </PracticeSessionContext.Provider>
  )
}
