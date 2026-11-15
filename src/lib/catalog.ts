import type {
  CategoryId,
  Difficulty,
  Scenario,
  ScenarioMode,
  ScenarioStatus,
  TrackId,
} from '../data/types'
import { difficultyOrder } from './labels'

export type FilterValue<T extends string> = T | 'all'

export interface ScenarioFilters {
  query: string
  trackId: FilterValue<TrackId>
  difficulty: FilterValue<Difficulty>
  mode: FilterValue<ScenarioMode>
  status: FilterValue<ScenarioStatus>
  category: FilterValue<CategoryId>
}

export type ScenarioSort = 'recommended' | 'title' | 'difficulty' | 'time'

export const defaultScenarioFilters: ScenarioFilters = {
  query: '',
  trackId: 'all',
  difficulty: 'all',
  mode: 'all',
  status: 'all',
  category: 'all',
}

export const defaultScenarioSort: ScenarioSort = 'recommended'

export const scenarioSortLabels: Record<ScenarioSort, string> = {
  recommended: 'Recommended',
  title: 'Title A–Z',
  difficulty: 'Difficulty',
  time: 'Time (shortest)',
}

const trackIds: readonly TrackId[] = [
  'manual-testing',
  'api-testing',
  'ui-automation',
  'api-automation',
  'database-testing',
  'contract-testing',
  'performance-testing',
  'security-testing',
  'microservices-testing',
  'async-testing',
  'auth-testing',
  'accessibility-testing',
]
const categoryIds: readonly CategoryId[] = [
  'functional',
  'exploratory',
  'automation',
  'data',
  'integration',
  'nonfunctional',
  'security-access',
  'accessibility',
]
const difficulties: readonly Difficulty[] = ['beginner', 'intermediate', 'advanced']
const modes: readonly ScenarioMode[] = ['clean', 'bug-hunt']
const statuses: readonly ScenarioStatus[] = ['planned', 'in-design', 'ready']
const sorts: readonly ScenarioSort[] = ['recommended', 'title', 'difficulty', 'time']

function parseEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
): FilterValue<T> {
  return allowed.includes(value as T) ? (value as T) : 'all'
}

function parseSort(value: string | null): ScenarioSort {
  return sorts.includes(value as ScenarioSort)
    ? (value as ScenarioSort)
    : defaultScenarioSort
}

/**
 * Parse catalogue state from the URL. Unknown or invalid values fall back to
 * the default rather than throwing or producing an empty catalogue by accident.
 */
export function filtersFromSearchParams(searchParams: URLSearchParams): ScenarioFilters {
  return {
    query: searchParams.get('q') ?? '',
    trackId: parseEnum(searchParams.get('track'), trackIds),
    difficulty: parseEnum(searchParams.get('difficulty'), difficulties),
    mode: parseEnum(searchParams.get('mode'), modes),
    status: parseEnum(searchParams.get('status'), statuses),
    category: parseEnum(searchParams.get('category'), categoryIds),
  }
}

export function sortFromSearchParams(searchParams: URLSearchParams): ScenarioSort {
  return parseSort(searchParams.get('sort'))
}

/** Serialize catalogue state back to the URL, dropping default values. */
export function buildSearchParams(
  filters: ScenarioFilters,
  sort: ScenarioSort = defaultScenarioSort,
): URLSearchParams {
  const params = new URLSearchParams()
  const query = filters.query.trim()

  if (query) {
    params.set('q', query)
  }
  if (filters.trackId !== 'all') {
    params.set('track', filters.trackId)
  }
  if (filters.difficulty !== 'all') {
    params.set('difficulty', filters.difficulty)
  }
  if (filters.mode !== 'all') {
    params.set('mode', filters.mode)
  }
  if (filters.status !== 'all') {
    params.set('status', filters.status)
  }
  if (filters.category !== 'all') {
    params.set('category', filters.category)
  }
  if (sort !== defaultScenarioSort) {
    params.set('sort', sort)
  }

  return params
}

export function hasActiveFilters(filters: ScenarioFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.trackId !== 'all' ||
    filters.difficulty !== 'all' ||
    filters.mode !== 'all' ||
    filters.status !== 'all' ||
    filters.category !== 'all'
  )
}

/** Number of non-default facet selects (q excluded; search has its own control). */
export function countActiveFacetFilters(
  filters: ScenarioFilters,
  sort: ScenarioSort = defaultScenarioSort,
): number {
  let count =
    Number(filters.trackId !== 'all') +
    Number(filters.difficulty !== 'all') +
    Number(filters.mode !== 'all') +
    Number(filters.status !== 'all') +
    Number(filters.category !== 'all')

  if (sort !== defaultScenarioSort) {
    count += 1
  }

  return count
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

    if (filters.category !== 'all' && scenario.categoryId !== filters.category) {
      return false
    }

    return true
  })
}

const difficultyRank: Record<Difficulty, number> = Object.fromEntries(
  difficultyOrder.map((difficulty, index) => [difficulty, index]),
) as Record<Difficulty, number>

/** Stable sort; 'recommended' preserves the authored catalogue order. */
export function sortScenarios(
  filtered: readonly Scenario[],
  sort: ScenarioSort,
): Scenario[] {
  const result = [...filtered]

  switch (sort) {
    case 'title':
      return result.sort((a, b) => a.title.localeCompare(b.title))
    case 'difficulty':
      return result.sort(
        (a, b) =>
          difficultyRank[a.difficulty] - difficultyRank[b.difficulty] ||
          a.title.localeCompare(b.title),
      )
    case 'time':
      return result.sort(
        (a, b) => a.estimatedMinutes - b.estimatedMinutes || a.title.localeCompare(b.title),
      )
    default:
      return result
  }
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

export function countScenariosByStatus(
  scenarios: readonly Scenario[],
): Record<ScenarioStatus, number> {
  return scenarios.reduce<Record<ScenarioStatus, number>>(
    (counts, scenario) => {
      counts[scenario.status] += 1
      return counts
    },
    { planned: 0, 'in-design': 0, ready: 0 },
  )
}
