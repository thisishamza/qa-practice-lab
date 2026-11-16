// Shared contracts for the practice-session mode engine (P3-M7, list wiring
// in P3-M8). Consumed by the Hono API (src/server/practice.ts) and the
// browser client (src/features/practice/api.ts). Money/IDs never appear
// here; a hunt summary deliberately carries no defect identifiers — defect
// ids are internal to the server registries (src/server/defects.ts) and
// never leave the server.

import type { HuntCurriculum } from './huntCurriculum'

export type PracticeSessionMode = 'clean' | 'bug_hunt'

/**
 * Learner-safe hunt summary. Never includes defect ids, hints or repro
 * steps. `scenarioId` points at the catalogue scenario that teaches the
 * exercise; null when the hunt has no catalogue wiring. `curriculum` is the
 * learner-safe curriculum metadata (Phase 4, WP1): what the exercise
 * practises, never the answer.
 */
export interface HuntSummary {
  id: string
  title: string
  summary: string
  scenarioId: string | null
  curriculum?: HuntCurriculum
}

/** Learner-safe list of the available hunts (server registry order). */
export interface HuntListResponse {
  data: HuntSummary[]
}

export interface PracticeSessionResponse {
  mode: PracticeSessionMode
  /** Present only in bug_hunt mode; null in clean mode. */
  hunt: HuntSummary | null
}
