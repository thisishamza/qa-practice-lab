import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const SIDEBAR_STORAGE_KEY = 'qa-practice-lab-sidebar-collapsed'

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <TopBar
        mobileOpen={mobileOpen}
        onOpenMobileNav={() => setMobileOpen(true)}
      />

      <div className="app-body">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
        />

        <main id="main-content" className="app-main" tabIndex={-1}>
          <div className="page-container">
            <Outlet />
          </div>

          <footer className="site-footer">
            <p>
              QA Practice Lab · built in verifiable phases. No AI service is required at
              runtime.
            </p>
            <p className="footer-meta">Phase 2 · v0.2.0</p>
          </footer>
        </main>
      </div>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  )
}
