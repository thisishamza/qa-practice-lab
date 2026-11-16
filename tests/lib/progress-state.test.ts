// Unit tests for the pure progress-fetch state resolver (P4 follow-up).
// A failed refresh must never wipe an already-rendered dashboard.
import { describe, expect, it } from 'vitest'
import { resolveProgressState } from '../../src/features/progress/useProgress'
import type { ProgressResponse } from '../../src/shared/learning'

function makeProgress(overrides: Partial<ProgressResponse['totals']> = {}): ProgressResponse {
  return {
    persistence: 'session',
    hunts: [],
    recent: [],
    totals: {
      attempts: 0,
      inProgress: 0,
      submitted: 0,
      revealed: 0,
      reports: 0,
      discovered: 0,
      hintsUsed: 0,
      bestScore: null,
      averageBestScore: null,
      ...overrides,
    },
  }
}

const reload = () => undefined

describe('resolveProgressState', () => {
  it('success resolves to ready, clears the refresh flag and any refresh error', () => {
    const data = makeProgress({ attempts: 2 })
    const state = resolveProgressState(null, { kind: 'success', data }, reload)
    expect(state.status).toBe('ready')
    if (state.status === 'ready') {
      expect(state.data).toBe(data)
      expect(state.refreshing).toBe(false)
      expect(state.refreshError).toBeNull()
      expect(state.onRefresh).toBe(reload)
    }
  })

  it('error with no previously rendered payload resolves to the full-page error state', () => {
    const state = resolveProgressState(null, { kind: 'error', message: 'boom' }, reload)
    expect(state).toEqual({ status: 'error', message: 'boom', onRetry: reload })
  })

  it('error with a previously rendered payload keeps the stale data and flags it', () => {
    const lastGood = makeProgress({ attempts: 5, discovered: 1 })
    const state = resolveProgressState(lastGood, { kind: 'error', message: 'API down' }, reload)
    expect(state.status).toBe('ready')
    if (state.status === 'ready') {
      expect(state.data).toBe(lastGood)
      expect(state.refreshError).toBe('API down')
      expect(state.refreshing).toBe(false)
    }
  })
})
