/**
 * Route classification for the Meridian commerce Practice App.
 *
 * The Practice App is the fictional shop under test. Its surfaces — the
 * storefront and product pages, cart, checkout, order confirmation, the
 * shop-side account and staff inventory flows, and the demo login — share
 * one trait: commerce chrome (the cart button and badge, and the
 * clean/bug-hunt mode banner) only makes sense there. Unrelated QA labs,
 * learning and meta pages must not render it.
 *
 * Prefix matching is boundary-aware (`/cart` matches `/cart` and
 * `/cart/…` but not `/carts`), so sibling prefixes never collide.
 */
export const COMMERCE_ROUTE_PREFIXES = [
  '/shop',
  '/cart',
  '/checkout',
  '/orders',
  '/account',
  '/admin/inventory',
  '/login',
] as const

export function isCommerceRoute(pathname: string): boolean {
  return COMMERCE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
