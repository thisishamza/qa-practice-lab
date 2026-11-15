# QA Practice Lab

A safe, phased practice environment for software testing. The project is being built one
verifiable slice at a time; **Phases 1 and 2 are implemented, the Phase 2.5 UI redesign
(M1–M8) is complete and merged, and Phase 3 (commerce practice application) is in progress**.

Phase 1 proves the full local stack: a React + TypeScript shell, a Hono API running on Cloudflare
Pages Functions, and a Cloudflare D1 database checked through `GET /api/health`.

Phase 2 adds the learner-facing interface: a responsive app shell, twelve learning tracks, a
searchable scenario catalog, six full guides, progress and practice pages, and light/dark themes.
The redesign makes the interface a precise, consistent "test bench": self-hosted IBM Plex Sans and
JetBrains Mono, a tile of design tokens, honest status labels, and no demo data disguised as real.

Phase 3 builds **Meridian Outfitters**, an original fictional outdoor & home goods store used as
the single commerce practice domain. **P3-M1 (domain foundation) and P3-M2 (storefront catalogue
UI) are implemented on the `feat/phase-3-commerce-practice` branch:** a D1 catalogue schema
(categories, products, inventory) with deterministic synthetic seed data, a `schema_version` of 2,
a read-only `/api/v1` catalogue API with search, and a working `/shop` storefront with
URL-driven search, filtering, sorting and pagination. The cart, checkout, synthetic auth,
inventory depth, and the clean/bug-hunt modes are planned milestones (see
`docs/phase-3-commerce-practice-plan.md`) and do not exist yet.

The interface is complete; the exercises are not. All catalog scenarios are labelled placeholders.
The storefront is the first real practice surface: it is fully functional, but it has **no cart,
no checkout, no authentication, no bug-hunt mode, and no persistence** yet. No SQL playground,
performance runner, or security challenge exists yet.

## What you can do now

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: start path, curriculum overview, and catalogue highlights |
| `/tracks` | Browse the twelve testing disciplines |
| `/tracks/:trackId` | Objectives, getting-started steps, guide link, listed scenarios |
| `/scenarios` | Search and filter every scenario by track, difficulty, mode, and status |
| `/scenarios/:scenarioId` | Scenario objectives, prerequisites, related guides, availability |
| `/guides` | Guides grouped by discipline |
| `/guides/:guideId` | Concepts, examples, steps, expected results, common mistakes, related exercises |
| `/progress` | No-persistence progress preview, clearly labelled as sample data |
| `/practice` | Live health check plus the planned practice formats and safety boundaries |
| `/shop` | Meridian Outfitters catalogue: search, filter, sort, paginate |
| `/shop/products/:slug` | Product detail with price, stock status and a link back to the catalogue |

Theme choice and sidebar collapse are remembered in `localStorage`. Progress is not tracked or
saved; the progress page shows labelled sample data and says so.

## Requirements

- Node.js **22.12 or newer** (Vitest 5 requires it; the current project was verified on Node 26)
- npm 10 or newer
- No Cloudflare account, API token, or remote resource is needed for local development

## Quick start

```sh
npm install
npm run db:migrate:local
npm run dev
```

Then open:

- **http://localhost:5173** — Vite dev server with HMR
- **http://localhost:8788** — Wrangler Pages dev server, serving the built app and `/api`

Vite proxies `/api` to the Wrangler server on port 8788. The health card on the home page turns
green only after the local D1 migration has been applied.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds the web app, then runs Vite and `wrangler pages dev` together |
| `npm run dev:web` | Runs only the Vite dev server on port 5173 (start the API separately) |
| `npm run dev:api` | Runs only Pages Functions + existing `dist/` on port 8788 |
| `npm run build` | Type-checks every project, then builds production assets into `dist/` |
| `npm run preview` | Builds, then serves the production output and Functions on port 8788 |
| `npm run typecheck` | Runs `tsc --noEmit` for app, tooling, and Functions/tests projects |
| `npm run lint` | Runs ESLint across the repository |
| `npm test` | Runs the Vitest suite once |
| `npm run test:watch` | Runs Vitest in watch mode |
| `npm run check` | Runs lint, typecheck, and tests in that order |
| `npm run db:migrate:local` | Applies unapplied D1 migrations to the local database |
| `npm run db:migrations:list` | Lists unapplied local D1 migrations |

