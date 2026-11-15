import { useContext } from 'react'
import { PracticeSessionContext, type PracticeSessionContextValue } from './practice-context'

export function usePracticeSession(): PracticeSessionContextValue {
  const value = useContext(PracticeSessionContext)
  if (!value) {
    throw new Error('usePracticeSession must be used within <PracticeSessionProvider>')
  }
  return value
}
