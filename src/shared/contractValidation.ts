// The single contract-validation boundary (Phase 7, plan §4.2).
//
// Framework-free, DOM-free, Node-free: the same module is imported by the
// browser workspaces and the Pages Functions server. Nothing outside this
// file touches the JSON Schema library directly, so complexity budgets are
// enforced uniformly on both planes and the library can be swapped by
// changing one file.
//
// Budgets (plan §10.2, enforced here before any schema operation):
//   schemas — ≤ 2,000 nodes, depth ≤ 16, `pattern` ≤ 256 chars, local
//             `$ref` only (≤ 32 resolution hops per chain, cycles
//             rejected), `unevaluatedProperties`/`unevaluatedItems`
//             rejected (unsupported by design).
//   payload — ≤ 5,000 nodes, depth ≤ 32 (payloads are validated, not
//             compiled, but a pathological allocation is still refused).
//   bytes   — enforced by the caller (HTTP layer 32 KB cap / fetch cap)
//             plus a post-parse node/depth recount here.
//
// `$ref` handling is manual (the library would resolve remote references
// itself, which we forbid): `normalizeSchema` dereferences local refs with
// hop/cycle guards and the *normalized* document is what gets compiled.
// The `$schema` dialect is stamped 2020-12 when absent — the platform
// document deliberately omits it, as OpenAPI 3.1 allows.
//
// Server-never-executes-learner-code: everything in here is data-in,
// verdict-out. There is no eval/new Function anywhere on the path.

import { Validator } from '@cfworker/json-schema'
import type { ContractAssertion } from './contractTypes'

export const CONTRACT_MAX_SCHEMA_NODES = 2000
export const CONTRACT_MAX_SCHEMA_DEPTH = 16
export const CONTRACT_MAX_PATTERN_LENGTH = 256
export const CONTRACT_MAX_REF_HOPS = 32
export const CONTRACT_MAX_PAYLOAD_NODES = 5000
export const CONTRACT_MAX_PAYLOAD_DEPTH = 32
export const CONTRACT_MAX_INPUT_BYTES = 24 * 1024

export type ContractInputErrorCode =
  | 'invalid_schema'
  | 'complexity_limit'
  | 'unsupported_schema'

export interface ContractCompileOptions {
  /**
   * Internal first-party documents (our own OpenAPI document, which exceeds
   * learner budgets by volume). Learner input NEVER sets this — the default
   * budgets are the security boundary.
   */
  internalDocument?: boolean
}

export class ContractValidationError extends Error {
  readonly code: ContractInputErrorCode

  constructor(code: ContractInputErrorCode, message: string) {
    super(message)
    this.name = 'ContractValidationError'
    this.code = code
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const UNSUPPORTED_SCHEMA_KEYS = ['unevaluatedProperties', 'unevaluatedItems'] as const

interface SchemaWalkState {
  nodes: number
}

/** Preflight walk: node budget, depth budget, pattern cap, remote-ref and unsupported-keyword rejection. */
function preflightSchema(node: unknown, depth: number, state: SchemaWalkState, limits: { nodes: number; depth: number }): void {
  if (state.nodes > limits.nodes) {
    throw new ContractValidationError(
      'complexity_limit',
      `The schema is larger than the ${limits.nodes}-node budget. Simplify it and try again.`,
    )
  }
  if (depth > limits.depth) {
    throw new ContractValidationError(
      'complexity_limit',
      `The schema is nested deeper than ${limits.depth} levels. Flatten it and try again.`,
    )
  }
  state.nodes += 1

  if (Array.isArray(node)) {
    for (const item of node) {
      preflightSchema(item, depth + 1, state, limits)
    }
    return
  }
  if (!isPlainObject(node)) {
    return
  }

  for (const key of Object.keys(node)) {
    if ((UNSUPPORTED_SCHEMA_KEYS as readonly string[]).includes(key)) {
      throw new ContractValidationError(
        'unsupported_schema',
        `\`${key}\` is not supported by this validator subset. Remove it from the schema.`,
      )
    }
  }

  const pattern = node.pattern
  if (typeof pattern === 'string' && pattern.length > CONTRACT_MAX_PATTERN_LENGTH) {
    throw new ContractValidationError(
      'complexity_limit',
      `A \`pattern\` longer than ${CONTRACT_MAX_PATTERN_LENGTH} characters is not allowed.`,
    )
  }

  const ref = node.$ref
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !(ref === '#' || ref.startsWith('#/'))) {
      throw new ContractValidationError(
        'invalid_schema',
        'Only local `$ref` pointers (starting with `#/`) are allowed — remote or absolute references are refused.',
      )
    }
  }

