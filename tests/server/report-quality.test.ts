// Phase 4 (P4-M1 WP3) — deterministic bug-report evaluator (plan §6.4).
//
// Covers: the exact §6.4 rubric check-by-check, full-quality reports for
// every registered hunt, weak and incomplete reports, boundary conditions,
// score range, verdict bands, deterministic repeat evaluation, feedback
// correctness and answer leakage, finding-check normalization/synonyms,
// per-hunt finding-group isolation, and discovery criteria. The evaluator
// is a pure function; no database is involved.
import { describe, expect, it } from 'vitest'
import {
  countSteps,
  evaluateReport,
  FINDING_GROUPS,
  isPlaceholderTitle,
  normalizeForEvaluation,
  RUBRIC_CHECKS,
  stepsHaveActionVerb,
  stepsHaveConcreteToken,
  tokenDisjointness,
  type EvaluateReportInput,
} from '../../src/server/reportQuality'

const DEFECT_IDS = [
  'CATALOGUE-001',
  'CATALOGUE-002',
  'CART-001',
  'INVENTORY-001',
  'PRICING-001',
  'CHECKOUT-001',
  'AUTHZ-001',
]

function baseReport(overrides: Partial<EvaluateReportInput> = {}): EvaluateReportInput {
  return {
    huntId: 'hunt-pricing-001',
    title: 'Order totals do not match quantities',
    environment: 'Firefox 132 on Ubuntu 24.04, practice shop build 2026.11',
    steps: '1. Open the shop\n2. Add 3 units of Ridgeline 2-Person Tent\n3. Place the order',
    expected: 'Each line total equals unit price times quantity.',
    actual: 'The line total ignores the quantity and shows the single-unit price.',
    severity: 'high',
    priority: 'p2',
    ...overrides,
  }
}

/** Strong, finding-free report (no token from any finding group). All checks
 * pass except `finding`. */
function findingFreeReport(overrides: Partial<EvaluateReportInput> = {}): EvaluateReportInput {
  return {
    huntId: 'hunt-pricing-001',
    title: 'Submitted figure is wrong on review',
    environment: 'Chrome on Windows 11',
    steps: '1. Open the shop\n2. Complete the flow\n3. Review the result',
    expected: 'The summary figure should equal the configured value.',
    actual: 'A mismatched figure is printed on screen instead.',
    severity: 'medium',
    priority: 'p3',
    ...overrides,
  }
}

/** A full-quality report for each registered hunt (passes every check). */
const STRONG_FIXTURES: Record<string, EvaluateReportInput> = {
  'hunt-catalogue-001': baseReport({
    huntId: 'hunt-catalogue-001',
    title: 'Search misses products by description',
    steps: '1. Open the shop\n2. Search for vestibules as a term\n3. Read the results',
    expected: 'A product whose description mentions vestibules should appear.',
    actual: 'No results appear even though the description contains the searched term.',
  }),
  'hunt-catalogue-002': baseReport({
    huntId: 'hunt-catalogue-002',
    title: 'Category filter shows every category',
    steps: '1. Open the shop\n2. Choose the Climbing category\n3. Compare the listing count',
    expected: 'Only products from the chosen category should be listed.',
    actual: 'All products are shown in the listing; the category choice has no effect.',
  }),
  'hunt-cart-001': baseReport({
    huntId: 'hunt-cart-001',
    title: 'Re-adding an item resets its quantity',
    steps:
      '1. Open the shop\n2. Add Ridgeline Tent to the cart\n3. Add the same item again\n4. Read the quantity',
    expected: 'The quantity should accumulate to 2.',
    actual: 'The quantity resets to 1 instead of adding up.',
  }),
  'hunt-inventory-001': baseReport({
    huntId: 'hunt-inventory-001',
    title: 'Checkout rejects the exact remaining stock',
    steps: '1. Open the shop\n2. Add 3 Kestrel Dry Bags when 3 remain in stock\n3. Place the order',
    expected: 'An order for exactly the available units should be placed.',
    actual: 'The order is rejected with insufficient stock even at the exact quantity.',
  }),
  'hunt-pricing-001': baseReport(),
  'hunt-checkout-001': baseReport({
    huntId: 'hunt-checkout-001',
    title: 'Blank customer name is accepted at checkout',
    steps: '1. Open checkout\n2. Leave the customer name field empty\n3. Submit the order',
    expected: 'A blank name should be rejected with a validation message.',
    actual: 'The order is placed with an empty name and no complaint.',
  }),
  'hunt-authz-001': baseReport({
    huntId: 'hunt-authz-001',
    title: 'Order from another account is visible',
    steps:
      '1. Sign in as the first demo customer\n2. Place an order and note the reference\n3. Sign in as a different account\n4. Open the order reference',
    expected: 'The order reference should only open for its owner.',
    actual: 'The order detail renders for the other account without any check.',
  }),
}

