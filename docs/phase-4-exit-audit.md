# Phase 4 exit audit — Learning & Bug-Hunt Intelligence

> **Purpose:** the formal record that Phase 4 is implementation-complete and that its
> exit criteria were verified. Companion to `PROJECT_STATE.md` (progress log, §11/§14) and
> `docs/phase-4-learning-intelligence-plan.md` (design + milestone history). Written for the
> maintainer, not for learners. Internal defect details remain in `docs/bug-hunt-catalogue.md`.

- **Branch:** `feat/phase-4-learning-intelligence`
- **Commit audited:** `86076b7` — `feat: add phase 4 learning transparency` (with Phase 4
  work packages `5210ebb` … `0cd7e08`), based on `main` @ `30d3424`
- **Audit date:** 2026-11-16
- **Verdict:** **Phase 4 exit criteria are satisfied. Phase 4 is implementation-complete and release-ready.**
- **Deployment status: NOT DEPLOYED.** Production (https://qa-practice-lab.pages.dev) still runs
  the pre-Phase-4 code and the `schema_version` 9 D1. Nothing was pushed, merged, PR'd or deployed as
  part of this audit. Deployment is a separate, explicitly approved maintainer step (see §8).

## 1. Completed work packages and commits

| Milestone | Work package | Scope | Commit |
|---|---|---|---|
| P4-M1 | WP1 | Scenario curriculum enrichment (`src/shared/huntCurriculum.ts`, learner-safe metadata on the 7 wired hunts, `/practice` recommended path v1) | `5210ebb` |
| P4-M1 | WP2 | Migration `0010_hunt_attempts.sql` (`hunt_attempts` + `bug_reports`, additive; `schema_version` → 10), attempt lifecycle, `POST …/report`, `report:<iphash>` 30/min limit | `968d144` |
| P4-M1 | WP3 | Deterministic §6.4 bug-report evaluator (`src/server/reportQuality.ts`, pure, no AI) — synchronous in the POST report path; `best_quality_score` running max; sticky `discovered`; all-or-nothing D1 batch | `c61cc1f` |
| P4-M2 | WP1 | Progressive-hint ladder (`hint_mask` bitset, server-enforced ordering, idempotent) + gated solution reveal (403 `reveal_locked` until submitted or explicit confirmed give-up; never awards discovery) | `05b5b8e` |
| P4-M2 | WP2 | Structured bug-report UI (labelled fields, blur validation, linked error summary, inline evaluation view, markdown download) on both wired hunt panels | `886f88c` |
| P4-M2 | WP3 | Hint ladder UI, give-up WAI-modal confirm (cancel → zero requests), gated reveal panel, attempt-status chips; WAI-modal primitive | `ef627f4` |
| P4-M3 | WP1 | `GET /api/v1/practice/progress` (owner-scoped aggregate, `persistence: session\|customer`, discovery excluding revealed attempts, no ids) + the real `/progress` | `0cd7e08` |
| P4-M3 | WP2 | Scoring transparency (`/about#evaluation`, canonical `src/shared/evaluationRubric.ts` rubric) + recommended completion path with live completion state | `86076b7` |
| P4-M3 | WP3 | This audit | `docs: add phase 4 exit audit` (this document) |

All nine commits are local to the branch; nothing has been pushed, merged or deployed.
`main` is untouched; production D1 remains `schema_version` 9 (migration 0010 unapplied remotely).

## 2. Database schema and migration status

Migrations `0001` … `0010` (never rewritten once applied). `app_meta.schema_version = 10` locally.

`0010_hunt_attempts.sql` is **additive only**: two new tables (`hunt_attempts`, `bug_reports`),
two indexes + one partial unique index (`idx_hunt_attempts_one_live` on
`(practice_session_id, hunt_id) WHERE status = 'in_progress'`), `app_meta` bump. No existing table
is altered or rewritten; no backfills; no defect ids, hint content, reveal content or evaluator
internals are stored.

**Both migration paths verified** (`tests/server/attempts.test.ts`, re-run during this audit):

- Fresh database — all migrations apply; `schema_version` reads `10`; the new tables, CHECKs and
  the partial unique index behave (second live insert rejected; FK cascades work).
- Upgrade 0001–0009 → 0010 with planted data (practice session, cart, order, attempt state) —
  data survives; `schema_version` reads `10`; `0010` touches only new tables.
- Local developer D1 verified via `wrangler d1 migrations apply --local` and
  `/api/health` → `schemaVersion: "10"`.
- **Production D1 intentionally not touched.** Applying `0010` remotely is part of the release
  step (§8), never part of this audit.

**Retention and lifecycle.** Attempts/reports belong to the practice session and
cascade-delete with it; `customer_id` is stamped at submit time when signed in
(`ON DELETE SET NULL` keeps the attempt snapshot while consenting to customer-row deletion).
`inventory_adjustments` and `order_cancellations` are untouched by Phase 4. The maintenance sweep
(`POST /api/v1/admin/maintenance/sweep`, staff-only, or local `npm run db:cleanup:local`) deletes
expired sessions (cascades attempts/reports), expired customer sessions, day-old hunt-start caps
and stale rate-limit buckets — it never deletes attempt/report rows directly. The sweep's
cascade behaviour is asserted in `tests/server/attempts.test.ts` (`cascades attempts and reports
with their practice session`, also re-run here): after sweeping an expired session, both tables
read zero. The sweep is unchanged from Phase 3 in shape, limit (100 rows/table/call) and idempotency.

**Guest TTL.** Guest progress expires with the practice session (7-day TTL), dies by cascade,
never transfers to a signed-in account, and is never merged/migrated on sign-in — guests keep
session-scoped durability only; the UI states this at every progress surface (`/progress` banner,
`/about` “How long your progress lasts”).

## 3. Capabilities delivered

- **Hunt curriculum** — every wired hunt carries learner-safe curriculum metadata (skill area,
  difficulty, concepts, expected outcomes, investigation focus) served in hunt-summary responses;
  scenario detail renders it; difficulty mirrored; no defect ids or evaluator internals anywhere.
- **Attempts** — one live in-progress attempt per (session, hunt), enforced by a partial unique
  index and idempotent creation (`INSERT … ON CONFLICT DO NOTHING`); hunt starts auto-create the
  live attempt; attempts are owner-scoped by the caller's session; signed-in rows are stamped
  `customer_id` at submit time; guest rows stay session-bound (never retro-adopted).
- **Structured bug reports** — labelled form (title, environment, preconditions, steps, expected,
  actual, severity, priority, reproducibility), required/optional markers, blur inline validation,
  linked error summary with focus management, duplicate-in-flight guard, per-field server 400
  errors, evaluation view with score /100, verdict tag, ten-check checklist, and a downloadable
  markdown report generated from the submitted report and safe feedback only.
- **Deterministic evaluation** — pure rule-based §6.4 evaluator (ten checks, 100 points; bands
  ≥80 `solid` · 50–79 `needs-work` · <50 `incomplete`; no AI, network, clock or randomness; hints
  never lower a score; no submission speed bonuses or cross-learner comparison). Score, feedback,
  `best_quality_score` running max and sticky `discovered` persist inside the same all-or-nothing
  D1 batch as the report insert; client-supplied evaluator fields are ignored.
- **Progressive hints** — exactly three levels per hunt (Orient → Focus → Narrow), server-enforced
  ladder via the attempt's `hint_mask`; skip → `409 hint_level_locked`; re-requests idempotent
  (never double-counted); usage persists on the attempt row (survives refresh/session
  continuation); counter exposed as a live region; locked levels are content-free.
- **Gated reveal** — server-only compiled registry; `GET …/reveal` → `403 reveal_locked` with zero
  content until the attempt is `submitted` or `revealed`; `POST …/reveal` (explicit confirmed
  give-up; `{confirm: true}` required; anything else → 400) atomically stamps `revealed` (first
  `revealed_at` preserved; submitted attempts stay submitted), never awards discovery, preserves
  submissions/best score; idempotent. Reveals never come from hunt-start, hint or report payloads.
- **Progress** — `GET /api/v1/practice/progress`: per-wired-hunt row (status, sticky discovery,
  best score, hints used, attempt count, last submission), recent submissions (score + verdict
  mapped from the persisted score — never re-evaluated), totals (pure status buckets, distinct
  hunts discovered, integer average over scored attempts only), `persistence: session|customer`
  marker; empty payload for no live session; bounded (7 hunts, ≤10 recent); no ids, no internals.
- **Recommended path** — `/practice` ordered list of the seven wired hunts (curriculum registry is
  the source), outcome lines from the curriculum, live completion chips (Not started / In progress
  / Solution viewed / Completed), `Discovered` tag only when credited; completion = a submitted
  report (`lastSubmittedAt !== null`); progress failure never hides the path (retry note).
- **Scoring transparency** — canonical `src/shared/evaluationRubric.ts` (single source of truth;
  server re-exports the checks); `/about#evaluation` explains every check, both bands and
  thresholds, and the report-quality vs discovery distinction explicitly (“a high report score does
  not automatically mean the defect was found”); wired scenario pages link to it.
- **Honesty** — guest progress is labelled temporary/session-bound/non-transferring wherever
  shown; the rubric is described as rule-based, not AI; dashboard demo data remains labelled.

## 4. Security, privacy and data audit

**Ownership and boundaries.** Every Phase 4 endpoint resolves the caller from the `mpl_session`
cookie; attempt ids, defect ids, scores, discovery flags and roles are never accepted from the
client. Attempts/reports/progress are scoped `practice_session_id = ?` (plus, when signed in,
`OR customer_id = ?` for bound attempts — one `OR` on one table, no double counting; verified by
tests: guest rows stay guest; a different customer never sees this learner's rows; customer
deletion nulls `customer_id` but preserves the attempt snapshot). There is no cross-customer or
admin read path in Phase 4; staff role gains nothing here (deliberate).

**Reveal gating is server-side only.** Content is served exclusively by `GET …/reveal` after the
status check and by `POST …/reveal` after explicit confirmation. Pre-unlock responses carry zero
reveal content (verified at three levels: integration tests; raw HTTP probes via curl/fetch —
403 with a content-free envelope; browser — body contains no reveal strings pre-unlock). Error
responses are learner-safe `{ error, message }` envelopes. Hunt ids path-validated against the
registry; unknown → 404; malformed → 400.

**Hint ladder integrity.** Ladder order enforced server-side atomically (guarded single-bit
`UPDATE … WHERE (hint_mask & bit) = 0`); skip → 409; no client-supplied ordering; masks are
session-scoped and never readable cross-session.

**Input validation and storage.** Reports: type checks → control-character rejection (C0/C1/DEL,
multiline keeps `\n`/`\t`) → length caps (title/environment 200, preconditions 1000, steps 4000,
expected/actual 2000, feedback ≤16 384) → enum checks (severity `critical|high|medium|low`;
priority `p1|p2|p3|p4`, never cross-derived; reproducibility `always|sometimes|once`); severity/priority
matched case-insensitively and stored lowercase; defense in depth via migration 0010 CHECKs.
`report:<iphash>` 30/min fixed-window limit consumed **before** body parsing; only a SHA-256 IP
hash is stored. Rate limits are abuse controls, not security boundaries (unchanged posture).

**Body caps and headers.** Global 32 KB request-body cap (`413 payload_too_large`, verified with a
real ~40 KB body); `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` on all API
responses (verified via headers on `/api/health` and `/api/v1/practice/hunts`).

**Logging.** No report text, evaluation payload, hint or reveal content is ever logged
(`grep` over `src/server` shows only server-error logs; reports are written to D1 inside the
all-or-nothing batch only). `onError` returns a generic envelope; no stack traces, SQL, hashes or
tokens in responses (unchanged from Phase 3 and re-verified).

**Client bundle leak scan.** The production bundle (`dist/assets/index-*.js`) contains **zero**
hint or reveal registry strings (19 hint strings and 83 reveal-derived strings checked — the one
overlap, “Equivalence partitioning of valid and invalid inputs”, is shared learner-safe curriculum
text from `src/shared/huntCurriculum.ts`, not hidden content); **zero** defect ids
(`CATALOGUE-001…`, `CART-001`, `INVENTORY-001`, `PRICING-001`, `CHECKOUT-001`, `AUTHZ-001`);
**zero** `hint_mask`/`hunt_attempts`/`quality_score`/evaluator-internals strings apart from the
published rubric ids (`severity-valid`, `priority-valid`, `expected-actual-distinct`, …) which are
intentional — the transparency page shows the check list verbatim; `reveal_locked` /
`hint_level_locked` appear only as required 403/409 error-code→message mappings. Pre-unlock DOM
assertion: `document.body.innerText/textContent` contains no reveal content (probe A2/A4).

**Honesty requirements.** Reveal/banners do not overclaim; guest durability is stated plainly;
evaluation is described as rule-based; discovery is attributed only to the finding check; revealed
attempts never confer discovery (probe B24/B25); hints never award discovery or lower scores.

**Rate limits (Phase 4 adds).** `report:<iphash>` 30/min (fresh scope, hash only, fixed window —
boundary seams may momentarily exceed sustained rate, same documented trade-off as Phase 3). Hints
and reveals fall under the existing 120/min `mutate:<iphash>` backstop; the hunt-start cap is
untouched. No new services, queues, cron, Turnstile or paid products.

**Sign-in/attribution boundary.** Signing in does **not** retro-attribute guest rows; guest rows of
the same session stay session-bound; signing in on a *fresh browser* does not see this browser's
rows (tests); the signed-in browser shows bound attempts from any of its own sessions (same
customer, `OR customer_id = ?`); no cross-customer path exists. Mid-session suspension still forces
403 on account routes (unchanged).

## 5. Tests, build and browser results

- `npm run check` — **passed**: ESLint clean; TypeScript clean in all three projects;
  **720/720 tests green across 36 files** (baseline before this audit; re-run at audit end).
- `npm run build` — **passed**: type-checks then bundles; JS **538.57 kB** (gzip **156.15 kB**),
  CSS **88.20 kB** (gzip **15.91 kB**); no new runtime dependencies; the existing chunk-size
  advisory remains (deferred, unchanged posture — see §7).
- Focused test re-run during this audit — 171/171 across `attempts`, `hints-reveal`, `hardening`,
  `progress`, `report-quality` suites.
- **Migration tests** — both paths pass (fresh; 0001–0009 → 0010); local D1 `schema_version` 10.
- **Bundle leak checks** — as §4; zero leaks.
- **Browser probe** — system Chrome over CDP (native Node WebSocket; no dependency added) against
  the production build served by an ephemeral `wrangler pages dev` on 127.0.0.1:8790 (local D1,
  `schema_version` 10): **133/133 checks pass**. Covered: fresh guest journey from
  `/scenarios/manual-cart-totals` (start → ordered hint unlock → `409` on skip attempt → idempotent
  re-read → refresh persistence of the ladder → empty-submit error summary with focus → complete
  report → evaluation view (score/verdict) → **reveal unlocks in-place via the report path without
  give-up** → resubmission → `/progress` row and recent submissions → recommended-path completion;
  the give-up journey on `/scenarios/manual-shop-search` (dialog opens/cancels with **zero network
  requests on cancel** (asserted by CDP network log), reveal stays locked; confirm → reveal with
  give-up framing; **a report submitted after give-up evaluates normally but earns no discovery —
  `/api/v1/practice/progress` shows `status: "revealed"`, `discovered: false`**); signed-in
  journey (demo account `amara.okafor@example.com`) — banner flips to the signed-in attribution copy;
  seven hunts listed with curriculum; placeholder scenario renders the not-runnable callout; both
  themes × 375/768/1024/1440 px on `/practice`, `/progress`, `/about`,
  `/scenarios/manual-cart-totals` (**zero horizontal overflow, exactly one `h1` each**); **zero
  unexpected console errors/exceptions** (the only network-level resource logs were the deliberate
  403/409 negative-path responses).
- **Caveat (honest):** three probe-predicate mistakes in my own ephemeral probe (CSS-uppercased
  tag text vs `innerText`, `innerText` vs `textContent` for the clipped-but-rendered score, and an
  incorrect expectation about restored-hint disclosure state) were corrected; none were product
  defects. The probe is not committed (no browser runner exists in the repo — consistent with
  prior phases).
- **Not run:** Firefox/WebKit (Chrome only); a human learner (CDP-driven only); an automated
  accessibility scanner (manual semantics/focus/contrast review only); load/capacity testing;
  **production smoke** (deployment deliberately not performed — §8).

## 6. Defects found during this audit

**None in product code.** The three WP-specific defects found during earlier Phase 4 milestones
(notably the report→reveal in-place unlock fixed in P4-M2 WP3, verified here end-to-end as probe
A30) remain fixed. Audit-level findings:

1. **Bundle contains published-rubric check ids** — intentional (the transparency surface renders
  them); documented, not a defect.
2. **One shared curriculum string overlaps the reveal registry** — both are learner-safe rendered
  content; not a defect.
3. **No reveal content, defect ids, or evaluator internals pre-unlock** — none found (§4).
4. **Report-after-give-up keeps `status: revealed` and earns no discovery** — by design and now
  browser-verified (B22–B25); the recommended-path completion chip still counts the submission as
  Completed (documented interpretation of “completion = a submitted report”); discovery is shown
  separately. Recorded in plan P4-M3 WP2 notes and here.

## 7. Known limitations and deferred work

1. **Deployment is not done** — production runs pre-Phase-4 code at `schema_version` 9; 0010 is
   applied to local D1 only.
2. **No browser runner is committed** — probes are ephemeral CDP scripts; acceptance evidence
   lives in `§5` and the milestone log entries.
3. **Rate limits are abuse controls** — fixed windows (seam bursts ≤2×), per-IP not per-account,
   no Turnstile (deliberate); hunt-start cap skipped when no IP is visible (local dev).
4. **Bundle size** — 538 kB JS (no code-splitting); acceptable for this build; deferred.
5. **Guest progress is session-bound** — by design; never transfers; expires with the 7-day TTL;
   local D1 accumulates probe rows until `npm run db:reset:local` (throwaway, local-only).
6. **Aggregate scan is unbounded by contract** (bounded in practice by learner behaviour and the
   7-day cascade).
7. **No telemetry/monitoring** beyond `console.error` and `/api/health`; free-tier visibility is
   log-based only.
8. **Scoring rubric is feedback**, not a hire/fire signal — tunable by maintainers via code review
   (planning decision); discovery requires the finding check only.
9. **Deferred capabilities (plan §12)** — AI-assisted feedback (never a runtime dependency), real
   accounts, cross-device progress, cohorts/leaderboards, expanded defect library, enforced
   learning paths, report-triage simulation, SQL playground, CSV export — all out of Phase 4.
10. **AUTHZ-001 hunt intentionally exposes order references cross-account** — a deliberate practice
    defect; do not “fix” outside the defect branch.
11. **Hono Pages adapter deprecated in Hono v5** — Pages remains a deliberate decision (AGENTS.md);
    revisit before any Hono upgrade.
12. **The maintenance sweep has no scheduler on Pages** — operator-invoked only (unchanged).

## 8. Release readiness

**Verdict: Phase 4 is implementation-complete and release-ready.** Every exit criterion in plan
§13 is satisfied (§9). Deployment remains a **maintainer decision**; this audit authorizes nothing.

**Explicit deployment status: NOT DEPLOYED.** Production still serves the pre-Phase-4 build and
`schema_version` 9. No Cloudflare resources were created or modified; no migrations were run
remotely; nothing was pushed, merged or PR'd.

**Release sequence (plan §7.5, maintainer-only, explicit approval required):**

1. `npm run check && npm run build` (both pass as of this audit).
2. Apply migration 0010 to the production D1 via the established remote-migration procedure
   (`wrangler d1 migrations apply qa-practice-lab-db --remote`) — additive-only; no data backfill.
3. `npx wrangler pages deploy dist`.

**Deployment verification (after an approved deploy):** `/api/health` reports `schemaVersion: "10"`;
smoke the full journey against production (start hunt → hint ladder → report → evaluation renders →
reveal gated → `/progress` renders); confirm both themes and reduced motion on the new surfaces;
confirm no defect ids in pre-unlock responses (§4 scan re-run against the deployed bundle).

**Rollback considerations.** Pages deploys are additive and reversible by redeploying the previous
known-good `dist/` (previous commit), which needs **no data migration**. Migration 0010 is
additive-only (two new tables, two indexes + one partial unique index, `app_meta` bump) — rolling
the code back does not strand or corrupt data; the new tables sit unused. No destructive schema
change exists in Phase 4; rolling back code leaves Phase 3 surfaces untouched; if a data-level
rollback were ever required, only rows in the two new tables would be affected, and dropping them
would not impact Phase 3. The deployment decision, its execution and its verification are
maintainer actions recorded after this audit, never as part of it.

## 9. Phase exit criteria (plan §13)

| # | Criterion | Verdict |
|---|---|---|
| 1 | P4-M1/M2/M3 each with `npm run check` green and milestone acceptance met | **PASS** (each WP green on the branch; merge/PR is the maintainer's release step, not an audit action) |
| 2 | Zero-context learner completes the full journey from `/scenarios/manual-cart-totals` | **PASS** (probe A1–A35: fresh guest, no docs, no maintainer) |
| 3 | No reveal content served or rendered before unlock | **PASS** (tests + raw probes + browser: 403 pre-unlock, zero requests on cancel) |
| 4 | Guest journey honestly labelled; signed-in bound attempts; no cross-session leaks | **PASS** (probe C4; isolation/attribution/deletion tests; durability copy in UI) |
| 5 | Migration 0010 both paths; `schema_version = 10`; sweep unchanged, attempts die by cascade | **PASS** (attempts + hardening suites; local D1 verified; production untouched) |
| 6 | This audit document records schema, capabilities, security/privacy, retention, tests/build/browser, limitations, deployment status, §7.5 verification + rollback, verdict | **PASS** |
| 7 | `npm run check` green; production build passes; both themes × 4 widths; zero defect ids pre-unlock | **PASS** (§5) |
| 8 | README and PROJECT_STATE updated truthfully | **PASS** (this commit; no “scoring” claims beyond shipped: rubric is published transparency, discovery is finding-check-only, completion = submitted report) |
| 9 | Release pattern confirmed before any deployment; §7.5 steps documented; no deployment without explicit approval | **PASS** (§8; nothing deployed) |

**No criterion failed; nothing was waived silently.** Production remains untouched at
`schema_version` 9; production smoke belongs to the approved deployment, not to this audit.

**Exact next action required for release:** the maintainer decides whether to release. If yes:
`npm run check && npm run build`, apply `0010` to the production D1 remotely, `npx wrangler pages
deploy dist`, then run the §8 post-deploy verification and record it in `PROJECT_STATE.md`. If no:
the branch remains the deliverable; do not push/merge without explicit instruction.
