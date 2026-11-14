# PROJECT_STATE.md — QA Practice Lab

> **Purpose:** This is the resumable source of truth for the project. Update this file in the same work turn whenever architecture, scope, implementation, tests, deployment, blockers, or next steps change. Never leave the update until a later turn.

## 1. Project snapshot

- **Working name:** QA Practice Lab (name is provisional).
- **Vision:** A public, safe, end-to-end practice environment where QA engineers can learn and exercise manual testing, UI automation, API testing, contract testing, asynchronous/microservice testing, database testing, performance testing, and bounded security testing.
- **Reference points:** Practice Software Testing and its bug-hunting mode are inspiration for the breadth and learning flow. Build an original product and original scenarios; do not copy their content, branding, or implementation.
- **Primary deployment target:** Cloudflare Pages + Pages Functions/Workers + D1, using free tiers initially.
- **Development assistant:** OpenCode with OpenRouter free models. AI is a developer productivity tool, not a runtime dependency for the lab.
- **Current status:** Phase 1 (repository foundation) complete and verified locally. Phase 2 (app shell and guides) has not started.
- **Last updated:** 2026-11-14.

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
| 3. Commerce practice app | Synthetic catalog/cart/checkout, clean mode, bug-hunt mode, reset | UI scenarios can be completed and known defects are reproducible |
| 4. API & identity lab | REST API, OpenAPI, sample collection, synthetic auth/roles, negative authZ cases | API learners can exercise positive/negative cases and inspect documented contracts |
| 5. Async/microservice lab | Job/outbox model, status polling, retries, idempotency, webhooks, failure injection | Learners can observe and test asynchronous state transitions safely |
| 6. Database lab | Isolated SQLite/WASM database playground and SQL exercises | Arbitrary learner SQL is isolated from platform D1 and resettable |
| 7. Contract testing | Versioned schemas, consumer/provider examples, contract break/fix exercises | Learners can detect schema incompatibility using examples and tooling |
| 8. Automation examples | Playwright UI/API starter suite and Postman/Newman collection | Learners can run examples locally against lab targets |
| 9. Performance & security tracks | Capped first-party load runner and non-destructive security exercises | Hard safety caps and abuse controls are tested before publishing |
| 10. Hardening & launch | Accessibility, responsive polish, docs, observability, rate limits, retention, backup/export, deploy | Production smoke tests pass and free-tier monitoring/limits are documented |

Phase 1 exit criteria were verified locally on 2026-11-14: the app runs, `/api/health` reports the
migrated D1 database, and the Pages preview serves the production build and Functions. Phases 2–10
remain unstarted.

## 10. Repository shape (current after Phase 1)

```text
qa-practice-lab/
├── AGENTS.md
├── PROJECT_STATE.md
├── README.md
├── package.json / package-lock.json
├── index.html
├── vite.config.ts / vitest.config.ts
├── wrangler.jsonc                # Pages config + local D1 binding
├── eslint.config.js
├── tsconfig.json                 # references app/node/functions projects
├── tsconfig.app.json             # src, excludes src/server
├── tsconfig.node.json            # Vite/Vitest config files
├── tsconfig.functions.json       # functions, src/server, tests
├── functions/
│   └── api/[[route]].ts          # Hono -> Pages Functions catch-all
├── src/
│   ├── app/                      # App, HomePage, NotFoundPage
│   ├── features/system/          # HealthStatus
│   ├── server/app.ts             # testable Hono app, basePath /api
│   ├── shared/health.ts          # shared response type
│   └── styles/global.css
├── db/
│   └── migrations/0001_initial_schema.sql
├── public/
│   └── favicon.svg
└── tests/
    └── server/health.test.ts
```

Planned but intentionally not created yet: `src/features/guides`, `scenarios`, `commerce`,
`progress`, `db/seed`, `contracts/openapi`, `examples/playwright`, `examples/postman`, and
`docs/guides`. Add them only when their phase starts.

## 11. Progress log

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

## 12. Resume prompt

Paste this into the next OpenCode/ChatGPT session after placing this file at the repository root:

> Read `PROJECT_STATE.md` and `AGENTS.md` first. Inspect the repository and reconcile the files with actual code and tests. Phase 1 is complete; resume at Phase 2 (app shell & guides) and work only on one phase/vertical slice at a time. Keep the app compatible with Cloudflare Pages + Pages Functions/Workers + D1 free tiers. Do not expose shared D1 to arbitrary user SQL, do not accept arbitrary external performance-test targets, and do not execute user code server-side. After every meaningful work turn, update `PROJECT_STATE.md` immediately with files changed, decisions, verification run, blockers, and the next exact action. Provide the updated file in the same turn.