const check = (result: ReturnType<typeof evaluateReport>, id: string) =>
  result.checks.find((c) => c.id === id)

describe('RUBRIC_CHECKS structure (plan §6.4 exactly)', () => {
  it('has ten checks whose points sum to 100', () => {
    expect(RUBRIC_CHECKS).toHaveLength(10)
    expect(RUBRIC_CHECKS.reduce((sum, item) => sum + item.points, 0)).toBe(100)
  })

  it('carries the approved point allocations', () => {
    expect(RUBRIC_CHECKS.map(({ id, points }) => [id, points])).toEqual([
      ['title-present', 10],
      ['environment-present', 10],
      ['steps-present', 15],
      ['steps-quality', 10],
      ['expected-present', 8],
      ['actual-present', 8],
      ['expected-actual-distinct', 7],
      ['severity-valid', 5],
      ['priority-valid', 5],
      ['finding', 22],
    ])
  })
})

describe('normalizeForEvaluation', () => {
  it('case-folds, strips punctuation, collapses whitespace', () => {
    expect(normalizeForEvaluation('  The   Quick,\n\tBrown   FOX!!!  ')).toBe('the quick brown fox')
  })
  it('normalises diacritics', () => {
    expect(normalizeForEvaluation('Crème brûlée Mañana')).toBe('creme brulee manana')
  })
  it('collapses hyphens and slashes to token boundaries', () => {
    expect(normalizeForEvaluation('re-add /shop/cart')).toBe('re add shop cart')
  })
  it('returns an empty string for symbol-only input', () => {
    expect(normalizeForEvaluation('!!! ---')).toBe('')
  })
})

describe('title-present (10 pts)', () => {
  it('passes a genuine 10-character title at the boundary', () => {
    expect('Cart drops'.length).toBe(10)
    const result = evaluateReport(baseReport({ title: 'Cart drops' }))
    expect(check(result, 'title-present')?.passed).toBe(true)
  })

  it('fails titles shorter than 10 characters', () => {
    const result = evaluateReport(baseReport({ title: 'Cart bug' }))
    expect(check(result, 'title-present')?.passed).toBe(false)
  })

  it('passes a 120-character title and fails 121', () => {
    const ok = evaluateReport(baseReport({ title: 'Order totals are wrong in baskets'.padEnd(120, ' and more') }))
    expect(check(ok, 'title-present')?.passed).toBe(true)
    const tooLong = evaluateReport(
      baseReport({ title: 'Order totals are wrong in baskets every single time someone checks it now'.padEnd(121, ' and more') }),
    )
    expect(check(tooLong, 'title-present')?.passed).toBe(false)
  })

  it('rejects placeholder junk regardless of length', () => {
    for (const junk of ['test', 'testing', 'placeholder', 'lorem ipsum', 'aaaaaaaaaa', 'xxxxxxxxxx', 'blank blank blank blank']) {
      const result = evaluateReport(baseReport({ title: junk }))
      expect(check(result, 'title-present')?.passed, JSON.stringify(junk)).toBe(false)
    }
  })

  it('isPlaceholderTitle detects junk but keeps genuine titles', () => {
    expect(isPlaceholderTitle('lorem ipsum')).toBe(true)
    expect(isPlaceholderTitle('aaaaaaaaaa')).toBe(true)
    expect(isPlaceholderTitle('test')).toBe(true)
    expect(isPlaceholderTitle('blank blank blank blank')).toBe(true)
    expect(isPlaceholderTitle('Order totals do not match quantities')).toBe(false)
    expect(isPlaceholderTitle('Cart drops items at checkout review step')).toBe(false)
  })
})

