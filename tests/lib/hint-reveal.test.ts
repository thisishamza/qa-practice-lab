// Unit tests for the P4-M2 WP3 hint/reveal flows (src/lib/hintReveal.ts).
// The server is the authority; these tests pin the client-side contract:
// locked levels expose no text, the ladder cannot be skipped, failures never
// unlock anything, duplicate requests are blocked, and error copy stays
// learner-safe (no internals, no invented retry durations).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  applyHintResponse,
  applyHintsUsed,
  buildLadder,
  canRequest,
  clampUsed,
  confirmGiveUpFlow,
  createSingleFlight,
  fetchRevealFlow,
  isRevealLockedError,
  learningErrorMessage,
  levelStatus,
  restoreLadder,
  restoreLevels,
  unlockHint,
} from '../../src/lib/hintReveal'
import { HINTS } from '../../src/server/hints'
import { REVEALS } from '../../src/server/reveals'
import type { HintResponse, RevealResponse } from '../../src/shared/learning'

const HINT_RESPONSE: HintResponse = { level: 1, hint: 'Look at the results count.', hintsUsed: 1 }

function hintResponse(level: 1 | 2 | 3, used: number): HintResponse {
  return { level, hint: `Hint text for level ${level}`, hintsUsed: used }
}

function revealResponse(status: 'submitted' | 'revealed'): RevealResponse {
  return {
    huntId: 'hunt-cart-001',
    title: 'Cart quantity accumulation',
    expected: 'expected',
    actual: 'actual',
    rootCause: 'root cause',
    reproduction: ['r1'],
    verification: ['v1'],
    concepts: ['c1'],
    commonMisconceptions: ['m1'],
    attempt: { status, hintsUsed: 3, bestQualityScore: null, discovered: false, submittedAt: null },
  }
}

function apiError(status: number, code: string | null, message: string | null) {
  const error = new Error(message ?? '') as Error & { status: number; code: string | null }
  error.name = 'PracticeApiError'
  error.status = status
  error.code = code
  return error
}

describe('levelStatus / buildLadder', () => {
  it('starts with level 1 available and levels 2–3 locked', () => {
    const ladder = buildLadder(0, {})
    expect(ladder.map((entry) => entry.status)).toEqual(['available', 'locked', 'locked'])
    expect(ladder.every((entry) => entry.hint === null)).toBe(true)
  })

  it('unlocks the next level after its predecessor is used', () => {
    expect(levelStatus(1, 0)).toBe('available')
    expect(levelStatus(2, 1)).toBe('available')
    expect(levelStatus(3, 2)).toBe('available')
    expect(levelStatus(2, 0)).toBe('locked')
    expect(levelStatus(3, 1)).toBe('locked')
  })

  it('marks used levels unlocked and carries their text', () => {
    const ladder = buildLadder(2, { 1: 'first', 2: 'second' })
    expect(ladder[0]).toEqual({ level: 1, status: 'unlocked', hint: 'first' })
    expect(ladder[1]).toEqual({ level: 2, status: 'unlocked', hint: 'second' })
    expect(ladder[2].status).toBe('available')
  })

  it('never renders text for a locked or merely available level, even if supplied', () => {
    const ladder = buildLadder(0, { 2: 'secret two', 3: 'secret three' })
    expect(ladder[1].hint).toBeNull()
    expect(ladder[2].hint).toBeNull()
    const partial = buildLadder(1, { 1: 'one', 3: 'secret three' })
    expect(partial[2].hint).toBeNull()
  })

  it('caps hintsUsed into 0–3', () => {
    expect(clampUsed(Number.NaN)).toBe(0)
    expect(clampUsed(-2)).toBe(0)
    expect(clampUsed(9)).toBe(3)
    expect(clampUsed(2)).toBe(2)
  })
})

describe('canRequest', () => {
  it('level 1 is always requestable', () => {
    expect(canRequest(1, 0)).toBe(true)
  })
  it('level 2 requires level 1, level 3 requires level 2', () => {
    expect(canRequest(2, 0)).toBe(false)
    expect(canRequest(2, 1)).toBe(true)
    expect(canRequest(3, 1)).toBe(false)
    expect(canRequest(3, 2)).toBe(true)
  })
  it('used levels remain requestable (idempotent re-read)', () => {
    expect(canRequest(1, 3)).toBe(true)
    expect(canRequest(2, 3)).toBe(true)
  })
})

