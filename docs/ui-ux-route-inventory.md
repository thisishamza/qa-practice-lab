# QA Practice Lab — UI/UX Route Inventory & Inspection Status

**Audit date:** 2026-11-17 · **Branch:** `main` @ `297a030` · **Working tree:** clean · **App:** http://localhost:8788 (existing `wrangler pages dev` on `:8788`, serving `dist/` build `index-CLEs4WAj.js`; production build of the audited HEAD, no source modified)
**Auditor toolchain:** headless Google Chrome 155 over raw CDP (Node 26 built-in WebSocket); no dependencies installed. Automated coverage = layout metrics sweep (horizontal overflow, h1 presence, console errors) at 1440×900, 1280×800, 768×1024, 390×844 and 375×812 in light and dark themes; full-page and viewport screenshots; in-page JavaScript probes (heading sequence, unlabeled controls, contrast of design-token pairs). **No axe/pa11y stack was installed** — see §Accessibility in `docs/ui-ux-audit.md`.

Screenshots referenced below live in `docs/audit-screenshots/` and exist on disk as of this commit.

## Coverage summary

| Coverage | Count |
|---|---|
| Routes with h1 + overflow + console-error sweep at 5 widths (both themes on key widths) | 41 |
| Routes with desktop viewport screenshot (light) | 28 |
| Routes with desktop screenshot (dark) | 3 |
| Routes with mobile screenshot | 4 |
| Routes not rendered at all | 0 (every declared route was rendered) |
| Routes only swept, not visually eyeballed | 11 (marked `SWEEP`) |

Legend — **Visual**: eyeballed a rendered screenshot · **SWEEP**: rendered and machine-measured (overflow/h1/console errors) but not visually inspected pixel-by-pixel · **Flows**: interactive flow exercised locally.

## Route inventory

### Core / learning shell

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/` | Dashboard — "Practise testing across the whole stack." | Visual + Flows | `dashboard-1440-light.png`, `dashboard-1440-dark.png`, `dashboard-390-light.png`, `dashboard-375-dark.png`, `vp-dashboard-1440-light.png` |
| `/tracks` | Learning tracks (12 cards) | Visual | `tracks-1440-light.png` |
| `/tracks/manual-testing` | Track detail | SWEEP + Visual | `track-detail-1440-light.png` |
| `/tracks/api-testing` | Track detail | SWEEP | — |
| `/scenarios` | Scenario catalogue (53 cards) | Visual | `scenarios-1440-light.png`, `vp-scenarios-1440-light.png` |
| `/scenarios/manual-cart-totals` | Scenario detail + wired bug hunt | Visual + Flows (start → bug-hunt banner → report gate → reset) | `scenario-detail-1440-light.png`, `scenario-detail-1440-dark.png` |
| `/scenarios/api-catalog-pagination` | Runnable clean-mode scenario | SWEEP | — |
| `/guides` | Guide index (11 guides) | Visual | `guides-1440-light.png`, `vp-guides-1440-light.png` |
| `/guides/guide-manual-test-design` | Guide detail | Visual | `guide-detail-1440-light.png` |
| `/practice` | Practice environment (start path, recommended path, hunt list) | Visual + SWEEP | `practice-1440-light.png`, `vp-practice-1440-light.png` |
| `/progress` | Learning record — activity, hunts, 5 lab sections, recent submissions | Visual + SWEEP | `progress-1440-light.png`, `progress-1440-dark.png` |

### API & identity

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/api-reference` | OpenAPI-driven reference | Visual; **375/390 px horizontal overflow reproduced (register F-006 / maintainer-accepted F10)** | `vp-api-reference-1440-light.png`, `api-reference-375-light-overflow.png`, `api-reference-390-dark-overflow.png` |
| `/api-lab` | Same-origin request console | Visual + SWEEP | `api-lab-1440-light.png`, `vp-api-lab-1440-light.png` |
| `/login` | Synthetic demo sign-in | SWEEP + content probe | — |
| `/account` | Guest/account profile (signed-out state probed) | SWEEP + content probe | — |
| `/account/orders` | Order history | SWEEP | — |
| `/account/orders/:reference` | Order detail | NOT INSPECTED (needs a completed checkout first; no mutation performed) | — |
| `/admin/inventory` | Staff-only stock tool (signed-out gate probed; shows staff-only notice) | SWEEP + content probe | — |

