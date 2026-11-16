// Evaluation result view for a submitted bug report (P4-M2 WP2).
// Renders the server-returned §6.4 evaluation verbatim — the score, verdict
// and per-check feedback all come from the API; nothing here recomputes or
// embellishes them. Learner-facing throughout: no defect ids, no
// finding-check terms, no evaluator internals.

import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Icon } from '../../components/ui/Icon'
import { Tag } from '../../components/ui/Tag'
import type { AttemptView, ReportEvaluation } from '../../shared/learning'
import { VERDICT_BANDS_NOTE, verdictDisplay } from '../../lib/reportForm'

interface ReportEvaluationViewProps {
  evaluation: ReportEvaluation
  attempt: AttemptView
  onRevise: () => void
  onDownload: () => void
}

export function ReportEvaluationView({
  evaluation,
  attempt,
  onRevise,
  onDownload,
}: ReportEvaluationViewProps) {
  const verdict = verdictDisplay(evaluation.verdict)
  const passedCount = evaluation.checks.filter((check) => check.passed).length

  return (
    <section className="report-result" aria-labelledby="report-result-title">
      <div className="report-result-head">
        <h4 id="report-result-title">Report evaluation</h4>
        <div className="report-result-score">
          <span className="report-score" aria-hidden="true">
            {evaluation.score}
            <span className="report-score-max"> / 100</span>
          </span>
          <span className="sr-only">Score: {evaluation.score} out of 100</span>
          <Tag tone={verdict.tone} icon={verdict.tone === 'warn' ? 'alert' : verdict.tone === 'ready' ? 'check' : undefined}>
            {verdict.label}
          </Tag>
        </div>
      </div>
      <p className="report-result-verdict-note">{verdict.description} {VERDICT_BANDS_NOTE}</p>
      <p className="panel-note">
        Scored by deterministic rules on the server — not by AI, and nothing about the score is
        estimated in your browser. Resubmitting keeps your best score.
      </p>

      <div className="report-eval-block">
        <h5>
          What the report does well, and what to improve ({passedCount} of{' '}
          {evaluation.checks.length} checks passed)
        </h5>
        <ul className="report-checks">
          {evaluation.checks.map((check) => (
            <li key={check.id} className={`report-check ${check.passed ? 'report-check-passed' : 'report-check-failed'}`}>
              <span className="report-check-icon" aria-hidden="true">
                <Icon name={check.passed ? 'check' : 'alert'} size={16} />
              </span>
              <span className="report-check-body">
                <span className="sr-only">{check.passed ? 'Passed: ' : 'Needs improvement: '}</span>
                <span className="report-check-label">{check.label}</span> — {check.message}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Callout tone="info" title="Report quality and finding the defect are different things">
        The score above grades the <em>report</em> — structure, detail and clarity. Discovery is
        decided separately, from whether your title, steps, expected and actual results describe
        the incorrect behaviour. A polished report can score well without identifying the defect,
        and identifying it can still leave sections of the report needing work.
        {attempt.discovered
          ? ' Your attempt currently counts as having found the defect.'
          : ' Your attempt does not yet count as having found the defect.'}
      </Callout>

      <div className="button-row">
        <Button variant="secondary" size="sm" onClick={onRevise}>
          <Icon name="reset" size={15} />
          Revise and resubmit
        </Button>
        <Button variant="ghost" size="sm" onClick={onDownload}>
          <Icon name="book" size={15} />
          Download the report (.md)
        </Button>
      </div>
      <p className="panel-note">
        The download contains only what you submitted plus the rule-based score and checklist —
        no internal identifiers, no hidden defect details.
      </p>
    </section>
  )
}
