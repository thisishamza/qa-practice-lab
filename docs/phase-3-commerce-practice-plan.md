# Phase 3 — Commerce Practice Application Plan

> **Purpose:** authoritative design for the Phase 3 commerce practice application and its
> milestone sequence. Implement **one milestone per session**; do not start a milestone before
> the previous one is verified and merged/committed. Update `PROJECT_STATE.md` §11/§12 in the
> same turn as any change to this plan.

## 1. What we are building

One original fictional e-commerce application — **Meridian Outfitters**, an outdoor & home
goods store — that learners test across manual UI, API, database, automation, performance and
safe security practice. It is a *test target*, not a real shop: synthetic data only, fake
payment outcomes, no real brands, no real PII.

The same domain entities back every track, so an API test, a database test and a UI test all
observe one coherent product: `Product`, `Category`, `Inventory`, `Customer` (M5), `Cart` /
`CartItem` (M3), `Order` / `OrderItem` (M4), `PracticeSession` (M7).

Non-goals for Phase 3: external integrations, real payment processing, accounts with email
verification, multi-tenant/social features, design-system rewrites, any Phase 4+ lab content.

## 2. Architecture decisions

1. **Modular services inside the existing Pages Functions app** (Hono), not separate Workers.
   Modules live under `src/server/`; routes mount under `/api/v1/...`; infrastructure stays
   under `/api/...`. A later phase may split services out if it adds learning value and fits
   free limits.
2. **D1 remains an implementation detail.** No endpoint exposes arbitrary SQL, no SQL-console
   surface, ever. SQL practice belongs to Phase 6 (browser SQLite/WASM sandbox).
3. **Money is integer cents** everywhere (`price_cents`), formatted only at the edge. No
   floats, no decimal strings as storage.
4. **Identifiers:** integer primary keys internally; stable lowercase-hyphen `slug` for
   URL-facing lookups. Seed data uses explicit ids so it is fully deterministic.
5. **`active` flag, not deletes:** catalogue rows are deactivated, never hard-deleted, so
   historical orders stay valid.
6. **Inventory as its own table** (`inventory.product_id` PK/FK) so stock can be reasoned
   about and seeded independently later; quantities are integers, `CHECK (quantity >= 0)`.
7. **Synthetic seed data lives inside migrations** (explicit inserts) so
   `npm run db:migrate:local` is the single, reproducible setup step for local dev and tests.
   A reseed/reset path arrives with M9.
8. **Shared contracts in `src/shared/commerce.ts`** consumed by server now and the storefront
   UI in M2; API error envelope stays `{ error, message }`, consistent with Phase 1/2.
9. **No new runtime dependencies** in M1. Icons/images: the storefront (M2) stays text-first
   in the Test Bench design system; no icon package is added casually.
10. **Free-tier first:** integer-keyed lookups, indexed filters, paginated list endpoints with
    hard caps, bounded page sizes (`perPage` ≤ 48), later milestones add per-IP caps on
    mutating endpoints. No background Workers until Phase 5 needs cron/queues.
11. **Clean by default.** The application ships defect-free; intentional defects exist only
    behind the Phase 3 bug-hunt engine (§4), never in the default path.

## 3. API surface plan (v1)

| Milestone | Endpoints | Type |
|---|---|---|
| M1 (done) | `GET /api/v1/products` (page, perPage≤48, category, sort, `q` since M2) · `GET /api/v1/products/:slug` · `GET /api/v1/categories` | Read-only |
| M2 (done) | No new endpoints (read-only); `q` search added to `/api/v1/products` | Read-only |
| M3 (done) | `GET /api/v1/cart` · `POST /api/v1/cart/items` · `PATCH /api/v1/cart/items/:id` · `DELETE /api/v1/cart/items/:id` · `DELETE /api/v1/cart` | Session cart |
| M4 (done) | `GET /api/v1/checkout` · `POST /api/v1/checkout` · `GET /api/v1/orders` · `GET /api/v1/orders/:reference` | Orders |
| M5 (done) | `GET /api/v1/auth/accounts` · `POST /api/v1/auth/login` · `POST /api/v1/auth/logout` · `GET /api/v1/auth/me` · `GET /api/v1/account` · `GET /api/v1/account/orders` · `GET /api/v1/account/orders/:reference` | Synthetic auth + protected account |
| M6 (implemented) | `GET /api/v1/admin/inventory` · `PATCH /api/v1/admin/inventory/:productId` (staff role) · `POST /api/v1/orders/:reference/cancel` (stock re-check inside checkout) | Inventory |
| M7 (implemented) | `POST /api/v1/practice/hunts/:huntId/start` · `POST /api/v1/practice/session/reset` · `GET /api/v1/practice/session` | Hunt sessions |

