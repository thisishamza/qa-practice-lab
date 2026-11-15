# Phase 2.5 — UI/UX Audit & Redesign Plan

> **Status:** Audit complete. No application code changed. Implementation is paused pending approval.
> **Date:** 2026-11-15
> **Scope:** The ten implemented routes (`/`, `/tracks`, `/tracks/:trackId`, `/scenarios`, `/scenarios/:scenarioId`, `/guides`, `/guides/:guideId`, `/progress`, `/practice`, 404) and the shared shell, at 375 / 768 / 1024 / 1440 px in light mode, plus dark-theme captures of the dashboard, catalog, guide detail, and practice page.
> **Companion state:** `PROJECT_STATE.md` §11 contains the matching log entry and the exact next action.

---

## 0. Executive summary

The Phase 2 interface is functional, accessible in its bones, and clearly built with care (skip link, semantic landmarks, labelled filters, `aria-current`, reduced-motion support, no horizontal overflow). The problem is not that it is broken; it is that it looks and reads like a **generic AI-generated SaaS dashboard** rather than a professional testing-and-engineering learning environment.

Seven systemic problems drive that impression:

1. **No real typeface is loaded.** `Inter` and `JetBrains Mono` are declared but never fetched; `document.fonts.size` is `0`, there are zero font requests, and both names measure identically to the fallback. Typography therefore changes per operating system, which undermines any visual identity.
2. **Everything is too small.** The app uses **33 distinct font sizes**, **26 of them below 16 px**; badges are 10.56 px, stat labels 10.88 px, track fact labels 9.92 px, TOC titles 10.24 px. Body copy starts at 15 px and guide prose is 14.72 px.
3. **The palette is decorative instead of semantic.** Indigo + cyan gradients, 12 arbitrary track-icon hues, and six badge tones make "orange" mean *advanced*, *bug hunt*, *warning*, and *in progress* at the same time. A catalog card carries three coloured pills, producing 72 pills on one page.
4. **The visual language is "landing page inside a dashboard."** A 53.6 px gradient hero, three feature checkmarks, an "Available now" stats panel, and four stat cards repeat the same counts (12 tracks / 24 scenarios / 6 guides) three times on one dashboard. Creator/phase metadata ("Phase 2 preview", "Phase 2 · v0.2.0", "What is real right now", `npm run db:migrate:local`) appears inside the learner product.
5. **Wayfinding and state are not engineered.** Top-bar "search" is a link with a fake `/` shortcut. Catalog filters live in `useState`, so Back returns all 24 cards and deep links can't carry a query. There is no scroll restoration (measured: scroll 1600 px → new detail page opens at 140 px, clamped) and focus falls to `<body>` after navigation. Category cards all link to the unfiltered catalog.
6. **Mobile and tablet are stacks, not designs.** The catalog is **7,631 px** tall at 375 px, the dashboard **6,739 px**. The guide TOC and facts panel render **below** the 2,133 px article below 1180 px (TOC top at 2,581 px). The mobile drawer lets focus escape into the page, does not make the background inert, and does not return focus to the trigger.
7. **Component boundaries fail contrast.** `--line` is 1.21–1.30:1 against the page and input surfaces (3:1 is required for UI component boundaries). The dark theme repeats this at 1.33–1.48:1, and the "dark mode" is a naive inversion rather than a purposeful workspace palette.

**Recommended direction (approved in principle: C. Hybrid):** a light-first **"test bench"** interface — precision typography, hairline rules, one restrained accent family, data labels in mono, and almost no shadows or gradients — with a **dark technical workspace surface** for API consoles, SQL, logs, and debugging. Dark theme mode adopts the same workspace palette so the product has one dark language, not two.

The redesign is achievable **without Tailwind, shadcn, or any UI framework**; it needs a token rewrite, two self-hosted fonts, a component pass, and page-level information-architecture changes. Estimated effort: **8 small milestones**, sequenced so foundations land before pages are restyled twice.

---

## 1. Method and evidence

### 1.1 What was inspected

- Every route, layout component (`AppShell`, `TopBar`, `Sidebar`, `MobileNav`), UI primitive (`Icon`, `Badge`, `DomainBadges`, `PageHeader`, `PageChrome`, `ProgressBar`, `StatCard`, `States`, `Callout`, theme components), feature component (`TrackCard`, `ScenarioCard`, `ScenarioFilterBar`, `GuideCard`, `HealthStatus`), all page components, all `src/data` content, `src/lib` logic, and all five stylesheets (2,681 lines of CSS).
- `PROJECT_STATE.md` and `AGENTS.md`, including the current-state, safety, and UI-skill rules.
- The installed `ui-ux-pro-max` skill (project-level, `.opencode/skills/ui-ux-pro-max/`), invoked with the `skill` tool and queried through its Python CLI.

### 1.2 Runtime evidence

The production build was served with `wrangler pages dev dist --port 8788` (`/api/health` returned `200`, `version: 0.2.0`, `database: ok`). A Playwright/Chrome script then:

- captured 48 screenshots (40 route captures at 1440, 1024, 768, and 375 px, plus 8 dark-theme variants of dashboard, catalog, guide detail, and practice);
- counted computed font sizes, weights, radii, shadows, badge tones, and visible link names;
- measured interactive target sizes;
- sampled computed foreground/background/border colours and calculated WCAG 2.x contrast locally;
- probed filter persistence, Back behaviour, scroll position, focus after route change, theme toggling, mobile-drawer focus order, and overflow.

The measurement script lives at `/tmp/qa-audit-capture.cjs` (ephemeral). If we want it reproducible, it should become `scripts/audit/capture-ui.mjs` in Milestone 8; committing it is a separate decision.

### 1.3 Skill guidance used (advisory, adapted to this repo)

| Query | Result used |
|---|---|
| `--design-system "developer education platform software testing technical"` | FAQ/Documentation Landing pattern; developer-tool palette family (slate + green); JetBrains Mono + IBM Plex Sans |
| `--design-system "online learning platform technical courses dashboard"` | Feature-rich showcase hierarchy, flat design, one key message per card |
| `--domain typography "developer mono technical documentation"` | **Developer Mono**: JetBrains Mono (code) + IBM Plex Sans (UI/body) |
| `--domain color "api developer portal"` | **API Developer Portal / Developer Tool**: `#0F172A`/`#1E293B` canvas, `#22C55E` run accent, `#334155` borders |
| `--domain ux "reading typography line length measure"` | 65–75 characters per line; 1.5–1.75 line height |
| `--domain ux "modal dialog focus trap keyboard"` | Visible focus inside dialogs; focus not obscured by sticky UI |
| `--domain ux "dashboard information hierarchy density"` | Sequential heading levels; no redundant entry; breadcrumbs for 3+ levels |
| `--domain chart "learning progress completion"` | Waffle / bullet / 100% bar for proportion; never colour-only; numeric fallback |

Skill output is recommendation, not authority. It was checked against this repo's constraints: **hand-written CSS, design tokens, no Tailwind/shadcn, desktop web first, no icon package installed, no runtime AI dependency.** App-UI-only guidance (safe areas, haptics, 44/48 dp) was ignored except where it maps to web target sizes.

### 1.4 Limitations

- No moderated usability testing or screen-reader session was run; findings are heuristic + measured. A keyboard/screen-reader pass is scheduled in Milestone 8.
- Content is static, so loading states are mostly latent. The audit judges the *patterns* (`LoadingState`/`ErrorState` exist but are unused; no route error boundary).
- Font measurements are from Linux Chrome. That strengthens rather than weakens the finding: the declared fonts are not shipped, so rendering differs by OS.
- No Phase 3 surface exists; the dark workspace recommendation is a token/pattern foundation, **not** an invitation to build the API console now.

---

## 2. What is working and must survive the redesign

- **Shell semantics:** one `<main>`, labelled `<nav>` regions, skip link as first tab stop, `aria-current="page"` on nav items, `aria-expanded`/`aria-controls` on the mobile trigger.
- **Theme bootstrap:** the inline `index.html` script applies `data-theme` before paint; there is no flash of wrong theme. `localStorage` persistence works, and the toggle updates its accessible name.
- **Filter semantics:** `role="search"`, real `<label>` elements, native selects, a result count with `aria-live`, disabled reset, and a genuine empty state with a recovery action.
- **Content model:** typed tracks/scenarios/guides, pure filtering logic, and content-integrity tests. Scenario/card facts are derived from data, not hard-coded copy.
- **Honesty:** every non-runnable scenario is labelled, progress is explicitly demo data, and safety boundaries are documented in-product. This is a trust asset; the redesign should make it quieter, not remove it.
- **Responsive baseline:** no horizontal overflow at any tested width; `prefers-reduced-motion` is honoured; body text contrast passes AA; zoom/reflow has a usable base.
- **404:** helpful, with real recovery links rather than a dead end.

---

## 3. Findings

