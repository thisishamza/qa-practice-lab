import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { CartLine, CartResponse, Product } from '../../src/shared/commerce'
import { CartView } from '../../src/features/cart/CartView'
import { ProductCard } from '../../src/features/shop/ProductCard'
import { ProductDetail } from '../../src/features/shop/ProductDetail'
import { CartProvider } from '../../src/features/cart/CartContext'

const inStockLine: CartLine = {
  id: 11,
  productId: 3,
  slug: 'sequoia-sleeping-bag',
  name: 'Sequoia Sleeping Bag',
  unitPriceCents: 12950,
  currency: 'USD',
  quantity: 2,
  lineTotalCents: 25900,
  stockStatus: 'in_stock',
  productActive: true,
  availableStock: 30,
  exceedsStock: false,
  available: true,
}

const lowStockLine: CartLine = {
  ...inStockLine,
  id: 12,
  productId: 20,
  slug: 'lumen-usb-bike-light-set',
  name: 'Lumen USB Bike Light Set',
  unitPriceCents: 4590,
  quantity: 4,
  lineTotalCents: 18360,
  stockStatus: 'low_stock',
  availableStock: 4,
}

const deactivatedLine: CartLine = {
  ...inStockLine,
  id: 13,
  productId: 41,
  slug: 'nightbeam-legacy-torch',
  name: 'Nightbeam Legacy Torch',
  unitPriceCents: 2990,
  quantity: 1,
  lineTotalCents: 2990,
  productActive: false,
  available: false,
}

const baseCart: CartResponse = {
  items: [inStockLine],
  itemCount: 2,
  subtotalCents: 25900,
  totalCents: 25900,
  currency: 'USD',
  hasUnavailableItems: false,
}

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

const noop = async () => ({ ok: true as const })

function renderView(element: React.ReactElement) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={['/cart']}>{element}</MemoryRouter>)
}

function renderWithCart(element: React.ReactElement) {
  // CartProvider never fetches during SSR (effects do not run), so the markup
  // reflects the initial loading state; mutation callbacks read the context.
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/cart']}>
      <CartProvider>{element}</CartProvider>
    </MemoryRouter>,
  )
}

