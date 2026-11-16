-- P3-M9 — local maintenance sweep (LOCAL ONLY). Never run this against a
-- remote database: this file is applied exclusively through
-- `npm run db:cleanup:local`, which passes `--local` to wrangler. It mirrors
-- src/server/maintenance.ts (the staff-only POST /api/v1/admin/maintenance/sweep
-- endpoint is the canonical path for a deployed environment) for housekeeping
-- of the local developer database. Every statement is bounded and idempotent.
--
-- What it removes (expired learner state, bounded to 100 rows per table):
--   - expired customer_sessions (binding to a dead practice session is useless)
--   - expired practice_sessions — cascades carts, cart items, orders,
--     order items, checkout idempotency records and bound customer sessions
--     (and, via them, hunt attempts and bug reports)
--   - hunt_start_caps rows whose day is not today (UTC)
--   - rate_limit_buckets rows older than ~2 hours
--   - expired or revoked api_tokens
--
-- What it NEVER touches: inventory_adjustments and order_cancellations
-- (append-only audit trail / exactly-once cancellation marker), customers,
-- products, categories, inventory, and any unexpired session.

DELETE FROM customer_sessions
WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  AND id IN (
    SELECT id FROM customer_sessions
    WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    LIMIT 100
  );

DELETE FROM practice_sessions
WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  AND id IN (
    SELECT id FROM practice_sessions
    WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    LIMIT 100
  );

DELETE FROM hunt_start_caps
WHERE day != date('now')
  AND ip_hash IN (
    SELECT ip_hash FROM hunt_start_caps
    WHERE day != date('now')
    LIMIT 100
  );

DELETE FROM rate_limit_buckets
WHERE window_start < CAST(strftime('%s', 'now') AS INTEGER) / 60 - 120
  AND rowid IN (
    SELECT rowid FROM rate_limit_buckets
    WHERE window_start < CAST(strftime('%s', 'now') AS INTEGER) / 60 - 120
    LIMIT 100
  );

DELETE FROM api_tokens
WHERE (expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now') OR revoked_at IS NOT NULL)
  AND id IN (
    SELECT id FROM api_tokens
    WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now') OR revoked_at IS NOT NULL
    LIMIT 100
  );
