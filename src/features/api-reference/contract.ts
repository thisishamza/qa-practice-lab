// Loader + pure view-model helpers for the API reference page. The page
// fetches the *served* contract (/openapi.json) so the documented surface
// can never silently drift from what learners can download. Everything in
// this module is pure (or fetch-only) and unit-testable.

export interface OpenApiParameter {
  name: string
  in: string
  required?: boolean
  description?: string
  schema?: OpenApiSchema
}

export interface OpenApiSchema {
  type?: string | string[]
  format?: string
  const?: unknown
  enum?: unknown[]
  default?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  items?: OpenApiSchema
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  $ref?: string
  anyOf?: OpenApiSchema[]
  description?: string
  example?: unknown
  maxItems?: number
  additionalProperties?: boolean | OpenApiSchema
}

export interface OpenApiResponse {
  description?: string
  content?: Record<string, { schema?: OpenApiSchema }>
  headers?: Record<string, unknown>
}

export interface OpenApiOperation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: OpenApiParameter[]
  requestBody?: {
    required?: boolean
    content?: Record<string, { schema?: OpenApiSchema }>
  }
  responses: Record<string, OpenApiResponse>
  security?: Array<Record<string, unknown[]>>
  'x-internal'?: boolean
}

export interface OpenApiDocument {
  openapi: string
  info: { title: string; version: string; description: string }
  servers: Array<{ url: string; description?: string }>
  tags: Array<{ name: string; description?: string }>
  paths: Record<string, Record<string, OpenApiOperation>>
  components: {
    schemas: Record<string, OpenApiSchema>
    responses: Record<string, OpenApiResponse>
    securitySchemes: Record<string, unknown>
  }
}

export const HTTP_METHODS = ['get', 'post', 'patch', 'delete'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface ParameterRow {
  name: string
  location: string
  required: boolean
  type: string
  detail: string
}

export interface PropertyRow {
  name: string
  type: string
  required: boolean
  detail: string
}

export interface ResponseRow {
  status: string
  description: string
  hasJsonBody: boolean
}

export interface Endpoint {
  method: HttpMethod
  path: string
  operationId: string
  summary: string
  description: string
  tag: string
  isInternal: boolean
  isStaff: boolean
  isProtected: boolean
  parameters: ParameterRow[]
  requestBody: PropertyRow[] | null
  requestBodyRequired: boolean
  responses: ResponseRow[]
  successResponseSchema: PropertyRow[] | null
}

export interface EndpointGroup {
  tag: string
  description: string
  endpoints: Endpoint[]
}

export async function loadContract(): Promise<OpenApiDocument> {
  const response = await fetch('/openapi.json', {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`The contract could not be loaded (HTTP ${response.status}).`)
  }
  const parsed = (await response.json()) as OpenApiDocument
  if (!parsed || typeof parsed !== 'object' || !parsed.paths) {
    throw new Error('The contract document is malformed.')
  }
  return parsed
}

/** Resolves a local `#/components/schemas/<name>` reference. */
export function resolveSchemaRef(
  spec: OpenApiDocument,
  schema: OpenApiSchema | undefined,
): { schema: OpenApiSchema; refName: string | null } {
  if (!schema) {
    return { schema: {}, refName: null }
  }
  if (typeof schema.$ref === 'string') {
    const name = schema.$ref.split('/').pop() ?? ''
    const resolved = spec.components.schemas[name]
    if (!resolved) {
      return { schema: {}, refName: name }
    }
    return { schema: resolved, refName: name }
  }
  return { schema, refName: null }
}

/** Human-readable type column for a schema. */
export function schemaType(spec: OpenApiDocument, schema: OpenApiSchema | undefined): string {
  if (!schema) {
    return '—'
  }
  if (schema.$ref) {
    return schema.$ref.split('/').pop() ?? 'object'
  }
  if (schema.anyOf) {
    return schema.anyOf.map((part) => schemaType(spec, part)).join(' | ')
  }
  if (Array.isArray(schema.type)) {
    return schema.type.join(' | ')
  }
  if (schema.type === 'array') {
    return `${schemaType(spec, schema.items)}[]`
  }
  if (schema.type) {
    return schema.type
  }
  return 'object'
}

/** Constraints worth showing next to the type, joined by middle dots. */
export function schemaDetail(spec: OpenApiDocument, schema: OpenApiSchema | undefined): string {
  if (!schema) {
    return ''
  }
  const { schema: resolved } = resolveSchemaRef(spec, schema)
  if (resolved.$ref || schema.anyOf) {
    return ''
  }
  const parts: string[] = []
  if (resolved.format) {
    parts.push(resolved.format)
  }
  if (Array.isArray(resolved.enum)) {
    parts.push(`one of: ${resolved.enum.join(' | ')}`)
  }
  if (resolved.const !== undefined) {
    parts.push(`const: ${String(resolved.const)}`)
  }
  if (resolved.default !== undefined) {
    parts.push(`default: ${String(resolved.default)}`)
  }
  if (resolved.minimum !== undefined) {
    parts.push(`≥ ${resolved.minimum}`)
  }
  if (resolved.maximum !== undefined) {
    parts.push(`≤ ${resolved.maximum}`)
  }
  if (resolved.minLength !== undefined) {
    parts.push(`min length ${resolved.minLength}`)
  }
  if (resolved.maxLength !== undefined) {
    parts.push(`max length ${resolved.maxLength}`)
  }
  if (resolved.maxItems !== undefined) {
    parts.push(`≤ ${resolved.maxItems} items`)
  }
  if (resolved.pattern) {
    parts.push(`pattern ${resolved.pattern}`)
  }
  return parts.join(' · ')
}

/** Property rows for a request/response object schema (resolves one $ref hop). */
export function propertyRows(
  spec: OpenApiDocument,
  schema: OpenApiSchema | undefined,
): PropertyRow[] {
  const { schema: resolved } = resolveSchemaRef(spec, schema)
  if (!resolved.properties) {
    return []
  }
  const required = new Set(resolved.required ?? [])
  return Object.entries(resolved.properties).map(([name, property]) => ({
    name,
    type: schemaType(spec, property),
    required: required.has(name),
    detail: schemaDetail(spec, property),
  }))
}

/** Parameter rows (path/query/header) for one operation. */
export function parameterRows(
  spec: OpenApiDocument,
  parameters: OpenApiParameter[] | undefined,
): ParameterRow[] {
  return (parameters ?? []).map((parameter) => ({
    name: parameter.name,
    location: parameter.in,
    required: parameter.required === true,
    type: schemaType(spec, parameter.schema),
    detail: parameter.description ?? schemaDetail(spec, parameter.schema),
  }))
}

function responseRows(operation: OpenApiOperation): ResponseRow[] {
  return Object.entries(operation.responses)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([status, response]) => ({
      status,
      description: response.description ?? '',
      hasJsonBody: Boolean(response.content?.['application/json']?.schema),
    }))
}

