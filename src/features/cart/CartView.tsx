// Presentational cart experience — everything except fetch/context wiring.
// The page passes server-recomputed state and the dispatch callbacks; this
// component renders honest loading, empty, error and ready states and every
// total shown is the server's figure.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MAX_LINE_QUANTITY,
  type CartLine,
  type CartResponse,
} from '../../shared/commerce'
import { formatPriceCents, stockStatusLabels } from '../../lib/shop'
import { Breadcrumbs } from '../../components/ui/PageChrome'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States'
import { Callout } from '../../components/ui/Callout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { CartActionResult } from './useCart'

export interface CartViewProps {
  status: 'loading' | 'ready' | 'error'
  errorMessage?: string | null
  cart: CartResponse | null
  pending: boolean
  onRetry: () => void
  onSetQuantity: (lineId: number, quantity: number) => Promise<CartActionResult>
  onRemove: (lineId: number) => Promise<CartActionResult>
  onClear: () => Promise<CartActionResult>
}

function CartLineRow({
  line,
  pending,
  onSetQuantity,
  onRemove,
}: {
  line: CartLine
  pending: boolean
  onSetQuantity: CartViewProps['onSetQuantity']
  onRemove: CartViewProps['onRemove']
}) {
  const [draft, setDraft] = useState(String(line.quantity))
  const [lastQuantity, setLastQuantity] = useState(line.quantity)
  const [error, setError] = useState<string | null>(null)

  if (line.quantity !== lastQuantity) {
    // Server state changed — re-sync the draft (derived-state pattern).
    setLastQuantity(line.quantity)
    setDraft(String(line.quantity))
    setError(null)
  }

  const inputLabel = `Quantity for ${line.name}`
  // Never invite more than the known stock ceiling or the hard cap.
  const increaseLimit = Math.min(Math.max(line.availableStock, line.quantity), MAX_LINE_QUANTITY)
  const increaseDisabled = pending || line.quantity >= increaseLimit
  const decreaseDisabled = pending || line.quantity <= 1

  async function commit(next: number) {
    if (!Number.isInteger(next) || next < 1 || next > MAX_LINE_QUANTITY) {
      setError(`Enter a whole number from 1 to ${MAX_LINE_QUANTITY}.`)
      setDraft(String(line.quantity))
      return
    }
    const result = await onSetQuantity(line.id, next)
    if (!result.ok) {
      setError(result.message)
      setDraft(String(line.quantity))
      return
    }
    setError(null)
  }

  async function handleInputCommit() {
    const parsed = Number(draft)
    if (!Number.isInteger(parsed)) {
      setError(`Enter a whole number from 1 to ${MAX_LINE_QUANTITY}.`)
      setDraft(String(line.quantity))
      return
    }
    await commit(parsed)
  }

  async function handleRemove() {
    const result = await onRemove(line.id)
    if (!result.ok) {
      setError(result.message)
    }
  }

  const unavailableNote = !line.productActive
    ? 'This product is no longer available. Checkout will not accept this line.'
    : line.exceedsStock
      ? line.availableStock === 0
        ? 'This product is out of stock. Checkout will not accept this line.'
        : `Only ${line.availableStock} in stock — reduce the quantity to continue.`
      : null

  return (
    <li className="cart-line">
      <div className="cart-line-main">
        <p className="cart-line-name">
          <Link to={`/shop/products/${line.slug}`}>{line.name}</Link>
        </p>
        <span className="cart-line-meta">
          {formatPriceCents(line.unitPriceCents)} each ·{' '}
          <span className={`stock-tag stock-${line.stockStatus}`}>
            <span className="stock-dot" aria-hidden="true" />
            {stockStatusLabels[line.stockStatus]}
          </span>
        </span>
        {unavailableNote ? (
          <p className="cart-line-note" role="alert">
            <Icon name="alert" size={15} />
            <span>{unavailableNote}</span>
          </p>
        ) : null}
        {error ? (
          <p className="cart-line-note" role="alert">
            <Icon name="alert" size={15} />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      <div className="cart-qty">
        <button
          type="button"
          className="cart-qty-button"
          onClick={() => void commit(line.quantity - 1)}
          disabled={decreaseDisabled}
          aria-label={`Decrease quantity of ${line.name}`}
        >
          <Icon name="minus" size={15} />
        </button>
        <input
          className="cart-qty-input"
          type="number"
          min={1}
          max={MAX_LINE_QUANTITY}
          step={1}
          inputMode="numeric"
          value={draft}
          aria-label={inputLabel}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void handleInputCommit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleInputCommit()
            } else if (event.key === 'Escape') {
              setDraft(String(line.quantity))
              setError(null)
              event.currentTarget.blur()
            }
          }}
        />
        <button
          type="button"
          className="cart-qty-button"
          onClick={() => void commit(line.quantity + 1)}
          disabled={increaseDisabled}
          aria-label={`Increase quantity of ${line.name}`}
        >
          <Icon name="plus" size={15} />
        </button>
      </div>

      <p className="cart-line-total" aria-label={`Line total for ${line.name}`}>
        {formatPriceCents(line.lineTotalCents)}
      </p>

      <div>
        <button
          type="button"
          className="link-button cart-remove"
          onClick={() => void handleRemove()}
          disabled={pending}
          aria-label={`Remove ${line.name} from the cart`}
        >
          Remove
        </button>
      </div>
    </li>
  )
}

