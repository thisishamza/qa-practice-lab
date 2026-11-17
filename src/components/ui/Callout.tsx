import type { ReactNode } from 'react'
import type { IconName } from '../../data/types'
import { Icon } from './Icon'

type CalloutTone = 'info' | 'warning' | 'success' | 'danger' | 'neutral'

const toneIcons: Record<CalloutTone, IconName> = {
  info: 'info',
  warning: 'alert',
  success: 'check',
  danger: 'alert',
  neutral: 'info',
}

/**
 * Rule-based callout: 3 px left rule + label + copy on a sunken surface.
 * Full danger tint is reserved for blocking errors. Never colour alone —
 * the icon and title carry the tone as well.
 */
export function Callout({
  tone = 'info',
  title,
  children,
  icon,
}: {
  tone?: CalloutTone
  title?: string
  children: ReactNode
  icon?: IconName
}) {
  return (
    <div className={`callout callout-${tone}`}>
      <span className="callout-icon" aria-hidden="true">
        <Icon name={icon ?? toneIcons[tone]} size={16} />
      </span>
      <div className="callout-body">
        {title ? <p className="callout-title">{title}</p> : null}
        <div className="callout-text">{children}</div>
      </div>
    </div>
  )
}
