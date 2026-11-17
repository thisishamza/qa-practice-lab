// Checkout-flow mini contracts (Phase 7, plan §4.3) — a three-contract
// bundle mirroring CheckoutSummary → CheckoutRequest → OrderDetail
// subsets. Capstone material for `contract-adv-checkout-flow-01`.
// CLIENT-SAFE; every canned capture is VALID against its schema.

export const CHECKOUT_FLOW_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Checkout flow contracts',
  type: 'object',
  components: {
    schemas: {
      CheckoutSummary: {
        type: 'object',
        additionalProperties: false,
        required: ['items', 'totalCents', 'currency'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['productSlug', 'quantity', 'unitPriceCents'],
              properties: {
                productSlug: { type: 'string', minLength: 1 },
                quantity: { type: 'integer', minimum: 1 },
                unitPriceCents: { type: 'integer', minimum: 0 },
              },
            },
          },
          totalCents: { type: 'integer', minimum: 0 },
          currency: { const: 'USD' },
        },
      },
      CheckoutRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['customerName', 'paymentSimulation'],
        properties: {
          customerName: { type: 'string', minLength: 2, maxLength: 100 },
          paymentSimulation: { enum: ['approved', 'declined'] },
        },
      },
      OrderDetail: {
        type: 'object',
        additionalProperties: false,
        required: [
          'reference',
          'status',
          'totalCents',
          'currency',
          'createdAt',
          'items',
        ],
        properties: {
          reference: { type: 'string', pattern: '^ORD-[0-9A-F]{16}$' },
          status: { enum: ['placed', 'cancelled'] },
          totalCents: { type: 'integer', minimum: 0 },
          currency: { const: 'USD' },
          createdAt: { type: 'string', format: 'date-time' },
          cancelledAt: { type: ['string', 'null'], format: 'date-time' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['productSlug', 'quantity', 'unitPriceCents', 'lineTotalCents'],
              properties: {
                productSlug: { type: 'string', minLength: 1 },
                quantity: { type: 'integer', minimum: 1 },
                unitPriceCents: { type: 'integer', minimum: 0 },
                lineTotalCents: { type: 'integer', minimum: 0 },
              },
            },
          },
        },
      },
    },
  },
} as const

export const CHECKOUT_SUMMARY_CAPTURE = {
  items: [
    { productSlug: 'ridgeline-2-person-tent', quantity: 2, unitPriceCents: 34900 },
    { productSlug: 'quartz-chalk-bag', quantity: 1, unitPriceCents: 1890 },
  ],
  totalCents: 71690,
  currency: 'USD',
} as const

export const CHECKOUT_REQUEST_CAPTURE = {
  customerName: 'Amara Demir',
  paymentSimulation: 'approved',
} as const

export const ORDER_DETAIL_CAPTURE = {
  reference: 'ORD-0A1B2C3D4E5F6078',
  status: 'placed',
  totalCents: 71690,
  currency: 'USD',
  createdAt: '2026-11-16T14:03:00Z',
  cancelledAt: null,
  items: [
    {
      productSlug: 'ridgeline-2-person-tent',
      quantity: 2,
      unitPriceCents: 34900,
      lineTotalCents: 69800,
    },
    {
      productSlug: 'quartz-chalk-bag',
      quantity: 1,
      unitPriceCents: 1890,
      lineTotalCents: 1890,
    },
  ],
} as const
