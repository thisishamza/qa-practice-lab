// Cancel-order flow shared by the session-scoped confirmation page and the
// account order detail page. The server is the authority: this hook only
// drives UI state and hands the server's answer back to the caller.

import { useCallback, useState } from 'react'
import type { OrderDetail } from '../../shared/commerce'
import { cancelOrder, CheckoutApiError } from './api'

export type CancelOrderStatus = 'idle' | 'confirming' | 'busy' | 'error'

export interface CancelOrderFlow {
  status: CancelOrderStatus
  errorMessage: string | null
  /** Enter the inline confirmation step. */
  requestCancel: () => void
  /** Leave the confirmation step without cancelling. */
  dismiss: () => void
  /** Confirm the cancellation; the server decides the outcome. */
  confirmCancel: () => Promise<void>
}

export function useCancelOrder(
  reference: string,
  onCancelled: (order: OrderDetail) => void,
): CancelOrderFlow {
  const [status, setStatus] = useState<CancelOrderStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const requestCancel = useCallback(() => {
    setErrorMessage(null)
    setStatus('confirming')
  }, [])

  const dismiss = useCallback(() => {
    setErrorMessage(null)
    setStatus('idle')
  }, [])

  const confirmCancel = useCallback(async () => {
    setStatus('busy')
    setErrorMessage(null)
    try {
      const order = await cancelOrder(reference)
      onCancelled(order)
      setStatus('idle')
    } catch (error) {
      setErrorMessage(
        error instanceof CheckoutApiError
          ? error.message
          : 'The order could not be cancelled. Please try again.',
      )
      setStatus('error')
    }
  }, [reference, onCancelled])

  return { status, errorMessage, requestCancel, dismiss, confirmCancel }
}