function requestBodyRows(
  spec: OpenApiDocument,
  operation: OpenApiOperation,
): PropertyRow[] | null {
  const schema = operation.requestBody?.content?.['application/json']?.schema
  if (!schema) {
    return null
  }
  return propertyRows(spec, schema)
}

/** The first 2xx JSON response body as property rows (for the shape table). */
function successBodyRows(
  spec: OpenApiDocument,
  operation: OpenApiOperation,
): PropertyRow[] | null {
  const success = Object.entries(operation.responses).find(([code]) => code.startsWith('2'))
  if (!success) {
    return null
  }
  const schema = success[1].content?.['application/json']?.schema
  if (!schema) {
    return null
  }
  const rows = propertyRows(spec, schema)
  return rows.length > 0 ? rows : null
}

/** Builds the grouped, ordered endpoint view the reference page renders. */
export function buildEndpointGroups(spec: OpenApiDocument): EndpointGroup[] {
  const tagDescriptions = new Map(spec.tags.map((tag) => [tag.name, tag.description ?? '']))
  const byTag = new Map<string, Endpoint[]>()

  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method]
      if (!operation) {
        continue
      }
      const tag = operation.tags?.[0] ?? 'other'
      const pathIsStaff = path.startsWith('/api/v1/admin')
      const endpoint: Endpoint = {
        method,
        path,
        operationId: operation.operationId ?? '',
        summary: operation.summary ?? '',
        description: operation.description ?? '',
        tag,
        isInternal: operation['x-internal'] === true,
        isStaff: pathIsStaff,
        isProtected: Array.isArray(operation.security) && operation.security.length > 0,
        parameters: parameterRows(spec, operation.parameters),
        requestBody: requestBodyRows(spec, operation),
        requestBodyRequired: operation.requestBody?.required === true,
        responses: responseRows(operation),
        successResponseSchema: successBodyRows(spec, operation),
      }
      const bucket = byTag.get(tag)
      if (bucket) {
        bucket.push(endpoint)
      } else {
        byTag.set(tag, [endpoint])
      }
    }
  }

  const orderedTags = spec.tags.map((tag) => tag.name)
  const known = new Set(orderedTags)
  for (const tag of byTag.keys()) {
    if (!known.has(tag)) {
      orderedTags.push(tag)
    }
  }

  return orderedTags
    .filter((tag) => byTag.has(tag))
    .map((tag) => ({
      tag,
      description: tagDescriptions.get(tag) ?? '',
      endpoints: (byTag.get(tag) ?? []).sort((a, b) =>
        a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
      ),
    }))
}

/** Total number of documented operations. */
export function countOperations(spec: OpenApiDocument): number {
  let count = 0
  for (const item of Object.values(spec.paths)) {
    for (const method of HTTP_METHODS) {
      if (item[method]) {
        count += 1
      }
    }
  }
  return count
}
