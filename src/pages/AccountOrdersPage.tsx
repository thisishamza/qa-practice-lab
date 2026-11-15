import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { fetchAccountOrders, AuthApiError } from '../features/auth/api'
import type { OrderSummary } from '../shared/commerce'
import { formatPriceCents } from '../lib/shop'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadingState, EmptyState, ErrorState } from '../components/ui/States'
import { Tag } from '../components/ui/Tag'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { useDocumentTitle } from '../lib/useDocumentTitle'

function createdLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function AccountOrdersPage() {
  useDocumentTitle('Order history')
  const { loadState, customer, refresh } = useAuth()

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const signedIn = loadState.status === 'ready' && customer !== null
  const effectiveStatus: 'loading' | 'ready' | 'error' | 'guest' =
    loadState.status === 'loading'
      ? 'loading'
      : loadState.status === 'error'
        ? 'error'
        : !signedIn
          ? 'guest'
          : status

  useEffect(() => {
    if (!signedIn) {
      return
    }
    const controller = new AbortController()
    fetchAccountOrders(controller.signal)
      .then((data) => {
        setOrders(data)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AuthApiError && error.status === 401) {
          // Session expired mid-visit — refresh the auth context, which
          // re-enters the guest state rather than trusting stale identity.
          setStatus('loading')
          refresh()
          return
        }
        setErrorMessage(
          error instanceof Error ? error.message : 'Your order history could not be loaded.',
        )
        setStatus('error')
      })
    return () => controller.abort()
  }, [signedIn, attempt, refresh])

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Account', to: '/account' },
          { label: 'Order history' },
        ]}
      />

      <PageHeader
        eyebrow="Meridian Outfitters"
        title="Order history"
        description="Practice orders placed while signed in as this synthetic customer. Orders placed as a guest stay with your practice session and are never adopted by a later sign-in."
      />

      <p className="catalogue-availability">
        Synthetic order history · no real purchases · session-bound ownership
      </p>

      {effectiveStatus === 'loading' ? <LoadingState label="Loading your orders…" /> : null}

      {effectiveStatus === 'guest' ? (
        <EmptyState
          title="Sign in to see order history"
          description="Order history is a protected customer resource. Sign in with a fictional demo account to see the orders that account owns."
          icon="lock"
          action={
            <Link className="button button-small" to="/login">
              <Icon name="lock" size={15} />
              Sign in with a demo account
            </Link>
          }
        />
      ) : null}

      {effectiveStatus === 'error' ? (
        <ErrorState
          title={loadState.status === 'error' ? 'Your account could not be loaded' : 'Your order history could not be loaded'}
          description={`${
            errorMessage ??
            (loadState.status === 'error'
              ? loadState.message
              : 'The practice API could not be reached.')
          } Check the API is running, then try again.`}
          action={
            <Button size="sm" onClick={() => (loadState.status === 'error' ? refresh() : setAttempt((value) => value + 1))}>
              <Icon name="reset" size={15} />
              Try again
            </Button>
          }
        />
      ) : null}

      {effectiveStatus === 'ready' && orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Place a practice order while signed in and it will appear here. Checkout is simulated — nothing is paid for or shipped."
          icon="cart"
          action={
            <Link className="button button-small" to="/shop">
              <Icon name="shop" size={15} />
              Browse the shop
            </Link>
          }
        />
      ) : null}

      {effectiveStatus === 'ready' && orders.length > 0 ? (
        <ul className="order-history">
          {orders.map((order) => (
            <li key={order.reference} className="order-history-row">
              <div className="order-history-main">
                <Link className="order-history-reference" to={`/account/orders/${order.reference}`}>
                  {order.reference}
                </Link>
                <span className="order-history-date">{createdLabel(order.createdAt)}</span>
              </div>
              <div className="order-history-meta">
                <span className="order-history-summary">
                  {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} ·{' '}
                  {formatPriceCents(order.totalCents)}
                </span>
                <Tag tone={order.paymentStatus === 'approved' ? 'ready' : 'warn'}>
                  Payment: {order.paymentStatus === 'approved' ? 'Approved' : 'Declined'}
                </Tag>
                <Tag tone="neutral">Status: {order.status === 'placed' ? 'Placed' : order.status}</Tag>
              </div>
              <Icon name="chevron-right" size={18} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
