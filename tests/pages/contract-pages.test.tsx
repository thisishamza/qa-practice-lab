// Contract lab page tests (Phase 7, plan §12.1.10 partial) — static markup
// assertions for every new route. useEffect fetches never run under SSR, so
// each test asserts the initial render state of the page.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PracticeSessionContext } from '../../src/features/practice/practice-context'
import type { PracticeSessionContextValue } from '../../src/features/practice/practice-context'
import { ContractHubPage } from '../../src/pages/ContractHubPage'
import { ContractValidatePage } from '../../src/pages/ContractValidatePage'
import { ContractComparePage } from '../../src/pages/ContractComparePage'
import { ContractConsumerPage } from '../../src/pages/ContractConsumerPage'
import { ContractExercisePage } from '../../src/pages/ContractExercisePage'
import { CONTRACT_EXERCISES } from '../../src/data/contractExercises'

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

function render(element: React.ReactElement, route = '/'): string {
  return renderToStaticMarkup(
    createElement(
      PracticeSessionContext.Provider,
      { value: contextStub },
      createElement(
        MemoryRouter,
        { initialEntries: [route] },
        createElement(Routes, null, createElement(Route, { path: '*', element })),
      ),
    ),
  )
}

describe('ContractHubPage', () => {
  const html = render(createElement(ContractHubPage))

  it('renders the hub with all 24 exercises and the capability cards', () => {
    expect(html).toContain('Contract Testing')
    for (const exercise of CONTRACT_EXERCISES) {
      expect(html).toContain(exercise.title)
    }
    expect(html).toContain('API contract validation')
    expect(html).toContain('Schema compatibility review')
    expect(html).toContain('Consumer-driven verification')
  })

  it('links the validate, compare and consumer workspaces and the track', () => {
    expect(html).toContain('/contract/validate')
    expect(html).toContain('/contract/compare')
    expect(html).toContain('/contract/consumer')
    expect(html).toContain('/tracks/contract-testing')
  })

  it('renders the seven contract bug-hunt scenario cards', () => {
    for (const id of [
      'contract-hunt-missing-stock-status',
      'contract-hunt-string-price-cents',
      'contract-hunt-enum-casing',
      'contract-hunt-204-cancel',
      'contract-hunt-undocumented-property',
      'contract-hunt-epoch-created-at',
      'contract-hunt-consumer-drift',
    ]) {
      expect(html).toContain(`/scenarios/${id}`)
    }
  })
})

describe('ContractValidatePage', () => {
  it('renders the source picker, operation picker and payload editor with a starter', () => {
    const html = render(createElement(ContractValidatePage))
    expect(html).toContain('Validate a payload')
    expect(html).toContain('Live platform contract (/openapi.json)')
    expect(html).toContain('Meridian Ledger v1.0.0')
    expect(html).toContain('Validate')
    expect(html).toContain('ridgeline-2-person-tent')
  })
})

describe('ContractComparePage', () => {
  it('renders the release-pair picker and the locus selector', () => {
    const html = render(createElement(ContractComparePage))
    expect(html).toContain('Compare two contracts')
    expect(html).toContain('v1 → v2.0.0 (breaking release)')
    expect(html).toContain('Locus')
  })

  it('defaults to the v1 → v2-breaking pair to make the breaking drill obvious', () => {
    const html = render(createElement(ContractComparePage))
    expect(html).toContain('v1 → v2.0.0 (breaking release)')
  })
})

describe('ContractConsumerPage', () => {
  it('renders the guided expectation editor with the five critical fields', () => {
    const html = render(createElement(ContractConsumerPage))
    expect(html).toContain('Verify your expectation')
    expect(html).toContain('slug')
    expect(html).toContain('priceCents')
    expect(html).toContain('stockStatus')
    expect(html).toContain('provider-product-v2-latest')
  })
})

describe('ContractExercisePage', () => {
  it('renders a validate exercise with the brief, checklist and Check work control', () => {
    const html = render(
      createElement(Routes, null, createElement(Route, { path: '/contract/exercises/:exerciseId', element: createElement(ContractExercisePage) })),
      '/contract/exercises/contract-bgn-required-01',
    )
    expect(html).toContain('Which properties are required?')
    expect(html).toContain('required')
    expect(html).toContain('Check work')
  })

  it('renders a compare exercise with per-finding classification selects', () => {
    const html = render(
      createElement(Routes, null, createElement(Route, { path: '/contract/exercises/:exerciseId', element: createElement(ContractExercisePage) })),
      '/contract/exercises/contract-adv-versioning-01',
    )
    expect(html).toContain('The compatibility review')
    expect(html).toContain('Verdict')
    expect(html).toContain('breaking')
  })

  it('renders a not-found state for an unknown exercise id', () => {
    const html = render(
      createElement(Routes, null, createElement(Route, { path: '/contract/exercises/:exerciseId', element: createElement(ContractExercisePage) })),
      '/contract/exercises/contract-bgn-nope-99',
    )
    expect(html).toContain('No such contract exercise')
  })
})
