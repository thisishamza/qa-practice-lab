// Recommended-path derivation for /practice (P4-M3 WP2). Pure and
// unit-testable: everything comes from the existing curriculum registry
// (src/shared/huntCurriculum.ts via the wired scenarios) and the P4-M3 WP1
// progress payload. Nothing here is duplicated curriculum data — the items
// are looked up from the catalogue, never re-declared.

import { scenarios, recommendedHuntScenarioIds } from '../data/scenarios'
import type { Scenario } from '../data/types'
import type { HuntCurriculum } from '../shared/huntCurriculum'
import type { ProgressHuntEntry } from '../shared/learning'

/**
 * Completion state for one wired hunt, derived strictly from the progress
 * payload:
 *
 * - `completed` — at least one bug report has been submitted against the
 *   hunt, surfaced as `lastSubmittedAt !== null`. This matches the approved
 *   plan definition ("Completion = a submitted report", regardless of
 *   score), is sticky across hunt switches and resets, and does not depend
 *   on the latest attempt's status — a revealed-then-submitted attempt is
 *   still a submitted report, and a re-opened attempt after submission
 *   never regresses a completion.
 * - `in_progress` — an attempt is open and no report has been submitted yet.
 * - `solution_viewed` — the solution was unlocked and no report has been
 *   submitted. A give-up is never a completion.
 * - `not_started` — no attempt exists.
 *
 * Discovery is deliberately absent: it is a separate, sticky signal carried
 * on the hunt entry and must never be inferred from any of the above.
 */
export type RecommendedCompletion =
  | 'completed'
  | 'in_progress'
  | 'solution_viewed'
  | 'not_started'

export function completionForEntry(
  entry: ProgressHuntEntry | undefined,
): RecommendedCompletion {
  if (!entry) return 'not_started'
  if (entry.lastSubmittedAt !== null) return 'completed'
  if (entry.status === 'in_progress') return 'in_progress'
  if (entry.status === 'revealed') return 'solution_viewed'
  return 'not_started'
}

export interface RecommendedPathItem {
  /** 1-based position in the approved recommended order. */
  position: number
  scenario: Scenario
  huntId: string
  curriculum: HuntCurriculum
}

/**
 * The runnable bug-hunt scenarios in the approved recommended order,
 * with their curriculum metadata attached. Derived from the existing
 * registries; throws nothing — a missing scenario is skipped rather than
 * rendered as a fake entry.
 */
export function getRecommendedPath(): RecommendedPathItem[] {
  return recommendedHuntScenarioIds.flatMap((id, index) => {
    const scenario = scenarios.find((entry) => entry.id === id)
    if (!scenario || !scenario.huntId || !scenario.curriculum) {
      return []
    }
    return [
      {
        position: index + 1,
        scenario,
        huntId: scenario.huntId,
        curriculum: scenario.curriculum,
      },
    ]
  })
}

/** Map a progress payload onto hunt entries by hunt id. */
export function progressByHuntId(
  hunts: readonly ProgressHuntEntry[],
): Map<string, ProgressHuntEntry> {
  return new Map(hunts.map((entry) => [entry.huntId, entry]))
}

/**
 * The next exercise on the recommended path: the first entry whose hunt has
 * no submitted report yet. `null` means one of two things, and callers
 * distinguish them by the argument they passed:
 *
 * - `progressByHunt === null` — progress is unavailable; callers treat this
 *   as "show the first item without claiming completion state".
 * - otherwise — every recommended item is complete; callers treat this as
 *   the all-caught-up state.
 *
 * Simple fixed-order rule — no personalisation, no scoring, no AI.
 */
export function findNextPathItem(
  progressByHunt: ReadonlyMap<string, ProgressHuntEntry> | null,
): RecommendedPathItem | null {
  const items = getRecommendedPath()
  if (!progressByHunt) {
    return items[0] ?? null
  }
  return (
    items.find(({ huntId }) => completionForEntry(progressByHunt.get(huntId)) !== 'completed') ??
    null
  )
}