describe('environment-present (10 pts)', () => {
  it('passes with a recognised browser, case-insensitively', () => {
    const result = evaluateReport(baseReport({ environment: 'FIREFOX on windows' }))
    expect(check(result, 'environment-present')?.passed).toBe(true)
  })
  it('passes with OS, device, build and practice-shop vocabularies', () => {
    for (const environment of [
      'ubuntu 24.04 desktop machine',
      'android tablet in the office',
      'build 2026.11 release candidate',
      'the practice shop on a phone',
    ]) {
      const result = evaluateReport(baseReport({ environment }))
      expect(check(result, 'environment-present')?.passed, environment).toBe(true)
    }
  })
  it('fails when no recognised term is named', () => {
    const result = evaluateReport(baseReport({ environment: 'some side room today' }))
    expect(check(result, 'environment-present')?.passed).toBe(false)
  })
  it('fails below 8 characters even with a browser term', () => {
    const result = evaluateReport(baseReport({ environment: 'firefox' }))
    expect(check(result, 'environment-present')?.passed).toBe(false)
  })
})

describe('steps-present (15 pts)', () => {
  it('counts newline-separated steps', () => {
    expect(countSteps('1. Open the shop\n2. Add 3 units\n3. Place the order')).toBe(3)
  })
  it('counts inline numbered markers on one line', () => {
    expect(countSteps('1. Open the shop 2. Add 3 units 3. Place the order')).toBe(3)
  })
  it('counts "step N:" style markers', () => {
    expect(countSteps('Step 1: Open the shop\nStep 2: Add 3 units')).toBe(2)
  })
  it('does not count decimals or versions as markers', () => {
    expect(countSteps('open v1.5 of the shop then compare the figures we see on screen')).toBe(1)
  })
  it('counts unnumbered lines as single steps', () => {
    expect(countSteps('open the shop page\nthen place a small order with three units')).toBe(2)
  })
  it('fails with fewer than 2 steps', () => {
    const result = evaluateReport(
      baseReport({ steps: 'open the shop and place an order with a few units to be honest' }),
    )
    expect(check(result, 'steps-present')?.passed).toBe(false)
  })
  it('fails below 40 total characters', () => {
    const steps = '1. Open shop\n2. Place order' // 27 chars, two steps
    expect(steps.length).toBeLessThan(40)
    const result = evaluateReport(baseReport({ steps }))
    expect(check(result, 'steps-present')?.passed).toBe(false)
  })
  it('passes exactly at 40 characters with two steps', () => {
    const steps = '1. Open the shop page\n2. Check the order'
    expect(steps.length).toBe(40)
    expect(countSteps(steps)).toBe(2)
    const result = evaluateReport(baseReport({ steps }))
    expect(check(result, 'steps-present')?.passed).toBe(true)
  })
})

describe('steps-quality (10 pts)', () => {
  it('requires an action verb and a concrete token', () => {
    expect(stepsHaveActionVerb('open the shop and look around')).toBe(true)
    expect(stepsHaveActionVerb('1. open the shop\n2. place an order')).toBe(true)
    expect(stepsHaveActionVerb('the totals are wrong on the confirmation screen')).toBe(false)
    expect(stepsHaveActionVerb('sign in as the demo customer')).toBe(true)
    // Numbered markers count as digits, so numbered steps alone satisfy the
    // concrete-token rule; unnumbered steps need a quoted value, a digit or a path.
    expect(stepsHaveConcreteToken('add 3 units')).toBe(true)
    expect(stepsHaveConcreteToken('search for "ridgeline"')).toBe(true)
    expect(stepsHaveConcreteToken('open /checkout/review')).toBe(true)
    expect(stepsHaveConcreteToken('open the shop and click around')).toBe(false)
  })
  it('fails without a verb', () => {
    const result = evaluateReport(
      baseReport({ steps: '1. the confirmation screen\n2. three units ordered\n3. the odd figure shown' }),
    )
    expect(check(result, 'steps-quality')?.passed).toBe(false)
  })
  it('fails without a concrete token', () => {
    const result = evaluateReport(
      baseReport({ steps: 'open the shop\nthen place an order with the default quantity' }),
    )
    expect(check(result, 'steps-quality')?.passed).toBe(false)
  })
})

describe('expected-present (8 pts) and actual-present (8 pts)', () => {
  it('passes at exactly 12 characters', () => {
    expect('abcdefghijkl'.length).toBe(12)
    const result = evaluateReport(baseReport({ expected: 'abcdefghijkl' }))
    expect(check(result, 'expected-present')?.passed).toBe(true)
  })
  it('fails below 12 characters', () => {
    const result = evaluateReport(baseReport({ expected: 'short', actual: 'short' }))
    expect(check(result, 'expected-present')?.passed).toBe(false)
    expect(check(result, 'actual-present')?.passed).toBe(false)
  })
})

