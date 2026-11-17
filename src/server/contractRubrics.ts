// Contract evaluation families (Phase 7, plan §4.7/§9) — pure, deterministic,
// server-only scoring helpers. Nothing here reads the request or a
// database; exercises hand in already-parsed learner input.
//
// Families:
//   selections — set match between expected assertion/statement
//                fingerprints and learner selections. Recall 70%,
//                precision 30% (§9).
//   validate   — selections (40 pts) + optional payload-fix (60 pts).
//                Single-sided validate exercises leave payloadSchema null
//                and give selections the full 100.
//   compare    — classifications keyed by finding id. Correctness 70%
//                (fraction of expected keys correctly classified),
//                completeness 30% (fraction of expected keys addressed).
//   consumer   — C1–C7 verbatim (src/server/consumerRubric.ts).
//   structured — selections with the same set math, framed as statements.
//
// Distractor selections cost precision; nothing best-of, nothing partial.

export const CONTRACT_PASS_SCORE = 70

export interface RubricCheck {
  id: string
  passed: boolean
  message: string
  points: number
}

export interface RubricResult {
  passed: boolean
  score: number
  checks: RubricCheck[]
  feedback: string
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function setIntersection<T>(a: readonly T[], b: readonly T[]): number {
  const wanted = new Set(a)
  let hits = 0
  for (const item of new Set(b)) {
    if (wanted.has(item)) {
      hits += 1
    }
  }
  return hits
}

/** Selections vs an expected set: recall×70 + precision×30 (§9). */
export function scoreSelections(
  expected: readonly string[],
  selections: readonly string[],
  points = 100,
): { points: number; detail: string; check: Omit<RubricCheck, 'points'> } {
  const hits = setIntersection(expected, selections)
  const recall = expected.length === 0 ? 1 : hits / expected.length
  const precision = selections.length === 0 ? 1 : hits / new Set(selections).size
  const awarded = clamp((recall * 0.7 + precision * 0.3) * points)
  const missing = expected.filter((item) => !selections.includes(item))
  const extra = selections.filter((item) => !expected.includes(item))
  const detailParts: string[] = []
  if (missing.length > 0) detailParts.push(`missing: ${missing.join(', ')}`)
  if (extra.length > 0) detailParts.push(`not supported: ${extra.join(', ')}`)
  const detail = detailParts.length === 0 ? 'Exact set match.' : detailParts.join('; ')
  return {
    points: awarded,
    detail,
    check: {
      id: 'selections',
      passed: awarded >= points * 0.7,
      message:
        awarded >= points * 0.7
          ? 'The selected assertions are the expected ones.'
          : `Not quite — ${detail}.`,
    },
  }
}

export interface CompareExpected {
  [findingId: string]: 'breaking' | 'compatible' | 'review'
}

/** Classifications vs expected: correctness×70 + addressed×30 (§9). */
export function scoreClassifications(
  expected: CompareExpected,
  classifications: Record<string, unknown>,
): RubricResult {
  const entries = Object.entries(expected)
  const allowed = new Set(['breaking', 'compatible', 'review'])
  let correct = 0
  let addressed = 0
  const wrong: string[] = []
  const missed: string[] = []
  for (const [findingId, wanted] of entries) {
    const got = classifications[findingId]
    if (typeof got === 'string' && allowed.has(got)) {
      addressed += 1
      if (got === wanted) {
        correct += 1
      } else {
        wrong.push(findingId)
      }
    } else {
      missed.push(findingId)
    }
  }
  const correctness = entries.length === 0 ? 1 : correct / entries.length
  const completeness = entries.length === 0 ? 1 : addressed / entries.length
  const score = clamp(correctness * 70 + completeness * 30)
  const checks: RubricCheck[] = [
    {
      id: 'correctness',
      passed: correctness === 1,
      message:
        correctness === 1
          ? 'Every finding classified into the right bucket.'
          : `Misclassified: ${wrong.join(', ') || '—'}.`,
      points: clamp(correctness * 70),
    },
    {
      id: 'completeness',
      passed: completeness === 1,
      message:
        completeness === 1
          ? 'Every expected finding addressed.'
          : `Unaddressed: ${missed.join(', ') || '—'}.`,
      points: clamp(completeness * 30),
    },
  ]
  return finalizeRubric(
    checks,
    score,
    'Breaking is breaking — nothing auto-upgrades to compatible; enum widening is always review.',
  )
}

function finalizeRubric(
  checks: RubricCheck[],
  score: number,
  fallbackFeedback: string,
): RubricResult {
  const passed = score >= CONTRACT_PASS_SCORE
  const failed = checks.filter((check) => !check.passed)
  const feedback = passed
    ? 'Passed. The classification set is correct and complete.'
    : failed.length > 0
      ? failed.map((check) => check.message).join(' ')
      : fallbackFeedback
  return { passed, score, checks, feedback }
}

/** Structured set match with per-item feedback (§9). */
export function scoreStructured(expected: readonly string[], selections: readonly string[]): RubricResult {
  const { points, detail, check } = scoreSelections(expected, selections, 100)
  const checks: RubricCheck[] = [
    {
      id: 'set-match',
      passed: check.passed,
      message: check.passed ? 'Exact set match.' : `Not quite — ${detail}.`,
      points,
    },
  ]
  const passed = points >= CONTRACT_PASS_SCORE
  return {
    passed,
    score: points,
    checks,
    feedback: passed ? 'Passed. Exact set match.' : `Not quite — ${detail}.`,
  }
}