Severity: **P0** = blocks a professional/accessible release; **P1** = clearly degrades the experience; **P2** = polish/consistency.

### F1 — The visual identity reads as generic AI SaaS (P0)

| Evidence | Why it matters |
|---|---|
| Indigo `#4f46e5` + cyan `#0e7490`, a purple→indigo gradient headline, and fixed radial-gradient glows on `body` (`base.css`) | The exact palette/effect combination associated with generated dashboards; it communicates "template", not "testing instrument" |
| 12 track icon hues (`#6366f1`, `#0e7490`, `#8b5cf6`, `#2563eb`, `#059669`, `#b45309`, `#ea580c`, `#e11d48`, `#0284c7`, `#c026d3`, `#0d9488`, `#db2777`) | Colour carries no meaning; a dozen hues compete with status colours and make every card equally loud |
| 152 fully rounded (`999px`) elements across nine pages; five radii (6/9/13/18/24 px) used almost interchangeably | "Pill everything" plus inconsistent rounding reads soft/consumer, not precise/technical |
| 84 card shadows at `0 1px 2px rgba(16,24,40,.05)`; cards inside cards inside gradients | Low-value elevation makes hierarchy mushy; panels should be separated by rules and surface changes |
| Hero feature checklist ("Typed, reusable…", "Search and filters…", "Keyboard-friendly…") | These are implementation claims to the developer, not learner outcomes |
| "Structure first" promo card in the sidebar | Product marketing/dev note occupying permanent navigation space |

**Recommendation:** replace the SaaS gradient language with a **test-instrument language**: near-neutral canvas, white surfaces separated by 1 px rules, one near-black action colour, one run-green signal colour, mono micro-labels, and no card shadows. Keep exactly one decorative device (a thin accent rule or indexed section label). See §4–§6.

### F2 — Typography is undeclared, inconsistent, and undersized (P0)

**No webfont is loaded.** The CSS declares `"Inter"` and `"JetBrains Mono"` first, but:

- `document.fonts.size === 0` (no `@font-face` registered);
- zero font/`.woff` requests on any route;
- canvas measurements for `Inter`, `JetBrains Mono`, and `IBM Plex Sans` are **identical** (143.51 px for the same string), i.e. all resolve to the platform fallback;
- the fallback chain includes proprietary `"Segoe UI"`, `system-ui`, and `Helvetica Neue`, so macOS, Windows, and Linux render differently.

**Size inventory across nine routes:** 33 distinct computed sizes. The 26 below 16 px include:

| Size | Count | Typical use |
|---|---|---|
| 9.92 px (0.62rem) | 55 | track fact labels, status badge, collapsed sidebar labels |
| 10.24 px | 20 | guide TOC title |
| 10.56 px | 146 | **all badges**, filter labels, eyebrow variants |
| 10.88 px | 11 | stat labels |
| 11.68 / 11.84 px | 121 | card meta, breadcrumb variants |
| 12.8 / 13.12 px | 277 | card summaries, panel notes |

**Weights** are `400/500/550/600/650/700/750/800`; the 550/650/750/800 values only behave predictably with a variable font. With no webfont loaded they snap to platform approximations.

**Measure:** guide prose is 14.72 px in a 623 px column — **≈89 characters**, outside the skill's 65–75 character guidance. Body copy is 15 px/1.6, which is below a comfortable reading size for long-form learning content.

**Headings:** page `h1` is 43.2 px on every inner page; dashboard `h1` is 53.6 px and takes two lines at 1440 px (three at 375 px). Oversized headings push real content below the fold and flatten hierarchy (h1 43 px vs h2 19 px vs card h3 15.7 px).

**Recommendation:** ship one UI sans + one mono, base 16 px, five-step heading scale, 12 px minimum for labels, 14 px minimum for meta, 16 px/1.7 prose at 66–72 ch, max h1 32–36 px on inner pages. See §6.

### F3 — Component boundaries fail contrast (P0)

Computed ratios (WCAG 2.x formula, sRGB):

| Pair | Ratio | Requirement | Result |
|---|---|---|---|
| `--line #dde2ee` on white | **1.30:1** | 3:1 for UI component boundaries | Fail |
| `--line` on `--bg #f6f7fb` | **1.21:1** | 3:1 | Fail |
| input surface `#f6f7fb` vs 1 px `--line` border | **1.21:1** | 3:1 | Fail |
| `--line-strong #c6cede` on white | **1.58:1** | 3:1 | Fail |
| dark `--line #233052` on `--surface #111a2e` | **1.33:1** | 3:1 | Fail |
| dark input surface vs border | **1.48:1** | 3:1 | Fail |
| `--muted #5b6580` on `--bg` | 5.42:1 | 4.5:1 text | Pass |
| badge-success text on soft | 4.53:1 | 4.5:1 at 10.56 px | Barely passes |
| badge-warning text on soft | 4.51:1 | 4.5:1 at 10.56 px | Barely passes |

The problem is not text legibility (body text is fine); it is that **input, select, card, and panel edges become invisible** for low-vision users and in bright environments, and focus/hover affordances rely on those edges. It also makes the UI look flat in a way that reads as unfinished rather than intentional.

**Recommendation:** separate **decorative hairlines** (`--border`, allowed below 3:1) from **interactive boundaries** (`--border-strong`, ≥3:1 on both white and canvas). Inputs/selects/buttons get the strong border (and a 2 px focus ring). Cards may use the hairline because their clickable target is an inner link with its own affordance.

### F4 — Colour semantics are overloaded (P0)

`DifficultyBadge` maps beginner→green, intermediate→cyan, advanced→amber. `ModeBadge` maps clean→indigo, bug-hunt→amber. `StatusBadge` maps planned→neutral, in-design→cyan, ready→green. Consequences:

- amber means **advanced**, **bug hunt**, **warning**, **demo data**, and **in progress**;
- green means **beginner**, **ready**, **success**, **operational**, and **hero checkmark**;
- cyan means **intermediate**, **in design**, **info**, and **operational dot halo**;
- a scenario card displays three pills at once (72 pills on the catalog page), so the most important signal (availability) competes with two taxonomy labels.

**Recommendation:** one **status** colour system only (ready/run = green, in-design = amber, planned = slate), with text and a dot/shape, never colour alone. Difficulty and mode become **plain meta text** (and, for difficulty, a 3-bar meter). Remove the "info/cyan" role entirely.

### F5 — Dashboard is a landing page, not a learner home (P0/P1)

The dashboard renders: hero + feature checklist + availability panel → info banner → 4 stat cards → 6 track cards → 8 category cards → 3 recommended scenario cards → demo progress panel → recent activity → practice panel. Measured height: **3,120 px at 1440**, **6,739 px at 375**.

Specific issues:

- **Triple repetition of the same facts.** The hero aside, the stat cards, and (partly) the track cards all report 12 / 24 / 6.
- **Two disclaimers before any content** (hero note + info banner), then two more "Demo data" badges below.
- **No answer to "what should I do next?"** The primary CTA is "Explore scenarios" (a 24-card wall), not a recommended starting path.
- **Category cards are dead ends.** Every one links to `/scenarios` with no category filter (`DashboardPage.tsx`). The catalog cannot receive a category filter at all (see F8).
- **Demo panels outrank real content.** Recent activity and progress take two full sections despite being sample data; the actual curriculum is below them.
- **Quick practice** duplicates the practice page in a card.

**Recommendation:** a three-zone dashboard — **Start/Continue**, **Curriculum** (compact track rows), **Catalogue** (one summary line + 3 starting scenarios). Move demo progress to `/progress`; move categories into the catalog; remove the feature checklist and one of the two disclaimers.

### F6 — Navigation and wayfinding gaps (P0/P1)

| Issue | Evidence |
|---|---|
| **Fake search** | `.topbar-search` is a `<Link>` to `/scenarios` with a visible `<kbd>/</kbd>`; no `/` handler exists anywhere in `src`. It promises a shortcut and a search field that do not exist. |
| **Dev chrome in product** | `env-pill` "Phase 2 preview" in every top bar; footer "Phase 2 · v0.2.0"; sidebar promo card; "What is real right now" panel; health error tells learners to run `npm run db:migrate:local` and mentions port 8788. |
| **No scroll restoration** | Navigating from catalog at scroll 1600 px opens the detail page at **140 px** (browser clamp, not a reset). Detail pages should start at the top. |
| **Focus lost on navigation** | After clicking a card, `document.activeElement` is `<body>`; SPA route changes are silent to keyboard and screen-reader users. |
| **Breadcrumb truncation** | `[aria-current]` is limited to 46 ch with `text-overflow: ellipsis`; long scenario titles read "Verify cart totals across quantity and discount cha…". |
| **Tablet breakpoint cliff** | Sidebar persists to 981 px, disappears at 980 px, while `--content-max` is 1180 px. At 1024 the content column is ~760 px and the 4-column filter row truncates the mode select ("Clean and bug hu…"). |
| **Sidebar dead space** | 6 links + promo card occupy ~340 px of a 950 px column; below that is empty. The collapsed state replaces section headings with "—". |
| **No active TOC state** | Guide TOC links never receive `aria-current` or a visual active state; all seven are identical at all scroll positions. |
| **Category links carry no context** | All 8 dashboard categories → `/scenarios`. |

