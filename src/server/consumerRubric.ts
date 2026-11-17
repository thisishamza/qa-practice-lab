// Consumer rubric (Phase 7, plan §4.5.2) — server-only, deterministic,
// 100 points. Scores a learner's expectation (a JSON Schema 2020-12)
// against the provider-product-v1 fixture and the server-only drifted
// payload. The expectation is data; nothing is compiled or executed.
//
//   C1 (10)  expectation parses and compiles as 2020-12
//   C2 (25)  requires every consumer-critical field (5 pts each)
//   C3 (15)  requires NO non-critical field — minimalism (−5 per extra)
//   C4 (20)  types of critical fields match the provider schema (4 pts each)
//   C5 (10)  additionalProperties absent or true (open contract)
//   C6 (10)  expectation passes the provider v1 canned payload
//   C7 (10)  expectation FAILS the drifted payload (catches the drift)
//
// Pass ≥ 70. Canonical failure modes cannot award full marks: `{}` fails
// C2/C7; the full provider clone fails C3; `additionalProperties: false`
// fails C5.

import {
  PROVIDER_PRODUCT_CRITICAL_FIELDS,
  PROVIDER_PRODUCT_V1_PAYLOAD,
  PROVIDER_PRODUCT_V1_SCHEMA,
} from '../shared/contracts/providerProduct'
import { compileSchema, validatePayload, ContractValidationError } from '../shared/contractValidation'
import { CONTRACT_DRIFT_PAYLOAD } from './contractDeltas'

export interface ConsumerRubricCheck {
  id: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7'
  passed: boolean
  points: number
  maxPoints: number
  message: string
}

export interface ConsumerRubricResult {
  score: number
  passed: boolean
  checks: ConsumerRubricCheck[]
  feedback: string
}

export const CONSUMER_RUBRIC_PASS_SCORE = 70

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function typeNames(typeValue: unknown): Set<string> {
  const names = new Set<string>()
  if (typeof typeValue === 'string') names.add(typeValue)
  if (Array.isArray(typeValue)) {
    for (const item of typeValue) {
      if (typeof item === 'string') names.add(item)
    }
  }
  return names
}

/** Does the expectation's declared type for one critical field match the provider's? */
function criticalFieldTypeMatches(
  expectationField: Record<string, unknown>,
  providerField: Record<string, unknown>,
): boolean {
  // const / enum compatibility — the expectation must agree with the vocabulary.
  if (providerField.const !== undefined) {
    if (expectationField.const !== undefined) {
      return expectationField.const === providerField.const
    }
    if (Array.isArray(expectationField.enum)) {
      return expectationField.enum.includes(providerField.const)
    }
    if (expectationField.type !== undefined) {
      return typeNames(expectationField.type).has('string')
    }
    return false
  }
  if (Array.isArray(providerField.enum)) {
    if (expectationField.const !== undefined) {
      return (providerField.enum as unknown[]).includes(expectationField.const)
    }
    if (Array.isArray(expectationField.enum)) {
      const providerSet = new Set((providerField.enum as unknown[]).map((value) => JSON.stringify(value)))
      return (expectationField.enum as unknown[]).every((value) => providerSet.has(JSON.stringify(value)))
    }
    return expectationField.type === undefined
  }
  // Type compatibility: the expectation may name the exact provider type,
  // or a broader superset that still admits every provider value
  // (integer ⊂ number).
  const providerTypes = typeNames(providerField.type)
  const expectationTypes = typeNames(expectationField.type)
  if (expectationTypes.size === 0) {
    return false
  }
  for (const needed of expectationTypes) {
    if (providerTypes.has(needed)) continue
    if (needed === 'number' && providerTypes.has('integer')) continue
    return false
  }
  return true
}

/**
 * The full platform `Product` domain — a "full pin" expectation requires
 * every one of these (the whole API contract, not the consumer's slice).
 */
const PROVIDER_DOMAIN_FIELDS = [
  'id',
  'slug',
  'name',
  'description',
  'categorySlug',
  'categoryName',
  'priceCents',
  'currency',
  'stockStatus',
] as const

