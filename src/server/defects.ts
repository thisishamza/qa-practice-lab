// Defect registry (P3-M7, expanded in P3-M8) — CODE, not data.
//
// Each defect is a typed object compiled with the Worker; there is no path
// by which a browser can define, register, select or activate a defect.
// Defect ids never appear in any API response; learner-facing surfaces only
// see hunt summaries (src/server/hunts.ts). Expected vs actual behaviour is
// documented for engine maintainers in docs/bug-hunt-catalogue.md.
//
// Every defect has exactly one code site branching on
// `isDefectActive(c, DEFECT_ID)`. Clean mode never reaches the defective
// branch. Defect branches are static — no randomness, no wall-clock
// dependence — so identical session state + hunt always yields identical
// responses.

import { getCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { AppEnv } from './app'
import { SESSION_COOKIE, findLiveSession, hashSessionToken, isTokenFormat } from './session'
import { findHunt } from './hunts'

export interface DefectDefinition {
  /** Stable internal id, e.g. 'CATALOGUE-001'. Never sent to the browser. */
  id: string
  title: string
  affectedSurface: string
  /** Internal documentation — Expected vs Actual (see docs/bug-hunt-catalogue.md). */
  expected: string
  actual: string
  repro: readonly string[]
  fix: string
}

export const DEFECTS: readonly DefectDefinition[] = [
  {
    id: 'CATALOGUE-001',
    title: 'Catalogue search ignores the description facet',
    affectedSurface: 'GET /api/v1/products?q= (and the /shop search box)',
    expected:
      'Searching matches products whose name, description OR category name contains the term (case-insensitive substring), matching the documented clean-mode contract.',
    actual:
      'The description clause is dropped from the match, so only products whose name or category name contains the term are returned. Description-only matches silently vanish from the results and the total count.',
    repro: [
      'In a bug-hunt session, open /shop.',
      "Search for 'vestibules' (a term that appears only in the Ridgeline 2-Person Tent description).",
      'Clean mode would return one product; the hunt session returns an empty result set.',
      'Reset to clean mode and repeat the search to observe the correct result.',
    ],
    fix: "Include the 'p.description LIKE ? ESCAPE '\\'' clause in the q predicate.",
  },
  {
    id: 'CATALOGUE-002',
    title: 'Category filter is silently ignored',
    affectedSurface: 'GET /api/v1/products?category= (and the /shop category select)',
    expected:
      'Listing products with a category slug returns only active products in that category. The response total and rows both respect the filter.',
    actual:
      'The category predicate is dropped from the query entirely, so every active product is returned regardless of the requested category. The filter still renders and accepts input, but the result set is unfiltered.',
    repro: [
      'In a bug-hunt session, open /shop.',
      'Choose the category "Climbing" (slug climbing) in the /shop filter.',
      'Clean mode returns only climbing products; the hunt session returns the full catalogue.',
      'Reset to clean mode and repeat the filter to observe the narrowed result.',
    ],
    fix: "Bind the 'c.slug = ?' condition whenever a category query parameter is present.",
  },
  {
    id: 'CART-001',
    title: 'Re-adding an item replaces the line quantity',
    affectedSurface: 'POST /api/v1/cart/items',
    expected:
      'Adding an item that is already in the cart accumulates the quantity (existing + added), capped by the stock guard and the per-line maximum — the documented idempotent add-to-cart semantics.',
    actual:
      'The upsert sets the line quantity to the newly added quantity instead of accumulating onto the existing line. Re-adding the same product looks like nothing happened when the cart already holds that quantity.',
    repro: [
      'In a bug-hunt session, add any product to the cart twice in a row with quantity 2 each time.',
      'Clean mode shows a line quantity of 4; the hunt session shows 2.',
      'The final-cart read-back is otherwise consistent — only the add operation loses the accumulation.',
      'Reset to clean mode and repeat to observe the accumulation.',
    ],
    fix: "In the cart upsert, use 'quantity = cart_items.quantity + excluded.quantity'.",
  },
  {
    id: 'INVENTORY-001',
    title: 'Checkout rejects orders for the exact remaining stock',
    affectedSurface: 'POST /api/v1/checkout (stock-sufficiency boundary)',
    expected:
      'Checkout accepts a line whose quantity is exactly the remaining stock (inventory.quantity >= line quantity). Only quantities above available stock are rejected with 422 cart_unavailable.',
    actual:
      'The stock-sufficiency comparison is off by one at the boundary, so an order for exactly the remaining units is rejected with 422 cart_unavailable even though the stock covers it exactly.',
    repro: [
      'In a bug-hunt session, find a low-stock product (for example the Ember LED Lantern, 4 units remaining).',
      'Add exactly all remaining units to the cart.',
      'Place an approved checkout. Clean mode places the order; the hunt session returns 422 cart_unavailable with a per-line insufficient_stock reason.',
      'Reset to clean mode and repeat to observe the order being accepted.',
    ],
    fix: "Compare 'line.quantity > line.availableStock' (reject only above stock), not '>='.",
  },
  {
    id: 'PRICING-001',
    title: 'Stored order line totals ignore quantity',
    affectedSurface: 'POST /api/v1/checkout (order_items snapshot) and the order confirmation pages',
    expected:
      'Each order item snapshot stores line_total_cents = unit_price_cents x quantity. The confirmation shows line totals consistent with unit price and quantity, and consistent with the order subtotal/total.',
    actual:
      'The stored snapshot records the unit price as the line total, ignoring the quantity. The cart and the checkout summary both compute totals correctly, but the placed order’s line totals are unit price x 1 regardless of the quantity ordered; the order subtotal/total remain correct.',
    repro: [
      'In a bug-hunt session, add a product with quantity 3 and confirm the checkout summary shows unit price x 3.',
      'Place the approved order and open the confirmation.',
      'Clean mode shows line total = unit price x 3; the hunt session shows line total = unit price.',
      'Reset to clean mode and repeat to observe the correct line totals.',
    ],
    fix: "Bind 'line.lineTotalCents' (unit price x quantity) as the line_total_cents insert parameter.",
  },
  {
    id: 'CHECKOUT-001',
    title: 'Blank customer name passes checkout validation',
    affectedSurface: 'POST /api/v1/checkout (details validation)',
    expected:
      'The customer name must match the documented pattern (2–100 letters, allowing spaces, periods, apostrophes, hyphens and commas). A blank or whitespace-only name is rejected with 400 invalid_request and a per-field customerName message.',
    actual:
      'The name validation check is skipped, so a blank customer name is accepted and the order is placed without a name. Every other field is still validated normally.',
    repro: [
      'In a bug-hunt session, call POST /api/v1/checkout directly (browser dev tools or an HTTP client) with customerName set to a blank string and all other fields valid.',
      'Clean mode answers 400 invalid_request with a customerName field error; the hunt session places the approved order.',
      'Every other invalid field is still rejected identically in both modes.',
      'Reset to clean mode and repeat to observe the rejection.',
    ],
    fix: "Re-apply the NAME_PATTERN check to the trimmed customerName before accepting the details.",
  },
  {
    id: 'AUTHZ-001',
    title: 'Account order detail drops the ownership check',
    affectedSurface: 'GET /api/v1/account/orders/:reference',
    expected:
      'Order detail is served only when the order reference AND the caller’s customer_id both match. Unknown or not-owned references answer the identical 404 not_found envelope (existence concealed).',
    actual:
      'The customer_id predicate is dropped from the lookup, so any authenticated active customer can read any existing order by its reference. Unknown references still answer 404 as before.',
    repro: [
      'In a bug-hunt session, sign in as a demo customer and place an order; note the reference.',
      'Sign out, sign in as a different demo customer, and open /account/orders/<reference> (or GET /api/v1/account/orders/<reference>).',
      'Clean mode answers 404 not_found; the hunt session returns the full order.',
      'Reset to clean mode and repeat as the second customer to observe the concealed 404.',
    ],
    fix: "Bind the caller’s customer_id and require 'reference = ? AND customer_id = ?' before reading the order.",
  },
]

export function findDefect(id: string): DefectDefinition | null {
  return DEFECTS.find((defect) => defect.id === id) ?? null
}

/**
 * Server-resolved defect activation. Reads the caller's `mpl_session`
 * cookie exactly as other session-scoped routes do, then checks that the
 * live session is in bug-hunt mode AND its hunt (from the code registry,
 * keyed by the session's stored hunt_id) lists the defect.
 *
 * Never trusts a client-supplied defect id, role, owner or activation flag
 * — the only inputs are the server-side session row and the compiled
 * registries. Unknown hunts, clean sessions, missing/expired sessions and
 * malformed cookies all resolve to false (clean). Performs one indexed
 * session lookup; call it only on paths that need it (e.g. inside the `q`
 * branch of the catalogue search).
 */
export async function isDefectActive(c: Context<AppEnv>, defectId: string): Promise<boolean> {
  const presented = getCookie(c, SESSION_COOKIE)
  if (!presented || !isTokenFormat(presented)) {
    return false
  }
  const live = await findLiveSession(c.env.DB, await hashSessionToken(presented))
  if (!live || live.mode !== 'bug_hunt' || !live.huntId) {
    return false
  }
  const hunt = findHunt(live.huntId)
  return hunt !== null && hunt.defectIds.includes(defectId)
}
