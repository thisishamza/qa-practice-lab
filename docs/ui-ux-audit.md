# QA Practice Lab — Comprehensive UI/UX Audit

**Date:** 2026-11-17 · **Auditor:** OpenCode agent session · **Scope:** read-only audit of the completed platform on `main` @ `297a030`
**App under test:** local `wrangler pages dev` on `:8788` serving the production build of the audited HEAD (`index-CLEs4WAj.js`); no source, CSS, routes, or configuration were modified. One local bug-hunt start → reset cycle was exercised (local D1, restored to clean). No production traffic, no migrations, no deploys.
**Evidence:** screenshots in `docs/audit-screenshots/` (41 files; every path cited in this report exists on disk), raw sweep JSONs summarised in `docs/ui-ux-route-inventory.md`.

---

## 0. Why the interface feels bland, hard to read and confusing — the short version

The application is functionally dense but informationally flat. It asks a first-time user to hold ~15 sidebar destinations, three overlapping "where do I start" surfaces (Dashboard start-path, Practice environment, Recommended path), and six "lab" hub pages that are near-identical clones — while simultaneously telling them, in at least six different places, that most of the platform "is not runnable yet", which is no longer true. Trust in the copy has been spent: the interface hedges so much about what "really works" that a new user cannot tell what to do, in what order, with what payoff, and is afraid to click. Visually, everything is correct and nothing is organised: one card style, one button style, one type ramp, no grouping of related actions, no progressive disclosure, micro-typography (12 px uppercase labels) doing the work that structure should do.

The details, evidence and the fix blueprint follow. This is an audit; nothing was redesigned.

---

## 1. Baseline established

- Branch `main`, HEAD `297a030` ("docs: record maintainer acceptance of F10"), working tree clean, up to date with `origin/main`.
- Runtime stack: React 19 + TS + Vite 7, React Router 7 (SPA fallback), Hono on Pages Functions, D1 bound as `DB`, `schema_version` 14, Wrangler. Hand-written CSS (tokens → base → layout → components → pages), no Tailwind, no icon package, self-hosted IBM Plex Sans + JetBrains Mono variable fonts.
- Routes: 57 declared routes in `src/app/App.tsx` (50 addressable paths + 404). Full inventory and per-route inspection status: `docs/ui-ux-route-inventory.md`.
- Navigation: `src/lib/navigation.ts` (`primaryNav` — 15 items in two sidebar groups "Learn" (4) and "Workspace" (11) + staff-only Inventory), `MobileNav` drawer with focus trap, top bar with brand, global scenario search (`/` shortcut), cart, account, theme toggle.
- Design tokens: `src/styles/tokens.css` — three-layer primitives → semantic → workspace scope; light default, dark global via `[data-theme="dark"]`, `[data-surface="workspace"]` for technical panels.
- Shared UI: 21 primitives in `src/components` (Button, Callout, Icon, Modal, Tag, ProgressBar, StatTile, …). Hub pages use `src/features/labs/LabHub.tsx`; hunt/scenario flows use the Phase 3/4 components.
- Commands run for verification only: `npm run build` was NOT re-run (audit-only; dist predates audit and was verified byte-current with HEAD by asset hash `index-CLEs4WAj.js`). `npm run check` was not re-run — no code changed.
- **Method note:** visual verification means rendered screenshots taken in this session (headless Chrome over raw CDP). Machine sweeps cover overflow/h1/console errors at five viewport widths × two themes. Accessibility evidence beyond those probes and source inspection is unavailable (no axe installed; do not install per constraints). Anything not verified is labelled.

---

## 2. Information architecture audit

### 2.1 What exists today

```
LEARN                                   WORKSPACE
 0 /            Overview                 4 /api-reference    API Reference
 1 /tracks      Tracks                   5 /api-lab         API Lab
 2 /scenarios   Catalog                   6 /database        Database
 3 /guides      Guides                   7 /contract        Contract Testing
                                         8 /performance     Performance
                                         9 /security        Security
                                        10 /microservices   Microservices
                                        11 /practice        Practice
                                        12 /progress        Progress
                                        13 /shop            Shop
                                        14 /account         Account
                             (staff only) /admin/inventory   Inventory
```

Plus: top-bar search icon (mobile) + global search (desktop) both → `/scenarios?q=`, cart badge → `/cart`, sign-in → `/login`|`/account`, footer link → `/about`.

### 2.2 Grouping logic review

The Learn/Workspace split does not survive contact with the product:

1. **"Learn" mixes consumption with catalogue tooling**: Overview (start), Tracks (structure), Catalog (search), Guides (reading). These are *learning prose*; Catalog is the only one with an action-oriented purpose ("find the thing to do"). It belongs with the practice surface, not with reading.
2. **"Workspace" mixes five different kinds of thing**:
   - *Reference material*: API Reference (reading the contract).
   - *Interactive workbenches*: API Lab, SQL Playground, Contract workspaces, Load runner, Simulator.
   - *Exercise catalogues*: Database/Contract/Performance/Security/Microservices hubs (12–36 scored exercises each) — these are *content*, like Tracks and Catalog, not tooling.
   - *Session/meta*: Practice (start & status), Progress (record).
   - *Simulated target*: Shop, Account, Checkout, Cart — a fictional commerce app the learner tests.

   Nothing in the label "Workspace" communicates any of these distinctions, and the ordering (Reference, Lab, Database, Contract, Performance, Security, Microservices, Practice, Progress, Shop, Account) has no semantic order at all — Shop and Account (the *thing under test*) sit between the learner's own records (Progress) and system reference (API Reference).
