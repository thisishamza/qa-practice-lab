import type { Difficulty, ScenarioMode, ScenarioStatus } from '../data/types'

export const difficultyLabels: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export const difficultyOrder: Difficulty[] = ['beginner', 'intermediate', 'advanced']

export const scenarioModeLabels: Record<ScenarioMode, string> = {
  clean: 'Clean mode',
  'bug-hunt': 'Bug hunt',
}

export const scenarioStatusLabels: Record<ScenarioStatus, string> = {
  planned: 'Planned',
  'in-design': 'In design',
  ready: 'Ready',
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function scenarioStatusTone(
  status: ScenarioStatus,
): 'neutral' | 'info' | 'success' {
  if (status === 'ready') {
    return 'success'
  }

  if (status === 'in-design') {
    return 'info'
  }

  return 'neutral'
}
