// Markup tests for the Phase 4 (WP1) curriculum surfaces: the scenario
// detail page's curriculum sections and the static "Recommended path" on
// /practice. Rendering is static (renderToStaticMarkup); the practice
// session context is stubbed so no network calls fire.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PracticeSessionContext } from '../../src/features/practice/practice-context'
import type { PracticeSessionContextValue } from '../../src/features/practice/practice-context'
import { ScenarioDetailPage } from '../../src/pages/ScenarioDetailPage'
import { PracticePage } from '../../src/pages/PracticePage'

const contextStub: PracticeSessionContextValue = {
  loadState: { status: 'ready' },
  mode: 'clean',
  hunt: null,
  busy: null,
  actionError: null,
  refresh: () => {},
  startHunt: async () => true,
  resetSession: async () => true,
}

function renderWithRouter(initialPath: string): string {
  return renderToStaticMarkup(
    <PracticeSessionContext.Provider value={contextStub}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/scenarios/:scenarioId" element={<ScenarioDetailPage />} />
          <Route path="/practice" element={<PracticePage />} />
        </Routes>
      </MemoryRouter>
    </PracticeSessionContext.Provider>,
  )
}

describe('ScenarioDetailPage — curriculum sections', () => {
  const html = renderWithRouter('/scenarios/manual-cart-totals')

  it('renders the curriculum sections for a wired hunt scenario', () => {
    expect(html).toContain('QA concepts practised')
    expect(html).toContain('Suggested investigation focus')
    expect(html).toContain('Expected learning outcomes')
    expect(html).toContain('What a good report covers')
    expect(html).toContain('Skill area')
  })

  it('renders the curriculum content itself', () => {
    expect(html).toContain('Manual testing · calculations &amp; consistency')
    expect(html).toContain('Quantity-dependent arithmetic verification')
    expect(html).toContain('Follow the same order of numbers')
  })

  it('keeps the pre-existing objectives section alongside the new ones', () => {
    expect(html).toContain('Learning objectives')
  })

  it('leaks no defect ids into the markup', () => {
    expect(html).not.toContain('PRICING-001')
  })

  it('renders nothing new for placeholder scenarios', () => {
    const placeholder = renderWithRouter('/scenarios/a11y-checkout-keyboard')
    expect(placeholder).not.toContain('QA concepts practised')
    expect(placeholder).not.toContain('Suggested investigation focus')
    expect(placeholder).not.toContain('What a good report covers')
  })
})

describe('PracticePage — recommended path', () => {
  const html = renderWithRouter('/practice')

  it('renders the recommended path with every wired hunt scenario in order', () => {
    expect(html).toContain('Recommended path')
    const titles = [
      'Bug hunt: adding the same item again does not add up',
      'Bug hunt: the category filter changes nothing',
      'Bug hunt: order line totals at checkout',
      'Bug hunt: shop search misses products that should match',
      'Bug hunt: checkout accepts a blank customer name',
      'Bug hunt: checkout refuses the exact remaining stock',
      'Probe object-level access control',
    ]
    let cursor = -1
    for (const title of titles) {
      const index = html.indexOf(title)
      expect(index, `missing recommended-path entry: ${title}`).toBeGreaterThan(cursor)
      cursor = index
    }
  })

  it('links each recommended step to its scenario detail page', () => {
    expect(html).toContain('/scenarios/manual-cart-add-quantity')
    expect(html).toContain('/scenarios/security-object-access')
  })
})