  for (const value of Object.values(node)) {
    preflightSchema(value, depth + 1, state, limits)
  }
}

/** Reject payloads bigger than the node/depth budget (data-in, verdict-out guard). */
export function assertPayloadBudget(payload: unknown): void {
  const state: SchemaWalkState = { nodes: 0 }
  assertPayloadWalk(payload, 0, state)
}

function assertPayloadWalk(node: unknown, depth: number, state: SchemaWalkState): void {
  state.nodes += 1
  if (state.nodes > CONTRACT_MAX_PAYLOAD_NODES) {
    throw new ContractValidationError(
      'complexity_limit',
      `The payload is larger than the ${CONTRACT_MAX_PAYLOAD_NODES}-node budget.`,
    )
  }
  if (depth > CONTRACT_MAX_PAYLOAD_DEPTH) {
    throw new ContractValidationError(
      'complexity_limit',
      `The payload is nested deeper than ${CONTRACT_MAX_PAYLOAD_DEPTH} levels.`,
    )
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      assertPayloadWalk(item, depth + 1, state)
    }
    return
  }
  if (isPlainObject(node)) {
    for (const value of Object.values(node)) {
      assertPayloadWalk(value, depth + 1, state)
    }
  }
}

function unescapePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~')
}

function resolvePointer(doc: Record<string, unknown>, ref: string): unknown {
  if (ref === '#') {
    return doc
  }
  const segments = ref
    .slice(2)
    .split('/')
    .map((segment) => unescapePointerSegment(segment))
  let current: unknown = doc
  for (const segment of segments) {
    if (!isPlainObject(current) && !Array.isArray(current)) {
      throw new ContractValidationError('invalid_schema', `Unresolvable local \`$ref\`: ${ref}`)
    }
    current = (current as Record<string, unknown>)[segment]
    if (current === undefined) {
      throw new ContractValidationError('invalid_schema', `Unresolvable local \`$ref\`: ${ref}`)
    }
  }
  return current
}

/**
 * Preflight + dereference. Returns a schema with no local `$ref` pointers,
 * safe to hand to the library compiler. Hops are capped per resolution
 * chain and the dereferenced node budget is re-checked before return.
 */
export function normalizeSchema(
  schema: unknown,
  options: ContractCompileOptions = {},
): Record<string, unknown> {
  if (!isPlainObject(schema)) {
    throw new ContractValidationError('invalid_schema', 'A schema must be a JSON object.')
  }
  const limits = options.internalDocument
    ? { nodes: 100_000, depth: 64 }
    : { nodes: CONTRACT_MAX_SCHEMA_NODES, depth: CONTRACT_MAX_SCHEMA_DEPTH }
  preflightSchema(schema, 0, { nodes: 0 }, limits)
  const root = schema

  const deref = (node: unknown, chain: readonly string[], budget: SchemaWalkState): unknown => {
    budget.nodes += 1
    if (budget.nodes > limits.nodes) {
      throw new ContractValidationError(
        'complexity_limit',
        `The schema expands past the ${limits.nodes}-node budget after \`$ref\` resolution.`,
      )
    }
    if (Array.isArray(node)) {
      return node.map((item) => deref(item, chain, budget))
    }
    if (!isPlainObject(node)) {
      return node
    }
    const ref = node.$ref
    if (typeof ref === 'string') {
      if (chain.length >= CONTRACT_MAX_REF_HOPS) {
        throw new ContractValidationError(
          'complexity_limit',
          `\`$ref\` resolution exceeded ${CONTRACT_MAX_REF_HOPS} hops — the reference chain is too deep or cyclic.`,
        )
      }
      if (chain.includes(ref)) {
        throw new ContractValidationError(
          'invalid_schema',
          `Cyclic local \`$ref\` detected at ${ref}.`,
        )
      }
      const target = resolvePointer(root, ref)
      return deref(target, [...chain, ref], budget)
    }
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      out[key] = deref(value, chain, budget)
    }
    return out
  }

  const normalized = deref(root, [], { nodes: 0 }) as Record<string, unknown>
  if (normalized.$schema === undefined) {
    normalized.$schema = 'https://json-schema.org/draft/2020-12/schema'
  }
  return normalized
}

