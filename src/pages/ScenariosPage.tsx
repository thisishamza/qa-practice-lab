import { useSearchParams } from 'react-router-dom'
import {
  buildSearchParams,
  countScenariosByStatus,
  defaultScenarioFilters,
  defaultScenarioSort,
  filterScenarios,
  filtersFromSearchParams,
  sortFromSearchParams,
  sortScenarios,
  type ScenarioFilters,
  type ScenarioSort,
} from '../lib/catalog'
import { scenarios } from '../data/scenarios'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { Button } from '../components/ui/Button'
import { ScenarioFilterBar } from '../features/catalog/ScenarioFilterBar'
import { ScenarioCard } from '../features/catalog/ScenarioCard'

export function ScenariosPage() {
  useDocumentTitle('Scenario catalog')

  const [searchParams, setSearchParams] = useSearchParams()

  // The URL is the single source of truth for catalogue state.
  const filters = filtersFromSearchParams(searchParams)
  const sort = sortFromSearchParams(searchParams)

  function applyState(nextFilters: ScenarioFilters, nextSort: ScenarioSort, replace: boolean) {
    setSearchParams(buildSearchParams(nextFilters, nextSort), { replace })
  }

  function handleFiltersChange(nextFilters: ScenarioFilters) {
    // Text input edits replace the current history entry; facet changes are pushed.
    const typing = nextFilters.query !== filters.query
    applyState(nextFilters, sort, typing)
  }

  function handleSortChange(nextSort: ScenarioSort) {
    applyState(filters, nextSort, false)
  }

  function handleClearAll() {
    applyState(defaultScenarioFilters, defaultScenarioSort, true)
  }

  const filtered = sortScenarios(filterScenarios(scenarios, filters), sort)
  const availability = countScenariosByStatus(scenarios)

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Catalogue"
        title="Scenario catalogue"
        description="Every planned exercise in one place — search by skill or track, then narrow by difficulty, category, mode or status."
      />

      <p className="catalogue-availability">
        Not runnable yet — {availability['in-design']} in design · {availability.planned}{' '}
        planned · {availability.ready} ready
      </p>

      <ScenarioFilterBar
        filters={filters}
        sort={sort}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
        onClearAll={handleClearAll}
        resultCount={filtered.length}
        totalCount={scenarios.length}
      />

      {filtered.length > 0 ? (
        <div className="scenario-grid">
          {filtered.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No scenarios match those filters"
          description={
            filters.query
              ? `Nothing matches “${filters.query}” with the current filters. Try a broader term or clear the filters.`
              : 'The current filters exclude everything. Try removing some of them to see more of the catalogue.'
          }
          icon="filter"
          action={
            <Button size="sm" onClick={handleClearAll}>
              <Icon name="reset" size={15} />
              Clear all
            </Button>
          }
        />
      )}
    </div>
  )
}
