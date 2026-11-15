# Bug-hunt catalogue (internal — maintainer-facing)

> **Not learner-facing.** This document is the maintainer-side registry of the
> intentional defects in the Meridian Outfitters practice store. Learners
> discover defects through the bug-hunt mode; the reveal/scoring flow is
> Phase 4+. Do not paste defect ids, expected/actual pairs or repro steps
> into learner-facing surfaces.

Companion to `docs/phase-3-commerce-practice-plan.md` §4 (engine design) and
§5 (P3-M8). The registries live in code: `src/server/hunts.ts` (hunts, with
the wiring `scenarioId`), `src/server/defects.ts` (defect definitions +
`isDefectActive`). Defect ids are internal; the browser only ever sees hunt
summaries plus the linked scenario id.

## Engine rules (recap)

- **Activation is server-resolved per request.** `isDefectActive(c, defectId)`
  reads the caller's `mpl_session` cookie, loads the live session
  (`mode='bug_hunt'`, `hunt_id`), and checks that the hunt's fixed defect
  list contains the id. Clean sessions, expired sessions, unknown hunts and
  malformed cookies all resolve to `false`.
- **No client-supplied defect ids, roles, owners or activation flags are ever
  consulted.** The hunt-start endpoint accepts no body; the hunt id comes
  from the URL path and is validated against the compiled registry.
- **One code site per defect.** Each defect branches in exactly one place
  (two mechanically-kept-in-lockstep branches in one handler count as one
  site; see INVENTORY-001). Defect branches are static: no randomness, no
  wall-clock dependence.
- **Session isolation.** Bug-hunt state lives on `practice_sessions`
  (`mode`, `hunt_id`) — never on shared rows, never in process memory.
  One learner's hunt cannot affect another learner's session.
- **Reset is non-destructive.** `POST /api/v1/practice/session/reset`
  re-stamps the live session to `mode='clean'`, `hunt_id=NULL`. Cart, orders
  and the synthetic customer binding are preserved. (Deviation from the
  plan's "expire + fresh session" sketch — see the plan doc §P3-M7 for the
  reason.)
- **Hunt starts are softly capped per IP per UTC day** (20 starts; only a
  SHA-256 hash of the IP is stored, one row per address in
  `hunt_start_caps`, reset on the day boundary). Idempotent same-hunt
  re-starts and resets never count. This is an abuse control, not a
  security boundary; when no client IP is visible (local development) it
  is skipped. Overshooting the cap under concurrency by a request or two
  is accepted by design.
- **Learner-facing metadata is limited to** `id`, `title`, `summary`,
  `scenarioId`. The `/api/v1/practice/hunts` and `/api/v1/practice/session`
  responses carry nothing else; `tests/server/hunt-set.test.ts` asserts no
  defect id appears in either.

## Registered hunts (P3-M8)

| Hunt id | Title | Defects | Wired scenario |
|---|---|---|---|
| `hunt-catalogue-001` | Catalogue search under-matches | `CATALOGUE-001` | `manual-shop-search` |
| `hunt-catalogue-002` | Category filter changes nothing | `CATALOGUE-002` | `api-catalogue-filters` |
| `hunt-cart-001` | Re-adding an item does not add up | `CART-001` | `manual-cart-add-quantity` |
| `hunt-inventory-001` | Checkout refuses the exact remaining stock | `INVENTORY-001` | `api-checkout-exact-stock` |
| `hunt-pricing-001` | Order totals do not add up | `PRICING-001` | `manual-cart-totals` |
| `hunt-checkout-001` | Checkout accepts a blank customer name | `CHECKOUT-001` | `manual-address-edge-cases` |
| `hunt-authz-001` | Order details cross account boundaries | `AUTHZ-001` | `security-object-access` |

The wiring is bidirectional and checked by `tests/data/content.test.ts`:
every wired scenario is `runnable`, `ready`, `mode: 'bug-hunt'`, carries
`huntId`, and the scenario's `huntId` matches its hunt's `scenarioId`.
`src/data/types.ts#Scenario.huntId` is the only client-relevant link.

## Defects

### CATALOGUE-001 — Catalogue search ignores the description facet

- **Surface:** `GET /api/v1/products?q=` (the `/shop` search box).
- **Code site:** `src/server/catalogue.ts` — the `q` predicate branch in
  `catalogueRoutes.get('/products')` guarded by `await isDefectActive(c, 'CATALOGUE-001')`.
