// Contract exercise & contract-hunt gated reveals (Phase 7, plan §4.7) — CODE, not data.
//
// Served only after reveal eligibility (submitted attempt or confirmed
// give-up), through src/server/learning.ts. Exercise reveals name the
// mechanism and the fix; hunt reveals name the finding path and the fix.
// Nothing here is imported by client code.

import type { RevealDefinition } from './reveals'

export interface ContractRevealDefinition extends RevealDefinition {
  /** The reference assertion(s) the exercise grades on (server-only). */
  solution: string
  /** Why the answer is right / what the fix would be, behaviour level. */
  explanation: string
}

interface RevealCore {
  expected: string
  actual: string
  rootCause: string
  reproduction: readonly string[]
  verification: readonly string[]
  concepts: readonly string[]
  commonMisconceptions: readonly string[]
}

const EXERCISE_REVEALS: Record<string, RevealCore> = {
  'contract-bgn-openapi-01': {
    expected: 'Five operation → schema mappings plus the two dangling refs (ProductList, Ordr).',
    actual: 'Five plausible pairings selected with the refs unexamined, or one wrong mapping accepted.',
    rootCause: 'Paths → responses → $refs → components is the reading order; every link must resolve.',
    reproduction: ['Open the mini contract.', 'Follow each $ref to its target.', 'Mark the two that never resolve.'],
    verification: ['All five mappings match the served document.', 'Both dangling refs identified.'],
    concepts: ['components/schemas', '$ref integrity', 'reading order'],
    commonMisconceptions: ['Trusting a 200-response example instead of following the schema reference.'],
  },
  'contract-bgn-required-01': {
    expected: 'The required assertion at /amountCents — the missing property named.',
    actual: 'Type/enum/pattern assertions selected, or the missing property unidentified.',
    rootCause: 'Required is presence — nothing else matters until every name is present.',
    reproduction: ['Diff the payload keys against required.'],
    verification: ['The assertion path names amountCents.', 'Nothing else fires.'],
    concepts: ['required', 'presence vs shape'],
    commonMisconceptions: ['Checking types first — presence is earlier in the pipeline than shape.'],
  },
  'contract-bgn-types-01': {
    expected: 'amountCents as a JSON number; the type assertion named at /amountCents.',
    actual: 'String accepted as "numeric enough"; fixed payload still a string.',
    rootCause: 'JSON carries no implicit numeric coercion — the wire type is the type.',
    reproduction: ['Compare the payload to the schema type.', 'Resubmit with 4250 as a number.'],
    verification: ['Validator returns zero assertions.', 'The submitted payload passes.'],
    concepts: ['type', 'integer vs string', 'money in integer cents'],
    commonMisconceptions: ['Relying on JS Number("4250") implicit conversion — the wire does not.'],
  },
  'contract-bgn-formats-01': {
    expected: 'Both format assertions — createdAt (date-time) and customerEmail (email).',
    actual: 'One format found; the other waved through as "it looks fine".',
    rootCause: 'Formats are grammar for strings — look-alikes are not members.',
    reproduction: ['Probe createdAt against date-time.', 'Probe customerEmail against email.'],
    verification: ['Both assertions selected; no others.'],
    concepts: ['format: date-time', 'format: email', 'grammar vs eyeball'],
    commonMisconceptions: ['Accepting human-verified dates — the spec is RFC 3339, not your calendar.'],
  },
  'contract-bgn-enum-01': {
    expected: 'Enum assertion for IN_STOCK and the complete set posted|pending|reversed.',
    actual: 'A partial enum selected, or casing waved through.',
    rootCause: 'Enum members are atoms — membership is exact, casing included.',
    reproduction: ['List the documented members.', 'Compare case-sensitively with the payload.'],
    verification: ['The enum assertion named.', 'The complete valid set selected.'],
    concepts: ['enum', 'case sensitivity', 'closed vocabularies'],
    commonMisconceptions: ['Case-insensitive comparison — JSON Schema enum is exact.'],
  },
  'contract-bgn-status-01': {
    expected: 'products 200, checkout 201, token 201, cancel 200, unknown slug 404, invalid body 400.',
    actual: 'The hunt answer (204) selected for the clean-mode contract.',
    rootCause: 'Clean mode is the documented contract; the 204 is the deviation called out by the bug hunt.',
    reproduction: ['Read each documented operation.', 'Pair method+behaviour with its clean code.'],
    verification: ['All six pairs correct.'],
    concepts: ['201 vs 200', 'status semantics', 'documented vs actual'],
    commonMisconceptions: ['204 for cancel because "empty success" — the contract documents 200 + OrderDetail.'],
  },
  'contract-bgn-contenttype-01': {
    expected: 'text/plain + JSON body identified; the media-type rule named.',
    actual: 'The 400-envelope response flagged as the violator.',
    rootCause: 'Content negotiation is contractual — parsers trust Content-Type, never sniffing.',
    reproduction: ['Inspect each response’s Content-Type against its document.'],
    verification: ['text/plain named; media-type rule selected.'],
    concepts: ['Content-Type', 'application/json', 'parser failure modes'],
    commonMisconceptions: ['Clients "just parse it as JSON anyway" — resilient clients are the exception, not the rule.'],
  },
  'contract-bgn-live-products-01': {
    expected: 'priceCents integer, stockStatus enum, currency const USD — the three pins.',
    actual: 'Descriptive fields pinned (description, name) — high count, low value.',
    rootCause: 'Pins are load-bearing invariants — money, stock and currency break builds, prose does not.',
    reproduction: ['Capture the payload.', 'Ask: which three lines would fail this build?'],
    verification: ['Exactly the three invariants selected.'],
    concepts: ['regression pin', 'minimal assertions', 'high-signal tests'],
    commonMisconceptions: ['Pinning everything — a regression test that fails on every harmless diff is noise.'],
  },
  'contract-int-nested-01': {
    expected: 'The minimum assertion at /items/1/quantity; fixed capture submitted.',
    actual: 'items[0] diagnosed; quantity left at 0; the fix not validated.',
    rootCause: 'Index the path literally — /items/1 is the second element, always.',
    reproduction: ['Walk items with indices.', 'Check each element against its element schema.'],
    verification: ['Assertion named at /items/1/quantity.', 'Fixed capture passes.'],
    concepts: ['arrays by index', 'nested assertion paths', 'reading Pointers'],
    commonMisconceptions: ['Assuming the first failing item is the only one — validators return all.'],
  },
  'contract-int-request-01': {
    expected: 'amountCents minimum + entryId required — both selected.',
    actual: 'One of the two found; the other missed under the first failure.',
    rootCause: 'The validator reports every failure it can see — read the whole list.',
    reproduction: ['Check bounds; check names; cross both against the request schema.'],
    verification: ['Both assertions selected; no extras.'],
    concepts: ['request contracts', 'minimum', 'required'],
    commonMisconceptions: ['Stopping at the first error — the request can be wrong twice.'],
  },
  'contract-int-response-01': {
    expected: 'The required assertion at /createdAt only.',
    actual: 'A second, invented assertion selected to look thorough.',
    rootCause: 'Omission is its own failure class — presence first, shape second.',
    reproduction: ['Diff payload keys against required.'],
    verification: ['Exactly the createdAt required assertion.'],
    concepts: ['required', 'partial truth', 'minimal signal'],
    commonMisconceptions: ['Adding plausible extras — selections are graded on precision too.'],
  },
  'contract-int-const-01': {
    expected: 'currency const + additionalProperties on debug — both selected.',
    actual: 'Symptom-chasing: enum/type selected instead of the two real keywords.',
    rootCause: 'Closed schemas fail at the edges: casing on a const, admission on closed properties.',
    reproduction: ['Check const for the currency.', 'Check properties admission for debug.'],
    verification: ['Both assertions selected; no others.'],
    concepts: ['const', 'additionalProperties: false', 'case exactness'],
    commonMisconceptions: ['usd accepted as "the same currency" — the contract is exact, not approximately right.'],
  },
  'contract-int-constraints-01': {
    expected: 'minimum + pattern + minLength + maxLength — four keywords, four items.',
    actual: 'Two of four found; maximum misread as minimum.',
    rootCause: 'Each keyword is one question about one value — answer each question.',
    reproduction: ['amount: bounds; entryId: shape; merchant: size, both ends.'],
    verification: ['Exactly the four expected items.'],
    concepts: ['minimum', 'pattern', 'minLength', 'maxLength'],
    commonMisconceptions: ['Pattern direction reversed — the pattern defines what IS allowed, not what is forbidden.'],
  },
  'contract-int-refs-01': {
    expected: 'LedgerEntry via items; enum via status; LEDG pattern via Error.code.',
    actual: 'Chain stopped at the first hop; terminal schema unnamed.',
    rootCause: 'A $ref is a promise the target exists — the chain terminates at a concrete schema.',
    reproduction: ['Trace each chain by hand through components.schemas.'],
    verification: ['All three terminal schemas named.'],
    concepts: ['$ref resolution', 'transitive references', 'documents as graphs'],
    commonMisconceptions: ['Treating $ref as a redirect for browsers — it is resolution for validators, entirely local.'],
  },
  'contract-int-nullable-01': {
    expected: 'null valid, absent valid, integer invalid — three true statements selected.',
    actual: 'absent deemed invalid because "nullable means required".',
    rootCause: 'null and absent are orthogonal: type array vs required list.',
    reproduction: ['Apply the required list; then the type array; then both to each statement.'],
    verification: ['Exactly the three true statements.'],
    concepts: ['type arrays', 'optional vs nullable', 'honest nulls'],
    commonMisconceptions: ['Type arrays imply required — they say nothing about presence.'],
  },
  'contract-int-compare-additive-01': {
    expected: 'memo → compatible (R4); status widening → review (R9); verdict REVIEW REQUIRED.',
    actual: 'enum widening called compatible — silent upgrade.',
    rootCause: 'Additions are compatible; vocabulary growth is review, always.',
    reproduction: ['Diff base vs candidate.', 'Bucket each finding; apply precedence.'],
    verification: ['Both classifications correct; verdict review.'],
    concepts: ['R4', 'R9', 'verdict precedence'],
    commonMisconceptions: ['Enum additions "can only add, never remove" — the consumer’s switch is the constraint, not the provider’s intent.'],
  },
  'contract-int-compare-enum-01': {
    expected: 'review; the closed-switch impact selected.',
    actual: 'compatible selected because "new value, nothing breaks".',
    rootCause: 'Consumers with exhaustive switches drop unknown values silently — review exists for them.',
    reproduction: ['Classify the finding; then name the consumer failure mode.'],
    verification: ['review + reason-closed-switch.'],
    concepts: ['R9', 'closed switches', 'silent drops'],
    commonMisconceptions: ['Providers own enum direction — they own emission, consumers own handling.'],
  },
  'contract-adv-breaking-req-01': {
    expected: 'breaking; client migration impact.',
    actual: 'compatible because "additive from the provider".',
    rootCause: 'Required is rejection surface — new required means old clients 400.',
    reproduction: ['Walk a fleet client against the new schema.'],
    verification: ['breaking + reason-client-break.'],
    concepts: ['R1', 'rejection surface', 'provider-driven breaks'],
    commonMisconceptions: ['Additive = safe — required puts the addition between the client and its data.'],
  },
  'contract-adv-breaking-type-01': {
    expected: 'breaking (type), review (pattern), breaking (minimum).',
    actual: 'pattern marked compatible because "input unchanged".',
    rootCause: 'Type/bound changes reshape the wire; pattern additions are never auto-classified.',
    reproduction: ['Classify the three findings independently.'],
    verification: ['Exact match on all three.'],
    concepts: ['R6', 'R13', 'R19'],
    commonMisconceptions: ['Pattern additions are documentation — the validator enforces them.'],
  },
  'contract-adv-breaking-remove-01': {
    expected: 'breaking (R3 settledAt); breaking (R8 pending enum).',
    actual: 'settledAt called compatible because "nothing crashed".',
    rootCause: 'Absence reads as undefined downstream — failure without an exception.',
    reproduction: ['Trace a consumer reading settledAt against the new schema.'],
    verification: ['Both classified breaking.'],
    concepts: ['R3', 'R8', 'absence failure modes'],
    commonMisconceptions: ['Removals are "just cleanup" — the wire contract had consumers on that field.'],
  },
  'contract-adv-consumer-expect-01': {
    expected: 'C1–C7 = 100 — minimal, critical-field-complete, open, drift-catching.',
    actual: 'The full provider schema cloned — C3 fails.',
    rootCause: 'Consumer contracts pin only what the consumer reads — minimalism is the discipline.',
    reproduction: ['List the five fields.', 'Write the smallest compiling schema over them.'],
    verification: ['Reference solution scores 100.'],
    concepts: ['C1–C7', 'minimalism', 'consumer-driven contracts'],
    commonMisconceptions: ['"More pinned = safer" — over-pinning rejects every valid provider release.'],
  },
  'contract-adv-consumer-broken-01': {
    expected: 'Expectation fails the drift (C7); triage names the provider-side rename (R3).',
    actual: 'Expectation weakened to pass — the provider’s break made invisible.',
    rootCause: 'A red contract test localizes the change — weakening the pin deletes the evidence.',
    reproduction: ['Verify expectation v1 against v2-drift.', 'Read the failing assertion; name the side that moved.'],
    verification: ['C1–C7 passes with the pin intact.'],
    concepts: ['R3', 'triage', 'keep the pin'],
    commonMisconceptions: ['"Fixing" the test to go green — the test is the smoke alarm, not the fire.'],
  },
  'contract-adv-checkout-flow-01': {
    expected: 'Eight violations: summary quantity/total, request email/payment, detail createdAt/reference/lineTotal/cancelledAt.',
    actual: 'Five found; the currency USD pseudo-violation flagged.',
    rootCause: 'Grade capture by capture — each contract independently, each keyword independently.',
    reproduction: ['Validate each capture; list every assertion that fires.'],
    verification: ['Exactly the eight expected ids selected.'],
    concepts: ['multi-contract journeys', 'per-capture lists', 'eight violations'],
    commonMisconceptions: ['USD being "the obvious bug" — const:USD is documentation, not drift.'],
  },
  'contract-adv-versioning-01': {
    expected: 'BREAKING — 4 breaking, 1 review, 1 compatible; consumer+provider notes.',
    actual: 'Verdict REVIEW because "some findings are compatible".',
    rootCause: 'Precedence is binary at the top: any breaking ⇒ BREAKING, and that is the ship gate.',
    reproduction: ['Classify all six findings; apply precedence; write the verdict.'],
    verification: ['All six exact; BREAKING verdict.'],
    concepts: ['verdict precedence', 'R2 R3 R6 R8 R13 R19', 'migration window'],
    commonMisconceptions: ['Vote-count compatibility — one breaking finding vetoes the release.'],
  },
  // --- Contract hunts ---
  'hunt-contract-001': {
    expected: 'stockStatus absent from the product response — the required assertion at /stockStatus fires.',
    actual: 'A response missing the required stockStatus property, emitted only in this hunt session.',
    rootCause: 'Read-time construction drops the property before serialization — the document never promised this body.',
    reproduction: ['In this hunt, GET /api/v1/products/{slug}.', 'Validate the capture against the documented Product schema.', 'Read which keyword fires.'],
    verification: ['The failing assertion names /stockStatus and required.', 'Reset and repeat — the clean response validates.'],
    concepts: ['required', 'missing vs wrong', 'hunt isolation'],
    commonMisconceptions: ['The payload "almost satisfies" the contract — required does not grade on almost.'],
  },
  'hunt-contract-002': {
    expected: 'priceCents serialized as a JSON string — the type assertion fires.',
    actual: 'priceCents emitted as "2400" instead of 2400, in this hunt session only.',
    rootCause: 'Serialization coerced the integer — JS-tolerant consumers keep rendering; contracts do not forgive.',
    reproduction: ['Capture /api/v1/products.', 'Validate; read the type assertion for priceCents.', 'Reset and repeat.'],
    verification: ['Assertion names /priceCents and type.', 'Clean response validates integer.'],
    concepts: ['type', 'integer on the wire', 'contract vs tolerance'],
    commonMisconceptions: ['String-typed numbers "work" — until arithmetic does not happen.'],
  },
  'hunt-contract-003': {
    expected: 'stockStatus emitted IN_STOCK — outside the documented enum (casing).',
    actual: 'Uppercase enum-casing drift in this hunt session only.',
    rootCause: 'Vocabulary drift — the enum is case-sensitive by construction.',
    reproduction: ['Capture /api/v1/products.', 'Validate; read the enum assertion.', 'Reset and repeat.'],
    verification: ['Assertion names /stockStatus and enum.', 'Clean response validates in_stock|low_stock|out_of_stock.'],
    concepts: ['enum', 'casing', 'closed vocabularies'],
    commonMisconceptions: ['Enum is a set with aliases — it is a set with exact members.'],
  },
  'hunt-contract-004': {
    expected: 'Cancel answered 204 No Content + empty body — documented 200 + OrderDetail never arrives.',
    actual: 'HTTP-legal, contract-breaking status substitution in this hunt session only.',
    rootCause: 'Status is contractual — the body promise and the status line are one document.',
    reproduction: ['POST /api/v1/orders/{reference}/cancel in this hunt.', 'Note the status line and the empty body.', 'Read the documented cancel contract.'],
    verification: ['Report cites documented 200 + OrderDetail vs actual 204 + empty.', 'Clean cancel answers 200.'],
    concepts: ['status as contract', '204 vs 200', 'body promises'],
    commonMisconceptions: ['204 is a valid success — it is a valid success of a different contract.'],
  },
  'hunt-contract-005': {
    expected: 'supplierCostCents rides the wire undocumented — strict closed-schema consumers reject the payload.',
    actual: 'An undocumented property added in this hunt session only; additionalProperties: false readers choke.',
    rootCause: 'Additive on the wire is compatible only for tolerant readers — closed readers reject everything.',
    reproduction: ['Capture /api/v1/products in this hunt.', 'Validate with a closed-schema consumer pin.', 'Note which readers survive.'],
    verification: ['additionalProperties: false assertion fires for strict readers.', 'Clean capture validates.'],
    concepts: ['additionalProperties: false', 'tolerant vs strict readers', 'undocumented surface'],
    commonMisconceptions: ['Additive changes are always safe — they are safe for tolerant readers only.'],
  },
  'hunt-contract-006': {
    expected: 'createdAt emitted as epoch-seconds integer — type and format assertions both fire.',
    actual: 'ISO-8601 date-time replaced by epoch integer in orders responses in this hunt session only.',
    rootCause: 'Temporal contracts are format-pinned — integer epochs fail both the type and the format keyword.',
    reproduction: ['Capture /api/v1/orders.', 'Validate; read type and format on createdAt.', 'Reset and repeat.'],
    verification: ['Both assertions named at /createdAt.', 'Clean capture restores ISO-8601 strings.'],
    concepts: ['format: date-time', 'epoch vs ISO-8601', 'type + format pairs'],
    commonMisconceptions: ['Epochs are "universal timestamps" — the contract says date-time strings, period.'],
  },
  'hunt-contract-007': {
    expected: 'The provider drifted: categoryName renamed to category; stockStatus casing drifted. Your pin (the expectation) catches it.',
    actual: 'Consumer verification resolves to a server-side drifted payload in this hunt session — the assertions fail on the rename and the enum.',
    rootCause: 'Provider-side breaking change (R3 rename) shipped to a consumer with a pinned expectation — the contract caught it before the deploy.',
    reproduction: ['In this hunt, open the consumer workspace.', 'Verify your expectation against provider-product-v2-latest.', 'Read the failing assertions — required categoryName, rejected stockStatus.'],
    verification: ['Assertions name /categoryName (required) and /stockStatus (enum).', 'Exit the hunt — verification passes again against the additive fixture.'],
    concepts: ['consumer-driven contracts', 'R3 rename', 'hunt-scoped alias'],
    commonMisconceptions: ['Weakening the expectation to go green — the pin is the smoke alarm; fix the provider or coordinate the rename.'],
  },
}

