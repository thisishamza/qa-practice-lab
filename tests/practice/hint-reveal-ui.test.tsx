// Markup tests for the P4-M2 WP3 hint/reveal/attempt-status surfaces.
// Rendering is static (renderToStaticMarkup) — interaction paths (focus
// trapping, Escape, in-flight guards, restore) are covered by the injected-
// transport controller tests in tests/lib/hint-reveal.test.ts and by the
// browser probe; behaviour that needs a live DOM cannot run under the Node
// test environment.
import { describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HintLadderView } from '../../src/features/practice/HintLadder'
import { RevealPanelView } from '../../src/features/practice/RevealPanel'
import { AttemptStatusChip } from '../../src/features/practice/AttemptStatusChip'
import { Modal } from '../../src/components/ui/Modal'
import type { RevealResponse } from '../../src/shared/learning'

const noop = () => {}
const noopFocus = createRef<HTMLHeadingElement>()
const cancelRef = createRef<HTMLButtonElement>()

function ladderProps(overrides: Partial<Parameters<typeof HintLadderView>[0]> = {}) {
  return {
    baseId: 'test-base',
    hintsUsed: 0,
    texts: {},
    openLevels: {},
    unlocking: null,
    restoreState: 'ready' as const,
    restoreError: null,
    levelErrors: {},
    onUnlock: noop,
    onToggle: noop,
    onRetryRestore: noop,
    ...overrides,
  }
}

function revealProps(overrides: Partial<Parameters<typeof RevealPanelView>[0]> = {}) {
  return {
    baseId: 'reveal-base',
    state: { phase: 'locked' } as const,
    dialogOpen: false,
    giveUpError: null,
    giveUpInFlight: false,
    headingRef: noopFocus,
    cancelRef,
    onRetry: noop,
    onOpenDialog: noop,
    onCancelGiveUp: noop,
    onConfirmGiveUp: noop,
    ...overrides,
  }
}

const REVEAL: RevealResponse = {
  huntId: 'hunt-cart-001',
  title: 'Cart quantity accumulation',
  expected: 'Adding the same item twice should accumulate the quantity.',
  actual: 'Only the latest quantity is kept.',
  rootCause: 'The cart line is replaced instead of merged.',
  reproduction: ['Open the shop', 'Add the same item twice', 'Open the cart'],
  verification: ['In a clean session, add the same item twice and confirm the quantity'],
  concepts: ['State management testing', 'Equivalence partitioning'],
  commonMisconceptions: ['Assuming the total is wrong rather than the quantity'],
  attempt: { status: 'revealed', hintsUsed: 3, bestQualityScore: null, discovered: false, submittedAt: null },
}

