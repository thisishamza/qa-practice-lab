// P4-M2 WP3 — pure logic for the learner-facing hint ladder, give-up
// confirmation and reveal panel. No I/O, no DOM, no React: everything here is
// unit-testable in plain Node. The components are thin shells over these
// helpers plus the typed API client.
//
// Security model:
// - Hint progression is decided server-side (hint_mask). This module only
//   reflects what the server said: a level is `unlocked` only after the
//   server granted it, `available` only when its predecessor is unlocked,
//   otherwise `locked`. The client never upgrades a level on its own.
// - Locked levels expose no text. Reveal content is never present here —
//   it arrives only from the reveal endpoints after server authorization.
// - Error mapping produces learner-safe copy; internal codes and database
//   details never surface. No retry durations are invented anywhere.

import type { HintLevel, HintResponse, RevealResponse } from '../shared/learning'

export const HINT_LEVELS: readonly HintLevel[] = [1, 2, 3]

export type HintLevelStatus = 'locked' | 'available' | 'unlocked'

export interface HintLadderLevel {
  level: HintLevel
  status: HintLevelStatus
  /** Present only for levels the server has unlocked in this session of the UI. */
  hint: string | null
}

export function levelStatus(level: HintLevel, hintsUsed: number): HintLevelStatus {
  if (level <= hintsUsed) {
    return 'unlocked'
  }
  if (level === 1 || level - 1 <= hintsUsed) {
    return 'available'
  }
  return 'locked'
}

/** Build the three-level ladder view from the server's hintsUsed count. */
export function buildLadder(
  hintsUsed: number,
  texts: Readonly<Partial<Record<HintLevel, string>>>,
): HintLadderLevel[] {
  const used = clampUsed(hintsUsed)
  return HINT_LEVELS.map((level) => {
    const status = levelStatus(level, used)
    return {
      level,
      status,
      hint: status === 'unlocked' ? (texts[level] ?? null) : null,
    }
  })
}

export function clampUsed(hintsUsed: number): number {
  if (!Number.isFinite(hintsUsed)) {
    return 0
  }
  return Math.min(3, Math.max(0, Math.trunc(hintsUsed)))
}

/** Fold a server hint response into the text map. Idempotent by level. */
export function applyHintResponse(
  texts: Readonly<Partial<Record<HintLevel, string>>>,
  response: HintResponse,
): Partial<Record<HintLevel, string>> {
  return { ...texts, [response.level]: response.hint }
}

/** Fold the server's authoritative hintsUsed count into a new value. */
export function applyHintsUsed(current: number, response: HintResponse): number {
  return clampUsed(Math.max(current, response.hintsUsed))
}

/** Levels that must be (re)fetched to restore the ladder after a refresh. */
export function restoreLevels(hintsUsed: number): HintLevel[] {
  const used = clampUsed(hintsUsed)
  return HINT_LEVELS.filter((level) => level <= used)
}

/**
 * Whether the given level can be requested right now. Level 1 is always
 * eligible; level N requires level N−1 unlocked. This mirrors — it does not
 * replace — the server's own enforcement.
 */
export function canRequest(level: HintLevel, hintsUsed: number): boolean {
  const used = clampUsed(hintsUsed)
  if (level <= used) {
    return true // idempotent re-read of an unlocked level
  }
  return level === 1 || level - 1 <= used
}

/** Learner-safe copy for the learning endpoints, keyed by machine code. */
const LEARNING_MESSAGES: Record<string, string> = {
  invalid_level: 'That hint level is not available.',
  hint_level_locked: 'Use the previous hint first — levels unlock in order.',
  hint_attempt_completed: 'This attempt is complete — start the hunt again to unlock the remaining hints.',
  session_required: 'Start the exercise before asking for a hint.',
  reveal_locked:
    'The solution stays locked until you submit a report or explicitly give up on this attempt.',
  hunt_not_found: 'This exercise is no longer available. Try the practice page.',
  rate_limited: 'Too many attempts in a short time. Wait a moment and try again.',
  invalid_request: 'That request was not valid. Review it and try again.',
}

export type LearningErrorContext = 'hint' | 'reveal' | 'giveUp'

interface ErrorLike {
  status?: unknown
  code?: unknown
  message?: unknown
}

const CONTEXT_FALLBACK: Record<LearningErrorContext, string> = {
  hint: 'The hint could not be loaded. Please try again.',
  reveal: 'The solution could not be loaded. Please try again.',
  giveUp: 'The solution could not be revealed. Please try again.',
}

/**
 * Map any failure from the learning endpoints onto learner-safe copy.
 * Prefers the server's learner-safe message for known codes; never invents
 * retry durations; never leaks internal details.
 */