Run a single test file directly with:

```sh
npx vitest run tests/server/health.test.ts
```

## Local architecture

```text
index.html                 Vite entry + pre-paint theme bootstrap
src/app/                   Router and route composition
src/components/layout/     App shell: top bar, sidebar, mobile navigation
src/components/ui/         Reusable badges, states, callouts, icons, theme provider
src/data/                  Typed tracks, categories, scenarios, guides, demo data
src/features/              Track, catalog, guide, health and shop components
src/lib/                   Catalog filtering, labels, navigation, theme hooks
src/pages/                 Route-level pages
src/styles/                Design tokens and layered CSS
src/server/app.ts          Hono app exported for tests (also under src/)
src/server/catalogue.ts    Meridian Outfitters /api/v1 catalogue routes
src/shared/commerce.ts     Shared catalogue contracts (types, currency constant)
functions/api/[[route]].ts Pages Functions catch-all; bridges /api to Hono
db/migrations/             D1 SQL migrations
tests/                     Vitest tests (Node environment)
wrangler.jsonc             Pages config + D1 binding + compatibility date
```

- The Hono app is exported from `src/server/app.ts` so it can be unit-tested without starting
  Wrangler. The Pages adapter in `functions/api/[[route]].ts` is the only Cloudflare-specific
  entrypoint.
- The D1 binding is named `DB` and is available as `c.env.DB` in Hono handlers.
- Local D1 data lives under `.wrangler/state/v3/d1/` and is git-ignored. Delete `.wrangler/` and
  re-run the migration to reset it.
- `wrangler.jsonc` uses `pages_build_output_dir: "./dist"` and a **placeholder** `database_id`.
  This is intentional: the project has not created or touched remote Cloudflare resources.

### Frontend and content

- Route definitions are in `src/app/App.tsx`; all pages render inside `src/components/layout/AppShell.tsx`.
- Learning content is typed and centralised in `src/data/`. Add or edit scenarios in
  `src/data/scenarios.ts`, guides in `src/data/guides.ts`, and tracks in `src/data/tracks.ts`;
  pages only read from those modules.
- Filtering and search live in `src/lib/catalog.ts` and are unit-tested independently of React.
  The storefront's URL-driven catalogue state (query, category, sort, page) lives in
  `src/lib/shop.ts` with the same conventions.
- Styling is plain CSS split across `src/styles/` and imported by `global.css`. There is no CSS
  framework. Files load in this order: tokens, base, layout, components, pages. Because all rules
  have similar specificity, a later file wins ties, so responsive overrides for layout primitives
  belong at the end of `pages.css`.
- Theme and sidebar preferences are stored under `qa-practice-lab-theme` and
  `qa-practice-lab-sidebar-collapsed`. The inline script in `index.html` applies the theme before
  first paint; keep it aligned with `src/lib/theme.ts`.
- Scenarios remain `runnable: false` and non-`ready` in Phase 2. Demo progress in
  `src/data/demo.ts` is sample data and is labelled as such wherever it appears.

### API

`GET /api/health` runs `SELECT value FROM app_meta WHERE key = 'schema_version'` against D1.

- `200` with `status: "ok"` when the migrated schema is readable
- `503` with `status: "degraded"` when D1 is unavailable or the migration has not been applied

The Meridian Outfitters catalogue API is mounted under `/api/v1`:

