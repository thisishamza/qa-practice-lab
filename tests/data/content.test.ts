import { describe, expect, it } from 'vitest'
import { learningTracks } from '../../src/data/tracks'
import { scenarios } from '../../src/data/scenarios'
import { guides } from '../../src/data/guides'
import { testingCategories } from '../../src/data/categories'
import {
  demoActivities,
  demoProgress,
  recommendedScenarioIds,
} from '../../src/data/demo'
import { HUNTS, findHunt } from '../../src/server/hunts'
import type { TrackId } from '../../src/data/types'

const trackIds = new Set<TrackId>(learningTracks.map((track) => track.id))
const scenarioIds = new Set(scenarios.map((scenario) => scenario.id))
const guideIds = new Set(guides.map((guide) => guide.id))
const categoryIds = new Set(testingCategories.map((category) => category.id))

describe('learning tracks', () => {
  it('contains the twelve required tracks', () => {
    expect(learningTracks).toHaveLength(12)
    expect(learningTracks.map((track) => track.name)).toEqual([
      'Manual Testing',
      'API Testing',
      'UI Automation',
      'API Automation',
      'Database Testing',
      'Contract Testing',
      'Performance Testing',
      'Security Testing',
      'Microservices Testing',
      'Event-Driven and Asynchronous Testing',
      'Authentication and Authorisation Testing',
      'Accessibility Testing',
    ])
  })

  it('uses unique ids and valid category references', () => {
    expect(trackIds.size).toBe(learningTracks.length)

    for (const track of learningTracks) {
      expect(track.objectives.length).toBeGreaterThanOrEqual(3)
      expect(track.plannedExerciseCount).toBeGreaterThan(0)
      expect(track.gettingStarted.steps.length).toBeGreaterThanOrEqual(2)
      expect(track.categoryIds.length).toBeGreaterThan(0)
      expect(track.categoryIds.every((id) => categoryIds.has(id))).toBe(true)

      if (track.gettingStarted.guideId) {
        expect(guideIds.has(track.gettingStarted.guideId)).toBe(true)
      }
    }
  })

  it('lists no more placeholders than planned exercises', () => {
    for (const track of learningTracks) {
      const listed = scenarios.filter((scenario) => scenario.trackId === track.id).length
      expect(listed).toBeGreaterThan(0)
      expect(listed).toBeLessThanOrEqual(track.plannedExerciseCount)
    }
  })
})

describe('scenarios', () => {
  it('has unique ids and valid track, category, and guide references', () => {
    expect(scenarioIds.size).toBe(scenarios.length)

    for (const scenario of scenarios) {
      expect(trackIds.has(scenario.trackId)).toBe(true)
      expect(categoryIds.has(scenario.categoryId)).toBe(true)
      expect(scenario.relatedGuideIds.every((id) => guideIds.has(id))).toBe(true)
    }
  })

  it('keeps unwired scenarios non-runnable (Phase 3 wired hunts excepted)', () => {
    for (const scenario of scenarios) {
      if (!scenario.huntId) {
        expect(scenario.runnable).toBe(false)
        expect(scenario.status).not.toBe('ready')
      }
    }
  })

  it('wires the implemented Phase 3 hunt scenarios end to end', () => {
    const wired = scenarios.filter((scenario) => scenario.huntId)
    expect(wired.length).toBe(HUNTS.length)
    for (const scenario of wired) {
      expect(scenario.runnable).toBe(true)
      expect(scenario.status).toBe('ready')
      expect(scenario.mode).toBe('bug-hunt')
      const hunt = findHunt(scenario.huntId as string)
      expect(hunt, `${scenario.id} references missing hunt ${scenario.huntId}`).not.toBeNull()
      expect(hunt?.scenarioId).toBe(scenario.id)
    }
  })

  it('has complete metadata for the detail page', () => {
    for (const scenario of scenarios) {
      expect(scenario.title.length).toBeGreaterThan(10)
      expect(scenario.summary.length).toBeGreaterThan(10)
      expect(scenario.description.length).toBeGreaterThan(40)
      expect(scenario.objectives.length).toBeGreaterThanOrEqual(2)
      expect(scenario.prerequisites.length).toBeGreaterThan(0)
      expect(scenario.estimatedMinutes).toBeGreaterThan(0)
    }
  })

  it('covers every track and both modes', () => {
    expect(new Set(scenarios.map((scenario) => scenario.trackId))).toEqual(trackIds)
    expect(new Set(scenarios.map((scenario) => scenario.mode))).toEqual(
      new Set(['clean', 'bug-hunt']),
    )
  })
})

describe('guides', () => {
  it('has unique ids, valid tracks, and resolvable related scenarios', () => {
    expect(guideIds.size).toBe(guides.length)

    for (const guide of guides) {
      expect(trackIds.has(guide.trackId)).toBe(true)
      expect(guide.relatedScenarioIds.length).toBeGreaterThan(0)
      expect(guide.relatedScenarioIds.every((id) => scenarioIds.has(id))).toBe(true)
    }
  })

  it('supports every required guide section', () => {
    for (const guide of guides) {
      expect(guide.introduction.length).toBeGreaterThan(0)
      expect(guide.concepts.length).toBeGreaterThanOrEqual(3)
      expect(guide.examples.length).toBeGreaterThan(0)
      expect(guide.steps.length).toBeGreaterThanOrEqual(3)
      expect(guide.expectedResults.length).toBeGreaterThan(0)
      expect(guide.commonMistakes.length).toBeGreaterThan(0)
    }
  })
})

describe('demo data', () => {
  it('references real scenarios and tracks', () => {
    expect(demoActivities.every((activity) => scenarioIds.has(activity.scenarioId))).toBe(
      true,
    )
    expect(demoProgress.tracks.every((item) => trackIds.has(item.trackId))).toBe(true)
    expect(recommendedScenarioIds.every((id) => scenarioIds.has(id))).toBe(true)
  })

  it('never describes demo progress as completed beyond its total', () => {
    for (const item of demoProgress.tracks) {
      expect(item.completed).toBeGreaterThanOrEqual(0)
      expect(item.completed).toBeLessThanOrEqual(item.total)
    }
  })
})