const EXERCISE_SOLUTIONS: Record<string, { solution: string; explanation: string }> = {
  'contract-bgn-openapi-01': { solution: 'maps: products→ProductListResponse, slug→Product, categories→CategoryListResponse, cart→CartResponse, checkout→OrderDetail; dangling: ProductList, Ordr', explanation: 'Every mapping resolves through components/schemas. The two dangling refs never resolve — integrity checked, not assumed.' },
  'contract-bgn-required-01': { solution: 'selection: assert-amountCents-required', explanation: 'Required is presence — the only failure here is absence.' },
  'contract-bgn-types-01': { solution: 'selection: assert-amountCents-type; payload: amountCents as a JSON number (integer)', explanation: 'The type assertion fires on the string; the corrected payload passes clean.' },
  'contract-bgn-formats-01': { solution: 'selection: assert-createdAt-format, assert-customerEmail-format', explanation: 'Two formats, two assertions — grammar for strings, not eyeballing.' },
  'contract-bgn-enum-01': { solution: 'selection: assert-status-enum, enum-posted-pending-reversed', explanation: 'IN_STOCK is not a member — casing is vocabulary.' },
  'contract-bgn-status-01': { solution: 'selection: products 200, checkout 201, token 201, cancel 200, slug 404, checkout-invalid 400', explanation: 'Documented clean-mode codes are the contract; 204 belongs to the bug hunt.' },
  'contract-bgn-contenttype-01': { solution: 'selection: violation-text-plain, rule-media-type', explanation: 'Media type is the parser’s contract — text/plain breaks it.' },
  'contract-bgn-live-products-01': { solution: 'selection: pin-priceCents-integer, pin-stockStatus-enum, pin-currency-const', explanation: 'Money, stock and currency — the three invariants that break builds.' },
  'contract-int-nested-01': { solution: 'selection: assert-items-1-quantity-minimum; payload: OrderDetail with items[1].quantity = 1', explanation: 'Index the pointer literally; element 1 violates minimum: 1.' },
  'contract-int-request-01': { solution: 'selection: assert-amountCents-minimum, assert-entryId-required', explanation: 'Below the bound and absent — two lies, two assertions.' },
  'contract-int-response-01': { solution: 'selection: assert-createdAt-required', explanation: 'Omission is the failure — required names it.' },
  'contract-int-const-01': { solution: 'selection: assert-currency-const, assert-debug-additionalProperties', explanation: 'Exact casing on the const; admission refused on the closed schema.' },
  'contract-int-constraints-01': { solution: 'selection: assert-amountCents-minimum, assert-entryId-pattern, assert-merchant-minLength, assert-clientRef-maxLength', explanation: 'minimum, pattern, minLength, maxLength — four keywords, four failures (maxLength on clientRef).' },
  'contract-int-refs-01': { solution: 'selection: ref-list-to-entry, ref-entry-status, ref-error-chain', explanation: 'Local $refs terminate at LedgerEntry, the enum and the LEDG pattern.' },
  'contract-int-nullable-01': { solution: 'selection: stmt-null-valid, stmt-absent-valid, stmt-number-invalid', explanation: 'Type array admits null; absence is governed by required, not by null; integers are neither.' },
  'contract-int-compare-additive-01': { solution: 'classifications: finding-memo compatible, finding-status review', explanation: 'R4 for additions; R9 review for enum widenings — every time.' },
  'contract-int-compare-enum-01': { solution: 'classifications: finding-status review; choices: reason-closed-switch', explanation: 'Review because of the closed switches — they are the consumers at risk.' },
  'contract-adv-breaking-req-01': { solution: 'classifications: finding-clientRequestId breaking; choices: reason-client-break', explanation: 'R1 — required addition on the request side breaks the fleet first.' },
  'contract-adv-breaking-type-01': { solution: 'classifications: finding-type breaking, finding-pattern review, finding-minimum breaking', explanation: 'R6, R19, R13 — the type break, the pattern hedge, the relaxed bound.' },
  'contract-adv-breaking-remove-01': { solution: 'classifications: finding-settledAt breaking, finding-enum breaking', explanation: 'R3 removal, R8 narrowing — absence and removal, two breaking classes.' },
  'contract-adv-consumer-expect-01': { solution: 'expectation: required slug/name/priceCents/currency/stockStatus; integer priceCents, const USD, enum stockStatus; open additionalProperties; C1–C7 = 100', explanation: 'Minimal, critical-field-complete, open, drift-catching — the definition of a consumer contract.' },
  'contract-adv-consumer-broken-01': { solution: 'expectation as above — it fails the drift; triage: provider-side rename (R3); keep the pin', explanation: 'The failing assertion is evidence, not a defect in the test — the provider moved the field.' },
  'contract-adv-checkout-flow-01': { solution: 'selection: all eight cap-* violation ids', explanation: 'Per-capture isolation: summary (2), request (2), detail (4).' },
  'contract-adv-versioning-01': { solution: 'classifications: finding-type breaking, finding-minimum breaking, finding-pattern review, finding-settledAt breaking, finding-enum breaking, finding-required compatible; verdict BREAKING', explanation: 'Precedence is not negotiable — one breaking finding ships BREAKING.' },
}

