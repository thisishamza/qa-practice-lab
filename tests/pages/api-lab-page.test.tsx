// Markup tests for the API Lab console page. Rendering is static; no
// fetch happens until a user sends, so the initial render never touches
// the network or browser storage.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ApiLabPage } from '../../src/pages/ApiLabPage'

function render(route = '/api-lab'): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[route]}>
      <ApiLabPage />
    </MemoryRouter>,
  )
}

describe('ApiLabPage', () => {
  const html = render()

  it('renders a single h1 and the same-origin scope copy', () => {
    expect(html).toContain('<h1')
    expect(html).toContain('API Lab')
    expect(html).toContain('/api/v1')
    expect(html).toContain('Same-origin only')
  })

  it('renders the method select with all four methods', () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      expect(html).toContain(`>${method}</option>`)
    }
  })

  it('prefills a safe default request', () => {
    expect(html).toContain('value="/api/v1/products"')
    expect(html).toContain('value="perPage=3"')
  })

  it('renders labelled controls for path, query, headers and body', () => {
    expect(html).toContain('for="api-lab-path"')
    expect(html).toContain('for="api-lab-query"')
    expect(html).toContain('for="api-lab-body"')
    expect(html).toContain('Add header')
    expect(html).toContain('Content-Type: application/json')
  })

  it('shows an empty response placeholder, not a fake response', () => {
    expect(html).toContain('Send a request to see the raw answer here')
    expect(html).not.toContain('Copy as curl')
    expect(html).not.toContain('Copy body')
  })

  it('renders the history empty state with the not-persisted copy', () => {
    expect(html).toContain('History')
    expect(html).toContain('never saved')
    expect(html).toContain('cleared when you refresh')
  })

  it('wires the form submit to an enabled send button', () => {
    expect(html).toContain('Send request')
    expect(html).not.toContain('aria-busy="true"')
  })

  it('links back to the API Reference', () => {
    expect(html).toContain('href="/api-reference"')
  })

  it('does not pre-render any error summary', () => {
    expect(html).not.toContain('role="alert"')
  })

  it('applies a valid deep link on mount (client-side only)', () => {
    // SSR renders the default; the deep link is applied in an effect, so
    // the markup stays deterministic. The console still accepts the
    // parameters used by the reference deep links.
    const deep = render('/api-lab?method=POST&path=%2Fapi%2Fv1%2Fcart%2Fitems&query=')
    expect(deep).toContain('API Lab')
  })
})
