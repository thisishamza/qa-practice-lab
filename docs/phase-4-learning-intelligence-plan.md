# Phase 4 — Learning & Bug-Hunt Intelligence — Plan

> **Purpose:** authoritative design for Phase 4 and its milestone sequence.
> **Planning only — no Phase 4 implementation has been started.** Implement **one
> milestone per session**; do not start a milestone before the previous one is
> verified and committed. Update `PROJECT_STATE.md` (§1, §9, §11, new §14) in the
> same turn as any change to this plan.
>
> **2026-11-16 — milestone consolidation:** Phase 4 contains **exactly three
> milestones** (P4-M1 → P4-M2 → P4-M3). The original eight milestones
> (P4-M1…P4-M8) were **consolidated, not removed** — every original feature,
> requirement, security rule, acceptance criterion and intended outcome maps into
> one of the three (see the consolidation map in §6). No functionality was dropped.
> The next recommended implementation task is **P4-M1**.
>
> **2026-11-16 — maintainer planning decisions resolved** (§14): curated
> server-side finding-check term groups with normalization and synonym tolerance;
> severity vocabulary `Critical|High|Medium|Low`; priority `P1 Urgent|P2 High|
> P3 Normal|P4 Low` kept strictly separate from severity; guest progress stays
> session-scoped-ephemeral with explicit UI copy (temporary, expires with the
> practice session, never transfers to an account); Phase 4 deployment retains the
> manual Cloudflare workflow (no new products, cron, queues or paid services).
> Roadmap renumbering is **not approved** — future phases keep their current
> numbering.
>
> This plan was written on 2026-11-16 against `main` @ `30d34241ba39424a4356c58eec8f566aa0ddb3d5`
> (Phase 3 merged, deployed at https://qa-practice-lab.pages.dev, D1 `schema_version` 9).
> Companion documents: `docs/phase-3-commerce-practice-plan.md` (Phase 3 design +
> milestones), `docs/bug-hunt-catalogue.md` (internal defect registry),
> `docs/phase-3-exit-audit.md` (Phase 3 closure).

## 1. Phase overview and objectives

Phase 3 made seven defects reproducible behind the bug-hunt engine. What it deliberately
did **not** ship: any explanation, any hint, any structured bug report, any evaluation,
any score, any record. A learner can today reproduce `PRICING-001`, download a local
markdown file, and nothing else happens.

**Phase 4 turns the bug-hunt engine from a collection of reproducible defects into a
structured QA learning experience.** Concretely, a learner should be able to:

1. Understand what they are testing and why (objectives, concepts, acceptance criteria).
2. Investigate a realistic defect independently, in clean vs bug-hunt mode.
3. Ask for progressive hints that guide the investigation without giving away the answer.
4. Submit a structured bug report (title, environment, preconditions, steps, expected,
   actual, severity, priority) and receive deterministic, explainable feedback.
5. Understand expected vs actual behaviour, the root cause at learner level, and how to
   verify a fix — revealed only after attempting (or explicitly choosing to reveal).
6. Track their completion state, history and report quality per hunt.
7. See how all of this connects: scenario ↔ hunt ↔ defect ↔ QA concepts.

The platform must keep teaching **QA thinking**, not test "did you click the right
answer". Consequences that shape everything below:

- No paid AI services; no AI at runtime. All evaluation is deterministic and testable.
- No timers, streaks or leaderboards that reward speed over rigour.
- Reveal is earned (report submitted) or chosen (explicit, confirmed reveal action) —
  never silently, never in the list endpoints, never in the DOM before unlock.
- Hunt defects stay server-controlled and session-isolated; Phase 4 adds learning
  surfaces around the engine, it does not change the engine's activation model.

### 1.1 Re-scoping note (important)

`PROJECT_STATE.md` §9 originally sketched Phase 4 as **"API & identity lab — REST API,
OpenAPI, sample collection, synthetic auth/roles, negative authZ cases"**. The Phase 4
charter for this project is now **Learning & Bug-Hunt Intelligence** (this plan). The
API & identity lab is **not cancelled and not implemented** — it is deferred to a later
phase (see §12). Renumbering the downstream roadmap is a maintainer decision and is
**not** made by this document; the deferred-phases table in §12 lists a *suggested*
placement for the user to confirm. As of 2026-11-16 **no renumbering has been
approved** — the roadmap table keeps its current numbering and the deferred API &
Identity Lab remains deferred until the maintainer explicitly approves a change.

## 2. Current-state architecture assessment

Assessed at `main` @ `30d3424` (deployed). Only files relevant to Phase 4 were inspected.

### 2.1 What exists and works today

| Area | State | Relevant facts |
|---|---|---|
| Hunt registries (code, not data) | `src/server/hunts.ts` (7 learner-safe hunt summaries: id, title, summary, scenarioId) · `src/server/defects.ts` (7 internal defect definitions: id, title, affectedSurface, expected, actual, repro[], fix) · `isDefectActive()` | Defect ids never appear in any API response; activation resolved per request from the caller's `mpl_session` row; clean/expired/unknown/forged all resolve to clean. |
| Hunt↔scenario wiring | `src/data/scenarios.ts` (28 scenarios; 7 wired `ready`/`runnable`/`mode: 'bug-hunt'`), bidirectional `scenarioId`↔`huntId` enforced by `tests/data/content.test.ts` | 21 catalogue entries remain non-runnable placeholders — keep them that way. |
| Practice API | `GET /api/v1/practice/hunts`, `GET /api/v1/practice/session`, `POST /api/v1/practice/hunts/:huntId/start`, `POST /api/v1/practice/session/reset` (`src/server/practice.ts`) | Start is idempotent per hunt; 20/IP/UTC-day start cap (`hunt_start_caps`, migration 0008, exact atomic); reset is a non-destructive re-stamp; rate limits: 120 mutate/min backstop, 30 checkout/min, 5 login failures/min (migration 0009). |
| Practice sessions | `practice_sessions(token_hash SHA-256, mode, hunt_id, 7-day TTL)`, cookie `mpl_session`; `carts`, `orders`, etc. all keyed off `session_id` | The practice session is the unit of learner ownership. Synthetic customer sessions (`mpl_customer`, 8 h, SHA-256) are bound to the practice session. |
| Synthetic auth | `customers` (2 roles: customer, staff; 5 fixtures), PBKDF2-HMAC-SHA256 100k, rotation on login, 401/403/404 ownership policy | Orders stamp `customer_id` at placement (nullable, SET NULL). Attempts should follow the same pattern (§7.3). |
| Bug-report capture | `src/features/practice/BugReportExport.tsx` — local markdown download, uploaded/stored **nowhere**, not graded; copy says so honestly | This is the placeholder Phase 4 replaces with a stored, evaluated report. The local export can remain as a secondary convenience. |
| Progress | `/progress` renders labelled **sample** data (`src/data/demo.ts`); nothing persists; page says "Nothing on this page is saved yet." | Dashboard shows demo data too (labelled). |
| Design system | "The Test Bench": light-first, dark workspace palette, IBM Plex Sans/JetBrains Mono Variable (self-hosted), hand-written CSS tokens in `src/styles/`, both themes, responsive at 375/768/1024/1440 | Phase 4 frontend work must extend this system, not restyle it. |
| Test infra | Vitest + `tests/helpers/fake-d1.ts` (node:sqlite harness applying the real migrations, all-or-nothing `batch()`); 344 tests green at P3-M9 (358 after WP1, 2026-11-16); integration tests per feature; one `h1`/page conventions; manual a11y + browser probe (Playwright/Chrome) | Follow these conventions exactly. |

### 2.2 Gaps Phase 4 must close

1. No persistence of hunt attempts, reports, hint usage or scores anywhere.
2. No deterministic evaluation of a bug report.
3. No reveal path (expected/actual, root cause, fix verification) after an attempt.
4. No progressive hints.
5. Scenario content lacks concepts/acceptance criteria/expected-outcome metadata.
6. `/progress` is a labelled mock, not a real view.
7. Completion is undefined — nothing says a hunt is "done".

### 2.3 Constraints carried forward

React 19 + TS + Vite; Hono on Pages Functions; D1 via `c.env.DB`; additive migrations
only; `app_meta.schema_version` bumps per migration; shared contracts in `src/shared/`;
all API responses `{ error, message }` envelopes, `Cache-Control: no-store`, 32 KB body
cap, per-IP rate-limit backstop; synthetic data only; no real identity; free-tier first;
`npm run check` green before each milestone lands.

## 3. Scope and non-goals

### 3.1 In scope (Phase 4)

- **A. Defect reveal & explanations** — learner-safe reveal content per hunt, served only
  after unlock (report submitted, or explicit confirmed reveal).
- **B. Progressive hints** — three levels per hunt, investigation-guiding, optional,
  server-counted, never mandatory.
- **C. Bug-report evaluation** — structured submission, stored server-side, deterministic
  rule-based quality scoring with per-check feedback. No AI.
- **D. Scoring & completion** — transparent rubric; completion = submitted report;
  hint usage disclosed, not punished; best score kept; no speed component.
- **E. Learner progress** — session/customer-scoped attempt and report history,
  completion states, per-hunt status, `/progress` becomes real.
- **F. Difficulty & learning paths** — difficulty on scenarios (beginner/intermediate/
  advanced already exists), a recommended order on `/practice` and scenario pages,
  prerequisites displayed (not enforced). Guided-vs-independent labelling via hints.
- **G. Scenario learning content** — objectives (exist), concepts practised, acceptance
  criteria, expected outcomes, hunt↔defect↔concept linkage; rendered on scenario detail.

### 3.2 Non-goals (Phase 4)

- Any AI/LLM call at runtime (feedback, grading, chat). Deterministic rules only.
- New defects or new hunts (the seven shipped in P3-M8 are the Phase 4 content base).
- The API & identity lab, SQL playground, contract testing, performance runner, security
  challenges, automation examples (each remains its own future phase — see §12).
- Accounts with real identity: registration, password reset, OAuth, cross-device sync,
  email. The synthetic training sign-in is unchanged.
- Leaderboards, classrooms, teacher/admin cohorts, proctoring, moderation.
- Persisting guest progress beyond the practice session's 7-day TTL.
- Enforcing prerequisites (displayed as guidance, never blocking).
- Migrating off Pages/Hono-adapter (tracked in AGENTS.md "Known risk").
- Redesigning the Test Bench system. Phase 4 adds learner workflows inside it.

## 4. Learner journeys

### 4.1 Primary journey — structured bug hunt (signed-in customer)

```text
/scenarios/manual-cart-totals  (objectives, concepts, acceptance criteria visible)
        │  "Start the bug-hunt exercise"
        ▼
  Hunt starts (server re-stamps practice_sessions.mode='bug_hunt')
        │  attempt row created (status='in_progress', hint_mask=0)
        ▼
  Investigate in /shop · /cart · /checkout …   (clean⇄bug-hunt switchable, reset anytime)
        │  optional: POST hints {level:1|2|3}   (mask updated, count shown)
        │  optional: submit report → evaluation feedback (deterministic)
        ▼
  Report submission → attempt.status='submitted'
  quality score + per-check feedback stored and shown; reveal unlocked
        │  optional: view reveal (expected/actual, root cause, repro, fix, verification)
        ▼
/progress  (completion state, score, hints used, history across hunts)
```

### 4.2 Guest journey

Identical, minus sign-in. Progress lives on the 7-day practice session and dies with it.
The UI states this plainly, wherever progress is shown: guest progress is **temporary**,
is **tied to this device's anonymous practice session**, and **expires when the practice
session expires** (or cookies are cleared) — after which the attempts and reports are
gone by cascade. The UI must **never imply that guest progress automatically transfers
to a signed-in account**; signing in starts attribution from that moment, it does not
retroactively claim earlier guest rows. No nagging, no blocked content. Signed-in
attribution behaviour is unchanged: attempts/reports made while signed in are stamped
`customer_id` at submit time (SET NULL afterwards) per the architecture in §7.3 and are
visible to that synthetic customer, still bounded by the practice session's TTL.

### 4.3 "Give up" / reveal-first journey

Learner may request the reveal at any time. The UI requires an explicit confirm
("Show the solution — you will not get this exercise marked discovered"). The attempt is
flagged `revealed` (not `submitted`, not `discovered`), the reveal is served, and the
attempt is still recorded in history. Choosing reveal is a legitimate pedagogical act;
hiding it would be paternalism. It simply never counts as a completion.

### 4.4 Resubmission journey

After evaluation feedback, the learner may revise and resubmit. Every submission is
stored as a `bug_reports` row (attempt history). The attempt keeps **best** quality score
and the `discovered` flag once earned (never revoked by later weaker submissions).

### 4.5 Anti-patterns the journeys must avoid

- Reveal rendered in HTML/JSON before unlock (checked by tests).
- Hint levels disclosed out of order (level N+1 requires N already used).
- "Wrong hunt" feedback that names the hiding spot (feedback is about the *report's*
  quality, never about where the defect lives, except the finding check — see §6.4).
- Any score shown before a submission exists.
- Progress bars that count non-runnable placeholder scenarios.

## 5. Capability breakdown (A–G)

For each: what Phase 4 does, what it deliberately defers.

### A. Defect reveal and explanations

**Phase 4 ships:** per-hunt learner-safe reveal payload — `expected` (plain English),
`actual` (observable symptom), `reproduction` (numbered steps), `rootCause` (learner
level: which layer, why the boundary is wrong, no source snippets), `verification`
(how to confirm the fix in clean mode), `concepts` (QA concepts exercised, e.g.
"boundary value analysis", "acceptance vs implementation", "authorization predicates"),
plus `commonMisconceptions` (1–2 bullets). Authored in a new **server-side registry**
(`src/server/reveals.ts`), mirroring `defects.ts` — code, not data; maintainer-visible
in `docs/bug-hunt-catalogue.md`; never in list endpoints; served by one endpoint only
after unlock.

**Deferred:** per-defect video/diagram content; localized reveals; "explain it to me
like I'm new" alternate depths (one good learner-level explanation only).

### B. Progressive hints

**Phase 4 ships:** a 3-level hint ladder per hunt, authored in the same server registry
pattern (`hints` in the reveal registry, or a sibling `src/server/hints.ts`):

- **Level 1 — Orient:** which surface/flow to observe, what normal looks like.
- **Level 2 — Focus:** which comparison/boundary to probe (still not the fault).
- **Level 3 — Narrow:** the precise condition to test (one step from the answer — the
  learner still has to execute and recognise it).

Rules: hints must guide, never disclose; requesting level N requires level N−1 already
used (levels served cumulatively); hint usage is counted on the attempt row
(`hint_mask`, bit per level — idempotent re-requests, no double count); hints are never
mandatory and never block the report form; `hintsUsed` is shown to the learner and on
`/progress`, framed as information, not as a penalty.

**Deferred:** per-hint "was this helpful?" telemetry; adaptive hint selection; hint
economy/points; hints for non-hunt scenarios.

### C. Bug-report evaluation

**Phase 4 ships:** a structured form (title, environment, preconditions, steps, expected,
actual, severity, priority, reproducibility) and a **deterministic evaluator**
(`src/server/reportQuality.ts`, pure function, unit-tested) producing
`{ score: 0–100, verdict, checks: [{ id, passed, message }] }`. See §6.4 for the rubric.
Every submission returns its evaluation; the learner keeps it in history.

**Explicitly rejected:** LLM-graded reports (runtime dependency, nondeterminism, cost,
privacy of learner text); fuzzy semantic similarity; keyword-soup matching beyond the
single curated finding check; plagiarism detection.

**Deferred:** report triage/simulation against a fictional tracker; report-to-test-case
derivation; reviewer roleplay.

### D. Scoring and completion

**Phase 4 ships** the transparent rubric in §6.4. Headline rules:

- **Completion = a submitted report** (`attempt.status='submitted'`). Reveal-only does
  not complete.
- **Discovered = submitted report whose finding check passed.** Discovered is sticky.
- **Quality score = rubric total (0–100)**, best-of submissions kept on the attempt.
- **No time, no speed, no streak, no comparison with other learners.**
- Hint usage is disclosed (`hintsUsed: 0–3`), never subtracted.
- Verdict bands: ≥80 "Solid report" · 50–79 "Needs work — see the checklist" · <50
  "Incomplete — most checks failed".

**Deferred:** percentage-of-defects-found dashboards; weighted track grades; any
competitive comparison; pass/fail gating of later content on scores.

### E. Learner progress

**Phase 4 ships:** session/customer-scoped persistence. `/progress` renders real data:
completed vs in-progress vs revealed counts (7 wired hunts only), per-hunt rows
(status, best score, hints used, last submitted), recent report submissions with scores,
guest-vs-signed-in durability note. Honest empty states for a fresh session.
Completion survives hunt switch/reset (it's keyed to the attempt, not the session mode).

**Key architectural decision:** progress durability is exactly the practice session's
7-day TTL — same ownership rule as orders (session FK `ON DELETE CASCADE`).
`customer_id` is stamped on attempts at submit time when signed in (SET NULL afterwards,
mirroring `orders.customer_id`). **There is no cross-session identity in the product
today**, so there is no honest cross-device progress to offer; promising it would require
real accounts, which are out of scope. Demo/sample data stays labelled wherever it
remains (dashboard), and `/progress` stops showing it once real data exists.

**Deferred:** export of learning transcript; persistent profiles; cross-device sync
(needs real identity — later); weekly goals/streaks (anti-feature for this phase).

### F. Difficulty and learning paths

**Phase 4 ships:** difficulty badges (already on scenarios), a **recommended order**
(the current difficulty progression: `manual-cart-totals` → `hunt-pricing-001`
beginner · `hunt-inventory-001` · `hunt-cart-001` · `hunt-checkout-001` ·
`hunt-catalogue-001` · `hunt-catalogue-002` · `hunt-authz-001` intermediate/advanced),
rendered on `/practice` and scenario detail pages as guidance with estimated effort.
"Guided" vs "independent" is conveyed by hints (0 used = independent), not by mode
flags. Prerequisites stay displayed, never enforced.

**Deferred:** a learning-path engine with unlocks; enforced sequencing; adaptive
difficulty; per-learner next-exercise recommendation (a static ordered recommendation
is enough and cannot be gamed).

### G. Scenario learning content

**Phase 4 ships** an additive `Scenario` content enrichment for the 7 wired scenarios:
`conceptsPracticed: string[]`, `expectedOutcomes: string[]`,
`investigationFocus: string[]`, `reportFocus: string[]`, `skillArea: string`,
`difficulty: 'beginner' | 'intermediate' | 'advanced'` (carried on a shared
`HuntCurriculum` sourced from `src/shared/huntCurriculum.ts`, riding on the wired
`Scenario` entries and, additively, on `HuntSummary.curriculum` — rendered on the
scenario detail page and validated by content tests — ids still wired bidirectionally
with hunts). The reveal and hint content itself lives server-side (§5 A/B) because it
is unlocked progressively.

**Deferred:** per-concept micro-guides; auto-generated study plans; attaching the
reveal content into `guides` (guides are public reading; reveals are earned).

## 6. Milestone plan (exactly three: P4-M1 … P4-M3)

Sequential: **P4-M1 → P4-M2 → P4-M3.** Phase 4 contains **exactly three milestones; the
original eight milestones were consolidated, not removed.** Every original feature,
requirement, security rule, acceptance criterion and intended outcome is preserved in
one of the three — nothing was descoped, weakened, or dropped. Each milestone is
independently reviewable and testable, and internally organizes its work into numbered
**work packages** (WP1, WP2, WP3) which are **not** additional milestones — they may be
separate commits inside the milestone, but the milestone lands and is verified as one
reviewed unit before the next milestone starts. "Acceptance" means: existing suite
green, `npm run check` clean, production build passes, milestone-specific tests written,
browser verification for any UI milestone, `PROJECT_STATE.md` updated in the same turn.

Dependencies across the phase never go backwards: P4-M1 has no Phase 4 dependencies;
P4-M2 depends on P4-M1; P4-M3 depends on P4-M1 and P4-M2. Every requirement from the
original eight milestones fits into one of the three; where an original requirement sat
on a dependency boundary (e.g. the report write path used by the evaluator), it is
placed in the earlier milestone and cross-referenced. No additional milestones are
created.

### 6.1 Consolidation map (original eight milestones → three)

| Original milestone | Destination | Internal work package |
|---|---|---|
| P4-M1 — Scenario curriculum enrichment & hunt learning metadata | **P4-M1** | WP1 (content enrichment; no DB; additive optional curriculum on hunt-summary responses) |
| P4-M2 — Attempts & bug-report persistence | **P4-M1** | WP2 (migration `0010`, attempts/reports) |
| P4-M3 — Deterministic bug-report evaluation engine | **P4-M1** | WP3 (evaluator + rubric, §6.4) |
| P4-M4 — Progressive hints & defect reveal (backend) | **P4-M2** | WP1 (hints/reveals, unlock logic) |
| P4-M5 — Structured bug report UI & evaluation feedback | **P4-M2** | WP2 (report panel + evaluation view) |
| P4-M6 — Hints & reveal UI, attempt status | **P4-M2** | WP3 (HintLadder / RevealPanel / status chips) |
| P4-M7 — Learner progress (real `/progress`) | **P4-M3** | WP1 (aggregate API + rewritten page) |
| P4-M8 — Scoring transparency & Phase 4 exit audit | **P4-M3** | WP2 (rubric explainer + recommended path) + WP3 (exit audit) |

A requirement that appeared in more than one original milestone (e.g. "no defect ids in
any response") is enforced in **each** milestone whose surface it constrains — it is
never counted once and dropped elsewhere.

The original "minimum viable Phase 4" (P4-M1…P4-M6, the complete learner loop) now maps
to **P4-M1 + P4-M2**; the original "full scope" (P4-M1…P4-M8, adding real `/progress`,
scoring transparency and the release audit) now maps to **P4-M1 + P4-M2 + P4-M3**.

### P4-M1 — Learning Foundation, Attempts & Evaluation

Combines (and preserves every requirement, acceptance criterion and security rule of)
the original **P4-M1**, **P4-M2** and **P4-M3**.

> **2026-11-16 — WP1 implemented (deviation from the original "no API change" note, recorded):**
> WP1 shipped with an **additive, optional** `curriculum` block on the existing
> learner-safe hunt summary (`HuntSummary.curriculum`), exposed on
> `GET /api/v1/practice/hunts`, `POST …/start` (all response paths) and
> `GET /api/v1/practice/session`. `HuntSummary` is unchanged for any consumer that
> ignores the new field; existing response envelopes, behaviour, caps and the
> activation model are untouched; **no database migration was required for WP1**.
> Curriculum metadata is sourced from the shared, compiled module
> `src/shared/huntCurriculum.ts` (`HuntCurriculum`: `skillArea`, `difficulty`,
> `conceptsPracticed`, `expectedOutcomes`, `investigationFocus`, `reportFocus`) —
> the same object rides on the wired `Scenario` entries (`Scenario.curriculum`) and
> on the hunt summary; there is no second copy. The curriculum describes what to
> practise and how to investigate; it **never** exposes defect identifiers, defect
> solutions, finding-check terms, hint data or evaluator internals, and is
> unit/contract-tested for that. The original "WP1: zero API change" wording below
> is superseded by this note. All other Phase 4 requirements are unchanged.

> **2026-11-16 — WP2 implemented (this note records the as-built behaviour; it
> supersedes the sketch wording below where they differ):**
>
> **Migration location.** The migration landed as **`db/migrations/0010_hunt_attempts.sql`**
> (this repository's convention, per AGENTS.md / README / `tests/helpers/fake-d1.ts`),
> not the literal `migrations/` path used elsewhere in the original task brief. Content
> is unchanged in intent: additive only, `schema_version` 9 → 10, previous migrations
> untouched, verified on both a fresh database and a planted 0001–0009 → 0010 upgrade.
>
> **One-live-attempt enforcement.** The sketch below carried no uniqueness constraint.
> As built, migration 0010 adds a **partial unique index** —
> `idx_hunt_attempts_one_live` `ON hunt_attempts(practice_session_id, hunt_id)
> WHERE status = 'in_progress'` — so at most one live `in_progress` attempt exists per
> (practice session, hunt), enforced at the database layer. Attempt creation is
> therefore **idempotent under retries and concurrency**: an
> `INSERT … ON CONFLICT(practice_session_id, hunt_id) WHERE status = 'in_progress'
> DO NOTHING` followed by a re-read; two concurrent starts can never mint two live
> attempts and a legitimate retry is a no-op. The full index set shipped is
> `idx_hunt_attempts_session_hunt(practice_session_id, hunt_id, id)`,
> **`idx_hunt_attempts_one_live`** (unique, partial),
> `idx_hunt_attempts_customer(customer_id) WHERE customer_id IS NOT NULL`
> (signed-in history read) and `idx_bug_reports_attempt(attempt_id, id)`.
> Every free-text column carries a defense-in-depth length CHECK mirroring the
> application caps; `severity`/`priority`/`reproducibility`/`status` are enum-CHECKed;
> `hint_mask` is CHECKed 0–7; `best_quality_score` CHECKed 0–100 (nullable until WP3);
> `discovered` CHECKed 0/1. Foreign keys: `hunt_attempts.practice_session_id` →
> `practice_sessions(id)` **ON DELETE CASCADE** (attempts die with the session — the
> orders precedent), `hunt_attempts.customer_id` → `customers(id)` **ON DELETE SET
> NULL** (the attempt snapshot survives customer deletion), `bug_reports.attempt_id`
> → `hunt_attempts(id)` **ON DELETE CASCADE**. Deleting the practice session (7-day
> TTL / the maintenance sweep) cascades through both tables; the sweep itself needed
> no changes. The migration also bumps `app_meta.schema_version` to `10`.
>
> **Attempt lifecycle (`src/server/attempts.ts`).** Hunt start (all three entry
> paths in `practice.ts` — idempotent re-start, switch from clean/another hunt, and
> fresh-mint) now ensures exactly one live `in_progress` attempt for
> (session, hunt). Starting another hunt preserves prior attempts per hunt; an
> attempt already `submitted`/`revealed` is never reused — the next hunt start mints
> a fresh `in_progress` attempt and the completed one is preserved as history.
> Report submission attaches to the live `in_progress` attempt when one exists
> (the normal path), otherwise to the latest attempt for (session, hunt)
> (resubmission extends that attempt's history), otherwise creates one implicitly
> (an API client submitting without starting a hunt). Status transitions:
> `in_progress → submitted` on report; **`revealed` stays `revealed`** after a later
> report (giving up is never a completion); `submitted` stays `submitted`.
> `submitted_at` keeps only the first submission time. `customer_id` is stamped at
> **submit time** when the browser is signed in to an ACTIVE account (never at hunt
> start, never retroactively for guest rows, never adopted for suspended accounts).
> `best_quality_score` stays `NULL` in WP2; `discovered` is untouched in WP2; both
> are WP3's to stamp. Attempts are owner-scoped by the `mpl_session` cookie — the
> client never sends an attempt id; there is no cross-session or cross-customer read
> path; staff gains nothing.
>
> **Report persistence and validation (`src/server/reports.ts`).**
> `POST /api/v1/practice/hunts/:huntId/report` validates the hunt id against the
> registry (`400` malformed / `404 hunt_not_found`), consumes the `report:<iphash>`
> limit (see below) **before** the body is parsed, requires a live practice session
> (`401 session_required` otherwise), then validates the body in layers — type
> checks → control-character rejection → length caps → enum checks — with per-field
> `400` messages in the existing checkout style. Field rules: `title` and
> `environment` 1–200 single-line (trim; `\s+` collapses to one space);
> `preconditions` optional ≤ 1000 multi-line; `steps` 1–4000 multi-line; `expected`
> and `actual` 1–2000 multi-line; multi-line fields normalize CRLF/CR → LF, keep
> interior line structure and permit `\n`/`\t`; **every other C0/C1/DEL control
> character is rejected** (single-line fields additionally reject `\n`/`\t`).
> `severity` ∈ `critical|high|medium|low`, `priority` ∈ `p1|p2|p3|p4` (independent
> axes, never derived from each other), `reproducibility` ∈ `always|sometimes|once`
> (default `always`); enums match case-insensitively and are stored lowercase.
> Unknown body keys are ignored. The report insert and the attempt's submission
> stamp commit as **one all-or-nothing D1 batch** (report row + `in_progress →
> submitted` transition, `submitted_at`, `customer_id`) — a failure leaves neither.
> The response is `201 { attempt, report }`, learner-safe by construction: no
> attempt/report ids, no defect ids, no evaluator internals. Two read endpoints
> shipped alongside: `GET /api/v1/practice/hunts/:huntId/attempt` — 404-free;
> returns `{ status: 'none', … }` when the caller has no attempt (`404`/`400` only
> for forged/malformed hunt ids); and `GET /api/v1/practice/attempts` — bounded
> history (≤ 50, newest first) for the session, plus customer-bound attempts from
> the caller's other live sessions when signed in. Shared contracts live in
> `src/shared/learning.ts` (`AttemptView`, `AttemptHistoryEntry`, `BugReportView`,
> `ReportSubmissionResponse`; evaluation types present but absent/empty in WP2).
>
> **Rate limiting.** Submissions are capped by the dedicated scope
> **`report:<iphash>` — 30 requests per IP per minute** — added to the existing
> fixed-window limiter (`src/server/rateLimit.ts`, `REPORT_LIMIT = 30`), mirroring
> the checkout budget. It is consumed before body parsing (malformed churn is
> bounded too), answers `429 rate_limited` with `Retry-After` on overflow, stores
> only a SHA-256 hash of the IP (raw-IP buckets never match — asserted by test),
> is skipped entirely when no IP is visible (the existing local-development
> convention), and does not touch unrelated scopes (`checkout`, `login`, `mutate`).
> No second rate-limiting mechanism was introduced.
>
> **Temporary WP2 placeholders (explicitly).** Until WP3 lands, every stored
> report carries **`quality_score = 0`** and **`feedback = '[]'`**; the POST response
> echoes `report.qualityScore: 0` and `report.feedback: []`;
> **`hunt_attempts.best_quality_score` remains `NULL`**; **`discovered` is not
> awarded** (stays 0); and the response carries no `evaluation` key. These are
> deliberate WP2 placeholders and **WP3 replaces them with the deterministic
> rule-based evaluation inside the same request path / same D1 batch** (the WP2
> `quality_score=0`/empty-feedback placeholder is removed by WP3, not before).
>
> **Deviations and limitations (actual vs original plan, recorded):**
> 1. Migration file lives at `db/migrations/0010_hunt_attempts.sql` (repo
>    convention), not the task brief's literal `migrations/` path.
> 2. One-live-attempt uniqueness is an explicit partial unique index
>    (`idx_hunt_attempts_one_live`) — the plan's sketch had no uniqueness
>    constraint at all; the WP2 instruction was to follow the plan's uniqueness
>    and lifecycle rules, and index enforcement makes the one-live rule real at
>    the database layer.
> 3. Cookie-less report submissions return **`401 session_required`** — the plan
>    did not specify an ownership-failure response; this is the honest answer in
>    the existing error-envelope convention.
> 4. There is **no `409` conflict response** anywhere in the contract — the
>    approved report contract defines no conflict condition. Resubmission is
>    allowed by design (bounded by the 30/min limit) and attaches to the live or
>    latest attempt.
> 5. A **revealed attempt remains revealed** after later report submission
>    (conservative reading of "give-up is never submitted"); `submitted_at` is
>    still stamped and the report still persists.
> 6. True concurrent rate-limit testing was not possible with the synchronous
>    SQLite test harness; the boundary is covered serially (29/30/31 against a
>    seeded bucket) and scope isolation/raw-IP non-match are asserted. The
>    limiter's atomic upsert (`INSERT … ON CONFLICT … RETURNING`) is the actual
>    concurrency guard, unchanged from P3-M9.
> 7. Local development rate limiting follows the existing convention: when no IP
>    is visible, the report limiter is skipped (it is an abuse control, not an
>    authentication boundary); the 120/min global mutation backstop still applies.
> 8. Reports associate with their practice session transitively via
>    `bug_reports.attempt_id` → `hunt_attempts.practice_session_id` (as the
>    approved schema carries no direct session column on `bug_reports`); this is
>    how ownership and cascade are enforced.
> 9. Report submission without any prior hunt start implicitly opens an attempt
>    (the plan implies submit-time attempt creation; an explicit guest-robustness
>    choice, tested).
> 10. No UI ships in WP2 (evaluation results and attempt state are API-only,
>     rendered in P4-M2); no browser verification was performed for WP2.
>
> All other Phase 4 requirements are unchanged. The three-milestone structure is
> unchanged; WP3 remains the immediate next work package after WP2 is committed.

1. **ID/title:** P4-M1 — Learning Foundation, Attempts & Evaluation.
2. **Objective:** the platform can describe what a learner is practicing, persist
   their attempts and reports, determine finding status, and evaluate report quality
   using transparent deterministic rules. Concretely: scenario curriculum enrichment
   (no DB change; additive, optional learner-safe curriculum on hunt-summary
   responses), additive migration with attempt/report persistence, and the
   pure deterministic evaluator wired into the submit path.
3. **Scope (internal work packages, executed in order):**
   - **WP1 — Scenario curriculum enrichment & hunt learning metadata** (original
     P4-M1). Shared module `src/shared/huntCurriculum.ts`; no DB change; **additive,
     optional `HuntSummary.curriculum` on existing hunt-summary responses** (see the
     WP1 implementation note below).
   - **WP2 — Attempt & bug-report persistence** (original P4-M2). Additive migration,
     attempt lifecycle, report write path.
   - **WP3 — Deterministic bug-report evaluation engine & transparent rubric**
     (original P4-M3). Pure evaluator wired into the submit path.
4. **User-visible functionality:** scenario detail pages for the 7 wired hunts show
   "QA concepts practised", "Suggested investigation focus", "Expected learning
   outcomes" and "What a good report covers", plus a "Skill area" row in the scenario
   facts panel (all static copy from the shared curriculum module); difficulty and
   estimated effort already render. `/practice` shows the recommended order (static
   "Recommended path" list, no backend). No other UI ships in this milestone —
   evaluation results and attempts are API-only (rendered in P4-M2).
5. **Backend changes:**
   - WP1: none to the database. `src/shared/huntCurriculum.ts` (new, compiled shared
     module) is the single source of the learner-safe curriculum; `src/shared/practice.ts`
     `HuntSummary` gains optional `curriculum`; `src/server/practice.ts` attaches it to
     the hunts list, hunt start (all paths) and practice-session responses. Hunt
     registry untouched; **no defect ids, solution data, finding-check terms, hint
     data or evaluator internals are exposed**; envelopes and behaviour unchanged.
   - WP2: new `src/server/attempts.ts` (attempt lifecycle) and `src/server/reports.ts`
     (submission); `src/server/practice.ts` start handler extended to create/re-stamp
     an `in_progress` attempt on hunt start (additive, idempotent);
     `src/server/maintenance.ts` unchanged (attempts cascade with session; document).
     Scoped per-IP limit `report:<iphash>` (30/min) added to `rateLimit.ts` mirroring
     the checkout budget.
   - WP3: new pure module `src/server/reportQuality.ts`; wired into the
     `POST …/report` path from WP2 (evaluation now runs synchronously and is stored;
     the WP2 `quality_score=0`/empty-feedback placeholder is removed in the same
     milestone); `bug_reports.quality_score` and `feedback` populated for real;
     `hunt_attempts.best_quality_score`, `discovered`, `status` transition
     (`in_progress→submitted`) stamped in the same D1 batch as the insert. No network,
     clock or randomness in the evaluation path.
6. **Frontend changes:**
   - WP1: `src/data/types.ts` (`Scenario` gains optional `curriculum`, typed as the
     shared `HuntCurriculum`); `src/data/scenarios.ts` wired for the 7 wired entries
     only (the same shared object — no duplication) and exports
     `recommendedHuntScenarioIds`; `ScenarioDetailPage` renders the curriculum
     sections and the "Skill area" fact row (existing Test Bench components:
     `SectionHeader`, `FactList`, `check-list`/`plain-list` patterns); `/practice`
     renders the static "Recommended path"; placeholder scenarios render nothing new.
   - WP2/WP3: shared contract types only (`src/shared/learning.ts`).
7. **Database work:** WP1 — none. WP2 — one additive migration: `0010_hunt_attempts.sql`
   (`schema_version` → 10; **as built at `db/migrations/0010_hunt_attempts.sql`, with
   added defense-in-depth length CHECKs, the `idx_hunt_attempts_one_live` partial unique
   index and indexes `idx_hunt_attempts_customer` — see the WP2 implementation note
   above; this sketch is superseded where they differ**):
   ```sql
   CREATE TABLE hunt_attempts (
     id INTEGER PRIMARY KEY,
     hunt_id TEXT NOT NULL,                       -- compiled registry id, NOT a FK
     practice_session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
     customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
     status TEXT NOT NULL DEFAULT 'in_progress'
       CHECK (status IN ('in_progress','submitted','revealed')),
     hint_mask INTEGER NOT NULL DEFAULT 0 CHECK (hint_mask BETWEEN 0 AND 7),
     best_quality_score INTEGER CHECK (best_quality_score BETWEEN 0 AND 100),
     discovered INTEGER NOT NULL DEFAULT 0 CHECK (discovered IN (0,1)),
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
     updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
     submitted_at TEXT, revealed_at TEXT
   );
   CREATE INDEX idx_hunt_attempts_session_hunt ON hunt_attempts(practice_session_id, hunt_id, id);
   CREATE TABLE bug_reports (
     id INTEGER PRIMARY KEY,
     attempt_id INTEGER NOT NULL REFERENCES hunt_attempts(id) ON DELETE CASCADE,
     title TEXT NOT NULL, environment TEXT NOT NULL, preconditions TEXT, steps TEXT NOT NULL,
     expected TEXT NOT NULL, actual TEXT NOT NULL,
     severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
     priority TEXT NOT NULL CHECK (priority IN ('p1','p2','p3','p4')),
     reproducibility TEXT NOT NULL DEFAULT 'always'
       CHECK (reproducibility IN ('always','sometimes','once')),
     quality_score INTEGER NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
     feedback TEXT NOT NULL,                       -- JSON [{id,passed,message}]
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   );
   CREATE INDEX idx_bug_reports_attempt ON bug_reports(attempt_id, id);
   ```
   `hunt_id` deliberately not a FK (hunts are compiled code, mirroring
   `practice_sessions.hunt_id`). `hint_mask` bit 0/1/2 = levels 1/2/3. WP3 — none
   (0010 already carries the columns).
8. **API contracts** (`src/shared/learning.ts` new; all learner-safe, no defect ids):
   - `POST /api/v1/practice/hunts/:huntId/report` — body `{title, environment,
     preconditions?, steps, expected, actual, severity, priority, reproducibility}`;
     server validates (typed patterns, length caps, control-char rejection); creates or
     reuses the live `in_progress` attempt for (session, hunt); **in WP2 stores
     `quality_score=0`/empty feedback placeholder only — WP3 replaces this with real
     evaluation in the same request path**; returns `201 { attempt, report }` in WP2,
     and in WP3 `201 { attempt: {…}, report: {…}, evaluation: { score, verdict, checks: [{id, label, passed, message}] } }`.
     Re-submission appends a new `bug_reports` row; the attempt keeps its best score
     and its sticky `discovered` flag.
   - `GET /api/v1/practice/hunts/:huntId/attempt` — current attempt for (session, hunt):
     `{ status, hintsUsed, bestQualityScore, discovered, submittedAt }` (learner-safe;
     404-free — returns `{ status: 'none' }` shape when none).
   - `GET /api/v1/practice/attempts` — bounded history (≤50, newest first) across all
     hunts for this session (+ customer-bound attempts when signed in).
   - No reveal/hint endpoints yet. The hunt summary responses (hunts list, hunt
     start, practice session) carry the optional learner-safe `curriculum` block
     (additive since WP1); nothing else changed.
9. **Security considerations:**
   - Report text is learner data: synthetic by policy (no PII required; preconditions
     and steps should contain none). Stored tied to the session; cascade-deleted; never
     logged (no `console.log(report)`), never sent off-box, never used for training.
   - `report:<iphash>` 30/min scoped limit on submissions (churn control on a write
     path that stores text); hints and reveals fall under the 120/min backstop (see
     P4-M2). Limits are abuse controls, not security boundaries.
   - Forgery: hunt ids path-validated against the registry (existing pattern); attempt
     ids never accepted from the client (all resolution from the cookie session);
     severity/priority/reproducibility enum-checked server-side; length caps +
     control-char rejection (reuse the checkout notes rules).
   - Authorization: attempts/reports/progress are owner-scoped by `practice_session`
     (+ `customer_id` stamp). There is no cross-customer or admin read path in Phase 4.
     Staff role gains nothing here (deliberately — a staff debug view is a later,
     separately approved feature).
   - Feedback messages describe the report, never the fault location; the `finding`
     check is boolean with a generic message ("Identifies which behaviour is
     incorrect"); no check reads the defect id; no message names the fault location.
    - Finding-check term groups are server-side until reveal authorization; no
      expected terms, defect ids or answer patterns appear in any pre-unlock payload
      (list, session, attempt, report) or in the pre-unlock DOM — asserted by test.
   - Cascade ownership is the retention rule: guest progress dies with the practice
     session's 7-day TTL (orders precedent) — document in code, UI copy and the P4-M3
     exit audit; do not "fix" by decoupling from the session.
   - Evaluation is a pure function — no network/clock/randomness; free-tier CPU-safe.
10. **Testing requirements:**
    - WP1: extend `tests/data/content.test.ts` (curriculum completeness/shape per
      hunt; `curriculum.difficulty` mirrors the scenario; wired-only — placeholders
      carry none; no defect ids, titles or fix strings anywhere in curriculum copy;
      ids still bidirectional); `tests/server/hunt-set.test.ts` (exact response keys
      now `curriculum,id,scenarioId,summary,title`; curriculum shape per entry; no
      defect ids or evaluator internals in the payload); `tests/server/hunt.test.ts`
      (hunt start + practice session payloads carry curriculum); new
      `tests/pages/curriculum-views.test.tsx` (markup: curriculum sections on
      wired detail pages, nothing new on placeholders, "Recommended path" renders all
      seven in order); existing suites green. Both themes × 4 widths re-verified
      for the scenario detail page in the browser probe (dark + 768/1024 px spot
      checks are tracked as outstanding where not yet performed).
    - WP2: fake-D1 integration suite `tests/server/attempts.test.ts`: migration applies
      fresh **and** 0001–0009→0010 upgrade with planted session/cart/order; attempt
      created on hunt start (idempotent); report validation matrix (400s);
      session/customer isolation; guest vs signed-in stamping; cascade behaviour on
      session expiry; history bounded; forged hunt ids 404; report rate limit 429; no
      defect ids in any response.
    - WP3: unit suite `tests/server/report-quality.test.ts` — every check id: happy
      path, boundary, near-miss (expected≈actual normalization), placeholder junk
      ("aaaa", lorem, "test"), empty steps, unnumbered steps, invalid severity/priority
      enums, each hunt's finding-term group (positive + negative), score totals, verdict
      bands, stability (same input → same output), no defect ids in feedback messages.
      Finding-group coverage per hunt: positive match, negative (no group term),
      **synonym/equivalent-terminology match**, **normalization cases** (case,
      punctuation, whitespace variants) and **unrelated-keyword negatives** (a lone
      group word in an environment or unrelated field must not award the check or
      `discovered`). Integration: full submit→evaluate flow; best-score retention;
      discovered stickiness; evaluation inside the D1 batch (rollback leaves nothing).
    - Gates: 344-test baseline stayed green through WP1 (358 after WP1) plus the
      new suites; `npm run check` clean;
      production build passes; milestone-specific tests written before acceptance.
11. **Internal execution order & dependencies:** WP1 is independent (no DB migration;
    its only API impact is additive, optional `curriculum` on existing hunt-summary
    responses) and lands first — it pays for itself in every later content check and
    keeps UI builds from stalling on copy. WP2 must land before WP3: the evaluator
    stamps columns on rows WP2 creates, and the submit path belongs to WP2. WP3 depends
    on WP2 only. No dependency on P4-M2 or P4-M3 of this consolidation. (The original cross-milestone
    M2→M3 "placeholder" hand-off is now an internal WP2→WP3 ordering inside this
    milestone and never ships as a placeholder to a later milestone.)
12. **Out of scope / explicit non-goals:** server reveal/hint endpoints and any unlock
    logic; hint economy/points; the report form and all evaluation UI; the progress
    view; the rubric explainer page; new defects or hunts (the seven shipped in
    P3-M8 are the Phase 4 content base); account/identity work; score-based gating of
    any content.
13. **Acceptance criteria:** 7 wired scenarios carry complete curriculum metadata
    (`skillArea`, `difficulty`, `conceptsPracticed`, `expectedOutcomes`,
    `investigationFocus`, `reportFocus`) sourced from the shared module — no
    duplicated copy; difficulty mirrors the scenario; placeholders unchanged and still
    `runnable: false`; no defect ids in `src/data/`; hunt summary responses carry the
    optional learner-safe `curriculum` (hunts list, hunt start, practice session) with
    existing envelopes and behaviour compatible; scenario detail renders the new
    sections and the "Skill area" fact row without overflow at 375 px; `/practice`
    renders the static "Recommended path"; migration both paths green; endpoints
    integration-tested; attempts visible via API only;
    `schema_version` = 10; rubric exactly as §6.4; every check has a learner-facing
    message that references the *report*, never the fault location; evaluator is a pure
    function; no network/clock/randomness in the evaluation path; existing tests
    green; `npm run check` green.
14. **Risks/considerations:**
    - Content quality is the WP1 risk — each scenario needs a reviewer pass (write
      criteria that a learner can self-check against). Keep fields optional so the 21
      placeholders need no edits. Do not let acceptance criteria leak defect details
      (criteria describe *report quality*, not the fault).
    - Attempt creation on hunt start adds one write per start — negligible on free
      tier, and starts are already capped.
    - Cascade-delete means guest progress is ephemeral — document in code and UI copy,
      do not decouple from the session (the orders precedent).
    - JSON `feedback` column — keep it small (≤ 32 checks); it's learner-visible output,
      not telemetry.
    - Do not store IP, user agent or report text elsewhere.
    - `preconditions` stays optional (not every hunt has meaningful preconditions).
    - Finding-check gaming ("description" written anyway) — accepted and documented; it
      is a check that the learner identified *which behaviour* is broken, calibrated to
      be reachable honestly.
    - False negatives on valid reports — keep thresholds generous, message copy kind,
      resubmission free.
    - Feedback must never shame — tone review part of acceptance.
    - Evaluation adds negligible CPU (string ops) — free-tier safe.

#### 6.4 Rubric (specified in P4-M1; ships in the UI in P4-M3)

Field-weight checks (max 100):

| Check id | Points | Rule (deterministic) |
|---|---|---|
| `title-present` | 10 | Non-empty, trimmed, 10–120 chars, not a placeholder. |
| `environment-present` | 10 | Non-empty, ≥ 8 chars, names at least one of {browser, OS, device, build/version, practice-shop} — via small curated term list, case-insensitive. |
| `steps-present` | 15 | ≥ 2 discrete steps (split on newlines/numbered markers), ≥ 40 chars total. |
| `steps-quality` | 10 | Steps contain ≥ 1 action verb from a curated list (open, click, add, place, sign in, search, …) and ≥ 1 concrete token (a number, quoted string, or URL path). |
| `expected-present` | 8 | Non-empty, ≥ 12 chars. |
| `actual-present` | 8 | Non-empty, ≥ 12 chars. |
| `expected-actual-distinct` | 7 | Normalized expected ≠ actual (lowercased, whitespace/punct stripped); ≥ 60% token disjoint. |
| `severity-valid` | 5 | Enum `critical|high|medium|low` — impact-based scale (see "Severity and priority vocabularies" below). |
| `priority-valid` | 5 | Enum `p1|p2|p3|p4` — urgency, labelled `P1 — Urgent`, `P2 — High`, `P3 — Normal`, `P4 — Low` (see "Severity and priority vocabularies" below). Never derived from severity. |
| `finding` | 22 | Report (title + steps + expected + actual) contains ≥ 1 term from the hunt's curated, server-side finding group (e.g. hunt-catalogue-001: {description, search, term, …}; hunt-authz-001: {ownership, other account, another customer, not yours, reference, …}). Input is normalized consistently before matching; groups accept reasonable synonyms and equivalent terminology; an unrelated keyword mention alone never satisfies this check. |

#### Severity and priority vocabularies (maintained by the maintainer; controlled)

**Severity** measures **impact** on the practice application — what breaks and for whom —
and the reporter's severity selection should be guided in the UI by:

- **Critical** — blocks core functionality or data loss/corruption risk; no viable
  workaround; affects essentially all learners/users of the flow (e.g. cannot check out
  at all, order totals always wrong).
- **High** — significant functional breakage or wrong results on a common path; a
  workaround exists but is costly or unreliable.
- **Medium** — real functionality impaired but with limited impact or scope; a viable
  workaround exists; edge cases of a common flow.
- **Low** — cosmetic, copy, minor UI/layout or presentation issues with negligible
  functional impact.

**Priority** measures **urgency/ordering** — how soon the issue should be addressed in a
(simulated) tracker — and is labelled:

- **P1 — Urgent** — fix immediately / stop the line.
- **P2 — High** — fix in the current cycle.
- **P3 — Normal** — schedule as normal backlog.
- **P4 — Low** — fix opportunistically.

Severity (impact) and priority (urgency) are independent axes: **do not automatically
derive one from the other** — a cosmetic bug can be P1, and a Critical defect can be
P4. The evaluator validates each against its own enum only; it never cross-derives.

#### Finding-check term groups (maintainer-approved approach)

Term groups are **curated, server-side, per hunt** and:

- accept reasonable **synonyms and equivalent terminology** (groups are matched as
  term sets with synonym alternates, not as single exact strings — no brittle
  exact-string-only matching);
- match against **normalized input** (case-folded, punctuation stripped/collapsed,
  whitespace normalized; the same normalization pipeline used by every check in the
  evaluator, e.g. for `expected-actual-distinct`);
- stay **server-side until reveal authorization** — expected terms, defect ids and
  answer patterns are never sent to the client in any pre-unlock payload (list,
  session, attempt, report) and are never rendered in the pre-unlock DOM;
- remain **deterministic and unit-tested**: every group ships positive, negative,
  synonym and normalization cases in `tests/server/report-quality.test.ts`;
- award `finding` only when a group term appears in the **finding fields**
  (title + steps + expected + actual) treated together — unrelated keyword mentions
  elsewhere (e.g. an environment line) never award the check or the `discovered`
  flag; thin, pure-keyword junk without the behaviour context fails.

Verdict: score ≥ 80 → `solid`; 50–79 → `needs-work`; < 50 → `incomplete`.
**Discovered** = `finding` check passed (sticky). Completion = submitted regardless of
score. No check reads the defect id; no message names the fault location. All term lists
and synonym alternates ship in `src/server/reportQuality.ts` and are unit-tested — tuning
them is a code change with review, not a data edit.

### P4-M2 — Complete Bug-Hunt Learning Experience

Combines (and preserves every requirement, acceptance criterion and security rule of)
the original **P4-M4**, **P4-M5** and **P4-M6**.

1. **ID/title:** P4-M2 — Complete Bug-Hunt Learning Experience.
2. **Objective / expected outcome:** learners can independently investigate defects,
   submit meaningful reports, receive deterministic feedback, use hints, and learn from
   solutions — without any answer leakage. Three-level progressive hints;
   server-controlled solution reveal unlocked only after a submitted report or an
   explicit confirmed give-up (give-up counts as revealed, not discovered);
   compiled server-side reveal content; structured bug-report submission UI with
   expected and actual behaviour and reproduction steps; deterministic evaluation
   results with detailed rubric feedback; hint and reveal UI; attempt state and
   completion UI; accessibility, responsive design and error handling.
3. **Scope (internal work packages, executed in order):**
   - **WP1 — Hint ladder & gated reveal (backend)** (original P4-M4).
   - **WP2 — Bug report form, submission and evaluation feedback (UI)** (original
     P4-M5).
   - **WP3 — Hint ladder, reveal and attempt-status surfaces (UI)** (original P4-M6).
4. **User-visible functionality:**
   - WP1: none yet (rendered in WP2/WP3); unlock logic is real from this milestone.
   - WP2: on wired scenario pages and `/practice`, an "Report a bug" panel (replacing
     `BugReportExport` in place): labelled fields (title, environment, preconditions,
     steps textarea, expected, actual, severity select (`Critical|High|Medium|Low`,
     impact-based descriptions shown to the learner) + a separate priority select
     (`P1 — Urgent|P2 — High|P3 — Normal|P4 — Low`), reproducibility
     select); required-field marking; inline validation on blur + error summary with
     linked focus on submit (per `ui-ux-pro-max` form guidance); submit → evaluation
     result view: score, verdict tag, per-check checklist (passed/failed with
     messages), "revise & resubmit" and "download report (.md)" (local generation
     from the stored report — the old export survives as a convenience, now honest
     about being generated from a submitted report); attempt state
     (none/in_progress/submitted, best score) visible.
   - WP3: in the bug-hunt panel (both on scenario detail and `/practice`): "Need a
     hint?" disclosure — level buttons unlock sequentially, used levels display as
     read-only entries, hintsUsed counter shown (e.g. "1 of 3 hints used"); "Show the
     solution" behind a WAI-modal confirm (Cancel/Keep investigating vs Show
     solution); post-unlock reveal panel: expected behaviour, actual behaviour, root
     cause (learner level), reproduction steps, how to verify the fix, concepts,
     common misconceptions — clearly divided from the hunt area with a `Callout` and
     "This exercise is complete for you now" framing; attempt-status chip on hunt
     cards (Not started · In progress · Submitted (score) · Solution viewed);
     clean-mode hunt still open to start/reset as before.
5. **Backend changes:**
   - WP1: new `src/server/hints.ts` + `src/server/reveals.ts` (compiled registries —
     content per §5 A/B; 7 hints × 3 levels, 7 reveals, authored in this milestone);
     `src/server/learning.ts` routes: `POST /api/v1/practice/hunts/:huntId/hints
     {level}` (level 1–3; requires prior levels used — 409 `hint_level_locked`;
     idempotent per level via `hint_mask`; returns `{ level, hint, hintsUsed }`);
     `GET /api/v1/practice/hunts/:huntId/reveal` (403 `reveal_locked` until attempt
     `status='submitted'` or `'revealed'`; otherwise the reveal payload);
     `POST /api/v1/practice/hunts/:huntId/reveal` (explicit confirmed unlock — sets
     `revealed`, stamps `revealed_at`; body ignored beyond confirm flag). Responses
     carry **no defect ids** anywhere.
   - WP2/WP3: none (WP2/WP3 consume P4-M1 and WP1 endpoints). Small: `practice/api.ts`
     gains typed clients (`submitReport`, `fetchAttempt`; hint/reveal clients as the
     panels consume them).
6. **Frontend changes:**
   - WP2: `src/features/practice/BugReportForm.tsx` (new, replacing the internals of
     `BugReportExport.tsx` — the download button is retained); evaluation panel
     component; error summary + field-level errors; focus management to the summary on
     failed submit (skill-verified); all new strings honest about evaluation being
     rule-based, not AI. Old placeholder copy removed ("The practice lab does not
     grade or read it") — replaced by accurate copy ("Evaluated locally by
     deterministic rules — no AI, nothing leaves your session").
   - WP3: `src/features/practice/HintLadder.tsx`, `RevealPanel.tsx`,
     `AttemptStatusChip.tsx`; `HuntPanel.tsx`, `HuntLaunchPanel.tsx`,
     `PracticePage.tsx` integration; focus moves to the revealed panel heading on
     unlock (and back on close); `prefers-reduced-motion` honoured; clean-mode hunt
     start/reset unchanged.
7. **Database changes:** none (0010's `hint_mask`, `status='revealed'`, `revealed_at`
   carry WP1).
8. **API contracts:**
   - `POST …/hints {level}` → `200 { level, hint: string, hintsUsed: 0–3 }` ·
     `400 invalid_level` · `409 hint_level_locked` · `404 hunt_not_found`.
   - `GET …/reveal` → `200 { huntId, title, expected, actual, rootCause, reproduction[],
     verification[], concepts[], commonMisconceptions[] }` · `403 reveal_locked
     { message }` · `404 hunt_not_found`.
   - `POST …/reveal` → `200 <same payload>` (idempotent) — the one explicit "I give up"
      path; never implicit.
   - Report and attempt endpoints from P4-M1 are consumed unchanged (evaluation
     payload included); no new report/attempt or progress endpoints in this milestone.
9. **Security considerations:**
   - Reveal gating is server-side only. Tests assert absence from list/session/hunt
     payloads pre-unlock and presence only post-unlock. The UI never hides content it
     shouldn't show; the API never sends it pre-unlock.
   - Give-up counts as `revealed`, never `submitted`, never `discovered`;
     `POST /reveal` is the designed give-up path — always available with an explicit
     confirmed flag; it is not a completion and never flips `discovered`.
   - No defect ids anywhere in responses or in the pre-unlock DOM; reveal text must
     not cite file paths or defect ids (it describes behaviour, not code).
   - Hint/reveal registries are compiled code — learners cannot inject content; output
     served read-only; `Cache-Control: no-store` already applied globally.
   - Forgery: reveal POST takes a confirm boolean only; hint level is enum/range
     checked server-side; level ordering is enforced server-side (level N requires
     level N−1 already used), not just visually; attempt ids never accepted from the
     client (resolution from the cookie session); severity/priority/reproducibility
     enum-checked server-side; length caps + control-char rejection (reuse the
     checkout notes rules).
   - Authorization: attempts/reports/hints/reveals are owner-scoped by
     `practice_session` (+ `customer_id` stamp) — same rule as P4-M1; no cross-customer
     or admin read path; staff role gains nothing here.
   - The reveal panel is sensitive content — the server-gate is the real boundary, the
     UI is convenience; never cache the reveal payload in localStorage; confirm dialog
     copy reviewed to avoid shaming; status chip wording neutral ("Solution viewed",
     not "Failed").
   - Rate limiting: hints and reveals fall under the 120/min per-IP backstop; the
     `report:<iphash>` 30/min limit (P4-M1) covers report churn; limits are abuse
     controls, not security boundaries — unchanged posture.
10. **Testing requirements:**
    - WP1: `tests/server/hints-reveal.test.ts` — hint mask idempotence (double-request
      counts once); level ordering enforced; hint content never contains its own
      level's answer (content lint: assert hint level 3 strings ∉ reveal strings —
      build-time content test); reveal 403 pre-submit; 200 post-submit; POST unlock
      path works with zero reports filed and flags `revealed`, never `submitted`;
      reveal payload has no defect ids; learning content for all 7 hunts present
      (content test).
    - WP2: component/SSR-markup tests (`tests/practice/bug-report-form.test.tsx`);
      client tests with stubbed fetch; manual keyboard pass (Tab order, summary focus,
      select labels); both themes × 375/768/1024/1440; reduced-motion respected (no
      new animation beyond existing transitions); browser probe: submit junk →
      incomplete verdict; submit complete → solid verdict; resubmit keeps best.
    - WP3: markup tests for locked/unlocked states (no reveal content in pre-unlock
      DOM — hard assertion); confirm dialog keyboard + focus trap behaviour (manual +
      markup assertion for roles); hint ordering UI test; browser probe both themes ×
      widths; reduced-motion check; zero defect ids in rendered HTML pre/post unlock
      until the reveal panel is legitimately open (post-unlock it shows concepts,
      never ids either).
    - Gates: full suite green, `npm run check` clean, production build passes; browser
      probe for the UI packages mandatory.
11. **Internal execution order & dependencies:** WP1 depends on P4-M1 (attempt rows,
    `hint_mask`, and the submit path that sets `status='submitted'` — reveal unlock
    depends on it). WP2 depends on P4-M1 endpoints, on P4-M1 WP1 page copy, and must
    leave layout room in the hunt panel for WP3's hint/reveal controls. WP3 depends on
    WP1 (endpoints it consumes) and WP2 (the shared panel layout). Build in this order
    so the UI never ships against missing endpoints.
12. **Explicit non-goals / out of scope:** progress page aggregation (P4-M3); rubric
    explainer page (P4-M3); hint telemetry / per-hint "was this helpful?";
    adaptive hint selection; hint economy/points; hints for non-hunt scenarios;
    per-user hint budgets beyond the 3-level ladder; reveal before any interaction of
    any kind (POST is always allowed — it is the confirmed give-up path); file
    attachments; rich-text editors; animated walkthroughs; hint analytics; any ML/LLM
    comparison in feedback.
13. **Acceptance criteria:**
    - Report submits end-to-end; evaluation renders; resubmission works and best
      score sticks; download works offline; zero console errors; both themes;
      `npm run check` green; old placeholder copy removed and replaced by accurate
      rule-based copy.
    - Zero paths serve reveal content before unlock (asserted); pre-unlock DOM
      contains zero reveal strings (asserted in test); hint ladder enforces order
      visually and via the API; counters exact; registries compile with exactly 7
      keys each; `hint_mask` idempotent; reveal only after submit or confirmed
      give-up; give-up flags `revealed`, never `submitted`; no defect id appears in
      any new response (grep test); browser probe passes.
14. **Risks/considerations:**
    - Hint/reveal content is the highest-craft item in Phase 4 — budget real
      authoring time; each hint must survive the "would a thoughtful senior QA hint
      this?" review; accidental near-verbatim overlap hint↔reveal — content lint +
      human review.
    - Learner submits junk to unlock reveal quickly — accepted (it is the designed
      unlock; the report still gets evaluated honestly).
    - Reveal text must not cite file paths or defect ids (it describes behaviour,
      not code).
    - Form size on small screens (single column, 48px rows); error-summary focus must
      not scroll-jack; select menus need visible labels (no placeholder-only); the
      32 KB body cap is comfortable for reports.
    - Confirm dialog copy reviewed to avoid shaming; status chip wording neutral.
    - If this milestone overflows a session, the internal work packages are the seam:
      WP1 (backend) may land separately from WP2/WP3 (UI) — but the milestone is not
      complete, and P4-M3 does not start, until all three work packages are done and
      verified together in one reviewed milestone.

### P4-M3 — Progress, Scoring & Phase 4 Release

Combines (and preserves every requirement, acceptance criterion and security rule of)
the original **P4-M7** and **P4-M8**.

1. **ID/title:** P4-M3 — Progress, Scoring & Phase 4 Release.
2. **Objective / expected outcome:** the platform presents trustworthy learner
   progress, explains how scores are computed, recommends the next practice, and
   passes a complete Phase 4 release audit.
3. **Scope (internal work packages, executed in order):**
   - **WP1 — Learner progress: aggregate API & the real `/progress`** (original
     P4-M7).
   - **WP2 — Scoring transparency & recommended completion path** (original P4-M8,
     first half).
   - **WP3 — Phase 4 exit audit & release verification** (original P4-M8, second
     half).
4. **User-visible functionality:**
   - WP1: `/progress` shows: seven wired hunts with status (Not started / In progress
     / Submitted / Solution viewed), best score, hints used, last submission date;
     headline stats (exercises submitted, discovered, total hints used, average best
     score — only over completed attempts); recent submissions list (score, verdict,
     date); guest vs signed-in durability banner stating that guest progress is
     temporary, tied to this device's practice session, expires when it expires, and
     never transfers to a signed-in account; honest empty state for fresh
     sessions with a link to the first recommended hunt; the old demo sections
     removed from this page (dashboard demo stays, still labelled).
   - WP2: "How this exercise is evaluated" section on wired scenario pages (or a
     linked `/about#evaluation` block) listing the §6.4 checks with point weights and
     the no-speed/no-AI/no-comparison statement; `/practice` ordered "Recommended
     path" list (static, data-driven from scenarios) with per-step outcome lines;
     honest notes on durability (7-day session) linked from `/about`; `AboutPage`
     gains the transparency section; `PracticePage` recommended path refined (from
     P4-M1's static list, now with outcome lines and completion state from WP1).
   - WP3: no new visible UI (audit + release checks only).
5. **Backend work:** WP1 — new `GET /api/v1/practice/progress`: aggregate for the
   caller — session-scoped attempts + (when signed in) customer-bound attempts,
   deduped by id; bounded (7 hunts × attempts ≤ 50 rows); response learner-safe.
   WP2 — none. WP3 — none.
6. **Frontend work:** WP1 — `src/pages/ProgressPage.tsx` rewritten around the new
   endpoint; `src/data/demo.ts` unchanged (dashboard still uses it); skeleton/error/
   retry states; `useDocumentTitle('Progress')`; empty state per above. WP2 — small
   content components; `AboutPage` gains the transparency section; `PracticePage`
   recommended path refined (outcome lines + completion state). WP3 — none.
7. **Database work:** none (reads only). Optional index already exists (0010).
8. **API contracts:** `GET /api/v1/practice/progress` →
   `200 { persistence: 'session'|'customer', hunts: [{ huntId, scenarioId, title, status, bestScore, hintsUsed, lastSubmittedAt }], recent: [{ attemptId, huntId, title, score, verdict, createdAt }], totals: { submitted, discovered, hintsUsed, averageBestScore } }`.
   No other endpoints change; `GET /api/v1/practice/hunts` unchanged. Error envelopes
   stay `{ error, message }`; `Cache-Control: no-store`; 32 KB body cap applies.
9. **Security considerations:**
   - Authorization: progress is owner-scoped by `practice_session` (+ `customer_id`
     stamp) — the same rule as attempts/reports. There is no cross-customer or admin
     read path in Phase 4; staff role gains nothing here.
   - Ownership & durability: attempts/reports stay scoped to the practice session
     (7-day TTL), `customer_id` stamped while the binding lives; never copied to a
     profile table, never shared, never exported off-box. Guest progress remains
     honestly ephemeral — the UI says so wherever progress is shown.
   - Averages over ≥ 1 attempt only; never render "0% complete" as failure; empty
     states are neutral; recent submissions show only the caller's own rows.
   - The exit audit re-verifies the Phase 3 audit's §4 (security/authz) and §8 (rate
     limits) controls, reveal gating (absence pre-unlock, presence post-unlock),
     report data handling and logging, and that the maintenance sweep does not touch
     attempt/report rows (they die by cascade) — asserted explicitly.
   - Regression guards: existing shipped controls must remain green — hunt activation
     isolation, reset non-destructiveness (cart/orders/sign-in preserved), no defect
     ids in any response, rate-limit behaviour, 32 KB body cap. Each Phase 4
     milestone runs the full suite; this milestone's audit is the final gate.
10. **Testing requirements:**
    - WP1: integration (`tests/server/progress.test.ts`): empty state; mixed
      statuses; guest vs signed-in visibility; cross-session invisibility; customer
      sees own bound attempts; bounded rows; page markup tests (states); browser
      probe; both themes × widths.
    - WP2: content tests (path ids valid, ordered, wired); markup tests.
    - WP3: full browser probe (P4-M2 surfaces together with `/progress`); exit-audit
      doc `docs/phase-4-exit-audit.md` mirroring the Phase 3 audit structure:
      milestones and commits, schema 10, capabilities, security/privacy review
      (reveal gating, report data handling, logging), retention (attempts die with
      session — verify the sweep and cascade explicitly), tests/build/browser
     results, known limitations, deployed schema-version note, deployment verification
      and rollback considerations per §7.5, exit-criteria verdict.
    - Gates: `npm run check` green; production build passes; both themes × 4 widths
      verified for every touched surface; zero defect ids in any client-reachable
      response or DOM pre-unlock.
11. **Internal execution order & dependencies:** WP1 depends on P4-M1 (attempts,
    scores/verdicts) and P4-M2 (status vocabulary; hunt definitions for titles and
    the recommended path). WP2 depends on WP1 (completion state feeds the recommended
    path) and on P4-M1 (the rubric it publishes). WP3 depends on everything — it
    audits the whole phase and is written and verified last.
12. **Explicit non-goals / out of scope:** deployment (a user decision, as with
    Phase 3); new features; performance tuning beyond free-tier checks; cross-device
    accounts; charts/graphs beyond simple bars (tokens already have `ProgressBar`);
    export/transcript; streaks; per-track rollups of non-runnable scenarios (would
    fake data); marketing-style completion claims.
13. **Acceptance criteria:** fresh session shows the empty state, not fake numbers;
    signed-in customer sees bound attempts; guest sees session attempts with the
    7-day note; all numbers derive from rows (spot-check by SQL); both themes;
    `npm run check` green; rubric visible in product; the recommended path renders
    ordered, wired and data-driven with outcome lines and completion state;
    `docs/phase-4-exit-audit.md` exists, is committed, and records schema 10,
    capabilities, security & privacy review, retention behaviour, tests/build/browser
    results, known limitations, an explicit deployed/not-deployed statement,
    deployment verification and rollback considerations per §7.5, and an
    exit-criteria verdict in §13; exit criteria in §13 met.
14. **Risks/considerations:**
    - Mixing session and customer attempts risks confusing UI — dedupe by attempt id
      and label the source subtly; averages over ≥ 1 attempt only; never render "0%
      complete" as failure — empty states are neutral.
    - The rubric will invite debate — present it as "transparent and tunable by
      maintainers", list it in the audit as a living document; do not soften wording
      to evade criticism.
    - `demo.ts` must remain labelled and confined to the dashboard; `/progress` must
      not show sample data once real data exists on the page.
    - The audit is the release gate: if any Phase 3 control regressed, the phase is
      not complete — re-run the Phase 3 exit-audit checks, do not assume they hold.

### 6.5 Milestone dependency graph

```text
P4-M1 (learning foundation, attempts & evaluation)
     internal: WP1 content enrichment → WP2 migration + attempts/reports → WP3 evaluator + rubric
        │
        ▼
P4-M2 (complete bug-hunt learning experience)
     internal: WP1 hints/reveal backend → WP2 bug-report panel + evaluation view → WP3 hint/reveal UI
        │
        ▼
P4-M3 (progress, scoring & phase 4 release)
     internal: WP1 /progress aggregate → WP2 rubric explainer + recommended path → WP3 exit audit
```

Cross-phase order is strictly **P4-M1 → P4-M2 → P4-M3**; no requirement reaches back
across a phase boundary. Within P4-M1, WP1 is independent (content + the additive
optional `curriculum` on hunt-summary responses; no DB migration) and lands first —
it pays for itself in every later content check and keeps UI builds from stalling on
copy. The original M1…M8 chain is preserved exactly: the old M1 is new
P4-M1 WP1, old M2→M3 is new P4-M1 WP2→WP3 (hard chain), old M4→M5→M6 is new P4-M2
WP1→WP2→WP3, and old M7→M8 is new P4-M3 WP1→WP2→WP3. Old M7 depended on M2+M3+M6 —
that maps to P4-M3 depending on P4-M1 (M2/M3/M6's data) and P4-M2 (M6's status
vocabulary). Old M8 depended on all — P4-M3 WP3 depends on all.

## 7. API and database considerations

### 7.1 Endpoint summary (Phase 4 adds)

| Endpoint | Milestone | Type | Notes |
|---|---|---|---|
| `POST /api/v1/practice/hunts/:huntId/report` | P4-M1 (WP2 storage → WP3 evaluation) | Write, `report:<iphash>` 30/min + 120/min backstop | As built (WP2): `201 { attempt, report }` with placeholder `qualityScore: 0`/empty feedback; `401 session_required` without a live session; no `409` (no conflict condition in the contract). Returns evaluation since WP3. |
| `GET /api/v1/practice/hunts/:huntId/attempt` | P4-M1 (WP2) | Read | As built: 404-free learner-safe attempt state (`{ status: 'none', … }` shape when none exists); `400`/`404` only for malformed/unknown hunt ids. |
| `GET /api/v1/practice/attempts` | P4-M1 (WP2) | Read | As built: ≤50 rows, newest first; session-scoped plus customer-bound when signed in. |
| `GET /api/v1/practice/progress` | P4-M3 (WP1) | Read | Aggregate; session + bound customer rows. |
| `POST /api/v1/practice/hunts/:huntId/hints` | P4-M2 (WP1) | Write (mask) + backstop | Idempotent per level; 409 on skipping levels. |
| `GET /api/v1/practice/hunts/:huntId/reveal` | P4-M2 (WP1) | Read (gated) | 403 `reveal_locked` until submitted/revealed. |
| `POST /api/v1/practice/hunts/:huntId/reveal` | P4-M2 (WP1) | Write | Explicit confirmed give-up; idempotent. |

Unchanged: hunts list, session, start, reset — **no endpoint ever accepts a defect id**,
and none of the new payloads contain one. Error envelopes stay `{ error, message }`.
Hunt summary responses (`hunts` list, `start`, `session`) additionally carry an
**optional, learner-safe `curriculum` block** (additive since WP1, sourced from
`src/shared/huntCurriculum.ts`); it is additive-only — absent for no consumer, ignoreable
by any consumer, and carries no defect ids, finding-check terms or evaluator internals.

### 7.2 Database

One additive migration: **`db/migrations/0010_hunt_attempts.sql`** (repo convention;
two tables, **four indexes** — including the partial unique index
`idx_hunt_attempts_one_live` enforcing one live attempt per (session, hunt) — and
`schema_version` → 10). Migration contents as built: `hunt_attempts` (nullable
`best_quality_score` CHECK 0–100, `hint_mask` CHECK 0–7, `discovered` CHECK 0/1,
status enum CHECK, `hunt_id` length CHECK 1–64) and `bug_reports` (length CHECKs on
every free-text column, severity/priority/reproducibility enum CHECKs,
`quality_score` CHECK 0–100), both carrying defense-in-depth CHECKs mirroring the
application caps. No rewrites, no backfills; `hunt_id` is intentionally not a FK
(compiled registry, same rule as `practice_sessions.hunt_id`); FK cascades:
`hunt_attempts` → `practice_sessions` CASCADE (guest data dies loudly and honestly),
`customer_id` SET NULL; `bug_reports` → `hunt_attempts` CASCADE. Maintenance sweep
needs **no changes** (nothing is shared or unbounded beyond session lifetime); the
`inventory_adjustments`/`order_cancellations` precedent applies — attempt/report rows
are deleted by cascade, not by sweep, and the sweep doc/test should assert this
explicitly in P4-M3's exit audit. (The cascade is already covered by the WP2 suite,
`tests/server/attempts.test.ts`, "cascades attempts and reports with their practice
session".)

### 7.3 Ownership & persistence model

- **Guest:** attempts/reports scoped to `practice_session` (7-day TTL). Deleting cookies
  or waiting out the TTL erases them. The UI says so plainly and must state that the
  progress is temporary, tied to the practice session, and never transfers to a
  signed-in account.
- **Signed-in (synthetic):** same rows, `customer_id` stamped while the binding lives;
  visible on `/progress` alongside session rows with silent dedupe. Still bounded by the
  practice session's TTL (the binding does not outlive it) — documented, not disguised.
  Attribution applies from sign-in onwards; earlier guest progress is never absorbed.
- **Never** copied to a profile table, never shared, never exported off-box.

### 7.4 Free-tier impact

Per submit: 1 read (attempt) + 1 batch (report insert + attempt update) ≈ 3 D1
statements; per hint: 1 update; per reveal GET post-unlock: 1 read; progress: 2 bounded
reads. Storage: 7 hunts × (1 attempt + N reports ≤ 50) per session — negligible against
5 GB. No new cron, queue or Worker. Backstop limits already in place; `report:<iphash>`
30/min added in P4-M1.

### 7.5 Deployment and release (manual workflow retained)

Phase 4 ships behind the **existing manual Cloudflare deployment workflow** — the same
pattern used for Phase 3. Specifically:

- **No new Cloudflare products, infrastructure, cron, queues or paid services.** Pages
  (static `dist/` + Pages Functions) and the existing D1 binding (`DB`) are unchanged.
- **Release sequence (maintainer, explicit approval only):** `npm run check && npm run
  build && npx wrangler pages deploy dist`, with remote migration `0010_hunt_attempts.sql`
  applied first via the established remote-migration procedure (`schema_version` → 10).
- **Deployment verification (recorded in the exit audit):** after deploy, `/api/health`
  reports `schema_version: 10`; smoke-test the bug-hunt journey end to end against the
  production site (start hunt → investigate → hint → submit report → evaluation renders
  → reveal gated correctly → `/progress` renders); confirm both themes and reduced
  motion on the new surfaces; confirm no defect ids in pre-unlock responses.
- **Rollback considerations (recorded in the exit audit):** Pages deployments are
  additive and reversible by redeploying the previous known-good `dist/` (previous
  commit), which needs no data migration. Migration `0010` is additive-only (two new
  tables, two indexes, `app_meta.schema_version` bump) — rolling the code back does not
  strand or corrupt data; the new tables simply sit unused. The audit must therefore
  state explicitly: no destructive schema change exists in Phase 4; rollback = redeploy
  the prior commit; if a data-level rollback were ever required, only rows in the new
  Phase 4 tables would be affected, and dropping them would not impact Phase 3 surfaces.
- **Not deployment scope:** no automatic/CI deployment, no preview deploys for learners,
  no scheduler for maintenance (the sweep stays operator-invoked). Phase 4 is **not
  deployed** as a result of implementation milestones — deployment is a separate,
  explicitly approved step recorded in the exit audit.

## 8. Security and privacy considerations

1. **Reveal gating is server-side only.** Tests assert absence from list/session/hunt
   payloads pre-unlock and presence only post-unlock. The UI never hides content it
   shouldn't show; the API never sends it.
2. **Report text is learner data.** Synthetic by policy (no PII required; preconditions
   and steps should contain none). Stored tied to the session; cascade-deleted; never
   logged (no `console.log(report)`), never sent off-box, never used for training.
3. **Feedback messages** describe the report, not the product's fault location; finding
   check is boolean, message generic ("Identifies which behaviour is incorrect").
4. **Hint/reveal registries are compiled code** — learners cannot inject content; output
   served read-only; `Cache-Control: no-store` already applied globally.
5. **Forgery:** hunt ids path-validated against the registry (existing pattern); attempt
   ids never accepted from the client (all resolution from the cookie session); reveal
   POST takes a confirm boolean only; severity/priority/reproducibility are enum-checked
   server-side; length caps + control-char rejection (reuse the checkout notes rules).
6. **Rate limiting:** report submissions get `report:<iphash>` 30/min (churn control on a
   write path that stores text); hints and reveals fall under the 120/min backstop; the
   hunt-start cap is untouched. Limits are abuse controls, not security boundaries —
   unchanged posture.
7. **Authorization:** attempts/reports/progress are owner-scoped by `practice_session`
   (+ `customer_id` stamp). There is no cross-customer or admin read path in Phase 4.
   Staff role gains nothing here (deliberately — a staff debug view is a later, separately
   approved feature).
8. **Privacy:** no new personal data collected; no fingerprinting; the IP hash remains
   the only network-derived value stored and stays scoped to existing tables; retention
   unchanged (rows die with the session ≤ 7 days).
9. **Honesty requirements:** reveal/banners must not overclaim; `/progress` guest note
   required by acceptance and must state progress is temporary, expires with the
   practice session, and never transfers to a signed-in account; evaluation described
   as rule-based.
10. **Regression guards:** existing shipped controls must remain green — hunt activation
    isolation, reset non-destructiveness (cart/orders/sign-in preserved), no defect ids
    in any response, rate-limit behaviour, 32 KB body cap. Each Phase 4 milestone runs
    the full suite; P4-M3's exit audit re-verifies the Phase 3 audit's §4 (security/authz) and §8 (rate limits) controls.

## 9. UX and design requirements

Extend **The Test Bench** (tokens in `src/styles/tokens.css`; components in
`src/components/ui/`); do not introduce new visual language, new fonts, new elevation,
or motion beyond existing transitions (`prefers-reduced-motion` honoured — it already is).

- **Light-first, dark workspace.** Any new panel/chip/form must be specified against
  both themes; contrast ≥ 4.5:1 body text, ≥ 3:1 large/UI non-text; focus-visible rings
  on every new interactive element.
- **Layout:** single-column form on ≤ 768 px; the bug-report panel is a `.stack` of
  `.panel`s; no new grid systems; hairline dividers between checklist items; hints and
  reveal live in the same hunt panel region — disclosure, not a new route.
- **Typography:** IBM Plex Sans for prose/UI; JetBrains Mono for ids, scores, counts
  (consistent with existing `.mono` usage); one `h1` per page preserved; headings
  balanced (`text-wrap: balance` is already a token-level concern, not ours).
- **Forms:** visible `<label for>` on every field; placeholder is hint, never label;
  blur inline validation; error summary on submit with focus target (WCAG 3.3.1/3.3.3
  handling via the patterns from the skill: confirm state, loading → success/error);
  errors stay visible until fixed; `aria-describedby` links fields to their messages;
  selects carry visible labels.
- **Feedback surfaces:** evaluation checklist rows use the existing `Callout`/`Tag`
  vocabulary (pass = `ok`/check icon, fail = `warn`/alert icon) — never colour-only
  (icon + text always paired); score rendered in mono with the verdict tag beside it.
- **Progressive disclosure:** hint levels as sequential disclosure buttons (expanded
  level remains readable while later ones unlock); reveal behind a modal confirm
  (`role="dialog"`, focus trap, labelled by its heading, Esc cancels, Cancel keeps
  investigation) — reuse `SlideIn`/drawer patterns already in the shell; confirm copy
  names the consequence honestly.
- **Progress page:** `StatTile` + `ProgressBar` + table-like rows mirroring the tracks
  page idiom; empty states are neutral, never "failure" coloured; sample/demo surfaces
  must not coexist with real data on the same page after P4-M3.
- **Copy tone:** precise, neutral, second person; no cartoonish grading ("Amazing!"),
  no shaming ("Wrong!"). Verdict wording fixed in §6.4.
- **Icons:** existing inline `Icon` set only (no new icon package — M9-style decision
  recorded per AGENTS.md); new glyphs only if unavoidable, then via the existing set.
- **Responsive verification matrix** for every UI milestone: 375 / 768 / 1024 / 1440 px
  × both themes × keyboard-only walkthrough; zero horizontal overflow; one `h1`.

## 10. Testing strategy

| Layer | Where | What |
|---|---|---|
| Unit (pure) | `tests/server/report-quality.test.ts` | Rubric: every check id, boundaries, verdicts, stickiness, stability, no-id-leakage lint. |
| Content | `tests/data/content.test.ts` (extended) | Wired-scenario curriculum complete & well-formed (per hunt), difficulty mirrors scenario, severity/priority/reproducibility constants shared; no defect ids in client data; hunt↔scenario↔concepts integrity; recommended path wiring/order. |
| Integration (fake-D1) | `tests/server/attempts.test.ts`, `hints-reveal.test.ts`, `progress.test.ts` | Migration fresh + upgrade path; attempt lifecycle; isolation (guest/customer/cross-session); hint mask idempotence; reveal lock/unlock; report rate limit; cascade on session expiry; sweep untouched. |
| API contract | reuse `hunt-set.test.ts` patterns | Responses carry no defect ids; envelopes; 32 KB cap; `Retry-After` on 429. |
| Client | `tests/practice/*` + `tests/lib/*` | Typed API clients (stubbed fetch), form validation, error summary focus, evaluation rendering, status chips. |
| Browser probe | per UI milestone | Playwright/Chrome vs production build on a scratch port: full journey end-to-end (start → investigate → 1 hint → junk report → resubmit → reveal → progress), both themes × 4 widths, reduced-motion, zero console errors. |
| Gates | every milestone | `npm run check` (lint → typecheck → test), `npm run build`; 344 baseline must stay green (358 after WP1) plus new tests. |

Exit-audit quality bar for P4-M3 mirrors the Phase 3 audit: both migration paths,
browser probe, and explicit re-verification of the reveal gate.

## 11. Risks and dependencies

### 11.1 Risks (and mitigations)

1. **Hint/reveal content quality** — the learning value lives or dies here. Mitigation:
   smallest curated inventory (7 hunts), senior-review checklist per hint/reveal,
   content lint tests, P4-M3 exit-audit sign-off.
2. **Evaluator gaming / false confidence** — finding-check term leakage or junk reports
   scoring well. Mitigation: honest copy about rules; generous-but-meaningful rubric;
   no score-based gating anywhere; resubmission allowed freely.
3. **Scope creep into AI grading, scoring leagues, classrooms** — explicitly out
   (§3.2); park them in §12 as future-phase candidates only.
4. **Reveal leakage regressions** — future features embedding reveal text. Mitigation:
   single registry module, grep-style content tests (defect ids and reveal strings
   asserted absent from all non-reveal responses/DOM) run in every milestone.
5. **Progress persistence misread as "accounts"** — over-promising durability.
   Mitigation: guest banner copy in acceptance criteria; docs language; audit re-check.
6. **Cascade-delete surprises** — attempts vanish with session expiry mid-class.
   Mitigation: documented in code, UI, and audit; consistent with orders today; sweep
   verified.
7. **Milestone sizing** — P4-M2 is the heaviest milestone (hints/reveal backend + the
   full bug-report UI + hint/reveal surfaces). If it overflows a session, the internal
   work packages are the seam: WP1 (backend) may land separately from WP2/WP3 (UI),
   and within WP2 the form may be built before the evaluation view — all without
   touching the P4-M1 → P4-M2 → P4-M3 ordering. The milestone is not complete, and
   P4-M3 does not start, until all three of its work packages are verified together.
8. **Content drift between `src/data/scenarios.ts` and registries** — bidirectional
   content tests fail loudly; fix-forward only.
9. **Bundle growth** — no new dependencies allowed by default; if anything appears to
   need one, bring the trade-off back for explicit approval first.

### 11.2 Dependencies

- Existing P3 hunt engine and registries (stable, shipped); scenarios wiring; fake-D1
  harness; Test Bench components; synthetic auth binding semantics — all as-is, none
  redesigned.
- P4-M1 WP2→WP3 is the hard internal chain (schema + write path, then evaluator);
  P4-M1 WP1 is independent. P4-M2 WP1 depends on P4-M1; P4-M2 WP2 depends on P4-M1
  (endpoints + page copy); P4-M2 WP3 depends on P4-M2 WP1+WP2. P4-M3 WP1 depends on
  P4-M1+P4-M2; P4-M3 WP2 depends on WP1+P4-M1; P4-M3 WP3 depends on all. No dependency
  ever points backwards across the P4-M1 → P4-M2 → P4-M3 ordering.
- No external services, no new Cloudflare products, no new secrets, no cron.

## 12. Deferred capabilities and suggested future phases

Phase numbering after Phase 3 is **not agreed**; this table records *suggested* homes
for user confirmation, not commitments. PROJECT_STATE §9 rows keep their content and
numbering until the maintainer confirms renumbering. As of 2026-11-16 **no renumbering
has been approved** — the API & Identity Lab remains deferred and all later phases keep
their current numbers.

| Capability | Why deferred / suggested home |
|---|---|
| **API & identity lab** (OpenAPI doc, sample Postman collection, synthetic auth depth, negative authZ cases) | Originally this phase's placeholder; charter changed. Suggested: **Phase 5**. Blocks nothing in Phase 4; AuthN/AuthZ hunt exists as `hunt-authz-001`. |
| **Bug hunts for other tracks** (API, DB, contract, a11y defects with the same hint/reveal/report treatment) | Content expansion *after* the Phase 4 machinery is proven. Natural **Phase 6+** increment; reuse registries unchanged. |
| **Async/microservice lab, database sandbox, contract testing, performance runner, security track, automation examples** | Their own phases (originally Phases 5–9); unchanged in scope. |
| **AI-assisted report feedback** (optional, clearly-labelled, off by default) | Never a runtime dependency; if ever approved, a separate, bounded experiment — not Phase 4. |
| **Real accounts / cross-device progress / transcript export** | Requires identity architecture (verification, recovery, deletion). **Phase 10 (launch hardening)** or later; product principle #7 (account-backed progress only when abuse controls exist) is satisfied — the identity decision is the remaining gate, not the controls. |
| **Leaderboards, cohorts, teacher dashboards, proctoring, class assignment** | Needs real multi-user identity; out of phases 4–6 by design. |
| **Report triage simulation** (fictional tracker workflow, severity negotiation, duplicate detection) | Rich follow-up using the stored reports; **Phase 6+** candidate. |
| **Spaced repetition / "revisit your found defects" review flow** | Post-completion pedagogy; needs attempt history maturity. **Phase 6+**. |
| **Enforced prerequisites / learning-path engine / adaptive difficulty** | Needs path content and completion guarantees beyond the 7 hunts. Suggested with the expanded defect library. |
| **Telemetry/analytics on hint usage to tune content** | Only as privacy-preserving aggregate counters; needs an abuse/privacy review first. Not Phase 4. |
| **Certificates/badges** | Marketing-y, thin learning value; revisit at launch hardening at the earliest. |

## 13. Phase exit criteria

Phase 4 is implementation-complete when **all** hold:

1. P4-M1, P4-M2 and P4-M3 each merged with `npm run check` green and milestone acceptance met.
2. A learner with zero prior context can, starting from `/scenarios/manual-cart-totals`
   in a fresh browser, complete the full journey (start hunt → investigate → use ≤ 3
   hints → submit a report → read deterministic feedback → view the reveal → see the
   result on `/progress`) without consulting docs or the maintainer.
3. No reveal content is served or rendered before unlock (automated + manual probe).
4. Guest journey works and is honestly labelled — the UI states that guest progress is
   temporary, tied to the practice session, expires with it, and never transfers to a
   signed-in account; signed-in journey shows bound attempts; neither leaks across
   sessions.
5. Migration 0010 verified both paths (fresh; 0001–0009 → 0010 with planted data);
   `schema_version = 10`; maintenance sweep unchanged and asserted to not touch
   attempt/report rows (they die by cascade).
6. `docs/phase-4-exit-audit.md` exists and records: schema, capabilities, security &
   privacy review (reveal gating, report data, logging), retention behaviour, tests /
   build / browser results, known limitations, an explicit "Phase 4 has not been
   deployed / deployed" statement, deployment verification and rollback considerations
   per §7.5 (deployment remains a user decision), and an exit-criteria verdict.
7. `npm run check` green; production build passes; both themes × 4 widths verified for
   every touched surface; zero defect ids in any client-reachable response or DOM
   pre-unlock.
8. README and PROJECT_STATE updated to describe Phase 4 status truthfully (no
   "scoring" claims beyond what shipped).
9. Release pattern confirmed before any Phase 4 deployment, per §7.5: the manual
   Cloudflare workflow is retained; deployment verification steps and rollback
   considerations are documented in the exit audit; **no Phase 4 deployment happens
   without explicit maintainer approval.**

## 14. Planning decisions (resolved 2026-11-16)

The five pre-implementation decisions are **resolved** by the maintainer and are part
of the Phase 4 contract; they are cross-referenced throughout this plan.

1. **Finding-check term groups — curated, server-side, normalized, synonym-tolerant.**
   Each hunt ships a curated, server-side term group (e.g. hunt-catalogue-001:
   {description, search, term, …}; hunt-authz-001: {ownership, other account, another
   customer, not yours, reference, …}) covering its finding. Rules (§6.4, "Finding-check
   term groups"): reasonable **synonyms and equivalent terminology** are accepted — no
   brittle exact-string-only matching; input is **normalized consistently** (case,
   punctuation, whitespace) by the same pipeline used by every evaluator check; expected
   terms, defect ids and answer patterns are **never exposed to the client before
   reveal authorization**; matching is **deterministic and unit-tested** (positive,
   negative, synonym and normalization cases per hunt); the check evaluates the
   **finding fields only** (title + steps + expected + actual), so unrelated keyword
   mentions elsewhere never award `finding` or `discovered`. Tuning the lists is a code
   change with review, not a data edit.
2. **Severity vocabulary — exactly `Critical|High|Medium|Low`.** Impact-based and
   chosen by the learner with impact/scope guidance shown in the UI:
   **Critical** = blocks core functionality or risks data loss/corruption; no viable
   workaround; affects essentially all users of the flow. **High** = significant
   functional breakage or wrong results on a common path; costly/unreliable workaround.
   **Medium** = real functionality impaired with limited impact/scope; viable workaround.
   **Low** = cosmetic, copy, minor UI/presentation issues; negligible functional impact.
   The `bug_reports.severity` CHECK constraint and the `severity-valid` rubric check use
   exactly this enum (§6.4, §7.2 migration sketch).
3. **Priority vocabulary — separate from severity, exactly `P1|P2|P3|P4`, labelled
   `P1 — Urgent`, `P2 — High`, `P3 — Normal`, `P4 — Low`.** Priority measures urgency/
   ordering in a (simulated) tracker, not impact; **severity and priority are never
   automatically derived from each other**. The `priority-valid` check validates the
   `p1..p4` enum only (§6.4).
4. **Guest progress — anonymous practice session, temporary by design.** Guest
   attempts/reports are tied to the anonymous `practice_session`, expire with it (7-day
   TTL), die by cascade, and are **never** implied to transfer to a signed-in account;
   the UI states plainly at every progress surface that guest progress is temporary,
   tied to the session, expires with it, and does not carry into an account (§4.2,
   §7.3, P4-M3). Signed-in attribution is unchanged: rows made while signed in are
   stamped `customer_id` at submit time (§7.3). Session ownership, retention and
   cascade rules are preserved exactly as architected.
5. **Deployment — manual Cloudflare workflow retained.** No new Cloudflare products or
   infrastructure; no cron, queue or additional paid services; existing D1 + Pages
   architecture preserved; deployment verification and rollback considerations are
   documented for the Phase 4 release in §7.5 (and repeated in the exit-audit
   requirements in §13); **Phase 4 is not deployed during implementation** — deployment
   remains a separate, explicitly approved step.

**Roadmap renumbering — explicitly not approved (2026-11-16).** The deferred
API & Identity Lab remains deferred, Phase 5…10 keep their current numbering in
PROJECT_STATE §9 and in §12 above; the suggested mapping in §12 stays a suggestion
only. A roadmap change requires explicit maintainer approval and is outside Phase 4's
documentation scope.

All Phase 4 planning decisions are now resolved; there are no open questions blocking
implementation. The next step is **P4-M1** (see §13 and PROJECT_STATE.md §14).
