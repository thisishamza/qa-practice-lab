# QA Practice Lab

> **Production:** https://qa-practice-lab.pages.dev (Phase 5 deployed 2026-11-16; Cloudflare Pages project `qa-practice-lab`, D1 `qa-practice-lab-db`, `schema_version` 11). Previously Phase 4 (PR #5). Deployment `aaa0e2a6`, source commit `3ecfb41` (merge of PR #8).

A safe, phased practice environment for software testing. The project is being built one
verifiable slice at a time; **Phases 1 and 2 are implemented, the Phase 2.5 UI redesign
(M1–M8) is complete and merged, and Phase 3 (commerce practice application) is implemented,
verified, merged to `main` (PR #4) and deployed to production**.

Phase 1 proves the full local stack: a React + TypeScript shell, a Hono API running on Cloudflare
Pages Functions, and a Cloudflare D1 database checked through `GET /api/health`.

Phase 2 adds the learner-facing interface: a responsive app shell, twelve learning tracks, a
searchable scenario catalog, six full guides, progress and practice pages, and light/dark themes.
The redesign makes the interface a precise, consistent "test bench": self-hosted IBM Plex Sans and
JetBrains Mono, a tile of design tokens, honest status labels, and no demo data disguised as real.

Phase 3 builds **Meridian Outfitters**, an original fictional outdoor & home goods store used as
the single commerce practice domain. **P3-M1 through P3-M9 are implemented and merged to `main`;
the app is deployed at https://qa-practice-lab.pages.dev:** a D1 catalogue schema with deterministic synthetic
seed data (`schema_version` 10), a `/api/v1` catalogue API with search, a working `/shop`
storefront, a session-based cart with server-calculated totals, a practice checkout that places
a simulated order in one atomic database transaction with idempotency protection, synthetic
customer sign-in, staff-only inventory management with exactly-once cancellation, a
ten-hunt bug-hunt program wired into the scenario catalogue, and the hardening & exit
milestone (rate limits, bounded cleanup sweeps, a local demo-data reset, and the Phase 3
exit audit in `docs/phase-3-exit-audit.md`).

The storefront is the first real practice surface, and ten of its behaviours are now
reproducible defects for controlled bug-hunt practice (see
[Bug-hunt mode](#bug-hunt-mode-p3-m8)). Other catalog scenarios remain placeholders. Progress is
tracked server-side only for the practice session (or, when signed in, for the synthetic training
account) — there is **no permanent learner account persistence**: guest progress expires with the
practice session and never transfers to an account. No SQL playground, performance
runner, or security challenge exists yet. Phase 4 (Learning & Bug-Hunt Intelligence — progressive
hints, structured bug reports with deterministic evaluation, and real progress tracking) is merged
to `main` (PR #5) and deployed to production; the Phase 4 scope includes:
P4-M1 WP1 (learner-safe curriculum metadata on the bug-hunt scenarios),
P4-M1 WP2 (migration `0010_hunt_attempts.sql` — `schema_version` → 10 — plus server-side hunt-attempt
and structured bug-report persistence with a scoped 30/minute report rate limit),
P4-M1 WP3 (the deterministic §6.4 bug-report evaluator — synchronous rule-based scoring,
a stored feedback checklist, `best_quality_score` running max and sticky `discovered`,
no AI),
P4-M2 WP1 (the three-level progressive-hint ladder and the gated solution
reveal as server-side API endpoints — unlocked only by a submitted report or an explicit
confirmed give-up),
P4-M2 WP2 (the structured bug-report UI — labelled form, inline
validation with a linked error summary, server-side submission, an evaluation result view
and a downloadable markdown report — rendered on the wired hunt panels),
P4-M2 WP3
(the hint ladder UI (sequential three-level disclosures), the "Show the solution" give-up
WAI-modal confirm dialog, the gated reveal panel (expected/actual/root cause/reproduction/
verification/concepts) and attempt-status chips on the hunt cards — cancel makes no
request; the report path unlocks the reveal in-place after submission),
P4-M3 WP1 (the progress
API and the real `/progress` dashboard — owner-scoped aggregate, guest-session durability or
signed-in customer attribution),
P4-M3 WP2 (scoring transparency at `/about#evaluation` + the recommended
completion path on `/practice` with live completion state) and
P4-M3 WP3 (the Phase 4 exit audit).
See [docs/phase-4-exit-audit.md](docs/phase-4-exit-audit.md) for the audit verdict and the
release addendum (independent review fixes + route-level code splitting that shipped with
the release: initial JS 538.57 → 370.33 kB, gzip 156.15 → 114.62 kB).

Phase 5 (API & Identity Testing Lab) turns the existing `/api/v1` surface into a guided
practice target. P5-M1 (merged to `main` via PR #6 on 2026-11-16) added the
hand-authored OpenAPI 3.1 contract (`public/openapi.json`, served at `GET /openapi.json`,
cross-checked by `tests/data/openapi.test.ts`), the learner-facing **API Reference** page
(`/api-reference`) and the same-origin-only **API Lab** console (`/api-lab`), wired
`api-catalog-pagination` to `ready`, and added console-based walkthrough content. P5-M2
(merged to `main` via PR #7 on 2026-11-16) added **synthetic
practice API tokens** (opaque 256-bit Bearer credentials, SHA-256-hashed at rest, 15–900 s
TTL clamped server-side, minted by `POST /api/v1/auth/token`, shown once, revocable),
**Bearer authentication** accepted everywhere the `mpl_customer` cookie is accepted (when a
Bearer header is present it wins; roles always come from the stored customer row), an
**in-console token helper** (signed-in only; the raw token lives in component memory and is
never persisted), and **three more deterministic hunts** — `hunt-authn-001`,
`hunt-rbac-001` and `hunt-mass-001` — wired through the same server-controlled engine. P5-M3
(hardening and the Phase 5 exit audit, PR #8) found and fixed three stale Bearer references
(contract summary, reference-page copy, README header) and re-verified the whole phase:
837/837 tests, clean build, both migration paths through v11, clean leak scans and 67/67
browser checks (Chrome only). The release was executed on 2026-11-16: PR #8 merged (`3ecfb41`),
migration `0011_api_tokens.sql` applied to the production D1 (`schema_version` 10 → 11, backup
exported first), the merged `main` deployed to Cloudflare Pages (deployment `aaa0e2a6`), and the
production acceptance passed. See
[docs/phase-5-exit-audit.md](docs/phase-5-exit-audit.md) for the audit verdict and the
release addendum, and
[docs/phase-5-api-identity-plan.md](docs/phase-5-api-identity-plan.md) for the plan.

## What you can do now

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: start path, curriculum overview, and catalogue highlights |
| `/tracks` | Browse the twelve testing disciplines |
| `/tracks/:trackId` | Objectives, getting-started steps, guide link, listed scenarios |
| `/scenarios` | Search and filter every scenario by track, difficulty, mode, status, category, and hunt availability |
| `/scenarios/:scenarioId` | Scenario objectives, prerequisites, related guides, availability; the ten wired hunt scenarios carry a live bug-hunt launch panel (and the structured report form while the hunt is active) |
| `/guides` | Guides grouped by discipline |
| `/guides/:guideId` | Concepts, examples, steps, expected results, common mistakes, related exercises |
| `/progress` | Real progress dashboard: per-hunt status, attempts/reports, discovery (finding-check only), best/average score, recent submissions, guest vs signed-in durability note |
| `/practice` | Live health check, bug-hunt mode controls (list/start/switch/reset the ten registered hunts), the ordered recommended path through the wired hunts with curriculum outcome lines and live completion state (a report counts as a completion; discovery shown separately), structured bug reporting with deterministic evaluation for the active hunt, planned practice formats and safety boundaries |
| `/about` | What works today, what comes next, honest guest/signed-in progress durability, the published report-evaluation rubric (weights, verdict bands, discovery vs report quality) at `/about#evaluation`, synthetic-environment limits |
| `/api-reference` | The machine-checkable description of every `/api/v1` route: methods, paths, parameters, request/response bodies, error envelopes and codes, rate-limit notes, and the documented bearer/cookie security schemes. Download `openapi.json` from the page; every operation deep-links into the API Lab |
| `/api-lab` | Same-origin-only in-browser API console (method, path, query, headers, body) with status, timing, headers and byte-capped inert-text body; copy-as-curl; component-state-only history (cleared on refresh); deep-linkable from the reference and wired scenario pages; includes a signed-in-only **practice API token helper** |
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

Theme choice and sidebar collapse are remembered in `localStorage`. Progress is tracked server-side
under an opaque `mpl_session` cookie (HttpOnly, `SameSite=Strict`, 7-day expiry): the `/progress`
page shows the caller's real attempts, reports, scores and discoveries — guest progress expires
with the session and never transfers to an account. The cart and orders are the real
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
- **Practice API token** (`Authorization: Bearer …`): an optional, synthetic opaque 256-bit
  credential minted by `POST /api/v1/auth/token` for the same demo accounts (only its SHA-256
  hash is stored, in `api_tokens`; the raw token is returned exactly once, in the 201 mint
  response). Tokens are **not** bound to a practice session — an API credential must outlive the
  tab that minted it — they are bound to the customer row, expire after 15–900 seconds (clamped
  server-side), are revoked server-side by sign-out, and carry no claims: role and status are
  read from the stored customer row on every request. When a Bearer header is present it wins;
  when absent, the cookie pair is used exactly as before. Expired tokens answer `401 token_expired`.
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
| `npm run db:cleanup:local` | Deletes expired local session/rate-limit/token rows (bounded, idempotent) |
| `npm run db:reset:local` | **Destructive (local only):** wipes all local learner state and restores the seed inventory |

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
src/server/app.ts          Hono app exported for tests (also under src/); body-size guard,
                           global mutation rate limit, Cache-Control/nosniff headers
src/server/catalogue.ts    Meridian Outfitters /api/v1 catalogue routes
src/server/cart.ts         Session cart routes (/api/v1/cart) with server-side totals
src/server/checkout.ts     Checkout & orders routes (/api/v1/checkout, /api/v1/orders)
src/server/auth.ts         Synthetic customer auth & account routes (/api/v1/auth/*, /api/v1/account/*)
src/server/apiTokens.ts    Synthetic practice API tokens (P5-M2): mint (SHA-256 at rest), expiry, revocation, sweep support
src/components/api-lab/TokenHelper.tsx  P5-M2 in-console practice API token helper (memory-only token)
src/server/inventory.ts    Staff-only inventory routes (/api/v1/admin/inventory*, P3-M6)
src/server/staff.ts        Staff authorization guard (requireStaff; server-side role check)
src/server/customer.ts     Customer session helpers (PBKDF2 verify, hashed tokens, ownership guard)
src/server/session.ts      Anonymous practice-session helpers (SHA-256-hashed tokens)
src/server/practice.ts     Practice-mode routes (/api/v1/practice/*) + the 20/IP/UTC-day hunt-start cap
src/server/attempts.ts     Phase 4 attempt lifecycle + GET /practice/attempts (bounded history)
src/server/reports.ts      Phase 4 structured bug-report validation + POST .../report
src/server/reportQuality.ts  Phase 4 deterministic §6.4 report evaluator (pure; server-only)
src/lib/reportForm.ts      Phase 4 bug-report form logic (validation, submission flow, markdown download)
src/lib/hintReveal.ts      Phase 4 hint-ladder/give-up/reveal flow logic (pure; injected transports)
src/lib/attemptStatus.ts   Phase 4 attempt-status chip mapping (pure)
src/lib/recommendedPath.ts  Phase 4 recommended-path derivation + completion mapping (pure)
src/shared/evaluationRubric.ts  Phase 4 canonical learner-safe §6.4 rubric (shared by the server evaluator and the UI)
src/features/progress/useProgress.ts  Phase 4 shared progress fetch state (route-remount refetch, retry)
src/features/practice/RecommendedPath.tsx  Phase 4 /practice ordered path with live completion state
src/features/evaluation/EvaluationTransparency.tsx  Phase 4 learner-facing rubric explainer (/about#evaluation)
src/components/ui/Modal.tsx        Phase 4 WAI-modal dialog primitive (focus trap, Escape, restore)
src/features/practice/BugReportForm.tsx        Phase 4 structured report form (WP2)
src/features/practice/ReportEvaluationView.tsx Phase 4 evaluation result view (WP2)
src/features/practice/ReportErrorSummary.tsx   Phase 4 linked error summary (WP2)
src/features/practice/HintLadder.tsx           Phase 4 progressive hint ladder UI (WP3)
src/features/practice/RevealPanel.tsx          Phase 4 gated reveal panel + give-up dialog (WP3)
src/features/practice/AttemptStatusChip.tsx    Phase 4 hunt-card attempt status chips (WP3)
src/server/rateLimit.ts    Fixed-window rate limiter (login failures, checkout, global mutation cap)
src/server/maintenance.ts  Bounded cleanup sweep + staff-only POST /api/v1/admin/maintenance/sweep
src/server/hunts.ts        Hunt registry (code); src/server/defects.ts — defect registry + isDefectActive
src/shared/commerce.ts     Shared catalogue, cart and order contracts (types, currency constant)
src/shared/learning.ts     Shared Phase 4 attempt/report contracts (learner-safe)
functions/api/[[route]].ts Pages Functions catch-all; bridges /api to Hono
db/migrations/             D1 SQL migrations (0001..0011; production D1 is on 0001..0011)
db/maintenance/            Local-only housekeeping SQL (cleanup.sql, reset-local.sql)
tests/                     Vitest tests (Node environment)
wrangler.jsonc             Pages config + D1 binding + compatibility date
```

- The Hono app is exported from `src/server/app.ts` so it can be unit-tested without starting
  Wrangler. The Pages adapter in `functions/api/[[route]].ts` is the only Cloudflare-specific
  entrypoint.
- The D1 binding is named `DB` and is available as `c.env.DB` in Hono handlers.
- Local D1 data lives under `.wrangler/state/v3/d1/` and is git-ignored. Delete `.wrangler/` and
  re-run the migration to reset it.
- `wrangler.jsonc` uses `pages_build_output_dir: "./dist"` and the production `database_id`
  for `qa-practice-lab-db` (created 2026-11-16; ids are not secrets). Local development is
  unaffected: `wrangler pages dev` still uses the local D1 under `.wrangler/state/`.

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
- `POST /api/v1/auth/token` — mint a synthetic practice API token. Body:
  `{ "email": "…", "password": "…", "expiresInSeconds"?: 15–900 }` — `expiresInSeconds` is clamped
  server-side to **15–900 seconds** (default `900`). The mint re-authenticates exactly like
  `POST /api/v1/auth/login`: same PBKDF2 verify, same dummy-hash timing equalization, and the
  **same shared `login:<iphash>` failure budget** (five failed attempts per IP per UTC minute →
  `429 login_rate_limited`, shared counter; a successful mint clears it; a suspended account
  answers `403 account_suspended`). Success answers **`201`** with
  `{ "token", "tokenType": "Bearer", "expiresIn", "expiresAt" }` — the raw token appears in this
  response **exactly once**; only its SHA-256 hash is stored (`api_tokens`), never logged, never
  returned again. There is no refresh and no renewal: mint a new token instead.
- **Bearer authentication.** Every protected endpoint (`/api/v1/auth/me`,
  `/api/v1/account*`, `/api/v1/admin/*`) accepts `Authorization: Bearer <token>` in addition to
  the `mpl_customer` cookie — identical success payloads and identical error envelopes. When a
  Bearer header is present it wins; when it is absent, the cookie pair is used exactly as
  documented. An expired token answers `401 token_expired`; an unknown, revoked, malformed or
  orphaned Bearer answers `401 unauthorized` (the cookie is never used as a fallback in either
  case). A suspended account answers `403 account_suspended` and a customer-role account answers
  `403 staff_required` on staff surfaces, exactly as with a cookie. Roles are read from the
  stored customer row on every request; the token carries no claims and can never elevate them.
- `POST /api/v1/auth/logout` — destroy the presented customer session and clear the cookie.
  **Clean mode also revokes every practice API token bound to the account** (customer-scoped,
  deliberately broad and documented — signing out anywhere signs out everywhere). Idempotent;
  `200 { ok: true }` in all cases.
- `GET /api/v1/auth/me` — the currently authenticated customer, or `401 unauthorized` (a stale or
  wrong-practice-session cookie is cleared in the same response; an expired Bearer token answers
  `401 token_expired`). A customer suspended mid-session answers `403 account_suspended`.
  Authenticate with the `mpl_customer` cookie or `Authorization: Bearer <token>`.
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
  against the start cap. Hunt starts are **capped per IP per UTC day** (20 starts; only a
  SHA-256 hash of the IP is stored, one row per address, reset on the day boundary; the cap is
  enforced by atomic guarded increments and cannot overshoot). Beyond the cap the endpoint
  answers `429 hunt_start_cap_reached` with `Retry-After`; resetting never counts against the
  cap, and local development without a visible client IP is not capped.
- `POST /api/v1/practice/session/reset` — return the session to clean mode. Non-destructive: the
  live session is re-stamped to `mode: "clean"`, `hunt_id: NULL`; the cart, orders and any
  synthetic sign-in are kept. With no live session, a fresh clean session is minted.

Phase 4 practice learning (P4-M1 WP2 + WP3; rendered by the P4-M2 WP2 UI on the hunt panels):

- `POST /api/v1/practice/hunts/:huntId/report` — submit a structured bug report. Body:
  `{ title, environment, preconditions?, steps, expected, actual, severity, priority,
  reproducibility? }` — `severity` ∈ `critical|high|medium|low`, `priority` ∈ `p1|p2|p3|p4`
  (independent axes; never derived from each other), `reproducibility` ∈
  `always|sometimes|once` (default `always`). All enums are matched case-insensitively and stored
  lowercase. Validation: required fields, per-field length caps (title/environment 200,
  preconditions 1000, steps 4000, expected/actual 2000), control-character rejection (newlines and
  tabs are permitted inside the multi-line `steps`/`expected`/`actual`/`preconditions` only),
  per-field `400` messages. The hunt id must match the registry (`404 hunt_not_found`;
  `400` when malformed). Reports require a live practice session (`401 session_required`
  otherwise) — hunt start mints one and opens the attempt; submission stamps
  `customer_id` when signed in, otherwise the report stays guest-scoped. The attempt the report
  attaches to is resolved server-side (the live `in_progress` attempt, else the latest attempt,
  else a fresh one) and ids are never accepted from the client. Submissions are **rate limited to
  30 per IP per minute** (`report:<iphash>`, only a SHA-256 hash of the IP is stored) with
  `429 rate_limited` + `Retry-After` on overflow. `201` answers
  `{ attempt, report, evaluation }` — learner-safe: no attempt/report ids, no defect ids, no
  finding-check terms. The report is evaluated synchronously by the deterministic §6.4 rule-based
  rubric (title 10 · environment 10 · steps 15 · step quality 10 · expected 8 · actual 8 ·
  expected-vs-actual distinct 7 · severity 5 · priority 5 · finding 22; verdict bands
  ≥80 `solid` · 50–79 `needs-work` · <50 `incomplete` — no AI, no network, no randomness).
  `report.qualityScore`, `report.feedback` (per-check `{ id, passed, message }` results),
  `evaluation.checks`, `attempt.bestQualityScore` (running maximum across submissions) and
  `attempt.discovered` (sticky once earned) all reflect this evaluation; client-supplied score,
  feedback or discovery fields are ignored.
- `GET /api/v1/practice/hunts/:huntId/attempt` — the caller's current attempt for one registered
  hunt: `{ status, hintsUsed, bestQualityScore, discovered, submittedAt }` where `status` is
  `none|in_progress|submitted|revealed` (`none` when the caller has no attempt — the endpoint is
  404-free), `hintsUsed` is 0–3. Forged hunt ids answer `404 hunt_not_found`.
- `GET /api/v1/practice/attempts` — bounded history (newest first, ≤50) across hunts for this
  session, plus customer-bound attempts when signed in. No internal ids. Empty `{ data: [] }`
  without a session.
- `GET /api/v1/practice/progress` — the learner's progress aggregate: per-wired-hunt entries
  (status, discovery, best score, hints used, attempts, last submission), the 10 newest
  submissions (score + verdict from the §6.4 bands), totals (attempts, status buckets,
  submissions, distinct discovered hunts, hints used, best and average best score over scored
  attempts) and a `persistence` marker (`session` | `customer`). No attempt/report/customer
  ids, no evaluator internals, no defect ids. Discovery requires a non-revealed attempt with
  the persisted finding-check result; a reveal never awards discovery and hints never lower a
  score. Averages render only over scored attempts.
- Hunt starts now also ensure exactly one live (`in_progress`) attempt per (session, hunt) —
  idempotent under retries and concurrency (a partial unique index enforces it in D1). Attempts
  cascade-delete with their practice session (orders precedent): guest progress is exactly as
  durable as the session's 7-day TTL. The `/progress` page shows this same persisted state.

  **P4-M2 WP2 (rendered).** The wired hunt panels (`/practice` and the scenario launch panel)
  carry a **structured report form** while a hunt is active: labelled fields (title, environment,
  optional preconditions, steps, expected, actual, severity — impact-based — and an independent
  priority, plus reproducibility), persistent required/optional markers, inline validation on blur,
  a linked error summary that takes focus on a failed submit (each entry names its field and moves
  focus to the control), duplicate-submission protection, and server per-field errors rendered
  beside their fields. The submitted report is evaluated synchronously and the result view shows
  the server's score (out of 100), the verdict band (≥80 solid · 50–79 needs work · below 50
  incomplete), per-check pass/improve feedback and an explicit
  **report quality vs. finding the defect** explainer (discovery follows solely from the finding
  evidence in title/steps/expected/actual; a high score does not imply discovery). The evaluation
  is rule-based and says so — no AI, nothing is estimated in the browser. The report can be
  revised and resubmitted (best score is kept) or downloaded as markdown generated from the
  submitted report plus the safe, learner-facing feedback — never from hidden evaluator state;
  no ids, defect data or evaluator internals appear in the file. A failed submission keeps the
  learner's text. **P4-M2 WP3 (rendered).** While a hunt is active, the panels also carry a
  **three-level hint ladder** ("Need a hint?" — sequential unlocks with a live "N of 3 hints
  used" counter; unlocked hints persist across refreshes; locked levels are unavailable and
  disclose nothing), a **gated reveal panel** ("The solution" — locked until a report is
  submitted or the learner explicitly gives up through a WAI-modal "Show the solution?"
  confirmation; cancel makes no request) and **attempt-status chips** on the hunt cards
  (Not started · In progress · Submitted · score · Solution viewed). Report submission unlocks
  the reveal in place. Hint text and reveal content are never present in the client bundle;
  both are served only after server-side eligibility checks.

Phase 4 learning experience (P4-M2 WP1 + WP3; API and UI both shipped):

- `POST /api/v1/practice/hunts/:huntId/hints` — request one progressive hint, three levels per
  hunt (Orient → Focus → Narrow). Body: `{ "level": 1|2|3 }` (strict). Level N requires level
  N−1 already used on the attempt, enforced server-side (`409 hint_level_locked`); re-requesting
  an unlocked level is idempotent. Hint usage is stored as a bitmask on the attempt row
  (`hint_mask`), so progress survives refreshes and is isolated per session and per hunt; it
  never reveals any reveal/solution content and never unlocks the solution. Response:
  `{ level, hint, hintsUsed }` — no ids, no internal titles.
- `GET /api/v1/practice/hunts/:huntId/reveal` — the gated solution, but only once the caller's
  attempt for this hunt is `submitted` (a persisted report exists) or `revealed`; otherwise
  `403 reveal_locked` (also for cookie-less callers; no attempt is minted by the read). Response:
  `{ huntId, title, expected, actual, rootCause, reproduction[], verification[], concepts[],
  commonMisconceptions[], attempt }` — learner-safe prose, never defect ids or code identifiers.
- `POST /api/v1/practice/hunts/:huntId/reveal` — the explicit, confirmed give-up ("Show the
  solution"). Requires `{ "confirm": true }` (anything else → `400 invalid_request`) and a live
  session. An `in_progress` attempt is atomically switched to `revealed` (first `revealed_at`
  kept); a `submitted` attempt stays `submitted`; prior submissions, best score and sticky
  discovery are preserved. Give-up **never awards discovery** and is idempotent. Discovery is
  governed solely by the §6.4 evaluator's finding check.

**The ten hunts (one defect each), wired to scenarios:**

| Scenario | Hunt | Area |
| --- | --- | --- |
| `api-catalogue-filters` | `hunt-catalogue-002` | catalogue category filtering |
| `api-checkout-exact-stock` | `hunt-inventory-001` | inventory boundary at checkout |
| `api-mass-assignment` | `hunt-mass-001` | checkout mass assignment of the order total |
| `api-token-replay` | `hunt-authn-001` | API token replay after sign-out |
| `auth-role-boundaries` | `hunt-rbac-001` | staff-role boundary on the inventory read |
| `manual-address-edge-cases` | `hunt-checkout-001` | checkout validation |
| `manual-cart-add-quantity` | `hunt-cart-001` | cart quantity accumulation |
| `manual-cart-totals` | `hunt-pricing-001` | order line-total snapshot |
| `manual-shop-search` | `hunt-catalogue-001` | catalogue search coverage |
| `security-object-access` | `hunt-authz-001` | access control on order detail |

Wiring both directions: wired scenario pages carry a **Bug-hunt exercise** launch panel
(start/reset in place) and, while the hunt is active, the **structured bug-report panel**;
`/practice` lists the hunts with start/switch/reset and the same report panel for the active
hunt (submission persists the report, evaluates it and offers a markdown download); the scenario
catalogue cards show a **Bug-hunt exercise** badge,
the status filter includes `Ready`, and `/scenarios?hunt=available` deep-links the ten wired
scenarios.

**Bug-hunt mode — learner-facing summary.** Starting a hunt puts *your browser session only*
into an intentionally broken state (the banner turns amber and names the hunt). One defect is
active; it is deterministic and reproducible. Nothing about the hunt is stored anywhere but your
own `practice_sessions` row, other browsers never share it, and `reset` always returns the shop
to clean behaviour. Work out what the defect is, gather evidence, file your report, and
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

## Rate limits, retention and cleanup (P3-M9)

**Rate limits** (all per client IP per UTC minute, all storage-capped, keyed only by a
SHA-256 hash of the IP — never the raw address):

- `mutate:<ip>` — global backstop, **120 mutating requests/minute** for every POST/PATCH/PUT/DELETE
  under `/api/v1`. Overshooting answers `429 rate_limited` + `Retry-After`.
- `login:<ip>` — **5 failed sign-ins/minute** (PBKDF2 is skipped once the budget is exhausted;
  a successful sign-in clears it). Overshooting answers `429 login_rate_limited`. The budget is
  shared with `POST /api/v1/auth/token` — one brute-force allowance for every credential-checking
  endpoint.
- `checkout:<ip>` — **30 order placements/minute** (every attempt, including invalid payloads,
  counts). Overshooting answers `429 rate_limited`.
- `hunt_start_caps` — **20 hunt starts per IP per UTC day**, atomically enforced (no overshoot).
- Request bodies larger than **32 KB** are rejected with `413 payload_too_large` before parsing.
- When no client IP is visible (local development), all IP-based limiters are skipped;
  they are soft abuse controls, not an authentication boundary.

**Retention and cleanup.** Expired rows are reclaimed three ways, all bounded and idempotent:

1. Lazily, on contact (existing behaviour): an expired practice session or customer session
   is deleted when it is next presented.
2. On write: the hunt-start cap write prunes day-old rows (≤100 per call).
3. Explicitly, via `POST /api/v1/admin/maintenance/sweep` (**staff-only**) — or
   `npm run db:cleanup:local` for the local throwaway database. Every table is swept in
   bounded batches (≤100 rows); re-running is a no-op. Pages Functions cannot register a cron
   trigger (that would require a Workers project, deliberately not used here); after deployment
   an operator may invoke the staff sweep on any cadence they choose.

What the sweep deletes: expired `practice_sessions` (their `carts`, `cart_items`, `orders`,
`order_items`, `checkout_idempotency` and bound `customer_sessions` cascade with them — synthetic
learner state never outlives its session), expired `customer_sessions`, day-old
`hunt_start_caps`, `rate_limit_buckets` older than two hours, and expired or revoked
`api_tokens`.

What nothing ever deletes automatically: **`inventory_adjustments` and `order_cancellations`**
— they are the append-only audit trail and the exactly-once cancellation markers; deleting them
would break stock accounting and idempotency. `order_cancellations` rows cascade-delete together
with their order when that order's practice session expires (the whole session scope disappears
as a unit); `inventory_adjustments` rows survive with their subject references nulled. Active
sessions and their live carts/orders are never touched, regardless of age. Customer fixtures and
the catalogue are never touched by maintenance.

`npm run db:reset:local` is the **destructive, local-only** demo reset: it deletes ALL learner
state (carts, orders, adjustments, sessions, caps, buckets, attempts, reports, API tokens) and
restores the seed inventory
quantities from `0002_commerce_domain.sql`. It is separate from the learner-facing Clean Mode
reset (`POST /api/v1/practice/session/reset`), which remains non-destructive — it re-stamps the
session to clean mode and always preserves cart, orders and sign-in. Nothing in `db/` or
`scripts/` is ever run against a remote database by this project.

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

Migrations run against the local SQLite-backed D1 database by default (`npm run db:migrate:local`).
The production database is migrated explicitly with `--remote` as part of the deployment
procedure documented in **Deployment status** above — never via ad-hoc commands, and never
`db:reset:local` (that script is local-only).
Do not expose the platform D1 binding as a user-facing SQL console.

## Deployment status

**Production is deployed** at https://qa-practice-lab.pages.dev (Phase 4 deployed 2026-11-16):
Cloudflare Pages project `qa-practice-lab` (production branch `main`) and D1 database
`qa-practice-lab-db` (region APAC), bound as `DB`, `schema_version` 10. `/api/health` reports
the deployed schema version.

How it was set up (and how to reproduce or re-deploy):

1. `npx wrangler d1 create qa-practice-lab-db` — then set the returned `database_id` in
   `wrangler.jsonc` (binding stays `DB`). The id is not a secret but review changes to it.
2. `npx wrangler d1 migrations apply qa-practice-lab-db --remote` — applies 0001–0010 for the
   Phase 4 release (0010 applied to production on 2026-11-16; additive-only; health reports
   `schemaVersion: "10"`). **0011 (`api_tokens`, Phase 5) is not applied to production**; it is
   local-only until a Phase 5 release is explicitly approved — Phase 5 deployment would claim
   0001–0011.
3. `npm run build` then `npx wrangler pages deploy dist`. The `d1_databases` binding in
   `wrangler.jsonc` is applied to the Pages Functions at deploy time; no dashboard binding
   step was required (verified via `/api/health` → `schemaVersion: "10"`). The Phase 4 release
   deployed commit `ac53fd0` (merge of PR #5) on 2026-11-16; the deployment-specific URL is
   https://0b1cd31b.qa-practice-lab.pages.dev.
4. **Post-deploy verification:** `/api/health` returns `schemaVersion: "10"`; staged smoke of the
   Phase 4 journey passed on production (hunt start → ladder gating 409 → ordered hint unlock →
   report → deterministic evaluation → reveal unlock/lock → `/progress` attribution banners;
   give-up does not grant discovery; both themes × 375/768/1024/1440 px; zero unexpected console
   errors — recorded in `PROJECT_STATE.md` §11). The maintenance sweep remains operator-invoked.
5. **Rollback:** the previous production deployment (`99ef81ca-c8c2-44bc-ba9b-69f4f627e982`,
   commit `1f0847f`) is still available; redeploy it to roll back code. Migrations 0010 and 0011
   are additive-only, so the rolled-back application runs unchanged against `schema_version` 10
   or 11; the new tables simply sit unused. Do not drop them and do not attempt a destructive
   down-migration.
5. **Maintenance cadence:** Pages has no cron; invoke the staff sweep on a routine cadence of
   the operator's choosing (at least weekly; daily during active classes). With a staff
   session (synthetic fixture or a browser sign-in): `POST /api/v1/admin/maintenance/sweep`
   with an empty JSON body; the response reports bounded `deleted` counts and is idempotent.
   A future Workers cron should call the same `sweepExpiredData()` function.

Keep usage within the free-tier ceilings recorded in `PROJECT_STATE.md` (Workers/Pages request and
build limits, D1 daily reads/writes and per-invocation query limits). Do not add a
`_redirects` catch-all (the SPA fallback is native; see *SPA routing* above).

## Known constraints

- Most catalog scenarios are placeholders. The ten wired hunt scenarios are runnable
  bug-hunt exercises (see above); hunt attempts and submitted bug reports persist
  server-side (session-scoped) and are evaluated by the deterministic §6.4
  rubric — the report form and evaluation feedback ship in the P4-M2 WP2 UI and the
  hint/reveal UI ships in the P4-M2 WP3 UI; Phase 4 (all milestones P4-M1..P4-M3) is merged to `main` and deployed to production; see
  `docs/phase-4-learning-intelligence-plan.md`.
- The storefront catalogue, cart, checkout and the synthetic customer account area are real and
  backed by the API and D1. Sign-in is a **training simulation**: the synthetic accounts, the
  PBKDF2 password digests and the session tokens are fixtures; there is no registration, password
  reset, MFA, email verification, role-based access beyond `customer|staff`, or external identity
  provider. The checkout's payment outcome is a simulation and nothing is really paid for or
  shipped. Deleting cookies or letting the 7-day session expire starts with a fresh empty cart and
  no order history (orders cascade with the session); customer sessions expire after 8 hours;
  expired sessions and buckets are reclaimed by the cleanup sweep (see **Rate limits, retention
  and cleanup**). Unavailable lines stay in the cart flagged as such and block checkout with a
  `422` envelope until adjusted.
- There is **no reservation system**. Inventory is decremented only at order placement and
  restored only on cancellation, both exactly-once; a staff restock is the only adjustment path.
  `inventory_adjustments` is append-only; nothing prunes it, and there is no removal adjustment
  yet. Cancelling an order whose product was deleted returns nothing to stock (the snapshot
  outlives the catalogue).
- Bug-hunt mode ships **ten hunts** (one deterministic defect each, listed above). Reset
  preserves the cart, orders and sign-in (it re-stamps the session; it does not cascade-delete
  anything) — hunts are reportable, evaluable and revealable exactly like the Phase 3/4 set.
  Hunt
  starts are capped per IP per UTC day (20; only a hash of the IP is stored). All mutating
  endpoints carry the rate limits described above; the limiter is a fixed-window approximation
  (counts are exact within a minute, bursts at the window boundary can briefly exceed the
  intended rate) and a soft abuse control, not a security boundary — see
  `docs/phase-3-exit-audit.md` for the limitations of every control. The mint/adopt semantics,
  migration 0009 and the rejection envelope are documented in
  `docs/phase-3-commerce-practice-plan.md` and `docs/bug-hunt-catalogue.md`.
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
