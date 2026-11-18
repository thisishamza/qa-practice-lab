import { describe, expect, it } from 'vitest'
import { COMMERCE_ROUTE_PREFIXES, isCommerceRoute } from '../../src/lib/commerceRoutes'

describe('isCommerceRoute', () => {
  it.each([
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
  ])('treats %s as a commerce (Practice App) route', (pathname) => {
    expect(isCommerceRoute(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/tracks',
    '/tracks/manual-testing',
    '/scenarios',
    '/scenarios/manual-cart-add-quantity',
    '/progress',
    '/practice',
    '/api-lab',
    '/api-reference',
    '/database',
    '/database/playground',
    '/database/exercises/sql-001',
    '/guides',
    '/about',
    '/contract',
    '/contract/validate',
    '/performance',
    '/security',
    '/microservices',
    '/some-unknown-route',
  ])('treats %s as a non-commerce route', (pathname) => {
    expect(isCommerceRoute(pathname)).toBe(false)
  })

  it('does not match on prefix boundaries alone', () => {
    expect(isCommerceRoute('/carts')).toBe(false)
    expect(isCommerceRoute('/shoppers')).toBe(false)
    expect(isCommerceRoute('/accounts')).toBe(false)
    expect(isCommerceRoute('/checkout-page')).toBe(false)
    expect(isCommerceRoute('/loginpage')).toBe(false)
    expect(isCommerceRoute('/admin')).toBe(false)
    expect(isCommerceRoute('/admin/inventory2')).toBe(false)
  })

  it('keeps the prefix list boundary-matched and stable', () => {
    expect([...COMMERCE_ROUTE_PREFIXES]).toEqual([
      '/shop',
      '/cart',
      '/checkout',
      '/orders',
      '/account',
      '/admin/inventory',
      '/login',
    ])
  })
})
