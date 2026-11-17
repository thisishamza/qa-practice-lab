import { Link, useSearchParams } from 'react-router-dom'
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
import { SQL_EXERCISES } from '../data/sqlExercises'
import { CONTRACT_EXERCISES } from '../data/contractExercises'
import { PERFORMANCE_EXERCISES } from '../data/performanceExercises'
import { SECURITY_EXERCISES } from '../data/securityExercises'
import { EVENT_EXERCISES } from '../data/eventExercises'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { IconName } from '../data/types'
import { PageHeader } from '../components/ui/PageHeader'
import { Breadcrumbs, SectionHeader } from '../components/ui/PageChrome'
import { EmptyState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Callout'
import { ScenarioFilterBar } from '../features/catalog/ScenarioFilterBar'
import { ScenarioCard } from '../features/catalog/ScenarioCard'

export function ScenariosPage() {
  useDocumentTitle('Exercises')

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
  const wiredHunts = scenarios.filter((scenario) => scenario.huntId).length
  const huntCount = (prefix: string) =>
    scenarios.filter((scenario) => scenario.huntId?.startsWith(prefix)).length

  const labs: { to: string; icon: IconName; title: string; exercises: number; hunts: number }[] = [
    { to: '/database', icon: 'database', title: 'SQL playground — Database Testing', exercises: SQL_EXERCISES.length, hunts: huntCount('hunt-db-') },
    { to: '/contract', icon: 'contract', title: 'Contract Testing', exercises: CONTRACT_EXERCISES.length, hunts: huntCount('hunt-contract-') },
    { to: '/performance', icon: 'performance', title: 'Performance Testing', exercises: PERFORMANCE_EXERCISES.length, hunts: huntCount('hunt-perf-') },
    { to: '/security', icon: 'security', title: 'Security Testing', exercises: SECURITY_EXERCISES.length, hunts: huntCount('hunt-sec-') },
    { to: '/microservices', icon: 'microservices', title: 'Microservices & events', exercises: EVENT_EXERCISES.length, hunts: huntCount('hunt-event-') },
  ]

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Exercises' }]} />

      <PageHeader
        eyebrow="Exercises"
        title="Exercises"
        description="One place to find practice — the scenario catalogue below, and the scored lab drills under each workbench. Search the catalogue, then narrow by difficulty, category, mode or status."
      />

      <section className="content-section" aria-labelledby="lab-exercises-title">
        <SectionHeader
          id="lab-exercises-title"
          title="Scored lab exercises"
          description="Hands-on labs — deterministic, synthetic targets with server-scored answers. Each card opens the lab."
        />
        <div className="contract-grid">
          {labs.map((lab) => (
            <Link key={lab.to} className="contract-capability-card" to={lab.to}>
              <h3 className="contract-capability-title">
                <Icon name={lab.icon} size={16} /> {lab.title}
              </h3>
              <p className="contract-capability-copy">
                {lab.exercises} scored exercises · {lab.hunts} bug hunts
              </p>
            </Link>
          ))}
        </div>
        <p className="panel-note">
          API practice lives in the catalogue below — filter by track “API testing” or open the{' '}
          <Link to="/api-lab">API console</Link>.
        </p>
      </section>

      <p className="catalogue-availability">
        {availability.ready} ready · {availability.planned} planned · {availability['in-design']}{' '}
        in design — {wiredHunts} live bug-hunt exercises in the practice shop
      </p>

      <Callout tone="info" title="How to read this catalogue" icon="search">
        Every exercise runs either in <strong>clean mode</strong> — the target behaves as
        specified — or in <strong>bug-hunt mode</strong> — seeded defects you find and report.{' '}
        <Link to="/practice">How bug hunts work</Link>. Ready exercises run today; placeholders
        are labelled and cannot be completed yet.{' '}
        <Link to="/scenarios?hunt=available">Show bug-hunt exercises</Link>
        {' · '}
        <Link to="/scenarios?mode=clean">Show clean-mode exercises</Link>
        {' · '}
        <Link to="/about#evaluation">How scoring works</Link>. Filters live in the URL, so a
        filtered view can be linked or shared.
      </Callout>

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
        <>
          <h2 className="sr-only">Scenario results</h2>
          <div className="scenario-grid">
            {filtered.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </>
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
              <Icon name="reset" size={16} />
              Clear all
            </Button>
          }
        />
      )}
    </div>
  )
}
