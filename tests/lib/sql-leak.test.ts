// SQL lab leak lint (Phase 6 M2, plan §12.1, extends the P4/P5 family).
// Scans every client-shipped source file for corruption literals, expected
// specification figures and imports of server-only modules. The bundle adds
// one more gate at build time (grep dist/assets in the verification log).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function collect(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collect(full))
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const CLIENT_DIRS = ['src/pages', 'src/features', 'src/components', 'src/data', 'src/lib'].map((d) =>
  join(ROOT, d),
)
const CLIENT_FILES = CLIENT_DIRS.flatMap(collect)

const FORBIDDEN_CORRUPTION_LITERALS = [
  '950001',
  '950002',
  '950101',
  '950102',
  '950103',
  '7777',
  '8888',
  'Obsolete Dome Tent',
  'Vaporshell Bivy Sack',
  'Morgan.Whitlock@example.com',
  'morgan.whitlock@example.com',
  '50777',
  'id = 8148',
  'quantity = 25 WHERE product_id = 30',
  'quantity = 3 WHERE product_id = 20',
  'order_id = 5133',
]

const FORBIDDEN_EXPECTED_FIGURES = [
  '15901850', // gross order cents
  '633662',   // June 2026 revenue cents
  '788919',   // stale-pipeline amount at risk
  '435472',   // cancelled-order approved payments
  '3767100',  // window-09 revenue cents for Driftline Gravel Frameset
  '8539313',  // bronze tier revenue cents
]

const SERVER_ONLY_IMPORTS = [
  'server/sqlSeedDelta',
  'server/sqlReveals',
  'server/sqlHints',
  'server/sqlExercises',
  'server/sqlEvaluate',
  'sqlSeedDelta',
  'sqlReveals',
  'sqlEvaluate',
]

const corpus = CLIENT_FILES.map((file) => [file, readFileSync(file, 'utf8')] as const)

describe('client sources carry no corruption literals', () => {
  it.each(FORBIDDEN_CORRUPTION_LITERALS)('no client file contains %s', (token) => {
    for (const [file, text] of corpus) {
      expect(
        text.includes(token),
        `${relative(ROOT, file)} leaks the corruption literal "${token}"`,
      ).toBe(false)
    }
  })
})

describe('client sources carry no expected-specification figures', () => {
  it.each(FORBIDDEN_EXPECTED_FIGURES)('no client file contains the figure %s', (token) => {
    for (const [file, text] of corpus) {
      expect(
        text.includes(token),
        `${relative(ROOT, file)} leaks the expected figure "${token}"`,
      ).toBe(false)
    }
  })
})

describe('client sources never import server-only SQL registries', () => {
  it.each(SERVER_ONLY_IMPORTS)('no client file imports %s', (token) => {
    const pattern = new RegExp(`(?:from\\s+|import\\s*\\()\\s*['"][^'"]*${token}['"]`)
    for (const [file, text] of corpus) {
      expect(
        pattern.test(text),
        `${relative(ROOT, file)} imports the server-only module "${token}"`,
      ).toBe(false)
    }
  })
})

describe('client sources never import anything under src/server', () => {
  it('no import path reaches src/server from client code', () => {
    const pattern = /from\s+['"][^'"]*\/server\//
    for (const [file, text] of corpus) {
      expect(pattern.test(text), `${relative(ROOT, file)} imports from src/server`).toBe(false)
    }
  })
})

describe('hint and reveal content stays out of the client corpus', () => {
  it('no hint/reveal phrasing appears verbatim in client code', () => {
    // Distinctive phrases from the server-only registries.
    const phrases = [
      'the precise condition to test — one step from the answer',
      'hint ladder is enforced',
      'Recompute each from first principles — price times quantity',
    ]
    for (const [file, text] of corpus) {
      for (const phrase of phrases) {
        expect(text.includes(phrase), `${relative(ROOT, file)} leaks hint/reveal phrasing`).toBe(false)
      }
    }
  })
})
