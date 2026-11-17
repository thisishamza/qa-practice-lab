# QA Practice Lab — UI/UX Redesign Recommendations

Companion to `docs/ui-ux-audit.md` (evidence) and `docs/ui-ux-route-inventory.md` (coverage). **This is a proposal for a subsequent redesign; nothing here was implemented. Existing functionality, routes, and the technical architecture must all be preserved.**

Constraints honored: no source/CSS/token changes in the audit session; every proposal below is scoped to a later, separately authorized redesign phase; no route deletions required (renames are label-only); server architecture, D1, Functions, OpenAPI, hunt engine untouched.

---

## A. Executive summary — the five biggest problems

1. **The platform never tells the truth about itself.** Stale copy on at least six surfaces (Dashboard hero, Tracks, Tracks detail, About, Recommended path, nav descriptions) claims most content "is not runnable yet" while 39 of 53 catalogue scenarios are READY, 10 hunts + 96 lab exercises are live, and production has shipped three labs. (F-003, F-016.) Fix the copy source-of-truth first — trust collapses when the UI contradicts reality.
2. **First-time users face a flat, undeclared 15-destination sidebar with no journey model.** "Learn" vs "Workspace" groups lab catalogues, the commercial target app, records, reference and meta into one undifferentiated strip. (F-001, F-009.)
3. **"What should I do next?" is answered three times, differently, and none of them matches the user's real state.** Dashboard start-path ≈ Practice available-now ≈ Recommended path — static copies of the same three steps. (F-002.) The real answer (server-side progress) is buried on the one page that is an unstructured wall of ~250 rows. (F-007.)
4. **Visual system is a single grammar (bordered card + 12 px mono uppercase) applied everywhere.** No tonal distinction between action/result/meta; density tokens optimized for engineers, not learners; attention is uniformly distributed so scanning fails. (F-008, F-013/§4.)
5. **A known, unfixed mobile breakage ships in the same build as a beautiful dark theme**: `/api-reference` overflows every phone by ~170–186 px (F10), and lab hub instructions render with missing word separation (F-005) — two "unfinished edges" that users read as "unfinished product". (F-006, F-005.)

Bonus systemic observation: this is fixable without a design system replacement. The token layer, theming, a11y primitives and page chrome are sound; the redesign is an *information hierarchy* project wearing a CSS costume.

---

## B. Proposed information architecture & navigation hierarchy

Principles: (1) groups mirror the learner's journey, not the org chart of features; (2) every nav verb maps to one primary action; (3) keep all URLs; labels may change; (4) max two levels in the sidebar; (5) top bar is for global facts (brand/home, site search, cart+account as one "Practice app" cluster, theme).

```
START
  Overview            — your real next step (server-driven), what this is, 60-second intro
  Learning paths      — 12 tracks + the recommended path (absorbs Tracks + Practice stepper)
PRACTISE
  Exercises           — ONE catalogue, faceted by skill/track/level/status; includes all 151 exercises & 53 scenarios (route stays /scenarios until an /exercises decision is made — do not ship two catalogues)
  Guides              — 11 guides
LABS  (the workbenches — each entry = one concrete action with a verb)
  Shop (Meridian)     — the app under test: browse → cart → checkout → account (cart badge lives only here)
  API console         — send your first request        (was API Lab)
  API reference       — read the contract             (keep; phone overflow fixed)
  SQL playground      — query the snapshot            (was Database → SQL)
  Contract testing    — validate / diff / verify      (hub)
  Performance testing — measure the first-byte budget (hub + bounded runner)
  Security testing    — break it safely               (hub + inert demos)
  Microservices & events — trace the pipeline          (hub + simulator)
MY WORK
  Bug hunts           — active hunt, start/reset, attempts (absorbs /practice)
  Progress            — attempts, scores, discoveries (gets a priority "Do this next" card)
  Account             — sign in / synthetic profile
UTILITY (visually separated, bottom)
  About & scoring     — rubric, evaluation transparency, durability notes, version/build
```

