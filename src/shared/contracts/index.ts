// Fixture registry (Phase 7, plan §4.3) — client-safe. Single-sourced:
// the browser workspaces and the server endpoints import the same
// modules. Fixture *ids* are learner-visible by design; fixture content
// carries no secrets. The hunt-007 drift is NOT here (server-only,
// src/server/contractDeltas.ts).

export {
  LEDGER_V1_SCHEMA,
  LEDGER_V1_ENTRY_EXAMPLE,
  LEDGER_V1_LIST_EXAMPLE,
  LEDGER_V1_CREATE_EXAMPLE,
} from './ledgerV1'
export { LEDGER_V2_COMPATIBLE_SCHEMA, LEDGER_V2_COMPATIBLE_ENTRY_EXAMPLE } from './ledgerV2Compatible'
export { LEDGER_V2_BREAKING_SCHEMA } from './ledgerV2Breaking'
export { LEDGER_V2_REQUIRED_SCHEMA } from './ledgerV2Required'
export {
  PROVIDER_PRODUCT_V1_PAYLOAD,
  PROVIDER_PRODUCT_V2_COMPATIBLE_PAYLOAD,
  PROVIDER_PRODUCT_CRITICAL_FIELDS,
  PROVIDER_PRODUCT_V1_SCHEMA,
} from './providerProduct'
export {
  CHECKOUT_FLOW_SCHEMA,
  CHECKOUT_SUMMARY_CAPTURE,
  CHECKOUT_REQUEST_CAPTURE,
  ORDER_DETAIL_CAPTURE,
} from './checkoutFlow'

import { LEDGER_V1_SCHEMA } from './ledgerV1'
import { LEDGER_V2_COMPATIBLE_SCHEMA } from './ledgerV2Compatible'
import { LEDGER_V2_BREAKING_SCHEMA } from './ledgerV2Breaking'
import { LEDGER_V2_REQUIRED_SCHEMA } from './ledgerV2Required'
import { CHECKOUT_FLOW_SCHEMA } from './checkoutFlow'

export interface ContractFixture {
  id: string
  /** Learner-facing label. */
  label: string
  /** The top-level schema document for the fixture. */
  schema: Record<string, unknown>
  /** Whether the fixture models a request or a response (both = 'both'). */
  locus: 'request' | 'response' | 'both'
  /** Named operation schemas the validate workspace can target. */
  operations: readonly { id: string; label: string }[]
}

export const CONTRACT_FIXTURES: readonly ContractFixture[] = [
  {
    id: 'ledger-v1',
    label: 'Meridian Ledger v1.0.0',
    schema: LEDGER_V1_SCHEMA as unknown as Record<string, unknown>,
    locus: 'both',
    operations: [
      { id: 'LedgerEntry', label: 'LedgerEntry' },
      { id: 'EntryListResponse', label: 'EntryListResponse' },
      { id: 'CreateEntryRequest', label: 'CreateEntryRequest' },
    ],
  },
  {
    id: 'ledger-v2-compatible',
    label: 'Meridian Ledger v2.0.0 (compatible)',
    schema: LEDGER_V2_COMPATIBLE_SCHEMA,
    locus: 'both',
    operations: [
      { id: 'LedgerEntry', label: 'LedgerEntry' },
      { id: 'EntryListResponse', label: 'EntryListResponse' },
      { id: 'CreateEntryRequest', label: 'CreateEntryRequest' },
    ],
  },
  {
    id: 'ledger-v2-breaking',
    label: 'Meridian Ledger v2.0.0 (breaking)',
    schema: LEDGER_V2_BREAKING_SCHEMA,
    locus: 'both',
    operations: [
      { id: 'LedgerEntry', label: 'LedgerEntry' },
      { id: 'EntryListResponse', label: 'EntryListResponse' },
      { id: 'CreateEntryRequest', label: 'CreateEntryRequest' },
    ],
  },
  {
    id: 'ledger-v2-required',
    label: 'Meridian Ledger v2.1.0 (new required field)',
    schema: LEDGER_V2_REQUIRED_SCHEMA,
    locus: 'both',
    operations: [
      { id: 'CreateEntryRequest', label: 'CreateEntryRequest' },
    ],
  },
  {
    id: 'checkout-flow',
    label: 'Checkout flow (summary → request → detail)',
    schema: CHECKOUT_FLOW_SCHEMA as unknown as Record<string, unknown>,
    locus: 'both',
    operations: [
      { id: 'CheckoutSummary', label: 'CheckoutSummary' },
      { id: 'CheckoutRequest', label: 'CheckoutRequest' },
      { id: 'OrderDetail', label: 'OrderDetail' },
    ],
  },
] as const

const FIXTURE_MAP = new Map(CONTRACT_FIXTURES.map((fixture) => [fixture.id, fixture]))

export function findContractFixture(id: string): ContractFixture | null {
  return FIXTURE_MAP.get(id) ?? null
}

/**
 * Resolve a fixture + named operation to the concrete schema document to
 * compile. The returned document is the fixture with the named operation
 * selected as the root (`$ref`), so every sibling stays reachable —
 * `normalizeSchema` dereferences both hops in order.
 */
export function fixtureOperationSchema(
  fixtureId: string,
  operationId: string | undefined,
): { schema: Record<string, unknown>; label: string } | null {
  const fixture = findContractFixture(fixtureId)
  if (!fixture) {
    return null
  }
  const target = operationId ?? fixture.operations[0]?.id
  if (!target) {
    return null
  }
  if (!fixture.operations.some((op) => op.id === target)) {
    return null
  }
  const components = (fixture.schema.components as Record<string, unknown> | undefined)?.schemas
  if (!isPlainObject(components) || !isPlainObject(components[target])) {
    return null
  }
  return {
    schema: { ...fixture.schema, $ref: `#/components/schemas/${target}` },
    label: target,
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
