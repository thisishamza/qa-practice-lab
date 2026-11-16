// Markup tests for the /practice recommended path with live progress
// (P4-M3 WP2). Rendering is static (renderToStaticMarkup); the progress
// state is supplied through props, so no fetch is mocked.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { RecommendedPathView } from '../../src/features/practice/RecommendedPath'
import { recommendedHuntScenarioIds } from '../../src/data/scenarios'
import type { ProgressDashboardState } from '../../src/features/progress/ProgressDashboard'
import type { ProgressResponse } from '../../src/shared/learning'

const HUNT_IDS = [
  'hunt-cart-001',
  'hunt-catalogue-002',
  'hunt-pricing-001',
  'hunt-catalogue-001',
  'hunt-checkout-001',
  'hunt-inventory-001',
  'hunt-authn-001',
  'hunt-rbac-001',
  'hunt-authz-001',
  'hunt-mass-001',
] as const

const SCENARIO_IDS: Record<(typeof HUNT_IDS)[number], string> = {
  'hunt-cart-001': 'manual-cart-add-quantity',
  'hunt-catalogue-002': 'api-catalogue-filters',
  'hunt-pricing-001': 'manual-cart-totals',
  'hunt-catalogue-001': 'manual-shop-search',
  'hunt-checkout-001': 'manual-address-edge-cases',
  'hunt-inventory-001': 'api-checkout-exact-stock',
  'hunt-authn-001': 'api-token-replay',
  'hunt-rbac-001': 'auth-role-boundaries',
  'hunt-authz-001': 'security-object-access',
  'hunt-mass-001': 'api-mass-assignment',
}

function makeData(
  overrides: Partial<Record<(typeof HUNT_IDS)[number], Partial<ProgressResponse['hunts'][number]>>> = {},
): ProgressResponse {
  const hunts = HUNT_IDS.map((huntId) => ({
    huntId,
    scenarioId: SCENARIO_IDS[huntId],
    title: huntId,
    status: 'none' as const,
    discovered: false,
    bestScore: null,
    hintsUsed: 0,
    attempts: 0,
    lastSubmittedAt: null,
    ...overrides[huntId],
  }))
  return {
    persistence: 'session',
    hunts,
    recent: [],
    totals: {
      attempts: hunts.reduce((sum, hunt) => sum + hunt.attempts, 0),
      inProgress: hunts.filter((hunt) => hunt.status === 'in_progress').length,
      submitted: hunts.filter((hunt) => hunt.status === 'submitted').length,
      revealed: hunts.filter((hunt) => hunt.status === 'revealed').length,
      reports: 0,
      discovered: hunts.filter((hunt) => hunt.discovered).length,
      hintsUsed: 0,
      bestScore: null,
      averageBestScore: null,
    },
  }
}

function render(state: ProgressDashboardState): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/practice']}>
      <RecommendedPathView state={state} />
    </MemoryRouter>,
  )
}

function ready(overrides: Parameters<typeof makeData>[0] = {}): ProgressDashboardState {
  return {
    status: 'ready',
    data: makeData(overrides),
    refreshing: false,
    onRefresh: () => {},
  }
}

