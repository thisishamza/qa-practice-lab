// SQL exercise & SQL hunt hints (Phase 6 M2, plan §10.4) — CODE, not data.
//
// Three levels per exercise/hunt, in a strict ladder:
//   Level 1 — Orient: which tables and what normal looks like.
//   Level 2 — Focus: which comparison to probe, which predicate to shape.
//   Level 3 — Narrow: the precise condition to test — one step from the answer.
//
// Server-only. Hints never name defect internals, expected result values or
// reference solutions; they orient, focus, then narrow. The ladder is enforced
// by src/server/learning.ts (unlock order, idempotency, attempt scoping).

import type { HintLevel, HuntHints } from './hints'

export const SQL_HINTS: Record<string, HuntHints> = {
  // ------------------------------------------------------------------ BEGINNER
  'sql-bgn-select-01': {
    level1: 'One table is involved: the eight-category reference table. Look at its shape in the schema explorer first — id, slug, name, sort_order.',
    level2: 'Write the simplest possible query: project two columns from that one table. No filters, no joins, no aggregates.',
    level3: 'Project exactly the two asked-for columns (slug, name) and read the table back in full — every category, nothing more.',
  },
  'sql-bgn-where-02': {
    level1: 'Two tables describe the products we sell; the category number in the task is the key. Start from the products table and know which column references it.',
    level2: 'Two predicates must hold at once — category membership and the price ceiling. Combine them with AND inside WHERE.',
    level3: 'category_id = 3 selects climbing; price_cents < 10000 keeps only the cheap ones. Strict inequality — a product at exactly 10000 is excluded.',
  },
  'sql-bgn-orderby-03': {
    level1: 'The orders table records when each order was placed. Find the timestamp column and think about how ISO-8601 text sorts.',
    level2: 'You need the newest — so descending order on the placement timestamp — and only a handful of them.',
    level3: 'ORDER BY that timestamp DESC followed by a small LIMIT. Ties on the same second are broken by order_number descending so the order is total.',
  },
  'sql-bgn-limit-04': {
    level1: 'Pages share one stable ordering decided by you in the query. Pick the column that never moves between pages.',
    level2: 'Page 2 of 10-per-page is the second slice of that ordering — LIMIT picks the page size, OFFSET skips what came before it.',
    level3: 'ORDER BY id, then LIMIT 10 OFFSET 10 — ten rows starting after the first ten. Any other ordering leaks rows between pages.',
  },
  'sql-bgn-distinct-05': {
    level1: 'The status column on orders is the domain you need to enumerate — see what the CHECK constraint allows.',
    level2: 'Duplicates are noise for this census; there is a keyword that collapses them in the projection itself.',
    level3: 'SELECT the status column with the duplicate-collapsing keyword applied — one row per distinct status value, no GROUP BY required.',
  },
  'sql-bgn-ops-06': {
    level1: 'Customer lifecycle states are stored in one small status column. Find it and see the two values it can hold.',
    level2: 'You want exactly the non-active half — a single equality comparison in the WHERE clause is the whole filter.',
    level3: "WHERE status = 'suspended' — plus a deterministic ORDER BY id so the report is stable for review.",
  },
  'sql-bgn-agg-07': {
    level1: 'Aggregates collapse a whole table into one row. The two questions are “how many” and “how much in total”.',
    level2: 'count(*) answers how many rows; sum() over the cents column answers how much. Both go in the same select list.',
    level3: 'SELECT count(*) and sum(total_cents) in one query; alias them total_orders and gross_cents. One row comes out.',
  },
  'sql-bgn-count-08': {
    level1: 'Some customers ordered many times; the raw order count is not the customer count. Find the column linking an order to its customer.',
    level2: 'You need one order per customer counted exactly once — the counting function has a form that collapses repeats.',
    level3: 'count(DISTINCT customer_id) over the orders table — that is customers, not orders.',
  },
  'sql-bgn-between-09': {
    level1: 'June 2026 is a closed window. The timestamps are stored as ISO-8601 UTC text, which compares like ordinary text.',
    level2: 'BETWEEN takes a lower and an upper bound — both inclusive. Make sure the upper bound covers the whole of June 30.',
    level3: "BETWEEN '2026-06-01T00:00:00Z' AND '2026-06-30T23:59:59Z' — count(*) and sum(total_cents) in the same query.",
  },
  'sql-bgn-like-10': {
    level1: 'The search term lives inside the product name text. You are matching a substring, wherever it appears.',
    level2: 'LIKE compares against a pattern; a pattern with wildcards on both sides matches substrings anywhere in the string.',
    level3: "WHERE name LIKE '%tent%' — both wildcards required, ORDER BY id for a stable report.",
  },
  'sql-bgn-text-11': {
    level1: 'Every email hides its domain after the @. Three functions together — find, slice, normalize — can extract it.',
    level2: 'instr locates the @, substr slices from one past it to the end, lower folds case. Then group the derived column like any other.',
    level3: "GROUP BY lower(substr(email, instr(email, '@') + 1)) with count(*) — the derived column behaves exactly like a real one.",
  },
  'sql-bgn-null-12': {
    level1: 'Contactability defects live in two columns: marketing_opt_in and phone. One is a flag, the other is nullable text.',
    level2: 'NULL is not a value — it means “absent”. The only correct membership test for it is IS NULL, never = NULL.',
    level3: 'WHERE marketing_opt_in = 1 AND phone IS NULL — both predicates; then project the emails.',
  },
  // -------------------------------------------------------------- INTERMEDIATE
  'sql-int-groupby-01': {
    level1: 'Every order carries the parts of its own total: subtotal, shipping, tax. The defect class hides where total disagrees with parts.',
    level2: 'Derive the expected total inside the query (subtotal + shipping + tax) and compare it against the stored total_cents in the same WHERE.',
    level3: 'expected_total_cents := subtotal_cents + shipping_cents + tax_cents; keep rows where total_cents <> that expression.',
  },
  'sql-int-having-02': {
    level1: 'Duplicates share a shape: same customer, same calendar day, same amount. The orders table holds everything you need — no other tables.',
    level2: 'Group by the (customer, day, total) trio — date() truncates the timestamp — and filter groups, not rows, for size > 1.',
    level3: "GROUP BY customer_id, date(placed_at), total_cents HAVING count(*) > 1 — date(placed_at) is the day bucket.",
  },
  'sql-int-join-03': {
    level1: 'Two tables, one money story: orders say what should have been captured; payments say what actually was. Join them on order id.',
    level2: 'An approved payment ought to equal its order total. Compute the comparison across the joined row pair in WHERE.',
    level3: "WHERE p.status = 'approved' AND p.amount_cents <> o.total_cents — exclude refunds and pendings; they are expected to differ.",
  },
  'sql-int-outerjoin-04': {
    level1: 'Out of stock on hand (quantity = 0) is the finding class. The interesting part is the ORDER history joined onto it — and products with none.',
    level2: 'Products without any orders must still appear with a NULL for last order — that is what an outer (LEFT) join preserves.',
    level3: 'FROM inventory i JOIN products p JOIN LEFT order_items LEFT orders … WHERE i.quantity = 0 GROUP BY p.id — keep the LEFT JOINs, then max(placed_at).',
  },
  'sql-int-multijoin-05': {
    level1: 'One order, many lines, one product table. Three tables, joined through the line items — start from the orders row for MO-2025-0058.',
    level2: 'Scope to the single order first (WHERE o.order_number = …), then walk orders → order_items → products for the lines.',
    level3: 'WHERE o.order_number = \'MO-2025-0058\' with the two joins spelled out and explicit aliases — order_items keys by order_id, products by id.',
  },
  'sql-int-subq-in-06': {
    level1: 'The October order cohort lives in the orders table. You want the emails of the customers who produced those rows.',
    level2: 'First produce the set of October orderer ids with a subquery; then outer-test membership of that set.',
    level3: "WHERE c.id IN (SELECT o.customer_id FROM orders o WHERE o.placed_at >= '2026-10-01T00:00:00Z' AND o.placed_at < '2026-11-01T00:00:00Z') — half-open bounds, distinct emails out.",
  },
  'sql-int-subq-exists-07': {
    level1: 'Addresses accumulate unused rows; orders reference addresses only when they ship. Find the addresses nothing references.',
    level2: 'For each address, ask whether at least one order points at it — an existence test, per address.',
    level3: 'NOT EXISTS (SELECT 1 FROM orders WHERE shipping_address_id = a.id) — one correlated probe per address; the count is the answer.',
  },
  'sql-int-correlated-08': {
    level1: 'Gold-tier customers are the outer set. For each of them you want one number/timestamp — their newest order.',
    level2: 'A subquery in the SELECT list that re-evaluates per gold customer — correlated to the outer row via customer id.',
    level3: '(SELECT max(o.placed_at) FROM orders o WHERE o.customer_id = c.id) — same id as the outer row; NULL when no orders exist.',
  },
  'sql-int-case-09': {
    level1: 'Buckets are derived values; the column does not exist yet. CASE evaluates conditions in order and yields the first match.',
    level2: 'Write the bucket expression once — two thresholds, three outcomes — then GROUP BY that derived expression.',
    level3: "CASE WHEN total_cents < 5000 THEN 'small' WHEN total_cents < 20000 THEN 'medium' ELSE 'large' END AS bucket — group by bucket, count(*) per group.",
  },
  'sql-int-dates-text-10': {
    level1: 'Two filters compose the pipeline rot: lifecycle status and age. Both live on the orders table alone.',
    level2: 'Half-open comparison against a fixed cutoff keeps the test reproducible — a 30-day stale window against the 2026-11-17 audit date.',
    level3: "WHERE status IN ('pending','placed') AND placed_at < '2026-10-18T00:00:00Z' — count and sum in one row.",
  },
  'sql-int-insert-11': {
    level1: 'You are writing a scratch row into the categories table — then proving it landed. Two steps, one statement each.',
    level2: 'The insert needs every NOT NULL column; sort_order can take 99 to stay off the seeded 1–8. The read-back selects by the unique slug.',
    level3: "INSERT ('qa-test-exports', 'QA Test Exports', …, 99) — then SELECT slug, name WHERE slug = 'qa-test-exports'.",
  },
  'sql-int-update-12': {
    level1: 'The defect class is a stale low-stock threshold on inventory rows. You are asked to rewrite exactly the affected rows, nothing else.',
    level2: 'Bound the write with WHERE quantity <= 5, then count who qualifies before/after — the count is the deliverable.',
    level3: 'UPDATE inventory SET low_stock_threshold = 3 WHERE quantity <= 5 — the verification counts rows matching that same predicate with threshold = 3.',
  },
  'sql-int-delete-13': {
    level1: 'A scratch order (MO-TEST-900001) was staged with two lines and one payment purely for you to delete. Cascade behaviour is the lesson.',
    level2: 'One DELETE on the aggregate root should dispose of all dependents — orders → order_items, payments via ON DELETE CASCADE.',
    level3: 'DELETE FROM orders WHERE order_number = \'MO-TEST-900001\' — then let the verification count what remains: orders, items, payments.',
  },
  // ------------------------------------------------------------------ ADVANCED
  'sql-adv-txn-01': {
    level1: 'This one is a drill: do the wrong thing safely. A transaction gives you a sandbox with an undo — use it.',
    level2: 'BEGIN, then the destructive UPDATE against product 5, then ROLLBACK — wrap and discard. No COMMIT.',
    level3: 'BEGIN; UPDATE inventory SET quantity = 0 WHERE product_id = 5; ROLLBACK; — quantity must come back as 4.',
  },
  'sql-adv-constraints-02': {
    level1: 'Two orphaned line items were injected with foreign keys switched off. They reference products that do not exist.',
    level2: 'For each line item, ask whether its product_id matches any real product — an existence test per row.',
    level3: 'NOT EXISTS (SELECT 1 FROM products p WHERE p.id = oi.product_id) — the two injected rows are the whole result.',
  },
  'sql-adv-explain-04': {
    level1: 'SQLite will tell you what it plans to do if you ask — EXPLAIN QUERY PLAN on the exact query in the task.',
    level2: 'The output rows name the structure used — index or scan — for each operator in the plan tree.',
    level3: 'EXPLAIN QUERY PLAN SELECT count(*) FROM orders WHERE status = \'pending\'; — read the detail column for the index name it uses.',
  },
  'sql-adv-index-05': {
    level1: 'A composite index on (customer_id, status) serves the dashboard query shape. Build it, then prove it exists.',
    level2: 'CREATE INDEX with IF NOT EXISTS; then the catalog function that lists a table’s indexes tells you it landed.',
    level3: "pragma_index_list('orders') filtered to name = 'idx_orders_test_lookup' — the origin should read 'c'.",
  },
  'sql-adv-cte-06': {
    level1: 'Gold customers with no real spend hide in a two-step question: first compute per-customer spend, then filter it. A CTE holds step one.',
    level2: 'The CTE aggregates non-cancelled spend per customer with a LEFT JOIN + coalesce guard; the outer SELECT filters and orders.',
    level3: 'WITH spend AS (… GROUP BY c.id) SELECT … WHERE loyalty_tier = \'gold\' AND spend_cents < 1000 — expect four rows.',
  },
  'sql-adv-recursive-07': {
    level1: 'December is missing from every monthly report. Generate the whole 2026 month series yourself instead of selecting only the months that exist.',
    level2: 'WITH RECURSIVE builds the series n = 1..12; the LEFT JOIN against month-labelled orders then keeps empty months as zero rows.',
    level3: "WITH RECURSIVE months(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM months WHERE n < 12) — join ON strftime('%Y-%m', placed_at) = '2026-' || printf('%02d', n).",
  },
  'sql-adv-condagg-08': {
    level1: 'One row per loyalty tier, three figures each. No subqueries needed — one pass with a conditional inside the aggregate.',
    level2: 'SUM(CASE WHEN o.status <> \'cancelled\' THEN o.total_cents ELSE 0 END) counts only live orders; count(DISTINCT c.id) counts people.',
    level3: "sum(CASE WHEN o.status <> 'cancelled' THEN o.total_cents ELSE 0 END) — and count(DISTINCT c.id), not count(*) over the join.",
  },
  'sql-adv-antijoin-10': {
    level1: 'Money limbo: cancelled orders whose approved payment never got refunded. Two tables, joined on order.',
    level2: 'One half is cancelled orders, the other is approved payments — the intersection is the leak. (Equivalent anti-join forms exist — this one is a join + two filters.)',
    level3: "WHERE o.status = 'cancelled' AND p.status = 'approved' — order by order_number; five rows.",
  },
  'sql-adv-dedup-11': {
    level1: 'The unique constraint on email compares raw bytes — case variants slip through. Normalize the key before counting.',
    level2: 'lower(email) folds case; group on the folded key; groups bigger than one are your duplicates.',
    level3: 'GROUP BY lower(email) HAVING count(*) > 1 — exactly one key survives (the seeded case-variant pair).',
  },
  'sql-adv-aggcorrect-12': {
    level1: 'The UI shows totals and they look plausible. The stored line_total may not be qty×price — only one query can see it.',
    level2: 'Recompute the expected value from the inputs in the WHERE clause; keep rows where the stored value disagrees.',
    level3: 'WHERE line_total_cents <> quantity * unit_price_cents — eight rows; order by id for review.',
  },
  'sql-adv-window-09': {
    level1: 'A leaderboard needs a total order. Rank products by revenue; ties would be ambiguous without a tiebreak.',
    level2: 'ROW_NUMBER() OVER (ORDER BY sum(...) DESC, product-id ASC) numbers the ranking deterministically; wrap and LIMIT 5.',
    level3: 'ROW_NUMBER() OVER (ORDER BY sum(oi.line_total_cents) DESC, p.id) AS rn inside a subquery/CTE — outer ORDER BY rn LIMIT 5.',
  },
  // -------------------------------------------------------------------- HUNTS
  'hunt-db-001': {
    level1: 'Open the schema explorer; every order line should join to a product. Pick a product and spot-check a few lines — or don’t, and count systematically instead.',
    level2: 'An inner join hides orphans; count what each side of the relationship yields and compare. A left-out match is a missing product.',
    level3: 'Left-join items to products (or NOT EXISTS a matching product) — the rows whose product columns come back NULL are your finding.',
  },
  'hunt-db-002': {
    level1: 'Dust off the customers table and sort by email. People tell support they never signed up twice. Something smells.',
    level2: 'Look for rows that are the same human wearing different casing, stray punctuation drift, or a trailing space the column preserved.',
    level3: 'Compare lower(trim(email)) across rows — the clusters that collapse to one key while existing as many rows are the accounts to report.',
  },
  'hunt-db-003': {
    level1: 'Orders have a full audit chain: item prices, subtotal, tax, total. Start by re-adding the parts of a few orders.',
    level2: 'total_cents must equal subtotal + shipping + tax. Pull every order where that identity fails — you want them all, not the first.',
    level3: 'Deriving expected_total := subtotal_cents + shipping_cents + tax_cents and filtering on <> finds the exact rows — count them and grab their ids.',
  },
  'hunt-db-004': {
    level1: 'Inventory is the source of truth for “how many can we sell”. Compare it against what the sales history proves.',
    level2: 'Pick a product and compute implied stock from orders — then look at what the inventory row claims today.',
    level3: 'Focus on any product where the on-hand figure disagrees with any re-derived quantity — and check the threshold field while you are there.',
  },
  'hunt-db-005': {
    level1: 'Every delivered order should carry a payment. Count delivered orders vs payment rows before anything else.',
    level2: 'An anti-join is the fastest disproof of “every delivered order paid”: orders with no payment row at all.',
    level3: 'WHERE o.status = \'delivered\' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id) — that list is the report.',
  },
  'hunt-db-006': {
    level1: 'Line totals are the atoms of revenue. Recompute each from first principles — price times quantity — and compare to storage.',
    level2: 'A unit-price-sized line_total standing in for a multi-unit line is the fingerprint. Evaluate that comparison over the whole table.',
    level3: 'line_total_cents <> quantity * unit_price_cents — collect the rows, then sum the gaps for the blast radius.',
  },
  'hunt-db-007': {
    level1: 'This one is about a boundary: exact-equality between stock and demand. Find the product at that seam.',
    level2: 'Line quantities from recent orders vs inventory.quantity for the same products — hunt for the exact-equal case.',
    level3: 'Compute each product’s last ordered quantity and compare for equality against the inventory row — the one matching pair is the exhibit.',
  },
  'hunt-db-008': {
    level1: 'Orders reference customers. If a customer row disappeared, the orders outlive them — count the orders whose customer is missing.',
    level2: 'An outer join (or NOT EXISTS) from orders to customers shows you every dangling customer reference.',
    level3: 'WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id) — those orders are orphaned; report the count and the ids.',
  },
}

/** Server-only lookup. Unknown ids resolve to null. */
export function findSqlHints(id: string): HuntHints | null {
  return SQL_HINTS[id] ?? null
}

/** The hint text for one level of one exercise/hunt, or null for an unknown id. */
export function sqlHintText(id: string, level: HintLevel): string | null {
  const hints = SQL_HINTS[id]
  if (!hints) {
    return null
  }
  return level === 1 ? hints.level1 : level === 2 ? hints.level2 : hints.level3
}

/** Fail-closed hint lookup — mirrors requireHint in hints.ts. */
export function requireSqlHint(id: string, level: HintLevel): string {
  const hint = sqlHintText(id, level)
  if (hint === null) {
    throw new Error('SQL hint registry is missing an exercise or hunt.')
  }
  return hint
}
