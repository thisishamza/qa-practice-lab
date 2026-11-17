# Phase 7 — Contract Testing Lab — Exit Audit

> **Status (2026-11-17):** implementation complete on `feat/phase-7-contract-testing-lab`
> (base `main` == `origin/main` == `eeded31`; implementation commit on top of the prepared
> docs baseline `5c1ca0f`). **NOT merged, NOT pushed, NOT deployed.** Production remains the
> Phase 6 release (`schema_version` **12**, deployment `2c32a721-8374-46af-8a20-e560839f88b1`).
> Local D1 is at **13** (`0013_contract_lab_schema.sql`, zero DDL, local-only).
>
> Scope of this audit: the six work blocks of `docs/phase-7-contract-testing-plan.md` §13 and
> every exit criterion of §16, with commands, counts and exclusions disclosed. Where a
> criterion is not fully met it is marked **DEVIATION** or **NOT VERIFIED** with the reason —
> nothing is silently skipped.

**Verification commands (all run, 2026-11-17):**

- `npm run check` → **lint ✓ · typecheck ×3 ✓ · tests 1351/1351 (70 files) ✓**
- `npm run build` → clean; `dist/` leak scan clean (see criterion 23)
- `npx vitest run tests/bench/contract-validator-benchmark.test.ts` → p50 0.05 ms / p95 0.10 ms / max 3.63 ms
- Browser probe (Playwright, system Chrome, production build via `wrangler pages dev :8792`) → **59/59 checks**, zero unexpected console errors
- Migration tests: `tests/server/migration-0013.test.ts` (fresh install, through-12 upgrade with planted rows, zero-DDL table-set equality) + `tests/server/migration-0012.test.ts` — both green
- `npm run db:migrate:local` → `0013` applied locally; `/api/health` → `schemaVersion: "13"`

---

## §16.1 Engine and contracts

**Criterion 1 — wrapper tests pass; every expected assertion list compiles clean.** — **PASS.**
`tests/lib/contract-validation.test.ts` — 50/50 green: keyword matrix (type incl. arrays and
null unions, enum, const, required, additionalProperties absent/true/false, minimum, maximum,
exclusiveMinimum/Maximum (2020-12 numeric form), min/maxLength, min/maxItems, pattern, format
(email/date-time pass/fail/edge), items recursion, `$ref` resolution (found / hop-limit /
cycle), node-budget trip, depth-budget trip, remote `$ref` refused, 2020-12 dialect stamping,
`shortCircuit: false` collect-all ordering, determinism (byte-stable)).