// --- Hunt reveals (mechanism + fix, never just the answer) ------------------
const HUNT_REVEALS: Record<string, { solution: string; explanation: string }> = {
  'hunt-contract-001': {
    solution: 'finding assertion: /stockStatus (required)',
    explanation: 'The documented product schema requires stockStatus — validate the capture and read the assertion; the vanished property names itself.',
  },
  'hunt-contract-002': {
    solution: 'finding assertion: /priceCents (type — "2400" is not an integer)',
    explanation: 'JS-tolerant consumers keep rendering; the type contract does not. The validator says which field and why.',
  },
  'hunt-contract-003': {
    solution: 'finding assertion: /stockStatus (enum — IN_STOCK outside the documented vocabulary)',
    explanation: 'The enum is case-sensitive. Validate the capture; the enum assertion names the field and the refused value.',
  },
  'hunt-contract-004': {
    solution: 'status line 204 vs documented 200; empty body vs documented OrderDetail',
    explanation: 'Status is contractual. The cancel contract documents 200 + OrderDetail — 204 with an empty body breaks every client that awaits the detail.',
  },
  'hunt-contract-005': {
    solution: 'finding assertion: supplierCostCents (additionalProperties: false)',
    explanation: 'Additive on the wire breaks closed readers. Strict consumers reject the entire payload — the undocumented field is named by the validator.',
  },
  'hunt-contract-006': {
    solution: 'finding assertions: /createdAt (type) and /createdAt (format)',
    explanation: 'Epoch seconds are neither the documented type nor the documented format — both assertions fire on the same field.',
  },
  'hunt-contract-007': {
    solution: 'finding assertions: /categoryName (required) and /stockStatus (enum) — provider-side drift (R3)',
    explanation: 'Your expectation failed because the provider renamed and re-cased its fields. Exit the hunt and verification passes again — the alias resolves back to the additive fixture. The fix is provider-side: restore the documented contract or coordinate a version boundary.',
  },
}

export const CONTRACT_REVEALS: Record<string, ContractRevealDefinition> = Object.fromEntries(
  Object.entries(EXERCISE_REVEALS).map(([id, core]) => {
    const exercise = EXERCISE_SOLUTIONS[id]
    if (id.startsWith('hunt-contract-')) {
      const hunt = HUNT_REVEALS[id]
      return [id, { ...core, solution: hunt.solution, explanation: hunt.explanation }]
    }
    return [id, { ...core, solution: exercise?.solution ?? '', explanation: exercise?.explanation ?? '' }]
  }),
) as Record<string, ContractRevealDefinition>

/** Lookup used by the reveal routes; null for unknown ids. */
export function contractRevealDefinition(id: string): ContractRevealDefinition | null {
  return CONTRACT_REVEALS[id] ?? null
}
