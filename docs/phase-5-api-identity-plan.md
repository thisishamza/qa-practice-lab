# Phase 5 — API & Identity Testing Lab — Implementation Plan

> **Status (2026-11-16):** **P5-M1 MERGED to `main` via PR #6 (merge commit `05f4870`). P5-M2 MERGED to `main` via PR #7 (merge commit `f7bf1c3`, 2026-11-16; NOT deployed; local `schema_version` 11; production D1 untouched at 10) — see PROJECT_STATE.md §11 and the P5-M2 outcome below. P5-M3 not started (no implementation without explicit instruction).** Previously: **Approved for implementation.** The maintainer approved this
> plan on 2026-11-16 and resolved the §14 decisions: synthetic practice API tokens ship in
> P5-M2; the expired-token signal is a distinct `401 token_expired`; token mint returns
> `201 Created`; API Reference and API Lab are **separate navigation entries**; schema
> validation stays guide-only this phase; the two new catalogue scenarios are approved;
> exactly three implementation milestones; **no deployment as part of implementation** —
> deployment/merge/push/production D1 migration remain separate, explicitly approved
> release steps, matching the Phase 3/4 release discipline.
>
> **Execution model: exactly three milestones (P5-M1 → P5-M2 → P5-M3), one complete
> milestone per focused OpenCode session.** Milestones are not split into separately
> executed WP1/WP2/WP3 sessions; the recommended implementation orders in §6 are ordered
> checklists *inside* each milestone. See §6 for the mandatory session workflow. No
> deployment, merge, push or production D1 migration happens without explicit maintainer
> approval.
>
> **Baseline this plan was written against (verified 2026-11-16):** `main` @ `369c00d`
> ("docs: record phase 4 production release"), working tree clean, production live at
> https://qa-practice-lab.pages.dev, production D1 `schema_version` 10, Phase 4 fully
> released (PR #5, merge `ac53fd0`). Plan approved 2026-11-16; implementation starts in a
> fresh session on a new feature branch (see §6). Companion documents: `PROJECT_STATE.md` (§1, §9, §11,
> §14), `README.md` (API reference), `docs/bug-hunt-catalogue.md`,
> `docs/phase-4-learning-intelligence-plan.md` (§12 suggested placement of this lab),
> `docs/phase-3-commerce-practice-plan.md` (hunt engine design).

## 1. Phase overview and objectives

Phase 4 made the bug-hunt engine a complete learning loop. What the platform still lacks is
a **first-class API testing learning surface**: the REST endpoints, the OpenAPI contract,
and the synthetic identity system all exist and are real, but a learner has nowhere to
*explore them deliberately* — no in-app API console, no API reference, no exercises that
target status codes, headers, pagination, authentication and authorization through HTTP
requests instead of clicks.

**Phase 5 turns the existing Meridian Outfitters API into a guided practice target.** A
learner should be able to:

1. Read a machine-checkable description of the `/api/v1` contract and use it to predict
   behaviour (methods, paths, query params, bodies, headers, status codes, error envelopes).
2. Issue real, safe, same-origin HTTP requests from inside the lab (an in-browser API
   console) without installing any tooling — and export curl equivalents for use in a
   terminal.
3. Sign in, mint a short-lived practice API token, present it as a Bearer credential,
   observe token lifecycle behaviour (issuance, use, expiry, revocation on logout), and
   reason about 401 vs 403 vs 404.
4. Investigate deterministic, server-controlled API and identity defects (token replay
   after logout, role-boundary gaps, mass assignment) through the existing bug-hunt engine —
   same hints, same report form, same deterministic evaluation, same progress tracking.
5. Recognize and check the API's documented invariants: pagination, filtering, sorting,
   idempotency, rate limiting, error envelopes, ownership concealment.

**Product-principle alignment:** practice over reading (every section leads to a runnable
request), one coherent domain (the existing commerce app is the target, never a toy), safe
by default (synthetic accounts only, same-origin allowlist, no external scanning), AI is
optional (everything deterministic), free-tier aware (no new products, no cron, no queues,
no new dependencies unless a milestone explicitly justifies one).

### 1.1 What this phase is not

- Not a general-purpose HTTP client that can reach arbitrary hosts (SSRF risk). The console
  is hard-wired to same-origin `/api/v1`.
- Not an identity provider. No registration, password reset, MFA, OAuth/OIDC, real JWT
  signing infrastructure, or third-party IdP integration.
- Not a fuzzer, scanner or exploit kit. Bounded, non-destructive exercises against
  first-party endpoints only.
- Not a contract-testing or automation-examples phase — those remain Phase 7/8 (or 8/9 if
  the maintainer approves renumbering; see §12).

## 2. Current-state architecture assessment (verified 2026-11-16)

### 2.1 What exists and works today

**Backend (Hono on Pages Functions, `src/server/app.ts`, basePath `/api`):**

- `GET /api/health` — infrastructure probe; reads `app_meta.schema_version`.
- Catalogue (`catalogue.ts`): `GET /api/v1/products` (page, perPage 1–48 capped, category,
  sort, `q`; LIKE wildcards literal), `GET /api/v1/products/:slug`, `GET /api/v1/categories`.
- Cart (`cart.ts`): `GET/DELETE /api/v1/cart`, `POST /api/v1/cart/items`,
  `PATCH/DELETE /api/v1/cart/items/:id` — session-scoped, server-recomputed totals.
- Checkout & orders (`checkout.ts`): `GET/POST /api/v1/checkout`,
  `GET /api/v1/orders`, `GET /api/v1/orders/:reference`,
  `POST /api/v1/orders/:reference/cancel` — atomic placement, idempotency-key replay,
  `placed → cancelled` via append-only event table.
- Synthetic identity (`auth.ts`, `customer.ts`, `session.ts`, `staff.ts`):
  `GET /api/v1/auth/accounts`, `POST /api/v1/auth/login` (PBKDF2-HMAC-SHA256, 100k iter,
  dummy-hash timing equalization, 5-failures/IP/min → 429), `POST /api/v1/auth/logout`
  (idempotent), `GET /api/v1/auth/me`, `GET /api/v1/account`,
  `GET /api/v1/account/orders` (+`/:reference`), `GET /api/v1/admin/inventory`,
  `PATCH /api/v1/admin/inventory/:productId` (staff-only, exactly-once guarded writes).
  Roles: `customer | staff`. Statuses: `active | suspended` (suspended fixture:
  `dana.reyes@example.com`). Staff fixture: `rowan.ellison@example.com`.
- Two-cookie model: `mpl_session` (anonymous practice session, 7-day TTL, SHA-256-hashed,
  owns cart/orders/hunt binding) and `mpl_customer` (simulated customer session, 8h TTL,
  SHA-256-hashed, bound to the establishing practice session — cross-practice-session
  replay is rejected by construction).
- Fixed-window rate limiting (`rateLimit.ts`): `mutate:<iphash>` 120/min global backstop,
  `login:<iphash>` 5 failures/min, `checkout:<iphash>` 30/min, `report:<iphash>` 30/min.
  `cf-connecting-ip` only; `x-forwarded-for` never trusted; local dev with no visible IP is
  uncapped. Abuse control, not a security boundary.
- Bug-hunt engine (`defects.ts`, `hunts.ts`, `practice.ts`, `attempts.ts`, `reports.ts`,
  `reportQuality.ts`, `hints.ts`, `reveals.ts`, `learning.ts`, `progress.ts`): seven
  deterministic defects, per-request server-resolved activation from the caller's own
  session row, hunt-start cap 20/IP/UTC day, structured bug reports evaluated by the
  deterministic §6.4 rule-based rubric (no AI), three-level hint ladder, gated reveals,
  sticky discovery, session/customer-scoped progress aggregate at `/progress`.
- Maintenance sweep (`maintenance.ts`): staff-only, operator-invoked, bounded idempotent
  deletions of expired sessions/attempts/reports/buckets.

**Frontend:** React 19 + TS + Vite, hand-written CSS design tokens, routes in
`src/app/App.tsx` (`/`, `/tracks`, `/scenarios`, `/guides`, `/practice`, `/progress`,
`/shop`, `/cart`, `/checkout`, `/account*`, `/admin/inventory`, 404). Existing hunt UI:
`HuntLaunchPanel`, `BugReportForm`, `ReportEvaluationView`, `HintLadder`, `RevealPanel`,
`AttemptStatusChip`, `/practice`, `/scenarios?hunt=available`.

**Content:** twelve tracks (`api-testing`, `api-automation`, `auth-testing` among them),
guides `guide-api-request-response` and `guide-auth-session-testing`, catalogue scenarios
including placeholders this phase can wire: `api-catalog-pagination`,
`api-order-idempotency`, `api-automation-schema-suite`, `api-automation-token-refresh`,
`auth-session-expiry`, `auth-role-boundaries`, `security-object-access` (wired ✔,
`hunt-authz-001`), `security-search-input`.

**Data isolation rule (unchanged):** no generic SQL console; D1 is never exposed; learner
SQL playground (if ever built) is a separate WASM sandbox (Phase 6).

### 2.2 Gaps Phase 5 must close

1. **No API reference or OpenAPI contract exists.** Nothing describes `/api/v1`
   machine-checkably; `contracts/openapi` is listed in PROJECT_STATE §10 as intentionally
   not created. Learners cannot "read the contract, then challenge it" yet.
2. **No in-app API exercise harness.** Learners must install curl/Postman to do API
   exercises; nothing in-app can issue a raw request and show the raw response.
3. **No token-based authentication story.** Only cookie sessions exist. "Bearer token,
   expiry, revocation, replay" — core API-identity curriculum — is unrepresentable today.
4. **No API/identity defect coverage in the hunt set.** Seven defects span catalogue,
   cart, checkout, pricing, and one object-level authz case. Token revocation, role-boundary
   and mass-assignment defects do not exist.
5. **Auth exercises are unwired placeholders.** `auth-session-expiry`, `auth-role-boundaries`,
   `api-catalog-pagination` are `runnable: false` / non-ready with nothing to do in-app.
6. **Error-envelope / status-code curriculum has no runnable surface.** The documented
   `{error, message}` contract is taught nowhere interactive.

### 2.3 Constraints carried forward

- React + TS + Vite; Pages Functions + Hono; D1; existing design tokens, themes, nav; hand-written CSS, no new CSS framework, no Tailwind, no shadcn; no icon package (project has none — do not add one casually).
- No paid infrastructure, no new Cloudflare products (no cron, queues, KV, Durable Objects, Workers), no external services, no new secrets, no external IdP, no real payment anything.
- Synthetic users/data only; no real credentials; production auth is never weakened for exercise convenience. Intentional vulnerabilities are isolated, deterministic, server-controlled (code-registry defects, one branch site each, static — consistent with the bug-hunt engine rules).
- Clean Mode remains correct; Bug-Hunt Mode never leaks defect ids/content pre-unlock; ids never appear in API responses, DOM, logs, or the client bundle.
- Free-tier ceilings (PROJECT_STATE §7, verified 2026-11-14 — re-verify before launch): Workers/Pages request quotas, D1 5M reads / 100k writes per day, 50 queries per invocation, 500 MB per database. Phase 5 adds negligible read/write volume (a few KB of reference material, one token row per mint, three hunts).
- Pages has no cron; the maintenance sweep stays operator-invoked; Phase 5 must extend it (bounded) to purge expired API tokens if they are added.
- Testing conventions: Vitest in Node, `tests/helpers/fake-d1.ts` harness applying real migrations, SSR markup tests for views, stubbed-fetch client tests, `npm run check` before claiming verified.
- One complete milestone per focused session (§6 session workflow); deploy only with explicit maintainer approval; production D1 migrations only during an approved release step; implementation sessions never deploy.

## 3. Scope and non-goals

### 3.1 In scope (Phase 5)

- Hand-authored OpenAPI 3.x description of `/api/v1`, stored in the repo, served statically
  (`public/openapi.json`) with a learner-facing **API reference page** in-app.
- An in-browser **API Console** (`/api-lab`): method/path/query/headers/body entry,
  same-origin `/api/v1` allowlist enforced client-side (UX guard on top of the browser's
  same-origin model), response viewer (status, timing, headers, pretty body), copy-as-curl.
  Cookies flow automatically; an optional Bearer field is added in P5-M2.
- **Synthetic practice API tokens** (approved 2026-11-16 — see §5-C and §14): short-lived,
  opaque, SHA-256-hashed-at-rest Bearer credentials minted by `POST /api/v1/auth/token`
  for the synthetic demo accounts only; resolved alongside the existing cookie guard; revoked
  on logout; expired rows purged by the maintenance sweep. No JWT infrastructure.
- **Three new deterministic hunts** (reusing the Phase 3/4 engine unchanged in semantics):
  token replay after logout (`AUTHN-001`), staff-role boundary on the admin inventory read
  (`RBAC-001`), checkout mass assignment of `totalCents` (`MASS-001`). Each with curriculum,
  3-level hints, gated reveal, §6.4 evaluation compatibility, catalogue wiring.
- **Exercise wiring:** flip `api-catalog-pagination` to ready (clean exercise); flip
  `auth-session-expiry` to ready (clean; token lifecycle journey); flip `auth-role-boundaries`
  to a wired hunt (`hunt-rbac-001`); add two new wired scenarios (`api-token-replay`,
  `api-mass-assignment`); optionally deepen `api-order-idempotency` content stays deferred.
- **Guide updates:** `guide-api-request-response` and `guide-auth-session-testing` gain
  console-based walkthroughs; any new guide needed for the contract (decide in M1; prefer
  extending existing guides over adding new ones).
- Docs: this plan, README (as-built, only after implementation), PROJECT_STATE, Phase 5
  exit audit (P5-M3).

### 3.2 Non-goals (Phase 5)

- No real OAuth 2.0 / OIDC / SAML / JWT signing, no refresh-token rotation machinery, no
  MFA, no registration or password reset, no email anything.
- No general-purpose external API scanning, fuzzing, or exploit tooling; no arbitrary
  target URLs anywhere (including the console).
- No new roles beyond `customer|staff`; no permission matrices, no ABAC, no tenants.
- No GraphQL, no WebSockets, no server-sent events surface, no file uploads.
- No schema-validation engine shipped in-app (schema validation is guide-only this phase — approved, §14).
- No contract-testing tooling (Phase 7), no automation collections/Playwright examples
  (Phase 8), no performance runner (Phase 9), no security scanning (never).
- No AI anywhere in the loop; scoring/evaluation stay deterministic.
- No change to the bug-hunt engine's activation model, session binding, cap, or reset semantics.
- No weakening of any production control to make an exercise easier (in particular: the
  login rate limiter, hunt-start cap, ownership concealment 404s, and practice-session
  binding are all preserved).
- Migration 0011 (token feature, approved 2026-11-16) ships in P5-M2. If implementation shows it is genuinely blocked, P5-M2 ships cookie-only identity exercises and the `AUTHN-001` hunt is replaced or the milestone checkpoints and reports — it is never silently dropped or partially claimed. Production application happens only during an approved release step.

## 4. Learner journeys

### 4.1 API fundamentals journey (P5-M1)

1. Learner opens `/api-reference`: grouped endpoint list (catalogue, cart, checkout, orders,
   auth, account, admin, practice), each with method, path, parameters, request/response
   examples, error envelopes, and rate-limit notes. A download button fetches
   `/openapi.json`.
2. Learner opens `/api-lab`, selects `GET`, path `/api/v1/products`, adds
   `perPage=3&sort=price_asc`, sends. Sees `200`, headers, elapsed ms, pretty-printed body
   with `total`, `totalPages`. Toggles `?page=0`, `?perPage=999`, `?sort=bogus`,
   `?category=bogus`, observing documented capping and empty-set behaviour.
3. Invalid body on `POST /api/v1/cart/items` → `400`/`404`/`422` envelopes observed and
   explained by the linked guide (`guide-api-request-response` §error envelopes).
4. Learner attempts the wired scenario `api-catalog-pagination` (ready, clean mode) using
   the console; evidence captured for the report flow (or just guide completion).
5. Copy-as-curl exports the exact request for the learner's terminal.

Anti-patterns to avoid: console telemetry, persisted request history, prefilled tokens,
any button that sends anything the learner did not compose.

### 4.2 Identity journey (P5-M2)

1. Learner signs in at `/login` (existing flow) — or stays a guest for guest-scoped APIs.
2. In the console, "Mint a practice API token" (signed-in only) calls
   `POST /api/v1/auth/token`; the raw token is shown **once**, stored only in component
   memory, and offered as a toggleable `Authorization: Bearer …` header. The console warns
   it dies with the page refresh.
3. Learner calls `GET /api/v1/account` with the header → `200`. Learner calls it with a
   tampered last character → `401`. Without credentials → `401`. After logout → `401`
   (clean mode).
4. Expiry exercise (`auth-session-expiry`, ready): mint with a clamped short
   `expiresInSeconds` (e.g. 60), observe `401 token_expired` (approved — §14) after the window, and the documented
   "no renewal exists; mint again" semantics. A guide section explains *why* short-lived
   tokens + refresh tokens exist in real systems, and why this lab deliberately does not
   simulate refresh rotation.
5. Wrong-credential and suspended-account paths: `401 invalid_credentials` (identical
   envelope, timing-equalized), `403 account_suspended` for Dana as a guest-side check.
   Login 5-failures/IP/minute → `429 login_rate_limited` — an honest, documented exercise in
   observing abuse controls (stop after observing it once; do not weaponize it).

### 4.3 API bug-hunt journeys (P5-M2) — three new hunts

All three reuse start/reset/attempt/hint/report/reveal/progress unchanged. Hunt starts for
these mint/activate attempts through the same `POST /api/v1/practice/hunts/:huntId/start`
path (20/IP/UTC-day cap applies to all hunts including these).

**`hunt-authn-001` (`AUTHN-001`) — token replay after logout.**
Signed in and token-minted, the learner starts the hunt, calls `POST /api/v1/auth/logout`,
then replays the captured Bearer token against `/api/v1/account`. Clean mode: `401
unauthorized` (logout deleted the token row). Hunt mode: `200` — the presented credential
still resolves. Learning objective: logout must revoke server-side; client-side cookie
clearing is not revocation. Report maps to the §6.4 rubric; reveal explains expected vs
actual, verification by re-replaying after reset.

**`hunt-rbac-001` (`RBAC-001`) — staff-only inventory read open to customer role.**
Signed in as Amara (customer), start the hunt, `GET /api/v1/admin/inventory`. Clean: `403
staff_required`. Hunt: `200` with the full inventory payload. `PATCH` restock remains
`403` in both modes (deliberate partial-enforcement gap — the classic per-route RBAC miss;
zero shared-data mutation in hunt mode because the defective branch is read-only). Scenario
`auth-role-boundaries` (updated copy from "seller tools" to the inventory/staff surface) is
wired to this hunt.

**`hunt-mass-001` (`MASS-001`) — checkout honours client-supplied `totalCents`.**
The checkout contract states the client sends only customer details and `paymentSimulation`;
figures are server-computed. In hunt mode, `POST /api/v1/checkout` with
`"totalCents": 1` stores that figure on the order; the confirmation page and
`GET /api/v1/orders/:reference` disagree with the cart/checkout summary and with the sum of
line totals. (Implemented for non-negative safe integers only — see the P5-M2 outcome note
(a): the `total_cents >= 0` CHECK is preserved.) Clean mode: the field is ignored. Orders are session-scoped and cascade-delete
with the session, so no shared state is corrupted and nothing persists beyond the learner's
7-day session TTL. Scenario `api-mass-assignment` (new) is wired to this hunt.

Each hunt gets: registry entry (`hunts.ts`, learner-safe summary), defect definition
(`defects.ts`, internal expected/actual/repro/fix), `docs/bug-hunt-catalogue.md` entry,
curriculum entry (`src/shared/huntCurriculum.ts`), three hints + gated reveal
(`hints.ts`/`reveals.ts`), scenario wiring both directions (`src/data/scenarios.ts`
`runnable: true, huntId`), and the standard both-branch server tests.

### 4.4 Report and progress journey

Unchanged from Phase 4: report form on the hunt panels, deterministic §6.4 evaluation,
best-score running max, sticky discovery, reveal after submit/give-up, `/progress` shows
the new hunts. Discovery for these hunts follows solely from the finding check — never from
the score, never from the reveal.

### 4.5 Anti-patterns the journeys must avoid

- A console that accepts absolute URLs (SSRF) or non-`/api/v1` paths — rejected at input.
- A token persisted to `localStorage`/`sessionStorage`/cookies by the app — component state
  only, gone on refresh and stated as such in the UI.
- Any hunt defect that mutates shared rows (catalogue, inventory, other customers' orders) —
  explicitly rejected for RBAC-001 (PATCH stays enforced) and MASS-001 (session-scoped
  orders only).
- Rate-limit-abuse hunts (per-IP buckets are shared behind NAT/classroom IPs) — rejected;
  the login 429 budget is taught as observation-only content.
- A "reveal" of expected behaviour on `/api-reference` for hunt-active surfaces — the
  reference documents the *contract* (expected behaviour), never which sessions carry
  which defect; docs never name defect ids.

## 5. Capability breakdown (A–E)

### A. OpenAPI contract & API reference (P5-M1)

Hand-author `public/openapi.json` (OpenAPI 3.1.x, JSON — no YAML parser dependency):
`info`, `servers` (same-origin relative), tags (catalogue, cart, checkout, orders, auth,
account, admin, practice), paths for **every** existing `/api/v1` route with parameters,
request bodies, response schemas, and the documented error envelope
(`{ error, message }` with per-endpoint enum values), plus security schemes
(`cookieAuth` mpl_session/mpl_customer, `bearerAuth` added in P5-M2) and rate-limit headers
where relevant (`Retry-After`). Accuracy is enforced by a test that: JSON-parses the file,
asserts a curated list of required paths exists, asserts no `defect`, `AUTHN-001`,
`RBAC-001`, `MASS-001` strings appear anywhere (leak lint), and asserts the documented
error-code enum matches `src/server` constants where they exist.

The **API reference page** (`/api-reference`) renders the same content as readable sections
(hand-written React, styled with existing tokens; grouped, each endpoint collapsible or
just stacked; request/response example blocks in JetBrains Mono). Not Swagger-UI — no new
dependency, full design-system control, and guaranteed no external CDN. A download button
fetches `/openapi.json`.

### B. In-browser API Console (`/api-lab`) (P5-M1/M2)

Component: method `<select>` (GET/POST/PATCH/DELETE), path `<input>` validated against
`^/api/v1(/|$)` (client-side; the network boundary is the browser's same-origin policy, so
this is UX, not security), query builder (raw query-string input is sufficient and most
honest for an API learning tool — no magic key/value grid), headers key/value rows with a
`Content-Type: application/json` helper and the Bearer toggle (M2), body `<textarea>` with a
pretty-print button. Send → `fetch(path, …)` → response panel: status line, elapsed time
(`performance.now()`), headers table, body pretty-printed when JSON (raw otherwise),
copy-body and copy-as-curl buttons. Request history: last 10 in component state, clear
button, explicitly not persisted (copy in empty state says so). Guard rails: response body
rendered as text only (no `dangerouslySetInnerHTML` anywhere), byte cap on displayed body
(e.g. 64 KB — clip with a notice), `no-store` honoured.

Entry points (approved 2026-11-16, §14): the sidebar gets **two separate navigation entries**
— **API Lab** (`/api-lab`) and **API Reference** (`/api-reference`) — not one merged entry.
`/practice` stays hunts-focused; the console links from the reference page and from wired
scenario pages ("Open in API Lab").

### C. Synthetic practice API tokens (P5-M2) — approved 2026-11-16

**Model (approved 2026-11-16):** opaque 256-bit tokens, only SHA-256 hashes stored. One new table:

```sql
-- db/migrations/0011_api_tokens.sql (P5-M2, approved 2026-11-16; production application only during an approved release step)
CREATE TABLE api_tokens (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_api_tokens_customer ON api_tokens(customer_id);
CREATE INDEX idx_api_tokens_expiry ON api_tokens(expires_at);
-- schema_version → 11
```

Tokens are **not** bound to a practice session (an API credential must outlive the browser
tab that minted it — that is the point of the exercise), but they are bound to
`customer_id`, hold the same synthetic trust properties as `mpl_customer`, and are **never**
valid for anything a cookie isn't: same `requireActiveCustomer`/`requireStaff` surfaces,
same suspended behaviour, same response schemas. Resolution order: `Authorization: Bearer`
if present, else `mpl_customer` cookie; if both present, Bearer wins and is documented as
such. Explicitly: **roles come only from the stored customer row**; no header, body field or
claim can elevate.

- `POST /api/v1/auth/token` — sign in a synthetic account and mint a token. Body:
  `{ "email", "password", "expiresInSeconds?" }` — `expiresInSeconds` clamped to
  **15–900** (default 900). Same PBKDF2 verify, same dummy-hash timing equalization, same
  `login:<iphash>` failure budget and 429 as `/auth/login` (shared counter — deliberate:
  one brute-force budget for all credential-checking endpoints). Success: `201`
  `{ token, tokenType: "Bearer", expiresIn, expiresAt }` — the raw token appears in this
  response **once and never again**; it is never stored, logged, or returned elsewhere.
- `POST /api/v1/auth/logout` — unchanged contract (`200 { ok: true }`), but clean mode now
  also deletes the caller's `api_tokens` rows (customer-scoped, not session-scoped —
  revoking is deliberately broad and documented).
- `GET /api/v1/auth/me`, `GET /api/v1/account*`, `GET/ PATCH /api/v1/admin/*` — accept
  Bearer in addition to the cookie. No response shape changes.
- Maintenance sweep — gains a bounded, idempotent `DELETE FROM api_tokens WHERE expires_at
  < now OR revoked_at IS NOT NULL` (capped), preserving the no-cron posture.
- Docs — README auth section + the API reference card gain the token flow; a new guide
  section (or extension of `guide-auth-session-testing`) explains the lifecycle.

**Safety properties:** SHA-256 at rest; raw token shown once; TTL clamped server-side;
issuance rate-limited under the login budget; revocation is widereaching on logout; suspend/
delete cascade as always; the bug-hunt defect AUTHN-001 never lives in clean code paths.

**Explicitly rejected alternatives:** (1) JWTs signed with a lab-held secret — new key
management, new failure modes, no learning value over opaque tokens here; (2) refresh tokens
+ rotation chains — real-world correct but adds a second lifecycle to reason about before the
basics are taught; defer (§12); (3) client-selectable *unbounded* TTL — rejected; clamp only;
(4) tokens bound to the practice session — rejected, defeats the replay exercise and confuses
the cookie contract.

### D. API & identity bug-hunt defects (P5-M2)

Three defects, registry-code, one branch site each, deterministic, server-resolved —
exactly the engine's rules:

| Hunt | Defect | Surface | Clean | Bug-hunt |
|---|---|---|---|---|
| `hunt-authn-001` | `AUTHN-001` | `POST /api/v1/auth/logout` (+ token resolution in `customer.ts`) | logout deletes `api_tokens` rows; replayed Bearer → `401` | token rows survive logout; replayed Bearer → `200` |
| `hunt-rbac-001` | `RBAC-001` | `GET /api/v1/admin/inventory` | customer role → `403 staff_required` | customer role → `200` inventory payload (PATCH still `403`) |
| `hunt-mass-001` | `MASS-001` | `POST /api/v1/checkout` | client `totalCents` ignored; server-computed value stored | client `totalCents` (non-negative safe integer — see outcome note (a)) stored as the order total; confirmation/history disagree with the cart |

Wiring: `hunts.ts`, `defects.ts`, `docs/bug-hunt-catalogue.md`, `huntCurriculum.ts`,
scenarios (`auth-role-boundaries` updated copy; new `api-token-replay`, `api-mass-assignment`),
hints ×3, reveals ×1 each. All three flip to `ready`/`runnable: true` in the catalogue and
appear via `/scenarios?hunt=available`. Expected/actual prose stays internal to the
maintainer docs; learners get objectives, hints, and the gated reveal only.

### E. Exercise wiring & content (P5-M1/M2)

| Scenario | M1 | M2 |
|---|---|---|
| `api-catalog-pagination` | **ready** (clean exercise; console + reference + guide; no defect) | — |
| `auth-session-expiry` | — | **ready** (clean; mint→use→wait→`401`; logout; replay after logout fails in clean mode) |
| `auth-role-boundaries` | — | **wired** → `hunt-rbac-001` (copy updated to staff inventory surface) |
| `api-token-replay` (new) | — | **wired** → `hunt-authn-001` |
| `api-mass-assignment` (new) | — | **wired** → `hunt-mass-001` |
| `api-order-idempotency` | stays `planned` (Phase 7/8-adjacent scope; revisit later) | stays `planned` |
| `security-search-input` | stays `in-design`/`planned` | stays (reflection exercise out of scope this phase) |

Difficulty/severity metadata (per the Phase 4 vocabularies): `api-catalog-pagination` beginner;
`auth-session-expiry` intermediate; `hunt-rbac-001` intermediate; `hunt-authn-001`
intermediate; `hunt-mass-001` advanced. Hunt "severity" is reported by the learner, not
assigned by the platform.

## 6. Milestone plan (exactly three)

Exactly three implementation milestones, executed in order: P5-M1 → P5-M2 → P5-M3.
**One complete milestone = one focused OpenCode session.** Milestones are *not* divided
into separately executed WP1/WP2/WP3 sessions. The recommended implementation orders below
are ordered checklists *inside* each milestone; where practical the whole milestone —
backend, frontend, database, tests, docs, and the `PROJECT_STATE.md` handoff — is
completed in its single session.

**Session workflow (mandatory for every milestone session):**

1. Read `PROJECT_STATE.md` (§1 snapshot, latest §11 entry) and the relevant sections of
   this plan before editing anything.
2. Verify branch, HEAD and working-tree state first (`git status`, `git log -1 --oneline`)
   and reconcile with the recorded baseline. If `main` has diverged or unexpected or
   unrelated changes exist, stop and report — never rewrite history, never discard user
   work.
3. Inspect only the source files relevant to the milestone — never re-read the whole
   codebase to "re-orient".
4. Complete the entire milestone where practical (each milestone's checklist below).
5. Run focused tests during implementation; run the consolidated `npm run check` (plus
   `npm run build` for app-code milestones) once at the end.
6. Fix regressions before declaring completion — a milestone with failing checks is not
   done.
7. Update `PROJECT_STATE.md` with exact outcomes (status, decisions, files changed,
   commands/tests run, blockers, exact next action).
8. Commit the completed milestone as one focused commit where practical.
9. Stop at the milestone boundary — never start the next milestone in the same session.
10. If model context or remaining credits are insufficient to finish safely, leave a
    precise checkpoint in `PROJECT_STATE.md` (done / verified / remaining / exact
    commands) and do **not** claim completion. Do not create artificial work-package
    boundaries to work around limits.

**Branching:** each milestone session starts by creating a feature branch from the current
`main` (recommended names: `feat/phase-5-m1-foundations`, `feat/phase-5-m2-identity-depth`,
`feat/phase-5-m3-exit-audit`). No push, merge, deployment or production D1 migration
happens as part of an implementation session — those are separate, explicitly approved
release steps.

### P5-M1 — Foundations: OpenAPI contract, API reference & in-browser API Console

**Objective.** Give learners a machine-checkable, in-app description of the `/api/v1`
contract plus a safe in-browser way to exercise it — the foundation every later Phase 5
journey builds on.

**Complete scope.** Hand-authored `public/openapi.json` (OpenAPI 3.1.x) covering every
existing `/api/v1` route, its contract test, the `/api-reference` page, the `/api-lab`
API Console, **two separate navigation entries** (API Reference, API Lab — approved, §14),
the `api-catalog-pagination` scenario flipped to `ready`, and a console-based walkthrough
section in `guide-api-request-response`. Zero new server routes; zero new migrations; zero
new dependencies.

**Learner-visible outcome.** A signed-out or signed-in visitor can open `/api-reference`,
read the documented contract for every `/api/v1` route, download `openapi.json`, open
`/api-lab` and fire real requests at the live API (including 400/404/422 negative cases),
see raw status/headers/body/timing, copy a curl command, and complete the flipped
`api-catalog-pagination` exercise.

**Recommended implementation order.** Ordered checklist for the single P5-M1 session —
not session boundaries:

1. Read `PROJECT_STATE.md`; verify branch/HEAD/tree; create the feature branch from `main`.
2. Author `public/openapi.json` (every `/api/v1` route; decide the maintenance-sweep
   treatment deliberately).
3. Contract test `tests/data/openapi.test.ts` (parse, required paths, required sections,
   defect-id/evaluator leak lint, error-code enum).
4. Pure client logic `src/lib/api-lab.ts` + `tests/lib/api-lab.test.ts` (validation, curl
   escaping, body clipping, history helpers).
5. `/api-reference` page (`ApiReferencePage.tsx`) + route; download button for
   `/openapi.json`.
6. `/api-lab` page (`ApiLabPage.tsx`, `src/components/api-lab/*`) + route; response panel
   (status, timing, headers, pretty body), copy-as-curl, component-state history.
7. Two sidebar/mobile-nav entries: **API Reference** (`/api-reference`) and **API Lab**
   (`/api-lab`); `/practice` stays hunts-focused; "Open in API Lab" deep-links from wired
   scenario pages.
8. Flip `api-catalog-pagination` to `ready`; extend `guide-api-request-response` with the
   console walkthrough; extend `tests/data/content.test.ts` (wiring integrity, leak lint).
9. SSR markup tests for both pages; run focused tests; then full `npm run check` and
   `npm run build` once at the end; fix regressions.
10. Browser verification: both themes × 375/768/1024/1440, keyboard-only console pass,
    `prefers-reduced-motion`, zero console errors, zero horizontal overflow.
11. Update `PROJECT_STATE.md` (§1 status + §11 entry, exact outcomes, files changed,
    commands run, exact next action = P5-M2 session on a new branch); commit as one focused
    commit; stop at the milestone boundary.

**Backend changes.** None. (`public/openapi.json` is a static asset; `/api-reference` and
`/api-lab` are client routes.) If M1 reveals any route/documentation mismatch, the *code*
does not change in M1 — the mismatch is filed and fixed in M2 or reported to the maintainer.

**Frontend changes.** New `ApiReferencePage.tsx`, `ApiLabPage.tsx`,
`src/components/api-lab/*` (ConsoleForm, ResponsePanel, maybe RequestHistory),
`src/lib/api-lab.ts` (path validation, header helpers, curl builder, body clipping, pure +
tested), routes in `App.tsx`, **two** sidebar/mobile-nav entries ("API Lab" `/api-lab`,
"API Reference" `/api-reference`), copy updates ("Shop"/"Practice" descriptions
untouched). `pages.css`/`components.css` additions using existing tokens; both themes;
375/768/1024/1440 verified.

**Database changes.** None. No migration (`schema_version` stays 10).

**API contracts.** None new. `/openapi.json` (static) is the only new HTTP surface; it must
describe every existing `/api/v1` route faithfully (34 routes total: catalogue 3, cart 5,
checkout/orders 5, auth/account 7, admin 2, practice 4, attempts 2, reports 1, learning 3,
progress 1, staff maintenance sweep 1 — the sweep is internal; document it as such or omit
it deliberately, decided in M1).

**Security constraints.** Console is same-origin-only by construction (relative fetch,
allowlist regex, no absolute-URL input). Response bodies render as inert text. No body/token
persistence anywhere. `openapi.json` contains no defect data (lint test). The reference
page must keep hunt-mode honesty: it documents expected behaviour; it never claims which
sessions are broken.

**Test strategy.** Unit: `api-lab.ts` (validation, curl escaping, clipping) — pure functions.
Content: scenario flip integrity (`tests/data/content.test.ts` extended), hunt wiring
unchanged. SSR markup: both pages render, accessible names, zero interactive dead-ends
(axe-style manual check in browser). Server: none (no server diff) + full `npm run check`.
Browser: both themes × 4 widths, keyboard-only pass on the console, zero console errors.

**Acceptance criteria.**
1. `/api-reference` lists every existing `/api/v1` route with correct methods/paths/params/
   status codes/error codes — cross-checked against source by a review pass and by the
   `openapi.json` path-coverage test.
2. `openapi.json` parses, carries `openapi: 3.1.x`, documents all routes, contains zero
   internal ids (leak lint green).
3. `/api-lab`: sending `GET /api/v1/products` renders 200 + headers + pretty body + elapsed;
   invalid paths are refused before any request; a fetched body over 64 KB is clipped with a
   notice; history is component-state-only and clearable.
4. `api-catalog-pagination` is `ready`; its page shows the console launch action; work is
   completable by a cold learner in ≤ 30 min.
5. Both themes × 4 widths; keyboard operable; `prefers-reduced-motion` respected; zero new
   dependencies; `npm run check` green; no console errors.

**Documentation and PROJECT_STATE.md handoff.** `PROJECT_STATE.md` §1 snapshot marks P5-M1
implemented/verified with exact outcomes; §11 gains a dated entry (files changed, commands
and tests run, browser verification result, blockers); "Exact next action" is updated to
the P5-M2 session (new feature branch from `main`). No `AGENTS.md` change (deferred to
P5-M3); README stays unchanged this milestone (as-built docs land in P5-M2/P5-M3). One
focused commit; stop at the boundary.

**Dependencies.** None (builds on Phase 2–4 only). **Explicit non-goals.** Defects; tokens;
bearer anything; schema validation tooling; Newman/Postman collections; any server change;
the `/progress` page; navigation redesign; no work-package session split; no deployment,
push, merge or production migration.

**Outcome (2026-11-16, actual).** Delivered as specified, with three recorded decisions: (a)
the staff-only maintenance sweep is documented **with `x-internal: true`** and an
operator-only description — omitted would have silently broken the
"every route documented" contract test, and omission was explicitly allowed but
documentation was chosen deliberately; (b) `/api/health` stays **out** of the contract
(infrastructure, not the versioned API); (c) the plan's “`cookieAuth`” security scheme was
realized as **two** apiKey cookie schemes — `practiceSessionCookie` (`mpl_session`) and
`customerCookie` (`mpl_customer`) — one scheme cannot bind two cookies. `public/openapi.json`
ships OpenAPI 3.1.0, 30 path keys / 34 operations, an `ErrorCode` vocabulary enum asserted
against the server source in both directions by `tests/data/openapi.test.ts` (14/14), and a
defect-id/evaluator leak lint. `/api-reference` renders the served document at runtime (no
drift possible); `/api-lab` enforces the same-origin `/api/v1` allowlist client-side and
rejects before any fetch (verified in-browser: zero network requests for a refused URL);
bodies are byte-capped at 64 KB both in display and at streaming-read time; history stays in
component state (10 entries, clearable, never persisted). `api-catalog-pagination` is
`ready`/`runnable` (clean) with a console launch action; `guide-api-request-response` gained
the console walkthrough; wired scenario pages deep-link into the console. Two separate nav
entries landed as approved (API Reference, API Lab). Verification: `npm run check` green,
**795/795 tests**, `npm run build` clean, SSR suites 17/17, browser probe **49/49** (themes
× 375/768/1024/1440 px, zero overflow, zero unexpected console errors), client-bundle leak
scan clean, no migrations (schema 10), no new dependencies, README and AGENTS.md untouched.
See PROJECT_STATE.md §1 and §11 for the full handoff; P5-M2 is next and must not start
without maintainer instruction.

---

### P5-M2 — Identity depth + API & identity bug hunts

**Objective.** Teach the credential lifecycle (mint, use, expiry, revocation) and the most
common API/identity defect classes through server-controlled hunts, on top of the M1
workbench.

**Complete scope.** Practice API tokens (approved 2026-11-16) with migration 0011, the
identity exercises (`auth-session-expiry` ready, `auth-role-boundaries` wired), and three
new deterministic defects wired through the existing hunt engine. Depends on M1 (the
console is the learner's token workbench).

**Learner-visible outcome.** From the console, a signed-in learner mints a practice API
token, uses it and watches it expire (clamped-TTL exercise, default accounts unchanged),
signs out and understands *server-side* revocation, completes `auth-session-expiry` (ready),
and completes three wired hunts (`hunt-rbac-001`, `hunt-authn-001`, `hunt-mass-001`) —
filing structured reports, earning deterministic feedback, and seeing results on `/progress`.

**Recommended implementation order.** Ordered checklist for the single P5-M2 session —
not session boundaries:

1. Read `PROJECT_STATE.md`; verify branch/HEAD/tree; create the feature branch from `main`.
2. Migration `db/migrations/0011_api_tokens.sql` (approved): `api_tokens` + two indexes;
   `schema_version` → 11; verify both paths locally (fresh 0001→0011; upgrade 0001–0010
   with planted rows); `npm run db:reset:local` parity. Production untouched.
3. `src/server/apiTokens.ts`: mint (`crypto.getRandomValues` 32 bytes), SHA-256 hash at
   rest, `findLiveApiToken` (delete expired-in-passing), customer-scoped revoke, `DUMMY`
   timing reuse; `tests/server/api-tokens.test.ts`.
4. `auth.ts`: `POST /api/v1/auth/token` (shared login budget; `expiresInSeconds` clamp
   15–900 default 900; `201` one-time raw token; never logged); `logout` additionally
   deletes the caller's `api_tokens` rows (AUTHN-001 branch site).
5. `customer.ts`: `resolveCustomerContext` tries Bearer when no cookie resolves (Bearer
   precedence documented); `requireActiveCustomer`/`requireStaff` semantics unchanged;
   expired Bearer → `401 token_expired` (approved).
6. `inventory.ts`: RBAC-001 branch on `GET /api/v1/admin/inventory` only (PATCH untouched).
7. `checkout.ts`: MASS-001 branch — bind client `totalCents` when the hunt is active and
   the field is a safe integer (any sign); otherwise server-computed, exactly as today.
8. Registry entries: `defects.ts`, `hunts.ts`, `huntCurriculum.ts`, `hints.ts`,
   `reveals.ts`, `docs/bug-hunt-catalogue.md` for `hunt-authn-001` / `hunt-rbac-001` /
   `hunt-mass-001` (expected/actual prose stays maintainer-internal).
9. Scenario wiring: flip `auth-session-expiry` (ready), update `auth-role-boundaries`
   (wired → `hunt-rbac-001`, copy rewritten to staff inventory), add `api-token-replay`
   (wired → `hunt-authn-001`) and `api-mass-assignment` (wired → `hunt-mass-001`) — both
   new scenarios approved (§14); `/scenarios?hunt=available` picks them up automatically.
10. Console token helper UI (signed-in only): mint button, one-time display with copy
    button, Bearer toggle feeding the header row, clamped 15–900 s TTL selector, gone on
    refresh with honest copy; SSR test for the helper states.
11. `README.md` as-built (token flow + new hunts, this milestone's turn); leak scan of the
    client bundle; focused tests; then full `npm run check` and `npm run build` once;
    fix regressions.
12. Browser verification: mint → expiry → logout → replay (clean 401 / hunt 200); Amara
    403→200 on GET inventory in hunt with PATCH 403 in both modes; forged `totalCents`
    honoured in hunt only; both themes × 375/768/1024/1440; keyboard pass; zero console
    errors.
13. Update `PROJECT_STATE.md` (§1 + §11 entry, exact outcomes, files changed, commands
    run, exact next action = P5-M3 session on a new branch); commit as one focused commit;
    stop at the milestone boundary.

**Backend changes.**

- `db/migrations/0011_api_tokens.sql` (approved 2026-11-16 — §14):
  the `api_tokens` table above + indexes; `schema_version` → 11; `npm run db:reset:local`
  parity; fresh + 0001–0010 upgrade verification both paths.
- `src/server/apiTokens.ts` (new): mint (`crypto.getRandomValues` 32 bytes hex), hash
  (SHA-256), resolve (`findLiveApiToken` — delete expired-in-passing, mirroring sessions),
  revoke customer-scoped, `DUMMY` reuse for timing parity.
- `auth.ts`: `POST /api/v1/auth/token` (shared login budget; `expiresInSeconds` clamp
  15–900; `201` one-time raw token; never logs). `logout` additionally deletes the caller's
  `api_tokens` rows (clean-mode revocation; this is the AUTHN-001 branch site — one site).
- `customer.ts`: `resolveCustomerContext` extended to try Bearer when no cookie resolution
  succeeds (Bearer precedence documented); `requireActiveCustomer`/`requireStaff` semantics
  unchanged downstream (401/403 envelopes identical).
- `inventory.ts`: `requireStaff`'s `403 staff_required` check gains the AUTHZ-style defect
  branch for the **GET** route only (`RBAC-001`); PATCH is mechanically unchanged.
- `checkout.ts`: in the order-insert path, bind `totalCents` from the client when
  `MASS-001` is active and the field is a safe integer (any sign) — otherwise the
  server-computed value, exactly as today. No behavioural change otherwise.
- `maintenance.ts`: bounded idempotent purge of expired/revoked `api_tokens` (< 500 rows/call).
- `defects.ts`, `hunts.ts`: three defects/hunts; `huntCurriculum.ts`; `hints.ts`;
  `reveals.ts`; `docs/bug-hunt-catalogue.md`.
- `README.md`: token flow + new hunts (as-built, this milestone's turn).

**Frontend changes.** Console: "Mint practice API token" helper (signed-in only) — calls
`/auth/token`, one-time display with copy button, Bearer toggle feeding the header row,
15–900 s TTL selector (clamped, documented), gone on refresh with honest copy. Scenarios:
flip `auth-session-expiry` (ready), `auth-role-boundaries` (wired hunt-rbac-001, copy
rewritten to staff inventory), add `api-token-replay` and `api-mass-assignment`
(both wired, `api-testing`/`security-testing` tracks as appropriate — exact track assignment
at implementation). `/scenarios?hunt=available` picks up the three automatically. No changes
to report/hint/reveal/progress UI.

**Database changes.** One migration (0011, approved 2026-11-16). No alterations to existing
tables. Production application happens only during an approved release step (P5-M3 produces
the release checklist; execution is a separate, explicitly approved step), never
mid-implementation.

**API contracts.** New (token flow):

```
POST /api/v1/auth/token
  req:  { email: string, password: string, expiresInSeconds?: integer 15–900 }
  res 201: { token: string, tokenType: "Bearer", expiresIn: number, expiresAt: string }
  err: 400 invalid_request · 401 invalid_credentials ·
       403 account_suspended · 429 login_rate_limited (shared budget)
Protected endpoints (account/admin): + "Authorization: Bearer <token>" accepted everywhere
  the mpl_customer cookie is accepted; identical success/error bodies; expired Bearer →
  401 token_expired (approved — §14).
POST /api/v1/auth/logout  (unchanged shape) — clean mode: also revokes caller's api_tokens.
```

**Security constraints.** Raw token once-per-view; SHA-256 at rest; TTL clamped; shared
issuance budget with login; revocation widereaching and prompt; sweep purges expiry;
suspended accounts rejected identically via cookie or Bearer; roles solely from DB; AUTHN-001
branch reachable only via hunt-active session and is read-affecting only (replayed
*credential* grants the same account's own data — no cross-account exposure); RBAC-001 PATCH
stays enforced (no shared-data writes in hunt mode); MASS-001 writes only session-scoped
orders. Error responses never enumerate which credential type failed. Logs stay free of
tokens (no logging of Authorization headers anywhere — verify).

**Test strategy.** `tests/server/api-tokens.test.ts` (issue/verify/expire/revoke/clamp/
bearer-matrix across both guards, suspended mid-token, cross-session cookie still rejected,
logout revocation, sweep purge); `tests/server/hunt-set.test.ts` extended with both-branch
tests for AUTHN-001/RBAC-001/MASS-001; `tests/data/content.test.ts` (new wiring, no defect-id
leakage); `tests/practice/*` and `tests/lib/hint-reveal.test.ts` untouched (engine
unchanged); SSR for console token helper; full `npm run check`; leak scan of client bundle
(zoomed on token UI strings). Fake-D1 migration verification both paths.

**Acceptance criteria.**
1. Fresh browser → `/login` as Amara → console → mint token (60 s TTL) → `/account` 200 with
   Bearer → after 60 s, `401 token_expired` → logout → new token replay fails `401` in
   clean mode.
2. Hunt `hunt-authn-001`: replay across logout returns 200 in bug-hunt session only; report
   submission → evaluation → reveal → `/progress` shows discovery; reset → clean.
3. Hunt `hunt-rbac-001`: Amara gets 403 on GET `/admin/inventory` clean; 200 in hunt; PATCH
   is 403 in **both** modes; staff (Rowan) unaffected in both modes.
4. Hunt `hunt-mass-001`: forged `totalCents=1` honoured in hunt only; resulting order lines/
   summary disagree consistently; 7-day cascade delete verified by test fixture.
5. Migration 0011 verified fresh and 0001→0010 upgrade paths; `schema_version` = 11;
   production untouched; zero console errors both themes × 4 widths.
6. No new dependencies. `npm run check` green. README updated.

**Documentation and PROJECT_STATE.md handoff.** `README.md` updated as-built (token flow +
the three new hunts); `PROJECT_STATE.md` §1 snapshot marks P5-M2 implemented/verified with
exact outcomes (including local `schema_version` 11, production untouched); §11 gains a
dated entry (files changed, commands and tests run, browser verification result, blockers);
"Exact next action" is updated to the P5-M3 session (new feature branch from `main`).
`AGENTS.md` stays untouched until P5-M3. One focused commit; stop at the boundary.

**Dependencies.** P5-M1. **Explicit non-goals.** Refresh tokens; JWTs; OAuth/OIDC;
registration/reset/MFA; additional roles; suspending-account hunt; rate-limit-bypass hunt
(rejected); a verbose-error/info-disclosure defect (stretch — only if all else lands with
margin); any deployment, push, merge or production migration.

**Outcome (2026-11-16, actual).** Delivered as specified, with one recorded deviation and a
handful of recorded decisions: **(a) MASS-001 narrowed to non-negative safe integers** — the
plan's “any sign” is not enforceable without altering the `orders.total_cents >= 0` CHECK
constraint, which this lab will not do for a hunt; negative forged totals (and non-integers,
NaN, unsafe integers) are ignored exactly as clean mode ignores the field. Everything else in
the MASS-001 spec landed verbatim (server-computed subtotal/line totals untouched; confirmation
disagrees with the cart; session-scoped cascade). **(b) The RBAC-001 branch lives in
`requireStaff` behind a per-route opt-in** (`{ roleBoundaryDefect: true }`) used only by
`GET /api/v1/admin/inventory` — PATCH and the maintenance sweep never opt in. **(c) Logout
deletes** the account's `api_tokens` rows customer-scoped (the plan's model) rather than
marking `revoked_at`; `revoked_at` remains as a fail-closed guard exercised by tests and the
sweep. `0011_api_tokens.sql` shipped: `api_tokens` + two indexes, `schema_version` → 11;
both migration paths verified (fresh 0001→0011; upgrade 0001–0010 → 0011 with planted rows);
`npm run db:reset:local` extended with the token table (plus a Phase 4 cleanup of its missing
`bug_reports`/`hunt_attempts` deletes); `db:cleanup:local` gained the bounded token purge.
Bearer resolution landed in `customer.ts` (`resolveCustomerContext` prefers Bearer when
present, never falls back to cookie; distinct `401 token_expired`; cookie path and all
401/403/404 semantics unchanged). `POST /api/v1/auth/token` is `201` with the one-time raw
token, a 15–900 s server-side TTL clamp, and the shared `login:<iphash>` failure budget
(5/IP/UTC-minute, one counter for every credential endpoint). The API Lab token helper is
memory-only (one-time display, explicit “Clear token”, nothing persisted anywhere; honest
copy warnings). Ten runnable bug-hunts now ship; `auth-session-expiry` is `ready` (clean),
`auth-role-boundaries` wired to `hunt-rbac-001`, and `api-token-replay` / `api-mass-assignment`
added and wired as approved. Verification: `npm run check` green (**837/837** across 42 files);
`npm run build` passes; OpenAPI contract pins **35 operations** with `bearerAuth` and
`token_expired`; client-bundle leak scan clean (all ten defect ids absent); browser probe
**38/38** (Chrome over CDP, both themes × 375/768/1024/1440 px, token lifecycle incl. a real
17-second expiry wait, both hunts plus MASS-001 end-to-end, reset restores clean). Production
is untouched (Phase 4 release; D1 `schema_version` 10); nothing was pushed, merged, PR'd or
deployed; `AGENTS.md` untouched per the plan. See PROJECT_STATE.md §11.

---

### P5-M3 — Hardening, verification & Phase 5 exit readiness

**Objective.** Engineering pass over the M1+M2 surface as one coherent deliverable:
re-verify everything, close review findings, document the exit, and prepare the release
checklist — without executing it.

**Complete scope.** Hardening, verification and exit documentation for Phase 5 as a whole.
**No deployment or production migration without explicit maintainer approval** — this
milestone produces the audit and the release checklist; execution is a separate,
approved step (as with Phase 4) and is out of scope for the milestone session.

**Learner-visible outcome.** None new — reliability, honesty, and completeness of what
shipped.

**Recommended implementation order.** Ordered checklist for the single P5-M3 session —
not session boundaries:

1. Read `PROJECT_STATE.md`; verify branch/HEAD/tree; create the feature branch from `main`.
2. Re-run the entire test suite; add regression tests for every review finding before
   fixing anything it finds.
3. Full review of the token surface: hashing, TTL clamp, sweep coverage, revocation
   breadth, log hygiene, 429 path, defect-branch reachability (a clean session must be
   physically incapable of hitting the AUTHN-001/RBAC-001/MASS-001 branches), bundle leak
   scan (defect ids, token-UI internals, evaluator terms), header/restart behaviour.
4. `openapi.json` drift check against the actual routes (path-coverage test must exist
   and pass); suspended-account and role-boundary matrix re-run; two-person-style review
   of `src/server/customer.ts` token resolution (the highest-risk hunk).
5. Browser pass on all touched surfaces: both themes × 375/768/1024/1440; keyboard-only
   console pass; hunt end-to-end for the three new hunts plus the original seven (smoke).
6. `docs/phase-5-exit-audit.md` (schema, capabilities, security & privacy review,
   retention/sweep behaviour, tests/build/browser results, known limitations, explicit
   deployed/not-deployed statement, rollback notes, exit-criteria verdict).
7. `README.md` "What you can do now" + known constraints; `AGENTS.md` current-state
   line; `PROJECT_STATE.md` §1/§9/§11 updated truthfully.
8. Release checklist mirroring Phase 4 (health check, migration list, prior deployment id
   recorded, acceptance script, rollback path = redeploy previous deployment; additive-only
   migration is safe with old code) — written, and explicitly **not** executed.
9. Full `npm run check` and `npm run build` once at the end; fix regressions.
10. Update `PROJECT_STATE.md` with exact outcomes; commit as one focused commit; stop at the
    boundary.

**Backend changes.** None beyond small fixes found in review. **Frontend changes.** Same.

**Database changes.** None (0011 already applied locally in M2 verification; production only
in the approved release step).

**API contracts.** Frozen as of M2.

**Security constraints.** Full review of the token surface: hashing, TTL clamp, sweep
coverage, revocation breadth, log hygiene, 429 path, defect-branch reachability (a clean
session must be physically incapable of hitting AUTHN-001/RBAC-001/MASS-001 branches),
bundle leak scan (defect ids, token-UI internals, evaluator terms), header/restart
behaviour, `openapi.json` drift check against routes. Suspended-account and role-boundary
matrix re-run. CSP-less posture re-confirmed and noted as a known follow-up (no CSP today —
see §11 risks).

**Test strategy.** Re-run the entire suite; add regression tests for every review finding;
two-person-style review of `customer.ts` token resolution (the highest-risk hunk); browser
pass on all touched surfaces both themes × 4 widths; keyboard-only console pass; hunt
end-to-end for all three new hunts plus the original seven (smoke).

**Documentation and PROJECT_STATE.md handoff (deliverables of this milestone).**
`docs/phase-5-exit-audit.md` (schema, capabilities, security & privacy review,
retention/sweep behaviour, tests/build/browser results, known limitations, explicit
deployed/not-deployed statement, rollback notes, exit criteria verdict); README "What you
can do now" + known constraints; `PROJECT_STATE.md` §1/§9/§11 updated truthfully;
`AGENTS.md` current-state line updated; release checklist mirroring Phase 4 (health
check, migration list, prior deployment id recorded, acceptance script, rollback path =
redeploy previous deployment; additive-only migration safe with old code) — written and
explicitly **not** executed.

**Acceptance criteria.** 1. All P5-M1/M2 acceptance criteria re-verified. 2. Exit audit
written with an explicit release verdict. 3. `npm run check` green; build clean; zero leaks;
zero console errors. 4. Release checklist ready and **explicitly not executed**.
5. `PROJECT_STATE.md` current.

**Dependencies.** P5-M1 + P5-M2. **Explicit non-goals.** Deployment, merge to `main`,
production D1 touch, pushing branches — all require separate explicit maintainer
instruction. Features from §12 stay out. No work-package session split.

## 7. API and database considerations

### 7.1 Endpoint summary (new in Phase 5)

| Method | Path | Milestone | Purpose |
|---|---|---|---|
| GET | `/openapi.json` | M1 | Static OpenAPI 3.1 contract (no secrets, lint-clean) |
| POST | `/api/v1/auth/token` | M2 | Mint synthetic practice API token (shared login budget) |
| — | all protected `/api/v1` routes | M2 | Accept `Authorization: Bearer` in addition to the cookie (identical responses) |

No other routes. Internal defects branch inside existing handlers only.

### 7.2 Database

One additive migration (0011, M2, approved 2026-11-16): `api_tokens` + two indexes;
`schema_version` 10 → 11. No changes to existing tables; orders/sessions/attempts
precedents for cascade and TTL apply. Retention: expired/revoked tokens purged by the
operator-invoked sweep (bounded, idempotent) — no automatic cron. Estimated production
write volume: single-digit rows/day typical class use — negligible vs 100k/day ceiling.

### 7.3 Ownership & persistence model

Token rows own `customer_id`; cascade on customer delete (fixtures never deleted in prod).
Guest learners cannot mint tokens (no account) — documented; guests use cookie auth for
protected endpoints or stay guest-scoped. No token↔practice-session binding (see §5-C).
Guest progress unchanged. Signed-in attempts unchanged (`customer_id` stamping at submit).

### 7.4 Free-tier impact

- **Requests/day:** console usage is learner-paced; thousands of requests/day negligible.
- **D1 reads:** token resolution adds one indexed row lookup per API call carrying Bearer —
  fine. Console adds zero. `openapi.json` is a static asset, zero D1.
- **D1 writes:** one row per token mint + deletes on sweep; trivial.
- **CPU:** PBKDF2 verify (~100k) per token mint — identical cost to login; unchanged budget.
- **Builds/files:** one static JSON (~10–20 KB) — far under limits.
- No new Cloudflare products; no KV/DO/Queues/cron/Workers; Pages Functions only.

### 7.5 Deployment and release (manual workflow retained)

Phase 5 ships like Phase 4: implement → review → `npm run check` → PR (maintainer-approved)
→ merge → production D1 migration (0011) via `npx wrangler d1 migrations apply qa-practice-lab-db
--remote` **during an approved release only** → `npx wrangler pages deploy dist` → smoke
acceptance → exit-audit addendum. Rollback: redeploy the previous deployment; 0011 is
additive so old code runs correctly against `schema_version` 11. Production D1 schema is
still 10 today; Phase 5 implementation must keep local `.wrangler` state in sync.

## 8. Security and privacy considerations

1. **No new untrusted input paths to storage** beyond one table with hashed tokens; the
   token endpoint mirrors login's validation exactly (same patterns, same caps).
2. **Defect isolation.** AUTHN-001/RBAC-001/MASS-001 branches require the caller's session to
   be in `bug_hunt` mode for the specific hunt; a forged/unknown/expired session resolves to
   clean; defects are compiled-in code, never data; reset restores clean behaviour without
   deletes.
3. **Mass assignment containment (MASS-001).** Forged totals affect only the forging
   learner's session-scoped orders (7-day TTL, cascade). The decimal/integer parse is total —
   non-integers, `NaN`, out-of-range, missing → field ignored exactly as clean mode.
   Confirmation pages show inconsistent but *self-consistent* figures so the learner can spot
   the defect without any cross-learner effect.
4. **Read-only privilege gap (RBAC-001).** The defect grants a customer role *read* access to
   synthetic inventory figures for Meridian Outfitters' fictional shop. Zero PII, zero
   mutation surface; PATCH stays enforced; staff fixtures unaffected; other sessions
   unaffected.
5. **Token replay (AUTHN-001).** The "vulnerability" is revocability failure, taught with
   synthetic credentials for synthetic accounts; exploit value outside the lab is nil, and
   nothing in the lab trains against real infrastructure.
6. **Credential hygiene.** Bearer tokens never in URLs (console puts them in the
   `Authorization` header only), never in `localStorage`, never in logs/analytics (none
   exist), never in error bodies, never in the bundle; hashed at rest; one-time display.
7. **Abuse controls.** Token issuance shares the login 5/IP/min failure budget plus the
   120/min mutation backstop; hunts retain the 20/IP/UTC-day cap; reports 30/IP/min. The
   learner-facing copy must state that the login-429 exercise is an observation endpooint,
   not a target (rate limits are abuse controls, not a security boundary — README already
   says this).
8. **Privacy.** All accounts fictional; tokens unusable outside this origin by design
   (`SameSite=Strict` cookies; Bearer tokens usable anywhere by design — mitigated by
   synthetic-only issuance, short TTL, one-time display, and plain UI warnings not to reuse
   "API tokens" from other systems). No telemetry on requests, bodies or tokens.
9. **Timing/oracles.** login/token paths keep dummy-hash verification; 401-vs-404 ownership
   concealment unchanged; `token_expired` (approved — §14) reveals only that an unexpired-vs-expired
   token was presented — acceptable for a teaching tool and documented either way (§14 Q2).
10. **Content security.** API Console renders bodies as text (XSS-immune); the reference page
    contains static copy only; no `dangerouslySetInnerHTML`; CSP remains absent (existing
    posture) — recorded as a Phase 10 launch-hardening item, not introduced here.

## 9. UX and design requirements

- Reuse the Phase 2.5 design system unchanged: tokens, light/dark themes, workspace
  surfaces, JetBrains Mono for request/response panes, `role="status"`/`role="alert"` for
  async feedback, labelled controls, linked error summaries (pattern from WP2 report form).
- `/api-lab` layout: two panes on ≥1024 px (request builder left, response right), stacked
  on small screens; response panel uses `States` (loading/error/empty) primitives; console
  is fully keyboard-operable; visible focus rings (existing tokens); `prefers-reduced-motion`
  respected; no horizontal overflow at 375/768 px; request/response panes scroll internally.
- `/api-reference`: documentation layout like `/guides/:guideId` (prose 66ch), monospace
  code blocks, per-endpoint method chips (`Tag` variants), table of contents mirrors guide
  scrollspy; "Try it" deep-links into `/api-lab` pre-filled with method+path (path only —
  never body, never headers).
- New scenario badges reuse existing "Bug-hunt exercise" treatment; new `ready` clean
  scenarios show the console CTA.
- Copy tone: honest about synthetic scope everywhere ("Meridian Outfitters is fictional",
  "nothing you do here touches a real service").

## 10. Testing strategy

| Layer | What | Where |
|---|---|---|
| Content integrity | scenario wiring, `huntId` ⇄ `HUNTS` bidirectional check, `runnable:false` placeholders stay placeholder, no defect ids learner-side | `tests/data/content.test.ts` |
| Contract | `openapi.json` parses, covers all routes, required sections, leak-lint (ids/evaluator terms), error-code enum matches server | `tests/data/openapi.test.ts` (new) |
| Server unit | token mint/hash/resolve/revoke/expiry/sweep; clamp bounds; bearer-vs-cookie precedence; both-branch hunt tests; logout revocation | `tests/server/api-tokens.test.ts` (new), `tests/server/hunt-set.test.ts` (ext), `tests/server/auth.test.ts` (ext) |
| Server isolation | two-session hunt isolation for the three new defects; reset; foreign-role PATCH rejection under hunt | `tests/server/hunt-set.test.ts` |
| Client logic | api-lab validation/curl/clip/history pure functions | `tests/lib/api-lab.test.ts` (new) |
| Markup | SSR render of `/api-lab`, `/api-reference`, token helper states | `tests/pages/api-lab.test.tsx` (new) |
| Migration | fresh 0001→0011; upgrade 0001–0010→0011 with planted rows; sweep purge honoured | `tests/server/api-tokens.test.ts` (or `hardening.test.ts` ext) |
| Gate | `npm run check` (lint → typecheck ×3 → all tests) + `npm run build` | CI-less local discipline |
| Browser | both themes × 375/768/1024/1440; keyboard; zero console errors; hunt journeys end-to-end | manual, recorded in exit audit |

The §6.4 report evaluator is untouched — discovery for the three hunts flows through its
existing finding check with term groups added per hunt (server-side, curated, normalized;
same rules as Decision 1 of Phase 4).

## 11. Risks and dependencies

| # | Risk | Mitigation |
|---|---|---|
| R1 | Bearer resolution subtly broadens auth surface; a bug could expose protected data | Token code paths are small, isolated in `apiTokens.ts`, reviewed like P3-M5; matrix tests for cookie/Bearer/suspended/cross-session; no change to 401/403/404 semantics |
| R2 | Learner pastes a *real* token into the console | UI warns; tokens are origin-bound visually (header field labelled "Practice API token (synthetic)"); no storage; docs explicit; the tool cannot call external hosts anyway |
| R3 | AUTHN-001 confused with cookie replay or with general session theft | Hints/reveal frame it narrowly (logout revocation); catalogue documents one branch site; README explains scope |
| R4 | MASS-001 learner forged order totals appear in their own `/progress`/orders and "stick" them | Session-scoped cascade, 7-day TTL; report flow asks severity, not morality; reveal clarifies expected semantics; no shared rows touched |
| R5 | `openapi.json` drifts from code | Path-coverage test + review checklist; a route added without docs fails the test |
| R6 | Free-tier D1 write ceiling approached by token churn | TTL clamp + sweep; still orders of magnitude under ceilings |
| R7 | Scope creep (refresh tokens, JWT, more hunts, schema validation) | §3.2 non-goals; §12 deferred list; maintainer approval gates |
| R8 | `hono/cloudflare-pages` deprecation (carried) | Unchanged; revisit before any Hono upgrade; Phase 5 adds no adapter surface |
| R9 | Production migration applied out of band | 0011 applies **only** during an approved release; local `wrangler.jsonc`/`.wrangler` verified in M2; README redeploy steps kept accurate |
| R10 | No committed browser runner (carried from Phase 4) | Ephemeral CDP probes, evidence in PROJECT_STATE §11 as before |

**Dependencies:** P5-M2 ← P5-M1 (console), engine ← Phase 4 (attempts/reports/hints/reveals/
progress, unchanged), fake-D1 harness ← tests. **Phase-order note:** the Phase 4 §12
renumbering suggestion (API & Identity Lab → Phase 5, shifting later phases) was never
approved; this document is written under the maintainer's explicit charter of 2026-11-16
naming this work **Phase 5**. Downstream renumbering (6 = async/microservice lab … 11 =
hardening & launch) is **proposed, not applied** — §14 decision 4 (not approved; downstream
phases keep their current numbering).

## 12. Deferred capabilities

Explicitly **not** in Phase 5 (candidate homes in parentheses):

- Refresh tokens, rotation, reuse detection/family revocation; access-token introspection
  endpoints; JWT/OAuth/OIDC provider; MFA; registration/reset/verification (never — sign-in
  stays synthetic; any real identity work belongs to a separate, explicit charter, likely
  Phase 10+).
- Additional roles (`support`, `seller`) and permission matrices (Phase 6+ if ever).
- Schema validation in-app (ajv) and contract-testing exercises (guide-only this phase,
  approved §14; in-app engine deferred to Phase 7).
- Postman/Newman collection, Playwright/API-runner starter suites (Phase 8).
- Rate-limit-bypass or login-bruteforce hunts (rejected for shared-IP safety — permanent).
- Verbose-error / stack-trace info-disclosure defect `INFO-001` (stretch goal post-M2 if
  margin; otherwise Phase 6+).
- Cookie-vs-Bearer precedence teaching across cross-practice sessions (folded into M2 tests;
  deeper session-fixation curriculum stays future content).
- Performance exercises against token endpoints (Phase 9).
- Telemetry on hint usage/token usage (needs privacy review; not this phase).
- Real multi-user accounts/cross-device progress (Phase 10+, identity decision gate).
- Retention beyond 7 days for ephemeral rows; export/certificates/badges (Phase 10+).
- `api-order-idempotency` as a runnable exercise (content-ready in catalogue, needs Phase 7/8
  tooling analysis — stays `planned`).

## 13. Phase exit criteria

Phase 5 is implementation-complete when:

1. P5-M1, P5-M2, P5-M3 each verified with acceptance criteria met and committed as one
   focused commit per milestone — one complete milestone per focused session (§6 session
   workflow); no work-package session boundaries.
2. A cold learner can complete the `api-catalog-pagination` exercise and the
   `auth-session-expiry` journey using only in-app affordances (reference + console + login),
   no external tools, unaided for the happy path.
3. All three new hunts are startable from the catalogue/`/practice`, produce deterministic
   both-mode behaviour, and are reportable/evaluable/revealable/debriefed identically to the
   original seven.
4. Clean Mode correctness: no defect branch reachable without an active hunt session
   (tested); `openapi.json` truthful; 401/403/404 triple unchanged.
5. `npm run check` green; `npm run build` clean; no defect ids anywhere learner-reachable;
   both themes × 4 widths; zero console errors; leak scan clean.
6. Migration 0011 verified both paths (approved 2026-11-16); `schema_version` = 11 locally;
   production statement in the exit audit is explicit about deployed/not-deployed.
7. `docs/phase-5-exit-audit.md` exists and records the full verification story; README and
   PROJECT_STATE.md updated truthfully; AGENTS.md current-state line current.
8. **No production push/merge/migration/deploy without separate explicit maintainer
   approval** — deployment remains a distinct, explicitly approved step with a recorded
   rollback plan.

## 14. Decisions — approved by the maintainer (2026-11-16)

All Phase 5 design and security decisions are recorded here as **approved**. Implementation
proceeds under these decisions; anything beyond them needs fresh maintainer approval.

1. **Practice API tokens ship in P5-M2 — approved.** `0011_api_tokens.sql` lands in P5-M2;
   production application only during an approved release step.
2. **Expired-token signal: `401 token_expired` — approved.** Distinct code, deliberately
   taught; the oracle concern is negligible for synthetic accounts. (`401 unauthorized`
   stays correct for missing/invalid credentials.)
3. **HTTP status for token mint: `201 Created` — approved.** One-time raw token in the
   201 response body; never stored, logged or returned again.
4. **Roadmap renumbering: not approved — remains proposed, not applied.** Downstream
   phases keep their current numbering (Phase 5 = this lab; 6/7/8/… unchanged). Revisit
   only with a fresh maintainer decision.
5. **Nav placement: two separate navigation entries — approved.** "API Reference"
   (`/api-reference`) and "API Lab" (`/api-lab`), not one merged entry.
6. **Schema validation: guide-only this phase — approved.** No ajv or other in-app schema
   engine; learners validate externally as the guides instruct.
7. **New catalogue scenarios: approved.** `api-token-replay` (wired → `hunt-authn-001`)
   and `api-mass-assignment` (wired → `hunt-mass-001`) are added as catalogue entries.
8. **Execution model: exactly three implementation milestones, one complete milestone per
   focused OpenCode session — approved.** No WP1/WP2/WP3 session boundaries; the
   recommended implementation orders in §6 are ordered checklists inside each milestone.
9. **No deployment as part of implementation — approved.** Implementation sessions never
   deploy, push, merge or run production D1 migrations. Release is a separate, explicitly
   approved step with its own checklist (produced in P5-M3).

**Approved safety invariants carried into implementation (unchanged):** Bearer/token code
stays isolated in `src/server/apiTokens.ts`; resolver symmetry with sessions
(expired-in-passing delete, customer-scoped revocation, shared login budget); AUTHN-001
read-affecting and reachable only from a hunt-active session; RBAC-001 read-only (PATCH
stays enforced for everyone); MASS-001 writes only session-scoped orders (7-day cascade);
no defect branch reachable in Clean Mode; no per-IP abuse hunts; defect ids never appear in
learner-facing output, logs or the client bundle.

## 15. Documentation deliverables (planning turn, 2026-11-16)

| Document | Action |
|---|---|
| `docs/phase-5-api-identity-plan.md` | **Created and approved 2026-11-16** — execution model aligned to one milestone per session; decisions recorded in §14 |
| `PROJECT_STATE.md` | §1 snapshot (Phase 5 approved; production baseline restated), §9 roadmap note, §11 progress-log entry, §12/§14 pointer updates; next-task recorded |
| `README.md` | Not changed this turn (no implementation yet); listed for P5-M2/M3 |
| `AGENTS.md` | Not changed this turn; listed for P5-M3 |

**Next step:** P5-M1 implementation **in a fresh session**, on a new feature branch created
from `main` (recommended: `feat/phase-5-m1-foundations`), following the §6 session
workflow — read PROJECT_STATE and this plan, verify branch/HEAD/tree, work the P5-M1
checklist end-to-end including verification and the `PROJECT_STATE.md` handoff, commit as
one focused commit, stop at the milestone boundary. **Do not start P5-M1 in this session.**

## 16. P5-M3 outcome (2026-11-16)

**P5-M3 is complete.** The full Phase 5 surface was re-reviewed as one coherent deliverable;
the consolidated verification ran green (837/837 tests, 42 files; `npm run build` clean; local
`schema_version` 11 on both migration paths; leak scan clean; 67/67 browser checks over system
Chrome, both themes, 375/768/1024/1440 px; zero unexpected console errors). Three defects were
found and fixed, all learner-facing **copy/contract** drift, not logic:

1. `public/openapi.json` — `info.description` claimed “No Bearer tokens exist in this phase”,
   contradicting the `bearerAuth` scheme, the token endpoint and the 401 `token_expired`
   vocabulary documented in the same document. Fixed.
2. `src/features/api-reference/ApiReferenceView.tsx` — the “How to use this reference” callout
   repeated the same stale “there are no Bearer tokens in this phase” sentence. Fixed.
3. `README.md` — the production-status header described P5-M2 as “on the unmerged branch”
   (it was merged via PR #7, `f7bf1c3`) and omitted P5-M3. Fixed.

No critical or high-severity security defect was found. Token lifecycle, Bearer precedence,
bug-hunt isolation, MASS-001 constraints and API Lab same-origin enforcement verified clean.
The exit audit with all eight §13 criteria verdicts (all PASS) is
**`docs/phase-5-exit-audit.md`**; the release checklist lives in §14 of that document and is
deliberately **not executed** — no push, PR, merge, production D1 migration or deploy happened.

**Deviations from this plan (justified):** none beyond the three copy/contract fixes above.
The P5-M3 checklist was followed as written; two-person review of `customer.ts` was not possible
in a single-session milestone and is recorded as a recommendation for the maintainer's release
gate (audit §13 item 11). An independent fresh-context review was performed at the release gate
and found no release-blocking issues (audit §17). Production D1 is now at `schema_version` 11
(migration `0011_api_tokens.sql` applied 2026-11-16).

**Exact state:** `main` @ `3ecfb41` (merge of P5-M3, PR #8); Phase 5 is released to production
(deployment `aaa0e2a6-2f13-47e1-91b5-cac38c4d2765`, 2026-11-16) and verified in production — see
`docs/phase-5-exit-audit.md` §14/§17. Phase 6 remains unstarted and requires explicit maintainer
instruction.