export function learningErrorMessage(error: unknown, context: LearningErrorContext): string {
  const like = (error ?? {}) as ErrorLike
  const code = typeof like.code === 'string' ? like.code : null
  const serverMessage =
    typeof like.message === 'string' && like.message.trim().length > 0 ? like.message : null

  if (code && LEARNING_MESSAGES[code]) {
    if (code === 'session_required' && context !== 'hint') {
      return serverMessage ?? 'Start the exercise before revealing the solution.'
    }
    return serverMessage ?? LEARNING_MESSAGES[code]
  }
  if (like.status === 429) {
    return LEARNING_MESSAGES.rate_limited
  }
  if (typeof like.status === 'number' && like.status >= 500) {
    return 'The server had a problem. Please try again in a moment.'
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return 'The connection failed. Check your network and try again.'
  }
  return serverMessage ?? CONTEXT_FALLBACK[context]
}

/** Whether a reveal failure should leave the panel locked. */
export function isRevealLockedError(error: unknown): boolean {
  const like = (error ?? {}) as ErrorLike
  return like.code === 'reveal_locked' || like.status === 403
}

// ---------------------------------------------------------------------------
// Async flows (injected transports — unit-testable in Node, no DOM)
// ---------------------------------------------------------------------------

/**
 * A minimal single-flight gate shared by the learning flows. `tryAcquire`
 * returns false while one operation is active; the holder must call
 * `release` when done (typically in a `finally`). This is what prevents
 * duplicate unlock/give-up requests while one is in flight.
 */
export interface SingleFlight {
  tryAcquire(): boolean
  release(): void
}

export function createSingleFlight(): SingleFlight {
  let active = false
  return {
    tryAcquire() {
      if (active) {
        return false
      }
      active = true
      return true
    },
    release() {
      active = false
    },
  }
}

export type UnlockHintOutcome =
  | { kind: 'success'; response: HintResponse }
  | { kind: 'failure'; message: string }

/**
 * Unlock one level. Failures carry a learner-safe message and never unlock
 * anything. Duplicate-request prevention lives in `createSingleFlight`.
 */
export async function unlockHint(input: {
  huntId: string
  level: HintLevel
  request: (huntId: string, level: HintLevel) => Promise<HintResponse>
}): Promise<UnlockHintOutcome> {
  try {
    const response = await input.request(input.huntId, input.level)
    return { kind: 'success', response }
  } catch (error) {
    return { kind: 'failure', message: learningErrorMessage(error, 'hint') }
  }
}

export interface RestoreLadderResult {
  hintsUsed: number
  texts: Partial<Record<HintLevel, string>>
}

/**
 * Restore the ladder after a refresh/session continuation. The attempt view
 * says how many levels are used; the (idempotent) hint endpoint returns the
 * text for each used level. Level N requires level N−1, and the mask is a
 * contiguous prefix, so levels 1..hintsUsed are exactly the unlocked ones.
 * Failures propagate — the caller maps them to learner-safe copy.
 */
export async function restoreLadder(deps: {
  huntId: string
  fetchAttempt: (huntId: string) => Promise<{ hintsUsed: number }>
  requestHint: (huntId: string, level: HintLevel) => Promise<HintResponse>
}): Promise<RestoreLadderResult> {
  const attempt = await deps.fetchAttempt(deps.huntId)
  const hintsUsed = clampUsed(attempt.hintsUsed)
  const texts: Partial<Record<HintLevel, string>> = {}
  let used = hintsUsed
  for (const level of restoreLevels(hintsUsed)) {
    const response = await deps.requestHint(deps.huntId, level)
    texts[level] = response.hint
    used = clampUsed(Math.max(used, response.hintsUsed))
  }
  return { hintsUsed: used, texts }
}

export type FetchRevealOutcome =
  | { kind: 'revealed'; reveal: RevealResponse }
  | { kind: 'locked' }
  | { kind: 'failure'; message: string }

/** Retrieve the reveal; 403 maps to `locked`, everything else to safe copy. */
export async function fetchRevealFlow(deps: {
  huntId: string
  fetchReveal: (huntId: string) => Promise<RevealResponse>
}): Promise<FetchRevealOutcome> {
  try {
    const reveal = await deps.fetchReveal(deps.huntId)
    return { kind: 'revealed', reveal }
  } catch (error) {
    if (isRevealLockedError(error)) {
      return { kind: 'locked' }
    }
    return { kind: 'failure', message: learningErrorMessage(error, 'reveal') }
  }
}

export type ConfirmGiveUpOutcome =
  | { kind: 'success'; reveal: RevealResponse }
  | { kind: 'failure'; message: string }

/**
 * The confirmed give-up. Failures carry a learner-safe message; nothing is
 * unlocked locally on failure. Duplicate-confirmation prevention lives in
 * `createSingleFlight`.
 */
export async function confirmGiveUpFlow(input: {
  giveUp: () => Promise<RevealResponse>
}): Promise<ConfirmGiveUpOutcome> {
  try {
    const reveal = await input.giveUp()
    return { kind: 'success', reveal }
  } catch (error) {
    return { kind: 'failure', message: learningErrorMessage(error, 'giveUp') }
  }
}