3. **Duplicated/competing destinations**:
   - Dashboard "Your start path" ≈ `/practice` "Available now" ≈ `/practice` "Recommended path" — three numbered "do this first" steppers rendering the *same three steps* with slightly different copy. Confirmed in `DashboardPage.tsx`, `PracticePage.tsx`, `RecommendedPath.tsx`.
   - `/progress` (hunt review) and `/practice` (hunt launch) split one concept — the bug-hunt lifecycle — across two nav items with adjacent positions.
   - `/scenarios` (exercise catalogue) vs each lab hub's exercise grid — six competing "pick an exercise" surfaces.
   - `/api-reference` vs `/api-lab` are in the same nav group with deliberately separate entries (an approved Phase 5 decision, headers kept) — but for a first-time user they are two adjacent, similarly-named, same-icon (`contract`/`api`) entries with no in-sidebar indication of which is "read" and which is "do".
4. **Labels vs. content mismatches** (evidence in §4 and register):
   - `Catalog` (nav, US spelling) vs "catalogue" everywhere else in the UI (UK spelling).
   - `Overview` — "What to do next in the lab" — but the page is a dashboard of everything; "Overview" sets no expectation.
   - `Practice` — described as "Runtime status and upcoming targets". "Runtime status" is engineering jargon; nothing on `/practice` is "runtime status". The page is actually a launcher + index of wired hunts.
   - `Progress` — described as "Demo progress and learning goals"; progress is real server-side data, and the page tracks labs, hunts, scores — not "goals".
5. **Where am I?**: breadcrumbs exist on some leaf pages (e.g. `Dashboard / Database Testing / Playground`, `Dashboard / Scenario catalogue / Manual / <scenario>`) but *not* on `/progress`, `/practice`, or any lab hub's exercise detail; sidebar active state is the only persistent location cue. Lab exercise pages (`/database/exercises/…`) have breadcrumbs under "…/Database Testing / Exercises"? — they show `Dashboard / …` inconsistently (SWEEP; not re-verified per exercise page, but `/database/exercises/sql-bgn-select-01` rendered breadcrumb `Dashboard / Database Testing` per sweep).
6. **First-screen communication**: the hero "Practise testing across the whole stack." tells the user the domain but not the *mechanic* (you test a fictional shop + labs, get scored, hunt seeded bugs). The primary CTA "Find a scenario" and secondary "Browse tracks" both push users into lists before teaching the model. Neither CTA says what the user will be able to *do*. And the supporting copy is stale (see F-004).

### 2.3 Duplicate / misplaced / confusing entries (enumerated)

| # | Item(s) | Issue | Fix direction |
|---|---|---|---|
| IA-1 | `Practice` | Duplicates Dashboard start-path; "runtime status" copy meaningless to target user; overloads "Practice" as a noun for everything | Consolidate: hunt launcher belongs beside Progress ("Bug hunts" entry) or inside each wired scenario page only |
| IA-2 | `Catalog` vs lab hubs | Six catalogues of exercises with no shared home; Catalog only carries the 53 catalogue scenarios, not SQL/contract/perf/sec/evt exercises (those appear only under each hub and under Progress) | One "Exercises" hub with faceted all-exercise view, or keep per-lab but add cross-linking + consistent "Exercises" naming |
| IA-3 | `Shop`, `Account` under Workspace | The commerce app is the *subject under test*, not a learner tool; sits next to reference material | Group as a distinct "Practice app" cluster (or fold into a "Target app" menu section) |
| IA-4 | `API Reference` / `API Lab` adjacency | Approved split (kept), but scan path needs clearer lexical pair: "API reference (read)" vs "API console (send requests)" | Keep both; rename labels and/or add one-line descriptions in-nav |
| IA-5 | 15-item flat list, two labels | No third grouping for the target app; Workspace has 11 undifferentiated items; sidebar height forces everything into one scroll strip | Three or four real groups (see §2.4) |
| IA-6 | Bottom `About this build` | Footer ("Preview build") + sidebar bottom link both → `/about`; fine, but About is the *only* place the honest rubric/evaluation model is explained and it is labelled like a build badge | Rename to "About & scoring" / place under help |

### 2.4 Proposed information architecture (summary — full proposal in `docs/ui-ux-redesign-recommendations.md`)

Four groups, ordered by the learner's journey:

```
START HERE
  Overview            — what this is, your next best step (real state, not generic steps)
  Learning paths      — the 12 tracks + recommended path (merged Tracks + Practice start-path)
LEARN & PRACTISE
  Exercises           — unified catalogue, faceted (all 151+ exercises incl. labs)
  Guides              — 11 guides
LABS (the hands-on workbenches)
  Shop (Meridian Outfitters)   — the app under test: storefront / cart / checkout / account
  API Lab                     — console
  API Reference               — contract (read)
  SQL Playground              — query the snapshot
  Contract testing            — hub
  Performance testing         — hub + load runner
  Security testing            — hub + demos
  Microservices & events      — hub + simulator
MY WORK
  Bug hunts           — active hunt, start/reset, attempts → Progress merged
  Progress            — scores, discoveries, rubric link
  Sign in / Account
```

Key renames: `Catalog`→`Exercises` (or `Catalogue`, pick one spelling — UK to match content), `Practice`→ folded into `Bug hunts`, `Overview`→`Start` (or keep `Overview` but fix copy), sidebar group labels → journey verbs rather than nouns.

**Non-goal:** changing routes/URLs. All renames are labelling-only; `/scenarios`, `/practice`, `/progress` etc. stay valid. Deep links preserved.

### 2.5 Navigation hierarchy recommendation

