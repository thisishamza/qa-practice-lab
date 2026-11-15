import type {
  Difficulty,
  ScenarioMode,
  ScenarioStatus,
  TrackId,
} from '../../data/types'
import { learningTracks } from '../../data/tracks'
import { hasActiveFilters, type ScenarioFilters } from '../../lib/catalog'
import {
  difficultyLabels,
  difficultyOrder,
  pluralize,
  scenarioModeLabels,
  scenarioStatusLabels,
} from '../../lib/labels'
import { Icon } from '../../components/ui/Icon'
import { Button } from '../../components/ui/Button'

const modes: ScenarioMode[] = ['clean', 'bug-hunt']
const statuses: ScenarioStatus[] = ['planned', 'in-design']

interface FilterProps {
  filters: ScenarioFilters
  onChange: (filters: ScenarioFilters) => void
  onReset: () => void
  resultCount: number
  totalCount: number
}

export function ScenarioFilterBar({
  filters,
  onChange,
  onReset,
  resultCount,
  totalCount,
}: FilterProps) {
  const active = hasActiveFilters(filters)

  function update<K extends keyof ScenarioFilters>(key: K, value: ScenarioFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <form
      className="filter-panel"
      role="search"
      aria-label="Filter scenarios"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="filter-search">
        <label htmlFor="scenario-search">Search scenarios</label>
        <div className="search-input">
          <Icon name="search" size={17} />
          <input
            id="scenario-search"
            type="search"
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
            placeholder="Title, objective, prerequisite, or keyword"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="filter-grid">
        <div className="filter-field">
          <label htmlFor="filter-track">Testing track</label>
          <select
            id="filter-track"
            value={filters.trackId}
            onChange={(event) => update('trackId', event.target.value as TrackId | 'all')}
          >
            <option value="all">All tracks</option>
            {learningTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="filter-difficulty">Difficulty</label>
          <select
            id="filter-difficulty"
            value={filters.difficulty}
            onChange={(event) =>
              update('difficulty', event.target.value as Difficulty | 'all')
            }
          >
            <option value="all">Any difficulty</option>
            {difficultyOrder.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficultyLabels[difficulty]}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="filter-mode">Mode</label>
          <select
            id="filter-mode"
            value={filters.mode}
            onChange={(event) => update('mode', event.target.value as ScenarioMode | 'all')}
          >
            <option value="all">Clean and bug hunt</option>
            {modes.map((mode) => (
              <option key={mode} value={mode}>
                {scenarioModeLabels[mode]}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) =>
              update('status', event.target.value as ScenarioStatus | 'all')
            }
          >
            <option value="all">Any status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {scenarioStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-footer">
        <p className="filter-count" aria-live="polite">
          Showing <strong>{resultCount}</strong> of {pluralize(totalCount, 'scenario')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={!active}
        >
          <Icon name="reset" size={15} />
          Reset filters
        </Button>
      </div>
    </form>
  )
}
