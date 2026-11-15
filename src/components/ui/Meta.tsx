import { Fragment, type ReactNode } from 'react'

/**
 * Inline dot-separated meta text (no pills). Items that are null/false are
 * dropped. Separators are aria-hidden because the dot is decorative.
 */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]

  return (
    <div className={['meta-row', className].filter(Boolean).join(' ')}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span className="meta-sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          {item}
        </Fragment>
      ))}
    </div>
  )
}
