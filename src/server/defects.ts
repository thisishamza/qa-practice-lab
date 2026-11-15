// Defect registry (P3-M7) — CODE, not data.
//
// Each defect is a typed object compiled with the Worker; there is no path
// by which a browser can define, register, select or activate a defect.
// Defect ids never appear in any API response; learner-facing surfaces only
// see hunt summaries (src/server/hunts.ts). Expected vs actual behaviour is
// documented for engine maintainers in docs/bug-hunt-catalogue.md.
//
// Every defect has exactly one code site branching on
// `isDefectActive(c, DEFECT_ID)`. Clean mode never reaches the defective
// branch. Defect branches are static — no randomness, no wall-clock
// dependence — so identical session state + hunt always yields identical
// responses.

import { getCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { AppEnv } from './app'
import { SESSION_COOKIE, findLiveSession, hashSessionToken, isTokenFormat } from './session'
import { findHunt } from './hunts'

export interface DefectDefinition {
  /** Stable internal id, e.g. 'CATALOGUE-001'. Never sent to the browser. */
  id: string
  title: string
  affectedSurface: string
  /** Internal documentation — Expected vs Actual (see docs/bug-hunt-catalogue.md). */
  expected: string
  actual: string
  repro: readonly string[]
  fix: string
}

export const DEFECTS: readonly DefectDefinition[] = [
  {
    id: 'CATALOGUE-001',
    title: 'Catalogue search ignores the description facet',
    affectedSurface: 'GET /api/v1/products?q= (and the /shop search box)',
    expected:
      'Searching matches products whose name, description OR category name contains the term (case-insensitive substring), matching the documented clean-mode contract.',
    actual:
      'The description clause is dropped from the match, so only products whose name or category name contains the term are returned. Description-only matches silently vanish from the results and the total count.',
    repro: [
      'In a bug-hunt session, open /shop.',
      "Search for 'vestibules' (a term that appears only in the Ridgeline 2-Person Tent description).",
      'Clean mode would return one product; the hunt session returns an empty result set.',
      'Reset to clean mode and repeat the search to observe the correct result.',
    ],
    fix: "Include the 'p.description LIKE ? ESCAPE '\\'' clause in the q predicate.",
  },
]

export function findDefect(id: string): DefectDefinition | null {
  return DEFECTS.find((defect) => defect.id === id) ?? null
}

/**
 * Server-resolved defect activation. Reads the caller's `mpl_session`
 * cookie exactly as other session-scoped routes do, then checks that the
 * live session is in bug-hunt mode AND its hunt (from the code registry,
 * keyed by the session's stored hunt_id) lists the defect.
 *
 * Never trusts a client-supplied defect id, role, owner or activation flag
 * — the only inputs are the server-side session row and the compiled
 * registries. Unknown hunts, clean sessions, missing/expired sessions and
 * malformed cookies all resolve to false (clean). Performs one indexed
 * session lookup; call it only on paths that need it (e.g. inside the `q`
 * branch of the catalogue search).
 */
export async function isDefectActive(c: Context<AppEnv>, defectId: string): Promise<boolean> {
  const presented = getCookie(c, SESSION_COOKIE)
  if (!presented || !isTokenFormat(presented)) {
    return false
  }
  const live = await findLiveSession(c.env.DB, await hashSessionToken(presented))
  if (!live || live.mode !== 'bug_hunt' || !live.huntId) {
    return false
  }
  const hunt = findHunt(live.huntId)
  return hunt !== null && hunt.defectIds.includes(defectId)
}
