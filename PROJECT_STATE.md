# PROJECT_STATE.md — QA Practice Lab

> **Purpose:** This is the resumable source of truth for the project. Update this file in the same work turn whenever architecture, scope, implementation, tests, deployment, blockers, or next steps change. Never leave the update until a later turn.

## 1. Project snapshot

- **Working name:** QA Practice Lab (name is provisional).
- **Vision:** A public, safe, end-to-end practice environment where QA engineers can learn and exercise manual testing, UI automation, API testing, contract testing, asynchronous/microservice testing, database testing, performance testing, and bounded security testing.
- **Reference points:** Practice Software Testing and its bug-hunting mode are inspiration for the breadth and learning flow. Build an original product and original scenarios; do not copy their content, branding, or implementation.
- **Primary deployment target:** Cloudflare Pages + Pages Functions/Workers + D1, using free tiers initially.
- **Development assistant:** OpenCode with OpenRouter free models. AI is a developer productivity tool, not a runtime dependency for the lab.
- **Current status:** Phase 2 (app shell, learning tracks, scenario catalog, and guides) complete and verified. **The approved Phase 2.5 redesign is COMPLETE (M1–M8) and merged into `main` via PR #2 (https://github.com/thisishamza/qa-practice-lab/pull/2). Phase 3 (commerce practice app) is IMPLEMENTATION-COMPLETE, merged into `main` via PR #4, and DEPLOYED TO PRODUCTION (https://qa-practice-lab.pages.dev, Cloudflare Pages project `qa-practice-lab`, D1 `qa-practice-lab-db`, schema_version 9) on 2026-11-16 — see §11. P3-M9 (hardening, reset & Phase 3 exit audit — per-IP rate limits, bounded cleanup sweeps, local demo reset, exit audit doc) is complete; the deployment was performed with user approval and the smoke suite passed against production. Phase 4 has started: the plan is written and, on 2026-11-16, consolidated from eight milestones to exactly three and had its five planning decisions resolved: `docs/phase-4-learning-intelligence-plan.md` ("Phase 4 — Learning & Bug-Hunt Intelligence", milestones P4-M1 → P4-M2 → P4-M3). **P4-M1 WP1 (scenario curriculum enrichment) is implemented, reviewed, verified and committed as the branch baseline (`feat: complete phase 4 curriculum foundation`) on 2026-11-16 — see §11 and §14. P4-M1 WP2 (migration 0010 `db/migrations/0010_hunt_attempts.sql`, `schema_version` → 10, attempts/report persistence, `report:<iphash>` 30/min scoped limit) is implemented, reviewed, verified and committed on the branch (`feat: add phase 4 attempt and report persistence`, 2026-11-16) — see §11 and §14. P4-M1 WP3 (the deterministic §6.4 bug-report evaluator, `src/server/reportQuality.ts`, synchronous in the POST report path — score/feedback persisted, `hunt_attempts.best_quality_score` running max, sticky `discovered`, inside the same all-or-nothing D1 batch) is implemented, reviewed, verified and committed on the branch (`feat: evaluate phase 4 bug reports`, 2026-11-16) — see §11 and §14. **P4-M2 WP1 (the progressive-hint ladder and the server-controlled gated solution reveal: server-only registries `src/server/hints.ts` + `src/server/reveals.ts`, routes in `src/server/learning.ts` — `POST …/hints` (strict level validation, server-enforced ordering via `hint_mask`, idempotent, 409 `hint_level_locked` on skips), `GET …/reveal` (403 `reveal_locked` until the attempt is `submitted`/`revealed`) and `POST …/reveal` (explicit confirmed give-up; sets `revealed`, never awards discovery, idempotent, preserves submissions/best score/discovery)) is implemented, reviewed, verified and committed on the branch (`feat: add phase 4 hint and reveal backend`, 2026-11-16) — see §11 and §14. **P4-M2 WP2 (the structured bug-report experience: the report panel on both wired hunt panels replacing the old `BugReportExport` — labelled fields, persistent required/optional markers, blur inline validation, linked error summary with focus management, server submission via a new typed `submitReport` client, duplicate-in-flight guard, server 400 per-field errors, and the deterministic evaluation result view (score /100, verdict tag, per-check checklist, report-quality vs. finding-the-defect explainer, revise-&-resubmit); plus a markdown download generated from the submitted report and safe feedback only — 32/32 browser-probe checks pass against the production build on both themes at 375/768/1024/1440 px) is implemented, reviewed, verified and committed on the branch (`feat: add structured bug report evaluation UI`, 2026-11-16) — see §11 and §14.** **P4-M2 WP3 (the learner-facing hint/reveal/attempt-status surfaces — `src/components/ui/Modal.tsx` (WAI-modal), `src/features/practice/HintLadder.tsx` (three-level sequential disclosures, server-state restore on mount, single-flight guard, learner-safe error mapping), `src/features/practice/RevealPanel.tsx` (locked 403 state with zero content, give-up WAI-modal confirm dialog — cancel makes no request, confirm posts `{confirm:true}` — revealed view distinguishing give-up from report-submitted), `src/features/practice/AttemptStatusChip.tsx` (hunt-card lifecycle chips: Not started / In progress / Submitted · score / Solution viewed), pure `src/lib/hintReveal.ts` + `src/lib/attemptStatus.ts`, and the report→reveal in-place unlock wiring) is implemented, reviewed, verified and committed on the branch (`feat: add phase 4 hint and reveal UI`, 2026-11-16) — P4-M2 (WP1 + WP2 + WP3) is complete; see §11 and §14.** **P4-M3 WP1 (the progress API and the real `/progress` — `GET /api/v1/practice/progress` in `src/server/progress.ts` (owner-scoped aggregate: per-wired-hunt status/discovery/best score/hints/attempts/last submission, 10 newest submissions with score+verdict from the §6.4 bands, totals with pure status buckets and integer average over scored attempts, `persistence: session|customer` marker, no internal ids, discovery excluding revealed attempts, reads-only — no migration), `src/features/progress/ProgressDashboard.tsx` + the rewritten `src/pages/ProgressPage.tsx` (loading/error/empty/populated states, guest-vs-signed-in durability banners, discovery progress bar, per-hunt links, refresh + remount-refetch) and `src/lib/progressDates.ts`) is implemented, reviewed, verified and committed on the branch (`feat: add phase 4 progress dashboard`, 2026-11-16) — see §11 and §14.** **P4-M3 WP2 (scoring transparency & the recommended completion path — canonical learner-safe rubric `src/shared/evaluationRubric.ts` re-exported by the server evaluator, `src/features/evaluation/EvaluationTransparency.tsx` on `/about#evaluation` with a linked section on wired scenario pages, the `/practice` Recommended path upgraded with curriculum-sourced outcome lines and completion state from `GET /api/v1/practice/progress` (completion = a submitted report, i.e. `lastSubmittedAt !== null`; discovery shown separately, never score- or reveal-derived; progress-unavailable keeps the path usable with a retry) plus the About-page durability (guest 7-day TTL, non-transfer) and synthetic-environment explanations) is implemented, reviewed, verified and committed on the branch (`feat: add phase 4 learning transparency`, 2026-11-16) — see §11 and §14.** **P4-M3 WP3 (the Phase 4 exit audit & release readiness — `docs/phase-4-exit-audit.md`) is implemented, verified and committed on the branch on 2026-11-16: the full suite re-runs green (720/720), production build passes, client bundle leak scan clean, focused suites re-run (171/171), and the complete learner journey was exercised end-to-end in a browser over CDP (fresh guest: start hunt → ordered hints → skip refused 409 → refresh-persisted ladder → error summary focus → report → evaluation → reveal unlocked in-place → resubmission; give-up path grants zero discovery; signed-in banner flip; placeholders intact; themes × 4 widths, zero overflow; zero console errors) — 133/133 checks pass; all nine plan §13 exit criteria PASS (merge to `main`/deploy remain explicit maintainer decisions); Phase 4 is implementation-complete and release-ready but NOT DEPLOYED (production still runs the pre-Phase-4 build at `schema_version` 9) — see §11 and the audit document.** The dedicated implementation branch is `feat/phase-4-learning-intelligence` (created from `main` @ `30d3424`; P4-M1 WP1–WP3 + P4-M2 WP1–WP3 + P4-M3 WP1–WP3 are committed there; nothing pushed, merged or deployed).** M9 (optional polish) is not started and only on request.
- **Last updated:** 2026-11-16.

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

