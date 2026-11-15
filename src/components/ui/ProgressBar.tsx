interface ProgressBarProps {
  value: number
  max: number
  label?: string
  tone?: 'accent' | 'success' | 'warning'
}

/**
 * Determinate bar with a numeric fallback: value/max and percentage are always
 * shown as text, so progress never relies on the fill colour or width alone.
 */
export function ProgressBar({ value, max, label, tone = 'accent' }: ProgressBarProps) {
  const safeMax = Math.max(max, 1)
  const safeValue = Math.min(Math.max(value, 0), safeMax)
  const percent = Math.round((safeValue / safeMax) * 100)

  return (
    <div className="progress">
      <div className="progress-meta">
        <span>{label ?? 'Progress'}</span>
        <span>
          {safeValue}/{max} · {percent}%
        </span>
      </div>
      <div
        className={`progress-track progress-${tone}`}
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        aria-valuetext={`${safeValue} of ${max}, ${percent}%`}
      >
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
