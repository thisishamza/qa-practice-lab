// Markup tests for the Phase 4 (P4-M2 WP2) bug-report surfaces. Rendering is
// static (renderToStaticMarkup) — interaction paths (focus management, blur
// validation, in-flight duplicate guard) are covered by the injected-transport
// controller tests in tests/lib/report-form.test.ts and by the browser probe;
// behaviour that needs a live DOM cannot run under the Node test environment.
import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { BugReportForm } from '../../src/features/practice/BugReportForm'
import { HuntLaunchPanel } from '../../src/features/practice/HuntLaunchPanel'
import { HuntPanel } from '../../src/features/practice/HuntPanel'
import { ReportErrorSummary } from '../../src/features/practice/ReportErrorSummary'
import { ReportEvaluationView } from '../../src/features/practice/ReportEvaluationView'
import { PracticeSessionContext } from '../../src/features/practice/practice-context'
import type { PracticeSessionContextValue } from '../../src/features/practice/practice-context'
import type { Scenario } from '../../src/data/types'
import type { ReportSubmissionResponse } from '../../src/shared/learning'

const hunt = { id: 'hunt-cart-001', title: 'Cart quantity accumulation', summary: 's', scenarioId: 'manual-cart-totals' }

const bugHuntContext: PracticeSessionContextValue = {
  loadState: { status: 'ready' },
  mode: 'bug_hunt',
  hunt,
  busy: null,
  actionError: null,
  refresh: () => {},
  startHunt: async () => true,
  resetSession: async () => true,
}

const cleanContext: PracticeSessionContextValue = { ...bugHuntContext, mode: 'clean', hunt: null }

const SUBMISSION: ReportSubmissionResponse = {
  attempt: {
    status: 'submitted',
    hintsUsed: 1,
    bestQualityScore: 82,
    discovered: false,
    submittedAt: '2026-11-16T10:20:30.000Z',
  },
  report: {
    title: 'Cart shows the wrong line total',
    environment: 'Meridian practice shop, Chrome on Linux',
    preconditions: null,
    steps: '1. Open /shop\n2. Add two copies\n3. Open /cart',
    expected: 'Line total should be 84.00.',
    actual: 'Line total shows 42.00.',
    severity: 'high',
    priority: 'p2',
    reproducibility: 'always',
    qualityScore: 82,
    feedback: [{ id: 'title-present', passed: true, message: 'Title describes the problem.' }],
    createdAt: '2026-11-16T10:20:30.000Z',
  },
  evaluation: {
    score: 82,
    verdict: 'solid',
    checks: [
      { id: 'title-present', label: 'Title', passed: true, message: 'Title describes the problem.' },
      { id: 'finding', label: 'Finding', passed: false, message: 'Does not identify which behaviour is incorrect — describe the behaviour that shows the problem.' },
    ],
  },
}

function staticMarkup(node: ReactElement): string {
  return renderToStaticMarkup(node)
}

describe('BugReportForm — initial render', () => {
  const html = staticMarkup(<BugReportForm huntId="hunt-cart-001" />)

  it('renders a noValidate form with persistent labels for every field', () => {
    expect(html).toContain('<form')
    expect(html).toContain('noValidate=""')
    expect(html).toContain('for="report-title"')
    expect(html).toContain('for="report-environment"')
    expect(html).toContain('for="report-preconditions"')
    expect(html).toContain('for="report-steps"')
    expect(html).toContain('for="report-expected"')
    expect(html).toContain('for="report-actual"')
    expect(html).toContain('for="report-severity"')
    expect(html).toContain('for="report-priority"')
    expect(html).toContain('for="report-reproducibility"')
  })

  it('marks required and optional fields in text, not only via attributes', () => {
    expect(html).toContain('Report title <span class="field-requirement">(required)</span>')
    expect(html).toContain('Preconditions <span class="field-requirement field-optional">(optional)</span>')
    expect(html).toContain('aria-required="true"')
  })

  it('links every field to its hint or error element', () => {
    expect(html).toContain('aria-describedby="report-title-hint"')
    expect(html).toContain('aria-describedby="report-steps-hint"')
    expect(html).toContain('id="report-title-hint"')
  })

  it('renders the severity, priority and reproducibility vocabularies', () => {
    expect(html).toContain('Critical — the shop is unusable')
    expect(html).toContain('High — core functionality is broken')
    expect(html).toContain('Medium — wrong behaviour')
    expect(html).toContain('Low — cosmetic')
    expect(html).toContain('P1 — Urgent')
    expect(html).toContain('P4 — Low')
    expect(html).toContain('Sometimes')
    // Reproducibility defaults to Always (matches the server default).
    expect(html).toMatch(/<option value="always" selected="">/)
    // Severity and priority start unselected — they are never derived.
    expect(html).toContain('Choose a severity…')
    expect(html).toContain('Choose a priority…')
  })

  it('offers no client-side score, feedback or discovery field', () => {
    expect(html).not.toContain('qualityScore')
    expect(html).not.toContain('discovered')
    expect(html).not.toContain('feedback')
    expect(html).not.toContain('hunt-cart-001')
  })

  it('shows a submit button with an accessible busy state hook', () => {
    expect(html).toContain('Submit the report')
    expect(html).toContain('type="submit"')
  })
})

