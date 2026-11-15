# Phase 3 exit audit — Meridian Outfitters (commerce practice application)

> **Purpose:** the formal record that Phase 3 is implementation-complete and that its
> acceptance criteria were verified. Companion to `PROJECT_STATE.md` (progress log, §11) and
> `docs/phase-3-commerce-practice-plan.md` (design + milestone history). Written for the
> maintainer, not for learners. Internal defect details remain in `docs/bug-hunt-catalogue.md`.

- **Branch:** `feat/phase-3-commerce-practice`
- **Milestone covered:** P3-M9 — Hardening, reset & Phase 3 exit
- **Audit date:** 2026-11-15
- **Verdict:** **Phase 3 exit criteria are satisfied.** Deployment (Cloudflare resources) and
  merging to `main` were **not** performed and remain explicit user decisions. Phase 4 has
  not started.

## 1. Completed milestones and commits

| Milestone | Scope | Commit |
|---|---|---|
| P3-M1 | Commerce domain foundation (categories/products/inventory, seed, catalogue API) | `0841783` |
| P3-M2 | Storefront catalogue UI (`/shop`, `/shop/products/:slug`) | `942967c` |
| P3-M3 | Session-based shopping cart (`/cart`, `/api/v1/cart`) | `58f119d` |
| P3-M4 | Checkout & orders (`/checkout`, `/orders/:reference`, idempotent placement) | `9b00d71` |
| P3-M5 | Synthetic customers & auth simulation (`/login`, `/account/*`, `/api/v1/account/*`) | `fb68c78` |
| P3-M6 | Inventory depth (staff restock, `/admin/inventory`, exactly-once cancellation) | `db71597` |
| P3-M7 | Bug-hunt engine v1 (session modes, hunt registry, `/practice` hunt controls) | `59baeed` |
| P3-M8 | Defect set & scenario wiring (seven hunts, cap, catalogue wiring) | `7996c98` |
| P3-M9 | Hardening, reset & exit audit (this document) | `feat: harden phase 3 and complete exit audit` |

All commits are local to the branch; nothing has been pushed or merged. `main` is untouched.

## 2. Final database schema and migrations

Migrations `0001` … `0009` (never rewritten once applied). `app_meta.schema_version = 9`.

| Table | Purpose | Key constraints / delete behaviour |
|---|---|---|
| `app_meta` | platform metadata; `schema_version` | PK `key` |
| `categories` | 8 seeded categories | `slug UNIQUE`, lowercase CHECK |
| `products` | 42 seeded products (40 active, 2 legacy) | `slug UNIQUE`, `price_cents >= 0`, `active IN (0,1)`, FK `category_id` (RESTRICT — catalogue rows are deactivated, never deleted) |
| `inventory` | per-product stock (`CHECK quantity >= 0`) | PK `product_id`, FK `ON DELETE CASCADE` |
| `practice_sessions` | anonymous sessions; `token_hash` (SHA-256, unique), `expires_at` (7 days), `mode` (clean|bug_hunt), `hunt_id` | FK consumers `ON DELETE CASCADE` |
| `carts` | one per practice session | `session_id UNIQUE`, FK `ON DELETE CASCADE` |
| `cart_items` | lines per cart | unique `(cart_id, product_id)`, `quantity BETWEEN 1 AND 99` |
| `orders` | placed orders (append-only snapshot) | `reference UNIQUE` (opaque `ORD-<16 hex>`), `session_id` FK CASCADE, nullable `customer_id` FK SET NULL; `status` stores only `placed` |
| `order_items` | immutable item snapshots | FK `order_id` CASCADE; `product_id` nullable ON DELETE SET NULL (snapshots outlive catalogue edits) |
| `checkout_idempotency` | exactly-once placement record | PK `(session_id, idempotency_key)`, FK `session_id` CASCADE |
| `customers` | 5 synthetic fixtures (2 roles) | `email UNIQUE COLLATE NOCASE`; role/status CHECKs |
| `customer_sessions` | synthetic sign-in sessions (8 h) | `token_hash UNIQUE`, FK `customer_id` CASCADE, FK `practice_session_id` CASCADE (binding) |
| `inventory_adjustments` | append-only stock-movement audit | FKs `product_id` CASCADE, customer/session/order SET NULL; `quantity_delta > 0`; reasons `restock\|order_cancellation` |
| `order_cancellations` | exactly-once cancellation marker | PK `order_id` (idempotency), FK `order_id` CASCADE |
| `hunt_start_caps` | per-IP daily hunt-start cap | PK `ip_hash`, `day` UTC, `starts >= 0`; SHA-256 IP only |
| `rate_limit_buckets` (0009) | fixed-window rate-limit counters | PK `(key, window_start)`; `key` = `<scope>:<ipHash>`; `count >= 0` |