Structural rules for the redesign:
- Sidebar sections get icons + a count of live items for Exercises/Labs ("8 ready", calm numeric badge, not decorative).
- Staff gate unchanged.
- Mobile drawer = same groups, collapsible (`<details>`-style sections with counts) — no more 400-screen scroll.
- Every non-root page gets a breadcrumb (`Dashboard / Labs / SQL / sql-bgn-…`); meta pages too (F-011).
- Search scope: scenarios + exercises + guides + labs (or relabel to "Search exercises…"); shortcut `/` kept; `Esc` clears (kept).
- Route changes: **none required**. Optional additive `/exercises` later as an index that redirects to `/scenarios?…` — defer.
- Renames (label-only): `Catalog`→`Exercises`; `Practice`→ folded into `Bug hunts` (route `/practice` may remain as a redirect/alias for one release, or keep `/practice` as the Bug-hunts page itself — URL unchanged, label becomes "Bug hunts"); `Progress` description → "Your attempts, scores and discoveries"; `Overview` description → "Your next step in the lab".

### Recommended page-level hierarchy (per page template)

```
Breadcrumb (mono, 12 px)
Eyebrow (mono 12 px, role of the page)      ← keep, one per page
H1 (32–36 px)                               ← keep
One-line purpose (muted, 16 px, max 75 ch)  ← keep
PRIMARY ACTION — one solid button + ≤1 secondary (where applicable)
THE WORK — two columns: [context/instructions | controls] on xl, stacked below 1024 px
RESULTS — sunken/inset panel, results vs inputs visibly distinct
TEACHING ASIDE — collapsed by default ("How scoring works · Hints · Rubric")
```

---

## C. Visual hierarchy & readability improvements

1. **Raise the floor on text size.** `--text-body` stays 1rem but kill 12 px as a *structural* size: kickers/fact-keys/stats/table-headers move to 0.8125–0.875rem (13–14 px) weight 600; reserve 0.75rem for captions and counts only. Add `--text-h1` bump on lab hubs (2.25rem) since those pages are tool UIs.
2. **Two-surface grammar.** Raised (`--surface`, 1px border, no shadow) = actions/inputs; **sunken** (`--surface-sunken` or `--canvas`) = results/reference/inline code; **inset tinted** (`--surface-selected`) = selected/active; **dark panel** (`[data-surface="workspace"]`) = technical workbenches only (SQL editor, API response, simulator log) — already correct, now *mandatory* grammar, documented in the component spec.
3. **One primary CTA per view** (solid dark); all other actions = secondary outline or ghost. Shop "Add to cart" stays solid; lab hubs "Open the workbench" becomes the sole solid button; exercise cards use text-links.
4. **Density variants, not more spacing everywhere:** add `data-density="compact|cozy|spacious"` on list containers; default cozy; compact for exercise rows; spacious for reading pages. Widen text measure on prose (keep 66 ch) but reduce card padding instead of growing font.
5. **Rhythm:** enforce 8 px baseline inside cards (tokens exist); consistent `--panel-gap`; remove per-page ad-hoc gaps.
6. **Scan rails:** section headers (`SectionHeader`) gain an optional `action` slot pattern usage so every section has ≤1 text-link "All X →"; results sections get an "inset" background so input/output split is pre-attentive.
7. **Color discipline:** keep the palette; change only `--green-700` → `#146c34` (fix F-014) and reserve `--warn` for real warnings (Today: `--warn-soft` callouts used for hints — recast hints as `info`/neutral or a dedicated `hint` tone so amber always means "caution"). No new hues.
8. **Icons:** normalize to two optical sizes (16/20) and one stroke width; audit the hand-drawn set against a single grid — do **not** add an icon dependency in the redesign phase without maintainer sign-off (Phosphor only if approved).
9. **Tables:** API-reference endpoint cards become a CSS grid `grid-template-columns: minmax(0,1fr) minmax(0, 2fr)` with `.table-scroll { overflow-x:auto }` wrappers; fixes F10 as a byproduct of the two-surface grammar (tables = sunken surface).
10. **Progress page structure:** summary tiles → "Do this next" card → collapsible sections per lab with completion rings; search/filter (status/track/result); recent submissions to 10 items with "View all" link. Evidence of need: `progress-1440-light.png`.

