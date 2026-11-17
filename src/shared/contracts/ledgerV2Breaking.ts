// Ledger v2.0.0 — BREAKING release (plan §4.3): `settledAt` removed
// (R3), `status` enum narrowed — `pending` removed (R8), and `amountCents`
// changed integer → string (R6). Multi-finding specimen used by the
// adv compare exercises and the compatibility review.

import { LEDGER_V1_SCHEMA } from './ledgerV1'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const v2 = deepClone(LEDGER_V1_SCHEMA) as unknown as {
  title: string
  components: { schemas: Record<string, Record<string, unknown> & { properties: Record<string, unknown>; required?: string[] }> }
}

v2.title = 'Meridian Ledger API v2.0.0'

const entry = v2.components.schemas.LedgerEntry
const entryRequired = entry.required ?? []
delete entry.properties.settledAt
entry.required = entryRequired.filter((name: string) => name !== 'settledAt')
entry.properties.status = { enum: ['posted', 'reversed'] }
entry.properties.amountCents = { type: 'string', pattern: '^[0-9]+$' }

export const LEDGER_V2_BREAKING_SCHEMA = v2 as Record<string, unknown>