### Database / SQL

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/database` | Database Testing hub | Visual | `database-1440-light.png`, `vp-database-1440-light.png` |
| `/database/playground` | SQL playground (sql.js WASM) | Visual | `database-playground-1440-dark.png` |
| `/database/exercises/sql-bgn-select-01` | SQL exercise | SWEEP | — |

### Contract Testing

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/contract` | Contract Testing hub | Visual | `contract-1440-light.png`, `vp-contract-1440-light.png` |
| `/contract/validate` | Contract validator workspace | SWEEP | — |
| `/contract/compare` | Contract diff workspace | SWEEP | — |
| `/contract/consumer` | Consumer-driven verification | SWEEP | — |
| `/contract/exercises/contract-bgn-openapi-01` | Contract exercise | SWEEP | — |

### Performance

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/performance` | Performance Testing hub | Visual | `performance-1440-light.png`, `vp-performance-1440-dark.png` |
| `/performance/workspace` | Bounded load runner | SWEEP | — |
| `/performance/exercises/perf-bgn-baseline-01` | Performance exercise | SWEEP | — |

### Security

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/security` | Security Testing hub | Visual | `security-1440-light.png`, `vp-security-1440-light.png` |
| `/security/demos` | Inert SQLi/XSS/CSRF demos | SWEEP | — |
| `/security/exercises/sec-bgn-authn-01` | Security exercise | SWEEP | — |

### Microservices / events

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/microservices` | Microservices & Event-Driven hub | SWEEP + Visual | `microservices-1440-light.png`, `vp-microservices-1440-light.png` |
| `/microservices/simulator` | Event-driven order pipeline simulator | Visual | `microservices-simulator-1440-dark.png` |
| `/microservices/exercises/evt-bgn-guarantee-01` | Event exercise | SWEEP | — |

### Commerce (practice target)

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/shop` | "Shop the catalogue" (40 synthetic products) | Visual | `shop-1440-light.png` |
| `/shop/products/sundrift-pocket-compass` | Product detail | SWEEP | — |
| `/cart` | Cart | SWEEP | — |
| `/checkout` | Checkout (empty-state probed) | Visual | `checkout-1440-light.png` |
| `/orders/:reference` | Order confirmation | NOT INSPECTED (requires a completed checkout; no mutation performed) | — |

### Meta

| Route | Purpose (rendered H1) | Inspection | Screenshot / evidence |
|---|---|---|---|
| `/about` | About this build / evaluation rubric | Visual | `about-1440-light.png` |
| `*` (404) | Not-found page | SWEEP (h1 = "That page is not part of the lab.") | — |

### Cross-cutting shell (every page)

| Element | Inspection |
|---|---|
| Top bar (brand, global search with `/` shortcut, cart badge, sign-in, theme toggle) | Visual (`vp-dashboard-1440-light.png`, mobile shots) |
| Sidebar (Learn / Workspace groups, 15 items + staff gate) | Visual |
| Mode banner (Clean mode / Bug-hunt mode; exercised start → active hunt → reset) — **renders only on the commerce Practice App surfaces (`/shop*`, `/cart`, `/checkout`, `/orders/:reference`, `/account`, `/account/orders*`, `/login`, `/admin/inventory`) since the post-R4 copy correction; QA labs do not show it (see the post-R4 copy-correction addendum)** | Visual + Flows |
| Mobile navigation drawer (focus trap, Escape, 390×844, open + close) | Visual (`mobile-nav-open-390-light.png`) — drawer content scrolls; 15 items + staff gate |
| Skip link / `main#main-content` / landmarks | Source + JS probes on 11 routes (landmarks present; one `<main>` each) |
| Keyboard focus ring (`:focus-visible`) | Visual (`focus-tab-dashboard-1440-light.png`); global rule in `base.css` |

## Machine-swept results

| Sweep | Result |
|---|---|
| 1440×900 light, 41 routes | 0 horizontal overflow; 0 unexpected console errors; single h1 on all 41 |
| 1440×900 dark, 41 routes | same — clean |
| 1280×800 light, 41 routes | clean |
| 768×1024 light, 41 routes | clean |
| 375×812 light, 41 routes | overflow only on `/api-reference` (+186 px; offenders `SECTION.api-group`, `.section-header`, `.api-endpoint-list`, `ARTICLE.api-…` tables) |
| 390×844 dark, 41 routes | overflow only on `/api-reference` (+171 px) |

Console errors observed: **none** on any swept route in either theme (Chrome 155, fresh profile).

## Coverage gaps & limitations

