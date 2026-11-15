import type { Difficulty } from '../../data/types'
import { difficultyLabels } from '../../lib/labels'

const levelBars: Record<Difficulty, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
}

interface LevelMeterProps {
  level: Difficulty
  /** When false, the bars are hidden and the level is announced via aria-label. */
  showLabel?: boolean
}

/**
 * Three-bar shape + text label, so difficulty never relies on colour or on
 * bars alone. Bars are decorative; the label (or aria-label) carries meaning.
 */
export function LevelMeter({ level, showLabel = true }: LevelMeterProps) {
  const filled = levelBars[level]
  const label = difficultyLabels[level]

  return (
    <span
      className="level-meter"
      role={showLabel ? undefined : 'img'}
      aria-label={showLabel ? undefined : `Level: ${label}`}
    >
      <span className="level-bars" aria-hidden="true">
        {[0, 1, 2].map((bar) => (
          <span key={bar} className={bar < filled ? 'level-bar is-filled' : 'level-bar'} />
        ))}
      </span>
      {showLabel ? <span className="level-label">{label}</span> : null}
    </span>
  )
}