**Recommendation:** real search in the top bar (submits `?q=`), implemented `/` shortcut (or remove the hint), detail breadcrumbs in the content column with middle-truncation, sidebar at 240 px with a utility footer, no dev chrome in chrome, scroll-to-top + focus-to-h1 on route change, scrollspy TOC. See §8 and §10.

### F7 — Component consistency and duplicated content (P1)

**Duplication inside pages:**

- Scenario detail: badges in the header repeat Difficulty/time/category; the facts panel repeats them again; the amber callout repeats the "Not runnable yet" status already shown in the panel write-up.
- Track detail: meta row (difficulty, planned, listed, categories) repeats the three fact rows in "Track facts"; "Level" appears both as a badge and a fact row on cards.
- Guide detail: level, reading time, and concept/step counts appear in the meta row and again in "Guide facts".
- Progress: four stat cards say "(demo)" while the section headers add "Demo data" badges and a page-level warning.

**Component-level:**

- One `.badge` serves taxonomy, status, metadata, and count chips — six tones, one shape, no semantic distinction.
- `StatCard` hard-codes the accent icon treatment, so every stat looks equally important.
- `.card-foot-link` ("View scenario", "Open track", "Read guide") is added to every card, duplicating the title link. Link-name audit: **24 × "View scenario"**, **12 × "Open track"**, **6 × "Read guide"**.
- Five radii, 152 pills, three near-identical "icon square" sizes (1.9 / 2.0 / 2.1 / 2.2 rem).
- `EmptyState` exists only on the catalog; `ErrorState` and `LoadingState` are mounted nowhere; there is no route error boundary. The one live async surface (`HealthStatus`) reimplements its own states.
- No shared `Button` component: `.button`, `.button-secondary`, `.button-ghost`, `.button-small` are applied ad hoc; `button-small` links (38 px tall) look like tags.

**Recommendation:** a small explicit primitive set (Button, IconButton, Tag, StatusDot, Card, StatTile, Callout, State, TOC, FactList, FilterBar) with one shape language and one semantic tone map; remove duplicate CTAs; make card title + one affordance the accessible target. See §7 and §9.

### F8 — Exercise discovery is harder than the data warrants (P0/P1)

- **Filters are not shareable or persistent.** `ScenariosPage` stores filters in local state; Back returns an unfiltered 24-card list (measured: search "cart" → 5 cards → open → Back → empty search, 24 cards). Deep links cannot express a query, track, difficulty, mode, or status.
- **Category cards cannot filter** (no category prop/route).
- **Track pages cannot deep-link to their scenarios.** "All scenarios" on a track goes to the whole catalog.
- **The catalog is a wall.** 24 visually identical cards, 2,903 px at 1440 and 7,631 px at 375, with no sort, no grouping, and no progressive disclosure. Three pills per card dominate the first line; availability (the only decision-relevant attribute today) is the third pill.
- **Cards are not scannable.** Titles wrap to three lines at 1024; the summary is 0.82 rem; meta wraps unpredictably (`Manual Testing · 35 min` then `Exploratory & bug hunting`), so card heights and CTA positions jitter.
- **Filters are a full-screen form on mobile.** Five stacked controls before the first result; the reset button is 38 px tall; labels are 10.56 px uppercase.
- **No loading/error states** for a future async catalog; no "no results for X" recovery beyond reset.

**Recommendation:** URL-synced state (`q`, `track`, `difficulty`, `mode`, `status`, `sort`), applied-filter chips, category/track deep links, a desktop filter bar in one row, a mobile filter drawer with a sticky "Filters (n)" bar, one status tag per card, and 2-line clamps. Add pure tests for the URL ↔ filter mapping.

### F9 — Progress visualisation is demo theatre (P1)

- Four large stat cards with "(demo)" baked into the labels; a warning banner; two more "Demo data" badges on section headers. The disclaimer outweighs the content.
- Bars show `2/8` but no percentage, no remaining count, and a 6 px track that is hard to read; colour is the only difference between an in-progress and completed bar.
- "What is real right now" is project status, not learner progress; it belongs on an About/Preview page.
- The dashboard duplicates a subset of the same demo progress, so the learner sees the same fake numbers twice with different framing.
- When real progress arrives, the current pattern has no place for "last activity", "next up", or completion dates.

**Recommendation:** until persistence exists, show one clearly labelled **sample preview** on `/progress` with a compact table (track, completed/planned, percentage, state), an explanation of what will be tracked, and a link to the catalog. Remove the progress panel from the dashboard or replace it with a **"Start here" path**. When real data lands, add a summary strip (completed / in progress / streak), track rows with % + counts, and a recent-activity list with dates. Waffle/bullet charts are an option later; bars + numbers are correct now.

### F10 — Mobile and tablet defects (P0/P1)

Measured at 375 px (viewport) / 1024 px:

| Page | Height at 375 | Problem |
|---|---|---|
| Dashboard | 6,739 px | ~9 screens; four stat cards become four full-width rows; hero + banner + stats + six tracks + categories + recommendations + demo + activity + practice |
| Catalog | 7,631 px | filter form consumes the first ~1.5 screens; 24 stacked cards |
| Tracks | 4,981 px | 12 full cards with descriptions, 3-column fact rows, and duplicate CTA |
| Guide detail | 3,920 px | TOC + facts appear **after** the article at ≤1180 px; no way to jump |
| Track detail | 2,796 px | three aside panels after the main content |

- **Tap targets:** topbar menu/theme 35 px, search 31 px, `text-link` 20 px, `card-foot-link` 20 px, "View progress" 20 px, buttons 38 px. WCAG 2.2 2.5.8 requires ≥24 px (with inline-text exceptions); comfortable web targets are 40–44 px. Most navigation targets fail even the 24 px floor.
- **Drawer accessibility:** focus starts on Close (good) but **escapes after six links** (measured: 7th Tab → body, then skip link, then page top bar). The background is not `inert`; `aria-modal="true"` is therefore untrue. After Escape, focus goes to `<body>`, not the trigger. The backdrop is a `<button>` — the first focusable element — so keyboard/screen-reader order is "giant close button, then dialog".
- **Guide layout:** `.guide-aside` becomes `position: static` at 980 px and is placed after the article in DOM order; at 1024 px the TOC starts at 2,581 px while the article starts at 421 px.
- **Tablet filter truncation:** the mode select shows "Clean and bug hu…" at 1024 px; labels and selects are cramped in four columns inside 760 px.
- **Two breakpoint systems:** components and layout use different sets (560/640/760/980/1024/1180), producing near-miss widths.

**Recommendation:** standardise breakpoints; mobile filter drawer; TOC as a `<details>` block above the article; compact track rows; collapsible dashboard sections (or remove content); 44 px primary controls / ≥24 px text links with padding; implement the dialog pattern correctly (focus trap + inert + return focus + backdrop as non-focusable element).

### F11 — Accessibility specifics

| # | Issue | Where | Standard/impact |
|---|---|---|---|
| 1 | Interactive boundaries 1.2–1.6:1 | inputs, selects, cards, panels | WCAG 1.4.11 Non-text Contrast (3:1) |
| 2 | Modal focus escapes; background not inert; no return focus | `MobileNav` | Dialog pattern; WCAG 2.4.3 focus order / 4.1.2 |
| 3 | Focus lost to `<body>` on route change; no scroll reset | all route transitions | WCAG 2.4.3; SPA wayfinding |
| 4 | 20–38 px targets | text links, card links, topbar buttons | WCAG 2.5.8 (24 px min); usability 44 px |
| 5 | 24 identical "View scenario" names; 12 "Open track"; 6 "Read guide" | cards | WCAG 2.4.4 context is technically met, but link-list navigation is unusable |
| 6 | `h1 → h3` on catalog/tracks (no `h2`) | `ScenariosPage`, `TracksPage` | WCAG 1.3.1 / 2.4.6 best practice |
| 7 | Whole card grid is `aria-live="polite"` while the count is also live | catalog | Duplicate/verbose announcements; announce the count only |
| 8 | Labels 10.56 px uppercase | filters, stat tiles | Legibility, not a WCAG failure |
| 9 | Badge text 10.56 px at 4.51–4.53:1 | badges | Passes by 0.01–0.03; fragile and hard to read |
| 10 | Guide TOC lacks active state; mobile TOC below content | guide detail | Wayfinding; WCAG 2.4.5 (multiple ways) not violated but weak |
| 11 | No `prefers-contrast`/`forced-colors` handling | global | Progressive enhancement gap |
| 12 | Tooltip-free icon-only controls rely on `aria-label` (okay) | topbar | Keep; no change needed |

