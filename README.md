# QA Practice Lab

A safe, phased practice environment for software testing. The project is being built one
verifiable slice at a time; **Phases 1 and 2 are implemented, the Phase 2.5 UI redesign
(M1–M8) is complete and merged, and Phase 3 (commerce practice application) is in progress**.

Phase 1 proves the full local stack: a React + TypeScript shell, a Hono API running on Cloudflare
Pages Functions, and a Cloudflare D1 database checked through `GET /api/health`.

Phase 2 adds the learner-facing interface: a responsive app shell, twelve learning tracks, a
searchable scenario catalog, six full guides, progress and practice pages, and light/dark themes.
The redesign makes the interface a precise, consistent "test bench": self-hosted IBM Plex Sans and
JetBrains Mono, a tile of design tokens, honest status labels, and no demo data disguised as real.

Phase 3 builds **Meridian Outfitters**, an original fictional outdoor & home goods store used as
the single commerce practice domain. **P3-M1 through P3-M8 are implemented on the
`feat/phase-3-commerce-practice` branch:** a D1 catalogue schema with deterministic synthetic
seed data (`schema_version` 8), a `/api/v1` catalogue API with search, a working `/shop`
storefront, a session-based cart with server-calculated totals, a practice checkout that places
a simulated order in one atomic database transaction with idempotency protection, synthetic
customer sign-in, staff-only inventory management with exactly-once cancellation, and a
seven-hunt bug-hunt program wired into the scenario catalogue.