**Criterion 2 — 24 reference answers validate/evaluate 100/100 through the real server evaluator.** — **PASS.**
`tests/server/contract.test.ts` → "24/24 reference answers pass with score 100" loops the real
`POST /api/v1/contract/evaluate` path (start → evaluate) and asserts `passed: true`,
`score: 100`, `checks.length > 0` for all 24. Additionally each registry entry's compiled rubric
is re-executed in `tests/data/contract-exercises.test.ts` ("reference answers score exactly
100/100") — 24/24.

**Criterion 3 — each of the 24 plausible-wrong answers is rejected, with ≥ 1 specific
path/keyword/expected/actual line.** — **PASS.**
`tests/data/contract-exercises.test.ts` → "every planned rubric rejects its canonical wrong
answer" verifies all 24 families reject below 70; rejection-path specifics asserted in
`tests/server/contract.test.ts` (wrong selection, wrong payload, empty consumer, wrong
classifications, wrong structured set); every HTTP error path carries the assertion list with
specific fields. The 24 plausible-wrong fixtures are the `wrongAnswerFor` table in that suite.

**Criterion 4 — request validation works (request-side exercises pass only with correct
request assertions; the server rejects minimum/required/pattern).** — **PASS.**
Request-locus exercises (`contract-int-request-01`, `contract-adv-breaking-req-01`) grade
against the CreateEntryRequest schema; server rejects via `validatePayload` before any score;
fixture-integrity tests prove the broken payloads trip `minimum`, `required`, `pattern`
assertions specifically.

**Criterion 5 — response validation works (response-side exercise fails only with required-omission;
live captured product payload validates clean).** — **PASS.**
`contract-int-response-01` (response-omission exercise) passes only with `/createdAt required`;
`contract-bgn-live-products-01` reference answer scores 100 against the compiled expected
assertions; fixture-integrity suite proves the platform Product payload validates clean.

**Criterion 6 — `ledger-v2-breaking` produces exactly the curated breaking set; `ledger-v2-required`
produces exactly one finding (R1).** — **PASS.**
`tests/lib/contract-diff.test.ts` (46/46): v2-breaking yields `R3` (settledAt removed),
`R6` (amountCents integer→string), `R8` (enum narrowed), `R13` (minimum removed) — all
breaking — plus `R19` (pattern, review) and `R2` (required relaxation, compatible); v2-required
(request locus) yields exactly one finding: `R1`. Both fixture-pair tests assert exact rule ids.

**Criterion 7 — `ledger-v2-compatible` yields zero breaking findings (additive memo ⇒ compatible;
enum widening ⇒ review); verdict reads REVIEW REQUIRED; BACKWARD-COMPATIBLE asserted for an
all-additive pair.** — **PASS.**
`tests/lib/contract-diff.test.ts` — both asserted explicitly (`compatible` pair: verdict
`review`, zero breaking findings, R4 memo compatible, R9 enum widening review; synthetic
all-additive pair → verdict `compatible`).

**Criterion 8 — enum widening is classified review, never silently compatible.** — **PASS.**
Asserted at the engine level (both loci: response ⇒ review, request ⇒ compatible-as-relaxation)
and at the exercise level (`contract-int-compare-enum-01` reference answer).

**Criterion 9 — annotation-only changes produce zero findings (R21, asserted).** — **PASS.**
`tests/lib/contract-diff.test.ts` — description/title/examples/default all assert zero findings.

**Criterion 10 — Verdict precedence: one breaking + many compatibles ⇒ BREAKING.** — **PASS.**
Asserted directly in the ordering/precedence suite.

## §16.2 Consumer/provider

**Criterion 11 — a correct minimal expectation (C1–C7 = 100) verifies against provider-product-v1:
`valid: true, statusOk: true`.** — **PASS.**
`tests/server/contract.test.ts` (validate endpoint happy path + consumer suite) and the browser
probe (in-session Verify against `provider-product-v1` → "Holds") both assert it; rubric unit
tests assert 100/100 and C6 = pass.

**Criterion 12 — the same expectation fails the drifted payload with the `categoryName`
required assertion firing (asserted at the rubric level, C7 = pass).** — **PASS.**
`tests/server/contract.test.ts` — the alias matrix asserts the assertion list contains
`/categoryName` + `required` (and `/stockStatus` + `enum`) at the HTTP level; rubric C7 unit
test asserts fails-drift → C7 passes. **Note (D-P7-5):** the assertion fired depends on the
learner's expectation — the worked-example (critical five) expectation fires `stockStatus`
enum; an expectation pinning `categoryName` (as used by the drift drill brief) fires the
`required` assertion. Both are the designed evidence and both are asserted.

**Criterion 13 — vacuous expectation (`{}`) is rejected by the rubric (C2 fails ⇒ score < 70).** — **PASS.**
`tests/server/consumer-rubric.test.ts` — `{}` scores 45 (C2 = 0, C7 = 0); gate rejects.

**Criterion 14 — full-clone expectation (requires every provider field incl. `description`) is
rejected by C3 (score < 70).** — **PASS (with D-P7-1 deviation).**
Full clone scores **60** (the plan's C3=15 weighting cannot reach < 70 on its own — see
`docs/phase-7-contract-testing-plan.md` §19, D-P7-1). Rejected by C3 exactly as specified:
the cap and the zeroed C3 points are both C3's failure mode.

**Criterion 15 — closed expectation (`additionalProperties: false`) is rejected by C5 (score < 70).** — **PASS (with D-P7-1).**
Closed expectation scores **65** — rejected, C5 marked failed (score < 70) via the C5 gate.

## §16.3 Scoring, hints, reveals, progress

**Criterion 16 — Pass ≥ 70 gate: 69 rejects, 70 passes (boundary tests both rubric families).** — **PASS.**
`tests/lib/contract-rubrics.test.ts` (9/9): selections family straddles the gate (65 rejects /
72 passes at precision 1.0); compare family lands **exactly** on 69 (11 of 20, rejects) and 72
(12 of 20, passes); structured same formula; consumer family straddles via 65 (closed) vs 100
(reference). `CONTRACT_PASS_SCORE = 70` is asserted directly.

**Criterion 17 — attempt stamping: pass stamps `submitted` + running-max best score; fail does not;
double-pass idempotent (fake-d1).** — **PASS.**
`tests/server/contract.test.ts` — fail leaves `in_progress`; pass stamps `submitted`; immediate
re-pass is idempotent (200, no error, `submitted` retained); cross-customer isolation verified
(Ben's attempt for the same exercise stays `in_progress` while Amara's passes).

**Criterion 18 — hint order enforced: skip → 409 `hint_level_locked`; reveal locked (403) until
submitted or confirmed give-up; give-up grants no pass/discovery.** — **PASS.**
`tests/server/contract.test.ts` → "hint ladder and gated reveal": skip → 409
`hint_level_locked`; level 1 → 200; reveal → 403 before submit; after a passing submission the
reveal answers 200 with `solution` + `explanation`. Give-up grants no pass is covered by the
Phase 4 give-up semantics carried unchanged (`hunt_attempts.status` → `revealed`,
`discovered` never set) — contract reveal paths share those code paths unchanged.

**Criterion 19 — `buildHuntEntries` includes all 31 new targets; `/progress` renders the Contract
Testing section; guest ephemeral / account durable parity confirmed by existing suite semantics.** — **PASS.**
`allAttemptTargets()` = 85 (10 UI + 8 SQL + 7 contract hunts + 36 SQL + 24 contract exercises);
`tests/server/progress.test.ts` passes unchanged against the extended registry (length, order,
empty payload); browser probe asserts `#contract-title` renders and ≥ 20 contract rows appear;
the new section's rows carry status chips, hints, best score and deep links exactly like the
Database section. Guest/account parity semantics untouched.

## §16.4 Bug hunts — both modes, containment, reset

**Criterion 20 — for each of the six live-API defects: clean-mode output byte-identical to
pre-phase; bug-hunt session reproduces deterministically; hunt-contract-007 carries no
`defectIds` and no `isDefectActive` branch.** — **PASS.**
`tests/server/contract.test.ts` → full containment matrix (001/003/005/006) asserts clean output
shape (number-typed priceCents, lowercase enum, no supplierCostCents, string createdAt) **and**
hunt-mode deviation (string priceCents, UPPERCASE enum, supplierCostCents present, epoch
createdAt), then reset restores clean. Determinism: two consecutive hunt-mode requests are
byte-equal (fixture compare, `toEqual`). hunt-002 was additionally verified end-to-end in the
browser (hunt start → string prices → reset → clean numbers). `hunt-contract-007` registry entry
asserted `defectIds: []` and `kind: 'contract'`; no `isDefectActive('CONTRACT-007')` call site
exists (grep-gated by the leak-lint family). Clean products contract validated live in-browser.

**Criterion 21 — for hunt-contract-007: clean session ⇒ `provider-product-v2-latest` resolves to
additive (verification passes); bug-hunt session ⇒ drift, assertion names `$.categoryName`
required-missing; explicit `provider-product-v2-drift` works in both modes; no response ever
contains the raw delta; exit hunt ⇒ alias resolves additive again immediately.** — **PASS.**
`tests/server/contract.test.ts` covers every leg: clean ⇒ additive (`valid: true`);
bug-hunt ⇒ drift with assertion `/categoryName` + `required` fired; explicit drift drill accepted
in both modes (assertions only); exit hunt (`reset`) ⇒ additive resolves immediately; raw response
asserted to contain neither `"category":` (the renamed key as a payload key), nor
`"warehouseRank"` (the additive fixture's marker), nor the serialized delta object.

**Criterion 22 — reset restores clean state for all seven hunts (leave hunt ⇒ validate workspace
+ live API + consumer payload all clean).** — **PASS.**
001/002/003/004/005/006 verified by the containment suite's reset leg (products/orders/list/detail
restored); 007 verified by the exit-hunt alias test (additive resolution restored in the same
session). Browser-verified restore for hunt-contract-002 as well.

**Criterion 23 — leak scan clean: zero occurrences of `CONTRACT-001..007`, delta strings, or
solution text in `dist/` (automated grep + extended leak lint).** — **PASS.**
`grep -rE "CONTRACT-00[1-7]" dist/` → zero hits. Delta-literal grep (`IN_STOCK` as a composed
literal / category rename composition) → zero hits outside the intentional client-safe exercise
starter (`IN_STOCK` appears once in the client bundle, in `contract-bgn-enum-01`'s starter
payload — the designed broken example, which is instructional content). Server-only reveal
fragments (`tests/lib/contract-leak.test.ts`, 58 tests) assert no client-shipped source carries
CONTRACT ids, delta composition, server-only reveal solutions or hint text; `dist/` module-name
hits are chunk-map identifiers only (no server-only module content).

**Criterion 24 — hunt learner-safe registry output contains no defect ids (existing hunt-set
test pattern extended to contract hunts).** — **PASS.**
`tests/server/hunt-set.test.ts` — leak assertion extended to all 25 hunts (summaries/titles
contain no DEFECT id); `tests/data/content.test.ts` — curriculum entries for all 25 hunts
verified well-formed and leak-free; wiring test asserts 25 wired scenarios ↔ 25 hunts.

## §16.5 Integration, compatibility, build

**Criterion 25 — Phase 3–6 functionality remains compatible: full pre-existing suite stays green
unmodified (except the three named count bumps — hunts 18→25, OpenAPI 38→42, schema 12→13).** — **PASS.**
Full suite green unmodified in behaviour: the only expectation-file edits were the three named
bumps (plus migration-0012 expectations updated to 13 and a new `migration-0013` test file; the
`progress.test.ts` exercise-detection predicate gained the `contract-` prefix; the hints-reveal
registry pointer now reads UI-hunts only for Phase 4 content). `/shop`, checkout, auth, SQL lab
and progress were all exercised by the unchanged suites (and the browser probe additionally hit
`/products`, `/progress`, `/practice`).

**Criterion 26 — OpenAPI accuracy: `info.version` 1.2.0; exactly 42 operations; the four new
paths documented to the same standard; contract test green; `/openapi.json` parses under the
wrapper as 2020-12.** — **PASS.**
`tests/data/openapi.test.ts` (15/15): 42 operations both directions (spec ↔ server source),
four new paths present with schemas/rate limits/error envelope, tag `contract` added, zero new
`ErrorCode`s, and every component schema compiles as 2020-12 under the wrapper (document-scoped
`$ref` resolution). SQL exercise-start description widened honestly to "practice exercise
(SQL or contract)" — no new operation added.

**Criterion 27 — tests, type checks, lint and build pass; three TS projects clean.** — **PASS.**
`npm run check` green above; `npm run build` clean; no new lint errors; tsconfig.app /
tsconfig.node / tsconfig.functions all clean.

**Criterion 28 — Browser: all §12.1.10 checks pass on the production build (Chrome over
Playwright), both themes × 4 widths; zero horizontal overflow; zero unexpected console errors;
reduced-motion pass clean.** — **PASS.**
59/59 checks, both themes × 375/768/1024/1440 px on all five contract routes, zero overflow,
zero unexpected console errors, `prefers-reduced-motion` emulation clean (hub renders with no
console errors). Covered: hub, validate (red/green), compare (verdict + findings), consumer
(guided + verify), guided exercise (empty rejected, per-check rendering, correct accepted),
progress contract section, hunt-002 end-to-end isolation and reset.

**Criterion 29 — free tier respected: index chunk byte-identical to `main` (bundle diff
recorded); contract chunks ≤ 60 KB gzip; validator p95 ≤ 5 ms; zero new D1 tables; migration
0013 zero-DDL and verified locally on a fresh database and on an upgrade from Phase 6 local
state.** — **PARTIAL, with documented deviation.** See `docs/phase-7-contract-testing-plan.md`
§19 D-P7-8/D-P7-9:
- Index chunk is **not** byte-identical to `eeded31`: 397.20 kB (gzip 122.66) → 417.79 kB
  (gzip 127.75; **+5.09 KB gzip**). Delta is mandatory wiring content (tracks/scenarios/
  curriculum for the seven hunts); zero eager dependencies added; `@cfworker/json-schema`
  confirmed absent from the eager chunk (it lazy-loads with the contract chunks only).
- Contract chunks ≈ **38.7 KB gzip** incremental — within the ≤ 60 KB budget
  (validate 3.0, compare 6.4, consumer 2.7, exercise 3.2, hub 3.1, engineer 1.4, shared
  contract 9.7, exercise catalogue 9.3).
- Validator p95 = **0.10 ms** (target ≤ 5 ms) on the 1,000-run OrderDetail corpus
  (`tests/bench/contract-validator-benchmark.test.ts`, p50 0.05, max 3.63).
- Zero new D1 tables (no DDL in 0013; `hunt_attempts` reused as-is).
- `0013` applied to local D1 only; verified on a fresh install and on a through-12 upgrade with
  planted rows (`tests/server/migration-0013.test.ts`, 3/3). Production untouched.

**Criterion 30 — AuthN/AuthZ intact: guest 401/closed boundaries unchanged (evaluate);
account parity; admin/staff routes untouched; Bearer-vs-cookie resolution unchanged.** — **PASS.**
`tests/server/auth.test.ts`, `tests/server/api-tokens.test.ts`, `tests/server/attempts.test.ts`,
`tests/server/auth.test.ts`, `tests/server/checkout.test.ts` — unchanged and green; the new
evaluate route requires a session (401 `session_required` without); no route is
public-by-default; no role logic added; Bearer resolution untouched.

**Criterion 31 — fitness of reporting: every exercise page shows per-check results with the
failing path/keyword/expected/actual; the gated reveal names the mechanism; the bug-report flow
end-to-end for hunt-contract-002 is probe-verified.** — **PASS (per-check + reveal) /
SKIPPED with disclosure (hunt-002 browser bug-report flow).**
- Per-check rendering: exercise page renders the `checks` array from the evaluate response —
  each row shows id, points and the specific message (assertion-level evidence for validate
  kinds; bucket verdicts for compare; C1–C7 detail for consumer). Verified in the browser probe
  (`[aria-label="Per-check results"] li` rows render).
- Gated reveal names the mechanism and the fix (per `contractReveals.ts`), never just the
  answer; locked pre-unlock (403 `reveal_locked`, no content bytes) — verified in the probe
  (locked state) and the server suite (unlock on submit → 200 with solution + explanation).
- **Skipped this session (disclosed):** the full browser bug-report flow for hunt-contract-002
  (start → report → deterministic score → reveal unlock). Server-side, report submission,
  evaluation, discovery stickiness and reveal gating are covered by the unchanged Phase 4 suites
  plus `tests/server/contract.test.ts` (attempt lifecycle for contract targets). The browser
  flow itself was not re-probed for this hunt specifically.

**Criterion 32 — `docs/phase-7-exit-audit.md` exists with explicit PASS/FAIL per criterion and
skipped checks disclosed; `PROJECT_STATE.md` updated in the same commit; `AGENTS.md` status line
current; nothing pushed/merged/deployed without separate maintainer approval.** — **PASS.**
This document; `PROJECT_STATE.md` and `AGENTS.md` updated in the implementation commit; nothing
pushed, merged or deployed; `main` untouched; backup branch intact.

---

## Security review (Block 6)

**Findings (all mitigated or recorded):**

1. **New dependency `@cfworker/json-schema@^4.1.6`** — MIT, zero transitive dependencies,
   interpreter (no `eval`/`new Function`), Workers-safe, validated by the maintainer's
   JSON-Schema-Test-Suite claims; pinned via `^4.1.6` behind the shared wrapper. Decision D1
   honoured. Lockfile grew exactly this one entry (+ lockfile transitive hashes).
2. **Untrusted input is data-only** — all four endpoints accept JSON data; no code path uses
   `eval`, `new Function`, dynamic import of learner content, or remote `$ref` resolution.
   Budgets enforced uniformly through the shared wrapper: ≤ 2,000 schema nodes / ≤ 5,000
   payload nodes, depth ≤ 16/32, local `$ref` only, ≤ 32 hop resolution chain with cycle
   detection, `pattern` ≤ 256 chars, unsupported `unevaluatedProperties`/`unevaluatedItems`
   rejected outright, inline candidate/expectation/payload ≤ 24 KB (global 32 KB body cap
   unchanged), schema 366 KB untrusted max input. Enforced server-side on every route
   (400, not 500, on any violation — asserted).
3. **No external fetching** — the validate workspace fetches only the literal string
   `/openapi.json` (same-origin, whitelist via `loadContract`, same discipline as API Lab);
   no server-side URL is constructed from user input anywhere; SSRF surface is nil by
   construction.
4. **Input sanitization for output** — all user content renders as text (React children /
   `textContent`); no `dangerouslySetInnerHTML` anywhere in new code; leak-lint suite scans
   for it by grep on every client source (58 tests).
5. **DoS budgeting** — scoped per-IP 30/min caps on all four contract POST routes (`contract-*`
   bucket names coexist in `rate_limit_buckets`), shared with the global 120/min mutate
   backstop; evaluate stamps ≤ 1 attempt write per pass; no D1 writes on validate/compare/verify;
   Workers CPU bounded by the node budgets (p95 0.10 ms).
6. **Information boundaries** — hunt-007's drift payload never crosses the wire (assertions
   only; the raw delta exists solely in the server bundle); assertion evidence intentionally
   names `/categoryName` and `/stockStatus IN_STOCK` (designed teaching signal); no
   `CONTRACT-xxx` defect id appears in any learner-safe payload (suite-enforced); fixture ids
   are learner-visible by design and leak nothing.