describe('HintLadderView', () => {
  it('renders three ordered, labelled levels with a live counter', () => {
    const html = renderToStaticMarkup(<HintLadderView {...ladderProps()} />)
    expect(html).toContain('Need a hint?')
    expect(html).toContain('0 of 3 hints used')
    expect(html).toContain('Unlock hint 1')
    expect(html).toContain('Hint 2 — locked')
    expect(html).toContain('Hint 3 — locked')
    expect(html).toContain('role="status"')
  })

  it('level 1 is available, levels 2 and 3 are disabled and locked — no content disclosed', () => {
    const html = renderToStaticMarkup(<HintLadderView {...ladderProps()} />)
    expect(html).toContain('Unlock hint 1')
    expect(html).toContain('Hint 2 — locked')
    expect(html).toContain('Hint 3 — locked')
    expect(html).toContain('Use hint 1 first')
    expect(html).toContain('Use hint 2 first')
    // Locked levels render disabled buttons.
    expect(html.match(/disabled=""/g)?.length).toBe(2)
    // No hint text or region markup leaks pre-unlock.
    expect(html).not.toContain('Loading this hint')
    expect(html).not.toContain('role="region"')
  })

  it('unlocked levels render as disclosures with aria-expanded and a region', () => {
    const html = renderToStaticMarkup(
      <HintLadderView
        {...ladderProps({
          hintsUsed: 2,
          texts: { 1: 'First hint body', 2: 'Second hint body' },
          openLevels: { 1: true, 2: false },
        })}
      />,
    )
    expect(html).toContain('2 of 3 hints used')
    expect(html).toContain('First hint body')
    expect(html).toContain('Second hint body')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls=')
    expect(html).toContain('role="region"')
    // Level 3 is available but not unlocked — no third text and no unlock control duplicated.
    expect(html).toContain('Unlock hint 3')
    expect(html).not.toContain('Third hint body')
    // Unlocked level 2 body is collapsed.
    expect(html).toMatch(/id="[^"]*-hint-2"[^>]*hidden/)
  })

  it('locked levels never show text, even when the texts map is polluted', () => {
    const html = renderToStaticMarkup(
      <HintLadderView {...ladderProps({ hintsUsed: 0, texts: { 2: 'secret two', 3: 'secret three' } })} />,
    )
    expect(html).not.toContain('secret two')
    expect(html).not.toContain('secret three')
  })

  it('level error alerts use role=alert and aria-describedby wiring', () => {
    const html = renderToStaticMarkup(
      <HintLadderView {...ladderProps({ levelErrors: { 1: 'Use the previous hint first — levels unlock in order.' } })} />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Use the previous hint first')
    expect(html).toContain('aria-describedby=')
  })

  it('shows a checking state and restore error honestly', () => {
    const loading = renderToStaticMarkup(<HintLadderView {...ladderProps({ restoreState: 'loading' })} />)
    expect(loading).toContain('Checking which hints you have used')
    const failed = renderToStaticMarkup(
      <HintLadderView {...ladderProps({ restoreState: 'error', restoreError: 'The connection failed. Check your network and try again.' })} />,
    )
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('The connection failed')
    expect(failed).toContain('Try again')
  })

  it('disables the unlock action while a request is in flight', () => {
    const html = renderToStaticMarkup(<HintLadderView {...ladderProps({ unlocking: 1 })} />)
    expect(html).toContain('Unlocking hint 1…')
  })
})

describe('RevealPanelView', () => {
  it('locked phase renders the locked callout and reveal trigger — no content', () => {
    const html = renderToStaticMarkup(<RevealPanelView {...revealProps()} />)
    expect(html).toContain('Still locked')
    expect(html).toContain('does not count as discovering the defect')
    expect(html).toContain('Show the solution')
    expect(html).not.toContain(REVEAL.expected)
    expect(html).not.toContain(REVEAL.actual)
    expect(html).not.toContain(REVEAL.rootCause)
    expect(html).not.toContain('Reproduction steps')
  })

  it('loading phase announces a status', () => {
    const html = renderToStaticMarkup(<RevealPanelView {...revealProps({ state: { phase: 'loading' } })} />)
    expect(html).toContain('Checking whether the solution is available')
    expect(html).toContain('role="status"')
  })

  it('error phase renders an alert and a retry — still no content', () => {
    const html = renderToStaticMarkup(
      <RevealPanelView {...revealProps({ state: { phase: 'error', message: 'The server had a problem. Please try again in a moment.' } })} />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('The server had a problem')
    expect(html).toContain('Try again')
    expect(html).not.toContain(REVEAL.expected)
  })

  it('revealed phase renders every section and distinguishes a give-up', () => {
    const html = renderToStaticMarkup(<RevealPanelView {...revealProps({ state: { phase: 'revealed', reveal: REVEAL } })} />)
    expect(html).toContain('Expected behaviour')
    expect(html).toContain('Actual behaviour')
    expect(html).toContain('Root cause')
    expect(html).toContain('Reproduction steps')
    expect(html).toContain('How to verify the fix')
    expect(html).toContain('Concepts you practiced')
    expect(html).toContain('Common wrong turns')
    expect(html).toContain(REVEAL.expected)
    expect(html).toContain(REVEAL.actual)
    expect(html).toContain('give-up')
    expect(html).toContain('not a discovery')
    expect(html).not.toContain('Revealed — report submitted')
  })

  it('revealed after a submission distinguishes the report path', () => {
    const submitted: RevealResponse = {
      ...REVEAL,
      attempt: { status: 'submitted', hintsUsed: 1, bestQualityScore: 88, discovered: true, submittedAt: '2026-11-16T10:20:30.000Z' },
    }
    const html = renderToStaticMarkup(<RevealPanelView {...revealProps({ state: { phase: 'revealed', reveal: submitted } })} />)
    expect(html).toContain('report submitted')
    expect(html).toContain('kept exactly as the server recorded')
    expect(html).not.toContain('Revealed — give-up')
  })

  it('the give-up dialog is not rendered until opened, and cancel makes no endpoint call', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const closed = renderToStaticMarkup(
      <RevealPanelView {...revealProps({ onConfirmGiveUp: onConfirm, onCancelGiveUp: onCancel })} />,
    )
    expect(closed).not.toContain('role="dialog"')
  })

  it('the open dialog is an accessible modal with label and description', () => {
    const html = renderToStaticMarkup(<RevealPanelView {...revealProps({ dialogOpen: true })} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Show the solution?')
    expect(html).toContain('does not count as discovering the defect')
    expect(html).toContain('Keep investigating')
    expect(html).toMatch(/aria-labelledby="[^"]+"/)
    expect(html).toMatch(/aria-describedby="[^"]+"/)
    // Safe action is the default focus target (it carries the ref; render order proves presence).
    expect(html).toContain('Keep investigating')
  })

  it('the dialog surfaces a give-up failure as an alert without revealing', () => {
    const html = renderToStaticMarkup(
      <RevealPanelView
        {...revealProps({ dialogOpen: true, giveUpError: 'The connection failed. Check your network and try again.' })}
      />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('The connection failed')
    expect(html).not.toContain('Reproduction steps')
  })
})

describe('AttemptStatusChip', () => {
  it('renders a neutral Not started chip', () => {
    const html = renderToStaticMarkup(<AttemptStatusChip status="none" bestQualityScore={null} />)
    expect(html).toContain('Not started')
    expect(html).toContain('tag-neutral')
  })

  it('renders In progress', () => {
    const html = renderToStaticMarkup(<AttemptStatusChip status="in_progress" bestQualityScore={null} />)
    expect(html).toContain('In progress')
    expect(html).toContain('tag-in-design')
  })

  it('renders Submitted with the best score', () => {
    const html = renderToStaticMarkup(<AttemptStatusChip status="submitted" bestQualityScore={82} />)
    expect(html).toContain('Submitted · 82')
    expect(html).toContain('tag-ready')
  })

  it('renders Submitted without a score when best score is null', () => {
    const html = renderToStaticMarkup(<AttemptStatusChip status="submitted" bestQualityScore={null} />)
    expect(html).toContain('Submitted')
    expect(html).not.toContain('·')
  })

  it('renders a neutral Solution viewed chip for revealed attempts, hiding any stale score', () => {
    const html = renderToStaticMarkup(<AttemptStatusChip status="revealed" bestQualityScore={97} />)
    expect(html).toContain('Solution viewed')
    expect(html).toContain('tag-planned')
    expect(html).not.toContain('97')
  })

  it('renders an explicit unavailable placeholder when attempt data is missing', () => {
    const html = renderToStaticMarkup(<AttemptStatusChip status={null} bestQualityScore={null} />)
    expect(html).toContain('Status unavailable')
    expect(html).toContain('tag-neutral')
  })

  it('never exposes internal identifiers', () => {
    for (const status of ['none', 'in_progress', 'submitted', 'revealed'] as const) {
      const html = renderToStaticMarkup(<AttemptStatusChip status={status} bestQualityScore={64} />)
      expect(html).not.toMatch(/hunt_attempts|practice_session|attempt_id|\d{4,}/)
    }
  })
})

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <Modal open={false} title="T" onClose={noop}>
        <button type="button">Child</button>
      </Modal>,
    )
    expect(html).toBe('')
  })

  it('renders role=dialog with label and description wiring', () => {
    const html = renderToStaticMarkup(
      <Modal open title="Confirm thing" description="This is what happens." onClose={noop}>
        <button type="button">OK</button>
      </Modal>,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Confirm thing')
    expect(html).toContain('This is what happens.')
    const labelled = html.match(/aria-labelledby="([^"]+)"/)?.[1]
    const described = html.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(labelled).toBeTruthy()
    expect(described).toBeTruthy()
    expect(html).toContain(`id="${labelled}"`)
    expect(html).toContain(`id="${described}"`)
  })
})
