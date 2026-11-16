// Unit tests for the pure bug-report form helpers (P4-M2 WP2): validation,
// the submission flow (with an injected transport), verdict presentation and
// the markdown download. No DOM, no network.
import { describe, expect, it, vi } from 'vitest'
import {
  EMPTY_REPORT_FORM_VALUES,
  REPORT_FIELD_LIMITS,
  describeSubmitError,
  escapeMarkdownText,
  priorityLabel,
  reproducibilityLabel,
  reportFilename,
  reportMarkdown,
  severityLabel,
  submitReportFlow,
  toSubmission,
  validateReportValues,
  verdictDisplay,
  type ReportFormValues,
} from '../../src/lib/reportForm'
import type {
  BugReportSubmission,
  ReportSubmissionResponse,
} from '../../src/shared/learning'

const VALID_VALUES: ReportFormValues = {
  title: 'Cart shows the wrong line total',
  environment: 'Meridian practice shop, Chrome on Linux',
  preconditions: 'Empty cart, signed out',
  steps: '1. Open /shop\n2. Add two copies of the same product\n3. Open /cart',
  expected: 'Line total should be quantity × unit price (2 × 42.00 = 84.00).',
  actual: 'Line total shows 42.00 regardless of the quantity in the cart.',
  severity: 'high',
  priority: 'p2',
  reproducibility: 'sometimes',
}

const SUBMISSION_RESPONSE: ReportSubmissionResponse = {
  attempt: {
    status: 'submitted',
    hintsUsed: 0,
    bestQualityScore: 82,
    discovered: false,
    submittedAt: '2026-11-16T10:20:30.000Z',
  },
  report: {
    title: 'Cart shows the wrong line total',
    environment: 'Meridian practice shop, Chrome on Linux',
    preconditions: 'Empty cart, signed out',
    steps: '1. Open /shop\n2. Add two copies of the same product\n3. Open /cart',
    expected: 'Line total should be quantity × unit price (2 × 42.00 = 84.00).',
    actual: 'Line total shows 42.00 regardless of the quantity in the cart.',
    severity: 'high',
    priority: 'p2',
    reproducibility: 'sometimes',
    qualityScore: 82,
    feedback: [
      { id: 'title-present', passed: true, message: 'Title describes the problem.' },
    ],
    createdAt: '2026-11-16T10:20:30.000Z',
  },
  evaluation: {
    score: 82,
    verdict: 'solid',
    checks: [
      { id: 'title-present', label: 'Title', passed: true, message: 'Title describes the problem.' },
      { id: 'environment-present', label: 'Environment', passed: true, message: 'Environment identifies where the problem was seen.' },
      { id: 'steps-present', label: 'Steps', passed: true, message: 'Steps are discrete and reproducible.' },
      { id: 'steps-quality', label: 'Step quality', passed: true, message: 'Steps describe concrete actions and values.' },
      { id: 'expected-present', label: 'Expected', passed: true, message: 'Expected behaviour is stated.' },
      { id: 'actual-present', label: 'Actual', passed: true, message: 'Actual behaviour is stated.' },
      { id: 'expected-actual-distinct', label: 'Expected vs actual', passed: true, message: 'Expected and actual behaviour are clearly different.' },
      { id: 'severity-valid', label: 'Severity', passed: true, message: 'Severity is a valid impact level.' },
      { id: 'priority-valid', label: 'Priority', passed: true, message: 'Priority is a valid urgency.' },
      { id: 'finding', label: 'Finding', passed: false, message: 'Does not identify which behaviour is incorrect — describe the behaviour that shows the problem.' },
    ],
  },
}