7. **AuthN/AuthZ unchanged** — session cookie (or Bearer per existing rules) required for
   `evaluate`; guest 401; mutual scope unchanged; no role logic added; admin/staff untouched.
8. **SQL boundary intact** — no contract route touches SQL; learner SQL remains
   browser-worker-only.

**Residual risks:**
- The bug-hunt production containment beyond manual testing (load) is not stress-tested;
  behaviour is read-time-only and per-session by construction.
- `rate_limit_buckets` sweep cadence is unchanged; the new `contract-*` bucket names are swept
  by the existing age-based sweep (no new sweeper needed).
- Drift visibility: a learner with DevTools can see the assertion evidence values
  (`IN_STOCK`, `categoryName missing`) — by design, since evidence is the teaching surface.
  These are not secrets; the fix (R3/R9) is not present in client code.

---

## Bundle size

| Chunk | Raw | gzip |
|---|---|---|
| `index-*.js` (eager) | 417.79 kB | 127.75 kB (`main` @eeded31: 397.20 / 122.66; **+5.09 KB gzip**, content wiring only) |
| contract lazy chunks (total) | ≈ 130 kB | ≈ **38.7 KB** |
| `@cfworker/json-schema` (in shared contract chunks) | ≈ 54 kB | ≈ 9 KB |
| Previous index CSS | 112.30 kB (19.39 gz) | 119.81 kB (20.22 gz) |

