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
- **Hunt starts are capped per IP per UTC day** (20 starts; only a
  SHA-256 hash of the IP is stored, one row per address in `hunt_start_caps`, reset on the day
  boundary, exact atomic guarded increments — never overshoots). Idempotent same-hunt
  re-starts and resets never count. This is an abuse control, not a
  security boundary; when no client IP is visible (local development) it is skipped.
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

## Registered hunts (P5-M2 — Phase 5 API & identity)

| Hunt id | Title | Defects | Wired scenario |
|---|---|---|---|
| `hunt-authn-001` | Signing out does not end the token’s life | `AUTHN-001` | `api-token-replay` |
| `hunt-rbac-001` | Staff tools open to the wrong role | `RBAC-001` | `auth-role-boundaries` |
| `hunt-mass-001` | Checkout trusts the client’s prices | `MASS-001` | `api-mass-assignment` |

### AUTHN-001 — Logout leaves API tokens replayable

- **Surface:** `POST /api/v1/auth/logout` (+ Bearer resolution in
  `src/server/customer.ts`).
- **Code site:** `src/server/auth.ts` — the logout handler's customer-scoped
  `DELETE FROM api_tokens WHERE customer_id = ?` is skipped under
  `await isDefectActive(c, 'AUTHN-001')`. Bearer resolution
  (`findLiveApiToken`) is unchanged in both modes.
- **Expected (clean):** logout revokes the caller account's practice API
  tokens server-side; a Bearer token replayed after logout answers
  `401 unauthorized`.
- **Actual (bug hunt):** logout deletes the customer session but leaves the
  account's `api_tokens` rows in place, so the replayed Bearer token still
  resolves the account (`200`).
- **Reproduction:**
  1. Start the hunt (launch panel on `/scenarios/api-token-replay`, or the
     hunt row on `/practice`).
  2. Sign in as a demo customer; mint a token from the API Lab
     (`POST /api/v1/auth/token`); prove it with one protected request.
  3. Sign out. Replay the same request with the token.
     Expected: `401 unauthorized`. Actual: `200` with the profile.
  4. Reset and repeat — `401 unauthorized` again.
- **Isolation:** only the hunting session's logout skips revocation. The
  tokens are account-scoped, so the defect could expose the hunting
  account's own data during the hunt window — never another account's.
  Clean mode (any session) revokes exactly as documented; AUTHN-001 never
  lives in clean code paths.
- **Reset:** `POST /api/v1/practice/session/reset` — subsequent logouts
  revoke normally again.
- **Tests:** `tests/server/api-tokens.test.ts` and
  `tests/server/hunt-set.test.ts` (logout-replay blocks, clean/hunt/reset).

### RBAC-001 — Staff inventory read is open to the customer role

- **Surface:** `GET /api/v1/admin/inventory` (read-only).
- **Code site:** `src/server/staff.ts` — the `role !== 'staff'` branch of
  `requireStaff` is bypassed under
  `options.roleBoundaryDefect && await isDefectActive(c, 'RBAC-001')`, and
  only the GET /admin/inventory route opts in via `{ roleBoundaryDefect: true }`.
  PATCH /admin/inventory/:productId calls `requireStaff` without the option
  and is enforced identically in both modes.
- **Expected (clean):** an authenticated customer-role account answers
  `403 staff_required` on the inventory list (cookie or Bearer).
- **Actual (bug hunt):** any authenticated *active* account (either role,
  either credential) receives `200` with the inventory list. Suspended
  accounts still answer `403 account_suspended`; guests still answer `401`.
- **Reproduction:**
  1. Start the hunt (launch panel on `/scenarios/auth-role-boundaries`, or
     the hunt row on `/practice`).
  2. Sign in as a customer-role demo account; GET /api/v1/admin/inventory.
     Expected: `403 staff_required`. Actual: `200` with the inventory list.
  3. Control: PATCH /api/v1/admin/inventory/:productId — `403` in both modes.
  4. Reset and repeat — `403 staff_required` again.