- **Expected (clean):** search matches products whose **name**, **description**
  or **category name** contains the term (case-insensitive substring, LIKE
  wildcards escaped, bind parameters only). Example: `vestibules` → one hit,
  the Ridgeline 2-Person Tent.
- **Actual (bug hunt):** the `p.description LIKE` clause is dropped; only the
  name and category predicates remain. `vestibules` → zero hits, zero total.
  Name and category matches are unaffected. The list and count share the same
  predicate, so they stay mutually consistent.
- **Reproduction:**
  1. Start the hunt (`POST /api/v1/practice/hunts/hunt-catalogue-001/start`, or
     the hunt row on `/practice`, or the **Start the bug-hunt exercise** button
     on `/scenarios/manual-shop-search`).
  2. Open `/shop` and search `vestibules`. Expected: 1 product. Actual: empty
     state ("no products").
  3. Control: search `trekking` (name match) — works normally in both modes.
  4. Reset (`/practice` → **Reset to clean mode**, or the banner button) and
     repeat step 2 — the product is found again.
- **Isolation:** only the hunting session's search predicate changes. Other
  browsers, guests and signed-in customers see clean behaviour.
- **Reset:** `POST /api/v1/practice/session/reset` re-stamps the session to
  clean mode; the defective branch is unreachable.
- **Tests:** `tests/server/hunt.test.ts` (engine regression, both branches,
  two-learner isolation) + `tests/server/hunt-set.test.ts` (whole-set reset
  table).

### CATALOGUE-002 — Category filter is silently ignored

- **Surface:** `GET /api/v1/products?category=` (the `/shop` category select).
- **Code site:** `src/server/catalogue.ts` — the `category` predicate push in
  the same route, skipped under `await isDefectActive(c, 'CATALOGUE-002')`.
- **Expected (clean):** a `category` slug narrows the listing to active
  products in that category; count and rows both respect it.
- **Actual (bug hunt):** the `c.slug = ?` condition is never pushed, so the
  full active catalogue (all 40 active products) is returned regardless of the
  category parameter. The pagination and sort both remain correct.
- **Reproduction:**
  1. Start the hunt (hunt row on `/practice`, or the launch panel on
     `/scenarios/api-catalogue-filters`).
  2. Open `/shop`, choose category **Climbing**. Expected: 5 products.
     Actual: the full catalogue ("40 products").
  3. Control: unfiltered listing shows the same 40 in both modes.
  4. Reset and repeat — the filter narrows to 5 again.
- **Isolation:** the predicate is dropped only for the hunting session. Other
  sessions keep a working filter.
- **Reset:** covered by the whole-set reset table in `tests/server/hunt-set.test.ts`.
- **Tests:** `tests/server/hunt-set.test.ts` (CATALOGUE-002 describe block:
  clean 5 vs hunt 40, bystander 5, reset back to 5).

### CART-001 — Re-adding an item replaces the line quantity

- **Surface:** `POST /api/v1/cart/items`.
- **Code site:** `src/server/cart.ts` — the upsert's `ON CONFLICT … DO UPDATE`
  in the add-to-cart handler. Clean: `quantity = cart_items.quantity + excluded.quantity`.
  Hunt: `quantity = excluded.quantity` (both branches keep the same stock guard).
- **Expected (clean):** adding a product already in the cart accumulates the
  quantity (existing + added), the documented idempotent add-to-cart semantics
  (capped at 99 and by available stock).
- **Actual (bug hunt):** the stored line quantity is replaced by the newly
  added quantity; the accumulation is lost. The cart read-back is otherwise
  consistent (recomputed from the database on every response).
- **Reproduction:**
  1. Start the hunt (hunt row on `/practice`, or the launch panel on
     `/scenarios/manual-cart-add-quantity`).
  2. Add any product with quantity 2, then add it again with quantity 2.
     Expected: quantity 4. Actual: quantity 2.
  3. Control: a different product in a second browser session accumulates to 4.
  4. Reset and repeat — the quantity accumulates again.
- **Boundary note:** the pre-write check (`existing + added > min(stock, 99)`)
  stays additive in both modes; the defect narrows to the stored accumulation.
- **Isolation:** cart rows are session-keyed; other learners see clean
  semantics.