1. **`/orders/:reference`, `/account/orders/:reference`** never rendered — would require placing an order; the audit performed **no** mutations of application state (one local bug-hunt start/reset cycle was exercised and reset to clean; local D1 only, discarded).
2. **`/shop/products/:slug`** was rendered with a valid catalogue slug (`sundrift-pocket-compass`); the originally guessed slug (`meridian-field-jacket`) rendered the intended "Product not found" empty state — noted, not a defect.
3. **Firefox/WebKit** not tested (Chrome only); cross-browser rendering unverified.
4. **No axe/pa11y** — automated a11y evidence is limited to the custom probes listed in `docs/ui-ux-audit.md` §6; anything not machine-checked is labelled *potential concern* or *manual verification required*.
5. **Screen-reader behaviour** (NVDA/VoiceOver) not tested.
6. **Zoom at 200%** not tested.
7. Sweeps used `captureBeyondViewport` screenshots for full-page documentation; interactive substates (hint ladder opened, report form validation, cart with items, signed-in chrome) were not exhaustively captured.
8. Local server is the audited build; no production probing was performed and no external resources touched.

---

## Post-change verification addendum — R1 (2026-11-17)

> This addendum records **post-change** verification performed during the R1
> (UI/UX trust & presentation fixes) milestone on the `ui-ux-redesign` branch.
> It is deliberately separate from the audit results above; the audit rows and
> screenshots in this document (branch `main` @ `297a030`) are preserved
> unchanged and remain the original audit evidence. Where the two differ, this
> addendum reflects the state of the R1 working tree, **not** `main`.

Build under test: local `wrangler pages dev` on `:8788` serving `dist/` rebuilt
from the R1 working tree (entry `index-B9mBnHKz.js`, 448.47 kB / gzip 137.59 kB).
Method: same raw-CDP headless Chrome 155 approach as the audit (no installed
tooling); 17 R1-affected routes (`/`, `/tracks`, `/tracks/manual-testing`,
`/scenarios`, `/scenarios/manual-cart-totals`, `/scenarios/api-catalog-pagination`,
`/guides/guide-manual-test-design`, `/performance`, `/security`, `/contract`,
`/database`, `/microservices`, `/practice`, `/progress`, `/shop`, `/about`,
`/this-route-does-not-exist`) were machine-swept for horizontal overflow, single
h1 and console errors in: 1440×900 light, 1440×900 dark, 375×812 light,
768×1024 light and 390×844 dark. **Result: 0 overflow, 0 console errors, one h1
per route, all 85 renders pass.** Heading-sequence probe (skip detection):
`/scenarios` and `/shop` now report **0 skips** (audit: 1 each — fixed via
`sr-only` h2 before the grids; audit F-013). READY-tag computed contrast on
`/scenarios`: light `rgb(20,108,52)` on `rgb(231,245,236)` = **5.79:1**; dark
`rgb(134,239,172)` on `rgb(16,41,29)` = **11.02:1** — both pass WCAG AA at
12 px (audit F-014). Visual inspection (viewport screenshots, this session):
`/performance` dark, `/security` light, `/contract` light, `/microservices`
dark — the "How to practice" blocks now render `Title. detail` with explicit
separation (audit F-005); `/scenarios` light full-page render OK. Content
probes confirmed the R1 copy renders (dashboard hero counts, Tracks note,
Practice formats 4-of-6-live, About "What works today"/"What comes next",
RecommendedPath derived placeholder count of 14, guide callout).

Not re-verified in this addendum (limitations, unchanged from audit):
Firefox/WebKit; screen-reader behaviour; 200% zoom; interactive substates
beyond the audit's probes; `/orders/:reference` and `/account/orders/:reference`
remain unrendered (no checkout performed, per instructions); `/api-reference`
was **not** in the R1 matrix and F10 (its 375 px overflow) remains open and
accepted — **F10 was explicitly excluded from R1 and is unfixed**.

---

## Post-change verification addendum — R2 (2026-11-17)

> Separate, post-R2 verification of the R2 (Navigation & Information
> Architecture Redesign) milestone on branch `ui-ux-redesign`, layered on top
> of the R1 working tree. The audit rows above and the R1 addendum remain the
> original evidence for their respective baselines; this section reflects
> only the R2 working tree and says nothing about `main`.

Build under test: local `wrangler pages dev` on `:8788` serving `dist/`
rebuilt from the R2 working tree (entry `index-DpNPjJNz.js`, 456.36 kB /
gzip 140.45 kB). Method: same raw-CDP headless Chrome 155 approach (no
installed tooling).