- **Isolation:** the defective branch grants read access to synthetic
  inventory figures only, only for the hunting session, and never widens
  PATCH or any other staff boundary. Staff fixtures are unaffected in both
  modes.
- **Reset:** covered in `tests/server/hunt-set.test.ts` (clean 403 → hunt
  200 → reset → 403; PATCH 403 in both modes).
- **Tests:** `tests/server/hunt-set.test.ts`.

### MASS-001 — Checkout honours a client-supplied totalCents

- **Surface:** `POST /api/v1/checkout`.
- **Code site:** `src/server/checkout.ts` — the `totalCents` bound for the
  orders INSERT is taken from a client `totalCents` field when the hunt is
  active and the field is a non-negative safe integer; otherwise the
  server-computed figure is used, exactly as clean mode. The subtotal and
  line totals are never client-controlled in either mode.
- **Expected (clean):** the client sends only customer details and
  `paymentSimulation`; the stored total is always computed server-side.
  An extra `totalCents` field is ignored entirely.
- **Actual (bug hunt):** a non-negative integer `totalCents` in the body is
  stored as the order's total. The confirmation and
  `GET /api/v1/orders/:reference` report a total disagreeing with the cart,
  the checkout summary and the sum of line totals.
- **Reproduction:**
  1. Start the hunt (launch panel on `/scenarios/api-mass-assignment`, or
     the hunt row on `/practice`).
  2. Add products to the cart; note the checkout summary total.
  3. POST /api/v1/checkout with valid details, `paymentSimulation:
     approved` and `"totalCents": 1`.
  4. Open the confirmation — the total is the forged figure.
     Expected (clean): the extra field is ignored.
  5. Reset and repeat — the server-computed total is stored again.
- **Isolation:** forged totals affect only the hunting session's own
  session-scoped, 7-day-TTL orders (cascade-deleted with the session).
  The orders table CHECK (`total_cents >= 0`) is untouched — negative
  forged values are out of domain and ignored exactly as clean mode
  ignores the field. No payment processor, no shared rows.
- **Reset:** covered in `tests/server/hunt-set.test.ts` (hunt `1` honoured →
  reset → server-computed figure) plus the clean-mode forged-field block.
- **Tests:** `tests/server/hunt-set.test.ts`.

## Registered hunts (Phase 6 M2 — SQL data-integrity hunts)

Eight deterministic **data-plane** hunts against the browser-local Meridian
Outfitters practice snapshot (WebAssembly SQLite). Unlike the UI/API hunts
above, there is no code-branch defect: the corruption lives in a
server-compiled delta (`src/server/sqlSeedDelta.ts`) that the browser applies
to a fresh canonical reseed, only in bug-hunt mode, only after the start
endpoint created the attempt. Deltas are served byte-identically to every
learner; nothing about them reaches D1, the public/ folder or the client
bundle (leak-linted by `tests/lib/sql-leak.test.ts` and the build sweep in
the exit audit). `defectIds` stays empty; `isDefectActive()` is always false
for them by construction. They consume none of the 20/IP/UTC-day UI hunt
start cap (that budget is reserved for the interactive hunts); abuse is
bounded by the global 120/min mutation backstop, the scoped 30/min
`sql-seed:<iphash>` load budget and the one-live-attempt unique index.

