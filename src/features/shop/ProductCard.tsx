import { Link } from 'react-router-dom'
import type { Product } from '../../shared/commerce'
import { formatPriceCents, stockStatusLabels } from '../../lib/shop'
import { Meta } from '../../components/ui/Meta'

export function ProductCard({ product }: { product: Product }) {
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
    </article>
  )
}
