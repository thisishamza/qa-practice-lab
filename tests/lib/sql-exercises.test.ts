// SQL exercise registry integrity + the 36/36 reference-solution gate
// (plan §7.1, §12.1–§12.2). Every shipped solution is executed against the
// canonical snapshot (+ exercise setupSql) and must pass its own evaluator
// with a perfect score. Drift between seed, solution and spec fails loudly.
import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  applyResultPayloadCap,
  openDatabase,
} from '../../src/lib/sql/engine'
import { SQL_EXERCISES as CLIENT_EXERCISES, SQL_EXERCISE_COUNT } from '../../src/data/sqlExercises'
import { SQL_EXERCISES as SERVER_EXERCISES, findSqlExercise, requireSqlExercise } from '../../src/server/sqlExercises'
import { evaluateSubmission } from '../../src/server/sqlEvaluate'
import type { SqlEvaluateCell } from '../../src/shared/sql'
import { SQL_LIMITS } from '../../src/shared/sql'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEED_PATH = join(ROOT, 'public', 'datasets', 'meridian-outfitters.sql')
const WASM_PATH = join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

let seedSql: string
let wasmBytes: Uint8Array

beforeAll(() => {
  seedSql = readFileSync(SEED_PATH, 'utf8')
  wasmBytes = new Uint8Array(readFileSync(WASM_PATH))
})

describe('exercise registry — shape and coverage matrix', () => {
  it('ships exactly 36 exercises', () => {
    expect(CLIENT_EXERCISES).toHaveLength(36)
    expect(SERVER_EXERCISES).toHaveLength(36)
    expect(SQL_EXERCISE_COUNT).toBe(36)
  })

  it('holds the contractual difficulty distribution: 12 beginner, 13 intermediate, 11 advanced', () => {
    const counts = { beginner: 0, intermediate: 0, advanced: 0 } as Record<string, number>
    for (const exercise of CLIENT_EXERCISES) {
      counts[exercise.difficulty] += 1
    }
    expect(counts).toEqual({ beginner: 12, intermediate: 13, advanced: 11 })
  })

  it('uses unique, pattern-clean, level-prefixed ids', () => {
    const ids = CLIENT_EXERCISES.map((exercise) => exercise.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const exercise of CLIENT_EXERCISES) {
      expect(exercise.id).toMatch(/^sql-(bgn|int|adv)-[a-z0-9-]+-\d{2}$/)
      const prefix = exercise.id.split('-')[1]
      expect(({ bgn: 'beginner', int: 'intermediate', adv: 'advanced' } as const)[prefix as 'bgn']).toBe(exercise.difficulty)
    }
  })

  it('tags exactly the 13 QA scenario carriers (SQL-QA-01..13) and only those', () => {
    const qa = CLIENT_EXERCISES.filter((exercise) => exercise.kind === 'qa')
    expect(qa.map((exercise) => exercise.qaId).sort()).toEqual(
      Array.from({ length: 13 }, (_, i) => `SQL-QA-${String(i + 1).padStart(2, '0')}`),
    )
    for (const exercise of CLIENT_EXERCISES) {
      if (exercise.kind === 'qa') {
        expect(exercise.qaId).toMatch(/^SQL-QA-\d{2}$/)
      } else {
        expect(exercise.qaId).toBeUndefined()
      }
    }
  })

  it('keeps client and server registries aligned id-for-id with matching difficulty', () => {
    const clientById = new Map(CLIENT_EXERCISES.map((exercise) => [exercise.id, exercise]))
    const serverById = new Map(SERVER_EXERCISES.map((exercise) => [exercise.id, exercise]))
    expect([...clientById.keys()].sort()).toEqual([...serverById.keys()].sort())
    for (const [id, client] of clientById) {
      expect(serverById.get(id)?.difficulty).toBe(client.difficulty)
    }
  })

  it('gives every exercise a learner-facing scenario, task, objective, tables, constraints, evidence and guide', () => {
    for (const exercise of CLIENT_EXERCISES) {
      expect(exercise.qaScenario.length).toBeGreaterThan(40)
      expect(exercise.objective.length).toBeGreaterThan(20)
      expect(exercise.task.length).toBeGreaterThan(20)
      expect(exercise.tables.length).toBeGreaterThan(0)
      expect(exercise.relevantConstraints.length).toBeGreaterThan(0)
      expect(exercise.exampleEvidence.length).toBeGreaterThan(10)
      expect(exercise.relatedGuideIds).toContain('guide-database-testing-sql')
      expect(exercise.estimatedMinutes).toBeGreaterThan(0)
      expect(exercise.summary.length).toBeGreaterThan(10)
    }
  })

  it('declares checkSql exactly on the DML/transaction/constraint/index exercises and nothing else', () => {
    const withCheck = CLIENT_EXERCISES.filter((exercise) => exercise.checkSql).map((exercise) => exercise.id).sort()
    expect(withCheck).toEqual(
      [
        'sql-adv-index-05',
        'sql-adv-txn-01',
        'sql-int-delete-13',
        'sql-int-insert-11',
        'sql-int-update-12',
      ].sort(),
    )
  })

  it('every setup SQL runs cleanly on top of the canonical snapshot', async () => {
    for (const exercise of CLIENT_EXERCISES) {
      if (!exercise.setupSql) continue
      const db = await openDatabase(wasmBytes)
      db.execAll(seedSql)
      const out = db.execAll(exercise.setupSql)
      expect(out.ok, `${exercise.id} setup failed: ${out.error?.message ?? ''}`).toBe(true)
      db.close()
    }
  })
})

