import type { ReactNode } from 'react'
import type { IconName } from '../../data/types'
import { Icon } from './Icon'

export function LoadingState({ label = 'Loading content…' }: { label?: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon = 'search',
  action,
}: {
  title: string
  description: ReactNode
  icon?: IconName
  action?: ReactNode
}) {
  return (
    <div className="state state-empty">
      <span className="state-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: string
  description: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="state state-error" role="alert">
      <span className="state-icon" aria-hidden="true">
        <Icon name="alert" size={20} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  )
}