The storefront is the first real practice surface, and seven of its behaviours are now
reproducible defects for controlled bug-hunt practice (see
[Bug-hunt mode](#bug-hunt-mode-p3-m8)). Other catalog scenarios remain placeholders. There is
**no learner account persistence** yet (progress is not saved). No SQL playground, performance
runner, or security challenge exists yet.

## What you can do now

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: start path, curriculum overview, and catalogue highlights |
| `/tracks` | Browse the twelve testing disciplines |
| `/tracks/:trackId` | Objectives, getting-started steps, guide link, listed scenarios |
| `/scenarios` | Search and filter every scenario by track, difficulty, mode, status, category, and hunt availability |
| `/scenarios/:scenarioId` | Scenario objectives, prerequisites, related guides, availability; the seven wired hunt scenarios carry a live bug-hunt launch panel |
| `/guides` | Guides grouped by discipline |
| `/guides/:guideId` | Concepts, examples, steps, expected results, common mistakes, related exercises |
| `/progress` | No-persistence progress preview, clearly labelled as sample data |
| `/practice` | Live health check, bug-hunt mode controls (list/start/switch/reset the seven registered hunts, local bug-report export), planned practice formats and safety boundaries |
| `/shop` | Meridian Outfitters catalogue: search, filter, sort, paginate |
| `/shop/products/:slug` | Product detail with price, stock status and a link back to the catalogue |
| `/cart` | Session cart: quantities, removal, server-calculated totals, clear |
| `/checkout` | Practice checkout: synthetic details, simulated payment outcome, order placement |
| `/orders/:reference` | Order confirmation: reference, statuses, item snapshot, session-scoped; placed orders can be cancelled here |
| `/login` | Training sign-in: fictional demo accounts, accessible form, suspended-account case |
| `/account` | Synthetic customer profile (guest state, sign-out, protected resource) |
| `/account/orders` | Order history owned by the signed-in synthetic customer |
| `/account/orders/:reference` | Order details, readable only by the owning synthetic customer; placed orders can be cancelled here |
| `/admin/inventory` | Staff-only inventory view and restock tool (staff account only) |

Theme choice and sidebar collapse are remembered in `localStorage`. Progress is not tracked or
saved; the progress page shows labelled sample data and says so. The cart and orders are the real
pieces of server-side practice state: they persist in D1 under an opaque `mpl_session` cookie
(HttpOnly, `SameSite=Strict`, 7-day expiry) and are never shared between browser sessions.
Signing in adds a second, independent `mpl_customer` cookie (HttpOnly, `SameSite=Strict`,
8-hour expiry) bound to that same practice session — the two cookies are never interchangeable,
and a customer session is only honoured while its owning practice session is live.

Every page carries a slim **mode banner** showing whether the commerce app is in
**Clean mode** (default, intended behaviour) or **Bug-hunt mode** (a deliberately broken
state for testing practice). The bug-hunt controls live on `/practice` — see
[Bug-hunt mode](#bug-hunt-mode-p3-m8).

## Training-only synthetic sign-in

**These are fictional practice accounts for the QA training environment. They are not real
people, they are not credentials for any real service, and the passwords below are
intentionally public. Never reuse them anywhere.**

| Name | Email | Password (public, training-only) | Role | Status |
| --- | --- | --- | --- | --- |
| Amara Okafor | `amara.okafor@example.com` | `demo-amara-1001` | Customer | Active |
| Ben Whitmore | `ben.whitmore@example.net` | `demo-ben-1002` | Customer | Active |
| Priya Raman | `priya.raman@example.org` | `demo-priya-1003` | Customer | Active |
| Dana Reyes | `dana.reyes@example.com` | `demo-dana-1004` | Customer | **Suspended** (sign-in is refused with `403 account_suspended` — an intended practice case) |
| Rowan Ellison | `rowan.ellison@example.com` | `demo-rowan-9001` | Staff | Active |

The login page (`/login`) lists the same accounts (name, email, role, status — never any
credential material) and fills the email field for you. Passwords are PBKDF2-HMAC-SHA256
digests (100,000 iterations, fixed salts) seeded by `db/migrations/0005_customers.sql`; the API
never returns hashes or raw tokens in any response. Customer A/B isolation is the point of the
exercise: sign in as Amara in one browser and Ben in another — neither can read the other's
orders, and URL/id tampering is refused with a concealed `404 not_found`.

**Identity architecture (read this before testing authZ):**

- **Practice session** (`mpl_session`): anonymous, owns the cart and unassociated orders; the
  isolation boundary for exercises. Deleting the cookie starts a fresh anonymous session.
- **Customer identity** (`mpl_customer`): a fictional customer signed in to the training
  storefront. Only its SHA-256 hash is stored, in `customer_sessions`, bound to the practice
  session that established it. A customer signed in on practice session A is *not* signed in on
  practice session B.
- Signing in **rotates** the customer token (any pre-existing customer session for this practice
  session is destroyed at login), which defeats session fixation by construction.
- Orders placed while signed in are associated **explicitly and transactionally** with
  `orders.customer_id` at placement time. Orders placed as a guest, or before sign-in, keep
  `customer_id NULL` and are **never** silently adopted by a later login — they stay
  session-scoped exactly as before. Guest checkout is unchanged and remains available without an
  account.
- Rowan Ellison is the synthetic **staff** account: signing in with it additionally reveals the
  `Inventory` workspace entry (`/admin/inventory`) — a staff-only stock view and restock tool.
  Every other account sees honest "staff required" or sign-in states instead.

## Requirements

- Node.js **22.12 or newer** (Vitest 5 requires it; the current project was verified on Node 26)
- npm 10 or newer
- No Cloudflare account, API token, or remote resource is needed for local development

## Quick start

```sh
npm install
npm run db:migrate:local
npm run dev
```

Then open:

- **http://localhost:5173** — Vite dev server with HMR
- **http://localhost:8788** — Wrangler Pages dev server, serving the built app and `/api`

Vite proxies `/api` to the Wrangler server on port 8788. The health card on the home page turns
green only after the local D1 migration has been applied.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds the web app, then runs Vite and `wrangler pages dev` together |
| `npm run dev:web` | Runs only the Vite dev server on port 5173 (start the API separately) |
| `npm run dev:api` | Runs only Pages Functions + existing `dist/` on port 8788 |
| `npm run build` | Type-checks every project, then builds production assets into `dist/` |
| `npm run preview` | Builds, then serves the production output and Functions on port 8788 |
| `npm run typecheck` | Runs `tsc --noEmit` for app, tooling, and Functions/tests projects |
| `npm run lint` | Runs ESLint across the repository |
| `npm test` | Runs the Vitest suite once |
| `npm run test:watch` | Runs Vitest in watch mode |
| `npm run check` | Runs lint, typecheck, and tests in that order |
| `npm run db:migrate:local` | Applies unapplied D1 migrations to the local database |
| `npm run db:migrations:list` | Lists unapplied local D1 migrations |

Run a single test file directly with:

```sh
npx vitest run tests/server/health.test.ts
```

## Local architecture

```text
index.html                 Vite entry + pre-paint theme bootstrap
src/app/                   Router and route composition
src/components/layout/     App shell: top bar, sidebar, mobile navigation
src/components/ui/         Reusable badges, states, callouts, icons, theme provider
src/data/                  Typed tracks, categories, scenarios, guides, demo data
src/features/              Track, catalog, guide, health and shop components
src/lib/                   Catalog filtering, labels, navigation, theme hooks
src/pages/                 Route-level pages
src/styles/                Design tokens and layered CSS
src/server/app.ts          Hono app exported for tests (also under src/)
src/server/catalogue.ts    Meridian Outfitters /api/v1 catalogue routes
src/server/cart.ts         Session cart routes (/api/v1/cart) with server-side totals
src/server/checkout.ts     Checkout & orders routes (/api/v1/checkout, /api/v1/orders)
src/server/auth.ts         Synthetic customer auth & account routes (/api/v1/auth/*, /api/v1/account/*)
src/server/inventory.ts    Staff-only inventory routes (/api/v1/admin/inventory*, P3-M6)
src/server/staff.ts        Staff authorization guard (requireStaff; server-side role check)
src/server/customer.ts     Customer session helpers (PBKDF2 verify, hashed tokens, ownership guard)
src/server/session.ts      Anonymous practice-session helpers (SHA-256-hashed tokens)
src/shared/commerce.ts     Shared catalogue, cart and order contracts (types, currency constant)
functions/api/[[route]].ts Pages Functions catch-all; bridges /api to Hono
db/migrations/             D1 SQL migrations
tests/                     Vitest tests (Node environment)
wrangler.jsonc             Pages config + D1 binding + compatibility date
```

- The Hono app is exported from `src/server/app.ts` so it can be unit-tested without starting
  Wrangler. The Pages adapter in `functions/api/[[route]].ts` is the only Cloudflare-specific
  entrypoint.
- The D1 binding is named `DB` and is available as `c.env.DB` in Hono handlers.
- Local D1 data lives under `.wrangler/state/v3/d1/` and is git-ignored. Delete `.wrangler/` and
  re-run the migration to reset it.
- `wrangler.jsonc` uses `pages_build_output_dir: "./dist"` and a **placeholder** `database_id`.
  This is intentional: the project has not created or touched remote Cloudflare resources.

### Frontend and content

- Route definitions are in `src/app/App.tsx`; all pages render inside `src/components/layout/AppShell.tsx`.
- Learning content is typed and centralised in `src/data/`. Add or edit scenarios in
  `src/data/scenarios.ts`, guides in `src/data/guides.ts`, and tracks in `src/data/tracks.ts`;
  pages only read from those modules.
- Filtering and search live in `src/lib/catalog.ts` and are unit-tested independently of React.
  The storefront's URL-driven catalogue state (query, category, sort, page) lives in
  `src/lib/shop.ts` with the same conventions.
- Styling is plain CSS split across `src/styles/` and imported by `global.css`. There is no CSS
  framework. Files load in this order: tokens, base, layout, components, pages. Because all rules
  have similar specificity, a later file wins ties, so responsive overrides for layout primitives
  belong at the end of `pages.css`.
- Theme and sidebar preferences are stored under `qa-practice-lab-theme` and
  `qa-practice-lab-sidebar-collapsed`. The inline script in `index.html` applies the theme before
  first paint; keep it aligned with `src/lib/theme.ts`.
- Scenarios remain `runnable: false` and non-`ready` in Phase 2. Demo progress in
  `src/data/demo.ts` is sample data and is labelled as such wherever it appears.

### API

`GET /api/health` runs `SELECT value FROM app_meta WHERE key = 'schema_version'` against D1.

- `200` with `status: "ok"` when the migrated schema is readable
- `503` with `status: "degraded"` when D1 is unavailable or the migration has not been applied

The Meridian Outfitters catalogue API is mounted under `/api/v1`:

- `GET /api/v1/products` — paginated active products. Query params: `page` (≥1, default 1),
  `perPage` (1–48, default 12; larger values are capped, not rejected), `category` (category
  slug; unknown slugs match zero rows), `sort` (`newest` default | `name` | `price_asc` |
  `price_desc`), `q` (case-insensitive search over product name, description and category name;
  LIKE wildcards in the query are treated literally). Response:
  `{ data, page, perPage, total, totalPages }`.
- `GET /api/v1/products/:slug` — a single active product, or a `404` `{ error: "not_found" }`
  envelope.
- `GET /api/v1/categories` — all eight categories ordered by `sortOrder`.

Products carry `priceCents` (integer cents, formatted only at the edge), a `categorySlug`, a
`categoryName`, and a `stockStatus` derived from inventory (`in_stock` | `low_stock` |
`out_of_stock`). Responses are `Cache-Control: no-store` with `X-Content-Type-Options: nosniff`.
Unknown API routes return a JSON `404` envelope.

The session cart is also mounted under `/api/v1` and is scoped to the caller's `mpl_session`
cookie (minted on first add; a missing, malformed, unknown or expired cookie simply means an
empty cart — reads never mint a session, mutations mint one):

- `GET /api/v1/cart` — the current cart (empty if no session exists).
- `POST /api/v1/cart/items` — add a product. Body: `{ "slug": "…", "quantity": 1–99 }`
  (quantity optional, defaults to 1). Unknown/inactive products → `404` `not_found`;
  zero-stock products → `422` `out_of_stock`; exceeding inventory or the 99-per-line cap →
  `422` `insufficient_stock` (with `availableStock`/`maxQuantity` metadata).
- `PATCH /api/v1/cart/items/:id` — set a line's quantity (integer 1–99, within stock).
- `DELETE /api/v1/cart/items/:id` — remove a line; `404` if it is not in your cart.
- `DELETE /api/v1/cart` — remove every line (idempotent).

Every cart response is `{ items, itemCount, subtotalCents, totalCents, currency,
hasUnavailableItems }` and every figure is recomputed server-side from the current
`products`/`inventory` rows — the client sends only slugs and quantities, so stale or
tampered client prices can never affect totals. Lines whose product was deactivated or lack
sufficient stock stay in the cart flagged `available: false` (and `exceedsStock: true` where
relevant) and set `hasUnavailableItems: true`; quantities are capped at 99 per line and within
inventory. Monetary values are integer cents. Cross-session access to another cart's lines is
impossible: every cart query is scoped to the session resolved from the cookie, and line ids
from other sessions return `404`. Client-supplied price/total fields are ignored by construction.

Checkout and orders:

- `GET /api/v1/checkout` — the checkout summary for the caller's cart (same figures as the
  cart plus `checkoutable`, false when the cart is empty or a line cannot be fulfilled).
- `POST /api/v1/checkout` — place an order. Body: `{ customerName, customerEmail,
  shippingLine, shippingCity, shippingPostcode, paymentSimulation }`;
  `paymentSimulation` is `approved` or `declined` and nothing else. Every field is validated
  server-side (400 `invalid_request` with per-field messages otherwise). The client may pass an
  `Idempotency-Key` header (8–128 chars of letters, digits, `-`, `_`); one is generated when
  absent. Placement is atomic: the order row, immutable order-item snapshots, inventory
  decrements (guarded by `inventory.quantity >= 0`), cart clearing and the idempotency record
  all happen in ONE D1 batch — any failure rolls back everything, so there is never a partial
  order, never stock decremented without an order, and never a cart cleared after a failed
  checkout. The summary of what happened to a retried request: same key + same payload returns
  the original outcome verbatim (`201` + the original order, or the recorded decline) with an
  `Idempotent-Replay: true` header; same key + materially different payload returns
  `409` `idempotency_conflict`. `declined` is a deterministic simulated decline: no order is
  placed, stock and cart are untouched, and the attempt is recorded so a retry replays it.
  Out-of-stock/under-stocked/deactivated lines → `422` `cart_unavailable` (with per-line
  reasons; the cart is left intact); empty cart → `422` `empty_cart`.
- `GET /api/v1/orders` — the current session's order history (newest first, ≤50).
- `GET /api/v1/orders/:reference` — an immutable order confirmation scoped to the session that
  placed it; unknown or foreign references return the same `404` `not_found` envelope.
  References are opaque (`ORD-` + 16 uppercase hex chars); sequential database ids are never
  exposed. The items are snapshots taken at placement time — product name, slug, unit price
  (integer cents), quantity and line total are rewritten by no later catalogue change.

Synthetic customer authentication and the account area (P3-M5):

- `GET /api/v1/auth/accounts` — safe directory of the demo accounts (name, email, role, status).
  Never includes credentials or hashes.
- `POST /api/v1/auth/login` — sign in. Body: `{ "email": "…", "password": "…" }`. Unknown email and
  wrong password both answer an identical `401 invalid_credentials` envelope (the unknown-email
  path still performs a PBKDF2 verification against a dummy digest, so timing does not enumerate
  accounts). A suspended account answers `403 account_suspended`. Success answers `200` with the
  customer profile, sets the `mpl_customer` cookie (HttpOnly, `SameSite=Strict`, `Path=/`,
  Max-Age 28800) and destroys any pre-existing customer session for this practice session
  (token rotation). If the browser had no practice session, a fresh one is minted and returned in
  the same response. Responses never contain password hashes or token hashes.
- `POST /api/v1/auth/logout` — destroy the presented customer session and clear the cookie.
  Idempotent; `200 { ok: true }` in all cases.
- `GET /api/v1/auth/me` — the currently authenticated customer, or `401 unauthorized` (a stale or
  wrong-practice-session cookie is cleared in the same response). A customer suspended
  mid-session answers `403 account_suspended`.
- `GET /api/v1/account` — the same profile (name, email, role, status, synthetic address, member
  since). Protected.
- `GET /api/v1/account/orders` — the signed-in customer's own order history (newest first, ≤50).
  Scoped to `orders.customer_id`, any practice session. Guest orders are never included.
- `GET /api/v1/account/orders/:reference` — own order details. Unknown reference and another
  customer's reference answer the **identical** `404 not_found` envelope (existence concealed,
  consistent with the session-scoped confirmation endpoint). Out-of-format references answer
  `400 invalid_request`.

Inventory depth and order cancellation (P3-M6):

- `POST /api/v1/orders/:reference/cancel` — cancel a placed order. The practice session that
  placed the order, or (when signed in as an active account) the customer that owns it, may
  cancel; unknown, foreign and unauthorised references answer the identical `404 not_found`.
  Cancellation is exactly-once: the marker row in `order_cancellations` (primary key) aborts the
  cancelling batch on any retry, so stock is restored and the audit rows are written exactly
  once. The response is the order detail with `status: "cancelled"` and a `cancelledAt`
  timestamp; repeating the call answers `200` with the unchanged cancelled order. Items whose
  product was deleted cannot restock (their `product_id` is `NULL`).
- `GET /api/v1/admin/inventory` — staff-only view of every product with live quantity, low-stock
  threshold, stock status and active/discontinued flag. `401` for guests, `403 staff_required`
  for customer accounts.
- `PATCH /api/v1/admin/inventory/:productId` — staff-only restock. Body:
  `{ "quantity": <integer 1..10000>, "note?": <≤200 chars> }`. Adds units; never sets them
  absolutely. The write is atomic: a guarded `UPDATE … WHERE quantity + ? <= 1000000` plus an
  `INSERT INTO inventory_adjustments` guarded by `changes() = 1`, in one all-or-nothing D1 batch —
  an adjustment rejected by the 1,000,000-unit ceiling records nothing and answers
  `422 stock_limit_exceeded` (with `maxQuantity` and `currentQuantity`). Validation failures
  (zero, negative, fractional, non-numeric, `> 10000`, oversized or control-character notes)
  answer `400 invalid_request` with per-field messages. Success answers `200` with the
  authoritative `{ inventory, adjustment }` (adjustment id, delta, note, actor, timestamp) — the
  UI never shows new figures before this response arrives. Discontinued (inactive) products may
  be restocked; unknown ids answer `404`.

**Inventory accounting (read this before testing stock):**

- **There is no reservation model.** Available stock is `inventory.quantity`; a cart line never
  holds stock, and cart quantity caps (99 per line) are upper bounds, not allocations. The phase
  plan explicitly prefers guarded writes over a reservation framework; nothing reservable exists.
- Cart lines whose stock disappears while they sit in the cart stay in the cart flagged
  (`exceedsStock: true` / `available: false`) and block checkout with `422 cart_unavailable`
  until adjusted. Failed checkout never consumes the cart or stock.
- Inventory is decremented **only at order placement**, inside the all-or-nothing D1 batch, with
  the `inventory.quantity >= 0` CHECK as the backstop: losing a race for the last unit rolls the
  whole batch back and yields `422 cart_unavailable`. Placement also re-checks stock before the
  batch, so the learner always gets the honest 422 rather than a 5xx. Two concurrent checkouts
  for the last unit produce exactly one `201` and one `422` — verified by test.
- `declined` payments change nothing. Successful checkout decrements exactly once; retries
  replay the recorded outcome via the idempotency key without touching stock again.
- `placed → cancelled` is implemented as an append-only event table (`order_cancellations`)
  rather than by mutating `orders.status`; the public status is derived at read time. This keeps
  the order row immutable and makes cancel idempotent by primary key. `orders.status` in D1
  therefore only ever holds `placed`.
- Every non-checkout stock movement is recorded in `inventory_adjustments`: product, positive
  `quantity_delta`, `reason` (`restock` | `order_cancellation`), optional `note`, acting customer
  (`NULL` for guest-initiated cancellations), acting practice session, optional `order_id`, and
  `created_at`. Rows are never updated or deleted by the application.
- Stock status (`in_stock` / `low_stock` / `out_of_stock`) is derived live from
  `inventory.quantity` vs `low_stock_threshold` (SQL `CASE`) on every catalogue, cart, checkout,
  admin and order read — it can never be stale.
- Staff authorization is enforced server-side only: `401 unauthorized` (guest), `403
  account_suspended` (suspended, including mid-session), `403 staff_required` (active customer),
  else allowed. Role and customer id are never read from the client. A staff customer session
  replayed against a different practice session is rejected like any other.
- Quantity ceilings: 99 per cart line (existing), 10,000 per restock adjustment, 1,000,000 units
  absolute per product. All integer units; no floats anywhere.
- **Staff functionality** uses the same synthetic sign-in; Rowan Ellison
  (`rowan.ellison@example.com` / `demo-rowan-9001`) is the active staff fixture and can open
  `/admin/inventory`. Customer accounts see a clear staff-required state; guests see a sign-in
  call to action; neither can call the admin endpoints (server answers `401`/`403`).

**Authorization policy (consistent across the account area):** `401 unauthorized` = not
authenticated (or the cookie failed validation/binding); `403 account_suspended` = authenticated
but the synthetic account is suspended; `404 not_found` = the resource is unknown **or** not owned
by the caller (existence concealed). `403` is deliberately not used for cross-customer access, so
the 401/403/404 triple each has one unambiguous meaning.

Bug-hunt mode (P3-M8):

- `GET /api/v1/practice/hunts` — the learner-safe list of the registered hunts:
  `{ "data": [ { "id", "title", "summary", "scenarioId" } ] }`, in registry order. Read-only;
  no cookie required; never contains defect ids.
- `GET /api/v1/practice/session` — the current practice mode: `{ "mode": "clean", "hunt": null }`
  or `{ "mode": "bug_hunt", "hunt": { "id", "title", "summary", "scenarioId" } }`. Read-only;
  unknown browsers get clean mode and no cookie is minted by reads. Never contains defect ids.
- `POST /api/v1/practice/hunts/:huntId/start` — enter bug-hunt mode for a registered hunt.
  The hunt id must match the server-side registry; unknown ids answer `404 hunt_not_found`,
  malformed ids `400 invalid_request`. The request **takes no body** — there is nothing a client
  may tune. If the browser has a live session it is re-stamped in place (mode `bug_hunt`, hunt
  id) and keeps its cart, orders and customer binding; otherwise a fresh bug-hunt session is
  minted and returned via cookie. Starting the same hunt again is idempotent and does not count
  against the start cap. Hunt starts are **softly capped per IP per UTC day** (20 starts; only a
  SHA-256 hash of the IP is stored, one row per address, reset on the day boundary). Beyond the
  cap the endpoint answers `429 hunt_start_cap_reached` with `Retry-After`; resetting never
  counts against the cap, and local development without a visible client IP is not capped.
- `POST /api/v1/practice/session/reset` — return the session to clean mode. Non-destructive: the
  live session is re-stamped to `mode: "clean"`, `hunt_id: NULL`; the cart, orders and any
  synthetic sign-in are kept. With no live session, a fresh clean session is minted.

**The seven hunts (one defect each), wired to scenarios:**

| Scenario | Hunt | Area |
| --- | --- | --- |
| `api-catalogue-filters` | `hunt-catalogue-002` | catalogue category filtering |
| `api-checkout-exact-stock` | `hunt-inventory-001` | inventory boundary at checkout |
| `manual-address-edge-cases` | `hunt-checkout-001` | checkout validation |
| `manual-cart-add-quantity` | `hunt-cart-001` | cart quantity accumulation |
| `manual-cart-totals` | `hunt-pricing-001` | order line-total snapshot |
| `manual-shop-search` | `hunt-catalogue-001` | catalogue search coverage |
| `security-object-access` | `hunt-authz-001` | access control on order detail |

Wiring both directions: wired scenario pages carry a **Bug-hunt exercise** launch panel
(start/reset in place); `/practice` lists the hunts with start/switch/reset and a **local
bug-report export** (the report is generated in your browser as a markdown download — nothing
is uploaded, stored or graded); the scenario catalogue cards show a **Bug-hunt exercise** badge,
the status filter includes `Ready`, and `/scenarios?hunt=available` deep-links the seven wired
scenarios.

**Bug-hunt mode — learner-facing summary.** Starting a hunt puts *your browser session only*
into an intentionally broken state (the banner turns amber and names the hunt). One defect is
active; it is deterministic and reproducible. Nothing about the hunt is stored anywhere but your
own `practice_sessions` row, other browsers never share it, and `reset` always returns the shop
to clean behaviour. Work out what the defect is, gather evidence, file your local report, and
reset. Defect ids, expected/actual details and repro steps are deliberately **not** exposed to
the learner; they live in `docs/bug-hunt-catalogue.md` for maintainers.

**Engine guarantees:** Clean mode never reaches a defect branch. Activation is re-resolved
per request from the caller's own session row — there is no global flag, cache or shared
"defects on" switch, and no endpoint accepts a defect id. Expired or unknown-hunt sessions
behave as clean. Bug-hunt state cannot affect another learner's session.

**Guest checkout remains fully supported.** Sign-in is never required for the existing catalogue,
cart or checkout flows. Orders placed before sign-in stay attached to the practice session; after
sign-in they remain readable through `GET /api/v1/orders` and `/orders/:reference` only, not
through the account area.

**Simulated payment behaviour (read this before relying on it):** `paymentSimulation` chooses
a deterministic outcome from the fictional practice gateway. `approved` places the practice
order; `declined` places nothing and changes nothing. There is no payment processor, card
collection, merchant account, shipping carrier or email service anywhere in this project; no
money moves; every "delivery" is synthetic. The only personal-ish data stored is the synthetic
name/email/address typed into the checkout form, visible only to the session that typed it
(7-day session expiry; cascade deletes the orders with the session).

### SPA routing

Cloudflare Pages serves the app as a single-page application automatically **as long as the build
output has no top-level `404.html`**. Do not add a `_redirects` catch-all such as
`/* /index.html 200`: current Wrangler/Pages rejects it as an infinite loop, and the native
fallback already serves deep links. If a `404.html` is ever added, SPA deep links will break and a
different routing strategy will be required.

## Database migrations

Create a migration file in `db/migrations/` using Wrangler's ordering convention, then apply it
locally:

```sh
npx wrangler d1 migrations create qa-practice-lab-db <migration_name>
npm run db:migrate:local
```

Migrations run against the local SQLite-backed D1 database only. Do not pass `--remote` in this
phase, and do not expose the platform D1 binding as a user-facing SQL console.

## Deployment status

Deployment is deliberately **not configured**. Before a remote deployment:

1. Create the real D1 database with `npx wrangler d1 create qa-practice-lab-db`.
2. Replace the placeholder `database_id` in `wrangler.jsonc`.
3. Apply migrations remotely (`wrangler d1 migrations apply ... --remote`).
4. Configure the Pages project and deploy with `npx wrangler pages deploy dist`.

Keep usage within the free-tier ceilings recorded in `PROJECT_STATE.md` (Workers/Pages request and
build limits, D1 daily reads/writes and per-invocation query limits).

## Known constraints

- Most catalog scenarios are placeholders. The seven wired hunt scenarios are runnable
  bug-hunt exercises (see above); there is no scoring and no saved progress; the progress page
  shows labelled sample data and says so.
- The storefront catalogue, cart, checkout and the synthetic customer account area are real and
  backed by the API and D1. Sign-in is a **training simulation**: the synthetic accounts, the
  PBKDF2 password digests and the session tokens are fixtures; there is no registration, password
  reset, MFA, email verification, role-based access beyond `customer|staff`, or external identity
  provider. The checkout's payment outcome is a simulation and nothing is really paid for or
  shipped. Deleting cookies or letting the 7-day session expire starts with a fresh empty cart and
  no order history (orders cascade with the session); customer sessions expire after 8 hours;
  sessions are not swept automatically until P3-M9. Unavailable lines stay in the cart flagged as
  such and block checkout with a `422` envelope until adjusted.
- There is **no reservation system**. Inventory is decremented only at order placement and
  restored only on cancellation, both exactly-once; a staff restock is the only adjustment path.
  `inventory_adjustments` is append-only; nothing prunes it, and there is no removal adjustment
  yet. Cancelling an order whose product was deleted returns nothing to stock (the snapshot
  outlives the catalogue).
- Bug-hunt mode ships **seven hunts** (one deterministic defect each, listed above). Reset
  preserves the cart, orders and sign-in (it re-stamps the session; it does not cascade-delete
  anything), and there is no reveal/scoring flow yet — intended behaviour during an active hunt
  is intentionally not documented to the learner until the reveal flow lands (Phase 4+). Hunt
  starts are softly capped per IP per UTC day (20; only a hash of the IP is stored); all other
  endpoints are not rate-limited yet (P3-M9). The mint/adopt semantics, migration 0008 and the
  rejection envelope are documented in `docs/phase-3-commerce-practice-plan.md` and
  `docs/bug-hunt-catalogue.md`.
- Six of the twelve learning tracks do not yet have a dedicated guide; they link to the closest
  guide or mark one as scheduled.
- The project intentionally uses **Cloudflare Pages Functions**. Current Cloudflare guidance
  recommends Workers with static assets for new projects, and Hono marks its
  `hono/cloudflare-pages` adapter deprecated for Hono v5. This is a deliberate project choice;
  revisit before upgrading Hono or if Pages limitations block later phases.
- `npm audit` reports moderate, development-only advisories from the ESLint/TypeScript tooling
  chain. Production dependencies are limited to React, React DOM, React Router, and Hono;
  `npm audit --omit=dev` reports zero vulnerabilities.
- If npm 11 blocks install scripts, approve the known build tools with
  `npm install-scripts approve esbuild workerd`.

## Troubleshooting

- **Health card says the database check failed:** run `npm run db:migrate:local`, then restart
  `npm run dev`.
- **Port already in use:** Vite is fixed to 5173 (`strictPort`) and Wrangler to 8788. Stop the
  other process instead of changing only one side, or the Vite proxy will point at the wrong API.
- **API works on 8788 but not through Vite:** confirm the `dev` script started both processes and
  that `vite.config.ts` still proxies `/api` to `http://127.0.0.1:8788`.
