# Final Development Phase — Performance, Security & Microservices/Distributed Testing Lab

**Status:** Approved for implementation (maintainer mission document, 2026-11-17). One milestone/session; this
plan and the implementation belong to a single final phase. No Phase 8+, no automation/portfolio/analytics/AI phases.
Branch: `feat/performance-security-distributed-testing-lab` (from `main` @ `8258b7e`).

## 1. Goals & non-goals

Three integrated testing capabilities, built on the existing learning/evaluation architecture:

1. **Performance Testing** — `/performance`: bounded *measured* browser-side load runner against an allowlist of
   first-party endpoints + scored exercises + bug hunts with server-enforced latency defects.
2. **Security Testing** — `/security`: synthetic, isolated vulnerability demonstrations + scored exercises +
   bug hunts with server-enforced defects. No real targets, no arbitrary scanning, no payload execution.
3. **Microservices & Event-Driven Testing** — `/microservices`: D1-backed, deterministic, session-scoped
   event-processing *simulation* (publish → consume → retry → DLQ → replay → webhook delivery) + scored exercises
   + bug hunts with server-enforced defects.

**Non-goals:** no Durable Objects / Queues / external brokers / paid infra; no arbitrary URLs; no learner code
execution; no chart/icon dependencies; no separate progress/evaluation system; production NOT deployed, migrated,
or re-pointed by this milestone (a separate, explicitly approved release step).

## 2. Constraints (carried from the mission + AGENTS.md)

- Cloudflare Pages/Workers/D1 free tier. Existing architecture unchanged. Migration 0014 is additive-only.
- Pages Functions CPU/wall limits respected: event processing is bounded (≤ 10 events/batch), no sleeps in
  hot paths, backoff expressed as short `available_at` delays (base 1s, ×2, cap 8s) with `available_at` gating
  so `process` calls never block.
- Rate limits + 32 KB body cap + scoped buckets for new mutating endpoints.
- Session isolation everywhere: all new rows key off `practice_sessions.id` with `ON DELETE CASCADE`;
  defects activate only in `bug_hunt` sessions (existing `isDefectActive`).
- Honest labels everywhere: measured vs modeled vs synthetic; local-only storage labelled local-only;
  simulation is labelled as a simulation, not a production broker.
- AI is not a runtime dependency. No new npm dependencies.

## 3. Architecture & data flow

### 3.1 Shared control plane (reused verbatim)

Attempts, hints, reveals, bug reports, progress and hunt/scenario wiring reuse the Phase 4 system unchanged:
`attemptTargets.ts` (extended with the new ids) → `hunt_attempts` (existing table, no DDL) → hints (`hints.ts`
gains nothing; new registry consulted by `learning.ts`) → reveals → `bug_reports` + `ProgressDashboard`.

### 3.2 New module map

| Area | Client-safe data | Server (compiled-in) | Feature UI | Page(s) |
|---|---|---|---|---|
| Shared labs | `src/data/labTypes.ts` (LabExerciseDef) | `src/server/labExercises.ts` (answer keys), `src/server/labs.ts` (POST `/api/v1/labs/evaluate`), `src/server/labLearning.ts` (hints+reveals for all three labs) | `src/features/labs/LabExerciseWorkspace.tsx` | 3 thin wrappers |
| Performance | `src/data/performanceExercises.ts` | + PERF defects (`catalogue.ts`, `cart.ts`) | `src/features/performance/` (`LoadRunner.tsx`, `api.ts`), `src/lib/performanceRunner.ts`, `src/lib/performanceMetrics.ts` | `PerformanceHubPage`, `PerformanceWorkspacePage`, `PerformanceExercisePage` |
| Security | `src/data/securityExercises.ts` | + SEC defects (`auth.ts` meHandler, `auth.ts` login peek, `checkout.ts`) | `src/features/security/SecurityDemos.tsx` | `SecurityHubPage`, `SecurityDemosPage`, `SecurityExercisePage` |
| Microservices | `src/data/eventExercises.ts` | `src/server/microservices.ts` (event engine + routes), `microHints`/`microReveals` inside `labLearning.ts` | `src/features/microservices/SimulatorConsole.tsx`, `api.ts` | `MicroservicesHubPage`, `MicroservicesSimulatorPage`, `MicroservicesExercisePage` |

