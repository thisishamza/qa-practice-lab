import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Product } from '../../src/shared/commerce'
import { ProductCard } from '../../src/features/shop/ProductCard'
import { ProductDetail } from '../../src/features/shop/ProductDetail'
import { CartProvider } from '../../src/features/cart/CartContext'
import { ProductLoading, ProductNotFound, ProductError } from '../../src/features/shop/ProductStates'
import { Pagination } from '../../src/features/shop/Pagination'
import { ShopPage } from '../../src/pages/ShopPage'
import { ShopProductPage } from '../../src/pages/ShopProductPage'

const product: Product = {
  id: 1,
  slug: 'ridgeline-2-person-tent',
  name: 'Ridgeline 2-Person Tent',
  description: 'Freestanding 3-season dome tent with taped seams and two vestibules.',
  categorySlug: 'camping',
  categoryName: 'Camping',
  priceCents: 18999,
  currency: 'USD',
  stockStatus: 'in_stock',
}

const outOfStock: Product = {
  ...product,
  slug: 'driftline-gravel-frameset',
  name: 'Driftline Gravel Frameset',
  categorySlug: 'cycling',
  categoryName: 'Cycling',
  priceCents: 129900,
  stockStatus: 'out_of_stock',
}

function render(element: React.ReactElement) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/shop']}>
      <CartProvider>{element}</CartProvider>
    </MemoryRouter>,
  )
}

describe('ProductCard', () => {
  it('links the product name to the detail route and shows price and stock', () => {
    const html = render(<ProductCard product={product} />)
    expect(html).toContain('href="/shop/products/ridgeline-2-person-tent"')
    expect(html).toContain('Ridgeline 2-Person Tent')
    expect(html).toContain('$189.99')
    expect(html).toContain('In stock')
    expect(html).toContain('Camping')
  })

  it('labels out-of-stock products without relying on colour', () => {
    const html = render(<ProductCard product={outOfStock} />)
    expect(html).toContain('Out of stock')
    expect(html).toContain('$1,299.00')
  })
})

describe('ProductDetail', () => {
  it('renders name, formatted price, stock status, category and currency', () => {
    const html = render(<ProductDetail product={product} />)
    expect(html).toContain('$189.99')
    expect(html).toContain('USD')
    expect(html).toContain('In stock')
    expect(html).toContain('href="/shop?category=camping"')
    expect(html).toContain('Camping')
    expect(html).toContain(product.description)
  })

  it('is honest about the practice storefront and missing checkout', () => {
    const html = render(<ProductDetail product={product} />)
    expect(html).toContain('fictional catalogue')
    expect(html).toContain('simulated checkout')
  })
})

describe('product state views', () => {
  it('renders a loading state with an accessible status', () => {
    const html = render(<ProductLoading />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Loading product…')
  })

  it('renders a not-found view with a way back to the shop', () => {
    const html = render(<ProductNotFound />)
    expect(html).toContain('We could not find that product')
    expect(html).toContain('href="/shop"')
    expect(html).toContain('Back to the shop')
  })

  it('renders an error view with role=alert and a retry action', () => {
    const html = render(<ProductError message="The API is down." onRetry={() => undefined} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('The API is down.')
    expect(html).toContain('Try again')
  })
})

describe('Pagination', () => {
  it('marks the current page and links neighbours with preserved params', () => {
    const html = render(
      <Pagination
        page={2}
        totalPages={4}
        buildPageTo={(target) => `/shop?q=tent&page=${target}`}
      />,
    )
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('href="/shop?q=tent&amp;page=1"')
    expect(html).toContain('href="/shop?q=tent&amp;page=3"')
    expect(html).toContain('aria-label="Page 2, current page"')
  })

  it('renders nothing when there is a single page', () => {
    const html = render(
      <Pagination page={1} totalPages={1} buildPageTo={() => '/shop'} />,
    )
    expect(html).toBe('')
  })
})

describe('shop routes (initial render)', () => {
  it('renders the loading state and exactly one h1 before data arrives', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/shop']}>
        <ShopPage />
      </MemoryRouter>,
    )
    expect(html).toContain('Loading products…')
    expect(html).toContain('<h1>Shop the catalogue</h1>')
    expect(html).toContain('role="search"')
    expect(html.match(/<h1/g)).toHaveLength(1)
  })

  it('renders the product page loading state with one h1', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/shop/products/ridgeline-2-person-tent']}>
        <Routes>
          <Route path="/shop/products/:slug" element={<ShopProductPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Loading product…')
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('href="/shop"')
  })
})
