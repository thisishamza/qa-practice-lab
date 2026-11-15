# PROJECT_STATE.md — QA Practice Lab

> **Purpose:** This is the resumable source of truth for the project. Update this file in the same work turn whenever architecture, scope, implementation, tests, deployment, blockers, or next steps change. Never leave the update until a later turn.

## 1. Project snapshot

- **Working name:** QA Practice Lab (name is provisional).
- **Vision:** A public, safe, end-to-end practice environment where QA engineers can learn and exercise manual testing, UI automation, API testing, contract testing, asynchronous/microservice testing, database testing, performance testing, and bounded security testing.
- **Reference points:** Practice Software Testing and its bug-hunting mode are inspiration for the breadth and learning flow. Build an original product and original scenarios; do not copy their content, branding, or implementation.
- **Primary deployment target:** Cloudflare Pages + Pages Functions/Workers + D1, using free tiers initially.
- **Development assistant:** OpenCode with OpenRouter free models. AI is a developer productivity tool, not a runtime dependency for the lab.
- **Current status:** Phase 2 (app shell, learning tracks, scenario catalog, and guides) complete and verified. **The approved Phase 2.5 redesign is COMPLETE (M1–M8) and merged into `main` via PR #2 (https://github.com/thisishamza/qa-practice-lab/pull/2). Phase 3 (commerce practice app) is IN PROGRESS on `feat/phase-3-commerce-practice` — P3-M1 (domain foundation), P3-M2 (storefront catalogue UI), P3-M3 (session-keyed shopping cart), P3-M4 (checkout & orders) and P3-M5 (synthetic customers & auth simulation) are implemented and verified; P3-M6 through P3-M9 are planned, not started.** M9 (optional polish) is not started and only on request.
- **Last updated:** 2026-11-15.

## 2. Product principles

1. **Practice, don't just read:** Every guide should lead to a runnable exercise, test target, or observable result.
2. **Clean and intentionally broken modes:** Each applicable scenario has a known-good mode and a bug-hunt mode. Defects are deterministic, documented internally, and revealed only after the learner submits or asks for hints.
3. **One coherent domain:** Use an original fictional commerce platform as the first domain so UI, APIs, services, events, and database exercises share the same entities and behavior.
4. **Safe by default:** Use synthetic users and data. Keep practice targets on this platform's own controlled endpoints. No open proxy, arbitrary target URL, destructive external testing, real payment processing, or real credential collection.
5. **AI is optional:** Core exercises, guides, API docs, and scoring must work without an AI request.
6. **Free-tier aware:** Bound concurrency, request rates, job volume, retention, and database reads/writes. Keep expensive or long-running work in the browser where practical.
7. **Progressive disclosure:** Start useful without an account. Persist basic progress locally first; add account-backed progress only when the core lab is stable and abuse controls exist.

## 3. Initial architecture decisions

### Application

- **Frontend (implemented):** React 19 + TypeScript 5.9 + Vite 7, React Router 7. Responsive plain-CSS shell with accessible landmarks and keyboard focus handling.
- **Design system (implemented in Phase 2):** Hand-written CSS split into `tokens`/`base`/`layout`/`components`/`pages`, CSS custom properties, and a light/dark theme driven by `data-theme` plus `localStorage`. No CSS framework or UI dependency was added.
- **Learning content (implemented in Phase 2):** Typed content modules in `src/data` (tracks, categories, scenarios, guides, demo data), with pure filtering logic in `src/lib/catalog.ts`. Scenario content is original to this project.
- **Routing:** React Router `BrowserRouter`; Pages serves SPA deep links natively while no top-level `404.html` exists.
- **Backend (implemented):** Hono 4 exporting a testable app from `src/server/app.ts`, bridged to a single Pages Functions catch-all (`functions/api/[[route]].ts`).
- **API namespace:** `/api/v1/...` is reserved for versioned practice APIs. Infrastructure endpoints use `/api/...` (`GET /api/health` is implemented).
- **Database:** Cloudflare D1 binding `DB`; migrations in `db/migrations/`. Phase 1 contains only `app_meta` (schema version).
- **Static deployment:** Cloudflare Pages with `pages_build_output_dir: "./dist"`; Pages Functions handle API calls and bind to D1.
- **Local development:** Vite on `:5173` proxies `/api` to `wrangler pages dev` on `:8788`. Tests run in plain Vitest (Node environment) because the app is exported independently of the Pages adapter; the Workers Vitest pool is not used yet.

### Important data isolation rule

Never expose the platform's D1 connection as a generic SQL console. Users must not be able to run arbitrary SQL against shared platform tables. The database-learning playground should use a per-browser sandbox database (for example SQLite compiled to WebAssembly, with disposable synthetic datasets) so learners can execute SQL without touching shared application data. D1 remains an implementation detail of the platform itself.

### Practice-domain services (logical boundaries first)

Model the first domain as modular services inside the API Worker rather than deploying many separate Workers at the start:

- Identity & access: login simulation, access/refresh token scenarios, roles, scopes, tenant context.
- Catalog: products, categories, search, sorting, pagination.
- Inventory: stock levels, reservations, optimistic concurrency.
- Cart & checkout: cart lifecycle, pricing, validation.
- Orders & payments: fake payment outcomes only; no real payment processor.
- Shipping & notifications: status transitions, webhook events, eventual consistency.

Each service should expose observable behavior, correlation/request IDs, and documented failure cases. A later phase may split services into separate Workers if that creates learning value and still fits free limits.

## 4. Functional scope

### Core learner experience

- A landing page with learning tracks and a searchable scenario catalog.
- Scenario pages with objective, prerequisites, setup, steps, expected behavior, hints, evidence to collect, and a debrief/solution.
- A clean/bug-hunt mode switch where supported.
- A bug report flow (steps to reproduce, expected vs actual, severity, evidence notes) and a way to reveal known issues after attempting the challenge.
- Browser-persisted progress initially; optional anonymous session identifier for server-side scenarios.

### Testing tracks

1. **Manual UI testing:** Browse/search/filter, cart, checkout, forms, validation, sorting, pagination, state transitions, accessibility, responsive layouts, error states.
2. **Bug-hunt UI:** Deterministic defects such as incorrect totals, stale stock, broken filters, edge-case validation, incorrect role visibility, and inconsistent UI state.
3. **API testing:** REST endpoints, CRUD, filtering, pagination, headers, status codes, error envelopes, auth, rate limits, idempotency, and negative cases.
4. **Authentication/authorization:** Synthetic users and tokens; roles/scopes/tenant boundaries; 401 vs 403; token expiry/refresh/revocation; safe IDOR/BOLA exercises against dummy data.
5. **Microservices & async workflows:** Service boundaries, correlation IDs, outbox/job records, retries, idempotency, ordering, duplicate delivery, dead-letter/failure states, eventual consistency, and webhook delivery/replay.
6. **Contract testing:** OpenAPI documents, schema validation, versioned response contracts, consumer/provider examples, backward-compatibility and deliberate contract-drift exercises.
7. **Database testing:** SQLite browser sandbox with seeded schemas and datasets; SQL SELECT/JOIN/GROUP BY/subqueries, constraints, NULL handling, data integrity, transactions, and query reasoning.
8. **Performance testing:** Bounded, opt-in load exercises against fixed first-party practice endpoints only. Start with a browser-driven runner and conservative caps; report latency percentiles, throughput, error rate, and saturation symptoms. No arbitrary external targets.
9. **Security testing:** Bounded, non-destructive learning scenarios for authZ gaps, excessive data exposure, input validation, mass assignment, rate limiting, and safe OWASP API Security concepts. Do not provide a general-purpose exploit or scanning service.
10. **Automation:** Provide downloadable/cloneable Playwright examples and API test collections (for example Postman/Newman). The lab itself should be a stable target; users can run automation locally. Do not promise hosted arbitrary-code execution on the free Worker tier.
11. **Guides:** Practical, scenario-led guides from test design through execution, evidence, bug reports, API/contract/performance/security approaches, and interview-style “how would you test…” exercises.

## 5. Proposed MVP boundary

The first usable release should be deliberately smaller than the complete vision:

- Responsive app shell and learning-track navigation.
- One original commerce practice application with clean and bug-hunt modes.
- Seeded product/cart/order scenarios with synthetic data.
- A versioned REST API with an OpenAPI document and sample requests.
- Basic synthetic auth/roles and authorization-negative scenarios.
- Scenario guides, hints, bug-report capture, and local progress.
- Cloudflare deployment and a smoke-test checklist.

Do **not** attempt to ship all tracks at once. Database sandbox, asynchronous workflows, contracts, performance, and broader security content are added in later increments after the base platform is stable.

## 6. Safety and abuse controls (non-negotiable)

- API and performance tests target only allowlisted first-party lab paths/hosts.
- Never accept user-supplied arbitrary destination URLs from the server-side test runner (SSRF protection).
- Add per-IP/session rate limits, request/body size limits, concurrency caps, run-duration caps, and global kill switches.
- Require an explicit confirmation before starting any load test; show a visible maximum duration and request budget.
- Keep test data synthetic; resettable; do not collect real passwords, card data, or personal records.
- Use non-destructive test cases; no real-world vulnerability scanning, credential stuffing, brute force, malware, or exploit payload service.
- Do not execute user-supplied automation/code on Cloudflare Workers. Provide client-run sample projects instead.
- Add retention caps for event traces, reports, and job history; do not store unbounded request/response bodies.
- Use Turnstile or another abuse gate if anonymous endpoints become a target; do not assume CORS alone is an access control.

## 7. Free-tier constraints verified on 2026-11-14

These are platform ceilings, not a promise of capacity; check official docs again before launch because quotas can change.

### Cloudflare Workers / Pages

- Workers Free: 100,000 requests/day, 10 ms CPU time per invocation, 128 MB memory, and 50 subrequests per invocation (official Workers limits page).
- Pages Free: 500 builds/month, one concurrent build, 20,000 files per site, and 25 MiB max per individual static asset. Pages Functions requests count toward Workers quota.
- Pages is suitable for the frontend plus lightweight API routes, but not long-running load generators or hosted arbitrary-code execution.

### Cloudflare D1

- Workers Free: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage across the account, and up to 10 D1 databases.
- Free database maximum size: 500 MB each. D1 free plan allows up to 50 queries per Worker invocation.
- Daily D1 read/write limits are enforced: once exceeded, D1 queries fail until the reset at 00:00 UTC. Index common filters, paginate results, batch writes, and avoid unbounded logs.

### OpenRouter free models

- Free model variants (`:free`) are currently limited to 20 requests/minute and 50 requests/day on an unfunded account; the daily allowance can increase after at least $10 of credits have been purchased. Failed attempts count toward the daily cap.
- Model catalog/rankings and provider capacity change often. Select models using OpenCode's `/models` UI and verify current availability rather than hardcoding a model based on today's ranking.
- Multiple free models on the same OpenRouter account should not be treated as independent daily request quotas.

## 8. AI-assisted development workflow

- Use OpenCode as the coding interface and OpenRouter as a provider; configure via OpenCode's provider connection or project config. Never commit API keys.
- Prefer one planning/reasoning model for architecture and tricky debugging, one coding-capable model for implementation, and a faster/lighter model for repetitive docs/tests when available. Verify live model availability and route behavior before relying on any model.
- Keep work units small: one phase or vertical slice per session; require typecheck, tests, and a concise manual verification before moving on.
- At the start of each session, read `PROJECT_STATE.md`, then inspect the repo and reconcile the file with actual code. Do not assume the state file is more accurate than the repository.
- At the end of every project response/turn that changes or clarifies the plan/code, update this file immediately: status, decisions, files changed, tests run, blockers, exact next action, and a brief progress log. Provide the latest file to the user in the same turn.
- Never leave the state update as a promised follow-up task.

## 9. Phased implementation roadmap

| Phase | Goal | Exit criteria |
|---|---|---|
| 0. Product/architecture | Scope, safety, platform decisions, resumable state | This file exists and the MVP boundary is agreed as the working baseline |
| 1. Repository foundation | Scaffold React/Vite/TypeScript, Hono Pages Functions, Wrangler, D1 migration setup, lint/typecheck/test scripts, CI-ready scripts | App runs locally; `/api/health` works locally; D1 migration applies; Pages preview works |
| 2. App shell & guides | Navigation, track catalog, scenario template, guide content structure | Learner can browse tracks and open a structured guide |
| 2.5. UI/UX audit & redesign planning | Evaluate the Phase 2 interface, choose a visual direction, and plan a component/page redesign | `docs/phase-2.5-ui-ux-audit.md` exists with evidence, tokens, page plans, accessibility plan, and milestones; implementation approved by the user |
| 2.6. UI/UX redesign implementation | Execute the approved milestones M1–M8 in order (M9 optional) | Every approved milestone is implemented, verified, and recorded; Phase 3 resumes only on explicit instruction |
| 3. Commerce practice app | Synthetic catalog/cart/checkout, clean mode, bug-hunt mode, reset | UI scenarios can be completed and known defects are reproducible |

Phase 3 is in progress on `feat/phase-3-commerce-practice`. The approved plan and milestone
sequence (P3-M1 … P3-M9) lives in `docs/phase-3-commerce-practice-plan.md`; see §12 for status.
P3-M1 (domain foundation), P3-M2 (storefront catalogue UI), P3-M3 (session cart), P3-M4
(checkout & orders) and P3-M5 (synthetic customers & auth simulation) are implemented and
verified on that branch.
| 4. API & identity lab | REST API, OpenAPI, sample collection, synthetic auth/roles, negative authZ cases | API learners can exercise positive/negative cases and inspect documented contracts |
| 5. Async/microservice lab | Job/outbox model, status polling, retries, idempotency, webhooks, failure injection | Learners can observe and test asynchronous state transitions safely |
| 6. Database lab | Isolated SQLite/WASM database playground and SQL exercises | Arbitrary learner SQL is isolated from platform D1 and resettable |
| 7. Contract testing | Versioned schemas, consumer/provider examples, contract break/fix exercises | Learners can detect schema incompatibility using examples and tooling |
| 8. Automation examples | Playwright UI/API starter suite and Postman/Newman collection | Learners can run examples locally against lab targets |
| 9. Performance & security tracks | Capped first-party load runner and non-destructive security exercises | Hard safety caps and abuse controls are tested before publishing |
| 10. Hardening & launch | Accessibility, responsive polish, docs, observability, rate limits, retention, backup/export, deploy | Production smoke tests pass and free-tier monitoring/limits are documented |

Phase 1 exit criteria were verified locally on 2026-11-14: the app runs, `/api/health` reports the
migrated D1 database, and the Pages preview serves the production build and Functions.

Phase 2 exit criteria were verified locally on 2026-11-14: a learner can navigate twelve learning
tracks, search and filter the scenario catalog, open a structured guide, and read scenario detail
pages. Every scenario is explicitly marked as not runnable. Phases 3–10 remain unstarted.

## 10. Repository shape (current after Phase 2)

```text
qa-practice-lab/
├── AGENTS.md
├── PROJECT_STATE.md
├── README.md
├── docs/
│   ├── phase-2.5-ui-ux-audit.md      # audit + redesign plan (no code changes)
│   └── phase-3-commerce-practice-plan.md  # Phase 3 plan: milestones P3-M1..P3-M9, bug-hunt engine design
├── package.json / package-lock.json   # v0.2.0
├── index.html                         # includes the pre-paint theme bootstrap
├── vite.config.ts / vitest.config.ts
├── wrangler.jsonc                     # Pages config + local D1 binding
├── eslint.config.js
├── tsconfig.json                      # references app/node/functions projects
├── tsconfig.app.json                  # src, excludes src/server
├── tsconfig.node.json                 # Vite/Vitest config files
├── tsconfig.functions.json            # functions, src/server, tests
├── functions/
│   └── api/[[route]].ts               # Hono -> Pages Functions catch-all
├── src/
│   ├── app/App.tsx                    # ThemeProvider + AppShell routes
│   ├── components/
│   │   ├── layout/                    # AppShell, TopBar, Sidebar, MobileNav
│   │   └── ui/                        # Icon, Button, IconButton, Tag, LevelMeter, Meta,
│   │                                  # FactList, StatTile, Callout, States, progress, theme
│   ├── data/                          # typed tracks, categories, scenarios, guides, demo
│   ├── features/
│   │   ├── catalog/                   # ScenarioCard, ScenarioFilterBar
│   │   ├── cart/                      # CartContext (provider), cart-context, useCart,
│   │   │                              # CartView, api (cart client)
│   │   ├── auth/                      # AuthContext (provider), auth-context, useAuth,
│   │   │                              # api (account/auth client)
│   │   ├── checkout/                  # CheckoutView, OrderConfirmationView, api
│   │   ├── guides/                    # GuideCard
│   │   ├── shop/                      # ProductCard, ProductDetail, ProductStates,
│   │   │                              # ShopFilterBar, Pagination, api (catalogue client)
│   │   ├── system/                    # HealthStatus
│   │   └── tracks/                    # TrackCard
│   ├── lib/                           # catalog filtering, labels, navigation, route management, theme
│   ├── pages/                         # route-level pages (dashboard … about, shop, shop product,
│   │                                  # cart, checkout, orders confirmation, login, account,
│   │                                  # account orders, account order detail, 404)
│   ├── server/app.ts                  # testable Hono app, basePath /api
│   ├── server/catalogue.ts            # Phase 3 catalogue routes (/api/v1, incl. q search)
│   ├── server/cart.ts                 # Phase 3 session cart routes (/api/v1/cart)
│   ├── server/checkout.ts             # Phase 3 checkout & order routes (/api/v1/checkout, /api/v1/orders)
│   ├── server/session.ts              # anonymous practice sessions (SHA-256-hashed tokens)
│   ├── server/auth.ts                 # P3-M5 auth + protected account routes (/api/v1/auth/*,
│   │                                  # /api/v1/account/*); PBKDF2 verify, token rotation, 401/403/404
│   ├── server/customer.ts             # P3-M5 customer sessions (mpl_customer cookie, hashed tokens,
│   │                                  # practice-session binding, suspended handling)
│   ├── shared/health.ts               # shared response type
│   ├── shared/commerce.ts             # shared catalogue + cart + order contracts (Phase 3)
│   ├── styles/                        # tokens, base, layout, components, workspace, pages, global
│   └── main.tsx
├── db/
│   └── migrations/                    # 0001_initial_schema.sql, 0002_commerce_domain.sql,
│                                      # 0003_cart.sql, 0004_orders.sql, 0005_customers.sql
├── public/
│   └── favicon.svg
└── tests/
    ├── data/content.test.ts           # content integrity and non-runnable guarantees
    ├── lib/catalog.test.ts            # filtering, search, counts, URL-param state, sorting
    ├── lib/shop.test.ts               # storefront URL-state, price formatting, labels
    ├── helpers/fake-d1.ts             # node:sqlite-backed D1 harness (applies real migrations;
    │                                  # also implements all-or-nothing batch())
    ├── server/catalogue.test.ts       # /api/v1 catalogue API against the seeded schema (incl. q search)
    ├── server/cart.test.ts            # session cart API: isolation, validation, totals, transactions
    ├── server/checkout.test.ts        # checkout & orders: transaction, rollback, idempotency
    ├── server/auth.test.ts            # auth & authorization: login/logout/me, rotation, expiry,
    │                                  # practice-session binding, ownership, compatibility
    ├── server/health.test.ts
    ├── lib/checkout.test.ts           # checkout form validation
    └── shop/                          # storefront API client (stubbed fetch) + SSR markup tests
                                       # (+ cart/checkout views & API client tests since P3-M3/M4)
```

