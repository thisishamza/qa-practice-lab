// Fetch helpers for the synthetic customer authentication simulation (P3-M5).
// Errors surface as typed results so pages can render honest states; nothing
// here invents identity client-side. Session material lives only in the
// HttpOnly `mpl_customer` cookie — never in localStorage or sessionStorage.

import type {
  AccountOrderListResponse,
  AuthResponse,
  CustomerProfile,
  DemoAccount,
  DemoAccountListResponse,
  OrderDetail,
  OrderSummary,
} from '../../shared/commerce'

export class AuthApiError extends Error {
  readonly status: number
  /** Machine-readable code from the server envelope, when present. */
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AuthApiError('The server returned an unreadable response.', response.status)
  }
}

async function errorFrom(response: Response, fallback: string): Promise<AuthApiError> {
  const body = await readJson<{ message?: string; error?: string }>(response).catch(() => null)
  return new AuthApiError(
    typeof body?.message === 'string' ? body.message : fallback,
    response.status,
    typeof body?.error === 'string' ? body.error : null,
  )
}

export async function fetchAccounts(signal?: AbortSignal): Promise<DemoAccount[]> {
  const response = await fetch('/api/v1/auth/accounts', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The demo accounts could not be loaded.')
  }
  const body = await readJson<DemoAccountListResponse>(response)
  return body.data
}

export async function fetchMe(signal?: AbortSignal): Promise<CustomerProfile | null> {
  const response = await fetch('/api/v1/auth/me', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (response.status === 401) {
    return null
  }
  if (!response.ok) {
    throw await errorFrom(response, 'Your account could not be loaded.')
  }
  const body = await readJson<AuthResponse>(response)
  return body.customer
}

export async function login(email: string, password: string): Promise<CustomerProfile> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw await errorFrom(response, 'The sign-in could not be completed.')
  }
  const body = await readJson<AuthResponse>(response)
  return body.customer
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  // Logout is idempotent server-side; a network failure is still tolerated
  // locally (the cookie will simply expire), but surface real errors.
  if (!response.ok) {
    throw await errorFrom(response, 'The sign-out could not be completed.')
  }
}

export async function fetchAccountOrders(signal?: AbortSignal): Promise<OrderSummary[]> {
  const response = await fetch('/api/v1/account/orders', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw await errorFrom(response, 'Your order history could not be loaded.')
  }
  const body = await readJson<AccountOrderListResponse>(response)
  return body.data
}

/** Returns null when the reference is unknown or not owned by this customer. */
export async function fetchAccountOrder(
  reference: string,
  signal?: AbortSignal,
): Promise<OrderDetail | null> {
  const response = await fetch(`/api/v1/account/orders/${encodeURIComponent(reference)}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw await errorFrom(response, 'The order could not be loaded.')
  }
  return readJson<OrderDetail>(response)
}