Phase 3 is complete, merged to `main` (PR #4) and deployed to production on 2026-11-16. The approved plan and milestone
sequence (P3-M1 … P3-M9) lives in `docs/phase-3-commerce-practice-plan.md`; see §12 for status and `docs/phase-3-exit-audit.md` for the audit.
P3-M1 (domain foundation), P3-M2 (storefront catalogue UI), P3-M3 (session cart), P3-M4
(checkout & orders), P3-M5 (synthetic customers & auth simulation), P3-M6 (inventory depth)
and P3-M7 (bug-hunt engine v1) are implemented and verified on that branch.
| 4. ~~API & identity lab~~ → **Learning & Bug-Hunt Intelligence** | Bug-hunt learning loop: reveal/hints, structured bug-report evaluation, scoring, attempt persistence, progress (plan: `docs/phase-4-learning-intelligence-plan.md`, 2026-11-16). The original API & identity lab is deferred — see the plan's §12 for the suggested renumbering (user confirmation required) | Implementation exit criteria in plan §13 met and audited |
| 5. Async/microservice lab | Job/outbox model, status polling, retries, idempotency, webhooks, failure injection | Learners can observe and test asynchronous state transitions safely |
| 6. Database lab | Isolated SQLite/WASM database playground and SQL exercises | Arbitrary learner SQL is isolated from platform D1 and resettable |
| 7. Contract testing | Versioned schemas, consumer/provider examples, contract break/fix exercises | Learners can detect schema incompatibility using examples and tooling |
| 8. Automation examples | Playwright UI/API starter suite and Postman/Newman collection | Learners can run examples locally against lab targets |
| 9. Performance & security tracks | Capped first-party load runner and non-destructive security exercises | Hard safety caps and abuse controls are tested before publishing |
| 10. Hardening & launch | Accessibility, responsive polish, docs, observability, rate limits, retention, backup/export, deploy | Production smoke tests pass and free-tier monitoring/limits are documented |

Note (2026-11-16): the Phase 4 charter changed from "API & identity lab" to **Learning &
Bug-Hunt Intelligence** (see `docs/phase-4-learning-intelligence-plan.md`). The API & identity
lab is deferred, not cancelled; whether the later phases are renumbered (API & identity lab →
Phase 5, shifting the rest) is a maintainer decision — the plan's §12 lists a suggested
mapping for confirmation. The table above intentionally retains the old numbering until that
decision is made.

Phase 1 exit criteria were verified locally on 2026-11-14: the app runs, `/api/health` reports the
migrated D1 database, and the Pages preview serves the production build and Functions.

Phase 2 exit criteria were verified locally on 2026-11-14: a learner can navigate twelve learning
tracks, search and filter the scenario catalog, open a structured guide, and read scenario detail
pages. Phase 3 is complete, merged and deployed; Phase 4 is implementation-complete and release-ready
but **NOT DEPLOYED** (2026-11-16, `docs/phase-4-learning-intelligence-plan.md`; three milestones P4-M1 → P4-M2 → P4-M3 after the same-day consolidation) — P4-M1 WP1 is committed as the branch baseline and P4-M1 WP2 is implemented, reviewed, verified and committed on the branch; P4-M1 WP3 (the deterministic §6.4 evaluator) is implemented, reviewed, verified and committed on the branch as `feat: evaluate phase 4 bug reports`; **P4-M2 WP1 (progressive hints & gated reveal backend), P4-M2 WP2 (structured bug-report & evaluation UI) and P4-M2 WP3 (hint ladder, gated reveal UI, give-up confirmation and attempt-status chips) are implemented, reviewed, verified and committed on the branch as `feat: add phase 4 hint and reveal backend`, `feat: add structured bug report evaluation UI` and `feat: add phase 4 hint and reveal UI` — P4-M2 is complete**; **P4-M3 WP1 (progress API, attempt history & aggregate scoring + the real `/progress`) is implemented, reviewed, verified and committed on the branch as `feat: add phase 4 progress dashboard` — **P4-M3 WP2 (scoring transparency + recommended path) is implemented, reviewed, verified and committed on the branch as `feat: add phase 4 learning transparency`** — **P4-M3 WP3 (Phase 4 exit audit & release) is implemented, verified and committed on the branch (`docs: add phase 4 exit audit`; see `docs/phase-4-exit-audit.md`) — Phase 4 is implementation-complete and NOT DEPLOYED**. Phases 5–10 remain unstarted.

## 10. Repository shape (current after Phase 2)

```text
qa-practice-lab/
├── AGENTS.md
├── PROJECT_STATE.md
├── README.md
├── docs/
│   ├── phase-2.5-ui-ux-audit.md      # audit + redesign plan (no code changes)
│   ├── phase-3-commerce-practice-plan.md  # Phase 3 plan: milestones P3-M1..P3-M9, bug-hunt engine design
│   ├── bug-hunt-catalogue.md             # internal maintainer registry: Expected vs Actual per defect
│   ├── phase-3-exit-audit.md             # P3-M9 exit audit (milestones, schema, security, cleanup, limits)
│   ├── phase-4-learning-intelligence-plan.md  # Phase 4 plan: Learning & Bug-Hunt Intelligence (exactly 3 milestones: P4-M1..P4-M3; consolidated 2026-11-16; P4-M1 WP1 implemented 2026-11-16)
│   └── phase-4-exit-audit.md         # P4-M3 WP3 exit audit & release readiness (2026-11-16; NOT DEPLOYED)
├── package.json / package-lock.json   # v0.2.0
├── index.html                         # includes the pre-paint theme bootstrap
├── vite.config.ts / vitest.config.ts
├── wrangler.jsonc                     # Pages config + local D1 binding
├── eslint.config.js
├── tsconfig.json                      # references app/node/functions projects
├── tsconfig.app.json                  # src + client view tests (incl. tests/pages/curriculum-views.test.tsx), excludes src/server
├── tsconfig.node.json                 # Vite/Vitest config files
├── tsconfig.functions.json            # functions, src/server, tests
├── functions/
│   └── api/[[route]].ts               # Hono -> Pages Functions catch-all
├── src/
│   ├── app/App.tsx                    # ThemeProvider + AppShell routes
│   ├── components/
│   │   ├── layout/                    # AppShell, TopBar, Sidebar, MobileNav
│   │   └── ui/                        # Icon, Button, IconButton, Tag, LevelMeter, Meta,
│   │                                  # FactList, StatTile, Callout, States, progress, theme,
│   │                                  # Modal (P4-M2 WP3 WAI-modal)
│   ├── data/                          # typed tracks, categories, scenarios, guides, demo
│   ├── features/
│   │   ├── practice/                  # P3-M7 api client, HuntPanel (M8 registry-driven),
│   │   │                              # PracticeSessionProvider, ModeBanner, HuntLaunchPanel,
│   │   │                              # BugReportForm + ReportEvaluationView (P4-M2 WP2),
│   │   │                              # HintLadder + RevealPanel + AttemptStatusChip (P4-M2 WP3)
│   │   ├── progress/                  # P4-M3 WP1 ProgressDashboard (presentational; container is
│   │   │                              # the ProgressPage; states loading/error/ready)
│   │   ├── catalog/                   # ScenarioCard, ScenarioFilterBar
│   │   ├── cart/                      # CartContext (provider), cart-context, useCart,
│   │   │                              # CartView, api (cart client)
│   │   ├── auth/                      # AuthContext (provider), auth-context, useAuth,
│   │   │                              # api (account/auth client)
│   │   ├── checkout/                  # CheckoutView, OrderConfirmationView, useCancelOrder, api
│   │   ├── inventory/                 # InventoryManager (staff-only restock UI) + api client
│   │   ├── guides/                    # GuideCard
│   │   ├── shop/                      # ProductCard, ProductDetail, ProductStates,
│   │   │                              # ShopFilterBar, Pagination, api (catalogue client)
│   │   ├── system/                    # HealthStatus
│   │   └── tracks/                    # TrackCard
│   ├── lib/                           # catalog filtering, labels, navigation, route management, theme,
│   │                                  # reportForm (P4-M2 WP2), hintReveal + attemptStatus (P4-M2 WP3),
│   │                                  # progressDates (P4-M3 WP1)
│   ├── pages/                         # route-level pages (dashboard … about, shop, shop product,
│   │                                  # cart, checkout, orders confirmation, login, account,
│   │                                  # account orders, account order detail, admin inventory (staff), 404)
│   ├── server/app.ts                  # testable Hono app, basePath /api; body-size guard (413),
│   │                                  # global mutation rate limit, no-store/nosniff headers
│   ├── server/rateLimit.ts            # P3-M9 fixed-window limiter (login/checkout/mutate scopes)
│   ├── server/maintenance.ts          # P3-M9 bounded cleanup sweep + staff-only sweep endpoint
│   ├── server/catalogue.ts            # Phase 3 catalogue routes (/api/v1, incl. q search; hunts CATALOGUE-001/002)
│   ├── server/cart.ts                 # Phase 3 session cart routes (/api/v1/cart)
│   ├── server/checkout.ts             # Phase 3 checkout & order routes (/api/v1/checkout, /api/v1/orders)
│   │                                  # + P3-M6 cancellation (/api/v1/orders/:reference/cancel)
│   ├── server/session.ts              # anonymous practice sessions (SHA-256-hashed tokens)
│   ├── server/auth.ts                 # P3-M5 auth + protected account routes (/api/v1/auth/*,
│   │                                  # /api/v1/account/*); PBKDF2 verify, token rotation, 401/403/404
│   ├── server/inventory.ts            # P3-M6 staff-only inventory routes (/api/v1/admin/inventory*)
│   ├── server/staff.ts                # P3-M6 requireStaff guard (401/403 staff_required; role from DB only)
│   ├── server/customer.ts             # P3-M5 customer sessions (mpl_customer cookie, hashed tokens,
│   │                                  # practice-session binding, suspended handling)
│   ├── server/practice.ts             # P3-M7 practice-mode routes + P3-M8 hunts list, exact 20/IP/UTC-day cap
│   │                                  # (Phase 4 WP2: hunt start ensures the live in_progress attempt)
│   ├── server/attempts.ts             # P4-M1 WP2 attempt lifecycle + GET attempt / GET attempts history
│   ├── server/reports.ts              # P4-M1 WP2/WP3 structured bug-report validation + POST report
│   ├── server/reportQuality.ts        # P4-M1 WP3 deterministic §6.4 evaluator (pure; server-only)
│   ├── server/hints.ts                # P4-M2 WP1 hint ladder (compiled content, server-only)
│   ├── server/reveals.ts              # P4-M2 WP1 gated solution reveals (compiled content, server-only)
│   ├── server/learning.ts             # P4-M2 WP1 hints/reveal routes (attempt-scoped, gated)
│   ├── server/progress.ts             # P4-M3 WP1 GET /practice/progress (owner-scoped aggregate;
│   │                                  # pure summarize/build helpers exported for tests)
│   ├── server/hunts.ts                # P3-M7→M8 hunt registry (code, not data; scenarioId wiring)
│   ├── server/defects.ts              # P3-M7→M8 defect registry + isDefectActive() (server-resolved)
│   ├── shared/health.ts               # shared response type
│   ├── shared/commerce.ts             # shared catalogue + cart + order contracts (Phase 3)
│   ├── shared/practice.ts             # shared practice-mode/hunt-summary/list contracts (P3-M7/M8)
│   ├── shared/learning.ts             # shared Phase 4 attempt/report contracts (P4-M1 WP2) + P4-M2 WP1 hint/reveal types
│   │                                  # + P4-M3 WP1 progress contracts
│   ├── styles/                        # tokens, base, layout, components, workspace, pages, global
│   └── main.tsx
├── db/
│   ├── migrations/                    # 0001_initial_schema.sql, 0002_commerce_domain.sql,
│   │                                  # 0003_cart.sql, 0004_orders.sql, 0005_customers.sql,
│   │                                  # 0006_inventory_depth.sql, 0007_bug_hunt.sql,
│   │                                  # 0008_hunt_start_caps.sql, 0009_rate_limit_buckets.sql,
│   │                                  # 0010_hunt_attempts.sql (P4-M1 WP2)
│   └── maintenance/                   # P3-M9 local-only housekeeping SQL (cleanup.sql, reset-local.sql)
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
    ├── server/inventory.test.ts       # staff authz matrix, restock validation/cap, exactly-once
    │                                  # cancel, race for the last unit, audit-trail assertions
    ├── server/health.test.ts
    ├── server/hunt.test.ts            # P3-M7 bug-hunt engine: registries, activation, isolation,
    │                                  # reset, idempotency, guest+account compatibility, forged ids
    ├── server/hunt-set.test.ts        # P3-M8 defect set: both branches per defect, whole-set reset,
    │                                  # two-learner isolation, per-IP daily cap, hunt catalogue
    ├── server/report-quality.test.ts # P4-M1 WP3: unit suite for the §6.4 evaluator — every check,
    │                                  # boundaries, verdict bands, determinism, no-leakage lint
    ├── server/hints-reveal.test.ts   # P4-M2 WP1: 21 hint levels, ladder order/idempotency,
    │                                  # per-session/per-hunt isolation, reveal gating (403 pre-unlock),
    │                                  # give-up semantics, discovery independence, leak checks
    ├── server/attempts.test.ts        # P4-M1 WP2+WP3: migration 0010 (fresh + 0001-0009 upgrade),
    │                                  # FKs/checks/partial unique index, cascade, attempt lifecycle
    │                                  # + idempotency, report validation/ownership, rate limiting,
    │                                  # WP3 evaluation persistence/best-score/sticky-discovery
    ├── server/hardening.test.ts       # P3-M9: migration 0009 (fresh + upgrade paths), body-size
    │                                  # guard, rate limits (mutate/login/checkout), sweep authz
    │                                  # + bounded idempotent deletion, hunt cap atomicity
    ├── practice/api.test.ts           # P3-M7 browser client (stubbed fetch) + P4-M2 WP3 learning clients
    ├── practice/bug-report-form.test.tsx   # P4-M2 WP2 SSR markup tests
    ├── practice/hint-reveal-ui.test.tsx    # P4-M2 WP3 SSR markup tests (ladder/panel/chip/Modal)
    ├── lib/attempt-status.test.ts     # P4-M2 WP3 chip mapping
    ├── lib/hint-reveal.test.ts        # P4-M2 WP3 ladder/flows + client-source/ bundle leak lint
    ├── lib/report-form.test.ts        # P4-M2 WP2 form controller tests
    ├── server/progress.test.ts        # P4-M3 WP1: API/ownership/aggregation/leak tests (22)
    ├── pages/progress-page.test.tsx   # P4-M3 WP1: dashboard SSR markup tests (16)
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
Phase 3 (P3-M6) added `/admin/inventory` — staff-only inventory view and restock tool (server
enforces authorization; the page renders honest guest/customer/staff states; the sidebar and
mobile nav carry an Inventory entry for staff only). Both confirmation pages gained an inline
cancel panel (`placed → cancelled`, stock restored exactly once).
Phase 3 (P3-M8) wired hunts into the scenario catalogue: seven scenarios flipped to
`ready`/`runnable` with a `huntId`, wired scenario pages carry `HuntLaunchPanel`, `/practice`
lists the registry, the catalogue shows a badge and `?hunt=available` facet. Phase 3 (P3-M7)
mounted no new routes: every page now renders a slim `ModeBanner`
(clean vs bug-hunt, `role="status"`, reset action) above the routed content, and `/practice`
gained a Bug-hunt mode section (`HuntPanel`) with start/reset controls.
`App.tsx` wraps the routes in `PracticeSessionProvider`.

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

### 2026-11-16 — Phase 4 P4-M3 WP3 complete: exit audit & release readiness (implementation-complete; NOT DEPLOYED)

- **Scope:** P4-M3 WP3 only — the Phase 4 end-to-end exit audit and release-readiness determination (`docs/phase-4-exit-audit.md`). No new features; no product-code defects were found or fixed. Nothing pushed, merged, PR'd or deployed; no earlier commits amended or reset; production D1 remains `schema_version` 9; local D1 remains `schema_version` 10.
- **Git safety (all expectations met):** branch `feat/phase-4-learning-intelligence`; HEAD at session start was `86076b7` (`feat: add phase 4 learning transparency`) as expected; working tree clean at start; no reset, restore, stash, clean, branch switch, push, merge or deploy occurred. The audit documentation commit includes `README.md` status-line updates only (no code changes).
- **Verification (actual results):** `npm run check` — ESLint clean; TypeScript clean (three projects); tests **720/720 green across 36 files**. `npm run build` — production build succeeded (JS **538.57 kB** / gzip **156.15 kB**; CSS **88.20 kB** / gzip **15.91 kB**; no new runtime dependencies; the pre-existing >500 kB chunk advisory unchanged). Focused suites re-run: 171/171 across `attempts`, `hints-reveal`, `hardening`, `progress`, `report-quality`. **Client-bundle leak scan** — zero hint/reveal registry strings (19 hint + 83 reveal-derived strings checked; one overlap is the shared learner-safe curriculum string); zero defect ids (`CATALOGUE-001…`, `CART-001`, `INVENTORY-001`, `PRICING-001`, `CHECKOUT-001`, `AUTHZ-001`); zero `hunt_attempts`/`bug_reports`/`hint_mask`/evaluator internals (published-rubric check ids — `severity-valid`, `priority-valid`, etc. — are intentional, the transparency page renders them verbatim); `reveal_locked`/`hint_level_locked` appear only as required 403/409 error-code→message mappings; pre-unlock DOM carries no reveal content (asserted in-browser). **Headers** — `Cache-Control: no-store` + `X-Content-Type-Options: nosniff` confirmed on `/api/health` and `/api/v1/practice/hunts`. **Raw checks (curl, production build)** — reveal pre-unlock → `403 reveal_locked` (content-free); hints/report without session → `401 session_required`; progress without a live session → `200` with the all-`none`/zeroed empty payload; malformed hunt id → `400 invalid_request`; unknown hunt → `404 hunt_not_found`; 40 KB body → `413 payload_too_large`. **Migration compatibility** — fresh and 0001–0009 → 0010 upgrade paths pass (`tests/server/attempts.test.ts`, re-run); maintenance sweep cascade into `hunt_attempts`/`bug_reports` asserted; local D1 `schema_version` **10** confirmed via `wrangler d1 migrations apply --local` + `/api/health`.
- **Browser acceptance (system Chrome over raw CDP against the production build served on an ephemeral `wrangler pages dev` on 127.0.0.1:8790; local D1; a fresh guest browser profile; the pre-existing :8788 dev server untouched):** **133/133 checks pass.** Guest journey from `/scenarios/manual-cart-totals`: hunt start → hints 1–3 unlocked in order → skip to 3 refused (`409 hint_level_locked`) → level-1 re-request idempotent (`hintsUsed` stays 1) → ladder restored after reload (`3 of 3 hints used`, restored hints as readable closed disclosures) → empty submit → linked error summary with focus → complete report → evaluation view (score/verdict) → **reveal unlocked in-place via the report path without give-up** → resubmission evaluates again → `/progress` shows the hunt row and recent submissions → recommended path renders with completion state. Give-up journey on `/scenarios/manual-shop-search`: give-up dialog opens; **cancel fires zero network requests (CDP network log asserted)** and reveal stays `403`; confirm → reveal renders with give-up framing; a report filed **after** give-up evaluates normally but earns **zero discovery** (`/api/v1/practice/progress` shows `status: "revealed"`, `discovered: false`). Signed-in journey: `/login` as Amara flips `/progress` to the signed-in attribution banner; `GET /api/v1/practice/hunts` returns exactly seven runnable hunts with curriculum; placeholder scenario renders the not-runnable callout. **Both themes × 375/768/1024/1440 px on `/practice`, `/progress`, `/about`, `/scenarios/manual-cart-totals`:** exactly one `h1` each, zero horizontal overflow. **Zero unexpected console errors/exceptions** (the only resource logs were the deliberate 403/409 negative-path responses).
- **Audit documentation:** `docs/phase-4-exit-audit.md` — scope and commit audited; each of the nine plan §13 exit criteria graded **PASS** (criterion 1: implementation and gates green on the branch; merge/PR/deploy is the explicit maintainer release step); migration/schema status (0010 additive-only; local 10; production 9 untouched); capabilities; security & privacy review (ownership scoping, reveal gating, report data handling and logging, rate limits, no internal ids pre-unlock, guest TTL and cascade); tests/build/browser results; defects found (none in product code — three predicates in the ephemeral probe were wrong and corrected; the one WP2-discovered unlock bug remains fixed and is now covered end-to-end by this audit); known limitations; release-readiness verdict; deployment verification and rollback considerations per plan §7.5; explicit **NOT DEPLOYED** statement; the exact release next action. The Phase 4 plan was left substantively unchanged (verified outcomes recorded here and in the audit; no criteria waived or rewritten).
- **Defects found in product code:** none. **Known issues (documented, not hidden):** all three theme/width passes and the interaction flows were exercised through the CDP probe and unit/markup tests (no committed browser runner — consistent with prior phases); Firefox/WebKit not run; accessibility review was manual, not scanner-based; rate limits remain fixed-window abuse controls; the local D1 accumulates throwaway probe rows until `npm run db:reset:local`; the >500 kB chunk advisory remains; the §8 probe negative-path resource logs (401/403/409) are expected by design.
- **Exact next action:** **Phase 4 is implementation-complete and release-ready but NOT DEPLOYED.** The maintainer must decide: if releasing — `npm run check && npm run build`, apply migration `0010_hunt_attempts.sql` to the production D1 via the established remote-migration procedure, then `npx wrangler pages deploy dist`, then run the audit's §8 post-deploy verification (health `schemaVersion: "10"`, full journey smoke, both themes, no pre-unlock defect ids) and record it here; if not — the branch remains the deliverable. Do not push, merge, PR or deploy without explicit maintainer instruction.

### 2026-11-16 — Phase 4 P4-M3 WP2 implemented, verified & committed: scoring transparency & the recommended completion path

- **Scope:** P4-M3 WP2 only — learner-facing evaluation transparency, the upgraded `/practice` recommended path, and the About-page durability/transparency copy. **No P4-M3 WP3 (exit audit & release) work.** Nothing pushed, merged, PR'd or deployed; no earlier commits amended. Production D1 remains `schema_version` 9; migration 0010 stays applied only to the local D1; `schema_version` stays **10** (no migration required or made — WP2 touches no server behaviour). The 21 placeholder scenarios remain unchanged and non-runnable.
- **Git safety (all expectations met):** branch `feat/phase-4-learning-intelligence`; HEAD at session start was `0cd7e08` (`feat: add phase 4 progress dashboard`) as expected; working tree clean at start; no reset, restore, stash, clean, branch switch, push, merge or deploy occurred.
- **Canonical rubric (one source of truth):** new learner-safe shared module `src/shared/evaluationRubric.ts` — `EVALUATION_RUBRIC` (the ten §6.4 checks in plan order with labels, points and learner-friendly summaries), `EVALUATION_TOTAL_POINTS` (100), `VERDICT_BANDS` (solid 80–100 · needs-work 50–79 · incomplete 0–49 with labels matching the §6.4 verdict vocabulary). `src/server/reportQuality.ts` now derives `RUBRIC_CHECKS` from `EVALUATION_RUBRIC` (re-exported unchanged, plus `RUBRIC_TOTAL_POINTS`) — the published transparency and the implemented checks cannot drift apart; point allocations, check logic, `verdictForScore` and all evaluator behaviour are unchanged.
- **Evaluation transparency:** new `src/features/evaluation/EvaluationTransparency.tsx` renders the ten checks with actual weights (+ "Total: 100 points"), the three verdict bands with thresholds, a callout stating plainly that **a high report score does not automatically mean the defect was found**, how discovery works in behavioural terms (finding evidence across title/steps/expected/actual only — environment lines excluded; server-side curated, synonym-accepting match; environment/unrelated mentions never count; sticky once earned; a revealed attempt confers no discovery even if a report is filed afterwards; hints never award discovery and never lower the score; revealing the solution never counts as completing the exercise), the no-timer/no-comparison/no-AI statement and the fictional-environment/synthetic-checkout note. **Canonical location: `/about#evaluation`** (AboutPage section `id="evaluation"`, scroll-margined, hash-scroll honoured client-side via `useLocation`); wired scenario pages (`ScenarioDetailPage`, runnable hunt scenarios only) carry a "How your report is evaluated" section that links to it. No page duplicates the rubric; the shared module is the single source. No finding terms, synonym lists, defect ids, attempt/report ids, hint/reveal content or evaluator internals appear in any transparency surface (leak-asserted by test and by client-bundle scan).
- **Recommended path (`/practice`):** new presentational `src/features/practice/RecommendedPath.tsx` + container `useProgress` (`src/features/progress/useProgress.ts`, extracted from the previously inline `ProgressPage` logic — behaviour identical, single fetch on mount which re-reads on route remount, manual retry/refresh, abort on unmount; no polling, no duplicate in-flight requests). New pure `src/lib/recommendedPath.ts`: `getRecommendedPath()` derives the seven wired hunts in the approved `recommendedHuntScenarioIds` order with positions 1–7, curriculum metadata read from the existing shared registry (`skillArea`, difficulty, `conceptsPracticed`, `expectedOutcomes` — never re-declared); `completionForEntry()` maps the WP1 progress payload onto completion. Each step shows: position, difficulty + skill area (kicker), hunt title, "You will be able to: …" (first `expectedOutcomes` line), "Concepts practised: …" (curriculum-sourced), and — when progress is ready — a completion chip + `Discovered` tag (only when the sticky flag is set) + `Best {score}` (when scored). **Completion definition (documented interpretation): a hunt counts as completed when at least one bug report has been submitted against it — surfaced by the WP1 aggregate as `lastSubmittedAt !== null`.** This follows the approved plan ("Completion = a submitted report", regardless of score), is sticky across hunt switches/resets and re-opened attempts, never infers completion from score/hints/reveal, and is deliberately independent of the latest attempt's status (a report filed on a revealed attempt still counts as submitted; a give-up alone — `lastSubmittedAt === null` — never completes). Discovery is shown separately and never inferred from any of this. Placeholder scenarios are not in the path (footer note says so explicitly); hunt links and launch behaviour unchanged.
- **Progress-unavailable behaviour:** when the progress fetch fails, the path renders unchanged with the statuses hidden (never fabricated) behind an inline `role="alert"` note ("completion states are hidden rather than guessed") plus a "Try again" retry button; while loading, a non-blocking `role="status"` "Checking your progress…" note renders instead of chips. `/progress` shows real data and is unchanged in behaviour (uses the extracted `useProgress`).
- **About page (`/about`):** outdated claims corrected (exercises are runnable, progress page shows real session-scoped data with labelled demo figures on the dashboard, no longer "the health check is the only live API call"). New durability section "How long your progress lasts" — guest: anonymous session-bound, temporary, seven-day TTL, then deleted; never copies elsewhere; signing in does not transfer guest progress. Signed in: attribution to the synthetic training customer associated at submission time (stamped on the attempt), guest rows remain session-bound and never re-attributed; signing in never merges or migrates earlier guest progress; accounts are fictional demo accounts. New "Learning and evaluation" section (the transparency component) and synthetic-environment limitations stated alongside the rubric (nothing really bought/paid for/shipped; scores measure practice, not employment readiness or real payment systems). Existing "No AI service is required" callout kept, corrected.
- **Semantics preserved:** no scoring, evaluator, attempt-lifecycle, discovery, reveal, hint or endpoint behaviour changed; no new endpoints; no server-only module imported by any client-reachable module; client bundle scanned clean.
- **Verification (actual results):** `npm run check` — lint clean; typecheck clean (three projects — three new markup tests added to the `tsconfig.app.json` JSX whitelist and excluded from `tsconfig.functions.json`, mirroring the established pattern; note: importing server modules from app-project test files pulls the Worker graph into that project without workers-types — server-graph imports are therefore kept out of app-project tests); tests **720/720 passed** across **36 files** (+58 vs WP1's 662: evaluation-rubric 6, recommended-path lib 12, recommended-path view 16, evaluation-transparency 11, about-page 13). `npm run build` — production build succeeded. Migrations unchanged; local D1 `schema_version` **10** (all ten migrations verified in the active miniflare object file; an older orphaned local object shows 0001–0009 and is not in use); production D1 untouched.
- **Client-bundle leak scan:** zero defect ids (`CATALOGUE-001`…`AUTHZ-001`), zero `hunt_attempts`/`bug_reports`/`hint_mask`/evaluator strings; hint/reveal content absent; `hunt-*-001` present only as learner-safe curriculum registry keys (as designed).
- **Browser probe (headless Chrome 155 over raw CDP, production build served by an ephemeral `wrangler pages dev` on :8789 — not committed; the pre-existing :8788 dev server was left untouched):** 32/32 checks across `/about`, `/practice`, `/scenarios/manual-cart-add-quantity`, `/progress` × light/dark × 375/768/1024/1440 — zero horizontal overflow, exactly one `h1`, valid heading hierarchy (no skipped levels), zero unnamed interactive elements, visible `:focus-visible` ring on keyboard Tab, zero console errors/exceptions, zero non-required findings. Element-clipped screenshots inspected in both themes at 375/1024/1440 (rubric rows, verdict bands, discovery callout, recommended path steps with the COMPLETED/DISCOVERED chips on the locally-seeded `hunt-pricing-001` fixture, mobile-stacked step layout, durability panels). `/about#evaluation` deep link verified to scroll to the section (scrollY 1340, scroll-margin honoured). "Dark" captures required setting `localStorage['qa-practice-lab-theme']` via `Page.addScriptToEvaluateOnNewDocument` — plain `prefers-color-scheme` emulation did not reach the inline theme bootstrap on this Chrome; recorded so future probes use the same approach.
- **Deviations/limitations:** the browser probe is not committed (no browser runner — consistent with prior phases); the local D1 carries rows from an earlier WP1 probe (`hunt-pricing-001` attempt + reports, score 100, discovered) — visible in screenshots, local-only, never committed; completion-state interpretation (`lastSubmittedAt !== null`) is a documented interpretation of the approved plan's "Completion = a submitted report" (the WP1 aggregate exposes no per-hunt ever-submitted flag other than this field) — recorded here and in the plan; the report→submission-after-give-up edge case (status stays `revealed`, `lastSubmittedAt` set) is therefore shown as Completed, matching the plan's "completion regardless of score" wording while discovery stays uncredited; `/practice`'s recommended path and `/progress` each fetch the progress endpoint on mount (two pages, one request each — no shared cache introduced).
- **Next task: P4-M3 WP3 — Phase 4 final progress, scoring and release audit** (plan P4-M3 WP3; `docs/phase-4-exit-audit.md`). Do not start without explicit maintainer instruction; do not push, merge, PR or deploy.

### 2026-11-16 — Phase 4 P4-M3 WP1 implemented, verified & committed: progress API, attempt history & aggregate scoring + the real /progress

- **Scope:** P4-M3 WP1 only — `GET /api/v1/practice/progress`, attempt-history aggregation and the rewritten real-data `/progress` page. **No P4-M3 WP2 (scoring transparency, recommended path) or WP3 (exit audit) work.** Nothing pushed, merged, PR'd or deployed; no earlier commits amended. Production D1 remains `schema_version` 9; migration 0010 stays applied only to the local D1; `schema_version` stays **10** (no migration required or made — the endpoint is read-only). The 21 placeholder scenarios remain unchanged and non-runnable.
- **Git safety (all expectations met):** branch `feat/phase-4-learning-intelligence`; HEAD at session start was `ef627f4` (`feat: add phase 4 hint and reveal UI`) as expected; working tree clean at start; no reset, restore, stash, clean, branch switch, push, merge or deploy occurred.
- **`src/shared/learning.ts`:** new learner-safe contracts `ProgressPersistence`, `ProgressHuntEntry`, `ProgressRecentSubmission`, `ProgressTotals`, `ProgressResponse` (no ids; `attempts`, `inProgress`, `submitted`, `revealed`, `reports`, `discovered`, `hintsUsed`, `bestScore`, `averageBestScore`).
- **`src/server/reportQuality.ts`:** new exported `verdictForScore(score)` — the §6.4 bands (≥80 solid · 50–79 needs-work · <50 incomplete) now have one source of truth, shared by the evaluator and the progress read path. No behavioural change.
- **`src/server/progress.ts` (new; routes mounted in `app.ts`):** `GET /api/v1/practice/progress` (cookie-resolved; no attempt/customer ids ever accepted). Owner scope identical to attempts/history: caller session rows `OR` (when signed in) the active customer binding's rows — one table, no join, no double count; there is no cross-customer or admin path (staff gains nothing). `persistence: 'customer'` exactly when the active binding exists, else `'session'`. Response: `persistence`, `hunts` (one entry per wired registry hunt in registry order — `status` = latest attempt, `discovered` sticky across the hunt's attempts, `bestScore` = max across its attempts, `hintsUsed` summed across its attempts via the shared mask popcount, `attempts` counted, `lastSubmittedAt` = latest first submission, null until submitted), `recent` (≤10 newest `bug_reports` in scope, `ORDER BY report id DESC`; verdict from the persisted score via `verdictForScore`) and `totals` (attempts by status bucket — pure: attempts = inProgress + submitted + revealed; `reports` = submitted report rows; `discovered` = DISTINCT hunts discovered; `hintsUsed` = mask popcount sum; `bestScore` = max over scored attempts; `averageBestScore` = integer mean over scored attempts only, null until ≥1 is scored). Empty payload (all-`none` hunts, zeroed totals, `recent: []`) when no live practice session exists.
- **Discovery semantics (as instructed):** discovery credit requires the persisted `discovered = 1` **and a non-`revealed` attempt status** — a give-up that comes first keeps the attempt `revealed` even when a report is filed afterwards, and such an attempt confers no discovery (submit-then-reveal keeps the attempt `submitted` and keeps credit). A reveal alone awards no discovery; score and hints never convert into discovery; hints never lower a score. Report quality, attempt status and defect discovery stay separate signals throughout (tile, bar, chips, copy).
- **No internal identifiers:** response carries no attempt/report/customer/session ids, no `hint_mask`, `best_quality_score`, `bug_reports`/`hunt_attempts` names, no evaluator internals, no defect ids (asserted by test, markers list incl. all seven defect codes). No defect list or evaluator term leaves the server.
- **Attempt history & bounds:** hunts fixed at the registry size (7); `recent` capped at 10; single aggregate scan (`ORDER BY id DESC`) over the caller's attempt rows — attempts are bounded by learner action and cascade with the 7-day session TTL; per-session scoping identical to attempts history.
- **Frontend:** `src/features/progress/ProgressDashboard.tsx` (presentational; all states through props for SSR-markup tests) + rewritten `src/pages/ProgressPage.tsx` (container: fetch on mount — route remount re-reads; manual Refresh; abort on unmount; retry from error). Sections: persistence banner (guest: temporary, 7-day TTL, never transfers to an account; signed-in: attribution to the synthetic account at submission time; guest rows never transfer), honest zero-state callout with a link to the first recommended hunt, six stat tiles (Attempts, Reports submitted, Defects discovered X of 7, Hints used, Best score, Average best score), discovery `ProgressBar` (0–7), the seven hunts as link rows (status chip, discovered/not-discovered tag, best score, hints, last submitted, links to the wired scenario pages), recent submissions list (score, verdict tag, date), footer transparency note. Loading/error/retry/empty/populated states; `useDocumentTitle('Progress')`; `Breadcrumbs`; one `h1`; keyboard-accessible links/controls; `.sr-only` score sentences; refresh disabled in-flight. **All sample/demo progress markup removed** (`demoProgress`/`demoDisclaimer` untouched in `demo.ts` — content tests + dashboard still use them; the ProgressPage neither imports nor renders them). Old dead styles removed (`.progress-list`, `.progress-row(-link)`, `.progress-note`, `.tracked-*`).
- **Shared client:** `fetchProgress` typed client added to `src/features/practice/api.ts` (cookie session; no ids sent; `PracticeApiError` on non-OK; `signal` supported) — existing error conventions reused, no duplicated fetch logic. `src/lib/progressDates.ts` (pure, raw-string fallback on unparseable timestamps).
- **Verification (actual results):** `npm run check` — lint clean (one `react-hooks/set-state-in-effect` finding fixed by moving the in-flight flag into the user-action callback); typecheck clean (three projects — new markup test added to `tsconfig.app.json` include and excluded from `tsconfig.functions.json`); tests **662/662 passed** across **31 files** (was 624/624 → +38: 22 server + 16 SSR markup). `npm run build` — production build succeeded. Client-bundle leak scan — zero defect ids / `hint_mask` / `hunt_attempts` / `quality_score` / `best_quality_score` / `customer_id` / `practice_session`; `reveal_locked`/`hint_level_locked` appear only as the required error-code mappings; `/api/v1/practice/progress` present as expected. Migrations unchanged; local D1 `schema_version` **10**; production D1 untouched (9). ESLint clean. Server-focused suites: `tests/server/progress.test.ts` 22/22; `tests/pages/progress-page.test.tsx` 16/16.
- **Browser probe (headless Chrome 155 over CDP against the rebuilt production build on :8789 — ephemeral, not committed):** `/progress` verified across a fresh guest profile: empty state shows the guest-durability banner, "Nothing recorded yet" and the first-recommended-hunt link (`h1` = Progress, scrollWidth == innerWidth). A real hunt start + report through the same browser session (score 100, discovery earned) then shows the populated state: attempts 1 → (probe re-run bumped the fixture to 2), reports submitted 1/2, `Discovered` chip on the exercise row, discovery bar 1/7, recent submission with score 100 and SOLID verdict tag, `last submitted 16 Nov 2026` on the exercise row. Signing in with the demo account (`amara.okafor@example.com`) flips the banner to the signed-in attribution copy and persists across reloads; the guest rows of the same session remain attributed to the session. Matrix **375/768/1024/1440 px × light/dark: zero horizontal overflow, one `h1` per page, zero JS exceptions**; the only console entries were three network-level `401 (Unauthorized)` resource logs from the app's `auth/me` guest-state check (expected and handled — not exceptions). Full-page screenshots inspected in both themes (both render coherently within the Test Bench system; status tags carry text + dot, not colour alone). The probe is not committed (consistent with prior phases); its local D1 rows (a `hunt-pricing-001` attempt and its reports) stayed local-only.
- **Deviation from the plan's sketch (recorded deliberately):** the plan's progress contract sketch listed `recent: [{ attemptId, … }]`. `attemptId` was **dropped** — no internal database id may appear in a learner-facing payload (the attempts-history precedent), and the attempts-history endpoint likewise ships no ids. The plan doc (P4-M3 WP1 item 8) and README record the as-built contract. All other plan fields are as built, plus the `attempts`/`inProgress`/`submitted`/`revealed`/`reports`/`bestScore` totals extension the WP1 task enumeration required ("aggregate attempt counts by meaningful lifecycle status", "submitted report count", "best score and aggregate score information").
- **Limitations:** the browser probe is not committed (no browser runner — consistent with prior phases); the refresh in-flight guard is verified by markup test + probe, not by a committed browser runner; the aggregate scan is unbounded by contract (bounded in practice by learner behaviour and the 7-day cascade); interaction flows that need a live DOM (e.g. refresh re-fetch after returning to the route) were verified by probe, not committed; 375/768/1024 dark-theme passes were exercised via the overflow/h1/console probe rather than per-pixel screenshot review (screenshots were taken and inspected at 1440 px, both themes).
- **Next task: P4-M3 WP2 — Scoring transparency & recommended completion path** (plan P4-M3 WP2). Do not start without explicit maintainer instruction; do not push, merge, PR or deploy.

### 2026-11-16 — Phase 4 P4-M2 WP3 implemented, verified & committed: hint ladder, gated reveal UI, attempt-status chips

- **Scope:** P4-M2 WP3 only — the learner-facing hint/reveal/attempt-status surfaces on the wired hunt panels (`/practice` via `HuntPanel` and the scenario detail via `HuntLaunchPanel`). **No P4-M3 (progress dashboard, aggregate scoring, recommended path) work.** Nothing pushed, merged, PR'd or deployed; no earlier commits amended. Production D1 remains `schema_version` 9; migration 0010 stays applied only to the local D1; `schema_version` stays **10** (no migration required or made). The 21 placeholder scenarios remain unchanged and non-runnable. **With WP3, P4-M2 (WP1 + WP2 + WP3) is complete.**
- **Git safety (all expectations met):** branch `feat/phase-4-learning-intelligence`; HEAD at session start was `886f88c` (`feat: add structured bug report evaluation UI`) as expected; working tree clean at start; no reset, restore, stash, clean, branch switch, push, merge or deploy occurred.
- **`src/components/ui/Modal.tsx` (new):** the project had no shared accessible dialog primitive (two ad-hoc focus-trap copies in MobileNav/ScenarioFilterBar) — a minimal WAI-modal was implemented without adding a dependency: `role="dialog"` + `aria-modal="true"`, `aria-labelledby`/`aria-describedby` wired to rendered elements, focus moved inside on open (default: first focusable; the give-up dialog focuses **Keep investigating**), Tab/Shift-Tab trapped among visible focusables, **Escape closes**, backdrop activation closes, focus restored to the trigger element on close, `prefers-reduced-motion` respected. No `window.confirm`/`alert` anywhere.
- **Hint ladder (`src/features/practice/HintLadder.tsx` + pure `src/lib/hintReveal.ts`):** three clearly ordered levels rendered as accessible disclosures — an action button per unlockable level ("Unlock hint N"), a `aria-expanded` + `aria-controls` toggle with `role="region"` panel per unlocked level, and a **disabled** button with a visible lock note per locked level (no content, ever). Unlocks are sequential; the server is the sole authority (hint text arrives only from `POST …/hints`; `hint_mask` rules are never reimplemented client-side). Previously unlocked hints re-fetch from the server on mount (the unlock endpoint is idempotent), so refresh and session continuation restore the ladder exactly. A live `role="status"` counter announces "N of 3 hints used". One request in flight at a time (shared `createSingleFlight` gate) and controls are disabled while in flight — duplicate unlocks are impossible. Error codes map to learner-safe copy (`hint_level_locked`/`session_required`/`hunt_not_found`/`rate_limited`/5xx/network; server messages preferred when present; **no invented retry durations**; nothing auto-unlocks on failure). Hint content is never copied into client code — a test asserts no server hint/reveal registry string appears anywhere in client source or the production bundle.
- **Give-up confirmation (`RevealPanel.tsx`):** "Show the solution" opens the WAI-modal dialog (title "Show the solution?"); copy explains that revealing ends the investigation for the attempt and **does not count as discovering the defect** (score/best-score/discovery untouched). **Cancel ("Keep investigating") makes zero API requests and changes nothing**; **Confirm ("Show the solution", danger variant, in-flight guarded) POSTs `{ confirm: true }`** to the existing give-up endpoint. Escape/backdrop cancel; focus trapped; restoration to the trigger on close. Failures render learner-safe inline copy (dialog stays open for retry/cancel).
- **Reveal panel:** `GET …/reveal` on mount; `403 reveal_locked` renders a locked callout with **no content**; 200 renders the server-returned reveal verbatim: expected behaviour, actual behaviour, root cause, numbered reproduction steps, verification steps, concepts, common misconceptions — plus a `Callout` distinguishing **"Revealed — give-up"** (reveal is not a discovery; later reports keep score but can't change that the reveal happened) from **"Revealed — report submitted"** (evaluation and discovery credit kept exactly as recorded). Focus moves to the reveal heading only after a user-initiated give-up. **Report submission unlocks the reveal in-place** — `BugReportForm` gained an optional `onSubmitted` callback and both panels pass a nonce to `RevealPanel` (`refreshToken`), so the panel re-fetches and flips to the submitted-report variant without a refresh (before this wiring the panel would have stayed locked and forced a refresh or a wrong give-up). The reveal payload is never persisted in browser storage; a refresh re-authorizes against the server. Report score/best/discovery are never modified by any reveal path.
- **Attempt-status chips (`AttemptStatusChip.tsx` + `src/lib/attemptStatus.ts`):** on every hunt card in `/practice`, sourced from `GET …/attempt` per hunt (`fetchAttempt`) — `none` → neutral "Not started"; `in_progress` → amber "In progress"; `submitted` → green "Submitted · score" (score only when the server has one); `revealed` → neutral "Solution viewed" (required-neutral wording, never "Failed"). Discovery is never inferred or displayed. Loading → chip absent; fetch failure → explicit neutral "Status unavailable" (never a guess). Internal ids never appear; label-only rendering (no colour-only semantics); `.sr-only` full sentence per chip. Chips refetch on hunt start/reset, report submission and reveal. Both hunt panels are keyed by `huntId` — switching hunts never leaks prior hint/reveal/report UI state into the next attempt.
- **`src/lib/attemptStatus.ts` / `src/lib/hintReveal.ts`:** pure, unit-tested presentation/flow logic (ladder state machine, `createSingleFlight`, `restoreLadder`, `unlockHint`, `fetchRevealFlow`, `confirmGiveUpFlow`, learner-safe error mapping) — the components are shells over it, matching the WP2 `reportForm.ts` pattern.
- **API client (`src/features/practice/api.ts`):** added typed `fetchAttempt`, `requestHint`, `fetchReveal`, `giveUpAndReveal` (cookie session; never accepts or sends attempt ids; hunt id only; consistent `PracticeApiError` handling). No server endpoints or security behaviour changed.
- **Placement:** `/practice` (`HuntPanel`) and the scenario launch panel (`HuntLaunchPanel`), in the active-hunt learning block (hints → report → reveal). The pre-existing duplicated "Found something?" paragraph (panel wrapper + form) was deduped.
- **Verification (actual results):** `npm run check` — lint clean; typecheck clean (three projects); tests **624/624 passed** across **29 files** (was 546/546 → +78). `npm run build` — production build succeeded. Client-bundle leak scan — zero hint/reveal registry strings; defect ids absent (lowercase `hunt-*-NNN` matches are the learner-safe public route ids); `reveal_locked` appears only as the required 403 error-code mapping; `hint_mask`/`hunt_attempts`/evaluator internals absent. Migrations unchanged; local D1 reads `schema_version` **10**; production D1 untouched. **Browser probe (system Chrome over CDP — native Node 26 WebSocket + `/usr/bin/google-chrome`) against the rebuilt production build: 68/68 checks pass** — hunt start; hint 1 unlock; server-side skip to level 3 refused with `409 hint_level_locked` (also asserted via raw API call); hints 2 and 3 unlocked in order; refresh persists unlocked hints server-side; give-up dialog opens/cancels (**zero network requests on cancel**, asserted)/confirms; reveal sections render; discovery remains `false` with status `revealed`; reveal persists across refresh; `/practice` card shows "Solution viewed"; a separate hunt submitted a complete report → evaluation renders, reveal unlocks via the report path without any give-up (status stays `submitted`), reveal persists across refresh, card shows "Submitted · score"; **zero horizontal overflow at 375/768/1024/1440 px × light/dark; one h1 per page; zero console errors**. Screenshots inspected (hint ladder both themes, give-up dialog light, both reveal variants, hunt cards both themes).
- **Bug found & fixed during verification:** after a report submission the reveal panel stayed locked until refresh (it only fetched on mount). Fixed by threading a `refreshToken` from the report form into `RevealPanel` (and an `onSubmitted` callback on `BugReportForm`) — the reveal now unlocks in-place through the report path. Verified in the browser probe (B11/B13) and by `npm run check`.
- **Limitations:** interaction behaviour (focus trap, Escape, in-flight guards, restore) is verified at the controller/markup level (Node test environment — no DOM renderer, no new dependencies) plus the browser probe; no browser runner is committed. The give-up confirm path and the refresh-restore path were exercised only through the local production build. Production D1 remains at `schema_version` 9 (0010 unapplied remotely). Screenshots were taken at 1280px/1440px; the 375/768/1024 both-themes passes were exercised via the overflow/h1 probe, not per-pixel screenshot review.
- **Next task: P4-M3 WP1 — Progress API, history and aggregate scoring foundation** (plan P4-M3 WP1). Do not start without explicit instruction; do not push, merge, PR or deploy without approval.

### 2026-11-16 — Phase 4 P4-M2 WP2 implemented, verified & committed: structured bug-report form & evaluation feedback UI

- **Scope:** P4-M2 WP2 only — the learner-facing structured bug-report experience replacing the `BugReportExport` local-only capture. **No WP3 (hint/reveal UI, attempt-status chips), no P4-M3 (progress) work.** Nothing pushed, merged, PR'd or deployed; no earlier commits were amended. Production D1 remains `schema_version` 9; migration 0010 stays applied only to the local D1; `schema_version` stays **10** (no migration required or made). The 21 placeholder scenarios remain unchanged and non-runnable.
- **Git safety (all expectations met):** branch `feat/phase-4-learning-intelligence`; HEAD at session start was `05b5b8e` (`feat: add phase 4 hint and reveal backend`) as expected; working tree clean at start; no reset, restore, stash, clean, branch switch, push, merge or deploy occurred.
- **`src/lib/reportForm.ts` (new, pure, unit-tested):** form values/validation mirroring the server caps (`title`/`environment` ≤200, `preconditions` ≤1000, `steps` ≤4000, `expected`/`actual` ≤2000; severity/priority/reproducibility enum checks; empty-string severity/priority rejected), `toSubmission` (exactly the nine client-allowed keys — a test asserts no `qualityScore`/`feedback`/`discovered`/`evaluation`/`huntId`/`attemptId` can be constructed), `submitReportFlow` (framework-free submission controller with injected transport: duplicate guard → client validation → POST → typed outcome; 400 with `fields` mapped (unknown keys dropped), 401/404/429/5xx/network mapped to learner-safe messages; raw exception text never surfaced; failure outcomes carry no evaluation), `describeSubmitError`, `verdictDisplay` (Solid/Needs work/Incomplete bands — display only, never recomputed), `reportMarkdown`/`escapeMarkdownText`/`reportFilename` (download generation; escapes `&`/`<`/`>`, backslashes, backticks, heading-like lines; excludes ids and check ids), and the shared `REPORT_FIELD_LABELS`/`REPORT_FIELD_IDS`/`REPORT_FIELD_ORDER`.
- **API client (`src/features/practice/api.ts`):** `PracticeApiError` gained optional per-field `fields: Record<string,string> | null`; `errorFrom` propagates server `fields`; new typed `submitReport` (POST, cookie session, no attempt ids accepted or constructed). Error envelopes unchanged.
- **Components (new):** `BugReportForm.tsx` (the form: persistent visible labels, explicit `(required)`/`(optional)` markers, impact-based severity options, independent p1–p4 priority, reproducibility defaulting to `always`; blur inline validation; in-flight ref-guard + disabled submit (duplicate submissions impossible); failure preserves all entered text; result state renders the evaluation instead of the form with "Revise and resubmit" (values intact) and "Download the report (.md)"), `ReportEvaluationView.tsx` (server response verbatim: score /100 in mono, verdict tag reusing the `Tag` vocabulary, 10-check pass/improve checklist with icon+text (never colour-only, `.sr-only` pass/fail cues), **report quality vs. finding the defect** explainer with the live `attempt.discovered` state, "no AI — deterministic rules" copy), `ReportErrorSummary.tsx` (`role="alert"`, `tabIndex={-1}`, focus target on any failed submit; entries name the field ("Report title — This field is required.") and move focus to the control; WCAG 2.4.4-safe link text), `src/styles/components.css` (`.report-*`, `.form-error-summary`, `.field-*`, matching the checkout/login idioms; single-column ≤640 px; both themes).
- **Placement:** the report panel renders on **both** wired hunt panels while a hunt is active — `/practice` (`HuntPanel`) and the scenario launch panel (`HuntLaunchPanel`, scenario detail) — and nowhere else. `BugReportExport.tsx` is removed outright (no compatibility shim).
- **Verification (actual results):** `npm run check` — lint clean; typecheck clean (three projects); tests **546/546 passed** across **26 files** (was 492/492 → +54). `npm run build` — production build succeeded. Client-bundle leak checks — zero matches for the seven defect ids, zero hint/reveal registry strings; `hunt-*-NNN` matches are the learner-safe route ids already shipped in the wiring. **Browser probe (system Chrome over CDP — the repo has no browser-test harness; no dependency added; Node 26 native WebSocket + `/usr/bin/google-chrome`) against the production build on a scratch port: 32/32 checks pass** — hunt start; empty submit → linked error summary + focus lands on the summary; summary link moves focus to the field; junk report → evaluated (score 17/100, incomplete); revise preserves text; complete report → evaluated (score 100/100, solid); checklist and discovery-vs-quality explainer render; download .md (filename `bug-report-<slug>-<date>.md`, contains submitted fields/enums/score/verdict/discovery note; zero defect ids, hunt ids, check ids or internals — verified by reading the file); blocked-network failure → safe message, text preserved; retry → success; **zero horizontal overflow at 375/768/1024/1440 px**; light+dark themes activate; zero console errors. Screenshots inspected (desktop evaluation view, light/dark form, error summary close-up, both themes at 375 px).
- **Limitations:** interaction behaviour (focus management, blur wiring, in-flight guard) is covered at the controller/markup level (Node test environment — no DOM renderer) plus the browser probe; no automated browser runner is committed to the repo. The probe uses a fresh guest session per run. Production D1 remains at `schema_version` 9. The full-page screenshot shows the form far down `/practice` — not a defect; the page is long by design.
- **Next task: P4-M2 WP3 — Hint, Reveal & Attempt-Status UI** (plan P4-M2 WP3). Do not start without explicit instruction; do not push, merge, PR or deploy without approval.

### 2026-11-16 — Phase 4 P4-M2 WP1 implemented, verified & committed: progressive hints & gated solution reveal (backend only)

- **Scope:** P4-M2 WP1 only — three-level progressive hints and the server-controlled, gated solution reveal for the seven runnable bug-hunt hunts. **No UI, no report form, no evaluation view, no `/progress`, no P4-M3 work.** Nothing pushed, merged, PR'd or deployed; no earlier commits were amended. Production D1 remains `schema_version` 9; migration 0010 stays applied only to the local D1; `schema_version` stays **10** — **no migration was required** (0010 already carries `hint_mask` CHECK 0–7, `status='revealed'`, `revealed_at`). The 21 placeholder scenarios remain unchanged and non-runnable.
- **Git safety (all expectations met):** branch `feat/phase-4-learning-intelligence`; HEAD at session start was `c61cc1f` (`feat: evaluate phase 4 bug reports`) as expected; working tree clean at start; no reset, restore, stash, clean, branch switch, push, merge or deploy occurred.
- **New server-only registries (content, compiled code):** `src/server/hints.ts` (`HINTS` — exactly seven hunts × three levels: L1 Orient / L2 Focus / L3 Narrow; investigation guidance only; no defect ids, internal defect titles, SQL, file or function identifiers; L3 is one step from the answer but never discloses it) and `src/server/reveals.ts` (`REVEALS` — exactly seven hunts; `expected`/`actual`/`rootCause`/`reproduction[]`/`verification[]`/`concepts[]`/`commonMisconceptions[]` as learner-safe behaviour-level prose; `title` in payloads is the learner-safe hunt title). Routing in `src/server/learning.ts`, mounted under `/v1`. **Neither registry is imported by any client module — verified after `npm run build`: `dist/` assets and `index.html` contain zero hint/reveal strings and none of the seven defect ids.**
- **Endpoints (as built):**
  - `POST /api/v1/practice/hunts/:huntId/hints` — strict `{ level: 1|2|3 }` (`400 invalid_level` otherwise); `401 session_required` without a live practice session; `404 hunt_not_found` / `400 invalid_request` for unknown/malformed hunt ids. Level N requires level N−1 already used on the attempt (`409 hint_level_locked`) — the ladder cannot be skipped via request parameters; levels are served cumulatively and re-requesting an unlocked level is idempotent (200 with the same text, no double count). Usage is a bitmask on the attempt row (bit 1/2/4 = levels 1/2/3), updated with one guarded atomic `hint_mask | bit` statement — progress persists across refreshes and session continuation, is scoped per (session, hunt), and is never readable across sessions (customer binding does not widen it). A hint request never reveals any reveal content and viewing all three hints never unlocks the solution; a session that never started the hunt mints its attempt implicitly on first hint request (consistent with the report path). Response: `{ level, hint, hintsUsed }` (0–3).
  - `GET /api/v1/practice/hunts/:huntId/reveal` — `200` with the reveal payload **only** when the caller's attempt for this hunt is `submitted` (a persisted report exists) or `revealed`; otherwise `403 reveal_locked` — including cookie-less callers and attempts that do not exist (this read mints nothing). Discovery is not consulted. Response: `{ huntId, title, expected, actual, rootCause, reproduction[], verification[], concepts[], commonMisconceptions[], attempt }` where `attempt` is the learner-safe `AttemptView` (additive nesting vs the plan sketch — approved by the WP1 brief's "return learner-safe attempt status" rule; recorded as a deviation in the plan note).
  - `POST /api/v1/practice/hunts/:huntId/reveal` — the explicit, confirmed give-up. Requires `{ confirm: true }` (anything else → `400 invalid_request`) and a live session (`401 session_required`). One atomic statement marks an `in_progress` attempt `revealed` and stamps `revealed_at` via `COALESCE` (first unlock time preserved); a `submitted` attempt stays `submitted` (never downgraded); a `revealed` attempt stays `revealed`. Prior report submissions, `best_quality_score` and sticky `discovered` are preserved untouched. **Give-up never awards discovery** and never marks `submitted`. Response equals the GET envelope; idempotent under retries.
- **Report submission integration:** unchanged by WP1 — the report path already transitions `in_progress → submitted` inside the same all-or-nothing D1 batch as the insert, and reveal eligibility reads that status, so a successfully persisted report makes the solution eligible on that same attempt. A failed report (400 validation, 429 rate limit, or batch rollback) never unlocks the reveal. Report submission and reveal retrieval stay separate endpoints; the report response carries no reveal content. Rate limiting unchanged (global 120/min per-IP backstop covers hints/reveals; `report:<iphash>` 30/min untouched). Error envelopes stay `{ error, message }`; `Cache-Control: no-store` applies globally.
- **Discovery independence:** nothing in WP1 sets `discovered`. Give-up never awards it; viewing hints never awards it; a high score alone cannot exist without a submission (there is no pre-submit score) and even a 100 score reveals only through the submitted status; the evaluator's finding check (WP3) remains the sole source of `discovered`, sticky in SQL. Verified by tests, including the give-up → full-quality report sequence (attempt stays `revealed`, `discovered` flips to 1 from the evaluation).
- **Verification (actual results):** `npx vitest run tests/server/hints-reveal.test.ts` — 33/33 passed. `npm run check` — lint clean; typecheck clean (`tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.functions.json`); full suite **492/492 passed** across 24 files. `npm run build` — production build succeeded (`dist/`, ~489 KB JS gzip ~142 KB). Client-bundle leak check on `dist/` — zero matches for hint/reveal content strings and defect ids. No migration; existing migrations untouched (verified in the diff). ESLint covers the new files cleanly.
- **Files changed:** `src/shared/learning.ts` (added `HintLevel`/`HintResponse`/`HuntReveal`/`RevealResponse` learner-safe contract types — no content), `src/server/hints.ts` (new), `src/server/reveals.ts` (new), `src/server/learning.ts` (new routes), `src/server/attempts.ts` (additive `resolveAttemptForView` read helper — read paths never mint attempts), `src/server/app.ts` (mount `learningRoutes`), `tests/server/hints-reveal.test.ts` (new, 33 tests), `docs/phase-4-learning-intelligence-plan.md` (dated WP1 note in P4-M2), `README.md` (one factual status line), `PROJECT_STATE.md` (this entry; §1 snapshot; §9; §13; §14).
- **Not verified / outstanding:** no browser verification (no UI ships in WP1 — hint/reveal surfaces land in P4-M2 WP3); the both-themes × 375/768/1024/1440 pass is a WP2/WP3 concern; production D1 remains at `schema_version` 9 (0010 unapplied remotely); failed-batch fault injection does not exist in this codebase (the 400/401/rate-limit paths are covered instead).
- **Exact next task:** **P4-M2 WP2 — Bug-Report Form & Evaluation Feedback UI** (plan §6.2 / P4-M2 WP2): the structured report panel replacing `BugReportExport` internals, inline validation + error summary, the deterministic evaluation result view, both-themes × 4 widths verification and browser probe — in a fresh session, only on explicit maintainer instruction. Do not start it without instruction; do not push, merge or deploy without approval.

### 2026-11-16 — Phase 4 P4-M1 WP3 reviewed, reconciled & committed: deterministic bug-report evaluator

- **Scope:** P4-M1 WP3 only — the deterministic bug-report evaluator (plan §6.4 rubric), wired into the POST report path. **No P4-M2 functionality** (no hints, reveal, report UI, scoring UI, `/progress`) was implemented; nothing pushed, merged, PR'd or deployed; WP1 and WP2 commits untouched (no amend). Production D1 remains `schema_version` 9; migration 0010 stays applied only to the local D1; `schema_version` remains **10** — **no migration was required** (0010 already carries `quality_score`, `feedback`, `best_quality_score`, `discovered`).
- **Git safety (all expectations met):** branch `feat/phase-4-learning-intelligence`; HEAD `968d144` (`feat: add phase 4 attempt and report persistence`); working tree clean at session start; no reset, restore, stash, clean, branch switch, push, merge or deploy occurred.
- **Evaluator (`src/server/reportQuality.ts`, pure, server-only):** plan §6.4 exactly — ten checks (`title-present` 10 · `environment-present` 10 · `steps-present` 15 · `steps-quality` 10 · `expected-present` 8 · `actual-present` 8 · `expected-actual-distinct` 7 · `severity-valid` 5 · `priority-valid` 5 · `finding` 22), integer score 0–100, verdict bands ≥80 `solid` · 50–79 `needs-work` · <50 `incomplete`. No AI, network, clock, randomness or hint penalties; no client-supplied score/feedback/discovery is consulted (unknown body keys, including spoofed `qualityScore`/`feedback`/`discovered`/`evaluation`, are ignored by validation — asserted by test). Feedback messages describe the *report* only; none names the fault location, an answer shape, or a finding-check term (lint-asserted over every message). Explicit input/output types; labelled checks `{id, label, passed, message}`; curated finding-check term groups live in the module (`FINDING_GROUPS`, exported for the server and its test suite only) with one shared normalization pipeline (case-fold, NFKD diacritics strip, punctuation → token boundaries, whitespace collapse) and token-boundary, synonym-tolerant matching — `researcher` never matches `search`. Finding evidence is title + steps + expected + actual only; environment/preconditions mention-matching awards nothing (tested). Inspection found **no internal inconsistency in §6.4**; under-specified points are documented deterministic choices (placeholder set + repeated-single-character + all-identical-tokens rules; Jaccard distance ≥ 0.6 for token disjointness — the "≥ 60% token disjoint" reading; newline/inline numbered-marker step counting; any digit/quoted string/URL-like path as the concrete token; enum re-validation case-insensitively; Jaccard/distinct applied to trimmed input). Discovery is possible only via the finding check — a near-perfect report with no finding-group vocabulary scores 78 and does NOT award `discovered` (tested).
- **Persistence & atomicity:** the evaluator runs synchronously after validation, before the D1 batch. Report insert binds the computed score and `JSON.stringify([{id, passed, message}])` (10 checks — far under the 16 KB cap). The attempt stamp computes `best_quality_score` as a **running maximum** and `discovered` as **sticky** (`CASE WHEN discovered = 1 OR :new = 1 THEN 1 ELSE 0`) in SQL inside the same all-or-nothing batch — neither can race a concurrent submission, and retry leaves both consistent. `revealed` attempts stay `revealed`; only the first `submitted_at` is kept; `customer_id` semantics unchanged (submit-time, signed-in active accounts only). A failed batch leaves neither report nor attempt update — asserted both for a clean attempt and for an already-scored one (prior row byte-identical after rollback).
- **Best score & sticky discovery:** best is the max across the attempt's submissions (strong→weak keeps 100; weak→strong raises 10→100; revealed attempts keep their scores). `discovered` once earned never reverts (strong→weak→weak stays discovered).
- **Response safety:** `201 { attempt, report, evaluation }` (contract: `evaluation` is now a required member of `ReportSubmissionResponse` — additive). No defect ids, attempt/report/database ids, finding-check terms, group definitions, evaluator internals, hint/reveal content, or solution material in the payload (asserted, including the no-leakage lint). Client bundle grep: zero defect ids (exact case), zero evaluator internals (`evaluateReport`, `FINDING_GROUPS`, …), and no finding-group fingerprint terms; the four content-word coincidences (`accumulation`, `insufficient`, `not yours`, `another account`) are verified learner-facing copy from the Phase 3 scenario catalogue/WP1 curriculum, not the evaluator.
- **WP2 placeholders (removed):** `quality_score=0`/`feedback='[]'`/absent evaluation are gone; the submission path now always evaluates synchronously. `attempts.test.ts` updated accordingly (201 payload keys now `['attempt','evaluation','report']`; persisted `quality_score=100` with all ten checks passing for the canonical full-quality report; `feedback` JSON parses to ten passed checks).
- **Verification (executed, not assumed):** `tests/server/report-quality.test.ts` — **53 tests, all green** (every check independently, boundaries 9/10 title, 120/121, 40-char exactly, 2-step paths, numbered markers, quote/path/digit concrete tokens, placeholder matrix, verdict-band edges 80/79/50/45, 100/100 per hunt, per-hunt isolation with exclusive-term fixtures, synonym/normalization/case/punctuation variants, environment-only masking, junk-salad acceptance scoped to curated-term gaming, determinism across fixtures, leakage lint). `tests/server/attempts.test.ts` — **48 tests, all green** (incl. the new WP3 block: persistence of computed score/feedback, client-spoofed evaluator fields ignored, best-score retention both directions, sticky discovery, discovery below 50, high score without discovery (78, not discovered), failed validation persists nothing, failed batch atomic rollback — clean and already-scored, revealed stays revealed, cross-session isolation, payload leak assertions). **Total: 459 tests green** (393 → +66). `npm run check` clean (lint → typecheck → test); `npm run build` passes; production bundle re-greped as above; local D1 verified on `schema_version` 10 (`node:sqlite` read of the `.wrangler` state); migrations unchanged (`git status` shows none); no production contact.
- **Documentation:** `PROJECT_STATE.md` and `README.md` updated truthfully (WP3 status; placeholders gone; no evaluation UI until P4-M2). Plan reconciled with a dated "WP3 implemented" note (§P4-M1, after the WP2 note) — migration-free wiring, running-max/sticky-in-SQL design, finding-check rules, the documented deterministic choices for under-specified §6.4 points (Jaccard ≥ 0.6 reading; step counting; concrete-token rule; placeholder rules), and the removal of the WP2 placeholders. Three-milestone structure unchanged; WP1/WP2 historical records preserved; README repo-shape and status sections updated.
- **Commit:** WP3 reviewed and committed in this turn as **`feat: evaluate phase 4 bug reports`** (exact hash via `git log -1`; this file is part of that commit). No amendment of WP1 (`5210ebb`) or WP2 (`968d144`) occurred. No push, merge, PR or deployment occurred.
- **Not verified / outstanding:** no browser verification (no UI ships in WP3 — evaluation results and attempt state are API-only, rendered in P4-M2); the 375/768/1024/1440 both-themes pass is a P4-M2 concern; production D1 remains at `schema_version` 9 (0010 unapplied remotely); dark-theme spot check still outstanding (pre-existing).
- **Exact next action:** **P4-M2 — Complete Bug-Hunt Learning Experience** (hint ladder & gated reveal backend, the learner-facing bug-report form with evaluation feedback, hint/reveal/attempt-status UI; plan §6.2 / P4-M2) — in a fresh session, only on explicit maintainer instruction. Do not start P4-M2 without instruction; do not push, merge or deploy without approval.

### 2026-11-16 — Phase 4 P4-M1 WP2 review, reconciliation & branch commit

- **Scope:** review / documentation reconciliation / verification / Git task only. **No WP3 (deterministic evaluator), hints, reveal, scoring UI or any P4-M2 functionality was implemented.** Nothing pushed, merged, PR'd or deployed; WP1 and the prior planning commits remain untouched (no amend). Production D1 remains `schema_version` 9; migration 0010 is applied only to the local D1.
- **Git safety (all expectations met):** branch `feat/phase-4-learning-intelligence`; HEAD `5210ebb` (`feat: complete phase 4 curriculum foundation`, the approved WP1 baseline); working tree carried exactly the expected WP2 implementation + documentation changes (migration 0010, `attempts.ts`, `reports.ts`, `src/shared/learning.ts`, `app.ts`, `practice.ts`, `hunts.ts`, `rateLimit.ts`, four schema-assertion test files, new `tests/server/attempts.test.ts`, `PROJECT_STATE.md`, `README.md`). No reset, restore, clean, stash or branch switch occurred.
- **Migration 0010 review (passed):** additive-only — two new tables (`hunt_attempts`, `bug_reports`), four indexes, previous migrations untouched; `schema_version` 9 → 10; length CHECKs everywhere the application caps apply; enum CHECKs for status/severity/priority/reproducibility (severity and priority are independent axes, never derived); `hint_mask` 0–7; `discovered` 0/1; `best_quality_score` 0–100 (nullable). FK behaviour verified: `hunt_attempts → practice_sessions` **ON DELETE CASCADE**, `customer_id → customers` **ON DELETE SET NULL** (attempt snapshot preserved on customer delete), `bug_reports → hunt_attempts` **ON DELETE CASCADE**. The plan's sketch carried no uniqueness rule; as built, the **partial unique index `idx_hunt_attempts_one_live`** (`hunt_attempts(practice_session_id, hunt_id) WHERE status = 'in_progress'`) enforces one live attempt per (session, hunt) at the database layer — the deliberate, documented deviation, retained. Both fresh-install and 0001–0009 → 0010 upgrade paths verified (planted session/cart/order survive intact; `schema_version` = 10).
- **Attempt lifecycle & idempotency review (passed):** all three hunt-start paths (idempotent re-start, switch, fresh-mint) call `ensureLiveAttempt`; creation is race-safe (`INSERT … ON CONFLICT … DO NOTHING` against the partial unique index + re-read) — retries/concurrency cannot mint duplicate live attempts; starting another hunt preserves prior attempts per hunt; `submitted`/`revealed` attempts are never reused (next start mints fresh); report submission attaches to the live attempt, else the latest (resubmission), else creates one implicitly. Status transitions: `in_progress → submitted`; **`revealed` stays `revealed`**; `submitted` stays `submitted`; only the first `submitted_at` is kept; `customer_id` stamped at submit time (active signed-in customer only — never at hunt start, never retroactively for guests); `best_quality_score` stays NULL and `discovered` stays 0 in WP2. Session ownership is resolved exclusively from the `mpl_session` cookie; client-supplied attempt ids are never accepted. Reset remains non-destructive (re-stamp; attempts survive); maintenance sweep unchanged — attempts/reports cascade with the practice session's 7-day TTL (verified by test; audit tables untouched).
- **Report API & validation review (passed):** fields match the approved Phase 4 report structure; layered validation (types → control chars → length caps → enums) with per-field `400` messages in the checkout style; single-line fields trim + collapse `\s+`; multi-line fields normalize CRLF→LF and permit `\n`/`\t`; all other C0/C1/DEL rejected; enums case-insensitive, stored lowercase; unknown keys ignored; severity/priority independent. Report insert and attempt stamp commit as **one all-or-nothing D1 batch** (mirrors D1 semantics in the test harness; a failed batch rolls both back). The response never exposes internal ids, defect ids, hint/reveal content or evaluator internals; response envelopes and error conventions preserved (`{ error, message }`; `400` / `401 session_required` / `404 hunt_not_found` / `429 rate_limited`).
- **WP2 placeholders (verified, documented as temporary, replaced by WP3):** `quality_score` stored as `0`; `feedback` stored as `'[]'`; response echoes `qualityScore: 0` / `feedback: []`; `best_quality_score` remains NULL; `discovered` never awarded; response carries no `evaluation` key. The plan + README + this entry record that WP3 replaces all of these inside the same request path / D1 batch.
- **Rate limiting review (passed):** `report:<iphash>` scope added to the existing fixed-window limiter (`REPORT_LIMIT = 30`), mirroring checkout's 30/min; consumed **before** body parsing; only SHA-256 hashes stored (raw-IP buckets never match — asserted by test); `429 rate_limited` + `Retry-After` on overflow; skipped when no IP is visible (local-dev convention); unrelated scopes untouched. Limitation recorded: the synchronous SQLite test harness cannot test true concurrency; the 29/30/31 boundary and scope isolation are covered serially, and the atomic upsert (`INSERT … ON CONFLICT … RETURNING`) remains the real concurrency guard. No second limiter introduced.
- **Ownership & retention guarantees (verified):** cross-session attempt/report access prevented (all queries scoped to the caller's live session + server-resolved customer binding); customer-bound history follows the submit-time attribution rule (re-signed-in learners see their bound attempts; another customer sees none); signed-out/guest paths stay session-scoped; expired-session cleanup cascades to attempts and reports; no endpoint accepts a defect id; hunt ids are path-validated against the registry.
- **Phase 4 plan reconciled:** `docs/phase-4-learning-intelligence-plan.md` now records the as-built WP2 details — migration location (`db/migrations/`), `idx_hunt_attempts_one_live`, report API behaviour and validation rules, lifecycle/idempotency/attribution/cascade/atomic-batch behaviour, the `report:<iphash>` 30/min scope, the temporary placeholders, and every deviation/limitation (401 `session_required` for cookie-less submissions; no `409` anywhere (the contract defines no conflict condition); revealed-stays-revealed; serial-only rate-limit boundary testing; local-dev missing-IP convention). Three-milestone structure unchanged; no planned functionality removed.
- **Verification (executed, not assumed):** focused suites `tests/server/attempts.test.ts` (35 tests green — migration fresh + upgrade, FKs/CHECKs/one-live index, cascade, lifecycle, idempotency, report validation matrix, ownership/isolation, history bound, 429 boundary 29/30/31, raw-IP non-match, scope isolation) and `tests/server/{catalogue,cart,checkout,hardening}.test.ts` (103 tests green — schema-version assertions updated to 10). `npm run check` clean; `npm run build` passes. Local D1 verified on `schema_version` 10. Full results recorded in §14.
- **Documentation:** `PROJECT_STATE.md` and README updated truthfully (WP2 implemented/committed; production unchanged). Plan reconciled as above.
- **Commit:** WP2 reviewed, reconciled and committed in this turn as `feat: add phase 4 attempt and report persistence` (the hash is recoverable with `git log -1`; this file is part of that commit). No amendment of WP1 (`5210ebb`) occurred. No push, merge, PR or deployment occurred.
- **Exact next action:** **P4-M1 WP3 — the deterministic bug-report evaluator** (`src/server/reportQuality.ts`, pure function; wired into the POST report path replacing the `quality_score=0`/empty-feedback placeholder in the same request path; stamps `quality_score`, `feedback`, `hunt_attempts.best_quality_score` and sticky `discovered` inside the same D1 batch as the insert; rubric exactly §6.4; unit suite `tests/server/report-quality.test.ts`) — in a fresh session, only after explicit maintainer instruction.

### 2026-11-16 — Phase 4 P4-M1 WP2 implemented: attempts & structured report persistence (branch only, uncommitted)

> **Addendum (same day, review turn):** WP2 was reviewed, reconciled and **committed** as `feat: add phase 4 attempt and report persistence` — see the entry above this one. The historical record below is preserved unchanged.

- **Scope:** P4-M1 WP2 only — durable, session-scoped hunt attempts and structured bug-report persistence. **No evaluator, no scoring, no finding checks, no hints/reveals, no UI, no `/progress`, no P4-M2/P4-M3 work.** Nothing committed, pushed, merged or deployed; WP1 remains the committed branch baseline (`5210ebb`), untouched.
- **Git safety:** `git status --short` clean, branch `feat/phase-4-learning-intelligence`, HEAD `5210ebb` (`feat: complete phase 4 curriculum foundation`) — exactly as expected; nothing reset/stashed/discarded; branch not switched; **no commit, push, merge, PR or deployment occurred** (per instruction; WP2 changes are left in the working tree for maintainer review).
- **Path deviation (recorded):** the task instruction called the file `migrations/0010_hunt_attempts.sql`; this repository's convention (AGENTS.md, README, `tests/helpers/fake-d1.ts`) is `db/migrations/`, so the migration landed as **`db/migrations/0010_hunt_attempts.sql`**. Content and numbering are unchanged.
- **Migration `0010_hunt_attempts.sql` (additive; `schema_version` 9 → 10):** two new tables, identical shapes to the approved plan, plus defense-in-depth length CHECKs and a partial unique index.
  - `hunt_attempts(id PK, hunt_id TEXT NOT NULL CHECK(length 1–64; NOT a FK — compiled registry, mirrors `practice_sessions.hunt_id`), practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE, customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL, status TEXT NOT NULL DEFAULT 'in_progress' CHECK in ('in_progress','submitted','revealed'), hint_mask INTEGER NOT NULL DEFAULT 0 CHECK 0–7, best_quality_score INTEGER NULL CHECK 0–100, discovered INTEGER NOT NULL DEFAULT 0 CHECK 0/1, created_at/updated_at TEXT DEFAULT strftime('%Y-%m-%dT%H:%M:%fZ','now'), submitted_at TEXT, revealed_at TEXT)`.
  - `idx_hunt_attempts_session_hunt(practice_session_id, hunt_id, id)`; **`idx_hunt_attempts_one_live` UNIQUE on (practice_session_id, hunt_id) WHERE status='in_progress'** — enforces the one-live-attempt invariant at the database; `idx_hunt_attempts_customer(customer_id) WHERE customer_id IS NOT NULL` for the signed-in history read.
  - `bug_reports(id PK, attempt_id INTEGER NOT NULL REFERENCES hunt_attempts(id) ON DELETE CASCADE, title/environment/steps/expected/actual TEXT NOT NULL with length CHECKs (200/200/4000/2000/2000), preconditions TEXT NULL ≤1000, severity CHECK in ('critical','high','medium','low'), priority CHECK in ('p1','p2','p3','p4'), reproducibility TEXT NOT NULL DEFAULT 'always' CHECK in ('always','sometimes','once'), quality_score INTEGER NOT NULL CHECK 0–100, feedback TEXT NOT NULL CHECK length ≤16384 (JSON), created_at default as above)`; `idx_bug_reports_attempt(attempt_id, id)`.
  - Storage timestamps use the same `strftime('%Y-%m-%dT%H:%M:%fZ','now')` convention as every existing migration. Previous migrations untouched; upgrade path 0001–0009 → 0010 verified with planted session/cart/order (all pre-existing rows intact, `schema_version` = 10) and fresh-install path verified.
- **Attempt lifecycle & idempotency (`src/server/attempts.ts`):** hunt start (`practice.ts`, all three entry paths — idempotent re-start, switch, fresh-mint) now calls `ensureLiveAttempt`, which returns the caller's live in_progress attempt for (session, hunt) or creates one. Creation is race-safe: `INSERT … ON CONFLICT(practice_session_id, hunt_id) WHERE status='in_progress' DO NOTHING` against the partial unique index, then a re-read — two concurrent starts can never mint two live attempts, and legitimate retries are no-ops. Starting a different hunt opens/reuses that hunt's attempt; starting a hunt whose attempt is already `submitted`/`revealed` mints a fresh `in_progress` attempt (completed attempts are preserved as history). Report submission attaches to the live in_progress attempt, else to the latest attempt (resubmission), else creates one — report insert and the attempt's submission stamp commit as **one all-or-nothing D1 batch**. Status transitions: `in_progress → submitted` on report; **`revealed` never flips to `submitted`** (give-up is never a completion); `submitted` stays `submitted`. `submitted_at` keeps only the first submission time. `customer_id` is stamped at **submit time** when signed in (mirrors `orders.customer_id`, never adopted retroactively for guests); `discovered` untouched until WP3; `best_quality_score` stays NULL in WP2 (no evaluator exists yet). Attempts cascade with the practice session (orders precedent — reset stays non-destructive and preserves attempts; maintenance sweep/7-day TTL deletes them).
- **API surface (additive; learner-safe; no internal ids, no defect data):**
  - `POST /api/v1/practice/hunts/:huntId/report` — validates hunt id against the registry (400 malformed / 404 unknown), consumes `report:<iphash>` (see rate limiting), requires a live practice session (`401 session_required` otherwise), validates the body (type checks → control-character rules → length caps → enum checks; per-field 400 messages in the checkout style), attaches the caller's signed-in active customer when present, persists the report with the WP2 placeholder (`quality_score=0`, `feedback='[]'` — **WP3 replaces this with the real evaluation in the same request path**), stamps the attempt, answers `201 { attempt, report }`.
  - `GET /api/v1/practice/hunts/:huntId/attempt` — current attempt for (session, hunt): `{ status, hintsUsed, bestQualityScore, discovered, submittedAt }`; returns the `status:'none'` shape when none (404-free) and `404 hunt_not_found` / `400` for forged/malformed ids.
  - `GET /api/v1/practice/attempts` — bounded history (≤50, newest first) across hunts for this session, plus customer-bound attempts when signed in; guest history is session-scoped only.
  - All three are resolved from the `mpl_session` cookie; attempt ids are never accepted from the client; no cross-session or cross-customer read path exists; staff gains nothing. `Cache-Control: no-store` (global). Hunt summary responses, commerce APIs and envelopes are unchanged apart from WP1's additive `curriculum`. Contracts live in `src/shared/learning.ts` (attempt/report/evaluation types, learner-safe by construction).
- **Validation rules (server-side, `validateReportBody`):** title 1–200 single-line; environment 1–200 single-line; preconditions optional ≤1000 multi-line; steps 1–4000 multi-line; expected/actual 1–2000 multi-line; all trimmed (multi-line: CRLF/CR→LF, interior structure kept); single-line fields collapse `\s+`→single space; control-character rejection: C0/C1/DEL rejected everywhere, `\n`/`\t` additionally permitted only in the multi-line fields; severity `critical|high|medium|low`, priority `p1|p2|p3|p4`, reproducibility `always|sometimes|once` (default `always`) — enums matched case-insensitively and stored lowercase (meaning unchanged); unknown body keys ignored; DB CHECKs mirror all caps/enums.
- **Rate limiting:** `report:<iphash>` — **30 submissions/IP/minute**, scope added to the existing fixed-window limiter (`src/server/rateLimit.ts`, `REPORT_LIMIT = 30`), mirroring the checkout budget. Consumed **before** body parsing so malformed-traffic churn is bounded too; `429 rate_limited` + `Retry-After` on overflow; only a SHA-256 hash of the IP is stored (raw-IP buckets never match, asserted by test); skipped entirely when no IP is visible (local dev); unrelated scopes (`checkout`) do not consume it. No second limiter system introduced.
- **Maintenance:** `src/server/maintenance.ts` intentionally unchanged — attempts/reports cascade with their practice session via FK; the sweep deletes expired sessions as before (cascade verified by test). Audit tables (`inventory_adjustments`, `order_cancellations`) untouched.
- **Verification (executed, not assumed):** focused suite `tests/server/attempts.test.ts` — **35 tests, all green** (fresh migration to 10; 0001–0009→0010 upgrade with planted session/cart/order, data intact; FKs, enum/length CHECKs, one-live-attempt partial unique index, session cascade, customer SET NULL; attempt creation on start + repeat starts + switching; submit→submitted→fresh attempt; reveal stickiness; report validation matrix incl. control chars and length caps; 201 payload key-exactness; defect-id absence; guest vs signed-in stamping; cross-session/customer isolation incl. customer-bound history after re-sign-in; history bound 50; 429 boundary 29/30/31; raw-IP non-match; scope isolation; cascade through the maintenance sweep). Existing schema-version assertions updated to 10 (catalogue/cart/checkout/hardening). **Total: 393 tests green** (358 → +35), `npm run check` clean, `npm run build` passes. Local D1 verified on schema 10 (`npm run db:migrate:local` — the existing local workflow; `.wrangler` is git-ignored). **Never run against production D1; nothing deployed.**
- **Not verified / outstanding:** no browser verification (no UI ships in WP2 — evaluation results and attempt state are API-only, rendered in P4-M2); production D1 remains at `schema_version` 9 (0010 is unapplied remotely); WP3 not started.
- **Deviations from the approved plan (all recorded):** (1) migration file lives at `db/migrations/0010_hunt_attempts.sql` per repo convention, not the task's literal `migrations/` path; (2) plan's intended uniqueness rule implemented as an explicit partial unique index `idx_hunt_attempts_one_live` (the plan's sketch had no uniqueness constraint; WP2 was told to follow the "plan's uniqueness and lifecycle rules" — this makes the one-live-attempt rule enforceable at the DB layer instead of app-only); (3) `customer_id` stamped at submit time per plan §E (not at hunt start); (4) report submission without any prior hunt start implicitly opens an attempt (plan implies submit-time attempt creation; explicit guest-robustness choice); (5) `revealed` attempts stay `revealed` on later report submission (conservative reading of "give-up is never submitted"); (6) new endpoint error `401 session_required` for cookie-less report posts (plan doesn't specify; honest ownership response); (7) there is **no `409` conflict response** — the approved report contract defines no conflict condition (resubmission is allowed by design and bounded by the 30/min limit); (8) reports associate with their practice session transitively via `bug_reports.attempt_id` → `hunt_attempts.practice_session_id` (the approved schema carries no direct session column on `bug_reports`), which is how ownership/cascade is enforced. No scope added beyond WP2; no plan requirements removed.
- **Files changed:** `db/migrations/0010_hunt_attempts.sql` (new), `src/shared/learning.ts` (new), `src/server/attempts.ts` (new), `src/server/reports.ts` (new), `src/server/rateLimit.ts` (REPORT_LIMIT), `src/server/hunts.ts` (export HUNT_ID_PATTERN), `src/server/practice.ts` (hunt start ensures attempt; header), `src/server/app.ts` (routes), `src/server/attempts.ts` + `reports.ts` wired under `/v1`; `tests/server/attempts.test.ts` (new), `tests/server/{catalogue,cart,checkout,hardening}.test.ts` (schema 9→10 assertions), `README.md`, `PROJECT_STATE.md`.
- **Exact next action:** **P4-M1 WP3 — deterministic bug-report evaluation engine** (`src/server/reportQuality.ts`, pure function; wired into the POST report path replacing the `quality_score=0`/empty-feedback placeholder in the same request path; stamps `quality_score`, `feedback`, `hunt_attempts.best_quality_score`, sticky `discovered` and the `in_progress→submitted` transition inside the same D1 batch as the insert; rubric exactly §6.4; unit suite `tests/server/report-quality.test.ts`) — in a fresh session, only after explicit maintainer instruction. WP2 is complete; P4-M2 must not start before P4-M1 (WP1–WP3) is verified and committed.

### 2026-11-16 — Phase 4 P4-M1 WP1 baseline review, plan reconciliation & branch commit

- **Scope:** review/reconciliation/Git task only — no WP2 functionality (no migration 0010, attempts, reports, evaluator) was implemented; nothing pushed, merged or deployed. Dark-theme browser spot check remains outstanding (see below).
- **Plan reconciliation (`docs/phase-4-learning-intelligence-plan.md`):** the WP1 "zero DB/API change" wording was superseded — WP1 shipped an **additive, optional `HuntSummary.curriculum`** on the existing hunt summary responses (hunts list, hunt start, practice session), sourced from `src/shared/huntCurriculum.ts`; existing envelopes, behaviour, caps and the activation model are compatible; **no database migration was required**; no defect identifiers, defect solutions, finding-check terms, hint data or evaluator internals are exposed (asserted by tests). The plan was updated in: consolidation map (P4-M1 WP1 row), the new "WP1 implemented (deviation … recorded)" note in §P4-M1, object gains, scope step 3, user-visible functionality step 4, backend step 5, frontend step 6, API contracts step 8, testing step 10, acceptance step 13, dependency-order notes (step 11, §6.5), §7.1 endpoint summary (curriculum note) and §10 testing strategy; test-count references updated (344 P3-M9 baseline → 358 after WP1). The three-milestone structure, all original requirements and the roadmap/posture are unchanged; nothing was descoped.
- **WP1 review findings:** all seven runnable hunts carry complete curriculum metadata (`skillArea`, `difficulty`, `conceptsPracticed`, `expectedOutcomes`, `investigationFocus`, `reportFocus`); difficulty mirrors the wired scenarios (and is asserted); the 21 placeholder scenarios are untouched; curriculum copy verified learner-safe against `src/server/defects.ts`; server and client share the single `src/shared/huntCurriculum.ts` source; API compatibility preserved (additive-optional field; exact-key test updated consciously); scenario-detail sections and the static "Recommended path" match the approved scope; no WP2/WP3/later-phase functionality present (`hunt_attempts` only appears in a test's negative assertion). No genuine WP1 defect found; no unrelated refactoring performed.
- **Verification (executed now, not assumed):** `npm run check` clean (lint → typecheck → test; **358 tests passed**); `npm run build` passes; client bundle grep: **zero** defect ids in `dist/`; local preview + `--dump-dom` confirmed curriculum sections and absence of defect ids on `/scenarios/manual-cart-totals`, all seven recommended-path entries on `/practice`; screenshots: light theme at 375 / 768 / 1024 / 1440 px — clean, no clipped content. **Outstanding: dark theme spot check** (headless Chrome could not toggle `prefers-color-scheme`/`qa-practice-lab-theme`; no new colours or tokens were introduced — additions reuse existing token-based components). 768 px and 1024 px verified for the scenario detail page this pass.
- **Commit:** WP1 implementation + tests + `tsconfig.app.json`/`tsconfig.functions.json` adjustments + planning docs (`README.md`, `docs/phase-4-learning-intelligence-plan.md`) + `PROJECT_STATE.md` were staged by explicit path and committed as **`feat: complete phase 4 curriculum foundation`** (the commit landing on `feat/phase-4-learning-intelligence` directly after this PROJECT_STATE.md edit — resolve the exact hash with `git log -1 --oneline`; it is the successor of `30d34241ba39424a4356c58eec8f566aa0ddb3d5`). Nothing else was staged; nothing was amended.
- **Remaining verification limitations:** dark theme (see above); no push/merge/deploy has occurred — branch remains local-only.
- **Exact next action:** **P4-M1 WP2** — migration `0010_hunt_attempts.sql` (`schema_version` → 10), `src/server/attempts.ts` + `src/server/reports.ts`, idempotent attempt creation on hunt start, `report:<iphash>` 30/min scoped limit — in a fresh OpenCode session, only after explicit maintainer approval. Do not start WP2 before this baseline commit is reviewed; do not start P4-M2 before P4-M1 is verified and committed.

### 2026-11-16 — Phase 4 P4-M1 WP1 implemented: scenario curriculum enrichment (branch only, uncommitted)

- **Scope:** P4-M1 WP1 only (scenario curriculum enrichment & hunt learning metadata). No attempts persistence, no migration 0010, no bug-report submission/evaluation, no finding-check detection, no hints/reveal, no scoring, no `/progress`, no auth changes. Nothing committed, pushed, merged or deployed; the pre-existing uncommitted planning docs (PROJECT_STATE.md, README.md, docs/phase-4-learning-intelligence-plan.md) were preserved untouched and remain the only non-WP1 modifications.
- **Git safety:** ran `git status --short` / `branch --show-current` / `log -1 --oneline` — branch `feat/phase-4-learning-intelligence`, HEAD `30d3424`, exactly the three expected uncommitted docs. Nothing reset/stashed/discarded; branch not switched; no commits.
- **What was built:**
  - **Single source of truth — new shared module `src/shared/huntCurriculum.ts`** (`HuntCurriculum`): keyed by hunt id for all seven runnable hunts; fields: `skillArea`, `difficulty` (mirrors the wired scenario; asserted by test), `conceptsPracticed[]`, `expectedOutcomes[]`, `investigationFocus[]`, `reportFocus[]`. Learner-safe by construction — describes what to practise and how to investigate; never names the defect, its fix, the affected implementation, a hidden finding-check term, or any pre-unlock answer. All copy manually reviewed against `src/server/defects.ts` for leakage.
  - **Shared contract `src/shared/practice.ts`:** `HuntSummary` gains optional `curriculum?: HuntCurriculum` — additive-only; existing consumers and the `{ error, message }` envelopes are unchanged; no defect ids anywhere.
  - **Client data:** `Scenario` gains optional `curriculum?: HuntCurriculum` (types.ts); the seven wired entries in `src/data/scenarios.ts` now carry `curriculum: HUNT_CURRICULUM[...]` (single source — no duplication). New export `recommendedHuntScenarioIds` (order: beginner manual/API → intermediate → advanced access-control).
  - **API:** `src/server/practice.ts` attaches `HUNT_CURRICULUM[hunt.id]` to the learner-safe hunt summary on **all** hunt-summary surfaces: `GET /api/v1/practice/hunts`, `POST .../start` (all three paths), `GET /api/v1/practice/session`. Hunt registry defect ids still never leave the server; endpoint behavior, envelopes, caps and activation model unchanged. **Deviation from the plan's "WP1: zero API change" wording — deliberate, per the WP1 task instruction ("expose the new learner-safe metadata through the existing hunt summary/API"); the plan predates the task instruction. The plan document is unchanged (still lists "zero API/DB change" for WP1) — reconcile when the plan is next revised, or leave as-is: the API change is additive and compatible.**
  - **Scenario detail UI:** `ScenarioDetailPage.tsx` renders, only for the wired hunt scenarios: "QA concepts practised" (check-list), "Suggested investigation focus" (prompted list, explicitly method-not-answers copy), "Expected learning outcomes" (check-list), "What a good report covers" (prompted list); plus a "Skill area" row in the Scenario facts panel. Reuses existing Test Bench components (`SectionHeader`, `FactList`, `check-list`/`plain-list` patterns) and existing icons (`check`, `target`); heading levels sequential; placeholder scenarios render nothing new.
  - **/practice UI:** new static "Recommended path" section (ordered, numbered, links to the scenario pages, `difficultyLabels` kicker) — per the approved P4-M1 plan (WP1: "/practice shows the recommended order (static list, no backend)"); rendered above the hunt panel.
- **Testing / verification (all run, all pass):**
  - New/extended tests: `tests/data/content.test.ts` (+ curriculum completeness/shape per hunt, difficulty mirror, **no defect ids/titles/fix strings in curriculum**, `recommendedHuntScenarioIds` wiring and difficulty ordering), `tests/server/hunt-set.test.ts` (hunts list: exact keys now `curriculum,id,scenarioId,summary,title`; curriculum shape per entry; no defect ids or evaluator terms (`finding-check`, `quality_score`, `hint_mask`, `hunt_attempts`) in the payload), `tests/server/hunt.test.ts` (start + session payloads carry curriculum; no evaluator data), new `tests/pages/curriculum-views.test.tsx` (markup: curriculum sections render on `/scenarios/manual-cart-totals`, placeholder scenario renders nothing new, `/practice` recommended path renders all seven in order, links valid, no defect ids).
  - **358 tests green** (344 baseline + 14 new); `npm run check` clean (lint → typecheck → test); `npm run build` passes.
  - Browser probe (Chrome headless vs local `npm run preview` build): `--dump-dom` confirms the curriculum sections on the detail page, absence of defect ids, `/practice` recommended path lists all seven hunt scenarios in order; screenshots at 375 px and 1440 px (light theme) render cleanly, no new visual language, no clipped content. **Not verified: dark theme and 768/1024 px this session** (no new colours/tokens were introduced — additions reuse existing tokens and both are re-verified in the next UI milestone browser probe); 375 px shows Chrome-headless classic scrollbars on both axes (also present on unchanged pages — headless artifact, not page overflow).
- **Notable development issue (fixed):** Vitest transform resolution for `.tsx` test files is keyed by the file being listed in `tsconfig.app.json`'s `include` list (solution-style root `tsconfig.json` — `tsconfck` resolves the referenced project, per-file `jsx` only applied when included). Without that, JSX compiles with the classic runtime and throws `ReferenceError: React is not defined`. Added `tests/pages/curriculum-views.test.tsx` (mirrors the three shop view tests) and excluded the same file from `tsconfig.functions.json`. A stale `node_modules/.vitest-cache` held the earlier classic transform; clearing `node_modules/.vitest-cache` + `node_modules/.vite` is required after fixing jsx resolution. **Do not add `.tsx` view tests outside the app `include` list without clearing `.vitest-cache`.**
- **Unresolved/known issues:** none blocking. The 375 px classic-scrollbar rendering is a Chrome headless artifact, not a page regression. Dark-theme/768–1024 px spot checks are deferred to the next UI milestone's browser probe.
- **Documentation:** `PROJECT_STATE.md` updated (this entry; §1 snapshot; §13 resume prompt; §14). `README.md` untouched (its content stays accurate). Plan document untouched (WP1 API-exposure wording is stricter than the plan's "no API change" — noted above for the next plan revision).
- **Exact next action:** **P4-M1 WP2** — migration `0010_hunt_attempts.sql` (schema_version → 10), `src/server/attempts.ts` + `src/server/reports.ts`, hunt-start attempt creation, `report:<iphash>` 30/min scoped limit — in a fresh OpenCode session, only on explicit maintainer instruction. WP1 is committed as the branch baseline (`feat: complete phase 4 curriculum foundation`; see the baseline review entry above). Do not start WP2 before this baseline commit is reviewed.

### 2026-11-16 — Phase 4 planning decisions resolved; implementation branch prepared (planning/git only)

- **Scope:** planning and Git preparation only. No application source, tests, migrations, dependencies, Cloudflare configuration, or deployment touched. Nothing committed, pushed, merged or deployed; the pre-existing uncommitted docs remain uncommitted on purpose.
- **Precondition checks (all passed):** branch `main`; `HEAD == 30d34241ba39424a4356c58eec8f566aa0ddb3d5`; three pre-existing uncommitted files present and exactly as expected (`PROJECT_STATE.md` modified, `README.md` modified, `docs/phase-4-learning-intelligence-plan.md` untracked); `git diff --stat` matched; no pre-existing `feat/phase-4-learning-intelligence` branch; nothing reset/stashed/discarded.
- **Five planning decisions resolved** (documented in the plan's §14, cross-referenced through the plan, see plan §14 for the authoritative wording):
  1. **Finding-check term groups** — curated, server-side per hunt; reasonable synonyms/equivalent terminology accepted (no brittle exact-string-only matching); input consistently normalized (case/punctuation/whitespace, same pipeline as the rest of the evaluator); expected terms/defect ids/answer patterns never exposed to the client pre-unlock (asserted by test); deterministic and unit-tested with positive/negative/synonym/normalization/unrelated-keyword cases; `finding` is awarded only from the finding fields (title + steps + expected + actual) — unrelated keyword mentions never award `finding` or `discovered`.
  2. **Severity vocabulary** — exactly **Critical|High|Medium|Low**, impact/scope-based; descriptions shown in the UI; `bug_reports.severity` CHECK constraint and the `severity-valid` rubric check updated accordingly.
  3. **Priority vocabulary** — separate from severity: **P1 — Urgent · P2 — High · P3 — Normal · P4 — Low**; severity = impact, priority = urgency; never automatically derived from each other; `p1..p4` enum preserved in DB/rubric.
  4. **Guest progress** — tied to the anonymous `practice_session`; UI states progress is temporary, tied to the session, expires with it (7-day TTL), and never transfers to a signed-in account; ownership, retention and cascade rules preserved; signed-in attribution (`customer_id` stamp at submit) unchanged.
  5. **Deployment pattern** — manual Cloudflare workflow retained; no new Cloudflare products/infra/cron/queue/paid services; existing D1 + Pages architecture preserved; deployment verification and rollback considerations documented in plan §7.5 and in the release/exit-audit requirements (§13 items 6 and 9); **no deployment during implementation** — release is a separate, explicitly approved step.
- **Roadmap unchanged:** no renumbering of Phases 5–10 approved; the deferred API & Identity Lab remains deferred; PROJECT_STATE §9 and plan §12 explicitly record that no renumbering has been approved. All non-goals, deferred capabilities, architecture decisions and the three-milestone structure (P4-M1 Learning Foundation, Attempts & Evaluation → P4-M2 Complete Bug-Hunt Learning Experience → P4-M3 Progress, Scoring & Phase 4 Release) are intact; all original functionality remains in scope.
- **README:** no changes — it contains no milestone counts, severity/priority vocabulary or decision-dependent content; its uncommitted edits are preserved untouched.
- **Branch:** `feat/phase-4-learning-intelligence` created from `main` @ `30d34241ba39424a4356c58eec8f566aa0ddb3d5` via `git switch -c` after the documentation edits and with all pre-existing uncommitted docs carried over intact. No commits were made on it.
- **Verification:** `git diff --check` clean; plan lists exactly three milestone sections; all five decisions consistent across §4.2, §6.4 (incl. new "Severity and priority vocabularies" and "Finding-check term groups" blocks), §7.2/§7.3/§7.5, §8 honesty requirements, §13 exit criteria (items 4, 6, 9), §14; `npm run check` not re-run — no code changed.
- **Next exact action:** begin **P4-M1 WP1** (scenario curriculum enrichment) in a fresh OpenCode session, only after explicit maintainer approval; P4-M1 implementation has **not** been started.

### 2026-11-16 — Phase 4 plan milestone consolidation: eight milestones → exactly three (planning only)

- **Scope:** documentation only. No application source, tests, migrations, dependencies, Cloudflare configuration, or deployment touched. No branch created, no deploy, no push, no commit (docs changes remain in the working tree for the user's review).
- **Precondition checks (all passed):** branch `main`; `HEAD ==` the expected `30d34241ba39424a4356c58eec8f566aa0ddb3d5` (plus no later main commit required); uncommitted changes present and exactly the Phase 4 planning files (`PROJECT_STATE.md`, `README.md`, `docs/phase-4-learning-intelligence-plan.md`); `git diff --check` clean; no unexpected source-code changes (`git status --porcelain` lists only those three docs). Nothing was reset, stashed or discarded.
- **Deliverable:** `docs/phase-4-learning-intelligence-plan.md` restructured — Phase 4 now contains **exactly three milestones**. **P4-M1 — Learning Foundation, Attempts & Evaluation** (combines original P4-M1 scenario curriculum enrichment + P4-M2 attempts & bug-report persistence + P4-M3 deterministic report evaluator; migration `0010_hunt_attempts.sql` sketch and §6.4 rubric unchanged). **P4-M2 — Complete Bug-Hunt Learning Experience** (combines original P4-M4 hint ladder & gated reveal backend + P4-M5 structured bug-report form/evaluation UI + P4-M6 hint/reveal UI & attempt status). **P4-M3 — Progress, Scoring & Phase 4 Release** (combines original P4-M7 real `/progress` aggregate endpoint + P4-M8 scoring transparency & recommended completion path + Phase 4 exit audit).
- **Preservation:** every original milestone's scope, requirements, API/DB/frontend/security/privacy/testing requirements and **all acceptance criteria** were mapped into the three milestones; the consolidation map is recorded in the plan (§6.1). "Minimum viable Phase 4" (old P4-M1…P4-M6) now maps to P4-M1 + P4-M2; full scope (old P4-M1…P4-M8) to P4-M1 + P4-M2 + P4-M3. Security rules kept in force across milestones: server-side reveal gating, no defect ids pre-unlock, `report:<iphash>` 30/min, enum/length/control-char validation, owner-scoped authorization, cascade retention (orders precedent). Endpoint summary (§7.1), exit criteria (§13), testing strategy (§10), risks (§11), dependencies (§11.2) and open questions (§14, now "resolve before P4-M1") updated to the three-milestone structure; dependency order strictly P4-M1 → P4-M2 → P4-M3 with internal WP1→WP3 ordering in each milestone.
- **Deferred/roadmap items unchanged:** §12 table (API & identity lab → suggested Phase 5, maintainer confirmation required), §9 roadmap table (intentionally unrenumbered), open questions, and all architectural decisions preserved verbatim.
- **PROJECT_STATE.md updated:** §1 snapshot, §9 phase-4 status line, §10 repo shape (doc line), §13 resume prompt, this entry, §14 (three-milestone structure + exact next action). README needed no change (its Phase 4 reference is milestone-count-free).
- **Verification:** `npm run check` not re-run — no code changed. `git diff --check` clean; plan lists exactly three milestones; every original requirement has a destination.
- **Next recommended action:** maintainer reviews `docs/phase-4-learning-intelligence-plan.md` and resolves the five open questions in its §14. **Done later on 2026-11-16** — see the decisions-resolved entry above. Then — only on explicit instruction — start **P4-M1** (WP1 scenario enrichment → WP2 attempts/migration → WP3 evaluator). Do not start P4-M2 before P4-M1 is verified and committed.

### 2026-11-16 — Phase 4 planning: Learning & Bug-Hunt Intelligence (design only, no implementation)

- **Scope:** planning and documentation only. No application source, tests, migrations, dependencies, or Cloudflare configuration touched. No branch created, no deploy, no push, no commit (docs changes remain in the working tree for the user's review).
- **Precondition checks (all passed):** branch `main`; `HEAD == origin/main == 30d34241ba39424a4356c58eec8f566aa0ddb3d5`; working tree clean at session start; latest deploy recorded (`1f0847f`, Pages project `qa-practice-lab`, D1 `qa-practice-lab-db`, `schema_version` 9).
- **Inspection:** targeted reads only (AGENTS.md, PROJECT_STATE.md, README.md, Phase 3 plan & exit audit, `src/server/{hunts,defects,practice}.ts`, `src/shared/practice.ts`, scenario data/type modules, `/practice` + scenario-detail + `/progress` surfaces, one wired scenario entry, migration `0007`). The `ui-ux-pro-max` skill was invoked; focused UX queries (form submit feedback, labels/inline validation, progress indicators/focus states) verified relevant guidance for the report form and progress page.
- **Deliverable created:** `docs/phase-4-learning-intelligence-plan.md` — Phase overview & objectives; current-state assessment; scope/non-goals; learner journeys; capability breakdown A–G (reveal, hints, report evaluation, scoring, progress, difficulty/paths, scenario content); milestones **P4-M1…P4-M8** with objective/visibility/backend/frontend/DB/API/testing/dependencies/out-of-scope/acceptance/risks; API & DB considerations (additive migration `0010_hunt_attempts.sql` sketched: `hunt_attempts` + `bug_reports`, `schema_version` → 10, session-cascade ownership mirroring orders, `hint_mask` idempotent levels); security & privacy (server-side reveal gating, no defect ids pre-unlock, report-text handling, `report:<iphash>` 30/min scoped limit); UX requirements (Test Bench extension only); testing strategy; risks; deferred/future phases; Phase 4 exit criteria; open questions for the maintainer.
- **Key decisions recorded (plan §1.1, §3, §12):** Phase 4 is re-scoped from the old "API & identity lab" placeholder to **Learning & Bug-Hunt Intelligence**; the API & identity lab is deferred (suggested renumbering → Phase 5; maintainer confirmation required — §9 table intentionally unrenumbered). Completion = submitted report; "discovered" = sticky finding-check pass; quality is a documented 100-point deterministic rubric (no AI, no speed, hints disclosed never subtracted, best score kept, free resubmission); guest progress remains session-scoped-ephemeral by design (synthetic auth has no cross-session identity); reveal unlocks only after submission or an explicit confirmed give-up; attempts/reports die by cascade with the practice session (orders precedent).
- **Minimum viable Phase 4:** P4-M1…P4-M6 (content → attempts/storage → evaluator → hints/reveal → report UI → hint/reveal UI). Full scope: P4-M1…P4-M8 (adds real `/progress` and the rubric explainer + exit audit). Deferred: AI feedback (never a runtime dependency), real accounts/cross-device progress, cohorts/leaderboards, expanded defect library, enforced paths — see plan §12.
- **PROJECT_STATE.md updated:** §1 snapshot (Phase 4 plan referenced), §9 roadmap (Phase 4 row re-scoped with note; downstream numbering flagged as maintainer decision), §10 repo shape (doc added), §13 resume prompt (Phase 4 plan status), this entry, and new §14 (Phase 4 planning status & decisions). README gained a one-line Phase 4 reference only.
- **Verification:** `npm run check` not re-run — no code changed. `git status --porcelain` lists only documentation files.
- **Next recommended action:** maintainer reviews `docs/phase-4-learning-intelligence-plan.md` and resolves the five open questions in its §14 (finding-check term groups, severity/priority vocabulary, guest-visibility copy, roadmap renumbering, deployment pattern). Then — only on explicit instruction — start **P4-M1** (scenario curriculum enrichment; smallest, no DB, unblocks nothing but everything UI).

### 2026-11-16 — Deployment finalization: review, commit `1796f20`, push to `main`

- **Precondition verification (all passed):** branch `main`; `HEAD == origin/main == 1f0847f38cec5723633057a4f94b35bd84ac04a4`; exactly the five expected files modified (`wrangler.jsonc`, `PROJECT_STATE.md`, `README.md`, `AGENTS.md`, `docs/phase-3-exit-audit.md`). Nothing was reset, stashed or discarded.
- **Review results (per file):** `wrangler.jsonc` — `database_id` `928b4ed6-6284-46a2-b374-f1c569c1affe` matches the created production database; binding `DB` matches `c.env.DB` in the app code; `pages_build_output_dir`/`compatibility_date`/`migrations_dir` preserved; no credentials introduced; JSONC parses. `PROJECT_STATE.md` — URL, SHA, schema 9, smoke results and unverified items accurate. `README.md` — production instructions reflect the actual setup; no stale "not deployed" statements remain. `AGENTS.md` — workflow/state lines now reflect merged + deployed reality; OpenCode workflow guidance preserved. `docs/phase-3-exit-audit.md` — original audit preserved; the dated addendum distinguishes audit-time findings from post-deployment verification.
- **Corrections made during review:** (1) §13 resume prompt had an unmatched `**` in the Phase 3 status sentence (stray bold after "done and verified") — restructured into two clean spans; (2) the §11 "Git state at end of session" file list was missing `docs/phase-3-exit-audit.md` — added.
- **Safety checks:** `git diff --check` clean; no secrets/tokens/keys in the staged diff; no application source, tests, migrations or production data touched; no destructive database commands run.
- **Commit & push:** `1796f20` — `docs: finalize phase 3 production deployment` (exactly the five files). Pushed `1f0847f..1796f20` to `origin/main`. Post-push: local `main` == `origin/main` == `1796f20`; working tree clean.
- **Pages deployment status after push:** the `qa-practice-lab` Pages project has **no Git integration** (`Git Provider: No`), so the push triggered **no automatic deployment**. The only deployment remains `99ef81ca` (source commit `1f0847f`, production branch `main`) and is live; post-push `/api/health` → `schemaVersion: "9"`. The docs/config commit changed no application code; production serves the `1f0847f` bundle, which is identical in behaviour to the reviewed state (the uncommitted `wrangler.jsonc` change from the deployment session is now committed in `1796f20` and does not change the bundle).
- **Note:** GitHub reported the known moderate Dependabot advisory on the default branch (dev-only tooling chain; production deps clean) — unchanged by this push.
- **Next exact action:** user decides the maintenance sweep cadence and any monitoring setup; Phase 4 has not started and must not begin without explicit instruction.

### 2026-11-16 — Phase 3 production deployment to Cloudflare Pages

- **Precondition checks (all passed):** branch `main`; `HEAD == origin/main == 1f0847f38cec5723633057a4f94b35bd84ac04a4` (merge of PR #4); working tree clean at session start; Phase 3 merge commit present; all nine migrations (`0001`–`0009`) present. No branches switched, reset, merged, or pushed.
- **Pre-deployment audit:** `wrangler.jsonc` (Pages config, `pages_build_output_dir: "./dist"`, D1 binding name `DB`, previously a placeholder `database_id` by design); Pages Functions catch-all `functions/api/[[route]].ts` → Hono; `package.json` build/deploy scripts; migrations verified **additive only** (no DROP/DELETE/TRUNCATE/renames; only `app_meta` `schema_version` bumps). No secrets in the repo.
- **Local gates:** `npm run check` — **passed** (ESLint clean; TypeScript clean in all three projects; **344/344 tests green**). `npm run build` — **passed** (JS 478.61 kB / gzip 139.18 kB; CSS 76.55 kB / gzip 14.36 kB).
- **Cloudflare setup (explicit user approval obtained before creating resources):** Wrangler 4.162.0 authenticated via OAuth (account `7769f509e147760becc1711810803069`, owner email ends `gmail.com`). `d1 list` was empty → created **`qa-practice-lab-db`** (region APAC; database_id `928b4ed6-6284-46a2-b374-f1c569c1affe`) and set the real id in `wrangler.jsonc` (binding stays `DB`; the id is not a secret). The remote database was verified empty before migrating (only `_cf_KV` and `d1_migrations` internals). Remote migrations `0001`–`0009` applied; `schema_version` = **9** (verified by remote query and `/api/health`); seed integrity confirmed (42 products / 8 categories / 5 customers). Created Pages project **`qa-practice-lab`** (production branch `main`) — no other project was touched. Deployed `dist/` with `npx wrangler pages deploy dist`; the `d1_databases` binding from `wrangler.jsonc` is applied to the Pages Functions at deploy time (verified: `/api/health` → `schemaVersion: "9"`), so no dashboard binding step was needed or performed.
- **Production URL:** https://qa-practice-lab.pages.dev (this deployment's alias: https://99ef81ca.qa-practice-lab.pages.dev). **Deployed commit SHA:** `1f0847f38cec5723633057a4f94b35bd84ac04a4` (`main`). The deploy was built from a working tree carrying one uncommitted change (`wrangler.jsonc` real `database_id`); no application code differed from the commit. That change is deliberately left uncommitted for review — nothing was pushed or committed in this session.
- **Smoke tests against production (curl-level, synthetic data only) — ALL 15 PASS:**
  1. `/api/health` → 200, `schemaVersion: "9"` — PASS
  2. Shop + product detail pages load (HTML 200 for `/`, `/shop`, `/shop/products/:slug`; product API detail 200; unknown slug → `404 not_found`) — PASS
  3. Categories + filtering (`category=water` → total 5; `q=Kestrel` → 1; description-term search `roll-top` → 1 in clean mode) — PASS
  4. Cart create / update / remove — PASS
  5. Checkout creates an order — PASS (`ORD-50AE62536D3C40B6`, 2× Kestrel Dry Bag, $59.80, `approved`, HTTP 201)
  6. Idempotent checkout replay — PASS (same reference returned; `Idempotent-Replay: true` header)
  7. Customer login and logout — PASS (Amara in/out; `auth/me` 200 → 401)
  8. Cross-customer order access denied — PASS (Ben reading Amara's order → concealed `404 not_found`; guest on account endpoint → `401`; cross-session cancel → `404`)
  9. Staff inventory authorization — PASS (guest `401`, customer `403 staff_required`, staff `200`)
  10. Restock + order cancellation — PASS (product 40 restocked +1, audit row `id 2`, quantity `47`; zero quantity → `400`; guest order `ORD-50AE62536D3C40B6` cancelled → stock restored; Amara's order `ORD-C9A69B0CCED1CD64` cancelled → stock restored)
  11. Bug-hunt session start / reset — PASS (fresh browser jar: `clean` → start `hunt-catalogue-001` → `bug_hunt` → reset → `clean`; `/api/v1/practice/hunts` list is learner-safe)
  12. Clean Mode unaffected by defects — PASS (description-term search and category filter behave cleanly after reset; identical to pre-hunt baselines)
  13. Rate limits → 429 — PASS (5 × `401 invalid_credentials` → 6th attempt `429 login_rate_limited`; correct sign-in after the one-minute window → `200`, budget cleared)
  14. Oversized request → 413 — PASS (40,057-byte JSON body → `413 payload_too_large`)
  15. Staff-only maintenance sweep — PASS (guest `401`, customer `403`, staff `200` with `deleted` all-zero on a fresh deployment)
- **Not tested / not run in this session:** browser-level (headless Chrome) smoke against production — checks were HTTP/API-level; the idempotency **conflict** path (same key + different payload → `409`) and the `checkout`/`mutate` 429 scopes were not exercised against production (the `login` scope was; deliberately no load or repeated checkout testing); the exact-stock `422` boundary was not exercised; the `Retry-After` header body was not asserted (429 body confirmed); the Pages project D1 binding was proven by `/api/health`, not inspected in the dashboard; the first `/api/health` call immediately after project creation briefly returned `error code: 522` (edge propagation) and has been stable on every subsequent check.
- **Production test data (all synthetic):** guest order `ORD-50AE62536D3C40B6` — cancelled, stock restored; Amara Okafor's order `ORD-C9A69B0CCED1CD64` — cancelled, stock restored; one staff restock of **+1 unit** on `sundrift-pocket-compass` (product 40; recorded in `inventory_adjustments` as `id 2`, actor = staff account Rowan Ellison); maintenance sweep reported zero deletions. No other data was created or modified.
- **Known production limitations:** no cron/scheduler on Pages — the sweep is **operator-invoked** (procedure below); rate limits are per-IP fixed windows (exit-audit §8 trade-offs: shared egress IPs share budgets; window seams); hunt starts capped at 20/IP/UTC day; 21 catalogue scenarios remain non-runnable placeholders; no telemetry beyond `/api/health` and `console.error`; free-tier D1 daily read/write ceilings apply (PROJECT_STATE §7) — current usage is trivially within them.
- **Maintenance sweep procedure (operator, no in-product scheduler):** sign in with a staff account (synthetic fixture `rowan.ellison@example.com / demo-rowan-9001`, or a browser session) and `POST /api/v1/admin/maintenance/sweep` with an empty JSON body; the response reports bounded `deleted` counts per table and is idempotent. Recommended cadence: **at least weekly** (daily during active cohorts/classes). If a Workers project is introduced later, it should call the same `sweepExpiredData()` unchanged.
- **Future releases:** `npm run check && npm run build && npx wrangler pages deploy dist` (deploys from the `main` branch working tree; the `DB` binding comes from `wrangler.jsonc`). Local development is unchanged (`npm run db:migrate:local`, `npm run dev`).
- **Git state at end of session:** branch `main`; uncommitted changes — `wrangler.jsonc` (real `database_id`), `README.md`, `PROJECT_STATE.md`, `AGENTS.md`, `docs/phase-3-exit-audit.md` (deployment addendum). Nothing committed, pushed or PR'd in that session.
- **Next exact action:** user reviews and commits the deployment documentation + `wrangler.jsonc` change (only with explicit instruction). **Done on 2026-11-16 — commit `1796f20` pushed to `origin/main`; see the 2026-11-16 finalization entry above. Phase 4 has not started and must not begin without explicit instruction.**

### 2026-11-15 — Phase 3 PR self-review: findings and fixes

- **Branch before work:** `feat/phase-3-commerce-practice` @ `98bcfdf` (P3-M9), tree clean;
  `main` untouched. The Phase 3 branch was confirmed in sync with `origin` (a background
  process outside this session mirrored it — no manual push was performed here).
- **Review:** two adversarial passes over the complete `main...HEAD` diff (115 files,
  +20,292). Server pass: 10 findings (1 latent correctness defect, 2 doc/comment-vs-code
  contradictions, rest informational). Frontend pass: 8 findings (2 Medium, rest Low).
  Every finding was verified against the code before acceptance; severity re-graded honestly.
- **Fixed (commit below):** cart context resyncs on failed checkout (unavailable/empty
  outcomes); hunt-launch panel renders `actionError`; hunt panel clears justStarted/justReset
  on external mode changes (render-phase adjustment, no setState-in-effect); account order
  pages render the auth-error state with retry instead of the guest prompt; HealthStatus
  sequences its retry via a monotonic request id; cancel confirm panel is focusable and takes
  focus (Button now accepts a `ref`, mirroring IconButton); dead symbols removed
  (`MAX_LINE_QUANTITY` re-export, unused `emailRef`, unreachable suspended copy — now wired to
  the context's `suspended` flag); nameless `role="radiogroup"` dropped; cart/checkout/staff
  inventory reads made `LEFT JOIN` fail-closed (missing inventory rows flag out of stock
  instead of silently vanishing — checkout 422s, staff view shows 0 units); cart-item id
  pattern bounded to 16 digits. Regression tests added (LEFT-JOIN fail-closed incl. staff
  view; bounded id) — **344/344 green**. `npm run build` clean. Browser probe re-verified
  **25/25** against the production build after the fixes.
- **Documented, not changed (deliberate):** `inventory_adjustments.product_id` is
  `ON DELETE CASCADE` (contradicts the "audit outlives its subjects" comment — unreachable in
  app since products are deactivated, never deleted; fixing needs a table rebuild, deferred);
  migration 0004's header comment says request_hash binds cart contents (code deliberately
  excludes cart — comment frozen, contract documented in README/checkout.ts/audit §5);
  sequential item ids appear in order payloads (the opaque claim applies to `orders.id`);
  `orders.status` stores only `placed` (by design, derived cancellation); no cap on
  `inventory.quantity` upper bound (restock-only control, documented); `x-forwarded-for`
  trusted only as a dev fallback (soft limiter, documented); D1 statement count per checkout
  is high (~15) — a request-scoped session-resolution optimization is the known follow-up,
  deliberately not bundled into this review; sweep deletes a signed-in customer's order
  history when the practice session expires after 7 days (the designed, documented retention
  policy); account pages still show guest prompt during wishful "loading" windows.
- **Git:** one follow-up commit on the branch (`fix: address PR self-review findings`,
  `cd4865f`); **PR #4 opened** — https://github.com/thisishamza/qa-practice-lab/pull/4
  (`feat/phase-3-commerce-practice` → `main`, 10 commits, 117 files, +20,542/−127,
  mergeable). Note: GitHub's Dependabot banner reports 1 moderate advisory on the default
  branch (README documents the same moderates, dev-only; production deps clean). Branch push
  was performed explicitly (`git push` via the environment's credential flow); no force-push,
  no merge, `main` untouched. Phase 4 remains unstarted.
- **Next exact action:** user opens the PR from the prepared compare URL (body in the final
  report); review thread lands there. Phase 4 remains unstarted.

### 2026-11-15 — Phase 3 P3-M9: hardening, reset & Phase 3 exit audit

- **Branch / commit before work:** `feat/phase-3-commerce-practice` @ `7996c98` (P3-M8), tree
  clean; `main` untouched; nothing pushed. Changes land in the milestone commit at the end of
  this turn (`feat: harden phase 3 and complete exit audit`; hash in the final report).
- **Audit findings (fixed):** (1) no rate limits anywhere except the soft hunt-start cap, and
  that cap could overshoot under concurrency and leak stale-day rows past the bounded delete;
  (2) login had zero brute-force protection — the plan deferred the 5/min/IP limit to M9 and
  it was never built; (3) failed logins minted a throwaway practice session before
  verification; (4) expired sessions/customer-sessions/cap/bucket rows were deleted only
  lazily, never boundedly; (5) no request body-size guard on mutations; (6) no local demo
  reset script (`db:reset:local` required by the plan); (7) expired `customer_sessions` from
  vanished practice sessions were only deleted on contact; (8) frontend fetch/error handling
  re-audited — no new defects found (loading/error/empty/expiry states, idempotency-key
  rotation, suspended-account handling all correct); no UI behaviour changed.
- **Migration `db/migrations/0009_rate_limit_buckets.sql` (additive, applied locally,
  `schema_version` → 9):** `rate_limit_buckets(key, window_start, count)` (PK `(key,
  window_start)`, `count >= 0`, index on `window_start`). `key` = `<scope>:<SHA-256 IP>`.
  One row per scope/IP/UTC-minute window; swept after two hours.
- **`src/server/rateLimit.ts` (new):** fixed-window limiter with one atomic
  `INSERT … ON CONFLICT DO UPDATE … RETURNING` per consume (one D1 statement, no per-request
  prune); `clientIp`/`sha256Hex` shared; `peekRateLimit`/`resetRateLimit` for the login
  budget. Scopes: `mutate` (global backstop, **120/min** per IP — deliberate: 60 was too
  tight for the legitimate ~71 mutating calls a hunt-cap test session issues in a minute;
  scoped budgets do the real work), `login` (**5 failed sign-ins/minute**, PBKDF2 skipped
  once exhausted, budget cleared on success, 429 `login_rate_limited` + `Retry-After`),
  `checkout` (**30 placements/minute**, every attempt counts, 429 `rate_limited`). No visible
  IP (local dev) → limiter skipped entirely. Mounted as middleware in `app.ts` for all
  mutating `/api/v1` requests.
- **Hunt-start cap made exact:** `consumeHuntStart` rewritten — guarded
  `UPDATE … WHERE starts < 20` (fast path, one statement) → single atomic upsert that inserts
  or resets a stale-day row → final guarded bump. Cannot overshoot; a pre-existing stale-day
  row is correctly reset instead of capping the IP forever; day-old rows pruned ≤100/call.
- **Login flow restructured (`auth.ts`):** 429 check first (before any PBKDF2), practice
  session minted only on success (failed brute force no longer creates throwaway sessions),
  `403 account_suspended` unchanged, success clears the failure budget.
- **`src/server/maintenance.ts` (new):** `sweepExpiredData(db, { now?, limit? })` — bounded
  (≤100/table) subquery-DELETE of expired `customer_sessions`, expired `practice_sessions`
  (cascades carts/items/orders/items/idempotency/bound customer sessions), day-old
  `hunt_start_caps`, two-hour-old `rate_limit_buckets`. Idempotent; never touches
  `inventory_adjustments`/`order_cancellations` (audit/exactly-once markers), active sessions,
  catalogue or customer fixtures. Exposed as **`POST /api/v1/admin/maintenance/sweep`**
  (staff-only via `requireStaff`; Pages Functions have no cron — operator-invoked) and as
  **`npm run db:cleanup:local`** (local SQL equivalent, `--local`). **`npm run db:reset:local`**
  (`db/maintenance/reset-local.sql`) restores the seed inventory and deletes ALL local
  learner state; local-only, explicitly destructive, never run by application code.
- **Request body cap:** `app.ts` rejects `Content-Length > 32 KB` with `413
  payload_too_large` before any parsing (lying small bodies are the platform's problem).
- **`tests/server/hardening.test.ts` (+13):** migration 0009 fresh **and** 0001–0008 → 0009
  upgrade paths (data survives), body-size 413, mutate-cap 429 integration (pre-filled
  bucket), checkout-cap 429, login 5×401 → 429 with correct password, per-IP independence,
  budget reset on success, hunt-cap stale-day reset (starts=1), sweep authz (401/403/200),
  sweep deletes expired rows + cascaded order/items/cancellation markers, preserves active
  `bug_hunt` session + `inventory_adjustments`, idempotent second sweep. Fresh-harness
  `createMigratedD1({ through })` + `applyRemainingMigrations` added to `fake-d1.ts`.
  schema_version assertions bumped 8→9. **342/342 tests green** (was 329).
- **Verification:** `npm run check` — passed; `npm run build` — passed (JS 477.54 kB / gzip
  139.01 kB, CSS 76.55 kB / gzip 14.36 kB, no new runtime deps); `db:migrate:local` applied
  0009 (local `/api/health` → `schemaVersion: "9"`); `db:cleanup:local` + `db:reset:local`
  executed (inventory restored, learner state 0, audit rows intact). Browser probe
  (headless Chrome vs production build, port 8791): **25/25 pass** — guest flow
  (home → shop → search Kestrel Dry Bag → add → cart → checkout → reference → cancel →
  cancelled), hunt start/reset banner flips, staff sign-in → inventory → staff sweep
  (401 guest / 200 staff, bounded-count report), login brute-force (5×401 → 429 +
  `Retry-After`), 413 on a real 40 KB body, **zero unexpected console errors**. Probe IP is
  randomized per run (per-minute buckets make repeated runs order-dependent otherwise).
  Port 8791 confirmed closed. No visual/UI changes — `ui-ux-pro-max` checklist applied to
  touched surfaces only (semantics preserved; no layout work).
- **Docs:** `docs/phase-3-exit-audit.md` (new — milestones & commits, schema 0001–0009,
  security controls + limitations, inventory/order accounting guarantees, bug-hunt engine,
  retention/cleanup policy, rate-limit limitations, test/build/browser results, known
  issues, Cloudflare deployment steps, exit criteria verdict), README (commands, architecture
  tree, retention & rate limits section, schema v9, constraints), plan doc (M9 as-built, §3
  table, §4/§7), `docs/bug-hunt-catalogue.md` (exact cap; sweep behaviour), AGENTS.md, this
  file.
- **Known limitations / open items (full list in `docs/phase-3-exit-audit.md` §10):** no
  deployment and no remote resources (user decision); no cron on Pages — sweep is
  operator-invoked; login cap can overshoot slightly under a tight concurrent burst (fixation
  of exactly one statement short — documented); limiters skipped without a visible IP;
  rate-limit buckets and caps are per-IP (shared egress IPs share a budget); `orders.status`
  stores only `placed` (cancellation derived); 21 placeholder scenarios remain non-runnable;
  local D1 accumulates probe state until `db:reset:local`.
- **Git:** single milestone commit `feat: harden phase 3 and complete exit audit`.
  `main` untouched, nothing pushed, Phase 4 not started.
- **Next exact action:** STOP. Phase 3 is implementation-complete and verified. Await user
  instruction — merge/deployment decisions or Phase 4 (do not begin without approval).

### 2026-11-15 — Phase 3 P3-M8: bug-hunt defect set & scenario wiring

- **Branch / commit before work:** `feat/phase-3-commerce-practice` @ `59baeed` (P3-M7), tree
  clean; `main` untouched; nothing pushed. Changes land in the milestone commit at the end of
  this turn (hash in the final report).
- **UI direction:** `ui-ux-pro-max` invoked before frontend work. No new `--design-system` run —
  this is a consistency pass on the existing Test Bench system (hunt rows reuse the index-row
  language; launch/reset follows the M7 panel pattern; filter facet reuses the chip/drawer
  system). Applied web-relevant guidance from the skill's checklist: ≥4.5:1 contrast, visible
  focus rings (`--focus`), `prefers-reduced-motion` render, semantic buttons/links with real
  accessible names, `role="status"`/`role="alert"` announcements, no emoji icons, no new
  dependencies. The `/practice` hunt list is the dense, keyboard-first control surface; the
  scenario badge is visual reinforcement, never the only signal.
- **Migration `db/migrations/0008_hunt_start_caps.sql` (additive, applied locally, `schema_version` → 8):**
  per-IP daily hunt-start cap rows (`hunt_start_caps`: SHA-256-hashed IP as PK, UTC `day`,
  `starts` counter). One row per address; previous-day rows are deleted on write. No defect,
  hunt or session state lives here — activation is still per-request from the caller's session.
- **Hunt registry (`src/server/hunts.ts`):** seven hunts, one defect each, all wired to a
  learner-safe `scenarioId`: `hunt-catalogue-001`→`manual-shop-search` (`CATALOGUE-001`),
  `hunt-catalogue-002`→`api-catalogue-filters` (`CATALOGUE-002`), `hunt-cart-001`→
  `manual-cart-add-quantity` (`CART-001`), `hunt-inventory-001`→`api-checkout-exact-stock`
  (`INVENTORY-001`), `hunt-pricing-001`→`manual-cart-totals` (`PRICING-001`),
  `hunt-checkout-001`→`manual-address-edge-cases` (`CHECKOUT-001`), `hunt-authz-001`→
  `security-object-access` (`AUTHZ-001`). Registry stays code, not data; responses carry only
  `{ id, title, summary, scenarioId }`.
- **Defect sites (one per defect, static branches, `await isDefectActive(c, …)`):**
  catalogue category predicate dropped (`catalogue.ts`); cart upsert replaces instead of
  accumulating quantity (both branches keep the stock guard, `cart.ts`); checkout
  `blockingProblems` boundary off-by-one (`checkout.ts`; one `rejectExactStock` flag shared by
  the pre-batch and post-batch callers so they cannot disagree); order_items snapshot stores
  unit price as line total (`checkout.ts`; id/qty/subtotal/total elsewhere stay correct);
  NAME_PATTERN check skipped in `validateDetails` (`checkout.ts`); account order-detail lookup
  drops the `customer_id` predicate (`auth.ts`). Clean branches untouched and verified
  defect-free per defect.
- **Scenario wiring (data):** three existing placeholders promoted/rewritten
  (`manual-cart-totals`, `manual-address-edge-cases`, `security-object-access`) and four new
  (`manual-shop-search`, `api-catalogue-filters`, `manual-cart-add-quantity`,
  `api-checkout-exact-stock`) — all `ready`/`runnable`, `mode: 'bug-hunt'`, `huntId` set.
  `Scenario.huntId` is optional and learner-safe. Bidirectional `huntId ↔ scenarioId` integrity
  and the two-tier catalogue rule (unwired stay non-runnable) are asserted in
  `tests/data/content.test.ts`; the content suite went from "all placeholders non-runnable" to
  the M8 contract.
- **API:** new `GET /api/v1/practice/hunts` (registry list, no cookie required, always 200).
  `hunt` summaries in `/api/v1/practice/session` and `/api/v1/practice/hunts/.../start` gained
  `scenarioId` (optional, learner-safe). Hunt starts are **softly capped at 20/IP/UTC day**
  (`cf-connecting-ip`, fallback first `x-forwarded-for`; hashed; previous-day rows purged on
  write). Idempotent same-hunt re-starts and resets are exempt; no visible IP (local dev) is
  uncapped; beyond 20 the endpoint answers `429 hunt_start_cap_reached` with `Retry-After`.
- **Frontend:** `HuntPanel` rewritten registry-driven (list from `GET /api/v1/practice/hunts`,
  loading/error/empty/ready states, retry, Start/Switch per row, Active tag + per-row reset,
  scenario deep-links, hunt count in the section header, no defect ids anywhere in the DOM —
  verified in the probe). `HuntLaunchPanel` on wired scenario pages (start/reset in place,
  loading/error/unavailable states). `BugReportExport` — local markdown download generated in
  the browser (nothing uploaded/stored/graded). Catalogue: **Bug-hunt exercise** badge on wired
  cards, `/scenarios?hunt=available` deep link, `Ready` in the status filter, `?hunt=available`
  URL state round-trips through the existing filter system. Both themes × 375/768/1024/1440
  verified (zero overflow, one h1).
- **Tests:** +28 server (`tests/server/hunt-set.test.ts`: per-defect both branches + reset
  semantics, envelope shapes, two-learner different-hunts isolation, all-7 hunts' forged-input
  rejection, per-IP cap matrix (20-cap, different IP, day rollover, idempotent-restart exempt,
  no-IP skip, resets exempt), whole-set reset table, registry integrity/no-leak, list endpoint
  contract); +3 client (`tests/practice/api.test.ts`); +3 lib (`?hunt=available`);
  `tests/data/content.test.ts` rewritten for the two-tier rule (+1 test). schema_version
  assertions bumped 7→8. **329/329 tests green**.
- **Verification:** `npm run check` — **passed** (ESLint clean; all three TS projects clean;
  329/329). `npm run build` — passed (JS **477.54 kB** / gzip 139.01 kB, CSS **76.55 kB** /
  gzip 14.36 kB; no new runtime dependencies). Local D1 migration applied (0008; schema_version
  reads 8; `/api/health` OK). Playwright/Chrome probe against the production build on port
  **8791**: **60/60 checks pass** — two isolated contexts: all seven defects defective-in-hunt +
  clean-outside, per-defect reset round-trips, catalogue discovery (7 wired cards, badge,
  `?hunt=available`, `Ready` facet), scenario launch panel flip, banner flips on start/reset,
  themes × widths, reduced-motion, Tab reachability, bug-report markdown download. **Zero
  unexpected console errors** (by-design 401/404/400/422 filtered). Port 8791 confirmed closed.
- **Docs:** README (status, routes, bug-hunt section rewritten for seven hunts + discovery +
  cap + local export, known constraints), `docs/bug-hunt-catalogue.md` (full maintainer
  registry: engine rules, hunt table, per-defect Expected/Actual/repro/fix/isolation/reset/
  tests), `docs/phase-3-commerce-practice-plan.md` (M8 marked implemented with as-built
  deviations; §3 API table, §6 mapping, risks), AGENTS.md (state lines), this file.
- **Known limitations / open items:** no reveal/scoring flow (Phase 4+); hunt starts are a
  **soft** cap (a request or two may overshoot under concurrency; day-boundary sweep is the
  `DELETE day != today` on write, not a job); 21 non-wired catalogue placeholders remain
  non-runnable; bug-report export is local-only by design; `hunt_start_caps` accumulates one
  row per IP until the day rolls (then it is deleted on the next write); expired sessions still
  swept only lazily (M9); local D1 accumulates probe state (throwaway).
- **Git:** single milestone commit `feat: expand bug-hunt scenarios and defect catalogue`
  (hash in the final report). `main` untouched, nothing pushed, P3-M9 not started.
- **Next exact action:** STOP. Await instruction to start **P3-M9 (hardening, reset & Phase 3
  exit)** — do not begin without approval.

### 2026-11-15 — Phase 3 P3-M7: bug-hunt engine v1

- **Branch / commit before work:** `feat/phase-3-commerce-practice` @ `db71597` (P3-M6), tree
  clean; `main` untouched; nothing pushed. Changes land in the milestone commit at the end of
  this turn (hash in the final report).
- **UI direction:** `ui-ux-pro-max` invoked before frontend work; focused `--domain ux` queries
  (status semantics → visible focus + `role="status"` live regions; submit feedback →
  loading→success/error states; destructive confirm → reset is deliberately NON-destructive, so
  no confirm dialog). Test Bench tokens are authoritative; no new dependencies, no icons package.
  The `--design-system` route was not used — this is a consistency pass on an existing design
  system, not a new page.
- **Migration `db/migrations/0007_bug_hunt.sql` (additive only, applied locally, `schema_version`
  → `7`):** `practice_sessions` gains `mode TEXT NOT NULL DEFAULT 'clean' CHECK (mode IN ('clean',
  'bug_hunt'))` and `hunt_id TEXT NULL CHECK (hunt_id IS NULL OR length(hunt_id) BETWEEN 1 AND
  64)`. `hunt_id` is deliberately NOT a foreign key — hunts are compiled TypeScript
  (`src/server/hunts.ts`), not database rows. Pre-M7 rows default to clean; guest and signed-in
  behaviour is byte-identical.
- **Engine design (as built):** registries are code — `src/server/hunts.ts` exports
  `HUNTS: [{ id: 'hunt-catalogue-001', title, summary, defectIds: ['CATALOGUE-001'] }]`;
  `src/server/defects.ts` exports `DEFECTS` (internal Expected/Actual/repro/fix per defect) and
  `isDefectActive(c, defectId)`, which reads the caller's `mpl_session` cookie exactly like the
  other session-scoped routes, loads the live session (one indexed lookup — `findLiveSession`
  was extended to select `mode`/`hunt_id`), requires `mode='bug_hunt'`, and checks the code
  registry's defect list for the hunt. Clean/expired/unknown-hunt/malformed-cookie sessions all
  resolve to false. No client-supplied defect id, role, owner or activation flag is ever
  consulted; `POST .../hunts/:huntId/start` takes NO body. No global flags, no process memory,
  no shared DB switch. Determinism: defect branches are static; no randomness or wall-clock.
- **API (`src/server/practice.ts`, mounted in `/api/v1`):** `GET /api/v1/practice/session`
  (read-only; never mints; `{ mode, hunt: { id, title, summary } | null }`; never defect ids),
  `POST /api/v1/practice/hunts/:huntId/start` (hunt id format-validated → 400
  `invalid_request`; registry miss → 404 `hunt_not_found`; live session is re-stamped in place —
  cart/orders/customer binding preserved — otherwise a fresh bug-hunt session is minted;
  same-hunt re-start is idempotent), `POST /api/v1/practice/session/reset` (NON-destructive
  re-stamp to clean; with no live session a fresh clean session is minted). Deviation from the
  plan's "expire + fresh session" sketch, documented in the plan + README: expiring the practice
  session would cascade-delete the learner's orders and cart (M4 FKs) and detach their synthetic
  customer session (M5 FKs) — far more destructive than "restores clean mode" promises. Existing
  session-cookie minting (`createSessionWithCart`) gained an optional `{ mode, huntId }` argument.
- **Proof defect `CATALOGUE-001` (hunt `hunt-catalogue-001`, "Catalogue search under-matches"):**
  expected — `GET /api/v1/products?q=` matches name OR description OR category name
  (case-insensitive substring, escaped LIKE, bind params); bug-hunt — the `p.description LIKE`
  clause is dropped in exactly ONE branch (`src/server/catalogue.ts`, guarded by
  `await isDefectActive(c, 'CATALOGUE-001')`); list and count share the predicate. Only the
  hunting session sees it. Repro: start hunt → shop search `vestibules` → 0 hits (clean: 1 —
  Ridgeline 2-Person Tent). Chosen instead of the sketched `PRICE-001` free-shipping off-by-one
  because NO shipping feature exists to hang the defect on; smallest defect demonstrated through
  an existing commerce workflow. Internal repro/fix/isolation in `docs/bug-hunt-catalogue.md`.
- **Frontend:** mode banner in the app shell (`ModeBanner`, `role="status"`; clean = green left
  border + check, bug-hunt = amber + bug icon + hunt title + Reset button; loading skeleton
  reserves space; error state with retry). `/practice` gained a Bug-hunt mode section
  (`HuntPanel`): current mode tag, hunt title/summary, Start button (loading → success
  `role="status"` announcement), Reset button (keeps cart/orders), inline `role="alert"` errors.
  Fresh `PracticeSessionProvider` context reads `/api/v1/practice/session` on mount; nothing in
  localStorage. Both themes verified at 375/768/1024/1440 (zero overflow, one h1, reduced-motion).
- **Tests:** `tests/server/hunt.test.ts` (+24): registry integrity (every hunt defect exists),
  fresh-browser clean read (never mints), start flow (mint/re-stamp/idempotent/legacy-session
  keep cart), malformed/unknown hunt ids, forged defect ids/mode/huntId in the body ignored,
  both defect branches, two-learner isolation, unrelated behaviour intact in hunt mode (sort),
  cart/checkout functional in hunt mode, unknown-hunt_id stamp resolves clean, expired hunt
  session purged → clean, non-destructive reset (cart + order placement survive), guest +
  synthetic Amara sign-in compatibility across start/reset, repeated reset idempotent, no-cookie
  reset mints clean. `tests/practice/api.test.ts` (+7): browser client contracts. schema_version
  assertions bumped 6→7 (catalogue/cart/checkout). Existing suites otherwise untouched and green.
- **Verification:** `npm run check` — **passed** (ESLint clean; all three TS projects clean;
  **294/294 tests**, was 287). `npm run build` — passed (JS **466.40 kB** / gzip 136.42 kB vs
  459.35/134.76 at M6; CSS **74.51 kB** / gzip 14.08 kB; no new runtime dependencies). Local D1
  migration applied (`0007`; `/api/health` reads `schemaVersion: 7`). Playwright/Chrome probe
  against the production build on port **8791**: **40/40 checks pass** — clean defaults both
  contexts, start flow, banner flip, hunt-only description-facet defect (A sees 0 results, B sees
  1, name facet works in hunt, reload persistence), cart functional in hunt + isolated from B,
  reset via banner and via panel round-trips, cart survives reset, keyboard reachability,
  both themes × 375/768/1024/1440 (zero overflow, one h1), reduced-motion render, zero unexpected
  console errors (by-design 401 guest probes filtered). Port 8791 confirmed closed.
- **Docs:** README (route table, mode-banner note, bug-hunt mode section incl. API + learner
  summary + engine guarantees, known constraints), `docs/bug-hunt-catalogue.md` (internal),
  `docs/phase-3-commerce-practice-plan.md` (M7 implemented, deviations recorded, §4/§6/§7
  reconciled), AGENTS.md state lines, PROJECT_STATE.md.
- **Known limitations / open items:** exactly one proof hunt (full 5–7 defect set is P3-M8);
  no reveal/scoring flow (Phase 4+); hunts not discoverable from the catalogue UI yet (M8 wires
  hunt→scenario links; `/practice` hard-codes the single hunt id); no rate limits on hunt
  start/reset (M9); hunt starts are not capped per IP/day (M8/M9); expired bug-hunt sessions are
  purged lazily on next contact only — no sweep (M9); `schema_version` reads 7.
- **Git:** single milestone commit `feat: implement bug-hunt engine v1` (hash in the final
  report). `main` untouched, nothing pushed, P3-M8 not started.
- **Next exact action:** STOP. Await instruction to start **P3-M8 (bug-hunt defect set & scenario
  wiring)** — do not begin without approval.

### 2026-11-15 — Phase 3 P3-M6: inventory depth and stock management

- **Branch / commit before work:** `feat/phase-3-commerce-practice` @ `fb68c78` (P3-M5), tree clean; `main` untouched; nothing pushed. All changes land in the milestone commit at the end of this turn (hash in the final report).
- **UI direction:** `ui-ux-pro-max` invoked before frontend work. The `--design-system` output (industrial slate/green palette, Fira fonts) was rejected as off-direction — the Test Bench token system is authoritative — while its applicable guidance was applied: flat design, dense dashboard, 4.5:1 contrast, visible focus, keyboard access, reduced motion, and a restock form using the same inline-error + `role="alert"` pattern as checkout/login (confirmed via `--domain ux` "focusable error summary"/"inline validation"). The staff list is a dense grid of rows with mono tabular numerals; it degrades to stacked cards ≤1024px.
- **Migration `db/migrations/0006_inventory_depth.sql` (additive only, applied locally, `schema_version` → `6`):** `inventory_adjustments` (id, product_id → products CASCADE, quantity_delta INTEGER CHECK > 0, reason CHECK IN ('restock','order_cancellation'), note NULL, actor_customer_id NULL → customers SET NULL, actor_session_id NULL → practice_sessions SET NULL, order_id NULL → orders SET NULL, created_at default now()) — immutable audit trail; indexes on product and order. `order_cancellations` (order_id PK → orders CASCADE, session_id NULL SET NULL, actor_customer_id NULL SET NULL, created_at) — the exactly-once/idempotency marker for `placed → cancelled`. No existing table altered; orders remain append-only snapshots.
- **Stock accounting decisions (documented in README.md + code comments):** NO reservations and no `inventory.reserved` — available stock is `inventory.quantity`; a cart line never holds stock; the plan's preference for conditional writes over a reservation framework was confirmed, not overridden. Inventory decrements ONLY at order placement (all-or-nothing D1 batch + `inventory.quantity >= 0` CHECK backstop + honest `422 cart_unavailable` re-read on failure), exactly once; declined payments change nothing; retries replay the idempotency record without touching stock. `placed → cancelled` restores stock exactly once: the cancelling batch INSERTs into `order_cancellations` first; a retry/concurrent cancel hits the primary key, rolls the whole batch back, and the handler replays the already-cancelled order with 200. The public order status is DERIVED at read time (`order_cancellations` LEFT JOIN) because D1 cannot alter a CHECK constraint without a table rebuild; `orders.status` therefore only ever stores `placed` (deliberate, documented deviation from the "CHECK may add cancelled" sketch — the transition exists as first-class behavior).
- **Staff restock (`PATCH /api/v1/admin/inventory/:productId`, `src/server/inventory.ts`):** adds units (never absolute set); validated positive integer 1..10,000 per adjustment; absolute ceiling 1,000,000 units per product; atomic guarded `UPDATE … WHERE quantity + ? <= 1000000` + audit INSERT guarded by `changes() = 1` in ONE batch (a rejected adjustment records nothing — `422 stock_limit_exceeded`); immutable `inventory_adjustments` row records product, delta, reason, note (optional, ≤200 chars, no control chars), acting staff customer, acting practice session, timestamp; restocks allowed on discontinued products; unknown id → 404; malformed → 400; response returns the authoritative `{ inventory, adjustment }`. Companion `GET /api/v1/admin/inventory` returns the full staff view (bounded catalogue; quantity, threshold, derived status, active flag). Client-supplied roles/customer ids/body `role` are never consulted — role comes from the stored customer row only.
- **Authorization (`src/server/staff.ts`, reusable `requireStaff`):** guest/invalid/expired/cross-practice-session cookie → 401 `unauthorized`; suspended (incl. mid-session) → 403 `account_suspended`; active customer → 403 `staff_required`; active staff → allowed. Replays a staff session bound to another practice session → 401 (same binding rule as customer protection). Customers see the honest staff-required page; guests a sign-in CTA; neither can call the admin endpoints.
- **Cancellation endpoint (`POST /api/v1/orders/:reference/cancel`):** callable by the placing practice session or (when signed in as an active account) the owning customer; unknown/foreign/unauthorised references → identical 404 `not_found`. Multi-item restores run in the same batch with per-line audit rows (`order_cancellation`). Items whose product was deleted (product_id NULL) cannot restock — by design. Confirmation pages (`/orders/:reference`, `/account/orders/:reference`) gained an inline cancel panel (request → confirm → busy/error; `role="alert"`, keyboard accessible) with the server's answer replacing the displayed order; the Callout/status tag switch to the cancelled state, and `cancelledAt` renders.
- **Frontend:** `/admin/inventory` (guest CTA / staff-required / staff manager), staff-only `Inventory` sidebar + mobile-nav entry (`staffNavItem`, icon `grid`); low-stock badge already existed (M2) and now has a staff management surface.
- **Tests:** `tests/server/inventory.test.ts` (+24): staff authz matrix (incl. body-role forgery ignored, suspended Rowan mid-session 403, cross-session replay 401), catalogue staleness after restock, restock validation matrix, cap with zero-write proof, cancel exactly-once + idempotency (stock, marker, audit rows), ownership matrix (foreign session/customer 404; owning customer from a fresh practice session 200), two-checkout race for the last unit (one 201 one 422, inventory 0, one order), CHECK-constraint rollback proof, `node:sqlite` harness gained `last_row_id` in `meta` (mirrors D1). Existing schema_version assertions bumped 5→6 in catalogue/cart/checkout tests; `checkout-views.test.tsx` OrderDetail fixture gained `cancelledAt: null`.
- **Verification:** `npm run check` — **passed** (ESLint clean; all three TS projects clean; **263/263 tests**, was 239). `npm run build` — passed (JS **459.35 kB** / gzip 134.76 kB vs 448.08/131.88 at M5; CSS **72.61 kB** / gzip 13.82 kB; no new runtime dependencies). Local D1 migration applied (`0006` — additive; pre-existing local orders remain valid, `order_cancellations` empty); schema_version reads `6` (verified via wrangler). Playwright/Chrome probe against the production build on port **8791**: **30/30 checks pass** — guest guard on `/admin/inventory`, staff sign-in + nav entry + 42 rows, restock round-trip with audit-adjustment success copy (local D1 only), inline rejection of 0 / 10,001 units, filter narrowing, both themes × 375/768/1024/1440 (zero overflow, one h1), customer-denied state with hidden nav entry, guest checkout → confirmation → cancel → refresh persistence of cancelled state, zero unexpected console errors. Port 8791 confirmed closed afterwards.
- **Docs:** README.md (admin endpoints + full inventory accounting section + staff fixture note + known constraints: no reservations, no removal adjustments, orders.status stays 'placed'), `docs/phase-3-commerce-practice-plan.md` (M6 marked implemented with as-built deviations), AGENTS.md state lines, PROJECT_STATE.md.
- **Known limitations / open items:** no rate limits (M9); no removal/negative adjustments (restock only); `order_cancellations` and `inventory_adjustments` accumulate forever and are not swept (M9); the staff list returns all rows (bounded by the ~42-row catalogue; paginate if it grows); cancellation of an order whose product was deleted restores nothing; the `changes() = 1` guarded audit insert relies on sequential statement execution on one connection (SQLite semantics; documented; verified in the node:sqlite harness which mirrors D1's batch).
- **Git:** single milestone commit `feat: implement inventory management and stock controls` (hash in the final report). `main` untouched, nothing pushed, P3-M7 not started.
- **Next exact action:** STOP. Await instruction to start **P3-M7 (bug-hunt engine v1)** — do not begin without approval.

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

## 12. Phase 3 — commerce practice application (implementation-complete, merged and deployed to production)

Phase 3 is implementation-complete and was merged to `main` (PR #4); the working branch was
`feat/phase-3-commerce-practice`. The full plan — milestone breakdown with scope/dependencies/acceptance/testing/risks,
the bug-hunt engine architecture, the API surface, scenario sketch and free-tier impact — lives in
**`docs/phase-3-commerce-practice-plan.md`**. The exit audit is **`docs/phase-3-exit-audit.md`**.
Phase 3 was merged to `main` (PR #4) and **deployed to production on 2026-11-16** (https://qa-practice-lab.pages.dev); see §11 for the deployment record.
Status summary:

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

### Bug-hunt engine (implemented in P3-M7; full catalogue in P3-M8)

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
- Reset re-stamps the live session to clean mode non-destructively (cart/orders/customer
  binding kept; hunt state removed); sessions are swept lazily on contact and by the
  maintenance sweep (M9); no admin/teacher activation UI in Phase 3. Internal catalogue
  documents Expected vs Actual, repro and fix in
  `docs/bug-hunt-catalogue.md`. P3-M8 expanded the registry to **seven hunts, one defect each**
  (see the milestone table below) and wires each hunt to a runnable scenario.
- Hunt starts are capped at 20 per IP per UTC day since P3-M8, enforced exactly since P3-M9
  (atomic guarded increments — no overshoot); only a SHA-256 of the IP is stored
  (`hunt_start_caps`, one row per address, day-old rows pruned on write and by the sweep);
  `429 hunt_start_cap_reached` + `Retry-After`; resets and idempotent same-hunt re-starts are not
  capped; local development without a visible client IP is not capped.

### Milestone status

| Milestone | Title | Status |
|---|---|---|
| P3-M1 | Commerce domain foundation (schema, seed, read-only catalogue API) | **Done & verified 2026-11-15** (this branch, `0841783`) |
| P3-M2 | Storefront catalogue UI (`/shop`, filters, detail) | **Done & verified 2026-11-15** (this branch) |
| P3-M3 | Cart (session-keyed, server-side totals) | **Done & verified 2026-11-15** (this branch) |
| P3-M4 | Checkout & orders (simulated payments, transactional D1 placement, idempotency) | **Done & verified 2026-11-15** (this branch) |
| P3-M5 | Synthetic customers & auth simulation (roles, ownership) | **Done & verified 2026-11-15** (this branch) |
| P3-M6 | Inventory depth (stock re-check in order transaction, restock, cancellation) | **Done & verified 2026-11-15** (this branch) |
| P3-M7 | Bug-hunt engine v1 (sessions, registry, one proof defect) | **Done & verified 2026-11-15** (this branch) |
| P3-M8 | Bug-hunt defect set & scenario wiring (7 defects, launch panels, `?hunt=available`) | **Done & verified 2026-11-15** (this branch) |
| P3-M9 | Hardening, reset, Phase 3 exit audit | **Done & verified 2026-11-15** (this branch) |

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

Known limitations (recorded at P3-M4; superseded where marked): customer auth/bug-hunt unimplemented at that time
(P3-M5 has since shipped; bug-hunt is P3-M7+); checkout has no
shipping/discounts/tax (total == subtotal); ~~expired sessions/carts are not swept yet~~
(closed in P3-M9 by the maintenance sweep + lazy deletion); stock checks are per-request reads + guarded writes, not a reservation system (M6 owns the
transactional depth); ~~per-request rate limits are deferred to M9~~ (closed in P3-M9); quantity cap is 99/line;
interaction-level cart testing beyond the SSR markup tests + Playwright probe is not automated
(no DOM-test runner installed yet); `practice_sessions` lacks `mode`/`hunt_id` until M7 (shipped).

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

P3-M6 detail: inventory depth on top of M1–M5 — migration `0006_inventory_depth.sql`
(`inventory_adjustments` immutable audit rows + `order_cancellations` exactly-once marker,
additive only; `schema_version` → `6`; nothing rewrites `orders.status`). Server:
`src/server/staff.ts` (`requireStaff`, shared 401/403 guard), `src/server/inventory.ts`
(`GET /api/v1/admin/inventory` staff view; `PATCH /api/v1/admin/inventory/:productId` guarded
UPDATE + `changes() = 1` audit insert in one batch), `src/server/checkout.ts` gained
`POST /api/v1/orders/:reference/cancel` (PK marker → exactly-once stock restore + audit rows;
401/403/404 policy identical to order reads) and read-time derived `status: 'cancelled'` +
`cancelledAt` on detail/history/account history. Checkout decrement unchanged: placement-time
approval, all-or-nothing batch, CHECK-guarded — a race for the last unit yields one 201 + one
422 (test-proven). NO reservation framework (documented). Frontend: `/admin/inventory` (staff
view + restock tool), staff-only nav entries, inline cancel panel on both confirmation pages.
263/263 tests green (+24); production build clean; Playwright/Chrome probe **30/30** on the
production build (port 8791). Known gaps: no rate limits (M9); restock-only adjustments (no
removal path); `order_cancellations` not swept (M9); staff list unpaginated (~42 rows).

P3-M7 detail: additive migration `db/migrations/0007_bug_hunt.sql` (`practice_sessions.mode`
CHECK clean|bug_hunt default 'clean', `hunt_id` nullable, `schema_version` → `7`); registries are
code (`src/server/hunts.ts` — one hunt `hunt-catalogue-001`; `src/server/defects.ts` — defect
`CATALOGUE-001` + `isDefectActive(c, defectId)` resolved per request from the caller's session
row; clean/expired/unknown-hunt sessions resolve to false). Endpoints
`GET /api/v1/practice/session`, `POST /api/v1/practice/hunts/:huntId/start` (no body; live session
re-stamps in place, cart/orders kept; unknown hunt → 404 `hunt_not_found`), `POST
/api/v1/practice/session/reset` (non-destructive re-stamp; cart/orders/sign-in kept). One code
site: the `q` predicate in `GET /api/v1/products` (description facet dropped for hunt sessions).
Frontend: `ModeBanner` in the app shell (role=status, Clean green / Bug-hunt amber + reset) and a
Bug-hunt mode section on `/practice` (`HuntPanel`; start/reset with loading/success/error states).
294/294 tests green (+24 server, +7 client; schema_version assertions 6→7); production build clean;
Playwright/Chrome probe **40/40** against the production build on port 8791 (two isolated contexts:
hunt-vs-clean search results, isolation, reload persistence, cart in hunt mode, reset round-trips,
themes × 375/768/1024/1440, reduced-motion). Local D1 migrated to 0007.

P3-M8 detail: additive migration `db/migrations/0008_hunt_start_caps.sql` (`hunt_start_caps`: one
SHA-256-hashed row per IP, UTC day counter, `schema_version` → `8`); hunt registry carries a
learner-safe `scenarioId` and now lists **seven hunts, one defect each** — `hunt-catalogue-001` →
`CATALOGUE-001` (description facet, shipped in M7), `hunt-catalogue-002` → `CATALOGUE-002` (category
filter dropped; clean 5 vs hunt 40 climbing), `hunt-cart-001` → `CART-001` (upsert replaces instead
of accumulating; both branches stock-guarded), `hunt-inventory-001` → `INVENTORY-001`
(`blockingProblems` boundary off-by-one; exact-stock orders 422'd), `hunt-pricing-001` →
`PRICING-001` (stored `order_items.line_total_cents` = unit price, not × quantity; summary/order
totals stay correct), `hunt-checkout-001` → `CHECKOUT-001` (`NAME_PATTERN` check skipped; other
fields enforced), `hunt-authz-001` → `AUTHZ-001` (ownership predicate dropped from the account
order-detail lookup; unknown references still 404). One code site per defect; activation resolved
per request from the caller's session row. New `GET /api/v1/practice/hunts` (learner-safe list,
`{ data: [{ id, title, summary, scenarioId }] }`, no cookie required); hunt starts softly capped
at **20/IP/UTC day** (resets and idempotent same-hunt re-starts exempt; `429 hunt_start_cap_reached`
+ `Retry-After`; hashed IP only; skipped locally when no client IP is visible). Seven scenarios
wired (three promoted/rewritten, four new): `manual-shop-search`, `api-catalogue-filters`,
`manual-cart-add-quantity`, `api-checkout-exact-stock`, `manual-cart-totals`,
`manual-address-edge-cases`, `security-object-access` — all `ready`/`runnable`, bidirectional
`huntId ↔ scenarioId` verified by `tests/data/content.test.ts`. Scenario pages carry a
`HuntLaunchPanel` (start/reset in place); `/practice` lists all seven hunts (`HuntPanel` rebuilt to
the registry, start/switch/reset, links to the wired scenarios) with a local markdown bug-report
export (`BugReportExport`, browser-only download, no server storage/scoring). Catalogue: wired
cards show a **Bug-hunt exercise** badge, `/scenarios?hunt=available` deep-links the seven, status
filter includes `Ready`, the `PracticeSessionResponse.hunt` now carries optional `scenarioId`.
Content: `tests/data/content.test.ts` rewritten for the two-tier catalogue rule (unwired stay
non-runnable; wired must be ready/bug-hunt/resolvable in the registry). Tests: `hunt-set.test.ts`
(+28: per-defect both branches, envelope shapes, two-learner-different-hunts isolation, reset
restores clean for every defect, forged client input ignored for every hunt, per-IP cap
behaviour incl. idempotent-restart exemption, day rollover, no-IP skip; schema_version assertions
bumped 7→8); `tests/practice/api.test.ts` (+3), `tests/lib/catalog.test.ts` (+3 hunt filter).
**329/329 tests green** (was 294). `npm run build` clean (JS **477.54 kB** / gzip 139.01 kB vs
466.40/136.42 at M7; CSS **76.55 kB** / gzip 14.36 kB; no new runtime dependencies). Browser probe
(Playwright/Chrome vs production build, port 8791): **60/60 checks pass** — two isolated contexts:
all seven defects verified defective-in-hunt/clean-outside, reset restores per defect, catalogue
discovery (7 wired cards, badge, `?hunt=available`, `Ready` filter), scenario launch panel and
banner flips, themes × 375/768/1024/1440 (zero overflow, one h1), reduced-motion, Tab reachability,
bug-report markdown download, zero unexpected console errors. Local D1 migrated to 0008.

Next recommended milestone: **none — Phase 3 is implementation-complete and exit-audited**
(`docs/phase-3-exit-audit.md`). Deployment (Cloudflare) and merging to `main` are user
decisions; Phase 4 requires explicit instruction.

## 13. Resume prompt

Paste this into the next OpenCode/ChatGPT session after placing this file at the repository root:

> Read `PROJECT_STATE.md` and `AGENTS.md` first. Inspect the repository and reconcile the files with actual code and tests. Phase 2 is complete and the redesign is approved and **complete (M1–M8)**. Phase 3 (commerce app) is **implementation-complete, merged into `main` via PR #4, and deployed to production on 2026-11-16 at https://qa-practice-lab.pages.dev** (Cloudflare Pages project `qa-practice-lab`, D1 `qa-practice-lab-db`, `schema_version` 9; merged commit `1f0847f`). The P3-M1 … P3-M9 milestones are done and verified: P3-M1 (domain foundation), P3-M2 (storefront catalogue UI), P3-M3 (session-keyed shopping cart), P3-M4 (checkout & orders — atomic D1 placement, simulated payments, idempotency), P3-M5 (synthetic customers & auth simulation), P3-M6 (inventory depth — staff restock, exactly-once cancellation), P3-M7 (bug-hunt engine v1), P3-M8 (seven deterministic defects, scenario wiring, hunt-start cap) and P3-M9 (hardening, reset & Phase 3 exit audit — rate limits, bounded cleanup sweeps, local demo reset, `docs/phase-3-exit-audit.md`). Phase 4 **has** started: **P4-M1 WP1 (scenario curriculum enrichment) is implemented, reviewed, verified and committed as the branch baseline (`feat: complete phase 4 curriculum foundation`, see §11). P4-M1 WP2 (migration `db/migrations/0010_hunt_attempts.sql` — `schema_version` → 10, `src/server/attempts.ts` + `src/server/reports.ts`, `practice.ts` attempt creation, `report:<iphash>` 30/min scoped limit) is implemented, reviewed, verified and committed on the branch (`feat: add phase 4 attempt and report persistence`, see §11). P4-M1 WP3 (the deterministic §6.4 bug-report evaluator — `src/server/reportQuality.ts`, synchronous scoring in the POST report path, persisted score/feedback, running-max `best_quality_score`, sticky `discovered`) is implemented, reviewed, verified and committed on the branch (`feat: evaluate phase 4 bug reports`, see §11). P4-M2 WP1 (progressive hints & gated solution reveal backend — `src/server/hints.ts` + `src/server/reveals.ts` server-only registries, `src/server/learning.ts` routes: `POST …/hints` with server-enforced ladder via `hint_mask`, `GET …/reveal` gated 403 `reveal_locked` until `submitted`/`revealed`, `POST …/reveal` explicit confirmed give-up that never awards discovery) and P4-M2 WP2 (the structured bug-report UI — labelled form on both wired hunt panels, inline validation + focus-managed linked error summary, server-side submission with duplicate-in-flight guard, deterministic evaluation result view, and a markdown download generated from the submitted report) and P4-M2 WP3 (the hint ladder — sequential disclosures with server-persisted progression — the WAI-modal give-up confirm dialog and gated reveal panel, and the attempt-status chips on hunt cards; report submission unlocks the reveal in-place) are implemented, reviewed, verified and committed on the branch (`feat: add phase 4 hint and reveal backend`, `feat: add structured bug report evaluation UI`, `feat: add phase 4 hint and reveal UI`, see §11)**. The implementation branch `feat/phase-4-learning-intelligence` is **local-only — nothing has been pushed, merged or deployed**. Production D1 remains `schema_version` 9 — migration 0010 is applied only to the local D1. Read `docs/phase-4-learning-intelligence-plan.md` before acting; **P4-M2 is complete** and **P4-M3 WP1 (Progress API, attempt history & aggregate scoring + the real `/progress`) is implemented, verified and committed on the branch as `feat: add phase 4 progress dashboard`** and **P4-M3 WP2 (scoring transparency & recommended completion path) is implemented, verified and committed on the branch as `feat: add phase 4 learning transparency`**. The remaining work is the explicit maintainer release decision — **P4-M3 WP3 (Phase 4 exit audit & release) is complete**; see `docs/phase-4-exit-audit.md` (Phase 4 is implementation-complete and NOT DEPLOYED). Do not push, merge, PR or deploy anything without explicit maintainer instruction. The deployment (D1 create + remote migrations + Pages project + deploy) is recorded in §11; the recommended maintenance sweep cadence is documented there. Keep the app compatible with Cloudflare Pages + Pages Functions/Workers + D1 free tiers. Do not expose shared D1 to arbitrary user SQL, do not accept arbitrary external performance-test targets, and do not execute user code server-side. After every meaningful work turn, update `PROJECT_STATE.md` immediately with files changed, decisions, verification run, blockers, and the next exact action. Provide the updated file in the same turn.

## 14. Phase 4 — Learning & Bug-Hunt Intelligence (P4-M1 WP1 + WP2 + WP3 + P4-M2 WP1 + WP2 + WP3 + P4-M3 WP1 + WP2 + WP3 implemented, verified & committed; P4-M1 complete; P4-M2 complete; **P4-M3 complete — Phase 4 implementation-complete, release-ready, NOT DEPLOYED**)

Status as of 2026-11-16: **the Phase 4 plan exists — `docs/phase-4-learning-intelligence-plan.md` —
and P4-M1 WP1 (scenario curriculum enrichment) is implemented, reviewed, verified and committed as
the branch baseline (`feat: complete phase 4 curriculum foundation`, `5210ebb`, 2026-11-16 —
it succeeds `30d34241ba39424a4356c58eec8f566aa0ddb3d5`) — WP1: 358 tests green. **P4-M1 WP2 is
implemented, reviewed, verified and committed on the branch** (`feat: add phase 4 attempt and
report persistence`, `968d144`, 2026-11-16 — the
WP2 implementation review/commit details are in §11): migration
`db/migrations/0010_hunt_attempts.sql` (`schema_version` → 10), `src/server/attempts.ts` +
`src/server/reports.ts` (+ `src/shared/learning.ts`), hunt-start attempt creation (idempotent),
`report:<iphash>` 30/min scoped limit — **393 tests green**, `npm run check` clean, production
build passes, local D1 on schema 10. **P4-M1 WP3 is implemented, reviewed, verified and committed
on the branch** (`feat: evaluate phase 4 bug reports`, 2026-11-16 — exact hash via `git log`; review
details in §11): `src/server/reportQuality.ts` (pure deterministic §6.4 evaluator, 53 unit tests),
synchronous evaluation inside the POST report path in the same all-or-nothing D1 batch —
`quality_score`/`feedback` persisted, `best_quality_score` running maximum in SQL, `discovered`
sticky in SQL — **459 tests green**, `npm run check` clean, production build passes, **no
migration** (0010 carries the columns; `schema_version` stays 10), local D1 verified on schema 10.
Nothing has been pushed, merged or deployed; production D1 remains `schema_version` 9 — migration
0010 is applied only to the local D1.**
P4-M3 WP1 was implemented, verified and committed on the branch on 2026-11-16 (see the WP1 entry below and §11); P4-M3 WP2 followed on the same day (see the WP2 entry below and §11); **P4-M3 WP3 (Phase 4 exit audit & release) is complete (2026-11-16) — `docs/phase-4-exit-audit.md` records the audit; Phase 4 is implementation-complete and release-ready but NOT DEPLOYED**. See §11 and the audit document.

**2026-11-16 — milestone consolidation (planning only):** Phase 4 was consolidated from eight
milestones (P4-M1…P4-M8) to **exactly three** (P4-M1 → P4-M2 → P4-M3). This was a restructuring,
not a scope reduction — every original feature, requirement, security rule, acceptance criterion
and intended outcome was mapped into one of the three and nothing was removed. The consolidation
map lives in the plan (§6.1).

### Plan contents (what was decided)

- **Re-scope:** Phase 4 is now Learning & Bug-Hunt Intelligence. The former Phase 4 placeholder
  ("API & identity lab") is deferred, not cancelled; the suggested renumbering (API & identity lab
  → Phase 5) needs maintainer confirmation — the §9 roadmap table intentionally keeps old
  numbering until then.
- **Milestones (exactly three):** **P4-M1 — Learning Foundation, Attempts & Evaluation**
  (combines original P4-M1 scenario curriculum enrichment · original P4-M2 attempts & bug-report
  persistence — additive migration `0010_hunt_attempts.sql`: `hunt_attempts` + `bug_reports`,
  `schema_version` → 10 · original P4-M3 deterministic report evaluator — 100-point transparent
  rubric, no AI) · **P4-M2 — Complete Bug-Hunt Learning Experience** (combines original P4-M4
  progressive hints — 3-level ladder, `hint_mask` idempotent — + gated reveal, locked until
  submitted or an explicit confirmed give-up · original P4-M5 structured bug-report form /
  evaluation feedback UI · original P4-M6 hint/reveal UI + attempt status) · **P4-M3 — Progress,
  Scoring & Phase 4 Release** (combines original P4-M7 real `/progress` aggregate endpoint ·
  original P4-M8 scoring transparency + recommended completion path + Phase 4 exit audit —
  `docs/phase-4-exit-audit.md`).
- **Ordering:** strictly P4-M1 → P4-M2 → P4-M3; each milestone is independently reviewable and
  testable and organizes its work into internal work packages (WP1→WP3, not additional
  milestones). Old minimum viable Phase 4 (P4-M1…P4-M6) maps to P4-M1 + P4-M2; full scope
  (P4-M1…P4-M8) maps to P4-M1 + P4-M2 + P4-M3.
- **Key decisions:** completion = submitted report; "discovered" = sticky finding-check pass;
  best score kept; free resubmission; hints disclosed, never subtracted; no speed/streaks/
  cross-learner comparison; guest progress stays session-scoped-ephemeral (synthetic auth has no
  cross-session identity); attempts/reports cascade with the practice session (orders precedent);
  reveal content lives in a compiled server registry and is served only after unlock; no defect
  ids in any client payload; report submissions carry a scoped `report:<iphash>` 30/min limit.
- **Deferred (plan §12):** AI-assisted feedback (never a runtime dependency), real accounts /
  cross-device progress, cohorts/leaderboards, expanded defect library, enforced learning paths,
  report-triage simulation.
- **Planning decisions — all resolved on 2026-11-16 (plan §14):** (1) finding-check term groups
  are curated, server-side, normalized and synonym-tolerant; never exposed before reveal
  authorization; unrelated keywords cannot award `finding`/`discovered`; (2) severity is exactly
  **Critical|High|Medium|Low** (impact-based); (3) priority is separate: **P1 — Urgent · P2 — High
  · P3 — Normal · P4 — Low**; severity ≠ priority, never cross-derived; (4) guest progress is
  temporary, tied to the anonymous practice session, expires with it, never transfers to a
  signed-in account; (5) deployment keeps the manual Cloudflare workflow — no new products/cron/
  queue/paid services; verification + rollback documented in plan §7.5 and §13 release criteria;
  Phase 4 is not deployed during implementation. **Roadmap renumbering explicitly not approved** —
  Phases 5–10 keep their numbering; the API & Identity Lab stays deferred.
- **Implementation branch:** `feat/phase-4-learning-intelligence` (created 2026-11-16 from
  `main` @ `30d34241ba39424a4356c58eec8f566aa0ddb3d5` with the uncommitted planning docs carried
  over; WP1 + planning docs committed on it as the branch baseline, and WP2 reviewed/reconciled
  and committed on 2026-11-16 — see §11). Nothing has been pushed, merged or deployed.

**2026-11-16 — P4-M2 WP2 implemented on the branch (see §11):** the structured
bug-report experience renders on both wired hunt panels (`/practice` `HuntPanel` and the
scenario-detail `HuntLaunchPanel`) while a hunt is active for the browser session —
`src/features/practice/BugReportForm.tsx` (labelled fields, explicit
`(required)`/`(optional)` markers, blur inline validation, in-flight duplicate guard,
text preserved on failure), `ReportErrorSummary.tsx` (focus-targeted linked summary;
entries name their field), `ReportEvaluationView.tsx` (the server §6.4 evaluation
verbatim — score, verdict band, ten-check checklist, report-quality vs.
finding-the-defect explainer) and `src/lib/reportForm.ts` (pure validation,
framework-free submission controller with injected transport, markdown download builder,
leak-safe escaping and filename). `BugReportExport.tsx` was removed. Server APIs
unchanged; no migration. 546/546 tests green; browser probe 32/32 (both themes ×
375/768/1024/1440, download verified, failure preserves text, zero console errors).
**Committed on the branch** (`feat: add structured bug report evaluation UI`, exact
hash via `git log`; see §11). Nothing pushed, merged, PR'd or deployed.

**2026-11-16 — P4-M1 WP1 implemented on the branch (see §11):** new shared module
`src/shared/huntCurriculum.ts` (learner-safe per-hunt curriculum: `skillArea`, `difficulty`,
`conceptsPracticed`, `expectedOutcomes`, `investigationFocus`, `reportFocus`); `HuntSummary` gains
optional `curriculum` (additive; served by `GET /api/v1/practice/hunts`, `POST .../start`,
`GET /api/v1/practice/session`); the seven wired scenarios carry the curriculum via
`src/data/scenarios.ts` / `Scenario.curriculum`; scenario detail renders new sections;
`/practice` gains the static "Recommended path"; `recommendedHuntScenarioIds` exported; tests
extended (+14; 358 green). **Deviation from the plan's "WP1: zero API change" wording — deliberate,
per the WP1 task instruction; additive and compatible.** Difficulty mirrored, no defect ids or
evaluator internals in any payload or curriculum string (asserted by test).

**2026-11-16 — P4-M1 WP2 implemented on the branch (see §11):** migration
`db/migrations/0010_hunt_attempts.sql` (additive; `schema_version` → 10; `hunt_attempts` +
`bug_reports`; partial unique index enforcing one live attempt per (session, hunt));
`src/server/attempts.ts` (lifecycle, `ensureLiveAttempt`, idempotent hunt-start creation,
`GET …/attempt`, `GET /practice/attempts` bounded ≤50); `src/server/reports.ts` (validated
`POST …/report`; enum/length/control-character checks; guest vs signed-in `customer_id` stamp at
submit; report insert + attempt stamp in one all-or-nothing D1 batch); `report:<iphash>` 30/min
scoped limit in `rateLimit.ts` applied before body parsing; maintenance sweep unchanged
(attempts cascade with the session); **+35 tests (393 green)**, `npm run check` clean,
`npm run build` passes, local D1 verified on schema 10. WP2 stores placeholder
`quality_score=0`/empty feedback — **WP3 replaces the placeholder with the real evaluator in the
same request path.** **Update (review turn, same day): WP2 was reviewed, reconciled and
committed as `feat: add phase 4 attempt and report persistence`; it was never merged, pushed or
deployed.**

**2026-11-16 — P4-M1 WP3 implemented on the branch (see §11):** `src/server/reportQuality.ts`
(the pure deterministic §6.4 evaluator: ten checks / 100 points, verdict bands
≥80 `solid` · 50–79 `needs-work` · <50 `incomplete`, no AI/network/clock/randomness/hint
penalties; curated per-hunt finding-check term groups matched after one shared normalization
pipeline with token boundaries and synonym tolerance; finding evidence confined to title + steps +
expected + actual); wired synchronously into `POST …/report` in the same all-or-nothing D1 batch —
persisted `quality_score`/`feedback`, `hunt_attempts.best_quality_score` as running maximum in
SQL, sticky `discovered` in SQL, revealed attempts stay revealed; client-supplied evaluator fields
ignored; `201 { attempt, report, evaluation }`. Unit suite `tests/server/report-quality.test.ts`
(**53 tests**), `tests/server/attempts.test.ts` extended with a WP3 integration block
(**48 tests**; total **459 green**); `npm run check` clean; `npm run build` passes; client bundle
verified to contain zero defect ids and zero evaluator internals; **no migration** — the WP2
placeholders (`quality_score=0`, empty feedback) are **removed**. **Update (this turn): WP3
reviewed, reconciled and committed as `feat: evaluate phase 4 bug reports`; never merged, pushed
or deployed.**

**2026-11-16 — P4-M2 WP1 implemented on the branch (see §11):** two server-only compiled
registries — `src/server/hints.ts` (`HINTS`, exactly seven runnable hunts × three levels:
Orient → Focus → Narrow; investigation guidance, never the fault; no defect ids, internal
titles, SQL or code identifiers) and `src/server/reveals.ts` (`REVEALS`, seven hunts;
learner-safe `expected`/`actual`/`rootCause`/`reproduction`/`verification`/`concepts`/
`commonMisconceptions`; behaviour-level prose only) — plus `src/server/learning.ts`
(routes mounted under `/v1`): `POST …/hints` (strict `{level:1|2|3}`; server-enforced
ladder ordering through the attempt's `hint_mask` — level N requires N−1, `409
hint_level_locked` otherwise; re-requests idempotent; single guarded atomic bit-set;
attempt-scoped, session-owned, masks never readable across sessions; hints never unlock
the reveal), `GET …/reveal` (`200` with `{ huntId, title, expected, actual, rootCause,
reproduction[], verification[], concepts[], commonMisconceptions[], attempt }` only when
the attempt is `submitted`/`revealed`; otherwise `403 reveal_locked`; no attempt minted
by the read), `POST …/reveal` (explicit confirmed give-up; `{ confirm: true }` required;
atomic `in_progress → revealed` with first-`revealed_at` preserved; submitted attempts
stay submitted; discovery untouched; idempotent). **No migration** — 0010's `hint_mask`,
`status='revealed'`, `revealed_at` carry WP1 unchanged. Report submission unlocks reveal
through the existing atomic batch transition (no report-endpoint changes; the report
response still carries no reveal content). **33 new tests** (`tests/server/hints-reveal.test.ts`);
**492 green** overall; `npm run check` clean; `npm run build` passes; client bundle verified
to contain zero hint/reveal strings. **Update (this turn): P4-M2 WP1 reviewed, reconciled
and committed as `feat: add phase 4 hint and reveal backend`; never merged, pushed or
deployed.** Nothing in WP1 renders; WP2 (report form) and WP3 (hint/reveal UI) are next, in a
fresh session, only on explicit maintainer instruction.

**2026-11-16 — P4-M2 WP3 implemented on the branch (see §11):** the learner-facing hint, reveal
and attempt-status surfaces on both wired hunt panels — `src/components/ui/Modal.tsx` (the
project's first shared accessible dialog primitive: `role="dialog"`, `aria-modal`, labelledby/
describedby wiring, focus moved in on open and trapped, Escape/backdrop cancel, focus restored
to the trigger), `src/features/practice/HintLadder.tsx` (three ordered `aria-expanded`/
`aria-controls` disclosures; sequential unlock via the server's `hint_mask`; previously unlocked
hints re-fetched on mount so refresh/session continuation restores the ladder; live
"N of 3 hints used" counter; single-flight duplicate guard; locked levels disabled and content-
free; learner-safe error mapping, no invented retry durations), `src/features/practice/
RevealPanel.tsx` (403 `reveal_locked` → zero-content locked callout; "Show the solution" opens a
WAI-modal confirm — cancel makes no request, confirm POSTs `{confirm:true}` in a single-flight
guarded path; revealed view distinguishes "give-up" from "report submitted" framing, never
awards discovery, and is never modified by report resubmission), `src/features/practice/
AttemptStatusChip.tsx` (card chips from the server attempt view: Not started / In progress /
Submitted · score / Solution viewed; discovery never inferred) — backed by pure
`src/lib/hintReveal.ts` + `src/lib/attemptStatus.ts` (WP2's `reportForm.ts` pattern) and new
typed clients (`fetchAttempt`, `requestHint`, `fetchReveal`, `giveUpAndReveal`). **One real bug
found and fixed during verification:** report submission did not unlock the reveal in-place (the
panel only fetched on mount) — fixed by `BugReportForm.onSubmitted` → a nonce both panels pass to
`RevealPanel` as `refreshToken`; verified in the browser probe. Both panels are keyed by hunt id,
and the duplicated "Found something?" note was deduped. **78 new tests** (`tests/lib/
hint-reveal.test.ts` incl. the client-source leak lint, `tests/lib/attempt-status.test.ts`,
`tests/practice/hint-reveal-ui.test.tsx`, API client extensions); **624/624 green**; `npm run
check` clean; `npm run build` passes; client bundle verified free of hint/reveal strings.
**Browser probe (Chrome over CDP) against the rebuilt production build: 68/68 checks pass** —
incl. server-enforced ladder skip (`409`), cancel-with-zero-requests assertion, refresh-restored
hints and reveal, give-up vs report-submission reveal framing, chips on `/practice` cards,
both themes × 4 widths with zero overflow, zero console errors. **Update (this turn): P4-M2 WP3
reviewed, reconciled and committed as `feat: add phase 4 hint and reveal UI`; never merged, pushed
or deployed. P4-M2 is complete.**

**2026-11-16 — P4-M3 WP1 implemented on the branch (see §11):** the progress aggregate endpoint `GET /api/v1/practice/progress` (`src/server/progress.ts`; owner-scoped to the caller's session rows plus, when signed in, the active customer binding's rows — `OR` on one table, so no double count and no cross-customer path; `persistence: session|customer`; per-wired-hunt entries in registry order with latest-attempt status, sticky discovery, best score, summed hints, attempt count and last-submitted timestamp; `recent` ≤ 10 newest submissions with score + verdict mapped from the persisted score through the §6.4 bands via the new `verdictForScore` helper; totals with pure status buckets (attempts = inProgress + submitted + revealed), `reports`, `discovered` (DISTINCT hunts; **revealed-status attempts confer no discovery** — a give-up-first attempt stays revealed even when a report is filed after it, while submit-then-reveal keeps its credit), `hintsUsed`, `bestScore` and integer `averageBestScore` over scored attempts only; empty payload when no live session; no ids, no evaluator internals, no defect ids — asserted by test) and the rewritten `/progress` page (loading/error/empty/populated states; guest-durability vs signed-in-attribution banners chosen from the server's `persistence` field; six stat tiles; discovery `ProgressBar`; the seven hunts as link rows with attempt-status chips + discovery tags; recent submissions with verdict tags; refresh + remount-refetch; all sample/demo markup removed). `src/lib/progressDates.ts` (pure timestamp formatters); `src/lib/attemptStatus.ts` and `src/lib/reportForm.ts` reused for chips and verdict tags (no duplicated logic). **662/662 tests green** (+38: `tests/server/progress.test.ts` 22 — ownership, isolation, attribution, customer deletion, idempotent starts/unlocks, bounded history, payload-marker leak lint, pure-aggregator units — and `tests/pages/progress-page.test.tsx` 16 SSR markup tests); `npm run check` clean; `npm run build` passes; client bundle clean of identifiers; **no migration**; production untouched. Browser probe on the rebuilt production build: empty → hunt start → report (score 100, discovered) → populated state; guest and signed-in banners verified; matrix 375/768/1024/1440 × light/dark with zero overflow and one h1; screenshots inspected both themes. **Committed on the branch as `feat: add phase 4 progress dashboard`; never merged, pushed or deployed.**

**2026-11-16 — P4-M3 WP2 implemented on the branch (see §11):** scoring transparency & the recommended completion path. **Canonical evaluation transparency** lives at `/about#evaluation` — a new shared learner-safe module `src/shared/evaluationRubric.ts` (the ten §6.4 checks with actual weights totalling 100, learner-friendly summaries, and the three verdict bands ≥80 `solid` · 50–79 `needs-work` · <50 `incomplete`) is the single source of truth: the server evaluator re-exports it as `RUBRIC_CHECKS`, and the new `src/features/evaluation/EvaluationTransparency.tsx` renders it for learners (checks, total, verdict bands, the explicit "a high report score does not automatically mean the defect was found" statement, behavioural — never term-level — explanation of discovery, hints/reveal honesty, synthetic-environment note). Wired scenario pages carry a "How your report is evaluated" block linking to `/about#evaluation`. **Recommended path** on `/practice`: the old static list upgraded — `getRecommendedPath()` derives the seven wired hunts in approved order from the existing curriculum registry (positions 1–7, difficulty, `skillArea`, "You will be able to:" from `expectedOutcomes[0]`, "Concepts practised: …" from `conceptsPracticed`); completion state comes from `GET /api/v1/practice/progress` via a shared `useProgress()` hook (extracted from the WP1 `ProgressPage`; route-remount refetch, retry/refresh, abort on unmount) and renders chips: Not started / In progress / Solution viewed / Completed (+ `Discovered` tag only when the sticky discovery flag is set, + `Best {score}` when scored). **Completion definition (documented interpretation): a hunt is completed when at least one bug report has been submitted against it — `lastSubmittedAt !== null` in the WP1 payload** ("Completion = a submitted report", sticky, score-independent, never reveal-conferred; discovery is separate and never inferred). Progress failure keeps the path usable — statuses hidden (never guessed) behind a `role="alert"` note with a "Try again" retry; loading shows a non-blocking `role="status"` note. `/about` gained the "How long your progress lasts" durability section (guest: anonymous, session-bound, seven-day TTL, never transferred; signed-in: attribution to the synthetic training customer at submission time, guest rows stay session-bound, no merge/migration, fictional demo accounts) and the "Learning and evaluation" section, and its outdated "exercises unimplemented / sample data / health check only" claims were corrected. `src/lib/recommendedPath.ts` (pure) and `useProgress` reuse the WP1 contracts; **no endpoints added, no scoring/evaluator/lifecycle/discovery behaviour changed, no migration** (`schema_version` stays 10; production untouched). **720/720 tests green** (+58); `npm run check` clean; `npm run build` passes; client bundle clean; **browser probe 32/32** (both themes × 375/768/1024/1440 across `/about`, `/practice`, `/scenarios/manual-cart-add-quantity`, `/progress` — zero overflow, one h1, valid heading hierarchy, focus-visible ring on Tab, zero console errors; element screenshots inspected both themes); `/about#evaluation` hash-scroll verified. **Committed on the branch as `feat: add phase 4 learning transparency`; never merged, pushed or deployed.**

### Exact next action

Phase 4 is implementation-complete and release-ready but **NOT DEPLOYED** (2026-11-16 — the exit audit `docs/phase-4-exit-audit.md` grades all nine plan §13 exit criteria PASS; see §11 and that document). The only remaining action is the **explicit maintainer release decision**: if releasing — `npm run check && npm run build`, apply migration `0010_hunt_attempts.sql` to the production D1 via the established remote-migration procedure (`schema_version` → 10), then `npx wrangler pages deploy dist`, then run and record the §8 post-deploy verification from `docs/phase-4-exit-audit.md` (health `schemaVersion: "10"`; start→hint→report→evaluate→reveal→/progress smoke; both themes; no pre-unlock defect ids). If not releasing yet — the branch remains the deliverable and nothing is pushed, merged or deployed. Do not push, merge, PR or deploy anything without explicit maintainer instruction.