export function CartView({
  status,
  errorMessage,
  cart,
  pending,
  onRetry,
  onSetQuantity,
  onRemove,
  onClear,
}: CartViewProps) {
  const [clearError, setClearError] = useState<string | null>(null)

  async function handleClear() {
    const result = await onClear()
    setClearError(result.ok ? null : result.message)
  }

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Shop', to: '/shop' },
          { label: 'Cart' },
        ]}
      />

      <PageHeader
        eyebrow="Meridian Outfitters"
        title="Your cart"
        description="A practice cart scoped to this browser session. Prices and totals are recalculated on the server for every change."
      />

      <p className="catalogue-availability">
        Session cart · server-calculated totals · simulated payment at checkout
      </p>

      {status === 'loading' ? <LoadingState label="Loading your cart…" /> : null}

      {status === 'error' ? (
        <ErrorState
          title="The cart could not be loaded"
          description={
            <>
              {errorMessage ?? 'The practice API could not be reached.'} Check that the practice
              API is running, then try again.
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

      {status === 'ready' && cart && cart.items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Browse the Meridian Outfitters practice storefront and add something to your cart."
          icon="cart"
          action={
            <Link className="button button-small" to="/shop">
              <Icon name="shop" size={15} />
              Browse the shop
            </Link>
          }
        />
      ) : null}

      {status === 'ready' && cart && cart.items.length > 0 ? (
        <>
          {cart.hasUnavailableItems ? (
            <Callout tone="warning" title="Some lines can’t be fulfilled">
              One or more lines reference a product that is out of stock or no longer available.
              Checkout will not accept them. Adjust or remove the affected
              lines.
            </Callout>
          ) : null}

          <div className="cart-layout">
            <ul className="cart-list" aria-label="Cart lines">
              {cart.items.map((line) => (
                <CartLineRow
                  key={line.id}
                  line={line}
                  pending={pending}
                  onSetQuantity={onSetQuantity}
                  onRemove={onRemove}
                />
              ))}
            </ul>

            <aside className="cart-summary" aria-label="Cart summary">
              <p className="cart-summary-title">Summary</p>

              <div className="cart-summary-row">
                <span>Items ({cart.itemCount})</span>
                <strong>{formatPriceCents(cart.subtotalCents)}</strong>
              </div>
              <div className="cart-summary-total">
                <span>Cart total</span>
                <strong>{formatPriceCents(cart.totalCents)}</strong>
              </div>

              <p className="cart-summary-note">
                This cart is scoped to your browser session and disappears when the session expires
                or cookies are cleared. Checkout is simulated — you choose whether the fictional
                payment is approved or declined.
              </p>

              {clearError ? (
                <p className="cart-line-note" role="alert">
                  <Icon name="alert" size={15} />
                  <span>{clearError}</span>
                </p>
              ) : null}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleClear()}
                loading={pending}
              >
                <Icon name="reset" size={15} />
                Clear cart
              </Button>
              {cart.hasUnavailableItems ? (
                <p className="cart-line-note">
                  <Icon name="alert" size={15} />
                  <span>Adjust the highlighted lines to unlock checkout.</span>
                </p>
              ) : (
                <Link className="button button-small" to="/checkout">
                  <Icon name="lock" size={15} />
                  Proceed to checkout
                </Link>
              )}
              <Link className="button button-secondary button-small" to="/shop">
                <Icon name="arrow-right" size={15} />
                Continue shopping
              </Link>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  )
}
