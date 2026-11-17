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
