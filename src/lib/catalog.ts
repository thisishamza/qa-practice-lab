import type {
  Difficulty,
  Scenario,
  ScenarioMode,
  ScenarioStatus,
  TrackId,
} from '../data/types'

export type FilterValue<T extends string> = T | 'all'

export interface ScenarioFilters {
  query: string
  trackId: FilterValue<TrackId>
  difficulty: FilterValue<Difficulty>
  mode: FilterValue<ScenarioMode>
  status: FilterValue<ScenarioStatus>
}

export const defaultScenarioFilters: ScenarioFilters = {
  query: '',
  trackId: 'all',
  difficulty: 'all',
  mode: 'all',
  status: 'all',
}

export function hasActiveFilters(filters: ScenarioFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.trackId !== 'all' ||
    filters.difficulty !== 'all' ||
    filters.mode !== 'all' ||
    filters.status !== 'all'
  )
}

function searchableText(scenario: Scenario): string {
  return [
    scenario.title,
    scenario.summary,
    scenario.description,
    scenario.id,
    scenario.trackId,
    scenario.trackId.replaceAll('-', ' '),
    scenario.categoryId,
    scenario.categoryId.replaceAll('-', ' '),
    scenario.difficulty,
    scenario.mode,
    scenario.mode.replaceAll('-', ' '),
    scenario.status,
    ...scenario.objectives,
    ...scenario.prerequisites,
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * Pure, UI-independent filtering so the catalogue behaviour can be tested without
 * rendering React.
 */
export function filterScenarios(
  scenarios: readonly Scenario[],
  filters: ScenarioFilters,
): Scenario[] {
  const query = filters.query.trim().toLowerCase()

  return scenarios.filter((scenario) => {
    if (query && !searchableText(scenario).includes(query)) {
      return false
    }

    if (filters.trackId !== 'all' && scenario.trackId !== filters.trackId) {
      return false
    }

    if (filters.difficulty !== 'all' && scenario.difficulty !== filters.difficulty) {
      return false
    }

    if (filters.mode !== 'all' && scenario.mode !== filters.mode) {
      return false
    }

    if (filters.status !== 'all' && scenario.status !== filters.status) {
      return false
    }

    return true
  })
}

export function countScenariosByTrack(
  scenarios: readonly Scenario[],
): Record<string, number> {
  return scenarios.reduce<Record<string, number>>((counts, scenario) => {
    counts[scenario.trackId] = (counts[scenario.trackId] ?? 0) + 1
    return counts
  }, {})
}

export function countScenariosByCategory(
  scenarios: readonly Scenario[],
): Record<string, number> {
  return scenarios.reduce<Record<string, number>>((counts, scenario) => {
    counts[scenario.categoryId] = (counts[scenario.categoryId] ?? 0) + 1
    return counts
  }, {})
}