Two-level max in the sidebar: **Group → Entry**, with the top bar reserved for (a) brand/home, (b) global search (scenarios + labs + guides — widen scope), (c) cart badge + account, (d) theme. Mobile: same drawer, but grouped with collapsible sections. Persist expanded groups; keep staff gate as-is.

---

## 3. First-time-user task walkthroughs

Persona: a QA learner, new to the platform, desktop 1440×900, light theme, fresh profile (no cart/session; guest). Each task records what I actually did this session (Chrome CDP); where a step was not exercised it says so.

**Task 1 — Understand what QA Practice Lab offers.**
- Start: `/`. Expected: one-paragraph pitch + primary action.
- Actual: hero "Practise testing across the whole stack." + subcopy citing "twenty-four catalogued scenarios, and six practical guides" (stale — reality: 53 scenarios, 11 guides, 151+ scored lab exercises) + two CTAs ("Find a scenario" / "Browse tracks"). Below: start-path, curriculum list, catalogue teaser with READY tags.
- Confusing: copy asserts scarcity ("exercises are not runnable yet", `dashboard-note`) while the same screen shows 3 READY scenarios and 10 hunts exist; user cannot form a correct mental model.
- Result: **completable with a wrong model.** Recommendation: rewrite hero to state the loop (read → practise → hunt → scored), fix counts, make CTA "Start the manual-testing path" style.

**Task 2 — Determine where to start learning.**
- Start: `/`. Expected: explicit ordered path.
- Actual: "Your start path" 3 steps (guide → manual-cart-totals scenario → API track). Also repeated verbatim at `/practice` ("Available now") and again as "Recommended path" (hunts). Three overlapping steppers; none says prerequisites, time, or completion state on the dashboard itself (it exists on `/practice` with real completion from server progress — see `vp-practice-1440-light.png` chips like "NOT STARTED").
- Result: **completable; disorienting.** Recommendation: single source of truth for "next step" — show real completion state on Dashboard; delete the duplicate from `/practice` or vice-versa.

**Task 3 — Find and start a manual testing exercise.**
- Steps: top-bar search or `Catalog` → dropdown filters (Track = Manual Testing, Mode = Bug hunt) → pick "Bug hunt: order line totals at checkout" → scenario page → button "Start the bug-hunt exercise".
- Verified live: clicked it; global banner flipped to **"Bug-hunt mode — Order totals do not add up…"**; repeated click semantics fine; after test, clicked "Reset to clean" — banner returned to clean. (Both screenshots captured.)
- Friction: (a) `Catalog` spelling; (b) the scenario page buries "Start the bug-hunt exercise" inside a right-rail panel below ~900 px of educational prose; (c) no count shown of how many manual hunts exist; (d) a blind user following only the nav label "Catalog" would not predict bug hunts live there.
- Result: **completable in ~3 clicks once you know it exists; label path unclear.** Recommendation: pin a "Start this exercise" CTA at top of scenario pages; rename nav entry.

**Task 4 — Understand Clean Mode vs Bug-Hunt Mode.**
- Expected: an explanatory affordance before first activation.
- Actual: a persistent one-line banner (`ModeBanner`) says current mode with icon; "Hunt controls" link routes to `/practice`. The *distinction* is explained only inside hunt-mode banner after activation and in `/about` & scenario pages. Nothing explains the shop "breaks on purpose and resets" until you start one. The `/about` page explains scoring/reveal semantics well but is linked as "About this build".
- Result: **not discoverable pre-activation; requires hunt to learn.** Recommendation: add a dismissible first-run explainer (or an info callout on Overview for new sessions) defining both modes + where the seeded defects live.

**Task 5 — Find and complete an API testing exercise.**
- Expected: obvious "API" entry.
- Actual: two adjacent entries `API Reference` and `API Lab` in sidebar; the *exercises* for API live under `/scenarios?track=api-testing` (via Catalog) and on the API Testing track page; `/api-lab` has a sign-in-gated practice token helper; `api-catalog-pagination` is a runnable clean exercise launched from its scenario page ("Open in API Lab"). Flow: Overview → Catalog → filter API → scenario → read → open API Lab → send request. ~5 steps, no single taught path.
- Confusing: which of the two API entries is "the exercise"? Neither says so.
- Result: **completable by an expert of this app; confusing for its target user.** Recommendation: in the Labs group, each lab entry label carries its verb (Next: "API console — send your first request") and from Overview a single "API path" card.

**Task 6 — Locate the SQL/database playground.**
- Steps: sidebar `Database` → `SQL playground` CTA. One click. Page renders WASM SQLite with editor, schema explorer (8 tables), starter queries; empty state explains "Nothing has run yet".
- Result: **easy — the best-signposted lab.** Keep pattern. Copy nit: hub "How to practice" number circles lack the missing-space defect (styled differently) — fine.

**Task 7 — Find a contract testing exercise.**
- Steps: sidebar `Contract Testing` → hub ("Read the contract like a tester" 24 exercises; validate/compare/consumer tools; 7 hunts) → `/contract/exercises/contract-bgn-openapi-01`.
- Verified SWEEP render. The hub is dense but organized (A/B/C capability cards). Missing-space defect hits this hub (F-007).
- Result: **completable, ~2–3 clicks; needs the missing-space fix and slightly clearer exercise CTA.**

**Task 8 — Find a performance testing exercise.**
- Steps: sidebar `Performance` → hub (load runner CTA; 12 exercises; 3 hunts; runner caps preview) → `/performance/exercises/perf-bgn-baseline-01`.
- Verified SWEEP + viewport dark screenshot. "Open the load runner" primary CTA goes to `/performance/workspace` — running a load test is the marquee action; exercises are secondary but equally reachable via list.
- Result: **completable.** Risk: user runs the load test before understanding percentiles gating (n≥20) — copy covers it on-page.