---

## D. Onboarding & first-time-user experience

Current state: none — a new guest lands on a dashboard that assumes domain fluency and immediately contradicts itself (F-003). Required elements (all local, all optional, no account required, dismissible with persistence key `qa-practice-lab-onboarding-v1`):

1. **"What is this?" callout (first visit only):** one paragraph — "Practice testing an original fictional shop and 151 scored exercises; find seeded bugs in bug-hunt mode; get deterministic scores; no real systems touched." Two links: *How scoring works* (→ `/about#evaluation`), *Start the 15-minute path* (→ recommended path).
2. **Start path** rebuilt as the page's primary content (3 steps, each with est. time, current completion state from `GET /api/v1/practice/progress`, and a single continue button — step 1: read the manual-testing guide; step 2: start the cart-totals hunt; step 3: file your first report). Remove duplicates from `/practice`.
3. **Bug-hunt mode explainer** on first hunt start (not on every page): modal or inline callout — "The shop you see will misbehave on purpose. Your job: find it, evidence it, report it. Reset anytime; nothing you break is real." Confirm button *is* the hunt start (no second click).
4. **Persistent rubric access:** every wired hunt panel and every scored exercise embeds a compact "How this is scored" disclosure (10 checks / verdict bands / discovery vs report quality — existing copy, shortened). Currently lives only on scenario pages/About.
5. **Empty-state onboarding:** fresh `/progress` shows "No attempts yet — your first hunt takes ~15 minutes" with the CTA, not five zeroed sections.
6. **Guest durability note** at point of decision (Progress header + Account): "Guest progress lives in this browser for 7 days. Sign in to keep attempts permanently."
7. **Sign-in nudge** at natural moments (after first scored submission, after completing step 2 of start path) — never on arrival.

---

## E. Shared components to improve or consolidate

| Component / pattern | Action | Notes |
|---|---|---|
| `LabHub` + `ContractHubPage` + `DatabaseHubPage` | **Consolidate to one** `LabHub` (or a `LabLayout` + slots) | Fixes F-005 (single place for the steps list markup incl. explicit space/punctuation), removes triple drift (F-007.3 design-system §7) |
| `StepsList` (numbered guided steps) | **New shared component** | Dashboard start-path, Practice available-now, lab how-to-practice, onboarding steps — one implementation, state machine for complete/current/locked |
| `PageHeader` | Constrain roles: eyebrow ≤ 12 px caps *muted*, h1 2–2.25 rem, max 75 ch description, actions right-aligned; optional `kickerBelow` for breadcrumb | Reduces the "three loud lines" issue |
| `ModeBanner` | Add `tone="hint"` explainer slot; keep role="status"; verify SR output (PC) | Discovery aid without new page |
| `Tag` / status chips | One component, 4 tones (ready/planned/in-design/done); fix green contrast (F-014); min 12.5 px | Pre-attentive status everywhere |
| `Card` / `Panel` | Formalize raised vs sunken variants in CSS only; refactor `.panel`, `.start-step`, `.recommended-step`, `.hunt-card` to them | No behavior change |
| `useProgress`-powered `ProgressDashboard` | Rebuild sections from shared `StatTile`/`ProgressBar`/`Tag`; add `Collapsible` primitive | Fixes F-007 structurally |
| `Navigation` items | Rename labels/descriptions per §B (data change only); add `hint` field for two-line drawer items | No structural change |
| Search | Extend `catalog.ts` filter or namespace-search across `guides`, `labExercises`, `scenarios` | Powers unified Exercises index |
| `Footer` | "Preview build" → "QA Practice Lab · v0.2.0 · changelog" link to About | P3 but cheap |

Consolidation rule: delete no API; reduce *page-level* bespoke markup; every new component must render server-safe SSR markup for tests (existing pattern).

---

## F. Pages needing significant redesign vs targeted fixes