Migration `db/migrations/0014_final_phase_lab.sql` (schema_version 13→14) creates:

- `events(id TEXT PK, practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL, seq INTEGER NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','processed','failed','dead')), attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL, available_at TEXT NOT NULL, last_error TEXT, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL)` + indexes on `(practice_session_id, status, available_at)` and `(practice_session_id, correlation_id, seq)`.
- `service_state(practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  service TEXT NOT NULL, state_key TEXT NOT NULL, state_value TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (practice_session_id, service, state_key))`
- `webhook_deliveries(id TEXT PK, practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, target TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','delivered','failed','dead')), attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3, http_status INTEGER, last_error TEXT, created_at, updated_at)`
  + index on `(practice_session_id, status)`.

`0001..0013` untouched. `npm run db:migrate:local` applies locally; production requires a separate approved step.

### 3.3 Microservices event engine (deterministic, session-scoped)

Event types (allowlist): `order.created`, `inventory.reserved`, `payment.processed`, `webhook.deliver`.
Payloads are **synthesized server-side from structured publish controls** (type, drill, quantity, totalCents) —
never free-form learner JSON, never executed, only stored and interpreted by compiled-in handlers:

- `order.created` → inventory service: if `drill = inventory-short` the synthetic stock (25/SKU) cannot cover
  qty 999 → reservation fails, order marked `inventory_failed`, emits `notification`-side outcome via state only.
  Otherwise `inventory_reservations` / per-SKU `reserved` counts increment (deduped on event id) and emits
  `inventory.reserved` (seq+1) with same correlation id.
- `inventory.reserved` → payment service: charge `totalCents`. `drill = payment-decline` (or totalCents > 250_000)
  → deterministic non-retryable `card_declined` (1 attempt, status `failed`). `drill = payment-transient` → fails
  attempts 1–2 (`gateway_timeout`), succeeds on attempt 3 (exponential backoff 1s→2s→4s). `drill = payment-always-fails`
  → always `gateway_timeout`; after `max_attempts` 3 → status `dead` (DLQ). Success → `payments_captured` increments
  (deduped), order marked `paid`, emits `webhook.deliver` (seq+1).
- `webhook.deliver` → simulated delivery to the single allowlisted synthetic target
  `https://hooks.meridian-practice.test/storefront`. `drill = webhook-timeout` → attempts 1–2 time out
  (`http_status` NULL, error `webhook_timeout`), attempt 3 delivered (200) — demonstrates at-least-once with
  retry; a duplicate delivery is logged and counted (`webhook_duplicates`, receiver deduped by correlation+seq).
  `drill = webhook-always-fail` → 3 timeouts → delivery `dead` + event `dead`.
  Default → single delivery, http 200. No network fetch is ever performed.
- `poison` drill on `order.created` → handler rejects immediately (missing/oversized content marker),
  status `dead` without retry (poison message).
- `inventory-delay` drill → the emitted `inventory.reserved` carries `available_at = now + 5s`
  (eventual consistency window; UI shows "waiting — due in Ns").