/** Preflight a schema without dereferencing (cheap guard for tooling paths). */
export function preflightSchemaOrThrow(schema: unknown): void {
  if (!isPlainObject(schema)) {
    throw new ContractValidationError('invalid_schema', 'A schema must be a JSON object.')
  }
  preflightSchema(schema, 0, { nodes: 0 }, { nodes: CONTRACT_MAX_SCHEMA_NODES, depth: CONTRACT_MAX_SCHEMA_DEPTH })
}

export interface CompiledSchema {
  /** The dereferenced 2020-12 document actually compiled. */
  normalized: Record<string, unknown>
  validate(payload: unknown): { valid: boolean; errors: ContractLibraryError[] }
}

export interface ContractLibraryError {
  instanceLocation: string
  keywordLocation: string
  keyword: string
  error: string
}

/**
 * Compile a JSON Schema (2020-12 subset) into a validator. Throws
 * ContractValidationError for unparseable/over-budget/unsupported input —
 * callers translate that into their transport error envelope.
 */
export function compileSchema(schema: unknown, options: ContractCompileOptions = {}): CompiledSchema {
  const normalized = normalizeSchema(schema, options)
  let validator: Validator
  try {
    validator = new Validator(normalized, '2020-12', false)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The schema could not be compiled.'
    throw new ContractValidationError('invalid_schema', message)
  }
  return {
    normalized,
    validate: (payload: unknown) => {
      try {
        const result = validator.validate(payload)
        return { valid: result.valid, errors: result.errors as ContractLibraryError[] }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The payload could not be validated.'
        throw new ContractValidationError('invalid_schema', message)
      }
    },
  }
}

const WRAPPER_KEYWORDS = new Set(['properties', 'items'])

function isWrapperError(error: ContractLibraryError, others: readonly ContractLibraryError[]): boolean {
  if (WRAPPER_KEYWORDS.has(error.keyword)) {
    return true
  }
  // An error whose keywordLocation is a strict ancestor of another error's
  // keywordLocation carries no information beyond its children — drop it.
  return others.some(
    (other) =>
      other !== error && other.keywordLocation.startsWith(error.keywordLocation + '/'),
  )
}

function pointerToPath(instanceLocation: string): string {
  if (instanceLocation === '#' || instanceLocation === '') {
    return '/'
  }
  // instanceLocation is a JSON-Pointer-ish path prefixed with '#'.
  return instanceLocation.startsWith('#') ? instanceLocation.slice(1) || '/' : `/${instanceLocation}`
}

function valueAtPath(payload: unknown, path: string): unknown {
  if (path === '/') {
    return payload
  }
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
  let current: unknown = payload
  for (const segment of segments) {
    if (!isPlainObject(current) && !Array.isArray(current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
    if (current === undefined) {
      return undefined
    }
  }
  return current
}


function jsonPreview(value: unknown, max = 64): string {
  let text: string
  try {
    text = JSON.stringify(value) ?? String(value)
  } catch {
    text = String(value)
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function jsTypeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  const type = typeof value
  if (type === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  if (type === 'object') return 'object'
  if (type === 'boolean') return 'boolean'
  if (type === 'string') return 'string'
  return type
}

const REQUIRED_MISSING = /required property "([^"]+)"/
const ADDL_PROPERTY = /Property "([^"]+)" does not match additional properties schema/
const EXPECTED_TYPE = /Expected "([^"]+)"/

