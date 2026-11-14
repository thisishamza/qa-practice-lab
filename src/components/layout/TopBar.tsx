import { Link } from 'react-router-dom'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Icon } from '../ui/Icon'

export function TopBar({
  mobileOpen,
  onOpenMobileNav,
}: {
  mobileOpen: boolean
  onOpenMobileNav: () => void
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button
          type="button"
          className="icon-button topbar-menu"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          aria-controls="mobile-navigation"
          aria-expanded={mobileOpen}
        >
          <Icon name="menu" size={20} />
        </button>

        <Link className="brand" to="/" aria-label="QA Practice Lab dashboard">
          <span className="brand-mark" aria-hidden="true">
            QA
          </span>
          <span className="brand-copy">
            <span className="brand-name">QA Practice Lab</span>
            <span className="brand-sub">Learning environment</span>
          </span>
        </Link>

        <div className="topbar-actions">
          <Link className="topbar-search" to="/scenarios" aria-label="Search the scenario catalog">
            <Icon name="search" size={16} />
            <span>Search scenarios</span>
            <kbd>/</kbd>
          </Link>
          <span className="env-pill">
            <span className="env-dot" aria-hidden="true" />
            Phase 2 preview
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