All mutating endpoints require an anonymous practice session cookie; M5 adds synthetic
bearer-style auth on top. Nothing here is exposed without the session cookie.

## 4. Bug-hunt engine architecture (implemented in M7 — see §P3-M7 and docs/bug-hunt-catalogue.md)

**Hard requirements:** reproducible, server-controlled, session-isolated, documented.
**Explicit non-goals:** random frontend bug generation, client-side activation flags,
open-ended defect toggling, defects in clean mode.

- **Hunt registry is code, not data** — `src/server/hunts.ts` (M7) exports typed hunt
  definitions: `{ id, title, scenarioId?, defectIds[], summary }`. Unknown ids → 404. Because
  hunts are compiled TypeScript, learners cannot inject defects, SQL, or expressions.
- **Defect registry is code, not data** — `src/server/defects.ts` (M7) exports the full
  catalogue: `{ id, title, expected, actual, repro, affectedSurface }`. Internal documentation
  (`docs/bug-hunt-catalogue.md`) documents Expected vs Actual per defect.
- **Sessions:** `practice_sessions` table — `token_hash` (SHA-256 of a 128-bit random token,
  never stored plain), `mode` (`clean` | `bug_hunt`), `hunt_id` (nullable), `created_at`,
  `expires_at` (7 days). Cookie: `mpl_session`, `httpOnly`, `SameSite=Strict`, `path=/`.
  Cart/order rows reference `session_id`. A new session is free with a cookie delete.
- **Activation is server-resolved:** `POST …/hunts/:huntId/start` creates (or re-stamps) the
  session with `mode='bug_hunt'` and the hunt's fixed defect list. There is deliberately **no**
  endpoint to toggle individual defects, and the client never sends defect ids.
- **Clean mode** is the default session (`mode='clean'`): no defect branch ever executes.
  The storefront banner shows "Clean mode" vs "Bug-hunt mode — defects are intentional".
- **Application sites:** each defect has exactly one (or as few as possible) code sites that
  branch on `await isDefectActive(c, '<DEFECT-ID>')`. The defective branch implements the
  documented wrong behavior *precisely*; no other path is touched. Unit tests cover both
  branches per defect.
- **Isolation:** mutable state is always session-scoped. Read-path defects (e.g. stale stock
  after a cart update) apply only to responses served for that session. The seeded catalogue
  is identical for everyone; learner mutations never leak across sessions because carts and
  orders are keyed by `session_id`.
- **Reset:** `POST …/practice/session/reset` re-stamps the live session to clean mode
  (`mode='clean'`, `hunt_id=NULL`) — the learner always lands in a known-good state with
  cart/orders intact (as built in M7; see the M7 deviation note below about why the
  expire+fresh-session sketch was not used).
- **Abuse controls:** hunt starts capped per IP per day; session rows swept on expiry (M9);
  no admin/teacher activation UI in Phase 3; rate limits on cart/checkout/hunt endpoints.
- **Docs:** every defect documents Expected vs Actual, reproduction steps, and the fix in
  `docs/bug-hunt-catalogue.md`. Learner-facing reveal stays minimal until the scenario/reveal
  flow lands (Phase 4+); Phase 3 hunts are clearly labelled practice.
- **Determinism guarantee:** defect branches are static; identical session state + hunt ⇒
  identical responses. No `Math.random()`, no time-dependent defect logic (timers use seeded
  `created_at`, not wall-clock, where ordering matters).

## 5. Milestone breakdown

Sizes are deliberately small; each is independently reviewable. Order is fixed by dependency,
not by interest. "Acceptance" means: existing suite green, `npm run check` clean, production
build passes, milestone-specific tests written and passing, browser verification for any UI
milestone, `PROJECT_STATE.md` updated in the same turn.

### P3-M1 — Commerce domain foundation *(implemented; see PROJECT_STATE §12)*

- **Purpose:** establish the domain schema, deterministic seed data, shared contracts and a
  read-only catalogue API the storefront will consume.
- **Scope:** migration `0002_commerce_domain.sql`; `src/shared/commerce.ts`; catalogue routes;
  fake-D1 test harness (`tests/helpers/fake-d1.ts`) applying the real migrations via
  `node:sqlite`; catalogue API tests. No UI, no cart/order/auth tables.
