import type { DemoActivity, DemoProgressItem } from './types'

/**
 * Explicitly synthetic dashboard data. Nothing here is persisted or presented as a
 * real learner's record; every surface that renders it also renders `demoDisclaimer`.
 */
export const demoDisclaimer =
  'Sample data for layout demonstration only. Nothing is saved and no exercise was actually completed.'

export const demoProgress = {
  completedExercises: 3,
  inProgressExercises: 2,
  streakDays: 4,
  weeklyGoal: 5,
  tracks: [
    { trackId: 'manual-testing', completed: 2, total: 8 },
    { trackId: 'api-testing', completed: 1, total: 8 },
    { trackId: 'ui-automation', completed: 0, total: 7 },
    { trackId: 'accessibility-testing', completed: 0, total: 6 },
  ] satisfies DemoProgressItem[],
}

export const demoActivities: DemoActivity[] = [
  {
    scenarioId: 'manual-cart-totals',
    visitedLabel: '2 hours ago',
    note: 'Cart pricing charter · sample activity',
  },
  {
    scenarioId: 'api-catalog-pagination',
    visitedLabel: 'Yesterday',
    note: 'Pagination boundary checks · sample activity',
  },
  {
    scenarioId: 'a11y-checkout-keyboard',
    visitedLabel: '3 days ago',
    note: 'Keyboard checkout review · sample activity',
  },
]

export const recommendedScenarioIds = [
  'manual-cart-totals',
  'ui-signin-smoke',
  'api-catalog-pagination',
]