| Hunt id | Title | Δ applied to the fresh snapshot | Expected vs actual |
|---|---|---|---|
| `hunt-db-001` | Order items without products | `INSERT` two `order_items` referencing products `7777`/`8888` with foreign keys disabled, then re-enable them | Expected: every order item joins to a product. Actual: two orphans; an inner join hides them entirely; an anti-join surfaces them |
| `hunt-db-002` | The signup email lookalikes | `INSERT` three `customers` rows for one identity (case variant, dot-drift variant, trailing-space variant) | Expected: one account per real human. Actual: the identity exists three times; counts inflate and the order history splits invisibly |
| `hunt-db-003` | The order that drifted | `UPDATE orders SET total_cents = 50777 WHERE id = 5003` (clean order; non-round drift −339) | Expected: total reconciles with parts (subtotal+shipping+tax). Actual: off by exactly 339 cents against its own chain |
| `hunt-db-004` | Stock that lied | `UPDATE inventory SET quantity = 25 WHERE product_id = 30` (seeded 80; still ≥0) | Expected: on-hand agrees with the sell-through ledger. Actual: Tinderbox Firesteel Kit reports 55 fewer units than history supports |
| `hunt-db-005` | The silent payment | `DELETE FROM payments WHERE id = 8148` (the approved payment for delivered order `MO-2026-0064`) | Expected: every delivered order carries exactly one payment. Actual: one delivered order is silently missing its capture; revenue under-counts |
| `hunt-db-006` | Line totals that ignore quantity | `UPDATE order_items SET line_total_cents = unit_price_cents WHERE order_id = 5133` (all three lines of `MO-2026-0075`) | Expected: `line_total = qty × price`. Actual: quantity factor dropped; aggregates under-count by exactly `(qty−1) × price` per line |
| `hunt-db-007` | The boundary that would not checkout | `UPDATE inventory SET quantity = 3 WHERE product_id = 20` — the exact `max(quantity)` of any order line for that product | Expected: a checkout for exactly the remaining stock is accepted exactly once. Actual: the equality seam the boundary check must cross; mirrors INVENTORY-001 in stored-data form |
| `hunt-db-008` | The customer who vanished | `PRAGMA foreign_keys=OFF; DELETE FROM customers WHERE id = 1030; PRAGMA foreign_keys=ON;` — jonas.osei@example.com's seven orders persist with a dangling reference | Expected: no orders reference missing customers. Actual: seven orphaned orders; every join silently drops them |

Learner wiring: each hunt is wired to a database scenario
(`db-orphaned-carts`, `db-duplicate-customers`, `db-order-total-drift`,
`db-stock-audit`, `db-missing-payment`, `db-line-totals`,
`db-stock-boundary`, `db-vanished-customer`), carries a `HUNT_CURRICULUM`
entry, and files structured reports through the unchanged Phase 4 report
evaluator (`hunt-db-*` are valid `huntId` values for the existing
report/hints/reveal endpoints). Investigation happens in the SQL lab at
`/database/playground`, where a bug-hunt session re-seeds with the delta
applied; the scenario page and `/practice` carry the hint ladder, report
form and gated reveal. Clean mode and every clean exercise stay correct
always (`PRAGMA foreign_keys=ON`, the canonical snapshot, and
`tests/server/sql-hunt.test.ts` assert the corruption never appears
without the delta).

## Defect coverage against the phase-plan areas

| Area (plan §5) | Defect(s) |
|---|---|
| filtering/search | `CATALOGUE-001`, `CATALOGUE-002` |
| inventory | `CART-001` (cart-side state), `INVENTORY-001` (checkout boundary) |
| pricing | `PRICING-001` |
| validation | `CHECKOUT-001` |
| authZ | `AUTHZ-001` |
| authN / token lifecycle | `AUTHN-001` |
| RBAC / role boundaries | `RBAC-001` |
| mass assignment | `MASS-001` |

## Maintenance notes

- `practice_sessions.hunt_id` is intentionally **not** a foreign key: hunts
  are compiled TypeScript, not database rows. If a mint outlives a registry
  change, `isDefectActive` and the session endpoint both resolve the stale
  id to clean behaviour.
- Defect and hunt ids are validated by format on input (`hunt_id` path
  param: `^[a-z0-9][a-z0-9-]{2,63}$`) and are never reflected back verbatim.
- `hunt_start_caps` is swept by the maintenance sweep (day-old rows, bounded) and by each
  write (day != today, ≤100 rows per call); each IP keeps at most one row per UTC day.
  `rate_limit_buckets` rows older than two hours are swept the same way.
- The catalogue seed data (`0002_commerce_domain.sql`) is stable. Local dev
  databases accumulate probe orders and stock decrements (throwaway local
  state); integration tests always run against freshly migrated in-memory
  databases.
- The two `blockingProblems` call sites share one `rejectExactStock` flag
  passed from the request scope, so the pre-batch and post-batch paths can
  never disagree about the boundary within a single request.