**Task 9 — Find a security exercise.**
- Steps: sidebar `Security` → hub (inert demos CTA; 12 exercises; 3 hunts) → `/security/exercises/sec-bgn-authn-01`.
- Verified SWEEP + viewport screenshot. Same LabHub clone + missing-space defect.
- Result: **completable.**

**Task 10 — Find the microservices simulator.**
- Steps: sidebar `Microservices` → hub → `Simulator` (publish event → process → trace). Verified render at dark theme; numbered steps 1→4 with reset section.
- Result: **completable.** Cognitive load is high (event jargon with explanations) but onboarding text is honest and good.

**Task 11 — Understand hints, solutions, reports and scoring.**
- Expected: one explanation, reachable pre-hunt.
- Actual: scoring rubric lives on `/about#evaluation` (excellent, honest: ten checks /100, verdict bands, discovery vs report quality) and "How your report is evaluated" module on *wired scenario pages* (scrolled position ~70% down). Hints/reveal behaviour described on scenario pages and in `/about`. Nothing pre-hunt summarises: "hints never lower your score; reveal grants no discovery; scoring is deterministic" — those exact sentences exist but are only visible deep in pages.
- Result: **completable but only by reading 2–4 long pages.** Recommendation: a persistent "How scoring works" popover or a compact callout on every wired hunt panel; link from banner.

**Task 12 — Locate progress and determine what to do next.**
- Steps: sidebar `Progress`.
- Actual: page renders: activity strip (counts), "Your hunts" list (all 34 wired hunts with status chips), Database/Contract/Performance/Security/Microservices sections (12 rows each), "Recent submissions". Entire page is one column of nearly identical rows totalling ≈ 12,300 px (≈ 14 viewport-screens at 900 px tall; machine probe: 402 text nodes @12 px + 720 @14 px); **no prioritised "next up" block**; the "what to do next" logic exists only on `/practice` (recommended path with completion state).
- Result: **task achievable (you can see status); goal (decide next step) fails.** Recommendation: Progress opens with a "Do this next" card (first incomplete recommended hunt), collapsible sections, search/filter.

### Walkthrough scorecard

| # | Task | Completable? | Quality of path |
|---|---|---|---|
| 1 | Understand offering | ✓ (wrong model) | Poor |
| 2 | Where to start | ✓ | Poor–fair |
| 3 | Start manual exercise | ✓ | Fair |
| 4 | Clean vs bug-hunt | ✗ pre-activation | Poor |
| 5 | API exercise | ✓ (~5 steps, unlabeled) | Poor |
| 6 | SQL playground | ✓ | Good |
| 7 | Contract exercise | ✓ | Fair |
| 8 | Performance exercise | ✓ | Fair |
| 9 | Security exercise | ✓ | Fair |
| 10 | Microservices simulator | ✓ | Fair |
| 11 | Hints/scoring | ✓ (long read) | Fair–good |
| 12 | Progress → next step | ✓ / ✗ goal | Poor |

**Critical honesty note:** no user testing with humans was performed; these are expert walkthroughs by the auditor. No clicks were instrumented or timed; "clicks" counts are approximate.

---

## 4. Visual design & readability audit

### 4.1 Typography

- Scale exists (`--text-display` 2.5rem → `--text-micro` 0.75rem) but the *page* rhythm does not use it: most page bodies render at 14–16 px with **12 px uppercase micro labels used structurally everywhere** (kickers, fact keys, table headers, stats, nav descriptions, "53 SCENARIOS · 12 TRACKS · 11 GUIDES" strip). Machine probe (`docs` run): `/scenarios` renders 103 nodes @12 px / 399 @14 px / 453 @16 px; `/progress` renders **402 nodes @12 px / 720 @14 px**; `/api-reference` renders **739 @12 px / 754 @13.5 px / 2011 @14 px**. The interface is informationally 12–14 px on a 1440px desktop — too dense, especially in dark theme.
- Contrast: token pairs mostly pass (measured: light ink-muted/surface ≈ 6.8–7.3; subtle ≈ 5.3–5.7; dark muted ≈ 8.1–8.8). **Exceptions:** `--green-700` on `--green-50` = **4.46** (READY/available tags at 12 px semibold — marginally below WCAA AA 4.5 for normal text); `--slate-400` on white = 3.68 (used for borders and *monospace counters/hints* in places — reserve for graphics only).
- Fonts work (IBM Plex Sans is a fine engineering choice; JetBrains Mono for code) — but 12 px mono uppercase kickers add texture, not information.
- Line length: prose pages cap at 66 ch (`--prose-measure`), good; cards and list rows run full width (1120 px container), encouraging 130+ ch lines of body copy on hub pages — e.g. lab "How to practice" text wraps to ~95–100 ch at 1440 px (VP screenshot).

### 4.2 Hierarchy, density, monotony

- **One visual noun: the bordered white card.** Every region — start path, track rows, stats, facts, steps, hunts, exercises, states — is a white/raised card on a slate canvas with a 1 px border and 12 px radius. No elevation hierarchy (`--shadow-*` only for overlays by design), no tonal grouping of related controls vs results. Nothing tells the eye what is *instruction*, what is *control*, what is *result*, or what is *meta*. Candidates for tonal separation (sunken panels for results vs raised for actions) exist in tokens (`--surface-sunken`, `--surface-selected`) but are barely used for meaning.
- **Repetition:** the lab hubs (Contract/Performance/Security/Microservices) are byte-similar: hero → "How to practice" 4-step list → facts panel → capability cards → exercise grids → hunts. Recognition over recall is good; but within one visit the pattern is *identical*, so users skim everything and read nothing.
- **Progress & Practice are lists without structure** (see §3 tasks 2/12) — pure repetition: 12 rows × 5 sections with identical skeletons, no collapsing, no filters, no sort, ~9 screens of scrolling.
- **Empty states are good** (checkout empty cart, SQL "Nothing has run yet", simulator empty trace) — keep them; they are the clearest writing on the site.
- **The hero vs the app:** the most visually confident elements (solid dark buttons) are shared by "Start the bug-hunt exercise", "Browse tracks", "Publish event", "Run query", "Add to cart" — equal visual weight for unequal stakes.