/** Map one library error onto the assertion model. Returns null to drop it. */
function toAssertion(
  error: ContractLibraryError,
  payload: unknown,
  normalized: Record<string, unknown>,
): ContractAssertion | null {
  if (error.keyword === 'false') {
    // The inverse-schema child of an additionalProperties failure — the
    // parent carries the teaching signal; this one is noise.
    return null
  }
  const path = pointerToPath(error.instanceLocation)
  const value = valueAtPath(payload, path)

  if (error.keyword === 'required') {
    const missing = REQUIRED_MISSING.exec(error.error)?.[1]
    return {
      path: missing ? `/${missing}` : path,
      keyword: 'required',
      expected: missing ? `required property "${missing}"` : 'required property',
      actual: 'missing',
      message: error.error,
    }
  }
  if (error.keyword === 'additionalProperties') {
    const extra = ADDL_PROPERTY.exec(error.error)?.[1]
    return {
      path: extra ? `/${extra}` : path,
      keyword: 'additionalProperties',
      expected: 'additionalProperties: false',
      actual: extra ? `unexpected property "${extra}"` : jsonPreview(value),
      message: error.error,
    }
  }

  // The library's keywordLocation points AT the keyword's own value node
  // (e.g. '#/properties/n/minimum' resolves to `1`), so expected renders
  // straight from the value at that pointer.
  const keywordPath = pointerToPath(error.keywordLocation ?? '#')
  const keywordNode = error.keywordLocation ? valueAtPath(normalized, keywordPath) : undefined
  const renderExpected = (value: unknown): string =>
    Array.isArray(value) || (typeof value === 'object' && value !== null)
      ? jsonPreview(value)
      : value === undefined
        ? error.keyword
        : String(value)

  let expected: string
  let actual: string
  switch (error.keyword) {
    case 'type': {
      const wanted = EXPECTED_TYPE.exec(error.error)?.[1]
      expected = keywordNode !== undefined ? renderExpected(keywordNode) : (wanted ?? 'matching type')
      actual = jsTypeName(value)
      break
    }
    case 'enum': {
      expected = keywordNode !== undefined ? renderExpected(keywordNode) : 'enum member'
      actual = jsonPreview(value)
      break
    }
    case 'const': {
      expected = keywordNode !== undefined ? renderExpected(keywordNode) : 'const value'
      actual = jsonPreview(value)
      break
    }
    case 'format': {
      expected = keywordNode !== undefined ? renderExpected(keywordNode) : 'format'
      actual = jsonPreview(value)
      break
    }
    case 'pattern': {
      expected = keywordNode !== undefined ? renderExpected(keywordNode) : 'pattern'
      actual = jsonPreview(value)
      break
    }
    case 'minimum':
    case 'maximum':
    case 'exclusiveMinimum':
    case 'exclusiveMaximum':
    case 'minLength':
    case 'maxLength':
    case 'minItems':
    case 'maxItems':
    case 'minProperties':
    case 'maxProperties': {
      expected =
        keywordNode !== undefined ? `${error.keyword} ${String(keywordNode)}` : error.keyword
      actual = jsonPreview(value)
      break
    }
    default: {
      expected = keywordNode !== undefined ? renderExpected(keywordNode) : error.keyword
      actual = jsonPreview(value)
    }
  }

  return {
    path,
    keyword: error.keyword,
    expected,
    actual,
    message: error.error,
  }
}

/**
 * Validate a payload against a schema. Returns the assertion list — all
 * assertions, never short-circuited (teaching surface), deterministically
 * ordered by (path, keyword, message). Throws ContractValidationError for
 * over-budget input.
 */
export function validatePayload(schema: unknown, payload: unknown): ContractAssertion[] {
  const compiled = compileSchema(schema)
  assertPayloadBudget(payload)
  const outcome = compiled.validate(payload)
  if (outcome.valid) {
    return []
  }
  const errors = outcome.errors
  const live = errors.filter((error) => !isWrapperError(error, errors))
  const assertions = live
    .map((error) => toAssertion(error, payload, compiled.normalized))
    .filter((assertion): assertion is ContractAssertion => assertion !== null)
  const seen = new Set<string>()
  const unique: ContractAssertion[] = []
  for (const assertion of assertions) {
    const key = `${assertion.path}|${assertion.keyword}|${assertion.message}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(assertion)
    }
  }
  unique.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1
    if (a.keyword !== b.keyword) return a.keyword < b.keyword ? -1 : 1
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0
  })
  return unique
}

/** Convenience for workspaces: valid flag + assertion list in one call. */
export function validatePayloadDetailed(
  schema: unknown,
  payload: unknown,
): { valid: boolean; assertions: ContractAssertion[] } {
  const assertions = validatePayload(schema, payload)
  return { valid: assertions.length === 0, assertions }
}