**Migration compatibility.** Fresh databases apply `0001`→`0009` cleanly (tested via the
node:sqlite harness against the real migration files, and via `wrangler d1 migrations apply
--local`). Existing Phase 3 databases upgrade additively: a test applies `0001`–`0008`,
plants a practice session/cart/order, then applies `0009` and verifies the schema row,
the new table, and data survival. `0009` adds only `CREATE TABLE IF NOT EXISTS` + an index
+ the `schema_version` bump — no rewrites, no backfills. `0005`/`0007` use `INSERT OR
IGNORE`/`ALTER TABLE … ADD COLUMN` to stay re-runnable on fresh builds; `wrangler` records
applied migrations itself, so `db:migrate:local` is idempotent in normal use.

**Query hygiene.** Every query is parameter-bound; the only interpolated values are
compile-time constants (`MAX_LIST_LIMIT`, `SORT_SQL` map). Indexes cover every session/cart/
order/customer/audit lookup; all list endpoints are capped (≤48 products/page, ≤50 orders,
bounded admin catalogue of 42 rows); no N+1 (joins alias in the catalogue and inventory
readers). `node:sqlite` batch is used for all multi-statement mutations and is
all-or-nothing, mirroring D1's `batch()` semantics (asserted in checkout/inventory tests).

## 3. Core API and frontend capabilities

**Endpoints (`/api/v1`):** catalogue (`products`, `products/:slug`, `categories`); cart
(`GET/DELETE /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id`); checkout
(`GET/POST /checkout`, `GET /orders`, `GET /orders/:reference`,
`POST /orders/:reference/cancel`); auth & account (`auth/accounts`, `auth/login`,
`auth/logout`, `auth/me`, `account`, `account/orders`, `account/orders/:reference`); staff
inventory (`GET/PATCH /admin/inventory*`); practice/bug-hunt (`GET /practice/session`,
`POST /practice/session/reset`, `GET/POST /practice/hunts*`); maintenance
(`POST /admin/maintenance/sweep`, staff-only); plus `GET /api/health`.

**Frontend routes:** `/`, `/tracks`, `/tracks/:trackId`, `/scenarios`, `/scenarios/:id`,
`/guides`, `/guides/:id`, `/progress`, `/practice`, `/about`, `/shop`,
`/shop/products/:slug`, `/cart`, `/checkout`, `/orders/:reference`, `/login`, `/account`,
`/account/orders`, `/account/orders/:reference`, `/admin/inventory`, and a 404 fallback.
Both themes, 375/768/1024/1440 widths, one `h1` per page, reduced-motion support. Demo
progress remains labelled as sample data; nothing in the UI pretends to persist.

## 4. Security and authorization controls

**Identity and cookies.** Two independent, HttpOnly, `SameSite=Strict`, Path=/ cookies:
`mpl_session` (anonymous practice session, 7 days, `Secure` on HTTPS) and `mpl_customer`
(synthetic sign-in, 8 hours). Only SHA-256 token hashes are stored. Customer tokens are
honoured only while their owning practice session is live **in the same browser** (binding
join on `practice_sessions`); a token replayed against another practice session resolves to
`none`. Sign-in rotates the customer token (any pre-existing session for that practice
session is destroyed), defeating session fixation. `SameSite=Strict` gives CSRF resistance
for state changes; no CORS headers are added anywhere (same-origin by construction).

