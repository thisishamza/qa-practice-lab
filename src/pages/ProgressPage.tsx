import { ProgressDashboard } from '../features/progress/ProgressDashboard'
import { useProgress } from '../features/progress/useProgress'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function ProgressPage() {
  useDocumentTitle('Progress')
  const state = useProgress()
  return <ProgressDashboard state={state} />
}
