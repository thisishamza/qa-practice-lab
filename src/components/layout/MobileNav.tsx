import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isNavItemActive, primaryNav } from '../../lib/navigation'
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
          {primaryNav.map((item) => {
            const active = isNavItemActive(item, pathname)

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`mobile-nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onClose(false)}
              >
                <Icon name={item.icon} size={19} />
                <span>
                  <span className="mobile-nav-label">{item.label}</span>
                  <span className="mobile-nav-description">{item.description}</span>
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="mobile-nav-footer">
          <Link
            to="/about"
            className="mobile-nav-utility"
            aria-current={pathname === '/about' ? 'page' : undefined}
            onClick={() => onClose(false)}
          >
            <Icon name="info" size={17} />
            <span>About this build</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
