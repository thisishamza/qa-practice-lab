import { useEffect, useId, useRef, useState } from 'react'
import type {
  CategoryId,
  Difficulty,
  ScenarioMode,
  ScenarioStatus,
  TrackId,
} from '../../data/types'
import { learningTracks } from '../../data/tracks'
import { testingCategories } from '../../data/categories'
import {
  countActiveFacetFilters,
  hasActiveFilters,
  scenarioSortLabels,
  type ScenarioFilters,
  type ScenarioSort,
} from '../../lib/catalog'
import {
  difficultyLabels,
  difficultyOrder,
  pluralize,
  scenarioModeLabels,
  scenarioStatusLabels,
} from '../../lib/labels'
import { Icon } from '../../components/ui/Icon'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'

const modes: ScenarioMode[] = ['clean', 'bug-hunt']
const statuses: ScenarioStatus[] = ['planned', 'in-design', 'ready']
const sorts: ScenarioSort[] = ['recommended', 'title', 'difficulty', 'time']

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
].join(',')

interface FilterControlsProps {
  idPrefix: string
  filters: ScenarioFilters
  sort: ScenarioSort
  onFiltersChange: (filters: ScenarioFilters) => void
  onSortChange: (sort: ScenarioSort) => void
}

/** The six catalogue controls shared by the desktop grid and the mobile drawer. */
function FilterControls({
  idPrefix,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
}: FilterControlsProps) {
  function update<K extends keyof ScenarioFilters>(key: K, value: ScenarioFilters[K]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <>
      <div className="filter-field">
        <label htmlFor={`${idPrefix}-track`}>Testing track</label>
        <select
          id={`${idPrefix}-track`}
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
        <label htmlFor={`${idPrefix}-difficulty`}>Difficulty</label>
        <select
          id={`${idPrefix}-difficulty`}
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
        <label htmlFor={`${idPrefix}-mode`}>Mode</label>
        <select
          id={`${idPrefix}-mode`}
          value={filters.mode}
          onChange={(event) => update('mode', event.target.value as ScenarioMode | 'all')}
        >
          <option value="all">All modes</option>
          {modes.map((mode) => (
            <option key={mode} value={mode}>
              {scenarioModeLabels[mode]}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor={`${idPrefix}-status`}>Status</label>
        <select
          id={`${idPrefix}-status`}
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

      <div className="filter-field">
        <label htmlFor={`${idPrefix}-hunt`}>Exercise</label>
        <select
          id={`${idPrefix}-hunt`}
          value={filters.hunt}
          onChange={(event) => update('hunt', event.target.value as ScenarioFilters['hunt'])}
        >
          <option value="all">All scenarios</option>
          <option value="available">Bug-hunt exercise available</option>
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor={`${idPrefix}-category`}>Category</label>
        <select
          id={`${idPrefix}-category`}
          value={filters.category}
          onChange={(event) =>
            update('category', event.target.value as CategoryId | 'all')
          }
        >
          <option value="all">All categories</option>
          {testingCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor={`${idPrefix}-sort`}>Sort by</label>
        <select
          id={`${idPrefix}-sort`}
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ScenarioSort)}
        >
          {sorts.map((entry) => (
            <option key={entry} value={entry}>
              {scenarioSortLabels[entry]}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

interface FilterProps {
  filters: ScenarioFilters
  sort: ScenarioSort
  onFiltersChange: (filters: ScenarioFilters) => void
  onSortChange: (sort: ScenarioSort) => void
  onClearAll: () => void
  resultCount: number
  totalCount: number
}

interface Chip {
  key: string
  label: string
  onRemove: () => void
}

function buildChips(
  filters: ScenarioFilters,
  sort: ScenarioSort,
  onFiltersChange: (filters: ScenarioFilters) => void,
  onSortChange: (sort: ScenarioSort) => void,
): Chip[] {
  const chips: Chip[] = []
  const remove = (key: keyof ScenarioFilters) => () =>
    onFiltersChange({ ...filters, [key]: 'all' })

  if (filters.trackId !== 'all') {
    chips.push({
      key: 'track',
      label: `Track: ${learningTracks.find((track) => track.id === filters.trackId)?.name ?? filters.trackId}`,
      onRemove: remove('trackId'),
    })
  }
  if (filters.difficulty !== 'all') {
    chips.push({
      key: 'difficulty',
      label: `Difficulty: ${difficultyLabels[filters.difficulty]}`,
      onRemove: remove('difficulty'),
    })
  }
  if (filters.mode !== 'all') {
    chips.push({
      key: 'mode',
      label: `Mode: ${scenarioModeLabels[filters.mode]}`,
      onRemove: remove('mode'),
    })
  }
  if (filters.status !== 'all') {
    chips.push({
      key: 'status',
      label: `Status: ${scenarioStatusLabels[filters.status]}`,
      onRemove: remove('status'),
    })
  }
  if (filters.hunt !== 'all') {
    chips.push({
      key: 'hunt',
      label: 'Exercise: Bug-hunt available',
      onRemove: remove('hunt'),
    })
  }
  if (filters.category !== 'all') {
    chips.push({
      key: 'category',
      label: `Category: ${testingCategories.find((category) => category.id === filters.category)?.name ?? filters.category}`,
      onRemove: remove('category'),
    })
  }
  if (sort !== 'recommended') {
    chips.push({
      key: 'sort',
      label: `Sort: ${scenarioSortLabels[sort]}`,
      onRemove: () => onSortChange('recommended'),
    })
  }

  return chips
}

export function ScenarioFilterBar({
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  onClearAll,
  resultCount,
  totalCount,
}: FilterProps) {
  const baseId = useId()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const facetCount = countActiveFacetFilters(filters, sort)
  const active = hasActiveFilters(filters) || sort !== 'recommended'
  const chips = buildChips(filters, sort, onFiltersChange, onSortChange)

  useEffect(() => {
    if (!drawerOpen) {
      return
    }

    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDrawerOpen(false)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = dialogRef.current

      if (!dialog) {
        return
      }

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null)

      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey) {
        if (activeElement === first || activeElement === dialog || !dialog.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
      } else if (activeElement === last || !dialog.contains(activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [drawerOpen])

  // Return focus to the trigger when the drawer closes.
  const wasOpen = useRef(drawerOpen)
  useEffect(() => {
    if (wasOpen.current && !drawerOpen) {
      triggerRef.current?.focus()
    }
    wasOpen.current = drawerOpen
  }, [drawerOpen])

  // Close the drawer when resizing to desktop width.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')

    function handleChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setDrawerOpen(false)
      }
    }

    desktop.addEventListener('change', handleChange)
    return () => desktop.removeEventListener('change', handleChange)
  }, [])

  return (
    <div className="filter-panel" role="search" aria-label="Filter scenarios">
      <div className="filter-search">
        <label htmlFor={`${baseId}-search`}>Search scenarios</label>
        <div className="search-input">
          <Icon name="search" size={16} />
          <input
            id={`${baseId}-search`}
            type="search"
            value={filters.query}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onFiltersChange({ ...filters, query: '' })
                event.currentTarget.blur()
              }
            }}
            placeholder="Title, objective, prerequisite, or keyword"
            autoComplete="off"
          />
          {filters.query ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => onFiltersChange({ ...filters, query: '' })}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Desktop + tablet controls */}
      <div className="filter-grid">
        <FilterControls
          idPrefix={`${baseId}-d`}
          filters={filters}
          sort={sort}
          onFiltersChange={onFiltersChange}
          onSortChange={onSortChange}
        />
      </div>

      {/* Mobile controls: sort inline, facets behind a drawer trigger */}
      <div className="filter-mobile-row">
        <div className="filter-field">
          <label htmlFor={`${baseId}-sort-mobile`}>Sort by</label>
          <select
            id={`${baseId}-sort-mobile`}
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ScenarioSort)}
          >
            {sorts.map((entry) => (
              <option key={entry} value={entry}>
                {scenarioSortLabels[entry]}
              </option>
            ))}
          </select>
        </div>
        <button
          ref={triggerRef}
          type="button"
          className="button button-secondary filter-trigger"
          aria-expanded={drawerOpen}
          aria-controls="catalogue-filter-drawer"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <Icon name="filter" size={16} />
          {facetCount > 0 ? `Filters (${facetCount})` : 'Filters'}
        </button>
      </div>

      {chips.length > 0 ? (
        <ul className="filter-chips" aria-label="Applied filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                className="filter-chip"
                onClick={chip.onRemove}
                aria-label={`Remove filter ${chip.label}`}
              >
                {chip.label}
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="filter-footer">
        <p className="filter-count" aria-live="polite">
          Showing <strong>{resultCount}</strong> of {pluralize(totalCount, 'scenario')}
        </p>
        <Button variant="ghost" size="sm" onClick={onClearAll} disabled={!active}>
          <Icon name="reset" size={16} />
          Clear all
        </Button>
      </div>

      {drawerOpen ? (
        <div className="filter-layer">
          <div
            className="filter-backdrop"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            id="catalogue-filter-drawer"
            ref={dialogRef}
            className="filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalogue-filter-drawer-title"
          >
            <div className="filter-drawer-head">
              <h2 id="catalogue-filter-drawer-title" className="filter-drawer-title">
                Filters{facetCount > 0 ? ` (${facetCount})` : ''}
              </h2>
              <IconButton
                ref={closeButtonRef}
                label="Close filters"
                onClick={() => setDrawerOpen(false)}
              >
                <Icon name="close" size={20} />
              </IconButton>
            </div>
            <div className="filter-drawer-body">
              <FilterControls
                idPrefix={`${baseId}-m`}
                filters={filters}
                sort={sort}
                onFiltersChange={onFiltersChange}
                onSortChange={onSortChange}
              />
            </div>
            <div className="filter-drawer-foot">
              <Button variant="ghost" size="sm" onClick={onClearAll} disabled={!active}>
                <Icon name="reset" size={16} />
                Clear all
              </Button>
              <Button size="sm" onClick={() => setDrawerOpen(false)}>
                Show {pluralize(resultCount, 'scenario')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