### 4.3 Scanability findings

1. Every page opens with the same triad — eyebrow kicker (12 px mono uppercase) + h1 (2 rem) + one-sentence description — whether it's a catalogue, a lab, a simulator or a reference. Consistent, but becomes wallpaper; the eye stops registering the hierarchy.
2. `Scenario catalogue` card grid: 3-up × 18 rows — uniform, undifferentiated by status except a small tag; "READY" vs "PLANNED" differs only by tag hue (green vs grey) — poor pre-attentive signal; no grouping by track/difficulty; horizontal scan requires reading every title.
3. Breadcrumbs + tags + stat rows are all 12 px mono — location, status and telemetry compete at the same volume.
4. Tables (SQL results, admin inventory, API reference tables) use full-width borders; alternate row shading absent; dense but honest. `table-scroll` has visible focus style (good).

### 4.4 What is genuinely good (keep)

- Self-hydrated tokens hierarchy; dark theme is a true redesign not an inversion; `[data-surface="workspace"]` dark panels inside light theme are *meaningfully* applied (code editor, simulator).
- Prose measure 66 ch; heading clarity; single-h1-per-page everywhere (verified all 41 routes); focus-visible ring geometry consistent; `prefers-reduced-motion` honored; skip link present; landmark discipline (`header/nav/main/aside/footer`) good; dialog focus trap in mobile nav + Modal WAI pattern.
- Honest empty states; good inline-docs tone; rubric transparency page.

---

## 5. Responsive behaviour (measured)

| Viewport | Light theme | Dark theme | Notes |
|---|---|---|---|
| 1440×900 | ✓ sweep clean, screenshots | ✓ sweep clean | Reference layout; sidebar fixed 240 px + content `max 1120 px` |
| 1280×800 | ✓ sweep clean | ✓ | Sidebar + content still fit; grid drops to 2-up |
| 768×1024 | ✓ sweep clean | ✓ | Sidebar hides ≤1023 px → top bar shows hamburger + search icon; drawer pattern verified at 390/375; content spans full width |
| 390×844 | ✓ sweep clean (except F10) | ✓ | Topbar: brand text wraps to two lines; search collapses to icon; cart/account/theme fit |
| 375×812 | ✓ sweep clean (except **F10 reproduced**: `/api-reference` +186 px) | ✓ +171 px | F10 = maintainer-accepted pre-existing defect; **re-verified this session** |
| Mobile nav | opens at ≤1023 px; focus-trapped; 15 items + descriptions; scrolls; close via Escape/X | — | Drawer lists all 15 entries with two-line descriptions — needs grouping too |
| Tables | `/api-reference` tables force page horizontal scroll | — | The only overflow in the matrix |
| 200% zoom | not tested | not tested | unverified |

F10 reproduced (both themes, both widths): document `scrollWidth` − clientWidth = **+186 px @375 light** (`docs/audit-screenshots/api-reference-375-light-overflow.png`), **+171 px @390 dark** (`…/api-reference-390-dark-overflow.png`). Offenders: `SECTION.api-group`, `.section-header`, `.api-endpoint-list`, `ARTICLE.ap…` (endpoint cards, `property-table` min-content width). Known/accepted as F10; included here because this audit is the redesign blueprint and it must be fixed there (see recommendations R1.3).

**Verdict:** responsive behaviour is structurally sound everywhere *except* `/api-reference` on phones; touch targets: primary controls use `--control-h` 2.75 rem (44 px) ✓; small buttons 2.25 rem (36 px) — below the 44 px guidance, acceptable for dense desktop tooling but flagged; sidebar collapse button is 2.25 rem.

---

## 6. Interaction design & accessibility audit

**Verified by inspection/probe/screenshot (labelled V):**
- V Skip link exists, targets `#main-content`, focus-visible style; V landmarks: exactly one `main#main-content` per page; V focus ring visible (`focus-tab-dashboard-1440-light.png`); V `prefers-reduced-motion` block present (8 files) + `(forced-colors: active)` handling; V mobile drawer: `role`-dialog pattern, Escape closes, Tab cycles within drawer, returns focus to trigger (source-verified; visually confirmed open state).
- V No unlabeled buttons/links/inputs on 11 probed routes (query-based check); V transparent naming for icon-only buttons (aria-label present).
- V Single h1 on all 41 swept routes; V `h1→h3` skip observed on `/scenarios` and `/shop` only (minor, F-014).
- V Console errors: **zero** on all swept routes, both themes.
- V Links vs buttons: buttons for actions, links for navigation — mostly consistent; `Hunt controls` is a link styled as link; ✓.
- V Disabled/placeholder states: exercise cards render "PLANNED"/"IN DESIGN" non-clickable chips (not buttons) — good practice.
- V Error states: mode banner has error retry; progress page has error+retry; API Lab refuses external URLs with inline message (verified earlier phases; code present).
- V Success: cart badge count, hunt mode banner, evaluation panel — distinct icons + text (never color-alone), as DESIGNED.

