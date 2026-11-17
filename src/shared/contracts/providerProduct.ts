// Provider-product fixtures for Capability C — consumer/provider
// verification (Phase 7, plan §4.5). CLIENT-SAFE except where marked.
//
//   providerProductV1Payload     — the canned v1 provider payload for
//                                  `getProduct` (satisfies the platform
//                                  `Product` contract). Valid by fixture
//                                  integrity test.
//   providerProductV2CompatiblePayload — v1 + an undocumented additive
//                                  `warehouseRank` field (harmless).
//   criticalFields               — learner-visible consumer-critical
//                                  fields metadata for the guided
//                                  expectation editor.
// The drifted (bug-hunt) payload lives server-only in
// src/server/contractDeltas.ts — never in this module.

import type { Product } from '../commerce'

export const PROVIDER_PRODUCT_V1_PAYLOAD: Product = {
  id: 1,
  slug: 'ridgeline-2-person-tent',
  name: 'Ridgeline 2-Person Tent',
  description: 'A three-season dome tent with a vestibule and full-coverage rainfly.',
  categorySlug: 'camping',
  categoryName: 'Camping',
  priceCents: 34900,
  currency: 'USD',
  stockStatus: 'in_stock',
}

export const PROVIDER_PRODUCT_V2_COMPATIBLE_PAYLOAD = {
  ...PROVIDER_PRODUCT_V1_PAYLOAD,
  warehouseRank: 42,
} as const

export const PROVIDER_PRODUCT_CRITICAL_FIELDS = [
  'slug',
  'name',
  'priceCents',
  'currency',
  'stockStatus',
] as const

/** The provider schema slice a consumer expectation is checked against (v1 documentation). Open — providers may add fields freely. */
export const PROVIDER_PRODUCT_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['slug', 'name', 'priceCents', 'currency', 'stockStatus'],
  properties: {
    slug: { type: 'string' },
    name: { type: 'string' },
    priceCents: { type: 'integer', minimum: 0 },
    currency: { const: 'USD' },
    stockStatus: { enum: ['in_stock', 'low_stock', 'out_of_stock'] },
  },
} as const
