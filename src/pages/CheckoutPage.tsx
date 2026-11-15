import { useNavigate } from 'react-router-dom'
import { useCart } from '../features/cart/useCart'
import { CheckoutView, type CheckoutSubmitOutcome } from '../features/checkout/CheckoutView'
import {
  CheckoutApiError,
  placeOrder,
} from '../features/checkout/api'
import type { CheckoutFormValues } from '../lib/checkout'
import type { OrderDetail } from '../shared/commerce'
import type { PaymentSimulation } from '../shared/commerce'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function CheckoutPage() {
  useDocumentTitle('Checkout')
  const navigate = useNavigate()
  const { loadState, cart, pending, refresh } = useCart()

  const checkoutable =
    cart !== null && cart.items.length > 0 && !cart.hasUnavailableItems

  async function handleSubmit(
    values: CheckoutFormValues,
    idempotencyKey: string,
  ): Promise<CheckoutSubmitOutcome> {
    if (values.paymentSimulation !== 'approved' && values.paymentSimulation !== 'declined') {
      return {
        ok: false,
        kind: 'error',
        message: 'Choose a simulated payment outcome before placing the order.',
      }
    }

    try {
      const order = await placeOrder(
        {
          customerName: values.customerName.trim(),
          customerEmail: values.customerEmail.trim(),
          shippingLine: values.shippingLine.trim(),
          shippingCity: values.shippingCity.trim(),
          shippingPostcode: values.shippingPostcode.trim(),
          paymentSimulation: values.paymentSimulation as PaymentSimulation,
        },
        idempotencyKey,
      )
      return { ok: true, order }
    } catch (error) {
      if (!(error instanceof CheckoutApiError)) {
        // Network-level failure — the view keeps the idempotency key.
        throw error
      }
      switch (error.code) {
        case 'payment_declined':
          return { ok: false, kind: 'declined' }
        case 'cart_unavailable':
          return {
            ok: false,
            kind: 'unavailable',
            message: error.message,
            lines: error.lines ?? [],
          }
        case 'invalid_request':
          return {
            ok: false,
            kind: 'fields',
            fields: error.fields ?? {},
            message: error.message,
          }
        case 'empty_cart':
          return { ok: false, kind: 'empty' }
        default:
          return { ok: false, kind: 'error', message: error.message }
      }
    }
  }

  function handleOrderPlaced(order: OrderDetail) {
    // The server cleared the session cart — sync the badge/context.
    refresh()
    navigate(`/orders/${order.reference}`)
  }

  return (
    <CheckoutView
      status={loadState.status}
      errorMessage={loadState.status === 'error' ? loadState.message : null}
      cart={cart}
      checkoutable={checkoutable}
      pending={pending}
      onRetry={refresh}
      onSubmit={handleSubmit}
      onOrderPlaced={handleOrderPlaced}
    />
  )
}
