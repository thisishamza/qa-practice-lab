# Phase 6 — Database & SQL Testing Lab — Implementation Plan

> **Status (2026-11-17):** APPROVED-FOR-PLANNING — this document is the complete
> plan for Phase 6. **Phase 6 is not started.** No application code, dependencies,
> migrations, or Cloudflare resources exist for Phase 6 yet. Implementation begins
> only after explicit maintainer instruction, milestone by milestone.
>
> **Baseline:** `main` @ `04974d0` (docs commit on top of the Phase 5 release
> `3ecfb41`, merged via PR #8). Production: https://qa-practice-lab.pages.dev,
> D1 `qa-practice-lab-db`, `schema_version` **11**. Phase 5 is live and frozen as
> the stable baseline. **Nothing in this phase may be deployed without explicit
> maintainer approval.**
>
> **Deliverables of the planning turn (2026-11-17):** this document and the
> `PROJECT_STATE.md` update. No source, dependency, migration, or config changes.

## 1. Phase objectives and learner outcomes

### 1.1 Objectives

Phase 6 adds a complete, practical database-testing learning environment to QA
Practice Lab — an isolated SQL playground plus a guided learning and bug-hunt
experience — without touching Phase 5 behavior, shared production data, or the
deployment contract.

Concretely, Phase 6 delivers:

1. An **isolated SQL playground** running SQLite compiled to WebAssembly in the
   browser, with a real editing experience, structured results, clear errors,
   reset/restore, sample queries, copy support, and hard execution safeguards.
2. A **realistic synthetic commerce dataset** ("Meridian Outfitters" practice
   snapshot) — relational, constrained, indexed, deterministic, resettable,
   conceptually connected to the existing commerce application, with deliberate,
   documented data-quality edge cases.
3. A **36-exercise learning catalogue** spanning beginner → intermediate →
   advanced, covering every SQL topic listed in the charter, each with a
   QA-oriented scenario, progressive hints, a solution and explanation,
   result-based evaluation, and reset.
4. A **QA database-testing scenario set** — reconciliation, orphan detection,
   duplicate detection, integrity verification, transaction rollback checks,
   corruption investigation — the part that teaches database *testing*, not
   just SQL syntax.
5. **Database bug hunts** wired into the existing Phase 3/4/5 bug-hunt
   architecture (code registries, attempts, hint ladder, gated reveal,
   structured bug reports, deterministic evaluation, progress).
6. **Integration with Phase 4 learning/progress systems** — exercise completion,
   scoring, attempt history, difficulty progression, guest/authenticated
   parity — with no duplication of the existing infrastructure.

### 1.2 Learner outcomes (measurable)

After completing Phase 6, a learner can:

- Write SELECT/WHERE/ORDER BY/LIMIT queries against a realistic schema and
  predict result sets (beginner track).
- Use DISTINCT, aggregates, GROUP BY/HAVING, CASE, and NULL-handling correctly
  (beginner/intermediate).
- Join tables with INNER/OUTER joins and read execution plans with
  `EXPLAIN QUERY PLAN` (intermediate).
- Write subqueries, correlated subqueries, and CTEs to answer layered business
  questions (intermediate/advanced).
- Perform INSERT/UPDATE/DELETE inside transactions, verify rollback behavior,
  and explain what constraints do and do not protect (intermediate/advanced).
- Reconcile orders ↔ order_items ↔ payments and prove or disprove data
  consistency with queries, not assumptions (the core database-testing skill).
- Detect orphaned rows, duplicates, stale records, and aggregation defects in
  a deliberately corrupted dataset, and file a structured bug report.
- Read a schema (keys, constraints, indexes) and identify which integrity
  properties the engine enforces vs. which need application-level checks.

### 1.3 What this phase is not

SQL syntax drills are necessary but not sufficient. Every track in this phase
is anchored to a QA question ("does this order reconcile?", "what did this
deploy break?"). A phase that shipped only a SQL console would fail its charter;
see §17 for explicit non-goals.

## 2. Existing architecture and integration points

Verified against the repository on 2026-11-17 (not against memory). Baseline:
`main` @ `04974d0`, working tree clean, `main` == `origin/main`.

### 2.1 What exists and works today (reused, not re-built)

| Area | Current implementation | Phase 6 use |
|---|---|---|
| App shell / routes | `src/app/App.tsx` — lazy routes inside `AppShell`, `PracticeSessionProvider` wrapping all | Add 3 lazy routes: `/database`, `/database/playground`, `/database/exercises/:exerciseId` |
| Navigation | `src/lib/navigation.ts` `primaryNav` (10 entries); `staffNavItem` for staff only | Add **Database** entry (`icon: 'database'` already exists in `IconName`) after `API Lab` |
| Workspace UI idiom | `[data-surface="workspace"]` scope + `src/styles/workspace.css` (`.workspace-panel`, `.workspace-head`, `.workspace-title`, `.workspace-status`) | SQL workspace chrome reuses these; no new palette |
| Theme | `data-theme` bootstrap in `index.html`, `.tokens.css` primitives→semantic; light default + dark workspace | Both themes required; verified at 4 widths |
| Fonts | Self-hosted `@fontsource-variable/ibm-plex-sans` + `jetbrains-mono` | Editor and numerics use the mono font; UI uses IBM Plex Sans |
| Route-level code splitting | Every non-index page is its own chunk | WASM + seed fetch only on `/database*` routes |
| Practice sessions | `mpl_session` cookie, 7-day TTL, SHA-256-hashed tokens, `PracticeSessionProvider` | Attempts stay session-scoped; guest = ephemeral, account = customer-scoped (Phase 4 rule) |
| Hunt registry | `src/server/hunts.ts` (`HUNTS`, `findHunt`, `HUNT_ID_PATTERN`) — code, not data; defect ids never client-reachable | SQL hunts register here as `kind: 'sql'` entries; clean exercises use a sibling registry |
| Attempt lifecycle | `hunt_attempts` (migration 0010) — idempotent start, partial unique index, cascade with session | Reused as-is for SQL exercises and SQL hunts (see §10) |
| Hint ladder / reveal gate | `src/server/learning.ts` + `src/server/hints.ts` + `reveals.ts`; 3 levels, idempotent `hint_mask`; reveal gated on submit or confirmed give-up | Reused as-is; new content modules for SQL hints/reveals |
| Bug-report evaluation | `src/server/reports.ts` + `reportQuality.ts` — deterministic 100-point rubric, no AI | Reused as-is for database bug hunts |
| Progress | `GET /api/v1/practice/progress` — `buildHuntEntries`, totals, session/customer scoped | Mapper extended to iterate `HUNTS + SQL_EXERCISES` (§10.6); response shape unchanged |
| Test harness | `tests/helpers/fake-d1.ts` (node:sqlite-backed D1 with atomic batch) | Server tests for new endpoints follow the same pattern |
| Bundle-leak lint | `tests/lib/hint-reveal.test.ts` asserts no defect/solution strings in client source | Extended for SQL solution strings and defect seed deltas |
| Guides system | Typed `Guide` in `src/data/guides.ts` | New guide `guide-database-testing-sql` ships with the phase |
| Scenario catalogue | `db-order-consistency` (planned), `db-orphaned-carts` (in-design) — both `runnable: false` | Both flip to `ready`/`runnable` with `huntId`/exercise wiring in M2 |
| Database-testing track | `tracks.ts` id `database-testing`, plannedExerciseCount 5, objectives already written (order consistency, constraints, orphans, duplicates, spec-first queries) | Copy refreshed in M2 to match shipped count; objectives stand |

### 2.2 Current commerce schema (concept reference for the practice dataset)

The platform D1 holds `products` (42 rows), `categories` (8), `inventory`,
`orders`, `order_items` (money in integer cents, explicit ids, FKs, CHECK
constraints, indexes — see `db/migrations/0002…0004`). The brand is
**Meridian Outfitters**. The Phase 6 practice dataset deliberately mirrors this
world (same brand, same product set, same integer-cents convention) so learners
move between the shop and the SQL lab without a context switch — but it is a
**separate, browser-resident snapshot**, not a D1 dump, and it adds the tables
the platform lacks (`payments`, `addresses`, richer customer history).

### 2.3 Gaps Phase 6 must close

1. **No isolated SQL execution environment exists.** D1 must never serve as one
   (§6). All learner SQL runs in a browser-local SQLite/WASM database.
2. **No SQL content.** 36 exercises, 14 QA scenarios, 8 database hunts, one
   guide, and the track/scenario/progress wiring.
3. **No result-based evaluation.** Existing evaluation is text/report-based;
   SQL needs column/row-set comparison (§10.3).
4. **The `database-testing` track is empty** — 5 planned exercises, two
   placeholder scenarios, no guide.

### 2.4 Constraints carried forward

- No route may accept user SQL, table names, or identifiers server-side.
- Synthetic data only; no real customer or payment data, anywhere.
- Free-tier budget (§13); no new bindings, cron, or background jobs.
- Existing behavior, migrations 0001–0011, and production D1 are untouched.
  The only production-affecting artifact is the static wasm asset and new JS.
- UI/UX follows `.opencode/skills/ui-ux-pro-max` (loaded 2026-11-17 for this
  plan). Its output independently confirms the existing direction: the
  dark-mode "code dark + run green" developer-tool pattern, JetBrains Mono /
  IBM Plex Sans (already self-hosted), avoid light-default for code surfaces —
  i.e. keep the workspace dark-scope idiom for the SQL surface in both themes.
- React + TypeScript + Vite; Hono on Pages Functions; hand-written CSS with
  design tokens; **no Tailwind, no shadcn, no chart library, no icon package**.

## 3. Proposed architecture and data flow

### 3.1 Planes

| Plane | Carries | Where |
|---|---|---|
| **Data plane** (browser) | Learner SQL, sandbox DB, seed bytes, deltas, results | A dedicated Web Worker holding a sql.js `Database` in WASM linear memory |
| **Control plane** (server) | Attempts, hints, reveals, reports, evaluation, progress, hunt seed deltas | Existing Hono app (`/api/v1/...`), D1 `qa-practice-lab-db` |
| **Static plane** | Canonical seed SQL, wasm asset | `public/datasets/meridian-outfitters.sql`, Vite asset |

The browser never sends SQL to the server. The server never sends rows from D1
to the browser. The only cross-plane payloads are: (a) the canonical seed
(static file), (b) a per-hunt corruption delta (on-demand, bug-hunt sessions
only, compiled server-side), (c) a result envelope
`{columns, rows, truncated}` (≤1,000 rows, ≤1 MB) for evaluation, (d) standard
Phase 4 attempt/hint/report payloads. Nothing is logged on the server beyond
what Phase 4 already stores.

### 3.2 Data flow (normal run)

```text
typesql / Ctrl+Enter
  → main thread: length/statement classifier (§6.4) → postMessage{run}
  → worker: sqlite.exec(sql) under 3.0 s budget
      ├─ OK: serialize ≤1,000 rows → postMessage{result, statementIndex, truncated}
      ├─ SQL error: postMessage{error, statementIndex, message}
      └─ timeout: main thread terminates worker → fresh worker + reseed → postMessage{error: 'timeout'}
  → main thread: render result grid / error callout / schema explorer refresh (if DDL)
```

### 3.3 Data flow (exercise)

```text
learner opens /database/exercises/:id
  → client GETs exercise definition (static typed data — prompt, tables, hints count, mode)
  → client POSTs /api/v1/sql/exercises/:id/start   → attempt created (idempotent)
  → learner writes SQL, clicks Run (data plane)
  → learner clicks "Check work"
  → for DML/transaction exercises: client runs the exercise's CHECK query in the sandbox
     (the check query is not secret — it reveals what to inspect, never the expected values)
  → client POSTs /api/v1/sql/evaluate {exerciseId, columns, rows}
  → server compares against compiled expected spec (§10.3) → {passed, score, checks[]}
  → server records attempt (status submitted, best_quality_score max) → returns feedback
  → UI renders verdict + enables solution reveal gate (or marks complete)
```

### 3.4 Data flow (database bug hunt)

```text
learner starts hunt-db-00N from its scenario page (huntId on Scenario) or the
/database hub (hunt card, Bug-Hunt Mode badge)
  → POST /api/v1/practice/hunts/hunt-db-00N/start   (existing endpoint; SQL hunts
     registered in HUNTS with kind:'sql' — they do NOT consume the 20/IP/UTC-day
     UI hunt cap; §9.4)
  → server creates hunt_attempts row (existing idempotent start)
  → client GETs /api/v1/sql/hunts/hunt-db-00N/seed  (bug-hunt session required)
  → server returns the compiled corruption delta SQL (1–12 statements)
  → client: fresh canonical reseed, then apply delta (FK off → apply → FK per exercise spec)
  → learner investigates; files structured bug report (existing form)
  → POST /api/v1/practice/hunts/hunt-db-00N/report  (existing endpoint, existing evaluator)
  → discovered sticky on pass (≥70); /progress shows the entry
```

### 3.5 Component inventory (new files)

| Path | Purpose |
|---|---|
| `public/datasets/meridian-outfitters.sql` | Canonical seed (generated, committed) |
| `scripts/generate-sql-seed.mjs` | Deterministic generator (mulberry32(20261117)) |
| `src/lib/sql/engine.ts` | Pure engine interface over sql.js (Node-testable; takes wasm bytes) |
| `src/lib/sql/worker.ts` | Module worker entry: run/reset/schema/export protocol |
| `src/lib/sql/client.ts` | Main-thread client: spawn/terminate, correlation ids, timeout |
| `src/lib/sql/tokenize.ts` | Minimal SQL tokenizer for highlight (strings, numbers, comments, keywords) |
| `src/components/ui/SqlEditor.tsx` | textarea-over-highlight editor; ⌘/Ctrl+Enter; Tab indent; aria labels |
| `src/features/database/DatabaseHub.tsx` (+ `.module` reuse) | `/database` hub: dataset card, track framing, exercise browser (difficulty × topic facets) |
| `src/features/database/Playground.tsx` | `/database/playground` workspace: editor, explorer, results, mode notes |
| `src/features/database/ExerciseWorkspace.tsx` | `/database/exercises/:exerciseId` instructions + hints + check + reset |
| `src/features/database/SchemaExplorer.tsx` | Table list → columns (PK/FK badges), indexes, constraints; DDL view toggle |
| `src/features/database/ResultsTable.tsx` | Sticky header, mono right-aligned numerics, truncation notice, copy TSV/CSV |
| `src/features/database/SampleQueries.tsx` | Starter templates + sample set (filtered per exercise context) |
| `src/data/sqlExercises.ts` | 36 exercise definitions (client-safe: prompt, tables, difficulty, check meta) |
| `src/data/sqlHuntsCatalog.ts` (client-safe parts) | Hunt cards for hub (title/summary/scenarioId only) |
| `src/shared/sql.ts` | Shared contracts: `SqlEvaluateRequest/Response`, `SqlExerciseDef` types, row caps |
| `src/server/sqlExercises.ts` | Server registry: expected specs + feedback (server-only) |
| `src/server/sqlEvaluate.ts` | Comparison engine (unordered multiset default; canonicalization) |
| `src/server/sqlSeedDelta.ts` | Corruption deltas for 8 hunts (server-only compiled code) |
| `src/server/sqlHints.ts` / `sqlReveals.ts` | 3-level ladder + gated reveals for exercises and hunts (server-only) |
| `src/server/sql.ts` | Routes: `POST /sql/exercises/:id/start`, `POST /sql/evaluate`, `GET /sql/hunts/:id/seed` |
| `db/migrations/0012_sql_lab_schema.sql` | `app_meta` `schema_version` → 12 (no table changes; see §10.7) |

### 3.6 What deliberately does NOT exist in this architecture

- No server-side SQL parser, no query logging, no "query store".
- No shared database handle; no connection pooling; nothing long-lived.
- No external network calls from the worker; no `fetch` inside SQL.
- No user-defined functions; no `ATTACH`; no file I/O pragmas (§6.4).

## 4. SQLite/WASM technology recommendation

### 4.1 Options evaluated

| Option | License | SQLite build | Delivery | Vitest (Node) fit | Headers needed | Verdict |
|---|---|---|---|---|---|---|
| **`sql.js@1.16.0`** (sql-wasm) | MIT | Emscripten build, modern 3.4x (verify at M1 kickoff via `SELECT sqlite_version()`) | Classic script + ESM dist; `.wasm` via `?url` import | Excellent — runs in Node out of the box; used by `tests/helpers/fake-d1.ts`'s harness family | None | **Recommended** |
| `@sqlite.org/sqlite-wasm` | MIT | Official SQLite WASM build | ESM + separate `.wasm`; OO1 API; sync build requires COOP/COEP headers for OPFS; non-OPFS works without them but is finnicky to bundle | Moderate — Node loading of the wasm is doable but more setup; API churn risk | Only for OPFS persistence | Reject for v1; keep as swap target behind the engine interface |
| `wa-sqlite` | MIT | Own build (EMSDK/wasi variants) | Async API, strong OPFS/IDB story | Moderate | Same | Reject for v1 |
| Server-side SQLite (`better-sqlite3`/D1) | — | — | Violates §6 isolation rule | n/a | n/a | **Rejected outright** |
| Editor: CodeMirror 6 | MIT | — | ~250–350 KB +theming | OK | n/a | Deferred; documented escape hatch (§4.4) |
| Editor: react-simple-code-editor + prism | MIT | — | Lightweight (~25 KB) | OK | n/a | Not needed; hand-rolled is smaller and matches repo's zero-dep CSS idiom |

### 4.2 Recommendation — `sql.js` behind an engine interface, inside a Web Worker

Reasons:

1. **Synchronous API** — `db.exec(sql)` returns result sets directly; simplest
   possible correct semantics for multi-statement runs and DDL ordering.
2. **Node-compatible** — the identical engine code path runs under Vitest
   (fs-read wasm bytes), so seed integrity, reference solutions, and evaluation
   are tested without a browser.
3. **Zero special headers** — no COOP/COEP, which keeps `wrangler pages dev`,
   previews, and the static asset path unchanged.
4. **Mature and attested** — 1.16.0 (SLSA-provenance published, MIT), long
   maintenance history, stable 1.x API.
5. **Memory posture** — `Database.export()`/close and full worker termination
   give us real reset/clear semantics (§6.6).

Accepted trade-offs (documented, not hidden):

- The wasm binary is **≈1.1–1.4 MB raw (≈400–600 KB gzip)** and stays out of the
  initial bundle via lazy route splitting + `?url` asset import. It downloads
  only on `/database*` navigation. M1 must **measure and record** actual size;
  budget: ≤600 KB gzip, ≤1.5 MB raw.
- No interrupt API in sql.js — timeout enforcement therefore lives at the
  worker boundary (terminate), not inside SQLite (§6.3).
- SQLite build lags upstream releases; the plan depends only on stable SQL:92…2018-era
  features (CTEs, window functions, JSON1 if present). Anything newer is
  opt-in sugar, never required by exercises.
- Persistence (OPFS/localStorage export) is **not** in v1 — every visit starts
  from the canonical snapshot; reset is deterministic and fast. Deferred (§17).

### 4.3 Swap strategy

All sql.js contact is behind `src/lib/sql/engine.ts`
(`openDatabase(bytes)`, `run(db, sql)`, `schemaOf(db)`, `exportBytes(db)`).
Nothing else imports `sql.js`. If sql.js is ever replaced by the official
build or OPFS persistence becomes a goal, only `engine.ts` + worker init change.

### 4.4 Editor recommendation — hand-rolled, no dependency

`SqlEditor.tsx` = a `<textarea>` transparently overlaid on a `<pre>` with the
tokenizer highlighter, the `react-simple-code-editor` geometry technique
implemented in-house (~200 lines, no overlay dep). Native textarea behavior:
mobile keyboards, selection, spellcheck off, autocapitalization off, Tab/Shift
Tab indent (keydown handler), ⌘/Ctrl+Enter run, visible focus ring via tokens,
`aria-label="SQL editor"` + describedby for the shortcuts hint. If usability
review in M2 shows this is inadequate (e.g., poor large-query performance),
CodeMirror 6 is the approved fallback — switching requires only replacing
`SqlEditor.tsx`, not the engine or page logic.

## 5. Dataset schema and seed strategy

### 5.1 The Meridian Outfitters practice snapshot

A self-contained relational snapshot — same brand and conventions as the
platform shop, intentionally not a copy of D1. **Eight tables**, all with
declared keys and constraints, all data synthetic:

| Table | PK | Key FKs | Notable constraints | Rows |
|---|---|---|---|---|
| `categories` | `id` | — | `slug` UNIQUE, `slug = lower(slug)` CHECK | 8 |
| `products` | `id` | `category_id → categories(id)` | `slug` UNIQUE, `price_cents >= 0`, `active IN (0,1)` | 42 |
| `inventory` | `product_id` | `product_id → products(id) ON DELETE CASCADE` | `quantity >= 0`, `low_stock_threshold >= 0` | 42 |
| `customers` | `id` | — | `email` UNIQUE (**no NOCASE** — case-variant duplicates stay detectable), `loyalty_tier IN ('bronze','silver','gold')`, `status IN ('active','suspended')`, `marketing_opt_in IN (0,1)`, `created_at` ISO-8601 UTC | ~120 |
| `addresses` | `id` | `customer_id → customers(id) ON DELETE CASCADE` | `is_default IN (0,1)`; partial unique index `WHERE is_default = 1` (one default per customer); `postal_code` length CHECK 3–12 | ~160 |
| `orders` | `id` | `customer_id → customers(id)`, `shipping_address_id → addresses(id)` | `order_number` UNIQUE; `status IN ('pending','placed','shipped','delivered','cancelled')`; `subtotal_cents/shipping_cents/tax_cents/total_cents >= 0`; CHECK `total_cents = subtotal_cents + shipping_cents + tax_cents` is **deliberately NOT declared** (reconciliation exercises need it breakable) | ~220 |
| `order_items` | `id` | `order_id → orders(id) ON DELETE CASCADE`, `product_id → products(id)` | `quantity > 0`, `unit_price_cents >= 0`, `line_total_cents >= 0`; no CHECK `line_total = qty×price` (broken rows exist by design) | ~600 |
| `payments` | `id` | `order_id → orders(id) ON DELETE CASCADE` | `provider_ref` UNIQUE; `method IN ('card','bank_transfer','gift_card')`; `status IN ('approved','declined','refunded','pending')`; `amount_cents >= 0` | ~220 |

Indexes: `idx_products_category`, `idx_products_active`, `idx_orders_customer`,
`idx_orders_status`, `idx_orders_placed_at`, `idx_order_items_order`,
`idx_order_items_product`, `idx_payments_order`, `idx_payments_status`,
`idx_addresses_customer`. All fact FKs indexed (Phase 5 lesson: no unindexed
FK scans at realistic row counts).

Session hygiene: `PRAGMA foreign_keys = ON` for the canonical seed and for
every learner session, except exercises/hunts whose declared spec turns it OFF
(orphan-injection and constraint-comparison exercises). `PRAGMA foreign_keys`
state is part of the exercise spec and is reset on every Reset.

### 5.2 Money, time, and types

Integer cents everywhere (`*_cents`). Timestamps ISO-8601 UTC text
(`strftime('%Y-%m-%dT%H:%M:%SZ','now')`-compatible comparisons). Booleans as
`0/1` INTEGERs. Emails/phones/postal codes as TEXT. No REAL columns used for
money (avoid float comparison traps; evaluation uses integer math).

### 5.3 Deliberate, documented data-quality quirks (canonical dataset)

The canonical snapshot is **structurally sound** (all PK/FK/UNIQUE/NOT NULL/
CHECK holds — it loads with `PRAGMA foreign_keys=ON` cleanly) but carries
**logical** anomalies a tester is expected to find. Each is documented here
and in `docs/bug-hunt-catalogue.md` (M2) with its intended exercise:

| ID | Quirk | Feeds exercise(s) |
|---|---|---|
| DQ-01 | A few `order_items.line_total_cents ≠ unit_price_cents × quantity` | SQL-QA-05 (`sql-adv-aggcorrect-12`), hunt-db-006 delta |
| DQ-02 | A few orders where `total ≠ subtotal + shipping + tax` | SQL-QA-02 (`sql-int-groupby-01`), hunt-db-003 delta |
| DQ-03 | Two customers with case-variant emails (`amara@example.com` vs `Amara@example.com`) | SQL-QA-04 (`sql-adv-dedup-11`), hunt-db-002 delta |
| DQ-04 | Customers with same full name, different emails | SQL-QA-04 |
| DQ-05 | Orders `pending` > 30 days old (stale pipeline) | SQL-QA-08 (`sql-int-dates-text-10`) |
| DQ-06 | `cancelled` order with `approved` (unrefunded) payment | SQL-QA-09 (`sql-adv-antijoin-10`) |
| DQ-07 | Payment `amount_cents ≠ orders.total_cents` (partial captures) | SQL-QA-03 (`sql-int-join-03`), hunt-db-005 delta |
| DQ-08 | Active product with `inventory.quantity = 0` and recent orders | SQL-QA-06 (`sql-int-outerjoin-04`) |
| DQ-09 | `loyalty_tier='gold'` customers with near-zero lifetime spend | `sql-adv-condagg-08` |
| DQ-10 | `marketing_opt_in=1` but email `NULL`? — **rejected**: `email` is NOT NULL. Replaced by: opted-in customers whose addresses are all missing `line1`? — rejected; kept as: opted-in customers with no address row | SQL-QA-10 (`sql-bgn-null-12`) |
| DQ-11 | `phone` formats mixed (`+1-555-…`, `(555) …`, NULL) | SQL-QA-10 (`sql-bgn-null-12`) |
| DQ-12 | Duplicate-looking orders: same customer, same day, same total | SQL-QA-11 (`sql-int-having-02`) |

Canonical row totals: 8 + 42 + 42 + ~120 + ~160 + ~220 + ~600 + ~220 ≈ **1,400
rows**, ≤300 KB SQL text, expected in-memory WASM DB < 4 MB. The integrity
test (§12.2-T1) asserts every anomaly class appears at least once and every
structural class (FK/UNIQUE violation) appears **zero** times.

### 5.4 Generation strategy

`scripts/generate-sql-seed.mjs` — Node ESM, **mulberry32(seed = 20261117)**,
explicit ids in ranges (categories 1–8, products 1–42, customers 1001–1120, …),
atomic emission (`BEGIN;` … `COMMIT;`), sorted INSERTs, `--regenerate` mode.
Output is **committed** at `public/datasets/meridian-outfitters.sql`; CI/tests
re-run the generator and fail on byte drift
(`tests/data/sql-seed.test.ts` re-generates into memory and compares).

Why generated-and-committed rather than runtime-synthesized: reproducibility
(a bug in a learner's result must be reproducible by a maintainer), diff-ability
(PR review sees data changes), offline determinism, and zero server cost.

### 5.5 Per-exercise setup deltas and per-hunt corruption deltas

| Class | Content | Delivery | Examples |
|---|---|---|---|
| Exercise `setupSql` (typed, small) | Inserts/updates to a **clone applied only for that exercise** (orphan injection, null-padding, duplicate pairs) | Compiled into `src/data/sqlExercises.ts` (client-safe — it IS the setup) | Orphan rows for referential-integrity exercises |
| Exercise `foreignKeys` flag | `on` (default) / `off` | Same | Orphan exercises need OFF during setup |
| Hunt corruption delta | 1–12 statements | **Server-only** (`src/server/sqlSeedDelta.ts`), returned on `GET /api/v1/sql/hunts/:id/seed` post-start | DQ-01-style corruption scoped to the hunt |
| Reset | Reseed canonical + reapply nothing (hunts: reapply after explicit re-start or re-fetch delta — see §9.4) | Client | "Reset database" restores the *hunt-corrupted* baseline while a hunt is active; "Reset exercise / Leave hunt" restores canonical clean |

Deltas never ship in `public/` or in the JS bundle; they are compiled server
code returned on demand to bug-hunt sessions (§6.5), mirroring how reveals are
returned on demand in Phase 4. A learner reading raw network traffic sees what
any motivated learner could infer from a diff; that is accepted and documented
(§14). No delta ever touches D1.

### 5.6 Sizes, budgets, reset performance

- Seed asset ≤ 300 KB; fetch + parse + insert expected < 800 ms on a mid-tier
  laptop; measured and recorded in the M1 verification log.
- Reset = terminate worker → spawn worker → re-fetch seed (HTTP cache hits) →
  exec → reapply hunt delta if active. Target ≤ 2 s. The worker is **recreated**
  on every reset so WASM memory from prior mutations is fully reclaimed.

## 6. SQL execution and isolation safety design

### 6.1 Isolation rule (inviolable)

Learner SQL executes **only** inside the per-page Web Worker's WASM linear
memory. There is no code path from learner input to D1, to any network socket,
to the filesystem, or to another origin. The shared platform database remains
an implementation detail; the SQL surface is disposable and per-tab.

### 6.2 Worker protocol (`src/lib/sql/worker.ts` / `client.ts`)

Requests: `reset{seedSql, deltaSql?}`, `run{sql}`, `schema{}`, `export{}`
(debug only in dev), `close{}`. Responses: `ready{sqliteVersion}`,
`result{columns, rows, rowCount, elapsedMs, truncated}`,
`resultSets[]{…}` (one per statement), `error{statementIndex, message, kind}`,
`schema{tables[]{columns, indexes, constraints, ddl}}`. Correlation ids are
monotonic integers; unknown-response types are dropped; the client ignores
out-of-order responses by id.

### 6.3 Timeout and memory safeguards (hard limits)

| Safeguard | Limit | Enforcement |
|---|---|---|
| Wall-clock per Run | **3,000 ms** | Main thread timer → `worker.terminate()` → fresh worker + reseed (hunt delta reapplied) → error `"Query exceeded the 3 second limit. The database was reset."` |
| Rows returned per statement | **1,000** | Statement `step()` loop stops at cap; `truncated: true` renders a notice + "export limit reached" |
| Statements per Run | **50** | Pre-flight classifier counts; reject before posting to worker |
| Query text length | **100 KB** | Client-side check |
| Cell value size | **10 KB** | Per-cell truncation with marker `… [truncated]` |
| Result payload per Run | **≤1 MB** (columns+rows JSON) | Post-serialization check; hard-trim rows to fit; `truncated: true` |
| Forbidden statements | `ATTACH`, `DETACH`, `VACUUM INTO`, `PRAGMA writable_schema`, `load_extension(...)` | Pre-flight classifier rejects with explanatory message (case-insensitive, comment-stripped) |
| DDL/DML side effects | In-memory only | Rebuilt from canonical seed + deltas at will; never persisted |
| Idle lifetime | Worker recreated on route unmount and on Reset | `useEffect` cleanup + Reset path |

`EXPLAIN QUERY PLAN` and read-only `PRAGMA`s (`table_info`, `index_list`,
`foreign_key_list`, `compile_options`, `foreign_keys` *read*) are explicitly
allowed — they are teaching surfaces. Mutating `PRAGMA foreign_keys` is
honored only per the exercise spec; free-play honors it too (it binds only the
learner's own sandbox). There is no privilege escalation possible: SQLite has
no ambient authority beyond its one file (here: memory).

### 6.4 Pre-flight classifier

A pure function `classify(sql)` (string → `{ ok, statementCount, forbidden[] }`)
is used **only** for UX guardrails and the 50-statement/forbidden checks — it
is not, and never becomes, a security boundary (the boundary is the worker +
WASM cage). It strips `--` line comments and `/* */` blocks before scanning.
Unit-tested exhaustively (strings containing `'ATTACH'` inside literals are not
flagged; `VACUUM` alone is allowed — it cannot escape memory).

### 6.5 Seed-delta delivery control

`GET /api/v1/sql/hunts/:huntId/seed` →
`401` without session · `403 not_hunt_mode` (or `404 not_found`, indistinguishably)
in clean mode or non-SQL hunt · `200 { huntId, deltaSql }` in bug-hunt mode for a
registered SQL hunt. Idempotent; global 120/min mutation backstop plus scoped
`sql-seed:<iphash>` 30/min reuse the Phase 3/4 limiter pattern; handler does no
D1 writes. The delta is compiled code, never read from D1.

### 6.6 Reset / clear / restore semantics (explicit)

| Control | Meaning | Never means |
|---|---|---|
| **Clear results** | Empties the output pane; editor contents kept | Touching the DB |
| **Reset database** (Tab key hint ⌘⇧R) | Terminates worker, fresh worker, canonical reseed (+ active hunt delta), explorer rebuilt | Persisting anything server-side |
| **Clear editor** | Empties the SQL buffer (confirm if non-empty) | Losing the exercise prompt |

"Restoring the database" IS "Reset database"; the button label and the empty
state both say "the original practice snapshot is restored". There is no
separate persistent snapshot to manage, which is what keeps isolation
absolute: two tabs, two DBs, zero shared fate.

### 6.7 One learner cannot affect another

No server-side mutable learner state exists in the data plane. The control
plane holds only Phase 4 artifacts (attempts/reports), already session- and
customer-scoped. Deltas are compiled constants. Seed is a static file.
Cross-learner leakage is structurally impossible, not merely policy-controlled.

## 7. Complete exercise and SQL topic coverage

### 7.1 Exercise model

Every exercise is a typed definition in `src/data/sqlExercises.ts` (client-safe
prompt data) with a server twin in `src/server/sqlExercises.ts` (expected spec
+ feedback). Shared ids: `sql-<level>-<topic>-<nn>`. Common fields: `id`,
`title`, `qaScenario` (one-paragraph QA framing), `objective`, `difficulty`,
`estimatedMinutes`, `tables[]`, `relevantConstraints[]` (chips shown in the UI),
`setupSql?`, `foreignKeys?`, `check` (post-run evaluation spec), `hints[]`
(3 levels), `solution` + `explanation` (server-only, revealed via gated
endpoint), `relatedGuideIds[]`, `exampleEvidence` (what a good submission looks
like). Exercises reset via the standard Reset (§6.6).

### 7.2 Evaluation model (result-based, not SQL-text-based)

- **Default:** server compares the submitted result multiset against a
  compiled expected spec — `{ columns: [{name, kind}?], rows: [[…]], ordered:
  bool, collate?: 'binary'|'nocase', numericTolerance?: … }`. Column **names**
  are compared case-insensitively; **values** are canonicalized (trim, NULL vs
  empty-string distinction preserved, integer-exact for cents, ISO-date
  lexicographic). `ordered: false` (default for non-`ORDER BY` exercises)
  compares multisets.
- **DML / transaction / constraint exercises** use a **post-state check**: the
  exercise declares a `checkSql` (client-visible — it reveals *what to
  inspect*, never expected *values*) executed in the sandbox after the learner's
  writes; its columns/rows go to `POST /api/v1/sql/evaluate`.
- **Rubric** per exercise: e.g. `column_match 30 + row_multiset 60 +
  ordered_when_required 10`, or all-or-nothing for binary checks (e.g.,
  rollback verification). Score 0–100; **pass ≥ 70**. Deterministic,
  unit-tested per exercise. Feedback strings are compiled and specific
  ("Expected 3 rows, got 5", "column `tier` missing", "row mismatch — check the
  join predicate", "ordering was required by the question").
- Exact-string SQL matching is **not used anywhere**.

### 7.3 Topic coverage matrix (all charter topics → exercise ids)

| Charter topic | Exercises | Level |
|---|---|---|
| SELECT, WHERE, ORDER BY, LIMIT | sql-bgn-select-01, sql-bgn-where-02, sql-bgn-orderby-03, sql-bgn-limit-04 | Beginner |
| DISTINCT + filtering | sql-bgn-distinct-05, sql-bgn-ops-06 | Beginner |
| Aggregates (COUNT/SUM/AVG/MIN/MAX) | sql-bgn-agg-07, sql-bgn-count-08 | Beginner |
| BETWEEN / IN / LIKE / text ops | sql-bgn-between-09, sql-bgn-like-10, sql-bgn-text-11 | Beginner |
| NULL handling | sql-bgn-null-12 | Beginner |
| GROUP BY / HAVING | sql-int-groupby-01, sql-int-having-02 | Intermediate |
| INNER JOIN | sql-int-join-03 | Intermediate |
| OUTER JOIN (LEFT/RIGHT/FULL) | sql-int-outerjoin-04 | Intermediate |
| Multi-table joins (3+) | sql-int-multijoin-05 | Intermediate |
| Subqueries (IN/EXISTS/scalar) | sql-int-subq-in-06, sql-int-subq-exists-07 | Intermediate |
| Correlated subqueries | sql-int-correlated-08 | Intermediate |
| CASE expressions | sql-int-case-09 | Intermediate |
| Date & text operations | sql-int-dates-text-10 | Intermediate |
| INSERT / UPDATE / DELETE | sql-int-insert-11, sql-int-update-12, sql-int-delete-13 | Intermediate |
| Transactions & rollback | sql-adv-txn-01 | Advanced |
| Constraints & referential integrity | sql-adv-constraints-02 (integrity *verification* lives in SQL-QA-07 with deltas) | Advanced |
| Indexes & EXPLAIN / optimization | sql-adv-explain-04, sql-adv-index-05 | Advanced |
| CTEs | sql-adv-cte-06, sql-adv-recursive-07 (recursive: org-chart-style flagged stretch goal — see §7.4) | Advanced |
| CASE in aggregation / conditional aggregates | sql-adv-condagg-08 | Advanced |
| Data reconciliation & consistency | sql-qa-* (§8) | All |
| Window functions | sql-adv-window-09 (ROW_NUMBER/RANK/LAG) | Advanced |
| Aggregation correctness / anti-joins / dedup patterns | sql-adv-antijoin-10, sql-adv-dedup-11, sql-adv-aggcorrect-12 | Advanced |

Total: 12 beginner + 13 intermediate + 11 advanced = **36**. (Recount in M2 if
content review merges two; the coverage matrix is the contract.)

### 7.4 Advanced / delivery notes

- `sql-adv-recursive-07` is the only stretch item: recursive CTEs are valid
  SQLite; if the exercise proves brittle in M2 content review it is replaced
  by a non-recursive CTE stack, never dropped silently — the coverage matrix
  in this plan is amended in the same commit.
- Window functions are supported by the bundled SQLite; exercises use
  `ROW_NUMBER()`, `RANK()`, `LAG()` only.
- Every exercise ships `exampleEvidence` and `solution` with `explanation`;
  solutions are never imported client-side (leak-linted).
- Difficulty progression is advisory (badges + recommended order), not locked;
  there are no streaks, leaderboards, or speed pressure (Phase 4 philosophy).

### 7.5 Exercise families (grouping labels; families overlap by design)

| Family | Members (examples) |
|---|---|
| Query fundamentals | all 12 beginner exercises |
| Aggregation & grouping | agg-07, count-08, groupby-01, having-02, condagg-08, aggcorrect-12 |
| Joins & set relations | join-03, outerjoin-04, multijoin-05, antijoin-10, dedup-11 |
| Subqueries & CTEs | subq-in-06, subq-exists-07, correlated-08, cte-06, recursive-07 |
| CASE & conditional logic | case-09, condagg-08 |
| Data modification & integrity | insert-11, update-12, delete-13, txn-01, constraints-02 |
| Window functions | window-09 |
| Query planning & performance | explain-04, index-05 |
| QA data-quality (see §8) | the `SQL-QA-*` labels ride on 13 of the 36 ids (map in §8) |

The registry is the single source of truth for the exact list; the coverage
matrix in §7.3 is the contractual topic map (distinct ids: 36).

## 8. Database-testing scenario catalogue

Fourteen QA scenarios — the part that teaches *testing*. Each of the first thirteen is the **QA
framing layered on one of the 36 registry exercises** (the `qaId` / `SQL-QA-nn` label, its briefing,
and the hub's *Testing goals* facet) — one id per exercise, nothing double-counted, nothing
duplicated. SQL-QA-14 is the investigation framing shared by the eight hunts. The registry is the
single source of truth; the map below is contractual and test-enforced (tag presence on those ids).

| QA id | Registry exercise it frames | Scenario (learner-facing name) | What the learner does | Tables | Mode |
|---|---|---|---|---|---|
| SQL-QA-01 | sql-int-multijoin-05 | Verify order and line-item consistency | Pick one order; prove items exist, reference valid products, snapshot price = product price or documented override | orders, order_items, products | clean |
| SQL-QA-02 | sql-int-groupby-01 | Reconcile order totals against item totals | Sum `line_total_cents` per order; diff against `orders.total_cents`; investigate mismatches (DQ-01/DQ-02) | orders, order_items | clean |
| SQL-QA-03 | sql-int-join-03 | Payments vs orders reconciliation | Join payments; find approved-but-mismatched amounts (DQ-07) | payments, orders | clean |
| SQL-QA-04 | sql-adv-dedup-11 | Find duplicate customers | Case-insensitive email duplicates (DQ-03) and same-name pairs (DQ-04); propose dedup criteria | customers | clean |
| SQL-QA-05 | sql-adv-aggcorrect-12 | Detect incorrect line aggregation | Hunt rows where `line_total ≠ qty × price` and estimate blast radius | order_items | clean |
| SQL-QA-06 | sql-int-outerjoin-04 | Verify inventory consistency | 0-quantity products with historical orders (DQ-08); thresholds breached | inventory, products, order_items, orders | clean |
| SQL-QA-07 | sql-adv-constraints-02 | Referential integrity sweep | Prove no orphans orders→items→products/payments/addresses; then flip FK off and watch it happen (setup delta) | all | clean (setup delta) |
| SQL-QA-08 | sql-int-dates-text-10 | Stale pipeline sweep | `pending`/`placed` orders older than 30 days; amount at risk; report list | orders | clean |
| SQL-QA-09 | sql-adv-antijoin-10 | Cancellation hygiene | Cancelled orders with unrefunded approved payments (DQ-06); count, sum | orders, payments | clean |
| SQL-QA-10 | sql-bgn-null-12 | Missing and malformed data sweep | NULL phones (DQ-11), opted-in customers without addresses (DQ-10), suspicious postal codes | customers, addresses | clean |
| SQL-QA-11 | sql-int-having-02 | Double-charge candidates | Same customer + same day + same total orders (DQ-12); count, self-join | orders | clean |
| SQL-QA-12 | sql-int-delete-13 | Deletion behavior verification | Observe what `ON DELETE CASCADE` does and does not cover; dry-run inside a transaction | order_items, payments, orders | clean |
| SQL-QA-13 | sql-adv-txn-01 | Transaction rollback verification | BEGIN → intentional wrong UPDATE → ROLLBACK → prove quantities/totals unchanged | order_items | clean |
| SQL-QA-14 | (hunt framing, not a registry id) | Investigate unexpected state ("corrupted snapshot") | Given a post-incident snapshot (applied delta), write the queries that bound the blast radius and produce the recovery report skeleton | all | bug-hunt (routes into §9 hunts) |

Tagging: `track: 'database-testing'`, `kind: 'qa'` on the 13 tagged ids — the `/database` hub renders a
**Testing goals** facet filter (All / Fundamentals / Testing goals / Bug hunts). A content test asserts
every `SQL-QA-01…13` `qaId` resolves to exactly one `SQL_EXERCISES` registry entry and each of those 13
ids carries the tag exactly once.

## 9. Database bug-hunt design and defect catalogue

### 9.1 Design principles (inherited, not re-invented)

- **Code registries, not data.** SQL hunts are `HUNTS` entries with
  `kind: 'sql'`; defect internals never appear in any API response or bundle.
- **Deterministic.** Delta SQL is compiled, argument-free (values inlined as
  literals from seed constants); same session + same hunt ⇒ byte-identical
  corrupted snapshot.
- **Scoped.** Corruption exists only in the learner's WASM memory; D1,
  other tabs, and production are untouched.
- **Clean mode is sacred.** Clean sessions never fetch a delta; the seed
  applier only ever applies a delta in `bug_hunt` mode for a `hunt-db-*` hunt.
- **Reset restores.** "Reset database" re-applies canonical + (if active)
  delta — the hunt environment returns to its intended broken baseline;
  "Reset exercise/mode" (leave hunt) restores canonical clean.
- **Evaluation = existing Phase 4 pipeline.** Structured bug report →
  deterministic §6.4-style rubric (reused, unchanged) → `best_quality_score`,
  sticky `discovered` at ≥70. Hints: 3-level ladder, idempotent. Reveal:
  gated on submit or confirmed give-up. No new evaluation code paths.

### 9.2 Defect catalogue (8 hunts)

| Hunt ID | Title (learner-safe) | Defect (maintainer view) | Delta strategy | Expected vs actual |
|---|---|---|---|---|
| hunt-db-001 | Order items without products | Orphaned `order_items.product_id` (e.g., 9999) inserted with FK off | `PRAGMA foreign_keys=OFF;` + INSERTs; re-enable per spec | Expected: every item joins to a product. Actual: N orphans; naive `JOIN` hides them; `NOT IN` anti-join finds them |
| hunt-db-002 | The signup email lookalikes | Two near-duplicate customers (case variant + one `.` drift) plus a third with trailing space | INSERTs into `customers` | Expected: one identity per real customer. Actual: lookalikes inflate counts, split order history |
| hunt-db-003 | The order that drifted | One delivered order's `total_cents` set to a plausible-but-wrong figure | UPDATE one row | Expected: total reconciles with items+shipping+tax. Actual: off by a non-round amount; the confirmation email disagrees |
| hunt-db-004 | Stock that lied | `inventory.quantity` for one product set to a wrong (still ≥0) value | UPDATE one row | Expected: on-hand reflects history. Actual: sell-through reports under-state; checkout would oversell |
| hunt-db-005 | The silent payment | One delivered order's `payments` row deleted | DELETE one row | Expected: every delivered order has exactly one payment. Actual: missing; revenue under-counts |
| hunt-db-006 | Line totals that ignore quantity | Subset of `order_items` set `line_total_cents = unit_price_cents` | UPDATE subset | Expected: `line_total = qty × price`. Actual: indistinguishable in the UI; aggregates under-count |
| hunt-db-007 | The boundary that would not checkout | One product whose `inventory.quantity` exactly equals a recent order's quantity; the hunt checks consistency reasoning, not the API | UPDATE one row | Expected: boundary orders are fulfilled exactly once. Actual: drift between `orders` and `inventory` exposes the boundary class (mirrors INVENTORY-001 in data form) |
| hunt-db-008 | The customer who vanished | One customer row deleted with FK off; their orders remain | `PRAGMA foreign_keys=OFF;` + DELETE; orders keep `customer_id` | Expected: no orders reference missing customers. Actual: orphaned orders; joins silently drop them |

Each hunt carries: full `expected`/`actual`/`repro`/`fix` in
`docs/bug-hunt-catalogue.md` (M2, maintainer-only); 3-level hint ladder
(e.g., L1 "start from the join", L2 "compare row counts both directions",
L3 "compare payments joined vs anti-joined"); reveal with query + explanation;
scenario page wired via the existing `huntId` scenario field
(`db-orphaned-carts` → `hunt-db-001` in M2, retitled to match); evaluation via
the standard report rubric with per-hunt `exampleEvidence` in the exercise card.

IDs are stable, lowercase-hyphen, pattern-clean (`HUNT_ID_PATTERN`); scenario
wiring is bidirectional-validated by `tests/data/content.test.ts` (existing
test extended, not duplicated).

### 9.3 Determinism & isolation proof strategy

`tests/server/sql-hunt.test.ts` (M2): two sessions, same hunt, fresh DBs →
byte-identical `export()` outputs (or identical `schema{}` + checksums of all
tables); different hunts → different snapshots; clean mode never receives
delta (asserts `403`/`404` paths); reset restores intended baseline (export ==
frozen fixture bytes per hunt).

### 9.4 Start path and the daily cap (explicit decision)

SQL hunts register in `HUNTS` with a new `kind: 'sql'` discriminator.
`POST /api/v1/practice/hunts/:huntId/start` remains the single start path; for
`kind: 'sql'` it creates the attempt **without** consuming the 20/IP/UTC-day
`hunt_start_caps` budget (that cap is reserved for the ten interactive
UI/API hunts). Rationale: 10 interactive + 8 SQL hunts would otherwise press
against the cap, and SQL hunt attempts are read-mostly and idempotent. The
cap code path is untouched for `kind: 'ui'` (current behavior preserved and
covered by existing tests). Abuse is still bounded by the 120/min global
mutation backstop and one-row-per-attempt (partial unique index).

### 9.5 Interaction with Phase 4 give-up / reveal semantics

Unchanged: submitting a report (any quality) ends the attempt as `submitted`;
give-up with confirmation flips to `revealed`; `discovered` is sticky once a
report passes. SQL hunts pass/fail through the identical report evaluator —
no SQL-specific scoring shortcuts, no AI anywhere.

## 10. Evaluation, scoring, hints, and progress integration

### 10.1 Attempt reuse (no new tables)

`hunt_attempts` fits SQL exercises unchanged: `hunt_id` is free-form TEXT
(≤64 chars, CHECK), registry-resolved. SQL exercise ids (`sql-bgn-…`,
`hunt-db-…`) are ≤ 32 chars. `status`, `hint_mask`, `best_quality_score`,
`discovered`, cascade with session — all correct as-is. **No migration is
needed for attempts.**

### 10.2 Registry unification

`src/server/sqlExercises.ts` exports `SQL_EXERCISES: SqlExerciseDefinition[]`
with `{ id, title, scenarioId?: string, difficulty }`.
`buildHuntEntries` iterates `HUNTS.concat(SQL_EXERCISES)` (or a shared
`ALL_ATTEMPT_TARGETS`); SQL exercise entries carry no `scenarioId` —
`ProgressHuntEntry.scenarioId` becomes optional and the progress UI renders
plain text without a link when absent. Public shape of
`GET /api/v1/practice/progress` is otherwise unchanged (additive only: new
entries in the `hunts` array + `totals.attempts` counting them).

### 10.3 Evaluation endpoint

`POST /api/v1/sql/evaluate`

```jsonc
// request (≤1 MB body, existing 413 guard applies)
{ "exerciseId": "sql-int-join-03", "columns": ["order_number", "total"], "rows": [["MO-2026-0042", 12999]], "rowCount": 1, "truncated": false }
// response 200
{ "passed": true, "score": 100, "checks": [{ "id": "columns", "passed": true, "detail": "…" }], "feedback": "…", "attemptStatus": "submitted" }
```

- `401` no session; `404` unknown exercise id; `400` malformed envelope;
  `413` oversize; scoped rate limit `sql-eval:<iphash>` **30/min** (reuses the
  Phase 3 fixed-window limiter); global backstop applies.
- Comparison engine (`src/server/sqlEvaluate.ts`): multiset compare by
  default; `ordered` honored when the exercise requires it; value
  canonicalization centralized (trim, case per spec, numeric-int exact);
  column-name match case-insensitive; missing column ⇒ named check failure.
- **Side effect:** on `passed` with an open attempt → `status='submitted'`,
  `best_quality_score=MAX(existing, score)`, `submitted_at=now`. On `failed` →
  attempt stays `in_progress`; response carries actionable check details.
- Nothing about the rows is persisted or logged. The comparison is O(n log n)
  in rows returned — trivially inside free-tier CPU.

### 10.4 Start endpoints

`POST /api/v1/sql/exercises/:id/start` → idempotent attempt creation for
clean exercises (mirrors the hunt-start idempotency); `404` unknown id;
`401` no session (client ensures session exists app-wide already). Not
rate-capped beyond global backstop (§9.4 rationale; attempts are one row).
Hints: existing `POST /api/v1/practice/hunts/:huntId/hints` — SQL exercise ids
are valid `:huntId` values once both registries are concatenated in the hint
lookup. Reveal: same for `GET/POST …/reveal` with existing gating.

### 10.5 Feedback quality bar

Every failing check names the column/row and a concrete next step; no lorem,
no "try again". Examples: `Expected 3 rows, got 5 — re-check the JOIN predicate
or the WHERE clause`; `Column \`tier\` missing — the question asks for the tier
per customer`; `Row count matches; values differ at row 2, column \`total_cents\`
— recompute from items, not from orders.total_cents`.

### 10.6 Progress integration details

- `/progress` gains a **Database Testing** section listing SQL entries
  (attempts, best score, hints used, last activity) beneath the hunt list;
  totals remain global (attempts, submitted, discovered, hints, best average).
- Empty state copy updated to name SQL exercises.
- Guest learners: session-scoped ephemeral, unchanged Phase 4 semantics
  (attempts cascade with session); signed-in learners: customer-scoped union,
  unchanged. No new identity surface.
- Recommended path (`src/lib/recommendedPath.ts`, Phase 4 WP2) gains a
  database node sequence: foundations exercises → QA scenarios → first hunt.
- `/database` hub surfaces the learner's own completion rings per difficulty
  band (read from the same progress endpoint; no new endpoint).

### 10.7 Migration 0012 — `db/migrations/0012_sql_lab_schema.sql`

**No table changes.** Only `app_meta.schema_version` 11 → 12, with a header
comment documenting that Phase 6 introduced no DDL (attempts reused). This
keeps the release train predictable: one migration per phase, additive-only.
If review concludes a bump is unnecessary, dropping the migration is a
maintainer decision recorded in `PROJECT_STATE.md` at M2 completion — but the
default is bump-and-comment, matching prior phases' version discipline.

### 10.8 Nothing duplicated

Reused verbatim: `hunt_attempts`, hint ladder, reveal gate, report evaluator,
`PracticeSessionProvider`, progress endpoint, `/progress` page shell, attempt
status chips, `hintReveal.ts`/`attemptStatus.ts` client libs, `Modal` (give-up
confirmation), leak-lint test family, `fake-d1` harness. New: the result
comparison engine, three routes, one registry, content modules, UI.

## 11. UI/UX implementation scope

(Design grounding in §2.4: the ui-ux-pro-max `--design-system` query for this
workspace returned the "code dark + run green" developer-tool pattern with
JetBrains Mono/IBM Plex Sans and avoid-light-default — i.e., the existing
`[data-surface="workspace"]` idiom is the sanctioned direction, and Phase 6
extends it rather than introducing a second visual language. Skill scope note:
web/desktop items only; no touch-target sizing beyond keyboard operability; no
emoji-as-icons; semantic icons already exist in the `Icon` component.)

### 11.1 Routes and layout

| Route | Purpose | Layout |
|---|---|---|
| `/database` | Hub: what this is, dataset card (Meridian Outfitters snapshot, row counts, constraint/index counts), how to run/check, difficulty bands (Beginner/Intermediate/Advanced/Testing goals), exercise grid with topic+difficulty facets, hunt cards with Bug-Hunt badges, progress rings | Standard AppShell page, workspace-tinted panels |
| `/database/playground` | Free workspace: editor / results / explorer; no exercise; samples menu; reset controls; "no account needed" note | 3-pane ≥1024px (editor+results flexible · explorer 280–320px collapsible); tabbed ≤768px |
| `/database/exercises/:exerciseId` | Exercise workspace: instructions (scenario, objective, tables+constraint chips, expected evidence), editor, results, Check work, 3-hint ladder, gated reveal, attempt chip, Reset | Same grid; instructions docked left ≥1280px, collapsible elsewhere |

Grid discipline: CSS grid, `minmax(0,1fr)` editor column, `min-width: 0` on all
flex/grid children (no overflow blowouts), `overflow:auto` contained panels;
results table scrolls inside its panel, sticky `thead` (`position: sticky`).
Numeric cells `font-variant-numeric: tabular-nums`; right-aligned; mono.
Row hover = surface step; selected row outline via tokens (focus-visible safe).

### 11.2 The workspace chrome

Panels use `.workspace-panel` + `.workspace-head`/`.workspace-title`/`.workspace-status`
("READ-ONLY SNAPSHOT", `sqlite 3.x · in-memory`, `reset on every Run of seed`…
copy honest and specific). Run button = primary `Button` with monospace ⌘↵ hint;
Destructive/secondary pair for Clear results vs Reset database. Status line after
Run: `12 rows · 3 ms · truncated: no` in `.workspace-status` idiom. Errors render
as a callout (danger tokens) with the SQLite message verbatim + failing statement
index + the line hint (`near "…": syntax error`). Empty state: ghost query +
three starter templates (top-5 products, revenue by category, orders without items).

### 11.3 Editor

JetBrains Mono, 13–14px, line-height 1.6, generous padding, no line numbers in
v1 (textarea geometry makes them lie) — instead a gutter-free full-width field
(decided); Tab inserts two spaces; ⌘/Ctrl+Enter runs; Escape blurs; `spellCheck={false}`,
`autoCapitalize="off"`, `autoCorrect="off"`, `aria-label="SQL editor"`,
`aria-describedby` → shortcuts hint. Highlight palette: keywords = accent,
strings = success-ish, comments = muted, numbers = info; all ≥4.5:1 on sunken
surface in both themes (verified in the M2 audit).

### 11.4 Responsive & accessibility contract

375px / 768px / 1024px / 1440px verification (same matrix as Redesign M8);
both themes; `prefers-reduced-motion` disables editor focus transitions;
visible focus rings everywhere (tokens); full keyboard operability (Run, Clear,
Copy, Reset, hints 1–3, reveal, check, tab/drawer toggles) with logical order;
`aria-live="polite"` on the results/status region; `role="alert"` on errors;
schema explorer is a `<details>`-style disclosure with aria-expanded; copy
button announces "Copied N rows"; no layout-shifting focus transforms; color
never sole carrier of state (chips carry text).

### 11.5 Copy & consistency

Copy tone matches existing lab voice; "Database" nav label; page titles via
`useDocumentTitle`; footer breadcrumb current-item wrap; 404 unaffected.
No new icons (`database` exists); `Icon` component reused.

### 11.6 Performance budgets

`/database` route chunk ≤ 120 KB gzip incremental; wasm ≤ 600 KB gzip lazy;
seed ≤ 300 KB; TTI unchanged for existing routes (no cross-imported deps).
Record actuals in the M2 acceptance log.

## 12. Testing strategy and acceptance criteria

### 12.1 Layers

| Layer | What | Where |
|---|---|---|
| Seed integrity | Counts per table; FK/UNIQUE/CHECK satisfied; anomaly classes present/absent; regeneration byte-identity | `tests/data/sql-seed.test.ts` (node:sqlite) |
| Engine | open/run/export/schema; multi-statement results; truncation at 1,000 rows; statement cap; classifier (literal-safety); timeout path (short injected budget via fake timers at worker boundary) | `tests/lib/sql-engine.test.ts`, `tests/lib/sql-classifier.test.ts` |
| Reference solutions | **Every exercise's shipped solution SQL is executed against the canonical seed + setup delta and must pass its own evaluator** — 36/36 green, plus the 8 hunt deltas apply cleanly | `tests/lib/sql-exercises.test.ts` |
| Evaluator | Multiset vs ordered; canonicalization (case, trim, cents); column-name CI; missing column; oversize row cap; numeric tolerance; determinism | `tests/server/sql-evaluate.test.ts` |
| Endpoint matrix | 401/404/400/413/429; evaluation side effect on pass; attempt idempotent start; seed endpoint 401/403/404/200 matrix; delta determinism (two calls → identical SQL) | `tests/server/sql.test.ts` |
| Attempts/progress | SQL exercise entries appear; scenarioId-optional render; guest vs account scoping; cascade on session delete; hints/reveal gating for `sql-*` ids | extend `tests/server/attempts.test.ts`, `tests/server/progress.test.ts` |
| Leak lint | No `solution`, `expected`, hint/reveal bodies, or delta figures in client source/bundle | extend `tests/lib/hint-reveal.test.ts` → `tests/lib/sql-leak.test.ts` |
| Client | SSR markup for editor chrome, results states (empty/truncated/error), explorer badges, exercise card, progress section; a11y roles/labels | `tests/practice/*.test.tsx` siblings |
| Manual | 4 widths × 2 themes × reduced-motion; both-theme contrast audit; keyboard walkthrough; offline-after-first-load behavior | Phase exit checklist |
| Regression | Full `npm run check` + build size report; existing suites untouched and green | CI of record |

### 12.2 Measurable acceptance criteria (phase exit)

1. `npm run check` green; total test count increases by **≥ 90** (baseline 851
   on `main` today — measured at phase start).
2. **36/36** exercises pass their reference solutions through the real
   evaluator (test-enforced).
3. **8/8** hunt deltas produce deterministic snapshots (double-fetch byte
   equality test) and reset restores the intended broken baseline.
4. Runaway query (`WITH RECURSIVE` bomb or `SELECT` Cartesian blow-up) is
   terminated by the worker guard and the UI renders the timeout callout;
   measured wall time ≤ 4.0 s including reseed.
5. Seed asset ≤ 300 KB; wasm ≤ 600 KB gzip; `/database` first-visit JS+WASM
   delta vs. `/practice` baseline recorded in the acceptance log.
6. `grep -ri -E "(hunt-db-00[1-8]|DEFECT|solution)" dist/assets/` finds no
   exercise solutions, expected rows, or defect internals (leak-lint enforced).
7. Both themes, four widths: zero contrast failures (≥4.5:1 text), zero
   focus-obscured elements, zero unlabelled controls; reduced-motion pass.
8. Existing behavior frozen: `git diff` on `src/server/{checkout,cart,auth,
   inventory,reports,hints,reveals,progress}.ts` is empty or test-backed-additive;
   `tests/server/*` pre-existing tests all pass unmodified.
9. Production smoke (post-approval only): `/api/health` `schemaVersion: 12`,
   `/database` loads, one exercise completable end-to-end as guest, zero
   console errors.
10. `docs/bug-hunt-catalogue.md` documents all 8 hunts (expected/actual);
    `README.md` gains the Phase 6 paragraph; `PROJECT_STATE.md` §11 entry
    written in the same turn as M2 completion.

## 13. Free-tier resource constraints

Verified ceilings (AGENTS.md §7; pages free tier) — Phase 6 stays inside them:

| Resource | Phase 6 footprint | Headroom note |
|---|---|---|
| Pages build | 1 build/deploy, same pipeline; +1 static asset (wasm ≤1.5 MB, seed ≤300 KB — far under the 25 MiB asset cap) | No 500 builds/month risk |
| Pages Functions CPU | Evaluation is JSON-in/JSON-out compare; O(rows log rows). One invocation per Check work. 10 ms CPU ample for ≤1,000 rows | Well under |
| D1 rows read/written/day | +1 attempt row per exercise start; +1 feedback write per pass; zero per Run; hints/reveals/reports unchanged | Negligible vs 5M/100k |
| D1 storage | No new tables; `schema_version` 12 (0012 is a meta bump) | Negligible |
| Requests | 3 new routes; exercise start/evaluate/hints only on user action | Negligible vs 100k/day Workers quota |
| Bandwidth | wasm + seed ≈ 700–900 KB per unique `/database` visit (cacheable); nothing else heavy | Acceptable at launch scale |
| KV/cron/queues | None used; no new bindings in `wrangler.jsonc` | Unchanged |
| D1 concurrency | No locks held; attempt updates are single-row | Unchanged |

No architectural change may expand this table without an explicit plan amendment.

## 14. Security and privacy considerations

| Threat / concern | Design answer |
|---|---|
| Learner SQL reaches D1 | Impossible — no SQL route exists; §6.1; review-enforced (any `c.env.DB` use in new routes limited to attempt/hint/report/seed paths) |
| SSRF / external fetch from SQL | No URL execution exists anywhere in the phase; worker has no network |
| SQL → filesystem | No `ATTACH`, no `VACUUM INTO`, no `load_extension` (§6.3/6.4); WASM cage |
| Stored XSS via result rendering / messages | All cell values rendered as text (`textContent`/escaped), never `dangerouslySetInnerHTML`; SQLite error text rendered as text; snapshot every audited |
| CSV/TSV clipboard formula injection | Copy-as-CSV quotes per RFC 4180 and prefixes cells starting with `= + - @` with `'` |
| Answer-key leakage | Solutions/expected rows server-only; leak-lint; hints gated; reveal gated; deltas server-only |
| Abuse of evaluate/seed endpoints | Scoped 30/min limiter + 120/min global; bodies ≤1 MB; 1,000-row cap; no oracle beyond pass/fail + check details |
| Timing oracles on ids | Unknown exercise/hunt ids → indistinguishable 404; seed endpoint indistinguishable 403/404 outside bug-hunt mode |
| Synthetic data only | Seed generated in-repo; no real names/emails/phones (all `example.com`); payments reference `pi_synthetic_*` refs |
| Privacy of submitted rows | Rows transit TLS to first-party compare, are compared, and are **discarded** — never logged, stored, or sampled for analytics |
| Injection through `setupSql`/delta sources | Compiled constants; no string interpolation from request paths; exercise ids validated against registry (404 otherwise) |
| Supply chain | sql.js 1.16.0 (MIT, SLSA provenance) pinned with lockfile; `npm audit` reviewed at M1; `allowScripts` untouched; note in M1 log |
| Worker resource exhaustion | Hard 3 s budget + terminate + full worker recreation (§6.6) |
| Shoulder-surfing solutions in bundle | Leak-lint §12.1; exercise client data carries no solutions |
| Guest privacy parity | Guest attempts cascade with the 7-day practice session; sign-out semantics unchanged; no new tracking |

Data-protection stance: Phase 6 collects **less** than Phase 4/5 surface area
(no text reports on clean exercises; nothing per-run), which is called out in
the exit audit.

## 15. Exactly two milestone scopes, tasks, and completion criteria

Two milestones is the right shape: the foundation (M1) is independently
verifiable with zero server changes; the learning experience (M2) builds on it
and carries all server/content/progress/release work. Splitting further would
ship half-features (a playground with no exercises, or exercises with no engine);
merging would breach one-milestone-per-session discipline. Documentation and
release hardening are deliberately **not** separate milestones — they are M2's
final task, as in Phase 5's P5-M3 pattern compressed into M2 scope.

### M1 — SQL Engine, Playground & Datasets

**Goal:** complete isolated SQLite/WASM foundation with the playground live at
`/database/playground` behind the shell; no server, schema, or production
changes. Ships the seed and the engine with real safeguards and tests.

**Tasks**

1. Add dependencies `sql.js@^1.16.0` and `@types/sql.js` (only new deps; exact
   pins per lockfile). Record `SELECT sqlite_version()` output.
2. `scripts/generate-sql-seed.mjs` (generator, mulberry32(20261117), explicit
   ids) → generate + commit `public/datasets/meridian-outfitters.sql`.
3. `src/lib/sql/{engine.ts,worker.ts,client.ts,tokenize.ts,classify.ts}` —
   engine interface, worker protocol (§6.2), classifier (§6.4).
4. `src/components/ui/SqlEditor.tsx` + `src/styles/*` additions (workspace
   editor tokens; reuse existing token files; no new palette).
5. `src/features/database/{Playground.tsx, SchemaExplorer.tsx, ResultsTable.tsx, SampleQueries.tsx, DatabaseHub.tsx (minimal — cards and dataset stats, exercise grid stubbed with "content arrives in M2" honest state)}`.
6. Routes `/database` + `/database/playground` (lazy) in `src/app/App.tsx`;
   `primaryNav` Database entry (position: after API Lab); `useDocumentTitle`.
7. Schema explorer: tables/columns/PK/FK/indexes/constraints via worker
   `schema{}` message; DDL toggle; index list.
8. Safeguards wired end-to-end (§6.3): timeout terminate+reseed, 1,000-row cap
   with truncation UI, 50-statement pre-flight, 100 KB query cap, multi-result
   rendering (per-statement grids, failing statement reported).
9. Actions: Run, Clear results, Clear editor, Reset database (reseed;
   worker recreation), Copy results (TSV/CSV, RFC-4180 + formula-injection
   guard), sample queries + starter templates.
10. Tests: `tests/data/sql-seed.test.ts`, `tests/lib/sql-engine.test.ts`,
    `tests/lib/sql-classifier.test.ts`, `tests/lib/sql-tokenize.test.ts`,
    SSR markup tests for editor chrome/results states; re-run leak lint.
11. Manual verification matrix (both themes × 4 widths × reduced-motion);
    record in M1 log. Update `PROJECT_STATE.md` §11; **no** deploy, **no**
    migration, **no** merge.

**Completion criteria (all required)**

- `npm run check` green; Playground usable end-to-end as a guess: type query →
  ⌘↵ → results; error path; timeout path demonstrable with a seeded heavy
  query (manual evidence); reset restores byte-identical snapshot.
- Seed ≤300 KB and regeneration byte-stable (test).
- Zero changes under `src/server/` and `db/migrations/` (verify with
  `git diff --name-only`).
- Measured wasm size recorded; budgets from §4.2/§11.6 either met or amended
  in the same commit with justification.

### M2 — Database Learning, Testing & Bug Hunts

**Goal:** the complete learner experience — 36 exercises, 14 QA scenarios,
8 database bug hunts, evaluation, progress, UI polish, docs, exit audit.

**Tasks**

1. Server: `sqlExercises.ts` registry (expected specs + feedback),
   `sqlEvaluate.ts`, `sqlSeedDelta.ts`, `sqlHints.ts` + `sqlReveals.ts`
   (3 levels each), `src/server/sql.ts` routes
   (`POST /sql/exercises/:id/start`, `POST /sql/evaluate`,
   `GET /sql/hunts/:id/seed`), unified `HUNTS` iteration for progress,
   `sql`-kind discrimination in hunt start (no cap), optional
   `scenarioId` on `ProgressHuntEntry` + UI link handling.
2. `db/migrations/0012_sql_lab_schema.sql` (app_meta bump + rationale header);
   local D1 verified at `schemaVersion: 12`; **no production migration until a
   separately approved release**.
3. Client: `ExerciseWorkspace.tsx` (instructions panel: scenario, objective,
   tables, constraint chips, evidence block; Check work; hint ladder via
   existing client libs; attempt chip; gated reveal; Reset), `src/data/
   sqlExercises.ts` content (36 defs), `src/data/guides.ts` new guide
   `guide-database-testing-sql`, track `plannedExerciseCount` reconciled,
   database track page CTA → `/database`.
4. QA scenario wiring: `SQL-QA-01..13` as exercises; `SQL-QA-14` as hunt
   framing; hub **Testing goals** facet; `db-order-consistency` →
   `ready`/`runnable` wired to its exercise's parent scenario copy or
   `huntId`-free (catalogue semantics preserved); `db-orphaned-carts` →
   `ready`/`runnable` with `huntId: 'hunt-db-001'`; `tests/data/content.test.ts`
   extended for the new wiring assertions.
5. Bug hunts: `hunt-db-001..008` in `src/server/hunts.ts` (`kind: 'sql'`),
   deltas + expected/actual/repro/fix documented in
   `docs/bug-hunt-catalogue.md`; scenario wiring bidirectional test passes;
   `hunt-db` deltas leak-linted out of client source.
6. Progress: `/progress` Database Testing section; recommended-path database
   node; guest/account parity tests; attempt history on exercise pages.
7. Copy results hardening, truncation UX, empty/error/loading states audit;
   explorer a11y pass (aria-expanded, roving tabindex if list grows).
8. Responsive + both-theme verification at 4 widths; reduced-motion; contrast
   audit documented; bundle-size report; remove any quarantined scaffolding.
9. Regression: full suite green; `git diff` on Phase 3/4/5 server files =
   empty-or-additive; leak lint extended and green.
10. Docs + audit: `docs/phase-6-exit-audit.md` (milestones, security, schema,
    sizes, verification evidence, production addendum slot); `README.md`
    Phase 6 paragraph; `AGENTS.md` status paragraph; `docs/bug-hunt-catalogue.md`
    §SQL; deployment remains a **separate, explicitly approved** step —
    Phase 6 M2 completion ≠ deployed.
11. Final `PROJECT_STATE.md` §11 entry in the same turn as M2's completion.

**Completion criteria (all required)**

- Every §12.2 item satisfied and evidenced; 36/36 reference-solution test;
  8/8 delta determinism test; phase exit audit doc committed; production
  unchanged until release is explicitly approved (migration 0012 applied to
  production D1 only as part of that release, after a pre-migration export —
  same protocol as Phase 5).

### Milestone sequencing and budget

`M1 → M2`, one focused session each, strictly ordered. M1 defines no M2
contracts — engine API change risk in M2 is limited to `schema{}` response
extensions, which are additive. If M1 overruns, M2 scope does **not** shrink;
only scheduling moves (the phase remains two milestones).

## 16. Risks, dependencies, and known limitations

| # | Risk / dependency / limitation | L | I | Mitigation |
|---|---|---|---|---|
| R1 | sql.js WASM blocks first paint or bloats initial bundle | M | M | Lazy route + `?url` + manualChunks; budget gate in M1 exit |
| R2 | Timeout terminate race: worker dies mid-message | L | M | Correlation ids + `ready` handshake; error path re-seeds before next Run |
| R3 | Evaluation false negatives (float noise, date text drift, collation) | M | M | Integer cents, ISO text, `collate` spec per exercise, tolerance where declared; 36/36 reference test catches authoring bugs pre-merge |
| R4 | Seed drift between generator and committed file | M | L | Byte-identity test runs in `npm test`; PR review sees seed diffs |
| R5 | Hunt delta leaks into bundle by accident | L | M | Server-only modules; leak-lint extended; delta fetch behind session gate |
| R6 | 50-statement / 1,000-row caps frustrate power users | L | L | Caps documented in-UI ("export limit reached"); raising them is an M2+ decision with evidence, not default |
| R7 | `ATTACH` classifier false positive on string literal `'ATTACH'` | M | L | Classifier literal-aware; tested; enforcement is advisory anyway (WASM cage is the boundary) |
| R8 | Recursive CTE exercise (`sql-adv-recursive-07`) flaky/needs replacement | M | L | §7.4 amendment path pre-authorized; coverage matrix is the contract |
| R9 | Worker recreation on every Reset churns WASM (memory pressure on low-RAM devices) | L | M | Recreation is required for memory reclamation; measure reset ≤2 s on target hardware; document |
| R10 | Node's `node:sqlite` (test harness) experimental warnings | L | L | Already the repo's harness (`fake-d1.ts`); warnings are informational |
| R11 | Progress page information density regression | L | L | Section follows existing entry component; snapshot test at both themes |
| R12 | Pages serves `.wasm` with correct MIME on all paths | L | M | Verify once at M1 (`curl -I`), record; add `_headers` (`Content-Type: application/wasm`) only if a path misbehaves |
| R13 | Dependency advisory in sql.js transitive deps | L | M | `npm audit` at M1; lockfile pin; document at plan approval |
| R14 | Two-session phase strain (scope) | M | M | Non-negotiable sequencing M1→M2; §15 consolidation rationale; change window only via maintainer-approved plan amendment |
| Dependencies | Node ≥22.12; Vite 7; wrangler 4; Pages Functions; D1 (unchanged); no Cloudflare account changes for M1/M2 (release separate) | | | |
| Known limitations | No OPFS persistence (§17); no ER-diagram rendering; `EXPLAIN QUERY PLAN` output verbatim only; no multi-tab DB sharing (by design); no SQL Server/Postgres dialects (SQLite only, by design); answers visible to determined readers via devtools network inspection (accepted, §14) | | | |

## 17. Explicit non-goals and deferred functionality

**Never-goals (safety/scope, not backlog)**

- No server-side execution of learner SQL; no D1-backed "playground"; no
  `/api/sql` console of any kind.
- No arbitrary database connections, drivers, or user-supplied hosts; no
  network from the worker.
- No real customer, payment, or personal data — ever; no connection to the
  platform's production dataset.
- No AI-generated evaluation, hints, or feedback; no chat tutor.
- No accounts/identity changes; guest/account semantics exactly as Phase 4/5.
- No cross-learner leaderboards, streaks, or timing competitions.
- No Tailwind/shadcn/chart library/icon package; hand-written CSS with tokens.

**Deferred (post-Phase-6 candidates, each needs its own planning turn)**

- OPFS/localStorage persistence of the sandbox (official `@sqlite.org/sqlite-wasm`
  or export/import of `.db` files) — needs COOP/COEP decision.
- Visual ER diagram / schema graph.
- Query plan visualizer beyond `EXPLAIN QUERY PLAN` text.
- Importing the learner's own seed/dataset (schema-bounded UI only).
- Saving and sharing query snippets.
- CodeMirror 6 editor upgrade (if §4.4 evidence justifies).
- Column-level lineage popover in the explorer.
- Additional dialects (PostgreSQL-flavored exercises).
- Performance-track integration (EXPLAIN-based tuning exercises join the
  performance track in a later phase).
- Deployment itself — a separately approved release step, always.

## 18. Documentation deliverables for this planning turn

- This document (`docs/phase-6-database-testing-plan.md`).
- `PROJECT_STATE.md` — 2026-11-17 planning entry: Phase 6 plan written,
  Phase 6 scope = two milestones, implementation NOT started, production
  untouched, exact next step = Phase 6 M1 implementation on maintainer
  instruction; branch/commit recorded.
- No other files changed; no dependencies added; no migrations; no Cloudflare
  interaction; no PR; no push.

---

*Plan approved-in-principle by charter; implementation begins only on explicit
maintainer instruction, starting with Phase 6 M1.*
