# AGENTS.md — QA Practice Lab

## Current repo state

- **Phase 2 (app shell, learning tracks, scenario catalog, guides) is implemented.** Phase 3 and later are not started.
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
- Never create remote Cloudflare resources, run `--remote` migrations, or deploy in this phase.

## Architecture

- `functions/api/[[route]].ts` is the only Pages Functions entrypoint. It bridges the `/api` catch-all to Hono via `handle()` from `hono/cloudflare-pages`.
- The Hono app lives in `src/server/app.ts` with `basePath('/api')` and is exported for unit tests. D1 is bound as `DB` (`c.env.DB`).
- `src/server` is excluded from `tsconfig.app.json`; server/tests type-check under `tsconfig.functions.json` with `@cloudflare/workers-types`.
- D1 migrations live in `db/migrations/`; local state is `.wrangler/state/v3/d1/`. `wrangler.jsonc` has a placeholder `database_id` on purpose.
- Pages serves SPA deep links natively **only while `dist/` has no top-level `404.html`**. Do not add a `_redirects` catch-all like `/* /index.html 200`; Wrangler rejects it as an infinite loop.
- Node **>=22.12** is required (Vitest 5). Dev script needs a built `dist/`; use `dev:web` only if the API is already running separately.

## Frontend structure

- Routes live in `src/app/App.tsx`: `/`, `/tracks`, `/tracks/:trackId`, `/scenarios`, `/scenarios/:scenarioId`, `/guides`, `/guides/:guideId`, `/progress`, `/practice`, plus a 404 fallback. All render inside `AppShell`.
- Typed learning content lives in `src/data` (`types.ts`, `tracks.ts`, `scenarios.ts`, `guides.ts`, `categories.ts`, `demo.ts`). Update content there, not inside page components.
- Pure, testable logic lives in `src/lib` (`catalog.ts` filtering, `labels.ts`, `navigation.ts`, theme helpers/hooks). Keep data transformations out of JSX where practical.
- Styling is hand-written CSS in `src/styles/{tokens,base,layout,components,pages}.css`, imported by `global.css`. There is no Tailwind. Prefer design tokens, and be careful with cascade order: a later, equal-specificity rule wins across files.
- Themes use `document.documentElement.dataset.theme`, the `qa-practice-lab-theme` storage key, and the inline bootstrap in `index.html`. Keep the bootstrap and `ThemeProvider` in sync.
- Sidebar collapse uses the `qa-practice-lab-sidebar-collapsed` storage key.
- Scenario placeholders must stay `runnable: false` with a non-`ready` status until a phase actually implements the exercise. Do not make demo progress look persisted.

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

- Work on one phase/vertical slice at a time. **Next task is Phase 3 — commerce practice app**, not yet started.
- Update `PROJECT_STATE.md` in the same turn as any code/plan change: status, decisions, files changed, commands/tests run, blockers, exact next action, progress log.
