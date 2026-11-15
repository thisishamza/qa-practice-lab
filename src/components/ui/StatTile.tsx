import type { ReactNode } from 'react'

interface StatTileProps {
  /** Mono micro-label; sentence or upper case is the caller's choice. */
  label: string
  value: ReactNode
  hint?: string
}

/**
 * Data tile without decoration: mono label, tabular value, optional context.
 * No icon by design — hierarchy comes from type, not ornament.
 */
export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="stat-tile">
      <p className="stat-tile-label">{label}</p>
      <p className="stat-tile-value">{value}</p>
      {hint ? <p className="stat-tile-hint">{hint}</p> : null}
    </div>
  )
}