describe('validateReportValues', () => {
  it('accepts a complete, valid form', () => {
    expect(validateReportValues(VALID_VALUES)).toEqual({})
  })

  it('flags every missing required field on an empty form', () => {
    const fields = validateReportValues(EMPTY_REPORT_FORM_VALUES)
    expect(Object.keys(fields)).toEqual(
      expect.arrayContaining([
        'title', 'environment', 'steps', 'expected', 'actual', 'severity', 'priority',
      ]),
    )
    // Preconditions is optional and must not be flagged.
    expect(fields.preconditions).toBeUndefined()
    // Reproducibility defaults to a valid selection.
    expect(fields.reproducibility).toBeUndefined()
  })

  it('flags whitespace-only required fields', () => {
    const fields = validateReportValues({ ...VALID_VALUES, title: '   ', steps: ' \n ' })
    expect(fields.title).toBeTruthy()
    expect(fields.steps).toBeTruthy()
  })

  it('enforces the server length caps', () => {
    const fields = validateReportValues({
      ...VALID_VALUES,
      title: 't'.repeat(REPORT_FIELD_LIMITS.title + 1),
      steps: 's'.repeat(REPORT_FIELD_LIMITS.steps + 1),
      expected: 'e'.repeat(REPORT_FIELD_LIMITS.expected + 1),
      actual: 'a'.repeat(REPORT_FIELD_LIMITS.actual + 1),
      environment: 'env '.repeat(100),
      preconditions: 'p'.repeat(REPORT_FIELD_LIMITS.preconditions + 1),
    })
    expect(fields.title).toMatch(/200/)
    expect(fields.steps).toMatch(/4000/)
    expect(fields.expected).toMatch(/2000/)
    expect(fields.actual).toMatch(/2000/)
    expect(fields.environment).toMatch(/200/)
    expect(fields.preconditions).toMatch(/1000/)
  })

  it('rejects out-of-enum severity and priority', () => {
    const fields = validateReportValues({
      ...VALID_VALUES,
      severity: '',
      priority: '',
    })
    expect(fields.severity).toBeTruthy()
    expect(fields.priority).toBeTruthy()
  })

  it('does not derive anything between severity and priority', () => {
    const low = validateReportValues({ ...VALID_VALUES, severity: 'low', priority: 'p1' })
    expect(low).toEqual({})
  })
})

describe('toSubmission', () => {
  it('sends exactly the nine client-allowed keys — no score, feedback or discovery fields', () => {
    const submission = toSubmission(VALID_VALUES)
    expect(Object.keys(submission).sort()).toEqual(
      [
        'actual', 'environment', 'expected', 'preconditions', 'priority',
        'reproducibility', 'severity', 'steps', 'title',
      ].sort(),
    )
    expect(submission).not.toHaveProperty('qualityScore')
    expect(submission).not.toHaveProperty('feedback')
    expect(submission).not.toHaveProperty('discovered')
    expect(submission).not.toHaveProperty('evaluation')
    expect(submission).not.toHaveProperty('huntId')
    expect(submission).not.toHaveProperty('attemptId')
  })

  it('trims values and maps empty preconditions to null', () => {
    const submission = toSubmission({
      ...VALID_VALUES,
      title: '  Padded title  ',
      preconditions: '   ',
    })
    expect(submission.title).toBe('Padded title')
    expect(submission.preconditions).toBeNull()
  })
})