describe('ReportErrorSummary', () => {
  const html = staticMarkup(
    <ReportErrorSummary
      failure="Check the highlighted fields and try again."
      errors={{ title: 'This field is required.', steps: 'This field is required.' }}
      fieldIds={{
        title: 'report-title',
        environment: 'report-environment',
        preconditions: 'report-preconditions',
        steps: 'report-steps',
        expected: 'report-expected',
        actual: 'report-actual',
        severity: 'report-severity',
        priority: 'report-priority',
        reproducibility: 'report-reproducibility',
      }}
      onNavigate={() => () => {}}
    />,
  )

  it('is focusable and announced, with one link per failing field in field order', () => {
    expect(html).toContain('role="alert"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('There is a problem')
    expect(html).toContain('Check the highlighted fields and try again.')
    expect(html).toContain('href="#report-title"')
    expect(html).toContain('href="#report-steps"')
    expect(html).toContain('Report title — This field is required.')
    expect(html.indexOf('#report-title')).toBeLessThan(html.indexOf('#report-steps'))
  })

  it('renders a failure-only summary without links when no field errors exist', () => {
    const failureOnly = staticMarkup(
      <ReportErrorSummary
        failure="Too many report submissions from this network."
        errors={{}}
        fieldIds={{
          title: 'report-title',
          environment: 'report-environment',
          preconditions: 'report-preconditions',
          steps: 'report-steps',
          expected: 'report-expected',
          actual: 'report-actual',
          severity: 'report-severity',
          priority: 'report-priority',
          reproducibility: 'report-reproducibility',
        }}
        onNavigate={() => () => {}}
      />,
    )
    expect(failureOnly).toContain('Too many report submissions')
    expect(failureOnly).not.toContain('href=')
  })
})

describe('ReportEvaluationView', () => {
  const html = staticMarkup(
    <ReportEvaluationView
      evaluation={SUBMISSION.evaluation}
      attempt={SUBMISSION.attempt}
      onRevise={() => {}}
      onDownload={() => {}}
    />,
  )

  it('renders the server score and the solid verdict without recomputing', () => {
    expect(html).toContain('82')
    expect(html).toContain('/ 100')
    expect(html).toContain('Score: 82 out of 100')
    expect(html).toContain('Solid')
  })

  it('renders criterion feedback with pass/improve affordances and text labels', () => {
    expect(html).toContain('Title describes the problem.')
    expect(html).toContain('Does not identify which behaviour is incorrect')
    expect(html).toContain('Passed: ')
    expect(html).toContain('Needs improvement: ')
    expect(html).toContain('1 of 2 checks passed')
  })

  it('distinguishes report quality from discovery and reflects the attempt', () => {
    expect(html).toContain('Report quality and finding the defect are different things')
    expect(html).toContain('does not yet count as having found the defect')
    const discovered = staticMarkup(
      <ReportEvaluationView
        evaluation={SUBMISSION.evaluation}
        attempt={{ ...SUBMISSION.attempt, discovered: true }}
        onRevise={() => {}}
        onDownload={() => {}}
      />,
    )
    expect(discovered).toContain('currently counts as having found the defect')
  })

  it('offers revise and download actions', () => {
    expect(html).toContain('Revise and resubmit')
    expect(html).toContain('Download the report (.md)')
  })

  it('exposes no defect ids, hunt ids or evaluator internals', () => {
    expect(html).not.toContain('hunt-cart-001')
    expect(html).not.toContain('PRICING-001')
    expect(html).not.toContain('qualityScore')
    expect(html).not.toContain('title-present')
    expect(html).not.toContain('bestQualityScore')
  })
})

describe('hunt panels — report form placement', () => {
  it('renders the report form on the /practice hunt panel while hunting', () => {
    const html = staticMarkup(
      <PracticeSessionContext.Provider value={bugHuntContext}>
        <MemoryRouter>
          <HuntPanel />
        </MemoryRouter>
      </PracticeSessionContext.Provider>,
    )
    expect(html).toContain('File a report')
    expect(html).toContain('Submit the report')
    expect(html).toContain('Report title')
  })

  it('renders no report form on the /practice hunt panel in clean mode', () => {
    const html = staticMarkup(
      <PracticeSessionContext.Provider value={cleanContext}>
        <MemoryRouter>
          <HuntPanel />
        </MemoryRouter>
      </PracticeSessionContext.Provider>,
    )
    expect(html).not.toContain('Submit the report')
  })

  const scenario = {
    id: 'manual-cart-totals',
    huntId: 'hunt-cart-001',
  } as unknown as Scenario

  it('renders the report form on the scenario launch panel while the hunt is active', () => {
    const html = staticMarkup(
      <PracticeSessionContext.Provider value={bugHuntContext}>
        <MemoryRouter>
          <HuntLaunchPanel scenario={scenario} />
        </MemoryRouter>
      </PracticeSessionContext.Provider>,
    )
    expect(html).toContain('File a report')
    expect(html).toContain('Submit the report')
  })

  it('renders no report form on the launch panel in clean mode', () => {
    const html = staticMarkup(
      <PracticeSessionContext.Provider value={cleanContext}>
        <MemoryRouter>
          <HuntLaunchPanel scenario={scenario} />
        </MemoryRouter>
      </PracticeSessionContext.Provider>,
    )
    expect(html).not.toContain('Submit the report')
  })
})