/** Does the expectation pin the entire platform domain? */
function pinsFullDomain(required: readonly string[]): boolean {
  const requiredSet = new Set(required)
  return PROVIDER_DOMAIN_FIELDS.every((field) => requiredSet.has(field))
}

export function scoreConsumerExpectation(expectation: unknown): ConsumerRubricResult {
  const checks: ConsumerRubricCheck[] = []
  const critical = PROVIDER_PRODUCT_CRITICAL_FIELDS as readonly string[]

  // --- C1: expectation parses and compiles as 2020-12 -----------------------
  let compileError: ContractValidationError | null = null
  try {
    compileSchema(expectation)
  } catch (error) {
    compileError =
      error instanceof ContractValidationError
        ? error
        : new ContractValidationError('invalid_schema', String(error))
  }
  const c1Passed = compileError === null
  checks.push({
    id: 'C1',
    passed: c1Passed,
    points: c1Passed ? 10 : 0,
    maxPoints: 10,
    message: c1Passed
      ? 'Expectation compiles as JSON Schema 2020-12.'
      : `Expectation is not a valid 2020-12 schema: ${compileError?.message ?? 'unparseable schema'}`,
  })

  if (!c1Passed) {
    const notScored = [
      ['C2', 25],
      ['C3', 15],
      ['C4', 20],
      ['C5', 10],
      ['C6', 10],
      ['C7', 10],
    ] as const
    for (const [id, maxPoints] of notScored) {
      checks.push({
        id,
        passed: false,
        points: 0,
        maxPoints,
        message: 'Not scored — the expectation does not compile (C1 failed).',
      })
    }
    return finalize(checks) // full-fail path: no gates apply
  }

  const expectationSchema = expectation as Record<string, unknown>
  const requiredValue = expectationSchema.required
  const required = Array.isArray(requiredValue)
    ? requiredValue.filter((item): item is string => typeof item === 'string')
    : []
  const properties = isPlainObject(expectationSchema.properties) ? expectationSchema.properties : {}
  const providerCriticalSchemas = PROVIDER_PRODUCT_V1_SCHEMA.properties as unknown as Record<
    string,
    Record<string, unknown>
  >

  // --- C2: requires every consumer-critical field ----------------------------
  const missingCritical = critical.filter((field) => !required.includes(field))
  const c2Points = Math.max(0, 25 - missingCritical.length * 5)
  checks.push({
    id: 'C2',
    passed: missingCritical.length === 0,
    points: c2Points,
    maxPoints: 25,
    message:
      missingCritical.length === 0
        ? 'Requires every consumer-critical field.'
        : `Missing critical requirement(s): ${missingCritical.join(', ')}.`,
  })

  // --- C3: minimalism — no non-critical requirements -------------------------
  const criticalSet = new Set<string>(critical)
  const extras = required.filter((field) => !criticalSet.has(field))
  const c3Points = Math.max(0, 15 - extras.length * 5)
  checks.push({
    id: 'C3',
    passed: extras.length === 0,
    points: c3Points,
    maxPoints: 15,
    message:
      extras.length === 0
        ? 'No non-critical fields are required — the contract is minimal.'
        : `Requires non-critical field(s): ${extras.join(', ')} — providers may change or drop those freely.`,
  })

  // --- C4: critical field types match the provider schema --------------------
  let c4Points = 0
  const c4Messages: string[] = []
  for (const field of critical) {
    const expectationField = isPlainObject(properties[field]) ? properties[field] : null
    const providerField = isPlainObject(providerCriticalSchemas[field])
      ? providerCriticalSchemas[field]
      : null
    if (!expectationField || !providerField) {
      c4Messages.push(`${field}: not declared in \`properties\``)
      continue
    }
    if (criticalFieldTypeMatches(expectationField, providerField)) {
      c4Points += 4
      continue
    }
    c4Messages.push(`${field}: type/vocabulary mismatch with the provider schema`)
  }
  checks.push({
    id: 'C4',
    passed: c4Points === 20,
    points: c4Points,
    maxPoints: 20,
    message:
      c4Points === 20
        ? 'Critical field types/vocabulary match the provider schema.'
        : c4Messages.join('; ') || 'Some critical fields are missing from `properties`.',
  })

  // --- C5: open contract ------------------------------------------------------
  const additional = expectationSchema.additionalProperties
  const c5Passed = additional === undefined || additional === true
  checks.push({
    id: 'C5',
    passed: c5Passed,
    points: c5Passed ? 10 : 0,
    maxPoints: 10,
    message: c5Passed
      ? 'Contract is open (additionalProperties absent or true).'
      : 'additionalProperties: false makes the contract closed — providers cannot add fields freely.',
  })

  // --- C6: expectation passes the provider v1 canned payload ------------------
  const v1Assertions = validatePayload(expectation, PROVIDER_PRODUCT_V1_PAYLOAD)
  const c6Passed = v1Assertions.length === 0
  const firstV1 = v1Assertions[0]
  checks.push({
    id: 'C6',
    passed: c6Passed,
    points: c6Passed ? 10 : 0,
    maxPoints: 10,
    message: c6Passed
      ? 'Expectation passes the provider v1 canned payload.'
      : `Expectation rejects the provider v1 payload: ${firstV1.path} (${firstV1.keyword})`,
  })

  // --- C7: expectation fails the drifted payload ------------------------------
  const driftAssertions = validatePayload(expectation, CONTRACT_DRIFT_PAYLOAD)
  const c7Passed = driftAssertions.length > 0
  checks.push({
    id: 'C7',
    passed: c7Passed,
    points: c7Passed ? 10 : 0,
    maxPoints: 10,
    message: c7Passed
      ? 'Expectation fails the drifted payload — it catches the drift.'
      : 'Expectation passes the drifted payload — a vacuous contract proves nothing.',
  })

  return finalizeGates(checks, { extras, critical, required, additional })
}