describe('expected-actual-distinct (7 pts)', () => {
  it('fails when normalized expected equals actual', () => {
    const same = 'The line total ignores quantity and shows single-unit price.'
    const result = evaluateReport(baseReport({ expected: same, actual: same }))
    expect(check(result, 'expected-actual-distinct')?.passed).toBe(false)
  })
  it('fails when expected is a trivially punctuated variant of actual', () => {
    const result = evaluateReport(
      baseReport({
        expected: 'The line total ignores quantity and shows the single-unit price.',
        actual: 'The line total ignores quantity and shows the single-unit price',
      }),
    )
    expect(check(result, 'expected-actual-distinct')?.passed).toBe(false)
  })
  it('fails when token overlap keeps disjointness under 60%', () => {
    expect(
      tokenDisjointness(
        'The cart total should include every line quantity in the order',
        'The cart total excludes the line quantity from the order',
      ),
    ).toBeLessThan(0.6)
    const result = evaluateReport(
      baseReport({
        expected: 'The cart total should include every line quantity in the order',
        actual: 'The cart total excludes the line quantity from the order',
      }),
    )
    expect(check(result, 'expected-actual-distinct')?.passed).toBe(false)
  })
  it('passes for clearly different statements', () => {
    expect(
      tokenDisjointness(
        'Each line total equals unit price times quantity.',
        'The line total ignores the quantity and shows the single-unit price.',
      ),
    ).toBeGreaterThanOrEqual(0.6)
  })
})

describe('severity-valid (5 pts) and priority-valid (5 pts)', () => {
  it('accepts the exact enums case-insensitively', () => {
    for (const severity of ['critical', 'HIGH', 'Medium', 'low']) {
      const result = evaluateReport(baseReport({ severity }))
      expect(check(result, 'severity-valid')?.passed, severity).toBe(true)
    }
    for (const priority of ['p1', 'P2', 'p3', 'P4']) {
      const result = evaluateReport(baseReport({ priority }))
      expect(check(result, 'priority-valid')?.passed, priority).toBe(true)
    }
  })
  it('rejects anything else, and never cross-derives', () => {
    for (const severity of ['', 'severe', 'p1', '1', 'blocker']) {
      const result = evaluateReport(baseReport({ severity }))
      expect(check(result, 'severity-valid')?.passed, JSON.stringify(severity)).toBe(false)
    }
    for (const priority of ['', 'p9', 'critical', '1', 'urgent']) {
      const result = evaluateReport(baseReport({ priority }))
      expect(check(result, 'priority-valid')?.passed, JSON.stringify(priority)).toBe(false)
    }
  })
})

