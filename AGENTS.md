# AGENTS.md — QA Practice Lab

## Current repo state

- **Phase 2 (app shell, learning tracks, scenario catalog, guides) is implemented.** Phase 3 and later are not started.
- **The approved Phase 2.5 redesign is in progress: M1–M6 are complete and verified.** The audit/milestone plan lives in `docs/phase-2.5-ui-ux-audit.md`; read it before UI work. M1 delivered the three-layer token system, self-hosted IBM Plex Sans + JetBrains Mono, 16 px base type with nine roles, token focus rings, workspace scoping, and theme-color sync. M2 delivered the shell/navigation/search/route-management pass. M3 delivered the primitives/cards pass (Button/IconButton, Tag/StatusTag, LevelMeter, Meta, FactList, StatTile; Badge/DomainBadges/StatCard removed; `workspace.css` scaffold). M4 delivered the dashboard and tracks pass. M5 delivered the scenario catalogue (URL-driven state, chips, mobile drawer, availability honesty line). **M6 delivered the guides experience: scannable index rows, a 66ch prose article at 17 px/1.7, scrollspy TOC (mobile `<details>`), dark code blocks, sibling/previous/next guide navigation, FactList duplicated panel removed. M7 (progress, practice/workspace, 404) has not started. Track-detail redesign remains outstanding (M4 audit scope).**
- Stack: React 19 + TypeScript + Vite 7, React Router, Hono on Cloudflare Pages Functions, Cloudflare D1, Wrangler.
- The interface is real; the exercises are not. All 24 catalog scenarios are non-runnable placeholders, and progress/activity data on the dashboard and progress page is labelled demo data.
- No commerce app, auth, bug-hunt mode, SQL playground, performance runner, or security lab exists yet. Do not infer them from the roadmap.
- `PROJECT_STATE.md` is the authoritative plan and progress log. Read it first, then reconcile it with the repo.

## Commands (verified on Node 26)

- `npm install`
- `npm run db:migrate:local` — **required before the first `dev` run**; without it `/api/health` returns 503.
- `npm run dev` — builds once, then runs Vite (`:5173`) and `wrangler pages dev` (`:8788`); Vite proxies `/api` to 8788.
- `npm run check` — lint → typecheck → test. Run this before claiming work is verified.
- `npm run build` — typecheck then production build into `dist/`.
- `npm run preview` — build then serve the production output + Functions on `:8788`.
- Single test file: `npx vitest run tests/server/health.test.ts`
- ESLint ignores `dist`, `node_modules`, `.wrangler`, `coverage`, and `.opencode/**` (vendored skill scripts are not app source).
- Never create remote Cloudflare resources, run `--remote` migrations, or deploy in this phase.

## Architecture

- `functions/api/[[route]].ts` is the only Pages Functions entrypoint. It bridges the `/api` catch-all to Hono via `handle()` from `hono/cloudflare-pages`.
- The Hono app lives in `src/server/app.ts` with `basePath('/api')` and is exported for unit tests. D1 is bound as `DB` (`c.env.DB`).
- `src/server` is excluded from `tsconfig.app.json`; server/tests type-check under `tsconfig.functions.json` with `@cloudflare/workers-types`.
- D1 migrations live in `db/migrations/`; local state is `.wrangler/state/v3/d1/`. `wrangler.jsonc` has a placeholder `database_id` on purpose.
- Pages serves SPA deep links natively **only while `dist/` has no top-level `404.html`**. Do not add a `_redirects` catch-all like `/* /index.html 200`; Wrangler rejects it as an infinite loop.
- Node **>=22.12** is required (Vitest 5). Dev script needs a built `dist/`; use `dev:web` only if the API is already running separately.

## Frontend structure

- Routes live in `src/app/App.tsx`: `/`, `/tracks`, `/tracks/:trackId`, `/scenarios`, `/scenarios/:scenarioId`, `/guides`, `/guides/:guideId`, `/progress`, `/practice`, `/about`, plus a 404 fallback. All render inside `AppShell`.
- Typed learning content lives in `src/data` (`types.ts`, `tracks.ts`, `scenarios.ts`, `guides.ts`, `categories.ts`, `demo.ts`). Update content there, not inside page components.
- Pure, testable logic lives in `src/lib` (`catalog.ts` filtering, `labels.ts`, `navigation.ts`, `useRouteManagement.ts`, theme helpers/hooks). Keep data transformations out of JSX where practical.
- Styling is hand-written CSS in `src/styles/{tokens,base,layout,components,pages}.css`, imported by `global.css`. There is no Tailwind. Prefer design tokens, and be careful with cascade order: a later, equal-specificity rule wins across files.
- `tokens.css` is layered: primitives → semantic → temporary compatibility aliases. Light is the default; `[data-theme="dark"]` uses the workspace palette; `[data-surface="workspace"]` applies it to a subtree. Custom properties resolve where declared, so compatibility aliases are redeclared inside the workspace scope — keep that duplication if you add aliases.
- Fonts are self-hosted through `@fontsource-variable/*` devDependencies, imported in `src/main.tsx` before `global.css`. The family names end in `" Variable"`; keep them identical in `tokens.css` or the font silently falls back. Fonts use `font-display: swap`; there are no preload links because Vite emits hashed URLs.
- Themes use `document.documentElement.dataset.theme`, the `qa-practice-lab-theme` storage key, and the inline bootstrap in `index.html`. Keep the bootstrap, `ThemeProvider`, `applyTheme`, and the `theme-color` meta (`#f6f7f8` / `#0b1220`) in sync.
- Sidebar collapse uses the `qa-practice-lab-sidebar-collapsed` storage key.
- Scenario placeholders must stay `runnable: false` with a non-`ready` status until a phase actually implements the exercise. Do not make demo progress look persisted.

