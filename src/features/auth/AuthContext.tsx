// Customer authentication state shared across the app: the TopBar indicator,
// the login page, /account and /account/orders all read through this
// provider. The server is the source of truth — signing in replaces local
// state with the server-returned profile, and refreshing the page re-reads
// /api/v1/auth/me (the HttpOnly cookie decides). Nothing is stored in
// localStorage or sessionStorage.

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { CustomerProfile } from '../../shared/commerce'
import {
  AuthApiError,
  fetchMe,
  login,
  logout,
} from './api'
import {
  AuthContext,
  type AuthLoadState,
  type SignInResult,
} from './auth-context'

function failureMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthApiError) {
    return error.message
  }
  return fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loadState, setLoadState] = useState<AuthLoadState>({ status: 'loading' })
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [suspended, setSuspended] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    fetchMe(controller.signal)
      .then((profile) => {
        setCustomer(profile)
        setSuspended(false)
        setLoadState({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AuthApiError && error.code === 'account_suspended') {
          // The cookie is valid but the account was suspended mid-session.
          setCustomer(null)
          setSuspended(true)
          setLoadState({ status: 'ready' })
          return
        }
        setLoadState({
          status: 'error',
          message: failureMessage(error, 'Your account could not be loaded.'),
        })
      })

    return () => controller.abort()
  }, [attempt])

  const refresh = useCallback(() => {
    setLoadState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        const profile = await login(email, password)
        setCustomer(profile)
        setSuspended(false)
        setLoadState({ status: 'ready' })
        return { ok: true }
      } catch (error) {
        if (error instanceof AuthApiError) {
          return {
            ok: false,
            message: error.message,
            suspended: error.code === 'account_suspended',
          }
        }
        return { ok: false, message: 'The practice API could not be reached. Try again.' }
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    try {
      await logout()
    } catch {
      // The server-side row may already be gone; clearing local state is
      // still the right thing — the cookie will expire on its own.
    }
    setCustomer(null)
    setSuspended(false)
    setLoadState({ status: 'ready' })
  }, [])

  return (
    <AuthContext.Provider value={{ loadState, customer, suspended, refresh, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
