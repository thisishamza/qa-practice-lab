import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'

interface TopBarProps {
  mobileOpen: boolean
  onOpenMobileNav: () => void
  menuButtonRef: RefObject<HTMLButtonElement | null>
  inert?: boolean
}

export function TopBar({
  mobileOpen,
  onOpenMobileNav,
  menuButtonRef,
  inert,
}: TopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const locationQuery =
    location.pathname === '/scenarios'
      ? new URLSearchParams(location.search).get('q') ?? ''
      : ''
  const [query, setQuery] = useState(locationQuery)
  const [syncedLocationQuery, setSyncedLocationQuery] = useState(locationQuery)

  if (locationQuery !== syncedLocationQuery) {
    setSyncedLocationQuery(locationQuery)
    setQuery(locationQuery)
  }

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      if (
        document.querySelector('[aria-modal="true"]') ||
        !window.matchMedia('(min-width: 1024px)').matches
      ) {
        return
      }

      event.preventDefault()
      inputRef.current?.focus()
    }

    document.addEventListener('keydown', handleShortcut)

    return () => document.removeEventListener('keydown', handleShortcut)
  }, [])

  function clearSearch() {
    setQuery('')

    if (location.pathname === '/scenarios') {
      const params = new URLSearchParams(location.search)

      if (params.has('q')) {
        params.delete('q')
        navigate(
          {
            pathname: location.pathname,
            search: params.toString(),
          },
          { replace: true },
        )
      }
    }

    inputRef.current?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = query.trim()

    navigate(
      nextQuery ? `/scenarios?q=${encodeURIComponent(nextQuery)}` : '/scenarios',
    )
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape') {
      return
    }

    if (query) {
      clearSearch()
    } else {
      event.currentTarget.blur()
    }
  }

  return (
    <header className="topbar" inert={inert || undefined}>
      <div className="topbar-inner">
        <IconButton
          ref={menuButtonRef}
          label="Open navigation menu"
          className="topbar-menu"
          onClick={onOpenMobileNav}
          aria-controls="mobile-navigation"
          aria-expanded={mobileOpen}
        >
          <Icon name="menu" size={20} />
        </IconButton>

        <Link className="brand" to="/" aria-label="QA Practice Lab overview">
          <span className="brand-mark" aria-hidden="true">
            QA
          </span>
          <span className="brand-copy">
            <span className="brand-name">QA Practice Lab</span>
            <span className="brand-sub">Learning environment</span>
          </span>
        </Link>

        <form className="global-search" role="search" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="global-search-input">
            Search scenarios
          </label>
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            id="global-search-input"
            className="global-search-input"
            type="search"
            placeholder="Search scenarios"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            aria-keyshortcuts="/"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              className="global-search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <Icon name="close" size={15} />
            </button>
          ) : (
            <kbd className="global-search-shortcut" aria-hidden="true">
              /
            </kbd>
          )}
        </form>

        <div className="topbar-actions">
          <Link
            className="icon-button topbar-search-link"
            to="/scenarios"
            aria-label="Search the scenario catalog"
          >
            <Icon name="search" size={18} />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
