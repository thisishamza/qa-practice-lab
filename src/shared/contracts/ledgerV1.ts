// Meridian Ledger API v1.0.0 fixtures (Phase 7, plan §4.3) — fictional
// payments sibling service. CLIENT-SAFE: bundled into browser workspaces.
// The v2-* modules are the pairwise diff baselines; the provider-product
// modules back the consumer/provider capability.
//
// All payloads shipped here are VALID against their schemas (fixture
// integrity is test-enforced). Broken payloads are constructed in tests
// by mutation, never committed.

export const LEDGER_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Meridian Ledger API v1.0.0',
  type: 'object',
  components: {
    schemas: {
      LedgerEntry: {
        type: 'object',
        additionalProperties: false,
        required: [
          'entryId',
          'amountCents',
          'currency',
          'direction',
          'status',
          'merchant',
          'postedAt',
          'settledAt',
        ],
        properties: {
          entryId: { type: 'string', pattern: '^LE-[0-9A-Z]{8}$' },
          amountCents: { type: 'integer', minimum: 0 },
          currency: { const: 'USD' },
          direction: { enum: ['debit', 'credit'] },
          status: { enum: ['posted', 'pending', 'reversed'] },
          merchant: { type: 'string', minLength: 1, maxLength: 80 },
          postedAt: { type: 'string', format: 'date-time' },
          settledAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      EntryListResponse: {
        type: 'object',
        additionalProperties: false,
        required: ['data', 'total'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/LedgerEntry' },
          },
          total: { type: 'integer', minimum: 0 },
        },
      },
      CreateEntryRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['entryId', 'amountCents', 'currency', 'direction', 'merchant', 'postedAt'],
        properties: {
          entryId: { type: 'string', pattern: '^LE-[0-9A-Z]{8}$' },
          amountCents: { type: 'integer', minimum: 0 },
          currency: { const: 'USD' },
          direction: { enum: ['debit', 'credit'] },
          merchant: { type: 'string', minLength: 1, maxLength: 80 },
          postedAt: { type: 'string', format: 'date-time' },
          clientRef: { type: 'string', minLength: 1, maxLength: 64 },
          settledAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', pattern: '^LEDG-[0-9]{3}$' },
          message: { type: 'string', minLength: 1 },
        },
      },
    },
  },
} as const

export const LEDGER_V1_ENTRY_EXAMPLE = {
  entryId: 'LE-0A1B2C3D',
  amountCents: 4250,
  currency: 'USD',
  direction: 'debit',
  status: 'posted',
  merchant: 'Ridgeline Outfitters',
  postedAt: '2026-11-10T00:00:00Z',
  settledAt: '2026-11-11T00:00:00Z',
} as const

export const LEDGER_V1_LIST_EXAMPLE = {
  data: [LEDGER_V1_ENTRY_EXAMPLE],
  total: 1,
} as const

export const LEDGER_V1_CREATE_EXAMPLE = {
  entryId: 'LE-9Z8Y7X6W',
  amountCents: 12500,
  currency: 'USD',
  direction: 'credit',
  merchant: 'Meridian Ledger Settlement',
  postedAt: '2026-11-12T09:30:00Z',
} as const

export type LedgerFixtureId = 'ledger-v1' | 'ledger-v2-compatible' | 'ledger-v2-breaking' | 'ledger-v2-required'

export interface LedgerFixture {
  id: LedgerFixtureId
  /** Display label for pickers. */
  label: string
  schema: Record<string, unknown>
  /** The schema a learner actually validates payloads against (the named operation). */
  operationSchemaId: 'LedgerEntry' | 'EntryListResponse' | 'CreateEntryRequest'
  example: Record<string, unknown>
}
