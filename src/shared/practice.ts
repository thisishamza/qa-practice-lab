// Shared contracts for the practice-session mode engine (P3-M7).
// Consumed by the Hono API (src/server/practice.ts) and the browser client
// (src/features/practice/api.ts). Money/IDs never appear here; a hunt summary
// deliberately carries no defect identifiers — defect ids are internal to the
// server registries (src/server/defects.ts) and never leave the server.

export type PracticeSessionMode = 'clean' | 'bug_hunt'

/** Learner-safe hunt summary. Never includes defect ids, hints or repro steps. */
export interface HuntSummary {
  id: string
  title: string
  summary: string
}

export interface PracticeSessionResponse {
  mode: PracticeSessionMode
  /** Present only in bug_hunt mode; null in clean mode. */
  hunt: HuntSummary | null
}
