// Lab hints and gated reveals (final phase) — SERVER-ONLY. Compiled into the
// Worker like the contract/SQL registries; nothing here reaches the browser
// before authorization. Hints are progressive (level N requires N-1 used);
// reveals unlock only after a submitted report or an explicit give-up.
//
// Coverage: every lab exercise (36) and every final-phase hunt (9). The
// content is intentionally compact but complete — it teaches, never leaks
// the answer outright at levels 1–2, and the full worked explanation at
// level 3 / reveal.

export interface LabRevealDefinition {
  expected: string
  actual: string
  rootCause: string
  reproduction: string[]
  verification: string[]
  concepts: string[]
  commonMisconceptions: string[]
  solution: string
  explanation: string
}

export const LAB_HINTS: Record<string, readonly [string, string, string]> = {
  // ---------------- Performance ----------------
  'perf-bgn-baseline-01': [
    'Think about order: what do you measure before anyone can talk about breaking points?',
    'A baseline is a fixed, comparable measurement — not a stress profile and not an average.',
    'Look for the options that fix endpoint, data, environment, concurrency and duration — those are the baseline properties. The spike/stress options jump ahead of them.',
  ],
  'perf-bgn-metric-02': [
    'Averages hide the tail. Which metrics describe the typical user, and which the worst 5%?',
    'p95 leaves 5% above it; p99 leaves 1%. Compare them against the median, not against each other.',
    'The correct statements: tail vs median vs average, what p95/p99 literally mean, and the fact that small samples make p99 meaningless.',
  ],
  'perf-bgn-workload-03': [
    'The safe run is small, capped and repeatable — the unsafe ones remove limits or point outside the lab.',
    'Good options fix VUs, duration, ramp-up, rps, timeout and a constant endpoint — and exclude “remove all limits” and “hit a public API”.',
    'Every option that says “no cap / unlimited / external target” is out; every option that bounds the run is in.',
  ],
  'perf-bgn-result-04': [
    'One is a rate (req/s), the other is a duration (ms). They degrade differently.',
    'Past saturation, throughput flattens while latency keeps rising — and the error mix tells you which side broke.',
    'Correct items: rate vs duration, the saturation knee, error-rate interplay, and concurrency sustaining cap throughput while each request slows.',
  ],
  'perf-int-bottleneck-05': [
    'Add the measured layers up: which one owns >90% of the total?',
    'Network 15 ms + DB 40 ms cannot explain 950 ms. The app handler owns the rest — trust the arithmetic, not the job title.',
    'In: app-bound, DB exonerated, network exonerated, measurement-over-guesswork, percentile attribution, and the re-test. Out: the index-tuning and “cache it anyway” options.',
  ],
  'perf-int-pagination-06': [
    'What does OFFSET 5000 force the engine to do with the first 5000 rows?',
    'Keyset pagination seeks instead of skipping — and page size must be capped server-side.',
    'In: OFFSET scan, flat-vs-growing cost, keyset, index can lower (not erase) cost, COUNT is a second scan, bound perPage. Out: “same SQL text costs the same” and “just buy hardware”.',
  ],
  'perf-int-cache-07': [
    'What does 60 seconds of staleness buy against 96% read share — and who bears it?',
    'Hit rate, TTL, invalidation and the personalised-response exception are the load-bearing concepts.',
    'In: amortisation, staleness budget, hit-rate measurement, invalidation, no shared cache for user-specific data, cold-miss tail. Out: “cache forever” and “caching fixes the query plan”.',
  ],
  'perf-int-error-08': [
    'What counts as “success” in the 2.1% — and where exactly does it fail?',
    'Split by status class: 5xx is your failure, 4xx is rejection, fast-fails inflate req/s — separate timeouts too.',
    'In: concentrated-defect reading, status classes, pre-agreed budget, fast-fail illusion, retry amplification, timeout accounting. Out: “4xx never matters” and “green p95 makes errors irrelevant”.',
  ],
  'perf-adv-nplus-09': [
    'What does the trace show happening once per row — and what should happen once per page?',
    'Count the queries: 1 + N. Multiply per-item cost by page size; the slope is the finding.',
    'In: N+1 shape, the arithmetic, batching fix, linear scaling, query-count budget. Out: “cache covers it”, “an index fixes the shape”, and “can’t reproduce in staging”.',
  ],
  'perf-adv-capacity-10': [
    'Where does throughput stop rising while latency keeps climbing? That’s the knee.',
    'Plan steady state near the knee with explicit headroom — never the peak figure, never a linear extrapolation.',
    'In: knee location, safe-load statement, p95 signal, error signal, headroom, stated conditions. Out: “linear forever”, “one passing run proves launch”.',
  ],
  'perf-adv-spike-11': [
    'A spike that arrives gradually is a load test wearing a costume. What does the real one look like?',
    'Baseline → abrupt jump → brief hold → drop → watch the recovery. Name the failure mode you are hunting.',
    'In: jump shape, recovery time, failure-mode choice, isolated environment, capped intensity, baseline pairing. Out: “hold forever” and “randomise everything”.',
  ],
  'perf-adv-soak-12': [
    'Compare three successive windows, not one long run: is p95 still falling or only rising?',
    'Flat errors + rising p95 + flat throughput = something accumulates; confirm by repeating the identical windowed run.',
    'In: windowed slope, leak candidates, flat-error non-exoneration, windowing, reproducibility, honest 30-second bound. Out: “restart nightly” and “extend unbounded”.',
  ],
  // ---------------- Security ----------------
  'sec-bgn-authn-01': [
    'Which controls slow guessing, which reset trust, and which make known passwords worthless?',
    'Rate limiting, step-up checks, soft lockout, breach corpora and a generic failure message are the load-bearing five-plus-one.',
    'In: rate limit, step-up check, soft lockout, breach-corpus rejection, generic failure, correlation logging. Out: faster hashes, security questions.',
  ],
  'sec-bgn-input-02': [
    'Is the variable part of the SQL text ever? If not, injection has no door.',
    'Separate the channels: structure is code, values are data — escaping is neither.',
    'In: two-channel separation, driver binding semantics, escaping’s fragility, IN-lists need placeholders, least-privilege pairing. Out: “ORMs need no review”, “error messages help users”.',
  ],
  'sec-bgn-headers-03': [
    'Each header buys down a specific browser risk — which is which?',
    'nosniff, HSTS, framing refusal, referrer bounding, CORP and Cache-Control are the load-bearing set here.',
    'In: nosniff, HSTS, X-Frame-Options/frame-ancestors, Referrer-Policy, CORP, Cache-Control no-store. Out: X-XSS-Protection as “modern”, and Server-removal as sufficient.',
  ],
  'sec-bgn-data-04': [
    'Imagine each item in a shared screen-share. Does anyone gasp?',
    'Credentials, tokens, bulk PII, internals, debug flags and other users’ proofs must never render.',
    'In: hashes/salts, tokens in URLs/logs/bodies, bulk PII, internals in errors, debug=true, other users’ references. Out: public product names and “USD”.',
  ],
  'sec-int-bola-05': [
    'Log in as two different synthetic customers. Ask each for the same order. Compare.',
    '404/uniformity, two-account matrix, rate limiting and the authn≠authz distinction are the load-bearing pieces.',
    'In: two accounts, non-enumerable response, bounded enumeration in-lab, authn≠authz, enumeration budget, uniform 404. Out: “body can be empty with 200 + hint”, “client-side filtering counts”.',
  ],
  'sec-int-session-06': [
    'Walk the token’s life: minted, used, logged out. Which step must touch the server?',
    'TTL shrinks the window; revocation ends it. Only hashes are stored; roles are re-read live.',
    'In: server-side revocation, TTL-not-revocation, hash storage, live authorization at call time, rotation on role change, audience binding. Out: “cookie cleared = token dead”, “single-use only”.',
  ],
  'sec-int-escalation-07': [
    'The menu hides it. Does the server know?',
    'Server-side allowlist checks, role from the stored row, mass-assignment stripping and default-deny routing are the answer.',
    'In: server 403, direct-call testing, DB-sourced role, mass-assignment stripping, audit logging, default-deny, 404-vs-403 discipline. Out: “UI hiding is enough”.',
  ],
  'sec-int-api-08': [
    'Each finding maps to one OWASP API family — which door does each belong to?',
    'BOLA, consumption limits, misconfiguration, excessive data exposure, inventory, mass assignment.',
    'In: BOLA mapping, unrestricted consumption mapping, verbose→misconfiguration/inventory, /me overshare mapping, inventory mapping, mass assignment mapping. Out: “BOLA = authn problem”, “BOLA = SSRF”.',
  ],
  'sec-adv-authz-09': [
    'Write rows (who) and columns (what × verb). Fill every cell before testing.',
    'Object-level scope, verb-level splits, fail-closed defaults and per-cell negatives are the testable shape.',
    'In: actor × resource × verb matrix, object-level cells, read/write split, paired negatives, fail-closed, server-side enforcement. Out: “authn strong ⇒ cells redundant”, “hard ids need no checks”.',
  ],
  'sec-adv-chain-10': [
    'Chain the three findings in order: which unlocks which?',
    'Low findings compound — report the path, the reachable data, and the cheapest link to break.',
    'In: compounding, reference+object-check chain, mass enumeration, single-narrative report, weakest-link break, data-class weighting. Out: “lows never matter”, “chain needs exploit code”.',
  ],
  'sec-adv-sql-11': [
    'Defense in depth: parameterize at the query, least-privilege at the role, generic errors at the edge, detection in the logs.',
    'Second-order injection defeats input-time filtering alone — parameterize at every use site.',
    'In: parameterization, least privilege, error hygiene, log-based detection, second-order. Out: keyword blacklists, WAF-only sufficiency, “ORM ⇒ zero review”.',
  ],
  'sec-adv-xss-12': [
    'The demo is inert — so look at what the encoder does to `<` instead of what the filter removes.',
    'Encode per context; CSP as layer two; HttpOnly cookies neutralize token theft; input filters lose to encoding variants.',
    'In: context-aware output encoding, per-context encoders, CSP default-src self, output encoding beats input filtering, stored XSS ignores input filters, framework escape hatches, HttpOnly. Out: X-XSS-Protection as primary.',
  ],
  // ---------------- Microservices / event-driven ----------------
  'evt-bgn-guarantee-01': [
    'Can the network make exactly-once happen, or only the consumer?',
    'At-most = loss; at-least = duplicates; exactly-once = at-least + dedup. Plus what undeliverables need.',
    'In: at-most-once, at-least-once, exactly-once-as-composition, explicit trade-off, broker ack after commit, dead-letter for poison. Out: “at-least-once is free”, “global ordering included”.',
  ],
  'evt-bgn-idempotency-02': [
    'The Redeliver button exists in the simulator. What makes its second press harmless?',
    'Stable identity + marker + commit-together; increments always need the guard.',
    'In: stable dedup key, same-effect-twice property, marker in same transaction, naturally idempotent operations, increment guard necessity, bounded marker window. Out: “broker guarantees it, skip dedup”, “at-least-once is safe anyway”.',
  ],
  'evt-bgn-order-03': [
    'Which arrival order breaks the pipeline, and which tolerance covers benign skew?',
    'Sequence per correlation, precondition guards, per-aggregate partitioning, honest pending states.',
    'In: sequence numbers, precondition reject/defer, per-aggregate partitioning, eventual-consistency tolerance, bounded reorder buffer, commutativity. Out: “global ordering required”, “retries preserve order so guards are redundant”.',
  ],
  'evt-bgn-dlq-04': [
    'Three corpses, three causes: garbage, exhausted transient, deleted referent. Different autopsies.',
    'Poison never retries; transients retry then wait for health; data problems reprocess after fix — and DLQ depth pages.',
    'In: poison quarantine, retry-then-replay-after-health, data/contract disposition, DLQ-as-alert, inspect before replay. Out: “replay all now”, “discard silently”, “auto-fix and replay unreviewed”.',
  ],
  'evt-int-retry-05': [
    'What does the gateway experience when every consumer retries instantly?',
    'Exponential backoff + jitter + attempt cap + error-class awareness + a global retry budget.',
    'In: exponential backoff with cap, jitter, attempt cap + dead-letter, retryable-class filtering, global budget, DLQ alerting. Out: “immediate retry”, “all failures identical”.',
  ],
  'evt-int-duplicate-06': [
    'Crash lands between apply and ack. The broker redelivers. What saves the invariant?',
    'Check-then-effect with the marker in the same transaction — and acknowledge duplicates anyway.',
    'In: pre-effect dedup check, ack duplicates, atomic marker+effect, duplicate-rate metric, stable identity across retries, webhook receiver dedup. Out: “duplicates impossible”, “switch to exactly-once instead”.',
  ],
  'evt-int-eventual-07': [
    'The screens disagree for five seconds. Is that a bug or a contract?',
    'Convergence window is a design input; read-your-writes routing, monotonic reads, honest pending UI, audits.',
    'In: bounded window as input, session/primary reads, monotonic reads, honest pending states, periodic audit, version stamps. Out: “strong transactions everywhere”, “eventually = milliseconds always”.',
  ],
  'evt-int-webhook-08': [
    'Attempt 1: timeout. Attempt 2: delivered. What does the receiver assume about attempt 1?',
    'Ambiguous timeout, retry-with-cap, receiver-side idempotency, 2xx-only-ack, optional HMAC, fast ack.',
    'In: timeout ambiguity, retry + dead-letter, receiver dedup by delivery id, 2xx semantics, signed payloads, acknowledge-fast. Out: “strict global order”, “keep retrying 4xx forever”.',
  ],
  'evt-adv-outbox-09': [
    'Two writes, one crash. Which one survives — and which one does anyone remember?',
    'Same-transaction outbox row; relay publishes at-least-once; consumers dedupe; retention bounds the table.',
    'In: dual-write loss, single-transaction outbox, relay with at-least-once + dedup, cleanup retention, per-aggregate ordering. Out: “2PC preferred”, “exactly-once mode makes outbox redundant”, “every event needs one”.',
  ],
  'evt-adv-outoforder-10': [
    'Payment arrived with no reservation behind it. What does clean mode do — and what should the guard check?',
    'Precondition on the order record, distinguishable dead-letter, audit cross-check, optional short buffer, seq compare.',
    'In: reservation precondition, out_of_order_payment disposition, consistency audit on paid∧¬reserved, defer-buffer alternative, seq-vs-applied guard, per-order partitioning. Out: “apply anyway, money is money”, “reorder topics”.',
  ],
  'evt-adv-poison-11': [
    'Sort the four failures: which two are doomed forever, which two are worth a wait?',
    'Parse and required-field failures are terminal; timeouts and 5xx retry with cap; taxonomy documented.',
    'In: unparseable→terminal, missing-field→terminal, timeout→retryable, 503→retryable+jitter+escalation, documented taxonomy. Out: “4xx retryable”, “everything retries”, “poison accumulates silently”.',
  ],
  'evt-adv-audit-12': [
    'Money first, fulfilment second, notification third — rank the three violations by blast radius.',
    'Unsecured stock must be fulfilled or refunded; overcapture is money-out; webhook-miss is a support call — fix, re-audit, and map each to a defect class.',
    'In: fulfil-or-refund for unreserved paid orders, refund delta + find double-apply, resend confirmation, money-first ordering, re-audit with before/after, defect-class mapping. Out: “informational only”, “no systemic recurrence prevention”.',
  ],
  // ---------------- Hunts ----------------
  'hunt-perf-001': [
    'Time the same endpoint over and over — is the delay shape uniform or load-dependent?',
    'Compare a bug-hunt session against a reset clean session; look at p50, not one run.',
    'The delay applies to every list call regardless of page or filter — measure, then report the uniform shape with numbers.',
  ],
  'hunt-perf-002': [
    'Sweep page=1..8 with identical perPage and record the latency per page.',
    'The boundary sits between two consecutive pages — find it exactly.',
    'Pages ≤ 3 healthy, page ≥ 4 pays the penalty — report the boundary and the delta.',
  ],
  'hunt-perf-003': [
    'Vary perPage and watch which metric moves: query count, latency, or both?',
    'A 1-item page and a 12-item page reveal the linear term if the assembly does per-row work.',
    'Assembly is sequential per item — report the per-item slope (~120 ms) and the total for 12 rows.',
  ],
  'hunt-sec-001': [
    'Compare GET /api/v1/auth/me in the hunt session and after a reset.',
    'Something in the response body is not in the documented profile shape.',
    'The over-share is an internalNotes object — name every member and why it must not serialize.',
  ],
  'hunt-sec-002': [
    'Fire ten wrong-password attempts rapidly from one browser session.',
    'Watch for the 6th response: does it differ from the first five?',
    'All ten return 401; the 429 wall never arrives — the failure budget is not enforced.',
  ],
  'hunt-sec-003': [
    'Trigger the checkout fulfilment failure path and read the whole error body.',
    'One member of that body is not for clients.',
    'The debug object carries synthetic query/sqlstate/connection detail — report each member and the fix (allowlist serializer).',
  ],
  'hunt-event-001': [
    'Capture a payment, then force the reservation event through the consumer again.',
    'Watch payments.captured_count and captured_cents_total — do they move on redelivery?',
    'The dedup marker is skipped in the payment handler — redelivery double-applies; show the counters and the consistency finding.',
  ],
  'hunt-event-002': [
    'Publish payment-always-fails and press Process a few times, watching “waiting” counts between presses.',
    'Do retries observe any spacing at all, or are they always due immediately?',
    'Backoff is collapsed to 0 ms — retries fire on the very next process call; compare with clean mode’s 1s/2s spacing.',
  ],
  'hunt-event-003': [
    'Publish a payment.processed directly into a fresh simulator — no order exists.',
    'Run Process, then run the consistency check.',
    'Clean mode dead-letters it (out_of_order_payment); the hunt session applies it — paid∧¬reserved — report the skipped guard.',
  ],
}

