import { Link, useLocation } from 'react-router-dom'
import { isNavItemActive, navGroups, staffNavItem, utilityNavItem } from '../../lib/navigation'
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

  function renderItems(items: typeof navGroups[number]['items']) {
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
            <Icon name={item.icon} size={20} />
            <span className="side-link-label">{item.label}</span>
          </Link>
        </li>
      )
    })
  }

  return (
    <aside className="sidebar">
      <nav className="side-nav" aria-label="Primary">
        {navGroups.map((group) => (
          <div key={group.id} className={`side-nav-group side-nav-group-${group.id}`}>
            <p className="side-nav-heading">
              {group.icon ? (
                <Icon name={group.icon} size={16} className="side-nav-heading-icon" />
              ) : null}
              {group.label}
            </p>
            <p className="side-nav-note">{group.note}</p>
            <ul>
              {renderItems(group.id === 'practice-app' && isStaff ? [...group.items, staffNavItem] : group.items)}
            </ul>
          </div>
        ))}
      </nav>

      <div className="side-utility">
        <Link
          to={utilityNavItem.to}
          className={`side-link${aboutActive ? ' is-active' : ''}`}
          aria-current={aboutActive ? 'page' : undefined}
          aria-label={collapsed ? utilityNavItem.label : undefined}
          title={collapsed ? utilityNavItem.label : undefined}
        >
          <Icon name={utilityNavItem.icon} size={20} />
          <span className="side-link-label">{utilityNavItem.label}</span>
        </Link>

        <button
          type="button"
          className="side-collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name="panel-left" size={20} />
          <span className="side-link-label">
            {collapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>
      </div>
    </aside>
  )
}
