// Practice-session mode engine (P3-M7, expanded in P3-M8) — clean vs bug-hunt.
//
// Endpoints:
//   GET  /api/v1/practice/hunts              — learner-safe list of available hunts
//   GET  /api/v1/practice/session            — current mode + learner-safe hunt summary
//   POST /api/v1/practice/hunts/:huntId/start — enter bug-hunt mode for a registered hunt
//   POST /api/v1/practice/session/reset       — return the session to clean mode
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
//   is idempotent and does not count against the daily start cap; starting
//   another hunt re-stamps to that hunt and counts. If the browser has no
//   live session, a fresh bug-hunt session is minted (counts against the
//   cap). Every path that enters a hunt also ensures exactly one live
//   (in_progress) attempt row for (session, hunt) exists — see
//   src/server/attempts.ts (Phase 4, P4-M1 WP2). Attempts carry no defect
//   information and cascade-delete with the session.
// - Reset is a NON-DESTRUCTIVE re-stamp of the live session to clean mode
//   (hunt_id=NULL). The plan's "expire + fresh session" sketch was NOT used:
//   expiring the practice session would cascade-delete the learner's orders
//   and cart (M4 FKs) and detach their synthetic customer session (M5 FKs),
//   which is far more destructive than "restores clean mode" promises. Reset
//   with no live session mints a fresh clean one so the learner always lands
//   in a known-good state. Reset never counts against the start cap.
// - Hunt starts are capped per IP per UTC day (HUNT_START_DAILY_CAP, 20).
//   Only a SHA-256 hash of the IP is stored (hunt_start_caps), never the raw
//   address, and the counter keeps one row per hashed IP, reset on the day
//   boundary. The cap is exact (guarded increments, never overshoots) and is
//   an abuse control, not a security boundary; when no IP is visible (local
//   development) it is skipped.
// - Responses never contain defect ids or hints; a bug_hunt session whose
//   hunt_id is no longer in the registry reports plain clean mode.
// - Hunt summaries carry the learner-safe curriculum metadata (Phase 4,
//   WP1; src/shared/huntCurriculum.ts) — concepts, outcomes and
//   investigation focus. It describes what to practise, never the answer.

import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type {
  HuntListResponse,
  HuntSummary,
  PracticeSessionResponse,
} from '../shared/practice'
import type { AppEnv } from './app'
import { HUNTS, HUNT_ID_PATTERN, findHunt } from './hunts'
import { ensureLiveAttempt } from './attempts'
import { HUNT_CURRICULUM } from '../shared/huntCurriculum'
import { clientIp, sha256Hex } from './rateLimit'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionWithCart,
  findLiveSession,
  hashSessionToken,
  isTokenFormat,
} from './session'

/** Soft per-IP per UTC day cap on entering a hunt. See the header comment. */
const HUNT_START_DAILY_CAP = 20

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