**Machine sweep (overflow / single h1 / console errors)** — same 17
R1-affected routes × 1440×900 light, 1440×900 dark, 375×812 light, 390×844
dark and 768×1024 light (**85 renders**): **0 horizontal overflow, 0 console
errors, one h1 per route.** No `/api-reference` claim is made here — F10
remains excluded from R2 and the route was not in the matrix.

**Heading-sequence probe (skips):** `/scenarios` 0, `/shop` 0, `/practice` 0,
`/about` 0, `/guides` 0, **`/tracks` 0 (was 1 — fixed during R2 via sr-only
h2)**.

**Interaction probes (CDP, this session, all passing unless noted):**
- Breadcrumbs present on all non-root routes probed (`/tracks`, `/scenarios`,
  `/guides`, `/practice`, `/progress`, `/shop`, `/about`,
  `/this-route-does-not-exist`, `/tracks/manual-testing`,
  `/scenarios/manual-cart-totals`) with journey-group labels; root dashboard
  intentionally has none (F-011 coverage).
- Global search: `role="combobox"` input, results panel `role="listbox"`,
  groups labelled Exercises/Guides/Labs (“cart” → Exercises|Labs, “api” → all
  three); ArrowDown sets `aria-activedescendant`; Enter navigates to the
  active result; plain Enter (no active option) routes to
  `/scenarios?q=…`; Escape clears; no-results state renders with a
  catalogue-search link; `/` shortcut focuses the input at ≥1024 px width
  (disabled <1024 px, as designed); click-outside closes the panel.
- Mobile drawer: four groups (Start/Practise/Labs/My work) with headings,
  scrollable, Escape closes, focus returns to the menu button, staff
  Inventory entry absent for guest (staff gating untested — no staff
  credentials used).
- Desktop sidebar: four journey groups; collapsed mode hides headings/labels,
  keeps icons, works toggled both ways.
- Dashboard: canonical "Your next step" panel renders from live server
  progress (guest state shows the 7-day durability note + sign-in link);
  duplicated "Your start path" stepper removed.
- Visual inspection (viewport screenshots, this session): dashboard light +
  dark, exercises page (lab cards), bug hunts page, search panel open,
  collapsed sidebar, mobile drawer open.

**Not verified (limitations, unchanged or new):** Firefox/WebKit;
screen-reader behaviour; 200% zoom; staff-mode rendering of the drawer/sidebar
Inventory entry (no staff credentials exercised; gating logic unchanged);
`/orders/:reference` and `/account/orders/:reference` remain unrendered (no
checkout performed); F10 re-verification deliberately out of scope.

---

## Post-change verification addendum — R2 follow-up: Practice App separation (2026-11-18)

