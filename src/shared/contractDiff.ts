// Compatibility & diff engine (Phase 7, plan §4.4) — pure, deterministic,
// browser- and server-safe. Compares two JSON Schema documents (after the
// wrapper's normalize step) and classifies every change as breaking,
// backward-compatible or review-required.
//
// Algorithm: preflight + dereference both documents, then walk the two
// normalized trees in parallel by path pair. Set operations on
// required/enum and key-set operations on properties produce findings.
// Verdict precedence: any breaking ⇒ BREAKING; else any review ⇒ REVIEW;
// else BACKWARD-COMPATIBLE. Findings are stable-sorted by (classification
// rank, path, rule) so output is byte-deterministic.
//
// Direction semantics (the locus is declared on the comparison):
//   request  — the producer side of the contract (clients speaking to us)
//   response — the consumer side of the contract (us speaking to clients)
//
// Annotation-only deltas (description/title/examples/$comment/default/
// deprecated/readOnly/writeOnly/$schema) produce ZERO findings (R21).
// Remote refs are refused upstream by the wrapper (local only).

import { normalizeSchema } from './contractValidation'
import type {
  CompatibilityFinding,
  ContractDiffResult,
  ContractLocus,
  RuleClassification,
} from './contractTypes'

export interface DiffContractsOptions {
  locus: ContractLocus
}

const CLASSIFICATION_RANK: Record<RuleClassification, number> = {
  breaking: 0,
  review: 1,
  compatible: 2,
}

const ANNOTATION_KEYS = new Set([
  '$schema',
  'title',
  'description',
  'examples',
  'default',
  'deprecated',
  'readOnly',
  'writeOnly',
  '$comment',
  'format-annotation',
])