**Retry/backoff:** `available_at = now + min(1000 × 2^attempts, 8000)` ms; `process` only handles events due now.
**Idempotency:** handlers dedupe on `event.id` via `service_state` key `dedup:<eventId>`; a redelivery is a
no-op (`duplicate: true` in the processing log) unless defect `EVT-001` is active (hunt-event-001), in which
case payment applies twice. **Ordering:** consumers track `applied_seq:<correlationId>`; applying seq ≤ last
applied → `out_of_order_skipped` processed-no-op. Defect `EVT-003` (hunt-event-003) applies unprepared
`payment.processed` messages (no reservation) instead of rejecting them. Defect `EVT-002` (hunt-event-002)
collapses backoff to 0 ms (retry-storm smell; still capped by `max_attempts`). **Replay:** dead/failed events
re-queueable via retry (single) or replay (all dead, ≤ 10), available_at = now, attempts preserved. **Reset:**
deletes caller session's events/webhooks/service_state. **Consistency:** `GET /microservices/consistency`
reports violations (paid orders without reservations; charged ≠ order total; captured ≠ paid count).
**Trace:** `GET /microservices/trace/:correlationId` returns the ordered event + webhook timeline.

Processing is bounded: ≤ 10 events/batch; publish 20/min/IP; `labs-eval` 30/min/IP; retry/replay/reset under
global 120/min mutate backstop. `payload_json` ≤ 512 B. Nothing here is a production-grade broker — labelled as
a deterministic simulation throughout.

### 3.4 Performance runner (measured, client-side, allowlisted)

`src/lib/performanceRunner.ts` (no deps): allowlist of same-origin GET endpoints only
(`/api/health`, `/api/v1/products`, `/api/v1/products?perPage=4`, `/api/v1/categories`, `/api/v1/cart`,
`/api/v1/auth/me`? — `/api/v1/auth/me` requires auth and adds variance; keep public catalogue endpoints +
`/api/health`). Caps: VUs ≤ 8, duration ≤ 30 s, ramp-up ≤ 10 s, ≤ 150 requests/run, 5 s per-request timeout
(AbortController), token-bucket RPS guard (1–100, default 50). VU loops start staggered across ramp-up; loop
until deadline. Every request duration is measured in the browser with `performance.now()`.

