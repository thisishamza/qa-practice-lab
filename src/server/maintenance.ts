// Maintenance sweeps and the staff-only sweep endpoint (P3-M9).
//
// The app has no cron trigger: Cloudflare Pages Functions cannot register a
// cron (that needs a Workers project, which Phase 3 deliberately does not
// add). Row expiry is therefore handled three ways, all bounded and
// idempotent:
//   1. Lazily, inline: findLiveSession/findLiveCustomerSession delete the
//      expired row they stumble over (existing behaviour, unchanged).
//   2. On write for the hunt-start caps (day != today) and via the
//      maintenance sweep below for everything else.
//   3. Explicitly, via `POST /api/v1/admin/maintenance/sweep` (staff-only)
//      or `npm run db:cleanup:local` (SQL equivalent, local only).
// A future Workers cron can call `sweepExpiredData` directly.
//
// Retention policy (documented in README.md and docs/phase-3-exit-audit.md):
// - Expired practice sessions are deleted. ON DELETE CASCADE removes their
//   cart, cart items, orders, order items, checkout idempotency records and
//   bound customer sessions with them. Synthetic learner data never outlives
//   its session.
// - Expired customer sessions are deleted (they would never authenticate
//   again anyway).
// - Rate-limit buckets older than two hours are deleted (they are dead
//   letters; the current window is what matters).
// - hunt_start_caps rows whose day is not today are deleted.
// - inventory_adjustments and order_cancellations are NEVER deleted: they
//   are the append-only audit trail and the exactly-once cancellation
//   marker. Deleting them would break stock accounting and idempotency.
//   order_cancellations rows cascade-delete together with their order when
//   that order's practice session expires — by design (the whole session
//   scope disappears together).
// - Active (unexpired) sessions, live carts, live orders and customer rows
//   are never touched, regardless of age.
//
// Every sweep is bounded (SWEEP_LIMIT rows per call per table) and safe to
// re-run any number of times — the second run simply deletes zero rows.

import { Hono } from 'hono'
import type { AppEnv } from './app'
import { requireStaff } from './staff'

export const SWEEP_LIMIT = 100
const RATE_LIMIT_BUCKET_RETENTION_SECONDS = 2 * 60 * 60
const WINDOW_SECONDS = 60

export interface SweepCounts {
  customerSessions: number
  practiceSessions: number
  huntStartCaps: number
  rateLimitBuckets: number
}

async function changesOf(result: { meta: { changes?: number | bigint } }): Promise<number> {
  return Number(result.meta.changes ?? 0)
}

/** Deletes up to `limit` rows matching `where` in `table`, via an indexed subquery. */
async function boundedDelete(
  db: D1Database,
  table: string,
  idColumn: string,
  whereSql: string,
  binds: unknown[],
  limit: number,
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM ${table}
       WHERE ${idColumn} IN (SELECT ${idColumn} FROM ${table} WHERE ${whereSql} LIMIT ?)`,
    )
    .bind(...binds, limit)
    .run()
  return changesOf(result)
}

function isoNow(now: Date): string {
  return now.toISOString()
}

function currentWindowStart(now: Date): number {
  return Math.floor(Math.floor(now.getTime() / 1000) / WINDOW_SECONDS)
}

export async function sweepExpiredData(
  db: D1Database,
  options: { now?: Date; limit?: number } = {},
): Promise<SweepCounts> {
  const now = options.now ?? new Date()
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? SWEEP_LIMIT), 1), 500)
  const nowIso = isoNow(now)
  const today = nowIso.slice(0, 10)
  const cutoffWindow = currentWindowStart(now) - Math.floor(RATE_LIMIT_BUCKET_RETENTION_SECONDS / WINDOW_SECONDS)

  const customerSessions = await boundedDelete(
    db,
    'customer_sessions',
    'id',
    'expires_at <= ?',
    [nowIso],
    limit,
  )
  const practiceSessions = await boundedDelete(
    db,
    'practice_sessions',
    'id',
    'expires_at <= ?',
    [nowIso],
    limit,
  )
  const huntStartCaps = await boundedDelete(
    db,
    'hunt_start_caps',
    'ip_hash',
    'day != ?',
    [today],
    limit,
  )
  const rateLimitBuckets = await boundedDelete(
    db,
    'rate_limit_buckets',
    'rowid',
    'window_start < ?',
    [cutoffWindow],
    limit,
  )

  return { customerSessions, practiceSessions, huntStartCaps, rateLimitBuckets }
}

export const maintenanceRoutes = new Hono<AppEnv>()

/**
 * Staff-only maintenance trigger. There is no cron on Pages Functions, so
 * an operator (or, after deployment, a curl on a schedule of the operator's
 * choosing) invokes this to bound table growth between the lazy inline
 * sweeps. Bounded and idempotent; returns how many rows were removed per
 * table so the operator can see the effect. Reads nothing live.
 */
maintenanceRoutes.post('/admin/maintenance/sweep', async (c) => {
  const staff = await requireStaff(c)
  if (staff.kind === 'error') {
    return staff.response
  }

  const deleted = await sweepExpiredData(c.env.DB)
  return c.json({ ok: true, deleted } satisfies { ok: true; deleted: SweepCounts })
})
