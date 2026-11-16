// Message protocol between the main thread (client.ts) and the SQL Web Worker
// (worker.ts). Both sides import these types; nothing crosses the network.

import type { SchemaInfo, SqlRunOutput } from '../../shared/sql'

export type WorkerRequest =
  | { id: number; type: 'reset'; seedSql: string }
  | { id: number; type: 'run'; sql: string }
  | { id: number; type: 'schema' }
  | { id: number; type: 'close' }

export type WorkerResponse =
  | { id: number; type: 'ready'; sqliteVersion: string; schema: SchemaInfo }
  | { id: number; type: 'result'; output: SqlRunOutput }
  | {
      id: number
      type: 'schema'
      schema: SchemaInfo
    }
  | { id: number; type: 'closed' }
  | { id: number; type: 'error'; kind: 'internal' | 'not-ready'; message: string }

/** Discriminator helpers for tests and the client. */
export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (typeof value !== 'object' || value === null) return false
  const r = value as { id?: unknown; type?: unknown }
  return typeof r.id === 'number' && typeof r.type === 'string'
}
