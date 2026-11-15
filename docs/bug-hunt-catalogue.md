# Bug-hunt catalogue (internal — maintainer-facing)

> **Not learner-facing.** This document is the maintainer-side registry of the
> intentional defects in the Meridian Outfitters practice store. Learners
> discover defects through the bug-hunt mode; the reveal/scoring flow is
> Phase 4+. Do not paste defect ids, expected/actual pairs or repro steps
> into learner-facing surfaces.

Companion to `docs/phase-3-commerce-practice-plan.md` §4 (engine design).
The registries live in code: `src/server/hunts.ts` (hunts),
`src/server/defects.ts` (defect definitions + `isDefectActive`). Defect ids
are internal; the browser only ever sees hunt summaries.

## Engine rules (recap)

- **Activation is server-resolved per request.** `isDefectActive(c, defectId)`
  reads the caller's `mpl_session` cookie, loads the live session
  (`mode='bug_hunt'`, `hunt_id`), and checks that the hunt's fixed defect
  list contains the id. Clean sessions, expired sessions, unknown hunts and
  malformed cookies all resolve to `false`.
- **No client-supplied defect ids, roles, owners or activation flags are ever
  consulted.** The hunt-start endpoint accepts no body; the hunt id comes
  from the URL path and is validated against the compiled registry.
- **One code site per defect.** Each defect branches in exactly one place.
  Defect branches are static: no randomness, no wall-clock dependence.
- **Session isolation.** Bug-hunt state lives on `practice_sessions`
  (`mode`, `hunt_id`) — never on shared rows, never in process memory.
  One learner's hunt cannot affect another learner's session.
- **Reset is non-destructive.** `POST /api/v1/practice/session/reset`
  re-stamps the live session to `mode='clean'`, `hunt_id=NULL`. Cart, orders
  and the synthetic customer binding are preserved. (Deviation from the
  plan's "expire + fresh session" sketch — see the plan doc §P3-M7 for the
  reason.)

## Registered hunts (v1)

| Hunt id            | Title                          | Defects         | Surface |
|--------------------|--------------------------------|-----------------|---------|
| `hunt-catalogue-001` | Catalogue search under-matches | `CATALOGUE-001` | `GET /api/v1/products?q=` (+ /shop search) |

## Defects

### CATALOGUE-001 — Catalogue search ignores the description facet

- **Surface:** `GET /api/v1/products?q=` (the `/shop` search box).
- **Code site:** `src/server/catalogue.ts` — the `q` predicate branch in
  `catalogueRoutes.get('/products')` guarded by `await isDefectActive(c, 'CATALOGUE-001')`.
- **Expected (clean):** search matches products whose **name**, **description**
  or **category name** contains the term (case-insensitive substring, LIKE
  wildcards escaped, bind parameters only). Example: `vestibules` → one hit,
  the Ridgeline 2-Person Tent.
- **Actual (bug hunt):** the `p.description LIKE` clause is dropped; only the
  name and category predicates remain. `vestibules` → zero hits, zero total.
  Name and category matches are unaffected. The list and count share the same
  predicate, so they stay mutually consistent.
- **Reproduction:**
  1. Start the hunt (banner reads "Bug-hunt mode"): `POST /api/v1/practice/hunts/hunt-catalogue-001/start`,
     or the **Start the practice hunt** button on `/practice`.
  2. Open `/shop` and search `vestibules`. Expected: 1 product. Actual: empty
     state ("no products").
  3. Control: search `trekking` (name match) — works normally in both modes.
  4. Reset (`/practice` → **Reset to clean mode**, or the banner button) and
     repeat step 2 — the product is found again.
- **Isolation:** only the hunting session's search predicate changes. Other
  browsers, guests and signed-in customers see clean behaviour.
- **Reset:** `POST /api/v1/practice/session/reset` re-stamps the session to
  clean mode; the defective branch is unreachable.
- **Not in scope for v1:** no other endpoint, table or workflow branches on
  this defect. Cart, checkout, orders, auth, inventory are untouched.

## Planned (P3-M8, not implemented)

The remaining catalogue (pricing/rounding, inventory staleness, catalogue
filtering, validation edge cases, authZ visibility) lands in P3-M8 together
with hunt→scenario wiring. Do not add defects ad hoc in between milestones.

## Maintenance notes

- `practice_sessions.hunt_id` is intentionally **not** a foreign key: hunts
  are compiled TypeScript, not database rows. If a mint outlives a registry
  change, `isDefectActive` and the session endpoint both resolve the stale
  id to clean behaviour.
- Defect and hunt ids are validated by format on input (`hunt_id` path
  param: `^[a-z0-9][a-z0-9-]{2,63}$`) and are never reflected back verbatim.
- The catalogue seed data (`0002_commerce_domain.sql`) is stable: the phrase
  `vestibules` appears only in product 1's description. If the seed gains
  new products, re-check the repro term is still description-unique.
