// Browser client for the microservices simulator API. Transport only —
// all semantics (handlers, backoff, idempotency, outcome) live server-side.

import { PracticeApiError } from '../practice/api'

export type EventType = 'order.created' | 'inventory.reserved' | 'payment.processed' | 'webhook.deliver'
export type Drill =
  | 'none'
  | 'inventory-short'
  | 'inventory-delay'
  | 'payment-decline'
  | 'payment-transient'
  | 'payment-always-fails'
  | 'webhook-timeout'
  | 'webhook-always-fail'
  | 'poison'

export interface SimulatorOverview {
  persistence: 'session'
  quota: { used: number; limit: number }
  events: { total: number; pending: number; processed: number; failed: number; dead: number }
  webhooks: { delivered: number; duplicates: number; dead: number }
  state: Record<string, Record<string, string>>
  orders: Array<{
    correlationId: string
    orderId: string
    quantity: number
    totalCents: number
    drill: string
    reserved: boolean
    paid: boolean
    paymentStatus: 'none' | 'declined' | 'paid' | 'failed'
    capturedCents: number
  }>
}

export interface EventHistoryItem {
  id: string
  correlation_id: string
  seq: number
  type: string
  status: string
  attempts: number
  max_attempts: number
  last_error: string | null
  created_at: string
  updated_at: string
  available_at: string
}

export interface ProcessOutcome {
  eventId: string
  type: string
  correlationId: string
  seq: number
  result: 'processed' | 'duplicate' | 'failed' | 'dead' | 'out_of_order'
  detail: string
}

export interface ProcessResponse {
  processed: ProcessOutcome[]
  waiting: number
  dead: number
}

export interface TraceEvent {
  id: string
  seq: number
  type: string
  status: string
  attempts: number
  max_attempts: number
  last_error: string | null
  created_at: string
  updated_at: string
  available_at: string
}

export interface TraceWebhook {
  event_id: string
  target: string
  status: string
  attempts: number
  max_attempts: number
  http_status: number | null
  last_error: string | null
}

export interface TraceResponse {
  correlationId: string
  events: TraceEvent[]
  webhooks: TraceWebhook[]
}

export interface ConsistencyResponse {
  ok: boolean
  checked: number
  violations: Array<{ correlationId: string; kind: string; detail: string }>
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function post<T>(url: string, body: unknown, fallback: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const parsed = (await parseJson(response)) as ({ error?: string; message?: string } & Record<string, unknown>) | null
  if (!response.ok) {
    throw new PracticeApiError(parsed?.message ?? fallback, response.status, parsed?.error ?? null)
  }
  return parsed as T
}

async function get<T>(url: string, fallback: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  const parsed = (await parseJson(response)) as ({ error?: string; message?: string } & Record<string, unknown>) | null
  if (!response.ok) {
    throw new PracticeApiError(parsed?.message ?? fallback, response.status, parsed?.error ?? null)
  }
  return parsed as T
}

export function fetchEvents(): Promise<{ events: EventHistoryItem[] }> {
  return get('/api/v1/microservices/events', 'The event history could not be loaded.')
}

export function fetchOverview(): Promise<SimulatorOverview> {
  return get('/api/v1/microservices/overview', 'The simulator state could not be loaded.')
}

export function publishEvent(input: {
  type: EventType
  drill: Drill
  quantity: number
  totalCents: number
  correlationId?: string
}): Promise<{ correlationId: string; seq: number; type: string; drill: string; status: string }> {
  return post('/api/v1/microservices/publish', input, 'The event could not be published.')
}

export function processEvents(): Promise<ProcessResponse> {
  return post('/api/v1/microservices/process', {}, 'The events could not be processed.')
}

export function retryEvent(eventId: string): Promise<{ eventId: string; status: string }> {
  return post(`/api/v1/microservices/events/${encodeURIComponent(eventId)}/retry`, {}, 'The event could not be retried.')
}

export function redeliverEvent(eventId: string): Promise<{ eventId: string; status: string }> {
  return post(`/api/v1/microservices/events/${encodeURIComponent(eventId)}/redeliver`, {}, 'The event could not be redelivered.')
}

export function replayDead(): Promise<{ replayed: number }> {
  return post('/api/v1/microservices/events/replay', {}, 'The dead-letter queue could not be replayed.')
}

export function resetSimulator(): Promise<{ deleted: boolean }> {
  return post('/api/v1/microservices/reset', {}, 'The simulator could not be reset.')
}

export function fetchTrace(correlationId: string): Promise<TraceResponse> {
  return get(`/api/v1/microservices/trace/${encodeURIComponent(correlationId)}`, 'The trace could not be loaded.')
}

export function fetchConsistency(): Promise<ConsistencyResponse> {
  return get('/api/v1/microservices/consistency', 'The consistency check could not be run.')
}
