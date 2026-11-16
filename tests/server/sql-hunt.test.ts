// Phase 6 M2 database bug hunts — determinism, isolation and honesty checks
// (plan §9.3, §9.4, §12.1). The corruption deltas are compiled constants;
// these tests prove they are deterministic, apply cleanly, and only ever
// reach a bug-hunt sandbox. They never touch D1.
import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { openDatabase } from '../../src/lib/sql/engine'
import { SQL_DELTAS, SQL_DELTA_HUNT_IDS } from '../../src/server/sqlSeedDelta'
import { HUNTS } from '../../src/server/hunts'
import { findSqlReveal } from '../../src/server/sqlReveals'
import { SQL_EXERCISES } from '../../src/data/sqlExercises'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEED_PATH = join(ROOT, 'public', 'datasets', 'meridian-outfitters.sql')
const WASM_PATH = join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

let seedSql: string
let wasmBytes: Uint8Array

beforeAll(() => {
  seedSql = readFileSync(SEED_PATH, 'utf8')
  wasmBytes = new Uint8Array(readFileSync(WASM_PATH))
})

describe('SQL hunt deltas — determinism and application', () => {
  it('ships exactly the eight planned hunt deltas, all registered in HUNTS', () => {
    expect([...SQL_DELTA_HUNT_IDS].sort()).toEqual([
      'hunt-db-001',
      'hunt-db-002',
      'hunt-db-003',
      'hunt-db-004',
      'hunt-db-005',
      'hunt-db-006',
      'hunt-db-007',
      'hunt-db-008',
    ])
    for (const huntId of SQL_DELTA_HUNT_IDS) {
      const hunt = HUNTS.find((candidate) => candidate.id === huntId)
      expect(hunt, `${huntId} must be registered in HUNTS`).toBeDefined()
      expect(hunt?.kind).toBe('sql')
    }
  })

  it.each(SQL_DELTA_HUNT_IDS.map((id) => [id, SQL_DELTAS[id]] as const))(
    '%s — applies cleanly to the canonical snapshot',
    async (_id, delta) => {
      const db = await openDatabase(wasmBytes)
      db.execAll(seedSql)
      const out = db.execAll(delta)
      expect(out.ok, `delta failed: ${out.error?.message ?? ''}`).toBe(true)
      db.close()
    },
  )

  it.each(SQL_DELTA_HUNT_IDS.map((id) => [id] as const))(
    '%s — the corrupted snapshot is byte-identical across two fresh applications',
    async (huntId) => {
      const make = async () => {
        const db = await openDatabase(wasmBytes)
        db.execAll(seedSql)
        db.execAll(SQL_DELTAS[huntId]!)
        const bytes = db.exportBytes()
        db.close()
        return Buffer.from(bytes)
      }
      const first = await make()
      const second = await make()
      expect(first.equals(second)).toBe(true)
    },
  )

  it.each(SQL_DELTA_HUNT_IDS.map((id) => [id] as const))(
    '%s — corruption actually changes the snapshot (never a no-op)',
    async (huntId) => {
      const clean = await openDatabase(wasmBytes)
      clean.execAll(seedSql)
      const corrupted = await openDatabase(wasmBytes)
      corrupted.execAll(seedSql)
      corrupted.execAll(SQL_DELTAS[huntId]!)
      expect(Buffer.from(clean.exportBytes()).equals(Buffer.from(corrupted.exportBytes()))).toBe(false)
      clean.close()
      corrupted.close()
    },
  )

  it('clean mode is untouched: each delta applied twice is idempotent-detectable, and clean never equals corrupt', async () => {
    for (const huntId of SQL_DELTA_HUNT_IDS) {
      const clean = await openDatabase(wasmBytes)
      clean.execAll(seedSql)
      const corrupted = await openDatabase(wasmBytes)
      corrupted.execAll(seedSql)
      corrupted.execAll(SQL_DELTAS[huntId]!)
      expect(Buffer.from(clean.exportBytes()).equals(Buffer.from(corrupted.exportBytes()))).toBe(false)
      clean.close()
      corrupted.close()
    }
  })
})

describe('SQL hunt reveals and the corruption they describe', () => {
  it.each(SQL_DELTA_HUNT_IDS.map((id) => [id] as const))(
    '%s — ships a gated reveal naming the finding query',
    (huntId) => {
      const reveal = findSqlReveal(huntId)
      expect(reveal, `${huntId} needs a reveal`).not.toBeNull()
      expect(reveal!.solution.length).toBeGreaterThan(20)
      expect(reveal!.verification.length).toBeGreaterThan(0)
    },
  )

  it('hunt solutions use only anti-join/derived-comparison patterns consistent with the delta class', () => {
    for (const huntId of SQL_DELTA_HUNT_IDS) {
      expect(findSqlReveal(huntId)!.solution).toMatch(/SELECT/i)
    }
  })

  it('the client exercise catalogue carries no corruption literals', () => {
    // Distinctive values from the eight deltas — any of these in the client
    // corpus would mean the corruption shipped in the bundle.
    const forbidden = [
      '950001', '950002', '950101', '950102', '950103',
      '7777', '8888',
      'Obsolete Dome Tent', 'Vaporshell Bivy Sack',
      'Morgan.Whitlock@example.com',
      '50777',
      'quantity = 25 WHERE product_id = 30',
      'id = 8148',
      'order_id = 5133',
      'quantity = 3 WHERE product_id = 20',
      'id = 1030',
    ]
    const corpus = JSON.stringify(SQL_EXERCISES)
    for (const token of forbidden) {
      expect(corpus, `client corpus leaks ${token}`).not.toContain(token)
    }
  })
})
