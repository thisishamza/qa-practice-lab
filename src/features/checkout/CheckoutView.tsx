// Presentational checkout experience — fetch/mutation wiring lives in the
// page. Everything shown is either the server-recomputed cart or honestly
// labelled simulation. No real payment, shipping or personal data exists
// here; every figure comes from the server.

import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CartResponse, OrderDetail } from '../../shared/commerce'
import { formatPriceCents, stockStatusLabels } from '../../lib/shop'
import {
  validateCheckoutForm,
  type CheckoutFieldErrors,
  type CheckoutFormValues,
} from '../../lib/checkout'
import { Breadcrumbs } from '../../components/ui/PageChrome'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States'
import { Callout } from '../../components/ui/Callout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'

export type CheckoutSubmitOutcome =
  | { ok: true; order: OrderDetail }
  | { ok: false; kind: 'declined' }
  | { ok: false; kind: 'unavailable'; message: string; lines: Array<{ slug: string; name: string; reason: string; availableStock: number }> }
  | { ok: false; kind: 'fields'; fields: Record<string, string>; message: string }
  | { ok: false; kind: 'empty' }
  | { ok: false; kind: 'error'; message: string }

export interface CheckoutViewProps {
  status: 'loading' | 'ready' | 'error'
  errorMessage?: string | null
  cart: CartResponse | null
  checkoutable: boolean
  pending: boolean
  onRetry: () => void
  onSubmit: (values: CheckoutFormValues, idempotencyKey: string) => Promise<CheckoutSubmitOutcome>
  onOrderPlaced: (order: OrderDetail) => void
}

