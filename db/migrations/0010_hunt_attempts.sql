-- Phase 4 (P4-M1 WP2) — hunt attempts and structured bug reports.
--
-- Additive only. Two new tables and two new indexes (one of them a partial
-- unique index enforcing the live-attempt invariant). No existing table is
-- altered and no previous migration is touched.
--
--   hunt_attempts — one row per attempt at a registered hunt by one practice
--                   session. hunt_id is the compiled registry id
--                   (src/server/hunts.ts), NOT a foreign key — hunts are
--                   TypeScript code, mirroring practice_sessions.hunt_id.
--                   Attempts belong to the practice session that created
--                   them and cascade-delete with it (the orders precedent):
--                   guest progress is exactly as durable as the session's
--                   7-day TTL and never outlives it. customer_id is nullable
--                   and is stamped at submit time when the browser is signed
--                   in (see src/server/reports.ts); ON DELETE SET NULL
--                   preserves the attempt snapshot if a customer row is ever
--                   removed, mirroring orders.customer_id. Signing in does
--                   NOT retroactively claim earlier guest rows.
--                   hint_mask bit 0/1/2 = hint levels 1/2/3 (0 when unused).
--                   best_quality_score stays NULL until a report is
--                   submitted and evaluated (WP3). discovered is sticky:
--                   once 1 it is never reset by the application.
--
--   bug_reports   — one row per submitted structured report. Belongs to the
--                   attempt it was filed against and cascade-deletes with it
--                   (which in turn cascades with the practice session).
--                   severity and priority are independent axes and are
--                   validated against their own vocabularies only; neither
--                   is ever derived from the other. quality_score and
--                   feedback are placeholders in WP2 (score 0, empty
--                   checklist) until WP3 lands the deterministic evaluator
--                   in the same request path; the columns exist now so the
--                   WP3 wiring is purely additive at the application layer.
--
-- Uniqueness: at most one in_progress attempt per (practice_session_id,
-- hunt_id), enforced by idx_hunt_attempts_one_live (a partial unique index).
-- Attempt creation is idempotent under retries and concurrency: the insert
-- is an ON CONFLICT DO NOTHING against that index followed by a re-read, so
-- two concurrent starts can never mint two live attempts. A new attempt
-- becomes available only after the previous one leaves in_progress
-- (submitted/revealed) or the session is deleted.
--
-- Field constraints: every free-text column carries a length CHECK that
-- mirrors the application-layer caps (defense in depth; the application
-- validates first and stores trimmed text). Newlines/tabs are permitted
-- inside multi-line fields at the application layer; the database accepts
-- any text within its length caps.
--
-- Write volume: one attempt row per hunt start (idempotent) and one report
-- row per submission. No defect ids, hint content, reveal content or
-- evaluation internals are stored here.

CREATE TABLE hunt_attempts (
  id INTEGER PRIMARY KEY,
  hunt_id TEXT NOT NULL CHECK (length(hunt_id) BETWEEN 1 AND 64),
  practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'revealed')),
  hint_mask INTEGER NOT NULL DEFAULT 0 CHECK (hint_mask BETWEEN 0 AND 7),
  best_quality_score INTEGER CHECK (best_quality_score BETWEEN 0 AND 100),
  discovered INTEGER NOT NULL DEFAULT 0 CHECK (discovered IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  submitted_at TEXT,
  revealed_at TEXT
);

CREATE INDEX idx_hunt_attempts_session_hunt
  ON hunt_attempts(practice_session_id, hunt_id, id);

CREATE UNIQUE INDEX idx_hunt_attempts_one_live
  ON hunt_attempts(practice_session_id, hunt_id)
  WHERE status = 'in_progress';

CREATE INDEX idx_hunt_attempts_customer
  ON hunt_attempts(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE TABLE bug_reports (
  id INTEGER PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES hunt_attempts(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  environment TEXT NOT NULL CHECK (length(environment) BETWEEN 1 AND 200),
  preconditions TEXT CHECK (preconditions IS NULL OR length(preconditions) <= 1000),
  steps TEXT NOT NULL CHECK (length(steps) BETWEEN 1 AND 4000),
  expected TEXT NOT NULL CHECK (length(expected) BETWEEN 1 AND 2000),
  actual TEXT NOT NULL CHECK (length(actual) BETWEEN 1 AND 2000),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  priority TEXT NOT NULL CHECK (priority IN ('p1', 'p2', 'p3', 'p4')),
  reproducibility TEXT NOT NULL DEFAULT 'always'
    CHECK (reproducibility IN ('always', 'sometimes', 'once')),
  quality_score INTEGER NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  feedback TEXT NOT NULL CHECK (length(feedback) <= 16384),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_bug_reports_attempt ON bug_reports(attempt_id, id);

UPDATE app_meta
SET value = '10', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