Passing today: one `h1` per route, skip link, `lang`, document titles, landmarks, `aria-current` on nav, reduced-motion, no overflow, body-text contrast.

### F12 — States and resilience (P1)

- **No route error boundary.** A future data failure yields a blank screen. React Router 7 `errorElement` would cover this.
- **`LoadingState`/`ErrorState` are dead code.** Only the catalog has an empty state; tracks/guides/scenarios never need one only because data is static.
- **`HealthStatus` is the only async surface** and exposes developer instructions and internal port numbers in an error message. Its "Needs attention" state uses the warning palette and has no retry button.
- **No loading skeleton or stale-while-revalidate pattern** for the future catalog/API. Decide the pattern now so pages don't each invent one.
- **404** is well-formed, but it is the only route with a designed recovery surface.

### F13 — Content and tone (P1)

- Phase/build metadata is treated as product content: "Phase 2 preview" pill, "Phase 2 · v0.2.0" footer, "Structure first" sidebar card, "What is real right now", "A curriculum preview, not a finished course", "Nothing on this page launches an exercise".
- The same disclaimer is repeated 4–5 times on the dashboard/progress pages.
- Hero copy describes the *build* ("This phase builds the learning interface; the practice targets themselves arrive later") instead of the *learner outcome*.
- Empty states/health errors speak developer-to-developer (`npm run db:migrate:local`, port 8788).

**Recommendation:** one **Preview build** notice (dismissible/one line) + an **About this build** page or footer disclosure; learner-facing copy everywhere else; keep the "not runnable yet" status on scenario detail because it prevents wasted effort, but state it once.

---

## 4. Recommended visual direction

### 4.1 Concept: **The Test Bench**

A calm, precise workspace that behaves like a well-maintained engineering instrument:

- **Light-first** for learning: reading, browsing, curriculum, progress.
- **Dark technical surfaces** for runtime work: API console, SQL editor, logs, request/response, debugging, code samples.
- **Rules over shadows**, **labels over decoration**, **numbers over adjectives**.
- The interface should feel like it was designed by someone who tests software: legible, consistent, honest about state, and free of ornament that doesn't carry information.

### 4.2 Principles

1. **One accent family, one semantic system.** Near-black ink for actions; run-green reserved for ready/run/success; amber for in-design/warning; red only for errors. Slate for everything inactive.
2. **Typography first.** Real fonts, 16 px body, a 5-step scale, 12 px minimum labels, 66–72 ch prose. Hierarchy from size/weight/space, not from colour.
3. **Boundaries are information.** Hairlines for grouping, 3:1 borders for interactive edges, 2 px focus rings with offset, no low-contrast "invisible" controls.
4. **Density with air.** Compact data rows, generous section rhythm, one primary action per zone. Remove duplicated facts before shrinking type.
5. **Show state, not status prose.** A dot + label, a percentage + count, a progress rule. One disclaimer per surface, not five.
6. **The product speaks to the learner.** Build/phase metadata lives in an About surface, not in the chrome.
7. **Light and dark are two modes of one system.** Dark = workspace tokens, not a hue-rotated light theme.

### 4.3 Signature elements (no new dependencies)

- **Indexed section labels** in mono: `01 / CURRICULUM`, `02 / CATALOGUE`. Replaces the uppercase indigo eyebrow.
- **Level meter:** three 3 px bars (filled 1–3) beside "Beginner / Intermediate / Advanced". Shape + text; no colour dependency.
- **Status dot + label:** `● Ready` (run green), `◐ In design` (amber), `○ Planned` (slate). Used once per item.
- **Fact rows:** mono key left, value right, 1 px divider — a test-report aesthetic. No nested cards.
- **Workspace panel:** dark surface with a thin header strip (`REQUEST / RESPONSE`, `QUERY`, `LOGS`), mono body, always dark even in light theme. This is the seed for Phase 4–6, not a Phase 3 build.
- **Rule-based callouts:** 3 px left rule + label + copy; drop the full pastel box except for blocking errors.
- **Reading progress rule** at the top of guide pages (1 px, run green), driven by scroll.

### 4.4 What changes at a glance

| Now | After |
|---|---|
| Indigo/cyan gradients, glow, 84 card shadows | Neutral canvas, white planes, hairlines, overlay-only shadows |
| 3 pills per card, 6 tones | 1 status tag + meta text; 3 status tones |
| 12 track hues | 1 ink icon tone; identity from the mark and label |
| 33 font sizes, 10.5 px badges | 5-step scale, 12 px minimum labels |
| Hero + 4 stats + 6 cards + 8 categories + 3 cards + demo panels | Start path + 6 compact track rows + 3 starting scenarios + one line of counts |
| Filter form lost on Back | URL state, deep links, Back/Forward preserved |
| Landing-page copy in chrome | Learner copy; one Preview notice + About build |
| Dark = inverted indigo | Dark = unified workspace palette |

---

## 5. Proposed palette and tokens

All ratios are computed with the WCAG 2.x relative-luminance formula. Values are proposals for approval, not yet applied.

### 5.1 Light theme (learning surfaces)

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--canvas` | `#F6F7F8` | app background | — |
| `--surface` | `#FFFFFF` | panels, cards, inputs | — |
| `--surface-sunken` | `#EEF0F3` | wells, code headers, table stripes | — |
| `--surface-selected` | `#E8EEF9` | selected row/nav (blue-slate, not indigo) | — |
| `--ink` | `#0F1B2D` | primary text, primary buttons | 17.3:1 on white |
| `--ink-muted` | `#4C5768` | body secondary, labels | 7.3:1 on white / 6.8:1 on canvas |
| `--ink-subtle` | `#6B7688` | timestamps, placeholders | 4.59:1 on white |
| `--border` | `#D5DAE1` | decorative rules only | 1.4:1 (allowed) |
| `--border-strong` | `#7C8697` | input/select/button boundaries, dividers with meaning | 3.68:1 on white / 3.43:1 on canvas |
| `--action` | `#0F1B2D` | primary button/active nav | 17.3:1 with white text |
| `--action-hover` | `#1D2E47` | hover | 14.2:1 |
| `--link` | `#1D4ED8` | inline links | 6.7:1 on white |
| `--focus` | `#1D4ED8` | 2 px ring + 2 px offset | 6.25:1 on canvas |
| `--run` | `#15803D` | ready/success/run | 5.02:1 on white |
| `--run-soft` | `#E7F5EC` | status tag background | — |
| `--run-ink` | `#146C34` | text on `--run-soft` | 5.79:1 |
| `--warn` | `#92400E` | in-design/warning text | 6.45:1 on `--warn-soft` |
| `--warn-soft` | `#FDF3E3` | callout/tag background | — |
| `--danger` | `#B42318` | errors/destructive | 6.05:1 on `--danger-soft` |
| `--danger-soft` | `#FEF3F2` | error surface | — |
| `--code-bg` | `#0B1220` | always-dark code blocks | — |
| `--code-ink` | `#E6EBF5` | code text | 15.7:1 |

Notes:

- **No cyan role.** Informational messages use `--surface-sunken` + `--ink-muted` + a link.
- **Selection is blue-slate**, not indigo, to avoid returning to the current accent.
- **The primary action is near-black**, not green. Green means "run/ready/success"; making every CTA green would overload it again.
- `--border` may remain subtle because it is never the only indicator of an interactive control. Cards remain distinguishable via surface change + spacing + optional hairline.

### 5.2 Dark theme = workspace tokens

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--canvas` | `#0B1220` | app background | — |
| `--surface` | `#111A2B` | panels, cards, console | — |
| `--surface-raised` | `#162236` | popovers, sticky headers | — |
| `--surface-sunken` | `#0E1626` | code wells, table stripes | — |
| `--ink` | `#E6EBF5` | primary text | 15.7:1 on `--surface` |
| `--ink-muted` | `#A7B2C6` | secondary text | 8.1:1 |
| `--ink-subtle` | `#8593AA` | timestamps/placeholders | ≥5.5:1 |
| `--border` | `#2C3A55` | decorative rules | 1.6:1 (allowed) |
| `--border-strong` | `#5A6C8C` | control boundaries | 3.28:1 on `--surface`, 3.53:1 on canvas |
| `--action` | `#E6EBF5` | primary button (inverted) | 15.7:1 with `#0B1220` text |
| `--link` | `#9DB8FF` | links | 9.57:1 |
| `--focus` | `#9DB8FF` | focus ring | 9.57:1 |
| `--run` | `#4ADE80` | ready/success/run | 10.74:1 |
| `--warn` | `#FBBF24` | in-design/warning | 10.43:1 |
| `--danger` | `#F87171` | errors | 6.29:1 |
| `--code-bg` | `#060A15` | code blocks | — |

This is deliberately the "Developer Tool / IDE" family from the skill (slate/navy + run green), mapped onto the existing semantic slots so no component needs theme-specific CSS.

