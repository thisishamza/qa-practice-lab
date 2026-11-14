import type { ReactNode } from 'react'
import type { IconName } from '../../data/types'
import { Icon } from './Icon'

type CalloutTone = 'info' | 'warning' | 'success' | 'neutral'

const toneIcons: Record<CalloutTone, IconName> = {
  info: 'info',
  warning: 'alert',
  success: 'check',
  neutral: 'sparkles',
}

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
        <Icon name={icon ?? toneIcons[tone]} size={18} />
      </span>
      <div className="callout-body">
        {title ? <p className="callout-title">{title}</p> : null}
        <div className="callout-text">{children}</div>
      </div>
    </div>
  )
}