describe('submitReportFlow', () => {
  const post = vi.fn(async (huntId: string, submission: BugReportSubmission) => {
    void huntId
    void submission
    return SUBMISSION_RESPONSE
  })

  it('submits valid values and returns the server response verbatim', async () => {
    post.mockClear()
    const values: ReportFormValues = { ...VALID_VALUES }
    const outcome = await submitReportFlow({ huntId: 'hunt-cart-001', values, inFlight: false, post })
    expect(outcome.kind).toBe('success')
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0]?.[0]).toBe('hunt-cart-001')
    if (outcome.kind === 'success') {
      expect(outcome.response.evaluation.score).toBe(82)
      expect(outcome.response.evaluation.verdict).toBe('solid')
    }
    // The caller's values object is never mutated.
    expect(values).toEqual(VALID_VALUES)
  })

  it('blocks duplicate submissions while one is in flight (post is not called)', async () => {
    post.mockClear()
    const outcome = await submitReportFlow({
      huntId: 'hunt-cart-001',
      values: VALID_VALUES,
      inFlight: true,
      post,
    })
    expect(outcome).toEqual({ kind: 'blocked' })
    expect(post).not.toHaveBeenCalled()
  })

  it('stops before the network on client-side validation errors', async () => {
    post.mockClear()
    const outcome = await submitReportFlow({
      huntId: 'hunt-cart-001',
      values: EMPTY_REPORT_FORM_VALUES,
      inFlight: false,
      post,
    })
    expect(outcome.kind).toBe('invalid')
    expect(post).not.toHaveBeenCalled()
    if (outcome.kind === 'invalid') {
      expect(outcome.fields.title).toBeTruthy()
    }
  })

  it('maps a 400 with per-field messages to the fields, keeping the values object untouched', async () => {
    const fields = { title: 'Enter a title (1–200 characters).', body: 'Unknown keys are ignored.' }
    const failing = async () => {
      throw Object.assign(new Error('Check the highlighted fields and try again.'), {
        status: 400,
        code: 'invalid_request',
        fields,
      })
    }
    const values: ReportFormValues = { ...VALID_VALUES }
    const outcome = await submitReportFlow({ huntId: 'hunt-cart-001', values, inFlight: false, post: failing })
    expect(outcome.kind).toBe('failure')
    if (outcome.kind === 'failure') {
      expect(outcome.status).toBe(400)
      expect(outcome.message).toBe('Check the highlighted fields and try again.')
      // Known fields are mapped; unknown keys like `body` are dropped.
      expect(outcome.fields).toEqual({ title: 'Enter a title (1–200 characters).' })
      // Failure outcomes never carry an evaluation.
      expect(outcome).not.toHaveProperty('evaluation')
      expect(outcome).not.toHaveProperty('response')
    }
    expect(values).toEqual(VALID_VALUES)
  })

  it('surfaces a 401 session_required as a failure without touching the text', async () => {
    const failing = async () => {
      throw Object.assign(new Error('Start the exercise before submitting a report.'), {
        status: 401,
        code: 'session_required',
      })
    }
    const values: ReportFormValues = { ...VALID_VALUES }
    const outcome = await submitReportFlow({ huntId: 'hunt-cart-001', values, inFlight: false, post: failing })
    expect(outcome.kind).toBe('failure')
    if (outcome.kind === 'failure') {
      expect(outcome.status).toBe(401)
      expect(outcome.code).toBe('session_required')
      expect(outcome.message).toMatch(/start the exercise/i)
      expect(outcome.fields).toBeNull()
    }
    expect(values).toEqual(VALID_VALUES)
  })

  it('surfaces a 404 hunt_not_found as a failure', async () => {
    const failing = async () => {
      throw Object.assign(new Error('No such practice hunt exists.'), {
        status: 404,
        code: 'hunt_not_found',
      })
    }
    const outcome = await submitReportFlow({ huntId: 'hunt-nope-999', values: VALID_VALUES, inFlight: false, post: failing })
    expect(outcome.kind).toBe('failure')
    if (outcome.kind === 'failure') {
      expect(outcome.status).toBe(404)
      expect(outcome.code).toBe('hunt_not_found')
    }
  })

  it('surfaces a 429 rate_limited with the server message and no invented duration', async () => {
    const message = 'Too many report submissions from this network. Wait a minute and try again.'
    const failing = async () => {
      throw Object.assign(new Error(message), { status: 429, code: 'rate_limited' })
    }
    const outcome = await submitReportFlow({ huntId: 'hunt-cart-001', values: VALID_VALUES, inFlight: false, post: failing })
    expect(outcome.kind).toBe('failure')
    if (outcome.kind === 'failure') {
      expect(outcome.status).toBe(429)
      expect(outcome.message).toBe(message)
      expect(outcome).not.toHaveProperty('retryAfter')
    }
  })

  it('hides raw server internals on unexpected 5xx failures', async () => {
    const failing = async () => {
      throw Object.assign(new Error('D1_ERROR: table hunt_attempts does not exist'), {
        status: 500,
        code: 'internal_error',
      })
    }
    const outcome = await submitReportFlow({ huntId: 'hunt-cart-001', values: VALID_VALUES, inFlight: false, post: failing })
    expect(outcome.kind).toBe('failure')
    if (outcome.kind === 'failure') {
      expect(outcome.message).not.toContain('D1_ERROR')
      expect(outcome.message).not.toContain('hunt_attempts')
    }
  })

  it('treats a network-level failure as unreachable, not as an evaluation', async () => {
    const failing = async () => {
      throw new TypeError('fetch failed')
    }
    const outcome = await submitReportFlow({ huntId: 'hunt-cart-001', values: VALID_VALUES, inFlight: false, post: failing })
    expect(outcome.kind).toBe('failure')
    if (outcome.kind === 'failure') {
      expect(outcome.status).toBeNull()
      expect(outcome.message).toMatch(/could not be reached/i)
      expect(outcome.message).not.toContain('fetch failed')
    }
  })
})

describe('describeSubmitError', () => {
  it('never leaks raw exception text for unknown statuses', () => {
    const outcome = describeSubmitError(new Error('super secret internals'))
    expect(outcome.kind).toBe('failure')
    expect(outcome.message).not.toContain('super secret internals')
  })
})

describe('verdictDisplay', () => {
  it('maps the three bands to labels and tones without recomputing anything', () => {
    expect(verdictDisplay('solid').label).toBe('Solid')
    expect(verdictDisplay('solid').tone).toBe('ready')
    expect(verdictDisplay('needs-work').label).toBe('Needs work')
    expect(verdictDisplay('needs-work').tone).toBe('warn')
    expect(verdictDisplay('incomplete').label).toBe('Incomplete')
    expect(verdictDisplay('incomplete').tone).toBe('planned')
  })
})