### 5.3 Workspace mode (dark inside light)

Add a scoped attribute rather than a second theme:

```css
[data-surface='workspace'] {
  --surface: #111a2b;
  --surface-sunken: #0e1626;
  --surface-raised: #162236;
  --ink: #e6ebf5;
  --ink-muted: #a7b2c6;
  --ink-subtle: #8593aa;
  --border: #2c3a55;
  --border-strong: #5a6c8c;
  --link: #9db8ff;
  --focus: #9db8ff;
  --run: #4ade80;
  --warn: #fbbf24;
  --danger: #f87171;
  --code-bg: #060a15;
  --code-ink: #e6ebf5;
}
```

Any component inside inherits the technical palette. This is how the practice/workspace page and future API/SQL surfaces get a dark identity without duplicating styles or making the whole site dark.

### 5.4 What happens to the old tokens

- Keep the names `--bg`, `--surface`, `--ink`, `--line`, `--accent` for one migration step, but remap their **values** and add the new semantic names. This avoids a flag-day rewrite of 2,681 CSS lines.
- Remove `--cyan` and `--info*`; replace `--accent` usage with `--action`/`--link`/`--run` depending on intent.
- Deprecate `--shadow-sm` on cards; keep `--shadow-overlay` for drawers/popovers only.

---

## 6. Typography

### 6.1 Families

| Role | Family | Weights | Notes |
|---|---|---|---|
| UI, body, headings, prose | **IBM Plex Sans** | 400 / 500 / 600 | Technical/humanist; distinct from the generic Inter look; the skill's "Developer Mono" pairing |
| Code, labels, numbers, keys | **JetBrains Mono** | 400 / 500 | Code, mono labels, tabular values, breadcrumb separators optional |

**Fallbacks:** `"IBM Plex Sans", ui-sans-serif, system-ui, "Segoe UI", sans-serif` and `"JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace`.

**Loading strategy (decision required):**

- **Recommended:** self-host latin subsets via `@fontsource-variable/ibm-plex-sans` and `@fontsource-variable/jetbrains-mono` (devDependencies, bundled by Vite, OFL). No runtime CDN, no third-party request, offline works, ~90–140 kB total for the needed subsets. Preload the two woff2 files, `font-display: swap`, and set `size-adjust`/fallback metrics to avoid CLS.
- **Alternative:** system stack only (zero bytes) with a carefully designed fallback stack. Cheaper, but forfeits the "professional instrument" identity and keeps cross-OS inconsistency.
- **Not recommended:** Google Fonts `<link>` at runtime (third-party dependency, privacy, offline failure) nor silently keeping undeclared fonts.

### 6.2 Scale

| Role | Size / line-height | Weight | Family |
|---|---|---|---|
| Dashboard display | 40 / 1.1 | 600 | Sans |
| Page `h1` | 32 / 1.15 | 600 | Sans |
| Section `h2` | 22 / 1.25 | 600 | Sans |
| Card/subsection `h3` | 17 / 1.4 | 600 | Sans |
| Body | 16 / 1.65 | 400 | Sans |
| Prose (guides) | 16 / 1.7, 66ch | 400 | Sans |
| Secondary/meta | 14 / 1.5 | 400/500 | Sans |
| Micro-label | 12 / 1.2, +0.06em, uppercase | 500 | Mono |
| Code | 13.5 / 1.7 | 400 | Mono |
| Numeric data | 13–24, tabular | 500/600 | Mono or Sans tabular |

Rules:

- **Minimum 12 px** for any text; no 10.5 px labels.
- Headings max weight **600**; reserve 700 for the brand wordmark and rare emphasis.
- No gradient text, no letter-spacing below `-0.02em`.
- `text-wrap: balance` on h1/h2 (progressive; verify fallback).
- `font-variant-numeric: tabular-nums` on all counts, times, percentages, versions.
- Headings use sentence case; mono labels may be uppercase.
- Cap prose at **66ch**; the guide article becomes a 640–700 px column with a 240 px sticky TOC, not a 623 px column at 14.7 px.

### 6.3 Expected impact

- 33 sizes → **9 roles** (display, h1, h2, h3, body, prose, meta, micro, code).
- 168 sub-14 px nodes on the dashboard at 1440 → near zero (only intentional 12–13 px mono labels).
- Reading measure 89 ch → 66 ch; guide body 14.7 px → 16 px.
- Cross-platform identity becomes deterministic once fonts ship.

---

## 7. Design-system structure

### 7.1 Layers

```
Primitive tokens   → raw palette, type scale, space, radius, motion, z-index
Semantic tokens    → canvas/surface/ink/border/action/link/run/warn/danger/focus
Component tokens   → --control-h, --control-h-sm, --card-pad, --panel-gap,
                     --prose-measure, --sidebar-w, --topbar-h
Patterns           → page header, index row, catalog card, reading page,
                     detail shell, workspace panel, filter bar, empty state
```

All tokens remain CSS custom properties in `src/styles/tokens.css`; no preprocessor, Tailwind, or CSS-in-JS.

### 7.2 File structure (progressive, not a flag-day)

Keep the existing five stylesheets and add one scoped file in Milestone 3:

```
src/styles/
  tokens.css        # 3-layer tokens + [data-theme] + [data-surface='workspace']
  base.css          # reset, type, focus, selection, skip link, motion
  layout.css        # shell, sidebar, topbar, drawer, page container, footer
  components.css    # primitives, cards, forms, feedback, tables, TOC, code
  workspace.css     # NEW: dark technical panels, console/log/query patterns
  pages.css         # page-specific composition only
  global.css        # imports, in cascade order
```

`components.css` is 1,744 lines and mixes primitives with page-specific rules; during Milestone 3, regroup it by primitive and move one-off page rules into `pages.css`. **Do not split files before tokens land** — cascade order is already a documented risk (the Phase 2 mobile-grid bug).

### 7.3 Component inventory

| Primitive | Variants / contract |
|---|---|
| `Button` | primary (ink), secondary (border), ghost, danger; sizes md (44 px) / sm (36 px); `asChild`-style link usage via a shared class, not a new dependency |
| `IconButton` | 40–44 px square, label required |
| `Tag` | status only: ready/in-design/planned; dot + text, 12 px mono, radius 4 |
| `Meta` | inline dot-separated text; no pills |
| `LevelMeter` | 3 bars + label |
| `Card` | static vs interactive; no shadow; hairline; optional top rule; one link |
| `StatTile` | label (mono), value (tabular), delta/context; no icon by default |
| `Callout` | info/warn/danger/success; 3 px left rule; no full tint except danger |
| `FactList` | mono key, right-aligned value, hairline rows |
| `State` | empty/loading/error; one component, consistent actions |
| `FilterBar` | search + selects + chips; desktop row, mobile drawer |
| `TOC` | sticky, scrollspy, `aria-current="true"`, mobile `<details>` |
| `CodeBlock` | always dark; language label; optional copy |
| `WorkspacePanel` | dark header strip + mono body; used by practice today, API/SQL later |
| `ProgressRow` | label, value/max, %, bar, optional link; text fallback |
| `Breadcrumbs` | middle-truncation; no 46 ch ellipsis on the current item |
| `PageHeader` | eyebrow (mono index), h1, lede, actions; no hero variant |

### 7.4 Icons

- Keep the existing inline SVG `Icon` set (no package). Standardise stroke width (1.5 px), 20 px default, 24 px for feature cards.
- Remove per-track hues. Use `--ink-muted` inside a 28–32 px bordered square; the icon shape carries identity.
- Audit the set for duplicates/missing metaphors during Milestone 3; add icons only where a concept repeats.
- **Decision:** do not add Phosphor/Heroicons mid-redesign. If a package is ever added, it must replace the whole set in one milestone, not mix styles.

### 7.5 Motion and elevation

- `--ease-out: cubic-bezier(.2,.7,.2,1)`; `--dur-fast: 120ms`, `--dur: 180ms`.
- Allowed: opacity, border/background colour, focus ring, drawer slide, reading-progress width.
- Removed: card `translateY(-2px)` on hover (moves the target under the cursor and adds noise), gradient shimmer, glow.
- Shadows only for overlays: `0 24px 60px -30px rgb(11 18 32 / .35)`.
- `prefers-reduced-motion` stays as-is; no new exceptions.

### 7.6 What we are *not* adding

No Tailwind, shadcn/Radix, CSS-in-JS, chart library, icon package, or component framework. The redesign is a token/typography/layout/component-CSS change plus small React refactors. This preserves the Phase 2 constraint and the Cloudflare Pages bundle profile.

---

## 8. Page-by-page recommendations

### 8.1 Global shell

