# Phase 5 exit audit — API & Identity Testing Lab

> **Purpose:** the formal record that Phase 5 is implementation-complete and that its
> exit criteria were verified. Companion to `PROJECT_STATE.md` (progress log, §1/§11/§14)
> and `docs/phase-5-api-identity-plan.md` (design + milestone history). Written for the
> maintainer, not for learners. Internal defect details remain in `docs/bug-hunt-catalogue.md`;
> this audit names defects only where a boundary needed proving.

- **Branch:** `feat/phase-5-m3-exit-audit` (merged to `main` via PR #8 on 2026-11-16)
- **Milestone covered:** P5-M3 — Hardening, verification & Phase 5 exit readiness
- **Audit date:** 2026-11-16
- **Verdict:** **All Phase 5 exit criteria are satisfied. Phase 5 is implementation-complete and release-ready.**
- **Deployment status: DEPLOYED TO PRODUCTION on 2026-11-16.** Production (https://qa-practice-lab.pages.dev) now serves the Phase 5 release — Cloudflare Pages deployment `aaa0e2a6-2f13-47e1-91b5-cac38c4d2765` (project `qa-practice-lab`), source commit `3ecfb4110e4acc230d5d9640d45f85b6bc57b492` (merge of PR #8). Production D1 `qa-practice-lab-db` was migrated `schema_version` **10 → 11** on 2026-11-16 (migration `0011_api_tokens.sql`, applied after a verified pre-migration export; `api_tokens` + 2 indexes created, 0 rows, remote migration history clean). Production acceptance passed (see the release addendum, §17). The pre-release audit content below is preserved as written at audit time; statements marked “NOT DEPLOYED” describe the state before the release executed. The release checklist in §14 is now **executed** (recorded there).
- **Baselines:** `main` @ `3b5c090` (P5-M1 merged via PR #6 `05f4870`; P5-M2 merged via PR #7 `f7bf1c3`); P5-M3 branch created from that verified `main`, merged via PR #8 (`3ecfb41`); local `schema_version` **11** (migration `0011_api_tokens.sql` applied locally in P5-M2 and re-verified here); production D1 migrated to 11 on 2026-11-16.

## 1. Phase 5 scope and milestones

Phase 5 — API & Identity Testing Lab — shipped in exactly three approved milestones, one
complete milestone per focused session, per `docs/phase-5-api-identity-plan.md` §6/§14.

| Milestone | Scope | Implementation commit | Merge | Status |
|---|---|---|---|---|
| P5-M1 — Foundations | OpenAPI 3.1 contract (`public/openapi.json`), contract tests, `/api-reference`, same-origin `/api-lab` API console, `api-catalog-pagination` flipped to ready, nav entries | `758fb72` | PR #6 → `05f4870` | merged; released 2026-11-16 |
| P5-M2 — Identity depth + hunts | `0011_api_tokens.sql`, `src/server/apiTokens.ts`, token mint/resolve/revoke, Bearer on the `mpl_customer` surface, in-console token helper, `hunt-authn-001` / `hunt-rbac-001` / `hunt-mass-001`, `api-token-replay` + `api-mass-assignment` scenarios | `2b7350c` | PR #7 → `f7bf1c3` | merged; released 2026-11-16 |
| P5-M3 — Hardening, verification & exit readiness | This audit, regression verification, three defects fixed (§6), release checklist (§14) | this milestone's commit | — | **not merged** |

**P5-M1 acceptance re-verified** in this audit (contract test 14/14 inside the 837-test suite;
both `/api-reference` and `/api-lab` re-probed in a browser — 35 endpoint cards, 8 tag groups,
35 deep links, both themes × 375/768/1024/1440 px, zero overflow, zero console errors).
**P5-M2 acceptance re-verified** in this audit (token mint 201 / TTL clamp / one-time display /
Bearer precedence / expiry `401 token_expired` / logout revocation / sweep — via the focused suites
and an end-to-end browser pass, see §4, §9, §11).

## 2. P5-M1 API Foundations

| Criterion (plan §6 P5-M1) | Evidence | Result |
|---|---|---|
| OpenAPI 3.1 contract covers every `/api/v1` route in both directions | `tests/data/openapi.test.ts` (parse, path coverage both directions, `$ref` integrity, error-code vocabulary both directions, defect-id/internal leak lint) — 14/14, re-run here; `python3` cross-check: 31 path keys / **35 operations** = server route count; 1 `x-internal` (staff sweep, deliberately documented, never hidden) | PASS |
| Error-code vocabulary documented in `components.schemas.ErrorCode` (24 codes incl. `token_expired`) | contract test; enum diff in both directions | PASS |
| `/api-reference` renders from the served contract, download works, 35 deep links | browser probe §11; `tests/pages/api-reference-page.test.tsx` | PASS |
| `/api-lab` same-origin console: refuses absolute/protocol-relative/`..` URLs before any fetch; query validation; header name/value rules incl. CR/LF; 64 KB body cap; component-state history (10 max, never persisted) | `src/lib/api-lab.ts` + `tests/lib/api-lab.test.ts` (29 tests); browser probe §11 (zero fetches on refused sends, live GET/POST round-trips) | PASS |
| `/openapi.json` served as a static asset | verified via `wrangler pages dev`: `200 application/json`, 35 operations parse | PASS |
| No zero-regression on earlier phases | full suite 837/837; §7 | PASS |

## 3. P5-M2 identity and token lifecycle

Bearer token security posture, verified by targeted suites (`tests/server/api-tokens.test.ts` — 28
tests) plus browser end-to-end checks (§11):

- **Opaque 256-bit token generation** — `crypto.getRandomValues`, 32 bytes → 64 lowercase hex
  (`generateApiToken`); format enforced on every resolution path (`isApiTokenFormat`).
- **SHA-256 hash-only persistence** — `api_tokens.token_hash` UNIQUE; raw token never stored.
- **One-time display** — the raw token exists exactly in the 201 `POST /api/v1/auth/token` response;
  nothing else returns it. Browser probe: `.api-token-value` shown once; "shown once" notice rendered.
- **TTL clamp** — 15–900 s inclusive, fractional truncated, non-finite/non-number → 400
  (`parseExpiresInSeconds`); the `expiresIn` in the 201 echoes the clamped value.
- **Expiry / revocation** — expired rows deleted in passing on first contact (never honoured);
  revoked rows fail closed as `unknown`; logout deletes the account's `api_tokens` rows
  (customer-scoped, deliberately broad, documented); `401 token_expired` vs `401 unauthorized`
  distinguished exactly as approved (§14 decision 2).
- **Shared login brute-force budget** — `/auth/token` peeks/consumes/resets the same `login`
  bucket as `/auth/login` (5 failures/IP/UTC minute → 429 `login_rate_limited`, `Retry-After` set)
  plus the global `mutate` 120/min backstop; a successful mint clears the budget. Tests:
  "shares the login failure budget", "a successful mint clears the shared login budget".
- **Suspended / deleted / orphaned customers** — suspended can neither mint (403
  `account_suspended`) nor resolve mid-token (403); a customer row that vanishes cascades its
  `api_tokens` rows away (ON DELETE CASCADE, asserted) and any presented token fails closed
  (`unusable` → 401 `unauthorized`, row deleted in passing). Orphaned practice session for the
  cookie path behaves identically (existing Phase 3 behaviour).
- **Cookie/Bearer symmetry and precedence** — identical roles/status from the stored customer row
  in both paths; roles never read from token claims; Bearer present → cookie never consulted;
  Bearer present but invalid/expired → **no cookie fallback** (`requireActiveCustomer` /
  `requireStaff` answer 401 `unauthorized` / 401 `token_expired`). Tests: "never falls back to the
  cookie when a Bearer header is presented", "Bearer wins over the cookie when both are present".
- **Suspect-header hygiene** — malformed `Authorization` (e.g. `Basic …`, `Bearer ` with junk,
  embedded CR/LF) fails closed; token format rejected before any hash lookup.
- **Sweep safety** — `sweepExpiredData()` deletes only `expires_at <= now` or
  `revoked_at IS NOT NULL`, bounded at 100 rows/table/call (≤500 by clamp), idempotent, never
  touches unexpired rows; test: "the maintenance sweep purges expired and revoked tokens and
  keeps live ones", "deletes expired rows, preserves active and audit data, and is idempotent".
  `db/maintenance/cleanup.sql` (local-only) mirrors the same semantics, verified by review.
- **Raw token in logs/errors/URLs/storage/bundle** — no `console.*` call logs request bodies,
  tokens or hashes (grep reviewed; `onError` returns a generic envelope); console has no token in
  URLs (Authorization header only, plus documented curl copy); component state only; no
  `localStorage`/`sessionStorage` anywhere in the token path; bundle leak scan §10 = 0 hits.

**Bearer resolution code (`src/server/customer.ts`) re-reviewed** — the highest-risk hunk after
P5-M2. Findings: resolution order is correct; no claim is ever trusted; roles and `status` are
always read from the `customers` row; the practice-session attribution branch (Bearer + live
`mpl_session` cookie) is used for audit attribution only and can never elevate or authenticate;
fail-closed on every path; `isDefectActive` is orthogonal (hunt activation only). No code change
was required.

## 4. API contract completeness and honesty

| Item | Evidence | Result |
|---|---|---|
| 401/403/404 triple unchanged (guest 401; suspended 403; staff-required 403; concealed 404) | `tests/server/auth.test.ts`, `inventory.test.ts`, `hunt-set.test.ts` — re-run green; browser matrix §11 | PASS |
| `token_expired` documented on protected operations; `bearerAuth` on all 7 protected operations | contract curl/python3 inspection — all seven list `customerCookie` + `bearerAuth`; `401` descriptions on `/auth/me` and `/admin/inventory` name both codes | PASS |
| `x-internal` on the staff sweep; `/api/health` excluded as infrastructure | contract test + curl parse (`x-internal` ops = 1) | PASS |
| Contract self-consistency — **found and fixed this audit:** `info.description` claimed "No Bearer tokens exist in this phase" while the same document documented `bearerAuth` and `POST /api/v1/auth/token` | fix in `public/openapi.json`; re-verified by contract test and probe (§6) | PASS (after fix) |
| No stale learner-facing copy — **found and fixed this audit:** API Reference callout claimed "there are no Bearer tokens in this phase" | fix in `src/features/api-reference/ApiReferenceView.tsx`; rebuilt; probe asserts the text is gone (§6) | PASS (after fix) |
| Error-code vocabulary in both directions | contract test — 14/14 | PASS |
| No defect ids / evaluator internals / token internals in the client bundle | leak scan §10 — 0 hits for all 17 probed strings | PASS |

## 5. API Lab and API Reference safety

- **Same-origin only** — `validatePath` accepts only `/api/v1(/|$)`; absolute URLs, scheme-prefixed
  strings, protocol-relative `//…`, `\` separators, CR/LF/control characters and `..` segments are
  refused before validation reaches the network layer; `assertSameOriginApiUrl` re-checks the
  resolved `URL.origin` against `window.location.origin` immediately before `fetch`; `credentials:
  'same-origin'` on every request; response bodies rendered strictly as text (`<pre>`), never as
  HTML; `referrer-policy` and `nosniff` set by the app middleware; the Lab page itself documents
  the can/cannot-do posture in-page.
  **Browser evidence:** external URL, protocol-relative URL and `..` path all refused with **zero
  network requests** (instrumented `window.fetch`); live GET (200) and POST round-trips verified.
- **Headers** — RFC 7230 token-name enforcement, CR/LF rejection in names and values, 2 KB value
  cap, case-insensitive dedupe (last row wins); cookie material never synthesized by the client.
- **Response size cap** — 64 KB display cap with mid-stream cancellation (`readCappedText`);
  oversized bodies annotated, never buffered whole.
- **Copy-as-curl** — POSIX single-quote shell-escaping; includes the user-chosen `Authorization`
  header when present (documented in the UI to treat the command as secret until expiry); intended.
- **History** — last 10 entries, component state only, never persisted, clearable, no headers or
  bodies stored (targets only).
- **Token helper** — one-time display after a signed-in re-authentication (email prefilled,
  password re-entered, cleared after mint); token lives in component state only; explicit
  "Use as Bearer header" / "Clear token" (drops both the in-memory token and the header row);
  nothing is written to storage or URLs; TTL select constrained to 15–900; role gate (signed-out →
  notice with sign-in link, suspended → notice without the form); raw token never rendered after
  Clear/refresh.
- **Accessibility / responsiveness** — labelled controls, `aria-invalid`, linked error summary with
  focus management, `role="status"` response line, keyboard-operable form and buttons, visible
  focus indicators (probe), `prefers-reduced-motion` respected (probe), no horizontal overflow at
  375/768/1024/1440 in both themes for `/api-lab`, `/api-reference` (and `/progress`).
- **Download behavior** — "Download openapi.json" is a plain `href="/openapi.json" download` to a
  public static artifact (no secrets by construction).

## 6. Bug-hunt isolation and clean-mode behavior

Defect activation is server-resolved exclusively via the caller's live `mpl_session` row (mode
`bug_hunt` + the hunt registry), bound to the hunting session only. There is no module-level
mutable state (`grep` for shared `let`/`Map`/`Set` in `src/server` = none); reset restores clean
mode non-destructively. The three Phase 5 hunts were each exercised end-to-end in the browser
(§11) **and** in the server suites (both branches, reset, bystander and suspended cases):

| Hunt | Clean mode | Hunt mode | Boundary proof | Result |
|---|---|---|---|---|
| `hunt-authn-001` (`AUTHN-001`, logout leaves API tokens replayable) | logout revokes the account's tokens; replayed Bearer → 401 `unauthorized` | logout leaves tokens; replayed Bearer → 200 on protected endpoints | activation only via live hunt session; reset restores; learner without the hunt never reaches the branch; suspended stays 403 | PASS |
| `hunt-rbac-001` (`RBAC-001`, staff inventory read open to customer role) | customer role → 403 `staff_required` on `GET /api/v1/admin/inventory` (cookie and Bearer) | customer role → 200; **PATCH stays 403 `staff_required` in both modes**; suspended → 403 | opt-in only on the one GET route; maintenance sweep and PATCH never defective; reset restores | PASS |
| `hunt-mass-001` (`MASS-001`, client-supplied `totalCents` honoured) | `totalCents` ignored; server-computed figure stored | forged non-negative safe-integer stored as order total; subtotal stays server-computed | session-scoped orders only (7-day cascade, no shared/customer-wide rows); out-of-domain values (negative, non-integer, NaN, unsafe) ignored exactly as clean; disposable synthetic data; nothing touches real payments | PASS |

**MASS-001 constraint preserved** — the non-negative safe-integer ceiling is untouched; the
`orders` row `CHECK (total_cents >= 0)` is deliberately not altered. The defect teaches "the
server trusted a client figure", not "the database accepted anything".

**Learning integration intact** — attempts, structured reports, the deterministic §6.4 evaluator,
progressive hints and gated reveal are unchanged by Phase 5; the three hunts flow through the same
report/hint/reveal/progress surfaces (browser probe §11; `hunt-set.test.ts` re-run green; the 837-test
suite includes the full P4 regression). No evaluator internals, hint content or reveal content is
reachable pre-unlock (leak scan §10; reveal remains gated server-side).

## 7. Existing-application regression review

Swept storefront catalogue, cart/checkout/orders, session/customer login, inventory admin, hunt
activation/reset, learning attempts/reports/hints/reveal, `/progress`, guides, runnable scenarios,
health endpoint, and operational maintenance sweep:

- **Automated:** full suite re-run green (837/837, 42 files) covering all of the above; Phase 3/4
  suites included.
- **Manual (browser, production build on `wrangler pages dev` + local D1):** sign-in as a demo
  customer; order placement (MASS-001 clean vs hunt totals verified against stored orders); `/progress`
  populated; `/practice` ten hunts listed; zero defect ids in DOM; zero unexpected console errors.
- **Migration compatibility:** `0011` is additive-only; `0001`–`0010` untouched; FK cascades from
  existing tables unaffected; `api_tokens` stands alone; no destructive change anywhere (§8).
- **Data ownership:** hunt orders remain session-scoped and cascade; token rows cascade with their
  customer; inventory audit tables untouched.

## 8. Database and migration safety

| Check | Evidence | Result |
|---|---|---|
| Fresh 0001 → 0011 (real migration files) | applied with sqlite3 against a scratch DB; `schema_version` = **11**; `api_tokens` + `idx_api_tokens_customer` + `idx_api_tokens_expiry` present | PASS |
| Upgrade 0001–0010 → 0011 with planted rows | planted `practice_sessions` row survives; `schema_version` flips 10 → 11; only `api_tokens` created | PASS |
| Same coverage in the test harness (fake-D1 applies the real files) | `tests/server/api-tokens.test.ts` + `tests/server/hardening.test.ts` — re-run green | PASS |
| FK and uniqueness behaviour | non-null FK enforced; `token_hash` UNIQUE enforced; customer delete cascades `api_tokens`; all asserted | PASS |
| Local D1 state | `wrangler d1 migrations apply --local` → "No migrations to apply!"; `schema_version` = 11; `npm run db:reset:local` re-run cleanly after browser probing | PASS |
| Local cleanup script mirrors sweep semantics (bounded, idempotent, never deletes live rows or audit tables) | `db/maintenance/cleanup.sql` review | PASS |
| **Production D1 not touched** | no `--remote` command was run; migration list for production remains 0001–0010; §14 checklist is the gate | PASS (held) |
| No destructive migration or data loss | `0011` creates one table + two indexes + bumps `app_meta`; touches nothing else | PASS |

## 9. Authentication and authorization matrix

| Case | Cookie path | Bearer path | Result |
|---|---|---|---|
| Guest (no credential) | 401 `unauthorized` | 401 `unauthorized` | PASS |
| Valid customer | 200 profile / protected OK | identical | PASS |
| Bearer present + valid cookie | Bearer wins (documented) | — | PASS |
| Bearer present, invalid | 401 `unauthorized` (**no cookie fallback**) | 401 `unauthorized` | PASS |
| Bearer present, expired | 401 `token_expired` | 401 `token_expired` | PASS |
| Suspended mid-session / mid-token | 403 `account_suspended` | 403 `account_suspended` | PASS |
| Orphaned token (customer row gone) | — | 401 `unauthorized`, row dropped in passing | PASS |
| Malformed `Authorization` (`Basic x`, `Bearer %0d%0a`, empty) | 401 `unauthorized`, never reaches the DB | 401 `unauthorized` | PASS |
| Staff surface, customer role | 403 `staff_required` | 403 (and 200 in `hunt-rbac-001` for GET only) | PASS |
| Maintenance sweep, non-staff | 403 `staff_required` | 403 | PASS |
| `/auth/token` with login budget exhausted | 429 `login_rate_limited` (+ `Retry-After`) | 429 | PASS |

## 10. Security and information-leak checks

Recorded commands (all run in the repo root unless noted; `dist/` rebuilt before scanning):

```
grep -rF <defect-id> dist/            # CATALOGUE-001/002, CART-001, INVENTORY-001, PRICING-001,
                                      # CHECKOUT-001, AUTHN-001, RBAC-001, MASS-001, AUTHZ-001
                                      # → 0 hits each
grep -ri <internal>   dist/           # isDefectActive, findDefect, hint_mask, reportQuality,
                                      # best_quality_score, token_hash, pbkdf2, api_tokens,
                                      # DUMMY_PASSWORD_HASH, access_token, revokeCustomerApiTokens
                                      # → 0 hits each
grep -ri demo-amara-1001 dist/        # → 0 hits (demo password in no bundle)
grep -rF hunt-{authn,rbac,mass}-001 dist/   # public hunt ids → present by design (catalogue)
python3 - openapi.json parse          # 35 operations; both security schemes on all 7 protected
                                      # ops; x-internal=1; token_expired documented on 401s
node /tmp/opencode/p5-m3-probe.mjs    # browser sweep (see §11); DOM text leak checks: PASS
```

- **Client bundle:** no defect ids, no evaluator/hint/reveal internals, no token internals, no
  fixtures or passwords. Public hunt ids appear by design (the catalogue is public content).
- **Learner-facing API responses:** hunts endpoint returns summaries only; report/hint/reveal/progress
  payloads carry no defect ids or evaluator internals (contract + suite).
- **DOM during probes:** no defect ids on `/practice` or `/api-reference`; no token material persisted.
- **Logs:** `console.*` reviewed — only generic error envelopes; no secrets or request bodies.
- **Cross-session isolation:** all three hunts startable only in the hunting session; other sessions
  resolve clean (suite + probe §11); hunt orders cascade with the session; tokens are account-scoped
  by design (AUTHN-001 is precisely about that scope).
- **Orders/orders-detail ownership:** unchanged Phase 3/4 semantics (session-scoped + customer-owned);
  re-run green.

## 11. Browser and accessibility verification

Local production build (`dist/`) served by `wrangler pages dev` on an ephemeral port against the
local D1 (schema 11, seeded; `npm run db:reset:local` applied before the run), driven by system
**Chrome** (headless, fresh profile) over raw CDP via `/tmp/opencode/p5-m3-probe.mjs`. **67/67
checks pass.**

Journeys covered: API Reference (render, 35 cards/8 groups/35 deep links, download affordance,
leak check); API Lab (signed-out notice, default prefill, external/protocol-relative/`..` refusal
with zero fetches, live GET 200, both-themes × 4 widths, no overflow); sign-in as a demo customer;
token helper (mint form, one-time display, 64-hex token, TTL select, "Use as Bearer header", Bearer
round-trip 200, "Clear token" drops the header row); expiry (fresh Bearer 200 → after 16 s 401
`token_expired`); logout revocation (minted 201 → logout → replay 401); AUTHN-001 (hunt replay 200;
reset; clean replay 401); RBAC-001 (hunt GET 200; PATCH 403; reset; clean GET 403); MASS-001
(hunt stores forged `totalCents: 1` with correct server subtotal; reset; clean ignores the field);
`/progress` (h1, ≥10 exercise rows); `/practice` (ten hunts, zero defect ids).

Widths: 375 / 768 / 1024 / 1440 px. Themes: light and dark (token helper, reference, lab,
progress). Keyboard: `/api-lab` path input focus shows a visible focus indicator; reduced-motion
media emulation leaves the reference fully usable; exactly one `h1` per page. **Zero unexpected
console errors** (expected benign 401/403/404 resource logs only).

**Coverage limitations (honest):** system Chrome only — **Firefox and WebKit were not tested**.
No committed browser runner exists (ephemeral CDP probe, consistent with earlier phases); probe is
not part of the repo. Pixel-level a11y audit (contrast, screen-reader narration) was not repeated —
the Phase 2.5 token audit and both-theme overflow checks cover the shipped surfaces.

## 12. Build, test and dependency status

- `npm run check` — **PASS**: ESLint clean; typecheck (×3 projects: app, node, functions) clean;
  **837/837 tests across 42 files**.
- `npm run build` — **PASS** (typecheck + Vite production build into `dist/`; index JS 377.55 kB /
  gzip 116.69 kB; all Phase 5 chunks built; `dist/openapi.json` present).
- `npm audit` posture unchanged — **no dependencies were added or upgraded in P5-M3**, and no new
  product features shipped. (Audit run previously in-phase; P5 added zero deps.)
- Migration/schema: local `schema_version` **11**; production **10**.
- Bundle: leak scan clean; `RevealPanel` chunk still lazy-loaded; route-level splitting retained.

## 13. Known limitations and deferred work

Implementation is complete; these are deliberate scope boundaries, not defects:

1. **~~Phase 5 is not deployed~~ Superseded 2026-11-16:** Phase 5 is merged, migration `0011` applied to production, deployed and verified in production (see §14/§17). Kept for audit-time honesty.
2. **Firefox/WebKit untested** (Chrome-only CDP probes); no committed browser automation.
3. **No CSP** — existing posture unchanged; recorded as a Phase 10 launch-hardening item.
4. **No refresh tokens, rotation or reuse detection** — deferred (plan §12); tokens are
   single-flight, short-TTL, one-time-displayed.
5. **No per-account cap on live tokens** — minting is bounded only by the shared login failure
   budget (failures) plus the 120/min mutation backstop (successes), the 15–900 s TTL and the
   bounded sweep; this matches the login success-path posture and is an abuse-control question,
   not an authentication boundary. A per-account ceiling can be proposed with fresh approval if
   class churn ever warrants it.
6. **Bearer-only logout is a no-op for revocation** — sign-out revocation is keyed off the
   `mpl_customer` cookie (the documented, unchanged contract). A caller authenticating purely with
   Bearer cannot sign out remotely; its tokens expire within 900 s. Documented; not a bug.
7. **`/openapi.json` is a public static artifact** — served as `Access-Control-Allow-Origin: *`,
   `Cache-Control: public, max-age=0, must-revalidate`; no `no-store` (intended; it is a public
   contract, not API state).
8. **Dark-theme token-helper rendering** verified via probe (both themes, 375/1440 px) but not
   pixel-audited; certificate/HTTPS behaviour unverified locally (`Secure` flag follows origin
   scheme, same convention as the session cookies).
9. **Hunt replay in `hunt-authn-001` is account-scoped** by design — the "vulnerability" is that
   logout revokes too little; it is scoped to synthetic accounts and taught as such.
10. **MASS-001 defect floor** — forged values are non-negative safe integers only; the `orders`
    `CHECK (total_cents >= 0)` is intentionally preserved; anything outside the domain is ignored.
11. **Two-person review not possible in this session** — `customer.ts` token resolution received a
    single-pass analytical re-review plus its full regression matrix (§3), not a second human
    reviewer. Flagged for the maintainer's release gate if desired.
12. **Reduced-motion and keyboard** verified at spot-check depth (focus indicator, reduced-motion
    reference render), not as a full assistive-technology audit.

## 14. Production release readiness — checklist (EXECUTED 2026-11-16)

Written at audit time as the gate for the approved release step; the maintainer explicitly approved
the release on 2026-11-16 and it was executed the same day. Recorded outcomes:

1. **Approval gate** — maintainer explicitly approved the Phase 5 release (PR #8 review → merge → production migration → deploy → production acceptance) on 2026-11-16. ✓
2. **Merge** — PR #8 (`https://github.com/thisishamza/qa-practice-lab/pull/8`, title “Phase 5 M3: Hardening and Exit Audit”, base `main`, head `feat/phase-5-m3-exit-audit`, 2 commits, 7 files, all in P5-M3 scope) merged with method `merge` on 2026-11-16; merge commit **`3ecfb4110e4acc230d5d9640d45f85b6bc57b492`**; PR state `merged`; branch `main` is not protected (no required checks; repository has no CI — consistent with PRs #5–#7). Independent fresh-context review of the auth-critical surface (`customer.ts`, `apiTokens.ts`, `auth.ts`, migration 0011) returned **no release-blocking issues** (observations OBS-1…OBS-7, all LOW/INFO, either documented or cosmetic; see §17). Firefox/WebKit remain untested (Chrome-only). ✓
3. **Production migration** — preflight: D1 `qa-practice-lab-db` identity verified by UUID (`928b4ed6-6284-46a2-b374-f1c569c1affe`) before any change; remote history = 0001–0010 applied, only `0011` pending; `schema_version` = 10; production health `ok`. **Backup: `npx wrangler d1 export qa-practice-lab-db --remote` created a full pre-migration export (`/tmp/opencode/qa-practice-lab-db-pre-0011.sql`, 175 statements, last migration `0010_hunt_attempts.sql`; 40192 bytes) at 2026-11-16T17:03Z.** Migration applied with `npx wrangler d1 migrations apply qa-practice-lab-db --remote` → `0011_api_tokens.sql` ✅ (5 commands, 1.22 ms). Post-migration verification (read-only): `schema_version` = **11**; `api_tokens` table + `idx_api_tokens_customer` + `idx_api_tokens_expiry` present; `api_tokens` row count = 0; `wrangler d1 migrations list qa-practice-lab-db --remote` → “No migrations to apply!”. ✓
4. **Deploy** — on merged `main` @ `3ecfb41` with a clean working tree: `npm run check` green (837/837 tests, 42 files); `npm run build` clean. Deployed with `npx wrangler pages deploy dist --project-name qa-practice-lab --branch main`: **deployment `aaa0e2a6-2f13-47e1-91b5-cac38c4d2765`** (Production, branch `main`, source `3ecfb41`, status success, https://aaa0e2a6.qa-practice-lab.pages.dev). Production alias `qa-practice-lab.pages.dev` served the new release (health `schemaVersion: "11"`). ✓
5. **Production acceptance** — passed; see §17 (release addendum). Mint 201 / Bearer 200 / logout revocation replay 401 (token lifecycle end-to-end, `api_tokens` back to 0 rows); guest/malformed-Bearer 401s; `/api-reference`, `/api-lab`, `/`, `/practice`, `/login`, `/progress` render with zero console errors (Chrome over CDP with IPv4 resolver + QUIC disabled — this machine has no IPv6 connectivity; curl over HTTP/2 unaffected); `/openapi.json` valid, 35 operations. ✓
6. **Rollback** — not needed; migration 0011 is additive and remains in place. Redeploy of the prior deployment (`0b1cd31b`, Phase 4 lineage) remains available via the Pages dashboard/CLI if ever required.
7. **Post-release hygiene** — `PROJECT_STATE.md` §11 records the release; README production header updated (only after the release actually happened); release documentation commit pushed to `main`. Staff-sweep cadence reminder restated: operator-invoked, at least weekly (daily in active classes). ✓
8. **Not in scope** — remote resource creation, secrets, DNS, Hono upgrades, Phase 6 — none were performed.

## 15. Phase exit criteria (plan §13) — verdicts

| # | Criterion | Evidence | Result |
|---|---|---|---|
| 1 | P5-M1, P5-M2, P5-M3 each verified and committed as one focused commit per milestone | commits `758fb72` (merged PR #6), `2b7350c` (merged PR #7), this milestone's commit; suite re-run green at each boundary | **PASS** |
| 2 | Cold learner can complete `api-catalog-pagination` and `auth-session-expiry` unaided with in-app affordances | afforances exercised and verified: both scenarios are `ready`/`runnable` with console walkthroughs; `/api-reference` → `/api-lab` deep links work; sign-in → mint → Bearer → 401-expiry journey verified end-to-end in the browser probe; nothing requires an external tool. Caveat: this is recorded tool-assisted verification, not a fresh human usability study | **PASS** (with stated caveat) |
| 3 | Three new hunts startable from catalogue/`/practice`, deterministic, reportable/evaluable/revealable like the original seven | hunt list shows all ten (probe; content test bidirectional wiring); both-mode behaviour verified in browser and suites; learning flow identical (§6) | **PASS** |
| 4 | Clean Mode correctness — no defect branch without an active hunt session; `openapi.json` truthful; 401/403/404 unchanged | defect sites branch only on server-resolved session rows; contract coverage + honesty fixes (§4); matrix (§9); `x-internal` declared | **PASS** |
| 5 | `npm run check` green; build clean; no learner-reachable defect ids; both themes × 4 widths; zero console errors; leak scan clean | §10, §11, §12 — exactly this state | **PASS** |
| 6 | Migration `0011` verified both paths; local `schema_version` = 11; explicit production statement | §8 — fresh + upgrade + fake-D1 + local wrangler; production explicitly **10** and untouched; statement in header §16 | **PASS** |
| 7 | `docs/phase-5-exit-audit.md` exists; README and `PROJECT_STATE.md` updated truthfully; `AGENTS.md` current | this document; README/PROJECT_STATE/AGENTS updated in the same milestone commit | **PASS** |
| 8 | No production push/merge/migration/deploy without separate explicit maintainer approval | nothing was pushed, merged, PR'd, deployed or applied to production; §14 is the unexecuted gate | **PASS** |

**Overall: all eight exit criteria PASS. Zero FAIL. Zero NOT VERIFIED.**

## 16. Final exit decision

- **Implementation complete:** yes — P5-M1, P5-M2, P5-M3 are all implemented and verified.
- **Locally verified:** yes — full suite, build, migrations, package leaks, browser probe,
  both themes × four widths, keyboard spot checks, zero unexpected console errors.
- **Ready for production release:** yes — as defined by this audit: additive-only migration,
  contract self-consistent, no known critical/high-severity defects, checklist §14 ready.
- **Actually deployed to production:** **yes — as of 2026-11-16, the same day this audit was written**
  (maintainer-approved release; see §14 and the release addendum §17). Production serves the Phase 5
  release (Cloudflare Pages deployment `aaa0e2a6-2f13-47e1-91b5-cac38c4d2765`, source `3ecfb41`,
  D1 `schema_version` 11). At the time this audit was first committed, production served the Phase 4
  release (`ac53fd0`, `schema_version` 10); that pre-release statement is preserved in the header
  and superseded by the addendum.

**Exit decision: Phase 5 is implementation-complete, released to production and verified.**

## 17. Release addendum — production release executed and verified (2026-11-16)

Executed on explicit maintainer authorization the same day this audit was written. All timestamps UTC.

### Git and PR
- PR #8 — https://github.com/thisishamza/qa-practice-lab/pull/8 — “Phase 5 M3: Hardening and Exit Audit”; base `main`, head `feat/phase-5-m3-exit-audit`; 2 commits (`7b224ed`, `1b51f06`); 7 files, +438/−17, all in approved P5-M3 scope; **merged 2026-11-16 with method `merge`**; merge commit **`3ecfb4110e4acc230d5d9640d45f85b6bc57b492`**; PR state `merged`; branch `main` not protected (no required checks — repository has no CI, consistent with PRs #5–#7); no branch protections bypassed. Local `main` fast-forwarded to `origin/main`; P5-M3 commits confirmed ancestors of `main`; working tree clean.
- **Deployment source commit:** `3ecfb4110e4acc230d5d9640d45f85b6bc57b492` (merged `main` HEAD). The release-documentation commit that follows is separate and was not the deployed artifact.

### Database
- D1 identity verified **before** any change: `qa-practice-lab-db`, UUID `928b4ed6-6284-46a2-b374-f1c569c1affe`, account matches the maintainer’s authenticated Wrangler session; binding `DB` in `wrangler.jsonc` points at this database.
- Pre-migration state: remote history 0001–0010 applied; `d1_migrations` = 10 rows; `schema_version` = 10; production health `ok`; `db:migrations list --remote` = only `0011_api_tokens.sql` pending.
- **Backup/export:** `npx wrangler d1 export qa-practice-lab-db --remote` → `/tmp/opencode/qa-practice-lab-db-pre-0011.sql` (40192 bytes, 175 statements, all 18 tables + `d1_migrations` 0001–0010; last applied `0010_hunt_attempts.sql`). Verified after download. Export URL expired unused; file retained outside the repo.
- **Migration:** `npx wrangler d1 migrations apply qa-practice-lab-db --remote` → `0011_api_tokens.sql` ✅. Post-migration read-only verification: `schema_version` = **11**; `api_tokens` + `idx_api_tokens_customer` + `idx_api_tokens_expiry` present; `api_tokens` row count = 0; `migrations list --remote` → “No migrations to apply!”. No unrelated migration applied; no manual SQL fragments run; tracking system intact. **Phase 4 application remains compatible** (migration is additive; Phase 4 code never references `api_tokens`).

### Deployment
- `npm run check` on merged `main`: ESLint clean, typecheck ×3 clean, **837/837 tests across 42 files**. `npm run build` clean (index JS 377.55 kB / gzip 116.69 kB).
- `npx wrangler pages deploy dist --project-name qa-practice-lab --branch main` → **deployment `aaa0e2a6-2f13-47e1-91b5-cac38c4d2765`** — Production, branch `main`, source `3ecfb41`, https://aaa0e2a6.qa-practice-lab.pages.dev, status success (“just now”, confirmed via `wrangler pages deployment list`).
- **Production alias** `https://qa-practice-lab.pages.dev` serves the release: `/api/health` → `schemaVersion: "11"`, database `ok`, version `0.2.0`.

### Production acceptance (2026-11-16, ~17:04–17:10 UTC)
Bounded, non-destructive checks only; no load tests, no scanning, no shared-data mutation. **Browser checks: yes — headless system Chrome over CDP** (with `--disable-quic` and IPv4 `host-resolver-rules`, because this machine has no IPv6 connectivity and `getent hosts qa-practice-lab.pages.dev` returns only AAAA records; curl over HTTP/2 was unaffected). Not tested in Firefox/WebKit (unchanged limitation).

| Check | Result |
|---|---|
| `GET /` | 200; renders “Dashboard · QA Practice Lab”, h1 “Practise testing across the whole stack.”; zero console errors |
| `GET /api/health` | 200 `{"status":"ok","service":"qa-practice-lab","version":"0.2.0","database":"ok","schemaVersion":"11",…}` |
| `GET /openapi.json` | 200 `application/json`, 124005 bytes; parses; **35 operations**, OpenAPI 3.1.0 |
| `GET /api-reference` | 200 (SPA shell); renders h1 “API Reference”; zero console errors |
| `GET /api-lab` | 200 (SPA shell); renders h1 “API Lab”; zero console errors |
| `GET /practice`, `/login`, `/progress` | 200; render respective h1s; zero console errors |
| Static assets (`/assets/index-Di9Y7OYz.js`, `/favicon.svg`) | 200, correct content types |
| Guest `GET /api/v1/account` | 401 `unauthorized` (fail closed) |
| `Authorization: Bearer not-hex-junk` on `/api/v1/account` | 401 `unauthorized` (fail closed, no cookie fallback) |
| Guest `GET /api/v1/admin/inventory` | 401 (staff authorization preserved) |
| Catalogue (`GET /api/v1/products`, no session) | 200; 40 synthetic products, clean data |
| `GET /api/v1/practice/hunts` | 200; 10 hunts listed incl. `hunt-authn-001`, `hunt-rbac-001`, `hunt-mass-001` |
| Token lifecycle (designated synthetic account `amara.okafor@example.com`) | sign-in 200 → mint `POST /api/v1/auth/token` **201** (hex-64 token, 15–900 clamp; 60 s TTL used; raw token never printed or stored beyond an ephemeral file deleted afterwards) → `Bearer GET /api/v1/account` **200** → `POST /api/v1/auth/logout` 200 → Bearer replay → **401** `unauthorized`; production `api_tokens` row count back to **0** (logout revocation confirmed) |
| Bug-hunt safety | no hunt was started against production; clean catalogue confirmed; all ten hunts present and activation is session-row-bound (documented design; verified locally at release-verification time); no defect triggered, no shared data modified |
| Unexpected 5xx | none observed |
| Unexpected console errors | none |
| Transient anomaly | one early GET of `/openapi.json` from a single edge PoP returned the 1506-byte SPA shell (`text/html`) moments after deploy; HEAD and subsequent GETs from multiple PoPs (SIN, KHI) returned the correct `application/json` artifact with the expected etag; resolved without intervention. Noted for the record; now consistent |

**Not run in production:** AUTHN-001/RBAC-001/MASS-001 hunt journeys and MASS-001 checkout (would create or modify production practice rows; clean-mode boundaries verified read-only instead, and full journeys passed 67/67 in the local browser probe); expired-token (`401 token_expired`) live check (the 60 s TTL token was revoked via logout before expiry; expiry semantics covered by the test suite and the local probe); production `/progress` signed-in attribution (covered by suite + local probe). Firefox/WebKit untested.

### Independent review
A second human reviewer for `customer.ts` was unavailable; an independent fresh-context agent reviewed the auth-critical surface (`customer.ts`, `apiTokens.ts`, `auth.ts`, `0011_api_tokens.sql`, hunt isolation) and reported **no release-blocking issues**. LOW/INFO observations recorded: Bearer-only `POST /api/v1/auth/logout` is a revocation no-op (documented, exit audit §13 item 6 / migration comment); `mintApiToken` relies on the single caller for TTL clamping (defense-in-depth would be cheap); optional-attach checkout paths treat invalid Bearer as anonymous (asymmetric with protected guards); sign-out revokes all of the account’s tokens (deliberately broad, documented); no per-account live-token cap (documented §13 item 5); one duplicated hex-format regex nit; migration’s silent `UPDATE app_meta` no-op if the row were missing (consistent with 0007–0010). None is release-blocking; OBS-1/OBS-7 candidates for a future hardening pass.

### Final status
- P5-M3 **merged** (PR #8, `3ecfb41`). Migration **0011 applied** to production D1 (`schema_version` 11). Phase 5 **deployed** to Cloudflare Pages production (deployment `aaa0e2a6-2f13-47e1-91b5-cac38c4d2765`). Production acceptance **passed** (with the skips recorded above). Phase 5 is **live** at https://qa-practice-lab.pages.dev.
- Known limitations (unchanged): Firefox/WebKit untested; no CSP; no refresh tokens/rotation; no per-account live-token cap; Bearer-only logout no-op (documented); `/openapi.json` is a public static artifact; Chrome-only automated acceptance; Phase 4–5 practice data in production is synthetic by design; the maintenance sweep remains operator-invoked (at least weekly; daily in active classes).
- Rollback: not needed; migration 0011 additive and retained. If ever required, redeploy Phase 4 deployment `0b1cd31b` via Pages dashboard/CLI.