> Separate, post-change verification of the R2 follow-up ("Separate the
> E-commerce Practice App from QA Labs") on branch `ui-ux-redesign`, layered on
> R1+R2. The audit rows and previous addenda remain the original evidence for
> their baselines; this section reflects only the follow-up working tree.

Build under test: local `wrangler pages dev` on `:8788` serving `dist/` rebuilt
from the follow-up working tree (entry `index-BMpeB-lo.js`, 458.06 kB /
gzip 140.96 kB). Method: raw-CDP headless Chrome 155 (no installed tooling).

**Machine sweep:** 17 routes affected by the change (`/`, `/tracks`,
`/scenarios`, `/guides`, `/practice`, `/progress`, `/shop`,
`/shop/products/sundrift-pocket-compass`, `/cart`, `/checkout`, `/account`,
`/account/orders`, `/accounts`, `/admin/inventory`, `/about`,
`/this-route-does-not-exist`, `/performance`) × 1440×900 light, 1440×900 dark,
375×812 light, 390×844 dark — **68 renders, 0 horizontal overflow, 0 console
errors, one h1 each** (375/390 dark-run once required a re-run after the known
localStorage seed flake; clean on retry). F10 remains excluded; `/api-reference`
was not in the matrix and was not modified.

**Interaction probes (all pass unless noted):** desktop sidebar shows five
groups (Start / Practise / Labs / Practice App / My work) with per-group note
lines and a dashed, sunken Practice App container; Labs no longer contains any
store destination; My work has Bug hunts / Progress / Account. Practice App
active states verified on `/shop` (Storefront), `/shop/products/:slug`
(Storefront, nested), `/cart`, `/checkout`, `/account/orders` and
`/account/orders/:reference` (Customer account); platform `/account` marks only
the MY WORK Account entry (end-matched). Mobile drawer: five groups in order,
Practice App box with shopper entries, scrolls, Escape closes (focus restore
pattern unchanged), group note mentions the fictional app. Search: new
"Practice app" group; "cart" query surfaces Storefront/Cart/Checkout/Customer
account under it; Labs group contains no store destinations; seven existing
search unit tests pass with one test's allowed-label list extended to include
`Practice app`, plus one new assertion (store group membership).

**Breadcrumbs:** all store surfaces now read `Dashboard / Practice App / …`
(strips LABS crumbs); `/account` (platform) stays `Dashboard / Account`;
`/admin/inventory` reads `Dashboard / Practice App / Inventory (staff)` —
staff Inventory gate confirmed unchanged (guest sees the sign-in/staff notice,
never the staff tool).

**Order routes not rendered:** `/orders/:reference` breadcrumb was verified via
the sweep (200, h1, no console errors) but no order was placed or mutated to
reach it — it was rendered by direct URL navigation only; `/account/orders/:reference`
was likewise not rendered (no checkout performed, per instruction).

**Not verified (limitations):** Firefox/WebKit; screen-reader behaviour; 200%
zoom; staff-mode rendering (no staff credentials exercised; gate unchanged);
checkout completion flow; the dark-theme Practice App container (verified at
1440 px only; light+dark theme parity confirmed by screenshots at 1440 px —
screenshots in /tmp/opencode/r2-shots/).
---

## Post-change verification addendum — R3 (2026-11-18)

> Separate, post-R3 verification of the R3 (Practice experience, progress
> dashboard & content consolidation) milestone on branch `ui-ux-redesign`,
> layered on R1 + R2 + the R2 follow-up. The audit rows and previous
> addenda remain the original evidence for their baselines; this section
> reflects only the R3 working tree and says nothing about `main` or
> production.

Build under test: local `wrangler pages dev` on `:8788` serving `dist/`
rebuilt from the R3 working tree (entry `index-HFmx9THp.js`, 458.13 kB /
gzip 140.96 kB). Method: same raw-CDP headless Chrome 155 approach (no
installed tooling), fresh throwaway profile per run.

**Machine sweep (overflow / single h1 / console errors)** — 7 routes
(`/`, `/practice`, `/progress`, `/scenarios`, `/about`,
`/scenarios/manual-cart-totals`, `/this-route-does-not-exist`) ×
1440×900 light, 768×1024 light, 375×812 light, 1440×900 dark and
390×844 dark — **35 renders, 0 horizontal overflow, one h1, zero console
errors.** F10 remains excluded; `/api-reference` was not in the matrix and
was not modified.

**Interactive probes (100/100 checks pass, local D1 only):**
- Guest with no progress: Do this next renders with `Start here` framing;
  "Nothing recorded yet" states once; all six lab disclosures start closed;
  per-area counts read "Not started yet"; submissions list shows the empty
  state; discovery tile reads `0 of 34` (wired hunt ceiling).
- Partial progress (start → report submitted through the real UI): attempt
  counted, report counted, Do this next advances past the completed step,
  the attempted area starts expanded, recent submissions populate (verdict
  chip `SOLID`), hint/discovery/best-score chips render per row.
- Collapsible sections: native `<details>/<summary>`; Enter/click toggles;
  counts appear in the summary; closed zero-activity sections render no
  rows — the page is ~2.2–3.1k px (was ~12.3k px).
- Bug hunts (`/practice`): "Two modes, one shop" explainer renders before
  any activation; grouped hunt list renders with live counts ("0 of 34
  attempted · 0 with a submitted report · 0 discovered"); start → banner
  flip → reset cycle works and restores clean mode; Recommended path
  intact.
- Scenario catalogue: "How to read this catalogue" callout renders;
  `?hunt=available` shows the 34 wired hunts; `?mode=clean` works; URL
  state, search and filters preserved.
- About & scoring: on-page nav, section anchors (`#what-works`,
  `#what-comes-next`, `#durability`, `#evaluation`, `#rubric-checks`,
  `#verdict-bands`, `#discovery-vs-score`, `#hints-and-reveals`) all
  resolve; `#evaluation` hash scroll/focus preserved.
- Regression: breadcrumbs intact on affected routes; console clean on
  `/`, `/practice`, `/progress`, `/scenarios`, `/about`; deep links
  unchanged.

**Not verified (limitations):** Firefox/WebKit; screen-reader behaviour;
200% zoom; staff-mode rendering (no staff credentials; gate unchanged);
order routes (`/orders/:reference`, `/account/orders/:reference`) not
rendered — no checkout was performed; interactive hunt substates beyond the
start→report→reset flow; local D1 holds anonymous scratch session rows
from probes (local only; a report was filed by a throwaway anonymous
session and orphaned with its profile).

---

## Post-change verification addendum — R4 (2026-11-18)

> Separate, post-R4 verification of the R4 (Visual Polish) milestone on
> branch `ui-ux-redesign`, layered on R1 + R2 + the R2 follow-up + R3. The
> audit rows and previous addenda remain the original evidence for their
> baselines; this section reflects only the R4 working tree and says nothing
> about `main` or production.

Build under test: local `wrangler pages dev` on `:8788` serving `dist/`
rebuilt from the R4 working tree. The milestone was verified in two
passes; the **final** build under test is entry `index-BA9US9FO.js`,
458.20 kB / gzip 140.99 kB (identical app code to `index-CdKscb2P.js` —
the delta is eight visually-hidden `<h1 className="sr-only">…</h1>`
additions in not-found branches, see below). Method: headless Google
Chrome over Playwright (`domcontentloaded` + fixed wait, fresh throwaway
context per run, no new dependencies installed or added to the repo),
local D1 only.

**Machine sweep** — 35 routes (`/`, `/tracks`, `/tracks/manual-testing`,
`/tracks/not-a-track`, `/scenarios`, `/scenarios/api-catalog-pagination`,
`/scenarios/not-a-scenario`, `/guides`, `/guides/guide-manual-test-design`,
`/guides/not-a-guide`, `/practice`, `/progress`, `/about`,
`/api-reference`, `/api-lab`, `/database`, `/database/playground`,
`/database/exercises/not-an-exercise`, `/contract`,
`/contract/exercises/not-an-exercise`, `/performance`,
`/performance/exercises/not-an-exercise`, `/security`,
`/security/exercises/not-an-exercise`, `/microservices`,
`/microservices/exercises/not-an-exercise`, `/shop`, `/cart`, `/checkout`,
`/account`, `/account/orders`, `/login`, `/not-a-page`, plus the
`/api/health` JSON endpoint) × 1440×900, 1024×768, 768×1024, 375×812 in
**both** themes. **Every page renders exactly one h1 and one
`QA Practice Lab · v0.2.0` footer; zero console/page errors other than the
expected unauthenticated `GET /api/v1/auth/me` 401 guest probe; zero
horizontal overflow everywhere except `/api-reference` at 375 px in the
dark pass — F10, the maintainer-accepted pre-existing defect; it was not
investigated, not modified and not re-measured** (see `PROJECT_STATE.md`
§20/§26). A final confirmation pass on the post-h1-fix build (35 app routes
+ `/api/health`, light 1440 / dark 375, 72 renders) reproduced the same
result — one h1 each, zero overflow except F10 (dark 375), zero unexpected
console errors. The SPA fallback serves `/not-a-page` with HTTP 200 and
renders the 404 view with one h1 (expected behaviour).

**Not-found branches:** the invalid-id detail views rendered **zero** h1
before R4 (found by this sweep at `/scenarios/<invalid-id>`). Eight such
branches (`/scenarios/:id`, `/tracks/:id`, `/guides/:id`,
`/contract/exercises/:id`, `/database/exercises/:id`,
`/performance/exercises/:id`, `/security/exercises/:id`,
`/microservices/exercises/:id`) now carry a visually-hidden
`<h1 className="sr-only">` so the single-h1-per-route discipline holds on
them too (fix verified in both themes × four widths).

**Route-level presentation changes shipped by R4** (visible on every
route): the footer now reads `QA Practice Lab · v0.2.0` with a `Changelog &
scoring` link to `/about`; the structural type floor moved from 12 px to
13 px (`--text-kicker`) for mono kickers, field labels, fact keys, stat
labels, table headers, disclosure badges, tags and nav headings; `.tag`
height 1.5 → 1.6 rem; empty states render as sunken dashed wells with
13+ px body text; `/about` reference panels, `/about` TOC, guide TOCs,
rubric and verdict lists, and code examples render on the sunken surface
(two-surface grammar); status/selected affordances use the tinted
`--surface-selected` step, re-tuned in dark/workspace scopes
(`night-600` → `night-700`); 404 recovery links already in place unchanged.

**Interactive/behavioural notes:** one primary CTA per view audited and
enforced where it competed (dashboard hero keeps the solid `Find a
scenario`, the NextStepPanel CTA and all header "back" actions demoted to
secondary; `/api-reference` header CTA demoted, bottom `Open the API Lab`
keeps the solid slot; lab-hub ClassName `lab-hub` adds the 2.25 rem h1
step); `data-density="compact"` on `/progress` exercise lists, `/practice`
hunt lists and the dashboard “recommended” row list; `data-density=
"spacious"` on the guide article; `data-density` containers consume the
shared `--list-gap`/`--row-pad-y`/`--row-pad-x` tokens (default cozy, no
global settings system, no persistence); icons normalised to the 16/20 px
optical pair app-wide; guest empty states on `/account`, `/account/orders`
and `/account/orders/:reference` now state the 7-day guest durability
window and the no-migration rule verbatim in the empty-state copy; the
stale `/about` “The dashboard still shows labelled demo figures.” sentence
was removed (the dashboard shows real server progress since Phase 4; a test
assertion was inverted accordingly).

**Not verified (limitations):** Firefox/WebKit; screen-reader behaviour;
200% zoom; staff-mode rendering (no staff credentials exercised; gate
unchanged); checkout completion; order routes (`/orders/:reference`,
`/account/orders/:reference`); reduced-motion was not re-probed in a browser
this milestone (the media query and its rules are unchanged); dark-theme
`--surface-selected` was checked at 1440 px only via screenshots; F10 remains
out of scope and unverified by design.

---

## Post-R4 copy-correction addendum (2026-11-18)

> Narrow terminology/placement correction applied on `ui-ux-redesign`
> (post-R4), on top of the R4 working tree. No audit finding is re-opened;
> the audit rows above remain the original evidence for their baselines.
> This addendum records where commerce-mode messaging now appears and
> where it was removed.

**Change:** the global shell (`AppShell`) rendered the `ModeBanner`
("Clean mode — the commerce app behaves as specified" / "Bug-hunt mode —
…") on **every** route, implying the whole lab runs in commerce Clean
mode. It is now rendered **only on the commerce Practice App surfaces**:
`/shop`, `/shop/products/:slug`, `/cart`, `/checkout`,
`/orders/:reference`, `/account`, `/account/orders`,
`/account/orders/:reference`, `/login`, `/admin/inventory`. QA labs
(database, contract, performance, security, microservices, API reference,
API lab), guides, tracks, dashboard, about, progress and 404 render no
mode banner. Their own execution-mode language is unchanged (e.g. the
microservices simulator keeps its `CLEAN` status chip). Bug-hunt surfaces
keep their existing contextual mode UI (`/practice` hunt panel,
`/scenarios` hunt-launch chips, HuntPanel clean/bug-hunt status tags),
and `/practice` now explains both modes in the intended concise wording:
"Shop normally. The commerce app behaves as specified; no deliberate
defects are enabled." (Clean) and "Explore the same app with deliberate
defects enabled. Find and report unexpected behaviour." (Bug-hunt).
Banner copy aligned the same way. **No mode-activation, defect-injection,
hunt-engine, scoring, API, D1, auth or persistence behaviour changed;
only rendering scope and copy.**

**Verification (final build entry `index-YGOGZbMN.js`, 458.41 kB / gzip
141.09 kB; local `wrangler pages dev` + local D1; headless Chrome):**
96 renders (24 routes × 1440×900 & 375×812 × light/dark) — commerce
routes show the banner (clean in the default session), all 16 unrelated
routes show none. Bug-hunt end-to-end (local): started the cart-totals
hunt from `/scenarios/manual-cart-totals`; `/shop`, `/cart`, `/checkout`,
`/account` showed the compact bug-hunt banner ("Order totals do not add
up … find and report unexpected behaviour. Reset to clean"); `/security`
and `/database` stayed banner-free; reset restored clean mode.
`npm run check` 1504/1504 green; `npm run build` clean.

---

## Post-R4 mobile UI fix addendum — `/shop` storefront (2026-11-18)

> Narrow responsive repair on `ui-ux-redesign` (layered on the R4 tree and
> the post-R4 copy correction). The audit rows and previous addenda
> remain the original evidence for their baselines; this addendum records
> the `/shop` grid fix and the adjacent 320 px shell overflow fix.

**Defect (found by measurement):** `@media (max-width: 760px)` overrode
`.product-grid` with `repeat(auto-fill, minmax(0, 1fr))`, collapsing the
track sizing function into dozens of ~1 px tracks — product cards
rendered ~50 px wide and ~569 px tall at every width ≤760 px (computed,
not eyeballed). The page itself was scroll-free except at 320 px, where
the shared topbar (brand mark + copy + actions) exceeded the viewport.

**Fix:** single full-width `minmax(0, 1fr)` column below 761 px;
`.product-card` gains `min-width: 0`; the broken auto-fill override was
deleted; `layout.css` hides brand copy below 400 px (mark only) so the
320 px bar fits. Desktop (≥761 px) unchanged. No content, route, API,
D1, scoring or hunt-engine changes.

**Verification:** `npm run check` 1504/1504 green; `npm run build` clean
(entry `index-CRWZaeVp.js`, 458.41 kB / gzip 141.10 kB). Computed-style
sweeps at 320–1280 px (both themes spot-checked): single column ≤760 px,
`scrollWidth === innerWidth` at every width; full-page screenshots
eyeballed at 320/375/390/500/760 light and 375/500 dark (individual
bordered cards, clear price/stock/category/CTA hierarchy, out-of-stock
state, pagination intact). `/cart`, `/checkout`, `/security`, `/`
re-verified at 320 px (one h1, no overflow). Chrome only; Firefox/WebKit
untested.

## Final UI/UX closure addendum — 2026-11-18

> Companion to `PROJECT_STATE.md` §29. The audit rows above, the original
> screenshot set and every prior addendum are preserved verbatim. This
> addendum records the closure verification only.

- **Cross-browser:** Firefox 155 (Playwright) swept 24 routes (light) and 12 key
  routes (dark) at 375 / 768 / 1440 px — **108 renders, 0 overflow, one h1,
  zero unexpected console/page errors**. **WebKit/Safari could not run in this
  environment** (Playwright WebKit aborts in `WPENetworkProcess` with a
  snap-core20 glibc `__libc_pthread_init` symbol lookup failure — environment
  defect, not the app). Do not cite WebKit support as verified.
- **200 % zoom (reflow equivalents):** halved CSS viewports (720×450, 640×400),
  18 routes × 2 themes, **72 renders — 0 overflow, one h1**. Native browser zoom
  UI not separately exercised. `/api-reference` excluded per F10.
- **Reduced motion (emulated):** global `0.01 ms !important` override active;
  `scroll-behavior: auto`; disclosure toggles remain functional.
- **Keyboard (1440 px):** skip link first (2 px solid ring); every probed stop
  shows a visible focus affordance (search uses its designed `:focus-within`
  box-shadow); mobile drawer opens at 390 px, focus-trapped, **Escape closes**.
- **Programmatic a11y probes (19 routes):** one banner/main/contentinfo landmark
  set, **0 unlabeled controls** (`/login` inputs carry `<label htmlFor>`), **0
  heading skips**, single h1, skip link on every route.
- **Staff mode:** local sign-in as Rowan Ellison — `Inventory` renders under the
  **Practice App** group; `/admin/inventory` h1 "Inventory". Gate unchanged.
- **`/shop` re-measured:** 320/375/390/760 px (light & dark) — single
  full-width column below 761 px, `scrollWidth === innerWidth`, one h1.
- **Mode-banner scope re-verified:** commerce routes only (`/shop`, `/cart`,
  `/checkout`, `/account`, `/login`); all QA/lab/meta routes render none.
- **Announcements:** `role="status"` present on commerce banners; `/practice`,
  `/scenarios` carry `aria-live` regions. **No screen reader was installed or
  used — announcement quality is unverified.** Human usability testing was not
  performed.
- **Screenshot count:** the folder holds **40 files** (~25 MB) on disk, all
  referenced paths resolve; the audit narrative's "41 screenshots" figure is
  recorded as inaccurate (one screenshot appears never to have been saved).
  No file was deleted. `docs/audit-screenshots/` is now listed in `.gitignore`,
  was never tracked in any branch or history, and must stay out of commits.
- **F10 (`/api-reference` 375 px overflow)** remains accepted, open and
  deliberately unfixed — excluded from every closure matrix, untouched.
- Production untouched: deployment `18db4007-…`, source `981176a`,
  `schema_version` 14. Local `wrangler pages dev` + local D1 only.
- **Disposition of findings F-001…F-024 and hypotheses H-1…H-5:** see
  `PROJECT_STATE.md` §29.2 — all P1/P2 items fixed and verified except F-006/F10
  (accepted/excluded); F-018 accepted; F-021 partially addressed with the
  top-bar cart badge recorded as a maintainer-review residual; F-020 verified
  only under emulation; H-3 fixed but not fully verified (no screen reader).