- **Sidebar (240 px):** brand not repeated; sections `Learn` (Overview, Tracks, Catalog, Guides) and `Workspace` (Practice, Progress); 44 px rows; active = 2 px ink rule + surface-selected; utility footer with **About this build** and theme; collapse to 64 px with tooltips. Remove the promo card and the "—" headings when collapsed.
- **Top bar (56–60 px):** menu trigger (mobile), brand, real search field (desktop), theme toggle. Remove the env pill. Search: submit navigates to `/scenarios?q=…`; `/` focuses it; Escape clears/blurs; `aria-keyshortcuts="/"` only if implemented.
- **Breadcrumbs:** in the content column; show short track name; allow the current item to wrap to two lines rather than truncate at 46 ch.
- **Footer:** one line, learner-facing (`QA Practice Lab · Preview build`), link to About. No version/build numbers repeated on every page.
- **Route management:** scroll to top on PUSH (restore on POP), focus the `h1` (or `main`) after navigation, announce the new page via the title. Use React Router's `ScrollRestoration` (data router) or a small `useLayoutEffect` on `pathname`.
- **Error boundary:** `errorElement` per route group with `ErrorState` and a "Back to dashboard" action.
- **Skip link / landmarks:** keep.

### 8.2 Dashboard (`/`)

**Goal:** answer "what should I do next?" in one screen, then get out of the way.

- **Header:** eyebrow `01 / OVERVIEW`, h1 "Practise the whole testing stack.", 2-line lede focused on learner outcomes, primary "Find a scenario" + secondary "Browse tracks".
- **Start here (replaces hero aside + demo progress):** a 3-step path card — `01 Read the manual-testing guide → 02 Try the cart-totals scenario → 03 Review the API track`. Uses real content IDs. First-time state; later becomes "Continue" with a real last activity.
- **Curriculum:** 6 compact track rows (icon, name, tagline, `Beginner · 8 exercises`, arrow) + "All 12 tracks". No descriptions, no duplicate CTA. Target ~360 px tall for six rows.
- **Catalog summary:** one line `24 scenarios · 12 tracks · 6 guides`, 3 starting scenarios as compact rows, "Open the catalog".
- **Remove:** feature checklist, the info banner (replace with one small inline Preview note), four stat cards, category grid (move to catalog), demo progress panel, recent activity (move to progress), quick practice card (sidebar + practice page already cover it).
- **Mobile:** single column, category/progress collapsed; target < 2,500 px.

**Acceptance:** no duplicated counts; one primary CTA; page < 1,600 px at 1440; no full-page gradient panels.

### 8.3 Tracks (`/tracks`)

- Header + one-line explanation; the curriculum preview note becomes a single inline line, not a full callout.
- **3-col grid at 1440** (min 300 px), 2 at 1024, 1 at <760; cards ~170 px tall: single-tone icon, name, tagline, `Beginner · 8 exercises · 2 listed`, arrow. No descriptions, no "Level" fact row duplication, no "Open track" link (the title + arrow is the target; whole card clickable via a single overlay link).
- Add a `Level` filter only if the list grows; 12 items do not need filters today.
- Remove the `Search the catalogue` button from the header (the top-bar search and sidebar cover it) or keep it as a secondary action.

**Acceptance:** page height ≤ ~1,100 px at 1440 and ≤ ~2,400 px at 375; one link per card; no duplicate facts.

### 8.4 Track detail (`/tracks/:trackId`)

- **Header:** title, tagline, meta `Level · 8 exercises · 2 listed · ~time`, one primary action "Start with the guide" (or "Open first scenario" when runnable).
- **Main:** About (2 short paragraphs) → **Path** (numbered: guide → scenario 1 → scenario 2 → next) → objectives. Scenario entries are compact numbered rows with status, not full cards.
- **Aside (sticky):** At a glance (`Level`, `Planned`, `Listed`, `Guide`) using `FactList`; related tracks (shared category) at the bottom; no arbitrary "first three others".
- **Remove:** the meta-row/facts duplication; the standalone "What planned means" callout (fold into a single note in the About section); the "Explore next" panel.

**Acceptance:** one source of truth for each fact; path visible without scrolling past objectives.

### 8.5 Catalog (`/scenarios`)

- **URL state:** `?q=&track=&difficulty=&mode=&status=&sort=`. Use `useSearchParams`; derive filters from the URL; preserve on Back/Forward; update with `replace` while typing and `push` for discrete filters (decide and test).
- **Deep links:** dashboard categories → `?category=` (add category to filters); track detail "All scenarios" → `?track=id`; top-bar search → `?q=`.
- **Desktop filter bar:** one card-less row group — search (grow), track, difficulty, mode, status, sort; labels above at 13 px; 44 px controls; applied-filter chips below with remove buttons; result count + "Clear all".
- **Mobile:** sticky bar `Filters (2)` + result count; filter drawer (bottom sheet or full-height dialog) with focus trap, Apply/Clear, and scroll lock; chips visible outside the drawer.
- **Cards:** 2 columns at ≥1024 (or list rows at ≥1280 if density wins), 1 below; one status tag; title (2-line clamp); summary (2–3 line clamp); meta `Track · Difficulty · Time` in 13 px; no "View scenario" duplicate link. Card title link + arrow, or a single overlay link with `aria-label`.
- **Empty state:** "No scenarios match `cart`" + applied chips + reset; live region only on the count.
- **Grouping (optional):** "Group by track" with `h2`s fixes heading order and makes 24 items scannable.
- **Target:** < 2,400 px at 1440, < 4,000 px at 375.

**Acceptance:** Back/Forward preserves filters; category/track deep links apply filters; mobile drawer traps focus; 24 cards scan without three-pill noise; URL is shareable.

### 8.6 Scenario detail (`/scenarios/:scenarioId`)

- **Header:** eyebrow `SCENARIO / MANUAL TESTING`, h1 32 px, summary, meta text (difficulty · time · category), **one** status tag.
- **Availability block:** directly under the header (not in the aside): "Preview only — this exercise is not runnable yet" + what will be available (target, steps, scoring) in one short paragraph. One per page.
- **Main:** What you'll practise (objectives) → Prerequisites → Related guidance.
- **Aside:** Facts (track link, category, time, level) — no availability duplication; "More in this track" as numbered prev/next.
- **Remove:** duplicate badges/facts/availability text; amber callout competing with the aside.
- **Breadcrumb:** use `track.shortName`, allow two lines.

**Acceptance:** status stated once; no fact appears twice; page < 1,000 px at 1440.

### 8.7 Guides (`/guides`)

- Header + one-line index summary (no count pills).
- Group by discipline with a compact **index row** per guide: title, 1-line summary, `Level · 9 min · 4 concepts`, arrow. 2 columns at ≥1024; 1 at mobile.
- Remove the "Six introductory guides are available" callout (redundant with the list); keep a single Preview note if needed.
- Add a `search`/filter later only when guides > 12.

**Acceptance:** < 1,400 px at 1440; no `h1 → h3` skip; each row has one link name.

### 8.8 Guide detail (`/guides/:guideId`)

- **Reading page:** 66ch prose, 16 px/1.7; h2 22 px with generous top space; code blocks dark (`data-surface="workspace"`), language label, 13.5 px mono, horizontal scroll; concepts as a definition list with a 3 px left rule; steps numbered with mono numerals.
- **Aside (sticky at ≥1180):** TOC with scrollspy + `aria-current="true"` + active rule; facts compressed into a meta strip (`Manual Testing · Beginner · 9 min`), not a second panel repeating the header.
- **Mobile/tablet:** `<details>` "On this page" **above** the article; facts after the title; no 2,581 px offset.
- **End of article:** prev/next guide + related scenarios (compact rows), then one Preview note (or none).
- **Optional:** reading progress rule (1 px) at the top; copy button on code blocks (requires a tiny JS addition, allowed but not required).
- **Fix:** TOC labels must match visible headings ("Practical examples", not "Examples").

**Acceptance:** ≤ 66–72 ch at 1440; TOC usable at 768/375; no duplicate facts; active section visible.

### 8.9 Progress (`/progress`)

- **Until persistence exists:** one page-level `Preview` tag + one explanatory paragraph; a compact **sample table** (track, completed/planned, %, state) clearly marked "Sample data"; a "What will be tracked" list (completion, scores, streak, activity); CTA to the catalog.
- Move "What is real right now" to **About this build**.
- Remove the four demo stat cards and the repeated "(demo)" labels; keep exactly one sample-data label.
- **When real progress lands:** summary strip (3 tiles max), track rows with % + counts + next-up, recent activity with dates, filters by track. Use text + shape, not colour alone; include a table fallback.
- Empty state for new learners: "No progress yet — start with the manual-testing guide" + CTA.

**Acceptance:** demo status stated once; no dashboard duplication; page < 1,200 px at 1440.

### 8.10 Practice (`/practice`) → Workspace hub

