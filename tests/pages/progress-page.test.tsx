// Markup tests for the rewritten real-data /progress page (P4-M3 WP1).
// Rendering is static (renderToStaticMarkup); every state is supplied
// through the presentational component's props, so no fetch is mocked.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ProgressDashboard } from '../../src/features/progress/ProgressDashboard'
import type { ProgressDashboardState } from '../../src/features/progress/ProgressDashboard'
import type { ProgressResponse } from '../../src/shared/learning'

const HUNT_IDS = [
  'hunt-cart-001',
  'hunt-catalogue-001',
  'hunt-catalogue-002',
  'hunt-inventory-001',
  'hunt-pricing-001',
  'hunt-checkout-001',
  'hunt-authz-001',
] as const

const SCENARIO_IDS: Record<(typeof HUNT_IDS)[number], string> = {
  'hunt-cart-001': 'manual-cart-add-quantity',
  'hunt-catalogue-001': 'manual-shop-search',
  'hunt-catalogue-002': 'api-catalogue-filters',
  'hunt-inventory-001': 'api-checkout-exact-stock',
  'hunt-pricing-001': 'manual-cart-totals',
  'hunt-checkout-001': 'manual-address-edge-cases',
  'hunt-authz-001': 'security-object-access',
}

const TITLES: Record<(typeof HUNT_IDS)[number], string> = {
  'hunt-cart-001': 'Re-adding an item does not add up',
  'hunt-catalogue-001': 'Catalogue search under-matches',
  'hunt-catalogue-002': 'Category filter changes nothing',
  'hunt-inventory-001': 'Checkout refuses the exact remaining stock',
  'hunt-pricing-001': 'Order totals do not add up',
  'hunt-checkout-001': 'Checkout accepts a blank customer name',
  'hunt-authz-001': 'Order details cross account boundaries',
}

function makeData(overrides: Partial<ProgressResponse> = {}): ProgressResponse {
  const hunts = HUNT_IDS.map((huntId) => ({
    huntId,
    scenarioId: SCENARIO_IDS[huntId],
    title: TITLES[huntId],
    status: 'none' as const,
    discovered: false,
    bestScore: null,
    hintsUsed: 0,
    attempts: 0,
    lastSubmittedAt: null,
  }))
  return {
    persistence: 'session',
    hunts,
    recent: [],
    totals: {
      attempts: 0,
      inProgress: 0,
      submitted: 0,
      revealed: 0,
      reports: 0,
      discovered: 0,
      hintsUsed: 0,
      bestScore: null,
      averageBestScore: null,
    },
    ...overrides,
  }
}

function renderDashboard(state: ProgressDashboardState): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/progress']}>
      <ProgressDashboard state={state} />
    </MemoryRouter>,
  )
}

function readyData(overrides: Partial<ProgressResponse> = {}): ProgressResponse {
  return makeData({
    totals: {
      attempts: 4,
      inProgress: 1,
      submitted: 2,
      revealed: 1,
      reports: 3,
      discovered: 1,
      hintsUsed: 4,
      bestScore: 88,
      averageBestScore: 72,
    },
    hunts: [
      {
        huntId: 'hunt-pricing-001',
        scenarioId: 'manual-cart-totals',
        title: TITLES['hunt-pricing-001'],
        status: 'submitted',
        discovered: true,
        bestScore: 88,
        hintsUsed: 2,
        attempts: 2,
        lastSubmittedAt: '2026-11-16T10:00:00.000Z',
      },
      {
        huntId: 'hunt-catalogue-001',
        scenarioId: 'manual-shop-search',
        title: TITLES['hunt-catalogue-001'],
        status: 'in_progress',
        discovered: false,
        bestScore: null,
        hintsUsed: 1,
        attempts: 1,
        lastSubmittedAt: null,
      },
      {
        huntId: 'hunt-authz-001',
        scenarioId: 'security-object-access',
        title: TITLES['hunt-authz-001'],
        status: 'revealed',
        discovered: false,
        bestScore: null,
        hintsUsed: 1,
        attempts: 1,
        lastSubmittedAt: null,
      },
      ...HUNT_IDS.filter(
        (id) => !['hunt-pricing-001', 'hunt-catalogue-001', 'hunt-authz-001'].includes(id),
      ).map((huntId) => ({
        huntId,
        scenarioId: SCENARIO_IDS[huntId],
        title: TITLES[huntId],
        status: 'none' as const,
        discovered: false,
        bestScore: null,
        hintsUsed: 0,
        attempts: 0,
        lastSubmittedAt: null,
      })),
    ],
    recent: [
      {
        huntId: 'hunt-pricing-001',
        title: TITLES['hunt-pricing-001'],
        score: 88,
        verdict: 'solid',
        createdAt: '2026-11-16T10:00:00.000Z',
      },
    ],
    ...overrides,
  })
}

describe('ProgressDashboard — loading and error states', () => {
  it('announces the loading state', () => {
    const html = renderDashboard({ status: 'loading' })
    expect(html).toContain('role="status"')
    expect(html).toContain('Loading your progress')
    expect(html).toContain('<h1>Progress</h1>')
  })

  it('renders an accessible error state with a retry action', () => {
    const html = renderDashboard({
      status: 'error',
      message: 'The practice API could not be reached.',
      onRetry: () => {},
    })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Your progress could not be loaded')
    expect(html).toContain('The practice API could not be reached.')
    expect(html).toContain('Try again')
  })
})