Routes implemented in Phase 2: `/`, `/tracks`, `/tracks/:trackId`, `/scenarios`,
`/scenarios/:scenarioId`, `/guides`, `/guides/:guideId`, `/progress`, `/practice`, and a
catch-all 404. Redesign M2 added one utility route, `/about` ("About this build"). Phase 3
(P3-M2) added `/shop` and `/shop/products/:slug` — both render inside `AppShell` and fetch
the real `/api/v1` catalogue. Phase 3 (P3-M3) added `/cart`, which reads/writes the
session cart through `/api/v1/cart`. Phase 3 (P3-M4) added `/checkout` and
`/orders/:reference` — both render inside `AppShell`; `/checkout` reads the same cart and
places a simulated order, `/orders/:reference` renders the session-scoped confirmation.
Phase 3 (P3-M5) added `/login`, `/account`, `/account/orders` and `/account/orders/:reference` —
all render inside `AppShell`; `/account` shows the synthetic customer profile (or an honest guest
state), order history and detail are protected resources owned by the signed-in customer. The
top bar carries an account indicator and the sidebar/mobile nav an Account entry.

Phase 2.5 added only `docs/phase-2.5-ui-ux-audit.md`; it contains the audit evidence and the
approved redesign plan. No application source was touched.

Redesign M1 changed existing files only (`src/styles/tokens.css`, `base.css`, `components.css`,
`layout.css`, `src/main.tsx`, `src/lib/theme.ts`, `index.html`, `eslint.config.js`,
`package.json`/`package-lock.json`). It added no routes, pages, content, or source directories.
IBM Plex Sans and JetBrains Mono are devDependencies whose variable woff2 files are bundled by Vite.

Redesign M8 changed `src/pages/TrackDetailPage.tsx` (dedupe, related tracks by shared category, catalogue deep link), `src/pages/NotFoundPage.tsx` (Test Bench 404, recovery rows), `src/pages/AboutPage.tsx` (persistence copy), `src/styles/{tokens,base,components}.css` (compatibility aliases removed, .not-found/.category-card deleted, .aside-link-meta added). No routes or backend changes.

Redesign M7 changed `src/pages/PracticePage.tsx` (available-now zone, workspace runtime panel), `src/pages/ProgressPage.tsx` (honest no-persistence empty state + single labelled sample preview), `src/features/system/HealthStatus.tsx` (dark workspace panel, retry, user-facing errors), `src/styles/workspace.css` (scaffold filled with workspace panel styles), `src/styles/{components,pages}.css` (dead stats/activity/health/reality rules deleted; new tracked-list styles). No backend or persistence added.

Redesign M6 changed `src/pages/GuidesPage.tsx` (index-row listing, mono availability line), `src/features/guides/GuideCard.tsx` (horizontal index row), `src/pages/GuideDetailPage.tsx` (prose 66ch, scrollspy TOC, mobile details TOC, pager, FactList removed), `src/styles/components.css` (concept/code/TOC/pager styles). No guide content or data changed.

Redesign M5 changed `src/pages/ScenariosPage.tsx` (URL-driven state, availability line), `src/features/catalog/{ScenarioFilterBar,ScenarioCard}.tsx` (facet grid + chips + mobile drawer; mode meta), `src/lib/catalog.ts` (URL-param helpers, sort, status counts), `tests/lib/catalog.test.ts`, and `src/styles/components.css` (chips, search clear, drawer styles). No scenario statuses, routes, or backend changed.

Redesign M4 changed `src/pages/DashboardPage.tsx` (zones rebuilt), `src/pages/TracksPage.tsx`, `src/features/tracks/TrackCard.tsx`, `src/pages/NotFoundPage.tsx` (`button-row`), and `src/styles/{pages,components}.css` (hero/quick-practice/track-grid-wide removed; new start-path, track-row, scenario-row styles). No content data, routes, or backend changed.

Redesign M3 changed the shared primitives in `src/components/ui/` (new Button, IconButton, Tag, LevelMeter, Meta, FactList, StatTile; Badge/DomainBadges/StatCard removed), the three feature cards, the fact-list call sites in four pages, callout/progress/stat styles and card/button tokens in `components.css`, added `workspace.css` (scaffold only), and wired the two Reset-filters buttons to the new `Button`. It redesigned no page layouts; page-level restructures remain M4–M7.

Redesign M2 changed the shell files (`AppShell`, `TopBar`, `Sidebar`, `MobileNav`,
`navigation.ts`, `layout.css`, `tokens.css` widths), added `src/lib/useRouteManagement.ts` and
`src/pages/AboutPage.tsx`, added minimal `?q=` handling to `ScenariosPage`, and wrapped the
breadcrumb current item instead of truncating it. It added no practice content, changed no
scenario statuses, and did not redesign page bodies.

Planned but intentionally not created yet: a commerce practice application, practice APIs,
persistence for learner progress, accounts, `db/seed`, `contracts/openapi`,
`examples/playwright`, `examples/postman`, and `docs/guides` exports. Add them only when their
phase starts.

## 11. Progress log

### 2026-11-15 — Phase 3 P3-M5: synthetic customers and authentication simulation

- **Branch / commit before work:** `feat/phase-3-commerce-practice` @ `9b00d71` (P3-M4), tree
  clean; `main` untouched; nothing pushed. All changes land in the milestone commit at the end
  of this turn (hash in the final report).
- **UI direction:** `ui-ux-pro-max` invoked before frontend work; verified guidance applied
  (WCAG 2.2 accessible authentication — password managers/paste allowed,
  `autocomplete="current-password"`; focusable error summary at the top of the form with linked
  field errors; `role="alert"`; inline field errors). The login view follows the existing
  Checkout form patterns and tokens (`checkout-form`, `checkout-field`, `checkout-error-summary`,
  `catalogue-availability`, `cart-layout`), so no new design language was introduced.
- **Identity architecture (documented in README.md + code comments):** TWO independent concepts.
  1. **Practice session** — `mpl_session`, opaque 128-bit token, SHA-256 hash in
     `practice_sessions`, 7-day expiry; owns the cart and unassociated orders; the isolation
     boundary for exercises; unchanged from P3-M3/M4.
  2. **Simulated customer identity** — `mpl_customer`, a SEPARATE opaque 128-bit token; only its
     SHA-256 hash is stored, in `customer_sessions`, bound to `practice_session_id`. A customer
     session is honoured only while its owning practice session is live in the same browser; a
     token replayed against another practice session (or without one) resolves to 401 with the
     cookie cleared. The two cookies are never interchangeable, and customer identity never
     replaces the practice session. Deleting the practice cookie or expiry detaches the customer
     session with it.
- **Token lifecycle:** login ALWAYS mints a brand-new customer token and first destroys every
  `customer_sessions` row for the current practice session (rotation — a pre-existing browser
  token can never remain valid after sign-in; fixation impossible by construction). Logout deletes
  the presented token's row (idempotent, `200 {ok:true}`) and clears the cookie. Expired rows are
  deleted on first contact. Cookies: HttpOnly, SameSite=Strict, Path=/, Max-Age 28800 (8 h),
  `Secure` only over HTTPS (same convention as `mpl_session`). Tokens and hashes never appear in
  any API response; DB stores only hashes (verified by test).
- **Password strategy:** PBKDF2-HMAC-SHA256, **100,000 iterations**, 8-byte FIXED salts — the
  fixtures are deterministic (`pbkdf2:<iterations>:<salt_hex>:<hash_hex>`), so a fresh migration
  always yields the same digests; stored hashes were verified against the documented plaintexts
  via `crypto.subtle`. Web Crypto `crypto.subtle` (Workers-compatible) is the only KDF; no new
  dependency, no Node-only crypto API in production paths. Login answers an IDENTICAL
  `401 invalid_credentials` for unknown email and wrong password; the unknown-email path still
  runs a PBKDF2 verification against a dummy digest so response timing does not enumerate
  accounts. Suspended accounts get `403 account_suspended` (only reachable with the correct
  password); suspending mid-session flips protected endpoints to the same 403.
- **Seed data (deterministic, RFC 2606 domains, zero real data):** migration
  `db/migrations/0005_customers.sql` — `customers` (id, email UNIQUE COLLATE NOCASE, name,
  password_hash, role `customer|staff`, status `active|suspended`, synthetic address
  line/city/postcode, created_at), `customer_sessions` (token_hash UNIQUE, customer_id →
  customers ON DELETE CASCADE, practice_session_id → practice_sessions ON DELETE CASCADE,
  expires_at; indexes on customer/practice/expires), and `orders.customer_id` (nullable →
  customers ON DELETE SET NULL; indexed). `schema_version` → `5`. Five fictional fixtures:
  Amara Okafor (`amara.okafor@example.com`, `demo-amara-1001`, customer, active),
  Ben Whitmore (`ben.whitmore@example.net`, `demo-ben-1002`, active),
  Priya Raman (`priya.raman@example.org`, `demo-priya-1003`, active) — two independent active
  identities for IDOR practice; Dana Reyes (`dana.reyes@example.com`, `demo-dana-1004`,
  **suspended** — documented sign-in refusal case); Rowan Ellison
  (`rowan.ellison@example.com`, `demo-rowan-9001`, **staff** — role seeded for M6).
  Credentials documented in README.md ("Training-only synthetic sign-in") — never in the UI bundle.
