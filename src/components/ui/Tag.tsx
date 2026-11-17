import type { ReactNode } from 'react'
import type { ScenarioStatus } from '../../data/types'
import { scenarioStatusLabels } from '../../lib/labels'
import type { IconName } from '../../data/types'
import { Icon } from './Icon'

export type TagTone = 'neutral' | 'ready' | 'in-design' | 'planned' | 'warn'

const statusTagTone: Record<ScenarioStatus, TagTone> = {
  ready: 'ready',
  'in-design': 'in-design',
  planned: 'planned',
}

/** Tones that communicate status get a shaped dot; the label is mandatory. */
const dotTones: ReadonlySet<TagTone> = new Set(['ready', 'in-design', 'planned'])

interface TagProps {
  tone?: TagTone
  /** Only rendered for tones without a status dot. */
  icon?: IconName
  children: ReactNode
  className?: string
}

export function Tag({ tone = 'neutral', icon, children, className }: TagProps) {
  const showDot = dotTones.has(tone)

  return (
    <span className={['tag', `tag-${tone}`, className].filter(Boolean).join(' ')}>
      {showDot ? <span className="tag-dot" aria-hidden="true" /> : null}
      {!showDot && icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </span>
  )
}

/** Status for a scenario/exercise: dot shape + label, never colour alone. */
export function StatusTag({ status }: { status: ScenarioStatus }) {
  return <Tag tone={statusTagTone[status]}>{scenarioStatusLabels[status]}</Tag>
}
