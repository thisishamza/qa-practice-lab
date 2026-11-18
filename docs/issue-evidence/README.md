# Issue evidence — 2026-11-18 backlog verification

Screenshots captured on 2026-11-18 against production
(https://qa-practice-lab.pages.dev, deployment `1573feaf-df8f-4d86-9c51-accf38d906b2`,
source `91ba58a`) in fresh anonymous guest sessions with headless Firefox 155.
They evidence the verification comments on the repository's open backlog issues
(#14–#36). Every image shows only public, synthetic surfaces — no accounts, no
personal data, no credentials, no production data.

| File | Evidence for |
|---|---|
| `f10-api-reference-375.png` | #14 — `/api-reference` at 375×812 (199 px overflow) |
| `f018-api-reference.png` | #15 — 36 px `.button-small` on `/api-reference` |
| `f021-security-topbar.png` | #16 — global top-bar cart badge on `/security` |
| `hu001-before-add.png` / `hu001-after-add.png` | #17 — add-to-cart feedback (badge only) |
| `hu002-web-zero.png` | #18 — `/scenarios?q=web` zero results |
| `simnew1-combo-zero.png` | #18 — compound filter zero (`track=manual-testing&mode=clean`) |
| `hu003-wired-hunt-top.png` | #19 — wired-hunt CTA at ≈1,076 px of a ≈2,182 px page |
| `hu004-dashboard.png` | #20 — manual-first "Do this next" panel |
| `hu005-progress.png` | #21 — Progress mixed denominators (0/130, 0/34, per-area) |
| `hu006-tracks.png` / `hu006-api-track.png` | #22 — track badging/legend and difficulty drift |
| `simnew2-api-lab.png` | #23 — nav "API console" vs page "API Lab" |
| `fc7-validate-disclosure.png` | #32 — ReDoS learner disclosure on `/contract/validate` |

Two verification probes created one anonymous cart row each in production D1
(expiry ≤ 7 days, no order, no personal data): the manual verification run and
the persona study. This folder adds nothing new.

Attached into issues via raw GitHub URLs pinned to the commit that introduced
this folder. Do not delete these images while the referenced issues are open.
