# Phase 7 — Contract Testing Lab — Implementation Plan

> **Status (2026-11-17):** PLANNED, NOT IMPLEMENTED. This document is the complete,
> implementation-ready plan for Phase 7. **No Phase 7 code, dependency, migration,
> fixture, route, or Cloudflare change may exist yet.** The next authorized action is
> maintainer review of this plan; implementation begins only on explicit instruction.
>
> **Baseline:** `main` @ `3e0e5e7` (local documentation commit on top of the Phase 6
> release `eeded31`); local `main` is ahead of `origin/main` by 4 local documentation
> commits (unpushed — preserved). Working tree clean at the start of the planning turn.
> Production: https://qa-practice-lab.pages.dev — Pages project `qa-practice-lab`, D1
> `qa-practice-lab-db`, production `schema_version` **12** (Phase 6 release 2026-11-17).
> Phases 1–6 are complete; Phase 6 is merged and deployed. **Nothing in this phase may
> be pushed, merged or deployed without explicit maintainer approval.**
>
> **Deliverables of the planning turn (2026-11-17):** this document, the
> `PROJECT_STATE.md` update, and a minimal `AGENTS.md` status-line update. No source,
> dependency, migration, or config changes.
>
> **Source of truth reminder:** `PROJECT_STATE.md` §1/§11 and the actual repository are
> authoritative over any aspiration written here. Where this plan differs from the code,
> the code wins and this plan is amended in the same commit that discovers the drift.

## 1. Phase objectives and learner outcomes

### 1.1 Objectives

Phase 7 adds a complete, practical **Contract Testing Lab** to QA Practice Lab — a
guided learning environment plus free-form workspaces for validating API contracts,
detecting breaking changes, and verifying consumer/provider compatibility — integrated
with the existing learning platform (tracks, scenarios, exercises, hints, gated
reveals, bug hunts, reports, progress) rather than as a disconnected product.

Concretely, Phase 7 delivers:

1. A **contract-validation workspace** (`/contract/validate`): validate request and
   response payloads against a documented OpenAPI 3.1 / JSON Schema 2020-12 contract —
   the real platform contract (`/openapi.json`) or the bundled synthetic fixtures — and
   get precise per-assertion diagnostics (which JSON-Schema keyword failed, where, why).
2. A **compatibility workspace** (`/contract/compare`): diff two versions of a contract
   (fixture pairs, or learner-pasted candidate schema against a fixture) and classify
   every change as **breaking**, **backward-compatible**, or **review-required**, with
   per-finding rationale from both consumer and provider perspectives.
3. A **consumer/provider workspace** (`/contract/consumer`): write a minimal consumer
   expectation as JSON Schema, verify a provider fixture against it, observe exact
   mismatches, and see why contract testing catches integration failures before deploy.
4. A **24-exercise learning catalogue** (8 beginner / 9 intermediate / 7 advanced) with
   progressive hints, gated reveals, deterministic server-side evaluation, and scoring —
   the same engine as Phases 4–6.
5. **Seven contract bug hunts** wired into the existing bug-hunt architecture with
   `kind: 'contract'` — six server-controlled live-API contract defects and one
   fixture-delta consumer/provider hunt — reusing the hunt → attempt → report →
   evaluation → reveal loop unchanged.
6. **Integration with Phase 4 learning/progress systems** and the Phase 5 OpenAPI
   contract surface (`/openapi.json`, `/api-reference`, `/api-lab`), with no duplication
   of the existing infrastructure.

### 1.2 Learner outcomes (measurable)

After completing Phase 7, a learner can:

- Validate an arbitrary JSON payload against an OpenAPI 3.1 document and read the
  resulting assertion list (which property, which keyword, expected vs actual) without
  outside tooling (beginner track).
- Distinguish required vs optional properties, correct types, `format` (date-time,
  email), `enum`, `const`, numeric/string/array constraints, nested objects, arrays,
  `null` via `type: [T, "null"]`, and `additionalProperties` handling — and predict which
  assertions fail before running the validator (beginner/intermediate).
- Validate a request body against the documented request schema and a response body
  against the documented response schema, including status codes and content types
  (intermediate).
- Follow `$ref` pointers through `components/schemas` by hand and explain what a named
  schema guarantees (intermediate).
- Diff two versions of a contract and classify each change as breaking, backward-
  compatible, or review-required — with the reasoning for both consumers and providers
  (intermediate/advanced).
- Write a minimal consumer expectation (only the fields the consumer relies on) and
  verify a provider fixture against it; explain why unrelated provider changes are free
  to ship (advanced).
- Diagnose a provider-side contract drift (missing required field, type change, enum
  change, status-code change, format drift, undocumented property), with evidence, and
  file a structured bug report that a reviewer can act on (advanced).
- Explain how consumer-driven contract testing reduces integration failures and when a
  contract test is a better investment than a full end-to-end test (advanced).

### 1.3 What this phase is not

Phase 7 is a **self-contained educational simulation**, not a contract-testing platform.
It does not implement Pact, a broker, distributed provider state, or CI gating. See §15
for explicit non-goals. The learner practises the *skills* — writing/reading/validating
contracts, detecting drift, verifying providers — against deterministic first-party
targets only.

## 2. Existing architecture and integration points

Verified against the repository on 2026-11-17 (not against memory). Baseline: `main` @
`3e0e5e7`, working tree clean, Phase 6 merged and deployed.

### 2.1 What exists and works today (reused, not re-built)

| Area | Current implementation | Phase 7 use |
|---|---|---|
| App shell / routes | `src/app/App.tsx` — lazy routes inside `AppShell`, `PracticeSessionProvider` wrapping all | Add 5 lazy routes (§6.1) |
| Navigation | `src/lib/navigation.ts` `primaryNav` (11 entries); `src/data/types.ts` `IconName` includes `'contract'` (already used by the API Reference entry and the `contract-testing` track) | Add **Contract Testing** entry after **Database** (§6.2) |
| Workspace UI idiom | `[data-surface="workspace"]` scope + `src/styles/workspace.css` | Contract workspaces reuse it; no new palette |
| Theme | `data-theme` bootstrap, light default + dark workspace | Both themes; verified at 4 widths |
| Fonts | Self-hosted IBM Plex Sans + JetBrains Mono Variable | Code/contract panes use the mono font |
| Route-level code splitting | Every non-index page is its own chunk | Contract chunks lazy-load like `/database*` |
| Practice sessions | `mpl_session` cookie, 7-day TTL, SHA-256-hashed tokens, `PracticeSessionProvider` | Attempts stay session-scoped; guest = ephemeral, account = customer-scoped (Phase 4 rule) |
| Hunt registry | `src/server/hunts.ts` (`HUNTS`, `findHunt`, `HUNT_ID_PATTERN`) — code, not data; executions branches on `isDefectActive(c, DEFECT_ID)` | Contract hunts register as entries with `kind: 'contract'`; live-API defects branch on `isDefectActive` unchanged |
| Defect registry | `src/server/defects.ts` (`DEFECTS`, server-only `expected`/`actual`/`repro`) | Six new `CONTRACT-xxx` defects, same rules |
| Attempt lifecycle | `hunt_attempts` (migration 0010) — idempotent start, partial unique index, cascade with session | Reused as-is for contract exercises and hunts (ids ≤ 32 chars fit TEXT) |
| Unified attempt targets | `src/server/attemptTargets.ts` (`resolveAttemptTarget`, `allAttemptTargets` — iterates `HUNTS` + `SQL_EXERCISES`) | Extended to include `CONTRACT_EXERCISES` (§4.7) |
| Hint ladder / reveal gate | `src/server/learning.ts` + `src/server/hints.ts` + `src/server/reveals.ts`; 3 levels, idempotent `hint_mask`; reveal gated on submit or confirmed give-up | Reused as-is; new content modules for contract hints/reveals |
| Bug-report evaluation | `src/server/reports.ts` + `src/server/reportQuality.ts` — deterministic 100-point rubric, no AI | Reused as-is for contract hunts |
| Progress | `GET /api/v1/practice/progress` — `buildHuntEntries`, totals, session/customer scoped | Mapper unchanged in shape; iterates the extended `allAttemptTargets()` (§4.7); `/progress` gains a Contract Testing section |
| OpenAPI contract | `public/openapi.json` served at `GET /openapi.json`; `tests/data/openapi.test.ts` enforces coverage both directions, error vocabulary, leak lint; `/api-reference` renders it; `/api-lab` same-origin console | Served contract is the **validation source** for the browser workspace; contract stays the live provider contract |
| Test harness | `tests/helpers/fake-d1.ts` (node:sqlite-backed D1 with atomic batch) | Server tests for new endpoints follow the same pattern |
| Bundle-leak lint | `tests/lib/hint-reveal.test.ts` information-leak guard | Extended for contract solution/reveal strings and `CONTRACT-xxx` defect ids |
| Guides system | Typed `Guide` in `src/data/guides.ts` | `guide-contract-testing-basics` refreshed; new `guide-consumer-driven-contracts` added |
| Scenario catalogue | `contract-catalog-consumer` and `contract-breaking-change` both `runnable: false`, `status: 'planned'` | Both flip to `ready`/`runnable` with exercise/hunt wiring in the milestone |
| Contract-testing track | `tracks.ts` id `contract-testing`, `plannedExerciseCount: 5`, objectives already written (consumer expectation, provider verification, breaking-change classification, contract vs integration) | Objectives stand; `plannedExerciseCount` updated to the shipped catalogue count |
| SQL seed-delta pattern | `src/server/sqlSeedDelta.ts` + `GET /api/v1/sql/hunts/:huntId/seed` (bug-hunt-mode-only compiled delta, 30/min scoped cap, 403/404 indistinguishable elsewhere) | Mirrored for the fixture-delta hunt `hunt-contract-007` (§4.6) |

### 2.2 The current OpenAPI surface (verified 2026-11-17)

`public/openapi.json` (135 KB) is OpenAPI **3.1.0**, `info.version` **1.1.0**, **34 path
keys / 38 operations**, 65 named schemas under `components.schemas`, security schemes
`practiceSessionCookie` / `customerCookie` / `bearerAuth`, `additionalProperties: false`
on every object schema, `example` blocks throughout. Cross-sections of the document that
matter for Phase 7:

- `Product` (required: 9 properties, `priceCents` integer `minimum: 0`,
  `currency` const `USD`, `stockStatus` enum
  `in_stock|low_stock|out_of_stock`) — the richest learner-facing record in the
  catalogue and the primary validation target.
- `OrderDetail` — `additionalProperties: false`, 15 required properties,
  `createdAt`/`cancelledAt` as `date-time`, `cancelledAt` typed `["string","null"]`,
  `items[]` of `OrderItemSnapshot`. The multi-operation capstone fixture mirrors this
  shape in miniature.
- `ErrorCode` (closed enum, 27 codes, no new codes are planned for Phase 7 — new error
  paths reuse `invalid_request`, `not_found`, `rate_limited`, `session_required`,
  `not_hunt_mode`, `exercise_not_found`, `payload_too_large`, `reveal_locked`).
- `StockStatus` is a `$ref`-only enum referenced by `Product.stockStatus` — the
  `$ref`-resolution teaching surface.
- No `anyOf`/`oneOf`/`allOf` in the shipped document other than the two
  `type: [string, "null"]` idiom instances (JSON Schema 2020-12 `type` arrays).

### 2.3 Gaps Phase 7 must close

1. **No contract tooling of any kind ships today.** `/api-reference` is documentation;
   `/api-lab` is a request console. Neither validates, diffs, or classifies anything.
2. **No contract fixtures exist** — nothing versioned to compare against.
3. **No validation library is installed** (deliberately — see §4.2).
4. **The contract-testing track and its two scenarios are placeholders**
   (`status: 'planned'`, `runnable: false`).
5. **No consumer/provider model exists anywhere in the codebase.**
6. **No compatible/breaking-change classification engine exists.**

## 3. Product scope and learner workflows

Three capability journeys plus one guided-exercise journey. Every workspace is reachable
from the `/contract` hub and from wired scenario pages; every guided exercise follows the
Phase 4/6 pattern (instructions → hint ladder → Check work → gated reveal → report).

### 3.1 Capability A — API contract validation (beginner → intermediate)

**Workflow.** Open `/contract/validate`. Pick a fixture (or the live platform contract,
browser-side) and an operation. Paste a JSON payload. Run → a per-assertion result list:
`{ path, keyword, expected, actual, passed }`, e.g. `$.priceCents — type — expected
integer, actual string`. Toggle **Request** / **Response** context where applicable
(constraints are direction-sensitive, §4.4). Every result links to a short explanation of
the keyword. A "Learn" tab on each assertion deep-links into the guides.

**Teaches:** why a contract assertion failed — property-by-property, keyword-by-keyword,
not "validation failed". Request and response validation share the same engine; only the
fixture side label (`request` / `response`) differs.

**Exercise focus ids:** `contract-bgn-required-01`, `contract-bgn-types-01`,
`contract-bgn-formats-01`, `contract-bgn-enum-01`, `contract-bgn-status-01`,
`contract-bgn-contenttype-01`, `contract-int-nested-01`, `contract-int-request-01`,
`contract-int-response-01`, `contract-int-const-01`, `contract-int-constraints-01`,
`contract-int-nullable-01`, `contract-bgn-live-products-01`.

### 3.2 Capability B — Schema compatibility and version comparison (intermediate → advanced)

**Workflow.** Open `/contract/compare`. Choose base and candidate (fixture pairs v1/v2,
or base fixture + learner-pasted candidate schema — inline mode). Run → verdict banner
(**BREAKING** / **BACKWARD-COMPATIBLE** / **REVIEW REQUIRED**), then findings grouped by
classification; each finding shows `path`, change description, rule id, and two short
blocks — **Consumer impact** / **Provider impact**. A compatibility report view renders the
summary suitable for pasting into a PR review.

