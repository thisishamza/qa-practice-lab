import type { HuntCurriculum } from '../shared/huntCurriculum'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type ScenarioMode = 'clean' | 'bug-hunt'

/**
 * Only non-runnable states are used in Phase 2. `ready` exists so later phases can
 * promote a scenario without changing the UI contract.
 */
export type ScenarioStatus = 'planned' | 'in-design' | 'ready'

export type TrackId =
  | 'manual-testing'
  | 'api-testing'
  | 'ui-automation'
  | 'api-automation'
  | 'database-testing'
  | 'contract-testing'
  | 'performance-testing'
  | 'security-testing'
  | 'microservices-testing'
  | 'async-testing'
  | 'auth-testing'
  | 'accessibility-testing'

export type CategoryId =
  | 'functional'
  | 'exploratory'
  | 'automation'
  | 'data'
  | 'integration'
  | 'nonfunctional'
  | 'security-access'
  | 'accessibility'

export type IconName =
  | 'home'
  | 'tracks'
  | 'scenarios'
  | 'guides'
  | 'progress'
  | 'practice'
  | 'manual'
  | 'api'
  | 'ui'
  | 'api-automation'
  | 'database'
  | 'contract'
  | 'performance'
  | 'security'
  | 'microservices'
  | 'async'
  | 'auth'
  | 'accessibility'
  | 'search'
  | 'menu'
  | 'close'
  | 'chevron-right'
  | 'chevron-down'
  | 'sun'
  | 'moon'
  | 'clock'
  | 'check'
  | 'lock'
  | 'sparkles'
  | 'filter'
  | 'arrow-right'
  | 'book'
  | 'bug'
  | 'target'
  | 'alert'
  | 'info'
  | 'grid'
  | 'panel-left'
  | 'reset'
  | 'shop'
  | 'cart'
  | 'minus'
  | 'plus'
  | 'user'
  | 'logout'

export interface GettingStarted {
  summary: string
  steps: string[]
  /** Null means a full guide is not written yet; the steps above still work standalone. */
  guideId: string | null
}

export interface LearningTrack {
  id: TrackId
  name: string
  shortName: string
  tagline: string
  description: string
  difficulty: Difficulty
  icon: IconName
  categoryIds: CategoryId[]
  objectives: string[]
  plannedExerciseCount: number
  gettingStarted: GettingStarted
}

export interface TestingCategory {
  id: CategoryId
  name: string
  description: string
  icon: IconName
}

export interface Scenario {
  id: string
  title: string
  summary: string
  description: string
  trackId: TrackId
  categoryId: CategoryId
  difficulty: Difficulty
  mode: ScenarioMode
  status: ScenarioStatus
  estimatedMinutes: number
  objectives: string[]
  prerequisites: string[]
  /** Phase 2 shipped placeholders only; runnable scenarios arrive in Phase 3. */
  runnable: boolean
  /**
   * The bug-hunt exercise wired to this scenario (a learner-safe hunt id
   * from the server registry). Present only on the Phase 3 hunt scenarios;
   * the hunt summary itself is fetched from the server.
   */
  huntId?: string
  /**
   * Learner-safe curriculum metadata for the wired hunt (Phase 4, WP1).
   * Present only on the seven runnable bug-hunt scenarios; single source
   * of truth is src/shared/huntCurriculum.ts. Nothing here reveals the
   * defect's identity or its fix.
   */
  curriculum?: HuntCurriculum
  relatedGuideIds: string[]
}

export interface GuideConcept {
  term: string
  explanation: string
}

export interface GuideExample {
  title: string
  description: string
  language: string
  code: string
}

export interface GuideStep {
  title: string
  detail: string
}

export interface Guide {
  id: string
  title: string
  trackId: TrackId
  level: Difficulty
  readingMinutes: number
  summary: string
  introduction: string[]
  concepts: GuideConcept[]
  examples: GuideExample[]
  steps: GuideStep[]
  expectedResults: string[]
  commonMistakes: string[]
  relatedScenarioIds: string[]
}

export interface DemoProgressItem {
  trackId: TrackId
  completed: number
  total: number
}

export interface DemoActivity {
  scenarioId: string
  visitedLabel: string
  note: string
}