- **Reset:** covered in `tests/server/hunt-set.test.ts` (accumulate → reset →
  accumulate).
- **Tests:** `tests/server/hunt-set.test.ts` (CART-001 block: clean 4, hunt 2,
  bystander 4, post-reset 4).

### INVENTORY-001 — Checkout rejects orders for the exact remaining stock

- **Surface:** `POST /api/v1/checkout` (stock-sufficiency boundary).
- **Code site:** `src/server/checkout.ts` — `blockingProblems(lines, options)`,
  called by both the pre-batch eligibility check and the post-batch re-check.
  Clean: rejects only when `line.quantity > line.availableStock`. Hunt: the
  same predicate is evaluated as `>=`, rejecting exact-stock orders.
- **Expected (clean):** an order for exactly the remaining stock is accepted;
  only quantities above available stock are rejected with
  `422 cart_unavailable` and a per-line `insufficient_stock` reason.
- **Actual (bug hunt):** an order for exactly the remaining stock is rejected
  with `422 cart_unavailable` even though the stock covers it exactly; the
  error payload reports `availableStock` equal to the requested quantity —
  the contradiction is the evidence.
- **Reproduction:**
  1. Start the hunt (hunt row on `/practice`, or the launch panel on
     `/scenarios/api-checkout-exact-stock`).
  2. Find a low-stock product in the seed (e.g. Kestrel Dry Bag 20L, 3 units,
     or Ember LED Lantern, 4 units — local D1 probes may have mutated these;
     the seed values in `db/migrations/0002_commerce_domain.sql` are 3 and 4).
  3. Add exactly that many to the cart and place an approved checkout.
     Expected: order placed (201). Actual: `422 cart_unavailable`.
  4. Reset and repeat — the order is placed.
- **Consistency note:** the checkout *summary* (`GET /api/v1/checkout`) still
  reports `checkoutable: true` while the placement enforces the defect — the
  boundary is deliberately server-side, so the UI affords the checkout and
  the server refuses it. That is part of the exercise.
- **Isolation:** placement validation is re-resolved per request from the
  hunting session; other sessions place exact-stock orders normally.
- **Reset:** covered in `tests/server/hunt-set.test.ts` (hunt 422 → reset →
  201, same session).
- **Tests:** `tests/server/hunt-set.test.ts` (INVENTORY-001 block: clean 201,
  hunt 422 with envelope shape, reset → 201).

### PRICING-001 — Stored order line totals ignore quantity

- **Surface:** `POST /api/v1/checkout` (the `order_items` snapshot written at
  placement) and the order confirmation pages, which read the snapshot.
- **Code site:** `src/server/checkout.ts` — the `line_total_cents` parameter
  in the order-items `INSERT … VALUES` inside the placement `batch()`. Clean:
  `line.lineTotalCents` (unit price × quantity). Hunt: `line.unitPriceCents`.
- **Expected (clean):** each stored snapshot records
  `line_total_cents = unit_price_cents × quantity`; the confirmation line
  total is consistent with unit price, quantity, and the order subtotal/total.
- **Actual (bug hunt):** the stored line total records the unit price, so the
  confirmation shows unit price regardless of quantity (e.g. 3 × $64.90 reads
  as $64.90). The order-level `subtotal_cents`/`total_cents` remain correct.
- **Reproduction:**
  1. Start the hunt (hunt row on `/practice`, or the launch panel on
     `/scenarios/manual-cart-totals`).
  2. Add any product with quantity 3; note the cart shows the correct total.
  3. Place an approved checkout and read the confirmation.
     Expected: line total = 3 × unit price. Actual: line total = unit price.
  4. Reset and repeat — the line totals are correct.
- **Isolation:** only the hunting session's placement snapshot differs; the
  cart math and the summary endpoint are unaffected.
- **Reset:** covered in `tests/server/hunt-set.test.ts` (hunt snapshot → reset
  → correct snapshot for the next order).
- **Tests:** `tests/server/hunt-set.test.ts` (PRICING-001 block: clean, hunt,
  order-level consistency, reset).

### CHECKOUT-001 — Blank customer name passes validation

- **Surface:** `POST /api/v1/checkout` (details validation).
- **Code site:** `src/server/checkout.ts` — the `NAME_PATTERN` check in
  `validateDetails(...)`, skipped when `isDefectActive(c, 'CHECKOUT-001')`.
  Every other field is validated identically in both modes.