describe('ProgressDashboard — honest zero state', () => {
  const html = renderDashboard({
    status: 'ready',
    data: makeData(),
    refreshing: false,
    onRefresh: () => {},
  })

  it('shows the zero-state message instead of fake numbers', () => {
    expect(html).toContain('Nothing recorded yet')
    expect(html).toContain('/scenarios/manual-cart-add-quantity')
  })

  it('renders every wired hunt as Not started', () => {
    expect(html.match(/Not started/g)?.length).toBeGreaterThanOrEqual(7)
    expect(html).not.toContain('Submitted · ')
  })

  it('renders no sample or demo values', () => {
    expect(html).not.toContain('>Sample<')
    expect(html).not.toContain('sample data')
    expect(html).not.toContain('Sample values')
    expect(html).not.toMatch(/demo(\s|-)?data/i)
    expect(html).not.toContain('12 of 20') // Phase 2 sample bar values
    expect(html).not.toContain('% complete')
  })

  it('uses neutral empty copy for submissions and averages', () => {
    expect(html).toContain('No reports submitted yet')
    expect(html).toContain('—')
  })

  it('explains guest progress is temporary', () => {
    expect(html).toContain('Guest progress')
    expect(html).toContain('expires')
    expect(html).toContain('never carries')
  })
})

describe('ProgressDashboard — populated state', () => {
  const html = renderDashboard({
    status: 'ready',
    data: readyData(),
    refreshing: false,
    onRefresh: () => {},
  })

  it('renders the aggregate tiles from persisted data', () => {
    expect(html).toContain('Reports submitted')
    expect(html).toContain('>3<')
    expect(html).toContain('Defects discovered')
    expect(html).toContain('1 of 7')
    expect(html).toContain('Average best score')
    expect(html).toContain('>72<')
    expect(html).toContain('>88<')
  })

  it('renders the discovery bar with a numeric fallback', () => {
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('1/7')
  })

  it('renders every hunt with a status chip and a link to its exercise', () => {
    for (const huntId of HUNT_IDS) {
      expect(html).toContain(`/scenarios/${SCENARIO_IDS[huntId]}`)
    }
    expect(html).toContain('Submitted · 88')
    expect(html).toContain('In progress')
    expect(html).toContain('Solution viewed')
    expect(html).toContain('Discovered')
    expect(html).toContain('Not discovered')
  })

  it('renders the recent submissions with score and verdict', () => {
    expect(html).toContain('Recent submissions')
    expect(html).toContain('Solid')
    expect(html).toContain('88')
  })

  it('distinguishes report quality from discovery in copy', () => {
    expect(html).toContain('a high score is not a discovery')
    expect(html).toContain('revealing the solution never counts as one')
  })

  it('carries no sample labels and no internal identifiers', () => {
    expect(html).not.toContain('>Sample<')
    expect(html).not.toContain('sample data')
    expect(html).not.toContain('attempt_id')
    expect(html).not.toContain('customer_id')
    expect(html).not.toContain('practice_session')
    for (const defect of ['CATALOGUE-001', 'CART-001', 'PRICING-001', 'CHECKOUT-001', 'AUTHZ-001']) {
      expect(html).not.toContain(defect)
    }
  })
})

describe('ProgressDashboard — attribution banners', () => {
  it('explains customer attribution when signed in', () => {
    const html = renderDashboard({
      status: 'ready',
      data: readyData({ persistence: 'customer' }),
      refreshing: false,
      onRefresh: () => {},
    })
    expect(html).toContain('Signed in — attributed progress')
    expect(html).toContain('submission time')
    expect(html).not.toContain('Guest progress — temporary')
  })

  it('explains guest temporariness and non-transfer when signed out', () => {
    const html = renderDashboard({
      status: 'ready',
      data: readyData({ persistence: 'session' }),
      refreshing: false,
      onRefresh: () => {},
    })
    expect(html).toContain('Guest progress — temporary by design')
    expect(html).toContain('never carries')
    expect(html).toContain('never copied into an account')
    expect(html).not.toContain('Signed in — attributed progress')
  })

  it('disables the refresh action while a refresh is in flight', () => {
    const html = renderDashboard({
      status: 'ready',
      data: readyData(),
      refreshing: true,
      onRefresh: () => {},
    })
    expect(html).toContain('Refreshing…')
    expect(html).toMatch(/disabled/)
  })
})

describe('ProgressDashboard — refresh failure keeps the stale dashboard', () => {
  it('renders an inline alert and the last good numbers instead of the full-page error', () => {
    const html = renderDashboard({
      status: 'ready',
      data: readyData(),
      refreshing: false,
      onRefresh: () => {},
      refreshError: 'The practice API could not be reached.',
    })
    expect(html).toContain('role="alert"')
    expect(html).toContain('could not be refreshed')
    expect(html).toContain('The practice API could not be reached.')
    // The previously rendered dashboard is still there — not wiped.
    expect(html).toContain('Reports submitted')
    expect(html).toContain('Recent submissions')
    expect(html).not.toContain('Your progress could not be loaded')
  })

  it('renders no inline alert when the refresh succeeded', () => {
    const html = renderDashboard({
      status: 'ready',
      data: readyData(),
      refreshing: false,
      onRefresh: () => {},
      refreshError: null,
    })
    expect(html).not.toContain('could not be refreshed')
  })
})
