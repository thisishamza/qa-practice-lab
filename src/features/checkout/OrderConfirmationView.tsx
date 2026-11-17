// Presentational order-confirmation experience — refreshing this route
// re-reads the owned order from the server (scoped by the session cookie).
// The confirmation never implies a real payment or shipment took place.

import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import type { OrderDetail } from '../../shared/commerce'
import { formatPriceCents } from '../../lib/shop'
import { Breadcrumbs, type Crumb } from '../../components/ui/PageChrome'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States'
import { Callout } from '../../components/ui/Callout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'

export interface OrderConfirmationViewProps {
  status: 'loading' | 'ready' | 'notfound' | 'error'
  errorMessage?: string | null
  order: OrderDetail | null
  onRetry: () => void
  /** Overrides the default breadcrumb trail (e.g. for the account area). */
  crumbs?: Crumb[]
  /** Shows the inline cancel panel (placed orders only). */
  onCancel?: () => void
  cancelState?: 'idle' | 'confirming' | 'busy' | 'error'
  cancelError?: string | null
  onCancelConfirm?: () => void
  onCancelDismiss?: () => void
}

export function OrderConfirmationView({
  status,
  errorMessage,
  order,
  onRetry,
  crumbs,
  onCancel,
  cancelState = 'idle',
  cancelError = null,
  onCancelConfirm,
  onCancelDismiss,
}: OrderConfirmationViewProps) {
  // Focus management for the destructive confirm panel: entering the
  // confirming state moves focus to the panel (it mounts with role=alert);
  // dismissing it returns focus to the "Cancel this order" button.
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  const hadConfirmRef = useRef(false)

  useEffect(() => {
    if (cancelState !== 'idle') {
      confirmRef.current?.focus()
      hadConfirmRef.current = true
    } else if (hadConfirmRef.current) {
      cancelButtonRef.current?.focus()
      hadConfirmRef.current = false
    }
  }, [cancelState])
  return (
    <div className="stack">
      <Breadcrumbs
        items={
          crumbs ?? [
            { label: 'Dashboard', to: '/' },
            { label: 'Practice App' },
            { label: 'Order confirmation' },
          ]
        }
      />

      <PageHeader
        eyebrow="Meridian Outfitters"
        title="Order confirmation"
        description="Your practice order reference and receipt. Refreshing this page re-reads the order from the server while your session lasts."
      />

      <p className="catalogue-availability">
        Practice confirmation · simulated payment · nothing is paid for or shipped
      </p>

      {status === 'loading' ? <LoadingState label="Loading your order…" /> : null}

      {status === 'error' ? (
        <ErrorState
          title="The order could not be loaded"
          description={
            <>
              {errorMessage ?? 'The practice API could not be reached.'} Check that the practice API
              is running, then try again.
            </>
          }
          action={
            <Button size="sm" onClick={onRetry}>
              <Icon name="reset" size={16} />
              Try again
            </Button>
          }
        />
      ) : null}

      {status === 'notfound' ? (
        <EmptyState
          title="We can’t find that order"
          description="This reference is unknown, mistyped, or not visible to your identity. An order can only be read by the practice session that placed it, or (for signed-in customers) by the account that owns it."
          icon="search"
          action={
            <Link className="button button-small" to="/shop">
              <Icon name="shop" size={16} />
              Back to the shop
            </Link>
          }
        />
      ) : null}

      {status === 'ready' && order ? (
        <>
          {order.status === 'cancelled' ? (
            <Callout tone="info" title="Order cancelled — stock restored">
              This practice order was cancelled. Its items went straight back into inventory;
              nothing was refunded because nothing was charged.
              {order.cancelledAt ? (
                <span className="catalogue-availability">
                  Cancelled {new Date(order.cancelledAt).toLocaleString()}
                </span>
              ) : null}
            </Callout>
          ) : (
            <Callout tone="success" title="Practice order placed">
              The simulated payment was accepted and this practice order was recorded. No real
              payment was processed and nothing will be shipped.
            </Callout>
          )}

          <div className="confirm-reference">
            <div className="confirm-reference-main">
              <p className="cart-summary-title">Order reference</p>
              <p className="confirm-reference-value" aria-label={`Order reference ${order.reference}`}>
                {order.reference}
              </p>
              <p className="cart-summary-note">
                Keep this reference to look the order up. It is opaque — no sequential ids are
                exposed.
              </p>
            </div>
            <div className="confirm-reference-tags">
              <span className="confirm-tag confirm-tag-neutral">
                <Icon name="check" size={16} />
                Status: {order.status === 'placed' ? 'Placed' : 'Cancelled'}
              </span>
              <span className="confirm-tag confirm-tag-success">
                <Icon name="check" size={16} />
                Payment (simulated): {order.paymentStatus === 'approved' ? 'Approved' : order.paymentStatus}
              </span>
            </div>
          </div>

          <div className="cart-layout">
            <section className="confirm-items" aria-label="Items in this order">
              <p className="cart-summary-title">Items</p>
              <ul className="confirm-item-list">
                {order.items.map((item) => (
                  <li className="confirm-item" key={item.id}>
                    <div>
                      <p className="confirm-item-name">{item.productName}</p>
                      <p className="confirm-item-meta">
                        {item.productSlug} · {formatPriceCents(item.unitPriceCents)} each · qty{' '}
                        {item.quantity}
                      </p>
                    </div>
                    <p className="confirm-item-total">{formatPriceCents(item.lineTotalCents)}</p>
                  </li>
                ))}
              </ul>
              <div className="cart-summary-row">
                <span>Subtotal ({order.itemCount} items)</span>
                <strong>{formatPriceCents(order.subtotalCents)}</strong>
              </div>
              <div className="cart-summary-total">
                <span>Total</span>
                <strong>{formatPriceCents(order.totalCents)}</strong>
              </div>
              <p className="cart-summary-note">
                Prices and totals are the snapshot taken when the order was placed; later catalogue
                changes never rewrite them.
              </p>
            </section>

            <aside className="cart-summary" aria-label="Delivery details">
              <p className="cart-summary-title">Delivery (synthetic)</p>
              <dl className="confirm-delivery">
                <div>
                  <dt>Name</dt>
                  <dd>{order.customerName}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{order.customerEmail}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>
                    {order.shippingLine}
                    <br />
                    {order.shippingCity} {order.shippingPostcode}
                  </dd>
                </div>
                <div>
                  <dt>Placed</dt>
                  <dd>{new Date(order.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
              <p className="cart-summary-note">
                These details are synthetic practice data, shown only to the session that placed the
                order. Nothing was emailed or delivered.
              </p>
              <Link className="button button-small" to="/shop">
                <Icon name="shop" size={16} />
                Continue shopping
              </Link>
              <Link className="button button-ghost button-small" to="/">
                Back to the dashboard
              </Link>

              {order.status === 'placed' && onCancel ? (
                <div className="confirm-cancel">
                  {cancelState === 'idle' ? (
                    <>
                      <p className="cart-summary-note">
                        Changed your mind? Cancelling this practice order returns its items to
                        stock. Cancellation is permanent and cannot be undone.
                      </p>
                      <Button
                        ref={cancelButtonRef}
                        variant="danger"
                        size="sm"
                        onClick={onCancel}
                      >
                        <Icon name="reset" size={16} />
                        Cancel this order
                      </Button>
                    </>
                  ) : (
                    <div className="confirm-cancel-confirm" role="alert" ref={confirmRef} tabIndex={-1}>
                      <p>
                        <strong>Cancel this order?</strong>
                        <br />
                        All {order.itemCount} unit{order.itemCount === 1 ? '' : 's'} from this
                        order go back into inventory exactly once. This cannot be undone.
                      </p>
                      <div className="button-row">
                        <Button
                          variant="danger"
                          size="sm"
                          loading={cancelState === 'busy'}
                          onClick={onCancelConfirm}
                        >
                          {cancelState === 'busy' ? 'Cancelling…' : 'Confirm cancellation'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onCancelDismiss}
                          disabled={cancelState === 'busy'}
                        >
                          Keep this order
                        </Button>
                      </div>
                      {cancelState === 'error' && cancelError ? (
                        <p className="cart-line-note" role="alert">
                          <Icon name="alert" size={16} />
                          <span>{cancelError}</span>
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  )
}