describe('finding (22 pts) — per-hunt curated groups', () => {
  it('passes for a full-quality report in every registered hunt', () => {
    for (const [huntId, fixture] of Object.entries(STRONG_FIXTURES)) {
      const result = evaluateReport(fixture)
      expect(check(result, 'finding')?.passed, huntId).toBe(true)
      expect(result.discovered, huntId).toBe(true)
    }
  })

  it('reaches 100/100 (solid, discovered) for every registered hunt', () => {
    for (const [huntId, fixture] of Object.entries(STRONG_FIXTURES)) {
      const result = evaluateReport(fixture)
      expect(result.score, huntId).toBe(100)
      expect(result.verdict, huntId).toBe('solid')
      expect(result.discovered, huntId).toBe(true)
    }
  })

  it('fails for a strong report that names no behaviour area — in every hunt', () => {
    for (const huntId of Object.keys(FINDING_GROUPS)) {
      const result = evaluateReport(findingFreeReport({ huntId }))
      expect(check(result, 'finding')?.passed, huntId).toBe(false)
      expect(result.discovered, huntId).toBe(false)
    }
  })

  it('isolates groups per hunt (exclusive-term reports only satisfy their own hunt)', () => {
    // Exclusive vocabularies: hunt-catalogue-001 owns "description"/"search",
    // hunt-pricing-001 owns "line total"/"unit price", hunt-checkout-001 owns
    // "validation". None of these vocabularies belongs to another hunt.
    const catalogueFixture = STRONG_FIXTURES['hunt-catalogue-001']
    expect(check(evaluateReport({ ...catalogueFixture, huntId: 'hunt-pricing-001' }), 'finding')?.passed).toBe(false)
    expect(check(evaluateReport({ ...catalogueFixture, huntId: 'hunt-cart-001' }), 'finding')?.passed).toBe(false)

    const pricingOnly = baseReport({
      huntId: 'hunt-pricing-001',
      title: 'Line total ignores quantity booked',
      steps: '1. Open checkout\n2. Add 3 units of Ridgeline Tent\n3. Place the order',
      expected: 'The line total should equal the unit price times the count.',
      actual: 'The line total shows the single-unit price on screen.',
    })
    expect(check(evaluateReport({ ...pricingOnly, huntId: 'hunt-pricing-001' }), 'finding')?.passed).toBe(true)
    expect(check(evaluateReport({ ...pricingOnly, huntId: 'hunt-catalogue-001' }), 'finding')?.passed).toBe(false)
    expect(check(evaluateReport({ ...pricingOnly, huntId: 'hunt-checkout-001' }), 'finding')?.passed).toBe(false)
    expect(check(evaluateReport({ ...pricingOnly, huntId: 'hunt-authz-001' }), 'finding')?.passed).toBe(false)

    const checkoutFixture = STRONG_FIXTURES['hunt-checkout-001']
    expect(check(evaluateReport({ ...checkoutFixture, huntId: 'hunt-checkout-001' }), 'finding')?.passed).toBe(true)
    expect(check(evaluateReport({ ...checkoutFixture, huntId: 'hunt-pricing-001' }), 'finding')?.passed).toBe(false)
  })

  it('ignores finding-group terms that appear only in the environment', () => {
    const result = evaluateReport(
      findingFreeReport({ environment: 'Firefox on Linux, search build 2026' }),
    )
    expect(check(result, 'finding')?.passed).toBe(false)
    expect(result.discovered).toBe(false)
  })

  it('never matches unrelated tokens sharing a stem (researcher ≠ search)', () => {
    const result = evaluateReport(
      findingFreeReport({
        huntId: 'hunt-catalogue-001',
        title: 'Researcher note about the flow',
      }),
    )
    expect(check(result, 'finding')?.passed).toBe(false)
  })

  it('normalizes case, punctuation and whitespace when matching', () => {
    const upcase = evaluateReport(
      findingFreeReport({ huntId: 'hunt-catalogue-001', title: 'SEARCH shows nothing for exact inputs' }),
    )
    expect(check(upcase, 'finding')?.passed).toBe(true)
    const punct = evaluateReport(
      findingFreeReport({ huntId: 'hunt-catalogue-001', title: 'Search!!! breaks on punctuation' }),
    )
    expect(check(punct, 'finding')?.passed).toBe(true)
    const multiLine = evaluateReport(
      findingFreeReport({ huntId: 'hunt-catalogue-001', steps: '1. Open the shop\n2. Search!!! for vestibules now\n3. Read the listing' }),
    )
    expect(check(multiLine, 'finding')?.passed).toBe(true)
  })

  it('accepts reasonable synonyms and equivalent terminology', () => {
    const synonymTitles: Array<[string, string]> = [
      ['hunt-catalogue-001', 'Keyword lookup returns nothing useful'],
      ['hunt-catalogue-002', 'Choosing a category changes nothing'],
      ['hunt-cart-001', 'Quantity does not accumulate on re-add'],
      ['hunt-inventory-001', 'Insufficient stock rejected at the exact quantity'],
      ['hunt-pricing-001', 'Line price is multiplied by nothing'],
      ['hunt-checkout-001', 'Customer details pass with an empty value'],
      ['hunt-authz-001', 'Not yours, yet openable by reference'],
    ]
    for (const [huntId, title] of synonymTitles) {
      const result = evaluateReport(findingFreeReport({ huntId, title }))
      expect(check(result, 'finding')?.passed, `${huntId}: ${title}`).toBe(true)
    }
  })

  it('grants finding to keyword salad containing a curated term, but fails everything else it honestly fails', () => {
    // Documented acceptance (plan §14: finding-check gaming is accepted and
    // documented). Salad built only from a curated term still passes `finding`;
    // the report as a whole is scored honestly — the placeholder title fails,
    // distinct fails, steps-quality fails.
    const result = evaluateReport(
      baseReport({
        huntId: 'hunt-checkout-001',
        title: 'blank blank blank blank',
        steps: '1. blank\n2. blank\n3. blank blank blank blank blank blank',
        expected: 'blank blank blank blank here now please',
        actual: 'blank blank blank blank there now please',
      }),
    )
    expect(check(result, 'finding')?.passed).toBe(true)
    expect(check(result, 'title-present')?.passed).toBe(false)
    expect(check(result, 'steps-quality')?.passed).toBe(false)
    expect(check(result, 'expected-actual-distinct')?.passed).toBe(false)
    // 10 + 15 + 8 + 8 + 5 + 5 + 22 = 73
    expect(result.score).toBe(73)
    expect(result.verdict).toBe('needs-work')
  })
})

