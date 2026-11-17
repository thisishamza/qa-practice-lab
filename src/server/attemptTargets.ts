// Unified attempt-target registry (Phase 6 M2, plan §10.2).
//
// SQL exercises, SQL hunts (hunt-db-*, kind: 'sql') and UI hunts are all
// attempt-able learning targets stored in the same hunt_attempts table.
// This module is the single place that resolves an attemptable id, so route
// files never re-implement the lookup. Phase 3/4 hunt entries keep their
// catalogue wiring; SQL exercise entries carry no scenarioId.

import { HUNTS, findHunt } from './hunts'
import { SQL_EXERCISES as CLIENT_EXERCISES } from '../data/sqlExercises'
import { findSqlExercise } from './sqlExercises'
import { CONTRACT_EXERCISES as CLIENT_CONTRACT_EXERCISES } from '../data/contractExercises'
import { findContractExercise } from './contractExercises'

export interface AttemptTarget {
  id: string
  title: string
  /** Catalogue scenario the target wires to, if any (SQL/contract exercises: none). */
  scenarioId?: string
  kind: 'ui' | 'sql' | 'contract' | 'exercise'
}

/** Client-safe exercise titles, keyed by id (the client module is safe to read). */
const EXERCISE_TITLES = new Map(CLIENT_EXERCISES.map((exercise) => [exercise.id, exercise.title]))
const CONTRACT_EXERCISE_TITLES = new Map(
  CLIENT_CONTRACT_EXERCISES.map((exercise) => [exercise.id, exercise.title]),
)

function huntKind(hunt: { kind?: 'ui' | 'sql' | 'contract' }): 'ui' | 'sql' | 'contract' {
  if (hunt.kind === 'sql') return 'sql'
  if (hunt.kind === 'contract') return 'contract'
  return 'ui'
}

/** Resolve an attemptable id; null when unknown. */
export function resolveAttemptTarget(id: string): AttemptTarget | null {
  const hunt = findHunt(id)
  if (hunt) {
    return {
      id: hunt.id,
      title: hunt.title,
      scenarioId: hunt.scenarioId,
      kind: huntKind(hunt),
    }
  }
  const exercise = findSqlExercise(id)
  if (exercise) {
    return {
      id: exercise.id,
      title: EXERCISE_TITLES.get(exercise.id) ?? exercise.id,
      kind: 'exercise',
    }
  }
  const contractExercise = findContractExercise(id)
  if (contractExercise) {
    return {
      id: contractExercise.id,
      title: CONTRACT_EXERCISE_TITLES.get(contractExercise.id) ?? contractExercise.id,
      kind: 'exercise',
    }
  }
  return null
}

/** All attemptable targets in registry order (UI hunts, SQL hunts, contract hunts, SQL exercises, contract exercises). */
export function allAttemptTargets(): AttemptTarget[] {
  return [
    ...HUNTS.map((hunt) => ({
      id: hunt.id,
      title: hunt.title,
      scenarioId: hunt.scenarioId,
      kind: huntKind(hunt),
    })),
    ...CLIENT_EXERCISES.map((exercise) => ({
      id: exercise.id,
      title: exercise.title,
      kind: 'exercise' as const,
    })),
    ...CLIENT_CONTRACT_EXERCISES.map((exercise) => ({
      id: exercise.id,
      title: exercise.title,
      kind: 'exercise' as const,
    })),
  ]
}