- `GET /api/v1/products` — paginated active products. Query params: `page` (≥1, default 1),
  `perPage` (1–48, default 12; larger values are capped, not rejected), `category` (category
  slug; unknown slugs match zero rows), `sort` (`newest` default | `name` | `price_asc` |
  `price_desc`), `q` (case-insensitive search over product name, description and category name;
  LIKE wildcards in the query are treated literally). Response:
  `{ data, page, perPage, total, totalPages }`.
- `GET /api/v1/products/:slug` — a single active product, or a `404` `{ error: "not_found" }`
  envelope.
- `GET /api/v1/categories` — all eight categories ordered by `sortOrder`.

Products carry `priceCents` (integer cents, formatted only at the edge), a `categorySlug`, a
`categoryName`, and a `stockStatus` derived from inventory (`in_stock` | `low_stock` |
`out_of_stock`). Responses are `Cache-Control: no-store` with `X-Content-Type-Options: nosniff`.
Unknown API routes return a JSON `404` envelope.

### SPA routing

Cloudflare Pages serves the app as a single-page application automatically **as long as the build
output has no top-level `404.html`**. Do not add a `_redirects` catch-all such as
`/* /index.html 200`: current Wrangler/Pages rejects it as an infinite loop, and the native
fallback already serves deep links. If a `404.html` is ever added, SPA deep links will break and a
different routing strategy will be required.

## Database migrations

Create a migration file in `db/migrations/` using Wrangler's ordering convention, then apply it
locally:

```sh
npx wrangler d1 migrations create qa-practice-lab-db <migration_name>
npm run db:migrate:local
```

Migrations run against the local SQLite-backed D1 database only. Do not pass `--remote` in this
phase, and do not expose the platform D1 binding as a user-facing SQL console.

## Deployment status

Deployment is deliberately **not configured**. Before a remote deployment:

1. Create the real D1 database with `npx wrangler d1 create qa-practice-lab-db`.
2. Replace the placeholder `database_id` in `wrangler.jsonc`.
3. Apply migrations remotely (`wrangler d1 migrations apply ... --remote`).
4. Configure the Pages project and deploy with `npx wrangler pages deploy dist`.

Keep usage within the free-tier ceilings recorded in `PROJECT_STATE.md` (Workers/Pages request and
build limits, D1 daily reads/writes and per-invocation query limits).

## Known constraints

- All catalog scenarios are placeholders. There is no exercise execution, scoring, or saved
  progress; the progress page shows labelled sample data and says so.
- The storefront catalogue is real and backed by the API, but it has **no cart, no checkout, no
  authentication, no bug-hunt mode, and no learner persistence** — product pages are read-only and
  labelled as a practice storefront. Prices and stock are synthetic seed data.
- Six of the twelve learning tracks do not yet have a dedicated guide; they link to the closest
  guide or mark one as scheduled.
- The project intentionally uses **Cloudflare Pages Functions**. Current Cloudflare guidance
  recommends Workers with static assets for new projects, and Hono marks its
  `hono/cloudflare-pages` adapter deprecated for Hono v5. This is a deliberate project choice;
  revisit before upgrading Hono or if Pages limitations block later phases.
- `npm audit` reports moderate, development-only advisories from the ESLint/TypeScript tooling
  chain. Production dependencies are limited to React, React DOM, React Router, and Hono;
  `npm audit --omit=dev` reports zero vulnerabilities.
- If npm 11 blocks install scripts, approve the known build tools with
  `npm install-scripts approve esbuild workerd`.

## Troubleshooting

- **Health card says the database check failed:** run `npm run db:migrate:local`, then restart
  `npm run dev`.
- **Port already in use:** Vite is fixed to 5173 (`strictPort`) and Wrangler to 8788. Stop the
  other process instead of changing only one side, or the Vite proxy will point at the wrong API.
- **API works on 8788 but not through Vite:** confirm the `dev` script started both processes and
  that `vite.config.ts` still proxies `/api` to `http://127.0.0.1:8788`.
