import { Link, useLocation } from 'react-router-dom'
import { isNavItemActive, primaryNav, staffNavItem } from '../../lib/navigation'
import { useAuth } from '../../features/auth/useAuth'
import { Icon } from '../ui/Icon'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const { pathname } = useLocation()
  const { customer } = useAuth()
  const isStaff = customer?.role === 'staff' && customer.status === 'active'
  const aboutActive = pathname === '/about'

  function renderItems(items: typeof primaryNav) {
    return items.map((item) => {
      const active = isNavItemActive(item, pathname)

      return (
        <li key={item.to}>
          <Link
            to={item.to}
            className={`side-link${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? item.label : undefined}
          >
            <Icon name={item.icon} size={18} />
            <span className="side-link-label">{item.label}</span>
          </Link>
        </li>
      )
    })
  }

  return (
    <aside className="sidebar">
      <nav className="side-nav" aria-label="Primary">
        <p className="side-nav-heading">Learn</p>
        <ul>{renderItems(primaryNav.slice(0, 4))}</ul>

        <p className="side-nav-heading">Workspace</p>
        <ul>
          {renderItems(primaryNav.slice(4))}
          {isStaff ? renderItems([staffNavItem]) : null}
        </ul>
      </nav>

      <div className="side-utility">
        <Link
          to="/about"
          className={`side-link${aboutActive ? ' is-active' : ''}`}
          aria-current={aboutActive ? 'page' : undefined}
          aria-label={collapsed ? 'About this build' : undefined}
          title={collapsed ? 'About this build' : undefined}
        >
          <Icon name="info" size={18} />
          <span className="side-link-label">About this build</span>
        </Link>

        <button
          type="button"
          className="side-collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name="panel-left" size={17} />
          <span className="side-link-label">
            {collapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>
      </div>
    </aside>
  )
}
