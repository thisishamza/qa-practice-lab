import type { ReactNode } from 'react'
import type { IconName } from '../../data/types'
import { Icon } from './Icon'

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  icon?: IconName
  className?: string
}

export function Badge({ children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span className={['badge', `badge-${tone}`, className].filter(Boolean).join(' ')}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  )
}
