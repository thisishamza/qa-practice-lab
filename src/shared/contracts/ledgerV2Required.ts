// Ledger v2.1.0 — REQUEST-SIDE BREAKING change (plan §4.3):
// CreateEntryRequest gains required `clientRequestId` (string, minLength 1).
// Previously absent. This is the R1 specimen — previously valid requests
// are rejected.

import { LEDGER_V1_SCHEMA } from './ledgerV1'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const v2 = deepClone(LEDGER_V1_SCHEMA) as unknown as {
  title: string
  components: { schemas: Record<string, Record<string, unknown> & { properties: Record<string, unknown>; required?: string[] }> }
}

v2.title = 'Meridian Ledger API v2.1.0'

const request = v2.components.schemas.CreateEntryRequest
const requestRequired = request.required ?? []
request.required = [...requestRequired, 'clientRequestId']
request.properties.clientRequestId = { type: 'string', minLength: 1, maxLength: 64 }

export const LEDGER_V2_REQUIRED_SCHEMA = v2 as Record<string, unknown>
