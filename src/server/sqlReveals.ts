// SQL exercise & SQL hunt gated reveals (Phase 6 M2, plan §10.4) — CODE, not data.
//
// Served only after reveal eligibility (submitted attempt or confirmed
// give-up), through src/server/learning.ts. Exercise reveals ship the
// reference solution SQL and its explanation; hunt reveals ship the finding
// query and its explanation. Phase 3/4 reveals carry neither. Nothing here
// is imported by client code.

import type { RevealDefinition } from './reveals'
import { SQL_EXERCISES } from './sqlExercises'

export interface SqlRevealDefinition extends RevealDefinition {
  /** The reference query (exercise) or finding query (hunt). */
  solution: string
  /** Why the query works / what the fix would be, behaviour level. */
  explanation: string
}

interface RevealCore {
  expected: string
  actual: string
  rootCause: string
  reproduction: readonly string[]
  verification: readonly string[]
  concepts: readonly string[]
  commonMisconceptions: readonly string[]
}

const EXERCISE_REVEALS: Record<string, RevealCore> = {
  'sql-bgn-select-01': {
    expected: 'Eight rows returning every category’s slug and name, one row per category.',
    actual: 'A bare SELECT id, slug, name, sort_order returns the same information as noise — or WHERE/ORDER BY mistakes narrow the set or scramble it.',
    rootCause: 'Projection discipline: ask for exactly the columns the task names, no more, no less.',
    reproduction: ['Open the schema explorer; read the categories DDL.', 'Run the minimal SELECT and count the rows.'],
    verification: ['Compare the row count against the expected eight and the two projected columns against the DDL.'],
    concepts: ['Projection', 'Reference tables', 'Reading DDL'],
    commonMisconceptions: ['Adding ORDER BY and panicking when the check seems to demand a specific row order — it does not for this exercise.'],
  },
  'sql-bgn-where-02': {
    expected: 'Only climbing products priced strictly below 10,000 cents, identified by id, name, price.',
    actual: 'Composing the two predicates with OR — or forgetting the strict inequality — leaks wrong rows into the result.',
    rootCause: 'Boolean composition: AND narrows, OR widens, and boundary comparisons must match the wording exactly.',
    reproduction: ['Run the query against category 3 only.', 'Then run it without the price predicate and compare row counts.'],
    verification: ['Every returned price must be < 10000; every returned product must be category 3.'],
    concepts: ['Conjunctive WHERE', 'Boundary conditions', 'IDs vs labels'],
    commonMisconceptions: ['Using <= 10000 — the question says “under”, so the boundary row is excluded.'],
  },
  'sql-bgn-orderby-03': {
    expected: 'The five newest orders by placed_at, newest first, as order_number, placed_at, total_cents.',
    actual: 'ORDER BY placed_at ASC returns the five oldest — or ORDER BY total_cents returns “biggest”, not “newest”.',
    rootCause: 'Direction and key selection: “most recent” means descending timestamp, and ISO-8601 text sorts chronologically.',
    reproduction: ['Run both ASC and DESC variants and compare the extremes.'],
    verification: ['placed_at values must be strictly non-increasing; five rows; they must be the five newest in the table.'],
    concepts: ['ORDER BY direction', 'ISO-8601 lexicographic order', 'LIMIT as a head slice'],
    commonMisconceptions: ['Assuming the default order is insertion order — tables carry no such guarantee without ORDER BY.'],
  },
  'sql-bgn-limit-04': {
    expected: 'Customers 1011–1020 by id — page 2 of the stable id-ordered listing.',
    actual: 'OFFSET without ORDER BY reads an arbitrary slice; LIMIT 20 first-page-re-truncated shows the same first page.',
    rootCause: 'Pagination correctness is ordering correctness — OFFSET shifts within whatever total order you established.',
    reproduction: ['Run page 1 and page 2 with and without ORDER BY and diff the email lists.'],
    verification: ['Page 2 ids must be exactly 1011–1020 and disjoint from page 1.'],
    concepts: ['LIMIT/OFFSET mechanics', 'Stable orderings', 'Non-overlapping pages'],
    commonMisconceptions: ['Expecting LIMIT OFFSET to remember anything — without ORDER BY each run can return different rows.'],
  },
  'sql-bgn-distinct-05': {
    expected: 'The five order statuses: cancelled, delivered, pending, placed, shipped.',
    actual: 'GROUP BY status with an extra aggregate returns the same names with irrelevant noise; without DISTINCT you get 228 rows.',
    rootCause: 'Set semantics: enumerating a domain means collapsing duplicates — DISTINCT is the minimal tool.',
    reproduction: ['Run SELECT status vs SELECT DISTINCT status and compare row counts.'],
    verification: ['Exactly five rows; each value matches the CHECK constraint’s vocabulary.'],
    concepts: ['Set semantics', 'Enum domains', 'Minimal projections'],
    commonMisconceptions: ['Using DISTINCT alongside an ORDER BY to “sort” — DISTINCT never orders.'],
  },
  'sql-bgn-ops-06': {
    expected: 'The four seeded suspended customers, ascending by id.',
    actual: 'Filtering on loyalty_tier instead of status; or LIKE ‘%suspend%’ over other columns; or omitting the ORDER BY.',
    rootCause: 'Column selection precision — the lifecycle flag is the authority, not any other attribute.',
    reproduction: ['Run the predicate against status=’active’ and compare populations.'],
    verification: ['Every returned row is suspended; the id list matches the four seeded accounts.'],
    concepts: ['Equality predicates', 'Enumerated status columns'],
    commonMisconceptions: ['Treating NULL status as suspended — NULL is excluded from = comparisons entirely.'],
  },
  'sql-bgn-agg-07': {
    expected: 'One row: 228 total orders, 15,901,850 gross cents.',
    actual: 'count(total_cents) counts non-null amounts (same answer here), or summing without count returns only the cents figure.',
    rootCause: 'Whole-table aggregation without GROUP BY produces exactly one row — two aggregates share it naturally.',
    reproduction: ['Run count(*) alone, then sum(total_cents) alone, then both.'],
    verification: ['The two figures must equal the table’s row count and money sum respectively.'],
    concepts: ['Scalar aggregation', 'count vs count(column)', 'Integer cents'],
    commonMisconceptions: ['Expecting one row per order — without GROUP BY there is no grouping, only one aggregate row.'],
  },
  'sql-bgn-count-08': {
    expected: '101 — customers with at least one order.',
    actual: 'count(*) returns 228 (orders, not customers); count(customer_id) returns 228 too — duplicates included.',
    rootCause: 'DISTINCT inside the aggregate is what collapses repeat customers into one count.',
    reproduction: ['Compare count(*), count(customer_id), count(DISTINCT customer_id) side by side.'],
    verification: ['The distinct count must be ≤ the row count and ≥ the number of difference cohorts.'],
    concepts: ['COUNT(DISTINCT)', 'Cardinality reasoning'],
    commonMisconceptions: ['Assuming customer_id is unique per order — it is not; only payments.provider_ref and orders.order_number are.'],
  },
  'sql-bgn-between-09': {
    expected: '10 June orders, 633,662 gross cents.',
    actual: 'An open-ended upper bound (< 2026-06-30) drops the 30th; or plain date strings drop time-of-day orders on the boundary.',
    rootCause: 'Inclusive bounds and ISO text: BOTH endpoints are included by BETWEEN — the upper bound must own the last second of the day.',
    reproduction: ['Rerun with 2026-06-30T00:00:00Z as the upper bound and observe the shrink; then restore 23:59:59Z.'],
    verification: ['June-window recount matches the filtered COUNT(*); no May/July orders present.'],
    concepts: ['BETWEEN inclusivity', 'Half-open interval hygiene', 'ISO lexicographic ranges'],
    commonMisconceptions: ['BETWEEN ‘2026-06-01’ AND ‘2026-06-30’ silently truncating June 30 orders with a time component.'],
  },
  'sql-bgn-like-10': {
    expected: 'Two rows: the two seeded products with “tent” in the name.',
    actual: 'LIKE ‘tent%’ misses leading-wildcard matches; or case-sensitivity surprises on non-ASCII collations.',
    rootCause: 'Pattern semantics of LIKE — leading wildcard makes the match a substring search, which is what “contains” means.',
    reproduction: ['Run ‘tent%’, ‘%tent’, ‘%tent%’ and compare.'],
    verification: ['Both seeded tent products present; no others.'],
    concepts: ['LIKE patterns', 'Wildcard placement'],
    commonMisconceptions: ['Escaping % and _ when the pattern is a literal — not needed unless the term contains them.'],
  },
  'sql-bgn-text-11': {
    expected: 'One row: example.com, 118 customers.',
    actual: 'grouping by the raw email yields 118 rows; forgetting lower() double-counts case variants.',
    rootCause: 'Deriving a normalized key from raw text — instr/substr/lower compose into a key you can group by.',
    reproduction: ['Run the extraction without GROUP BY and eyeball the derived domains.'],
    verification: ['Domains are lower-cased; per-domain counts sum to the customer total; example.com is 118.'],
    concepts: ['String derivation', 'Normalization before aggregation'],
    commonMisconceptions: ['Substr without the +1 offset leaves the @ in the domain.'],
  },
  'sql-bgn-null-12': {
    expected: 'Only the 10 seeded opted-in customers with no phone on file.',
    actual: '= NULL matches nothing (three-valued logic); OR phone = ‘’ lets phone format garbage through.',
    rootCause: 'NULL semantics — the only true test for absence is IS NULL; marketing flags are integers 0/1.',
    reproduction: ['Run the query with phone = NULL and observe zero rows; switch to IS NULL.'],
    verification: ['Every returned row is opted in and phone IS NULL; emails are exactly the opted-in NULL cohort.'],
    concepts: ['Three-valued logic', 'IS NULL', 'Consent cohorts'],
    commonMisconceptions: ['empty string vs NULL — the snapshot distinguishes them; = ‘’ is exact-match only.'],
  },
  'sql-int-groupby-01': {
    expected: 'Exactly the six orders whose total_cents ≠ subtotal + shipping + tax, with the derived expected figure alongside.',
    actual: 'Every order appears (comparing against items alone) — shipping and tax are legitimate parts of the total.',
    rootCause: 'A reconciliation compares stored totals to derived totals from the transaction’s own parts — not against an unrelated projection.',
    reproduction: ['Run the same derivation with and without shipping_cents + tax_cents and compare row counts.'],
    verification: ['Six rows; each expected_total differs from total_cents; spot-recompute one by hand.'],
    concepts: ['Reconciliation chains', 'Derived expected values', 'Identity checking'],
    commonMisconceptions: ['Comparing total against items-only sum — the seeing shape of the defect is invisible there.'],
  },
  'sql-int-having-02': {
    expected: 'The four seeded double-buy cohorts: same day, same total, same customer.',
    actual: 'GROUP BY customer with HAVING count(*) > 1 without the day/total keys returns every repeat customer, not duplicates.',
    rootCause: 'Dedup keying — “duplicate” is defined by the full (customer, day, total) triple, which forces a multi-column group.',
    reproduction: ['Group by customer only; then add date(placed_at); then add total_cents; watch the set narrow.'],
    verification: ['Four groups; each exactly 2; days are ISO dates; totals match the stored orders.'],
    concepts: ['Multi-column GROUP BY', 'date() truncation', 'HAVING vs WHERE'],
    commonMisconceptions: ['WHERE count(*) > 1 — aggregate filtering belongs in HAVING, not WHERE.'],
  },
  'sql-int-join-03': {
    expected: 'The five approved payments whose amounts disagree with their orders.',
    actual: 'Including refunded/pending payments flags expected differences; or comparing without the join — amount_cents alone is meaningless.',
    rootCause: 'Cross-table inequality testing — the comparison only exists across the joined row pair.',
    reproduction: ['Run with all statuses; then filter to approved and observe the clean cohort.'],
    verification: ['Five rows; provider_refs pi_synthetic_000012/…045/…096/…206/…220; amounts ≠ totals.'],
    concepts: ['Join + filter composition', 'Reconciliation against a reference', 'Statuses with different invariants'],
    commonMisconceptions: ['Assuming any mismatch is fraud — half-captures are a normal PSP flow; this exercise isolates the storage error.'],
  },
  'sql-int-outerjoin-04': {
    expected: 'Two zero-stock products with their last order timestamps, NULL for never-ordered.',
    actual: 'Inner join drops products with no orders; or GROUP BY placed_at yields one row per (product, order) pair.',
    rootCause: 'Outer joins preserve the left side entirely — the “may have none” side of a relationship.',
    reproduction: ['Replace LEFT JOIN products→orders with an inner join and watch products vanish.'],
    verification: ['Both zero-quantity products present; last_order_at is an ISO timestamp or NULL.'],
    concepts: ['LEFT JOIN preservation', 'Aggregation over joins', 'NULL-tolerant reports'],
    commonMisconceptions: ['GROUP BY p.id while selecting raw names without an aggregate — the name needs membership in the group key.'],
  },
  'sql-int-multijoin-05': {
    expected: 'The two lines of order MO-2025-0058 with product names and stored unit prices.',
    actual: 'Wrong order id spelling returns empty; joining products by name instead of id is brittle and hides the snapshot discrepancy.',
    rootCause: 'Join hygiene — key by id, scope by order first, project what the task asks.',
    reproduction: ['Run for order 5002 ids; then try the order_number predicate form and compare.'],
    verification: ['Two rows; quantity × unit_price matches the snapshot price logic inside each line.'],
    concepts: ['Multi-table joins', 'Scoping before projecting', 'Name snapshots vs live names'],
    commonMisconceptions: ['Comparing snapshot names to live product names as “the check” — the snapshot is the contractual price at sale time.'],
  },
  'sql-int-subq-in-06': {
    expected: 'The distinct October 2026 orderers — 30 emails.',
    actual: 'Forgetting DISTINCT lists the same customer per order; or closed interval drops Oct 31 orders.',
    rootCause: 'Subquery materialization of a cohort followed by membership projection — DISTINCT belongs at the end.',
    reproduction: ['Run with and without DISTINCT and compare row counts.'],
    verification: ['30 rows; every email placed ≥ 1 order in the window; none outside it.'],
    concepts: ['IN (subquery)', 'Distinct projection', 'Half-open windows'],
    commonMisconceptions: ['NOT IN with NULLs somewhere inside the subquery — silently empty results.'],
  },
  'sql-int-subq-exists-07': {
    expected: '53 — addresses never used as a shipping target.',
    actual: 'NOT IN (SELECT shipping_address_id …) yields 0 because a NULL ships through some plans’ comparisons.',
    rootCause: 'Existential quantification — NOT EXISTS tests rows one at a time and is NULL-safe.',
    reproduction: ['Compare NOT IN vs NOT EXISTS against the same table.'],
    verification: ['The count is positive and every counted address has no referencing order.'],
    concepts: ['EXISTS/NOT EXISTS', 'NULL safety', 'Semi-join semantics'],
    commonMisconceptions: ['Joining and counting matches — a customer can have 3 orders sharing one address; direct counting is not membership.'],
  },
  'sql-int-correlated-08': {
    expected: '13 rows: every gold customer with their latest order timestamp, or NULL for the four orderless golds.',
    actual: 'max over all orders per customer without the correlation returns the same global max for everyone; GROUP BY without correlation misses never-ordered customers entirely.',
    rootCause: 'Correlation wires the subquery to the current outer row — the “per-row” question mark of correlated subqueries.',
    reproduction: ['Run without WHERE correlation and observe the identical max everywhere.'],
    verification: ['Each timestamp is ≤ 2026-11-10; NULL count is 4; emails match gold customers.'],
    concepts: ['Correlated subqueries', 'Per-row evaluation', 'NULL preservation'],
    commonMisconceptions: ['GROUP BY on the inner query — the correlation makes grouping unnecessary.'],
  },
  'sql-int-case-09': {
    expected: 'small 5, medium 57, large 166 — buckets summing to 228.',
    actual: 'Reversed threshold order (WHEN < 20000 first) classifies everything below 20000 as medium.',
    rootCause: 'CASE evaluates in order and stops at first truth — thresholds must descend (or ascend) monotonically.',
    reproduction: ['Flip the two WHENs and observe the bucket distribution collapse.'],
    verification: ['Counts 5/57/166; sum = 228; assignment boundaries per the CASE order.'],
    concepts: ['CASE ordering', 'Derived dimensionality', 'Bucket integrity'],
    commonMisconceptions: ['Assuming SQL CASE is pattern-matched like switch in other languages with break semantics — it is first-match, not fall-through, but order still rules.'],
  },
  'sql-int-dates-text-10': {
    expected: '8 stale orders totalling 788,919 cents.',
    actual: 'Using date(’now’) ties the answer to the clock — the report rewrites itself daily and fails any fixed assertion.',
    rootCause: 'Testability — pinned cutoffs make counts reproducible; ISO text needs no parsing functions.',
    reproduction: ['Swap the literal for date(’now’) and watch the result change between runs.'],
    verification: ['Eight rows pending/placed older than 2026-10-18; not one shipped or delivered.'],
    concepts: ['Pinned reference dates', 'ISO text comparison', 'Stale cohorts'],
    commonMisconceptions: ['julianday(’now’)-based relative math — correct in general and wrong for a reproducible check.'],
  },
  'sql-int-insert-11': {
    expected: 'The inserted row readable back by its unique slug.',
    actual: 'Missing NOT NULL description; or sort_order colliding with the seeded 1–8 and breaking the natural ordering.',
    rootCause: 'Write-then-read discipline with deliberate fixture values.',
    reproduction: ['Attempt the insert twice — the second fails on UNIQUE, as intended.'],
    verification: ['The verification query returns exactly qa-test-exports with the intended name.'],
    concepts: ['INSERT ergonomics', 'Read-back verification', 'Fixture hygiene'],
    commonMisconceptions: ['Using INSERT OR REPLACE — it silently overwrites and hides fixture collisions.'],
  },
  'sql-int-update-12': {
    expected: 'The 6 seeded low-quantity inventory rows moved to threshold 3.',
    actual: 'WHERE quantity < 5 (dropping the boundary row) touches 5; or no WHERE rewrites the whole table.',
    rootCause: 'Bounded writes — the WHERE is the blast radius controller, and boundary inclusion must match the intent.',
    reproduction: ['Run with <, then ≤, and diff the counts on a reset copy.'],
    verification: ['Six rows qualify and now read threshold 3; nothing else changed.'],
    concepts: ['Bounded UPDATE', 'Pre-flight counting', 'Boundary inclusivity'],
    commonMisconceptions: ['An UPDATE “query” being riskier than INSERT — bulk DML is the highest-risk statement class you will run.'],
  },
  'sql-int-delete-13': {
    expected: 'Zero remaining rows for MO-TEST-900001 across orders, items, payments.',
    actual: 'DELETE by order_number in a second statement session without the order staged — deletes hit nothing (0/0/0 trivially) for the wrong reason.',
    rootCause: 'ON DELETE CASCADE is declared at the schema layer and enforced by the engine only when foreign keys are enabled.',
    reproduction: ['Delete the order and rerun the verification; then reset and inspect the staged fixture.'],
    verification: ['0 / 0 / 0 from the count triple; no collateral rows touched.'],
    concepts: ['ON DELETE CASCADE', 'Aggregate-root deletion', 'Cascade verification'],
    commonMisconceptions: ['Assuming cascades extend to snapshot tables or audit rows — they cover declared FK references only.'],
  },
  'sql-adv-txn-01': {
    expected: 'quantity back to 4 after ROLLBACK — the destructive write vanished entirely.',
    actual: 'Omitting ROLLBACK commits silently? No — here the omission means the session ends with the change merely uncommitted; in the exercise the verification sees quantity 0.',
    rootCause: 'Transaction atomicity — work not committed never touched the durable state.',
    reproduction: ['Run the script, then check inventory quantity for product 5.'],
    verification: ['quantity = 4; quantity = 0 only inside an open uncommitted transaction.'],
    concepts: ['BEGIN/ROLLBACK', 'Atomicity', 'Undo discipline'],
    commonMisconceptions: ['Assuming ROLLBACK undoes data committed in an earlier transaction — it undoes only the current one.'],
  },
  'sql-adv-constraints-02': {
    expected: 'The two injected orphans, ids 930001/930002, product ids 9999/9998.',
    actual: 'A plain JOIN returns nothing for them (that is the point — joins hide orphans); NOT IN with a NULL collapses to empty.',
    rootCause: 'Foreign keys are enforced only at write time with the pragma on; verification requires anti-join forensics.',
    reproduction: ['Inner-join the items to products and observe zero output; switch to NOT EXISTS.'],
    verification: ['Exactly two rows; both reference missing products; nothing else is flagged.'],
    concepts: ['Anti-joins', 'Orphan detection', 'Pragma-scoped enforcement'],
    commonMisconceptions: ['PRAGMA foreign_keys = ON retroactively deletes orphans — it constrains future writes only.'],
  },
  'sql-adv-explain-04': {
    expected: 'A plan row mentioning idx_orders_status (COVERING INDEX).',
    actual: 'Reading the plan as “it used an index” without naming which — the index name is the evidence.',
    rootCause: 'Plan literacy — USING vs SCAN vs COVERING are three different promises.',
    reproduction: ['Explain the same predicate with a leading-wildcard LIKE and compare plans.'],
    verification: ['detail contains idx_orders_status; COVERING marks the index-only path.'],
    concepts: ['EXPLAIN QUERY PLAN', 'Index-only scans', 'Plan reading'],
    commonMisconceptions: ['Assuming EXPLAIN ANALYZE exists in SQLite — it does not; QUERY PLAN is the tool.'],
  },
  'sql-adv-index-05': {
    expected: 'idx_orders_test_lookup, origin c, on orders.',
    actual: 'Creating on (status, customer_id) — column order matters for composite indexes serving equality pairs.',
    rootCause: 'Composite index column order follows the equality-discriminant first rule.',
    reproduction: ['Create the wrong order, inspect the plan of the target query, then create the right one.'],
    verification: ['pragma_index_list shows the index; a subsequent plan references it.'],
    concepts: ['CREATE INDEX', 'Composite key ordering', 'IF NOT EXISTS idempotency'],
    commonMisconceptions: ['Indexes always help — they cost writes and storage; this one is free-seed and cheap.'],
  },
  'sql-adv-cte-06': {
    expected: 'The four zero-spend gold customers with email, spend_cents 0.',
    actual: 'Forgetting the coalesce yields NULL spend, which fails spend_cents < 1000 and hides the cohort; or filtering gold before aggregating changes the cohort.',
    rootCause: 'NULL-propagating aggregates — SUM over zero matching rows is NULL, and three-valued logic excludes NULLs silently.',
    reproduction: ['Remove coalesce and watch the set empty out; restore and re-add.'],
    verification: ['Four rows; every spend_cents is 0; ids ascending; all gold tier.'],
    concepts: ['CTEs', 'NULL-safe aggregation', 'Cohort forensics'],
    commonMisconceptions: ['coalesce(spend, 0) placed after GROUP BY incorrectly — it wraps the SUM expression.'],
  },
  'sql-adv-recursive-07': {
    expected: 'Twelve rows: months 1–12 with order counts; month 12 is 0.',
    actual: 'GROUP BY month on orders alone omits empty months — the report looks complete while silently skipping December.',
    rootCause: 'Dense series generation — recursive rows are joined against sparse data to force completeness.',
    reproduction: ['Run the plain GROUP BY version and observe eleven rows; then the recursive version.'],
    verification: ['Twelve rows; order counts match per-month scans; month 12 = 0.'],
    concepts: ['WITH RECURSIVE', 'Dense vs sparse buckets', 'strftime on ISO text'],
    commonMisconceptions: ['Recursive CTE infinite loops — the UNION ALL step needs the terminator (n < 12).'],
  },
  'sql-adv-condagg-08': {
    expected: 'Three rows: bronze 74, silver 31, gold 13 customers with non-cancelled revenue.',
    actual: 'count(*) over the join inflates customer counts by orders-per-customer; SUM without the CASE includes cancellations.',
    rootCause: 'Conditional aggregation is two orthogonal aggregates composed in one pass — each needs its own DISTINCT or CASE discipline.',
    reproduction: ['Swap count(DISTINCT …) for count(*) and compare; flip the CASE filter.'],
    verification: ['Counts 74/31/13; tier sums to 118 customers; revenue excludes cancelled.'],
    concepts: ['Conditional aggregation', 'COUNT(DISTINCT)', 'Join cardinality'],
    commonMisconceptions: ['FILTER (WHERE …) — valid modern SQL, but CASE works everywhere including older SQLite.'],
  },
  'sql-adv-antijoin-10': {
    expected: 'The five cancelled orders still carrying approved payments.',
    actual: 'Including refunded payments flags resolved cases; including declined flags nothing at all; the join answers “which rows”, not “how many”.',
    rootCause: 'Anti-join reasoning — the stuck-money set is exactly captured order∩approved-payment∩cancelled.',
    reproduction: ['Widen the payment status filter and watch the false positives arrive.'],
    verification: ['Five order_numbers; amounts equal the order totals; all cancelled status.'],
    concepts: ['Anti-join semantics', 'Set intersection reasoning', 'Status invariants'],
    commonMisconceptions: ['Typo-joins on provider_ref — the order_id FK is the reliable join path.'],
  },
  'sql-adv-dedup-11': {
    expected: 'One normalized key: amara.okafor@example.com with 2 copies.',
    actual: 'GROUP BY raw email finds nothing (both rows differ) — normalization must happen before grouping.',
    rootCause: 'Case-insensitive uniqueness is a normalized-key property that the schema did not enforce.',
    reproduction: ['Group by email, then by lower(email), and watch the pair surface.'],
    verification: ['One row; copies = 2; key is lower-cased.'],
    concepts: ['Normalized keys', 'Normalization before grouping', 'Weak uniqueness'],
    commonMisconceptions: ['UNIQUE COLLATE NOCASE would fix it — but this schema does not declare it, deliberately.'],
  },
  'sql-adv-aggcorrect-12': {
    expected: 'The eight quantity-ignoring line rows.',
    actual: 'Trusting the stored line_total (or the UI) — the defect is invisible until recomputed from inputs.',
    rootCause: 'Recomputation from first principles is the only check for stored-derived-column drift.',
    reproduction: ['List all lines whose stored total equals unit_price exactly — that is the fingerprint.'],
    verification: ['Eight rows; on each, quantity > 1; delta equals (qty − 1) × price.'],
    concepts: ['Stored vs derived reconciliation', 'Blast-radius estimation', 'Aggregation correctness'],
    commonMisconceptions: ['The bug is “bad data”, not a broken write path — for testing purposes they are the same exercise.'],
  },
  'sql-adv-window-09': {
    expected: 'The five highest-revenue products with a deterministic rn 1–5.',
    actual: 'RANK() yields ties and LIMIT 5 returns more than five; or ORDER BY revenue alone leaves output order unstable.',
    rootCause: 'Total order via ROW_NUMBER with a tiebreak — the only ranking that guarantees the slice size.',
    reproduction: ['Swap ROW_NUMBER for RANK and compare the fifth row.'],
    verification: ['Five rows; revenue strictly descending; ids ascending on equal revenue.'],
    concepts: ['Window functions', 'ROW_NUMBER vs RANK', 'Deterministic slicing'],
    commonMisconceptions: ['Offset-fetch pagination syntax (FETCH FIRST) — not this SQLite dialect; LIMIT is.'],
  },
}

