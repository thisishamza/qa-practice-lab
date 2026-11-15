// Shared context object for the synthetic customer session — kept
// component-free so both the provider and the hook can import it without
// fast-refresh warnings. Identity lives only in the HttpOnly cookie; nothing
// about the signed-in customer is persisted in browser storage.

import { createContext } from 'react'
import type { CustomerProfile } from '../../shared/commerce'

export type AuthLoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

export type SignInResult =
  | { ok: true }
  | { ok: false; message: string; suspended?: boolean }

export interface AuthContextValue {
  loadState: AuthLoadState
  /** The signed-in synthetic customer, or null when browsing as a guest. */
  customer: CustomerProfile | null
  /** True when the account exists but was suspended mid-session. */
  suspended: boolean
  refresh: () => void
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
