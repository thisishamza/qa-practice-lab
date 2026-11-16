// Learner-facing presentation of the §6.4 report evaluation rubric (P4-M3
// WP2). Static content sourced from the canonical shared module
// (src/shared/evaluationRubric.ts) — the same definitions the server
// evaluator scores against. Contains no finding-check terms, no defect
// identifiers and no evaluator internals; discovery is explained in
// behavioural terms only.

import {
  EVALUATION_RUBRIC,
  EVALUATION_TOTAL_POINTS,
  VERDICT_BANDS,
} from '../../shared/evaluationRubric'
import { Callout } from '../../components/ui/Callout'

export function EvaluationTransparency() {
  return (
    <div className="evaluation-transparency">
      <p className="panel-note">
        Every structured bug report you file is read by a deterministic, rule-based evaluator.
        The same ten checks, worth the same points, run on every submission — there is no
        timer, no speed bonus, no comparison with other learners, and no AI in the loop. You
        can see exactly what earns or loses points below, and every submission returns
        per-check feedback so you know what to fix.
      </p>

      <h3 className="evaluation-subhead" id="rubric-checks">
        The ten checks — {EVALUATION_TOTAL_POINTS} points in total
      </h3>
      <ol className="rubric-list" aria-label="Report evaluation checks and their point weights">
        {EVALUATION_RUBRIC.map((check) => (
          <li key={check.id} className="rubric-row">
            <span className="rubric-row-copy">
              <span className="rubric-row-label">{check.label}</span>
              <span className="rubric-row-summary">{check.summary}</span>
            </span>
            <span className="rubric-row-points">
              <span aria-hidden="true">{check.points}</span>
              <span className="sr-only">{check.points} points</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="rubric-total">
        <span aria-hidden="true">Total: {EVALUATION_TOTAL_POINTS} points</span>
        <span className="sr-only">The ten checks add up to {EVALUATION_TOTAL_POINTS} points</span>
      </p>

      <h3 className="evaluation-subhead" id="verdict-bands">
        Verdict bands
      </h3>
      <p className="panel-note">
        Your score maps onto one of three verdicts. Bands are fixed — the same thresholds apply
        to every report, every time.
      </p>
      <ul className="verdict-band-list" aria-label="Score verdict bands">
        {VERDICT_BANDS.map((band) => (
          <li key={band.id} className="verdict-band">
            <span className="verdict-band-range">
              <span aria-hidden="true">
                {band.minimum}–{band.maximum}
              </span>
              <span className="sr-only">
                Scores from {band.minimum} to {band.maximum}
              </span>
            </span>
            <span className="verdict-band-copy">
              <span className="verdict-band-label">{band.label}</span>
              <span className="rubric-row-summary">{band.description}</span>
            </span>
          </li>
        ))}
      </ul>

      <h3 className="evaluation-subhead" id="discovery-vs-score">
        Report quality is not the same as finding the defect
      </h3>
      <Callout tone="warning" title="A high score does not automatically mean the defect was found">
        The score measures how well your report is written — completeness, clarity and
        evidence. Whether you actually identified the incorrect behaviour is tracked separately,
        as <strong>discovery</strong>.
      </Callout>
      <p className="panel-note">
        Discovery is credited only when the finding check passes: the behaviour described across
        your title, steps, expected and actual (environment lines are not counted) is
        recognisably the incorrect behaviour, matched server-side against a curated list of
        behaviour terms that accepts reasonable synonyms. That list stays server-side — it is
        never sent to the browser and never shown to you, so working the problem out is still
        the exercise. An unrelated mention does not earn discovery, and discovery is sticky once
        earned — nothing you do afterwards takes it away.
      </p>
      <p className="panel-note">
        Some checks — for example having all the fields filled with the right enums — can be
        satisfied by a report that misses the actual fault. A report can score well in the 50s
        or 70s without describing the incorrect behaviour, and such a report is not a
        discovery. Equally, discovering the defect with a thin report is a discovery but a low
        score. Treat the two numbers separately: chase the discovery, then improve the report.
      </p>

      <h3 className="evaluation-subhead" id="hints-and-reveals">
        Hints and reveals count for exactly what they are
      </h3>
      <ul className="plain-list">
        <li>
          Hints never lower your score and never award discovery — using them is disclosed as
          a count (0–3) and shown on your progress, nothing more.
        </li>
        <li>
          Revealing the solution never awards discovery and never counts as completing the
          exercise. It unlocks the write-up so you can compare it with your investigation, or
          concedes the hunt when you are stuck.
        </li>
        <li>
          A revealed attempt confers no discovery, even if you file a report afterwards —
          reports filed on a revealed attempt are evaluated and scored, but the give-up is not
          undone by them. Submit-then-reveal keeps what you earned.
        </li>
      </ul>
      <p className="panel-note">
        This training environment is fictional. The shop, the accounts, the orders and every
        defect are synthetic, and checkout is a deterministic simulation — nothing is really
        bought, paid for or shipped. Scores and discoveries here measure practice, not
        employment readiness or real-world payment systems.
      </p>
    </div>
  )
}