const CONSTRAINT_KEYS = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minProperties',
  'maxProperties',
] as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function joinPointer(base: string, segment: string): string {
  return base === '/' ? `/${segment}` : `${base}/${segment}`
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function typeKind(typeValue: unknown): string | null {
  if (typeValue === undefined) return null
  if (typeof typeValue === 'string') return typeValue
  if (Array.isArray(typeValue)) return (typeValue as string[]).slice().sort().join('|')
  return null
}

/** Narrowing/widening detection over `type` declarations (integer ⊆ number). */
function typeChangeKind(base: unknown, candidate: unknown): 'narrowed' | 'widened' | 'same' | 'incompatible' {
  if (base === undefined && candidate === undefined) return 'same'
  const b = typeKind(base)
  const c = typeKind(candidate)
  if (b === c) return 'same'
  if (b === null || c === null) return 'incompatible'
  const baseSet = new Set(b.split('|'))
  const candSet = new Set(c.split('|'))
  const covers = (name: string, set: Set<string>): boolean =>
    set.has(name) || (name === 'integer' && set.has('number'))
  const baseCoveredByCand = [...baseSet].every((name) => covers(name, candSet))
  const candCoveredByBase = [...candSet].every((name) => covers(name, baseSet))
  if (baseCoveredByCand && !candCoveredByBase) return 'widened'
  if (candCoveredByBase && !baseCoveredByCand) return 'narrowed'
  if (baseCoveredByCand && candCoveredByBase) return 'same'
  return 'incompatible'
}

interface WalkContext {
  locus: ContractLocus
  findings: CompatibilityFinding[]
}

function impact(rule: string, locus: ContractLocus): { consumerImpact: string; providerImpact: string } {
  // Short, specific, deterministic impact notes per rule.
  switch (rule) {
    case 'R1':
      return {
        consumerImpact: 'Requests that were valid before now fail provider-side validation — update payloads or SDKs.',
        providerImpact: 'Safe to ship after a major/doc-flagged release; existing clients must migrate first.',
      }
    case 'R2':
      return {
        consumerImpact: 'Nothing breaks — previously-required input is no longer mandatory.',
        providerImpact: 'Relaxation; safe to deploy.',
      }
    case 'R3':
      return {
        consumerImpact: 'Reads of the removed property return undefined — audit every consumer call site.',
        providerImpact: 'Breaking for the provider contract — requires a version boundary and migration window.',
      }
    case 'R4':
      return {
        consumerImpact: 'Additive — existing reads are unaffected; new field available opportunistically.',
        providerImpact: 'Safe to deploy; closed-schema consumers pinned to the old document are unaffected unless they pin strict readers (see R5).',
      }
    case 'R5':
      return {
        consumerImpact: 'Strict closed-schema readers (additionalProperties: false) will reject the whole payload — audit strict consumers before shipping.',
        providerImpact: 'Pick a release boundary or relax the closed schema; never ship additive-only to pinned strict readers silently.',
      }
    case 'R6':
      return {
        consumerImpact: 'Values fall outside the widened domain — runtime type errors and wrong rendering are likely.',
        providerImpact: 'Breaking; coordinate with consumers and ship behind a version boundary.',
      }
    case 'R7':
      return {
        consumerImpact: 'Values now include kinds (widened domain) readers may not expect — display/serialize paths need review.',
        providerImpact: 'Compatible for readers; document the widened domain in release notes.',
      }
    case 'R8':
      return {
        consumerImpact: 'The removed value can no longer appear — exhaustive switches still compile but mishandle nothing.',
        providerImpact: 'Breaking for any consumer matching the full old set; coordinate the removal.',
      }
    case 'R9':
      return {
        consumerImpact: 'A new value appears on the wire — closed-set switches and exhaustiveness checks will hit unknown values; review before shipping.',
        providerImpact: 'Additive for consumers that tolerate unknowns; gate behind a version boundary if any consumer keeps a closed switch.',
      }
    case 'R10':
      return {
        consumerImpact: 'Previously-valid requests are now rejected — client-side validation and payloads need updating.',
        providerImpact: 'Rejection surface grows — treat as breaking for request-side clients.',
      }
    case 'R11':
      return {
        consumerImpact: 'Values narrow — anything satisfying the old bound still satisfies the new one; old expectations hold.',
        providerImpact: 'Compatible with a note: document the narrowed domain in the provider changelog.',
      }
    case 'R12':
      return {
        consumerImpact: 'Requests that failed before now pass — no action required.',
        providerImpact: 'Compatible; relaxation.',
      }
    case 'R13':
      return {
        consumerImpact: 'Values exceed the bounds consumers may have relied on (e.g. assumed minimum: 1) — runtime violations surface.',
        providerImpact: 'Breaking; relax only with a migration window.',
      }
    case 'R14':
      return {
        consumerImpact: 'The constant changed — any hard-coded expectation breaks outright.',
        providerImpact: 'Breaking; requires a version boundary.',
      }
    case 'R15':
      return locus === 'request'
        ? {
            consumerImpact: 'Strict document readers accept nothing new (compatible) — or reject formerly-valid payloads (breaking, reverse direction).',
            providerImpact: 'Per direction; treat the stricter direction as breaking.',
          }
        : {
            consumerImpact: 'Closed provider schemas may now emit undeclared properties — strict consumer readers break.',
            providerImpact: 'Review; relax closed schemas deliberately.',
          }
    case 'R16':
      return {
        consumerImpact: 'A documented status code disappears — client-side status handling loses a branch.',
        providerImpact: 'Breaking; document the migration in the changelog.',
      }
    case 'R17':
      return {
        consumerImpact: 'A new status code appears — clients must tolerate it or route around it.',
        providerImpact: 'Compatible for tolerant clients; review for strict status machines.',
      }
    case 'R18':
      return {
        consumerImpact: 'Payload parsing breaks — content negotiation and deserializers fail.',
        providerImpact: 'Breaking; keep the media type stable across a version boundary.',
      }
    case 'R19':
      return {
        consumerImpact: 'Semantic change outside set comparison — a human must review what the new format means.',
        providerImpact: 'Review; never auto-classify a format change.',
      }
    case 'R20':
      return {
        consumerImpact: 'The target contract moved — everything behind the ref may have changed.',
        providerImpact: 'Review; verify the retarget does not silently swap semantics.',
      }
    default:
      return { consumerImpact: '', providerImpact: '' }
  }
}

function classify(ctx: WalkContext, rule: string, path: string, change: string): CompatibilityFinding {
  const { consumerImpact, providerImpact } = impact(rule, ctx.locus)
  const classification = classificationFor(rule)
  const finding: CompatibilityFinding = {
    rule,
    path,
    locus: ctx.locus,
    classification,
    change,
    consumerImpact,
    providerImpact,
  }
  ctx.findings.push(finding)
  return finding
}

function classificationFor(rule: string): RuleClassification {
  switch (rule) {
    case 'R1':
      return 'breaking' // request-side only, by rule definition
    case 'R2':
    case 'R4':
    case 'R7':
    case 'R12':
    case 'R17':
      return 'compatible'
    case 'R3':
    case 'R6':
    case 'R8':
    case 'R10':
    case 'R13':
    case 'R14':
    case 'R16':
    case 'R18':
      return 'breaking'
    case 'R5':
    case 'R9':
    case 'R19':
    case 'R20':
      return 'review'
    case 'R11':
      return 'compatible'
    case 'R15':
      return 'compatible' // direction-specific handled at the call site
    default:
      return 'review'
  }
}

const ENUM_WIDENED = 'review' as const

/** Walk two schema nodes in parallel. `path` is the JSON Pointer of the current node. */
function walk(base: unknown, candidate: unknown, path: string, ctx: WalkContext): void {
  if (!isPlainObject(base) || !isPlainObject(candidate)) {
    return
  }

  // x-contract-meta: mini-contract annotations for status/media-type diffs.
  // Structural-only; stripped from JSON Schema semantics (annotation).
  walkContractMeta(base['x-contract-meta'], candidate['x-contract-meta'], path, ctx)

  // $ref retarget detection (pre-normalization view is not available here —
  // normalize dereferences — so this compares the *normalized* nodes; the
  // R20 retarget finding is emitted by the caller before normalization).

  // x-contract-meta is the only non-schema annotation; skip everything else annotation-like.
  const baseKeys = Object.keys(base).filter((key) => !ANNOTATION_KEYS.has(key))
  const candidateKeys = Object.keys(candidate).filter((key) => !ANNOTATION_KEYS.has(key))
  const keySet = new Set([...baseKeys, ...candidateKeys])

  // ---- required (set semantics) --------------------------------------------
  const baseRequired = Array.isArray(base.required) ? new Set(base.required.filter((v): v is string => typeof v === 'string')) : null
  const candRequired = Array.isArray(candidate.required) ? new Set(candidate.required.filter((v): v is string => typeof v === 'string')) : null
  if (baseRequired || candRequired) {
    const before = baseRequired ?? new Set<string>()
    const after = candRequired ?? new Set<string>()
    for (const name of after) {
      if (!before.has(name) && ctx.locus === 'request') {
        classify(ctx, 'R1', joinPointer(path, 'required'), `required gains "${name}"`)
      } else if (!before.has(name) && ctx.locus === 'response') {
        // A response gaining a required property implies an additive
        // property change — surfaced as R4/R5 via the key-set diff below.
        continue
      }
    }
    for (const name of before) {
      if (!after.has(name)) {
        classify(ctx, 'R2', joinPointer(path, 'required'), `required loses "${name}"`)
      }
    }
  }

  // ---- type ----------------------------------------------------------------
  const typeChange = typeChangeKind(base.type, candidate.type)
  if (typeChange === 'narrowed') {
    classify(ctx, 'R6', joinPointer(path, 'type'), `type narrowed ${json(base.type)} → ${json(candidate.type)}`)
  } else if (typeChange === 'widened') {
    classify(ctx, 'R7', joinPointer(path, 'type'), `type widened ${json(base.type)} → ${json(candidate.type)}`)
  } else if (typeChange === 'incompatible') {
    // string → enum narrowing is the flagged incompatibility the table calls out.
    if (base.type === 'string' && (candidate.enum !== undefined || candidate.type === 'enum')) {
      classify(ctx, 'R6', joinPointer(path, 'type'), `type narrowed ${json(base.type)} → enum`)
    } else if (isPlainObject(base) && typeof base.type === 'string' && typeof candidate.type === 'string') {
      classify(ctx, 'R6', joinPointer(path, 'type'), `type changed ${json(base.type)} → ${json(candidate.type)}`)
    }
  }

  // ---- const ---------------------------------------------------------------
  if (base.const !== undefined || candidate.const !== undefined) {
    if (json(base.const) !== json(candidate.const)) {
      classify(ctx, 'R14', joinPointer(path, 'const'), `const changed ${json(base.const)} → ${json(candidate.const)}`)
    }
  }

  // ---- enum ----------------------------------------------------------------
  const baseEnum = Array.isArray(base.enum) ? new Set(base.enum.map((v) => json(v))) : null
  const candEnum = Array.isArray(candidate.enum) ? new Set(candidate.enum.map((v) => json(v))) : null
  if (baseEnum || candEnum) {
    const before = baseEnum ?? new Set<string>()
    const after = candEnum ?? new Set<string>()
    const removed = [...before].filter((v) => !after.has(v))
    const added = [...after].filter((v) => !before.has(v))
    if (removed.length > 0) {
      classify(ctx, 'R8', joinPointer(path, 'enum'), `enum removes ${removed.join(', ')}`)
    }
    if (added.length > 0) {
      if (ctx.locus === 'response') {
        const finding = classify(ctx, 'R9', joinPointer(path, 'enum'), `enum gains ${added.join(', ')} (consumers with closed switches must review)`)
        finding.classification = ENUM_WIDENED
      } else {
        classify(ctx, 'R9', joinPointer(path, 'enum'), `enum gains ${added.join(', ')} (request surface relaxes)`).classification = 'compatible'
      }
    }
  }

  // ---- numeric/length constraints ------------------------------------------
  for (const key of CONSTRAINT_KEYS) {
    const before = base[key]
    const after = candidate[key]
    if (before === undefined && after === undefined) {
      continue
    }
    if (typeof before !== 'number' || typeof after !== 'number') {
      if (before !== after && (before === undefined || after === undefined)) {
        // A constraint appearing or disappearing entirely is a tightening
        // or relaxation of that bound.
        if (ctx.locus === 'request') {
          classify(ctx, after === undefined ? 'R12' : 'R10', joinPointer(path, key), `${key} ${before === undefined ? 'added' : 'removed'}`)
        } else {
          classify(ctx, after === undefined ? 'R13' : 'R11', joinPointer(path, key), `${key} ${before === undefined ? 'added' : 'removed'}`)
        }
      }
      continue
    }
    if (before === after) {
      continue
    }
    // "Tightening" direction: for minimum-like, larger is tighter; for
    // maximum-like, smaller is tighter.
    const isMin = key.startsWith('min') || key === 'exclusiveMinimum'
    const tightened = isMin ? after > before : after < before
    if (tightened) {
      if (ctx.locus === 'request') {
        classify(ctx, 'R10', joinPointer(path, key), `${key} tightened ${before} → ${after}`)
      } else {
        classify(ctx, 'R11', joinPointer(path, key), `${key} tightened ${before} → ${after}`)
      }
    } else {
      if (ctx.locus === 'request') {
        classify(ctx, 'R12', joinPointer(path, key), `${key} relaxed ${before} → ${after}`)
      } else {
        classify(ctx, 'R13', joinPointer(path, key), `${key} relaxed ${before} → ${after}`)
      }
    }
  }

  // ---- pattern / format -----------------------------------------------------
  const basePattern = typeof base.pattern === 'string' ? base.pattern : undefined
  const candPattern = typeof candidate.pattern === 'string' ? candidate.pattern : undefined
  if (basePattern !== candPattern) {
    classify(ctx, 'R19', joinPointer(path, 'pattern'), `pattern changed ${json(basePattern)} → ${json(candPattern)}`)
  }
  const baseFormat = typeof base.format === 'string' ? base.format : undefined
  const candFormat = typeof candidate.format === 'string' ? candidate.format : undefined
  if (baseFormat !== candFormat) {
    classify(ctx, 'R19', joinPointer(path, 'format'), `format changed ${json(baseFormat)} → ${json(candFormat)}`)
  }

  // ---- additionalProperties ---------------------------------------------------
  const baseAP = base.additionalProperties
  const candAP = candidate.additionalProperties
  if (typeof baseAP === 'boolean' || typeof candAP === 'boolean') {
    if (baseAP !== candAP) {
      if (ctx.locus === 'request') {
        const finding = classify(ctx, 'R15', joinPointer(path, 'additionalProperties'), `additionalProperties ${json(baseAP)} → ${json(candAP)}`)
        finding.classification = baseAP === false && candAP === true ? 'compatible' : 'breaking'
      } else {
        // A response schema going open on the wire breaks closed-schema
        // readers pinned to the provider document (R5); closing is safe.
        const finding = classify(ctx, 'R5', joinPointer(path, 'additionalProperties'), `additionalProperties ${json(baseAP)} → ${json(candAP)}`)
        finding.classification = baseAP === false && candAP === true ? 'review' : 'compatible'
      }
    }
  }

  // ---- properties key-set diff ------------------------------------------------
  const baseProps = isPlainObject(base.properties) ? base.properties : null
  const candProps = isPlainObject(candidate.properties) ? candidate.properties : null
  const propUnion = new Set([...Object.keys(baseProps ?? {}), ...Object.keys(candProps ?? {})])
  for (const name of propUnion) {
    const before = baseProps?.[name]
    const after = candProps?.[name]
    if (before !== undefined && after === undefined) {
      // Property removed from the schema.
      if (ctx.locus === 'response') {
        classify(ctx, 'R3', joinPointer(joinPointer(path, 'properties'), name), `property "${name}" removed`)
      } else {
        // Request-side removal is ambiguous for clients — human review.
        classify(ctx, 'R3', joinPointer(joinPointer(path, 'properties'), name), `property "${name}" removed (strict clients sending it will fail)`).classification = 'review'
      }
      continue
    }
    if (before === undefined && after !== undefined) {
      if (ctx.locus === 'response') {
        classify(ctx, 'R4', joinPointer(joinPointer(path, 'properties'), name), `property "${name}" added`)
      }
      // Request-side additions are handled by R1 (required) or are
      // optional props — no finding (relaxation for clients).
      continue
    }
    if (before !== undefined && after !== undefined) {
      walk(before, after, joinPointer(joinPointer(path, 'properties'), name), ctx)
    }
  }

  // ---- items recursion --------------------------------------------------------
  if (isPlainObject(base.items) && isPlainObject(candidate.items)) {
    walk(base.items, candidate.items, joinPointer(path, 'items'), ctx)
  }

  // ---- items arrays / tuples --------------------------------------------------
  if (Array.isArray(base.items) && Array.isArray(candidate.items)) {
    const length = Math.max(base.items.length, candidate.items.length)
    for (let index = 0; index < length; index += 1) {
      walk(base.items[index], candidate.items[index], `${joinPointer(path, 'items')}/${index}`, ctx)
    }
  }

  // ---- nested boolean additionalProperties-as-schema ---------------------------
  if (isPlainObject(base.additionalProperties) && isPlainObject(candidate.additionalProperties)) {
    walk(base.additionalProperties, candidate.additionalProperties, joinPointer(path, 'additionalProperties'), ctx)
  }

  // ---- generic recursion for other composite keywords -------------------------
  for (const key of keySet) {
    if (['required', 'type', 'const', 'enum', 'pattern', 'format', 'properties', 'items', 'additionalProperties', 'x-contract-meta'].includes(key)) {
      continue
    }
    const before = base[key]
    const after = candidate[key]
    if (isPlainObject(before) && isPlainObject(after)) {
      walk(before, after, joinPointer(path, key), ctx)
    }
  }
}

/** x-contract-meta: mini-contract status/media-type annotations (R16–R18). */
function walkContractMeta(
  base: unknown,
  candidate: unknown,
  path: string,
  ctx: WalkContext,
): void {
  if (base === undefined && candidate === undefined) {
    return
  }
  const before = isPlainObject(base) ? base : {}
  const after = isPlainObject(candidate) ? candidate : {}
  const statusBefore = Array.isArray(before.statuses) ? before.statuses.filter((s): s is number => typeof s === 'number') : null
  const statusAfter = Array.isArray(after.statuses) ? after.statuses.filter((s): s is number => typeof s === 'number') : null
  if (statusBefore || statusAfter) {
    const b = new Set(statusBefore ?? [])
    const a = new Set(statusAfter ?? [])
    for (const code of b) {
      if (!a.has(code) && ctx.locus === 'response') {
        classify(ctx, 'R16', `${joinPointer(path, 'x-contract-meta')}/statuses`, `documented status ${code} removed`)
      }
    }
    for (const code of a) {
      if (!b.has(code) && ctx.locus === 'response') {
        classify(ctx, 'R17', `${joinPointer(path, 'x-contract-meta')}/statuses`, `status ${code} added`)
      }
    }
  }
  const mediaBefore = typeof before.mediaType === 'string' ? before.mediaType : undefined
  const mediaAfter = typeof after.mediaType === 'string' ? after.mediaType : undefined
  if (mediaBefore !== mediaAfter && mediaBefore !== undefined && mediaAfter !== undefined) {
    if (ctx.locus === 'response') {
      classify(ctx, 'R18', `${joinPointer(path, 'x-contract-meta')}/mediaType`, `media type changed ${mediaBefore} → ${mediaAfter}`)
    }
  }
}

/**
 * Diff two contracts. `base` and `candidate` are JSON Schema documents
 * (parsed); both are normalized with the shared wrapper budgets. Throws
 * ContractValidationError for over-budget/cyclic/remote-ref input.
 */
export function diffContracts(
  base: unknown,
  candidate: unknown,
  options: DiffContractsOptions,
): ContractDiffResult {
  // Detect `$ref` retargets BEFORE normalization (it erases refs).
  const refFindings: CompatibilityFinding[] = []
  const ctxRef: WalkContext = { locus: options.locus, findings: refFindings }
  walkRefTargets(base, candidate, '/', ctxRef)

  const normalizedBase = normalizeSchema(base)
  const normalizedCandidate = normalizeSchema(candidate)

  const ctx: WalkContext = { locus: options.locus, findings: [] }
  walk(normalizedBase, normalizedCandidate, '/', ctx)
  ctx.findings.push(...refFindings)

  // `$ref` inlining duplicates each subschema under every use site —
  // collapse identical (rule, change, classification) triples, keeping the
  // shortest (least nested) path. Output stays byte-deterministic.
  const bySignature = new Map<string, CompatibilityFinding>()
  for (const finding of ctx.findings) {
    const signature = `${finding.rule}|${finding.change}|${finding.classification}`
    const existing = bySignature.get(signature)
    if (!existing || finding.path.length < existing.path.length) {
      bySignature.set(signature, finding)
    }
  }
  const findings = [...bySignature.values()]
  findings.sort((a, b) => {
    const rank = CLASSIFICATION_RANK[a.classification] - CLASSIFICATION_RANK[b.classification]
    if (rank !== 0) return rank
    if (a.path !== b.path) return a.path < b.path ? -1 : 1
    if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1
    if (a.change !== b.change) return a.change < b.change ? -1 : 1
    return 0
  })

  const verdict: ContractDiffResult['verdict'] = findings.some((f) => f.classification === 'breaking')
    ? 'breaking'
    : findings.some((f) => f.classification === 'review')
      ? 'review'
      : 'compatible'

  return { verdict, findings }
}

/** Detect `$ref` retargeting on raw (pre-normalization) trees. */
function walkRefTargets(base: unknown, candidate: unknown, path: string, ctx: WalkContext): void {
  if (Array.isArray(base) && Array.isArray(candidate)) {
    const length = Math.max(base.length, candidate.length)
    for (let index = 0; index < length; index += 1) {
      walkRefTargets(base[index], candidate[index], `${path}/${index}`, ctx)
    }
    return
  }
  if (!isPlainObject(base) || !isPlainObject(candidate)) {
    return
  }
  const beforeRef = typeof base.$ref === 'string' ? base.$ref : undefined
  const afterRef = typeof candidate.$ref === 'string' ? candidate.$ref : undefined
  if (beforeRef !== afterRef && (beforeRef !== undefined || afterRef !== undefined)) {
    classify(ctx, 'R20', path, `$ref retargeted ${json(beforeRef)} → ${json(afterRef)}`)
  }
  for (const key of Object.keys(base)) {
    if (key === '$ref') continue
    if (key in candidate) {
      walkRefTargets(base[key], candidate[key], joinPointer(path, key), ctx)
    }
  }
}
