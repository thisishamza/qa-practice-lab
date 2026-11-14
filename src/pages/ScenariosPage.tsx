import { useState } from 'react'
import {
  defaultScenarioFilters,
  filterScenarios,
  type ScenarioFilters,
} from '../lib/catalog'
import { scenarios } from '../data/scenarios'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { EmptyState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { ScenarioFilterBar } from '../features/catalog/ScenarioFilterBar'
import { ScenarioCard } from '../features/catalog/ScenarioCard'

export function ScenariosPage() {
  useDocumentTitle('Scenario catalog')

  const [filters, setFilters] = useState<ScenarioFilters>(defaultScenarioFilters)
  const filtered = filterScenarios(scenarios, filters)

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Catalogue"
        title="Scenario catalog"
        description="Every planned exercise in one searchable place. Filter by track, difficulty, mode, or availability status."
      />

      <Callout tone="info" title="All scenarios are placeholders">
        Search and filtering are fully functional. The scenarios themselves are not
        runnable yet, so every entry carries a planned or in-design status.
      </Callout>

      <ScenarioFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(defaultScenarioFilters)}
        resultCount={filtered.length}
        totalCount={scenarios.length}
      />

      {filtered.length > 0 ? (
        <div className="scenario-grid" aria-live="polite">
          {filtered.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No scenarios match those filters"
          description="Try a broader search, a different track, or reset the filters to see the full catalogue."
          icon="filter"
          action={
            <button
              type="button"
              className="button button-small"
              onClick={() => setFilters(defaultScenarioFilters)}
            >
              <Icon name="reset" size={15} />
              Reset filters
            </button>
          }
        />
      )}
    </div>
  )
}