- **Status strip:** "Runtime" panel in `data-surface="workspace"` — API/D1 status, version, schema, checked-at, **Retry** button; user-facing error copy (no npm commands/ports; optional "Developer details" disclosure).
- **Formats:** 6 planned formats as 2–3 compact cards with a `Planned` tag and one line of "what you'll practise". No button-shaped "Not available" controls; use a tag, not a disabled-looking button.
- **Safety boundaries:** keep, condensed to 4 short lines in a single panel.
- **"Prepare while you wait":** the start-path links.
- Remove the "Nothing on this page launches an exercise" full-width warning; replace with the status strip + `Planned` tags.

**Acceptance:** workspace palette visibly distinct from the light page; no dev instructions; status has a retry path.

### 8.11 404

- Replace the giant gradient `404` with a mono `404` label at 14–16 px and a clear h1.
- Add a real catalog search field (same component as the top bar) and 3 recovery rows.
- Keep the route; no new page needed.

**Acceptance:** search works; no gradient panel; < 600 px tall at 1440.

### 8.12 Cross-page states

- One `State` component family for empty/loading/error; skeleton rows for lists, not spinners, once data can be async.
- Route error boundary with retry + home.
- Announce route changes and result counts, not whole grids.
- No layout shift from fonts (fallback metrics) or late data (reserved heights).

---

## 9. Reusable component improvements

| Component | Current | Change | Why |
|---|---|---|---|
| `Badge` | 6 tones, pill, 10.56 px uppercase, used for taxonomy + status + counts | Split into `Tag` (status only, 3 tones, dot + 12 px mono, radius 4) and plain `Meta` text | Removes 72 pills per catalog page; restores status meaning |
| `DifficultyBadge` / `ModeBadge` | Coloured pills | `LevelMeter` + text meta | Colour no longer overloaded; difficulty is scannable by shape |
| `StatusBadge` | Colour-only distinction with text | Dot + text + `aria-label` where needed | Shape/text redundancy; colour-blind safe |
| `TrackCard` | Icon hue per track, 3-col fact row, 2 links, description | Compact row/card: single-tone icon, name, tagline, one meta line, one link | 12 cards become scannable; no duplicate "Level" |
| `ScenarioCard` | 3 pills, summary, meta, duplicate CTA | 1 status tag, title, 2-line summary, meta text, one link | Density and link-name clarity |
| `GuideCard` | Icon + discipline pill + 3 meta items + CTA | Index row: title, summary, `Level · min · concepts`, one link | Reading library scans like an index, not a card grid |
| `StatCard` | Icon + uppercase label + value + hint; all equal | `StatTile` with mono label, tabular value, optional context; de-emphasise when demo | Data, not decoration |
| `Callout` | Full pastel box, icon square | 3 px left rule + label + copy; full tint only for blocking errors | Less candy, more hierarchy |
| `EmptyState` / `LoadingState` / `ErrorState` | Exist; two unused | Single `State` API; use in catalog, errors, future async; add retry | Consistent recovery |
| `PageHeader` | Eyebrow + 43 px h1 + lede + actions | 12 px mono index eyebrow, 32 px h1, lede, actions; optional meta row | Hierarchy and fold position |
| `SectionHeader` | h2 19 px + 13 px description + action | h2 22 px, 14 px description, action aligned to baseline | Clearer section rhythm |
| `ProgressBar` | 6 px track, label/value, no % | 8 px track, % + count, text fallback, state label | Readability and a11y |
| `FactList` | 12 px/12.5 px text | Mono keys 12 px, values 13–14 px tabular, 44 px rows | Test-report feel; scannable |
| `Breadcrumbs` | 12.2 px, current truncated at 46 ch | 13 px, 2-line current, separator as `/` in mono | Long QA titles are the norm |
| `MobileNav` | Focus escapes; non-inert background; focus not returned | Focus trap + `inert` + return focus + non-focusable backdrop + labelled dialog | Core a11y |
| `ThemeToggle` | 35 px icon | 40–44 px, tooltip, `aria-pressed` not needed; keep label | Target size |
| Top-bar search | Link + fake `/` kbd | Real `<form role="search">` + input + shortcut + clear | Honest affordance |
| `Icon` | Many sizes/use of colour for identity | Standardise stroke/size; decorative `aria-hidden`; no hues | Consistency |

---

## 10. Accessibility and responsive plan

### 10.1 P0 (must ship with the redesign)

1. **Boundary contrast:** `--border-strong` on every input/select/button/card edge with interactive meaning; verify ≥3:1 in both themes with the audit script.
2. **Mobile dialog correctness:** focus trap, `inert` on the shell, return focus to the trigger, `aria-labelledby`, Escape, scroll lock, backdrop not a `<button>`.
3. **Route transitions:** scroll-to-top on PUSH, focus `h1`/`main`, document title already handled; test with keyboard only.
4. **Focus visibility:** tokenised 2 px ring + 2 px offset on every control; verify on canvas, surface, selected, and workspace backgrounds.
5. **Target sizes:** 44 px primary/controls; ≥24 px for text links (add padding, not font size); topbar 44 px.
6. **Link names:** one accessible name per card ("View Verify cart totals…"), or remove the duplicate secondary CTA.
7. **Heading order:** h1 → h2 (visually hidden group heading on catalog/tracks) → h3.
8. **Search honesty:** implement `/` or remove the hint; real input or remove the field.

### 10.2 P1

9. Minimum 12 px labels, 14 px meta, 16 px body/prose.
10. Announce only the filter count; remove `aria-live` from the card grid.
11. Filter drawer: labelled fields, focus trap, Apply/Clear, restore focus.
12. TOC: `aria-current="true"`, scrollspy, mobile placement above content.
13. Callouts: icon + label, never colour alone; error copy without developer commands.
14. Remove hover `translateY` on cards; keep colour-only transitions (reduced-motion safe).
15. Ensure target size and focus order in the collapsed sidebar (tooltips + `title` already exist).
16. `forced-colors` check; do not rely on `color-mix` alone for focus/borders in forced-colors mode.

### 10.3 P2

17. `prefers-contrast: more` variant: switch `--border` to `--border-strong`, strengthen muted text.
18. Screen-reader pass on drawer, catalog filters, TOC, progress rows.
19. 200% zoom / 320 px reflow; ensure no two-dimensional scrolling in tables/fact lists.
20. Print styles for guides (optional, low cost).

### 10.4 Responsive matrix

| Width | Shell | Catalog | Detail pages | Guides |
|---|---|---|---|---|
| 1440 | sidebar 240, content 1120 | 2–3 cols, filter row | main + 280 aside | 66ch + 240 TOC |
| 1024 | sidebar 240, content ~760 | 2 cols, 3+1 filters | main + 280 aside | 66ch + TOC |
| 860 | drawer nav | 2 cols, filter bar wraps | aside stacks | TOC `<details>` above |
| 640 | drawer nav | 1 col, filter drawer | 1 col | 1 col |
| 375 | drawer nav | 1 col, sticky filter bar | 1 col | 1 col |

Breakpoints: **1280 / 1024 / 860 / 640 / 480** (replace 560/760/980/1180). Verify 320 px and 200% zoom separately.

### 10.5 Verification plan (Milestone 8)

- `npm run check` (lint → typecheck → test) and `npm run build`.
- Scripted audit rerun: contrast pairs, computed sizes, target sizes, focus-visible presence, duplicate link names, heading order, overflow at 320/375/768/1024/1440, both themes, reduced-motion emulation.
- Keyboard-only walk: skip link → nav → catalog filters → card → detail → guide TOC → drawer open/close.
- Screen-reader smoke (NVDA or VoiceOver) on drawer, filters, TOC.
- Visual matrix screenshots for every route × 4 widths × 2 themes.
- Playwright checks for URL state (Back/Forward/deep link) and drawer focus trap; add unit tests for the URL ↔ filters mapping.

---

## 11. Implementation milestones

Each milestone is independently shippable, testable, and reversible. **Phase 3 stays paused until all approved milestones are complete.** No milestone introduces a Phase 3 feature.

### M1 — Foundations: tokens, fonts, base type, focus

- Rewrite `tokens.css` in three layers; add workspace scope; map old names temporarily.
- Add self-hosted IBM Plex Sans + JetBrains Mono (if approved), preloads, fallback metrics, `font-display: swap`.
- `base.css`: 16 px base, 9 type roles, focus token, remove body gradients, selection colour, `forced-colors` guard.
- **Accept:** contrast script passes for all token pairs; no visual regressions beyond intended palette/type; build size delta documented; `npm run check`.
- **Files:** `src/styles/tokens.css`, `base.css`, `index.html`, `package.json` (font packages only).

### M2 — Shell, navigation, search, route management

