import type { IconName } from '../../data/types'
import { Icon } from './Icon'

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon: IconName
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint ? <p className="stat-hint">{hint}</p> : null}
      </div>
    </div>
  )
}
