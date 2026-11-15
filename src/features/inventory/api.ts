// Staff-only inventory API client. The server is the authority —
// authorization is enforced there; this client only surfaces the result
// honestly. Nothing here implies a restock succeeded before the server
// confirms it.

import type {
  AdminInventoryItem,
  AdminInventoryListResponse,
  AdminRestockResponse,
} from '../../shared/commerce'

export class InventoryApiError extends Error {
  readonly status: number
  /** Machine-readable code from the server envelope, when present. */
  readonly code: string | null
  /** Per-field validation messages, when the server returned them. */
  readonly fields: Record<string, string> | null

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    fields: Record<string, string> | null = null,
  ) {
    super(message)
    this.name = 'InventoryApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new InventoryApiError(
      'The practice API could not read the server response.',
      response.status,
    )
  }
}

async function errorFrom(response: Response, fallback: string): Promise<InventoryApiError> {
  const body = await readJson<{
    message?: string
    error?: string
    fields?: Record<string, string>
  }>(response).catch(() => null)
  return new InventoryApiError(
    body?.message ?? fallback,
    response.status,
    typeof body?.error === 'string' ? body.error : null,
    body?.fields ?? null,
  )
}

export interface StaffInventoryFetchResult {
  items: AdminInventoryItem[]
  total: number
}

export async function fetchStaffInventory(signal?: AbortSignal): Promise<StaffInventoryFetchResult> {
  const response = await fetch('/api/v1/admin/inventory', {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw await errorFrom(response, 'The staff inventory could not be loaded.')
  }

  const body = await readJson<AdminInventoryListResponse>(response)
  return { items: body.data, total: body.total }
}

export interface RestockInput {
  quantity: number
  note?: string
}

export async function restockProduct(
  productId: number,
  input: RestockInput,
): Promise<AdminRestockResponse> {
  const response = await fetch(
    `/api/v1/admin/inventory/${encodeURIComponent(String(productId))}`,
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    throw await errorFrom(response, 'The restock could not be applied. Please try again.')
  }

  return readJson<AdminRestockResponse>(response)
}