- Sidebar 240/64, new section labels, utility footer, remove promo card and env pill.
- Top bar: real search form + `/` shortcut + clear; 44 px controls.
- Mobile drawer: focus trap, inert, return focus, labelled dialog, non-button backdrop.
- Scroll restoration + route focus + error boundary; breadcrumb wrapping; footer cleanup.
- **Accept:** keyboard walk passes; Back/Forward keeps scroll/focus; search deep-links to `/scenarios?q=`; no dev chrome.
- **Files:** `AppShell.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, `App.tsx`, `navigation.ts`, `layout.css`, `components.css` (shell parts).

### M3 — Primitives and cards

- Button/IconButton/Tag/StatusDot/Meta/LevelMeter/Card/StatTile/Callout/State/FactList/ProgressRow.
- Card de-chipping; single-tone icons; remove card shadows/hover lift; link-name audit.
- Consolidate CSS sections; add `workspace.css` scaffold (no feature).
- **Accept:** every route renders with primitives; no `badge-*` taxonomy pills left; duplicate link names = 0; both themes.
- **Files:** `components/ui/*`, `features/**/*Card.tsx`, `components.css`, `workspace.css`.

### M4 — Dashboard, tracks index, track detail

- New dashboard zones (start path, compact track rows, catalog summary) and copy; remove duplicated stats/demo panels/categories.
- Tracks index compact grid; track detail path/sequence + aside dedupe.
- **Accept:** dashboard < 1,600 px at 1440 / < 2,500 px at 375; tracks < 1,100 px; each fact appears once; no removed routes/features.
- **Files:** `DashboardPage.tsx`, `TracksPage.tsx`, `TrackDetailPage.tsx`, `TrackCard.tsx`, `pages.css`.

### M5 — Catalog, filters, scenario detail

- URL-synced filters + category support + sort + applied chips; deep links from dashboard/tracks.
- Desktop filter bar, mobile filter drawer; one status tag per card; link names.
- Scenario detail availability block + facts dedupe + prev/next.
- **Accept:** Back/Forward and deep links preserve filters (tests); drawer a11y; catalog targets (< 2,400 px at 1440); empty state with recovery.
- **Files:** `ScenariosPage.tsx`, `ScenarioFilterBar.tsx`, `ScenarioCard.tsx`, `ScenarioDetailPage.tsx`, `lib/catalog.ts` (URL mapping helpers), `tests/lib/catalog.test.ts`.

### M6 — Guides index and reading page

- Index rows; reading layout 66ch; TOC scrollspy + mobile `<details>`; dark code blocks; facts meta strip; prev/next.
- **Accept:** 66–72 ch at 1440; TOC above article at ≤860; active state; no duplicate facts; guide page < 2,200 px at 1440.
- **Files:** `GuidesPage.tsx`, `GuideDetailPage.tsx`, `GuideCard.tsx`, `pages.css`, `workspace.css`.

### M7 — Progress, practice/workspace, 404, states

- Progress sample preview (single label) or empty state; move "What is real" to About build.
- Practice workspace strip (dark surface, retry, user-facing errors); planned-format cards.
- 404 redesign; `State` family adoption; route error boundary.
- **Accept:** one demo label per page; simulated API failure shows retry + user copy; workspace palette isolated to `data-surface`; 404 search works.
- **Files:** `ProgressPage.tsx`, `PracticePage.tsx`, `NotFoundPage.tsx`, `HealthStatus.tsx`, `States.tsx`, `workspace.css`.

### M8 — Accessibility, responsive verification, tests, docs

- Run the full matrix; fix findings; add URL-state unit tests and Playwright focus/drawer checks (decision needed on committing browser tests).
- Commit the audit capture script under `scripts/audit/` if approved.
- Update `AGENTS.md` design-system rules (new tokens, file roles, font loading, workspace scope) and `PROJECT_STATE.md`.
- **Accept:** `npm run check` + `npm run build`; scripted audit clean; keyboard/SR walk recorded; screenshots for all routes.

### M9 — Optional polish (only if requested)

- Icon set refinement, empty-state illustrations (SVG only), reading-progress rule, copy-button on code, print styles, `prefers-contrast`.

**Sequencing rationale:** tokens before components (no double restyle), shell before pages (navigation/focus is global), catalog before progress (discovery is the core loop), verification last but continuous via the scripted audit.

---

## 12. Decisions required before implementation

1. **Fonts:** self-host IBM Plex Sans + JetBrains Mono (recommended, ~90–140 kB, OFL) or stay on the system stack (0 kB, weaker identity)?
2. **Icon strategy:** keep/extend inline SVG (recommended) or add an icon package? If a package is added, it must replace the full set in M3.
3. **Content restructuring:** approve removing the hero feature checklist, dashboard categories/stats/demo panels, and "What is real right now" (recommended), or limit the redesign to visual tokens and leave IA untouched?
4. **Dark theme:** adopt the workspace palette as the global dark theme (recommended) and add `data-surface="workspace"` for dark panels inside light mode?
5. **Dev chrome:** remove "Phase 2 preview" from the top bar, "Phase 2 · v0.2.0" from the footer, and developer commands from the health error; add a single **About this build** surface (recommended)?
6. **Progress:** leave the demo content on `/progress` as a clearly labelled sample preview, or replace it with an empty state until persistence exists? (Recommended: sample preview on `/progress` only.)
7. **Browser tests:** add Playwright + axe as devDependencies in M8, or keep verification manual/scripted from `/tmp`?
8. **Search:** implement a real top-bar search that deep-links to the catalog now, or remove the field and keep search inside the catalog (recommended for scope: implement now, it is a small win)?

---

## 13. Risks and non-goals

**Risks**

- **Scope creep into Phase 3.** The workspace token can tempt us to build an API console. M1–M8 must not add exercise targets, scoring, auth, or commerce.
- **Cascade regressions.** The repo has already hit order-dependent overrides. Token remapping must be verified per route, and media queries consolidated rather than appended.
- **Font licensing/bundle.** OFL is fine, but subsets must be checked; preload only what is used; monitor CLS.
- **Removing demo panels may look like removing features.** We keep the data and the `/progress` surface, and we remove only duplicate framing. No route is deleted.
- **Tests may encode old copy.** `tests/data/content.test.ts` and `tests/lib/catalog.test.ts` are content/logic tests; update expectations only where the redesign intentionally changes labels.
- **Accessibility regressions from custom primitives.** Every new primitive must ship with keyboard/focus/contrast checks, not be "polished later".

**Non-goals**

- No Phase 3 commerce app, API console, SQL sandbox, auth, bug-hunt mode, scoring, or persistence.
- No Tailwind/shadcn/UI framework/chart library/icon package.
- No redesign of the content domain, safety boundaries, or route map.
- No dark-workspace feature work beyond the token scope and the practice status surface.
- No remote Cloudflare resources, deployments, or migrations.

---

## 14. Appendix

### A. Measured page heights

| Route | 1440 px | 375 px |
|---|---|---|
| `/` | 3,120 | 6,739 |
| `/tracks` | 1,939 | 4,981 |
| `/tracks/manual-testing` | 1,602 | 2,796 |
| `/scenarios` | 2,903 | 7,631 |
| `/scenarios/manual-cart-totals` | 1,169 | 1,990 |
| `/guides` | 2,436 | 2,590 |
| `/guides/guide-manual-test-design` | 2,667 | 3,920 |
| `/progress` | 1,265 | 2,156 |
| `/practice` | 1,469 | 2,978 |

### B. Type and shape inventory (nine routes)

- 33 distinct computed font sizes; 26 below 16 px.
- 146 text nodes at 10.56 px (badges, filter labels, eyebrow variants); 55 labels at 9.92 px; 11 stat labels at 10.88 px.
- 8 font weights, including 550/650/750/800.
- 152 fully rounded elements; radii 5/6/7/9/11/13/18/24 px in use.
- 84 identical card shadows.
- Duplicate link names: 24 "View scenario", 12 "Open track", 6 "Read guide".
- Badge tones observed: 7 accent, 7 neutral, 2 warning, 1 info, 1 success on a single catalog/detail sweep.

### C. Behaviour probes

| Probe | Result |
|---|---|
| Theme toggle | `light → dark`, persisted; bootstrap prevents flash |
| Catalog filter then open card then Back | Search `cart` → 5 cards; Back → empty search, 24 cards |
| Scroll on navigation | 1600 px → 140 px (clamped, not reset) |
| Focus after navigation | `<body>` |
| Mobile drawer focus | Starts on Close; escapes after 6 links; background not inert; focus returns to `<body>` |
| Mobile drawer sizing | 330 px wide at 375; body scroll locked |
| Guide TOC at 1024 | TOC top 2,581 px vs article top 421 px |
| Overflow | None at 375/768/1024/1440 |
| Dark theme boundary contrast | 1.33–1.48:1 |
| Top-bar targets at 375 | 31–35 px; text links 20 px; small buttons 38 px |

### D. Reproduction

```bash
npm run db:migrate:local     # if local D1 is fresh
npm run build
npx wrangler pages dev dist --port 8788
# in another shell:
node /tmp/qa-audit-capture.cjs   # screenshots + metrics → /tmp/audit
```

The capture script is intentionally not committed yet; see M8.

---

**End of audit. Awaiting approval before any implementation.**
