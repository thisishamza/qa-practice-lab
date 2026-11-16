import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useRouteManagement } from '../../lib/useRouteManagement'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ModeBanner } from '../../features/practice/ModeBanner'

const SIDEBAR_STORAGE_KEY = 'qa-practice-lab-sidebar-collapsed'

/** Accessible, non-blocking fallback shown while a route chunk downloads. */
function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="route-fallback-text">Loading page…</span>
    </div>
  )
}

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsedPreference)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useRouteManagement()

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
    } catch {
      // Preference persistence is optional.
    }
  }, [collapsed])

  useEffect(() => {
    if (!mobileOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')

    function handleBreakpointChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setMobileOpen(false)
      }
    }

    desktop.addEventListener('change', handleBreakpointChange)

    return () => desktop.removeEventListener('change', handleBreakpointChange)
  }, [])

  const openMobileNav = useCallback(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : menuButtonRef.current

    setMobileOpen(true)
  }, [])

  const closeMobileNav = useCallback((restoreFocus = true) => {
    setMobileOpen(false)

    if (restoreFocus) {
      const target = returnFocusRef.current ?? menuButtonRef.current

      window.requestAnimationFrame(() => target?.focus())
    }
  }, [])

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content" inert={mobileOpen || undefined}>
        Skip to main content
      </a>

      <TopBar
        mobileOpen={mobileOpen}
        onOpenMobileNav={openMobileNav}
        menuButtonRef={menuButtonRef}
        inert={mobileOpen}
      />

      <div className="app-body" inert={mobileOpen || undefined}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
        />

        <main id="main-content" className="app-main" tabIndex={-1}>
          <div className="page-container">
            <ModeBanner />
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>

          <footer className="site-footer">
            <p>QA Practice Lab · Preview build</p>
            <Link to="/about">About this build</Link>
          </footer>
        </main>
      </div>

      <MobileNav open={mobileOpen} onClose={closeMobileNav} />
    </div>
  )
}
