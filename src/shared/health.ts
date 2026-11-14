export interface HealthResponse {
  status: 'ok' | 'degraded'
  service: string
  version: string
  database: 'ok' | 'unavailable'
  schemaVersion: string | null
  checkedAt: string
}
