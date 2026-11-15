-- Phase 3 (P3-M6) — inventory depth.
--
-- Two append-only tables. No existing table is altered, so this applies
-- cleanly on top of 0002..0005 and cannot orphan orders, items, sessions
-- or carts.
--
-- 1. inventory_adjustments — immutable audit trail of every stock movement
--    that is NOT a checkout decrement (those are implicit in orders):
--    staff restocks and cancellation restores. Each row records the product,
--    the signed quantity delta, the actor (nullable customer for synthetic
--    staff, nullable practice session for guest cancellations), the reason
--    and the time. Rows are never updated or deleted by the application.
--    `actor_customer_id` / `actor_session_id` / `order_id` are nullable and
--    ON DELETE SET NULL so the audit trail outlives its subjects.
--
-- 2. order_cancellations — the order-cancellation event. Its primary key
--    (order_id) is what makes `placed → cancelled` exactly-once and
--    idempotent: the cancelling batch INSERTs into this table first, and a
--    repeated or concurrent cancel violates the primary key, aborting the
--    whole batch (mirroring the checkout idempotency design in 0004). The
--    cancellation is recorded here instead of flipping orders.status so the
--    orders row stays an append-only snapshot; the API derives the public
--    status ('placed' | 'cancelled') and the cancellation timestamp by
--    LEFT JOINing this table at read time.

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Positive delta in units. Restocks and cancellation restores both add
  -- stock; no removal path exists yet, so the CHECK pins delta > 0.
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta > 0),
  reason TEXT NOT NULL CHECK (reason IN ('restock', 'order_cancellation')),
  note TEXT,
  actor_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  actor_session_id INTEGER REFERENCES practice_sessions(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product
  ON inventory_adjustments(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_order
  ON inventory_adjustments(order_id);

CREATE TABLE IF NOT EXISTS order_cancellations (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES practice_sessions(id) ON DELETE SET NULL,
  actor_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

UPDATE app_meta
SET value = '6', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
