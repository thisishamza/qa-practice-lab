// Attempt-status presentation for hunt cards (P4-M2 WP3). Pure and
// unit-testable: maps the server's attempt view onto a neutral, learner-safe
// chip. The mapping never derives discovery — discovery is decided solely by
// the deterministic evaluator and is not part of this display.

import type { AttemptStatusView } from '../shared/learning'

/**
 * Presentation tone for the chip. Kept as a plain union (rather than importing
 * Tag's tone type) so this module stays dependency-free; values are a subset
 * of Tag's tones and the chip maps them straight through.
 */
export type AttemptStatusTone = 'neutral' | 'ready' | 'in-design' | 'planned'

export interface AttemptStatusDisplay {
  /** Short, learner-facing label (uppercased by the Tag styling). */
  label: string
  tone: AttemptStatusTone
  /** Full sentence for assistive tech and tooltips; never colour-only. */
  description: string
}

/**
 * Map an attempt status onto the chip presentation.
 * - `none`        → neutral “Not started”
 * - `in_progress` → “In progress”
 * - `submitted`   → “Submitted” plus the best score when the server has one
 * - `revealed`    → neutral “Solution viewed” (a give-up is not a completion
 *                   and never implies discovery)
 * `bestQualityScore` is honoured only for `submitted`; it is never shown for
 * other statuses so a reveal cannot look like a scored completion.
 */
export function attemptStatusDisplay(
  status: AttemptStatusView,
  bestQualityScore: number | null,
): AttemptStatusDisplay {
  switch (status) {
    case 'none':
      return {
        label: 'Not started',
        tone: 'neutral',
        description: 'No attempt at this exercise yet.',
      }
    case 'in_progress':
      return {
        label: 'In progress',
        tone: 'in-design',
        description: 'You have started this exercise. Your investigation is still open.',
      }
    case 'submitted':
      return {
        label:
          bestQualityScore !== null ? `Submitted · ${bestQualityScore}` : 'Submitted',
        tone: 'ready',
        description:
          bestQualityScore !== null
            ? `Report submitted. Your best score so far is ${bestQualityScore} out of 100.`
            : 'Report submitted.',
      }
    case 'revealed':
      return {
        label: 'Solution viewed',
        tone: 'planned',
        description:
          'The solution is unlocked for this attempt. Revealing it does not count as discovering the defect.',
      }
  }
}

/** Neutral placeholder used when the attempt status cannot be loaded. */
export const ATTEMPT_STATUS_UNAVAILABLE: AttemptStatusDisplay = {
  label: 'Status unavailable',
  tone: 'neutral',
  description: 'The attempt status for this exercise could not be loaded right now.',
}
