// Attempt-status chip for hunt cards (P4-M2 WP3). Presentation-only: the
// mapping logic lives in src/lib/attemptStatus.ts and the server's attempt
// view is the source of truth. Never colour-only — a visible text label is
// always rendered, with the full sentence available to screen readers.

import { Tag } from '../../components/ui/Tag'
import { ATTEMPT_STATUS_UNAVAILABLE, attemptStatusDisplay } from '../../lib/attemptStatus'
import type { AttemptStatusView } from '../../shared/learning'

interface AttemptStatusChipProps {
  /** The server's attempt status, or null while unavailable. */
  status: AttemptStatusView | null
  bestQualityScore: number | null
}

export function AttemptStatusChip({ status, bestQualityScore }: AttemptStatusChipProps) {
  const display =
    status === null ? ATTEMPT_STATUS_UNAVAILABLE : attemptStatusDisplay(status, bestQualityScore)
  return (
    <Tag tone={display.tone} className="attempt-status-chip">
      {display.label}
      <span className="sr-only"> — {display.description}</span>
    </Tag>
  )
}
