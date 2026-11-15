-- P3-M8: Bug-hunt defect set & scenario wiring — per-IP hunt-start cap.
--
-- Additive only. One new table:
--   hunt_start_caps — at most one row per hashed IP address, holding the
--                     UTC day the counter applies to and the number of hunt
--                     starts recorded for it. A row whose `day` is not today
--                     is treated as zero and overwritten on the next write,
--                     so the table stays bounded without a sweep job.
--                     Only a SHA-256 hash of the IP is stored, never the raw
--                     address. No defect flag, hunt state or session state
--                     lives here; activation is still resolved per request
--                     from the caller's own practice session.
--
-- Write volume is one counter update per hunt start; read volume is one
-- primary-key lookup per hunt start.

CREATE TABLE hunt_start_caps (
  ip_hash TEXT PRIMARY KEY NOT NULL,
  day TEXT NOT NULL,
  starts INTEGER NOT NULL DEFAULT 0 CHECK (starts >= 0)
);

UPDATE app_meta
SET value = '8', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
