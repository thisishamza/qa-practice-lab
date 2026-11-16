// Markup tests for the API reference page. The view is static given the
// parsed contract; the test loads the real served document so the page is
// verified against the artifact learners actually download.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import specRaw from '../../public/openapi.json?raw'
import { ApiReferenceView } from '../../src/features/api-reference/ApiReferenceView'
import type { OpenApiDocument } from '../../src/features/api-reference/contract'

const spec = JSON.parse(specRaw) as OpenApiDocument
const html = renderToStaticMarkup(
  <MemoryRouter>
    <ApiReferenceView spec={spec} />
  </MemoryRouter>,
)

const ALL_OPERATIONS: ReadonlyArray<[string, string]> = [
  ['GET', '/api/v1/products'],
  ['GET', '/api/v1/products/{slug}'],
  ['GET', '/api/v1/categories'],
  ['GET', '/api/v1/cart'],
  ['DELETE', '/api/v1/cart'],
  ['POST', '/api/v1/cart/items'],
  ['PATCH', '/api/v1/cart/items/{id}'],
  ['DELETE', '/api/v1/cart/items/{id}'],
  ['GET', '/api/v1/checkout'],
  ['POST', '/api/v1/checkout'],
  ['GET', '/api/v1/orders'],
  ['GET', '/api/v1/orders/{reference}'],
  ['POST', '/api/v1/orders/{reference}/cancel'],
  ['GET', '/api/v1/auth/accounts'],
  ['POST', '/api/v1/auth/login'],
  ['POST', '/api/v1/auth/logout'],
  ['GET', '/api/v1/auth/me'],
  ['GET', '/api/v1/account'],
  ['GET', '/api/v1/account/orders'],
  ['GET', '/api/v1/account/orders/{reference}'],
  ['GET', '/api/v1/admin/inventory'],
  ['PATCH', '/api/v1/admin/inventory/{productId}'],
  ['GET', '/api/v1/practice/hunts'],
  ['GET', '/api/v1/practice/session'],
  ['POST', '/api/v1/practice/hunts/{huntId}/start'],
  ['POST', '/api/v1/practice/session/reset'],
  ['GET', '/api/v1/practice/hunts/{huntId}/attempt'],
  ['GET', '/api/v1/practice/attempts'],
  ['POST', '/api/v1/practice/hunts/{huntId}/report'],
  ['POST', '/api/v1/practice/hunts/{huntId}/hints'],
  ['GET', '/api/v1/practice/hunts/{huntId}/reveal'],
  ['POST', '/api/v1/practice/hunts/{huntId}/reveal'],
  ['GET', '/api/v1/practice/progress'],
  ['POST', '/api/v1/admin/maintenance/sweep'],
]

describe('ApiReferenceView', () => {
  it('renders a single h1 and the contract download action', () => {
    expect(html).toContain('<h1')
    expect(html).toContain('API Reference')
    expect(html).toContain('href="/openapi.json"')
    expect(html).toContain('download="openapi.json"')
  })

  it('renders every documented operation', () => {
    for (const [method, path] of ALL_OPERATIONS) {
      expect(html, `${method} ${path}`).toContain(path)
    }
  })

  it('renders the error envelope and the no-leak posture honestly', () => {
    expect(html).toContain('{ &quot;error&quot;: string, &quot;message&quot;: string }')
    expect(html).not.toContain('AUTHN-001')
    expect(html).not.toContain('RBAC-001')
    expect(html).not.toContain('MASS-001')
    expect(html.toLowerCase()).not.toContain('defect')
  })

  it('groups endpoints by area and marks staff/operator surfaces', () => {
    for (const group of ['Catalogue', 'Cart', 'Checkout', 'Orders', 'Authentication', 'Account']) {
      expect(html).toContain(group)
    }
    expect(html).toContain('Staff only')
    expect(html).toContain('Operator-only · internal')
  })

  it('links each of the 34 operations into the API Lab', () => {
    const matches = html.match(/\/api-lab\?method=/g) ?? []
    expect(matches).toHaveLength(34)
    expect(html).toContain('/api-lab?method=GET&amp;path=%2Fapi%2Fv1%2Fproducts')
  })

  it('marks sign-in required surfaces', () => {
    expect(html).toContain('Sign-in required')
  })

  it('deep links from the reference into the console for a templated route too', () => {
    expect(html).toContain(encodeURIComponent('/api/v1/orders/{reference}'))
  })
})
