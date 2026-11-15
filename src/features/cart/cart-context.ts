// Shared context object for the practice cart — kept component-free so both
// the provider and the hook can import it without fast-refresh warnings.

import { createContext } from 'react'
import type { CartResponse } from '../../shared/commerce'

export type CartActionResult = { ok: true } | { ok: false; message: string }

export type CartLoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

export interface CartContextValue {
  loadState: CartLoadState
  /** Server-recomputed cart; null until the first load resolves. */
  cart: CartResponse | null
  /** True while a mutation is in flight — use to disable cart controls. */
  pending: boolean
  refresh: () => void
  addItem: (slug: string, quantity?: number) => Promise<CartActionResult>
  setQuantity: (lineId: number, quantity: number) => Promise<CartActionResult>
  removeItem: (lineId: number) => Promise<CartActionResult>
  clear: () => Promise<CartActionResult>
}

export const CartContext = createContext<CartContextValue | null>(null)
