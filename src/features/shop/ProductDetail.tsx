import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MAX_LINE_QUANTITY, type Product } from '../../shared/commerce'
import { formatPriceCents, stockStatusLabels } from '../../lib/shop'
import { useCart } from '../cart/useCart'
import { SectionHeader } from '../../components/ui/PageChrome'
import { FactList } from '../../components/ui/FactList'
import { Callout } from '../../components/ui/Callout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'

/** Presentational product body — everything except fetch/URL plumbing. */
export function ProductDetail({ product }: { product: Product }) {
  const { addItem, pending } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [draft, setDraft] = useState('1')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const outOfStock = product.stockStatus === 'out_of_stock'

  useEffect(() => {
    if (!added) return
    const timeout = window.setTimeout(() => setAdded(false), 2400)
    return () => window.clearTimeout(timeout)
  }, [added])

  function commitDraft(raw: string) {
    const parsed = Number(raw)
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_LINE_QUANTITY) {
      setQuantity(parsed)
      setError(null)
    }
  }

  async function handleAdd() {
    setAdding(true)
    setError(null)
    const result = await addItem(product.slug, quantity)
    setAdding(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setAdded(true)
  }

  return (
    <div className="detail-layout product-detail">
      <div className="detail-main">
        <section className="content-section" aria-labelledby="product-details">
          <SectionHeader id="product-details" title="Details" />
          <p className="body-copy">{product.description}</p>
        </section>
      </div>

      <aside className="product-aside" aria-label="Purchase summary">
        <div className="product-buy">
          <p className="product-buy-price">
            {formatPriceCents(product.priceCents)}
            <span className="product-buy-currency"> {product.currency}</span>
          </p>
          <span className={`stock-tag stock-${product.stockStatus}`}>
            <span className="stock-dot" aria-hidden="true" />
            {stockStatusLabels[product.stockStatus]}
          </span>
          <FactList
            items={[
              {
                label: 'Category',
                value: (
                  <Link to={`/shop?category=${product.categorySlug}`}>
                    {product.categoryName}
                  </Link>
                ),
              },
              { label: 'Catalogue code', value: <code>{product.slug}</code> },
            ]}
          />

          <div className="product-add-row">
            <label className="product-add-qty-label" htmlFor="product-add-quantity">
              Quantity
            </label>
            <div className="cart-qty">
              <button
                type="button"
                className="cart-qty-button"
                onClick={() => {
                  const next = Math.max(1, quantity - 1)
                  setQuantity(next)
                  setDraft(String(next))
                }}
                disabled={outOfStock || pending || quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Icon name="minus" size={15} />
              </button>
              <input
                id="product-add-quantity"
                className="cart-qty-input"
                type="number"
                min={1}
                max={MAX_LINE_QUANTITY}
                step={1}
                inputMode="numeric"
                value={draft}
                disabled={outOfStock || pending}
                onChange={(event) => {
                  setDraft(event.target.value)
                  commitDraft(event.target.value)
                }}
                onBlur={() => setDraft(String(quantity))}
              />
              <button
                type="button"
                className="cart-qty-button"
                onClick={() => {
                  const next = Math.min(MAX_LINE_QUANTITY, quantity + 1)
                  setQuantity(next)
                  setDraft(String(next))
                }}
                disabled={outOfStock || pending || quantity >= MAX_LINE_QUANTITY}
                aria-label="Increase quantity"
              >
                <Icon name="plus" size={15} />
              </button>
            </div>
          </div>

          <Button
            onClick={() => void handleAdd()}
            loading={adding}
            disabled={outOfStock || pending || adding}
          >
            {outOfStock ? (
              'Out of stock'
            ) : added ? (
              <>
                <Icon name="check" size={16} />
                Added to cart
              </>
            ) : (
              <>
                <Icon name="cart" size={16} />
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
          <Link className="text-link" to="/cart">
            View the cart
            <Icon name="arrow-right" size={14} />
          </Link>
        </div>

        <Callout tone="neutral" title="Practice storefront">
          Meridian Outfitters is a fictional catalogue. Prices, stock, the session cart and
          simulated checkout are synthetic — nothing is really paid for or shipped.
        </Callout>
      </aside>
    </div>
  )
}