/** Run a reference solution (plus its post-state check) against a fresh snapshot. */
async function runExercise(
  client: (typeof CLIENT_EXERCISES)[number],
): Promise<{ columns: string[]; rows: SqlEvaluateCell[][]; truncated: boolean }> {
  const db = await openDatabase(wasmBytes)
  db.execAll(seedSql)
  if (client.setupSql) {
    db.execAll(client.setupSql)
  }
  const server = requireSqlExercise(client.id)
  db.execAll(server.solution)
  const source = client.checkSql ?? server.solution
  const out = db.execAll(source)
  expect(out.ok, `${client.id} failed to execute: ${out.error?.message ?? ''}`).toBe(true)
  const sets = out.resultSets.filter((set) => set.columns.length > 0)
  const last = sets[sets.length - 1]
  expect(last, `${client.id} produced no row-returning result set`).toBeDefined()
  applyResultPayloadCap(out)
  db.close()
  return { columns: last.columns, rows: last.rows, truncated: last.truncated }
}

describe('exercise registry — reference solutions pass their own evaluators', () => {
  const cases = CLIENT_EXERCISES.map((exercise) => [exercise.id, exercise] as const)
  it.each(cases)('%s — solution passes with a perfect score', async (_id, exercise) => {
    const server = findSqlExercise(exercise.id)
    expect(server, 'server registry must carry the exercise').not.toBeNull()
    const envelope = await runExercise(exercise)
    const verdict = evaluateSubmission(server!.expected, envelope)
    expect(verdict.passed, `${exercise.id} failed: ${verdict.feedback}`).toBe(true)
    expect(verdict.score, `${exercise.id} score`).toBe(100)
  })
})

describe('exercise registry — evaluator rejects plausible wrong answers', () => {
  it.each([
    ['sql-bgn-where-02', `SELECT id, name, price_cents FROM products WHERE category_id = 3`],
    ['sql-bgn-orderby-03', `SELECT order_number, placed_at, total_cents FROM orders ORDER BY placed_at ASC LIMIT 5`],
    ['sql-int-groupby-01', `SELECT order_number, total_cents FROM orders WHERE total_cents <> subtotal_cents + shipping_cents + tax_cents`],
    ['sql-int-join-03', `SELECT p.provider_ref, o.order_number, p.amount_cents, o.total_cents FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.status = 'refunded' AND p.amount_cents <> o.total_cents`],
    ['sql-adv-dedup-11', `SELECT email, count(*) AS copies FROM customers GROUP BY email HAVING count(*) > 1`],
  ] as const)('%s — an incorrect query does not pass', async (id, wrongSql) => {
    const exercise = CLIENT_EXERCISES.find((entry) => entry.id === id)!
    const server = requireSqlExercise(id)
    const db = await openDatabase(wasmBytes)
    db.execAll(seedSql)
    if (exercise.setupSql) db.execAll(exercise.setupSql)
    db.execAll(wrongSql)
    const source = exercise.checkSql ?? wrongSql
    const out = db.execAll(source)
    const sets = out.resultSets.filter((set) => set.columns.length > 0)
    const last = sets[sets.length - 1]
    const verdict = evaluateSubmission(server.expected, {
      columns: last?.columns ?? [],
      rows: last?.rows ?? [],
      truncated: false,
    })
    expect(verdict.passed).toBe(false)
    db.close()
  })

  it('empty result sets never pass', () => {
    const server = requireSqlExercise('sql-bgn-select-01')
    const verdict = evaluateSubmission(server.expected, { columns: ['slug', 'name'], rows: [], truncated: false })
    expect(verdict.passed).toBe(false)
    expect(verdict.score).toBeLessThan(SQL_LIMITS.maxRowsPerStatement)
  })
})
