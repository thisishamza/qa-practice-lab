// Staff authorization (P3-M6).
//
// One reusable server-side guard for staff-only endpoints. It layers on top
// of the P3-M5 customer-identity machinery, so the practice-session binding,
// expiry and suspension rules apply unchanged:
//
//   guest (no/invalid/expired/cross-practice-session cookie)
//     → 401 unauthorized        (customer session cookie, if any, is cleared)
//   authenticated but suspended
//     → 403 account_suspended
//   authenticated, active, role = 'customer'
//     → 403 staff_required
//   authenticated, active, role = 'staff'
//     → ok
//
// The client never gets a say: no body field, header or query parameter can
// elevate a role. Authorization is decided solely from the stored customer
// row. A staff session replayed against another practice session is rejected
// here exactly as it is on every protected endpoint.

import type { Context } from 'hono'
import type { AppEnv } from './app'
import type { CustomerRow } from './customer'
import { applyCustomerCookieClear, resolveCustomerContext } from './customer'

export type StaffResolution =
  | { kind: 'ok'; customer: CustomerRow; practiceSessionId: number }
  | { kind: 'error'; response: Response }

export async function requireStaff(
  c: Context<AppEnv>,
): Promise<StaffResolution> {
  const resolution = await resolveCustomerContext(c)

  if (resolution.kind !== 'ok') {
    if (resolution.clearCookie) {
      applyCustomerCookieClear(c)
    }
    return {
      kind: 'error',
      response: c.json(
        { error: 'unauthorized', message: 'Sign in with a staff account to access staff tools.' },
        401,
      ),
    }
  }

  if (resolution.customer.status !== 'active') {
    return {
      kind: 'error',
      response: c.json(
        {
          error: 'account_suspended',
          message: 'This synthetic training account is suspended and cannot access staff tools.',
        },
        403,
      ),
    }
  }

  if (resolution.customer.role !== 'staff') {
    return {
      kind: 'error',
      response: c.json(
        {
          error: 'staff_required',
          message: 'This synthetic account does not have staff access to Meridian Outfitters inventory tools.',
        },
        403,
      ),
    }
  }

  return { kind: 'ok', customer: resolution.customer, practiceSessionId: resolution.practiceSessionId }
}
