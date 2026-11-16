// Main-thread client for the SQL worker.
//
// Responsibilities: spawn/terminate the worker, correlate requests by id,
// enforce the 3-second wall-clock budget (plan §6.3) by terminating the
// worker outright, reseed automatically after a timeout, and drop stale
// responses from terminated workers. Learner SQL never leaves the worker.

import { SQL_LIMITS, type SchemaInfo, type SqlRunOutput } from '../../shared/sql'
import { isWorkerResponse, type WorkerRequest, type WorkerResponse } from './protocol'

/** Distributive Omit — preserves the request union. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type WorkerRequestBody = DistributiveOmit<WorkerRequest, 'id'>

export type RunOutcome =
  | { kind: 'ok'; output: SqlRunOutput }
  /** Worker exceeded the wall-clock budget and was terminated + reseeded. */
  | { kind: 'timeout'; elapsedMs: number }

interface Pending {
  resolve: (value: WorkerResponse) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout> | null
}

export class SqlClient {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private id = 0
  private seedSql: string | null = null
  private disposed = false
  sqliteVersion: string | null = null

  /** Create (or recreate) the worker and load the canonical seed database. */
  async reset(seedSql: string): Promise<SchemaInfo> {
    this.assertNotDisposed()
    this.seedSql = seedSql
    const worker = this.spawn()
    const response = await this.requestOn(worker, { type: 'reset', seedSql }, null)
    if (response.type !== 'ready') {
      throw new Error('Unexpected response while loading the practice database.')
    }
    this.sqliteVersion = response.sqliteVersion
    return response.schema
  }

  /** Execute a batch of SQL. On wall-clock overrun the worker is terminated + reseeded. */
  async run(sql: string): Promise<RunOutcome> {
    this.assertNotDisposed()
    const worker = this.worker
    if (!worker) {
      throw new Error('The practice database is not loaded yet.')
    }
    const started = Date.now()

    return new Promise<RunOutcome>((resolve, reject) => {
      let settled = false
      let timedOut = false

      const finish = (outcome: RunOutcome | null, error?: Error): void => {
        if (settled) return
        settled = true
        if (error) reject(error)
        else resolve(outcome as RunOutcome)
      }

      const timer = setTimeout(() => {
        timedOut = true
        // Kill the runaway worker immediately; pending entries get rejected.
        this.teardownWorker(worker)
      }, SQL_LIMITS.runTimeoutMs)

      this.requestOn(worker, { type: 'run', sql }, timer)
        .then((response) => {
          if (response.type === 'result') {
            finish({ kind: 'ok', output: response.output })
            return
          }
          if (response.type === 'error') {
            finish({
              kind: 'ok',
              output: {
                ok: false,
                resultSets: [],
                elapsedMs: Date.now() - started,
                error: { statementIndex: -1, message: response.message },
              },
            })
            return
          }
          finish(null, new Error('Unexpected response while running the query.'))
        })
        .catch(() => {
          if (timedOut) {
            // Reseed after the terminate; resolve timeout once recovery completes.
            void (async () => {
              try {
                if (this.seedSql !== null) {
                  await this.reset(this.seedSql)
                }
              } catch {
                // Timeout is surfaced regardless; the caller reseeds on its own.
              } finally {
                finish({ kind: 'timeout', elapsedMs: Date.now() - started })
              }
            })()
            return
          }
          finish(null, new Error('The practice database was reset unexpectedly.'))
        })
    })
  }

  /** Fresh schema for the explorer (cheap; called after every Run). */
  async schema(): Promise<SchemaInfo> {
    this.assertNotDisposed()
    const worker = this.worker
    if (!worker) {
      throw new Error('The practice database is not loaded yet.')
    }
    const response = await this.requestOn(worker, { type: 'schema' }, null)
    if (response.type !== 'schema') {
      throw new Error('Unexpected response while reading the schema.')
    }
    return response.schema
  }

  /** Terminate the worker and reject all pending requests. */
  dispose(): void {
    this.disposed = true
    this.teardownWorker(this.worker)
  }

  // -- internals -----------------------------------------------------------

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('This SQL session has been closed.')
    }
  }

  private spawn(): Worker {
    this.teardownWorker(this.worker)
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(event.data)
    }
    worker.onerror = (event) => {
      event.preventDefault()
      if (this.worker === worker) {
        this.teardownWorker(worker)
      }
    }
    this.worker = worker
    return worker
  }

  private teardownWorker(worker: Worker | null): void {
    if (!worker) return
    if (this.worker === worker) {
      this.worker = null
    }
    worker.terminate()
    // A single worker is ever active; every pending entry belongs to it.
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer)
      pending.reject(new Error('The practice database was reset.'))
    }
    this.pending.clear()
  }

  private requestOn(
    worker: Worker,
    message: WorkerRequestBody,
    timer: ReturnType<typeof setTimeout> | null,
  ): Promise<WorkerResponse> {
    const id = this.id + 1
    this.id = id
    const full = { ...message, id } as WorkerRequest
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => {
          if (timer) clearTimeout(timer)
          resolve(value)
        },
        reject: (reason: Error) => {
          if (timer) clearTimeout(timer)
          reject(reason)
        },
        timer,
      })
      worker.postMessage(full)
    })
  }

  private handleMessage(data: unknown): void {
    if (!isWorkerResponse(data)) return // foreign/stale message shape
    const pending = this.pending.get(data.id)
    if (!pending) return // response from a terminated worker — drop it
    this.pending.delete(data.id)
    if (pending.timer) clearTimeout(pending.timer)
    pending.resolve(data)
  }
}