const initialValues: CheckoutFormValues = {
  customerName: '',
  customerEmail: '',
  shippingLine: '',
  shippingCity: '',
  shippingPostcode: '',
  paymentSimulation: 'approved',
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Extremely unlikely fallback for ancient engines.
  return `iks-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
}

const fieldOrder: Array<keyof CheckoutFormValues> = [
  'customerName',
  'customerEmail',
  'shippingLine',
  'shippingCity',
  'shippingPostcode',
  'paymentSimulation',
]

const fieldIds: Record<keyof CheckoutFormValues, string> = {
  customerName: 'checkout-name',
  customerEmail: 'checkout-email',
  shippingLine: 'checkout-line',
  shippingCity: 'checkout-city',
  shippingPostcode: 'checkout-postcode',
  paymentSimulation: 'checkout-payment-approved',
}

export function CheckoutView({
  status,
  errorMessage,
  cart,
  checkoutable,
  pending,
  onRetry,
  onSubmit,
  onOrderPlaced,
}: CheckoutViewProps) {
  const [values, setValues] = useState<CheckoutFormValues>(initialValues)
  const [errors, setErrors] = useState<CheckoutFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<ReactNode>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const idempotencyKeyRef = useRef<string>(newIdempotencyKey())

  const busy = submitting || pending
  const cartLineCount = cart?.items.length ?? 0

  const focusSummary = () => {
    summaryRef.current?.focus()
  }

  const setValue = (field: keyof CheckoutFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const blurValidate = (field: keyof CheckoutFormValues) => {
    setErrors((prev) => {
      const next = validateCheckoutForm({ ...values })
      if (next[field]) {
        return { ...prev, [field]: next[field] }
      }
      const copy = { ...prev }
      delete copy[field]
      return copy
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const found = validateCheckoutForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setNotice(null)
      // Error summary renders with tabIndex -1; wait a paint so it exists.
      requestAnimationFrame(focusSummary)
      return
    }

    setSubmitting(true)
    setNotice(null)
    try {
      const outcome = await onSubmit(values, idempotencyKeyRef.current)
      // A settled response means the key has done its job — rotate for the
      // next deliberate submission. Network failures keep the key so a
      // retry replays instead of duplicating.
      idempotencyKeyRef.current = newIdempotencyKey()
      if (outcome.ok) {
        onOrderPlaced(outcome.order)
        return
      }
      switch (outcome.kind) {
        case 'declined':
          setNotice(
            <Callout tone="danger" title="Simulated payment declined">
              The practice gateway declined the payment. No order was placed, no stock was
              reserved and your cart is unchanged — nothing in this storefront handles real
              money. Choose “Approved” and submit again to place the practice order.
            </Callout>,
          )
          break
        case 'unavailable':
          setNotice(
            <Callout tone="warning" title="Some lines can’t be fulfilled">
              {outcome.message} Go back to the{' '}
              <Link to="/cart">cart</Link>, adjust the affected lines, and try again — your cart
              has not been changed.
              {outcome.lines.length > 0 ? (
                <ul className="checkout-blocking-lines">
                  {outcome.lines.map((line) => (
                    <li key={line.slug}>
                      {line.name} —{' '}
                      {line.reason === 'inactive'
                        ? 'no longer available'
                        : line.reason === 'out_of_stock'
                          ? 'out of stock'
                          : `only ${line.availableStock} in stock`}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Callout>,
          )
          break
        case 'fields':
          setErrors((prev) => ({ ...prev, ...outcome.fields }))
          setNotice(
            <Callout tone="warning" title="Check the highlighted fields">
              {outcome.message}
            </Callout>,
          )
          break
        case 'empty':
          setNotice(
            <Callout tone="info" title="Your cart is empty">
              There is nothing to check out yet.{' '}
              <Link to="/shop">Browse the shop</Link> and add an item first.
            </Callout>,
          )
          break
        default:
          setNotice(
            <Callout tone="danger" title="The order could not be placed">
              {outcome.message}
            </Callout>,
          )
      }
    } catch {
      // Network-level failure: keep the same idempotency key so Retry is a
      // legitimate replay, not a second order.
      setNotice(
        <Callout tone="danger" title="The order could not be placed">
          The practice API could not be reached. Your cart is unchanged; nothing was charged or
          ordered. Check the API is running, then try again.
        </Callout>,
      )
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (field: keyof CheckoutFormValues) => errors[field]
  const showErrorSummary = Object.values(errors).some(Boolean)

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Shop', to: '/shop' },
          { label: 'Cart', to: '/cart' },
          { label: 'Checkout' },
        ]}
      />

      <PageHeader
        eyebrow="Meridian Outfitters"
        title="Checkout"
        description="A practice checkout for a fictional storefront. Every figure is calculated on the server; no real payment, delivery or personal data is involved."
      />

      <p className="catalogue-availability">
        Practice checkout · simulated payment · server-calculated totals
      </p>

      {status === 'loading' ? <LoadingState label="Loading your cart…" /> : null}

      {status === 'error' ? (
        <ErrorState
          title="The checkout could not be loaded"
          description={
            <>
              {errorMessage ?? 'The practice API could not be reached.'} Check that the practice API
              is running, then try again.
            </>
          }
          action={
            <Button size="sm" onClick={onRetry}>
              <Icon name="reset" size={15} />
              Try again
            </Button>
          }
        />
      ) : null}

      {status === 'ready' && cart && cartLineCount === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="There is nothing to check out yet. Browse the Meridian Outfitters practice storefront and add something first."
          icon="cart"
          action={
            <Link className="button button-small" to="/shop">
              <Icon name="shop" size={15} />
              Browse the shop
            </Link>
          }
        />
      ) : null}

      {status === 'ready' && cart && cartLineCount > 0 ? (
        <>
          {!checkoutable ? (
            <Callout tone="warning" title="Some lines can’t be fulfilled">
              One or more lines reference a product that is out of stock or no longer available, so
              the order cannot be placed. Adjust those lines in the{' '}
              <Link to="/cart">cart</Link> first.
            </Callout>
          ) : null}

          {notice ? <div role="alert">{notice}</div> : null}

          {showErrorSummary ? (
            <div
              className="checkout-error-summary"
              role="alert"
              tabIndex={-1}
              ref={summaryRef}
              aria-labelledby="checkout-error-title"
            >
              <h2 id="checkout-error-title">There is a problem</h2>
              <ul>
                {fieldOrder
                  .filter((field) => errors[field])
                  .map((field) => (
                    <li key={field}>
                      <a href={`#${fieldIds[field]}`}>{errors[field]}</a>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="cart-layout">
            <form className="checkout-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
              <fieldset className="checkout-fieldset">
                <legend className="checkout-legend">Your details</legend>
                <p className="checkout-hint">
                  Synthetic information only — do not enter a real address or email. Nothing is
                  sent anywhere.
                </p>

                <div className="checkout-field">
                  <label htmlFor="checkout-name">Full name</label>
                  <input
                    id="checkout-name"
                    name="customerName"
                    type="text"
                    autoComplete="name"
                    value={values.customerName}
                    aria-invalid={Boolean(fieldError('customerName')) || undefined}
                    aria-describedby={fieldError('customerName') ? 'checkout-name-error' : undefined}
                    onChange={(event) => setValue('customerName', event.target.value)}
                    onBlur={() => blurValidate('customerName')}
                  />
                  {fieldError('customerName') ? (
                    <p className="checkout-field-error" id="checkout-name-error" role="alert">
                      {fieldError('customerName')}
                    </p>
                  ) : null}
                </div>

                <div className="checkout-field">
                  <label htmlFor="checkout-email">Email address</label>
                  <input
                    id="checkout-email"
                    name="customerEmail"
                    type="email"
                    autoComplete="email"
                    value={values.customerEmail}
                    aria-invalid={Boolean(fieldError('customerEmail')) || undefined}
                    aria-describedby={fieldError('customerEmail') ? 'checkout-email-error' : undefined}
                    onChange={(event) => setValue('customerEmail', event.target.value)}
                    onBlur={() => blurValidate('customerEmail')}
                  />
                  {fieldError('customerEmail') ? (
                    <p className="checkout-field-error" id="checkout-email-error" role="alert">
                      {fieldError('customerEmail')}
                    </p>
                  ) : null}
                </div>

                <div className="checkout-field">
                  <label htmlFor="checkout-line">Street address</label>
                  <input
                    id="checkout-line"
                    name="shippingLine"
                    type="text"
                    autoComplete="street-address"
                    value={values.shippingLine}
                    aria-invalid={Boolean(fieldError('shippingLine')) || undefined}
                    aria-describedby={fieldError('shippingLine') ? 'checkout-line-error' : undefined}
                    onChange={(event) => setValue('shippingLine', event.target.value)}
                    onBlur={() => blurValidate('shippingLine')}
                  />
                  {fieldError('shippingLine') ? (
                    <p className="checkout-field-error" id="checkout-line-error" role="alert">
                      {fieldError('shippingLine')}
                    </p>
                  ) : null}
                </div>

                <div className="checkout-field-row">
                  <div className="checkout-field">
                    <label htmlFor="checkout-city">City</label>
                    <input
                      id="checkout-city"
                      name="shippingCity"
                      type="text"
                      autoComplete="address-level2"
                      value={values.shippingCity}
                      aria-invalid={Boolean(fieldError('shippingCity')) || undefined}
                      aria-describedby={fieldError('shippingCity') ? 'checkout-city-error' : undefined}
                      onChange={(event) => setValue('shippingCity', event.target.value)}
                      onBlur={() => blurValidate('shippingCity')}
                    />
                    {fieldError('shippingCity') ? (
                      <p className="checkout-field-error" id="checkout-city-error" role="alert">
                        {fieldError('shippingCity')}
                      </p>
                    ) : null}
                  </div>

                  <div className="checkout-field">
                    <label htmlFor="checkout-postcode">Postcode</label>
                    <input
                      id="checkout-postcode"
                      name="shippingPostcode"
                      type="text"
                      autoComplete="postal-code"
                      value={values.shippingPostcode}
                      aria-invalid={Boolean(fieldError('shippingPostcode')) || undefined}
                      aria-describedby={
                        fieldError('shippingPostcode') ? 'checkout-postcode-error' : undefined
                      }
                      onChange={(event) => setValue('shippingPostcode', event.target.value)}
                      onBlur={() => blurValidate('shippingPostcode')}
                    />
                    {fieldError('shippingPostcode') ? (
                      <p className="checkout-field-error" id="checkout-postcode-error" role="alert">
                        {fieldError('shippingPostcode')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </fieldset>

              <fieldset className="checkout-fieldset">
                <legend className="checkout-legend">Simulated payment (practice only)</legend>
                <p className="checkout-hint">
                  This is a fictional storefront — choosing an outcome is an exercise, not a
                  transaction. There is no card to enter and no money moves.
                </p>

                <div className="checkout-payment-options">
                  <label className="checkout-payment-option" htmlFor="checkout-payment-approved">
                    <input
                      id="checkout-payment-approved"
                      name="paymentSimulation"
                      type="radio"
                      value="approved"
                      checked={values.paymentSimulation === 'approved'}
                      onChange={() => setValue('paymentSimulation', 'approved')}
                    />
                    <span className="checkout-payment-copy">
                      <span className="checkout-payment-title">Approved</span>
                      <span className="checkout-payment-note">
                        The simulated payment is accepted and your practice order is placed.
                      </span>
                    </span>
                  </label>

                  <label className="checkout-payment-option" htmlFor="checkout-payment-declined">
                    <input
                      id="checkout-payment-declined"
                      name="paymentSimulation"
                      type="radio"
                      value="declined"
                      checked={values.paymentSimulation === 'declined'}
                      onChange={() => setValue('paymentSimulation', 'declined')}
                    />
                    <span className="checkout-payment-copy">
                      <span className="checkout-payment-title">Declined</span>
                      <span className="checkout-payment-note">
                        The simulated payment is declined: no order is placed and stock and cart are
                        untouched — useful for practising decline handling.
                      </span>
                    </span>
                  </label>
                </div>
                {fieldError('paymentSimulation') ? (
                  <p className="checkout-field-error" id="checkout-payment-error" role="alert">
                    {fieldError('paymentSimulation')}
                  </p>
                ) : null}
              </fieldset>

              <Button
                type="submit"
                size="md"
                loading={busy}
                disabled={!checkoutable || busy}
              >
                <Icon name="lock" size={15} />
                Place practice order
              </Button>
              <p className="checkout-hint checkout-hint-submit">
                Placing the order changes practice inventory and clears this session’s cart. Nothing
                is charged.
              </p>
            </form>

            <aside className="cart-summary" aria-label="Order summary">
              <p className="cart-summary-title">Order summary</p>
              <ul className="checkout-lines" aria-label="Items in this order">
                {cart.items.map((line) => (
                  <li className="checkout-line" key={line.id}>
                    <span className="checkout-line-name">
                      {line.name} <span className="checkout-line-qty">× {line.quantity}</span>
                    </span>
                    <span className="checkout-line-total">
                      {formatPriceCents(line.lineTotalCents)}
                    </span>
                    <span className={`stock-tag stock-${line.stockStatus}`}>
                      <span className="stock-dot" aria-hidden="true" />
                      {stockStatusLabels[line.stockStatus]}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="cart-summary-row">
                <span>Subtotal ({cart.itemCount} items)</span>
                <strong>{formatPriceCents(cart.subtotalCents)}</strong>
              </div>
              <div className="cart-summary-total">
                <span>Total</span>
                <strong>{formatPriceCents(cart.totalCents)}</strong>
              </div>
              <p className="cart-summary-note">
                No shipping, tax or discounts exist in this practice storefront. The total is the
                sum of the lines, always calculated on the server.
              </p>
              <Link className="button button-ghost button-small" to="/cart">
                <Icon name="cart" size={15} />
                Back to the cart
              </Link>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  )
}
