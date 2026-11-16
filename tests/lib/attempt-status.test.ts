import { describe, expect, it } from 'vitest'
import {
  ATTEMPT_STATUS_UNAVAILABLE,
  attemptStatusDisplay,
} from '../../src/lib/attemptStatus'

describe('attemptStatusDisplay', () => {
  it('maps none to a neutral Not started chip', () => {
    const display = attemptStatusDisplay('none', null)
    expect(display.label).toBe('Not started')
    expect(display.tone).toBe('neutral')
    expect(display.description).not.toMatch(/found|discover/i)
  })

  it('maps in_progress to In progress', () => {
    const display = attemptStatusDisplay('in_progress', null)
    expect(display.label).toBe('In progress')
    expect(display.tone).toBe('in-design')
  })

  it('maps submitted with a best score to a scored label', () => {
    const display = attemptStatusDisplay('submitted', 82)
    expect(display.label).toBe('Submitted · 82')
    expect(display.tone).toBe('ready')
    expect(display.description).toContain('82')
  })

  it('maps submitted without a best score to a plain Submitted label', () => {
    const display = attemptStatusDisplay('submitted', null)
    expect(display.label).toBe('Submitted')
    expect(display.tone).toBe('ready')
    expect(display.description).not.toContain('100')
  })

  it('ignores the score for revealed attempts — a reveal is not a scored completion', () => {
    const display = attemptStatusDisplay('revealed', 95)
    expect(display.label).toBe('Solution viewed')
    expect(display.tone).toBe('planned')
    expect(display.label).not.toContain('95')
    expect(display.description).not.toContain('95')
  })

  it('never mentions discovery — discovery is not derived from attempt status', () => {
    for (const status of ['none', 'in_progress', 'submitted', 'revealed'] as const) {
      const display = attemptStatusDisplay(status, 70)
      expect(display.label).not.toMatch(/found|discover|solved|complete/i)
      expect(display.description).not.toMatch(/you (have )?found|defect (was )?found|solved/i)
    }
  })

  it('describes a revealed attempt as not counting as discovery', () => {
    const display = attemptStatusDisplay('revealed', null)
    expect(display.description).toMatch(/does not count/i)
  })

  it('exposes a neutral unavailable placeholder for missing attempt data', () => {
    expect(ATTEMPT_STATUS_UNAVAILABLE.label).toBe('Status unavailable')
    expect(ATTEMPT_STATUS_UNAVAILABLE.tone).toBe('neutral')
  })
})
