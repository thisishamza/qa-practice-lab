-- Phase 1 foundation schema.
-- Only platform metadata lives here. Practice-domain tables arrive in later phases.

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_version', '1');