`src/lib/performanceMetrics.ts` (pure): totals, success/fail, error rate, avg, median, nearest-rank p90/p95/p99
(shown only when n ≥ 20 — below that rendered as "n/a — sample too small"), throughput (req/s over the actual
elapsed window), timeouts, status-class distribution. No fabricated numbers; all values derived from samples.
Report: Markdown download (config, metrics, status distribution, timestamp, "measured in-browser, same-origin,
bounded" footer). History: last 5 runs in `localStorage` (`qa-practice-lab-perf-runs`), labelled
"this browser only", clearable. Exercises carry synthetic example datasets, labelled as such.

### 3.5 Security isolation model

Defects activate only in `bug_hunt` sessions via `isDefectActive`. No real third-party targets; the API Lab
remains same-origin-only. SQLi/XSS/CSRF taught via (a) scored exercises, (b) non-executable demos page
(payloads rendered inert inside `<iframe sandbox="">` — scripts cannot run; SQL demo is a client-side
string-building preview, never executed against any database; CSRF demo is a static token walkthrough).
No real credential collection: demo sign-in already uses fictional accounts. Reports reuse the structured
bug-report flow (severity is a required controlled field; scoring never keyword-matches).

### 3.6 New hunts (9) and defect sites (9)

| Hunt | Defect | Kind | Site | Beginner→Advanced |
|---|---|---|---|---|
| hunt-perf-001 | PERF-001 slow catalogue list (+350 ms) | ui | `catalogue.ts` GET /products | beginner |
| hunt-perf-002 | PERF-002 un-indexed deep pagination (+600 ms when page > 3) | ui | `catalogue.ts` GET /products | intermediate |
| hunt-perf-003 | PERF-003 N+1 list rendering (sequential per-product work, +120 ms each) | ui | `catalogue.ts` GET /products | advanced |
| hunt-sec-001 | SEC-001 excessive profile exposure (`internalNotes` added) | ui | `auth.ts` meHandler/toCustomerProfile path | intermediate |
| hunt-sec-002 | SEC-002 login failure cap not enforced (peek skipped) | ui | `auth.ts` login/token peek branch | intermediate |
| hunt-sec-003 | SEC-003 verbose internal detail in error responses | ui | `checkout.ts` 422 cart_unavailable adds `debug` | advanced |
| hunt-event-001 | EVT-001 payment handler ignores idempotency | event | `microservices.ts` payment handler | intermediate |
| hunt-event-002 | EVT-002 backoff collapsed to 0 ms | event | `microservices.ts` backoff computation | advanced |
| hunt-event-003 | EVT-003 unprepared payment applied (out-of-order) | event | `microservices.ts` payment ordering guard | advanced |

`HUNTS` 25 → 34; `DEFECTS` 16 → 25; `kind` union gains `'event'`. `hunt-set.test.ts` updated accordingly.
`HUNT_CURRICULUM` gains 9 learner-safe entries; `scenarios.ts` gains 9 wired `ready`/`runnable` bug-hunt
scenarios; `content.test.ts` enforces the bidirectional wiring.

### 3.7 New exercises (36; 12 per lab = 4 beginner / 4 intermediate / 4 advanced)

All scored by the shared selection rubric (recall 70% + precision 30%, pass ≥ 70) reused from
`contractRubrics.scoreSelections`. Ids ≤ 32 chars: `perf-*` (beginner ×4, intermediate ×4, advanced ×4),
`sec-*`, `evt-*`. Client-safe defs in `src/data/{performance,security,event}Exercises.ts`; server answer keys in
`src/server/labExercises.ts`; unknown ids → 404; out-of-checklist selection ids → 400; attempt stamping identical
to the contract evaluate path (`resolveAttemptForSubmission` + `submissionStatements`).

Breakdown:
- **Performance (12):** baseline vs load vs stress vs spike; ramp-up reasoning; throughput vs latency; percentile
  interpretation; bottleneck triage from a percentile table; saturation signs; caching impact; pagination cost;
  N+1 detection from traces; capacity planning from a synthetic dataset; reading an error budget.
- **Security (12):** authn weakness classes; BOLA/IDOR; privilege escalation; session lifecycle & revocation;
  SQLi parameterization; output encoding vs XSS (inert demo); CSRF token checks; security headers triage;
  sensitive data exposure; rate limiting/brute-force; OWASP API Top-10 triage; safe testing rules of engagement.
- **Microservices (12):** delivery guarantees; idempotent consumers; retries & backoff; DLQ triage; out-of-order
  handling; duplicate delivery; eventual consistency; correlation ids & tracing; webhook semantics (timeout,
  retry, duplicate); poison messages; transactional outbox concept; consistency audit interpretation.

Each exercise ships: prompt/task/QA scenario, objective, chips, checklist options, example evidence, related
guide(s), 3 progressive hints, a gated reveal (expected/actual/rootCause/reproduction/verification/concepts/
misconceptions/solution-ish text for exercises) — registered in `labLearning.ts`, wired into `learning.ts`.

### 3.8 Guides, tracks, navigation, integration

- Three new guides: `guide-performance-testing`, `guide-security-testing`, `guide-event-driven-testing`
  (tracks `performance-testing`, `security-testing`, `async-testing` already exist; guides must satisfy the
  content tests: trackId/level/readingMinutes/concepts/relatedScenarioIds valid).
- Navigation: three new sidebar entries after Contract Testing (Performance `/performance`, Security `/security`,
  Microservices `/microservices`) with existing IconNames (`performance`, `security`, `microservices`).
- Progress: three new sections on `/progress` (prefix filters `perf-`/`hunt-perf-`, `sec-`/`hunt-sec-`,
  `evt-`/`hunt-event-`).
- Practice/recommended path: no new curated path edits required (hunt scenarios are automatically recommended-
  eligible via `recommendedPath.ts` if it enumerates HUNTS — verified during implementation; counts asserted by
  `content.test.ts` stay green).

### 3.9 API surface (9 new operations; OpenAPI 1.2.0 → 1.3.0; 42 → 51 operations)

1. `POST /api/v1/labs/evaluate` — scored lab exercise evaluation (session required; `labs-eval` 30/min; 404 unknown exercise; 400 invalid answer; ≥70 passes and stamps the attempt).
2. `GET /api/v1/microservices/overview` — session-scoped counts (events by status, DLQ, webhook stats), per-service state projection. Empty payload when no session.
3. `POST /api/v1/microservices/publish` — publish a synthesized event (`type` allowlist, `drill` allowlist, `quantity` 1–999, `totalCents` 0–2_000_000); `events-publish` 20/min.
4. `POST /api/v1/microservices/process` — process ≤ 10 due events; returns per-event outcomes + waiting count.
5. `POST /api/v1/microservices/events/{id}/retry` — re-queue one failed/dead event; 409 when pending/processed.
6. `POST /api/v1/microservices/events/replay` — re-queue all dead events (≤ 10). Returns replayed count.
7. `POST /api/v1/microservices/reset` — delete caller session simulation state.
8. `GET /api/v1/microservices/trace/{correlationId}` — ordered event + webhook timeline (404 when unknown).
9. `GET /api/v1/microservices/consistency` — deterministic violation report for the caller's session.

All mutating routes respect the global 32 KB body cap and the 120/min mutate backstop. No new error codes;
`labs-eval` reuses `invalid_request`, `session_required`, `hunt_not_found` (as `exercise_not_found`? — reuse
`hunt_not_found` vocabulary to avoid expanding ErrorCode enum, or add one new code `exercise_not_found` and bump
the ErrorCode vocabulary test accordingly — decision: reuse `hunt_not_found` for unknown lab exercise ids is
misleading; add `exercise_not_found` and update the 27→28 ErrorCode vocabulary in `openapi.json` + tests).
Decision recorded: add `exercise_not_found` (28 codes).

### 3.10 Frontend routes (lazy; existing design system; no new deps)

`/performance` (hub + terminology + metrics explainer + catalogues + reports info),
`/performance/workspace` (runner + history + report download),
`/performance/exercises/:exerciseId`,
`/security` (hub + severity model + catalogues),
`/security/demos` (inert SQLi/XSS/CSRF demonstrations),
`/security/exercises/:exerciseId`,
`/microservices` (hub + topology + guarantees catalogue),
`/microservices/simulator` (publish / process / DLQ / trace / consistency / reset),
`/microservices/exercises/:exerciseId`.

`LabExerciseWorkspace` (shared): qaScenario/objective/task/chips/checklist/evaluate/result/attempt-chip/HintLadder/
RevealPanel — the same honest pattern as contract exercises. Accessibility, both themes, 375–1440 px, and
`prefers-reduced-motion` preserved. No placeholder controls — every visible control works.

## 4. Security boundaries (summary)

Defects only in `bug_hunt` sessions; event/webhook targets are synthetic and never fetched; perf runner is
same-origin allowlist with hard caps; no arbitrary URLs anywhere; no learner code/SQL executed; security demos
render payloads inside sandboxed iframes without scripts; no real credentials/accounts; no PII; AI not required.

## 5. Test strategy

Focused during development: `migration-0014` (fresh + upgrade through 13, row preservation), `labs-evaluate`
(auth/404/400/pass/fail/attempt stamping/rate cap), `microservices` (publish→process pipeline, transient retry
with backoff assertion via injected clock, always-fails → DLQ, poison → immediate dead, idempotency duplicate
no-op + EVT-001 defect branch, out-of-order skip + EVT-003 branch, redeliver, replay, reset, consistency
violations, trace, session isolation), `lab-exercises` data matrix, hunt-flow regression (`hints-reveal`),
existing `content`/`openapi`/`hunt-set` updated. Consolidated `npm run check` + `npm run build` at the end.
Browser acceptance: HTTP smoke via `wrangler pages dev` + CDP browser pass when Chrome is available.
Migration fresh-install + upgrade tests mandatory. No claim of browser PASS without actually running it.

## 6. Acceptance criteria (final checklist)

### Performance
- [ ] Workload controls render and are enforced (VUs ≤8, duration ≤30s, ramp ≤10s, ≤150 req, 1–100 rps)
- [ ] Allowlist enforced — no arbitrary URLs reachable from the runner
- [ ] Runner measures (avg/median/p90/p95/p99 gated on n≥20, throughput, timeouts, status classes)
- [ ] Report downloads; history is local-only and labelled
- [ ] Exercise catalogue 12 (4/4/4); hunts reproduce deterministically; clean mode unaffected
### Security
- [ ] All advertised scenarios/demos work; hunts deterministic and session-isolated
- [ ] No answer leakage (hints/reveals gated); reports with severity; clean mode safe
### Microservices
- [ ] Publish/process; retry with backoff; duplicate delivery; idempotency; DLQ; replay; trace; consistency
- [ ] Webhook timeout→retry→duplicate delivery observable; session isolation; reset works
### Platform
- [ ] Phase 3–7 surfaces unchanged and green; `npm run check` green; build clean
- [ ] Light/dark × 375/768/1024/1440 px; no console errors; reduced-motion OK
### Release discipline
- [ ] Feature branch only; no push/PR/merge/deploy/migration without explicit approval

## 7. Known limitations

- The load runner measures the browser→Pages/D1 path only; it is not a load-generation service. Percentiles below
  n=20 are shown as unavailable. Soak/endurance is capped at 30 s (labelled "soak-lite").
- Webhook "delivery" is simulated (no network); HTTP status codes are scripted, not observed.
- Event processing is learner-triggered (no background cron on Pages free tier); backoff is observable across
  process calls, not wall-clock real-time at scale.
- The three labs share the session model: signed-out browsers lose event/attempt state after 7 days like everything else.
- Firefox/WebKit untested (Chrome over CDP only, as prior phases).

## 8. Release handoff (out of scope without approval)

Merge (PR), production D1 migration 0014 (pre-migration export first), Pages deploy, production acceptance,
PROJECT_STATE release entry. Phase 7 production remains authoritative until an approved release.

## 9. As-built addendum (2026-11-17, implementation session)

- **Operations:** 53 (not 51) — `POST /api/v1/microservices/events/{id}/redeliver` added during
  browser acceptance so learners can force at-least-once duplicate delivery of any non-pending
  event (status-gated 409 for pending). `retry` stays failed/dead-only.
- **Mint-on-first-use:** `publish` and `process` mint a clean guest session on demand
  (hunt-start semantics); reads never mint; retry/redeliver/replay/reset require an existing
  session. Found in browser acceptance (first-time browsers got a 401 wall).
- **Shared hub/workspace components:** `LabHub`, `LabExerciseWorkspace`, `LabProgressSection`
  are shared across the three labs; hub progress rings consume the same server-side attempt
  record as `/progress` (no separate tracking).
- **Performance honesty:** p50/p90/p95/p99 nearest-rank; tail percentiles print `n/a` below
  n = 20; all report values measured in-browser against the allowlist; run history is
  localStorage-only, labelled "this browser only".
- **Event semantics verified by 22 server tests** (full pipeline, backoff gating, DLQ →
  replay, poison, idempotency, out-of-order, webhook timeout→retry→deliver→duplicate, EVT-001/2/3
  hunt containment, reset, session isolation) plus a browser end-to-end pass.
- **Verification:** `npm run check` green (1473/1473, 74 files); `npm run build` clean
  (entry 448.33 kB / gzip 137.54 kB); migration fresh+upgrade tests (`migration-0014.test.ts`);
  browser acceptance green (40/40 render matrix; pipeline end-to-end; 100/100 exercise pass via
  UI; PERF-001 containment ~40→~400 ms→~40 ms; both themes; mobile nav; zero console errors).
- **Not released:** no push/PR/merge/deploy/production migration. Local D1 only for 0014.
