import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../../shared/commerce'
import { formatPriceCents, stockStatusLabels } from '../../lib/shop'
import { useCart } from '../cart/useCart'
import { Meta } from '../../components/ui/Meta'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'

export function ProductCard({ product }: { product: Product }) {
  const { addItem, pending } = useCart()
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const outOfStock = product.stockStatus === 'out_of_stock'

  useEffect(() => {
    if (!added) return
    const timeout = window.setTimeout(() => setAdded(false), 2400)
    return () => window.clearTimeout(timeout)
  }, [added])

  async function handleAdd() {
    setAdding(true)
    setError(null)
    const result = await addItem(product.slug, 1)
    setAdding(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setAdded(true)
  }

  return (
    <article className="product-card">
      <h3>
        <Link to={`/shop/products/${product.slug}`}>{product.name}</Link>
      </h3>
      <p className="product-description">{product.description}</p>

      <div className="product-card-foot">
        <p className="product-price">{formatPriceCents(product.priceCents)}</p>
        <span className={`stock-tag stock-${product.stockStatus}`}>
          <span className="stock-dot" aria-hidden="true" />
          {stockStatusLabels[product.stockStatus]}
        </span>
      </div>

      <Meta>
        <span className="meta-item">{product.categoryName}</span>
      </Meta>

      <div className="product-card-actions">
        <Button
          size="sm"
          variant={outOfStock ? 'secondary' : 'primary'}
          onClick={() => void handleAdd()}
          disabled={outOfStock || pending || adding}
          loading={adding}
        >
          {outOfStock ? (
            'Out of stock'
          ) : added ? (
            <>
              <Icon name="check" size={15} />
              Added to cart
            </>
          ) : (
            <>
              <Icon name="cart" size={15} />
              Add to cart
            </>
          )}
        </Button>
        {error ? (
          <p className="cart-line-note" role="alert">
            <Icon name="alert" size={15} />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </article>
  )
}
