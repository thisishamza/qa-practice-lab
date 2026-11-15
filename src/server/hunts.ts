// Hunt registry (P3-M7) — CODE, not data.
//
// A hunt definition is a typed object compiled with the Worker:
//   { id, title, summary, defectIds }
// Unknown ids resolve to null and the API answers 404; learners can never
// inject defects, SQL, expressions or new hunts, because nothing here comes
// from the database or the request. Hunt summaries are the only thing the
// browser ever sees — defect ids stay inside the server registries.
//
// P3-M7 ships exactly one hunt (the engine proof hunt). P3-M8 expands the
// catalogue; the shop/scenario wiring lands with it.

export interface HuntDefinition {
  /** Stable public id, lowercase-hyphen. Safe to expose. */
  id: string
  title: string
  /** Learner-safe one-line summary. No defect ids, hints or repro steps. */
  summary: string
  /** Internal: the fixed defect list for this hunt, resolved only server-side. */
  defectIds: readonly string[]
}

export const HUNTS: readonly HuntDefinition[] = [
  {
    id: 'hunt-catalogue-001',
    title: 'Catalogue search under-matches',
    summary:
      'The shop search appears to miss products. Find out why results come up empty for some queries and report it.',
    defectIds: ['CATALOGUE-001'],
  },
]

export function findHunt(id: string): HuntDefinition | null {
  return HUNTS.find((hunt) => hunt.id === id) ?? null
}
