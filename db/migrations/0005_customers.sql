-- Phase 3 (P3-M5) — synthetic customers and customer authentication sessions.
-- Meridian Outfitters is a fictional training storefront. Every customer row
-- below (and every seeded address) is invented; email addresses use the
-- RFC 2606 documentation domains (example.com / example.net / example.org).
-- No real personal data exists anywhere in this schema.
--
-- Identity architecture: a customer identity is NOT the practice-session
-- identifier. The anonymous `practice_sessions` row (mpl_session cookie)
-- still owns the cart and unassociated orders and remains the isolation
-- boundary for exercises. A signed-in customer adds a SECOND, independent
-- cookie (`mpl_customer`, see src/server/customer.ts) whose hashed token
-- lives in `customer_sessions` and is bound to the practice session that
-- established it — a customer session is only honoured while that practice
-- session is live. The two cookies are never interchangeable.
--
-- Passwords: PBKDF2-HMAC-SHA256 (100,000 iterations, 8-byte fixed salts),
-- stored as `pbkdf2:<iterations>:<salt_hex>:<hash_hex>`. The fixtures are
-- deterministic (fixed salts, fixed passwords documented in README.md) so a
-- fresh migration always yields the same hashes. Plaintext passwords appear
-- nowhere in the database. Verification uses Web Crypto (crypto.subtle),
-- which is available in the Cloudflare Workers runtime.
--
-- Orders placed while a customer is signed in are associated explicitly and
-- transactionally at placement time (`orders.customer_id`). Orders placed
-- before sign-in keep `customer_id NULL` and are never silently adopted by
-- a later login; they remain scoped to the practice session exactly as in
-- P3-M4. Deleting a customer row nulls the association (snapshots stay),
-- deleting the practice session cascades as before.

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'staff')),
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
  address_line TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_postcode TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer
  ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_practice
  ON customer_sessions(practice_session_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires
  ON customer_sessions(expires_at);

-- Nullable on purpose: guest orders (and pre-sign-in orders) have no
-- customer. ON DELETE SET NULL preserves the order snapshot if a customer
-- row is ever removed.
ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON orders(customer_id, created_at DESC);

-- Deterministic synthetic fixtures. ids are explicit; hashes are PBKDF2
-- (see header comment). Passwords (documented in README.md, training only):
--   demo-amara-1001 / demo-ben-1002 / demo-priya-1003 / demo-dana-1004 / demo-rowan-9001
INSERT OR IGNORE INTO customers
  (id, email, name, password_hash, role, status, address_line, address_city, address_postcode)
VALUES
  (1, 'amara.okafor@example.com', 'Amara Okafor',
   'pbkdf2:100000:0a1b2c3d4e5f6a7b:f86bff20be3eb6774bb2883cf88adb381450d3561a22cf35e35ebe873decc353',
   'customer', 'active', '48 Fellside Lane', 'Aldermere', 'AL9 4QT'),
  (2, 'ben.whitmore@example.net', 'Ben Whitmore',
   'pbkdf2:100000:1a2b3c4d5e6f7a8b:d71c48dea0e9883cf9dd7436583701dfe36fc2f805f9b6dbb1f3917f6c5b93fc',
   'customer', 'active', '12 Harbor Row', 'Kestrelford', 'KF2 8JD'),
  (3, 'priya.raman@example.org', 'Priya Raman',
   'pbkdf2:100000:2b3c4d5e6f7a8b9c:d318c3b0c06d2174f99ddfab778de33fe36e9c858065f6c61b1699d5e04ae5fb',
   'customer', 'active', '7 Juniper Walk', 'Brackenmoor', 'BM31 6QX'),
  (4, 'dana.reyes@example.com', 'Dana Reyes',
   'pbkdf2:100000:3c4d5e6f7a8b9c0d:8ea8193adf6b910f63296bd5c185aa740d0edf786892b6a828c67a4e91bfa450',
   'customer', 'suspended', '129 Tollgate Street', 'Aldermere', 'AL4 1RN'),
  (5, 'rowan.ellison@example.com', 'Rowan Ellison',
   'pbkdf2:100000:4d5e6f7a8b9c0d1e:084a5d0c5134c54b43f4abc943a6cd5c712db24ca993d84e88fcf6caa1ff53ed',
   'staff', 'active', '1 Testbench Way (Meridian Outfitters practice office)', 'Aldermere', 'AL1 0QA');

UPDATE app_meta
SET value = '5', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
