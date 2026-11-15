// Cart state shared across the app: the TopBar badge, product cards, the
// product detail page and /cart all read through this provider. The server
// is the source of truth — every mutation replaces local state with the
// server-recomputed cart.

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { CartResponse } from '../../shared/commerce'
import {
  CartApiError,
  addToCart,
  clearCart,
  fetchCart,
  removeCartItem,
  setCartItemQuantity,
} from './api'
import {
  CartContext,
  type CartActionResult,
  type CartLoadState,
} from './cart-context'

function failureMessage(error: unknown, fallback: string): string {
  if (error instanceof CartApiError) {
    return error.message
  }
  return fallback
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [loadState, setLoadState] = useState<CartLoadState>({ status: 'loading' })
  const [cart, setCart] = useState<CartResponse | null>(null)
  const [pending, setPending] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    fetchCart(controller.signal)
      .then((data) => {
        setCart(data)
        setLoadState({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadState({
          status: 'error',
          message: failureMessage(error, 'The cart could not be loaded.'),
        })
      })

    return () => controller.abort()
  }, [attempt])

  const refresh = useCallback(() => {
    setLoadState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const runMutation = useCallback(
    async (
      mutation: () => Promise<CartResponse>,
      fallback: string,
    ): Promise<CartActionResult> => {
      setPending(true)
      try {
        const next = await mutation()
        setCart(next)
        setLoadState({ status: 'ready' })
        return { ok: true }
      } catch (error) {
        return { ok: false, message: failureMessage(error, fallback) }
      } finally {
        setPending(false)
      }
    },
    [],
  )

  const addItem = useCallback(
    (slug: string, quantity = 1) =>
      runMutation(() => addToCart(slug, quantity), 'The product could not be added.'),
    [runMutation],
  )

  const setQuantity = useCallback(
    (lineId: number, quantity: number) =>
      runMutation(
        () => setCartItemQuantity(lineId, quantity),
        'The quantity could not be updated.',
      ),
    [runMutation],
  )

  const removeItem = useCallback(
    (lineId: number) =>
      runMutation(() => removeCartItem(lineId), 'The item could not be removed.'),
    [runMutation],
  )

  const clear = useCallback(
    () => runMutation(() => clearCart(), 'The cart could not be cleared.'),
    [runMutation],
  )

  return (
    <CartContext.Provider
      value={{ loadState, cart, pending, refresh, addItem, setQuantity, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  )
}
