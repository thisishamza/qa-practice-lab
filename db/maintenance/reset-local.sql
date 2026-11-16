-- P3-M9 — local demo reset (LOCAL ONLY, DESTRUCTIVE). Never run this against
-- a remote database: this file is applied exclusively through
-- `npm run db:reset:local`, which passes `--local` to wrangler. It exists so a
-- maintainer can return the LOCAL throwaway database to the seeded demo state
-- without hunting down probe state by hand. It is intentionally separate from
-- the learner-facing Clean Mode reset (POST /api/v1/practice/session/reset),
-- which is non-destructive by design and never deletes anything.
--
-- It deletes ALL learner state: carts and cart items, orders and order items,
-- checkout idempotency records, customer sessions, practice sessions, order
-- cancellation markers, inventory adjustments (audit history of probe work),
-- hunt-start caps, rate-limit buckets, hunt attempts, bug reports and API
-- tokens. It then restores the seed inventory
-- quantities and low-stock thresholds from 0002_commerce_domain.sql.
--
-- It keeps: the schema, the catalogue (products/categories), the synthetic
-- customer fixtures, and app_meta (including schema_version). Nothing here
-- runs migrations; run `npm run db:migrate:local` first if the schema is
-- older than the migration files. This script is not a substitute for the
-- learner-facing reset button, and it is never invoked by any application code.

-- bug_reports/hunt_attempts are listed explicitly even though the
-- reference rows cascade from practice_sessions: the file must remain a
-- complete, honest inventory of what a reset removes.
DELETE FROM bug_reports;
DELETE FROM hunt_attempts;
DELETE FROM api_tokens;
DELETE FROM order_cancellations;
DELETE FROM inventory_adjustments;
DELETE FROM checkout_idempotency;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM cart_items;
DELETE FROM carts;
DELETE FROM customer_sessions;
DELETE FROM practice_sessions;
DELETE FROM hunt_start_caps;
DELETE FROM rate_limit_buckets;

-- Restore the seed inventory (42 rows; threshold 10 for product 9, else 5).
UPDATE inventory
SET quantity = CASE product_id
WHEN 1 THEN 24 WHEN 2 THEN 12 WHEN 3 THEN 30 WHEN 4 THEN 48 WHEN 5 THEN 4 WHEN 6 THEN 20 WHEN 7 THEN 26 WHEN 8 THEN 15 WHEN 9 THEN 8 WHEN 10 THEN 60 WHEN 11 THEN 18 WHEN 12 THEN 10 WHEN 13 THEN 7 WHEN 14 THEN 40 WHEN 15 THEN 55 WHEN 16 THEN 22 WHEN 17 THEN 0 WHEN 18 THEN 36 WHEN 19 THEN 28 WHEN 20 THEN 4 WHEN 21 THEN 3 WHEN 22 THEN 6 WHEN 23 THEN 9 WHEN 24 THEN 33 WHEN 25 THEN 44 WHEN 26 THEN 25 WHEN 27 THEN 19 WHEN 28 THEN 70 WHEN 29 THEN 14 WHEN 30 THEN 80 WHEN 31 THEN 50 WHEN 32 THEN 38 WHEN 33 THEN 16 WHEN 34 THEN 0 WHEN 35 THEN 42 WHEN 36 THEN 90 WHEN 37 THEN 65 WHEN 38 THEN 5 WHEN 39 THEN 58 WHEN 40 THEN 47 WHEN 41 THEN 100 WHEN 42 THEN 100
ELSE quantity
END,
low_stock_threshold = CASE product_id
WHEN 9 THEN 10 ELSE 5 END
;