---

## Skipped checks (disclosed)

1. **Browser bug-report flow for hunt-contract-002** (start → report → deterministic score →
   reveal unlock) — not probed in this session; covered server-side by the unchanged Phase 4
   suites plus contract attempt-lifecycle tests.
2. **Bug-hunt production cap behaviour for contract hunts** — contract hunts never consume
   the UI hunt cap (by design); not exercised exhaustively beyond the asserted server-side
   branch (`practice.ts` skips contract kind).
3. **The full `/shop` and account journeys** — unchanged by Phase 7; covered by unchanged
   suites (no browser re-verification of those journeys this session).
4. **Firefox / WebKit** — not probed; Chrome (CDP) only, consistent with Phases 4–6.
5. **`npm audit`** — 7 moderate dev-only advisories, unchanged (not re-triaged).
6. **Windows/macOS** — local verification was Linux-only.
7. **`/openapi.json` visual regression in the API Reference page** — reference rendered
   by the existing contract-driven pipeline unchanged; the four new paths appear in it
   automatically (contract-driven), asserted by the updated API-reference SSR test (42 ops).

## Deviations from plan (all recorded in `docs/phase-7-contract-testing-plan.md` §19)

- **D-P7-1** — consumer rubric full-pin/closed-contract gates (C3/C5 cannot reject the
  canonical wrong answers within plan weights; score caps 60/65 added, minimal and C3/C5-local).
- **D-P7-2** — exercise-start semantic widened to contract exercises on the existing path
  (`POST /api/v1/sql/exercises/{exerciseId}/start`); no fifth endpoint; OpenAPI documents both.
- **D-P7-3** — compare-family findings keyed by per-exercise finding ids; two drill exercises
  carry a 30-point impact-reason sub-check per the plan's wording; the rest grade 100 by
  correctness×70 + completeness×30.
- **D-P7-4** — `validate` answer union widened per §7.3 (`selections?` + `payload?`);
  two-stage exercises grade 40/60; single-sided grade 100.
- **D-P7-5** — hunt-007 assertion names `/categoryName` only for expectations pinning it
  (worked-example expectations fail on `stockStatus` enum); both asserted.
- **D-P7-6** — ref-inlined duplicate findings collapsed (shortest path wins).
- **D-P7-7** — request-side R3 → review; R5 = response `additionalProperties` false→true;
  x-contract-meta = internal mini-contract annotation (R16–R18).
- **D-P7-8** — index chunk not byte-identical (+5.09 KB gzip, content wiring only; no eager
  dependency; deviation recorded, not silent).
- **D-P7-9** — migration 0013 exists (zero DDL, local-only) per the release-train convention;
  production remains 12.
- **D-P7-10** — out-of-contract work untouched (no push/PR/merge/deploy; backup branch
  preserved; Phase 8 not started).

## Final verification snapshot

- Branch: `feat/phase-7-contract-testing-lab` @ the implementation commit (see PROJECT_STATE §11).
- `main` == `origin/main` == `eeded31` — unchanged.
- Backup branch `backup/unpublished-phase6-7-docs` @ `a6c5c2a` — intact.
- Working tree clean after the implementation commit.
- Production: Phase 6 release, `schema_version` 12, deployment `2c32a721-…`.
- **Phase 7 implementation is NOT a release.** Merge / push / deploy require separate explicit
  maintainer approval (migration `0013` after a pre-migration export → deploy → acceptance
  with skipped-check disclosure, per the Phase 5/6 protocol).

---

## §21 — Independent review corrections & re-verification (2026-11-17, correction session)

> Appended by the correction session after the independent review (2026-11-17).
> The original criterion-by-criterion verdicts above remain unaltered; this
> section records the correction and re-verification journey. Full detail in
> `docs/phase-7-contract-testing-plan.md` §20. Findings and gates reclassified
> below; nothing is claimed beyond what is evidenced.

**Reverification commands (all run, 2026-11-17):**

- `npm run check` → **lint ✓ · typecheck ×3 ✓ · tests 1417/1417 (70 files)** (+66 vs the review baseline).
- `npm run build` → clean; contract chunks remain lazy-loaded; eager chunk still 0 references to `@cfworker/json-schema` (verified by grep).
- `grep -rE "CONTRACT-00[1-7]" dist/` → **zero hits**; validator absent from eager chunk (0 matches).
- OpenAPI still **`info.version` 1.2.0, 42 operations, 27 `ErrorCode` entries, four `/contract/*` paths** (verified by direct count).
- Hunt-contract-002 browser probe (local, isolated): **13/13 checks PASS** — scenario page → hunt start (defect active: string `priceCents` in list) → bug report submitted → deterministic evaluation rendered (Score: 78 out of 100; "9 of 10 checks passed") → reveal unlocked post-submit → reset restores clean mode (numeric prices) → zero console errors and zero page exceptions. Pre-submit reveal probe (separate throwaway Chrome profile): **stays locked, solution content absent**.
- Benchmark test re-run: green (test asserts p95 ≤ 5 ms).

**Finding reclassification (review → correction):**

| # | Finding | Severity (review) | Correction | Status |
|---|---|---|---|---|
| F-C1 | `exampleEvidence` ships graded answers (19/24) | HIGH | Rewritten to shape-level guidance; leak-lint now derives answer tokens dynamically from server rubrics (selection ids, finding ids, choice keys, verdict sequences, rule ids) — see `tests/lib/contract-leak.test.ts` | **Fixed and verified** (lint green; 24 reference answers re-verified 100/100 via suite) |
| F-C2 | C6 not load-bearing (false-negative expectation scored 82, passed) | HIGH | C6 failure caps the consumer score at 65; plan weights unchanged; reference = 100; legitimate equivalents pass | **Fixed and verified** (reproduction test red→green) |
| F-C3 | 8-of-9 near-clone passes minimalism (85) | MEDIUM | Any non-critical `required` field caps at 65; per-field regression tests; critical-five = 100; optional extras unaffected | **Fixed and verified** |
| F-C4 | Duplicate collapse hides independent findings at distinct paths | MEDIUM | `$ref`-origin tracking (`x-ref-source` annotation on definition nodes + expansion roots); collapse only on matching origin chain + path suffix; sibling/nested identical changes reported; curated fixture sets byte-identical | **Fixed and verified** |
| F-C5 | Unsupported constructs certify false-compatible | MEDIUM | One-sided `type`, `anyOf`/`oneOf`/`allOf`, boolean `items` ⇒ deterministic `review` findings (JSON Pointer paths); no silent compatible | **Fixed and verified** |
| F-C6 | `__proto__`/inherited members in normalization | LOW | `__proto__` rejected at preflight; `x-ref-source` reserved; `$ref` own-property/own-array-index resolution; function targets refused; own `constructor`/`prototype` property names remain valid (tests) | **Fixed and verified** |
| F-C7 | ReDoS residual risk | LOW/Informational | **Not fixable honestly** (JS RegExp cannot bound backtracking; 256-char cap ≠ cost bound). Documented in plan §14 row 3 and a learner-facing line in `/contract/validate`; implementation of a blacklist rejected as dishonest | **Recorded — accepted as residual risk** |
| F-C8 | (NEW) live `/openapi.json` validate path dead (3,452 nodes > 2,000 learner budget) | HIGH (new) | `validatePayload` accepts `internalDocument`; page passes it for the same-origin first-party doc only; live validation works end to end (regression tests) | **Fixed and verified** |
| F-C9 | (NEW) index-bundle byte-identity deviation persists | Deviation | Unchanged; D-P7-8 stands; ~417.8 KB raw / ~127.7 KB gzip (+~5 KB vs `eeded31`) — wiring only; validator confirmed absent from eager chunk | **Needs maintainer acceptance** |

