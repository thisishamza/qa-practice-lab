-- Phase 5 (P5-M2) — synthetic practice API tokens.
--
-- Additive only. One new table and two new indexes. No existing table is
-- altered and no previous migration is touched.
--
--   api_tokens — one row per minted practice API token. Tokens are OPAQUE
--                256-bit values; only their SHA-256 hash is stored here.
--                The raw token is returned to the browser exactly once, in
--                the 201 response to POST /api/v1/auth/token, and is never
--                stored, logged or returned again.
--
--                Tokens are NOT bound to a practice session: an API
--                credential must outlive the tab that minted it. They ARE
--                bound to customer_id, carry the same synthetic trust
--                properties as the mpl_customer cookie, and are never valid
--                for anything the cookie is not (same guards, same suspended
--                behaviour, same response schemas). Resolution order:
--                Authorization: Bearer if present, else mpl_customer; if both
--                are present the Bearer token wins.
--
--                expires_at is clamped server-side to 15–900 seconds after
--                creation (POST /api/v1/auth/token enforces the clamp).
--                revoked_at is set when a token is revoked (logout deletes
--                the caller's rows outright instead; revoked_at exists so a
--                token revoked by any future path fails closed and so the
--                maintenance sweep can purge revoked rows). Expired rows are
--                deleted lazily on first contact.
--
--                ON DELETE CASCADE: deleting a customer row removes their
--                tokens. Practice-session cascade does NOT apply (tokens are
--                deliberately not session-scoped).
--
-- Retention: expired or revoked tokens are purged by the operator-invoked
-- maintenance sweep (bounded, idempotent) and lazily on first contact — no
-- cron exists on Pages Functions.
--
-- Write volume: one row per mint. Negligible against free-tier ceilings.

CREATE TABLE api_tokens (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX idx_api_tokens_customer ON api_tokens(customer_id);
CREATE INDEX idx_api_tokens_expiry ON api_tokens(expires_at);

UPDATE app_meta
SET value = '11', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
