import type { Difficulty, ScenarioMode, ScenarioStatus } from '../../data/types'
import {
  difficultyLabels,
  scenarioModeLabels,
  scenarioStatusLabels,
  scenarioStatusTone,
} from '../../lib/labels'
import { Badge } from './Badge'

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const tone =
    difficulty === 'beginner'
      ? 'success'
      : difficulty === 'intermediate'
        ? 'info'
        : 'warning'

  return <Badge tone={tone}>{difficultyLabels[difficulty]}</Badge>
}

export function ModeBadge({ mode }: { mode: ScenarioMode }) {
  return (
    <Badge tone={mode === 'clean' ? 'accent' : 'warning'} icon={mode === 'clean' ? 'check' : 'bug'}>
      {scenarioModeLabels[mode]}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: ScenarioStatus }) {
  return (
    <Badge
      tone={scenarioStatusTone(status)}
      icon={status === 'ready' ? 'check' : 'lock'}
    >
      {scenarioStatusLabels[status]}
    </Badge>
  )
}
