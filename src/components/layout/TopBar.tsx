import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { useCart } from '../../features/cart/useCart'
import { useAuth } from '../../features/auth/useAuth'
import { searchSite } from '../../lib/siteSearch'

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
  const { cart } = useCart()
  const { customer, loadState } = useAuth()
  const cartCount = cart?.itemCount ?? 0
  const cartLabel =
    cartCount === 0 ? 'Cart, 0 items' : `Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`
  const accountLabel =
    loadState.status === 'ready' && customer
      ? `Account — signed in as ${customer.name}`
      : 'Sign in to the demo storefront'
  const accountText = customer ? customer.name.split(' ')[0] : 'Sign in'
  const accountDestination = customer ? '/account' : '/login'
  const inputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const locationQuery =
    location.pathname === '/scenarios'
      ? new URLSearchParams(location.search).get('q') ?? ''
      : ''
  const [query, setQuery] = useState(locationQuery)
  const [syncedLocationQuery, setSyncedLocationQuery] = useState(locationQuery)
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  if (locationQuery !== syncedLocationQuery) {
    setSyncedLocationQuery(locationQuery)
    setQuery(locationQuery)
  }

  // Navigating anywhere dismisses the results panel (derived-state reset,
  // same pattern as the locationQuery sync above — no effect needed).
  const locationKey = `${location.pathname}?${location.search}`
  const [syncedLocationKey, setSyncedLocationKey] = useState(locationKey)
  if (locationKey !== syncedLocationKey) {
    setSyncedLocationKey(locationKey)
    setPanelOpen(false)
    setActiveId(null)
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

  // Clicking anywhere outside the search container closes the panel.
  useEffect(() => {
    if (!panelOpen) {
      return
    }

    function handleDocumentMouseDown(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        event.target instanceof Node &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setPanelOpen(false)
        setActiveId(null)
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)

    return () => document.removeEventListener('mousedown', handleDocumentMouseDown)
  }, [panelOpen])

  const trimmedQuery = query.trim()
  const groups = useMemo(() => searchSite(trimmedQuery), [trimmedQuery])
  const flatResults = useMemo(() => groups.flatMap((group) => group.results), [groups])
  const panelVisible = panelOpen && trimmedQuery.length > 0
  const activeResult = flatResults.find((result) => result.id === activeId) ?? null

  function closePanel() {
    setPanelOpen(false)
    setActiveId(null)
  }

  function goTo(to: string) {
    closePanel()
    navigate(to)
  }

  function clearSearch() {
    setQuery('')
    closePanel()

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

    if (activeResult) {
      goTo(activeResult.to)
      return
    }

    const nextQuery = query.trim()

    closePanel()
    navigate(
      nextQuery ? `/scenarios?q=${encodeURIComponent(nextQuery)}` : '/scenarios',
    )
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (flatResults.length === 0) {
        return
      }

      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const currentIndex = flatResults.findIndex((result) => result.id === activeId)
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : flatResults.length - 1
          : (currentIndex + direction + flatResults.length) % flatResults.length
      setPanelOpen(true)
      setActiveId(flatResults[nextIndex].id)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      if (activeResult) {
        goTo(activeResult.to)
      } else {
        closePanel()
        navigate(
          trimmedQuery ? `/scenarios?q=${encodeURIComponent(trimmedQuery)}` : '/scenarios',
        )
      }
      return
    }

    if (event.key !== 'Escape') {
      return
    }

    if (query) {
      clearSearch()
    } else {
      closePanel()
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

        <div className="global-search-container" ref={searchContainerRef}>
          <form
            className="global-search"
            role="search"
            onSubmit={handleSubmit}
          >
            <label className="sr-only" htmlFor="global-search-input">
              Search exercises, guides, labs and the practice store
            </label>
            <Icon name="search" size={16} />
            <input
              ref={inputRef}
              id="global-search-input"
              className="global-search-input"
              type="search"
              placeholder="Search exercises, guides, labs, store"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPanelOpen(true)
                setActiveId(null)
              }}
              onFocus={() => setPanelOpen(true)}
              onKeyDown={handleInputKeyDown}
              aria-keyshortcuts="/"
              aria-expanded={panelVisible}
              aria-controls="global-search-results"
              aria-autocomplete="list"
              aria-activedescendant={activeResult ? `global-search-option-${activeResult.id}` : undefined}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
            />
            {query ? (
              <button
                type="button"
                className="global-search-clear"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <Icon name="close" size={16} />
              </button>
            ) : (
              <kbd className="global-search-shortcut" aria-hidden="true">
                /
              </kbd>
            )}
          </form>

          {panelVisible ? (
            <div
              id="global-search-results"
              className="search-results"
              role="listbox"
              aria-label="Search results"
            >
              {flatResults.length === 0 ? (
                <p className="search-results-empty">
                  No matches for “{trimmedQuery}”.{' '}
                  <Link to={`/scenarios?q=${encodeURIComponent(trimmedQuery)}`} onClick={closePanel}>
                    Search the scenario catalogue
                  </Link>
                </p>
              ) : (
                <>
                  {groups.map((group) => (
                    <div key={group.type} className="search-results-group" role="group" aria-label={group.label}>
                      <p className="search-results-heading" role="presentation">
                        {group.label}
                      </p>
                      {group.results.map((result) => (
                        <div
                          key={result.id}
                          id={`global-search-option-${result.id}`}
                          className={`search-result${result.id === activeId ? ' is-active' : ''}`}
                          role="option"
                          aria-selected={result.id === activeId}
                          onMouseEnter={() => setActiveId(result.id)}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            goTo(result.to)
                          }}
                        >
                          <span className="search-result-title">{result.title}</span>
                          <span className="search-result-context">{result.context}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <Link
                    className="search-results-more"
                    to={`/scenarios?q=${encodeURIComponent(trimmedQuery)}`}
                    onClick={closePanel}
                  >
                    See all catalogue matches for “{trimmedQuery}”
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="topbar-actions">
          <Link className="icon-button topbar-search-link" to="/scenarios" aria-label="Search the exercises catalogue">
            <Icon name="search" size={20} />
          </Link>
          <Link className="icon-button topbar-cart" to="/cart" aria-label={cartLabel}>
            <Icon name="cart" size={20} />
            {cartCount > 0 ? (
              <span className="cart-badge" aria-hidden="true">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Link>
          <Link className="topbar-account" to={accountDestination} aria-label={accountLabel}>
            <Icon name="user" size={20} />
            <span className="topbar-account-label">{accountText}</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
