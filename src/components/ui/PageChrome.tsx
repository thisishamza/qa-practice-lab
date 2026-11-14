import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`}>
              {item.to && !isCurrent ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={isCurrent ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  id,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  id?: string
}) {
  return (
    <div className="section-header">
      <div>
        <h2 id={id}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-header-action">{action}</div> : null}
    </div>
  )
}