**Significant redesign (information-first, not cosmetic):**
1. `/progress` — restructure around "Do this next" + grouped/collapsible lab sections + search (F-007, F-011).
2. `/practice` — merge into Bug hunts (label/copy change; URL stays) or delete the route's duplicated stepper; hunt list reuses catalogue grid (F-002).
3. `/scenarios` catalogue — grouped/faceted default view; pre-attentive status (F-007, §4.3.2); possibly two-pane on xl.
4. Dashboard (`/`) — hero truth fix + single start-path w/ real progress + "what this is" (F-003, F-010, D-1).
5. `About` — split into "About & scoring" (rubric, durability) and release notes; delete stale future copy; keep the excellent rubric prose (F-016).
6. `/api-reference` — F10 fix + card→grid redesign; add jump-to-group index (sticky, desktop).

**Targeted fixes (surgical):**
- All lab hubs — LabHub consolidation (F-005); spacing/rhythm tweaks only.
- Tracks + TrackDetail + RecommendedPath + navigation.ts — copy sweep to one honest registry (F-003, F-009).
- TopBar — cart badge placement within a "Practice app" cluster; search placeholder (F-015, F-021).
- `/checkout`, `/cart`, `/shop`, `/account*` — mostly keep; minor: move cart badge, account empty-state durability note.
- `ModeBanner` — hint slot + copy check.
- 404 page — keep; optionally add three popular links.
- `base.css` focus/selection/reduced-motion — keep as is (verified good).

**Do not touch:** SQL playground (pattern-setter), microservices simulator, contract workspaces, security demos, checkout empty states — these are the best-designed surfaces; changes risk regressions.

---

## G. Prioritized redesign roadmap (by user impact, with dependencies)

Rule: no new dependencies unless maintainer approves per phase; each stage = its own milestone with `npm run check` + browser matrix; **functionality frozen**.

**R1 — Truth & breakage sweep (P1, no structure change).**
 R1.1 Copy honesty registry (single `src/data/platformFacts.ts` driving Dashboard/Tracks/About/RecommendedPath/nav) — fixes F-003, F-016 partially. Dep: none.
 R1.2 LabHub consolidation + missing-space fix — F-005. Dep: none.
 R1.3 F10 / `/api-reference` overflow fix + tables→grid + `.table-scroll` everywhere — F-006. Dep: none. (Maintainer chose to accept F10 earlier; this roadmap assumes a redesign phase is authorized — see Out-of-scope note.)
 R1.4 Green contrast + heading-skip + tag tone fix — F-014, F-013. Dep: none.
 Exit: manual matrix 390/375; screenshot set refreshed.

**R2 — Navigation & IA (P1, depends on R1 copy being honest).**
 R2.1 Sidebar/drawer regroup into Start/Practise/Labs/My work (+ new icons); breadcrumbs everywhere; label renames incl. UK spelling — F-001, F-009, F-011. Dep: R1.
 R2.2 Search scope extension + Exercises unified index (route reuse `/scenarios`); both themes. Dep: R2.1.
 R2.3 Dashboard rebuild: truthful hero, real start-path w/ progress completion, "What is this?" callout v1 — F-002, F-003, D-1..D-3. Dep: R1, R2.1.
 Exit: first-time task test (scripted, not human) re-run of §3 tasks 1–5; trace doc updated.

**R3 — Structure of practice & progress (P1/P2).**
 R3.1 Progress page rebuild ("Do this next" + collapsibles + filter) — F-007. Dep: R2.1.
 R3.2 `/practice` → Bug hunts consolidation; remove duplicate stepper; hunts grid parity with catalogue — F-002. Dep: R2.3.
 R3.3 Scenario catalogue redesign (facets, pre-attentive status, grouping; grid 3-up with expandable rows) — F-007. Dep: R2.2.
 R3.4 About split: About & scoring / What's new — F-016. Dep: R1.
 Exit: all §3 tasks pass; screenshots; perf budget unchanged.

