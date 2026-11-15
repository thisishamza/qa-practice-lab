// Shared context object for the practice-session mode — kept component-free
// so both the provider and the hook can import it without fast-refresh
// warnings. Mode and hunt identity are resolved server-side from the
// HttpOnly `mpl_session` cookie; nothing about the mode is persisted in
// browser storage.

import { createContext } from 'react'
import type { HuntSummary, PracticeSessionMode } from '../../shared/practice'

export type PracticeLoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

export type PracticeAction = 'start' | 'reset' | null

export interface PracticeSessionContextValue {
  loadState: PracticeLoadState
  /** 'clean' whenever the session is missing, expired or not hunting. */
  mode: PracticeSessionMode
  /** Present only in bug_hunt mode. Never carries defect ids. */
  hunt: HuntSummary | null
  /** Which action is in flight, if any. */
  busy: PracticeAction
  /** Last action error, shown inline by the triggering control. */
  actionError: string | null
  refresh: () => void
  startHunt: (huntId: string) => Promise<boolean>
  resetSession: () => Promise<boolean>
}

export const PracticeSessionContext = createContext<PracticeSessionContextValue | null>(null)