const HUNT_REVEALS: Record<string, SqlRevealDefinition> = {
  'hunt-db-001': {
    expected: 'Every order_items row joins to a product — zero dangling product references.',
    actual: 'Two line items reference products that do not exist; an inner join silently drops them from every report.',
    rootCause: 'The rows were written with foreign keys disabled, so the database cannot — and does not — refuse them.',
    reproduction: ['Start the hunt from the scenario page.', 'Left-join order_items to products (or NOT EXISTS a product with the same id).', 'The two orphan rows name their dangling product ids.'],
    verification: ['Reset to clean mode; the same query returns zero rows.'],
    concepts: ['Orphan detection', 'Anti-joins', 'What inner joins hide'],
    commonMisconceptions: ['The UI showed these orders fine — it never joins to products for line display.', 'Re-adding the product row is not a fix for a snapshot inconsistency; the report is the deliverable.'],
    solution: `SELECT oi.id, oi.order_id, oi.product_id
FROM order_items oi
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = oi.product_id)
ORDER BY oi.id;`,
    explanation:
      'The seeded snapshot is referentially clean by default; this hunt re-injects two orphan rows (product_ids 7777 and 8888) behind your back. Only anti-join forensics surfaces them.',
  },
  'hunt-db-002': {
    expected: 'One account per real human — unique, canonicalized identities.',
    actual: 'Three lookalike rows sit in the customers table: case-variant and trailing-space doppelgangers of one identity.',
    rootCause: 'Case-insensitive display name masking a byte-level unique constraint that only sees exact duplicates — plus sloppy import hygiene.',
    reproduction: ['Sort customers by email; then group by lower(trim(email)).', 'The collapsed clusters reveal every identity hiding behind multiple rows.'],
    verification: ['Clean mode: the same collapse yields one singleton cluster per normalized key.'],
    concepts: ['Normalized identity keys', 'Data dedup analysis', 'Weak uniqueness'],
    commonMisconceptions: ['Deleting the extras in the hunt sandbox — the report, not the cleanup, is the assignment.'],
    solution: `SELECT lower(trim(email)) AS email_key, count(*) AS copies, min(id) AS keep_id, group_concat(id) AS all_ids
FROM customers
GROUP BY lower(trim(email))
HAVING count(*) > 1;`,
    explanation:
      'lower() + trim() collapse the three inserted doppelgangers into their canonical key; the group exposes the full row set behind each identity.',
  },
  'hunt-db-003': {
    expected: 'Every order satisfies total = subtotal + shipping + tax.',
    actual: 'One delivered order’s total_cents is set to a plausible-but-wrong figure — off by a non-round amount.',
    rootCause: 'A write path bypassed the reconciliation identity (admin adjustment, failed retry, or a partial capture wrongly stored as total).',
    reproduction: ['Derive expected_total := subtotal + shipping + tax for all orders.', 'Keep the rows where total <> expected_total — one row remains.'],
    verification: ['Clean mode: the same identity scan returns the six seeded DQ-02 rows only — the injected seventh never appears.'],
    concepts: ['Reconciliation', 'Derived-vs-stored drift', 'Incident bounding'],
    commonMisconceptions: ['Comparing items×price to total — shipping and tax legitimately account for part of it.'],
    solution: `SELECT id, order_number,
       total_cents,
       subtotal_cents + shipping_cents + tax_cents AS expected_total_cents
FROM orders
WHERE total_cents <> subtotal_cents + shipping_cents + tax_cents
ORDER BY id;`,
    explanation:
      'The injected drift is on top of the six seeded DQ-02 rows — the query returns seven rows here and six in clean mode; the seventh (non-round delta) is your report.',
  },
  'hunt-db-004': {
    expected: 'inventory.quantity reflects reality — sell-through ledgers never overstate availability.',
    actual: 'One product’s quantity was reduced to a plausible-but-wrong figure; availability reports understate stock and checkout can oversell.',
    rootCause: 'A stale write path (manual adjust, failed restock, or lost sync) rewrote a single inventory row without a ledger entry.',
    reproduction: ['Pick the product with the most suspicious on-hand row.', 'Re-derive expected stock from orders vs receipts (or vs clean mode) and compare.'],
    verification: ['Clean mode: the same re-derivation agrees with the stored figure.'],
    concepts: ['Ledger re-derivation', 'Point-in-time snapshot comparison', 'Drift bounding'],
    commonMisconceptions: ['Trusting low_stock_threshold as evidence — the quantity itself is the drifted field.'],
    solution: `SELECT p.id, p.name, i.quantity, i.low_stock_threshold
FROM inventory i JOIN products p ON p.id = i.product_id
WHERE p.id = 30;`,
    explanation:
      'The drifted row belongs to Tinderbox Firesteel Kit (product_id 30) — the qty 25 against a seeded 80. Re-deriving from the sell-through ledger (or a clean-mode side-by-side) quantifies the lie exactly.',
  },
  'hunt-db-005': {
    expected: 'Every delivered order carries exactly one approved payment.',
    actual: 'One delivered order has no payment row at all — revenue silently under-counts it.',
    rootCause: 'The payment row was deleted (or never written) while the order progressed — a capture webhook dropped on the floor.',
    reproduction: ['Run the delivered-orders anti-join: orders with status delivered and no payments row.', 'Exactly one row returns.'],
    verification: ['Clean mode: the anti-join returns zero rows.'],
    concepts: ['Anti-join forensics', 'Completeness oracles', 'Revenue reconciliation'],
    commonMisconceptions: ['Counting all payments vs all orders globally — the defect is a single-row hole, visible only per-order.'],
    solution: `SELECT o.id, o.order_number, o.total_cents
FROM orders o
WHERE o.status = 'delivered'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id)
ORDER BY o.id;`,
    explanation:
      'The missing row is deleted outright by the hunt delta; in clean mode every delivered order carries exactly one payment — the anti-join is empty.',
  },
  'hunt-db-006': {
    expected: 'line_total_cents = quantity × unit_price_cents for every line.',
    actual: 'A subset of lines stores the bare unit price as the line total, dropping the quantity factor.',
    rootCause: 'A writer path snapshot the unit price into the totals column — aggregation without the multiplier.',
    reproduction: ['Scan all lines for line_total <> quantity × price.', 'Group the finds by order — the blast radius is those orders’ revenue under-count.'],
    verification: ['Clean mode: the same scan returns the eight seeded DQ-01 rows; the injected set is strictly larger and disjoint.'],
    concepts: ['Recompute-and-diff', 'Aggregation correctness', 'Blast-radius quantification'],
    commonMisconceptions: ['Fixing rows in the hunt sandbox — report, don’t repair.'],
    solution: `SELECT id, order_id, quantity, unit_price_cents, line_total_cents,
       quantity * unit_price_cents AS expected_cents
FROM order_items
WHERE line_total_cents <> quantity * unit_price_cents
ORDER BY id;`,
    explanation:
      'The eight seeded DQ-01 rows plus the injected subset all satisfy the fingerprint line_total = unit_price; sum(expected − actual) sizes the under-count exactly.',
  },
  'hunt-db-007': {
    expected: 'Boundary orders — exactly the remaining stock — are fulfilled exactly once with correct decrement.',
    actual: 'One product’s inventory sits exactly at a live order’s demand; the boundary class mirrors the checkout off-by-one in data form — nothing reconciles the two.',
    rootCause: 'No cross-check binds order quantities to inventory at the exact-equality seam; small write paths diverge silently there.',
    reproduction: ['For each product, compute the max single-line quantity in orders and compare to inventory.quantity.', 'The one equality pair names the boundary product.'],
    verification: ['Clean mode: the equality scan returns the same pair — the injection moves stock INTO equality, the report names it.'],
    concepts: ['Boundary-value analysis in data', 'Cross-table equality seams', 'Consistency oracles'],
    commonMisconceptions: ['Trying to “fix” checkout from SQL — the boundary is data-side in this hunt; the API mirror is a separate lesson.'],
    solution: `SELECT p.id, p.name, i.quantity,
       (SELECT max(oi.quantity) FROM order_items oi WHERE oi.product_id = p.id) AS max_line_qty
FROM inventory i JOIN products p ON p.id = i.product_id
WHERE i.quantity = (SELECT max(oi.quantity) FROM order_items oi WHERE oi.product_id = p.id)
ORDER BY p.id;`,
    explanation:
      'The injected state places one inventory row exactly on its boundary; the max-line-quantity self-comparison surfaces the seam deterministically.',
  },
  'hunt-db-008': {
    expected: 'No order references a customer that does not exist.',
    actual: 'One customer row was deleted; their orders remain — silently dropped from every join-based report.',
    rootCause: 'The delete ran with foreign keys off; nothing re-linked or cascade-handled the orphaned orders.',
    reproduction: ['Left-join orders to customers and keep the NULL side.', 'Group the orphans by customer_id — one id, N orders.'],
    verification: ['Clean mode: the outer-join scan returns zero rows (the seeded data is referentially whole).'],
    concepts: ['Orphan orders', 'Null-side outer join reads', 'Damage bounding'],
    commonMisconceptions: ['Filtering the report by that customer id — the join, not the filter, is the test.'],
    solution: `SELECT o.id, o.customer_id, o.order_number, o.placed_at
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id)
ORDER BY o.id;`,
    explanation:
      'The hunt delta deletes one customer with FK off; their orders persist with a dangling customer_id. The NOT EXISTS form names every one of them.',
  },
}

const SOLUTION_BY_ID = new Map(SQL_EXERCISES.map((exercise) => [exercise.id, { solution: exercise.solution, explanation: exercise.explanation }]))

const REVEALS: Record<string, SqlRevealDefinition> = Object.fromEntries([
  ...Object.entries(EXERCISE_REVEALS).map(([id, core]) => {
    const solution = SOLUTION_BY_ID.get(id)
    if (!solution) {
      throw new Error(`SQL reveal registry is missing the exercise definition for ${id}.`)
    }
    return [id, { ...core, ...solution }]
  }),
  ...Object.entries(HUNT_REVEALS),
])

/** Server-only lookup. Unknown ids resolve to null. */
export function findSqlReveal(id: string): SqlRevealDefinition | null {
  return REVEALS[id] ?? null
}

/** Fail-closed lookup. */
export function requireSqlReveal(id: string): SqlRevealDefinition {
  const reveal = findSqlReveal(id)
  if (!reveal) {
    throw new Error('SQL reveal registry is missing an exercise or hunt.')
  }
  return reveal
}
