// Route-aware visibility of the top-bar cart affordance (issue #16).
// Rendering is static (renderToStaticMarkup); cart state is supplied through
// a mocked useCart hook, and the theme hook is stubbed so the suite stays
// free of window/document dependencies (tests run in the node environment).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const cartState = { itemCount: 2 }

vi.mock('../../src/lib/useTheme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: () => {}, toggleTheme: () => {} }),
}))

vi.mock('../../src/features/cart/useCart', () => ({
  useCart: () => ({
    loadState: { status: 'ready' as const },
    cart: {
      items: [],
      itemCount: cartState.itemCount,
      subtotalCents: 0,
      totalCents: 0,
      currency: 'USD',
      hasUnavailableItems: false,
    },
    pending: false,
    refresh: () => {},
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }),
}))

vi.mock('../../src/features/auth/useAuth', () => ({
  useAuth: () => ({
    loadState: { status: 'loading' as const },
    customer: null,
    suspended: false,
    refresh: () => {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

import { TopBar } from '../../src/components/layout/TopBar'

function renderAt(pathname: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <TopBar mobileOpen={false} onOpenMobileNav={() => {}} menuButtonRef={{ current: null }} />
    </MemoryRouter>,
  )
}

const COMMERCE_ROUTES = [
  '/shop',
  '/shop/products/ridgeline-2-person-tent',
  '/cart',
  '/checkout',
  '/orders/ABC123',
  '/account',
  '/account/orders',
  '/account/orders/ABC123',
  '/admin/inventory',
  '/login',
] as const

const NON_COMMERCE_ROUTES = [
  '/',
  '/tracks',
  '/scenarios',
  '/progress',
  '/practice',
  '/api-lab',
  '/api-reference',
  '/database/playground',
  '/guides',
  '/about',
  '/contract',
  '/microservices',
] as const

beforeEach(() => {
  cartState.itemCount = 2
})

describe('TopBar cart affordance — commerce routes', () => {
  it.each(COMMERCE_ROUTES)('renders the cart button on %s', (pathname) => {
    const html = renderAt(pathname)
    expect(html).toContain('topbar-cart')
    expect(html).toContain('aria-label="Cart, 2 items"')
  })

  it('renders the live badge count on commerce routes', () => {
    expect(renderAt('/cart')).toContain('<span class="cart-badge" aria-hidden="true">2</span>')
  })

  it('caps the badge at 99+', () => {
    cartState.itemCount = 140
    const html = renderAt('/shop')
    expect(html).toContain('>99+</span>')
  })
})

describe('TopBar cart affordance — non-commerce routes', () => {
  it.each(NON_COMMERCE_ROUTES)('does not render the cart button on %s', (pathname) => {
    const html = renderAt(pathname)
    expect(html).not.toContain('topbar-cart')
    expect(html).not.toContain('Cart, 2 items')
    expect(html).not.toContain('cart-badge')
  })
})

describe('TopBar cart affordance — navigation between route groups', () => {
  it('updates visibility when crossing the commerce boundary', () => {
    expect(renderAt('/security')).not.toContain('topbar-cart')
    expect(renderAt('/shop')).toContain('topbar-cart')
    expect(renderAt('/progress')).not.toContain('topbar-cart')
    expect(renderAt('/cart')).toContain('topbar-cart')
  })
})
