// Contract exercise & contract-hunt hints (Phase 7, plan §4.7) — CODE, not data.
//
// Three levels per exercise/hunt, in a strict ladder:
//   Level 1 — Orient: what the contract says and where to look.
//   Level 2 — Focus: which keyword/locus to probe.
//   Level 3 — Narrow: the precise assertion — one step from the answer.
//
// Server-only. Hints never name expected selections verbatim, reference
// answers or fixture deltas. The ladder is enforced by src/server/learning.ts.

import type { HintLevel, HuntHints } from './hints'

export const CONTRACT_HINTS: Record<string, HuntHints> = {
  'contract-bgn-openapi-01': {
    level1: 'The document has paths (the operations) and components/schemas (what the operations return). The $ref pointers between them are the table of contents.',
    level2: 'For each listed operation, follow its response schema $ref to its target, and confirm the target exists. Two of them point at names that were never declared.',
    level3: 'Products → ProductListResponse, slug → Product, categories → CategoryListResponse, cart → CartResponse, checkout → OrderDetail. The two that dangle: #/components/schemas/ProductList and #/components/schemas/Ordr.',
  },
  'contract-bgn-required-01': {
    level1: 'The contract declares a required list. Every one of those names must be present in a payload that claims to satisfy the document.',
    level2: 'Check the payload against `required` one name at a time — no type, enum or pattern checking yet.',
    level3: 'Amount is the missing one: required contains amountCents and the payload has no such key. That is the required assertion at /amountCents.',
  },
  'contract-bgn-types-01': {
    level1: 'JSON values carry their type with them. The contract says exactly what shape each field must take — read the amount field first.',
    level2: 'Compare the payload value to the schema keyword for that field: does a number belong, or something spelled like one?',
    level3: 'amountCents arrives as the string "4250"; the schema says integer. The type assertion fires — and the fix is to submit 4250 as a JSON number.',
  },
  'contract-bgn-formats-01': {
    level1: 'Formats are contracts too. A date that parses in your head is not a date the validator accepts.',
    level2: 'Look at the two payloads one at a time: which string is supposed to be a timestamp, and which is supposed to be an email?',
    level3: 'createdAt wants RFC 3339 date-time; customerEmail wants a parseable email. Both fail their format assertions — and nothing else does.',
  },
  'contract-bgn-enum-01': {
    level1: 'Enum members are a closed vocabulary — the spelling, the casing and the set are all part of it.',
    level2: 'List the values the document allows for `status`, then compare the payload token against that list, case-sensitively.',
    level3: 'The valid set is posted, pending, reversed — IN_STOCK is neither a member nor a casing variant. Select the enum assertion and the complete set.',
  },
  'contract-bgn-status-01': {
    level1: 'Methods differ: reads succeed with 200; creations answer 201; bad input is 400; unknown resources are 404.',
    level2: 'Pair each documented behaviour with its clean-mode code: products read, checkout creation, token creation, cancel, unknown slug, invalid checkout body.',
    level3: 'products→200, checkout POST→201, token POST→201, cancel→200, unknown slug→404, invalid body→400. The 204 in the distractors is the bug-hunt answer, not the contract.',
  },
  'contract-bgn-contenttype-01': {
    level1: 'The client decides how to parse from Content-Type — before it looks at the bytes.',
    level2: 'Exactly one of the four is not application/json on a JSON endpoint. Find the one whose parsers will throw.',
    level3: 'The text/plain response with a JSON body breaks the media-type rule — not the status code, not the schema.',
  },
  'contract-bgn-live-products-01': {
    level1: 'You are choosing what to pin forever — the regression test is three lines, and it must break when the contract breaks.',
    level2: 'Which invariants does everything else depend on? Think: money, stock, currency. What would make this payload unshippable?',
    level3: 'Pin priceCents (integer ≥ 0), stockStatus (the enum) and currency (exactly USD). Everything else is descriptive.',
  },
  'contract-int-nested-01': {
    level1: 'Assertion paths in arrays carry indices — /items/1/quantity means "the second element’s quantity".',
    level2: 'Walk into items, element by element, and apply the element’s schema. Which element fails, and on which rule?',
    level3: 'items[1].quantity is 0 against minimum: 1 — the minimum assertion at /items/1/quantity. Fix the capture and re-validate.',
  },
  'contract-int-request-01': {
    level1: 'Requests fail in two directions: too little, and the wrong shape. Check the numbers and the names.',
    level2: 'Two independent problems ship in this payload — one is a bound, one is a missing name.',
    level3: 'amountCents is below minimum: 0, and entryId is absent from required. Both assertions fire; select them both.',
  },
  'contract-int-response-01': {
    level1: 'A missing key is still a type of wrong. The contract knows which keys may never be absent.',
    level2: 'Diff the payload against `required`. One name is absent; nothing else needs fixing.',
    level3: 'createdAt is required — it is the only failure. Select the required assertion.',
  },
  'contract-int-const-01': {
    level1: 'Const fields carry exactly one legal value. casing included.',
    level2: 'Two violations: one is the currency casing, the other is the extra key the closed schema refuses to admit.',
    level3: 'currency must be exactly "USD" — and `debug` is not in properties, so additionalProperties: false rejects the whole payload.',
  },
  'contract-int-constraints-01': {
    level1: 'Numbers with opinions: bounds, spellings and sizes are each their own keyword.',
    level2: 'One violation per keyword — minimum, pattern, minLength, maxLength — and each is a different field.',
    level3: 'Negative amount (minimum), malformed entryId (pattern), empty merchant (minLength), over-64-char clientRef (maxLength). Four items, four keywords.',
  },
  'contract-int-refs-01': {
    level1: 'Every $ref here starts with #/ — resolve them against the same document, no loader needed.',
    level2: 'Follow each chain to its end: which component schema, and what does it guarantee?',
    level3: 'items → LedgerEntry (merchant required); status → posted|pending|reversed; Error.code → ^LEDG-[0-9]{3}$.',
  },
  'contract-int-nullable-01': {
    level1: 'Optional and nullable are two different promises — check the required list separately from the type array.',
    level2: 'For each statement: is the field required? Does the type array include null? Can it be a number?',
    level3: 'Null validates (type array), absent validates (not required), 1763308800 does not. The other three are lies.',
  },
  'contract-int-compare-additive-01': {
    level1: 'Two changes ride in this diff: one is an addition nobody depended on, one is a vocabulary that grew.',
    level2: 'R4 covers additions; R9 covers enum widenings — which is which here, and which bucket does the enum rule force?',
    level3: 'memo is an optional addition — compatible (R4). scheduled widens the closed status set — review, always (R9).',
  },
  'contract-int-compare-enum-01': {
    level1: 'A wider enum is a louder enum. The consumers with closed switches are the ones at risk.',
    level2: 'Classify the finding first; then name the failure mode for the consumer who switches on status exhaustively.',
    level3: 'Review — because closed switches hit scheduled with no branch and no error message; they silently drop the row.',
  },
  'contract-adv-breaking-req-01': {
    level1: 'Required lists are promises the provider makes to clients — tightening them breaks the promise.',
    level2: 'Think about every client already in the fleet: what happens to their valid requests on Tuesday?',
    level3: 'R1 — breaking. Previously-valid requests are rejected; clients must migrate first, always.',
  },
  'contract-adv-breaking-type-01': {
    level1: 'Types on the wire are load-bearing — integer cents render, sum and compare; strings do none of that safely.',
    level2: 'Classify the three findings independently: the type, the pattern that came with it, and the bound that disappeared.',
    level3: 'integer→string is R6 breaking; the pattern addition is R19 review; removing minimum: 0 response-side is R13 breaking.',
  },
  'contract-adv-breaking-remove-01': {
    level1: 'A field that disappears from the document does not disappear from consumers’ expectations.',
    level2: 'Two findings to classify — the removed property, and the enum narrowing in the same candidate.',
    level3: 'settledAt removed is R3 breaking; pending removed from the status enum is R8 breaking. Absent and unhandled, respectively.',
  },
  'contract-adv-consumer-expect-01': {
    level1: 'You are declaring only what this consumer reads — nothing more, and never the whole provider document.',
    level2: 'Five fields, five types: which five, and which vocabulary constraints (const, enum) does each need?',
    level3: 'Required: slug, name, priceCents (integer), currency (const USD), stockStatus (enum). No description, no categoryName, no closed schema.',
  },
  'contract-adv-consumer-broken-01': {
    level1: 'Someone moved something. The failing assertion tells you which side to look at — read it before you triage.',
    level2: 'Compose the expectation exactly as before (C1–C7 still applies), then compare its failure against the drift: which assertion fires, and who owns the fix?',
    level3: 'stockStatus casing fires first; categoryName is the missing pin for category-rendering consumers — provider-side rename (R3). Keep the pin; the fix is theirs.',
  },
  'contract-adv-checkout-flow-01': {
    level1: 'Three captures, three contracts — grade each capture separately; eight violations hide across the journey.',
    level2: 'One violation hides in each of: summary items[0].unitPriceCents, summary total, request email, request paymentSimulation, detail createdAt, detail reference, detail items[0].lineTotalCents, detail cancelledAt.',
    level3: 'unitPriceCents string, negative total; email magic-string, paymentSimulation "maybe"; createdAt integer-epoch, malformed reference, lineTotalCents string, cancelledAt integer. Eight, no more.',
  },
  'contract-adv-versioning-01': {
    level1: 'This is the complete list — one of each rule in play. Sort them into breaking / review / compatible before you write the verdict.',
    level2: 'Type change, dropped bound, pattern addition, removed property, enum narrowing, required relaxation — six findings, three buckets.',
    level3: 'breaking (type R6), breaking (minimum R13), review (pattern R19), breaking (settledAt R3), breaking (enum R8), compatible (required R2). BREAKING overall.',
  },
  // --- Contract hunts (learner-safe: orientation only, never the finding) ---
  'hunt-contract-001': {
    level1: 'One documented field is absent from the live response. The contract names the payload — find what it insists on.',
    level2: 'Validate the capture against the documented product schema and read which keyword fires first.',
    level3: 'The `required` keyword — the vanished property is the one the contract refuses to drop.',
  },
  'hunt-contract-002': {
    level1: 'Money is not text. The response still says the right thing — until you add two of them together.',
    level2: 'Validate the capture: which keyword complains about the money field?',
    level3: 'The `type` keyword — the documented integer rides the wire as a string.',
  },
  'hunt-contract-003': {
    level1: 'The status vocabulary is closed — spelling and casing included. One of the three values is off.',
    level2: 'Validate the capture against the enum and see exactly which value is refused.',
    level3: 'The `enum` keyword — the value is a casing variant, not a member.',
  },
  'hunt-contract-004': {
    level1: 'A success code is part of the contract. Something returned success — but not the success the document promises.',
    level2: 'Make the cancel call and read the status line. Then read the document’s cancel contract.',
    level3: 'The documented 200 + OrderDetail body versus what actually came back — the assertion is the status code itself.',
  },
  'hunt-contract-005': {
    level1: 'One extra key rides the wire that the document never declared. Strict readers will refuse the whole payload.',
    level2: 'Validate with additionalProperties: false in force — what does it call out, and who does it break?',
    level3: 'additionalProperties: false — the undocumented property rejects the entire payload for strict consumers.',
  },
  'hunt-contract-006': {
    level1: 'Timestamps are strings with rules. This one stopped being a string with rules.',
    level2: 'Validate the orders capture and read which keywords fire on the timestamp field.',
    level3: 'type + format — the epoch integer is neither the documented type nor the documented format.',
  },
  'hunt-contract-007': {
    level1: 'The provider moved something. Your expectation is the pin — run it against the v2 payload and see where it snaps.',
    level2: 'Resolve provider-product-v2-latest in the consumer workspace while in this hunt, and read the failing assertion list carefully.',
    level3: 'The `required` assertion on the renamed category property — provider-side drift (R3). The consumer pin stays; the fix is theirs.',
  },
}

/** Hint lookup for contract targets; null when not registered. */
export function contractHintText(id: string, level: HintLevel): string | null {
  return CONTRACT_HINTS[id]?.[`level${level}` as 'level1' | 'level2' | 'level3'] ?? null
}
