-- P3-M9: Hardening, reset & Phase 3 exit — bounded fixed-window rate limiting.
--
-- Additive only. One new table:
--   rate_limit_buckets — one row per (scope+IP-hash, fixed window).
--                        Scopes: 'login' (failed attempts), 'checkout'
--                        (order placement), 'mutate' (every mutating
--                        /api/v1 endpoint). Only a SHA-256 hash of the IP
--                        is stored, never the raw address. Windows are
--                        aligned to the unix minute (window_start is
--                        floor(now / 60)). Rows older than ~2 hours are
--                        deleted by the maintenance sweep
--                        (POST /api/v1/admin/maintenance/sweep) and are
--                        ignored for reads; deleted-or-absent rows are
--                        treated as zero.
--
-- Writes are one upsert per consume call; there is no per-request prune
-- query — the sweep handles expiry, keeping the hot path at one statement.
-- Cloudflare free-tier friendly: a learner's steady-state footprint is at
-- most a handful of rows per minute across the three scopes.

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_window
  ON rate_limit_buckets(window_start);

UPDATE app_meta
SET value = '9', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
