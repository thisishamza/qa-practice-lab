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
    id: 'AUTHN-001',
    title: 'Logout leaves API tokens replayable',
    affectedSurface: 'POST /api/v1/auth/logout (+ Bearer token resolution in src/server/customer.ts)',
    expected:
      'Logging out revokes the account’s practice API tokens server-side (customer-scoped delete), so a Bearer token captured before logout answers 401 unauthorized on every protected endpoint.',
    actual:
      'Logout deletes the customer session but leaves the account’s api_tokens rows in place, so a Bearer token replayed after logout still resolves the account and answers 200 on protected endpoints.',
    repro: [
      'In a bug-hunt session, sign in as a demo customer and mint a practice API token.',
      'Call POST /api/v1/auth/token, note the token, then call POST /api/v1/auth/logout.',
      'Replay the token against GET /api/v1/account with an Authorization: Bearer header.',
      'Clean mode answers 401 unauthorized; the hunt session answers 200 with the profile.',
    ],
    fix: "Run the customer-scoped DELETE FROM api_tokens WHERE customer_id = ? in the logout handler (clean mode does this today).",
  },
  {
    id: 'RBAC-001',
    title: 'Staff inventory read is open to the customer role',
    affectedSurface: 'GET /api/v1/admin/inventory',
    expected:
      'GET /api/v1/admin/inventory is staff-only: an authenticated customer-role account answers 403 staff_required, identically for cookie and Bearer authentication. PATCH /api/v1/admin/inventory/:productId enforces the same boundary.',
    actual:
      'The read-only list endpoint does not check the role: any authenticated active customer (cookie or Bearer) receives the full inventory payload with 200. PATCH is unaffected and still answers 403 staff_required for non-staff accounts.',
    repro: [
      'In a bug-hunt session, sign in as a customer-role demo account.',
      'GET /api/v1/admin/inventory with the mpl_customer cookie (or a Bearer token).',
      'Clean mode answers 403 staff_required; the hunt session answers 200 with the inventory list.',
      'Control: PATCH /api/v1/admin/inventory/:productId is 403 in both modes.',
    ],
    fix: "Re-apply the role check on the GET route (clean mode already enforces it); PATCH is not part of this defect and stays enforced.",
  },
  {
    id: 'MASS-001',
    title: 'Checkout honours a client-supplied totalCents',
    affectedSurface: 'POST /api/v1/checkout',
    expected:
      'The checkout contract accepts only customer details and paymentSimulation. The order total is computed server-side from the catalogue; a client-supplied totalCents is ignored entirely.',
    actual:
      'When the client sends a non-negative integer totalCents it is bound as the order’s total, while the subtotal stays server-computed. The confirmation and GET /api/v1/orders/:reference report a total that disagrees with the cart, the checkout summary and the sum of the line totals.',
    repro: [
      'In a bug-hunt session, add products to the cart and note the checkout summary total.',
      'Call POST /api/v1/checkout with valid details, approved paymentSimulation and "totalCents": 1.',
      'Open the confirmation: the stored total is the forged figure, not the summary total.',
      'Reset to clean mode and repeat — the field is ignored and the server-computed total is stored.',
    ],
    fix: "Ignore the client-supplied totalCents entirely (clean mode binds the server-computed figure).",
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
  {
    id: 'CONTRACT-001',
    title: 'Product detail omits the required stockStatus property',
    affectedSurface: 'GET /api/v1/products/:slug (response body)',
    expected:
      'The product response always satisfies the documented Product contract — every required property present, including stockStatus.',
    actual:
      'In this hunt session the serialized product detail omits stockStatus entirely. Consumers reading the required field get undefined; strict validators fail the payload.',
    repro: [
      'In a bug-hunt session, open any product page.',
      'Capture GET /api/v1/products/<slug>.',
      'Validate the capture against the documented Product schema — the required assertion at /stockStatus fires.',
      'Reset to clean mode and repeat — the clean response validates.',
    ],
    fix: "Build the product response with stockStatus present (clean mode serializes it unchanged).",
  },
  {
    id: 'CONTRACT-002',
    title: 'Product priceCents serialized as a string',
    affectedSurface: 'GET /api/v1/products and GET /api/v1/products/:slug (priceCents)',
    expected:
      'priceCents is an integer number of cents on the wire, exactly as the Product contract declares.',
    actual:
      'In this hunt session priceCents is serialized as a JSON string ("2400"). JS-tolerant consumers keep rendering; the type contract does not.',
    repro: [
      'In a bug-hunt session, capture GET /api/v1/products.',
      'Validate the capture — the type assertion at /priceCents fires (expected integer, actual string).',
      'Reset to clean mode and repeat — the clean response validates.',
    ],
    fix: "Serialize priceCents as a JSON integer (clean mode binds row.price_cents unchanged).",
  },
  {
    id: 'CONTRACT-003',
    title: 'Stock status emitted outside the documented enum',
    affectedSurface: 'GET /api/v1/products and GET /api/v1/products/:slug (stockStatus)',
    expected:
      'stockStatus is one of in_stock | low_stock | out_of_stock, exactly as the StockStatus enum documents.',
    actual:
      'In this hunt session stockStatus is emitted UPPERCASE (IN_STOCK / LOW_STOCK / OUT_OF_STOCK) — outside the documented enum vocabulary.',
    repro: [
      'In a bug-hunt session, capture GET /api/v1/products.',
      'Validate the capture — the enum assertion at /stockStatus fires.',
      'Reset to clean mode and repeat — the clean response validates.',
    ],
    fix: "Emit stockStatus exactly as the documented enum spells it (clean mode is unchanged).",
  },
  {
    id: 'CONTRACT-004',
    title: 'Cancel answers 204 instead of the documented 200',
    affectedSurface: 'POST /api/v1/orders/:reference/cancel (status line and body)',
    expected:
      'A successful cancel answers HTTP 200 with the OrderDetail JSON body, exactly as the contract documents.',
    actual:
      'In this hunt session a successful cancel answers HTTP 204 No Content with an empty body — HTTP-legal, contract-breaking. Clients awaiting the OrderDetail get nothing.',
    repro: [
      'In a bug-hunt session, place an order and cancel it.',
      'Note the status line (204) and the empty body.',
      'Read the documented cancel contract — 200 + OrderDetail.',
      'Reset to clean mode and cancel again — clean mode answers 200 with the OrderDetail.',
    ],
    fix: "Answer 200 with the OrderDetail on success (clean mode is unchanged).",
  },
  {
    id: 'CONTRACT-005',
    title: 'Products gain an undocumented supplierCostCents field',
    affectedSurface: 'GET /api/v1/products (list items)',
    expected:
      'The product payload contains exactly the documented properties — closed-schema consumers (additionalProperties: false) validate clean.',
    actual:
      'In this hunt session each product item carries an extra supplierCostCents property the document never declares. Strict closed-schema consumers reject the entire payload; tolerant consumers pass silently.',
    repro: [
      'In a bug-hunt session, capture GET /api/v1/products.',
      'Validate with a closed-schema consumer pin — additionalProperties: false fires on supplierCostCents.',
      'Reset to clean mode and repeat — the clean response validates.',
    ],
    fix: "Drop the undocumented property (clean mode serializes only documented fields).",
  },
  {
    id: 'CONTRACT-006',
    title: 'Order createdAt emitted as epoch-seconds integer',
    affectedSurface: 'GET /api/v1/orders and GET /api/v1/orders/:reference (createdAt)',
    expected:
      'createdAt is an ISO-8601 date-time string, exactly as the contract declares (format: date-time).',
    actual:
      'In this hunt session createdAt is emitted as an epoch-seconds integer (e.g. 1763308800). The value passes type readers if untyped; the format contract does not.',
    repro: [
      'In a bug-hunt session, capture GET /api/v1/orders.',
      'Validate the capture — the format assertion at /createdAt fires (expected date-time, actual integer).',
      'Reset to clean mode and repeat — the clean response validates.',
    ],
    fix: "Emit createdAt as the stored ISO-8601 string (clean mode is unchanged).",
  },
  {
    id: 'PERF-001',
    title: 'Catalogue list endpoint is uniformly slow',
    affectedSurface: 'GET /api/v1/products (list path)',
    expected:
      'A bounded catalogue page responds within a normal web latency budget (well under 500 ms on this lab) regardless of filters, because the list query is a single indexed read.',
    actual:
      'Every call to the list endpoint pays a uniform artificial delay (~350 ms) before the query runs, so baseline response time is elevated for every learner session carrying this defect, even for cacheable pages.',
    repro: [
      'In a bug-hunt session, time GET /api/v1/products in the Performance workspace or the API Lab.',
      'Compare p50 against a clean-mode session (reset and repeat).',
      'The delay is uniform — it does not depend on page, filter or payload size.',
      'Reset to clean mode and repeat to observe the normal latency.',
    ],
    fix: 'Remove the redundant pre-query stall; keep the single indexed catalogue read.',
  },
  {
    id: 'PERF-002',
    title: 'Deep pagination degrades sharply after page 3',
    affectedSurface: 'GET /api/v1/products?page= (offset beyond page 3)',
    expected:
      'Response time stays roughly flat as the learner pages forward; offset pagination on an indexed, bounded list should not cliff.',
    actual:
      'Pages beyond 3 pay an artificial ~600 ms penalty (an un-indexed deep OFFSET scan represented safely), so page latency grows sharply with depth while pages 1–3 look healthy.',
    repro: [
      'In a bug-hunt session, time GET /api/v1/products?page=1, then ?page=2, ?page=3, ?page=4 and ?page=6.',
      'Latency jumps at the page-3 boundary and stays high.',
      'Reset to clean mode and repeat the page sweep to observe flat latency.',
    ],
    fix: 'Use a keyset (seek) paginator or stabilise the offset plan with an index; never prefetch unbounded pages.',
  },
  {
    id: 'PERF-003',
    title: 'List rendering performs N+1 sequential lookups',
    affectedSurface: 'GET /api/v1/products (list assembly path)',
    expected:
      'Assembling a 12-item page performs a constant number of queries (one list query plus the count), not one lookup per item.',
    actual:
      'The list assembler performs per-product work sequentially with a ~120 ms penalty each (N+1 behaviour represented safely), so a 12-row page pays over a second instead of the flat cost of the list query.',
    repro: [
      'In a bug-hunt session, time GET /api/v1/products?perPage=12.',
      'Compare perPage=1, perPage=6 and perPage=12 — latency scales linearly with page size.',
      'Reset to clean mode and repeat the perPage sweep to observe flat assembly cost.',
    ],
    fix: 'Assemble list rows in one batched query (or one pass) instead of per-row lookups.',
  },
  {
    id: 'SEC-001',
    title: 'Profile response over-shares internal analyst fields',
    affectedSurface: 'GET /api/v1/auth/me (and GET /api/v1/account)',
    expected:
      'The profile payload carries only the learner’s own display fields (name, email, role, status, address, memberSince). Internal analyst annotations are never serialized.',
    actual:
      'The response includes an internalNotes object (synthetic risk score, analyst segment note) that was never intended for the client — classic excessive data exposure.',
    repro: [
      'Sign in with a synthetic demo account in a bug-hunt session.',
      'GET /api/v1/auth/me and inspect the response body.',
      'internalNotes is present in the hunt session and absent in clean mode.',
      'Reset to clean mode and repeat to observe the minimal profile.',
    ],
    fix: 'Project the response through an explicit allowlist serializer; never spread the storage row into the response.',
  },
  {
    id: 'SEC-002',
    title: 'Login failure cap is not enforced',
    affectedSurface: 'POST /api/v1/auth/login (and POST /api/v1/auth/token — shared failure budget)',
    expected:
      'After 5 failed attempts per IP per minute the endpoint refuses further attempts with 429 rate_limited until the window resets; successful sign-in clears the counter.',
    actual:
      'The failure-budget peek is skipped, so unlimited password guesses are answered with 401 forever — brute-force protection is effectively absent.',
    repro: [
      'In a bug-hunt session, POST /api/v1/auth/login with a wrong password ten times rapidly.',
      'Every attempt returns 401 invalid_credentials; no 429 ever appears.',
      'Reset to clean mode and repeat — the 6th attempt within the minute is refused with 429.',
    ],
    fix: 'Enforce the shared login failure budget at the gate (peek before verify), with a sliding 60 s window keyed by hashed IP.',
  },
  {
    id: 'SEC-003',
    title: 'Error responses leak internal diagnostic detail',
    affectedSurface: 'POST /api/v1/checkout (422 cart_unavailable response)',
    expected:
      'Client errors carry the safe error envelope only — error code, learner-safe message and the per-line fulfilment problems. No SQL, connection or stack detail.',
    actual:
      'The 422 response additionally carries a debug object with internal diagnostics (synthetic query text, connection name, SQLSTATE). Harmless-looking internal detail is real information disclosure: it accelerates attacker mapping even when synthetic.',
    repro: [
      'In a bug-hunt session, add items then attempt checkout with an unfulfillable line (or trigger the validation failure path).',
      'Inspect the 422 response body — the debug member is present.',
      'Reset to clean mode and repeat — only error, message and lines appear.',
    ],
    fix: 'Strip diagnostic members at the response boundary; log them server-side, never serialize them.',
  },
  {
    id: 'EVT-001',
    title: 'Payment consumer is not idempotent',
    affectedSurface: 'Event consumer: inventory.reserved → payment (simulated service)',
    expected:
      'Redelivering the same inventory.reserved event is a no-op: the payment is captured at most once per event id (dedup marker recorded).',
    actual:
      'The dedup check is skipped, so each redelivery captures the payment again — captured totals drift above the order total and the duplicate is invisible unless reconciled.',
    repro: [
      'In the microservices simulator (bug-hunt session), publish an order and process until the payment is captured.',
      'Retry/redeliver the inventory.reserved event (or use the Redeliver control) and process again.',
      'payments captured_count and captured_cents_total increase again; the consistency check reports overcapture.',
      'Reset the simulator (or clean mode) and repeat — redelivery is a no-op.',
    ],
    fix: 'Record and check dedup:<eventId> before applying any handler side effect.',
  },
  {
    id: 'EVT-002',
    title: 'Retry backoff is collapsed to zero',
    affectedSurface: 'Event consumer: retry scheduling (all retryable handlers)',
    expected:
      'Retryable failures back off exponentially (1s, 2s, 4s, capped at 8s) so a struggling dependency is not hammered by immediate retries.',
    actual:
      'The backoff computation is collapsed to 0 ms, so every retry fires immediately on the next process call — a retry storm against an already-sick dependency (still bounded by the 3-attempt cap).',
    repro: [
      'In the microservices simulator (bug-hunt session), publish an order with the payment-always-fails drill.',
      'Process once and observe the retry becomes due immediately (waiting count does not include a delay).',
      'Reset and repeat with payment-transient in clean mode — retries wait 1s, then 2s before the 3rd attempt succeeds.',
    ],
    fix: 'Restore exponential backoff with a cap (2^n seconds, ≤ 8s) between attempts.',
  },
  {
    id: 'EVT-003',
    title: 'Unprepared payment message is applied',
    affectedSurface: 'Event consumer: ordering guard (inventory.reserved / payment.processed)',
    expected:
      'A payment message with no matching reservation for its correlation id is rejected to the dead-letter queue with out_of_order_payment — never applied.',
    actual:
      'The ordering guard is skipped, so the unprepared payment is applied: orders flip to paid with no reservation behind them, and the consistency audit flags payment_without_reservation.',
    repro: [
      'In the microservices simulator (bug-hunt session), publish a payment.processed event directly (no order exists).',
      'Process — the payment is applied and captured_count increases with no reservation.',
      'Run the consistency check: payment_without_reservation is reported.',
      'Reset and repeat in clean mode — the message dead-letters with out_of_order_payment.',
    ],
    fix: 'Reject messages whose preconditions are unmet with a distinguishable dead-letter reason; never apply them.',
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