describe('score range, verdict bands, no-discovery-still-scores', () => {
  it('stays an integer within 0–100 across fixtures', () => {
    for (const fixture of Object.values(STRONG_FIXTURES)) {
      const result = evaluateReport(fixture)
      expect(Number.isInteger(result.score)).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    }
  })

  it('awards ≥ 80 (solid) at the boundary when title and environment fail', () => {
    const result = evaluateReport(baseReport({ title: 'short', environment: 'zzzzzzzz' }))
    expect(result.score).toBe(80)
    expect(result.verdict).toBe('solid')
  })

  it('awards 79 (needs-work) when expected, actual and priority fail', () => {
    const result = evaluateReport(
      baseReport({ expected: 'line wrong', actual: 'also wrong', priority: 'p9' }),
    )
    // distinct stays passing here (token sets barely overlap at this size).
    expect(result.score).toBe(79)
    expect(result.verdict).toBe('needs-work')
  })

  it('awards exactly 50 (needs-work) at the band edge', () => {
    // Passes: steps-present 15 + expected-present 8 + severity-valid 5 + finding 22 = 50.
    const result = evaluateReport(
      baseReport({
        title: 'short',
        environment: 'zzzzzzzz',
        steps: 'did it once\nthen again on the next run it happened again and again and again every single time',
        expected: 'price is the price',
        actual: 'price is it',
        severity: 'high',
        priority: 'p9',
      }),
    )
    expect(check(result, 'finding')?.passed).toBe(true)
    expect(result.score).toBe(50)
    expect(result.verdict).toBe('needs-work')
  })

  it('awards incomplete below 50', () => {
    const sameFixture = baseReport({
      title: 'short',
      environment: 'zzzzzzzz',
      steps: 'did it once\nthen again on the next run it happened again and again and again every single time',
      expected: 'price is the price',
      actual: 'price is it',
      severity: 'bogus',
      priority: 'p9',
    })
    const result = evaluateReport(sameFixture)
    // 50 − 5 (severity) = 45.
    expect(result.score).toBe(45)
    expect(result.verdict).toBe('incomplete')
  })

  it('scores 78 (needs-work) without a finding even on a near-perfect report', () => {
    const result = evaluateReport(findingFreeReport())
    expect(result.score).toBe(78)
    expect(result.verdict).toBe('needs-work')
    expect(result.discovered).toBe(false)
  })

  it('scores an incomplete verdict for a fully junk report', () => {
    const result = evaluateReport(
      baseReport({
        title: 'short',
        environment: 'zzzzzzzz',
        steps: 'no structure at all',
        expected: 'short',
        actual: 'short',
        severity: 'bogus',
        priority: 'p9',
      }),
    )
    expect(result.score).toBeLessThanOrEqual(15)
    expect(result.verdict).toBe('incomplete')
  })
})

describe('determinism and feedback correctness', () => {
  it('produces identical output for identical input', () => {
    for (const fixture of Object.values(STRONG_FIXTURES)) {
      expect(evaluateReport(fixture)).toEqual(evaluateReport(fixture))
    }
  })

  it('emits ten labelled checks with unique ids and non-empty messages', () => {
    const result = evaluateReport(baseReport())
    expect(result.checks).toHaveLength(10)
    expect(new Set(result.checks.map((c) => c.id)).size).toBe(10)
    for (const item of result.checks) {
      expect(item.label.trim().length).toBeGreaterThan(0)
      expect(item.message.trim().length).toBeGreaterThan(0)
      expect(typeof item.passed).toBe('boolean')
    }
  })

  it('never leaks defect ids or finding-group vocabulary in feedback messages', () => {
    const evaluations = Object.values(STRONG_FIXTURES).map((fixture) => evaluateReport(fixture))
    const normalisedGroups = Object.values(FINDING_GROUPS)
      .flat()
      .map((term) => normalizeForEvaluation(term))
    for (const evaluation of evaluations) {
      const serialized = JSON.stringify(evaluation)
      for (const defectId of DEFECT_IDS) {
        expect(serialized).not.toContain(defectId)
      }
      for (const item of evaluation.checks) {
        const message = ` ${normalizeForEvaluation(item.message)} `
        for (const term of normalisedGroups) {
          if (term.length === 0) continue
          expect(message.includes(` ${term} `), `leaked term ${JSON.stringify(term)} in ${message}`).toBe(false)
        }
      }
    }
  })
})