**Potential concerns requiring manual verification (labelled PC):**
- PC Focus order inside long lab pages (visual focus ring confirmed only on first six Tab stops).
- PC `aria-live` politeness of mode-banner changes (`role="status"` — should announce; unverified with SR).
- PC Dark-theme contrast of 12 px uppercase kickers (ink-subtle 5.6–6.0 — passes 4.5 ✓ actually measured; fine) and of placeholder text in inputs (= ink-subtle on surface; ≈5.3 — passes).
- PC Target size of chip filters on `/scenarios` (<44 px tall; desktop context, acceptable).
- PC Screen-reader announcement of async route transitions (`useRouteManagement` sets document title + focus — code present; SR unverified).
- PC Colour-alone signalling in `READY` vs `PLANNED` chips (text label present ✓ — passes; hue is redundant, fine).
- PC Contrast of `--green-700` on `--green-50` = 4.46 < 4.5 (F-016) — **measured, verified fail for normal text**.
- PC Reduced-motion path in the load runner / simulator animations unverified.

**Failed (verified defects):** F10 overflow (mobile), F-016 contrast, F-014 heading skip, F-007 missing-space (readability defect that reads as noise to SR too since `<strong>` and `<span>` are separate text nodes).

---

## 7. Design-system audit

### 7.1 What works

- **Token architecture** (3-layer primitives → semantic → workspace) is genuinely good; dark theme parity is achieved through one mechanism, not per-component forks; dark-on-dark technical panels (`[data-surface="workspace"]`) are scoped correctly and keep contrast (simulator verified readable).
- **Shared primitives are consistent where used** (Button variants, Callout tones, PageChrome/PageHeader, StatTile, Tag) and their states are documented in code comments.
- **Headings**: components name their sections; h1 unique; `useRouteManagement` updates `<title>`.
- **Self-hosted variable fonts** with `font-display: swap`; no FOUT bombs.
- **Focus-visible everywhere** (global + scoped overrides); selection styling themed.

### 7.2 What contributes to the poor experience

1. **Scale & density tokens are wrong for the audience.** `--text-micro` 12 px is used as *structural* type (kickers, keys, captions, stat labels, table headers) on every page — at 1440 px. The system *supports* 16/17/22 px roles but pages never reach for them; the component library ships 12 px as its default meta size, so "consistency" locks in density.
2. **Spacing rhythm**: cards padded via `--card-pad` 1.5 rem uniformly — same rhythm for a 3-line fact panel and an 18-card catalogue; no density variants (compact/cozy/spacious) despite free vertical space on 1440–1920 px screens; content column caps at 1120 px even on 1920 px.
3. **Surfaces carry no meaning**: `--surface` = cards, `--canvas` = page, `--surface-sunken` = code/inputs, but nothing says "raised = action / sunken = result". Result panels (SQL results, evaluation output, diffs) and controls share the same elevation — the user cannot scan "what do I operate vs what did the system produce".
4. **No icon scale discipline**: icon sizes 14/15/16/17/18/20 px appear nearly arbitrarily; optical weight varies; inline SVG icons hand-drawn, fine, but no shared `stroke-width` scale — contributes to the "technical but unfinished" feel.
5. **PageHeader is doing too much**: eyebrow + title + description + actions, every page — three text styles competing; the eyebrow (mono uppercase) is the same everywhere so it stops signalling (see §4.3).
6. **Shared components exist but pages bypass them**:
   - Five labs hand-roll their hub via `LabHub` vs two hand-roll (`DatabaseHubPage`, `ContractHubPage`) → the same "How to practice" block exists in **three** implementations with **two** different micro-typography outcomes (one renders `<strong>title</strong> <span>detail</span>` correctly via explicit text node space; two render them as adjacent inline elements with zero separation — see F-007). The shared-component principle failed in the exact place it mattered most.
   - `.panel`, `.card`, `.facts-panel`, `.workspace-facts`, `.start-step`, `.recommended-step`, `.hunt-card` — at least five near-identical list/step containers; `pages.css` alone defines ~1355 lines and `components.css` 3701 — overlap likely (not enumerated mechanically; spot-checked).
   - Stale copy hard-coded inside components (`navigation.ts` descriptions; `DashboardPage`; `AboutPage`) instead of derived from data — see F-004/F-005.
