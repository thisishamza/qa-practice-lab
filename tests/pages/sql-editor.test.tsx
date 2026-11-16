import { createElement } from 'react'
// SSR markup tests for the SqlEditor skeleton (no editor dependency).
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SqlEditor } from '../../src/components/ui/SqlEditor'

const value = "SELECT name, price_cents FROM products WHERE active = 1 -- visible\n'it''s' "

describe('SqlEditor', () => {
  it('renders a labelled textarea over a highlighted pre', () => {
    const markup = renderToStaticMarkup(
      createElement(SqlEditor, { id: 'test-sql', value, onChange: () => {}, onRun: () => {}, ariaDescribedBy: 'hint-id' }),
    )
    expect(markup).toContain('aria-label="SQL editor"')
    expect(markup).toContain('aria-describedby="hint-id"')
    expect(markup).toContain('<textarea')
    expect(markup).toContain('spellCheck="false"')
    expect(markup).toContain('aria-hidden="true"')
  })

  it('renders highlighted tokens as spans, not raw HTML injection', () => {
    const markup = renderToStaticMarkup(
      createElement(SqlEditor, { id: 'test-sql', value: "SELECT '<img>'", onChange: () => {}, onRun: () => {} }),
    )
    expect(markup).not.toContain('<img>')
    expect(markup).toContain('sql-token-string')
    expect(markup).toContain('sql-token-keyword')
  })

  it('marks comments and numbers distinctly', () => {
    const markup = renderToStaticMarkup(
      createElement(SqlEditor, { id: 'test-sql', value: 'SELECT 42 -- answer', onChange: () => {}, onRun: () => {} }),
    )
    expect(markup).toContain('sql-token-number')
    expect(markup).toContain('sql-token-comment')
  })
})
