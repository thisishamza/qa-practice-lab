import { Link, useLocation } from 'react-router-dom'
import { isNavItemActive, primaryNav } from '../../lib/navigation'
import { Icon } from '../ui/Icon'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const { pathname } = useLocation()

  return (
    <aside className="sidebar" aria-label="Primary">
      <nav className="side-nav">
        <p className="side-nav-heading">{collapsed ? '—' : 'Learn'}</p>
        <ul>
          {primaryNav.slice(0, 4).map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`side-link${isNavItemActive(item, pathname) ? ' is-active' : ''}`}
                aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span className="side-link-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="side-nav-heading">{collapsed ? '—' : 'Practice'}</p>
        <ul>
          {primaryNav.slice(4).map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`side-link${isNavItemActive(item, pathname) ? ' is-active' : ''}`}
                aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span className="side-link-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {collapsed ? null : (
        <div className="side-card">
          <span className="side-card-icon" aria-hidden="true">
            <Icon name="sparkles" size={16} />
          </span>
          <p className="side-card-title">Structure first</p>
          <p className="side-card-text">
            All exercises are placeholders. Content and UI are real; runnable practice
            targets arrive in a later phase.
          </p>
        </div>
      )}

      <button
        type="button"
        className="side-collapse"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon name="panel-left" size={17} />
        <span className="side-link-label">{collapsed ? 'Expand' : 'Collapse'}</span>
      </button>
    </aside>
  )
}
