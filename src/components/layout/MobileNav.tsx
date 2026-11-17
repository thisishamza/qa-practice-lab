import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isNavItemActive, navGroups, staffNavItem, utilityNavItem } from '../../lib/navigation'
import { useAuth } from '../../features/auth/useAuth'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'

interface MobileNavProps {
  open: boolean
  onClose: (restoreFocus?: boolean) => void
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { pathname } = useLocation()
  const { customer } = useAuth()
  const isStaff = customer?.role === 'staff' && customer.status === 'active'
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose(true)
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
      const active = document.activeElement

      if (event.shiftKey) {
        if (
          active === first ||
          active === dialog ||
          !dialog.contains(active)
        ) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="mobile-nav-layer">
      <div
        className="mobile-nav-backdrop"
        aria-hidden="true"
        onClick={() => onClose(true)}
      />
      <div
        ref={dialogRef}
        id="mobile-navigation"
        className="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
      >
        <div className="mobile-nav-head">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">
              QA
            </span>
            <span className="brand-name">QA Practice Lab</span>
          </span>
          <h2 id="mobile-nav-title" className="sr-only">
            Navigation
          </h2>
          <IconButton
            ref={closeButtonRef}
            label="Close navigation menu"
            onClick={() => onClose(true)}
          >
            <Icon name="close" size={20} />
          </IconButton>
        </div>

        <nav className="mobile-nav-list" aria-label="Primary">
          {navGroups.map((group) => (
            <div key={group.id} className={`mobile-nav-group mobile-nav-group-${group.id}`}>
              <p className="mobile-nav-group-heading">
                {group.icon ? (
                  <Icon name={group.icon} size={16} className="mobile-nav-group-heading-icon" />
                ) : null}
                {group.label}
              </p>
              <p className="mobile-nav-group-note">{group.note}</p>
              {(group.id === 'practice-app' && isStaff ? [...group.items, staffNavItem] : group.items).map((item) => {
                const active = isNavItemActive(item, pathname)

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`mobile-nav-link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => onClose(false)}
                  >
                    <Icon name={item.icon} size={20} />
                    <span>
                      <span className="mobile-nav-label">{item.label}</span>
                      <span className="mobile-nav-description">{item.description}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="mobile-nav-footer">
          <Link
            to={utilityNavItem.to}
            className="mobile-nav-utility"
            aria-current={pathname === utilityNavItem.to ? 'page' : undefined}
            onClick={() => onClose(false)}
          >
            <Icon name={utilityNavItem.icon} size={20} />
            <span>{utilityNavItem.label}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
