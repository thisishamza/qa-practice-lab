// Staff authorization (P3-M6; Bearer-aware and role-boundary hunt aware P5-M2).
//
// One reusable server-side guard for staff-only endpoints. It layers on top
// of the P3-M5 customer-identity machinery, so the practice-session binding,
// expiry and suspension rules apply unchanged:
//
//   guest (no/invalid/expired credential)
//     → 401 unauthorized        (customer session cookie, if any, is cleared)
//   authenticated with an expired Bearer token
//     → 401 token_expired
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
//
// Role-boundary bug-hunt hook: GET /api/v1/admin/inventory (only that route)
// may pass `{ roleBoundaryDefect: true }`, which lets a hunt-active session
// carrying the role-boundary defect read the inventory list as a non-staff
// customer. The defective branch is read-only; it is unreachable in clean
// mode and does not apply to PATCH or any other staff endpoint.

import type { Context } from 'hono'
import type { AppEnv } from './app'
import type { CustomerRow } from './customer'
import { applyCustomerCookieClear, resolveCustomerContext } from './customer'
import { isDefectActive } from './defects'

export type StaffResolution =
  | { kind: 'ok'; customer: CustomerRow; practiceSessionId: number | null }
  | { kind: 'error'; response: Response }

export async function requireStaff(
  c: Context<AppEnv>,
  options: { roleBoundaryDefect?: boolean } = {},
): Promise<StaffResolution> {
  const resolution = await resolveCustomerContext(c)

  if (resolution.kind === 'bearer-expired') {
    return {
      kind: 'error',
      response: c.json(
        {
          error: 'token_expired',
          message:
            'This practice API token has expired. Mint a new one — there is no renewal flow by design.',
        },
        401,
      ),
    }
  }

  if (resolution.kind !== 'ok') {
    if (resolution.kind === 'none' && resolution.clearCookie) {
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
    // BUG-HUNT DEFECT RBAC-001 (hunt-rbac-001): reachable ONLY when the
    // caller's session carries this hunt and ONLY for the one route that
    // opts in via `roleBoundaryDefect` (GET /api/v1/admin/inventory). The
    // branch grants read access to the synthetic inventory figure and
    // nothing else — PATCH and every other staff boundary are enforced
    // identically in both modes. Clean mode never reaches here.
    if (options.roleBoundaryDefect && (await isDefectActive(c, 'RBAC-001'))) {
      return {
        kind: 'ok',
        customer: resolution.customer,
        practiceSessionId: resolution.practiceSessionId,
      }
    }
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
