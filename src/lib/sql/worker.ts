// SQL Web Worker — the only place learner SQL is ever executed.
//
// The worker owns an in-memory sql.js database. The main thread sends the
// canonical seed text on reset; nothing else from the outside arrives here
// except SQL text. If the main thread stops hearing back, it terminates this
// worker outright (plan §6.3) — the wasm cage is the security boundary.

/// <reference lib="webworker" />

import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { SQL_LIMITS, type SchemaInfo, type SqlRunOutput } from '../../shared/sql'
import { applyResultPayloadCap, openDatabase, type EngineDatabase } from './engine'
import { splitStatements } from './statements'
import type { WorkerRequest, WorkerResponse } from './protocol'

let db: EngineDatabase | null = null
let wasmBytes: Uint8Array | null = null

async function ensureWasmBytes(): Promise<Uint8Array> {
  if (wasmBytes) return wasmBytes
  const response = await fetch(wasmUrl)
  if (!response.ok) {
    throw new Error(`Failed to load the SQLite engine (HTTP ${response.status}).`)
  }
  wasmBytes = new Uint8Array(await response.arrayBuffer())
  return wasmBytes
}

function post(message: WorkerResponse): void {
  const scope = self as unknown as DedicatedWorkerGlobalScope
  scope.postMessage(message)
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  try {
    switch (message.type) {
      case 'reset': {
        const bytes = await ensureWasmBytes()
        if (db) {
          db.close()
          db = null
        }
        const fresh = await openDatabase(bytes)
        if (message.seedSql.trim().length > 0) {
          fresh.execAll(message.seedSql)
        }
        // Optional bug-hunt corruption delta — applied after the canonical
        // seed and never persisted; the delta carries its own FK handling.
        if (message.deltaSql && message.deltaSql.trim().length > 0) {
          fresh.execAll(message.deltaSql)
        }
        db = fresh
        const schema = db.schema()
        post({ id: message.id, type: 'ready', sqliteVersion: db.sqliteVersion(), schema })
        return
      }
      case 'run': {
        if (!db) {
          post({ id: message.id, type: 'error', kind: 'not-ready', message: 'The practice database is not ready yet. Try again in a moment.' })
          return
        }
        const started = Date.now()
        // Defense in depth: the main thread pre-flights; the worker re-checks.
        const statements = splitStatements(message.sql)
        if (statements.length > SQL_LIMITS.maxStatementsPerRun) {
          const output: SqlRunOutput = {
            ok: false,
            resultSets: [],
            elapsedMs: Date.now() - started,
            error: { statementIndex: -1, message: `Too many statements — at most ${SQL_LIMITS.maxStatementsPerRun} per run.` },
          }
          post({ id: message.id, type: 'result', output })
          return
        }
        const output = db.execAll(message.sql)
        applyResultPayloadCap(output)
        post({ id: message.id, type: 'result', output })
        return
      }
      case 'schema': {
        if (!db) {
          post({ id: message.id, type: 'error', kind: 'not-ready', message: 'The practice database is not ready yet.' })
          return
        }
        const schema: SchemaInfo = db.schema()
        post({ id: message.id, type: 'schema', schema })
        return
      }
      case 'close': {
        if (db) {
          db.close()
          db = null
        }
        post({ id: message.id, type: 'closed' })
        return
      }
    }
  } catch (err) {
    post({
      id: message.id,
      type: 'error',
      kind: 'internal',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
