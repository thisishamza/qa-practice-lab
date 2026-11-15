// Practice-session mode engine (P3-M7) — clean vs bug-hunt.
//
// Endpoints:
//   GET  /api/v1/practice/session              — current mode + learner-safe hunt summary
//   POST /api/v1/practice/hunts/:huntId/start  — enter bug-hunt mode for a registered hunt
//   POST /api/v1/practice/session/reset        — return the session to clean mode
//
// Security model:
// - Everything resolves from the `mpl_session` cookie; only a SHA-256 hash
//   is stored. The client NEVER sends a defect id, role, owner or activation
//   flag. `POST .../start` takes no body at all — the hunt id comes from the
//   URL path and is validated against the compiled registry
//   (src/server/hunts.ts); unknown ids answer 404 `hunt_not_found`.
// - Activation is re-resolved per request from the session row (see
//   isDefectActive in defects.ts); there is no shared flag, cache, global or
//   admin/teacher activation surface in Phase 3.
// - Starting a hunt re-stamps the caller's own live session in place
//   (mode='bug_hunt', hunt_id) — the same practice session keeps its cart,
//   orders and (when signed in) customer binding. Re-starting the same hunt
//   is idempotent; starting another hunt re-stamps to that hunt.
//   If the browser has no live session, a fresh bug-hunt session is minted.
// - Reset is a NON-DESTRUCTIVE re-stamp of the live session to clean mode
//   (hunt_id=NULL). The plan's "expire + fresh session" sketch was NOT used:
//   expiring the practice session would cascade-delete the learner's orders
//   and cart (M4 FKs) and detach their synthetic customer session (M5 FKs),
//   which is far more destructive than "restores clean mode" promises. Reset
//   with no live session mints a fresh clean one so the learner always lands
//   in a known-good state.
// - Responses never contain defect ids or hints; a bug_hunt session whose
//   hunt_id is no longer in the registry reports plain clean mode.

import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { PracticeSessionResponse } from '../shared/practice'
import type { AppEnv } from './app'
import { findHunt } from './hunts'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionWithCart,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'

const HUNT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'Strict' as const,
    maxAge: SESSION_TTL_SECONDS,
    secure,
  }
}

function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === 'https:'
}

function huntSummary(huntId: string | null): PracticeSessionResponse['hunt'] {
  if (!huntId) {
    return null
  }
  const hunt = findHunt(huntId)
  return hunt ? { id: hunt.id, title: hunt.title, summary: hunt.summary } : null
}

function sessionResponse(mode: 'clean' | 'bug_hunt', huntId: string | null): PracticeSessionResponse {
  if (mode === 'bug_hunt') {
    const hunt = huntSummary(huntId)
    if (hunt) {
      return { mode: 'bug_hunt', hunt }
    }
  }
  return { mode: 'clean', hunt: null }
}

export const practiceRoutes = new Hono<AppEnv>()

practiceRoutes.get('/practice/session', async (c) => {
  const presented = getCookie(c, SESSION_COOKIE)
  if (presented && isTokenFormat(presented)) {
    const live = await findLiveSession(c.env.DB, await hashSessionToken(presented))
    if (live) {
      return c.json(sessionResponse(live.mode, live.huntId))
    }
  }
  // Read paths never mint a session; an unknown browser is simply clean.
  return c.json({ mode: 'clean', hunt: null } satisfies PracticeSessionResponse)
})

practiceRoutes.post('/practice/hunts/:huntId/start', async (c) => {
  const huntId = c.req.param('huntId') ?? ''
  if (!HUNT_ID_PATTERN.test(huntId)) {
    return c.json(
      { error: 'invalid_request', message: 'A hunt id looks like hunt-topic-001.' },
      400,
    )
  }
  const hunt = findHunt(huntId)
  if (!hunt) {
    return c.json(
      { error: 'hunt_not_found', message: 'No such practice hunt exists.' },
      404,
    )
  }

  // Any request body is deliberately ignored: there is nothing a client
  // may tune — the hunt's defect list is fixed in the server registry.
  const presented = getCookie(c, SESSION_COOKIE)
  if (presented && isTokenFormat(presented)) {
    const tokenHash = await hashSessionToken(presented)
    const live = await findLiveSession(c.env.DB, tokenHash)
    if (live) {
      await c.env.DB.prepare(
        "UPDATE practice_sessions SET mode = 'bug_hunt', hunt_id = ? WHERE id = ?",
      )
        .bind(hunt.id, live.id)
        .run()
      return c.json({
        mode: 'bug_hunt',
        hunt: { id: hunt.id, title: hunt.title, summary: hunt.summary },
      } satisfies PracticeSessionResponse)
    }
  }

  const fresh = await createSessionWithCart(c.env.DB, { mode: 'bug_hunt', huntId: hunt.id })
  setCookie(c, SESSION_COOKIE, fresh.token, cookieOptions(isSecureRequest(c.req.url)))
  return c.json({
    mode: 'bug_hunt',
    hunt: { id: hunt.id, title: hunt.title, summary: hunt.summary },
  } satisfies PracticeSessionResponse)
})

practiceRoutes.post('/practice/session/reset', async (c) => {
  const presented = getCookie(c, SESSION_COOKIE)
  if (presented && isTokenFormat(presented)) {
    const tokenHash = await hashSessionToken(presented)
    const live = await findLiveSession(c.env.DB, tokenHash)
    if (live) {
      // Non-destructive re-stamp: the cart, orders and synthetic customer
      // binding all belong to this practice session and are preserved.
      await c.env.DB.prepare(
        "UPDATE practice_sessions SET mode = 'clean', hunt_id = NULL WHERE id = ?",
      )
        .bind(live.id)
        .run()
      return c.json({ mode: 'clean', hunt: null } satisfies PracticeSessionResponse)
    }
  }

  const fresh = await createSessionWithCart(c.env.DB)
  setCookie(c, SESSION_COOKIE, fresh.token, cookieOptions(isSecureRequest(c.req.url)))
  return c.json({ mode: 'clean', hunt: null } satisfies PracticeSessionResponse)
})