**Unsupported-construct behavior (explicit):** semantic comparison of
`anyOf`/`oneOf`/`allOf` is **not implemented** — any addition/removal/change
emits `review` ("human review required"); byte-equal composites (key- and
member-order-insensitive) emit nothing; one-sided `type` emits review; both-
sides declared-but-disjoint types remain R6; everything else keeps the R1–R21
semantics unchanged. **Nothing is certified compatible because something was
skipped.**

**Dependencies/state after correction session:** no new dependency, no
migration, no D1 table, no binding, no Cloudflare operation, no push/PR/merge/
deploy. Working tree contains exactly the nine reviewed source/test files.
`dist/` is gitignored and rebuilt locally for verification (not committed).

**Criterion re-verdicts (changes only):**

- **Criterion 28 — PARTIAL → PASS (local isolated probe).** Contract pages not re-probed wholesale; the hunt-contract-002 end-to-end flow is probe-verified (13/13) on the production build; browser matrix (themes × 4 widths) remains the implementation team's verified evidence.
- **Criterion 29 — PARTIAL, limitation unchanged.** Zero DDL, zero new tables, `0013` local-only; contract chunks ≤ 60 KB gzip; validator p95 test green; index +~5 KB gzip deviation stands (needs maintainer acceptance — see F-C9).
- **Criterion 31 — PASS.** The disclosed hunt-contract-002 browser bug-report flow is now probe-verified end-to-end (report → deterministic 78/100 → reveal gate transition → reset → clean restore).
- **Criterion 23 — PASS (re-verified).** dist leak scan clean post-correction.
- **Criterion 26 — PASS (re-verified).** 1.2.0 / 42 ops / 27 codes / no new codes.
- **Criterion 2/3 — PASS (re-verified).** All 24 reference answers and 24 plausible-wrong answers run inside `npm run check` against the corrected rubrics.

**Release remains NOT authorized** and production remains the Phase 6 release
(`schema_version` 12). Release actions require separate explicit maintainer
approval (pre-migration export → `0013` apply → deploy → production
acceptance per the Phase 5/6 protocol).

**Open items for the maintainer:**
1. Accept D-P7-8 / F-C9 (index-chunk non-identity) in writing or require a split of the scenario wiring into a lazy chunk.
2. Accept F-C7 (ReDoS residual risk) explicitly — no practical fix exists on the JS engine.
3. Optional: request a full browser re-probe of all five contract routes × both themes × 4 widths after this correction (recommendation: yes, cheap).

---

## §22 — Final maintainer review & release-gate verification (2026-11-17, review session `43a7d3e`)

> Appended by the final maintainer-review session AFTER the correction session
> (§21). No application code was changed in this session; the browser matrix
> and consolidated checks were re-run on commit `43a7d3e`. Production remains
> the Phase 6 release (`schema_version` 12). The release remains **not
> authorized**; this section is evidence for a separate release-approval
> decision, not a release decision.

**Reverification commands/runs (2026-11-17, this session):**

- `npm run check` → lint ✓ · typecheck ×3 ✓ · **1417/1417 (70 files)**.
- `npm run build` → clean; `dist/index-*.js` eager entry re-measured: **raw 417,794 B; gzip 127,366 B** (against the Phase 6 baseline recorded in the audit: 397.20 kB / 122.66 KB gzip — **+20.6 kB raw / +≈4.7–5.1 KB gzip**, wiring-only, D-P7-8 stands). `@cfworker/json-schema` absent from the eager chunk (0 matches); contract routes dynamic-import (`import("./Contract…Page")` ×5 in the entry); validator present only in lazy chunks.
- Browser matrix (local isolated environment, `wrangler pages dev :8793` on the fresh `dist/`, local D1 `schema_version` 13, headless Chrome over CDP):
  - **40/40 matrix checks PASS** — 5 routes (`/contract`, `/contract/validate`, `/contract/compare`, `/contract/consumer`, `/contract/exercises/contract-bgn-required-01`) × 2 themes (light/dark) × 4 widths (375/768/1024/1440): **zero horizontal overflow** (all diffs ≤ 0), all route markers rendered, **zero console errors and zero page exceptions**; 40 screenshots captured to `/tmp/opencode/review-shots/` (ephemeral; several inspected: hub-light-375, validate-dark-375, compare-dark-768, consumer-dark-375, exercise-light-1440, hub-dark-1024).
  - **14/14 functional checks PASS** — live `/openapi.json` validation (invalid payload fires `/priceCents type` assertion; valid payload validates clean); compare pairs: v1→v2-compatible ⇒ **REVIEW REQUIRED**, v1→v2-breaking ⇒ **BREAKING** (rule-id findings render), v2-required (request locus) ⇒ **BREAKING**; consumer guided verify ⇒ holds; `provider-product-v2-latest` in clean mode resolves additive and holds; exercise `contract-bgn-required-01` check-work ⇒ pass; reveal gated pre-submit; `prefers-reduced-motion` page renders and is interactable.
  - Prior hunt-contract-002 end-to-end probe (correction session): **13/13 PASS** (reused, not re-run — no new attempts minted in this session).
- dist leak scan (this session): **zero** `CONTRACT-00[1-7]`; **zero** historical answer-bearing exampleEvidence strings; reveal/rubric/delta modules absent from the bundle.
- OpenAPI invariants re-verified: **3.1.0, `info.version` 1.2.0, exactly 42 operations, 27 `ErrorCode`s**, four `/api/v1/contract/*` paths. No migration, table, binding or dependency added.

**F-C8 call-graph security-boundary assessment (verified this session):** `internalDocument` exists only in `src/shared/contractValidation.ts` and is used at exactly one call site — `src/pages/ContractValidatePage.tsx` (`isLive ? { internalDocument: true } : {}`). The server never passes options (grep across `src/server`: no `internalDocument`); learner-pasted schemas/expectations/payloads therefore remain under the normal 2,000-node / depth-16 schema and 5,000-node / depth-32 payload budgets, and the payload budget is not widened by the option (`validatePayload` always calls `assertPayloadBudget` with defaults). The privileged path validates only the literal same-origin `/openapi.json` fetched via `loadContract()` (hard-coded URL, no learner-controlled document, no API surface, no alternate helper). Test coverage exists for both budgets (`tests/lib/contract-validation.test.ts`, Finding 8 block: 3,452-node live doc throws `complexity_limit` by default; compiles and validates end-to-end under `internalDocument`). **Verdict: PASS — the restriction is structural, not conventional.**

**Exact rubric scores (re-scored this session):** worked example 100 PASS · false-negative 65 FAIL (C6=0) · each of `id`/`description`/`categorySlug`/`categoryName` added as required extra ⇒ **65 FAIL** · 8-of-9 near-clone ⇒ **65 FAIL** · full 9-of-9 clone ⇒ **60 FAIL** · optional extra property ⇒ **100 PASS** · const→enum / integer→number / reordered `required` equivalents ⇒ **100 PASS** · closed ⇒ 65 FAIL · vacuous `{}` ⇒ 45 FAIL.

