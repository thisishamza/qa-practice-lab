import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isNavItemActive, primaryNav } from '../../lib/navigation'
import { Icon } from '../ui/Icon'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { pathname } = useLocation()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    closeButtonRef.current?.focus()
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="mobile-nav-layer">
      <button
        type="button"
        className="mobile-nav-backdrop"
        aria-label="Close navigation menu"
        onClick={onClose}
      />
      <div
        id="mobile-navigation"
        className="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="mobile-nav-head">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">
              QA
            </span>
            <span className="brand-name">QA Practice Lab</span>
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="mobile-nav-list" aria-label="Primary">
          {primaryNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`mobile-nav-link${isNavItemActive(item, pathname) ? ' is-active' : ''}`}
              aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
              onClick={onClose}
            >
              <Icon name={item.icon} size={19} />
              <span>
                <span className="mobile-nav-label">{item.label}</span>
                <span className="mobile-nav-description">{item.description}</span>
              </span>
            </Link>
          ))}
        </nav>

        <p className="mobile-nav-note">
          Phase 2 preview · exercises are not runnable yet
        </p>
      </div>
    </div>
  )
}
