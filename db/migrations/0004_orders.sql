-- Phase 3 (P3-M4) — orders and checkout idempotency.
-- Orders belong to the anonymous practice session that placed them; deleting
-- or expiring the session cascades to its orders and their items. The
-- public identifier is an opaque `reference` (ORD-<16 uppercase hex chars>).
-- Sequential database ids are never exposed to clients.
--
-- Immutability: order_items snapshot product_name, product_slug,
-- unit_price_cents and line_total_cents at placement time, so renaming,
-- repricing, deactivating or deleting a product never rewrites history.
-- product_id is nullable with ON DELETE SET NULL to preserve the snapshot
-- even if the product row is removed; orders/items are never repriced.
--
-- Money is integer cents. `status` and `payment_status` are stored
-- separately. Only `approved` payments create an order; a declined payment
-- creates nothing, leaves the cart intact and never decrements stock
-- (simulated authorization failure), and is recorded in
-- checkout_idempotency so a legitimate retry replays the same outcome.
--
-- Atomicity: checkout runs as ONE D1 batch. SQLite's inventory CHECK
-- (quantity >= 0, see 0002) turns an oversell into a statement failure,
-- which rolls back the entire batch — never a partial order, never stock
-- decremented without an order, never a cleared cart after a failure.

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  -- Status lifecycle. P3-M4 ships only 'placed'; M6 may add 'cancelled'/'fulfilled'.
  status TEXT NOT NULL CHECK (status IN ('placed')),
  -- Simulated payment outcome. Only 'approved' rows can exist today —
  -- declines never persist an order. The column is explicit so the
  -- order/payment split survives M5/M6 changes.
  payment_status TEXT NOT NULL CHECK (payment_status IN ('approved', 'declined')),
  -- Minimum synthetic checkout details. No card or banking data is ever stored.
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_line TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_postcode TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_session_created
  ON orders(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Nullable so a deleted product never breaks a stored order.
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Session-scoped checkout idempotency. PRIMARY KEY (session_id,
-- idempotency_key) enforces exactly-once placement even under concurrent
-- submissions; the competing writer's batch fails on this constraint and
-- rolls back entirely. request_hash binds the key to the material payload
-- (validated checkout details + payment outcome + cart contents); reuse
-- with a different payload is rejected with 409.
CREATE TABLE IF NOT EXISTS checkout_idempotency (
  session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'declined')),
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (session_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_checkout_idempotency_order
  ON checkout_idempotency(order_id);

UPDATE app_meta
SET value = '4', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