function huntSummary(huntId: string | null): HuntSummary | null {
  if (!huntId) {
    return null
  }
  const hunt = findHunt(huntId)
  return hunt
    ? {
        id: hunt.id,
        title: hunt.title,
        summary: hunt.summary,
        scenarioId: hunt.scenarioId,
        curriculum: HUNT_CURRICULUM[hunt.id],
      }
    : null
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

async function consumeHuntStart(
  db: D1Database,
  day: string,
  ipHash: string,
): Promise<boolean> {
  // Bound the table opportunistically: one bounded DELETE per call (old-day
  // rows, at most 100) keeps hunt_start_caps small without a sweep job.
  await db
    .prepare(
      `DELETE FROM hunt_start_caps
       WHERE day != ?
         AND ip_hash IN (SELECT ip_hash FROM hunt_start_caps WHERE day != ? LIMIT 100)`,
    )
    .bind(day, day)
    .run()

  // Exact cap, atomic at the row level. No overshoot under concurrency:
  // every path that grants a start must increment or reset the counter
  // itself, and increments are always guarded by the cap.
  //
  // Fast path handles the common case in one statement.
  const bumped = await db
    .prepare(
      'UPDATE hunt_start_caps SET starts = starts + 1 WHERE ip_hash = ? AND day = ? AND starts < ?',
    )
    .bind(ipHash, day, HUNT_START_DAILY_CAP)
    .run()
  if (Number(bumped.meta.changes) === 1) {
    return true
  }
  // No row for this IP today yet (or the counter is full). Single atomic
  // upsert: insert a fresh row, or reset a leftover stale-day row to 1
  // (covers pre-0009 rows and stale rows past the bounded delete). A
  // same-day row at the cap fails the WHERE and reports changes = 0.
  const upserted = await db
    .prepare(
      `INSERT INTO hunt_start_caps (ip_hash, day, starts) VALUES (?, ?, 1)
       ON CONFLICT(ip_hash) DO UPDATE SET day = excluded.day, starts = 1
       WHERE hunt_start_caps.day != excluded.day`,
    )
    .bind(ipHash, day)
    .run()
  if (Number(upserted.meta.changes) === 1) {
    return true
  }
  // Lost a race against a concurrent insert/reset, or genuinely at the cap:
  // one final guarded bump decides. Never overshoots.
  const retried = await db
    .prepare(
      'UPDATE hunt_start_caps SET starts = starts + 1 WHERE ip_hash = ? AND day = ? AND starts < ?',
    )
    .bind(ipHash, day, HUNT_START_DAILY_CAP)
    .run()
  return Number(retried.meta.changes) === 1
}

export const practiceRoutes = new Hono<AppEnv>()

practiceRoutes.get('/practice/hunts', async (c) => {
  // Read-only, learner-safe; no cookie needed and nothing is minted.
  const data = HUNTS.map((hunt) => ({
    id: hunt.id,
    title: hunt.title,
    summary: hunt.summary,
    scenarioId: hunt.scenarioId,
    curriculum: HUNT_CURRICULUM[hunt.id],
  }))
  return c.json({ data } satisfies HuntListResponse)
})

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
  let live: { id: number; mode: 'clean' | 'bug_hunt'; huntId: string | null } | null = null
  if (presented && isTokenFormat(presented)) {
    const liveSession = await findLiveSession(c.env.DB, await hashSessionToken(presented))
    if (liveSession) {
      live = { id: liveSession.id, mode: liveSession.mode, huntId: liveSession.huntId }
    }
  }

  if (live && live.mode === 'bug_hunt' && live.huntId === hunt.id) {
    // Idempotent re-start of the hunt already active: re-stamp in place
    // (cart/orders/customer binding untouched) and do NOT consume the cap.
    await c.env.DB.prepare(
      "UPDATE practice_sessions SET mode = 'bug_hunt', hunt_id = ? WHERE id = ?",
    )
      .bind(hunt.id, live.id)
      .run()
    // Ensure the live in_progress attempt exists (Phase 4, P4-M1 WP2).
    // Idempotent — a retry after a mid-flight crash creates it here.
    await ensureLiveAttempt(c.env.DB, live.id, hunt.id)
    return c.json({
      mode: 'bug_hunt',
      hunt: {
        id: hunt.id,
        title: hunt.title,
        summary: hunt.summary,
        scenarioId: hunt.scenarioId,
        curriculum: HUNT_CURRICULUM[hunt.id],
      },
    } satisfies PracticeSessionResponse)
  }

  // Entering a hunt (fresh session or a switch from clean/another hunt)
  // counts against the per-IP daily cap. When no IP is visible (local
  // dev), the cap is skipped. SQL database hunts (kind: 'sql') never
  // consume the cap — that budget is reserved for the interactive UI/API
  // hunts (plan §9.4); abuse stays bounded by the global mutation backstop
  // and the one-in_progress-attempt-per-target unique index.
  const ip = clientIp(c)
  if (ip && hunt.kind !== 'sql') {
    const day = new Date().toISOString().slice(0, 10)
    const allowed = await consumeHuntStart(c.env.DB, day, await sha256Hex(ip))
    if (!allowed) {
      const retryAfter = 86400 - (Math.floor(Date.now() / 1000) % 86400)
      c.header('Retry-After', String(retryAfter))
      return c.json(
        {
          error: 'hunt_start_cap_reached',
          message:
            'The daily limit for starting practice hunts on this network has been reached. Try again tomorrow, or reset your session to clean mode instead.',
        },
        429,
      )
    }
  }

  if (live) {
    await c.env.DB.prepare(
      "UPDATE practice_sessions SET mode = 'bug_hunt', hunt_id = ? WHERE id = ?",
    )
      .bind(hunt.id, live.id)
      .run()
    // Entering a different hunt: reuse the live in_progress attempt for it,
    // or open a fresh one (Phase 4, P4-M1 WP2).
    await ensureLiveAttempt(c.env.DB, live.id, hunt.id)
    return c.json({
      mode: 'bug_hunt',
      hunt: {
        id: hunt.id,
        title: hunt.title,
        summary: hunt.summary,
        scenarioId: hunt.scenarioId,
        curriculum: HUNT_CURRICULUM[hunt.id],
      },
    } satisfies PracticeSessionResponse)
  }

  const fresh = await createSessionWithCart(c.env.DB, { mode: 'bug_hunt', huntId: hunt.id })
  setCookie(c, SESSION_COOKIE, fresh.token, cookieOptions(isSecureRequest(c.req.url)))
  // Phase 4, P4-M1 WP2: open the in_progress attempt for this hunt.
  await ensureLiveAttempt(c.env.DB, fresh.sessionId, hunt.id)
  return c.json({
    mode: 'bug_hunt',
    hunt: {
      id: hunt.id,
      title: hunt.title,
      summary: hunt.summary,
      scenarioId: hunt.scenarioId,
      curriculum: HUNT_CURRICULUM[hunt.id],
    },
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