- **API (`src/server/auth.ts` + `src/server/customer.ts`, mounted in `/api/v1`):**
  `GET /api/v1/auth/accounts` (safe directory — name/email/role/status only, never secrets),
  `POST /api/v1/auth/login` (400 on malformed bodies; identical 401 `invalid_credentials`;
  403 `account_suspended`; lazy-mints a practice session+pair when the browser has neither;
  binds the new customer session to it; anti-fixation rotation),
  `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, protected `GET /api/v1/account`
  (profile incl. synthetic address + member-since), `GET /api/v1/account/orders` (≤50, newest
  first, scoped to `customer_id`), `GET /api/v1/account/orders/:reference` (own details only).
  Shared guard `requireActiveCustomer` (401 unauthorized / 403 account_suspended); stale or
  malformed/foreign-bound cookies are cleared in the same response.
- **Ownership policy (documented + tested):** 401 = unauthenticated; 403 = authenticated but
  suspended; 404 = unknown OR not owned (existence concealed, consistent with the session-scoped
  confirmation policy). Account order history = orders with this `customer_id` (any practice
  session — it is the same fictional person); account order detail requires BOTH reference AND
  caller's `customer_id`; unknown and not-owned references return the IDENTICAL 404 envelope;
  out-of-format references get 400. `403` is deliberately never used for cross-customer access.
- **Order ownership decision:** orders placed while signed in get `orders.customer_id` set in the
  placement batch (explicit, transactional, practice-session-scoped binding). Orders placed as a
  guest or before sign-in keep `customer_id NULL` and are NEVER silently adopted; they stay
  readable through the session-scoped `/api/v1/orders*` endpoints. Guest cart and guest checkout
  are fully unchanged — sign-in is never a prerequisite for them. Pre-M5 orders in existing local
  D1 remain valid (column added nullable, no backfill).
- **Frontend:** `/login`, `/account`, `/account/orders`, `/account/orders/:reference` inside
  `AppShell`; `AuthProvider` (`src/features/auth/`) reads `/api/v1/auth/me` on mount and after
  sign-in/out — refresh restores identity from the cookie, nothing in localStorage/sessionStorage;
  login page with clearly-labelled fictional demo-account directory (email fill buttons, no
  passwords shown, suspended case labelled), aggregated `role="alert"` error summary with linked
  field errors, `autocomplete="username"/"current-password"`, paste allowed; account profile view
  (FactList, synthetic address card, member since, sign-out, suspended callout, guest state with
  sign-in CTA); order history list (reference links, status/payment tags, item count, total);
  order detail reuses `OrderConfirmationView` (new optional `crumbs` prop only). Top bar gained an
  account indicator (first name when signed in; "Sign in" otherwise; hidden ≤640px where the
  sidebar/mobile drawer instead carries an **Account** entry added to `primaryNav`). New inline
  icons `user`, `logout`. Both themes + 375/768/1024/1440 verified.
- **Compatibility:** anonymous cart and cart UX unchanged; anonymous checkout unchanged (guest
  orders confirmed readable via `/api/v1/orders/:reference` after later sign-in); catalogue
  untouched; 212 pre-existing tests kept green (schema_version assertions bumped 4→5).
- **Verification:** `npm run check` — **passed** (ESLint clean; all three TS projects clean;
  **239/239 tests**, was 212; +27 new auth/ownership/compatibility tests incl. token-hash-only
  storage assertions, rotation, expiry purge, cross-practice-session replay, suspended mid-
  session 403, guest/non-adoption, byte-identical login failure payloads). `npm run build` —
  passed (JS **448.08 kB** / gzip 131.88 kB vs 447.98/448.08 at M4, CSS **68.39 kB** / gzip
  13.27 kB; no new runtime dependencies). Playwright/Chrome probe against the production build on
  port **8791** (8788/5173 untouched): **51/51 checks pass** — guest navigation on all new
  routes, non-enumerating login failure, empty-submit error summary with field links, sign-in,
  refresh persistence, signed-in order placement appearing in account history, Ben unable to see
  Amara's order (history + direct reference → concealed not-found state), Amara's own detail,
  logout → guest state on /account and /account/orders, session scoping of the cart, all new
  routes × 375/768/1024/1440 × light/dark (zero overflow, exactly one h1), reduced-motion render,
  zero unexpected console errors (the by-design 401 guest probe and concealed-order 404 are
  filtered). Port 8791 confirmed closed afterwards. One layout bug found and fixed during
  verification: the extra top-bar control overflowed 375 px by 37 px — the account indicator is
  now hidden ≤640 px and Account lives in the sidebar/mobile drawer (`primaryNav`).
- **Local D1 note:** `npm run db:migrate:local` applied `0005_customers.sql` to the existing
  local database (additive; pre-existing orders keep `customer_id NULL`); seeds verified
  (5 customers, correct roles/statuses) and all fixture digests verify against README passwords.
  Local probes accumulated synthetic signed-in orders in local state (throwaway).
- **Docs:** README.md (routes, training-only credential table, identity architecture, auth +
  account endpoint reference, authorization policy, guest-checkout compatibility, limitations),
  `docs/phase-3-commerce-practice-plan.md` (M5 marked implemented with as-built deviations),
  AGENTS.md (state lines), PROJECT_STATE.md.
- **Known limitations / open items:** NO rate limiting on login (or cart/checkout) — deferred to
  M9 with the rest; no registration/password-reset/MFA (deliberately out of scope); no staff-only
  endpoint yet (`staff` role seeded for M6); customer sessions are not swept until M9 (expired
  rows are deleted lazily on first contact); the staff account's role is stored but unused by any
  endpoint yet; login does not prefill the checkout form (deliberate — keeps the form honest);
  `node:sqlite` harness remains the only database test path; interaction-level auth testing relies
  on the (uncommitted) Playwright probe + SSR markup tests, same convention as before; local dev
  D1 accumulates probe orders (throwaway local state).
- **Git:** single milestone commit `feat: implement synthetic customer authentication` (hash in
  the final report). `main` untouched, nothing pushed, P3-M6 not started.
- **Next exact action:** STOP. Await instruction to start **P3-M6 (inventory depth)** — do not
  begin without approval.

### 2026-11-15 — Phase 3 P3-M4: checkout & order workflow

- **Branch / commit before work:** `feat/phase-3-commerce-practice` @ `58f119d` (P3-M3), tree
  clean; `main` untouched; nothing pushed. All changes land in the milestone commit at the end
  of this turn (hash in the final report).
- **Migration `db/migrations/0004_orders.sql` (applied locally, `schema_version` → `4`):**
  `orders(id PK, session_id → practice_sessions ON DELETE CASCADE, reference TEXT UNIQUE NOT NULL
  /* opaque ORD- + 16 uppercase hex chars — sequential ids never exposed */,
  status CHECK IN ('placed'), payment_status CHECK IN ('approved','declined'),
  customer_name, customer_email, shipping_line, shipping_city, shipping_postcode,
  subtotal_cents, total_cents /* integer cents, >= 0 */, created_at)`,
  `order_items(id PK, order_id → orders ON DELETE CASCADE, product_id nullable → products
  ON DELETE SET NULL /* snapshots survive product deletion */, product_slug, product_name,
  unit_price_cents, quantity CHECK 1..99, line_total_cents)`,
  `checkout_idempotency(session_id → practice_sessions ON DELETE CASCADE, idempotency_key,
  request_hash, outcome CHECK IN ('approved','declined'), order_id NULLABLE → orders
  ON DELETE SET NULL, created_at, PRIMARY KEY (session_id, idempotency_key))`. Orders cascade
  with the anonymous session (same semantics as carts; 7-day expiry). Indexes:
  orders(session_id, created_at DESC), order_items(order_id), checkout_idempotency(order_id).
  Only synthetic name/email/address are stored; no card or banking fields exist anywhere.
- **Simulated payments (documented approach):** `paymentSimulation ∈ {approved, declined}`,
  deterministic, chosen on the checkout form behind an explicit “not a real payment” wording.
  `declined` ⇒ NO order row is created, no stock is touched, cart stays intact; the attempt is
  recorded in `checkout_idempotency` so a retry replays the decline verbatim. `approved` ⇒ the
  practice order is placed. `orders.payment_status` can therefore only ever hold `approved` in
  P3-M4 (the CHECK also allows `declined` for M6 flexibility); `status` and `payment_status`
  are stored separately as the plan required.
- **Transaction design (D1 has no interactive transactions; `batch()` is all-or-nothing):**
  read-only validation first (resolve session → read lines joined to products/inventory →
  verify every line active + stock sufficient → compute totals from DB rows). Approved
  payments then run as ONE `batch()`: INSERT order, INSERT item snapshots (order resolved via
  `(SELECT id FROM orders WHERE reference = ?)` inside the batch), unguarded-but-CHECK-protected
  `UPDATE inventory SET quantity = quantity - ?` (the existing `inventory.quantity >= 0` CHECK
  turns an oversell into a statement failure that aborts the whole batch), DELETE cart lines,
  INSERT idempotency record. Any failure rolls back everything — no partial order, no stock
  decrement without an order, never a cleared cart after failure. Verified against the real
  migration SQL in the node:sqlite harness and live via the API.
- **Idempotency (request-scoped, details fingerprint):** client may send an `Idempotency-Key`
  header (8–128 chars of `[A-Za-z0-9_-]`; an `idempotencyKey` body field is also accepted;
  generated when absent). The fingerprint is SHA-256 over the validated checkout details +
  payment outcome — deliberately NOT the cart contents, because a legitimate retry after the
  first placement finds an empty cart. Behaviour: same key + same payload → the recorded outcome
  replayed verbatim (`201` + original order, or the recorded decline) with header
  `Idempotent-Replay: true`; same key + materially different payload → `409
  idempotency_conflict`; concurrent twins resolve through the PRIMARY KEY — loser’s batch rolls
  back and its response becomes a replay of the winner’s outcome. The idempotency lookup happens
  BEFORE the empty-cart rejection so retry-after-success works. Frontend generates a UUID key per
  form session, rotates it after every settled server response, and keeps it across network
  failures — a double-click can never place two orders.
- **API (`src/server/checkout.ts`):** `GET /api/v1/checkout` (summary + `checkoutable`, never
  mints a session), `POST /api/v1/checkout` (validate → idempotency pre-check → eligibility
  check → batch; envelopes: 400 `invalid_request` + per-field `fields` map, 422 `empty_cart`,
  422 `cart_unavailable` + per-line reasons, 422 `payment_declined`, 409
  `idempotency_conflict`), `GET /api/v1/orders` (session history, ≤50, newest first), `GET
  /api/v1/orders/:reference` (format 400; unknown OR foreign session → identical 404 envelope;
  reference regex `^ORD-[0-9A-F]{16}$`).
- **Frontend:** routes `/checkout` and `/orders/:reference` inside `AppShell`. Checkout page:
  breadcrumb + PageHeader, honest “practice checkout” availability line, two-column layout
  (form + sticky summary with Item lines, subtotal, total), HTML5/`noValidate` form with
  server-mirroring client validation (`src/lib/checkout.ts`, unit-tested), mono-uppercase field
  labels, blur validation, accessible error summary (`role="alert" tabIndex=-1`) whose items
  link to the offending fields, inline field errors (`aria-describedby`/`aria-invalid`),
  explicit Approved/Declined radio cards with practice-only wording, submit disabled while busy,
  success → `refresh()` cart (badge clears) → navigate to `/orders/:reference`. Confirmation
  page: status/payment tags (text, not colour), reference in mono, immutable item snapshots,
  delivery block (synthetic), “No real payment was processed” Callout, links to shop and
  dashboard; unknown/foreign reference renders an honest EmptyState; refresh persists within the
  owning session only. `/cart` summary now has a **Proceed to checkout** button (disabled when
  any line is unavailable) and updated honest copy; ShopPage/ProductDetail copy updated; no new
  dependencies; two icons reused (`lock`, `check`).
- **Verification:** `npm run check` — **passed** (ESLint clean; all three TS projects clean;
  **212/212 tests**, was 155; +30 server checkout tests incl. full-rollback batch proof,
  concurrent same-key/different-key placement, declined replay, payload-drift 409, snapshot
  survival of rename/reprice/deactivation/deletion; +8 views/api tests; +5 lib validation
  tests). `npm run build` — passed (JS **429.38 kB** / gzip 127.83 kB vs 408.70 / 123.21 at M3;
  CSS **64.89 kB** / gzip 12.88 kB; no new runtime dependencies). Playwright/Chrome probe against
  the production build on port **8791** (8788/5173 untouched; curl liveness confirmed 8791 closed
  after): **live flow** — add to cart → checkout → place approved order (redirect, reference,
  tags, snapshot, refresh persistence, foreign-session 404, unknown reference, malformed
  reference) and declined order (notice shown, cart intact); **422/400 by-design API responses**;
  **idempotency replay verified live against the production build** (same key+payload after the
  cart was emptied → `201` + original reference + `Idempotent-Replay: true`; payload drift →
  `409`); **both themes × 375/768/1024/1440** for `/checkout` and `/orders/:reference` (zero
  overflow, exactly one h1), reduced-motion render; client-side validation blocks empty submit
  with linked error summary; zero unexpected console errors. Port 8788/5173 appear down at end of
  session; this turn never started or stopped them (only a pattern-scoped pkill for 8791, which
  also terminated the probe harness shell; nothing owned by the user was touched).
- **Docs:** README.md (M4 functionality, endpoint reference, explicit simulated-payment
  behaviour section, limitations), `docs/phase-3-commerce-practice-plan.md` (M4 marked
  implemented with as-built deviations), AGENTS.md (state lines), PROJECT_STATE.md.
- **Known limitations / open items:** no rate limits yet (deferred to M9); order history UI not
  exposed (API-only; `/orders/:reference` is the only orders UI); expired sessions cascade-delete
  their orders (by design, documented); `react-dom/server` SSR markup tests assert rendering,
  browser probes cover interaction and are not committed (same convention as before); local dev
  D1 accumulates practice orders from probes/tests (throwaway local state; `rm -rf .wrangler` +
  `db:migrate:local` resets); `npm run check` is green but the `node:sqlite` harness remains the
  only database test path.
- **Git:** single milestone commit `feat: implement checkout and order workflow` (hash in the
  final report). `main` untouched, nothing pushed, P3-M5 not started.
- **Next exact action:** STOP. Await instruction to start **P3-M5 (synthetic customers &
  auth simulation)** — do not begin without approval.

### 2026-11-15 — Phase 3 P3-M3: session-keyed shopping cart

- **Branch / commit before work:** `feat/phase-3-commerce-practice` @ `942967c` (P3-M2), tree
  clean; `main` untouched; nothing pushed. All changes land in the milestone commit at the end
  of this turn (hash in final report).
- **Migration `db/migrations/0003_cart.sql` (applied locally, `schema_version` → `3`):**
  `practice_sessions(id, token_hash UNIQUE, created_at, expires_at DEFAULT fixed insert in code,
  index on expires_at)`, `carts(id, session_id UNIQUE → practice_sessions ON DELETE CASCADE,
  created_at, updated_at)`, `cart_items(id, cart_id → carts ON DELETE CASCADE, product_id →
  products, quantity INTEGER CHECK 0 < quantity <= 99, UNIQUE(cart_id, product_id))`. The raw
  session token is never stored — only its SHA-256 hash; 7-day expiry; expired rows are purged
  on contact. M7 will ALTER `practice_sessions` for hunt mode, so M7 touches nothing cart-side.
- **Session design (documented limitation):** lazy mint on the first cart **mutation** (reads
  never create sessions); cookie `mpl_session` (HttpOnly, SameSite=Strict, Path=/, Max-Age
  604800, `Secure` only over HTTPS); token = 16 random bytes as 32 hex chars; fresh session =
  delete the cookie (no login exists until M5). Two rapid first-adds from a cookieless browser
  could mint two sessions; the UI disables cart controls while a mutation is in flight and
  double-submissions therefore can't orphan lines from the learner's perspective.
- **API (`src/server/cart.ts`):** `GET /api/v1/cart` (never mints; clears stale cookie;
  empty cart otherwise), `POST /api/v1/cart/items` (validate slug format → product must exist
  and be active → inventory must be > 0 → mint session if needed → 400 for bad quantity or
  `>99`, 422 `out_of_stock`, 422 `insufficient_stock` with `availableStock`/`maxQuantity`;
  stock-guarded `INSERT … ON CONFLICT … DO UPDATE … WHERE …` clause makes oversell
  impossible even in a race), `PATCH /api/v1/cart/items/:id` and `DELETE …/:id` (id must be a
  positive integer; non-numeric → 400; everything is scoped to the caller's cart — other
  sessions get 404), `DELETE /api/v1/cart` (clear, idempotent). All responses recompute
  `lineTotalCents = price_cents * quantity` and `totalCents = subtotalCents` (integer cents;
  shipping/discounts/tax don't exist until M4) from the **current** catalogue, so adding after
  a price change or deactivation is honest: deactivated/under-stocked lines stay in the cart
  flagged `available: false` / `exceedsStock: true`, cart sets `hasUnavailableItems: true`,
  and the UI surfaces per-line warnings and a summary Callout. Error envelopes stay
  `{ error, message, … }` consistent with the catalogue API.
- **Frontend:** `CartProvider` + `useCart` (context split into `cart-context.ts` /
  `CartContext.tsx` / `useCart.ts` to satisfy react-refresh) — on mount, fetches the cart,
  replaces state with the **server-recomputed** cart after every mutation, exposes
  `pending` to disable controls. `/cart` page (`CartPage` → `CartView` presentational split):
  breadcrumb, `PageHeader`, honest session note, loading/empty/error(`role="alert"` + Try
  again)/ready states, per-line name link, unit price, stock tag, −/number/+ stepper
  (input commits on blur/Enter, Escape resets, +/- respect 99-cap and known stock ceiling),
  line total, Remove, summary panel (Items count, Subtotal, Cart total, *Checkout is not
  implemented yet* note, Clear cart, Continue shopping), `hasUnavailableItems` warning
  Callout, and per-line `role="alert"` notes for deactivated/under-stocked items. Top bar
  gained a cart entry point with an item-count badge (`aria-label` includes the count).
  Product cards and the detail page gained Add to cart (disabled + "Out of stock" when
  unavailable; detail gets a quantity stepper `#product-add-quantity` 1–99). Two inline SVG
  icons added to the existing set (`cart`, `minus`, `plus` — no icon package).
