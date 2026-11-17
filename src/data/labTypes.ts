// Shared client-safe definition for the final-phase lab exercise catalogues
// (performance / security / microservices). Compiled into the bundle like the
// SQL and contract exercise modules — nothing server-only may live here.

export type LabDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type LabTrack = 'performance-testing' | 'security-testing' | 'async-testing'

export interface LabChecklistItem {
  /** Opaque id transmitted back on submit — carries no answer signal. */
  id: string
  /** Learner-facing label (rendered as a checkbox row). */
  label: string
}

export interface LabExerciseDef {
  id: string
  title: string
  difficulty: LabDifficulty
  estimatedMinutes: number
  /** One line for cards and hub grids. */
  summary: string
  /** One-paragraph QA-oriented framing. */
  qaScenario: string
  objective: string
  /** The specific learner task (imperative). */
  task: string
  /** Opaque selection options; graded server-side. */
  checklist: LabChecklistItem[]
  chips: string[]
  exampleEvidence: string
  relatedGuideIds: string[]
  track: LabTrack
  /** Hub facet. */
  facet: string
}
