// Worker-boundary tests with a mocked Worker (plan §12.1): reset lifecycle,
// run correlation, timeout terminate + reseed, stale-response drops, dispose.
// The real 3-second budget is enforced in the browser; here the timer is
// driven by fake timers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SqlClient } from '../../src/lib/sql/client'
import { SQL_LIMITS } from '../../src/shared/sql'

interface SentMessage {
  id: number
  type: string
  [key: string]: unknown
}

class MockWorker {
  static instances: MockWorker[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: { message?: string; preventDefault?: () => void }) => void) | null = null
  sent: SentMessage[] = []
  terminated = false

  constructor() {
    MockWorker.instances.push(this)
  }

  postMessage(message: SentMessage): void {
    this.sent.push(structuredClone(message))
  }

  terminate(): void {
    this.terminated = true
  }

  respond(data: Record<string, unknown>): void {
    this.onmessage?.({ data })
  }

  lastIdFor(type: string): number | undefined {
    const match = [...this.sent].reverse().find((message) => message.type === type)
    return match?.id
  }

  static latest(): MockWorker {
    const worker = MockWorker.instances[MockWorker.instances.length - 1]
    if (!worker) throw new Error('no mock worker spawned')
    return worker
  }
}

const fakeSchema = { tables: [], sqliteVersion: '3.54.1' }

beforeEach(() => {
  MockWorker.instances = []
  vi.stubGlobal('Worker', MockWorker)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('SqlClient', () => {
  it('resets, reports the schema and sqlite version', async () => {
    const client = new SqlClient()
    const resetPromise = client.reset('SEED SQL')
    const worker = MockWorker.latest()
    worker.respond({ id: worker.lastIdFor('reset'), type: 'ready', sqliteVersion: '3.54.1', schema: fakeSchema })
    const schema = await resetPromise
    expect(schema.sqliteVersion).toBe('3.54.1')
    expect(client.sqliteVersion).toBe('3.54.1')
    expect(worker.sent[0]).toMatchObject({ type: 'reset', seedSql: 'SEED SQL' })
    client.dispose()
  })

  it('runs a query and correlates the response by id', async () => {
    const client = new SqlClient()
    const resetPromise = client.reset('SEED SQL')
    MockWorker.latest().respond({ id: 1, type: 'ready', sqliteVersion: '3.54.1', schema: fakeSchema })
    await resetPromise

    const runPromise = client.run('SELECT 1')
    const worker = MockWorker.latest()
    const runId = worker.lastIdFor('run')
    worker.respond({
      id: runId,
      type: 'result',
      output: { ok: true, resultSets: [], elapsedMs: 2, error: null },
    })
    const outcome = await runPromise
    expect(outcome.kind).toBe('ok')
    client.dispose()
  })

  it('drops responses with unknown or stale ids (terminated generation)', async () => {
    const client = new SqlClient()
    const resetPromise = client.reset('SEED SQL')
    MockWorker.latest().respond({ id: 1, type: 'ready', sqliteVersion: '3.54.1', schema: fakeSchema })
    await resetPromise

    // A stale message with a bogus id must be ignored silently.
    expect(() => MockWorker.latest().respond({ id: 999, type: 'result', output: { ok: true, resultSets: [], elapsedMs: 0, error: null } })).not.toThrow()
    // A malformed message must also be ignored.
    expect(() => MockWorker.latest().respond('nonsense' as unknown as Record<string, unknown>)).not.toThrow()
    client.dispose()
  })

  it('timeout terminates the worker, reseeds and resolves with kind=timeout', async () => {
    vi.useFakeTimers()
    const client = new SqlClient()
    const resetPromise = client.reset('SEED SQL')
    const first = MockWorker.latest()
    first.respond({ id: first.lastIdFor('reset'), type: 'ready', sqliteVersion: '3.54.1', schema: fakeSchema })
    await resetPromise

    const runPromise = client.run('SELECT * FROM huge_cartesian_blowup')
    await vi.advanceTimersByTimeAsync(SQL_LIMITS.runTimeoutMs + 10)
    // Let the rejection handler and the reseed chain reach the new worker.
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)

    expect(first.terminated).toBe(true)
    const second = MockWorker.latest()
    expect(second).not.toBe(first)
    const reseed = [...second.sent].reverse().find((message) => message.type === 'reset')
    expect(reseed).toBeDefined()
    second.respond({ id: reseed?.id, type: 'ready', sqliteVersion: '3.54.1', schema: fakeSchema })

    const outcome = await runPromise
    expect(outcome.kind).toBe('timeout')
    expect(first.sent.some((message) => message.type === 'run')).toBe(true)
    client.dispose()
  })

  it('worker failure mid-flight rejects the run with a reset error', async () => {
    const client = new SqlClient()
    const resetPromise = client.reset('SEED SQL')
    MockWorker.latest().respond({ id: 1, type: 'ready', sqliteVersion: '3.54.1', schema: fakeSchema })
    await resetPromise

    const runPromise = client.run('SELECT 1')
    const assertion = expect(runPromise).rejects.toThrow(/reset/i)
    // Resetting mid-flight tears the worker down and rejects pending requests.
    const resetting = client.reset('SEED AGAIN')
    const latest = MockWorker.latest()
    latest.respond({ id: latest.lastIdFor('reset'), type: 'ready', sqliteVersion: '3.54.1', schema: fakeSchema })
    await resetting
    await assertion
    client.dispose()
  })

  it('schema before ready rejects with a clear error', async () => {
    const client = new SqlClient()
    await expect(client.schema()).rejects.toThrow(/not loaded/i)
    client.dispose()
  })
})