- **`fake-d1.ts` harness extended:** `batch()` now executes statements inside one SQLite
  transaction with all-or-nothing rollback (mirrors D1's contract, used by a rollback test),
  and `PRAGMA foreign_keys = ON` is set to match D1's FK enforcement/cascade behaviour.
- **Verification:** `npm run check` — **passed** (ESLint clean, all three TS projects clean,
  **155/155 tests**, was 98; +35 cart API tests incl. tampering/IDOR/expiry/batch-rollback,
  +23 shop cart-API/view SSR tests, schema guard updated to `schema_version = 3`).
  `npm run build` — passed (JS **408.70 kB** / gzip 123.21 kB, +12.08 kB raw vs P3-M2;
  CSS **59.45 kB** / gzip 12.17 kB; no new runtime dependencies). Playwright/Chrome probe
  against the production build on port **8791** (8788 untouched): **61/61 checks pass** —
  refresh persistence of the badge across reloads, quantity committed via input and buttons,
  removal, clear, empty state, out-of-stock disabled Add, two-browser-context isolation,
  browser-stored cookie attributes (HttpOnly/SameSite=Strict/Path=/Max-Age 7d), both themes
  × 375/768/1024/1440 for `/cart` and `/shop` with zero overflow and exactly one h1, zero
  console errors. Screenshots `/tmp/opencode/p3m3-cart-*.png` (not committed). Port 8788's
  owner process was not modified; my 8791 processes were stopped afterwards.
- **Docs:** README.md (Phase 3 status, cart endpoints + session model, limitations),
  `docs/phase-3-commerce-practice-plan.md` (M3 marked implemented), AGENTS.md (state line),
  PROJECT_STATE.md.
- **Git:** milestone committed as `feat: implement session-based shopping cart` (hash in the
  final report). `main` untouched, nothing pushed, P3-M4 not started.
- **Next exact action:** STOP. Await instruction to start **P3-M4 (checkout & orders)** —
  do not begin without approval.

### 2026-11-15 — Phase 3 P3-M2: storefront catalogue UI

- **Branch / commit before work:** `feat/phase-3-commerce-practice` @ `0841783` (P3-M1), tree
  clean; `main` untouched; nothing pushed. All changes land in the milestone commit at the end
  of this turn (hash in final report).
- **API extension (justified, in agreed scope):** `GET /api/v1/products` gained an optional
  `q` parameter — case-insensitive (SQLite ASCII) match on `p.name`, `p.description` and
  `c.name`, `%q%` pattern with `ESCAPE '\'` and LIKE wildcards (`%`, `_`, `\`) escaped in user
  input; the value is trimmed to 80 chars after whitespace collapse. Bind-parameter only;
  out-of-format input simply matches zero rows. 7 new search tests in
  `tests/server/catalogue.test.ts` (matches on name/description/category, case-insensitivity,
  wildcard literalness, combination with category/sort/pagination, no-match empty page).
  Without this, the storefront's required search would have been frontend-only and misleading.
- **Routes:** `/shop` (catalogue) and `/shop/products/:slug` (detail), both inside `AppShell`.
  Sidebar Workspace section gained a `Shop` item (new inline `shop` shopping-bag icon added to
  the existing inline SVG set; no icon package).
- **Catalogue page:** heading + introduction, honesty mono-line (“Fictional practice
  storefront · API-backed catalogue · no checkout”), 12-up product grid
  (`minmax(260px, 1fr)`), each card = one h3 title link (stable
  `/shop/products/:slug`), 2-line description, price (`Intl.NumberFormat` USD), category meta,
  stock pill with dot + text label (`In stock` / `Low stock` / `Out of stock`, never colour
  alone). Controls: labelled search (`#shop-search-input`, icon, ×-clear, Escape clears,
  200 ms debounce → `replace`), category select fed by `/api/v1/categories`, sort select
  (Newest / Name A–Z / Price: low→high / high→low), Clear-all (disabled when idle), result
  count in `aria-live="polite"`, pagination with prev/numbered/next as real links
  (`aria-current="page"`), out-of-range `?page=` renders an honest “beyond the end of the
  catalogue” recovery state linking to page 1.
- **URL-driven state (mirrors `src/lib/catalog.ts`):** `?q=&category=&sort=&page=`; unknown or
  invalid values fall back to defaults (verified by unit tests, incl. `category=Travel`
  lower-casing and SQL-ish input falling back to `all`); defaults are omitted from the URL;
  refresh preserves state; Back/Forward step through facet/sort/page changes; search typing is
  debounced with `replace`. Detail links are stable slugs.
- **Product detail page:** breadcrumb (Dashboard → Shop → product), PageHeader h1 = product
  name, category fact links back to `/shop?category=<slug>`, `FactList` (Category link +
  catalogue code = slug, shown as a teaching aid for the API), sticky purchase aside with
  price, currency, stock pill, and a “Practice storefront” Callout stating the catalogue is
  fictional with cart/checkout explicitly not implemented (no fake cart/CTA anywhere).
  Loading → `LoadingState` (one h1 kept), unknown/inactive slug → `EmptyState` + “Back to the
  shop”, fetch/HTTP failure → `ErrorState` (`role="alert"`) + “Try again”.
- **Fetch layer (`src/features/shop/api.ts`):** `fetchProducts` / `fetchProduct` /
  `fetchCategories` with `Accept: application/json`, `AbortSignal` support, typed
  `ShopApiError` carrying `status`; 404 on the detail endpoint maps to `null` (not-found)
  rather than an exception. Requests are keyed to the URL query string with derived loading
  state (no synchronous `setState` in effects; continuation-based updates); `categories`
  fetch is separate, and a categories failure degrades to an inline `role="alert"` note with
  retry while products still render. No duplicate requests; Back/Forward is handled by the
  URL being the source of truth.
- **Verification:** `npm run check` — **passed** (ESLint clean; all three TS projects clean;
  **98/98 tests**, was 57; +41 new). `npm run build` — passed: JS **396.62 kB** (120.09 kB
  gzip, +13.30 raw vs P3-M1), CSS **55.45 kB** (11.68 kB gzip, +3.84 raw); no new runtime
  dependencies. `tsconfig.app.json` now includes `tests/shop/views.test.tsx`;
  `tsconfig.functions.json` excludes it; vitest include glob widened to `.tsx`. Browser probe
  (Playwright/`channel: chrome` vs fresh production build on port **8789**, after confirming
  8788 was untouched): **70/70 checks pass** — deep links, refresh persistence, Back/Forward,
  debounce, all filters/sort/pagination paths, empty/error/out-of-range/not-found states and
  their recovery actions, both themes × 375/768/1024/1440 (no overflow, exactly one h1),
  h1 focus after client-side nav, visible 2 px focus ring on card links, sidebar `Shop` entry
  with `aria-current="page"`, all 11 pre-existing routes + deep links still 200, no
  unexpected console errors. Screenshots in `/tmp/opencode/p3m2-*.png` (not committed).
- **Known limitations:** storefront is read-only — no cart, checkout, auth, bug-hunt mode or
  persistence (P3-M3+); product cards are text-first (no photography/icon package yet);
  `sort=newest` remains `id DESC` (seeded `created_at` is a constant); search is LIKE-based
  and name/description/category only; the API has no `SKU` field so the detail page shows the
  slug as “Catalogue code” instead; `npm run check` covers render markup via SSR string
  assertions, not DOM interaction (Playwright probe is not committed, same convention as
  Phase 2/2.5).
- **Git:** milestone committed as `feat: implement e-commerce storefront catalogue` (hash
  recorded in the final report). `main` untouched, nothing pushed.
- **Next exact action:** STOP. Await instruction to start **P3-M3 (cart)** per the plan; do not
  begin it without approval.

### 2026-11-15 — Phase 3 kickoff: branch, plan (P3-M1…P3-M9) and P3-M1 domain foundation

- **Branch:** `feat/phase-3-commerce-practice` created from synchronized `main` @ `394691c` (Phase 2.5 merge `c5eca37`/PR #2 and OpenCode workflow docs `394691c`/PR #3 both confirmed present; working tree was clean; `main` untouched; nothing pushed).
- **Plan doc added:** `docs/phase-3-commerce-practice-plan.md` — full milestone breakdown (P3-M1 domain foundation → P3-M2 storefront catalogue UI → P3-M3 cart → P3-M4 checkout & orders → P3-M5 synthetic auth → P3-M6 inventory depth → P3-M7 bug-hunt engine v1 → P3-M8 defect set & scenario wiring → P3-M9 hardening/exit), bug-hunt engine architecture (server-controlled activation, hunts/defects in code, `practice_sessions` + `mpl_session` cookie isolation, reset flow, M7/M8 implementation), API surface per milestone, scenario sketch, free-tier impact, §12 status summary.
- **P3-M1 implemented:** migration `db/migrations/0002_commerce_domain.sql` (`categories`, `products`, `inventory`; `schema_version` → `2`; 8 categories, 42 products (40 active), 42 inventory rows; fixed `created_at` in seed for full determinism); `src/shared/commerce.ts` (contracts, `stockStatus` from SQL CASE); `src/server/catalogue.ts` (`GET /api/v1/products` with `page`/`perPage`≤48/`category`/`sort`, `GET /api/v1/products/:slug` active-only with 404 envelope, `GET /api/v1/categories`); `src/server/app.ts` mounts `/api/v1`; `tests/helpers/fake-d1.ts` (node:sqlite-backed, applies real migrations — no SQL mocks); `tests/server/catalogue.test.ts` (16 tests). One design fix during verification: an out-of-format `category` filter is now tolerated and simply matches zero rows (parameter-bound) instead of being silently dropped — least-surprising API contract.
- **Verification:** `npm run db:migrate:local` applied 0002 (10 commands); local D1 confirms 8/42/40/42 rows and `schema_version=2`. `npm run check` — passed (ESLint clean, all three TS projects clean, **57/57 tests**). `npm run build` — passed (JS 383.32 kB / gzip 116.54 kB; CSS 51.61 kB — unchanged, no frontend changes). End-to-end through `wrangler pages dev` on **port 8789** (production build): `/api/health` returns `schemaVersion: "2"`; list/detail/categories/404 all correct; seeds return real data. **Port 8788 was already in use by an unrelated local `workerd` process, so verification ran on 8789; the existing process and its 5173 neighbour were not modified, and my 8789 processes were stopped afterwards.** Killing stale 8788 remains the user's call.
- **Docs:** README.md (Phase 3 status, `/api/v1` reference, limitations), PROJECT_STATE.md (§1, §9, §10, §11, new §12, resume prompt → §13), `docs/phase-3-commerce-practice-plan.md`. AGENTS.md updated for Phase 3 in-progress state (still minimal).
- **Not done / deferred:** no storefront UI (P3-M2, unstarted); no cart/orders/auth/inventory runtime; bug-hunt engine is design-only (§12); no remote Cloudflare resources created; no persistence of learner progress; M9 polish still on request only.
- **Next exact action:** STOP. Await instruction to start **P3-M2 (storefront catalogue UI)** — the next milestone per the plan. Do not start it without approval.

### 2026-11-15 — OpenCode token-efficiency configuration (tooling only)

- **No application code, content, tests, or Git history changed.** This turn inspected and tuned the OpenCode configuration for this project's workflow before Phase 3 begins.
- **Documentation preservation:** this optimization was recorded on the `docs/opencode-workflow-optimization` branch and merged into `main` via PR #3 (https://github.com/thisishamza/qa-practice-lab/pull/3). The change reviewed there is this section plus the `AGENTS.md` "Token-efficient workflow" section under `## Workflow`.
- **Inspection:** the project has no `opencode.json(c)`; the global config at `~/.config/opencode/opencode.json` contained only one local MCP server (`rea`). No model or provider configuration exists in files — the model (Inkling 2 Small Free via OpenRouter) is chosen in the TUI and is untouched. `~/.config/opencode/service.json` (OpenCode's own service registration) was deliberately not read or modified.
- **Change:** merged into the global config (after a timestamped backup at `~/.config/opencode/opencode.json.bak-20261115T131319Z`):
  - `$schema: https://opencode.ai/config.json` (editor validation only)
  - `compaction: { auto: true, keep: { tokens: 8000 }, buffer: "20%" }` — automatic compaction on, ~8k tokens of recent conversation retained beside the summary instead of the 15k default, and 20% of the model window kept free instead of the 15% default (applies to every model; compacts at 80% full).
- **Verification:** `mcp.rea` preserved byte-for-byte and asserted programmatically; the merged file re-parses; no other settings were touched.
- **AGENTS.md:** added a "Token-efficient workflow" section (one milestone per session, PROJECT_STATE.md handoff, narrow prompts, check-once discipline, small tool output, no marathon sessions). No useful instruction was removed; the section overlaps deliberately with nothing that already exists.
- **Backups:** the original global config is retained at `~/.config/opencode/opencode.json.bak-20261115T131319Z`.
- **Known limitations:** compaction is lossy by design — if a session grows long, starting a fresh one is still cheaper and cleaner. The compaction config is user-level (all projects); if a project-only scope is preferred later, move the `compaction` block into a project `opencode.json` instead.
- **Next:** Phase 3 (commerce practice app) remains paused awaiting explicit instruction.

### 2026-11-15 — Redesign M8: final consistency, remaining pages and design audit

- **Checkpoint before this milestone:** the M7 diff contained exactly the eight expected files (`ProgressPage`, `PracticePage`, `HealthStatus.tsx`, `styles/{workspace,components,pages}.css`, `AGENTS.md`, `PROJECT_STATE.md`). `npm run check` and `npm run build` were re-run on the M7 state, then M7 was committed as **`c200095`** (`feat: redesign progress and practice experience`, 8 files, +529/−546). Nothing pushed. M1 `b84b210`, M2 `d77a446`, M3 `c89ced0`, M4 `d94f3b1`, M5 `16222ad`, M6 `c1867e9` untouched.
- **Phase 2.5 completion and merge:** M8 was committed as **`5c4a959`** (`feat: redesign track detail, 404 and final consistency audit`, 8 files, +159/−223), with a docs-only follow-up commit **`f014e78`**. A docs-only README correction for Phase 2.5 landed as **`98dbe55`**. On 2026-11-15 the branch was pushed to `origin/feat/phase-2.5-redesign` and **PR #2 (`Complete Phase 2.5 UI redesign`, https://github.com/thisishamza/qa-practice-lab/pull/2) was opened against `main`**; it was clean (`mergeable: true`, `mergeable_state: clean`), with no branch protection and no CI check runs configured on the repository. The redesign was merged into `main` via PR #2 on 2026-11-15. Phase 3 (commerce practice app) is the next milestone and has not been started.
- **Track Detail page (outstanding from M4):**
  - Removed the "Track facts" panel (duplicated LevelMeter/planned/listed already in the meta row) and the boxed "What planned means" callout (now a one-line `.tracks-note`).
  - **"All scenarios" deep link** now points at `/scenarios?track={track.id}` — the catalogue opens pre-filtered to this track (verified: select shows `manual-testing`, 2 cards).
  - "Explore next" (arbitrary first-three tracks) replaced with **Related tracks** derived by shared `categoryIds` — a real, deterministic relationship (manual-testing → API testing, UI automation, Database testing), each row with icon, name and mono meta (level · planned).
  - FactList removed from the page; `aside-link-list` restored in CSS after M6 deleted it in error (it is still used by Scenario Detail and was missing there — a real regression found during M8 inspection and fixed).
  - Learning objectives, getting-started steps and scenario cards unchanged; back-to-tracks via breadcrumb; starting-guide panel kept.
- **404 page:** legacy radial gradient + shadow + giant accent 404 removed. New design: mono `Error · 404` eyebrow, h1, two actions (`Back to the dashboard`, `Search the catalogue`), then three recovery rows in the M4 start-step pattern (catalogue / tracks / guides). No decorative hero, developer details, or gradients. 404 behavior unchanged.
- **Shared State adoption:** the shared `States.tsx` family (Loading/Empty/Error, `.state` patterns) was found already adopted at the only genuine call sites (every not-found/empty path uses `EmptyState`; no ad-hoc empty/loading/error implementations remain anywhere). `ErrorState`'s call sites do not exist yet because there is still no async error surface; it stays exported for the future route error boundary (deferred to M9/M8-review — flag if you want it now). No duplicate state components exist.
- **Token/CSS cleanup:** every compatibility alias (`--bg`, `--bg-elevated`, `--surface-2`, `--surface-3`, `--muted`, `--muted-strong`, `--line`, `--line-strong`, `--accent*`, `--cyan`, `--success*`, `--warning*`, `--info*`) now has zero consumers — removed from `tokens.css` (light defaults, dark overrides, workspace re-declarations); the one consumer (`base.css` skip link) moved to `--canvas`. `.not-found`, `.not-found-code`, `.category-card*`, `.category-grid`, `.category-icon`, `.category-copy`, `.category-count` deleted (orphaned after dashboard in M4 and 404/tracks in M8). `layout.css`, `pages.css` audited — no other orphans found. `workspace.css` untouched.
- **About page:** one line corrected to match M7 ("Progress is not tracked or saved; …labelled sample data" — was the stale "activity figures are labelled demo data").
- **Accessibility & responsive audit (all routes × 375/768/1024/1440 × light/dark):** one `h1` per route, no overflow, unique accessible link names app-wide (**zero ambiguous names** across all 11 routes), focus rings visible on every interactive element tested (the top-bar search input intentionally focuses its container ring), reduced-motion confirmed to neutralise animations (drawer animationName = none under `reduce`), `forced-colors` guard present. Runtime contrast probe: ink/canvas 15.7–16.1:1, muted 7.3–8.1:1, input boundary 3.28–3.68:1, tags ≥6.4:1, primary buttons ≥14.6:1 — all pass.
- **Commands and results:**
  - `npm run check` — **passed** (ESLint clean; all three TS projects clean; **41/41 tests pass**).
  - `npm run build` — passed. Final: JS **383.32 kB** (116.54 kB gzip), CSS **51.61 kB** (11.20 kB gzip). Versus M7: **−0.16 kB JS, −3.15 kB CSS**. No dependency changes.
  - Regression probes vs fresh build: **121/121** (M3/M4), **66/66** (M5), **83/83** (M6), plus M7 workspace/error-state checks — all pass. No console or page errors.
  - Screenshots of the redesigned Track Detail and 404 at 375/1024/1440 in both themes live in `/tmp/opencode/m8-*.png`, not in the repo.
- **Branch / latest commit:** `feat/phase-2.5-redesign`; M8 was committed after verification as **`5c4a959`** (`feat: redesign track detail, 404 and final consistency audit`, 8 files, +159/−223). Latest commits: `5c4a959` (M8), `c200095` (M7). Nothing pushed. The Phase 2.5 redesign (M1–M8) is complete on this branch, ready to merge into `main`.
- **Known limitations / outstanding:**
  - Route error boundary and route-level error UI remain undone (assigned to M7 in the audit, not delivered; a candidate for M9 polish alongside Playwright + axe committed tests).
  - `ErrorState` remains exported but unreferenced; by design until an async surface exists.
  - The theme-color/typography contracts (font licensing lines, fallback metrics) remain open since M1.
- **Blockers:** none. **Phase 2.5 redesign is complete (M1–M8).**
- **Next exact action:** Stop and await instruction. Options, in order of precedence: **M9 (optional polish)** only on explicit request, or **Phase 3 — commerce practice app**, which remains paused until the user approves resuming it. Neither starts without instruction.

### 2026-11-15 — Redesign M7: progress and practice experience

- **Checkpoint before this milestone:** the M6 diff contained exactly the six expected files (`GuidesPage`, `GuideCard`, `GuideDetailPage`, `styles/components.css`, `AGENTS.md`, `PROJECT_STATE.md`). `npm run check` and `npm run build` were re-run on the M6 state, then M6 was committed as **`c1867e9`** (`feat: redesign guides learning experience`, 6 files, +386/−138). Nothing pushed. M1 `b84b210`, M2 `d77a446`, M3 `c89ced0`, M4 `d94f3b1`, M5 `16222ad` untouched.
- **Scope (as instructed):** Practice landing, Progress page, supporting components/styles. **Track-detail redesign remains explicitly deferred and outstanding — not started in M7 either.** Scenario catalogue (M5), guides (M6), dashboard/tracks (M4), 404 (audit M7 also assigns 404 to this milestone but the explicit instruction scoped only practice/progress — 404 and the shared State adoption are not done; M8 or a follow-up should own them; flag if they should be added). No backend, no persistence, no dependencies.
- **Actual persistence status (honest answer):** **none exists.** Nothing on these pages writes learner state; the only browser storage keys in the app are `qa-practice-lab-theme` (theme) and `qa-practice-lab-sidebar-collapsed` (sidebar). Theme preference remains accurate as "the only thing this browser stores" — stated on the page.
- **Practice page:**
  - Header now leads with the real action: `Explore the catalogue` primary CTA → `/scenarios`.
  - **Available now** zone — three ordered steps (guide → scenario → track) linking to real content the learner can use without a runtime, via the M4 start-step rows.
  - **Runtime status** panel — first real use of `data-surface="workspace"` in a shipped route: dark mono header strip (RUNTIME STATUS + status dot), Hono/D1 facts (service version, schema version, checked-at, exercise targets = Not implemented), plain-language body, **Check again** retry button. Error copy is user-facing ("The practice API could not be reached. Learning content still works — only this runtime check fails.") — the `npm run db:migrate:local` / port 8788 developer instructions are gone. `HealthStatus` keeps `aria-live="polite"` and adds continuation-based state updates (effect has no synchronous setState; `react-hooks/set-state-in-effect` clean).
  - **Practice formats** — six planned formats kept, clearly tagged Planned / Not available; no launch controls implied.
  - **Safety boundaries** — kept, condensed (4 rules).
- **Progress page:**
  - Removed all fabricated achievements from view: stat tiles ("Completed/Streak/Weekly goal (demo)"), recent activity list, and the "What is real right now" panel (the About page owns build reality).
  - New structure: header with honest lede → one-line note ("No activity is recorded in this build. Your theme preference is the only thing this browser stores.") → **"What progress will look like"** — a single sample preview panel (4 track rows, `2/8 · 25%` etc., tagged `Sample`, with the demo disclaimer intact) → **"What will be tracked"** — four planned capabilities (completion, attempts/scoring, recently visited, streaks), tagged `Planned`, each one line → **"While you wait"** — the three real learning links (reuse of the start-step rows).
  - **Real vs sample:** nothing on the page is real learner data. The only sample content is inside the `Sample`-tagged panel and is labelled as demonstration data three times (section action tag, section description, panel disclaimer).
- **CSS:** `.workspace-panel` family fills the `workspace.css` scaffold (mono strip head, status dot states run/warn, 2-col fact grid → 1-col ≤640px). Deleted ~250 lines of now-unused rules: `.stats-grid`, `.demo-stat-*`, `.activity-list*`/`.activity-copy`/`.activity-time`, `.reality-list*`/`.reality-*`, `.health-panel`, `.health-heading`, `.status-badge*`, `.muted`, `.health-details*`, `.hint*`. Added `.progress-note`, `.tracked-list` to `pages.css`. **Regression found and fixed:** the rule deletion broke the `.check-list`/`.plain-list`/`.step-list` container rule (invalid selector group → list items laid out in a row and overflowed 375 px); restored the intended `flex-direction: column` rule and verified via computed style + overflow probes.
- **Commands and results:**
  - `npm run check` — **passed** (ESLint clean, all three TS projects clean, **41/41 tests pass**). One lint failure occurred during development (`react-hooks/set-state-in-effect` on `useEffect(() => { void refresh() })`) and was fixed by continuation-based updates before the final run.
  - `npm run build` — passed. Final: JS **383.16 kB** (116.57 kB gzip, −0.49 vs M6), CSS **54.76 kB** (11.55 kB gzip, −1.11 vs M6). No dependency changes.
  - Browser verification (Playwright/Chrome vs fresh production build): **M3/M4 regression probe 121/121 pass, M5 catalogue probe 66/66 pass, M6 guides probe 83/83 pass.** M7-specific probes: both themes × 4 widths × 2 routes with no overflow and one `h1`; workspace panel renders the dark palette inside a light-themed page; simulated `/api/health` 503 exercises the error state (Needs attention, retry keeps working, facts hidden — retry button remains); screenshots `m7-*.png` in `/tmp/opencode`.
  - One overflow regression (375 px, three routes) was caught by the existing probe, root-caused to the selector deletion above, fixed, and re-verified at all widths in both themes.
- **Known limitations / deferred:**
  - **404 redesign + shared `State` family adoption** (audit M7 also assigns these to M7) were NOT done — the explicit instruction scoped M7 to practice/progress; the 404 gradient/shadow remain for M7-follow-up or M8.
  - Sample preview remains by design (single labelled instance) — replace with a real empty state once persistence lands.
  - `/progress` exercise links require the practice runtime; all current rows honestly point at learnable content.
  - HealthStatus "Exercise targets: Not implemented" is hard-coded intentionally (no runtime exists).
- **Branch / latest commit:** `feat/phase-2.5-redesign`; M7 changes uncommitted at report time (`git status`: 6 modified files, nothing untracked). Latest commits: `c1867e9` (M6), `16222ad` (M5). Nothing pushed.
- **Blockers:** none.
- **Next exact action:** Stop and await instruction. On approval, start **M8 — accessibility, responsive verification, tests, docs** from `docs/phase-2.5-ui-ux-audit.md` §11 (run `npm run check` first). Track-detail redesign remains outstanding (audit M4 scope). Do not start Phase 3.

### 2026-11-15 — Redesign M6: guides experience

- **Checkpoint before this milestone:** the M5 diff contained exactly the eight expected files (`catalog.ts`, `ScenariosPage.tsx`, `{ScenarioFilterBar,ScenarioCard}.tsx`, `styles/components.css`, `tests/lib/catalog.test.ts`, `AGENTS.md`, `PROJECT_STATE.md`). `npm run check` and `npm run build` were re-run on the M5 state, then M5 was committed as **`16222ad`** (`feat: redesign scenario catalogue`, 8 files, +988/−126). Nothing pushed. M1 `b84b210`, M2 `d77a446`, M3 `c89ced0`, M4 `d94f3b1` untouched.
- **Scope (as instructed):** Guides listing, Guide Detail reading experience, and guide discovery/navigation. **Track-detail redesign remains explicitly deferred — it was not started in M6 and is still outstanding from the M4 audit.** Scenario catalogue (M5), progress/practice pages (M7), dashboard/track redesign, backend, and dependencies untouched. Scenario/progress pages not in scope and were not touched.
- **Skill:** loaded earlier this session; focused `--domain ux` query on reading line length verified (65–75 ch; implemented as 66ch `--prose-measure` at 1.7 leading — already the approved system). The `--stack react` query for code blocks returned no database match; standard `pre` + `overflow-x: auto` practice applied instead, stated explicitly.
- **Listing changes (`src/pages/GuidesPage.tsx`, `src/features/guides/GuideCard.tsx`):**
  - Header kept (`Learning library` eyebrow, title, self-contained-guides description); the boxed callout was replaced by one honest mono line (`6 guides across 6 disciplines — all readable today`).
  - Index rows replace the card grid: title link (the only link), 1–2 line summary, then `LevelMeter · read time · concepts · steps` meta; chevron-right affordance; hover = border-strong. Grouped by discipline with existing SectionHeader rows (one per discipline, unchanged IA).
  - No search/filters (6 guides across 6 disciplines don't justify them), no fake metrics, no decorative icons.
- **Detail changes (`src/pages/GuideDetailPage.tsx`):**
  - **Reading layout:** article capped at 74ch; prose at 66ch/1.7; `h2` at `--text-h2` with scroll-margin for the sticky top bar; semantic `<article>` + sectioned `h2`s; one `h1`.
  - **Concepts** became a test-report definition list: mono term left, explanation right, hairline row dividers (was: left-rule card boxes).
  - **Code examples:** always-dark `pre` (`--code-bg`) with mono `--text-code`, `white-space: pre`, independent horizontal scroll; figcaption = semibold title + neutral language tag; gold-standard for the Phase 4+ API examples.
  - **Steps:** hairline square mono numerals (were filled rounded chips).
  - **TOC:** scrollspy via `IntersectionObserver` (`rootMargin: -15% 0px -70% 0px`); exactly one `aria-current="true"` + `.is-active` at a time; ≥1180px it stays sticky in the aside; ≤1180px it is a native `<details>` "On this page" disclosure above the article (hidden sidebar), keyboard-operable without JS.
  - **Facts:** the "Guide facts" panel (duplicate of the header meta) was removed; the aside now holds only the TOC.
  - **Navigation:** related scenarios (unchanged rows), sibling guides surfaced at the end of the article as index rows under "More in this discipline", and a **guide-library pager** (Previous / Next, ordered by the data file; real content, no wrap). Breadcrumb remains the back-to-guides path.
  - **Mobile:** single column; mobile TOC above the article; code scrolls independently; no page overflow at 375.
- **CSS:** `.guide-row*`, `.guides-note`, concept-list row styles, step-number chip, code-example dark pre, `.toc-mobile` (details/summary), `.guide-pager*` (2-col → 1-col ≤640), `.guide-article` cap, ≤1180px hide-TOC/show-details rules, `.aside-link-list`, `.guide-grid`, `.guide-card-top/.guide-icon`, `.guide-index-meta` deleted. `.body-copy` now uses `var(--prose-measure)`.
- **Commands and results:**
  - `npm run check` — **passed** (ESLint clean; all three TS projects clean; **41/41 tests pass**, unchanged — no content or logic changed that tests cover).
  - `npm run build` — passed. Final: JS **383.67 kB** (117.06 kB gzip, +0.75 vs M5), CSS **55.87 kB** (11.71 kB gzip, +2.28 vs M5). No dependency changes.
  - Browser probe (`m6-verify.mjs`): **83/83 pass** — all six guide detail routes render with one `h1`, 7 TOC links, mono code blocks; TOC has exactly one active entry ("Introduction"); related scenario and pager navigation work (previous guide appears on the API guide); invalid id → EmptyState + recovery; mobile `<details>` TOC toggles open/closed with 7 links; focus rings on guide row title links and TOC links; no overflow at 375/768/1024/1440 in both themes; zero console errors.
  - M5 regression probe: **66/66 pass**. M3/M4 regression probe: **121/121 pass**.
  - Screenshots (light/dark × 4 widths for listing and detail) live in `/tmp/opencode/m6-*.png`, not in the repo.
- **Fix during verification:** one probe assertion raced client-side navigation (read pager text before React re-rendered); fixed the probe to wait for the destination `h1` — the pager itself was correct.
- **Branch / latest commit:** `feat/phase-2.5-redesign`; M6 changes uncommitted at report time (`git status`: 4 modified files). Latest commits: `16222ad` (M5), `d94f3b1` (M4). Nothing pushed.
- **Known limitations:** the pager uses data-file order (not per-discipline grouping) — acceptable, matches the library index; "More in this discipline" is absent for disciplines with a single guide (currently the norm — by design); no progress/reading-time tracking added (out of scope; M7 owns progress); TOC active state only tracks section starts (no character-level position — adequate).
- **Blockers:** none.
- **Next exact action:** Stop and await instruction. On approval, start **M7 — progress, practice/workspace, 404, states** from `docs/phase-2.5-ui-ux-audit.md` §11 (run `npm run check` first). Track-detail redesign remains outstanding (audit M4 scope). Do not start Phase 3.

### 2026-11-15 — Redesign M5: scenario catalogue

- **Checkpoint before this milestone:** the M4 diff contained exactly the eight expected files (`DashboardPage`, `TracksPage`, `NotFoundPage`, `TrackCard`, `styles/{components,pages}.css`, `AGENTS.md`, `PROJECT_STATE.md`). `npm run check` and `npm run build` were re-run on the M4 state, then M4 was committed as **`d94f3b1`** (`feat: redesign dashboard and learning tracks`, 8 files, +386/−454). Nothing pushed. M1 `b84b210`, M2 `d77a446`, M3 `c89ced0` untouched.
- **Scope (as instructed):** catalogue page only. Scenario detail pages were NOT redesigned. **Track-detail redesign (audit M4 scope) is explicitly deferred and remains outstanding — it was not started in M5 either; it is tracked here and in the M4/M6 handoff, not silently closed.** Dashboard category deep links are not needed (categories are chosen on the catalogue) — `?category=` works directly. Guides (M6), progress/practice (M7), backend, and dependencies untouched.
- **What was built:**
  - **URL is the single source of truth** (`useSearchParams` + pure helpers in `src/lib/catalog.ts`): `?q=&track=&difficulty=&mode=&status=&category=&sort=`. Unknown/invalid values fall back to the default rather than erroring (verified by unit tests). Text edits use `replace` (no history spam); facet changes and sort changes use `push` (Back/Forward step through them). Default values are omitted from the URL.
  - **Search** — matches title, summary, description, objectives, prerequisites, ids, and hyphen/space variants across track/mode/category/difficulty/status (existing matcher, extended with `category`). Labelled input, clear-× control, Escape clears, `role="search"` on the panel. Worked examples verified: `q=cart` → 5 cards, refresh preserves state, top-bar `/` deep link `/scenarios?q=cart` still works.
  - **Filters** — Track, Difficulty, Mode, Status, Category (all real data dimensions; 11 exploratory, 13 clean / 11 bug-hunt, 14 planned / 10 in-design, 0 ready). Multiple filters combine; each active facet renders a removable **chip** (e.g. `Track: API Testing ×`); **Clear all** resets filters + search + sort; result count in an `aria-live` region; the results grid is no longer wrapped in `aria-live` (announced via the count only).
  - **Sorting** — `recommended` (authored order, default), `title` (A–Z), `difficulty` (beginner→intermediate→advanced), `time` (shortest first). Sort persists in the URL; no popularity/rating options exist.
  - **Availability honesty** — a mono line under the header states real data (`Not runnable yet — 10 in design · 14 planned · 0 ready`); the old callout was removed; no metrics imply persistence or execution.
  - **Responsive** — ≥861px: full control grid (search + six labelled selects); ≤860px: facet grid hidden; search stays, a sort select sits inline with a **Filters (n)** trigger that opens a proper drawer: `role="dialog"` + `aria-modal`, `aria-labelledby`, Tab/Shift+Tab trap, initial focus on the close button, Escape/backdrop close, body scroll lock, focus restored to the trigger, `Show N scenarios` CTA, auto-close at ≥1024px. The grid of cards is 3-up at 1440 / 2-up at 1024/768 / 1-up at 375.
  - **Cards** — StatusTag + title link (only link), summary, meta now `Track · Difficulty · Mode · Time · Category`; fully labelled, no color-only signalling.
- **Tests & verification:**
  - `npm run check` — **passed** (ESLint clean; all three TS projects clean; **41/41 tests pass** — 11 new: URL-param parse/serialize/round-trip, invalid-param fallback, sort orders, category filter, status counts). One test assertion was written wrong and fixed during development (`status=bogus` now used for invalid input; `ready` is a valid status).
  - `npm run build` — passed. Final: JS **382.92 kB** (116.75 kB gzip, +6.98 vs M4), CSS **53.31 kB** (11.43 kB gzip, +2.49 vs M4). No dependency changes.
  - Browser probe (`m5-verify.mjs`, Playwright/Chrome vs production build): **66/66 pass** — deep links at all widths, refresh persistence, Back/Forward, chip add/remove, Clear all, empty-state recovery, scenario-card navigation, 375px drawer (scroll lock, focus trap/return, trigger count badge, Show-results), unique accessible card names at 4 widths × 2 themes, one `h1`, no overflow, focus rings, zero console errors.
  - M3/M4 regression probe: **121/121 pass**.
  - Screenshots (light/dark × 375/768/1024/1440 + drawer in both themes) live in `/tmp/opencode/m5-*.png`, not in the repo.
- **Fixes during verification:** MODE default option "Clean and bug hunt" clipped in narrow desktop selects → shortened to "All modes"; probe bug (assumed `q=cart∩beginner` = 5 cards — actually 1) corrected; stale `wrangler pages dev` instances killed so probes ran against the fresh build.
- **Branch / latest commit:** `feat/phase-2.5-redesign`; M5 changes uncommitted at report time (`git status`: 6 modified files, nothing else). Latest commits: `d94f3b1` (M4), `c89ced0` (M3).
- **Known limitations:** catalogue meta separators can start a wrapped line (accepted, aria-hidden); the mobile drawer applies facet changes immediately (URL is the source of truth — there is no staged "Apply"); availability line wraps at 375px (acceptable); no dashboard→catalogue `?category=` deep links because the dashboard no longer shows categories (M4 decision).
- **Blockers:** none.
- **Next exact action:** Stop and await instruction. On approval, start **M6 — guides index and reading page** from `docs/phase-2.5-ui-ux-audit.md` §11 (run `npm run check` first). Track-detail redesign remains outstanding (audit M4 scope) and may be scheduled before or with M6 if instructed. Do not start M7 or Phase 3.

### 2026-11-15 — Redesign M4: dashboard and tracks

- **Checkpoint before this milestone:** all M3 work was verified and belonged to the milestone, so it was committed as **`c89ced0`** (`feat: redesign M3 primitives and cards`, 35 files, +901/−803). Nothing pushed. M1 `b84b210` and M2 `d77a446` untouched.
- **Scope (as instructed):** dashboard, tracks listing, track cards/track discovery, and the dashboard's progress/activity sections. **Track detail pages were not redesigned** (navigation into them verified; they only received the M3 primitive adoption) — the approved audit assigns the track-detail rework to M4 but the explicit instruction enumerated dashboard/tracks/discovery only, so it was left out; flag if the audit's track-detail pass is wanted. Scenario catalog (M5), guides (M6), progress/practice pages (M7) untouched; no backend, no dependencies.
- **Skill:** loaded at session start (M3 turn) and reused; focused `--domain ux` queries only (heading hierarchy, font scale). No new design system — direction already approved.
- **Dashboard, removed:** gradient `.hero-panel` and availability aside, four stat tiles (including "Completed (demo)"), the "Testing categories" grid of dead-end links, the demo progress panel, the recent-activity panel, and the quick-practice panel. No remaining metrics imply persistence or progress.
- **Dashboard, added:**
  - `PageHeader` with `QA learning environment` eyebrow, h1 "Practise testing across the whole stack.", learner-outcome lede, and two CTAs (`Find a scenario` primary → `/scenarios`, `Browse tracks` secondary → `/tracks`).
  - **Your start path** — three ordered steps with mono numerals and real content IDs: read the manual-testing guide → inspect the cart-totals scenario → review the API testing track. One inline honesty line below ("exercises are not runnable yet …").
  - **Curriculum** — six compact track rows (single-tone icon, name, tagline, mono meta `Level · n exercises planned · n listed`, chevron) linking to the track detail pages, plus "All 12 tracks".
  - **Scenario catalogue** — mono counts line (`24 scenarios · 12 tracks · 6 guides`), three recommended scenario rows (curated `recommendedScenarioIds`), each with `StatusTag` and difficulty/time meta, plus "Open the catalogue". No fake metrics anywhere on the page.
- **Tracks listing:** header "Search the catalogue" action removed (top bar covers it); boxed "curriculum preview" callout replaced with one inline line (71 planned exercises; two representative placeholders; not runnable yet). `.track-grid` minimum 300 px → 3 columns at 1440, 2 at ≤1024/768, 1 at <600. `TrackCard` is compact by default: single-tone icon, `LevelMeter`, name link (the only link on the card), tagline, and a mono meta line (`n exercises planned · n listed`). The `compact` prop and card descriptions were removed; decorative per-track hues were already gone in M3.
- **CSS:** `.hero-panel`, `.hero-copy`, `.hero-accent`, `.hero-points`, `.hero-aside*`, `.hero-actions`, `.quick-practice*` and `.track-grid-wide` deleted; new `.start-path-list`/`.start-step*`, `.track-row*`, `.catalogue-counts`, `.scenario-row*`, `.tracks-note`, `.dashboard-note` with matching `.track-row-meta` / `.catalogue-counts` inline-flex separators; ≤640 px rules hide row meta and stack scenario rows; responsive hero references removed. NotFoundPage's `.hero-actions` (class deleted) migrated to `.button-row`.
- **Commands and results:**
  - `npm run check` — **passed**: ESLint clean; all three TypeScript projects clean; 3 files / 30 tests passing.
  - `npm run build` — passed. Final: JS **375.94 kB** (114.64 kB gzip), CSS **50.82 kB** (11.10 kB gzip). Versus M3: **−3.76 kB JS**, +0.63 kB CSS raw.
  - Browser verification (Playwright/Chrome against `wrangler pages dev dist`): **121/121 checks pass** (all 11 routes × 375/768/1024/1440 — overflow, one `h1`, both themes, drawer, search deep link, duplicate link names = 0). Dashboard and tracks reviewed at 375/768/1024/1440 in light and dark (screenshots `m4-*.png` in `/tmp/opencode`, not in the repo). No console or page errors. 1024 px shows an ellipsized tagline on rows without overflow; 375 px wraps page-header CTAs under the lede (intended).
- **Measured heights:** dashboard **1,708 px** at 1440 (Phase 2 was 3,120 px; audit target ~1,600 — missed by ~108 px, noted honestly) and **2,264 px** at 375 (was 6,739 px). Tracks **1,365 px** at 1440 (was 1,939 px) and **3,168 px** at 375 (12 stacked cards).
- **Fixes during verification:** mono meta separators in `.track-row-meta` / `.catalogue-counts` lacked spacing (rendered as `INTERMEDIATE·8 …`); fixed with inline-flex + 0.45rem gaps. Stale `wrangler pages dev` instances on 8788/8789 from earlier sessions were killed so verification ran against the fresh build.
- **Known limitations:** the three "start path" step 02 destination "In design"-labelled scenario opens the detail page (by design — status is shown there); demo progress still lives on `/progress` only (M7); track detail pages keep pre-M4 layout; no horizontal-overflow exception found; one start-path row arrow is top-aligned on ≤640 px by design.
- **Blockers:** none.
- **Next exact action:** Stop and await instruction. On approval, start **M5 — catalog, filters and scenario detail** from `docs/phase-2.5-ui-ux-audit.md` §11 (run `npm run check` first). Do not start M6 or Phase 3 in the same change.

### 2026-11-15 — Redesign M3: primitives and cards

- **Completed:** The third approved redesign milestone (per `docs/phase-2.5-ui-ux-audit.md` §11). No route, page layout, content, or scenario status changed; all 24 scenarios remain non-runnable placeholders and demo progress remains labelled sample data.
- **Commit state noted at takeover:** the handoff described M2 as uncommitted, but the repository shows M2 committed as `d77a446` on `feat/phase-2.5-redesign` with a clean tree; M1 is `b84b210`. Nothing was committed, reset, or pushed in this milestone.
- **Skill:** the `ui-ux-pro-max` skill was loaded before implementation; focused queries only — `--stack react` (focus management, labels, submission handling) and `--domain ux` (status/badge accessible names, compact control semantics, ARIA labels). No `--design-system` run, because the direction (The Test Bench) was already approved. Skill output was treated as recommendation and checked against repo rules.
- **Components implemented (new, `src/components/ui/`):**
  - `Button.tsx` — semantic `<button>` primitive: primary/secondary/ghost/danger variants, md (44 px) / sm (36 px), `loading` prop (spinner + `aria-busy` + disabled), `type="button"` default. Plain-router `<Link>` elements keep the shared class language (`button button-secondary button-small`); no `asChild` helper was added because nothing needs it yet.
  - `IconButton.tsx` — 40 px square, required `label` (accessible name), children aria-hidden by convention; used by ThemeToggle, the top-bar menu trigger, and the drawer close button.
  - `Tag.tsx` — `Tag` (neutral/ready/in-design/planned/warn) and `StatusTag` (status→tone mapping; dot shape + mandatory text label, never colour alone). Status dots: filled (ready), ring (in-design), hollow (planned).
  - `LevelMeter.tsx` — three 3 px bars (ascending height) + mono micro label; bars are `aria-hidden`, the text carries meaning; optional `aria-label` mode when the label is hidden.
  - `Meta.tsx` — inline dot-separated (`·`, aria-hidden separator) meta row; drops null/false children.
  - `FactList.tsx` — test-report rows (mono key left, tabular value right, hairline dividers); replaces hand-written `<dl className="fact-list">` at the four call sites (ScenarioDetail, TrackDetail, GuideDetail, Practice).
  - `StatTile.tsx` — mono micro label, tabular value, optional hint; no icon by design.
  - `workspace.css` (new, `src/styles/`) — scaffold only: comment header describing the workspace-scope contract and why no feature styles exist yet. Imported between `components.css` and `pages.css`.
- **Components updated:** `Callout.tsx` (rule-based: 3 px left rule + sunken surface; full tint only for new `danger` tone; success/warning/info/neutral icon colours, neutral uses the same ink-muted icon), `ProgressBar.tsx` (8 px track, always-visible `value/max · percent` text, `aria-valuetext`, accent fill maps to near-black action / run-green / warn), `ThemeToggle.tsx`, `TopBar.tsx` (menu trigger), `MobileNav.tsx` (close button) now use `IconButton`; `ScenarioFilterBar.tsx` and `ScenariosPage.tsx` (empty-state reset) now use `Button`.
- **Components removed:** `Badge.tsx` (six tones, pill, 10.56 px) → split into `Tag` (status) + `Meta` (text meta). `DomainBadges.tsx` → `StatusTag` + `LevelMeter`. `StatCard.tsx` → `StatTile`. `scenarioStatusTone()` in `lib/labels.ts` removed (only consumer was `DomainBadges`). `scenario.difficulty` raw id in the scenario fact list now renders `difficultyLabels`.
- **Cards de-chipped:** one `StatusTag` per `ScenarioCard` (Difficulty and Mode are plain meta text / gone from the card); `TrackCard` shows `LevelMeter` and drops the duplicate "Level" fact row; `GuideCard` shows `LevelMeter` + neutral track tag and drops the foot link; per-track icon hue CSS (12 rules) deleted — all cards use a single-tone 32 px bordered-square icon; duplicate "Open track"/"View scenario"/"Read guide" foot links removed — one accessible name per card (the title link); card shadows and hover `translateY(-2px)` removed; cards separated by hairline borders + radius 12.
- **CSS regrouped, not reorganized:** `components.css` keeps its file and cascade position; sections were rewritten in place (buttons, tags/meters, panels/callouts, stats/progress, cards, filter panel, lists/state/health). `.scenario-meta`, `.guide-meta`, `.scenario-badges`, `.stat-icon`, `.card-foot-link`, all `.badge*` and hue rules deleted. Mechanical compatibility-alias remap applied where consumers are gone (`--line`→`--border`, `--muted*`→`--ink*`, `--accent-soft`→`--surface-selected`, etc.). Remaining `--accent`/`--cyan` references are the M4 (dashboard hero/quick-practice) and M7 (404) gradients, deliberately untouched. `workspace.css` added to `global.css` import order.
- **Typography/spacing standardisation:** eyebrow is now mono micro ink-muted; card h3 = `--text-h3`; section h2 = `--text-h2`; meta/labels ≥ 12 px (`--text-micro`) / 14 px (`--text-meta`); fact keys mono micro uppercase; code blocks `--text-code` mono; buttons/inputs 44 px (`--control-h`), sm 36 px; filter inputs/selects use `--border-strong` boundary + `--surface`; all remaining sub-12 px text in `components.css` eliminated. Weights 550/650/750/800 removed (400/500/600 only).
- **Accessibility:** dot + text status (never colour alone); visible focus preserved globally; `aria-busy` + disabled for loading buttons; status tags use text as the accessible name; bars `aria-hidden`; ProgressBar `aria-valuetext`; duplicate card link names = 0 (verified); focus ring ≥ 2 px verified on a card title link; top-bar icon target ≥ 40 px; reduced-motion for the button spinner; `forced-colors` untouched from M1.
- **Commands and results:**
  - `npm run check` — **passed**: ESLint clean (one warning found and fixed during the milestone: `buttonClassName` export broke `react-refresh/only-export-components`; the helper was removed before completion), all three TypeScript projects clean, 3 files / 30 tests passing.
  - `npm run build` — passed. Final bundle: JS **379.70 kB** (115.22 kB gzip), CSS **50.19 kB** (11.17 kB gzip). Versus M2 (380.28 kB JS / 49.37 kB CSS): **−0.58 kB JS, +0.82 kB CSS raw**. No dependency changes.
  - Browser verification (Playwright/Chrome from the external install reused in M2, against `wrangler pages dev dist`): **121/121 checks passed** at 375/768/1024/1440 across all 11 routes — no horizontal overflow, exactly one `h1` per route, zero duplicate card accessible names, both themes apply, workspace scope flips the palette (action `#E6EBF5`, tag `#4ADE80`-family), card-link focus ring ≥ 2 px, theme toggle target ≥ 40 px, `/` shortcut + `/scenarios?q=cart` deep link still works (5 filtered cards), mobile drawer opens/closes on Escape, zero console errors. A Reset-filters click cycle (disabled at idle → enabled with a filter → resets to 24 cards, clears the field, re-disables) passed with zero console errors.
  - Screenshots (light + dark, 1440; scenarios 375) live in `/tmp/opencode` (`m3-*.png`), not in the repo. Known cosmetic note: the meta separator dot can start a wrapped line (e.g. guide cards); accepted — Meta separators are aria-hidden.
- **Issue found and fixed during verification:** guide cards' neutral track tag overflowed at 375 px (`white-space: nowrap`, full row width); fixed with `.guide-card-top .tag { min-width: 0; overflow: hidden; text-overflow: ellipsis; }`. Also `.scenario-card > .tag` was `align-self: stretch` (full-width tag banner); fixed to `flex-start`.
- **Known limitations / deferred:** compatibility aliases remain for `layout.css`/`pages.css` (dashboard hero gradient, 404) — removal belongs to the milestones that own those surfaces (M4/M7), then a cleanup pass. No `data-surface="workspace"` element exists in a shipped route yet; scope correctness was verified with a synthetic probe only. `Button`'s `danger` variant, `LevelMeter` hidden-label mode, and `Meta` custom class are unused but reserved (approved in the audit inventory). HealthStatus is unchanged (M7). Route error boundaries, full URL filter state, and catalog layout remain M5/M7.
- **Blockers:** none.
- **Next exact action:** Stop and await instruction. On approval, start **M4 — Dashboard, tracks index, track detail** from `docs/phase-2.5-ui-ux-audit.md` §11 (run `npm run check` first). Do not start M5 or Phase 3 in the same change.

### 2026-11-15 — Redesign M2: shell, navigation, search, route management

- **Completed:** The second approved redesign milestone. Content, scenario statuses, and page bodies were not redesigned. All 24 scenarios remain non-runnable placeholders and demo progress remains labelled sample data. Git checkpoint `b84b210` holds the verified M1 state; M1 and M2 are committed on branch `feat/phase-2.5-redesign`, local `main` remains at `origin/main`, and nothing is pushed.
- **Shell and navigation:** sidebar is 240 px (64 px collapsed), built on surface with 44 px rows, Learn (Overview, Tracks, Catalog, Guides) and Workspace (Practice, Progress) sections, and an ink 2 px active rule. The promo card, the environment pill, the fake search link, and the version/build footer were removed. The sidebar utility footer carries "About this build" and collapse; collapsed headings disappear and links gain `aria-label`/`title` instead of rendering "—". Nav labels were shortened to `Overview`/`Catalog` and Practice now precedes Progress.
- **Top bar:** 60 px solid surface. Desktop search is a real `<form role="search">` with a labelled input, `/` shortcut (`aria-keyshortcuts`), clear control, and Enter submit to `/scenarios?q=…`. A search icon link and the menu trigger replace the field below 1024 px. Theme toggle remains in the top bar at all widths (the sidebar utility adds About and collapse only; no duplicate toggle).
- **Catalog deep link:** `ScenariosPage` reads `?q=` on mount and re-syncs when it changes, updating only the query field. Full URL-driven filters, chips, sort, and the mobile filter drawer remain M5. Clearing search with the field control or Escape removes `q` (using `replace`) and resets results.
- **Drawer accessibility:** the drawer is a labelled `role="dialog"` with `aria-modal`, a non-focusable backdrop, initial focus on close, Tab/Shift+Tab trapping, Escape handling, body scroll lock, and focus return for close/backdrop/Escape. Navigating from a drawer link closes without restoring focus so route focus management takes over. The top bar, app body, and skip link are `inert` while open. Resizing to ≥1024 px closes the drawer.
- **Route management:** new `useRouteManagement` hook sets `history.scrollRestoration = 'manual'`, records scroll per history entry from a passive scroll listener, jumps to top instantly on PUSH/REPLACE, restores on POP, and focuses the page `h1` (adding `tabindex="-1"`, `preventScroll`) after pathname changes only. Reading the listener value instead of `window.scrollY` avoids saving a clamp caused by a shorter destination page; `behavior: 'instant'` avoids the global smooth-scroll animation. Route error boundaries remain M7.
- **Footer, breadcrumbs, About:** footer is one learner-facing line plus the About link. Breadcrumb current items wrap rather than truncating at 46 ch. `/about` is a minimal learner-facing build-status page (what works, what is planned, no-AI note) so the new utility link has a real destination.
- **Bug found and fixed during verification:** the first scroll-restoration implementation saved the destination page's clamped offset (195 px instead of 900 px). Fixed before final verification; Back now restores 900 px exactly in the probe.
- **Files changed:** `src/components/layout/AppShell.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `MobileNav.tsx`; `src/lib/navigation.ts`; `src/lib/useRouteManagement.ts` (new); `src/pages/AboutPage.tsx` (new); `src/pages/ScenariosPage.tsx` (minimal `?q=` only); `src/app/App.tsx`; `src/styles/layout.css`; `src/styles/components.css` (breadcrumb wrap); `src/styles/tokens.css` (top bar 60, sidebar 240/64, content max 1120). Documentation: `PROJECT_STATE.md`, `AGENTS.md`.
- **Commands and verification:**
  - `npm run check` — **passed**: ESLint clean, all three TypeScript projects clean, 3 test files / 30 tests passing.
  - `npm run build` — passed: JS 380.28 kB (114.94 kB gzip), CSS 49.37 kB (11.35 kB gzip). Versus M1: **+6.55 kB JS, +0.81 kB CSS raw**. No new runtime dependency.
  - Playwright/Chrome against the dev server at 1440/1024/768/375: **48/48 primary checks passed** with no console or page errors. Covered deep-link submit from `/guides`, direct `/scenarios?q=`, filter sync, clear, Escape clear/blur, `/` focus, clear/reset to 24 cards, route `h1` focus, Back scroll restore (900 px), About/footer, both themes, the 1024 sidebar/drawer boundary, 375/768 navigation, drawer focus trap/inert/scroll lock/focus return/backdrop, nav-link close without focus return, and horizontal overflow.
  - Supplemental sweep: **55/55 route × width overflow checks passed** across all 11 routes at 320/375/768/1024/1440. A 12-stop keyboard walk showed a visible 2 px focus ring on every stop except the search input, whose visible focus indicator is the 3 px ring on its container (intentional); the drawer close target measures 44 px (44.000015 px subpixel). 63/65 supplemental assertions passed with those two harness-expectation differences only. Screenshots for light/dark 1440/375 and tablet/mobile drawer live in `/tmp/opencode`, not in the repo.
  - Breakpoint/resize, `inert`, body overflow restore, and desktop-drawer auto-close were checked in the browser. Reduced motion continues to remove the drawer animation through the existing global rule.
- **Outstanding / deliberately deferred:**
  - Catalog filters other than `q` are still component state; Back/Forward and deep links do not yet preserve track/difficulty/mode/status/sort. M5 owns full URL state, applied chips, and the mobile filter drawer.
  - Route error boundary and route-level error UI remain M7. Focus on the page `h1` is the current mechanism; no live-region route announcement beyond the document title.
  - Closing the drawer by resizing across 1024 px does not return focus to the now-hidden menu trigger; focus falls back to the document. This is an edge case accepted for M2.
  - No browser tests are committed; M8 owns Playwright + axe coverage and may promote the `/tmp` probes.
  - M1's deferred items (component-level type sizes, badges/card styling, licences, fallback metrics) remain for M3–M8.
- **Blockers:** none.
- **Next exact action:** Stop and await instruction. On approval, start **M3 — primitives and cards** from `docs/phase-2.5-ui-ux-audit.md`, run `npm run check` first, and do not start M4 in the same change.

### 2026-11-15 — Redesign M1: design foundations (tokens, fonts, base type, focus)

- **Completed:** The first approved redesign milestone, scoped to foundations only. No routes, pages, content, interactions, or scenario statuses changed. All 24 scenarios remain non-runnable placeholders and demo progress remains labelled sample data.
- **Baseline verification (before any edit):**
  - `npm run check` **failed at lint** with 143 errors in 7 vendored files under `.opencode/skills/*/scripts/*.cjs` (`no-undef`, `no-require-imports`, `no-unused-vars`). No app-source lint errors.
  - `npm run typecheck` — passed; `npm test` — passed (3 files / 30 tests). The failure was tooling scope, not application code.
  - Fixed by adding `.opencode/**` to the ESLint ignores (the 172 tracked skill files are vendored guidance, not app source).
- **Token system:** rewrote `src/styles/tokens.css` in three documented layers:
  - **Primitives:** slate/blue/run/amber/red/workspace-night palettes, font stacks, nine type roles (`--text-display/h1/h2/h3/body/prose/meta/micro/code` with leading tokens), weights, space 4–64 px, radii 4/8/12/16, overlay-only shadows, motion/easing, focus ring, z-index.
  - **Semantic:** `--canvas`, `--surface(-raised/-sunken/-selected)`, `--ink/-ink-strong/-ink-muted/-ink-subtle`, `--border(-strong)`, `--action(-hover/-ink)`, `--link(-hover)`, `--focus`, `--run/-soft/-ink`, `--warn/-soft/-ink`, `--danger/-soft/-ink`, `--code-bg/-ink`; light palette applied as approved (`#F6F7F8`, `#0F1B2D` action, `#1D4ED8` link/focus, `#15803D` run, `#92400E` warn, `#B42318` danger, `#7C8697` control boundary).
  - **Compatibility:** all old names (`--bg`, `--muted`, `--line`, `--accent*`, `--cyan`, `--success*`, `--warning*`, `--info*`, `--shadow-*`, layout widths) remain for one migration step. `--accent` maps to the near-black action; links in `base.css` and `.card-foot-link` use `--link`; `--cyan` maps to link.
  - **Dark theme:** `[data-theme="dark"]` now uses the same workspace palette (`#0B1220` canvas, `#111A2B` surface, `#E6EBF5` ink, `#9DB8FF` link/focus, `#4ADE80` run, `#5A6C8C` control boundary) and overrides the compatibility values that are not dynamic (notably `--muted-strong` and `--surface-3`).
  - **Workspace scope:** `[data-surface="workspace"]` sets `color-scheme: dark` and the full technical palette. Compatibility aliases are deliberately redeclared inside the scope because custom properties resolve where they are declared; without that, a workspace nested in light mode would inherit light `--accent`/`--line`/`--muted` values.
- **Fonts:** added `@fontsource-variable/ibm-plex-sans@5.3.0` and `@fontsource-variable/jetbrains-mono@5.3.0` as devDependencies; imported their `wght.css` before `global.css`; set exact variable family names (`"IBM Plex Sans Variable"`, `"JetBrains Mono Variable"`) with system fallbacks. `font-display: swap` and unicode-range subsetting come from Fontsource. No CDN or runtime third-party request.
- **Base type and focus:** body is 16 px / 1.65 with the new sans stack; body radial gradients removed; `h1/h2/h3` use the token scale (32/22/17 px, weight 600, `text-wrap: balance`); links use `--link`; `:focus-visible` is `2px solid var(--focus)` with `2px` offset; selection uses the focus colour; inline code/kbd use semantic surfaces and a ≥12 px mono label; `forced-colors` guard added; reduced-motion handling retained.
- **Theme chrome:** added `color-scheme` and a `theme-color` meta (`#f6f7f8` light / `#0b1220` dark), kept in sync by both the pre-paint bootstrap and `applyTheme` via a new `THEME_COLORS` export.
- **Small compatibility fixes caused by the palette remap:** neutralised the indigo brand mark (fixed slate chip with white text), moved `.card-foot-link` to `--link`, and corrected dark `--muted-strong` so inactive navigation/fact labels remain legible (`#C9D2E3`).
- **Files changed:** `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css` (card-foot-link only), `src/styles/layout.css` (brand mark only), `src/main.tsx`, `src/lib/theme.ts`, `index.html`, `eslint.config.js`, `package.json`, `package-lock.json`; documentation: `PROJECT_STATE.md`, `AGENTS.md`. No route/page/data/feature files changed; no commit created.
- **Commands and verification:**
  - `npm run check` — **passed**: ESLint clean (baseline 143 → 0 after the scope fix), all three TypeScript projects clean, 3 test files / 30 tests passing.
  - `npm run build` — passed: JS 373.73 kB (112.80 kB gzip), CSS 48.56 kB (11.28 kB gzip). Baseline Phase 2 was JS 373.62 kB (112.74 kB gzip) and CSS 37.15 kB (7.25 kB gzip): **+0.11 kB JS, +11.41 kB raw / +4.03 kB gzip CSS**, plus 12 emitted woff2 files (260 KB on disk). Only the two latin files are fetched at runtime (45.71 kB Plex Sans + 40.40 kB JetBrains Mono = 86.11 kB); other subsets stay unrequested.
  - Token contrast script — **40/40 audited pairs pass** in light, dark, and workspace values, including body/secondary text, control borders (3:1), action/action-ink, link/focus, run/warn/danger on soft backgrounds, selected surfaces, and code text. `--ink-subtle` was darkened from `#6B7688` to `#5C677A` because the original failed on `--surface-sunken` (4.02:1).
  - Production preview + Playwright/Chrome — 40 screenshots across seven routes at 1440/1024/768/375 (plus dark at 1440/375). No console or page errors, no horizontal overflow at any tested width (20/20 route checks at 768/1024 plus the 1440/375 sweep), exactly one `h1` per route, and the skip link is the first tab stop with a 2 px `#1D4ED8` ring at 2 px offset. Theme toggle updates both `data-theme` and the `theme-color` meta. A synthetic workspace probe confirmed `color-scheme: dark`, `--link` `#9DB8FF`, inverted action `#E6EBF5` with `#0B1220` text, and unchanged light text outside the scope.
  - Font probe — `document.fonts` reports six Plex and six Mono faces with only the latin faces `loaded`; computed body font starts with `"IBM Plex Sans Variable"`. No preload links were added: Vite emits hashed font URLs, the self-hosted CSS is already render-blocking/same-origin, and Fontsource ships `font-display: swap`, so preload would not survive a stable-URL requirement without duplicating binaries. Fallback metric overrides are also deferred.
- **Outstanding / deliberately deferred:**
  - Component-level type sizes are still legacy: 168 dashboard nodes and 238 catalog nodes render below 14 px at 1440 (sidebar labels 10.2 px, brand 11.2–11.5 px, badges ~10.6 px, env pill). M2/M3 replace these with the 12/14 px roles; M1 only established the base and tokens.
  - Dashboard hero `h1` remains 53.6 px at 1440 with `-0.035em` tracking and radial gradients until M4; the tokens already define the 40 px display role and the `-0.02em` limit.
  - Badges/pills, category hues, card shadows, input/select boundaries (still `--line`), and remaining `--accent` link hovers are component migrations for M3–M5. Several component weights (650–800) currently clamp to the variable fonts' 700 maximum and will be normalised with the type roles.
  - Font licence texts (SIL OFL 1.1) are not copied into `public/`; surface them on the About/build page or ship the licence files before any deployment.
  - No browser tests are committed; M8 owns Playwright + axe coverage. The M1 capture/probe scripts live in `/tmp`.
- **Blockers:** none.
- **Next exact action:** Stop and await instruction. On approval, start **M2 — shell, navigation, search, route management** (`AGENTS.md` next-task), run `npm run check` first, and do not start M3 in the same change.

### 2026-11-15 — Phase 2.5 UI/UX audit and redesign plan (no code changes)

- **Completed:** A full audit of the Phase 2 interface and a redesign plan, recorded in `docs/phase-2.5-ui-ux-audit.md`. All ten routes, the shared shell, every UI/feature component, all five stylesheets (2,681 CSS lines), the typed content, and the installed `ui-ux-pro-max` skill were inspected. The production build was served locally and measured with Playwright/Chrome at 375, 768, 1024, and 1440 px in both themes, including focus, scroll, filter, and dialog probes.
- **Chosen direction (user-approved in principle):** **C. Hybrid** — light-first learning interface with a dark technical workspace for API/SQL/logs/debugging. Dark theme adopts the same workspace palette. Concept: **"The Test Bench"** — precision typography, hairline rules, one accent family, mono data labels, no gradients/card shadows.
- **Primary findings:**
  - **Fonts never load:** `document.fonts.size === 0`, zero font requests, and Inter/JetBrains Mono measure identically to the fallback. Typography is OS-dependent.
  - **Type is undersized and fragmented:** 33 distinct sizes (26 under 16 px); badges 10.56 px, track fact labels 9.92 px; body 15 px; guide prose 14.72 px at ~89 characters per line.
  - **Boundaries fail contrast:** `--line` is 1.21–1.58:1 in light and 1.33–1.48:1 in dark (3:1 required for UI boundaries).
  - **Generic SaaS identity:** indigo/cyan gradients, 12 arbitrary track hues, 152 pill elements, 84 card shadows, 3 pills per scenario card (72 on the catalog page).
  - **Duplication:** dashboard repeats 12/24/6 three times across 3,120 px (6,739 px at 375 px); facts repeat in detail headers and asides; demo disclaimers repeat four+ times.
  - **Navigation/state:** top-bar search is a link with a fake `/` shortcut; filters are local `useState` (Back returns 24 cards); no scroll restoration (1600 → 140 px); focus falls to `<body>` after navigation; category cards link unfiltered.
  - **Mobile/tablet:** catalog 7,631 px at 375 px; guide TOC and facts render after the article below 1180 px (TOC at 2,581 px); drawer focus escapes (7th Tab), background not inert, no return focus; topbar/text targets 20–35 px.
  - **States:** `LoadingState`/`ErrorState` unused, no route error boundary, health error exposes `npm run db:migrate:local` and port 8788.
- **Proposed system (documented, not applied):** IBM Plex Sans + JetBrains Mono (self-hosted, decision pending); 16 px base with 9 type roles; near-black action, run-green status, amber in-design, slate planned; `--border-strong #7C8697` (3.4–3.7:1) for controls; dark workspace `#0B1220`/`#111A2B` with `#5A6C8C` boundaries; `data-surface="workspace"` scoping; 4/8/12/16 radii; overlay-only shadows; no new UI library or icon package.
- **Plan:** eight milestones — (M1) tokens/fonts/base/focus, (M2) shell/nav/search/drawer/route focus, (M3) primitives/cards, (M4) dashboard/tracks, (M5) catalog/filters/scenario detail, (M6) guides/reading/TOC, (M7) progress/practice workspace/404/states, (M8) accessibility/responsive verification/tests. M9 polish is optional.
- **Files changed:** `docs/phase-2.5-ui-ux-audit.md` (new), `PROJECT_STATE.md` (this entry, snapshot, roadmap, repo shape), `AGENTS.md` (current-state/next-task alignment).
- **No application code, styles, content, dependencies, or routes were changed.** No commits were made.
- **Commands executed:** `npm run build` (existing `dist/` used for the audit), `npx wrangler pages dev dist --port 8788`, `/api/health` → `200` (`version 0.2.0`, `database ok`, `schemaVersion 1`), Playwright capture and probes (48 screenshots, per-route metrics, contrast math, keyboard/drawer/filter/scroll checks). `npm run check` was **not** rerun because no source changed; run it at the start of M1.
- **Measured verification highlights:** no horizontal overflow at any tested width; one `h1` per route; theme toggle persisted; body text contrast passes; all scenario cards remain non-runnable.
- **Blockers:** awaiting approval of the eight decisions in §12 of the audit (fonts, icon strategy, IA/content restructuring, dark-theme mapping, dev-chrome removal, progress/demo treatment, browser-test tooling, real top-bar search).
- **Next exact action:** User reviews `docs/phase-2.5-ui-ux-audit.md` and approves or amends the direction and decisions. On approval, start **M1 — design foundations (tokens, fonts, base type, focus)** and run `npm run check` first. **Do not start Phase 3** and do not implement later milestones before M1 is verified.

### 2026-11-14 — Repo hygiene: ignore Python cache artifacts

- Added `__pycache__/` and `*.py[cod]` to `.gitignore` and untracked the three committed `__pycache__/*.pyc` files under `.opencode/skills/ui-ux-pro-max/scripts/` (local files left in place; they regenerate on every script run).
- **Files changed:** `.gitignore`, `PROJECT_STATE.md` (this entry).
- **Tests run:** none — repo hygiene only.
- **Note:** `main` was pushed directly after PR #1 was merged on GitHub (merge `e4dd324`).
- **Next exact action:** Unchanged — Phase 3 (commerce practice app), starting with the `ui-ux-pro-max` skill.

### 2026-11-14 — Agent guidance: ui-ux-pro-max skill invocation

- Inspected the installed `ui-ux-pro-max` skill before Phase 3 and documented how to use it so future sessions invoke it consistently instead of improvising UI direction.
- **Findings:** the skill lives at project level in `.opencode/skills/ui-ux-pro-max/` (untracked in git; global `~/.config/opencode/skills` empty). OpenCode discovers it via the project `.opencode/skills/<id>/SKILL.md` convention; the ID is path-derived (`ui-ux-pro-max`). Loading is manual — OpenCode advertises only ID/name/description, and the skill body plus its Python scripts/CSV data enter context only when the `skill` tool is called with `{ "id": "ui-ux-pro-max" }`. Scripts need Python 3 (stdlib only; verified `python3` 3.14.4 works). Persistence (`--persist`, `design-system/<slug>/MASTER.md`) requires explicit user authorization; page overrides beat Master. The skill's Common Rules/checklist target App UI, so only the web-relevant items apply here.
- **No application code was changed.** A read-only `search.py --design-system` query was run to verify the CLI works; nothing was persisted.
- **Files changed:** `AGENTS.md` (new "UI/UX Pro Max skill" section + Workflow pointer), `PROJECT_STATE.md` (this entry).
- **Tests run:** none — documentation-only change.
- **Next exact action:** Unchanged — Phase 3 (commerce practice app), starting by invoking the `ui-ux-pro-max` skill to generate the commerce app design system.

### 2026-11-14 — Phase 2 app shell, learning tracks, catalog, and guides

- **Completed:** A full learner-facing interface on top of the Phase 1 foundation:
  - App shell with sticky top bar, collapsible sidebar (state persisted in `localStorage`), mobile navigation dialog with Escape/focus handling, breadcrumbs, skip link, footer, and a 404 page.
  - Light/dark theme with a pre-paint bootstrap in `index.html`, a `ThemeProvider`, and a persisted `data-theme` choice.
  - Dashboard with welcome hero, availability snapshot, twelve-track preview (six shown), eight testing categories, recommended scenarios, demo progress, recent activity, and quick practice access.
  - Twelve learning tracks, each with description, difficulty, objectives, planned exercise count, getting-started steps, a starting guide where one exists, and two representative scenario placeholders.
  - Searchable/filterable scenario catalog (query, track, difficulty, mode, status), result counts, reset, and a dedicated empty state.
  - Scenario detail pages with objectives, prerequisites, related guides, track/category facts, and an explicit "not runnable yet" callout.
  - Six full guides grouped by discipline, with introduction, concepts, examples, step-by-step instructions, expected results, common mistakes, related exercises, and an on-page table of contents.
  - Progress and practice pages that clearly separate real functionality from demo data and planned formats.
  - Shared loading, empty, and error state components; typed scenario/guide/track content; pure filtering logic covered by tests.
- **Bugs found and fixed during verification:**
  - The dashboard hero and split grids stayed two-column on mobile because `pages.css` loaded after the component media queries; responsive overrides were moved to the end of `pages.css`.
  - The mobile menu trigger leaked onto desktop because `.icon-button { display: inline-grid }` outranked `.topbar-menu { display: none }`; the rule now uses `.topbar .topbar-menu` and was rechecked at 1440, 1024, 981, 980, and 390 px.
  - Filter inputs removed their focus outline; the global focus-visible ring now remains visible on text inputs and selects.
- **Files created:**
  - Content: `src/data/types.ts`, `categories.ts`, `tracks.ts`, `scenarios.ts`, `guides.ts`, `demo.ts`.
  - Logic: `src/lib/catalog.ts`, `labels.ts`, `navigation.ts`, `theme.ts`, `useTheme.ts`, `useDocumentTitle.ts`.
  - UI: `src/components/ui/{Icon,Badge,DomainBadges,PageHeader,PageChrome,ProgressBar,StatCard,States,Callout,ThemeToggle,ThemeProvider,ThemeContext}`.
  - Layout: `src/components/layout/{AppShell,TopBar,Sidebar,MobileNav}.tsx`.
  - Features: `src/features/tracks/TrackCard.tsx`, `src/features/catalog/{ScenarioCard,ScenarioFilterBar}.tsx`, `src/features/guides/GuideCard.tsx`.
  - Pages: `src/pages/{Dashboard,Tracks,TrackDetail,Scenarios,ScenarioDetail,Guides,GuideDetail,Progress,Practice,NotFound}Page.tsx`.
  - Styles: `src/styles/{tokens,base,layout,components,pages}.css`.
  - Tests: `tests/lib/catalog.test.ts`, `tests/data/content.test.ts`.
- **Files modified:** `src/app/App.tsx` (theme provider + nested routes), `src/styles/global.css` (imports the stylesheet layers), `index.html` (theme bootstrap and metadata), `src/server/app.ts` (service version `0.2.0`), `tests/server/health.test.ts` (version expectation), `package.json` / `package-lock.json` (version `0.2.0`).
- **Files removed:** `src/app/HomePage.tsx`, `src/app/NotFoundPage.tsx` (replaced by `src/pages/*`).
- **Decisions:**
  - No new runtime or dev dependencies; the design system is hand-written CSS using custom properties, `color-mix()`, and container-agnostic grid layouts.
  - All Phase 2 scenarios are placeholders with `runnable: false` and a `planned`/`in-design` status. The `ready` status exists in the type so later phases can promote content without changing the UI contract.
  - Each track lists two representative placeholders while `plannedExerciseCount` records the intended total (71 planned across twelve tracks).
  - Six disciplines have a full guide; the other six link to the closest guide or state that a dedicated guide is scheduled.
  - Dashboard progress, streaks, weekly goal, and recent activity are demo data. Every surface that renders them also renders a disclaimer, and nothing is persisted.
  - Search matches across titles, summaries, descriptions, objectives, prerequisites, ids, and hyphen-to-space variants so queries such as "ui automation" and "bug hunt" work.
  - The fictional commerce domain is **Aster Market**; no commerce code exists yet.
  - `role="search"`, labelled filters, `aria-live` result counts, keyboard-operable controls, and visible focus styles were treated as acceptance criteria, not polish.
- **Commands executed and results:**
  - `npm run check` — passed: ESLint clean, all three TypeScript projects clean, 3 test files / 30 tests passing.
  - `npm run build` — passed: JS 373.62 kB (112.74 kB gzip), CSS 37.15 kB (7.25 kB gzip).
  - `npx wrangler pages dev dist --port 8788` route smoke test — `/`, `/tracks`, `/tracks/manual-testing`, `/scenarios`, `/scenarios/api-order-idempotency`, `/guides`, `/guides/guide-api-request-response`, `/progress`, `/practice`, and unknown deep links all returned `200 text/html` via the Pages SPA fallback. `/api/health` returned `200` with `version: "0.2.0"` and `schemaVersion: "1"`; `/api/nope` returned `404` JSON.
  - Playwright against the production preview — 30/30 interaction checks passed (navigation, theme toggle, catalog search/filters/reset/empty state, track/scenario/guide detail, progress, practice health, 404, mobile navigation) with no console or page errors. An additional 7/7 checks passed for dark theme from storage, sidebar collapse and persistence, mobile filtering, and mobile detail stacking.
  - A route sweep at 390 px, 768 px, and 1440 px confirmed exactly one `h1` per page, no horizontal overflow, and no console/page errors. The skip link is the first tab stop, focuses `#main-content`, and filter inputs/selects retain a 3 px focus-visible outline.
  - Screenshot review at 1440 px, 1024 px, 980 px, 390 px, collapsed sidebar, and dark theme confirmed layout coherence and no horizontal overflow.
- **Known issues / deliberate gaps:**
  - Every scenario is a placeholder; no exercise launches, scores, or stores results.
  - Demo progress and activity are not persisted and are not derived from real work.
  - Six of twelve tracks do not yet have a dedicated guide.
  - The Playwright verification scripts live in `/tmp` and are not part of the repository. Automated component/route tests cover content and filtering; browser interaction checks were run manually rather than committed.
  - The Phase 2 working tree is not committed yet; Phase 1 remains commit `2c75168`.
  - `npm audit` still reports seven moderate, development-only advisories; production audit is clean.
  - Pages/Hono deprecation risk from Phase 1 is unchanged.
- **Unfinished work:** Phase 3 onward — no commerce application, practice API, authentication, bug-hunt mode, SQL sandbox, contract lab, performance runner, security exercises, or progress persistence exists.
- **Next exact action:** Start Phase 3 — commerce practice app: build the Aster Market catalog/cart/checkout UI with synthetic data, deterministic clean behaviour, and a resettable bug-hunt mode behind first-party routes. Keep Phase 2 navigation and content intact, and do not add real payments or credentials.

### 2026-11-14 — Phase 1 repository foundation

- **Completed:** React/Vite/TypeScript frontend shell; Hono Pages Functions API; Wrangler Pages + D1 configuration; initial local migration; accessible responsive landing page; `GET /api/health`; lint/typecheck/test/build scripts; README; local smoke tests. No remote resources were created.
- **Files created:**
  - Config: `package.json`, `package-lock.json`, `wrangler.jsonc`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.functions.json`, `.gitignore`.
  - App: `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/app/HomePage.tsx`, `src/app/NotFoundPage.tsx`, `src/features/system/HealthStatus.tsx`, `src/styles/global.css`, `src/vite-env.d.ts`, `public/favicon.svg`.
  - Server: `src/server/app.ts`, `src/shared/health.ts`, `functions/api/[[route]].ts`.
  - Data/tests/docs: `db/migrations/0001_initial_schema.sql`, `tests/server/health.test.ts`, `README.md`.
- **Files modified:** `PROJECT_STATE.md`; `AGENTS.md` (rewritten from its pre-scaffold state to the implemented Phase 1 commands and architecture).
- **Architecture decisions:**
  - Pinned React 19.3.1, Vite 7.3.8, TypeScript 5.9.3, React Router 7.18.5, Hono 4.13.18, Wrangler 4.162.0, Vitest 5.1.0, ESLint 10.15.0. Node >=22.12 because Vitest 5 requires it.
  - Hono app is isolated in `src/server/app.ts` for unit testing; `functions/api/[[route]].ts` uses `handle()` from `hono/cloudflare-pages`. `basePath('/api')`; `/api/v1` remains reserved for later practice APIs.
  - D1 binding `DB`; initial migration creates only `app_meta` and seeds `schema_version = 1`. Health reads that row, so a missing migration produces a controlled 503.
  - Three TypeScript projects keep browser, Node tooling, and Workers/D1 globals separate. Tests run in Node with a mocked D1 binding; the Workers Vitest pool is deferred.
  - Vite dev on `:5173` proxies `/api` to Wrangler on `:8788`. `npm run dev` builds `dist/` once for the Pages server.
  - Removed a `_redirects` catch-all after Wrangler rejected `/* /index.html 200` as an infinite loop. Pages' native SPA fallback serves deep links while no top-level `404.html` exists.
- **Commands executed and results:**
  - `npm install` — succeeded. `npm audit` reports 7 moderate, development-only advisories; `npm audit --omit=dev` reports 0.
  - `npm run db:migrate:local` — applied `0001_initial_schema.sql`; 3 commands executed successfully.
  - `npm run typecheck` — passed (app, node, functions projects).
  - `npm run lint` — passed with no output.
  - `npm test` — passed: 1 test file, 4 tests.
  - `npm run build` — passed; production JS 265.81 kB (84.60 kB gzip), CSS 5.94 kB (1.95 kB gzip).
  - `npx wrangler pages dev dist --port 8788` smoke test — `/api/health` 200 with `schemaVersion: "1"` and correct headers; unknown API route 404 JSON; SPA deep link 200 with the app HTML; no redirect warnings.
  - `wrangler pages dev` against a fresh, unmigrated `--persist-to` directory — `/api/health` 503 `degraded` with `database: "unavailable"`, confirming the controlled failure path.
  - `npm run dev` smoke test — Vite root 200; `/api/health` through the proxy 200; proxy unknown API route 404.
  - `npm run check` — passed (lint -> typecheck -> test).
  - `npm run db:migrations:list` — "No migrations to apply!".
  - `npm run preview` — root 200, health 200, SPA deep link 200.
  - `git diff --check` — clean; secret scan found no credentials (only the phrase "API token" in README).
- **Known issues:**
  - Hono deprecates `hono/cloudflare-pages` in v5 and Cloudflare recommends Workers with static assets for new projects. Pages remains a deliberate project constraint; revisit before a Hono major upgrade or if Pages blocks a later phase.
  - 7 moderate npm advisories remain in the dev-only ESLint/TypeScript tooling chain. Production audit is clean.
  - No remote Cloudflare resources, remote migrations, CI, or deployment configuration exist yet. `wrangler.jsonc` intentionally contains a placeholder `database_id`.
  - `npm run dev` builds `dist/` once; edits to `public/` require a rebuild to appear on `:8788`. Vite on `:5173` is current.
  - npm 11 may block `esbuild`/`workerd` install scripts; README documents `npm install-scripts approve esbuild workerd`.
- **Unfinished work:** Phase 2 onward. No commerce, auth, bug-hunt, SQL playground, async, contract, performance, security, or automation features were started.
- **Next exact action:** Start Phase 2 — app shell & guides: add learning-track navigation and a track/scenario catalogue shell, define the scenario template and guide content structure, and verify it with lint, typecheck, tests, and a build. Do not add commerce or auth yet.

### 2026-11-14 — Agent guidance

- (Before Phase 1) Added `AGENTS.md` to give future OpenCode sessions the hard rules that are easy to miss: no scaffold existed yet, `PROJECT_STATE.md` must be updated in the same turn, target stack, safety invariants, free-tier caps, and MVP discipline.
- **Files changed:** `AGENTS.md` (new), `PROJECT_STATE.md` (this entry).
- **Tests run:** None at the time; no application code existed yet.
- **Next exact action:** Unchanged — Phase 1 scaffold.

### 2026-11-14 — Phase 0 baseline

- Captured the vision, key testing tracks, initial MVP boundary, and phased roadmap.
- Chose React + TypeScript + Vite for the frontend; Pages Functions + Hono for the API; D1 for platform metadata.
- Decided not to expose shared D1 through a general-purpose SQL console; database exercises will run in a browser-isolated SQLite/WASM sandbox.
- Set strict guardrails around performance testing, arbitrary target URLs, user-supplied code execution, and synthetic data.
- Verified Cloudflare free-tier and OpenRouter free-model limits against current official documentation.
- **Files created:** `PROJECT_STATE.md` only. No application source code exists yet.
- **Tests run:** None; implementation has not started.
- **Blockers:** None. Working name and exact UI design remain open and can be chosen during scaffold/design work.
- **Next exact action:** Phase 1 — create the repository scaffold and implement a minimal React shell plus Hono `/api/health` endpoint with a local D1 migration.

## 12. Phase 3 — commerce practice application (in progress)

Phase 3 is approved and in progress on branch `feat/phase-3-commerce-practice` (base: `main` @
`394691c`). The full plan — milestone breakdown with scope/dependencies/acceptance/testing/risks,
the bug-hunt engine architecture, the API surface, scenario sketch and free-tier impact — lives in
**`docs/phase-3-commerce-practice-plan.md`**. Status summary:

### Architecture decisions (Phase 3)

- One original fictional store — **Meridian Outfitters**, outdoor & home goods, synthetic data only.
- Modular services inside the existing Pages Functions/Hono app under `/api/v1/...`; no separate
  Workers yet. D1 remains an implementation detail; no learner-facing SQL surface ever.
- Money is integer cents (`price_cents`); currency constant `USD` (`src/shared/commerce.ts`).
- Integer PKs internally; URL-facing lookups use stable lowercase-hyphen `slug`.
- Catalogue rows are deactivated (`active = 0`), never deleted.
- Seed data lives inside migrations with explicit ids → `npm run db:migrate:local` is the single
  reproducible setup step. Deterministic, no wall-clock in seeds (`created_at` is a fixed constant).
- Shared contracts in `src/shared/commerce.ts`; API error envelope stays `{ error, message }`.
- Inventory is its own table (`inventory.product_id` PK/FK, `quantity >= 0`, per-product
  `low_stock_threshold`); stock status is derived in SQL as `in_stock | low_stock | out_of_stock`.
- Testing: server tests run against an in-memory SQLite (`node:sqlite`) that applies the **real**
  migration files — no hand-mocked SQL (`tests/helpers/fake-d1.ts`).

### Bug-hunt engine (designed, NOT implemented — lands in P3-M7/P3-M8)

- **Clean mode** is the default: zero defect branches execute. **Bug-hunt mode** activates a
  hunt's fixed defect set; never anything else.
- Hunts and defects are **code, not data** (`src/server/hunts.ts`, `src/server/defects.ts` in M7) —
  learners cannot inject defects, SQL or expressions. No endpoint accepts defect ids; activation
  happens only via `POST /api/v1/practice/hunts/:huntId/start` with the server resolving the set.
- Anonymous `practice_sessions` (`mpl_session` httpOnly SameSite=Strict cookie, 7-day expiry,
  SHA-256-hashed token) isolate carts/orders/defect-state per learner session; read-path defects
  apply only to that session's responses; seeded catalogue is identical for everyone.
- Every defect is a single (minimal) code site branching on an `isDefectActive()` check with
  unit tests for both branches; deterministic — no randomness, no wall-clock ordering.
- Reset issues a fresh clean session; sessions swept on expiry (M9); per-IP hunt-start caps;
  no admin/teacher activation UI in Phase 3. Internal catalogue documents Expected vs Actual,
  repro and fix in `docs/bug-hunt-catalogue.md`.

### Milestone status

| Milestone | Title | Status |
|---|---|---|
| P3-M1 | Commerce domain foundation (schema, seed, read-only catalogue API) | **Done & verified 2026-11-15** (this branch, `0841783`) |
| P3-M2 | Storefront catalogue UI (`/shop`, filters, detail) | **Done & verified 2026-11-15** (this branch) |
| P3-M3 | Cart (session-keyed, server-side totals) | **Done & verified 2026-11-15** (this branch) |
| P3-M4 | Checkout & orders (simulated payments, transactional D1 placement, idempotency) | **Done & verified 2026-11-15** (this branch) |
| P3-M5 | Synthetic customers & auth simulation (roles, ownership) | **Done & verified 2026-11-15** (this branch) |
| P3-M6 | Inventory depth (stock re-check in order transaction, restock) | Planned |
| P3-M7 | Bug-hunt engine v1 (sessions, registry, one proof defect) | Planned |
| P3-M8 | Bug-hunt defect set & scenario wiring (5–7 defects) | Planned |
| P3-M9 | Hardening, reset, Phase 3 exit audit | Planned |

P3-M1 detail: migration `db/migrations/0002_commerce_domain.sql` (tables `categories`, `products`,
`inventory`; `app_meta.schema_version` → `2`; 8 categories, 42 products of which 40 active,
42 inventory rows; 2 out-of-stock, 5 low-stock products); routes `GET /api/v1/products`
(`page`, `perPage` ≤ 48, `category`, `sort=newest|name|price_asc|price_desc`),
`GET /api/v1/products/:slug` (active only, 404 envelope otherwise), `GET /api/v1/categories`;
`/api/v1/*` inherits the global `no-store`/`nosniff` middleware; all parameters are bound, never
interpolated. 16 new tests in `tests/server/catalogue.test.ts`. Verified end-to-end against the
production build on a separate local port (8789) because 8788 was in use by another local
process; the user's servers were not touched.

P3-M2 detail: storefront UI on top of the M1 API — routes `/shop` (catalogue: 12-per-page grid,
URL-driven `?q=&category=&sort=&page=` with safe fallbacks, refresh/Back/Forward persistence)
and `/shop/products/:slug` (detail: price, stock status from the API, category deep link back
to the filtered catalogue, breadcrumb). `GET /api/v1/products` gained an optional `q` parameter
(case-insensitive match on name/description/category name; LIKE wildcards escaped; bound
parameters only) — the only API change; 7 new search tests (23/23 in `catalogue.test.ts`).
Loading/empty/error/out-of-range/not-found states are all implemented and verified in both
themes at 375/768/1024/1440 via a Playwright/Chrome probe (70/70 checks, production build on
port 8789). 41 new tests total (98/98 suite green); `npm run check` and `npm run build` clean;
no new runtime dependencies. One icon added to the inline SVG set (`shop`, shopping bag); no
icon package. `tsconfig` split adjusted so `tests/shop/views.test.tsx` type-checks under the
app project (JSX + DOM lib) and is excluded from the functions project; vitest glob widened
to `.tsx`.

P3-M3 detail: session cart on top of the M1/M2 stack — migration `0003_cart.sql` (`practice_sessions`,
`carts`, `cart_items`; `schema_version` → `3`; token stored only as a SHA-256 hash; 7-day expiry;
`CHECK 0 < quantity <= 99`). Server: `src/server/session.ts` (token generation/hash, resolve,
lazy mint on first mutation, never on reads) and `src/server/cart.ts` (`GET /api/v1/cart`,
`POST /api/v1/cart/items`, `PATCH`/`DELETE /api/v1/cart/items/:id`, `DELETE /api/v1/cart`).
Every cart query is session-scoped — there is no code path that reads a cart by anything other
than the caller's cookie-resolved session; line ids from other sessions return 404. Prices,
stock and totals are recomputed from `products`/`inventory` on every response (integer cents;
`totalCents == subtotalCents` until M4 adds shipping); client-supplied price/total fields are
ignored by construction; stock-guarded upsert/update reject oversells (`422 insufficient_stock`);
out-of-stock adds get `422 out_of_stock`; unknown/inactive products get the shared `404 not_found`
envelope; failed adds never mint a session. Lines whose product is deactivated or drops below
line quantity stay in the cart flagged `available: false` / `exceedsStock: true` and set
`hasUnavailableItems` — never silently dropped or repriced. Frontend: `CartProvider` context
(`src/features/cart/`) on top of a fetch client; top-bar cart entry point with item-count badge;
Add-to-cart on product cards and the detail page (quantity stepper, disabled when out of stock);
`/cart` route with loading/empty/error/ready states, per-line steppers with Enter-to-commit,
stock-ceiling +/- disable logic, removal, clear-cart, and honest checkout-not-implemented copy.
155/155 tests green (`tests/server/cart.test.ts` 35 tests incl. cross-session IDOR probes,
tampering, expiry, batch-rollback; `tests/shop/cart-api.test.ts`; `tests/shop/cart-views.test.tsx`);
Playwright/Chrome probe **61/61** against the production build on port 8791 (refresh persistence,
two-browser-context isolation, cookie attributes in the browser jar, all 4 widths × light/dark
no overflow, one h1). No new runtime dependencies; one inline icon added (`cart`).

P3-M3 focus (from the brief): cart at `/cart` rather than the plan's sketched `/shop/cart`;
`practice_sessions` created now (M7 will extend it) rather than deferring all session state to M7.
Storefront-wide caveats from M2 still apply — no product photography/icon package; `sort=newest`
is `id DESC` because seeded `created_at` is a constant; the API has no `SKU` field — the detail
page shows the slug as “Catalogue code”; storefront search is LIKE-based (fine at 42 products);
SSR string-markup tests assert rendering, browser probes cover interaction and are not committed;
`npm run check` passes but the Node 26 / `node:sqlite` harness is the only database test path.

Known limitations (recorded at P3-M4): customer auth/bug-hunt unimplemented at that time
(P3-M5 has since shipped; bug-hunt is P3-M7+); checkout has no
shipping/discounts/tax (total == subtotal); expired sessions/carts are not swept yet
(M9); stock checks are per-request reads + guarded writes, not a reservation system (M6 owns the
transactional depth); per-request rate limits are deferred to M9; quantity cap is 99/line;
interaction-level cart testing beyond the SSR markup tests + Playwright probe is not automated
(no DOM-test runner installed yet); `practice_sessions` lacks `mode`/`hunt_id` until M7.

P3-M4 detail: atomic checkout & orders on top of M1–M3 — migration `0004_orders.sql`
(`orders`, `order_items` nullable `product_id` with `ON DELETE SET NULL` for snapshot survival;
`checkout_idempotency` PRIMARY KEY `(session_id, idempotency_key)`; `schema_version` → `4`).
Server `src/server/checkout.ts`: `GET /api/v1/checkout` (summary + `checkoutable`),
`POST /api/v1/checkout` (validation + fingerprinted idempotency pre-check before the empty-cart
rejection, then either a single all-or-nothing D1 `batch()` — order + item snapshots +
`inventory.quantity >= 0`-CHECK-guarded decrements + cart clear + idempotency record — or a single
idempotency-record insert for `declined`), `GET /api/v1/orders` (≤50, newest first),
`GET /api/v1/orders/:reference` (opaque `ORD-` + 16 hex; unknown/foreign → identical 404).
Client fingerprint = SHA-256 of validated details + payment outcome (excludes cart contents —
legitimate retry-after-success must replay); same key + different payload → 409; concurrent
twins resolve via the PRIMARY KEY.
Frontend: `/checkout` (validated form, error summary with
field links, Approved/Declined simulation radios, duplicate-submit guard, cart badge refresh
on success) and `/orders/:reference` (confirmation, snapshot items, honest “not a real payment”
wording). 212/212 tests green; live probe against the production build incl. a live idempotency
replay after cart-emptying. Known gaps: no rate limits (M9); no order-history UI (API only);
orders cascade-delete with expired sessions; no checkout reservation system (M6 owns depth).

Known limitations: bug-hunt engine still unimplemented (P3-M7+); the cart and checkout have no
shipping/discounts/tax (total == subtotal); expired sessions/carts/orders/customer sessions are
not swept yet (M9); stock checks are per-request reads + guarded writes in one batch, not a
reservation system (M6 owns the transactional depth); per-request rate limits deferred to M9;
quantity cap is 99/line; interaction-level testing beyond SSR markup tests + Playwright probe is
not automated; `practice_sessions` lacks `mode`/`hunt_id` until M7.

P3-M5 detail: synthetic customer auth & ownership on top of M1–M4 — migration
`0005_customers.sql` (`customers` with PBKDF2 digests + fixed salts, RFC 2606 example domains;
`customer_sessions` bound to `practice_sessions`; `orders.customer_id` nullable → explicit,
transactional adoption at placement only). Server `src/server/customer.ts` (token generation,
SHA-256 hashing, practice-session binding check, suspended handling, shared guard
`requireActiveCustomer`) and `src/server/auth.ts` (`/api/v1/auth/accounts|login|logout|me`,
`/api/v1/account`, `/api/v1/account/orders[/:reference]`). Frontend: `AuthProvider` + top-bar
account indicator + `/login` (fictional demo-account directory), `/account` (profile / guest /
suspended states), `/account/orders` (history), `/account/orders/:reference` (reuses
`OrderConfirmationView`). Anti-enumeration login (identical 401, dummy-digest verify), token
rotation on sign-in, HttpOnly `mpl_customer` cookie (8 h). 239/239 tests green; live probe
**51/51** against the production build (port 8791). Known gaps: no login rate limit (M9); no
account registration/recovery/MFA (out of scope); staff role seeded but unused by endpoints (M6);
no checkout prefill from profile; credentials documented in README only (never in the UI); the
plan's sketched 403-for-wrong-owner was refined to 404 (existence concealed) — documented in
README and the plan.

Next recommended milestone: **P3-M6 — inventory depth** (requires explicit instruction; do not
start without approval).

## 13. Resume prompt

Paste this into the next OpenCode/ChatGPT session after placing this file at the repository root:

> Read `PROJECT_STATE.md` and `AGENTS.md` first. Inspect the repository and reconcile the files with actual code and tests. Phase 2 is complete and the redesign is approved and **complete (M1–M8)**. Phase 2.5 produced `docs/phase-2.5-ui-ux-audit.md`; **all eight redesign milestones are implemented, verified, and recorded; M9 (optional polish) is not started and only on explicit request.** Phase 3 (commerce app) is **approved and in progress on `feat/phase-3-commerce-practice`: P3-M1 (domain foundation), P3-M2 (storefront catalogue UI), P3-M3 (session-keyed shopping cart), P3-M4 (checkout & orders — atomic D1 placement, simulated payments, idempotency) and P3-M5 (synthetic customers & auth simulation — PBKDF2-hashed fictional demo accounts, `/login` + `/account*`, practice-session-bound customer tokens, documented 401/403/404 authorization policy) are done and verified; see §12 and `docs/phase-3-commerce-practice-plan.md`. Do not start P3-M6 until the user explicitly instructs it.** Keep the app compatible with Cloudflare Pages + Pages Functions/Workers + D1 free tiers. Do not expose shared D1 to arbitrary user SQL, do not accept arbitrary external performance-test targets, and do not execute user code server-side. After every meaningful work turn, update `PROJECT_STATE.md` immediately with files changed, decisions, verification run, blockers, and the next exact action. Provide the updated file in the same turn.
