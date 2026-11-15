import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { OrderConfirmationView } from '../features/checkout/OrderConfirmationView'
import { CheckoutApiError, fetchOrder } from '../features/checkout/api'
import type { OrderDetail } from '../shared/commerce'
import { useDocumentTitle } from '../lib/useDocumentTitle'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; order: OrderDetail }
  | { status: 'notfound' }
  | { status: 'error'; message: string }

interface FetchResult {
  key: string
  state: LoadState
}

export function OrderConfirmationPage() {
  useDocumentTitle('Order confirmation')
  const { reference } = useParams<{ reference: string }>()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<FetchResult | null>(null)

  const key = `${reference ?? ''}:${attempt}`

  useEffect(() => {
    if (!reference) {
      return
    }
    const controller = new AbortController()
    const resultKey = `${reference}:${attempt}`

    fetchOrder(reference, controller.signal)
      .then((order) => {
        if (controller.signal.aborted) return
        setResult({
          key: resultKey,
          state: order ? { status: 'ready', order } : { status: 'notfound' },
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResult({
          key: resultKey,
          state: {
            status: 'error',
            message:
              error instanceof CheckoutApiError
                ? error.message
                : 'The practice API could not be reached.',
          },
        })
      })

    return () => controller.abort()
  }, [reference, attempt])

  // Derived state: anything not resolved for the current key renders as loading.
  const state: LoadState = !reference
    ? { status: 'notfound' }
    : result && result.key === key
      ? result.state
      : { status: 'loading' }

  return (
    <OrderConfirmationView
      status={state.status}
      errorMessage={state.status === 'error' ? state.message : null}
      order={state.status === 'ready' ? state.order : null}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  )
}