const HINT_LEVELS = new Set([1, 2, 3] as const)

/** Lab reveal lookup (final phase). */
export function labRevealDefinition(id: string): LabRevealDefinition | null {
  return LAB_REVEALS[id] ?? null
}

export function labHintText(id: string, level: number): string | null {
  if (!HINT_LEVELS.has(level as 1 | 2 | 3)) {
    return null
  }
  const hints = LAB_HINTS[id]
  return hints ? hints[level - 1] : null
}

function reveal(expected: string, actual: string, rootCause: string, solution: string, explanation: string): LabRevealDefinition {
  return {
    expected,
    actual,
    rootCause,
    reproduction: [
      'Select an answer and submit it to see the deterministic checks.',
      'Compare your selections against the expected set one option at a time.',
      'Resubmit with the corrected selection set to pass.',
    ],
    verification: [
      'Re-run the evaluation; the score must rise to ≥ 70.',
      'All checks report passed with no unexpected extras selected.',
    ],
    concepts: ['Lab scoring rubric (recall 70 / precision 30)', 'Evidence-driven QA reasoning', 'Deterministic server-side evaluation'],
    commonMisconceptions: [
      'Selecting every plausible option boosts recall but tanks precision.',
      'The keyword in an option matters less than the claim it makes.',
    ],
    solution,
    explanation,
  }
}