describe('applyHintResponse / applyHintsUsed / restoreLevels', () => {
  it('folds responses into the text map and used count', () => {
    const texts = applyHintResponse({}, hintResponse(1, 1))
    expect(texts).toEqual({ 1: 'Hint text for level 1' })
    expect(applyHintsUsed(0, hintResponse(1, 1))).toBe(1)
    expect(applyHintsUsed(3, hintResponse(1, 1))).toBe(3) // never decrease
  })

  it('plans exactly the used prefix for restore', () => {
    expect(restoreLevels(0)).toEqual([])
    expect(restoreLevels(1)).toEqual([1])
    expect(restoreLevels(2)).toEqual([1, 2])
    expect(restoreLevels(3)).toEqual([1, 2, 3])
  })
})

describe('createSingleFlight', () => {
  it('blocks a second acquire until release', () => {
    const flight = createSingleFlight()
    expect(flight.tryAcquire()).toBe(true)
    expect(flight.tryAcquire()).toBe(false)
    flight.release()
    expect(flight.tryAcquire()).toBe(true)
  })
})

describe('unlockHint', () => {
  it('returns the server response on success', async () => {
    const request = vi.fn(async () => HINT_RESPONSE)
    const outcome = await unlockHint({ huntId: 'hunt-cart-001', level: 1, request })
    expect(outcome).toEqual({ kind: 'success', response: HINT_RESPONSE })
    expect(request).toHaveBeenCalledWith('hunt-cart-001', 1)
  })

  it('maps failures to learner-safe copy and never unlocks', async () => {
    const request = vi.fn(async () => {
      throw apiError(409, 'hint_level_locked', 'Use the previous hint first — levels unlock in order.')
    })
    const outcome = await unlockHint({ huntId: 'hunt-cart-001', level: 3, request })
    expect(outcome.kind).toBe('failure')
    if (outcome.kind === 'failure') {
      expect(outcome.message).toBe('Use the previous hint first — levels unlock in order.')
    }
  })

  it('maps rate limiting without inventing a duration', async () => {
    const request = vi.fn(async () => {
      throw apiError(429, 'rate_limited', null)
    })
    const outcome = await unlockHint({ huntId: 'hunt-cart-001', level: 1, request })
    expect(outcome).toEqual({
      kind: 'failure',
      message: 'Too many attempts in a short time. Wait a moment and try again.',
    })
    expect(outcome.kind === 'failure' && outcome.message).not.toMatch(/\d+/)
  })
})

describe('restoreLadder', () => {
  it('restores texts for exactly the used levels, in order', async () => {
    const request = vi.fn(async (_huntId: string, level: 1 | 2 | 3) => hintResponse(level, level))
    const result = await restoreLadder({
      huntId: 'hunt-cart-001',
      fetchAttempt: async () => ({ hintsUsed: 2 }),
      requestHint: request,
    })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls.map((call) => call[1])).toEqual([1, 2])
    expect(result.hintsUsed).toBe(2)
    expect(Object.keys(result.texts)).toEqual(['1', '2'])
  })

  it('fetches nothing for a fresh attempt', async () => {
    const request = vi.fn(async () => hintResponse(1, 1))
    const result = await restoreLadder({
      huntId: 'hunt-cart-001',
      fetchAttempt: async () => ({ hintsUsed: 0 }),
      requestHint: request,
    })
    expect(request).not.toHaveBeenCalled()
    expect(result).toEqual({ hintsUsed: 0, texts: {} })
  })

  it('propagates failures instead of guessing', async () => {
    await expect(
      restoreLadder({
        huntId: 'hunt-cart-001',
        fetchAttempt: async () => {
          throw apiError(401, 'session_required', null)
        },
        requestHint: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'session_required' })
  })
})

describe('fetchRevealFlow', () => {
  it('returns revealed content only when the server serves it', async () => {
    const outcome = await fetchRevealFlow({
      huntId: 'hunt-cart-001',
      fetchReveal: async () => revealResponse('submitted'),
    })
    expect(outcome.kind).toBe('revealed')
  })

  it('maps 403 reveal_locked to locked — never to content', async () => {
    const outcome = await fetchRevealFlow({
      huntId: 'hunt-cart-001',
      fetchReveal: async () => {
        throw apiError(403, 'reveal_locked', 'Submit a bug report for this attempt, or explicitly give up, to unlock the solution.')
      },
    })
    expect(outcome).toEqual({ kind: 'locked' })
  })

  it('maps other failures to a learner-safe message', async () => {
    const outcome = await fetchRevealFlow({
      huntId: 'hunt-cart-001',
      fetchReveal: async () => {
        throw apiError(500, 'internal_error', null)
      },
    })
    expect(outcome).toEqual({ kind: 'failure', message: 'The server had a problem. Please try again in a moment.' })
  })
})