**R4 — Visual system polish (P2/P3).**
 R4.1 Two-surface grammar + solid-CTA constraint + results inset panels — F-008. Dep: R1–R3 stable.
 R4.2 Type-floor raise (kickers 13 px; table headers 12.5–13 px) + density variants — §C.1/4. Dep: R4.1.
 R4.3 Icon size normalization (no new package); footer v0.2.0; 404 popular-links. Dep: none.
 R4.4 `--surface-selected` review in dark; empty-state durability notes — F-017.
 Exit: AA contrast re-measure; reduced-motion manual pass; 5-viewport × 2-theme matrix clean.

**Sequencing rationale:** R1 removes lies and breakage (unblocks trust), R2 fixes wayfinding (removes disorientation), R3 fixes the two daily-loop pages, R4 is polish. Dependency-free items (icon norm, footer) may slot anywhere. Each Ri is independently shippable and reversible; no route deletions anywhere; `/practice` redirects or remains an alias.

**Rough effort:** R1 ≈ 2–3 sessions; R2 ≈ 3–4; R3 ≈ 4–5; R4 ≈ 2–3. (Indicative only — not estimates for commitment.)

---

## H. What should NOT change

1. **Routes, URLs, deep links, 404 behavior** — public contract; only labels/copy change; optional additive `/exercises` deferred indefinitely.
2. **Design token architecture** (primitives → semantic → workspace scope) — extend, don't re-platform.
3. **Dark theme via `[data-theme]` + `ThemeProvider`/`applyTheme`/bootstrap meta sync** — verified consistent.
4. **`[data-surface="workspace"]`** technical panels — semantics are good; simulator/SQL/editor stay dark in both themes.
5. **Self-hosted IBM Plex Sans + JetBrains Mono**, `font-display: swap`, no preload hacks.
6. **Focus-visible global ring, skip link, sr-only utility, forced-colors + reduced-motion blocks** — keep verbatim.
7. **Hand-written CSS (no Tailwind/shadcn)** and current file layering.
8. **Mobile drawer focus trap + WAI Modal** pattern.
9. **Empty states** (checkout, SQL, simulator, cart) — best writing on the site.
10. **Server-side scoring/rubric transparency** (`EvaluationTransparency`, `/about#evaluation`) — substance is excellent; only placement/copy surfacing changes.
11. **Mode banner semantics** (role="status", icon+text, reset-to-clean).
12. **Search shortcut `/`** and Escape-clear; cart badge aria pattern; account menu aria pattern.
13. **localStorage keys** (`qa-practice-lab-theme`, `qa-practice-lab-sidebar-collapsed`) — migration-free.
14. **Single h1/page discipline; landmark skeleton; `main#main-content` + skip link contract; `tabIndex={-1}`** — verified conformant; preserve.
15. **Checkout/shop copy** ("nothing is paid for or shipped") — model for honest microcopy; reuse voice.
16. **The `/` shortcut & button vocabulary** (`Hunt controls` on banner) — rename only if R2.1 lands.
17. **OpenAPI/API-reference data-driven architecture** — keep; fix presentation only.
18. **Functions/D1/schema/migration process** — entirely out of scope; no migrations in any Ri.

---

## Out-of-scope / explicitly deferred

- F10 acceptance: maintainer accepted it as pre-existing maintenance defect on 2026-11-17. R1.3 assumes a *separately authorized* redesign; if only maintenance is authorized, fix F10 only and skip R2–R4.
- Accessibility re-test with real SR (NVDA/VoiceOver) and 200% zoom after R2/R3.
- Icon library adoption, `/exercises` route, any design-system package.
- Any production deploy/merge/migration — each redesign milestone needs its own authorization per repo policy.

## Report metadata
- Audit inputs: rendered sweeps @ 1440/1280/768/390/375 × light/dark; 41 screenshots in `docs/audit-screenshots/`; source inspection; in-page probes. No human participants. No changes applied.
- Deliverables: this file + `docs/ui-ux-audit.md` + `docs/ui-ux-route-inventory.md` + `PROJECT_STATE.md` audit entry.