**Compatibility engine (re-verified this session):** sibling identical changes and nested identical changes at distinct pointers **both remain distinct** (4 findings incl. `/properties/a`+`/properties/b`, `/properties/x`+`/properties/y`); shared-`$ref` duplicate (two `$ref:'#/definitions/shared'` sites, `minimum 1→0`) collapses to **one** finding justified by shared ref origin; one-sided `type` added/removed ⇒ **REVIEW (R19)** both directions; `anyOf` added/removed/changed ⇒ **REVIEW**; byte-equal reordered composites ⇒ zero findings; `oneOf` identical ⇒ none; `allOf` removed ⇒ **REVIEW**; boolean `items` toggle and boolean↔schema ⇒ **REVIEW**; request/response loci R1 (request ⇒ breaking) and R9 (response ⇒ review / request ⇒ compatible) intact; output byte-deterministic; **ledger fixture outputs byte-identical** to the review record. **Verdict: PASS.**

**Remaining deviation recommendations (for maintainer sign-off):**
1. **D-P7-8 (index chunk not byte-identical)** — **ACCEPT** (recommended): the +≈5 KB gzip is mandatory wiring content (tracks/scenarios/curriculum for the seven hunts), no new eager dependency, contract chunks lazy. Alternative if rejected: split the scenario-wiring data into a lazy chunk — measure first; do not rearchitect in the release step.
2. **F-C7 (ReDoS residual risk)** — **ACCEPT with disclosure** (recommended): 256-character cap bounds pattern size, not regex cost; JS `RegExp` has no possessive quantifiers; mitigation is the Pages Functions CPU-time limit (server) and tab freeze risk (browser); the ReDoS-shaped test fixture was planned but never implemented (recorded as an unimplemented test, not a passing one); learner-facing warning shipped in `/contract/validate`. No blacklist is implemented or advised.
3. **D-P7-1 (60/65 caps)** — **ACCEPT** (recommended): the plan's own exit criteria 13/14/15 ("score < 70") were unreachable with pure weights; the caps are tested against every canonical wrong answer and every legitimate equivalent representation; the deviation and rationale are recorded in plan §19/§20/§21 and the gates are load-bearing (findings from the independent review confirmed the need). The caps do **not** reject the correct contract or any recorded equivalence to it.
4. **Criterion 28** — re-verified this session as PASS-locally (40/40 matrix + 14/14 functional); a full production-build browser re-probe **after** the approved release remains desirable.

