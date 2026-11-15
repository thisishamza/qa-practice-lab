-- P3-M7: Bug-hunt engine v1 — practice-session modes.
--
-- Additive only. `practice_sessions` gains:
--   mode    — 'clean' (default) or 'bug_hunt'. Every pre-existing row
--             becomes 'clean', so existing guests and signed-in customers
--             keep byte-identical behaviour.
--   hunt_id — the id of the hunt from the server-side registry
--             (src/server/hunts.ts), NULL in clean mode. Deliberately NOT a
--             foreign key: hunts are compiled TypeScript, not database rows,
--             so the registry stays the single source of truth and the D1
--             schema never needs to know it.
--
-- No defect flag lives on any shared row; activation is always resolved
-- per request from the caller's own session. There is no admin/teacher
-- activation surface in Phase 3.

ALTER TABLE practice_sessions
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'clean' CHECK (mode IN ('clean', 'bug_hunt'));

ALTER TABLE practice_sessions
  ADD COLUMN hunt_id TEXT NULL CHECK (hunt_id IS NULL OR length(hunt_id) BETWEEN 1 AND 64);

UPDATE app_meta
SET value = '7', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