**Teaches:** detecting removed properties, type changes, newly required properties,
incompatible response changes; distinguishing additive/compatible changes from breaking
ones; reading a change set from both perspectives. The engine is deliberately
conservative: when a change is genuinely ambiguous for closed-set consumers (enum
widening), it is **review-required**, not silently "compatible".

**Exercise focus ids:** `contract-int-compare-additive-01`, `contract-int-compare-enum-01`,
`contract-adv-breaking-req-01`, `contract-adv-breaking-type-01`,
`contract-adv-breaking-remove-01`, `contract-adv-versioning-01`.

### 3.3 Capability C — Consumer/provider contract verification (advanced)

**Workflow.** Open `/contract/consumer`. Pick a consumer profile (e.g. *Meridian Ledger —
POS adapter*) and an operation (e.g. `getProduct`). The **expectation editor** is a JSON
Schema editor with a guided mode (pick consumer-critical fields from checkboxes →
auto-generates the minimal schema) and a raw mode. **Verify** → runs the provider fixture
*payload* against the expectation: status match, then JSON-Schema assertion list. A
**Break/fix** toggle swaps the provider fixture selection (v1 → `v2-latest`, the
session-aware alias, §4.5.3) so learners watch their own expectation fail on the breaking
change — the "consumer catches provider drift first" moment. A **mismatch report** panel renders the exact diff between expectation and
provider payload.

**Teaches:** consumer expectations are *minimal, intent-revealing* schemas — required only
what the consumer reads, open (`additionalProperties` unspecified) so providers may add
fields freely. Provider verification proves/disproves the expectation against a concrete
payload. Contract testing reduces integration failures by failing fast at the contract
boundary, before cross-service deployment.

**Exercise focus ids:** `contract-adv-consumer-expect-01`, `contract-adv-consumer-broken-01`.

### 3.4 Capability D — Guided learning exercises (beginner → advanced)

Twenty-four exercises, five entry routes per exercise page (Phase 4 pattern): brief,
success criteria, hint ladder (3 levels), Check work, Attempt chip, gated reveal, Reset.
Evaluation is deterministic and server-side; pass ≥ 70. Every exercise has a QA-oriented
framing — the reason a tester cares — not "validate this JSON for practice".

### 3.5 Capability E — Contract bug hunts (intermediate → advanced)

Seven hunts, `kind: 'contract'`, six against the live first-party API and one
fixture-delta consumer/provider hunt. Full model in §4.6; catalogue in §9.

### 3.6 Capability F — Results and reporting (all difficulties)

- **Contract validation reports** — assertion lists from Capability A validate runs
  (workspace-local, dismissible, copyable) plus the scored evaluation result view on
  exercise pages (checklist with per-check pass/fail — same component family as Phase 6).
- **Compatibility reports** — verdict + findings + perspectives from Capability B,
  copyable as Markdown (client-side generation; no new server surface).
- **Mismatch reports** — consumer expectation vs provider payload assertions from
  Capability C.
- **Structured bug reports** — the existing Phase 4 flow (labeled fields, rubric scoring,
  revise & resubmit) is unchanged for the seven hunts.
- **Progress integration** — `/progress` gains a **Contract Testing** section; the
  recommended path gains a contract node sequence; guest = session-ephemeral, account =
  customer-scoped — Phase 4/5/6 semantics unchanged.

### 3.7 Anti-patterns the journeys must avoid

- No "click validate to see green check" without assertion-level diagnostics.
- No schema-diff output that says only "different" — every finding names rule, path,
  classification.
