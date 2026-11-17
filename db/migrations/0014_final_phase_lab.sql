-- Phase 8 (final development phase) — Performance, Security & Microservices/Event-Driven Testing Lab.
--
-- Scope: the D1-backed, deterministic, session-scoped EVENT SIMULATION for the
-- Microservices & Event-Driven Testing lab. Everything else in this phase is
-- compiled-in code (defects, exercises, hints, reveals, rubrics) or reuses the
-- Phase 4 control plane (hunt_attempts, bug_reports, rate_limit_buckets) — no
-- changes there.
--
-- Tables:
--   events              — one row per (synthetic) event in a practice session.
--                         Status lifecycle: pending -> processed | failed -> (retry)
--                         -> dead. available_at implements exponential backoff
--                         between learner-triggered process calls.
--   service_state       — per-session key/value projection of the simulated
--                         services' state (inventory reservations, captures,
--                         dedup markers, applied sequence numbers, webhook
--                         receipts). Keyed (practice_session_id, service, key).
--   webhook_deliveries  — one row per simulated webhook delivery attempt series
--                         for an event; never performs a network fetch.
--
-- All rows are practice-session scoped with ON DELETE CASCADE — deleting an
-- expired/abandoned practice session removes its simulation state with it.
-- Nothing here is shared across sessions and nothing references production
-- data. Expected payload/answer data never reaches D1.
--
-- Bounded by construction: process handles at most 10 due events per call;
-- payload_json is capped at 512 bytes by the writer; statuses are CHECKed;
-- available_at keeps retry storms observable but finite; max_attempts caps
-- retries (default 3).
--
-- 0014 must be applied to production only as part of a separately approved
-- release, after a pre-migration export — the same protocol as 0012/0013.
-- Local development applies it via npm run db:migrate:local.

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order.created', 'inventory.reserved', 'payment.processed', 'webhook.deliver')),
  payload_json TEXT NOT NULL CHECK (length(payload_json) <= 512),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  available_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX events_session_status_due ON events (practice_session_id, status, available_at);
CREATE INDEX events_session_correlation ON events (practice_session_id, correlation_id, seq);

CREATE TABLE service_state (
  practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  state_key TEXT NOT NULL,
  state_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (practice_session_id, service, state_key)
);

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  http_status INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX webhook_deliveries_session_status ON webhook_deliveries (practice_session_id, status);

UPDATE app_meta SET value = '14', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE key = 'schema_version';
