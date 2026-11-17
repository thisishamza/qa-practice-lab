// Final-phase lab exercise catalogue matrix. 12 per lab = 4 beginner +
// 4 intermediate + 4 advanced; ids unique and ≤ 32 chars; checklists are
// non-empty; every server answer key is registered; hints exist for every
// exercise and every wired hunt.
import { describe, expect, it } from 'vitest'
import { PERFORMANCE_EXERCISES } from '../../src/data/performanceExercises'
import { SECURITY_EXERCISES } from '../../src/data/securityExercises'
import { EVENT_EXERCISES } from '../../src/data/eventExercises'
import { LAB_HINTS, LAB_REVEALS } from '../../src/server/labLearning'
import { HUNTS } from '../../src/server/hunts'
import { DEFECTS } from '../../src/server/defects'
import { findLabExercise } from '../../src/server/labExercises'

const LABS = [
  { name: 'performance', exercises: PERFORMANCE_EXERCISES },
  { name: 'security', exercises: SECURITY_EXERCISES },
  { name: 'microservices', exercises: EVENT_EXERCISES },
] as const

const ALL = LABS.flatMap((lab) => lab.exercises)

describe('lab exercise catalogue matrix', () => {
  it('ships exactly 12 exercises per lab, 4 per difficulty', () => {
    for (const lab of LABS) {
      expect(lab.exercises).toHaveLength(12)
      for (const difficulty of ['beginner', 'intermediate', 'advanced'] as const) {
        expect(
          lab.exercises.filter((exercise) => exercise.difficulty === difficulty),
          `${lab.name} ${difficulty}`,
        ).toHaveLength(4)
      }
    }
    expect(ALL).toHaveLength(36)
  })

  it('uses unique, ≤ 32-char, lowercase-hyphen ids', () => {
    const seen = new Set<string>()
    for (const exercise of ALL) {
      expect(exercise.id, exercise.id).toMatch(/^[a-z0-9][a-z0-9-]{2,31}$/)
      expect(seen.has(exercise.id)).toBe(false)
      seen.add(exercise.id)
    }
  })

  it('every exercise carries the required learner-facing fields', () => {
    for (const exercise of ALL) {
      expect(exercise.title).toBeTruthy()
      expect(exercise.summary).toBeTruthy()
      expect(exercise.qaScenario).toBeTruthy()
      expect(exercise.task).toBeTruthy()
      expect(exercise.checklist.length).toBeGreaterThanOrEqual(5)
      expect(new Set(exercise.checklist.map((item) => item.id)).size).toBe(exercise.checklist.length)
      expect(exercise.estimatedMinutes).toBeGreaterThan(0)
      expect(exercise.chips.length).toBeGreaterThan(0)
      expect(exercise.relatedGuideIds.length).toBeGreaterThan(0)
    }
  })

  it('every exercise is registered server-side with a non-empty answer key and 3 hints + a reveal', () => {
    for (const exercise of ALL) {
      expect(findLabExercise(exercise.id), exercise.id).not.toBeNull()
      expect(LAB_HINTS[exercise.id], `hints for ${exercise.id}`).toHaveLength(3)
      expect(LAB_REVEALS[exercise.id], `reveal for ${exercise.id}`).toBeTruthy()
    }
  })

  it('every new hunt has 3 hints, a reveal and a registered defect', () => {
    const LAB_HUNT_IDS = ['hunt-perf-001', 'hunt-perf-002', 'hunt-perf-003', 'hunt-sec-001', 'hunt-sec-002', 'hunt-sec-003', 'hunt-event-001', 'hunt-event-002', 'hunt-event-003']
    for (const huntId of LAB_HUNT_IDS) {
      const hunt = HUNTS.find((entry) => entry.id === huntId)
      expect(hunt, huntId).toBeTruthy()
      expect(LAB_HINTS[huntId], `hints for ${huntId}`).toHaveLength(3)
      expect(LAB_REVEALS[huntId], `reveal for ${huntId}`).toBeTruthy()
      for (const defectId of hunt?.defectIds ?? []) {
        expect(DEFECTS.some((defect) => defect.id === defectId), `${defectId} registered`).toBe(true)
      }
    }
  })
})
