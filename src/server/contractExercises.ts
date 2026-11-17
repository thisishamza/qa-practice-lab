// Server-only contract exercise registry (Phase 7, plan §4.7, §7.3) —
// CODE, not data.
//
// For every exercise: the compiled evaluation definition (selection
// fingerprints, payload schema reference, classification key map) and the
// reference answer used by the test-enforced 24/24 100-point gate. The
// client-safe twin lives in src/data/contractExercises.ts; ids are shared
// and tests keep the two aligned.
//
// Nothing here is serialized into a response before the reveal gate, and
// no expected set/fixture delta/reference answer ships to the browser.

import type { ContractExerciseKind } from '../data/contractExercises'
import { LEDGER_V1_ENTRY_EXAMPLE } from '../shared/contracts/ledgerV1'
import { ORDER_DETAIL_CAPTURE } from '../shared/contracts/checkoutFlow'

export type ContractPayloadSchemaRef = 'ledger-v1/LedgerEntry' | 'checkout-flow/OrderDetail'

export type ContractEvaluationDefinition =
  | { family: 'selections'; expected: string[] }
  | { family: 'validate'; expectedSelections: string[]; payloadSchemaRef: ContractPayloadSchemaRef }
  | { family: 'compare'; expectedClassifications: Record<string, 'breaking' | 'compatible' | 'review'>; expectedChoices?: Record<string, string> }
  | { family: 'consumer' }

export interface ContractExerciseDefinition {
  id: string
  kind: ContractExerciseKind
  evaluation: ContractEvaluationDefinition
  /** Reference answer — the deterministic 100/100 gate (test-enforced). */
  referenceAnswer: unknown
  /** Maintainer-facing explanation shipped with the gated reveal. */
  explanation: string
}

const CONSUMER_REFERENCE_EXPECTATION = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['slug', 'name', 'priceCents', 'currency', 'stockStatus'],
  properties: {
    slug: { type: 'string' },
    name: { type: 'string' },
    priceCents: { type: 'integer', minimum: 0 },
    currency: { const: 'USD' },
    stockStatus: { enum: ['in_stock', 'low_stock', 'out_of_stock'] },
  },
} as const

/** Corrected LedgerEntry used by two-stage validate exercises (amountCents as integer). */
const FIXED_LEDGER_ENTRY = {
  ...LEDGER_V1_ENTRY_EXAMPLE,
} as const

/** OrderDetail capture with items[1].quantity corrected to the documented minimum. */
const FIXED_ORDER_DETAIL = {
  ...ORDER_DETAIL_CAPTURE,
  items: [
    ORDER_DETAIL_CAPTURE.items[0],
    { ...ORDER_DETAIL_CAPTURE.items[1], quantity: 1 },
  ],
} as unknown as Record<string, unknown>

