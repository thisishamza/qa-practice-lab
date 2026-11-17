// Server-only bug-hunt delta for hunt-contract-007 (Phase 7, plan §4.6).
//
// The drifted provider payload exists solely for two server-side
// consumers, both inside POST /api/v1/contract/verify-consumer:
//   1. the session-aware `provider-product-v2-latest` alias — a caller in
//      bug-hunt mode on hunt-contract-007 resolves to the drifted
//      payload; everyone else resolves to the additive v2 fixture;
//   2. the explicitly named `provider-product-v2-drift` drill used by the
//      contract-adv-consumer-broken-01 exercise (instructions say the v2
//      provider changed).
//
// NO endpoint ever returns this payload. Learners receive assertion lists
// only. The delta is compiled into the Worker bundle and never ships to
// the browser.
//
// Expected-vs-actual (internal): `categoryName` renamed to `category`
// (the fixture's product detail view is rebuilt) plus `stockStatus`
// casing drift (`IN_STOCK`, outside the documented enum). A consumer
// expectation requiring `categoryName` (or the platform contract's
// Product schema) fails against this payload.

import {
  PROVIDER_PRODUCT_V1_PAYLOAD,
  PROVIDER_PRODUCT_V2_COMPATIBLE_PAYLOAD,
} from '../shared/contracts/providerProduct'

/** The drifted payload (server-only). */
export const CONTRACT_DRIFT_PAYLOAD: Record<string, unknown> = Object.freeze(
  (() => {
    const rest: Record<string, unknown> = { ...PROVIDER_PRODUCT_V1_PAYLOAD }
    delete rest.categoryName
    return {
      ...rest,
      category: PROVIDER_PRODUCT_V1_PAYLOAD.categoryName,
      stockStatus: 'IN_STOCK',
    }
  })(),
)

export type ProviderFixtureId =
  | 'provider-product-v1'
  | 'provider-product-v2-compatible'
  | 'provider-product-v2-drift'
  | 'provider-product-v2-latest'

export const PROVIDER_FIXTURE_IDS: readonly ProviderFixtureId[] = [
  'provider-product-v1',
  'provider-product-v2-compatible',
  'provider-product-v2-drift',
  'provider-product-v2-latest',
]

/**
 * Resolve a provider fixture id to its canned payload. `hunt007Active`
 * is the ONLY session-aware seam — it is computed by the caller from the
 * live session (bug-hunt mode + hunt-contract-007), never from the
 * request. The drift payload never crosses the wire; callers validate
 * against it and return assertion lists only.
 */
export function selectProviderFixture(
  fixtureId: ProviderFixtureId,
  hunt007Active: boolean,
): Record<string, unknown> {
  switch (fixtureId) {
    case 'provider-product-v1':
      return { ...PROVIDER_PRODUCT_V1_PAYLOAD }
    case 'provider-product-v2-compatible':
      return { ...PROVIDER_PRODUCT_V2_COMPATIBLE_PAYLOAD }
    case 'provider-product-v2-drift':
      return { ...CONTRACT_DRIFT_PAYLOAD }
    case 'provider-product-v2-latest':
      return hunt007Active ? { ...CONTRACT_DRIFT_PAYLOAD } : { ...PROVIDER_PRODUCT_V2_COMPATIBLE_PAYLOAD }
  }
}