describe('labels', () => {
  it('renders learner-facing enum labels', () => {
    expect(severityLabel('critical')).toBe('Critical')
    expect(priorityLabel('p2')).toBe('P2 — High')
    expect(reproducibilityLabel('always')).toBe('Always')
  })
})

describe('escapeMarkdownText', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeMarkdownText('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert("x")&lt;/script&gt;',
    )
    expect(escapeMarkdownText('a & b')).toBe('a &amp; b')
    expect(escapeMarkdownText('`code`')).toBe('\\`code\\`')
    expect(escapeMarkdownText('back\\slash')).toBe('back\\\\slash')
  })

  it('neutralises lines that would open a heading', () => {
    expect(escapeMarkdownText('# not a heading')).toBe('\\# not a heading')
    expect(escapeMarkdownText('## section')).toBe('\\## section')
  })

  it('normalises CRLF line endings', () => {
    expect(escapeMarkdownText('a\r\nb')).toBe('a\nb')
  })
})

describe('reportFilename', () => {
  it('builds a slugged name with the submission date', () => {
    expect(reportFilename('Cart shows the wrong line total', '2026-11-16T10:20:30.000Z')).toBe(
      'bug-report-cart-shows-the-wrong-line-total-2026-11-16.md',
    )
  })

  it('falls back when the title has no slug-able characters', () => {
    expect(reportFilename('!!!', '2026-11-16T10:20:30.000Z')).toBe('bug-report-2026-11-16.md')
  })

  it('omits the date when the timestamp is unusable', () => {
    expect(reportFilename('Cart bug', 'not-a-date')).toBe('bug-report-cart-bug.md')
  })
})

describe('reportMarkdown', () => {
  const markdown = reportMarkdown(SUBMISSION_RESPONSE.report, SUBMISSION_RESPONSE.evaluation)

  it('includes the submitted fields, enums and the rule-based evaluation', () => {
    expect(markdown).toContain('# Bug report — Cart shows the wrong line total')
    expect(markdown).toContain('Environment: Meridian practice shop, Chrome on Linux')
    expect(markdown).toContain('Severity: High')
    expect(markdown).toContain('Priority: P2 — High')
    expect(markdown).toContain('Reproducibility: Sometimes')
    expect(markdown).toContain('Empty cart, signed out')
    expect(markdown).toContain('quantity × unit price')
    expect(markdown).toContain('- Score: 82/100 — Solid')
    expect(markdown).toContain('PASS')
    expect(markdown).toContain('FAIL')
    expect(markdown).toContain('Title describes the problem.')
  })

  it('contains the discovery-vs-quality explanation', () => {
    expect(markdown).toContain('Report quality and finding the defect are scored separately')
  })

  it('excludes internal identifiers, hidden defect data and evaluator internals', () => {
    expect(markdown).not.toContain('hunt-')
    expect(markdown).not.toContain('attempt')
    expect(markdown).not.toContain('PRICING-001')
    expect(markdown).not.toContain('qualityScore')
    expect(markdown).not.toContain('bestQualityScore')
    expect(markdown).not.toMatch(/attemptId|reportId/i)
    // Check ids (evaluator internals) must not be rendered — only labels and messages.
    expect(markdown).not.toContain('title-present')
    expect(markdown).not.toContain('expected-actual-distinct')
  })

  it('escapes user-supplied content so it cannot alter the document', () => {
    const hostile = reportMarkdown(
      {
        ...SUBMISSION_RESPONSE.report,
        title: '<img src=x onerror=alert(1)> # owned',
        steps: '1. open\n# a fake heading\n2. `id`',
      },
      SUBMISSION_RESPONSE.evaluation,
    )
    expect(hostile).not.toContain('<img')
    expect(hostile).toContain('&lt;img')
    expect(hostile).not.toContain('\n# a fake heading')
    expect(hostile).toContain('\\# a fake heading')
    expect(hostile).toContain('\\`id\\`')
  })

  it('marks an absent optional section instead of fabricating one', () => {
    const markdown = reportMarkdown(
      { ...SUBMISSION_RESPONSE.report, preconditions: null },
      SUBMISSION_RESPONSE.evaluation,
    )
    expect(markdown).toContain('## Preconditions\n\n_Not provided._')
  })
})