- **Dependencies:** none (Phase 2.5 merged).
- **Database:** new tables `categories`, `products`, `inventory`; index on
  `products(category_id)`, `products(active)`; `app_meta.schema_version` → `2`.
- **Backend:** `GET /api/v1/products` (pagination ≤ 48/page, `category` slug filter,
  `sort=newest|name|price_asc|price_desc`), `GET /api/v1/products/:slug` (404 envelope),
  `GET /api/v1/categories`. Stock status derived in SQL
  (`in_stock` / `low_stock` / `out_of_stock`).
- **Acceptance:** migration applies cleanly on fresh local D1; list/detail/categories work;
  inactive products hidden; unknown slug → 404 envelope; `schemaVersion` reports `2`.

### P3-M2 — Storefront catalogue UI *(implemented; see PROJECT_STATE §12)*

- **Purpose:** learners can browse, search, filter and open products — the surface manual UI
  testing needs.
- **Scope:** `/shop` and `/shop/products/:slug` inside `AppShell`: catalogue grid (product
  cards, mono meta, stock tags), URL-driven search/filter/sort/pagination (mirror
  `src/lib/catalog.ts` pattern), product detail, empty/error/loading states, fetch against
  `/api/v1/*`.
- **Dependencies:** M1. **Backend:** small justified extension — `GET /api/v1/products` gained
  an optional `q` parameter (case-insensitive match on name, description and category name;
  LIKE wildcards escaped; bind-parameter only) because the storefront purpose requires search
  and the M1 API had none. **Database:** none.
- **Frontend changes:** new pages + feature components, reuse tokens/primitives; text-first
  cards (no icon package, no product photography yet — layout and typography carry the design).
- **Acceptance:** routes render inside shell; both themes; 375/768/1024/1440; one `h1`; no
  overflow; deep links work; API down → `ErrorState` with retry. ✅ verified 2026-11-15.
- **Testing:** unit tests (`tests/lib/shop.test.ts`, `tests/shop/api.test.ts`,
  `tests/shop/views.test.tsx`) + `tests/server/catalogue.test.ts` search coverage + Playwright/Chrome
  probe. **Risks:** duplicate filter logic — extracted shared helpers instead.

### P3-M3 — Cart *(implemented; see PROJECT_STATE §12)*

- **Purpose:** mutable, testable state for cart scenarios (add/update/remove, totals).
- **Scope:** `practice_sessions`, `carts`, `cart_items` tables (session-keyed);
  `POST …/cart/items`, `PATCH/DELETE …/cart/items/:id`, `GET /api/v1/cart`,
  `DELETE /api/v1/cart`; `/cart` page; top-bar cart entry point; anonymous `mpl_session`
  cookie (clean-mode sessions only; hunt sessions arrive in M7). Planned `/shop/cart`
  page became `/cart` per the implementation brief.
- **Database:** `carts(id, session_id UNIQUE, created_at, updated_at)`, `cart_items(cart_id,
  product_id, quantity, CHECK 0 < quantity <= 99)`; unique `(cart_id, product_id)`;
  `practice_sessions(id, token_hash UNIQUE, created_at, expires_at)` with the token stored
  only as a SHA-256 hash. M7 will extend `practice_sessions` with mode/hunt_id.
