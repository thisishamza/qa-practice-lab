// Contract-lab leak lint (Phase 7, extends the P4/P5/P6 family).
// Scans every client-shipped source file for server-only material:
// defect ids, the bug-hunt delta markers, reference-answer language from
// the server-only reveal registry, and imports of server-only modules.
// The production bundle gets one more gate at build time (grep dist/).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

import { DEFECTS } from '../../src/server/defects'
import { CONTRACT_REVEALS } from '../../src/server/contractReveals'
import { CONTRACT_HINTS } from '../../src/server/contractHints'
import { CONTRACT_SERVER_EXERCISES } from '../../src/server/contractExercises'
import { CONTRACT_EXERCISES } from '../../src/data/contractExercises'

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

const CLIENT_DIRS = ['src/pages', 'src/features', 'src/components', 'src/data', 'src/lib', 'src/styles'].map((d) =>
  join(ROOT, d),
)
const CLIENT_FILES = CLIENT_DIRS.flatMap(collect)
const corpus = CLIENT_FILES.map((file) => [file, readFileSync(file, 'utf8')] as const)

describe('CONTRACT defect ids stay out of client-shipped sources', () => {
  it.each(DEFECTS.map((defect) => defect.id))('no client file contains %s', (token) => {
    for (const [, text] of corpus) {
      expect(text.includes(token), `client source leaks ${token}`).toBe(false)
    }
  })
})

describe('the drifted payload never reaches the client', () => {
  it('no client file contains the drifted payload composition', () => {
    // The drift = category rename (categoryName → category) + stockStatus
    // re-casing. Client-safe exercise content may name the FIELDS, but the
    // drifted payload's literal composition must not exist client-side.
    const forbidden = ['"IN_STOCK","category"', '"category":"Camping"', '"category": "Camping"']
    for (const token of forbidden) {
      for (const [file, text] of corpus) {
        expect(text.includes(token), `${relative(ROOT, file)} leaks the drift literal`).toBe(false)
      }
    }
  })
})

describe('reveal solutions and hint text stay out of client-shipped sources', () => {
  it.each(Object.entries(CONTRACT_REVEALS).map(([id, reveal]) => [id, reveal.solution] as const))(
    'no client file contains the reveal solution for %s',
    (id, solution) => {
      const distinctive = solution.slice(0, 48)
      for (const [file, text] of corpus) {
        expect(
          text.includes(distinctive),
          `${relative(ROOT, file)} leaks the reveal solution for ${id}`,
        ).toBe(false)
      }
    },
  )

  it('no hint text appears verbatim in client code', () => {
    const phrases = Object.values(CONTRACT_HINTS)
      .flatMap((hints) => [hints.level1, hints.level2, hints.level3])
      .filter((text) => text.length > 60)
      .map((text) => text.slice(0, 48))
    for (const phrase of phrases) {
      for (const [, text] of corpus) {
        expect(text.includes(phrase), `client source leaks hint text: ${phrase.slice(0, 40)}`).toBe(false)
      }
    }
  })
})

// Answer tokens derived from the server-only rubrics — never hardcoded
// literals. Anything an exercise grades against must not appear in its
// client-shipped exampleEvidence, or the brief hands the answer over.
const RULE_ID = /\bR(?:[1-9]|1[0-9]|2[01])\b/

function expectedAnswerTokens(exerciseId: string): string[] {
  const server = CONTRACT_SERVER_EXERCISES.find((exercise) => exercise.id === exerciseId)
  if (!server) {
    return []
  }
  const tokens: string[] = []
  const evaluation = server.evaluation
  if (evaluation.family === 'selections') {
    tokens.push(...evaluation.expected)
  } else if (evaluation.family === 'validate') {
    tokens.push(...evaluation.expectedSelections)
  } else if (evaluation.family === 'compare') {
    tokens.push(...Object.keys(evaluation.expectedClassifications))
    if (evaluation.expectedChoices) {
      tokens.push(...Object.keys(evaluation.expectedChoices))
    }
  }
  return tokens
}

function expectedVerdictSequences(exerciseId: string): string[] {
  const server = CONTRACT_SERVER_EXERCISES.find((exercise) => exercise.id === exerciseId)
  if (!server || server.evaluation.family !== 'compare') {
    return []
  }
  const values = Object.values(server.evaluation.expectedClassifications)
  if (values.length < 2) {
    return []
  }
  return [values.join(', ').toLowerCase()]
}

describe('exampleEvidence never discloses the graded answer', () => {
  it('the server registry resolves all 24 exercises and derives tokens for every graded family', () => {
    expect(CONTRACT_EXERCISES).toHaveLength(24)
    for (const exercise of CONTRACT_EXERCISES) {
      const server = CONTRACT_SERVER_EXERCISES.find((candidate) => candidate.id === exercise.id)
      expect(server, exercise.id).not.toBeUndefined()
      if (server && server.evaluation.family !== 'consumer') {
        expect(expectedAnswerTokens(exercise.id).length, exercise.id).toBeGreaterThan(0)
      }
    }
  })

  it.each(CONTRACT_EXERCISES.map((exercise) => [exercise.id, exercise] as const))(
    '%s exampleEvidence contains no expected selection/finding ids, verdict sequences or rule ids',
    (_id, exercise) => {
      const evidence = exercise.exampleEvidence.toLowerCase()
      for (const token of expectedAnswerTokens(exercise.id)) {
        expect(
          evidence.includes(token.toLowerCase()),
          `${exercise.id} exampleEvidence contains answer token "${token}"`,
        ).toBe(false)
      }
      for (const sequence of expectedVerdictSequences(exercise.id)) {
        expect(
          evidence.includes(sequence),
          `${exercise.id} exampleEvidence contains the verdict sequence "${sequence}"`,
        ).toBe(false)
      }
      expect(
        RULE_ID.test(exercise.exampleEvidence),
        `${exercise.id} exampleEvidence cites a rule id`,
      ).toBe(false)
    },
  )
})

describe('client code never imports server-only contract modules', () => {
  it.each([
    'server/contractExercises',
    'server/contractReveals',
    'server/contractHints',
    'server/consumerRubric',
    'server/contractDeltas',
    'server/contractRubrics',
    'contractDeltas',
    'consumerRubric',
  ])('no client file imports %s', (token) => {
    const pattern = new RegExp(`(?:from\\s+|import\\s*\\()\\s*['"][^'"]*${token}['"]`)
    for (const [file, text] of corpus) {
      expect(pattern.test(text), `${relative(ROOT, file)} imports the server-only module "${token}"`).toBe(false)
    }
  })

  it('no import path reaches src/server from client code', () => {
    const pattern = /from\s+['"][^'"]*\/server\//
    for (const [file, text] of corpus) {
      expect(pattern.test(text), `${relative(ROOT, file)} imports from src/server`).toBe(false)
    }
  })
})