describe('CartView loading and error states', () => {
  it('renders a labelled loading state and exactly one h1', () => {
    const html = renderView(
      <CartView
        status="loading"
        cart={null}
        pending={false}
        onRetry={vi.fn()}
        onSetQuantity={noop}
        onRemove={noop}
        onClear={noop}
      />,
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('Loading your cart…')
    expect((html.match(/<h1/g) ?? []).length).toBe(1)
  })

  it('renders an error state with role=alert and a retry action', () => {
    const html = renderView(
      <CartView
        status="error"
        errorMessage="The practice API could not be reached."
        cart={null}
        pending={false}
        onRetry={vi.fn()}
        onSetQuantity={noop}
        onRemove={noop}
        onClear={noop}
      />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('The practice API could not be reached.')
    expect(html).toContain('Try again')
  })
})

describe('CartView empty state', () => {
  it('renders an empty cart with a way back to the shop', () => {
    const html = renderView(
      <CartView
        status="ready"
        cart={{ ...baseCart, items: [], itemCount: 0, subtotalCents: 0, totalCents: 0 }}
        pending={false}
        onRetry={vi.fn()}
        onSetQuantity={noop}
        onRemove={noop}
        onClear={noop}
      />,
    )
    expect(html).toContain('Your cart is empty')
    expect(html).toContain('href="/shop"')
    expect(html).toContain('Browse the shop')
  })
})

describe('CartView ready state', () => {
  it('shows line details, quantity controls and server-calculated totals', () => {
    const html = renderView(
      <CartView
        status="ready"
        cart={baseCart}
        pending={false}
        onRetry={vi.fn()}
        onSetQuantity={noop}
        onRemove={noop}
        onClear={noop}
      />,
    )
    expect(html).toContain('Sequoia Sleeping Bag')
    expect(html).toContain('$129.50 each')
    expect(html).toContain('$259.00')
    expect(html).toContain('aria-label="Quantity for Sequoia Sleeping Bag"')
    expect(html).toContain('value="2"')
    expect(html).toContain('aria-label="Decrease quantity of Sequoia Sleeping Bag"')
    expect(html).toContain('aria-label="Increase quantity of Sequoia Sleeping Bag"')
    expect(html).toContain('aria-label="Remove Sequoia Sleeping Bag from the cart"')
    expect(html).toContain('Items (2)')
    expect(html).toContain('Cart total')
    expect(html).toContain('Proceed to checkout')
  })

  it('renders the server figures even when they disagree with a client-side sum', () => {
    const tampered: CartResponse = {
      ...baseCart,
      items: [{ ...inStockLine, lineTotalCents: 1 }],
      subtotalCents: 7777,
      totalCents: 7777,
    }
    const html = renderView(
      <CartView
        status="ready"
        cart={tampered}
        pending={false}
        onRetry={vi.fn()}
        onSetQuantity={noop}
        onRemove={noop}
        onClear={noop}
      />,
    )
    expect(html).toContain('$77.77')
  })

  it('disables the Increase control at the known stock ceiling', () => {
    const html = renderView(
      <CartView
        status="ready"
        cart={{
          ...baseCart,
          items: [lowStockLine],
          itemCount: 4,
          subtotalCents: 18360,
          totalCents: 18360,
        }}
        pending={false}
        onRetry={vi.fn()}
        onSetQuantity={noop}
        onRemove={noop}
        onClear={noop}
      />,
    )
    const increase = html.match(
      /<button\b[^>]*aria-label="Increase quantity of Lumen USB Bike Light Set"[^>]*>/,
    )?.[0]
    expect(increase).toBeDefined()
    expect(increase).toContain('disabled')
  })

  it('warns about unavailable lines and keeps them visible', () => {
    const html = renderView(
      <CartView
        status="ready"
        cart={{
          items: [deactivatedLine],
          itemCount: 1,
          subtotalCents: 2990,
          totalCents: 2990,
          currency: 'USD',
          hasUnavailableItems: true,
        }}
        pending={false}
        onRetry={vi.fn()}
        onSetQuantity={noop}
        onRemove={noop}
        onClear={noop}
      />,
    )
    expect(html).toContain('Some lines can’t be fulfilled')
    expect(html).toContain('no longer available')
    expect(html).toContain('Nightbeam Legacy Torch')
    expect(html).toContain('$29.90')
  })

  it('links each line to its product detail page', () => {
    const html = renderView(
      <CartView
        status="ready"
        cart={baseCart}
        pending={false}
        onRetry={vi.fn()}
        onSetQuantity={noop}
        onRemove={noop}
        onClear={noop}
      />,
    )
    expect(html).toContain('href="/shop/products/sequoia-sleeping-bag"')
  })
})

describe('add-to-cart actions on shop surfaces', () => {
  it('enables Add to cart for in-stock products on the card', () => {
    const html = renderWithCart(<ProductCard product={product} />)
    expect(html).toContain('Add to cart')
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>[^<]*Add to cart/s)
  })

  it('disables Add to cart for out-of-stock products on the card', () => {
    const html = renderWithCart(
      <ProductCard product={{ ...product, stockStatus: 'out_of_stock' }} />,
    )
    expect(html).toContain('Out of stock')
    expect(html).toMatch(/<button[^>]*disabled/s)
  })

  it('enables Add to cart on the product detail page and links the cart', () => {
    const html = renderWithCart(<ProductDetail product={product} />)
    expect(html).toContain('Add to cart')
    expect(html).toContain('href="/cart"')
    expect(html).toContain('aria-label="Increase quantity"')
    expect(html).toContain('aria-label="Decrease quantity"')
    expect(html).toContain('id="product-add-quantity"')
  })

  it('disables quantity controls and Add to cart for out-of-stock products', () => {
    const html = renderWithCart(
      <ProductDetail product={{ ...product, stockStatus: 'out_of_stock' }} />,
    )
    expect(html).toContain('Out of stock')
    expect(html).toMatch(/<button[^>]*id="product-add-quantity"[^>]*disabled|<input[^>]*disabled/s)
  })
})
