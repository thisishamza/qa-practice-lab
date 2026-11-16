// Markup tests for the learner-facing evaluation transparency surface
// (P4-M3 WP2). All content is static and sourced from the canonical shared
// rubric; rendering is renderToStaticMarkup.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { EvaluationTransparency } from '../../src/features/evaluation/EvaluationTransparency'
import { EVALUATION_RUBRIC } from '../../src/shared/evaluationRubric'

// Internal defect identifiers (as registered in src/server/defects.ts).
// Duplicated here deliberately: this page test must stay client-safe and
// must not import the server graph.
const DEFECT_IDS = [
  'CATALOGUE-001',
  'CATALOGUE-002',
  'CART-001',
  'INVENTORY-001',
  'PRICING-001',
  'CHECKOUT-001',
  'AUTHZ-001',
] as const

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <EvaluationTransparency />
    </MemoryRouter>,
  )
}

describe('EvaluationTransparency — rubric', () => {
  const html = render()

  it('renders all ten check labels', () => {
    for (const label of [
      'Title',
      'Environment',
      'Steps',
      'Step quality',
      'Expected',
      'Actual',
      'Expected vs actual',
      'Severity',
      'Priority',
      'Finding',
    ]) {
      expect(html).toContain(label)
    }
  })

  it('shows every weight and the 100-point total', () => {
    for (const check of EVALUATION_RUBRIC) {
      expect(html).toContain(String(check.points))
    }
    expect(html).toContain('Total: 100 points')
  })

  it('explains the three verdict bands and their thresholds', () => {
    expect(html).toContain('Solid report')
    expect(html).toContain('Needs work')
    expect(html).toContain('Incomplete')
    expect(html).toContain('80–100')
    expect(html).toContain('50–79')
    expect(html).toContain('0–49')
  })

  it('states there is no timer, no comparison and no AI', () => {
    expect(html).toContain('no timer')
    expect(html).toContain('no comparison with other learners')
    expect(html).toContain('no AI in the loop')
  })
})

describe('EvaluationTransparency — discovery is separate from report quality', () => {
  const html = render()

  it('says a high score does not automatically mean the defect was found', () => {
    expect(html).toContain('A high score does not automatically mean the defect was found')
  })

  it('explains discovery as findings-based, not score-based', () => {
    expect(html).toContain('discovery')
    expect(html).toContain('the incorrect behaviour')
    expect(html).toContain('environment lines are not counted')
  })

  it('explains that hints never award discovery', () => {
    expect(html).toContain('Hints never lower your score and never award discovery')
  })

  it('explains that reveals never award discovery or count as completion', () => {
    expect(html).toContain('Revealing the solution never awards discovery')
    expect(html).toContain('never counts as completing')
  })

  it('explains a reveal consumes discovery credit for later reports', () => {
    expect(html).toContain('A revealed attempt confers no discovery')
  })
})

describe('EvaluationTransparency — no hidden information leaks', () => {
  const html = render()

  it('leaks no defect identifiers', () => {
    for (const defectId of DEFECT_IDS) {
      expect(html).not.toContain(defectId)
    }
  })

  it('does not enumerate the server-side finding term groups', () => {
    for (const term of [
      'accumulation',
      'subtotal',
      'unauthorised',
      'unauthorized',
      'someone else',
      'keyword',
      'whitespace',
      'order reference',
      'times quantity',
    ]) {
      expect(html.toLowerCase()).not.toContain(term)
    }
  })
})