- No consumer expectation exported as 300-line full-schema copies ("the pact is the whole
  API") — minimalism is enforced by the exercise rubric (C3).
- No fake "live provider verification against the internet" — fixtures only.
- No scores without per-check explainability; no wall-clock pressure; no streaks or
  leaderboards (Phase 4 philosophy).

## 4. Technical architecture

### 4.1 Where validation executes — browser, server, or both

**Decision: both, with the server authoritative for scoring.**

| Plane | What runs there | Why |
|---|---|---|
| Browser | Immediate feedback in the three workspaces; live-platform-contract validation against the fetched `/openapi.json`; bundled fixtures imported from `src/shared/contracts/` | Latency, offline-capable after first load, zero server round-trips for exploration |
| Server (Pages Functions / Hono) | Deterministic **scored** evaluation (`POST /api/v1/contract/evaluate`), rubric-checked re-validation of anything that awards points (validate/compare/verify-consumer), hunt fixture delta, attempt stamping | The browser is untrusted for scoring; identical engine on both sides |
| Static | `/openapi.json` served as today; fixtures are **not** static assets — they are imported TS modules, single-sourced (§4.3) | No duplication; no second copy to drift |

**Why not browser-only (rejected):** scores would be client-computed; leak-shaped
"reference answers in the bundle" risk; no integrity boundary for hunts/reports. **Why
not server-only (rejected):** every keystroke-latency workspace interaction would need a
network round-trip, and full server-side validation of large learner pastes costs Worker
CPU for exploratory (unscored) work — Pages free tier is CPU-time-bounded.

**Server never executes learner code.** There is no evaluator for executable learner
content anywhere in Phase 7 — only data-in, verdict-out schema operations on bounded
inputs (§4.2, §11). No `eval`, no `new Function` on learner input (there is no need for
either), no remote `$ref` resolution.

### 4.2 Dependency decision: the validation library

**Requirement:** validate JSON payloads/schemas written in JSON Schema **2020-12**
(the dialect OpenAPI 3.1 is aligned with), deterministic, no code generation (Cloudflare
Workers forbid `eval`/`new Function` for Pages Functions; the Pages Functions runtime is
where scored evaluation lives), small, MIT-licensed, maintained, no native deps, and
directly usable in both the Pages Functions (Worker-like, no DOM) and the browser bundle.

**Candidates evaluated (2026-11-17, verified via npm registry + package artefacts, not
memory):**

| Library | Version / license / last publish | Size (gzip, aggregate) | Dialect support | Server fit | Notes |
|---|---|---|---|---|---|
| `ajv` + `ajv-formats` | 8.20.0 / 3.0.1 — MIT — ajv pub. 2026-04-24 | ≈55 KB (all dialects in one package); core+2020 subset ≈30–45 KB | 4 (legacy), 6, 7, 2019-09, 2020-12 (via `ajv/dist/2020`) | **Fails:** compiles validators with `new Function`; unusable in Pages Functions at runtime | Interpreter fallback does not exist; standalone build would add a build step + codegen drift risk; richest error model but disqualified for the server plane and an avoidable two-engine situation |
| **`@cfworker/json-schema`** | **4.1.6 — MIT — pub. 2026-11-04** | **≈9 KB** (ESM dist 54 KB unminified → ≈9 KB gzip measured) | drafts 4, 7, **2019-09, 2020-12** | **Yes** — interpreter, no eval/new Function, built for Cloudflare Workers, validated against the ~4,500-assertion JSON-Schema-Test-Suite | `email` + `date-time` (the only formats the platform contract uses, 17 occurrences) implemented natively; `$id`/`$ref` local resolution supported; `shortCircuit: false` collects all errors (we need all errors for teaching); error objects carry `instanceLocation`/`keywordLocation`/`error` — mapped to our assertion model |
| `@hyperjump/json-schema` | 1.18.1 — MIT — pub. 2026-11-14 | ≈2 KB entry; needs targeted dist measurement per dialect (openapi-3-1 entry ≈4.2 KB gzip); full 2020-12 runtime larger | **2019-09, 2020-12 + OpenAPI 3.0/3.1 dialect entries** | Yes (interpreter) | Correct dialect story and standards-forward design, but younger API, more packages to reason about, bundling/measurement not yet verified in this repo, and its docs/example surface for Workers is thinner; deferred (§18, D1) — not needed at our dialect-subset complexity |
| `jsonschema` | 1.5.0 — MIT — pub. 2025-01-07 | ≈30 KB | Draft 7 era | Marginal | Stale dialect alignment (no 2020-12); not for new work |
| `zod` | 4.6.7 — MIT — pub. 2026-10-12 | ≈80+ KB | n/a — TypeScript-first schema builder | Yes, but **wrong tool** | Would mean re-authoring every schema in zod; the contract under test is *JSON Schema/OpenAPI* — learners must read the artefact itself, not a zod encoding of it. Rejected |
| `ajv-compiler` (standalone precompile) | — | Build-time only | same as ajv | Yes (build-step only) | Adds a codegen pipeline + a checked-in generated artifact + CI drift risk for ~0 runtime benefit over the interpreter at our payload sizes. Rejected |

**Decision: `@cfworker/json-schema@^4.1.6`** — the only interpreter-based, Workers-safe,
actively maintained, tiny option with first-class 2020-12 support and exactly the two
formats our contract uses. One engine on both planes ⇒ identical diagnostics in the
browser and in scored evaluation, one test matrix, ~9 KB lazy-loaded gzip on `/contract*`
routes only. `$schema: 'https://json-schema.org/draft/2020-12/schema'` is stamped by our
wrapper when compiling (the platform document deliberately omits it, as OpenAPI 3.1 allows).

**Wrapper module** `src/shared/contractValidation.ts` (framework-free, no DOM, no Node
APIs): `compileSchema(schema) → Validator`, `validatePayload(schema, payload, { locus,
maxNodes, maxDepth }) → ContractAssertion[]`, plus the complexity guards in §10.2/§11 (node
budget, depth budget, `$ref` hop limit, local refs only, `^` pattern length cap). Both
workspaces and both server endpoints call this wrapper — never the library directly — so
limits are enforced uniformly and the library can be swapped by changing one file.

**Format strategy:** rely on the library's `email` / `date-time` (both implemented); do
**not** enable "annotation-only" formats silently — unknown formats in learner input are
treated as annotations (JSON Schema 2020-12 default behaviour) and documented as such;
the two known formats are enforced and tested.

**Bundle impact (measured targets, verified at build time in the milestone):** +9 KB gzip
for the validator, +≈8 KB gzip for fixtures, +≈25–30 KB gzip for the three workspaces and
hub — **contract lazy chunks budget ≤ 60 KB gzip incremental**; the `index` chunk and
`/database*` chunks must remain byte-identical to current `main` (verified with `du` in
the build output). `npm run build` output is diffed in the exit audit.

**Maintenance/licensing:** MIT, zero transitive dependencies (verified from
`package/package.json` `dependencies` field — none), ESM+CJS dual (we import ESM), types
included. `package-lock.json` will gain exactly this one entry — no transitive tree. The
dependency is recorded in §18 for maintainer approval; removing it later is a one-file
change behind the wrapper.

### 4.3 Contract fixture model — what learners compare and validate against

Fixtures are **TypeScript modules under `src/shared/contracts/`**, not static assets and
not D1 rows. Rationale: single source for browser + server (both `import` the same
constants), type-checked at compile time, bundled (no second copy to drift), tiny, and
zero network cost. Each fixture declares a stable id, version, kind, direction locus, and
the schema/payload pair used by exercises.

**Why a fictional sibling service ("Meridian Ledger") and not the platform contract as
the diff baseline?** The platform contract is a *provider contract learners exercise*; it
has exactly one version and is consumed by 38 operations. Compatibility teaching needs
small, purpose-built, pairwise-comparable documents with known deltas (dropped property,
narrowed enum, newly required field, additive change). A synthetic sibling service gives
pedagogically clean diffs without touching the production-relevant contract and without
teaching "just regenerate the file". The platform contract stays a first-class citizen of
Capability A (browser-side validation against `/openapi.json`, and the scored
`contract-bgn-live-products-01` exercise, which grades the *captured payload answer*
against compiled expected assertions server-side — never against the live document).

**Fixture inventory (six client-safe modules + one server-only delta, ≤ 30 KB total,
all `as const satisfies` typed, all synthetic):**

| Module (`src/shared/contracts/`) | Id | Content | Used by |
|---|---|---|---|
| `ledgerV1.ts` | `ledger-v1` | Meridian Ledger API **v1.0.0** (fictional payments sibling): `LedgerEntry` (`entryId` pattern `^LE-[0-9A-Z]{8}$`, `amountCents` integer `minimum: 0`, `currency` const, `direction` enum `debit\|credit`, `status` enum `posted\|pending\|reversed`, `merchant`, `postedAt` date-time, `settledAt` date-time\|null), `EntryListResponse`, `CreateEntryRequest` (optional `clientRef`), `Error`. ~4 KB | Validate + Compare baselines |
| `ledgerV2Compatible.ts` | `ledger-v2-compatible` | v1 + **additive** change (new optional `memo` on `LedgerEntry`; R4) + **enum widened** (`status` gains `scheduled`; R9 review, never breaking). No constraint relaxation — any response-side bound loosening would be R13-breaking, which is exactly what the breaking fixture demonstrates, so this fixture stays two clean findings | `contract-int-compare-additive-01`, `contract-adv-versioning-01` (partial) |
| `ledgerV2Breaking.ts` | `ledger-v2-breaking` | v1 + **removed property** (`settledAt` gone) + **enum narrowed** (`pending` removed from `status`) + **type change** (`amountCents` integer → string). Multi-finding specimen | `contract-adv-breaking-remove-01` (partial), `contract-adv-breaking-type-01` (partial), `contract-adv-versioning-01` |
| `ledgerV2Required.ts` | `ledger-v2-required` | `CreateEntryRequest` **gains required `clientRequestId`** (string, minLength 1) — previously optional/absent. Request-side breaking change | `contract-adv-breaking-req-01` |
| `providerProduct.ts` | `provider-product-v1` | Canned provider fixture pair for `getProduct`: `v1Payload` (satisfies `Product`), `v2CompatiblePayload` (adds harmless `warehouseRank`), plus **client-safe metadata** (`criticalFields: ['slug','name','priceCents','currency','stockStatus']`) | Consumer capability + `contract-adv-consumer-expect-01` |
| `providerProductV2Drift.ts` | *server-only* (`src/server/contractDeltas.ts`) | The **bug-hunt delta** for `hunt-contract-007`: provider payload with `categoryName` renamed to `category` and `stockStatus` value casing change composed only in the eyes of the hunt session — compiled into the server bundle, never shipped to the browser, never statically served | `hunt-contract-007`, `contract-adv-consumer-broken-01` (payload source in bug-hunt mode) |
| `checkoutFlow.ts` | `checkout-flow` | Mini three-contract bundle mirroring `CheckoutSummary` → `CheckoutRequest` → `OrderDetail` field subsets (`items[].unitPriceCents`, `totalCents`, `createdAt` date-time, `cancelledAt` string\|null) + canned captures. Capstone material | `contract-adv-checkout-flow-01` |

Plus shared assertion/verdict types in `src/shared/contractTypes.ts` and the wrapper in
`src/shared/contractValidation.ts`. The class names are historical ("Meridian Ledger"),
matching the "Meridian Outfitters" family out of which the whole practice domain is built
(brand reuse is deliberate; this is an original domain, not a copy of any external lab).

**Fixture integrity is test-enforced**: every fixture must parse under the wrapper at
2020-12; every `example`/`canned payload` must validate against its schema (fixtures
ship *valid* examples; the broken ones are constructed in tests by mutation, never
committed as "broken examples"); leak lint covers deltas; the coverage test fails if a
fixture module exports an id not listed in the fixture-catalogue test.

### 4.4 Compatibility & diff engine (Capability B)

Pure functions, server- and browser-safe (`src/shared/contractDiff.ts`):

```
diffContracts(base: JsonSchema, candidate: JsonSchema, locus: 'request'|'response')
  → { verdict: 'breaking' | 'compatible' | 'review', findings: CompatibilityFinding[] }
```

**Algorithm.** Both documents are normalized by the wrapper's `normalizeSchema`
(local `$ref` resolution with ≤ 32 hops, cycle detection → deterministic error, node walk
≤ 2,000 nodes, depth ≤ 16). The two normalized trees are walked **in parallel by path
pair**; set operations on `required`/`enum`/`const` and key-set operations on
`properties`/`items` produce findings. Object schemas are compared property-wise; arrays
recurse into `items`; scalars reduce to keyword comparisons. `path` uses JSON Pointer.
Because locus is declared on the comparison (the learner picks or the exercise fixes it),
each rule below is applied with the correct direction semantics.

**Rule table (the contract — test-enforced; every rule id appears in ≥ 1 test):**

| Rule | Change (base → candidate) | Locus | Classification |
|---|---|---|---|
| R1 | `required` gains a property | request (producer-of-requests side tightens) | **breaking** — previously valid requests rejected |
| R2 | `required` loses a property | any | **compatible** (relaxation) |
| R3 | property removed from schema | response | **breaking** — consumers read a field that no longer exists |
| R4 | new property added (not required, not in base) | response | **compatible** (additive) — subject to R5 |
| R5 | new property added while `additionalProperties: false` AND consumer pins strict | response | **review** — additive on the wire; breaks strict closed-schema readers; always additive for request payloads is N/A |
| R6 | `type` narrowed (number→integer, string→`enum`, etc.) | any | **breaking** |
| R7 | `type` widened (integer→number, adding `"null"` to a non-nullable type) | any | **compatible** for readers; **review** for strict writers — classified **compatible** with a provider note |
| R8 | `enum` values removed | any | **breaking** — values previously emitted/accepted disappear |
| R9 | `enum` values added | response | **compatible** (provider may emit more); **review** if consumers keep a closed switch — always flagged **review** with explicit consumer-impact text |
| R10 | constraint tightened (`minimum`↑, `maximum`↓, `minLength`↑, `maxLength`↓, `minItems`↑, `maxItems`↓, `pattern` narrowed) | request | **breaking** (provider rejection surface grows) |
| R11 | constraint tightened | response | **compatible** (value set narrows; old consumer expectations still satisfied) — classified **compatible** with a reviewer note |
| R12 | constraint relaxed (all bounds loosen) | request | **compatible** |
| R13 | constraint relaxed | response | **breaking** — values may now violate consumer expectations written against the tighter bound (e.g. a consumer assumed `minimum: 1`) |
| R14 | `const` value changed | any | **breaking** — constant contract change |
| R15 | `additionalProperties`: `false`→`true` (request) | request | **compatible**; reverse (`true`→`false`) is **breaking** (payload rejection surface) |
| R16 | response `status` set loses a code | response | **breaking** |
| R17 | response `status` set gains a code | response | **compatible** (e.g. added 202/206); a changed *documented* code for the same outcome is covered by R14/R16 — see note |
| R18 | response media type changed (`application/json` → anything) | response | **breaking** |
| R19 | format changed (`date`→`date-time`: usually a widening; any other `format` change) | any | **review** — semantic change not expressible as sets; always human review; never auto-classified |
| R20 | `$ref` retargeted to a different component | any | **review** — follows R3–R14 transitively if resolvable, else always review |
| R21 | description/title/annotation-only change | any | *not a finding* — never reported (annotation-only deltas are invisible to consumers; listing them would drown signal) |

Verdict precedence: **any breaking ⇒ BREAKING**; else **any review ⇒ REVIEW REQUIRED**;
else **BACKWARD-COMPATIBLE**. Findings list is stable-sorted by (classification rank:
breaking < review < compatible, then path, then rule id) so output is byte-deterministic —
snapshot tests depend on it.

**Known limitations (documented, accepted):** the engine compares *structural* contracts,
not prose semantics; `pattern` narrowing detection is heuristic-free — any `pattern`
change is reported as **review** (R19-class), never claimed provably tighter/looser;
`unevaluatedProperties`/`unevaluatedItems` are unsupported and rejected with a clear
error if present (absent from every fixture by construction).

### 4.5 Consumer/provider expectation model (Capability C)

The consumer expectation **is a JSON Schema (2020-12)** — no new DSL, no YAML, no Pact
JSON. Definition used by the consumer workspace, the rubric (§4.5.2), and the capstone.

**4.5.1 Expectation shape (worked example, `contract-adv-consumer-expect-01` answer):**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["slug", "name", "priceCents", "currency", "stockStatus"],
  "properties": {
    "slug": { "type": "string" },
    "name": { "type": "string" },
    "priceCents": { "type": "integer", "minimum": 0 },
    "currency": { "const": "USD" },
    "stockStatus": { "enum": ["in_stock", "low_stock", "out_of_stock"] }
  }
}
```

Consumer-critical fields (from fixture metadata, learner-visible):
`slug`, `name`, `priceCents`, `currency`, `stockStatus`. **Not** required by this consumer:
`description`, `categorySlug`, `categoryName`, `id` — providers may change or drop those
without breaking this consumer. That is the teaching point.

**4.5.2 Consumer rubric (server-only, `src/server/consumerRubric.ts`, deterministic,
100 points):**

| Check | Points | Failure mode |
|---|---|---|
| C1 expectation parses and compiles as 2020-12 under the wrapper | 10 | invalid schema |
| C2 requires every consumer-critical field | 25 | missing critical requirement |
| C3 requires **no** non-critical field (minimalism) | 15 | demands provider extras |
| C4 types of critical fields match the provider schema (integer vs number vs string; enum/const preserved) | 20 | wrong type/enum/const |
| C5 `additionalProperties` is absent or `true` (open contract) | 10 | closed consumer schema |
| C6 expectation **passes** the provider v1 canned payload (status + body) | 10 | false negative |
| C7 expectation **fails** the provider v2-drifted payload (the rename) — proving it catches the drift | 10 | false positive (vacuous contract that matches anything) |

Pass ≥ 70; full pass = 100. C6/C7 execute against canned payloads shipped with the
fixture module — no live calls, deterministic. This rubric cannot award full marks for a
consumer schema that "matches everything" (`{}` fails C2/C7 reasoning) nor for one that
"matches only the full provider contract" (fails C3) — the two canonical failure modes
the exercise teaches.

**4.5.3 Verification request/response** (`POST /api/v1/contract/verify-consumer`):
request `{ expectation, providerFixtureId }` where `providerFixtureId ∈ {
`provider-product-v1`, `provider-product-v2-compatible`, `provider-product-v2-drift`,
`provider-product-v2-latest` }`. Response: `{ valid: boolean, statusOk: boolean,
assertions: ContractAssertion[], mismatchSummary?: string }`. The server chooses the
actual payload — `provider-product-v2-latest` **resolves server-side from the caller's
session** (bug-hunt mode for `hunt-contract-007` ⇒ the drifted delta; otherwise ⇒
v2-compatible). `provider-product-v2-drift` is the explicitly-named drill for
`contract-adv-consumer-broken-01` (any session; instructions reference the v2 change).
The drifted payload and delta strings never traverse the wire in either case — the
response is the assertion list only. No endpoint returns the raw drifted payload (§4.6).

### 4.6 Bug-hunt model — `kind: 'contract'`

Phase 7 reuses the Phase 3/4/6 engine verbatim; contracts add one defect locus (live API)
and one delta locus (fixture payload). No new attempt/report/hint/reveal machinery.

**Isolation rules (all inherited):**
- Hunts are code: `HUNTS` entries with `kind: 'contract'`, learner-safe `id`, `title`,
  `summary`, `scenarioId`; `defectIds` resolved server-only. `HUNT_ID_PATTERN` unchanged.
- `isDefectActive(c, 'CONTRACT-xxx')` — one branch site per defect in the response builders.
  Clean mode never reaches the defective branch (test-enforced, §12).
- `hunt_attempts` reused; hints/reveals reuse `learning.ts`; reports reuse
  `reportQuality.ts`; progress mapper extended, not rewritten.
- Contract hunts **do not consume the per-IP 20/UTC-day UI hunt-start cap** (consistent
  with `kind: 'sql'`: the cap exists for the interactive shop-hunt economy; contract
  hunts are API-surface exercises). They remain bounded by the global mutate backstop,
  the session TTL, and the `contract-*` scoped caps (§11). Flagged for maintainer
  confirmation (§18, D4).
- `hunt-contract-007`'s drifted provider payload is a **server-only compiled delta**
  (`src/server/contractDeltas.ts`); no endpoint ever returns it as a payload. It exists
  solely for two server-side consumers: the `provider-product-v2-latest` alias in
  `verify-consumer` (session-aware resolution, §4.5.3) and the `provider-product-v2-drift`
  branch used by the `contract-adv-consumer-broken-01` drill. The learner receives the
  *assertion list* naming `$.categoryName` — the designed evidence for both contexts —
  never the delta itself. The delta is never compiled into any client chunk.
  (The SQL seed delta mirrors this design with one difference forced by SQLite: the SQL
  delta *must* reach the browser because the sandbox applies it locally; the contract
  drift never needs to leave the server.)

**Defect containment for live-API defects (CONTRACT-001..006):** each branch alters only
the named operation's response construction; no other route reads the altered value; the
altered value is never persisted (read-time corruption only), so clean mode and
bug-hunt mode diverge exclusively in the activation-checked branch.

**Reset semantics:** leaving the hunt (`POST /api/v1/practice/session/reset`) restores
clean mode everywhere — the live-API defects vanish (they are per-request reads of session
mode) and the Capability C workspace stops receiving the drifted payload (same mechanism,
same request path). No database state is corrupted by any contract hunt; there is nothing
to restore beyond the session row, so "reset restores the broken baseline" is trivially
true and tested.

**Expected-vs-actual documentation:** internal-only in `docs/bug-hunt-catalogue.md`
(§Contract section), same discipline as Phases 3–6; `docs/bug-hunt-catalogue.md` gains the
section in the milestone; leak lint extended with all `CONTRACT-xxx` ids and every
reveal fragment.

### 4.7 Evaluation integration (deterministic, server-side)

**`POST /api/v1/contract/evaluate`** — mirrors `sql/evaluate` in shape and guarantees:

- `{ exerciseId, answer }` → `{ passed, score, checks[], feedback, attemptStatus }`;
  pass ≥ 70; **nothing the client sends can raise** a score — the rubric is compiled
  server-side from the exercise id; the submitted `answer` is data only.
- On pass: stamps the caller's attempt (`status: submitted`, `best_quality_score`-style
  running max into `best_quality_score` — the column already exists and is used by the
  SQL evaluator) in the same path; on fail: attempt stays `in_progress`.
- 401 no session · 404 unknown exercise · 400 malformed answer (per-exercise union) ·
  413 via global 32 KB cap · 429 `contract-eval:iphash` 30/min · 404 for malformed ids
  (`HUNT_ID_PATTERN` reused for the id shape; `CONTRACT_EXERCISES` registry is the
  truth).
- Answer union (discriminated by exercise kind):
  - `validate` exercises — `{ kind: 'validate', payload: unknown }`: server re-validates
    against the exercise's compiled expected assertion list (payload parse + node budget;
    **the payload itself is never stored**). Score from matched-expected-assertion rules.
  - `compare` exercises — `{ kind: 'compare', findings: string[] }` (learner selects which
    candidate findings are breaking/compatible) or `{ kind: 'classify', classifications:
    { [findingLocalId]: 'breaking'|'compatible'|'review' } }`: graded set-wise against
    the compiled diff output (exact classifier agreement per rule id; no partial credit
    for "right bucket, wrong finding").
  - `consumer` exercises — `{ kind: 'consumer', expectation: unknown }`: the C1–C7 rubric
    (§4.5.2) verbatim.
  - `structured` exercises — `{ kind: 'structured', selections: string[] }`: exact set
    match against the compiled answer key, with per-item feedback.
- 0 of the 24 exercises parse, execute or evaluate learner JavaScript/SQL/shell — the
  words "code execution" never appear in the implementation.

**Attempt targets** (`src/server/attemptTargets.ts`): `allAttemptTargets()` gains
`CONTRACT_EXERCISES` (24 entries, `kind: 'exercise'`), appended after `SQL_EXERCISES`;
`resolveAttemptTarget` falls through HUNTS → SQL → CONTRACT. `buildHuntEntries` is
unchanged in shape (iterates `allAttemptTargets()`); the progress UI gains a **Contract
Testing** section rendering the 24 exercises + 7 hunts, same row anatomy (status, best
score, hints used, attempts, last submission) with a per-row deep link to
`/contract/exercises/:exerciseId`.

**Hints/reveals**: `src/server/contractHints.ts` + `contractReveals.ts` — 24 three-level
ladders + 24 gated reveals (learner-safe hint text; server-only solution + explanation).
Reuses `learning.ts` routes unchanged.

### 4.8 Data model and migrations

**Migration `0013_contract_lab_schema.sql` — zero DDL: `app_meta.schema_version` 12 → 13
plus the standard header comment.** No `CREATE TABLE`, no `ALTER`, no `INDEX`, no new
column: `hunt_attempts` already stores every field Phase 7 needs (exercise ids ≤ 32
chars fit the TEXT id columns — verified: longest planned id
`contract-int-compare-additive-01` = 32 chars).

- Applied to **local** D1 during implementation only (`npm run db:migrate:local`); the
  `pre-migration export` + `schema_version` verification protocol from Phases 5/6 release
  discipline applies when the maintainer approves a production release. Phase 7 is
  **never** deployed inside implementation.
- Hashed-IP `rate_limit_buckets` rows for the new scoped caps appear organically via
  `consumeRateLimit` — no seed writes.
- **No new tables** (Charter: avoid unnecessary D1 migrations — a zero-DDL marker
  migration is retained only for release observability via `/api/health`, consistent with
  `0012`; maintainer may choose to skip it — §18 D2 documents the option and its
  trade-off: without it, health keeps reporting 12 while Phase 7 ships, which is harmless
  but ambiguous).
- `db/migrations/0013_contract_lab_schema.sql` itself is one `UPDATE app_meta ...` hunk.

## 5. API surface and OpenAPI updates

### 5.1 New server endpoints (exactly four)

All under `/api/v1/contract/`, implemented in `src/server/contract.ts`, registered in
`src/server/app.ts` after `sqlRoutes`. All four resolutions come from the caller's
`mpl_session` cookie; no
endpoint accepts a role, owner, defect, hunt, or exercise id from outside the path/registry
contract. Rate caps follow the Phase 6 scoped-bucket pattern (`consumeRateLimit`,
hashed IP, soft per-IP limit, `Retry-After` on 429).

| # | Endpoint | Body / params | Semantics | Caps / failure modes |
|---|---|---|---|---|
| 1 | `POST /api/v1/contract/validate` | `{ fixtureId, operationId?, payload }` | Validate `payload` (request **or** response, per fixture metadata) against the named fixture schema; returns learner-safe assertion list (all assertions, `shortCircuit: false`); on unknown fixture → 404; payload never stored or logged | body ≤ 32 KB (global cap); payload ≤ 24 KB + node/depth budget; `contract-validate:iphash` 30/min; 400 on malformed JSON; 429 |
| 2 | `POST /api/v1/contract/compare` | `{ baseFixtureId, locus, candidateFixtureId? }` **or** `{ baseFixtureId, locus, candidateSchema }` (mutually exclusive; learner-pasted candidate mode) | Runs the §4.4 diff; returns verdict + deterministic findings. Named-pair mode is what exercises use; inline mode powers the workspace's "paste candidate" tab | inline candidate ≤ 24 KB, depth ≤ 16, nodes ≤ 2,000, local `$ref` only (≤ 32 hops), `pattern` ≤ 256 chars; `contract-compare:iphash` 30/min; 400 schema-out-of-subset errors; 429 |
| 3 | `POST /api/v1/contract/verify-consumer` | `{ expectation, providerFixtureId }` | §4.5.3 verification against the canned provider payload; `provider-product-v2-latest` resolves server-side by caller session (hunt-contract-007 bug-hunt ⇒ drift; otherwise v2-compatible); returns `{ valid, statusOk, assertions, mismatchSummary? }` — assertions only, never the raw delta | expectation ≤ 24 KB; same node/depth/ref budgets; `contract-verify:iphash` 30/min; 429; the v2-latest alias is the single hunt-isolation seam (§4.6) |
| 4 | `POST /api/v1/contract/evaluate` | `{ exerciseId, answer }` | §4.7 scoring; pass ≥ 70; stamps attempt on pass | §4.7; `contract-eval:iphash` 30/min; 404 unknown exercise (id-shape check via `HUNT_ID_PATTERN`); 401 no session |

**No other routes change.** Existing 38 operations are untouched in semantics and shape
— the only edits are the additive §5.2 contract update and the six defect branch sites
inside existing response builders (§4.6/§9), each of which preserves clean-mode output
byte-for-byte (verified by the existing regression suites).

### 5.2 OpenAPI 3.1 updates (`public/openapi.json`)

- Four new `paths` entries: `/api/v1/contract/validate`, `/api/v1/contract/compare`,
  `/api/v1/contract/verify-consumer`, `/api/v1/contract/evaluate`, with full
  request/response schemas, scoped rate-limit notes, and the shared error envelope. New
  component schemas (`ContractAssertion`, `ContractAssertionListResponse`,
  `ComparisonFinding`, `ComparisonResponse`, `ConsumerVerificationResponse`,
  `ContractEvaluateRequest` (discriminated union), `ContractEvaluateResponse`) —
  all `additionalProperties: false`.
- `info.version` **1.1.0 → 1.2.0**. `servers`/`tags` unchanged; new tag `contract`.
- **No new error codes** — every error path reuses the existing closed `ErrorCode` enum
  (validated both directions by the existing contract test). Specifically: `400 →
  invalid_request`, `404 → not_found`, `401 → session_required`, `403 → not_hunt_mode`,
  `413 → payload_too_large`, `429 → rate_limited`, exercise unknown →
  `exercise_not_found`, reveal/evaluate gates → `reveal_locked`.
- New operation count: **38 → 42** (test-enforced both directions).
- `/openapi.json` remains the live provider contract — it is now *also* the artefact the
  browser validate workspace fetches (same-origin, exact-string match to `/openapi.json`,
  same whitelist discipline as the API Lab; no other URL is ever fetched).
- Security schemes unchanged (cookie + Bearer both ride the same `mpl_customer` /
  `mpl_session` trust boundary).

### 5.3 Endpoint error vocabulary for contract assertions

The workspace UIs render the server's assertion list with the same learner-safe language
in all three planes. Assertion `keyword` values are exactly the JSON Schema keywords
(`type`, `enum`, `const`, `required`, `minimum`, `maximum`, `minLength`, `maxLength`,
`minItems`, `maxItems`, `pattern`, `additionalProperties`, `format`, `$ref`). The wrapper
normalizes library error objects into `{ path (JSON Pointer), keyword, expected, actual,
message }`; messages are compiled, specific, and free of fixture internals (no
"returned fixture ledger-v2-breaking" phrasing learner-safe — fixture **ids** are
learner-visible by design; the drifted payload's defect nature is not).

## 6. Frontend routes, components, navigation

### 6.1 Routes (all lazy, inside `AppShell`, after `database/*`)

| Route | Component | Purpose |
|---|---|---|
| `/contract` | `ContractHubPage.tsx` | Hub: what contract testing is, three capability cards linking to workspaces, exercise catalogue grid with difficulty/facet filters (fundamentals / compatibility / consumer / bug hunts — `kind` facet), hunt cards, progress ring(s), "Start with…" path CTA |
| `/contract/validate` | `ContractValidatePage.tsx` | Capability A workspace: source picker (fixtures + live `/openapi.json` via same-origin fetch), operation picker (from selected fixture), payload editor (plain textarea + mono font; **no new editor dependency**), Validate → assertion list (path/keyword/expected/actual/why), copy-as-JSON button |
| `/contract/compare` | `ContractComparePage.tsx` | Capability B workspace: base/candidate fixture pickers + **paste-candidate inline mode**; verdict banner; findings list grouped breaking/review/compatible with Consumer/Provider impact blocks; copyable Markdown compatibility report |
| `/contract/consumer` | `ContractConsumerPage.tsx` | Capability C workspace: consumer profile picker; expectation editor (guided mode: checkboxes of critical fields → generated minimal schema; raw mode: textarea); Verify → status + assertions; **Break/fix toggle** (learner-safe selections only: v1, `provider-product-v2-compatible`, and the `provider-product-v2-latest` server-side alias, §4.5.3 — never the drift itself); mismatch panel |
| `/contract/exercises/:exerciseId` | `ContractExercisePage.tsx` | Guided exercise runtime: brief, success criteria, contextual workspace embedding (the matching Capability workspace in "exercise mode"), hint ladder, Check work, attempt chip, gated reveal, Reset — reuses Phase 4/6 components (`HintLadder`, `RevealPanel`, `AttemptStatusChip`, `EvaluationTransparency`) |

Five lazy chunks; each `≤ ~15 KB` gzip; hub ≈ 8 KB; total contract surface ≤ 60 KB gzip
incremental (enforced in §12/§13).

### 6.2 Navigation and catalogue wiring

- `src/lib/navigation.ts` — one new `primaryNav` entry **after Database**:
  `{ label: 'Contract Testing', to: '/contract', icon: 'contract', description: 'Validate and diff API contracts' }`.
  Icon `'contract'` already exists in `IconName` (used by API Reference and the
  track). Mobile nav and sidebar both read `primaryNav` — no second edit needed. No
  other nav changes; **API Reference and API Lab entries are unchanged** (Phase 5
  decision preserved).
- `src/data/tracks.ts` — `contract-testing` track: `plannedExerciseCount` 5 → **24**;
  `gettingStarted` steps rewritten to the shipped journey (validate live product →
  compare ledger v1→v2 → write consumer expectation); guide hook updated to
  `guide-contract-testing-basics` (refreshed, §6.4).
- `src/data/scenarios.ts`:
  - `contract-catalog-consumer` → `status: 'ready'`, `runnable: true`, wired to
    `contract-adv-consumer-expect-01` (consumer workspace
    + `/contract/consumer` CTA). Copy refreshed to the shipped exercise.
  - `contract-breaking-change` → `status: 'ready'`, `runnable: true`,
    `huntId: 'hunt-contract-007'`, wired to the compare workspace.
  - **Seven new wired hunt scenarios** (one per hunt, `mode: 'bug-hunt'`,
    `runnable: true`, `huntId` = the hunt id): `contract-hunt-missing-stock-status`,
    `contract-hunt-string-price-cents`, `contract-hunt-enum-casing`,
    `contract-hunt-204-cancel`, `contract-hunt-undocumented-property`,
    `contract-hunt-epoch-created-at`, `contract-hunt-consumer-drift` (the last maps
    `hunt-contract-007`).
  - `recommendedHuntScenarioIds` extended with the seven ids, difficulty-ascending.
  - `HUNT_CURRICULUM` gains learner-safe entries for the seven hunts (question, hypothesis,
    evidence, reported severity vocabulary reused verbatim).
- `tests/data/content.test.ts` — hunt counts (10 UI + 8 SQL + 7 contract = **25**) and
  wiring assertions updated in the same commit as the catalogue change.
- `/practice` — the "Recommended path" gains a contract node sequence after the API and
  database sequences (ids difficulty-ascending, from `src/lib/recommendedPath.ts`).

### 6.3 `/progress` (ProgressPage + `ProgressDashboard`)

- New **Contract Testing** section below Database Testing — same row anatomy: title,
  scenario deep link where wired, status chip, best score, hints, attempts, last
  submission, per-row link to `/contract/exercises/:exerciseId`.
- Totals/rows derivation unchanged (server already aggregates all attempt targets).
- Database and API sections unchanged; Phase 4 semantics (guest ephemeral / account
  durable) unchanged.

### 6.4 Guides

- `guide-contract-testing-basics` — refreshed in place: current content explains the
  topic survey; new sections map to the three capabilities and link the workspaces and
  first exercises (`contract-bgn-required-01`, `contract-adv-consumer-expect-01`);
  keeps its id (all `relatedGuideIds` references stay valid).
- New `guide-consumer-driven-contracts` — focused guide: consumer expectations as
  minimal schemas, provider verification, break/fix walkthrough with the ledger
  fixtures, "when contract tests beat end-to-end tests" decision notes. Linked from the
  consumer workspace, the advanced exercises, and the track.
- `relatedGuideIds` wired on all 24 exercises + 7 scenarios.

### 6.5 Accessibility and UX requirements (must-pass gates)

- Both themes; 375 / 768 / 1024 / 1440 px; zero horizontal overflow; every interactive
  control keyboard-operable; visible focus states; `prefers-reduced-motion` respected;
  assertion lists rendered as structured lists (not raw JSON) with the JSON available via
  copy; monospace only for code; minimum 4.5:1 text contrast (Phase 2.5 tokens applied).
- Workspaces handle: loading contract, malformed payload (inline error, not a crash),
  oversized paste (hard cap with notice), empty results, and hunt-mode banners
  ("Bug-hunt mode — the provider is intentionally deviating") exactly as SQL workspaces do.
- No emoji-as-icons; no `dangerouslySetInnerHTML` (leak-lint scanned); user payload
  rendered as text only.

## 7. Complete exercise catalogue (24 — contract, test-enforced)

### 7.1 Exercise model (identical anatomy to Phase 6)

Every exercise is a typed definition in `src/data/contractExercises.ts` (client-safe
prompt data) with a server twin in `src/server/contractExercises.ts` (compiled rubric +
server-only reference answer/explanation). Shared ids `contract-<level>-<topic>-<nn>`,
≤ 32 chars. Common fields: `id`, `title`, `qaScenario` (one-paragraph QA framing — why a
tester runs this), `objective`, `difficulty`, `estimatedMinutes`, `kind` (`validate |
compare | consumer | structured`), `locus?` (`request | response`), `fixtureId`,
`task`, `chips` (e.g. `['additionalProperties:false', 'required×9', 'enum']`),
`exampleEvidence`, `relatedGuideIds`, `qaTag?` (not used — see §8 note), `kind` facet for
the hub: Contract fundamentals / Compatibility / Consumer-driven / Multi-operation.

- All exercises: 3-level progressive hints (`contractHints.ts`), server-only reference
  solution + explanation (`contractReveals.ts`), pass ≥ 70, attempt-stamping on pass,
  deterministic evaluation, no exact-string matching anywhere (structured exercises match
  answer *sets*, not prose).
- Difficulty progression is advisory (badges + recommended order), never locked; no
  streaks/speed pressure (Phase 4 philosophy).
- Hub facets: All / Fundamentals / Compatibility / Consumer-driven / Multi-operation.

### 7.2 Topic coverage matrix (charter topics → exercise ids)

| Charter topic | Exercises | Level | Kind |
|---|---|---|---|
| OpenAPI document structure (paths, operations, components, `$ref`) | contract-bgn-openapi-01 | Beginner | structured |
| Required vs optional properties | contract-bgn-required-01 | Beginner | validate |
| Type violations (string/integer/number/boolean) | contract-bgn-types-01 | Beginner | validate |
| `format` violations (`date-time`, `email`) | contract-bgn-formats-01 | Beginner | validate |
| `enum`, `const` violations | contract-bgn-enum-01 | Beginner | validate |
| Status codes (2xx/4xx semantics, 200 vs 201 vs 204) | contract-bgn-status-01 | Beginner | structured |
| Content types (`application/json`, charset, 415) | contract-bgn-contenttype-01 | Beginner | structured |
| First live contract test (captured real response) | contract-bgn-live-products-01 | Beginner | validate |
| Nested objects and arrays (`items[]` deep assertion paths) | contract-int-nested-01 | Intermediate | validate |
| Request validation (CheckoutRequest-equivalent fixture) | contract-int-request-01 | Intermediate | validate |
| Response validation (OrderSummary-like fixture, missing required) | contract-int-response-01 | Intermediate | validate |
| `const` + `additionalProperties: false` (strict closed schemas) | contract-int-const-01 | Intermediate | validate |
| Constraints (`minimum`, `maximum`, `pattern`, `minLength`) | contract-int-constraints-01 | Intermediate | validate |
| `$ref` resolution / reusable schemas (by hand) | contract-int-refs-01 | Intermediate | structured |
| `type: [string, "null"]` nullable fields (`cancelledAt`) | contract-int-nullable-01 | Intermediate | validate |
| Additive change classification (backward-compatible) | contract-int-compare-additive-01 | Intermediate | compare |
| Enum widening — ambiguous for closed-set consumers (review) | contract-int-compare-enum-01 | Intermediate | compare |
| Breaking change — newly required property | contract-adv-breaking-req-01 | Advanced | compare |
| Breaking change — type change | contract-adv-breaking-type-01 | Advanced | compare |
| Breaking change — removed property | contract-adv-breaking-remove-01 | Advanced | compare |
| Write a consumer expectation for `getProduct` | contract-adv-consumer-expect-01 | Advanced | consumer |
| Consumer triage: provider drift vs contract — file the report | contract-adv-consumer-broken-01 | Advanced | consumer |
| Multi-operation capstone (summary → request → order detail) | contract-adv-checkout-flow-01 | Advanced | validate |
| Full v1→v2 compatibility review (breaking-change summary, both perspectives) | contract-adv-versioning-01 | Advanced | compare |

Total: 8 beginner + 9 intermediate + 7 advanced = **24**. The coverage matrix is the
contract (as in Phase 6); content tests enforce the count, the difficulty split, id
uniqueness, and longest-id ≤ 32 chars.

### 7.3 Exercise catalogue with evaluation behaviour

| Id | Title | Evaluation (compiled server rubric) | Related hunt |
|---|---|---|---|
| contract-bgn-openapi-01 | Read the contract like a tester | structured: learner maps 5 operations → their response schema names + finds 2 broken `$ref`s; set match | — |
| contract-bgn-required-01 | Which properties are required? | validate: payload missing `priceCents`; expected assertion `$.priceCents required` fires; answer must select the correct failing-path list (structured sub-step) | hunt-contract-001 |
| contract-bgn-types-01 | Spot the type lie | validate: payload with `priceCents: "2400"`; the `$.priceCents type` assertion must fire; learner also fixes the payload to pass (two-stage answer, both graded) | hunt-contract-002 |
| contract-bgn-formats-01 | Dates and emails are not strings | validate: two payloads (bad `postedAt`, bad `email`); `format` keyword assertions must be identified | hunt-contract-006 |
| contract-bgn-enum-01 | Only these values exist | validate: `stockStatus: "IN_STOCK"`; `enum` assertion fires; learner picks the full valid value set | hunt-contract-003 |
| contract-bgn-status-01 | The right number for the job | structured: match 6 endpoint/behaviour pairs to codes (200/201/204/400/404/415) | hunt-contract-004 |
| contract-bgn-contenttype-01 | JSON is a media type, not a vibe | structured: identify which of 4 responses violates the documented media type and why | hunt-contract-004 |
| contract-bgn-live-products-01 | Your first live contract test | validate: learner captures a real `/api/v1/products` response (guided capture step), pastes it, and selects the 3 assertions worth pinning as a regression test | hunt-contract-005 |
| contract-int-nested-01 | Into the array | validate: `OrderDetail`-mini fixture; nested assertion path `$.items[1].quantity minimum` identified + payload fixed | hunt-contract-002 |
| contract-int-request-01 | The request is also a contract | validate: `CreateEntryRequest` with amount `-50` and missing `entryId`; `minimum` + `required` fire; both found = full marks | hunt-contract-004 |
| contract-int-response-01 | The response lies by omission | validate: OrderSummary-like payload missing `createdAt`; all failing assertions listed | hunt-contract-001 |
| contract-int-const-01 | One constant to rule them all | validate: `currency: "usd"` and `additionalProperties` extra `"debug"` field; `const` + `additionalProperties` fire | hunt-contract-005 |
| contract-int-constraints-01 | Numbers with opinions | validate: 4 constraint violations across `minimum`/`pattern`/`minLength`/`maximum`; identify keyword per violation | — |
| contract-int-refs-01 | Follow the reference | structured: given 3 `$ref` chains, resolve each to the final concrete schema name + list one guaranteed property | — |
| contract-int-nullable-01 | The honest null | validate: `cancelledAt` present-but-null passes; absent fails; `type` array semantics explained | — |
| contract-int-compare-additive-01 | The change that broke nothing | compare: `ledger-v1` vs `ledger-v2-compatible`; learner classifies all findings correctly | hunt-contract-005 (inverse) |
| contract-int-compare-enum-01 | Wider enum, worried consumers | compare: enum widening finding classified **review** with correct consumer-impact reason selected | hunt-contract-003 (inverse) |
| contract-adv-breaking-req-01 | New rule, no warning | compare: `ledger-v1` vs `ledger-v2-required`; `required` addition classified breaking; consumer/provider notes selected | — |
| contract-adv-breaking-type-01 | When the number became a string | compare: `amountCents` integer→string finding classified breaking (R6) | hunt-contract-002 (inverse) |
| contract-adv-breaking-remove-01 | The property that vanished | compare: `settledAt` removal classified breaking (R3); `enum` narrowing in same candidate also found (bonus path, scored in part c) | hunt-contract-001 (inverse) |
| contract-adv-consumer-expect-01 | Write the smallest contract that bites | consumer: C1–C7 rubric (§4.5.2) against `provider-product-v1` | — |
| contract-adv-consumer-broken-01 | Who broke the contract? | consumer + structured report: given the drifted payload, identify which expectation assertions fail, classify the drift (R-rule), and draft the one-line reviewer comment | hunt-contract-007 |
| contract-adv-checkout-flow-01 | The whole journey, three contracts | validate: capstone — learner validates summary → request → detail captures; 8 seeded violations across 3 canned captures; per-capture assertion lists graded | hunt-contract-006 |
| contract-adv-versioning-01 | The compatibility review | compare: `ledger-v1` vs `ledger-v2-breaking`; full breaking-change summary with all classifications correct + both perspectives (consumer/provider) for the top finding | hunt-contract-007 |
| | | **Total: 24 exercises · 8 hunt-linked** | |

### 7.4 Exercise-to-bug-hunt relationships

Seven of 24 exercises rehearse the exact failure pattern one of the hunts then makes
live (`hunt-*` column above). The remaining 17 teach structure/formats/refs/consumer
writing/compare-in-clean-mode. The pairing is intentional and documented — learners who
complete the exercise and then the hunt see the same defect from two angles (guided vs
unguided). No exercise requires a hunt to have been started.

## 8. Contract bug-hunt catalogue (7 hunts, `kind: 'contract'`)

> Internal expected-vs-actual for each defect is recorded in `docs/bug-hunt-catalogue.md`
> (§Contract) during the milestone and is never shipped client-side. Hunt learner-safe
> surfaces are only `id`, `title`, `summary`, `scenarioId` — identical discipline to
> Phases 3–6. All seven flip ready/runnable in the milestone; all seven reuse the
> attempt/report/hint/reveal/progress pipeline unchanged.

| Hunt | Defect | Surface | Clean mode | Bug-hunt mode | Learner evidence & evaluation |
|---|---|---|---|---|---|
| `hunt-contract-001` | `CONTRACT-001` | `GET /api/v1/products/{slug}` response body | `stockStatus` present (required); validator green | `stockStatus` omitted from the response; every consumer of the documented contract breaks — `$.stockStatus required` fires | Learner captures + validates against the contract; failing assertion identifies the missing required property; report scores on missing-field + contract references; severity learner-chosen |
| `hunt-contract-002` | `CONTRACT-002` | `GET /api/v1/products` (+detail) `priceCents` | integer cents | serialized as JSON string (`"2400"`); JS-tolerant consumers still render — the contract test is what catches it | `$.priceCents type` assertion (expected integer, actual string) is the smoking gun; report ties type-contract to money precision |
| `hunt-contract-003` | `CONTRACT-003` | `GET /api/v1/products` `stockStatus` | `in_stock\|low_stock\|out_of_stock` | emitted `IN_STOCK` (casing drift outside the enum) | `$.stockStatus enum` assertion; teaches enum as exhaustive vocabulary; cross-ref exercise contract-bgn-enum-01 |
| `hunt-contract-004` | `CONTRACT-004` | `POST /api/v1/orders/{reference}/cancel` | `200` + `OrderDetail` JSON body (documented) | `204 No Content` + empty body — HTTP-legal, contract-breaking; documented reader expecting `OrderDetail` gets nothing | Status-code assertion + "documented 200 vs actual 204" in the report; teaches status as part of the schema, not an afterthought |
| `hunt-contract-005` | `CONTRACT-005` | `GET /api/v1/products` list items gain undocumented `supplierCostCents` | no such field (`additionalProperties: false` passes) | extra field present; strict closed-schema consumers (`additionalProperties: false`) reject the whole payload; permissive consumers pass silently | The nuance hunt: additive is **compatible** per OpenAPI, **breaking** for strict readers — learner must classify, not panic; ties R4/R5/R15 |
| `hunt-contract-006` | `CONTRACT-006` | `GET /api/v1/orders` + `GET /api/v1/orders/{reference}` `createdAt` | ISO-8601 `date-time` string | epoch-seconds **integer** (`1763308800`) — format drift that passes type readers if untyped | `$.createdAt format` (expected date-time, actual integer — two keywords fire: `type` and `format`); teaches `format` as the date contract |
| `hunt-contract-007` | `CONTRACT-007` | Consumer workspace / `POST /api/v1/contract/verify-consumer` provider payload | `provider-product-v2-latest` resolves to the additive v2 fixture; expectations pass | **fixture-delta locus**: the same alias resolves to the server-only drifted payload (`categoryName`→`category`, plus `stockStatus` casing) inside `verify-consumer`, session-aware (§4.5.3/§4.6); learner's saved expectation assertions fail on the rename | Provider-fixture verification flips red; learner triages *which side moved* (consumer vs provider), classifies (R3 via reference), files the report; the only hunt requiring the compare/consumer workspace rather than the live API |

**Hunt coverage vs charter examples:** missing required field (001) ✓ · incorrect type
(002) ✓ · incompatible schema change (005+007) ✓ · status code violation (004) ✓ ·
consumer expectation provider no longer satisfies (007) ✓ · undocumented response
variation (005) + enum/format drift (003/006) ✓ — seven hunts, six distinct root-cause
classes, no superficial variation pairs (001/005 are deliberately distinct: *absence* of a
required property vs *presence* of an undocumented one — both break strict readers, for
opposite algebraic reasons).

**Clean/hunt isolation (per hunt):** 001–006 — `isDefectActive` branch at the named
response builder only; 007 — server-only delta + hunt-session gate. Reset
(`POST /api/v1/practice/session/reset` or leaving the hunt) restores clean behaviour
everywhere immediately (read-time activation, nothing persisted). Test matrix in §12
asserts clean outputs for all seven are byte-identical to `main` today.

**Evaluation criteria (all seven):** reports go through the existing deterministic rubric;
the **expected failing assertion is hunt-specific** — the reveal (gated) names the
assertion path and keyword (e.g. `$.priceCents type`), not just "it broke". In bug-hunt
mode the workspace banner says the provider is intentionally deviating; the learner picks
the evidence standard.

## 9. Evaluation strategy (deterministic; no AI in the scoring path)

- **One evaluator, four rubric families** (§4.7): `validate` (match expected assertion
  multiset — every expected assertion present + no missed required ones; distractor
  selections cost points), `compare`/`classify` (set-wise rule-id agreement; partial
  credit per correct classification × 70% weight, completeness × 30%), `consumer` (C1–C7,
  §4.5.2), `structured` (exact set match with per-item feedback).
- **Pass ≥ 70; full marks = 100; feedback is assertion-specific** ("`$.createdAt` —
  `type` — expected string (date-time), actual integer") never generic ("close but not
  quite"). All feedback strings compile from server-only definitions; the leak lint
  guards them.
- **Reference solutions are test-enforced**: a test runs all 24 compiled reference answers
  through the real evaluator and requires 100/100 (or 24/24 `passed`); a second test feeds
  one canonical *plausible-wrong* answer per exercise and requires rejection. This is the
  "reference solutions pass deterministic evaluation / incorrect solutions are rejected"
  gate, identical in spirit to Phase 6's 36/36 + wrong-answer suites.
- **Attempt stamping:** pass → attempt `submitted` + running-max `best_quality_score`
  (Phase 4 column) + discovered sticky semantics for hunts; fail → stays `in_progress`.
  Guest attempts die with the 7-day session; account attempts persist — unchanged.
- **Progress:** unchanged aggregation over all attempt targets; Contract Testing section
  on `/progress`; recommended-path ordering by difficulty; totals `/100` and discovery
  counts reuse existing shapes.
- **Hints/reveals:** 3-level ladders per exercise; reveal gated until submit/give-up;
  contract reveals name the mechanism and the fix, never just the answer; give-up grants
  no pass and no discovery.
- **No AI anywhere** in evaluation, hints, reveals, or feedback — matching the Phase 4
  constraint and product principle 5.

## 10. Security and privacy considerations

1. **Untrusted-input surface is data-only.** All four workspaces accept JSON *data*;
   nothing is compiled, `eval`-ed, or executed. The only "compiled" artefacts are schemas
   validated by an interpreter with pre-budgets. There is no code-execution path for
   learner input anywhere in Phase 7 — verified by grep gates in CI/review (§12).
2. **Complexity caps on every schema operation** (server and client, uniform through the
   wrapper): input bytes (24 KB candidate/expectation/payload; global 32 KB body cap
   unchanged), depth ≤ 16 (schemas) / ≤ 32 (payloads), nodes ≤ 2,000 (schemas) / ≤ 5,000
   (payloads), `$ref` hops ≤ 32 with cycle detection, local refs only (remote/absolute
   `$ref` rejected with `invalid_request`), `pattern` ≤ 256 chars, `maxItems`/`maxLength`
   honored as *declared* constraints (not as validator loops), `shortCircuit: false`
   bounded by the node budget. No unbounded recursive processing is reachable.
3. **No external fetching.** The validate workspace fetches only the literal string
   `/openapi.json` (same-origin) — same whitelist discipline as the API Lab (external
   URLs/unsafe schemes refused pre-fetch, verified in-browser historically and re-probed
   for the new workspace in the milestone). No server-side URL is accepted anywhere;
   `fetch`/`Request` are never constructed from learner input.
4. **Parser safety:** `JSON.parse` only — no YAML, no JSON5, no comments. Payloads are
   rendered as text (`textContent`/React children), never `dangerouslySetInnerHTML`.
5. **DoS budgeting:** scoped per-IP caps on all new POST routes (30/min each; §11);
   global mutate backstop unchanged; body 32 KB; Workers CPU bounded by the node budgets;
   no D1 writes on validate/compare/verify routes; evaluate stamps at most one
   attempt row per pass.
6. **Information boundaries (bug hunts):** defect ids/expected-vs-actual never leave the
   server (code registry); the hunt-007 drifted payload is a server-only compiled delta
   with **no payload-returning endpoint** — learners receive assertion-path evidence only;
   hint/reveal leak lint extended (solution strings, `CONTRACT-xxx`, delta strings);
   fixture *ids* are learner-visible by design (`provider-product-v2-drift` names the
   drill exercise) but reveal no assertion outcomes or prose answers.
7. **AuthN/AuthZ boundaries unchanged:** no route is public-by-default; session cookie
   (or, where already supported, Bearer — unchanged resolution) required for evaluate and
   for the hunt-007 delta branch inside verify-consumer; staff routes untouched; no role
   logic added.
8. **SSRF/provider-testing:** there is no "test a real provider" capability — no URL
   inputs, no headers forwarding, no webhook/callback URL handling. Explicit non-goal
   (§15). Provider verification executes against canned fixtures only.
9. **Synthetic data:** all fixtures describe fictional entities (Meridian Ledger; POS
   adapter; candidate payloads). No real customer, account, token, or PII anywhere;
   canned payloads carry no real-looking personal data.
10. **SQL-worker isolation preserved:** Phase 6's boundary is untouched — no contract
    route accepts SQL text, no WASM/SQLite interaction is added or relaxed; the SQL caps
    and the browser-worker rule remain in force verbatim.
11. **Privacy:** no new personal-data collection (attempt rows only, already governed by
    the 7-day guest session TTL and Phase 4 retention); markdown reports are generated
    client-side; the server never receives report Markdown; hunt reports (structured
    bug reports) reuse the existing minimal schema (no free-text PII guidance needed
    beyond what Phase 4 shipped).
12. **License hygiene:** the new dependency (`@cfworker/json-schema`, MIT, no transitive
    deps) is recorded; its copyright notice rides in `node_modules` per standard
    practice; THIRD-PARTY obligations satisfied by the existing lockfile workflow.

## 11. Free-tier and abuse constraints

| Resource | Consumption |
|---|---|
| Pages Functions requests | +4 POST routes (validate/compare/verify/evaluate) — all under **30/min per-IP scoped caps** (`contract-validate`, `contract-compare`, `contract-verify`, `contract-eval`) on top of the global 120/min mutate backstop; expected steady state ≈ a few requests/learner/hour |
| Worker CPU (10 ms free) | Interpreter validation of ≤ 24 KB input with ≤ 2,000-node budget ≈ low single-digit ms; no warm-up effect; measured in the milestone (p95 on 1,000-run local benchmark recorded in the exit audit — target p95 ≤ 5 ms; if exceeded, the node budget is tightened, not the timeout) |
| D1 reads/writes | **Zero new tables.** evaluate stamps ≤ 1 write per pass (same shape as SQL evaluate); the hunt-007 verify path costs 1 session read, 0 writes; validate/compare/verify: 0 D1 ops otherwise. Daily writes unchanged from Phase 4 baselines |
| Bundle size | +≤ 60 KB gzip lazy chunks; index chunk must remain byte-identical (verified via `du`/`vite build --mode` output comparison in the exit audit); WASM untouched |
| Static assets | Fixtures are compiled-in TS modules, not assets — no `dist/` growth except lazy chunks; 25 MiB/file limit far away |
| Pages builds | One implementation branch; build minutes unchanged |
| Rate-limit buckets | New scoped bucket names (`contract-*`) coexist in `rate_limit_buckets`; old buckets unchanged; no migration required for buckets |

**Kill-switch posture:** every new 429 path is independent; the existing staff-only
`/api/v1/admin/maintenance/sweep` needs no change (it owns `rate_limit_buckets` cleanup by
age already); no cron is introduced.

## 12. Testing strategy

### 12.1 Test layers and budget (target ≈ +150 tests; total ≈ 1,250+)

1. **Wrapper unit tests** — valid/invalid matrix per keyword (type incl. arrays + null,
   enum, const, required, additionalProperties true/false/absent, minimum/maximum/
   exclusive*, minLength/maxLength, pattern, minItems/maxItems, items recursion,
   format email/date-time (pass/fail/edge), `$ref` resolution (found / hop-limit /
   cycle), node-budget trip, depth-budget trip, remote `$ref` refused, 2020-12 dialect
   selection, `shortCircuit: false` ordering, determinism (byte-stable output)).
2. **Diff engine unit tests** — every rule R1–R21 with ≥ 1 positive and 1 negative case
   (≈ 50 cases); locus × classification grid; verdict precedence (breaking > review >
   compatible); deterministic ordering snapshot; self-diff ⇒ zero findings;
   annotation-only deltas ⇒ zero findings (R21).
3. **Consumer rubric unit tests** — C1..C7 each pass/fail/partial; canonical failure
   modes (empty schema, full-schema clone, wrong critical type, closed
   `additionalProperties:false`, v1-passing/v2-passing vacuous contract); 100/100 for the
   reference answer.
4. **Exercise suite** — 24/24 reference solutions pass the real evaluator; 24 plausible-
   wrong answers rejected; rubric boundaries (69/70); binary exercises all-or-nothing;
   feedback specificity snapshots (no generic strings); id matrix (count, split, lengths,
   uniqueness, coverage matrix matches §7.2).
5. **Fixture integrity** — every fixture parses; canned payloads validate against their
   schemas; v2-compatible is classified compatible; v2-breaking yields exactly the
   curated finding set; fixture catalogue matches exported modules; fixtures never
   import server modules (dependency direction lint).
6. **Server tests (fake-d1)** — the four endpoints: happy path, auth (401/404
   indistinguishable out-of-session / wrong-hunt), body cap (413), scoped caps (429 +
   `Retry-After`), malformed input (400), the hunt-007 session-aware alias matrix (clean
   ⇒ additive fixture; hunt-007 bug-hunt ⇒ drift; explicit `provider-product-v2-drift`
   accepted anywhere and assertions name `$.categoryName`; non-contract hunt / clean alias
   ⇒ additive; assertions-only responses — never the raw delta), attempt stamping (pass
   stamps, fail does not, idempotent double-pass, cross-customer isolation), progress
   mapper includes contract targets.
7. **Hunt containment** — clean-mode response bodies for all six live-API surfaces
   byte-identical pre/post activation paths (existing regression suites stay green);
   `isDefectActive` returns false outside hunt sessions; defect branches unreachable
   without session+hunt; 007 delta strings absent from `dist/` and from every clean API
   response (leak lint).
8. **OpenAPI contract tests** — 42 operations, both directions; 4 new paths documented;
   no new `ErrorCode`; `additionalProperties: false` everywhere; `info.version` 1.2.0;
   leak lint (no `CONTRACT-xxx`, no solution strings) across the bundle.
9. **Progress/wiring tests** — `buildHuntEntries` includes the 24 + 7; totals include
   them; `/progress` SSR markup shows the Contract Testing section; recommended-path
   order inserts contract nodes difficulty-ascending.
10. **Browser verification (CDP, production build)** — hub renders; validate flow green +
    red paths; compare flow (fixture pair) shows verdict banner and findings; consumer
    workspace break/fix toggle; guided exercise end-to-end (start → hints (409 on skip) →
    submit (score) → reveal unlocked); reset isolation; hunt-contract-001..006 each
    reproducible in bug-hunt mode and absent in clean mode; hunt-contract-007 alias
    swap (clean workspace shows additive v2 demo; hunt workspace fails on `$.categoryName`);
    both themes × 375/768/1024/1440; zero console
    errors; reduced-motion clean; zero horizontal overflow.
11. **Leak scan** — `dist/` grep for `CONTRACT-xxx`, delta strings, reveal texts ⇒
    zero hits; `tests/lib/hint-reveal.test.ts` extended.

### 12.2 Acceptance coverage of the exit criteria

Each §16 exit criterion maps to ≥ 1 automated or probe check above; the criterion itself
is binary (PASS/FAIL) — no "works correctly" language. The milestone closes with a
criterion-by-criterion audit document (`docs/phase-7-exit-audit.md`), following the
Phase 5/6 audit format (explicit verdicts, evidence, deviations, skipped-checks
disclosure).

## 13. The one implementation milestone — `P7 — Contract Testing Lab` (one session)

**One complete milestone per focused OpenCode session.** No WP1/WP2/WP3 sessions; no
pull-request splitting inside Phase 7. The six blocks below are an *ordered checklist
inside one session* — dependency order, not session boundaries. If model context/credits
are insufficient, the session stops at a clean checkpoint with a precise
`PROJECT_STATE.md` note (done/verified/remaining/exact commands) and **does not claim
completion** or carve ad-hoc work packages.

**Branch:** `feat/phase-7-contract-testing-lab` created from current `main`.
**Non-goals inside the session:** no push, PR, merge, deployment, production D1 access,
or `--remote` migration — those remain separate, explicitly approved steps.

### 13.1 Ordered implementation checklist

**Block 1 — Validation engine and technical foundations**
1. `src/shared/contractTypes.ts`, `src/shared/contractValidation.ts` (wrapper + budgets),
   `src/shared/contracts/*.ts` fixtures (six client-safe modules + one server-only delta, §4.3).
2. `src/server/contract.ts` — endpoint 1 (`validate`); register in `app.ts`;
   scoped rate caps; shared `ContractAssertion` mapping; tests §12.1.1/6 (partial).
3. Browser: `src/features/contract/` skeleton (SourcePicker, AssertionList components),
   `/contract/validate` page (fixture + live `/openapi.json` sources), route + lazy chunk;
   verify live-fetch whitelist refuses external URLs (in-browser probe).
4. `npm run check` green at this point (additive).

**Block 2 — Contract versioning and compatibility analysis**
5. `src/shared/contractDiff.ts` — normalize (local `$ref`, hops ≤ 32, cycle error,
   budgets), rule table R1–R21, verdict + deterministic ordering; tests §12.1.2 (≈ 50).
6. Endpoint 2 (`compare`) in `contract.ts` with locus semantics + inline-candidate mode;
   tests; `/contract/compare` page (verdict banner, findings by classification, impact
   blocks, copyable Markdown report); route + chunk.

**Block 3 — Consumer/provider testing**
7. `src/server/consumerRubric.ts` (C1–C7) + `src/server/contractDeltas.ts` (server-only
   drifted payload for hunt-contract-007) + endpoint 3 (`verify-consumer`) with the
   session-aware `provider-product-v2-latest` alias (§4.5.3) — one isolation seam;
   tests §12.1.3/6.
8. `/contract/consumer` page (profile picker, guided + raw expectation editors, Verify,
   break/fix toggle wired to the `provider-product-v2-latest` alias (server-side
   session-aware resolution, §4.5.3), mismatch panel).

**Block 4 — Exercises, evaluation and bug hunts**
9. `src/data/contractExercises.ts` (24 client-safe defs) + `src/server/contractExercises.ts`
   (24 compiled rubrics + server-only reference answers/explanations) +
   `contractHints.ts` (72 levels) + `contractReveals.ts` (24) — registry/test invariants
   (count, split, ids, 32-char cap, coverage matrix).
10. Endpoint 4 (`evaluate`) with the four rubric families + attempt stamping;
    `attemptTargets.ts` extension; `HUNTS` += 7 `kind: 'contract'` entries (the six
    live-API hunts carry `defectIds: ['CONTRACT-00x']`; `hunt-contract-007` carries
    `defectIds: []` exactly like the SQL hunts); `defects.ts` += **6** server-only
    `CONTRACT-001..006` definitions with exactly one `isDefectActive` branch site each
    in the product/order response builders (chip/serialization/enum/status/undocumented
    field/format); `contractDeltas.ts` holds the 007 drift, compiled server-side only,
    consumed solely server-side by the two `verify-consumer` paths (§4.6).
11. `0013_contract_lab_schema.sql` (zero-DDL `app_meta` 12→13) applied locally only;
    `docs/bug-hunt-catalogue.md` §Contract; leak-lint extension; hunt parse/wiring tests.

**Block 5 — Learning UI, reporting and progress integration**
12. `/contract` hub page (capability cards, exercise grid with facets, hunt cards, rings,
    recommended start) — reuse Phase 6 hub idioms; `/contract/exercises/:exerciseId`
    guided runtime embedding workspace behaviours per exercise `kind`; nav entry
    (`contract` icon) after Database; `/progress` Contract Testing section (server mapper
    unchanged, new section UI); `/practice` recommended path contract sequence;
    `scenarios.ts` rewires (2 existing + 7 new wired hunt scenarios) +
    `recommendedHuntScenarioIds` + `HUNT_CURRICULUM`; `tracks.ts` count 5→24 +
    `gettingStarted` rewrite; guides refresh + new guide; `content.test.ts` counts
    (25 hunts); OpenAPI 42 ops + `info.version` 1.2.0 + 4 documented paths; API Reference
    unchanged visually (contract-driven); `/api-lab` unchanged.
13. Bundle budget check (`du` before/after; index chunk byte-identical); lazy-chunk
    smoke (hub + 4 workspaces import cleanly; no eager `@cfworker` in index chunk).

**Block 6 — Security review, regression and final verification**
14. Security pass: grep gates (`eval`, `new Function`, `dangerouslySetInnerHTML`, remote
    `$ref` acceptance, external fetch), leak scan of `dist/`, auth matrices (401/403/404),
    hunt containment sweep (§12.1.7), body-cap re-verification (413), scoped-cap live
    check (429 + `Retry-After`).
15. Full `npm run check` (green) + `npm run build` (clean); browser CDP probe suite
    (themes × 4 widths; hub/validate/compare/consumer/exercise/hunt × clean+hunt;
    18+ checks; zero console errors); reduced-motion pass.
16. `docs/phase-7-exit-audit.md` — criterion-by-criterion (§16) with evidence;
    `PROJECT_STATE.md` §1/§9/§11/§16 + README production-line paragraph; `AGENTS.md`
    status line; commit as **one focused commit** (`feat: add phase 7 contract testing lab`).
17. **Stop at the milestone boundary.** No push/merge/deploy/release without separate
    explicit maintainer approval (Phase 5/6 release protocol: pre-migration export →
    `0013` on production D1 → deploy → production acceptance with skipped-check
    disclosure).

**Estimated size:** ~70–80 source files touched or added, +≈150 tests, +≈7 dependency-free
bundles, 1 new devDependency-free runtime dependency (§4.2). Phase 6 M2 took one session;
Phase 7 is comparable.

### 13.2 Suggested session workflow (identical discipline to Phases 4–6)

Read `PROJECT_STATE.md` §1 + this plan first; verify branch/HEAD/tree; inspect only
touched files; run focused tests while iterating, `npm run check` once at the end
(+ `npm run build`); fix regressions before claiming completion; update state files in the
same turn; commit once at the boundary; leave a precise checkpoint instead of claiming
completion if credits run short — never silently incomplete.

## 14. Risks, dependencies and known limitations

| # | Risk / limitation | Mitigation |
|---|---|---|
| 1 | `@cfworker/json-schema` error-object shape drift across minors (API surface `validate`/`Validator`) | Wrapper module is the only import site; pin `^4.1.6`; upgrade only with the full §12.1.1 matrix green |
| 2 | Learner pastes a pathological schema (deep `$ref` chain, huge enum) — CPU exhaustion | Node/depth/hop budgets pre-flight; interpreter aborts deterministically; scoped 30/min cap; 400 with specific reason (`complexity_limit` — rides `invalid_request`, no new code) |
| 3 | Catastrophic-backtracking `pattern` regex in a learner candidate schema | `pattern` length ≤ 256; honest documentation note in the workspace ("prefer anchored, possessive-style patterns"); no possessive support needed at our sizes; milestone adds one ReDoS-shaped fixture to the timeout tests to keep the budget honest |
| 4 | Browser and server validators diverge (different dialect handling) | Single shared wrapper (`src/shared/contractValidation.ts`) imported by both planes — one code path, one matrix; SSR tests exercise the server path with the same payloads as browser unit tests |
| 5 | Drift between `/openapi.json` and the *server* surfaces unexposed (the validate workspace shows the doc, not the implementation) | Accepted and documented: the served contract is under a both-directions coverage test today; Phase 7 does not add runtime conformance sampling (would require live traffic capture — out of scope) |
| 6 | Learner confuses "contract validates" with "API works" — validation checks shape, not semantics | Every workspace carries the Phase 4-style explainer strip ("Valid ≠ correct — this checks structure only"); guides reinforce; exercise debriefs repeat it |
| 7 | `ledger-*` fixtures perceived as busywork vs the "real" platform contract | The live platform contract is a first-class validation source in the hub (one click) and in `contract-bgn-live-products-01`; fixtures exist because pairwise diffs need version pairs |
| 8 | Hunt-007 drift leaks to clean sessions via the workspace's "later release" demo | Clean alias resolves to the **v2-compatible additive** fixture; the drift is selectable only as the explicitly named `contract-adv-consumer-broken-01` drill (instructions say v2 changed) and as the hunt-007 alias; no endpoint returns the raw delta; leak lint + §12.1.6 matrix cover this |
| 9 | Free-tier CPU p95 exceeds 5 ms on slow paths (large nested payloads) | Node budget is the control (not wall-clock); if p95 breaches, budget tightens; exit audit records the measurement |
| 10 | Progress page grows unwieldy with a third lab section | Section is collapsible (shared `CollapsibleSection` used by Database since Phase 6); rows reuse existing anatomy |
| 11 | `hunt_attempts` id-space collision between contract exercise ids and future phases | Prefix scheme `contract-*` is registered in `attemptTargets` alongside future-namespaced ids; uniqueness test-enforced |
| 12 | No open defects carried from Phase 6 — Phase 7 adds no WASM/worker state and touches no SQL boundary | n/a by construction; verified in review |

**Dependencies:** one new runtime dependency (`@cfworker/json-schema@^4.1.6`), one new
migration file (zero-DDL, local-only until approved release), no Cloudflare resource
changes, no bindings, no secrets, no cron.

## 15. Explicit non-goals (and why)

1. **No Pact Broker / Pact-compatible tooling / pact-files exchange protocol.** The lab
   teaches the *concepts* self-contained; implementing Pact compatibility would import a
   whole external ecosystem (broker servers, webhooks, can-i-deploy) with zero additional
   QA skill-per-byte. The expectation model is deliberately minimal JSON Schema.
2. **No distributed multi-service contract infrastructure, no microservice choreography,
   no service virtualization.** One provider surface (first-party lab) + fixtures;
   choreography is Phase 5/async scope, not this phase.
3. **No external provider testing or arbitrary URL fetching** (SSRF-class abuse). All
   verification is fixture-based; the browser can fetch only `/openapi.json` same-origin.
4. **No CI/CD integration, GitHub checks, or webhook gates.** Phase 10 (hardening/launch)
   territory; this phase is learner-facing runtime only.
5. **No production traffic interception / shadowing / replay.** There is no traffic.
6. **No arbitrary scripting or code execution** on Workers or in the browser sandbox —
   learner input is data; there is no evaluator for executable content (by design,
   verified by gates).
7. **No enterprise schema registry** (versioned artifact storage, promotion pipelines,
   compatibility gates on push). Registry semantics are taught via fixture pairs, not via
   infrastructure.
8. **No real third-party API scanning or conformance crawling** — first-party targets only.
9. **No reimplementation of the API Lab** — `/api-lab` remains the request console; the
   contract lab is additive links + workspaces.
10. **No replacement of the learning/bug-hunt engines** — attempts, hints, reveals,
    reports, evaluation, progress are reused verbatim; Phase 7 registers as data + branch
    sites inside them.
11. **No OpenAPI 3.0/3.1 conversion tooling, no schema inference from traffic, no
    JSON Schema → TypeScript codegen.** Authoring/editing the served contract stays a
    hand-authored, test-guarded human process (Phase 5 decision).
12. **No PII-bearing canned payloads, no credential fixtures.** Synthetic-only (§10.9).
13. **No schema-validation result caching/memoization layer** — unnecessary at ≤ 24 KB.
14. **No persistence of free-form learner schemas** (a "my saved expectations" library).
    Session-ephemeral by default; attempt scoring is what gets recorded. Promote later if
    learners ask for it.

## 16. Exit criteria (measurable — Phase 7 is done when every line passes)

### 16.1 Engine and contracts

1. All §12.1.1 wrapper tests pass; every expected assertion list for the canned valid
   payloads compiles clean; every keyword in the matrix emits the documented assertion
   shape.
2. **Valid contracts are accepted** — the 24 reference answers validate/evaluate 100/100
   through the real server evaluator (test-enforced, output recorded).
3. **Invalid contracts are rejected with useful diagnostics** — each of the 24 plausible-
   wrong answers is rejected, and every rejection carries ≥ 1 specific
   `path`/`keyword`/`expected`/`actual` line (asserted in tests).
4. Request validation works: every request-side exercise (`contract-int-request-01` et al.)
   passes only with the correct request assertions identified; the server rejects
   request payloads violating `minimum`/`required`/`pattern`.
5. Response validation works: `contract-int-response-01` fails only with the correct
   `required`-omission assertions; live captured product payload validates clean.
6. **Breaking changes are correctly detected** — `ledger-v2-breaking` produces exactly
   the curated breaking finding set (removed property R3, enum narrowing R8, type change
   R6); `ledger-v2-required` produces exactly one finding (R1).
7. **Backward-compatible changes are correctly classified** — `ledger-v2-compatible`
   yields zero breaking findings (additive `memo` ⇒ compatible; `status` enum widening ⇒
   review) and the verdict banner reads **REVIEW REQUIRED**, never BREAKING; the
   BACKWARD-COMPATIBLE verdict is reached for an all-additive test pair constructed in
   the diff-engine tests (response-only optional property, no enum change) — both verdicts
   asserted.
8. Enum widening is classified **review**, never silently compatible (asserted).
9. Annotation-only changes produce **zero** findings (R21, asserted).
10. Verdict precedence holds: one breaking + many compatibles ⇒ BREAKING (asserted).

### 16.2 Consumer/provider

11. A correct minimal expectation (C1–C7 = 100) verifies against provider-product-v1:
    `valid: true, statusOk: true`.
12. The same expectation **fails** the drifted payload with the `categoryName` required
    assertion firing (asserted at the rubric level, C7 = pass).
13. Vacuous expectation (`{}`) is rejected by the rubric (C2 fails ⇒ score < 70).
14. Full-clone expectation (requires every provider field incl. `description`) is rejected
    by C3 (score < 70).
15. Closed expectation (`additionalProperties: false`) is rejected by C5 (score < 70).

### 16.3 Scoring, hints, reveals, progress

16. Pass ≥ 70 gate: score 69 rejects, 70 passes (boundary tests both rubric families).
17. Attempt stamping: pass stamps attempt `submitted` + running-max best score; fail does
    not stamp; double-pass idempotent (fake-d1).
18. Hint order enforced: skip → 409 `hint_level_locked`; reveal locked (403
    `reveal_locked`) until submitted or confirmed give-up; give-up grants no pass/discovery.
19. `buildHuntEntries` includes all 31 new targets (24 exercises + 7 hunts); `/progress`
    renders the Contract Testing section; guest ephemeral / account durable parity
    confirmed by existing suite semantics.

### 16.4 Bug hunts — both modes, containment, reset

20. For each of the six live-API defects: clean-mode output byte-identical to pre-phase
    (existing regression suites + explicit clean/hunt matrix test); bug-hunt session
    reproduces the defect deterministically (two consecutive requests identical);
    `hunt-contract-007` carries no `defectIds` and no `isDefectActive` branch (asserted,
    mirroring the SQL-hunt registration pattern).
21. For hunt-contract-007: clean session ⇒ `verify-consumer(provider-product-v2-latest)`
    resolves to the additive fixture (verification passes); bug-hunt session with
    `hunt-contract-007` ⇒ the same call resolves to the drift and the assertion list names
    `$.categoryName` required-missing; explicit `provider-product-v2-drift` works in both
    modes (the named drill); no response ever contains the raw delta; exit hunt ⇒ alias
    resolves to additive again immediately (asserted for the same browser session).
22. Reset restores clean state for all seven hunts (leave hunt ⇒ validate workspace + live
    API + consumer payload all clean; asserted in the browser probe).
23. Leak scan clean: zero occurrences of `CONTRACT-001..007`, delta strings, or solution
    text in `dist/` (automated grep + extended leak lint).
24. Hunt learner-safe registry output contains no defect ids (existing hunt-set test
    pattern extended to contract hunts).

### 16.5 Integration, compatibility, build

25. **Existing Phase 3–6 functionality remains compatible**: full pre-existing suite stays
    green unmodified (except the three named count bumps — hunts 18→25, OpenAPI 38→42,
    schema 12→13 — each is a mechanical assertion, none a behavioural change); `/shop`,
    checkout, auth, SQL lab, progress, API Lab all re-verified in the browser probe.
26. **OpenAPI accuracy**: `info.version` 1.2.0; exactly 42 operations; the four new paths
    documented to the same standard (schemas, rate limits, error envelope); contract test
    green; `/openapi.json` parses under the wrapper as 2020-12.
27. **Tests, type checks, lint and build pass**: `npm run check` green (all projects);
    `npm run build` clean; no new lint errors; three TS projects clean.
28. **Browser**: all §12.1.10 checks pass on the production build (Chrome over CDP), both
    themes × 4 widths; zero horizontal overflow; zero unexpected console errors;
    reduced-motion pass clean.
29. **Free tier respected**: index chunk byte-identical to `main` (bundle diff recorded);
    contract chunks ≤ 60 KB gzip; validator p95 ≤ 5 ms on the benchmark corpus (recorded
    in the audit); zero new D1 tables; migration 0013 zero-DDL and verified locally on a
    fresh database **and** on an upgrade from the Phase 6 local state.
30. **AuthN/AuthZ intact**: guest 401/closed boundaries unchanged (evaluate);
    account parity; admin/staff routes untouched; Bearer-vs-cookie resolution unchanged.
31. **Fitness of reporting**: every exercise page shows per-check results with the failing
    `path`/`keyword`/`expected`/`actual`; the gated reveal names the mechanism; the
    bug-report flow end-to-end for hunt-contract-002 (representative) is probe-verified.
32. `docs/phase-7-exit-audit.md` exists with explicit PASS/FAIL per criterion and skipped
    checks disclosed; `PROJECT_STATE.md` updated in the same commit; `AGENTS.md` status
    line current; **nothing pushed/merged/deployed without separate maintainer approval.**

## 17. Documentation deliverables of the implementation milestone

- `docs/phase-7-exit-audit.md` — criterion-by-criterion verdicts + evidence (commands,
  outputs, probe counts, screenshots paths, skipped checks).
- `docs/bug-hunt-catalogue.md` — §Contract (internal expected/actual per hunt).
- `docs/phase-7-contract-testing-plan.md` — §19 implementation decisions & deviations
  appended (as built, dated), mirroring Phase 6 §19.
- `README.md` — Phase 7 paragraph (capabilities, routes, boundaries, commands).
- `PROJECT_STATE.md` — §1 snapshot + §9 roadmap + §11 log + new §16 Phase 7 section.
- `AGENTS.md` — one status-line update only.
- `guide-consumer-driven-contracts` + `guide-contract-testing-basics` refresh (product
  content, not repo docs).

## 18. Open decisions for maintainer approval (nothing here is decided yet)

> Defaults below are what the milestone will implement if the maintainer approves the
> plan unchanged. Anything the maintainer overrides becomes a §18 decision recorded in
> the same commit that changes it.

| # | Decision (default in this plan) | Alternatives considered |
|---|---|---|
| D1 | **Dependency:** `@cfworker/json-schema@^4.1.6` on both planes behind `src/shared/contractValidation.ts` (interpreter; ≈9 KB gzip; MIT; drafts 4/7/2019-09/2020-12; Workers-safe) | `ajv` (rejected: `new Function`, unusable in Pages Functions; precompile adds drift); `@hyperjump/json-schema` (deferred: dialect story good, bundle/Worker ergonomics unverified here); `zod` (rejected: wrong artefact); no-dependency hand-rolled walker (rejected: re-implements a spec badly) |
| D2 | **Migration `0013_contract_lab_schema.sql`:** zero-DDL `app_meta` 12→13 applied locally in the milestone; production only inside a separately approved release | Skip the bump entirely (health stays 12 — allowed, but loses the release observability marker Phase 5/6 used; not recommended); new table for persisted diffs (rejected: no product need) |
| D3 | **Fixture domain:** fictional sibling "Meridian Ledger" service for pairwise version fixtures; platform contract used browser-side for live validation + `contract-bgn-live-products-01` grades captured answers server-side | Use the platform contract as the diff baseline (rejected: single version, 65 schemas, noisy diffs); `git`-style inline fixture pairs per exercise only (rejected: hub cross-referencing suffers) |
| D4 | **Hunt-start cap:** the seven `kind: 'contract'` hunts do **not** consume the 20/IP/UTC-day UI hunt cap (consistent with `kind: 'sql'`) | Consume the UI cap (would need a cap-path exception that teaches learners hunts are "expensive" — inconsistent); separate counter (needless bucket) |
| D5 | **Hunt-contract-007 mechanism:** server-only compiled delta consumed at two server-side `verify-consumer` paths — the session-aware `provider-product-v2-latest` alias (hunt-007 bug-hunt ⇒ drift; everywhere else additive) and the explicitly named `provider-product-v2-drift` drill for `contract-adv-consumer-broken-01`; **no endpoint returns the raw delta** (learners get assertion lists only) | SQL-seed-style payload delivery endpoint (considered and rejected: the delta never needs to reach the browser — delivery would only widen the leak surface); live-API defect with a surgical leaf field (rejected: no surgical leaf exists — every product field renders somewhere); client-side drift (rejected: breaks the isolation model) |
| D6 | **Route surface:** exactly **four** new endpoints (`validate`, `compare`, `verify-consumer`, `evaluate`); no new read endpoints (fixtures are bundled TS modules; the drift has no delivery endpoint) | Fixture-catalogue endpoint (rejected: needless round-trip); hunt-007 delivery endpoint à la SQL seed (rejected: see D5); per-operation validation endpoints (rejected: one generic validator) |
| D7 | **Navigation:** one entry "Contract Testing" after Database, icon `contract` (existing) | Merging with API Lab/Reference (rejected — Phase 5 approved separate entries) |
| D8 | **Exercise count 24 (8/9/7)**, 7 hunts, flip `contract-catalog-consumer` + `contract-breaking-change` to ready, 7 new wired hunt scenarios, track count 5→24 | Larger catalogue (rejected: arbitrary size, duplicate objectives); fewer hunts (rejected: charter's six failure classes each need their own hunt) |
| D9 | **No deployment as part of the milestone** — release always a separate explicitly approved step (pre-migration export → `0013` production → deploy → acceptance with skipped-check disclosure) | — |
| D10 | **`info.version` 1.2.0 / 42 operations**; no new `ErrorCode`s | Appending Phase 7 codes (rejected: vocabulary is closed by test; no genuinely new failure class exists) |

## 19. What the planning turn delivered / did not deliver

- Delivered: this document; `PROJECT_STATE.md` (Phase 7 recorded as planned, not
  implemented; next authorized action = review of this plan); minimal `AGENTS.md`
  status-line update (prevents accidental implementation before approval).
- Not delivered (deliberately): no code, fixtures, dependencies, migrations, tests,
  config, routes, or Cloudflare changes; no push/merge/deploy; no Phase 8 work; the
  `README.md` is untouched (its Phase 6 paragraph is current; Phase 7 gets its paragraph
  at implementation exit, per the Phase 6 pattern).

---

## 19. Implementation decisions & deviations (as built, 2026-11-17)

> Appended by the implementing session. The plan above remains the approved
> design; everything here records where the build landed, what drifted, and
> why. Nothing in this section silently rewrites §1–§18.

**Delivered:** the complete P7 milestone — shared validation boundary
(`src/shared/contractValidation.ts`), compatibility engine (`contractDiff.ts`,
R1–R21, verdict precedence, byte-deterministic findings), consumer rubric
(`consumerRubric.ts`, C1–C7), seven hunts (`kind: 'contract'`), 24 exercises
(8/9/7), four endpoints (`validate | compare | verify-consumer | evaluate`),
OpenAPI 1.2.0 / 42 operations / zero new error codes, one nav entry after
Database, `/progress` Contract Testing section, five lazy routes, migration
`0013` (zero DDL, **local D1 only**; production stays at `schema_version` 12),
and `docs/phase-7-exit-audit.md` with the criterion-by-criterion verdicts.

**D-P7-1 — Consumer rubric gates (C3/C5) cannot reject the canonical wrong
answers within the plan's 10/25/15/20/10/10/10 weighting.** The full clone
(requires every provider field) scores 85 under the plan's C3=15/−5-per-extra
rule — the plan's own exit criteria 14 ("score < 70") is unreachable. The
build keeps every point value exactly as specified and adds two explicit
gates, only for the two failure modes the exercise exists to teach:
(1) full-pin detection (required ⊇ all 9 platform `Product` fields) ⇒ score
capped at 60 and C3 marked failed — "rejected by C3"; (2) `additionalProperties:
false` ⇒ score capped at 65 and C5 marked failed — "rejected by C5". All
other answers score exactly as the plan specifies. Criteria 13/14/15 pass.

**D-P7-2 — The exercise-start semantic is exercise-generic.** §5.1 allows
exactly four new endpoints, so no `POST /api/v1/contract/exercises/.../start`
route exists. The existing `POST /api/v1/sql/exercises/{exerciseId}/start`
now idempotently starts contract exercises too (same handler, same semantics:
mints a clean guest session when the browser has none, idempotent attempt
creation, 404 otherwise). No new operation was added — the OpenAPI document
describes both dialects on that one path (`info.version` still 1.2.0, 42
operations). Contract exercise ids satisfy the same id pattern
(`^[a-z0-9][a-z0-9-]{2,63}$`, ≤ 64 chars; the longest shipped id is 32).

**D-P7-3 — compare-family results keyed by stable finding ids.** Exercises
grade classifications keyed by per-exercise finding ids (`finding-memo`,
`finding-type`, …) rather than by (rule, path) tuples — the client-safe
checklist carries those ids, the server holds the expected map.
`contract-int-compare-enum-01` and `contract-adv-breaking-req-01` carry a
second sub-check (impact-reason selection, 30 points) matching the plan's
"with correct consumer-impact reason selected" wording; the rest are
100-point classification drills. `contract-int-compare-additive-01`
(classifications, no choices) uses the 70/30 correctness/completeness split
as specified; exercises with choices grade classifications at 70 / choices at
30.

**D-P7-4 — `validate` answer union widened per §7.3.** §4.7 specifies
`{ kind: 'validate', payload }`; §7.3 mixes "select which assertion fires"
with "fix the payload". The shipped union is `{ kind: 'validate',
selections?: string[], payload?: unknown }` — each compiled rubric declares
the graded sides. Two-stage exercises (`contract-bgn-types-01`,
`contract-int-nested-01`) grade selections 40 / payload 60; single-sided
exercises grade selections 100. Both §7.3 evaluation descriptions are
satisfied with no unreachable branch.

**D-P7-5 — hunt-contract-007 alias assertion targeting.** Criterion 21 says
the assertion list names `$.categoryName` required-missing. The drift payload
does rename `categoryName → category` (and re-cases `stockStatus`), so an
expectation pinning `categoryName` fails with exactly that assertion (asserted
in `tests/server/contract.test.ts`). The §4.5.1 worked example (critical five
only) fails on the `stockStatus` enum instead — both are the correct designed
evidence for their respective expectations; the hunt teaches "attitude toward
any failing assertion", not a single string.

**D-P7-6 — Order of findings for ref-inlined schemas.** The §4.4 parallel
walk visits `$ref`-inlined subschemas once per use site. Identical (rule,
change, classification) findings from those sites are collapsed (shortest
path wins) — the learner sees each distinct change once, not once per
reference. Verdicts and classifications are unchanged; ordering remains
deterministic (classification rank → path → rule).

**D-P7-7 — `R3` request-side, and two R5/R4 corner readings.** The rule table
is response-scoped for R3; request-side property removal (with any candidate
shape) is reported as **review** ("strict clients sending it will fail")
rather than breaking or silent — conservative and honest. R5 in the built
engine fires only when a response contract relaxes `additionalProperties:
false → true` (wire-open); additive properties with an open base schema are
R4-compatible (criterion 7 passes: memo ⇒ compatible, enum widening ⇒
review). x-contract-meta (`statuses`, `mediaType`) is a documented mini-contract
annotation consumed by R16–R18; it is stripped from JSON Schema semantics and
never appears in fixtures.

**D-P7-8 — Index chunk is NOT byte-identical to `main`.** `eeded31`'s index
chunk was 397.20 kB (gzip 122.66 kB); the built index is ~417.8 kB (gzip
127.75 kB, +5.09 KB). The delta is the mandatory wiring content (tracks,
scenarios, curriculum entries for the seven hunts) — no new eager dependency,
and `@cfworker/json-schema` is confirmed absent from the eager chunk. Contract
lazy chunks total ≈ 38.7 KB gzip against the ≤ 60 KB budget. Criterion 29's
byte-identity expectation is unmet by necessity (the wiring had to ship
somewhere); the deviation is recorded here rather than hidden.

**D-P7-9 — `0013` exists (zero DDL) and is local-only.** It exists because the
repository ships one additive migration per phase (0011, 0012 precedent) and
`/api/health` observability benefits from the marker; without it, health would
keep reporting 12 while Phase 7 code is deployed. It contains exactly one
`UPDATE app_meta …` statement; **production remains `schema_version` 12**;
`0013` is applied to the local D1 only; the Phase 5/6 pre-migration-export
protocol applies inside any separately approved Phase 7 release. Migration
fresh/upgrade tests (`migration-0013.test.ts`) pass, including a through-12
upgrade with planted rows.

**D-P7-10 — Out-of-contract work not touched:** push/PR/merge/deploy, remote
migrations, Phase 8, SQL playground, Phase 5 API surfaces (only the exercise-start
semantics widened per D-P7-2), and the backup branch. The Phase 7 plan and
technical decisions were not rewritten; deviations are recorded, not applied
silently.
