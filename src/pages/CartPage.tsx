import { useCart } from '../features/cart/useCart'
import { CartView } from '../features/cart/CartView'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function CartPage() {
  useDocumentTitle('Cart')

  const { loadState, cart, pending, refresh, setQuantity, removeItem, clear } = useCart()

  return (
    <CartView
      status={loadState.status}
      errorMessage={loadState.status === 'error' ? loadState.message : null}
      cart={cart}
      pending={pending}
      onRetry={refresh}
      onSetQuantity={setQuantity}
      onRemove={removeItem}
      onClear={clear}
    />
  )
}