**Passwords.** PBKDF2-HMAC-SHA256, 100,000 iterations; unknown emails verify against a fixed
dummy hash so response timing/payload does not enumerate accounts; the login envelope is
identical for unknown email and wrong password. The demo passwords are intentionally public
training fixtures (documented in README); they are not protectable secrets by design.

**Authorization policy.** 401 = unauthenticated/invalid/expired/cross-session cookie
(stale cookies cleared in the same response); 403 `account_suspended` = authenticated but
suspended (mid-session suspension enforced); 403 `staff_required` = active customer without
staff role; 404 `not_found` = unknown **or not owned** (existence concealed) — used for
foreign orders everywhere, including the hunt-wired AUTHZ-001 surface. Role and customer id
are read solely from the stored customer row; no client-supplied role/customer/session/owner/
defect-activation field is ever consulted. Staff guard: reusable `requireStaff`.

**Bug-hunt activation.** Defects are code (registry), never data; activation is re-resolved
per request from the caller's own session row; clean/expired/unknown-hunt/malformed-cookie
sessions resolve to clean; defect ids never appear in any response. A hunt id is format-
validated then matched against the compiled registry — unknown ids 404, forged bodies carry
no effect. Two learners on two browsers share nothing: carts, orders, sessions and caps are
all session/IP scoped.

**Input handling and output.** All inputs validated server-side (typed patterns, bounded
lengths, integer-only quantities, control-character rejection in notes/addresses). Response
bodies never include hashes, tokens, stack traces or SQL; `onError` logs server-side and
returns a generic envelope; `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` on
every API response; 32 KB request-body cap (`413`); order references are opaque.

**Ownership/IDOR checks** exist on every order read path and on cancel, and were hardened by
the P3-M9 audit (no defects found; tests assert guest/customer/staff/suspended/cross-session
boundaries). **Known limitations:** the synthetic identity model has no token revocation list
beyond row deletion; sealed cookies do not rotate outside login; the demo directory endpoint
(`/api/v1/auth/accounts`) intentionally discloses the training accounts; `/api/health`
discloses the schema version; rate limits (§8) are abuse controls, not security boundaries;
there is no Turnstile/CAPTCHA (deliberate — see §10); PBKDF2 is Web Crypto, so the
Workers runtime's own CPU caps apply.

## 5. Inventory and order accounting guarantees

No reservation model: available stock is `inventory.quantity`; cart lines never hold stock;
quantities are integers, `CHECK (quantity >= 0)`, unit counts only.

1. **Decrement exactly once, only at placement.** Order placement runs ONE all-or-nothing D1
   batch (order row, item snapshots, `quantity >= 0`-guarded decrements, cart clear,
   idempotency record). A violated CHECK aborts the batch → nothing commits. Tests cover the
   last-unit race: two concurrent approved checkouts → exactly one 201, one 422.
2. **Declined payments change nothing** (no order, no stock, no cart edit; the decline is
   recorded for replay).
3. **Idempotency.** `(session_id, idempotency_key)` PK + `request_hash` (details + outcome).
   Same key + same payload → verbatim replay (`Idempotent-Replay: true` + original 201/decline);
   same key + different payload → `409 idempotency_conflict`; retries never double-decrement.
4. **Cancellation is exactly-once.** `order_cancellations` PK aborts any duplicate/concurrent
   cancel batch; the handler replays the already-cancelled order with 200. Stock restore and
   audit rows commit in the same batch → partial cancels are impossible. Retries and
   cross-session/customer replays are covered by tests; public status is derived
   (`placed|cancelled`) — `orders.status` never rewrites the snapshot.
5. **Negative stock is structurally impossible** (CHECK), and every non-checkout movement
   (restock, cancellation restore) carries an `inventory_adjustments` audit row; a restock
   whose guarded `UPDATE … WHERE quantity + ? <= 1,000,000` matches nothing records **no**
   audit row (`422 stock_limit_exceeded`).
6. **Failed operations never partially mutate:** checkout and cancel both stage all effects in
   a single batch; the pre-batch read-check returns honest 422s instead of 5xx races.

## 6. Bug-hunt engine and the seven defects