describe('RecommendedPathView — structure and order', () => {
  const html = render(ready())

  it('renders the section with one page-hierarchy heading', () => {
    expect(html).toContain('Recommended path')
    expect(html).toContain('aria-labelledby="recommended-path-title"')
  })

  it('lists the runnable hunts in the approved order', () => {
    for (const id of recommendedHuntScenarioIds) {
      expect(html).toContain(`/scenarios/${id}`)
    }
    const positions = recommendedHuntScenarioIds.map((id) =>
      html.indexOf(`href="/scenarios/${id}"`),
    )
    expect(positions.every((position) => position > -1)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('renders no placeholder scenario as a path step', () => {
    expect(html).not.toContain('ui-signin-smoke')
    expect(html).not.toContain('db-order-consistency')
  })

  it('shows curriculum metadata sourced from the shared registry', () => {
    expect(html).toContain('Manual testing · functional &amp; state behaviour')
    expect(html).toContain('API testing · parameters &amp; filtering')
    expect(html).toContain('You will be able to:')
    expect(html).toContain('Concepts practised:')
    expect(html).toContain('Beginner')
    expect(html).toContain('Intermediate')
  })

  it('preserves hunt launch links', () => {
    expect(html).toContain('href="/scenarios/manual-cart-add-quantity"')
    expect(html).toContain('href="/scenarios/security-object-access"')
  })
})

describe('RecommendedPathView — progress-derived completion states', () => {
  it('shows Not started for hunts with no attempts', () => {
    const html = render(ready())
    expect(html.match(/Not started/g)?.length).toBe(10)
    expect(html).not.toContain('Completed')
  })

  it('shows In progress for an open attempt', () => {
    const html = render(ready({ 'hunt-cart-001': { status: 'in_progress', attempts: 1 } }))
    expect(html).toContain('In progress')
  })

  it('shows Solution viewed — never Completed — for a give-up without a report', () => {
    const html = render(ready({ 'hunt-cart-001': { status: 'revealed', attempts: 1 } }))
    expect(html).toContain('Solution viewed')
    expect(html).not.toContain('Completed')
  })

  it('shows Completed for a submitted report, even on a low score', () => {
    const html = render(
      ready({
        'hunt-cart-001': {
          status: 'submitted',
          attempts: 1,
          bestScore: 20,
          lastSubmittedAt: '2026-11-16T10:00:00.000Z',
        },
      }),
    )
    expect(html).toContain('Completed')
    expect(html).toContain('Best 20')
  })

  it('shows Completed for a report filed after a give-up, but no discovery', () => {
    const html = render(
      ready({
        'hunt-authz-001': {
          status: 'revealed',
          attempts: 1,
          bestScore: 64,
          lastSubmittedAt: '2026-11-16T10:00:00.000Z',
        },
      }),
    )
    expect(html).toContain('Completed')
    expect(html).not.toContain('Discovered')
  })

  it('shows Discovered only when the sticky discovery flag is set', () => {
    const html = render(
      ready({
        'hunt-pricing-001': {
          status: 'submitted',
          attempts: 1,
          bestScore: 88,
          discovered: true,
          lastSubmittedAt: '2026-11-16T10:00:00.000Z',
        },
      }),
    )
    expect(html).toContain('Discovered')
  })

  it('does not infer discovery from a high score without the finding check', () => {
    const html = render(
      ready({
        'hunt-pricing-001': {
          status: 'submitted',
          attempts: 2,
          bestScore: 78,
          discovered: false,
          lastSubmittedAt: '2026-11-16T10:00:00.000Z',
        },
      }),
    )
    expect(html).toContain('Best 78')
    expect(html).toContain('Completed')
    expect(html).not.toContain('Discovered')
  })

  it('shows only the best score across multiple attempts', () => {
    const html = render(
      ready({
        'hunt-catalogue-001': {
          status: 'submitted',
          attempts: 3,
          bestScore: 74,
          lastSubmittedAt: '2026-11-16T10:00:00.000Z',
        },
      }),
    )
    expect(html).toContain('Best 74')
    expect(html).not.toContain('Best 88')
  })
})

describe('RecommendedPathView — progress unavailable', () => {
  it('renders the path without completion chips while loading', () => {
    const html = render({ status: 'loading' })
    expect(html).toContain('role="status"')
    expect(html).toContain('Checking your progress')
    expect(html).toContain('/scenarios/manual-cart-add-quantity')
    expect(html).not.toContain('Completed')
    expect(html).not.toContain('In progress')
    expect(html).not.toContain('Solution viewed')
  })

  it('renders the path with a retry path when progress fails', () => {
    const html = render({
      status: 'error',
      message: 'The practice API could not be reached.',
      onRetry: () => {},
    })
    expect(html).toContain('role="alert"')
    expect(html).toContain('completion states are hidden')
    expect(html).toContain('Try again')
    expect(html).toContain('/scenarios/manual-cart-add-quantity')
    expect(html).not.toContain('Completed')
    expect(html).not.toContain('Discovered')
  })

  it('does not fabricate completion for hunts absent from the payload', () => {
    const data = makeData()
    data.hunts = data.hunts.filter((hunt) => hunt.huntId !== 'hunt-cart-001')
    const html = render({
      status: 'ready',
      data,
      refreshing: false,
      onRefresh: () => {},
    })
    expect(html).toContain('/scenarios/manual-cart-add-quantity')
    expect(html).not.toContain('Completed')
  })
})