**Acceptance matrix status after this review (changes only):** 1–3 PASS; 4–27 PASS; **28 → PASS (local isolated probe, this session)**; **29 → PARTIAL (waived only by D-P7-8 acceptance — open)**; 30–32 PASS. No criterion regressed. **31 → PASS** (per §21 and this session's check-work/hint evidence).

**Release remains NOT approved.** Before any release: maintainer sign-off on (1)–(3); explicit approval for the release sequence (verified pre-migration export → `0013` on production → `npm run check && npm run build && npx wrangler pages deploy dist` → production acceptance, incl. hunt-002 browser flow in production and the §10 acceptance list). Production stays the Phase 6 release until then; migration 0013 remains local-only.

---

## §23 — Release execution & production acceptance (2026-11-17, release session)

> Appended by the release session AFTER §22. The maintainer confirmed the
> three deviation decisions in writing ahead of the release: **D-P7-8 ACCEPT**
> (index-chunk wiring-only growth, validator remains lazy), **F-C7 ACCEPT WITH
> DISCLOSURE** (regex execution cost is an explicitly documented residual
> risk; the 256-character cap limits pattern size, not execution cost), and
> **D-P7-1 ACCEPT** (consumer rubric full-pin/closed-contract caps of
> 60/65). This section is the release record; §21/§22 are unchanged.
>
> **Outcome: RELEASED.** Phase 7 is live in production; production D1 is on
> `schema_version` 13; git `main` remains at `eeded31` (Phase 7 deployed from
> the reviewed source per the maintainer-approved sequence; merge/PR was NOT
> authorized and was NOT performed).

### Source and git preflight (2026-11-17)

- Working tree clean; branch `feat/phase-7-contract-testing-lab`; HEAD
  `8000b77` (documentation-only final review record) containing `43a7d3e`
  (the reviewed application commit) — both verified ancestors.
- `git diff 43a7d3e..8000b77` → documentation only (`PROJECT_STATE.md`,
  `docs/phase-7-contract-testing-plan.md`, `docs/phase-7-exit-audit.md`);
  zero application-code changes.
- `main == origin/main == eeded31`; `backup/unpublished-phase6-7-docs @
  a6c5c2a` untouched (not deleted, not pushed, not merged).
- Release built in a detached worktree at `/tmp/opencode/release-phase-7`
  pinned to `8000b77` (`git worktree add --detach … 8000b77`), dependencies
  installed with `npm ci` from the lockfile (244 packages).

### Production D1 preflight and backup

- Account context unambiguous (single OAuth account, APAC region).
- Target database verified by exact name **and** UUID:
  `qa-practice-lab-db` / `928b4ed6-6284-46a2-b374-f1c569c1affe`.
- Pre-migration health: `schemaVersion "12"`, database `ok`. Migration
  history exactly `0001..0012`; `app_meta.schema_version = 12`; tables 22 /
  indexes 34 / triggers 0 / views 0; recorded row counts (products 42,
  categories 8, customers 5, orders 2, order_items 2, inventory 42, carts
  26, cart_items 0, customer_sessions 1, hunt_attempts 24, bug_reports 1,
  api_tokens 0, practice_sessions 26, rate_limit_buckets 34,
  hunt_start_caps 1).
- Migration `0013_contract_lab_schema.sql` inspected before apply: exactly
  the reviewed zero-DDL marker update (`schema_version 12 → 13` via
  `UPDATE app_meta`), no DDL of any kind. Only 0013 pending.
- **Verified pre-migration export**:
  `/tmp/opencode/backups/qa-practice-lab-db-pre-0013-2026-11-17T08-13-49Z.sql`
  — **57,655 bytes**, SHA-256
  `225c744464fb3426e291c35cb189a46c582e1ff6b2406c7ef24680b32c780730`.
  Structurally verified by loading the export into a scratch SQLite database:
  12 migrations (0001→0012), `schema_version` 12, 21 load-created tables, all
  row counts identical to the live database, `PRAGMA integrity_check` →
  `ok`. The previous Phase 6 backup was not touched. The backup is not in
  the repository.

### Migration 0013

- Applied via `wrangler d1 migrations apply qa-practice-lab-db --remote`
  (the only pending migration; not via `execute --file`, so `d1_migrations`
  records it). Wrangler reported `0013_contract_lab_schema.sql` ✅,
  2 commands in 0.24 ms.
- Post-migration verification:
  `d1_migrations` now contains `0013_contract_lab_schema.sql`;
  `app_meta.schema_version = '13'`;
  `wrangler d1 migrations list --remote` → **No migrations to apply**;
  tables 22 / indexes 34 / triggers 0 / views 0 (unchanged); all row
  counts byte-identical to pre-migration; table definitions compared
  against the backup: **19 definitions byte-identical**, `d1_migrations`
  differs only by the export's `IF NOT EXISTS` header. No new table, index,
  column, trigger or other DDL introduced. Zero DDL held.
- Health endpoint immediately reported `schemaVersion: "13"`,
  `database: "ok"` (runtime read of `app_meta`), before redeploy.

### Build and deployment

- `npm run check` in the release worktree → lint ✓, typecheck ×3 ✓,
  **1417/1417 tests (70 files)** — the expected suite count, no change.
- `npm run build` → clean (`tsc` + `vite build`).
- Client budget audit of the built artifact:
  - five contract routes are `import("./Contract…Page-…")` dynamic imports
    in the eager entry (`index-KeIJVV6-.js`, **raw 417,794 B / gzip
    127.74 kB**; D-P7-8 accepted);
  - `@cfworker/json-schema` — **0 matches** in the eager chunk;
  - SQL WASM asset shipped (`dist/assets/sql-wasm-CXIAVl5-.wasm`,
    688,197 B served, HTTP 200); seed dataset shipped
    (`dist/datasets/meridian-outfitters.sql`, 122,966 B served, HTTP 200);
  - Phase 3–6 chunks all present (shop/cart/checkout, database, api-reference,
    api-lab, progress, practice).
- Dist leak scan: **zero** `CONTRACT-00[1-7]`;
  **zero** `CONTRACT_DRIFT_PAYLOAD` / `selectProviderFixture` /
  `contractDeltas` references;
  **zero** composition literals (`categoryName`→`category` + `IN_STOCK`
  adjacency); `IN_STOCK` appears only inside the intentional client-safe
  exercise brief; `provider-product-v2-drift` appears only in the public
  `openapi.json` documentation (the explicitly documented drill);
  `exampleEvidence` strings are the shape-level rewrites enforced by the
  in-suite leak lint (1417 green); no SQL server-execution route exists in
  OpenAPI (`/api/v1/sql/*`: evaluate, exercises/start, hunts/seed only).
- OpenAPI invariants on the **served** document: `openapi` 3.1.0,
  `info.version` 1.2.0, 38 paths, exactly **42 operations**, exactly
  **27 `ErrorCode`** entries, exactly **four** `/api/v1/contract/*` paths.
  No new error codes.
- No deployment hook applies migrations (Pages direct upload; no
  workflows; `migrations_dir` is only read by the `wrangler d1
  migrations` command). Migration 0013 was applied manually and only once.
- Deployment 1 (from the detached worktree): `npx wrangler pages deploy
  dist` → succeeded but, being built from a detached HEAD, landed as
  **Preview** branch `HEAD` (`2b6b09b5-3b96-4844-a681-1c5132754fdf`, source
  `8000b77`) — the production alias did NOT move. Root cause understood
  before any retry (branch inference), no settings were changed.
- Deployment 2 (same verified `dist/`, same project): `npx wrangler pages
  deploy dist --branch=main` → **Production** deployment
  **`47680bf9-7290-4c8a-a5c9-25490dff7fc4`**, branch `main`, source
  `8000b77`, URL `https://47680bf9.qa-practice-lab.pages.dev`. Production
  alias `https://qa-practice-lab.pages.dev` now serves
  `assets/index-KeIJVV6-.js` (verified) and `/api/health` reports
  `schemaVersion: "13"`, `database: "ok"`.
- The Phase 6 rollback reference remains `2c32a721-8374-46af-8a20-e560839f88b1` (kept in
  deployment history; nothing overwritten).

### Production HTTP and API acceptance (all against the production alias)

- Core routes, all HTTP **200**: `/`, `/shop`, `/database`,
  `/database/playground`, `/practice`, `/tracks`, `/progress`,
  `/openapi.json`, `/api-reference`, `/api-lab`, `/contract`,
  `/contract/validate`, `/contract/compare`, `/contract/consumer`,
  `/contract/exercises/contract-bgn-enum-01`.
- `/api/health` → `schemaVersion: "13"`, `database: "ok"` (repeatedly).
- OpenAPI served document → 3.1.0 / 1.2.0 / 42 operations / 27 ErrorCodes /
  four contract paths (re-verified from the network, not just the build).
- `POST /api/v1/contract/validate`:
  valid payload → `valid:true`, `assertions:[]`; invalid payload (missing
  `amountCents`) → `valid:false` with the structured `/amountCents`
  `required` assertion; missing `fixtureId` → 400; unknown fixture → 404.
  >24 KB payload → 400 (`larger than the 24 KB limit`).
  30/min scoped budget observed: 30-second burst → the 31st request
  answers `429 rate_limited` with the documented message (bucket is
  per hashed IP; self-healing).
- `POST /api/v1/contract/compare`:
  named `ledger-v2-compatible` (response locus) → **review** (R9 enum
  widening flagged, R4 memo compatible); named `ledger-v2-breaking` →
  **breaking** (R13/R6/R3/R8 breaking, R19 review, R2 compatible, verdict
  BREAKING); document-shaped inline additive candidate (optional `memo`) →
  **compatible** (single R4 finding); both `candidateFixtureId` and
  `candidateSchema` → 400.
  (Probe note: an earlier bare-schema inline candidate — not the documented
  document-shaped contract — yielded structurally valid but semantically
  meaningless findings; the public contract requires a full candidate
  document. Not a defect; recorded for honesty.)
- `POST /api/v1/contract/verify-consumer`:
  minimal open expectation (critical five: slug/name/priceCents/currency/
  stockStatus) vs `provider-product-v1`, `provider-product-v2-compatible`,
  `provider-product-v2-latest` (no hunt session) → **valid:true** each.
  With `hunt-contract-007` active in a synthetic bug-hunt session, the
  `provider-product-v2-latest` alias exposes the drift — assertion-only
  diagnostics (`/categoryName` required missing; `/stockStatus` enum
  `IN_STOCK`), **never the raw drift payload** (verified: no
  `warehouseRank`, `supplierCostCents`, `categorySlug`, `category`, or id
  material in any response). Explicit drill `provider-product-v2-drift`
  likewise returns assertion lists only. Control path
  (`provider-product-v2-compatible`) holds during the hunt. Unknown
  provider fixture id → 400.
- `POST /api/v1/contract/evaluate`:
  unauthenticated → `401 session_required`; authenticated correct answer
  (`contract-bgn-required-01`) → `passed:true`, score **100**, `set-match`
  check, `attemptStatus: submitted`; incorrect answer → `passed:false`,
  score 0; unknown exercise → 404 `exercise_not_found`; malformed answer →
  400; malformed id shape → 404.

### Contract hunts in production (synthetic, isolated sessions)

**CONTRACT-002** (`hunt-contract-002`, "The money that became text"):
started via `POST /api/v1/practice/hunts/hunt-contract-002/start` →
list (`/api/v1/products`) and detail
(`/api/v1/products/ridgeline-2-person-tent`) both emitted `priceCents` as a
**string** (`"2250"`, `"18900"`…); `GET .../reveal` before any report →
**403 `reveal_locked`**; bug report submitted (expected/actual covering
type, surface list+detail, integer-vs-string) → deterministic evaluation
**68/100**, verdict `needs-work` (honest: the probe report failed
`environment-present` and `finding` — recorded as such, not dressed up);
attempt → `submitted`; `GET .../reveal` after submission → **200** with
the full solution; `POST .../session/reset` → clean mode; `priceCents`
numeric again (`2250`, `1890`).

**CONTRACT-007** (`hunt-contract-007`, "The provider that moved"):
started → `provider-product-v2-latest` resolves to the drifted fixture;
expectation pinning `categoryName` fails with assertion-only diagnostics
(`/categoryName` required missing; `/stockStatus` `IN_STOCK` vs enum);
drift also visible through the explicit `provider-product-v2-drift` drill;
no raw payload at any point; control fixture
(`provider-product-v2-compatible`) still holds during the hunt;
`POST .../session/reset` → clean; expectation holds again
(`valid:true`).

Hunt-002 leak of production state: none — contract hunts mint no orders,
no carts of substance, no customer rows. See cleanup below.

### Browser acceptance (headless Chrome 155, raw CDP, system Chrome)

- Matrix: 5 routes × 2 themes × 4 widths = **40/40 PASS** —
  `/contract`, `/contract/validate`, `/contract/compare`,
  `/contract/consumer`, `/contract/exercises/contract-bgn-enum-01`.
  Zero horizontal overflow at document level at every width
  (measured: `scrollWidth ≤ innerWidth`; widest document 366 px at
  375 px viewport); all route markers render; themes applied
  (`documentElement.dataset.theme` = `light|dark` per cell); **zero
  unexpected console errors, zero page exceptions** (2–3 benign gate
  probes per page: `/api/v1/auth/me` 401 for anonymous visitors and,
  on exercise pages, the pre-submit `reveal` 403 — both are the app's
  designed gate checks, allowlisted by match and counted separately).
  40 screenshots at `/tmp/opencode/shots/` (not committed); several
  inspected visually (hub-light-375, validate-dark-375, exercise-light-375,
  exercise-dark-1440, compare-dark-768, consumer-light-1440): no clipped
  controls, no unreadable content, nav/search/theme toggle usable.
  Note: 375 px cells show intentional *inner* horizontal scroll strips
  for wide code/pills; the document itself does not scroll horizontally.
- Reduced motion: `prefers-reduced-motion: reduce` emulated →
  `matchMedia(...).matches === true`, page renders, no overflow, no
  exceptions.
- Functional (light, 1440 px): validate default starter → **VALID**;
  broken payload → **INVALID** (assertion list renders); live
  `/openapi.json` source → validates → **VALID** (internal-budget path,
  no error alert); compare default pair renders **BREAKING** with
  rule-id findings (engine output, verdict headline, impact notes);
  consumer guided verify → **HOLDS**; exercise
  `contract-bgn-enum-01`: two correct options selected → Check work →
  **Passed — 100/100 (Exact set match)**; `Unlock hint 1` present and
  enabled post-pass; reveal locked pre-submission (403 observed on page
  load) and unlocked after submission; Reset returns to clean mode.
  (Probe artifact disclosed honestly: an early Check-work click issued
  before hydration settled scored 65/100 with `assert-status-enum`
  unselected in the payload sent; re-run with 1.5 s settle scored
  100/100. Not a product defect; browser hydration is the timing
  constraint.)
- The production-browser pass supersedes and complements the local
  isolated 40/40 + 14/14 from §22; it does not silently reuse it.

### Phase 3–6 regression smoke (production, no destructive actions)

- Storefront: categories list 8; products page (`perPage`) → 40 active,
  numeric `priceCents`; product detail clean (`priceCents` int,
  `stockStatus` lowercase); category filter `hiking` → 5 rows, all
  `hiking`.
- Cart: guest add (`ember-led-lantern` ×1) → line present; remove →
  cart empty. No order placed; no checkout POST issued;
  `GET /api/v1/checkout` quote shape correct.
- Customer auth boundaries: anonymous `/api/v1/auth/me` → 401;
  wrong password (demo account) → 401 `invalid_credentials`;
  suspended demo account → 403 `account_suspended` (one attempt, the
  documented practice case).
- API token lifecycle (demo customer `ben.whitmore@example.net`, a public
  training account): login → `/auth/me` 200 → `POST /api/v1/auth/token`
  (email+password+60 s TTL) → `expiresIn: 60`, 256-bit opaque token →
  Bearer `/auth/me` 200 → `POST /api/v1/auth/logout` → Bearer
  `/auth/me` **401** (token revoked with sign-out). Client sessions
  deleted server-side by logout (verified: 0 matching rows).
- Bug-hunt catalogue: `GET /api/v1/practice/hunts` → 25 ids
  (`hunt-contract-001…007` present).
- Learning progress: guest `GET /api/v1/practice/progress` → 200,
  per-hunt rows for all hunt ids.
- SQL playground: `/database/playground` 200; WASM asset 200
  (688,197 B); seed dataset 200 (122,966 B).
- Rate-limit/backstop behavior spot-checked (contract-validate 31st
  request → 429; login failure budget untouched — one wrong-password
  attempt only).
- `GET /api/v1/auth/me` 401 for anonymous is the routine anonymous probe
  the SPA issues on every page; expected and unchanged.

### Records created by this release probe, and cleanup

Created and then **removed by exact id** (verified by re-count):
guest practice sessions 27–40 (cascade-deleted
`practice_sessions` → `carts` → `cart_items`, `hunt_attempts` 25–33
(9 rows incl. the two `contract-bgn-required-*`/`contract-bgn-enum-01`
evaluations and the two hunt attempts), `bug_reports` id 2 via cascade —
38 rows written); 1 API token (auto-deleted by logout, verified absent);
2 demo customer sessions (auto-deleted by logout, verified absent); 1
cart line (added then removed via API). Post-cleanup counts are
byte-identical to the pre-probe baseline for every table **except**
`rate_limit_buckets` (34 → 61; shared hashed-IP windows from the burst
and 30/min checks; no learner data; self-cleaning / swept by the staff
maintenance sweep). `products 42, categories 8, customers 5, orders 2,
order_items 2, inventory 42, carts 26, cart_items 0, hunt_attempts 24,
bug_reports 1, api_tokens 0, practice_sessions 26, hunt_start_caps 1` —
all identical pre- and post-probe. My probe left the database clean.

### Documentation disposition

- `PROJECT_STATE.md`, `README.md`, this audit (§23), and the stale status
  lines in `AGENTS.md` updated in the same turn as this release.
- Historical audit sections (§14–§22) unchanged. The Phase 6 audit and
  backup branch untouched.
- New commit for the documentation update; no push.

### Known limitations / accepted residuals (unchanged by the release)

- **F-C7 (accepted with disclosure):** JS `RegExp` has no
  possessive quantifiers; the 256-character cap bounds pattern *size*,
  not *execution cost*; mitigation is the Pages Functions CPU-time limit
  (server) and tab freeze risk (browser); the ReDoS-shaped test fixture
  planned in the plan was **never implemented** — recorded as an
  unimplemented test, not a passing one; learner-facing warning ships in
  `/contract/validate`. No blacklist is implemented or advised.
- **D-P7-8 (accepted):** eager entry is not byte-identical to Phase 6
  (+≈5 KB gzip; wiring-only; `@cfworker/json-schema` confirmed absent).
- **D-P7-1 (accepted):** consumer rubric C3/C5 caps of 60/65.
- Criterion 29 (exact bundle byte-identity) remains PARTIAL, waived only
  by the D-P7-8 acceptance.
- The Phase 7 implementation is deployed but **not merged into git
  `main`**; merge/PR is a separate maintainer decision.
- `/openapi.json` validation on `/contract/validate` runs in-browser
  against the first-party document under the documented `internalDocument`
  budget; learner-pasted content always runs under the normal budgets.

### Final verdict

**RELEASED** — production serves the reviewed Phase 7 source; migration
0013 applied and verified; production acceptance passed; no production
data was harmed; three maintainer deviation decisions are recorded as
accepted. Git history unchanged (`main == origin/main == eeded31`; release
source `8000b77` on `feat/phase-7-contract-testing-lab`); backup branch
intact; documentation committed on the feature branch; no push.

---

### Post-release merge addendum (2026-11-17)

*Added after the fact; the audit above is preserved verbatim.* Phase 7 was
**merged into git `main`** on 2026-11-17 via **PR #11**
(https://github.com/thisishamza/qa-practice-lab/pull/11, merge commit
`e21108aab833e73f4ac21e5f9783e348f4f8b99d`; parents `eeded31` + `04a6013`).
The merged tree is identical to the reviewed branch head `04a6013`; the
application code (`src/`, `public/`, `db/`, `functions/`, `package.json`) is
byte-identical to the deployed release source `8000b77` (delta
documentation-only). Post-merge `npm run check` is green (1417/1417, 70 files)
and `npm run build` is clean (entry `index-KeIJVV6-.js`, identical to the
deployed entry). Production was **not** redeployed: the 2026-11-17 Phase 7
deployment `47680bf9-7290-4c8a-a5c9-25490dff7fc4` (source `8000b77`) remains
authoritative; read-only verification confirmed `schema_version` 13 and
migration `0013` present. See `PROJECT_STATE.md` §11 ("Phase 7 merge
complete"). Phase 8 has not been started.
