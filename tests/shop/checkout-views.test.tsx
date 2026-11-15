import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { CartResponse, OrderDetail } from '../../src/shared/commerce'
import { CheckoutView } from '../../src/features/checkout/CheckoutView'
import { OrderConfirmationView } from '../../src/features/checkout/OrderConfirmationView'

const readyCart: CartResponse = {
  items: [
    {
      id: 11,
      productId: 1,
      slug: 'ridgeline-2-person-tent',
      name: 'Ridgeline 2-Person Tent',
      unitPriceCents: 18999,
      currency: 'USD',
      quantity: 2,
      lineTotalCents: 37998,
      stockStatus: 'in_stock',
      productActive: true,
      availableStock: 24,
      exceedsStock: false,
      available: true,
    },
  ],
  itemCount: 2,
  subtotalCents: 37998,
  totalCents: 37998,
  currency: 'USD',
  hasUnavailableItems: false,
}

const unavailableCart: CartResponse = {
  ...readyCart,
  items: [
    {
      ...readyCart.items[0],
      productActive: false,
      available: false,
    },
  ],
  hasUnavailableItems: true,
}

const order: OrderDetail = {
  reference: 'ORD-0011223344556677',
  status: 'placed',
  paymentStatus: 'approved',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  shippingLine: '12 Analytical Engine Way',
  shippingCity: 'London',
  shippingPostcode: 'N1 9GU',
  subtotalCents: 37998,
  totalCents: 37998,
  itemCount: 2,
  currency: 'USD',
  createdAt: '2026-11-15T12:00:00.000Z',
  items: [
    {
      id: 101,
      productId: 1,
      productSlug: 'ridgeline-2-person-tent',
      productName: 'Ridgeline 2-Person Tent',
      unitPriceCents: 18999,
      currency: 'USD',
      quantity: 2,
      lineTotalCents: 37998,
    },
  ],
}

const noop = () => {}
const asyncNoop = () => Promise.resolve({ ok: false as const, kind: 'declined' as const })

function renderCheckout(overrides: Partial<Parameters<typeof CheckoutView>[0]> = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <CheckoutView
        status="ready"
        cart={readyCart}
        checkoutable
        pending={false}
        onRetry={noop}
        onSubmit={asyncNoop}
        onOrderPlaced={noop}
        {...overrides}
      />
    </MemoryRouter>,
  )
}

function renderConfirmation(overrides: Partial<Parameters<typeof OrderConfirmationView>[0]> = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <OrderConfirmationView status="ready" order={order} onRetry={noop} {...overrides} />
    </MemoryRouter>,
  )
}

describe('CheckoutView', () => {
  it('renders exactly one h1, labelled fields and the simulated payment selector', () => {
    const html = renderCheckout()
    expect((html.match(/<h1/g) ?? []).length).toBe(1)
    expect(html).toContain('Checkout')
    for (const label of [
      'Full name',
      'Email address',
      'Street address',
      'City',
      'Postcode',
    ]) {
      expect(html).toContain(label)
    }
    expect(html).toContain('Simulated payment (practice only)')
    expect(html).toContain('value="approved"')
    expect(html).toContain('value="declined"')
    expect(html).toContain('Place practice order')
    expect(html).toContain('There is no card to enter')
    // No decline notice before the learner submits.
    expect(html).not.toContain('Choose “Approved” and submit again')
  })

  it('preselects the approved outcome with practice-only wording', () => {
    const html = renderCheckout()
    expect(html).toContain('id="checkout-payment-approved"')
    expect(html).toContain('checked=""')
  })

  it('renders server totals and line items', () => {
    const html = renderCheckout()
    expect(html).toContain('Ridgeline 2-Person Tent')
    expect(html).toContain('$379.98')
    expect(html).toContain('Order summary')
  })

  it('blocks placement and shows the fulfilability warning when a line is unavailable', () => {
    const html = renderCheckout({ cart: unavailableCart, checkoutable: false })
    expect(html).toContain('Some lines can’t be fulfilled')
    expect(html).toContain('disabled')
  })

  it('renders the empty-cart state with a link to the shop', () => {
    const emptyCart: CartResponse = {
      ...readyCart,
      items: [],
      itemCount: 0,
      subtotalCents: 0,
      totalCents: 0,
    }
    const html = renderCheckout({ cart: emptyCart, checkoutable: false })
    expect(html).toContain('Your cart is empty')
    expect(html).toContain('/shop')
  })

  it('renders the error state with a retry action', () => {
    const html = renderCheckout({
      status: 'error',
      cart: null,
      checkoutable: false,
      errorMessage: 'D1 unavailable',
    })
    expect(html).toContain('The checkout could not be loaded')
    expect(html).toContain('D1 unavailable')
    expect(html).toContain('Try again')
  })
})

describe('OrderConfirmationView', () => {
  it('renders the reference, statuses and item snapshot with an honest practice notice', () => {
    const html = renderConfirmation()
    expect((html.match(/<h1/g) ?? []).length).toBe(1)
    expect(html).toContain('ORD-0011223344556677')
    expect(html).toContain('Status: Placed')
    expect(html).toContain('Payment (simulated): Approved')
    expect(html).toContain('Ridgeline 2-Person Tent')
    expect(html).toContain('$189.99 each')
    expect(html).toContain('$379.98')
    expect(html).toContain('No real payment was processed')
    expect(html).toContain('snapshot')
    expect(html).toContain('ada@example.com')
  })

  it('never implies a real payment or shipment occurred', () => {
    const html = renderConfirmation()
    expect(html).toContain('nothing will be shipped')
    expect(html).not.toContain('charged to your card')
    expect(html).not.toContain('real payment was captured')
  })

  it('renders the not-found state for unknown or foreign references', () => {
    const html = renderConfirmation({ status: 'notfound', order: null })
    expect(html).toContain('We can’t find that order')
    expect(html).toContain('/shop')
  })

  it('renders the error state with a retry action', () => {
    const html = renderConfirmation({
      status: 'error',
      order: null,
      errorMessage: 'D1 unavailable',
    })
    expect(html).toContain('The order could not be loaded')
    expect(html).toContain('Try again')
  })

  it('renders the loading state', () => {
    const html = renderConfirmation({ status: 'loading', order: null })
    expect(html).toContain('Loading your order')
  })
})