- **Expected (clean):** a blank/whitespace-only `customerName` is rejected
  with `400 invalid_request` and a `fields.customerName` message.
- **Actual (bug hunt):** the name check is skipped; the order is placed with
  an empty `customer_name`. Other fields (email, line, city, postcode,
  paymentSimulation) are still enforced, so partial probes elsewhere fail
  normally.
- **Reproduction:**
  1. Start the hunt (hunt row on `/practice`, or the launch panel on
     `/scenarios/manual-address-edge-cases`). The UI blocks blank submits
     client-side, so reproduce via an HTTP client or the browser dev tools.
  2. `POST /api/v1/checkout` with `customerName: "   "` and all other fields
     valid. Expected: 400 + `fields.customerName`. Actual: 201, order placed.
  3. Control: the same request with an invalid email is rejected (400) in
     both modes.
  4. Reset and repeat — the blank name is rejected again.
- **Isolation:** validation is re-resolved per request; other sessions keep
  the full check.
- **Reset:** covered in `tests/server/hunt-set.test.ts` (hunt 201 → control
  400 → reset → clean 400).
- **Tests:** `tests/server/hunt-set.test.ts` (CHECKOUT-001 block).

### AUTHZ-001 — Account order detail drops the ownership check

- **Surface:** `GET /api/v1/account/orders/:reference`.
- **Code site:** `src/server/auth.ts` — the ownership lookup before
  `orderDetailById`. Clean: `WHERE reference = ? AND customer_id = ?`. Hunt:
  the `customer_id` predicate is dropped, so any authenticated active
  customer can read any existing order by reference.
- **Expected (clean):** order detail is served only when the reference AND
  the caller's `customer_id` both match; unknown or not-owned references
  answer the identical `404 not_found` envelope (existence concealed).
- **Actual (bug hunt):** the customer_id predicate is dropped; a not-owned
  reference returns `200` with the order. Unknown references still answer
  `404` (the row lookup itself cannot leak anything).
- **Reproduction:**
  1. Start the hunt (launch panel on `/scenarios/security-object-access`, or
     the hunt row on `/practice`).
  2. Sign in as a demo customer and place an order; copy the reference.
  3. Sign in as a *different* demo customer and open
     `/account/orders/<reference>`. Expected: concealed not-found. Actual:
     the order detail renders.
  4. Reset and repeat as the second customer — concealed again.
- **Isolation:** the check is re-resolved per request from the hunting
  session. Ben's hunt cannot expose data to Ben's bystander colleagues
  beyond what the defect allows — every other account surface is unchanged.
- **Reset:** covered in `tests/server/hunt-set.test.ts` (404 → hunt 200 →
  reset → 404) plus the unknown-reference-stays-404 control.
- **Tests:** `tests/server/hunt-set.test.ts` (AUTHZ-001 block: clean 404,
  hunt 200, unknown reference 404).

## Defect coverage against the phase-plan areas

| Area (plan §5) | Defect(s) |
|---|---|
| filtering/search | `CATALOGUE-001`, `CATALOGUE-002` |
| inventory | `CART-001` (cart-side state), `INVENTORY-001` (checkout boundary) |
| pricing | `PRICING-001` |
| validation | `CHECKOUT-001` |
| authZ | `AUTHZ-001` |

## Maintenance notes

- `practice_sessions.hunt_id` is intentionally **not** a foreign key: hunts
  are compiled TypeScript, not database rows. If a mint outlives a registry
  change, `isDefectActive` and the session endpoint both resolve the stale
  id to clean behaviour.
- Defect and hunt ids are validated by format on input (`hunt_id` path
  param: `^[a-z0-9][a-z0-9-]{2,63}$`) and are never reflected back verbatim.
- `hunt_start_caps` is intentionally not swept by a job: on each write, rows
  whose `day` is not today are deleted first, and each IP keeps at most one
  row. If the table ever matters for billing or audit, revisit with M9.
- The catalogue seed data (`0002_commerce_domain.sql`) is stable. Local dev
  databases accumulate probe orders and stock decrements (throwaway local
  state); integration tests always run against freshly migrated in-memory
  databases.
- The two `blockingProblems` call sites share one `rejectExactStock` flag
  passed from the request scope, so the pre-batch and post-batch paths can
  never disagree about the boundary within a single request.