export const CONTRACT_SERVER_EXERCISES: readonly ContractExerciseDefinition[] = [
  {
    id: 'contract-bgn-openapi-01',
    kind: 'structured',
    evaluation: {
      family: 'selections',
      expected: [
        'map-products',
        'map-product-detail',
        'map-categories',
        'map-cart',
        'map-checkout',
        'ref-dangling-productlist',
        'ref-dangling-ordr',
      ],
    },
    referenceAnswer: {
      kind: 'structured',
      selections: [
        'map-products',
        'map-product-detail',
        'map-categories',
        'map-cart',
        'map-checkout',
        'ref-dangling-productlist',
        'ref-dangling-ordr',
      ],
    },
    explanation:
      'Operations resolve to components.schemas by $ref: products→ProductListResponse, product detail→Product, categories→CategoryListResponse, cart→CartResponse, checkout→OrderDetail. The two dangling refs (ProductList, Ordr) never resolve — integrity is the contract’s first job.',
  },
  {
    id: 'contract-bgn-required-01',
    kind: 'validate',
    evaluation: { family: 'selections', expected: ['assert-amountCents-required'] },
    referenceAnswer: { kind: 'validate', selections: ['assert-amountCents-required'] },
    explanation:
      'A missing required property fires the `required` keyword assertion at `/amountCents` — the payload cannot satisfy the contract, so nothing downstream is trustworthy.',
  },
  {
    id: 'contract-bgn-types-01',
    kind: 'validate',
    evaluation: {
      family: 'validate',
      expectedSelections: ['assert-amountCents-type'],
      payloadSchemaRef: 'ledger-v1/LedgerEntry',
    },
    referenceAnswer: {
      kind: 'validate',
      selections: ['assert-amountCents-type'],
      payload: FIXED_LEDGER_ENTRY,
    },
    explanation:
      'JSON carries no integer/string nuance — `amountCents: "4250"` is a string. The contract declares integer cents; the type assertion fires at `/amountCents` and the corrected payload passes clean.',
  },
  {
    id: 'contract-bgn-formats-01',
    kind: 'validate',
    evaluation: { family: 'selections', expected: ['assert-createdAt-format', 'assert-customerEmail-format'] },
    referenceAnswer: { kind: 'validate', selections: ['assert-createdAt-format', 'assert-customerEmail-format'] },
    explanation:
      'Formats are contractual. `createdAt` must be RFC 3339 / ISO-8601 date-time; `customerEmail` must parse as an email. A string that merely looks like either is a contract violation waiting for the first parser.',
  },
  {
    id: 'contract-bgn-enum-01',
    kind: 'validate',
    evaluation: { family: 'selections', expected: ['assert-status-enum', 'enum-posted-pending-reversed'] },
    referenceAnswer: { kind: 'validate', selections: ['assert-status-enum', 'enum-posted-pending-reversed'] },
    explanation:
      'Enum members are a closed vocabulary — `IN_STOCK` is not a member, casing included. The stored value and the documented value must match exactly; the valid set is posted|pending|reversed.',
  },
  {
    id: 'contract-bgn-status-01',
    kind: 'structured',
    evaluation: {
      family: 'selections',
      expected: [
        'pair-products-200',
        'pair-checkout-201',
        'pair-token-201',
        'pair-cancel-200',
        'pair-unknown-slug-404',
        'pair-checkout-invalid-400',
      ],
    },
    referenceAnswer: {
      kind: 'structured',
      selections: [
        'pair-products-200',
        'pair-checkout-201',
        'pair-token-201',
        'pair-cancel-200',
        'pair-unknown-slug-404',
        'pair-checkout-invalid-400',
      ],
    },
    explanation:
      'Clean-mode codes are contractual: 200 reads, 201 creation (checkout, token), 400 invalid_request, 404 unknown resources. The tempting 204 is the hunt defect, not the contract.',
  },
  {
    id: 'contract-bgn-contenttype-01',
    kind: 'structured',
    evaluation: { family: 'selections', expected: ['violation-text-plain', 'rule-media-type'] },
    referenceAnswer: { kind: 'structured', selections: ['violation-text-plain', 'rule-media-type'] },
    explanation:
      'Clients decide how to parse from Content-Type. A JSON body on text/plain is a parser crash waiting to happen — the media type is part of the contract.',
  },
  {
    id: 'contract-bgn-live-products-01',
    kind: 'validate',
    evaluation: {
      family: 'selections',
      expected: ['pin-priceCents-integer', 'pin-stockStatus-enum', 'pin-currency-const'],
    },
    referenceAnswer: {
      kind: 'validate',
      selections: ['pin-priceCents-integer', 'pin-stockStatus-enum', 'pin-currency-const'],
    },
    explanation:
      'The three load-bearing invariants of the products contract: priceCents integer ≥ 0, stockStatus within the enum, currency exactly USD. Everything else is descriptive; these three break builds.',
  },
  {
    id: 'contract-int-nested-01',
    kind: 'validate',
    evaluation: {
      family: 'validate',
      expectedSelections: ['assert-items-1-quantity-minimum'],
      payloadSchemaRef: 'checkout-flow/OrderDetail',
    },
    referenceAnswer: {
      kind: 'validate',
      selections: ['assert-items-1-quantity-minimum'],
      payload: FIXED_ORDER_DETAIL,
    },
    explanation:
      'The assertion path `/items/1/quantity` names element 1 and the quantity rule — nested assertions are read exactly like flat ones, just with indices. Zero quantity violates minimum: 1; the corrected capture validates.',
  },
  {
    id: 'contract-int-request-01',
    kind: 'validate',
    evaluation: {
      family: 'selections',
      expected: ['assert-amountCents-minimum', 'assert-entryId-required'],
    },
    referenceAnswer: {
      kind: 'validate',
      selections: ['assert-amountCents-minimum', 'assert-entryId-required'],
    },
    explanation:
      'Two independent lies in one payload: amountCents −50 violates minimum: 0, and entryId is absent entirely. The provider rejects on both; the contract tells you before the network does.',
  },
  {
    id: 'contract-int-response-01',
    kind: 'validate',
    evaluation: { family: 'selections', expected: ['assert-createdAt-required'] },
    referenceAnswer: { kind: 'validate', selections: ['assert-createdAt-required'] },
    explanation:
      'Omission is the hardest failure to spot by eye and the easiest for a validator: the `required` assertion fires at `/createdAt`. The rest of the payload may be flawless — this is still a broken contract.',
  },
  {
    id: 'contract-int-const-01',
    kind: 'validate',
    evaluation: {
      family: 'selections',
      expected: ['assert-currency-const', 'assert-debug-additionalProperties'],
    },
    referenceAnswer: {
      kind: 'validate',
      selections: ['assert-currency-const', 'assert-debug-additionalProperties'],
    },
    explanation:
      'USD is the only currency the platform speaks — `usd` is not USD. And `additionalProperties: false` means exactly that: `debug` never makes it onto the wire, no matter how handy it is locally.',
  },
  {
    id: 'contract-int-constraints-01',
    kind: 'validate',
    evaluation: {
      family: 'selections',
      expected: [
        'assert-amountCents-minimum',
        'assert-entryId-pattern',
        'assert-merchant-minLength',
        'assert-clientRef-maxLength',
      ],
    },
    referenceAnswer: {
      kind: 'validate',
      selections: [
        'assert-amountCents-minimum',
        'assert-entryId-pattern',
        'assert-merchant-minLength',
        'assert-clientRef-maxLength',
      ],
    },
    explanation:
      'minimum: 0 on the amount; ^LE-[0-9A-Z]{8}$ on the entryId; merchant between 1 and 80 characters. Bounds are the contract, not decoration — four assertions, four keywords.',
  },
  {
    id: 'contract-int-refs-01',
    kind: 'structured',
    evaluation: { family: 'selections', expected: ['ref-list-to-entry', 'ref-entry-status', 'ref-error-chain'] },
    referenceAnswer: { kind: 'structured', selections: ['ref-list-to-entry', 'ref-entry-status', 'ref-error-chain'] },
    explanation:
      'EntryListResponse.data.items dereferences to LedgerEntry; LedgerEntry.status is the posted|pending|reversed enum; Error.code pins the LEDG-NNN pattern. Local refs resolve inside the same document — no loader, no network.',
  },
  {
    id: 'contract-int-nullable-01',
    kind: 'validate',
    evaluation: { family: 'selections', expected: ['stmt-null-valid', 'stmt-absent-valid', 'stmt-number-invalid'] },
    referenceAnswer: { kind: 'validate', selections: ['stmt-null-valid', 'stmt-absent-valid', 'stmt-number-invalid'] },
    explanation:
      '`type: ["string","null"]` means null is a first-class value — valid. Optional (not required) means absent is fine. Integer 1763308800 is not a string and not null — it fails the type array outright.',
  },
  {
    id: 'contract-int-compare-additive-01',
    kind: 'compare',
    evaluation: {
      family: 'compare',
      expectedClassifications: { 'finding-memo': 'compatible', 'finding-status': 'review' },
    },
    referenceAnswer: {
      kind: 'compare',
      classifications: { 'finding-memo': 'compatible', 'finding-status': 'review' },
    },
    explanation:
      'Additive optional property = R4, compatible — providers ship those freely. Enum widening = R9, review — never silently compatible, because closed-set consumers exist somewhere in the fleet.',
  },
  {
    id: 'contract-int-compare-enum-01',
    kind: 'compare',
    evaluation: {
      family: 'compare',
      expectedClassifications: { 'finding-status': 'review' },
      expectedChoices: { 'finding-status': 'reason-closed-switch' },
    },
    referenceAnswer: {
      kind: 'compare',
      classifications: { 'finding-status': 'review' },
      choices: { 'finding-status': 'reason-closed-switch' },
    },
    explanation:
      'Widening is review precisely because somebody, somewhere, wrote a switch on the enum. They will hit `scheduled` with no branch and no error message — silent drop. Review exists for them, not for the provider.',
  },
  {
    id: 'contract-adv-breaking-req-01',
    kind: 'compare',
    evaluation: {
      family: 'compare',
      expectedClassifications: { 'finding-clientRequestId': 'breaking' },
      expectedChoices: { 'finding-clientRequestId': 'reason-client-break' },
    },
    referenceAnswer: {
      kind: 'compare',
      classifications: { 'finding-clientRequestId': 'breaking' },
      choices: { 'finding-clientRequestId': 'reason-client-break' },
    },
    explanation:
      'R1 on the request side: a new required property in the provider’s schema means every existing client starts 400ing. Compatible for new clients, breaking for the fleet — hence breaking.',
  },
  {
    id: 'contract-adv-breaking-type-01',
    kind: 'compare',
    evaluation: {
      family: 'compare',
      expectedClassifications: {
        'finding-type': 'breaking',
        'finding-pattern': 'review',
        'finding-minimum': 'breaking',
      },
    },
    referenceAnswer: {
      kind: 'compare',
      classifications: {
        'finding-type': 'breaking',
        'finding-pattern': 'review',
        'finding-minimum': 'breaking',
      },
    },
    explanation:
      'Integer→string is R6 breaking — money precision depends on it. The pattern addition rides as R19 review (never auto-classified). Dropping minimum: 0 on the response side is R13 breaking — values may now exceed what consumers relied on.',
  },
  {
    id: 'contract-adv-breaking-remove-01',
    kind: 'compare',
    evaluation: {
      family: 'compare',
      expectedClassifications: { 'finding-settledAt': 'breaking', 'finding-enum': 'breaking' },
    },
    referenceAnswer: {
      kind: 'compare',
      classifications: { 'finding-settledAt': 'breaking', 'finding-enum': 'breaking' },
    },
    explanation:
      'Property removal is R3 — readers get undefined where a value used to be, and nothing throws until the UI shows a blank cell. Enum narrowing is R8 — a value consumers handled can no longer appear; emitting it was the contract.',
  },
  {
    id: 'contract-adv-consumer-expect-01',
    kind: 'consumer',
    evaluation: { family: 'consumer' },
    referenceAnswer: { kind: 'consumer', expectation: CONSUMER_REFERENCE_EXPECTATION },
    explanation:
      'Minimal, critical-field-complete, open. The expectation names exactly what this consumer reads (slug, name, priceCents, currency, stockStatus), types agree with the provider, and nothing else is pinned — providers may add or drop the rest freely.',
  },
  {
    id: 'contract-adv-consumer-broken-01',
    kind: 'consumer',
    evaluation: { family: 'consumer' },
    referenceAnswer: { kind: 'consumer', expectation: CONSUMER_REFERENCE_EXPECTATION },
    explanation:
      'Against the drifted payload the expectation fails: `stockStatus` casing (enum) fires, and — because the drill expects you to pin what your consumer renders — the rename `categoryName → category` is the R3 evidence. The fix is provider-side: restore the documented field or coordinate a version boundary. Do not weaken the expectation.',
  },
  {
    id: 'contract-adv-checkout-flow-01',
    kind: 'validate',
    evaluation: {
      family: 'selections',
      expected: [
        'cap-a-unitPrice',
        'cap-a-total',
        'cap-b-email',
        'cap-b-payment',
        'cap-c-createdAt',
        'cap-c-reference',
        'cap-c-lineTotal',
        'cap-c-cancelledAt',
      ],
    },
    referenceAnswer: {
      kind: 'validate',
      selections: [
        'cap-a-unitPrice',
        'cap-a-total',
        'cap-b-email',
        'cap-b-payment',
        'cap-c-createdAt',
        'cap-c-reference',
        'cap-c-lineTotal',
        'cap-c-cancelledAt',
      ],
    },
    explanation:
      'Summary: unitPriceCents as string, negative total. Request: customerEmail magic-string, paymentSimulation neither enum member. Detail: createdAt as integer epoch, reference pattern, lineTotalCents as string, cancelledAt as integer — eight violations, three contracts, one checkout.',
  },
  {
    id: 'contract-adv-versioning-01',
    kind: 'compare',
    evaluation: {
      family: 'compare',
      expectedClassifications: {
        'finding-type': 'breaking',
        'finding-minimum': 'breaking',
        'finding-pattern': 'review',
        'finding-settledAt': 'breaking',
        'finding-enum': 'breaking',
        'finding-required': 'compatible',
      },
    },
    referenceAnswer: {
      kind: 'compare',
      classifications: {
        'finding-type': 'breaking',
        'finding-minimum': 'breaking',
        'finding-pattern': 'review',
        'finding-settledAt': 'breaking',
        'finding-enum': 'breaking',
        'finding-required': 'compatible',
      },
    },
    explanation:
      'Four breaking (type, minimum, settledAt, enum), one review (pattern), one compatible (required relaxation). Any breaking finding forces the BREAKING verdict — compatibility is not negotiable by vote count. Provider ships behind a major version boundary; consumers migrate field-by-field.',
  },
]

export const CONTRACT_SERVER_EXERCISE_IDS = CONTRACT_SERVER_EXERCISES.map((exercise) => exercise.id)

const SERVER_BY_ID = new Map(CONTRACT_SERVER_EXERCISES.map((exercise) => [exercise.id, exercise]))

export function findContractExercise(id: string): ContractExerciseDefinition | null {
  return SERVER_BY_ID.get(id) ?? null
}