Engine (code-compiled registries, per-request resolution, session-isolated, non-destructive
reset): `docs/bug-hunt-catalogue.md`. Seven hunts/defects, one deterministic site each, all
verified by integration tests running both branches:

`CATALOGUE-001` (search description facet) · `CATALOGUE-002` (category filter ignored) ·
`CART-001` (add-to-cart replacement) · `INVENTORY-001` (exact-stock checkout boundary) ·
`PRICING-001` (stored line totals ignore quantity) · `CHECKOUT-001` (blank name accepted) ·
`AUTHZ-001` (order-detail ownership predicate dropped).

Hunt starts are capped at 20/IP/UTC day with a SHA-256-hashed IP only, **exact atomic
across concurrency** (guarded `UPDATE` + upsert + retry bump; never overshoots — see §8 and
commit history for the rewrite from the M8 soft/racy check). Idempotent same-hunt re-starts
and resets are exempt. Bug-hunt state never leaks across sessions or into clean mode; reset
re-stamps `mode='clean', hunt_id=NULL` and always preserves cart, orders and sign-in. Defect
details are maintainer-only documentation and are not returned by any API.

## 7. Cleanup and retention policies

Expired rows are reclaimed by three complementary paths (all bounded, all idempotent, all
covered by `tests/server/hardening.test.ts`):

1. **Lazy inline deletion on contact** — an expired practice/customer session presented to
   the API is deleted in passing (existing behaviour, unchanged).
2. **On-write pruning** — each hunt-start cap write deletes day-old cap rows (≤100/call).
3. **Explicit maintenance sweep** — `POST /api/v1/admin/maintenance/sweep` (staff-only) or
   `npm run db:cleanup:local` (local throwaway D1, `--local` flag enforced by the npm
   script). Deletes, ≤100 rows per table per call: expired `practice_sessions` (cascades
   carts/cart_items/orders/order_items/checkout_idempotency/bound customer_sessions),
   expired `customer_sessions`, day-old `hunt_start_caps`, two-hour-old
   `rate_limit_buckets`. Second run is a no-op (asserted).

**Retention guarantees.** `inventory_adjustments` and `order_cancellations` are **never**
deleted by maintenance (append-only audit + idempotency markers). `order_cancellations`
cascade-deletes together with its order when that order's session expires as a unit;
`inventory_adjustments` survive with subject references nulled. **Active sessions and live
carts/orders are never deleted, regardless of age.** Customer fixtures and the catalogue are
never deleted. Synthetic learner state never outlives its 7-day session.

**Local demo reset.** `npm run db:reset:local` (`db/maintenance/reset-local.sql`, `--local`
only) deletes ALL local learner state and restores the seed inventory; explicitly
destructive, local-only, never invoked by application code, separate from the learner-facing
non-destructive Clean Mode reset.

**No cron.** Pages Functions cannot register a cron trigger; a Workers cron was not added
(out of phase scope, and the free-tier impact section forbids new services). The sweep is
explicit and operator-invoked (staff-only endpoint) or local via npm script. If/when a
Workers project exists, it should call the same `sweepExpiredData()` function unchanged.

## 8. Rate limits and known abuse-control limitations

| Control | Scope | Window | Overshoot behaviour |
|---|---|---|---|
| `mutate:<iphash>` | all mutating `/api/v1` requests | 120 / UTC minute | `429 rate_limited` + `Retry-After` |
| `login:<iphash>` | failed sign-ins only (reset on success) | 5 / UTC minute | `429 login_rate_limited`; PBKDF2 skipped |
| `checkout:<iphash>` | every placement attempt (incl. invalid) | 30 / UTC minute | `429 rate_limited` + `Retry-After` |
| `hunt_start_caps` | entering a hunt (not re-starts/resets) | 20 / IP / UTC day | `429 hunt_start_cap_reached` |

