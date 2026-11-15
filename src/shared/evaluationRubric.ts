// Canonical learner-safe evaluation rubric (plan §6.4). This module is the
// single source of truth for the ten deterministic checks, their point
// weights and the verdict bands. The server evaluator
// (src/server/reportQuality.ts) builds its weights from EVALUATION_RUBRIC,
// and the learner-facing transparency surfaces render the same entries, so
// the published rubric can never drift from the implemented one.
//
// Learner-safe by construction: this module carries check ids, labels,
// weights and plain-English descriptions only. It contains no finding-check
// terms, no synonym lists, no defect identifiers and no evaluator
// internals — those stay server-side in src/server/reportQuality.ts.

export const EVALUATION_RUBRIC = [
  {
    id: 'title-present',
    label: 'Title',
    points: 10,
    summary:
      'A specific, non-placeholder title between 10 and 120 characters — it says what is wrong, not “bug” or “test”.',
  },
  {
    id: 'environment-present',
    label: 'Environment',
    points: 10,
    summary:
      'Where you saw it, in at least 8 characters, naming at least one recognisable environment cue — for example your browser, operating system, device, build/version, or the practice shop.',
  },
  {
    id: 'steps-present',
    label: 'Steps',
    points: 15,
    summary:
      'At least two separate steps (split across lines or numbered), adding up to at least 40 characters — detailed enough for a reader to follow.',
  },
  {
    id: 'steps-quality',
    label: 'Step quality',
    points: 10,
    summary:
      'The steps include at least one action verb (open, click, add, place…) and at least one concrete detail — a number, a quoted string, or a URL path.',
  },
  {
    id: 'expected-present',
    label: 'Expected',
    points: 8,
    summary: 'What should happen, in at least 12 characters.',
  },
  {
    id: 'actual-present',
    label: 'Actual',
    points: 8,
    summary: 'What actually happens, in at least 12 characters.',
  },
  {
    id: 'expected-actual-distinct',
    label: 'Expected vs actual',
    points: 7,
    summary:
      'Expected and actual genuinely differ — at least 60% of the words are different once case and punctuation are normalised.',
  },
  {
    id: 'severity-valid',
    label: 'Severity',
    points: 5,
    summary:
      'Critical, high, medium or low — an impact-based rating of what breaks and for whom.',
  },
  {
    id: 'priority-valid',
    label: 'Priority',
    points: 5,
    summary:
      'P1–P4 — an urgency rating for the tracker (P1 Urgent, P2 High, P3 Normal, P4 Low). Independent of severity; never derived from it.',
  },
  {
    id: 'finding',
    label: 'Finding',
    points: 22,
    summary:
      'Your title, steps, expected and actual — taken together — identify the incorrect behaviour. The match runs server-side against a curated list of behaviour terms with reasonable synonyms, and is aware of context, so an unrelated mention never earns this check.',
  },
] as const

export type RubricCheckId = (typeof EVALUATION_RUBRIC)[number]['id']

export type EvaluationRubricCheck = (typeof EVALUATION_RUBRIC)[number]

/** Sum of the check weights. Always 100 for the approved §6.4 rubric. */
export const EVALUATION_TOTAL_POINTS = EVALUATION_RUBRIC.reduce(
  (sum, check) => sum + check.points,
  0,
)

export type VerdictBandId = 'solid' | 'needs-work' | 'incomplete'

export interface VerdictBand {
  id: VerdictBandId
  /** Learner-facing label, matching the §6.4 verdict vocabulary. */
  label: string
  /** Inclusive lower bound of the band. */
  minimum: number
  /** Inclusive upper bound of the band. */
  maximum: number
  description: string
}

/**
 * Verdict bands for the persisted score (§6.4). The server evaluator maps
 * scores onto the same bands (src/server/reportQuality.ts
 * `verdictForScore`); the bounds below are the presentation of those same
 * thresholds.
 */
export const VERDICT_BANDS: readonly VerdictBand[] = [
  {
    id: 'solid',
    label: 'Solid report',
    minimum: 80,
    maximum: 100,
    description: 'The report stands on its own — a reproducible account with the evidence a reader needs.',
  },
  {
    id: 'needs-work',
    label: 'Needs work',
    minimum: 50,
    maximum: 79,
    description: 'Parts of the report are there, but something important is missing or unclear — see the per-check feedback.',
  },
  {
    id: 'incomplete',
    label: 'Incomplete',
    minimum: 0,
    maximum: 49,
    description: 'Most checks failed — start from the checklist and resubmit. A revised report can score higher.',
  },
] as const