describe('confirmGiveUpFlow', () => {
  it('returns the reveal on success', async () => {
    const outcome = await confirmGiveUpFlow({ giveUp: async () => revealResponse('revealed') })
    expect(outcome.kind).toBe('success')
    if (outcome.kind === 'success') {
      expect(outcome.reveal.attempt.status).toBe('revealed')
      expect(outcome.reveal.attempt.discovered).toBe(false)
    }
  })

  it('maps failures to learner-safe copy', async () => {
    const outcome = await confirmGiveUpFlow({
      giveUp: async () => {
        throw apiError(429, 'rate_limited', null)
      },
    })
    expect(outcome.kind).toBe('failure')
    if (outcome.kind === 'failure') {
      expect(outcome.message).toBe('Too many attempts in a short time. Wait a moment and try again.')
    }
  })
})

describe('learningErrorMessage', () => {
  it('prefers the server learner-safe message for known codes', () => {
    expect(learningErrorMessage(apiError(404, 'hunt_not_found', 'No such practice hunt exists.'), 'hint')).toBe(
      'No such practice hunt exists.',
    )
  })

  it('falls back to honest copy when the server sent no message', () => {
    expect(learningErrorMessage(apiError(401, 'session_required', null), 'reveal')).toBe(
      'Start the exercise before revealing the solution.',
    )
    expect(learningErrorMessage(apiError(401, 'session_required', null), 'hint')).toBe(
      'Start the exercise before asking for a hint.',
    )
  })

  it('treats a bare 429 as rate limiting', () => {
    expect(learningErrorMessage({ status: 429 }, 'giveUp')).toBe(
      'Too many attempts in a short time. Wait a moment and try again.',
    )
  })

  it('treats network TypeErrors as connection failures', () => {
    expect(learningErrorMessage(new TypeError('fetch failed'), 'reveal')).toBe(
      'The connection failed. Check your network and try again.',
    )
  })

  it('falls back to a generic message and context fallback', () => {
    expect(learningErrorMessage({}, 'giveUp')).toBe('The solution could not be revealed. Please try again.')
    expect(learningErrorMessage({ message: 'custom' }, 'hint')).toBe('custom')
  })

  it('maps 403 reveal_locked regardless of context', () => {
    expect(learningErrorMessage(apiError(403, 'reveal_locked', null), 'giveUp')).toBe(
      'The solution stays locked until you submit a report or explicitly give up on this attempt.',
    )
  })
})

describe('isRevealLockedError', () => {
  it('detects the locked state by code or status', () => {
    expect(isRevealLockedError(apiError(403, 'reveal_locked', null))).toBe(true)
    expect(isRevealLockedError({ status: 403 })).toBe(true)
    expect(isRevealLockedError(apiError(500, 'internal_error', null))).toBe(false)
    expect(isRevealLockedError(null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Information-leak guard: no client source file may contain hint or reveal
// content. The registries are compiled server-side; the browser must never
// ship them.
// ---------------------------------------------------------------------------

function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full))
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('client bundle carries no server-only learning content', () => {
  const clientFiles = ['src/features', 'src/lib'].flatMap((dir) => collectSourceFiles(dir))
  const clientSource = clientFiles.map((file) => readFileSync(file, 'utf8')).join('\n')

  it('scans a meaningful number of client files', () => {
    expect(clientFiles.length).toBeGreaterThan(20)
  })

  it('no reveal field text appears in client source', () => {
    for (const reveal of Object.values(REVEALS)) {
      const fragments = [reveal.expected, reveal.actual, reveal.rootCause, ...reveal.reproduction, ...reveal.verification, ...reveal.concepts, ...reveal.commonMisconceptions]
      for (const fragment of fragments) {
        expect(clientSource.includes(fragment), `leaked reveal fragment: ${fragment.slice(0, 60)}`).toBe(false)
      }
    }
  })

  it('no hint text appears in client source', () => {
    for (const hints of Object.values(HINTS)) {
      for (const level of [1, 2, 3] as const) {
        const text = hints[`level${level}` as keyof typeof hints]
        if (typeof text === 'string') {
          expect(clientSource.includes(text), `leaked hint: ${text.slice(0, 60)}`).toBe(false)
        }
      }
    }
  })
})