7. **Progress page ignores the shared system** (`ProgressDashboard` builds bespoke rows rather than using StatTile/ProgressBar/Tag consistently for the hunt rows; only the summary strip uses tiles) — largest consistency breakage.
8. **Light/dark semantic drift**: `--surface-selected` (slate-150 #e8eef9) on white reads as pale blue tint — fine; dark `--surface-selected` night-600 #1b2c46 fine; no drift defects found. Themes preserve meaning ✓.

### 7.3 Pages bypassing the shared system

Severity-ranked: `/progress` (bespoke dashboard), lab hubs (triple implementation), `/about` (hand-rolled prose + rubric table), `/practice` (stepper cloned from dashboard), `/scenarios` (card grid is bespoke though it uses Tag). Everything else within reasonable tolerance.

### 7.4 Does the design system support hierarchy?

Partially: it guarantees a *consistent* lowest common denominator, not an *opinionated* hierarchy. It has no concept of:
- tonal grouping (action vs result vs meta),
- typographic contrast for scanning (everything 12–16 px),
- summary-first layouts (every page is full-width stacked sections),
- "next action" component (three ad-hoc copies).
A redesign should *extend* the system (add 2–3 tokens + 2 components), not replace it — the token layer, theming and a11y baseline are keepers.

---

## 8. Finding register

Severity: **P0** blocks a core task · **P1** seriously obstructs navigation/comprehension/completion · **P2** friction/confusion/readability · **P3** polish/consistency.
`EV` = evidence verified this session (screenshot/probe/source); `HP` = hypothesis flagged for verification.

| ID | Area | Page / component | Problem | Evidence | User impact | Severity | Recommendation |
|---|---|---|---|---|---|---|---|
| F-001 | IA | Sidebar + Mobile drawer | Flat 15-item "Learn/Workspace" grouping is not meaningful to first-time users; Shop/Account (the app under test) sit under "Workspace" beside reference material; ordering carries no semantic meaning | `src/lib/navigation.ts`; sidebar render in `vp-dashboard-1440-light.png`; drawer in `mobile-nav-open-390-light.png` | Cannot predict where anything lives; everything looks equally important | **P1** | Regroup into journey groups (Start / Learn / Labs / My work) — see recommendations R2 |
| F-002 | IA | Dashboard, `/practice` | "Next step" represented by three duplicated steppers with overlapping content (Dashboard start path / Practice available-now / Recommended path) with inconsistent copy and completion state | `DashboardPage.tsx:14–44`, `PracticePage.tsx:14–64`, `RecommendedPath.tsx`; screenshots `vp-dashboard-1440-light.png`, `vp-practice-1440-light.png` | No canonical "what next"; users re-read identical lists | **P1** | Single recommended-path component with real progress state on the dashboard; `/practice` removed as a destination or repurposed as "Bug hunts" launcher |
| F-003 | Copy / trust | Dashboard hero + note; Tracks; About; navigation descriptions; TrackDetail; RecommendedPath | Systemic stale pre-launch copy: "twenty-four catalogued scenarios, six practical guides" (actual: 53/11); "Scenario exercises are catalogued but are not runnable yet" (10 wired hunts + 5 lab catalogues ship); "121 exercises are planned… exercises are not runnable yet" (Tracks); "Later phases add… a browser-isolated SQL sandbox, performance…" (About, written of now-shipped features); Progress nav: "Demo progress"; RecommendedPath: "remaining 18 catalogue scenarios are not runnable" | `DashboardPage.tsx:59,97`; `TracksPage.tsx:27`; `AboutPage.tsx:42,55,60,66–78`; `navigation.ts:89`; `RecommendedPath.tsx:141`; `TrackDetailPage.tsx:97`; about-1440-light.png | Users conclude the platform is vapor; disengage; report bugs that aren't bugs | **P1** | Copy audit sweep; derive counts from data; add a versioned "What works today" registry; single source in data modules |
| F-004 | IA / discovery | Global | Six competing exercise catalogues (Catalog scenarios, 5 lab hubs) with no shared "Exercises" index, no faceted all-exercise search; global search searches scenarios only | `TopBar.tsx` search placeholder "Search scenarios"; lab hubs verified; sidebar | Cross-domain tasks ("I want a beginner SQL + API exercise") unfindable | **P1** | Extend search scope; unified Exercises facet view (route `/exercises` optional); keep catalogues as curated entry points |
| F-005 | Readability defect | Contract/Performance/Security/Microservices hubs (LabHub + ContractHubPage) | Instructional text in primary "How to practice" block renders with ZERO separation between bold lead-in and body ("Pick the endpointOnly first-party…", "Walk the demosSee parameterization…", "Fix, diff, verifyExploratory…") | LabHub.tsx:163–170; ContractHubPage.tsx:162–168; cropped evidence `vp-performance-1440-dark.png`, `vp-security-1440-light.png`, `vp-contract-1440-light.png` | Instruction reads as corrupted text; eye stumbles on the most important guidance | **P1** | Add `{' '}` + punctuation in shared component; single implementation via LabHub or shared `StepsList` |
| F-006 | Responsive | `/api-reference` | 186 px (375 light) / 171 px (390 dark) horizontal page overflow; offenders `property-table` min-content inside endpoint cards; reproduces F10 | This session re-probe; screenshots `api-reference-375-light-overflow.png`, `api-reference-390-dark-overflow.png`; sweep JSONs | Phone users cannot read the reference; whole-page h-scroll | **P1** (known F10, accepted by maintainer; still a blocking defect for the redesign mobile matrix) | `minmax(0,1fr)` columns, table wrappers with overflow-x, remove min-content forcing widths; retest matrix |
| F-007 | Visual density | `/progress`, `/practice`, `/scenarios` | Unstructured walls of identical rows/cards (12+ rows per section; ≈ 12,300 px tall page ≈ 14 viewport-screens; ~1,100 text nodes @12–14 px); no collapse/filter/sort | `progress-1440-light.png`, `practice-1440-light.png`, `scenarios-1440-light.png`; font-size probes | Cognitive overload; scanning impossible; only motivated users find their hunt | **P1** | Section collapses; "Do this next" priority card; filters (status/track); consider two-pane sticky index |
| F-008 | Visual hierarchy | Global | No tonal distinction between actions/controls and results/output; single card grammar everywhere; primary dark buttons used for all stakes (Add to cart = Publish event = Start hunt = Run query) | `components.css` surface usage; all screenshots | Can't scan; users don't know what is interactive vs informational vs done | **P2** | Introduce 2-surface grammar (raised=action, sunken/inset=result); restrict solid-action styling to one primary CTA per view |
| F-009 | Navigation labels | `/scenarios`, topbar | "Catalog" (US) vs "catalogue" (UK) mismatch; `/progress` described as "Demo progress and learning goals" (false); `/practice` "Runtime status and upcoming targets" (opaque jargon) | `navigation.ts:26,84,89` | Misleading entry points | **P2** | Rename labels + descriptions; UK spelling; plain-language ("Your attempts & scores", "Start a hunt & see your status") |
| F-010 | First-run | Global | Clean vs Bug-hunt mode is never explained pre-activation; first-time users cannot predict what "Hunt" does to the shop; mode exists for 6 phases without onboarding copy | `ModeBanner.tsx` (text exists but post-activation only); Overview has no explainer | Starts hunts fearfully or not at all | **P2** | One dismissible explainer card on Overview for sessions with zero attempts; plain definitions + "you can reset anytime" |
| F-011 | Wayfinding | `/progress`, `/practice`, lab hubs | Breadcrumbs absent on the two most-visited meta pages and inconsistent elsewhere; no persistent "you are here" beyond sidebar highlight; no relative level indicator | Sweep of 41 routes (breadcrumb strings present only on leaf pages) | Lost context on meta pages | **P2** | Breadcrumb component on all non-root pages (element exists in source patterns — apply uniformly) |
| F-012 | Copy consistency | Global | "Meridian Outfitters" vs "the practice shop" vs "commerce app" used interchangeably; mixed US/UK spelling (Catalog/catalogue); "53 SCENARIOS · 12 TRACKS · 11 GUIDES" strip rendered 12 px caps | Sweep of page intros; screenshots | Voice inconsistency; minor trust erosion | **P3** | Voice/terminology pass in one sweep (fold into F-003 fix) |
| F-013 | Headings | `/scenarios`, `/shop` | h1 → h3 level skip (no h2) | a11y probe output (headingSkips=1 on both) | SR navigation minor | **P3** | h2 SectionHeader usage |
| F-014 | A11y / contrast | Tag/chips | `READY` tag green-on-green-50 = 4.46:1 (< 4.5 AA normal text) | Token measurement | Minor text may fail AA | **P2** | Darken `--green-700`→ ~#146C34 or raise tag text size/weight |
| F-015 | Search | TopBar | Global search covers scenarios only; placeholder "Search scenarios"; mobile surfaces duplicate icon | TopBar.tsx; both viewports | Users expect site-wide search; findability of labs hurt | **P2** | Scope search to all entries/exercises or label honestly ("Search exercises…" + sections) |
| F-016 | Consistency | `/about` | Honest but unnavigable: rubric table + prose walls; "What comes next" describes shipped features as future; page is the de-facto scoring doc yet labelled a build badge | about-1440-light.png | Scoring docs undiscoverable; trust undermined | **P2** | Split into "About & scoring" (rubric) + "What's new" changelog fed by a data module |
| F-017 | Empty-state density | `/checkout` empty etc. | Good empty states exist but dashboard empty/demo states don't explain guest TTL (7 days) — documented only in About/About | Checkout screenshot; About copy | Guest data loss surprise | **P3** | One-line guest durability note on Progress/Account empty states |
| F-018 | Touch targets | Small buttons | `--control-h-sm` 36 px < 44 px guidance on dense desktop pages | tokens.css; components using sm buttons | Marginal; desktop acceptable | **P3** | WCAG 2.2 AA target size on mobile breakpoints |
| F-019 | Icons | Global | No icon package; hand-drawn glyphs inconsistent optical size/stroke (14–20 px mixed) | Icon.tsx sampling | Slightly "unfinished" look | **P3** | Adopt Phosphor (as ui-ux-pro-max suggests) in a future phase only if authorized; else normalize sizes |
| F-020 | Motion | Simulator/runner | Animated affordances (publish→process) have no reduced-motion-specific verification; CSS handles transitions | CSS verified; behaviour unverified by probe | Potential SR/motion discomfort | **P3** | Manual check; ensure `prefers-reduced-motion` short-circuits timers if any |
| F-021 | IA | Topbar | Cart badge & sign-in visible for all sessions — shopping-cart chrome on a testing tool confuses first-time users about platform purpose | `vp-dashboard-1440-light.png` header | "Is this a shop or a QA tool?" bleed | **P2** | Group commerce chrome under a single "Practice app" doorway; or move cart into Shop context only |
| F-022 | Meta semantics | Dashboard | `<html lang>` set? (yes, index.html); `meta theme-color` sync verified earlier phases | Source | fine | — | Verified OK, record as pass |
| F-023 | Console | All pages | Zero console errors observed (both themes, 41 routes × 2 sweeps) | Sweep output | n/a | — | Verified OK |
| F-024 | 404 | `*` | Renders branded 404 with h1 "That page is not part of the lab." + escape links | Sweep | Works | — | Keep; add suggestion links (hypothesis) |

Confirmed counts: **P1 ×7 (F-001..F-007), P2 ×8 (F-008, F-009, F-010, F-011, F-014, F-015, F-016, F-021), P3 ×6 (F-012, F-013, F-017, F-018, F-019, F-020).** Zero P0. F-022/023/024 are passes.

### Hypotheses to verify before redesign sign-off (not counted above)
H-1. Sidebar at ≤1024 px disappears (confirmed breakpoint) but no "rail" mode for laptop sizes — hypothesis from CSS read; verify at 900×700.
H-2. `prefers-reduced-motion` fully neutralizes simulator animations — PC.
H-3. Screen-reader output of `role="status"` banner and route-change focus target — PC.
H-4. `/api-reference` F10 fix via grid minmax is sufficient (no other table overflows) — PC after fix.
H-5. The 12 px micro scale would survive an A/B bump to 13 px — PC.

---

## 9. Executive summary → see `docs/ui-ux-redesign-recommendations.md`
This audit's findings feed the redesign blueprint in the companion document (sections A–H as required). Detailed evidence per finding lives above; the route-level inspection matrix is in `docs/ui-ux-route-inventory.md`.
