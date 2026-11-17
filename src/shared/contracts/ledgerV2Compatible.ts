// Ledger v2.0.0 — COMPATIBLE release (plan §4.3): additive optional
// `memo` on LedgerEntry (R4) + `status` enum widened with `scheduled`
// (R9 — always review, never silently compatible). No constraint
// relaxation: any response-side bound loosening would be R13-breaking,
// which is what the breaking fixture demonstrates.

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
entry.properties.memo = { type: 'string', maxLength: 200 }
entry.properties.status = { enum: ['posted', 'pending', 'reversed', 'scheduled'] }

export const LEDGER_V2_COMPATIBLE_SCHEMA = v2 as Record<string, unknown>

export const LEDGER_V2_COMPATIBLE_ENTRY_EXAMPLE = {
  entryId: 'LE-4M5N6P7Q',
  amountCents: 8750,
  currency: 'USD',
  direction: 'debit',
  status: 'scheduled',
  merchant: 'Fernhill Provisions',
  postedAt: '2026-11-15T08:00:00Z',
  settledAt: null,
  memo: 'Weekly supplier settlement',
} as const
