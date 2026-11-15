import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { fetchAccountOrder, AuthApiError } from '../features/auth/api'
import type { OrderDetail } from '../shared/commerce'
import { OrderConfirmationView } from '../features/checkout/OrderConfirmationView'
import { useCancelOrder } from '../features/checkout/useCancelOrder'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, LoadingState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const ORDER_REFERENCE_PATTERN = /^ORD-[0-9A-F]{16}$/

export function AccountOrderDetailPage() {
  useDocumentTitle('Order details')
  const { reference = '' } = useParams<{ reference: string }>()
  const { loadState, customer, refresh } = useAuth()

  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const signedIn = loadState.status === 'ready' && customer !== null
  const wellFormed = ORDER_REFERENCE_PATTERN.test(reference)

  // Hooks must run unconditionally on every render — this cancel flow is
  // only wired to the UI when the loaded order is yours to cancel.
  const cancelFlow = useCancelOrder(
    reference,
    useCallback((cancelled: OrderDetail) => setOrder(cancelled), []),
  )

  useEffect(() => {
    if (!signedIn || !wellFormed) {
      return
    }
    const controller = new AbortController()
    fetchAccountOrder(reference, controller.signal)
      .then((detail) => {
        setOrder(detail)
        setStatus(detail ? 'ready' : 'notfound')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AuthApiError && error.status === 401) {
          setStatus('loading')
          refresh()
          return
        }
        setErrorMessage(
          error instanceof Error ? error.message : 'The order could not be loaded.',
        )
        setStatus('error')
      })
    return () => controller.abort()
  }, [signedIn, wellFormed, reference, attempt, refresh])

  if (loadState.status === 'loading') {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Account', to: '/account' },
            { label: 'Order details' },
          ]}
        />
        <PageHeader eyebrow="Meridian Outfitters" title="Order details" />
        <LoadingState label="Loading your order…" />
      </div>
    )
  }

  if (!signedIn) {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Account', to: '/account' },
            { label: 'Order details' },
          ]}
        />
        <PageHeader
          eyebrow="Meridian Outfitters"
          title="Order details"
          description="Orders are protected customer resources — sign in to view the order history owned by your synthetic account."
        />
        <p className="catalogue-availability">
          Protected resource · sign-in required · synthetic data
        </p>
        <EmptyState
          title="Sign in to view this order"
          description="An order can only be read by the account that owns it. Sign in with the fictional account that placed the order."
          icon="lock"
          action={
            <Link className="button button-small" to="/login">
              <Icon name="lock" size={15} />
              Sign in with a demo account
            </Link>
          }
        />
      </div>
    )
  }

  const effectiveStatus: 'loading' | 'ready' | 'notfound' | 'error' = !wellFormed
    ? 'notfound'
    : status

  return (
    <OrderConfirmationView
      status={effectiveStatus}
      errorMessage={errorMessage}
      order={order}
      onRetry={() => {
        setStatus('loading')
        setAttempt((value) => value + 1)
      }}
      onCancel={effectiveStatus === 'ready' ? cancelFlow.requestCancel : undefined}
      cancelState={cancelFlow.status}
      cancelError={cancelFlow.errorMessage}
      onCancelConfirm={() => void cancelFlow.confirmCancel()}
      onCancelDismiss={cancelFlow.dismiss}
      crumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Account', to: '/account' },
        { label: 'Order history', to: '/account/orders' },
        { label: reference },
      ]}
    />
  )
}