Storage is one row per `(key, window)` in `rate_limit_buckets` (plus `hunt_start_caps`);
counts read via a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` upsert — one D1 round
trip per consume. Buckets older than two hours are swept. Only SHA-256 IP hashes are stored.

**Limitations (read before relying on these):**

1. **Fixed windows, not sliding**: a burst at a window boundary can momentarily exceed the
   intended sustained rate (up to ~2× at the seam for one minute). For this training
   environment that is an accepted trade-off for a single-statement, free-tier limiter.
2. **Per-IP, not per-account**: NATed/shared egress IPs (school, CGN) share a bucket — a
   class of learners behind one address may hit limits together. Documented; no per-account
   budget exists by design (accounts are training fixtures with public passwords).
3. **Login overshoot under concurrency**: the 5-failure check is a read-before-write
   (`peek`) followed by an increment on failure; a tight concurrent burst can slip a few
   extra attempts past the check before the counter moves. The hunt cap, by contrast, is
   exact. Login limiting exists to stop casual online guessing, not dedicated grinding.
4. **Checkout counts failed attempts too** — deliberate (bounds malformed-traffic churn);
   a learner who fat-fingers 30 checkouts in a minute gets a one-minute cooldown.
5. **No distributed exactness beyond D1**: limits are consistent because they serialize on
   row keys in D1; they are not coordinated across hypothetical future isolates of a
   different runtime. In-memory limiting was rejected as weaker than D1.
6. **No Turnstile/CAPTCHA gate.** Anonymous endpoints remain IP-limited only. If the app is
   ever deployed publicly and abused, that is the next control to add (Phase 10 track), not
   a Phase 3 defect.
7. Limits are skipped entirely when no client IP is visible (local development) — `wrangler
   pages dev` does not set `cf-connecting-ip` reliably; tests and probes that exercise the
   limits set the header explicitly.

## 9. Tests, build and browser results

- `npm run check` — **passed**: ESLint clean; TypeScript clean in all three projects;
  **342/342 tests green** (329 at P3-M8 + 13 new hardening tests in
  `tests/server/hardening.test.ts`).
- `npm run build` — **passed**: type-checks then bundles; JS **477.54 kB** (gzip 139.01 kB),
  CSS **76.55 kB** (gzip 14.36 kB) — unchanged from P3-M8; no new runtime dependencies.
- **Migrations** — both paths tested:
  - Fresh database (`createMigratedD1()`): schema_version `9`, `rate_limit_buckets` usable.
  - Upgrade from the existing Phase 3 DB (`through: 8` → then `0009`): schema_version `9`,
    pre-existing session/cart/order rows intact. Local upgrade of the developer database via
    `wrangler d1 migrations apply --local` also succeeded (`0009` applied; `/api/health`
    reports `schemaVersion: "9"`).
- **Local scripts** — `db:migrate:local` (idempotent), `db:cleanup:local`, `db:reset:local`
  all executed against the throwaway local D1: schema intact at 9, inventory restored,
  learner state empty after reset.
- **Browser probe** (headless Chrome against the **production build** on port 8791):
  **25/25 checks pass** — guest flow (home → shop → search Kestrel Dry Bag → add → cart →
  checkout → reference → cancel → stock restored), bug-hunt start/reset banner flips, staff
  sign-in → inventory → staff sweep endpoint; API-level abuse controls (login 5×401 → 429 +
  `Retry-After`; 413 on a real 40 KB body; sweep requires staff); **zero unexpected console
  errors**. Both themes were previously verified across widths; this session re-verified the
  touched surfaces (none visually changed).
- **What was not run:** no load test or capacity exercise (rate limits are enforced, not
  stress-tested); no automated accessibility scanner — the a11y review was manual
  (semantics, focus, contrast tokens, reduced motion); no cross-browser matrix beyond Chrome;
  no remote/Pages deployment (deliberately — no Cloudflare resources were created).

## 10. Remaining known issues and risks

1. **Deployment is not done** — nothing has been deployed; no D1 exists remotely; smoke
   testing against Pages remains a manual step by the user (checklist in §11).
2. **Sweep requires an operator** — Pages has no cron; tables grow within their bounds until
   somebody runs the staff sweep (or a future Workers cron calls `sweepExpiredData()`).
3. **Rate-limit boundary behaviour** — see §8 (window seams, shared egress IPs, login
   concurrency). These are documented trade-offs, not defects.
4. **Hunt cap is per-IP** — classroom/NAT scenarios can throttle legitimate learners; the
   reset path and per-day window bound the damage.
5. **P3-M8 defects remain the full defect set** — no scoring/reveal flow (Phase 4+); 21
   catalogue scenarios remain non-runnable placeholders by design.
6. **Frontend bundle** is 477 kB (gzip 139 kB) — acceptable but unoptimized; no code
   splitting.
7. **Local D1 accumulates probe state** — the developer database is throwaway;
   `npm run db:reset:local` restores the seed.
8. **No telemetry/monitoring** beyond server-side `console.error` logging and `/api/health`;
   free-tier error visibility on Pages is log-based only.
9. **Single point of failure**: `src/server` assumes Cloudflare Pages Functions; Hono's
   Pages adapter is deprecated in Hono v5 (migration to Workers+assets revisited at upgrade
   time — see AGENTS.md "Known risk").
10. **`orders.status` only stores `placed`** — cancellation state lives in
    `order_cancellations` by design (D1 cannot alter a CHECK without a table rebuild).
11. **AUTHZ-001 hunt** intentionally exposes any order reference to the hunting learner — a
    deliberate practice defect; do not "fix" it outside the defect branch.
12. **Wipe semantics**: `npm run db:reset:local` deletes the audit history of the local
    database; it exists for the throwaway local database and must never be run remotely.

## 11. Cloudflare deployment configuration and manual setup required

**Current state: deliberately undeployed.** `wrangler.jsonc` contains a placeholder
`database_id` (`00000000-…`), Pages config (`pages_build_output_dir: "./dist"`), and a
compatibility date. No remote resource was created in this phase. Before the first deploy:

1. `npx wrangler d1 create qa-practice-lab-db` — then replace `database_id` in
   `wrangler.jsonc` with the real id (do **not** commit real credentials; ids are not
   secrets but keep them reviewed).
2. `npx wrangler d1 migrations apply qa-practice-lab-db --remote` — applies 0001–0009.
3. `npm run build` → `npx wrangler pages deploy dist` (or connect the repository to Pages
   for build-on-push). No `_redirects` catch-all may be added (SPA fallback is native;
   infinite-loop rejection documented in README).
4. **Post-deploy verification:** `/api/health` returns `schemaVersion: "9"`; place one
   approved practice order; reset via `/practice`; start + reset a hunt; run one staff
   sweep (`POST /api/v1/admin/maintenance/sweep` with a staff sign-in) and confirm
   `deleted` counts are 0 on an idle deployment.
5. **Maintenance cadence:** invoke the staff sweep on a routine cadence of the operator's
   choosing (e.g. a scheduled `curl` with staff credentials from a trusted host, or a
   future Workers cron) — there is no in-product scheduler on Pages.
6. Free-tier notes: request/build limits, D1 daily read/write ceilings and the 50-queries
   per-invocation limit are in PROJECT_STATE §7; the current workload fits comfortably.

## 12. Phase 3 exit criteria

Phase 3's roadmap row: **"UI scenarios can be completed and known defects are reproducible"** —
satisfied:

- Seven wired bug-hunt scenarios are runnable and reproducible from the UI
  (catalogue badge, launch panel, `/practice` hunt controls) and from the API.
- All seven defects, both branches each, are covered by integration tests
  (`tests/server/hunt-set.test.ts`, `tests/server/hunt.test.ts`) and the browser probe.
- Guest and signed-in workflows complete end-to-end: browse → cart → checkout → cancel →
  sign-in → order history → staff restock → sweep.
- Every P3-M9 acceptance item in §5 of the plan is closed: both migration paths green, all
  gates green (lint/typecheck/342 tests/build), bounded idempotent cleanup implemented and
  tested, rate limits implemented and tested, fresh-clone quick start verified locally
  (migrate → dev → health OK), exit audit produced.

**Outstanding (explicitly accepted, not blocking):** deployment + remote smoke (user
decision; §11), merge to `main` (user decision; the branch is the deliverable), the
auto-sweep operator action (§7/§11), and the §8 rate-limit trade-offs. No P3-M9 acceptance
criterion failed; nothing was waived silently. Phase 4 has **not** been started.
