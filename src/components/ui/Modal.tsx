// Accessible WAI-modal dialog primitive (P4-M2 WP3). The project has no
// dialog dependency; this is a minimal, correctly accessible modal:
// - role="dialog" + aria-modal="true" with aria-labelledby/aria-describedby
// - focus is moved inside on open and trapped while open
// - Escape and backdrop activation both request close (caller decides)
// - focus returns to the element that opened the dialog on close
// - no window.confirm/alert is used anywhere

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'

const focusableSelector =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  /** Accessible name — rendered as the visible heading. */
  title: string
  /** Accessible description — rendered visibly under the title. */
  description?: string
  /** Called on Escape, backdrop activation or the close affordance. Must not perform the destructive action itself. */
  onClose: () => void
  /** Element to focus on open. Defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
}

export function Modal({
  open,
  title,
  description,
  onClose,
  initialFocusRef,
  children,
  className,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  // Always invoke the latest onClose without re-running the open/close
  // effect (and without yanking focus) when the caller re-renders.
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    restoreRef.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const initial =
      initialFocusRef?.current ??
      panel?.querySelector<HTMLElement>(focusableSelector) ??
      panel
    initial?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') {
        return
      }
      const dialog = panelRef.current
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
        if (active === first || active === dialog || !dialog.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      // Restore focus to the element that opened the dialog.
      restoreRef.current?.focus?.()
      restoreRef.current = null
    }
  }, [open, initialFocusRef])

  if (!open) {
    return null
  }

  return (
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={['modal', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="modal-description">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  )
}
