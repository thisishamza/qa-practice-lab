interface ProgressBarProps {
  value: number
  max: number
  label?: string
  tone?: 'accent' | 'success' | 'warning'
}

export function ProgressBar({ value, max, label, tone = 'accent' }: ProgressBarProps) {
  const safeMax = Math.max(max, 1)
  const percent = Math.min(100, Math.round((value / safeMax) * 100))

  return (
    <div className="progress">
      {label ? (
        <div className="progress-meta">
          <span>{label}</span>
          <span>
            {value}/{max}
          </span>
        </div>
      ) : null}
      <div
        className={`progress-track progress-${tone}`}
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={value}
      >
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