/**
 * Gate logic (deviation D-P7-1, recorded in the Phase 7 exit audit): the
 * plan's C3=15/C5=10 weights alone cannot sink the two canonical wrong
 * answers below the 70 pass line, so two explicit gates cap the score.
 * All point values stay exactly as the plan specifies them; the caps fire
 * only for the two failure modes the exercise exists to teach:
 *   1. Full pin — requires EVERY provider field (9 of 9): the contract is
 *      the whole API, not the consumer's slice → cap at 60 (rejected by C3).
 *   2. Closed contract — `additionalProperties: false`: providers cannot
 *      add fields freely → cap at 65 (rejected by C5).
 */
function finalizeGates(
  checks: ConsumerRubricCheck[],
  context: {
    extras: string[]
    critical: readonly string[]
    required: string[]
    additional: unknown
  },
): ConsumerRubricResult {
  const fullPin = pinsFullDomain(context.required)
  const closed = context.additional === false

  if (fullPin) {
    const c3 = checks.find((check) => check.id === 'C3')
    if (c3) {
      c3.passed = false
      c3.points = 0
      c3.message = `Pins all ${PROVIDER_DOMAIN_FIELDS.length} provider fields — the contract must cover only what this consumer reads.`
    }
  }
  if (closed) {
    const c5 = checks.find((check) => check.id === 'C5')
    if (c5) {
      c5.passed = false
      c5.points = 0
    }
  }

  let raw = checks.reduce((sum, check) => sum + check.points, 0)
  if (fullPin) raw = Math.min(raw, 60)
  if (closed) raw = Math.min(raw, 65)
  return finalize(checks, raw)
}

function finalize(checks: ConsumerRubricCheck[], rawOverride?: number): ConsumerRubricResult {
  const raw = rawOverride ?? checks.reduce((sum, check) => sum + check.points, 0)
  const score = Math.max(0, Math.min(100, raw))
  const passed = score >= CONSUMER_RUBRIC_PASS_SCORE
  const failed = checks.filter((check) => !check.passed)
  const feedback = passed
    ? 'Passed. The expectation is minimal, critical-field-complete and catches the provider drift.'
    : failed.map((check) => check.message).join(' ')
  return { score, passed, checks, feedback }
}