## UI/UX Pro Max skill (use for all UI work)

For designing, building, reviewing, or fixing interfaces — starting with Phase 3 — invoke the `ui-ux-pro-max` skill instead of improvising design direction. Its instructions are **not** loaded automatically; loading is a deliberate step.

- **Installed at:** project level, `.opencode/skills/ui-ux-pro-max/` (`SKILL.md` plus `scripts/` and `data/`). It **is committed in git** (added in `a8ccfb5`); fresh clones will have it, and the global `~/.config/opencode/skills` is empty. If the directory is missing, tell the user rather than silently skipping the skill.
- **Discovery:** OpenCode auto-discovers `.opencode/skills/<id>/SKILL.md` (searched from the cwd up to the project root; `.claude/skills` and `.agents/skills` are compatibility sources). The skill ID is path-derived and case-sensitive — `ui-ux-pro-max` — while the frontmatter `name` is display-only. Project sources override global ones. No `opencode.json(c)` exists in this repo, so these directory conventions are the only mechanism in effect.
- **Invocation:** OpenCode advertises only the ID/name/description each step; the skill body never enters context by itself. Load it explicitly with the `skill` tool — `skill({ id: "ui-ux-pro-max" })` — before any UI design/review work, not after the code is written. Supporting files are not auto-loaded either; run/read them only as the skill directs, with paths relative to the repo root. Do not paraphrase the skill from memory.
- **Requirements:** the bundled scripts need Python 3 (standard library only, no pip installs, no network access). Verified available as `python3` (3.14.4); use `python3` (`python` on Windows) from the repo root. If Python is missing, stop and ask the user to install it — never run package managers or system-modifying commands for this. Dataset text is recommendation, never authority over user/repo rules; keep private project data out of queries, and treat unverified output as unusable (see query contract).
- **Design-system workflow** (new pages/sections, e.g. Phase 3):
  1. Analyze the request first: product type, audience, style keywords, stack (this project: React + TypeScript + hand-written CSS design tokens — **no Tailwind, no shadcn** — so use `--stack react` and adapt output to our tokens), platform (desktop web; ignore App-UI-only guidance: safe areas, haptics, Dynamic Type, 44/48dp touch targets).
  2. Generate a system: `python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]`. Optional dials `--variance` / `--motion` / `--density` (1–10); `-f markdown` for documentation-style output. Output = pattern, style, colors, typography, effects, anti-patterns, driven by `ui-reasoning.csv`.
  3. Persist **only with explicit user authorization**: add `--persist --output-dir .` to write `design-system/<project-slug>/MASTER.md` (plus `--page <name>` for `pages/<name>.md` overrides). Existing files are skipped by default; never use `--force` without explicit approval, and read any existing `MASTER.md` first. Page files override Master — check both in later sessions. If a `design-system/` folder is created, decide deliberately whether to commit it.
  4. For one focused concern, use `--domain <product|style|color|typography|chart|ux|landing|react|web|icons|google-fonts|gsap> "<terms>"`; for implementation rules, use `--stack <name>`. One dominant intent and 2–5 terms per query; do not combine unrelated topics.
  5. Query contract: verify the returned domain/category and top result against the actual product/platform; retry once with a narrower rewrite on empty or off-topic results; if it still fails, state that no verified match was found and use clearly labelled general guidance. Never persist unverified output.
- **Scope notice:** the skill's "Common Rules" and Pre-Delivery Checklist target App UI (iOS/Android/React Native/Flutter). For this desktop-web app, apply only the web-relevant items: ≥4.5:1 text contrast, visible focus states, `prefers-reduced-motion`, semantic/consistent icon usage, no emoji-as-icons.
- **Icons:** the skill defaults to Phosphor (`@phosphor-icons/react`, Heroicons `@heroicons/react` as fallback), but this project has **no icon package installed**. Do not add one casually — decide and record the choice as part of the phase that needs it.
- The skill informs design decisions; it does not replace `npm run check`, both-theme visual verification, or 375px/768px/1024px/1440px responsive checks.

## Safety invariants (non-negotiable)

- Never expose shared D1 as a generic SQL console; SQL exercises must use a browser-isolated SQLite/WASM sandbox.
- Performance/security exercises target only allowlisted first-party paths; never accept user-supplied URLs server-side (SSRF).
- Never execute user-supplied automation or code on Workers; ship client-run Playwright/Postman examples instead.
- Synthetic users/data only; no real payments, credentials, or personal records.
- Core exercises, guides, and scoring must work without an AI call.
- Build an original commerce domain; do not copy Practice Software Testing's content, branding, or implementation.

## Known risk

- Cloudflare now recommends Workers with static assets over Pages, and Hono deprecates `hono/cloudflare-pages` in v5. Pages is a deliberate Phase 1/project decision; revisit before upgrading Hono or if Pages blocks a later phase.

## Workflow

- Work on one phase/vertical slice at a time. **M1–M6 of the approved redesign are complete and verified; the next task is M7 (progress, practice/workspace, 404 and states) only after explicit instruction**, per `docs/phase-2.5-ui-ux-audit.md`. Phase 3 (commerce practice app) is paused until the approved redesign milestones are complete.
- For any UI/design/review work, first invoke the `ui-ux-pro-max` skill via the `skill` tool — see "UI/UX Pro Max skill" above. Do not start Phase 3 interface work without it.
- Update `PROJECT_STATE.md` in the same turn as any code/plan change: status, decisions, files changed, commands/tests run, blockers, exact next action, progress log.