- **Acceptance:** totals derived server-side from `price_cents`; quantity ≤ stock; clear
  cart; idempotent add-to-cart semantics (one line per product, quantities accumulate);
  session isolation (two browser contexts never see each other's carts). ✅ verified 2026-11-15.

### P3-M4 — Checkout & orders *(implemented; see PROJECT_STATE §12)*

- **Purpose:** order lifecycle — the richest API/DB test target.
- **Scope (as built):** `GET /api/v1/checkout` (summary + `checkoutable`),
  `POST /api/v1/checkout` (validate cart → create order + items in one all-or-nothing D1 batch
  — order, immutable item snapshots, `inventory.quantity >= 0`-guarded decrements, cart clear,
  idempotency record; fake payment outcome `approved|declined`), `GET /api/v1/orders` (history,
  ≤50, newest first), `GET /api/v1/orders/:reference` (session-scoped confirmation; the plan's
  `:id` became the opaque `ORD-…` reference). Pages: `/checkout` and `/orders/:reference`
  (the plan's `/shop/checkout` and `/shop/orders` sketch became top-level `/checkout` and the
  `/orders/:reference` confirmation route, matching the `/cart` precedent).
- **Database:** `orders(id, session_id, reference UNIQUE, status CHECK('placed'),
  payment_status CHECK('approved','declined'), customer_*, shipping_*, subtotal_cents,
  total_cents, created_at)`, `order_items(order_id, product_id NULL ON DELETE SET NULL,
  product_slug, product_name, unit_price_cents, line_total_cents, quantity)`,
  `checkout_idempotency(session_id, idempotency_key, request_hash, outcome, order_id,
  PRIMARY KEY(session_id, idempotency_key))`. Status enum as CHECK (`placed`; M6 may add
  `cancelled`/`fulfilled`). `schema_version` → `4`.
- **Acceptance:** declined payment creates no order; approved order decrements stock exactly
  once (single D1 batch; CHECK-guarded); order totals match cart; empty cart → 422 envelope.
  ✅ verified 2026-11-15. Rate caps remain deferred to M9 (the plan's per-session/minute
  checkout cap was not implemented in M4; noted in PROJECT_STATE limitations).
- **Testing:** transaction rollback cases in the fake-D1 harness; concurrent-submission and
  idempotency replay/drift cases; SQLite-backed through real migrations.

### P3-M5 — Synthetic customers & auth simulation *(implemented; see PROJECT_STATE §12)*

- **Purpose:** authN/authZ test surface: login, ownership, session handling.
- **Scope (as built):** migration `0005_customers.sql` (`customers(id, email UNIQUE COLLATE NOCASE,
  name, password_hash /* PBKDF2-HMAC-SHA256, 100k iterations, fixed salts — deterministic fixtures */,
  role /* customer|staff */, status /* active|suspended */, synthetic address columns, created_at)`,
  `customer_sessions(token_hash UNIQUE, customer_id → customers, practice_session_id →
  practice_sessions NOT NULL, expires_at)` — the customer session is bound to its practice session
  and is only honoured while that practice session is live; `orders.customer_id` added as an
  explicit, nullable, transactional association set at checkout placement (pre-sign-in orders are
  never silently adopted). Endpoints: `GET /api/v1/auth/accounts` (safe demo-directory),
  `POST /api/v1/auth/login` (identical 401 `invalid_credentials` for unknown email vs wrong
  password, dummy-digest verification, 403 `account_suspended`, token rotation destroying any
  pre-existing customer session for the practice session — fixation impossible),
  `POST /api/v1/auth/logout` (idempotent), `GET /api/v1/auth/me` (401 unauthorized /
  403 account_suspended), protected `GET /api/v1/account`, `GET /api/v1/account/orders`,
  `GET /api/v1/account/orders/:reference` (unknown and not-owned references answer the identical
  404 — existence concealed, consistent with the session-scoped confirmation). Frontend: `/login`,
  `/account`, `/account/orders`, `/account/orders/:reference` routes inside `AppShell`, demo
  account directory (no credentials shown), accessible error summary, top-bar account indicator,
  Account entry in sidebar/mobile nav.
- **Deviations from the sketched scope:** the login page is `/login` (the plan sketched
  `/shop/account`); password hashing is Web-Crypto PBKDF2 via `crypto.subtle` (available in the
  Workers runtime) rather than a scrypt-ish dependency; the plan's 5/min/IP login rate limit is
  NOT implemented — consistent with cart/checkout, rate limiting is deferred to M9 (documented);
  no staff-only endpoint ships yet (the `staff` role is seeded and stored; the staff inventory
  restock surface arrives with M6). Sign-in is never required for cart/checkout; the guest flow is
  unchanged.
- **Acceptance:** wrong password → 401 (identical to unknown email); cross-customer order access →
  concealed 404 (the plan sketched 403 for customer A reading B's order — this milestone refines
  that to a documented, consistent policy: 401 = unauthenticated, 403 = authenticated but
  suspended, 404 = concealed/not owned); `/auth/me` reflects the cookie; full-suite tests cover
  rotation, expiry, malformed cookies, practice-session binding, ownership and compatibility
  (212 → 239 tests). ✅ verified 2026-11-15.

### P3-M6 — Inventory depth *(implemented; see PROJECT_STATE §12)*

- **Purpose:** make stock real — low/out-of-stock UX, reservation correctness.
- **Scope (as built):** checkout-time stock re-check inside the transaction (fail cleanly if
  insufficient; the pre-batch read-check plus the `inventory.quantity >= 0` CHECK and the
  post-batch honest `422 cart_unavailable` re-read — see the M4 transaction design); out-of-stock
  add-to-cart rejection (shipped in M3); low-stock badge in storefront (shipped in M2 —
  `stock-tag low_stock` on cards and the detail page); staff restock endpoint
  (`PATCH /api/v1/admin/inventory/:productId`, staff role, with a staff-only list endpoint
  `GET /api/v1/admin/inventory` and the `/admin/inventory` UI); order status transitions
  (`placed → cancelled` restores stock once) via `POST /api/v1/orders/:reference/cancel`.
- **Database:** migration `0006_inventory_depth.sql` (additive only): `inventory_adjustments`
  (immutable audit rows: product, positive delta, reason `restock|order_cancellation`, note,
  acting customer/session, `order_id`, timestamp) and `order_cancellations` (PK `order_id` — the
  exactly-once / idempotency marker; cancellation is an append-only event, the public status is
  derived at read time and `orders.status` is never rewritten — D1 cannot alter a CHECK without
  an unsupported table rebuild). `schema_version` → `6`. No reservations; the plan's preference
  for conditional writes over a reservation framework was confirmed.
- **Acceptance:** race simulation test (two checkouts, stock 1) yields exactly one success
  (verified in `tests/server/inventory.test.ts`); cancel restock is idempotent (retry answers
  200, stock restored once, no duplicate marker or audit rows). ✅ verified 2026-11-15.
- **Deviations / notes:** the plan's sketch allowed `PATCH` on `:productId` — implemented exactly;
  added read endpoint because staff must *see* current stock (the plan's "at minimum, evaluate a
  safe stock-restock operation"); cancellation marker replaces rewriting `orders.status`
  (documented above); audit-trail scope kept minimal (no reporting UI). Rate caps remain deferred
  to M9 (consistent with the rest of the app).
- **Testing:** `tests/server/inventory.test.ts` — staff authorization matrix (guest 401, customer
  403 `staff_required`, suspended staff 403 `account_suspended`, cross-practice-session replay
  401), restock validation (zero/negative/fractional/textual/missing/>10,000/cap-exceeded → no
  write, audit row only on success), catalogue staleness after restock, cancel exactly-once,
  idempotency across sessions/customers, race for the last unit, CHECK-constraint rollback.

### P3-M7 — Bug-hunt engine v1 *(implemented; see PROJECT_STATE §12)*

- **Purpose:** the machinery for clean/bug-hunt modes — sessions, hunt registry, isolation.
- **Scope (as built):** `practice_sessions` extended with `mode`/`hunt_id` (migration
  `0007_bug_hunt.sql`, additive, `schema_version` → `7`); `src/server/hunts.ts` (hunt registry)
  and `src/server/defects.ts` (defect registry + `isDefectActive`); `POST /api/v1/practice/hunts/:huntId/start`,
  `POST /api/v1/practice/session/reset`, `GET /api/v1/practice/session`; `isDefectActive()`
  server-resolved activation; one end-to-end proof defect — **`CATALOGUE-001`** (hunt
  `hunt-catalogue-001`, "Catalogue search under-matches": the description facet of the `q`
  search predicate is dropped), chosen instead of the sketched `PRICE-001` free-shipping
  off-by-one because no shipping/free-shipping feature exists to hang the defect on — the
  smallest defect demonstrated through an existing commerce workflow. Learner-facing surfaces:
  a persistent mode banner in the app shell (Clean vs Bug-hunt) and start/reset controls on
  `/practice`; engine doc `docs/bug-hunt-catalogue.md` (internal Expected vs Actual, repro,
  fix, isolation).
- **Database:** additive columns only; `hunt_id` is deliberately NOT a foreign key (hunts are
  compiled TypeScript, not rows). Existing sessions default to `clean`.
- **Acceptance:** clean session never sees the defect; bug-hunt session sees exactly
  `CATALOGUE-001`; reset returns to clean; no endpoint accepts defect ids; two sessions are
  isolated. ✅ verified 2026-11-15 (unit/integration + browser probe).
- **Deviations (documented, deliberate):**
  1. Proof defect is `CATALOGUE-001`, not the sketched free-shipping `PRICE-001` (no shipping
     exists; inventing one was scope creep).
  2. Reset is a **non-destructive re-stamp** (`mode='clean'`, `hunt_id=NULL`), not the
     "expire + fresh session" sketch: expiring the practice session would cascade-delete the
     learner's orders and cart (M4 FKs) and detach their synthetic customer session (M5 FKs) —
     far more destructive than "restores clean mode" promises. The cart, orders and
     sign-in binding survive reset; verified by test.
  3. Hunt start re-stamps the live session in place rather than minting a new one (cart and
     orders stay put); repeated starts are idempotent. The learner-facing hunt list is
     hard-coded on `/practice` until P3-M8 wires hunts into the scenario catalogue
     (no `GET /api/v1/practice/hunts` endpoint yet — hunt→scenario wiring is M8).
- **Testing:** `tests/server/hunt.test.ts` (24 tests: registry integrity, start/reset, both
  defect branches, two-learner isolation, guest + synthetic-account compatibility across
  reset, forged body/defect-id rejection, expired/unknown-hunt → clean, idempotency,
  non-destructive order preservation) + `tests/practice/api.test.ts` (client) + browser probe
  (two isolated contexts) + all pre-existing suites green.

### P3-M8 — Bug-hunt defect set & scenario wiring

- **Purpose:** the actual learner-facing hunts.
- **Scope:** 5–7 deterministic defects across pricing/inventory/filtering/validation/authZ
  (examples: price rounding, stale stock after update, broken catalogue filter, coupon
  free-shipping boundary, incorrect role visibility, validation that accepts empty names).
  Each defect: registry entry + single-site branch + both-branch tests + internal doc entry;
  hunt→scenario links surfaced in catalogue UI; bug-report capture stays minimal (local
  markdown export) until reveal flow lands.
- **Acceptance:** every defect reproducible by scripted steps; clean mode verified defect-free
  against the same probe suite; hunt starts capped per IP/day.
- **Risks:** scope creep — any defect touching more than one site is redesigned or dropped.

### P3-M9 — Hardening, reset & Phase 3 exit

- **Purpose:** ship-quality pass and merge preparation.
- **Scope:** session expiry sweep (delete expired sessions/carts/orders), rate limits on
  mutating endpoints, reset/reseed script (`npm run db:reset:local`), README/docs/roadmap
  final, a11y + responsive audit of the new zone, PRODUCTION smoke checklist, PROJECT_STATE
  Phase 3 exit log, merge proposal to `main`.
- **Acceptance:** fresh-clone quick start works; all gates green; exit criteria met for the
  Phase 3 roadmap row ("UI scenarios can be completed and known defects are reproducible").

## 6. Scenario mapping (initial sketch)

| Hunt | Scenario area | Defect(s) |
|---|---|---|
| `hunt-catalogue-001` | Filtering/search | `CATALOGUE-001` description facet ignored — **shipped in M7** |
| `hunt-pricing-001` | Checkout totals | threshold off-by-one (candidate — no shipping feature exists; re-scope in M8) |
| `hunt-inventory-001` | Inventory/staleness | stale stock read after cart mutation |
| `hunt-validation-001` | Checkout form | empty-name/postcode edge case accepted |
| `hunt-authz-001` | Order ownership | missing ownership check on one endpoint |

Final hunt set is fixed in M8; this table is a sketch, not a contract.

## 7. Free-tier impact (summary)

- Storage: ~50 products + ≤ a few thousand rows of sessions/carts/orders before caps engage;
  negligible against 5 GB.
- Reads/writes per learner action: ≤ 5 D1 statements per request; list endpoints paginated;
  no N+1 (joins aliased in M1).
- No cron/queues/Workers in Phase 3; M7 hunt starts create a practice-session row only when the browser has no live one (otherwise the row is re-stamped).
- Pages builds unaffected (static bundle + Functions). No remote resources are created or
  migrated in this phase — everything is local until deployment is explicitly approved.

## 8. Deferred / explicitly not in Phase 3

- Phase 4 (API & identity lab depth: OpenAPI doc, Postman collection), Phase 5 (async
  services/jobs/webhooks), Phase 6 (SQL sandbox), Phase 7 (contracts), Phase 8 (automation
  examples), Phase 9 (performance/security tracks).
- Learner accounts with email, password reset flows, OAuth — synthetic auth only.
- Payments beyond fake outcomes; shipping integrations; tax engines.
- Bug-hunt reveal/scoring flows and leaderboards (need Phase 4 scenario runtime).
- Product imagery/CDN, reviews, wishlists, search indexing (plain SQL `LIKE` is fine at this
  catalogue size).
