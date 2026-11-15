import { Link } from 'react-router-dom'
import type { Product } from '../../shared/commerce'
import { formatPriceCents, stockStatusLabels } from '../../lib/shop'
import { SectionHeader } from '../../components/ui/PageChrome'
import { FactList } from '../../components/ui/FactList'
import { Callout } from '../../components/ui/Callout'

/** Presentational product body — everything except fetch/URL plumbing. */
export function ProductDetail({ product }: { product: Product }) {
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
        </div>

        <Callout tone="neutral" title="Practice storefront">
          Meridian Outfitters is a fictional catalogue. Stock and prices are synthetic; cart and
          checkout are not implemented yet.
        </Callout>
      </aside>
    </div>
  )
}