export const LAB_REVEALS: Record<string, LabRevealDefinition> = {
  'perf-bgn-baseline-01': reveal(
    'A fixed, comparable, low-concurrency measurement of the unchanged endpoint — recorded p50/p95/error rate before any change.',
    'A stress/spike run or an unbounded measurement is proposed first; or the average is claimed sufficient.',
    'Testing order was inverted: measurement must precede optimisation.',
    'Baseline first: pin endpoint, data, environment, concurrency and duration; record the numbers; only then profile.',
    'Baseline → load → stress/spike. Cold-start measurement is part of a first baseline; external targets never are.',
  ),
  'perf-bgn-metric-02': reveal(
    'Median = typical; p95 = 95% at-or-below; p99 = the heavy tail; average pulled by tail; small samples void percentiles.',
    'The average is quoted as “the” latency; p99 is claimed for n=8; 0.4% errors are waved away.',
    'Average-of-tail misread: the metric chosen describes the middle, not the risk.',
    'Report median + p95 + p99 together; gate release on p95/p99 and the error budget, never the mean alone.',
    'Percentiles are order statistics: p90/p95/p99 are only meaningful with enough n (≥ 20) to occupy the tail.',
  ),
  'perf-bgn-workload-03': reveal(
    'Bounded run: ≤ 8 VUs, ≤ 30 s, ramp ≤ 10 s, explicit rps guard, per-request timeout, constant endpoint.',
    'Limits removed for “realism”, or an external/public target is proposed.',
    'Unbounded load is not realism; it is an incident against a shared environment.',
    'Cap VUs and duration, ramp gradually, set the rps guard and the timeout, keep the endpoint constant.',
    'Caps protect the shared practice environment while still producing comparable measurements.',
  ),
  'perf-bgn-result-04': reveal(
    'Throughput = completed req/s; latency = per-request duration; the knee separates them.',
    'The two are treated as one metric; the saturation knee is invisible.',
    'Rate-versus-duration confusion: the units are different and the failure modes differ.',
    'Quote req/s and per-request latency side by side; watch error rate with both at every step.',
    'Concurrency can hold throughput at cap while latency climbs — only the pair reveals saturation.',
  ),
  'perf-int-bottleneck-05': reveal(
    'Layer shares add to the whole: the app handler owns ~880/950 ms; the DB and network are cleared by evidence.',
    'The database is blamed by instinct; an index is prescribed unread.',
    'Blame-by-default instead of attribution-by-measurement.',
    'Fix the handler; re-run the identical workload; confirm p95 moved; only then consider the DB.',
    'Percentile attribution per layer; verify with the repeated measurement, not with victory.',
  ),
  'perf-int-pagination-06': reveal(
    'Offset cost is O(offset): deep pages discard N rows; keyset is O(page).',
    'The query text is asserted to cost the same on every page.',
    'Offset blindness: identical SQL text, different work.',
    'Adopt keyset pagination (WHERE id > :last), keep the index, bound perPage, rethink COUNT(*).',
    'Both the data access and the total are scans; both must be bounded or replaced.',
  ),
  'perf-int-cache-07': reveal(
    '96% reads + rare writes ⇒ strong candidate: quantify hit rate, staleness budget and invalidation, exclude personalised entries.',
    '“Add cache” is proposed without hit-rate, staleness or invalidation analysis.',
    'Caching as talisman: applied for latency, not for hit rate and correctness.',
    'Design the TTL + invalidation; measure hit rate; keep cold-miss budget; never cache personalised responses.',
    'Caching moves the cost curve; it does not fix the query plan.',
  ),
  'perf-int-error-08': reveal(
    '2.1% error budget, concentrated on one endpoint, classified 5xx/4xx, with timeouts counted separately and a pre-agreed threshold.',
    '“98% success, ship it” — aggregate masking an endpoint-shaped failure.',
    'Aggregation masking: the denominator forgives the numerator problem.',
    'Localise, classify, threshold, and check retry amplification; re-test after the fix.',
    'Error budgets are only meaningful per endpoint, per class, against a pre-agreed budget.',
  ),
  'perf-adv-nplus-09': reveal(
    'Trace shows 1 + 12 identical queries; ≈180 ms serial; batching collapses to one query for any page size.',
    'A cache is added or the page is left at perPage=4 “temporarily”.',
    'Single-row lookups dressed as iteration.',
    'Batch with WHERE id IN (…); set a query-count budget per render; re-measure the slope.',
    'N+1 is a shape; only the shape change removes it.',
  ),
  'perf-adv-capacity-10': reveal(
    'The knee: 4→6 VUs flattening at ~340–390 req/s with p95 120→900 ms; safe load ≤ knee + explicit headroom; conditions stated.',
    'Linear extrapolation or a single peak run is quoted as launch capacity.',
    'Knee blindness: more VUs ≠ more throughput past saturation.',
    'State the safe envelope (340 req/s + margin), the p95/error evidence, and the exact conditions.',
    'Capacity is a statement about conditions — never a bare number.',
  ),
  'perf-adv-spike-11': reveal(
    'Jump profile with recovery measurement, named failure mode, lab-only target, capped intensity, baseline pair.',
    'A polite ramp is proposed, or unbounded holding “to find the real limit”.',
    'Spike theatre: nothing jumps, so nothing is revealed.',
    'Jump, hold briefly, drop, watch recovery; hunt timeouts / 5xx / saturation explicitly.',
    'The spike teaches the failure mode and the MTTR, not merely the max.',
  ),
  'perf-adv-soak-12': reveal(
    'Windowed p95 climb with flat errors = cumulative signature; confirm by repetition; bound the claim to 30 s.',
    'One end-to-end figure is quoted; or an unbounded extension is proposed.',
    'Slope blindness: jitter and leaks look identical in a single window.',
    'Compare windows; reproduce the slope; name candidates; bound the claim; follow with a proper soak.',
    'Leaks are evidenced by the slope, not by the crash you are not allowed to induce.',
  ),
  'sec-bgn-authn-01': reveal(
    'Layered anti-stuffing: per-IP/account rate limit + step-up + soft lockout + breach corpora + generic failure + correlation logging.',
    'A faster hash is proposed as the fix for stuffing; or a security question.',
    'Stuffing is not hashing; it is volume against reused credentials.',
    'Layer the controls; measure the 429s; verify success-path counters reset.',
    'Rate limits absorb volume, corpora kill reuse, generic failures kill oracles.',
  ),
  'sec-bgn-input-02': reveal(
    'Two-channel separation: values bound, never interpolated; escaping is dialect encoding, not separation.',
    '“Escaped the quotes, we’re safe” — until charset or dialect surprises.',
    'Confusing encoding with separation.',
    'Parameterize every value position (bind lists included); pair with least-privilege roles.',
    'Injection dies when data can never be re-read as syntax.',
  ),
  'sec-bgn-headers-03': reveal(
    'nosniff, HSTS, framing refusal, referrer bound, CORP, Cache-Control on auth responses.',
    'X-XSS-Protection is enabled as a primary; Server-header removal is declared “done”.',
    'Header checkbox-ticking without the risk mapping.',
    'Set the load-bearing six; document the residual risk of the cosmetic ones.',
    'Each header cheapens a specific browser attack; none replace the others.',
  ),
  'sec-bgn-data-04': reveal(
    'Secrets never render: hashes, tokens, bulk PII, internals, debug flags, other users’ proofs.',
    '“It’s only in the logs” or “only behind auth” — both are exposures.',
    'Exposure-classification gap: surface × secret.',
    'Allowlist serializers; log scrubbers; URL token ban; debug flags off in prod.',
    'If it renders anywhere untrusted-adjacent, it is exposed.',
  ),
  'sec-int-bola-05': reveal(
    'Two synthetic accounts, same order reference: server answers non-enumerable (404 or equivalent); attempts hit rate limits.',
    'The order is returned to the second account, or enumeration is unthrottled.',
    'Authentication treated as authorization.',
    'Build the two-account matrix; request each object as each actor at each verb; assert uniform denial.',
    'BOLA is closed server-side or not at all.',
  ),
  'sec-int-session-06': reveal(
    'Mint → use → revoke: logout revokes server-side; TTL bounds replay; only hashes stored; roles re-read live.',
    'Cookie deletion is claimed as logout; TTL is tuned and revocation never built.',
    'Client-side trust: the browser is not a revocation mechanism.',
    'Server deny-list on logout; live role check at call time; rotation on privilege change.',
    'A live token at call time is the unit of trust.',
  ),
  'sec-int-escalation-07': reveal(
    'Server-side 403 at the boundary; role from stored row; mass-assignment stripped; default-deny.',
    'The sidebar hides the link; the API is wide open to direct calls.',
    'UI-as-perimeter thinking.',
    'Direct-call each privileged route as customer and staff; assert 403/404; strip unknown body fields.',
    'Obscurity layers; authorization enforces.',
  ),
  'sec-int-api-08': reveal(
    'BOLA→object authorization; throttle→unrestricted consumption; verbose→misconfig/inventory; /me overshare→object property authorization; shadow endpoints→inventory; body-assign→mass assignment.',
    'Findings are filed without families, or patterns are misfiled (BOLA as SSRF).',
    'Taxonomy gap: findings cannot be triaged by blast radius without the mapping.',
    'Map each finding to its family; prioritise by reachable data and actor model.',
    'OWASP API is a triage tool: family → control → verification.',
  ),
  'sec-adv-authz-09': reveal(
    'Actor × resource × verb matrix, object-level cells, paired negatives, fail-closed unmapped cells.',
    'A roles×resources sketch with allow cells only and no negatives.',
    'Happy-path authorization: the matrix is approved by the allow list.',
    'Enumerate actors including edge accounts; assert denial everywhere else; keep it fail-closed.',
    'If a cell isn’t tested, the cell doesn’t exist.',
  ),
  'sec-adv-chain-10': reveal(
    'Verbose error + overshared field + predictable reference → enumeration path; report as one narrative; break the cheapest link.',
    'Three separate informational tickets are filed; the path is walked outside the lab.',
    'Finding-silo thinking: CVSS of parts misses the sum.',
    'Ordered repro, combined impact, weakest-link remediation, re-test the chain end-to-end.',
    'Chains are the actual adversary; individual severities are their ingredients.',
  ),
  'sec-adv-sql-11': reveal(
    'Parameterize everywhere (including second-order), least-privilege roles, generic edge errors, log-based detection.',
    'A quote-escaping fix is proposed; blacklists; WAF-only.',
    'Single-layer thinking: each defence assumed sufficient alone.',
    'Layer parameterization + role + error hygiene + detection; verify the fix with the same request that failed.',
    'Injection survives wherever encoding is mistaken for separation.',
  ),
  'sec-adv-xss-12': reveal(
    'Output encoding per context (primary), CSP default-src self (layer), HttpOnly (mitigation), HttpOnly cookies unreadable even on execution.',
    'An input filter “sanitizes” the payload; or X-XSS-Protection is shipped alone.',
    'Filter-over-encode: inspecting input instead of neutralizing output.',
    'Encode at render; set CSP; set HttpOnly; re-run the inert demo expectation unchanged.',
    'The browser executes what you render — so render data, never code.',
  ),
  'evt-bgn-guarantee-01': reveal(
    'At-most-once (loss), at-least-once (duplicates), exactly-once = at-least-once + dedup; ack after commit; DLQ for poison.',
    '“Exactly-once delivery” is marketed as a broker flag merchants can just switch on.',
    'Wire-vs-consumer confusion: delivery is a transport property; processing is a design.',
    'Choose at-least-once + idempotent consumers; ack post-commit; route poison to DLQ.',
    'Exactly-once is an emergent property of the pair, never a flag.',
  ),
  'evt-bgn-idempotency-02': reveal(
    'Stable dedup key; effect∧marker commit together; increments guarded; redeliver = no-op.',
    'The counter doubles on the second delivery; nobody notices until the audit.',
    'Counter-as-proof: the number is trusted before it is explained.',
    'Insert dedup row in the effect transaction; return duplicate:true on hit; re-run the redeliver test.',
    'Side effects must commute with themselves.',
  ),
  'evt-bgn-order-03': reveal(
    'Sequence per correlation; precondition guards (reserve before pay); partition by aggregate; honest pending states; bounded buffers.',
    'Global ordering is demanded; or guards are omitted as “retries fix it”.',
    'Ordering confusion: per-aggregate vs global scope.',
    'Add seq + precondition rejection; partition per order; tolerate the window; audit drift.',
    'Only the stream sharing state must be ordered; the rest must tolerate skew.',
  ),
  'evt-bgn-dlq-04': reveal(
    'Poison → quarantine; transient → backoff then replay post-health; data → fix data, then reprocess; DLQ depth pages.',
    'Replay-all is pressed; or messages are silently discarded.',
    'Autopsy skipped: the body is not examined before burial.',
    'Classify per message with the error taxonomy; replay condition recorded; alert on DLQ growth.',
    'A DLQ you do not read is a second production outage, scheduled.',
  ),
  'evt-int-retry-05': reveal(
    'Base 1s → ×2 → cap 8s; jitter; ≤ 3 attempts; retryable-class filter; global retry budget; DLQ replayable.',
    'Immediate retries; infinite attempts; all errors retried.',
    'Retry-as-echo: the dependency hears every consumer, forever.',
    'Parameterize base/cap/attempts/jitter; exclude declines/validation; budget globally.',
    'Retries are load; budget them like a client.',
  ),
  'evt-int-duplicate-06': reveal(
    'Pre-effect dedup check; duplicate acked anyway; marker∧effect atomic; duplicates metered; stable ids; receivers dedupe by delivery id.',
    'The redelivery double-applies; the marker is written post-effect (crash splits them).',
    'Ack-before-applied or effect-before-marker: the crash window stays open.',
    'Marker in effect transaction; ack duplicates; emit the duplicates metric; watch the rate.',
    'At-least-once is survivable only if apply∧marker share one fate.',
  ),
  'evt-int-eventual-07': reveal(
    'Bounded window as input; session-consistent reads for the buyer; honest pending UI; version-stamped reads; scheduled audit.',
    'Distributed transactions across services are mandated “for correctness”.',
    'Strong-everywhere reflex: paying coordination tax on every read.',
    'Route the buyer to their session view; render pending states; audit for drift; converge.',
    'Eventual consistency is a budget you spend where users cannot feel it.',
  ),
  'evt-int-webhook-08': reveal(
    'Ambiguous timeout; retry to cap; receiver dedupes by delivery id; 2xx = ack; HMAC-signed; acknowledge fast, process async.',
    'Retry-until-200 regardless of class; receiver processes synchronously for 30 s; duplicates replay effects.',
    'Receiver-trusts-sender-trusts-receiver: nobody closes the ack.',
    'Implement fast-ack + async work; receiver dedup; signature verify; replay path documented.',
    'Timeouts are ambiguous by definition — the receiver contract must absorb that.',
  ),
  'evt-adv-outbox-09': reveal(
    'Order row and outbox row commit in one transaction; relay publishes at-least-once; consumers dedupe; rows retained briefly.',
    'Publish happens after the commit with no shared fate; crash loses the event.',
    'Dual-write fallacy: two systems updated, zero transactions shared.',
    'Write to the outbox in the business transaction; relay; monitor unpublished age; alert.',
    'Atomicity cannot escape the database you already have — so put the event inside it.',
  ),
  'evt-adv-outoforder-10': reveal(
    'Precondition (reservation exists ∧ not-applied seq) gates payment application; failure → dead_letter out_of_order_payment; audit asserts paid∧¬reserved absent.',
    'The unprepared payment applies; the order flips to paid; the auditor finds it first.',
    'Precondition amnesia: the message is trusted because it arrived.',
    'Add the guard + distinguishable rejection + the audit cross-check; re-run the failing case.',
    'Messages carry claims; state carries truth. Verify before you apply.',
  ),
  'evt-adv-poison-11': reveal(
    'Terminal: parse, missing required fields (contract). Retryable: timeouts, 5xx (with cap+jitter). 4xx terminal. Taxonomy documented.',
    'All four are retried; or all four dead-letter; either violates the taxonomy.',
    'Retry-all / deadletter-all nihilism: no error model at all.',
    'Classify at the throw site; emit the class with the error; route by class.',
    'Only errors with plausible transience deserve attempts.',
  ),
  'evt-adv-audit-12': reveal(
    'Money first (overcapture refund + double-apply fix), then fulfilment (unreserved-paid orders), then webhooks; re-audit; map to the consumer-guard defect class.',
    'The three are batched into one “consistency ticket” with no ordering or owner.',
    'Blast-radius blindness: severity of parts misranked.',
    'Refund delta; secure/cancel unreserved paid orders; resend confirmations; re-audit clean; file with defect class.',
    'Audit output is remediation input — it dies if unranked.',
  ),
  'hunt-perf-001': reveal(
    'Every list call pays the same ~350 ms regardless of inputs — a uniform flat stall.',
    'Latency varies by payload or “warm-up” explains it.',
    'Misattribution to variance/cold-start.',
    'A/B hunt vs reset session with identical requests; report p50/p95 delta.',
    'Uniformity across inputs is the signature of a pre-query stall.',
  ),
  'hunt-perf-002': reveal(
    'Latency steps at the page 3→4 boundary (+~600 ms) and holds for deeper pages.',
    'Deep pages are “just slower because offsets” with no boundary measured.',
    'Hand-waving depth cost without a measured boundary.',
    'Page sweep 1..8 with perPage fixed; tabulate; report boundary and delta.',
    'The boundary is the defect; everything else is noise around it.',
  ),
  'hunt-perf-003': reveal(
    'Latency scales linearly with perPage (~120 ms per row): per-row sequential work in assembly.',
    'The count query is blamed; or “SQLite is slow”.',
    'Slope blindness: 1/6/12-item rows are a pattern probe.',
    'perPage sweep; fit the linear term; report per-row cost; recommend batching.',
    'Slope > step: N+1 shows up in the coefficient, never in the constant.',
  ),
  'hunt-sec-001': reveal(
    'internalNotes { riskScore, segment, analystNote } serializes in the profile response for hunt sessions only.',
    'The response is “normal” — nothing is out of place on first glance.',
    'Over-share blindness: extra members in a familiar shape.',
    'Diff hunt vs reset payload key-by-key; report each extra member and the serializer fix.',
    'Allowlist projection is the only trustworthy serializer.',
  ),
  'hunt-sec-002': reveal(
    '401 for every wrong password, forever; no 429 at the budget line; success resets nothing observable.',
    'The 6th attempt is expected to 429 and does not — the peek is bypassed.',
    'Budget-bypass belief: the counter “must” fire.',
    'Fire 10 wrong passwords; observe zero 429s; reset; confirm clean mode refuses at 6.',
    'The cap is the only thing between guessing and infinity.',
  ),
  'hunt-sec-003': reveal(
    '422 body carries debug { query, sqlstate, connection, stack } alongside lines[].',
    'The 422 “just has a couple of error fields”.',
    'Debug-blindness: extra members in a 4xx envelope.',
    'Trigger the fulfilment failure in a hunt session; diff vs reset body; report members + fix.',
    'Every byte on the wire is a contract — error bodies included.',
  ),
  'hunt-event-001': reveal(
    'Redelivery re-applies payment: captured_count +1, cents +total, paid stays paid but overcaptured.',
    'The redelivered message “processes fine” — counters say otherwise.',
    'Dedup-marker trust: the marker exists but is never consulted.',
    'Capture payment; force redelivery; read counters; run consistency; reset and repeat clean.',
    'Idempotency is proven by the second delivery, not asserted by the first.',
  ),
  'hunt-event-002': reveal(
    'Failed payment retries are always due immediately: zero backoff, zero spacing between process calls.',
    'Exponential backoff is “sort of configured” (it is, in clean mode).',
    'Spacing blindness: the gap between attempts is the metric, not the attempts.',
    'payment-always-fails; process ×3; record waiting counts between calls; contrast clean 1s/2s.',
    'Backoff is the difference between recovery and a storm.',
  ),
  'hunt-event-003': reveal(
    'Payment applied with no reservation: paid∧¬reserved; consistency reports payment_without_reservation.',
    'The simulator “handled” the message — paid state without precondition.',
    'Precondition blindness: state asserts nothing before accepting claims.',
    'Publish bare payment; process; audit; contrast with clean-mode dead-letter.',
    'Unprepared messages must die in the DLQ, never in the ledger.',
  ),
}
