// Lab exercise answer keys (final phase) — SERVER-ONLY. Compiled into the
// Worker; never shipped to the browser. Client-safe catalogues live in
// src/data/{performance,security,event}Exercises.ts; the id matrix is
// enforced by tests/data/lab-exercises.test.ts.

import { PERFORMANCE_EXERCISES } from '../data/performanceExercises'
import { SECURITY_EXERCISES } from '../data/securityExercises'
import { EVENT_EXERCISES } from '../data/eventExercises'

export interface LabExerciseRuntime {
  id: string
  title: string
  /** Which client-safe checklist ids are graded as correct. */
  expected: readonly string[]
}

const EXPECTED: Record<string, readonly string[]> = {
  // Performance
  'perf-bgn-baseline-01': ['first-baseline', 'first-load', 'first-compare', 'first-cold'],
  'perf-bgn-metric-02': ['metric-avg-hides', 'metric-p95-line', 'metric-p99-tail', 'metric-median-typical'],
  'perf-bgn-workload-03': ['wl-ramp-gradual', 'wl-cap-vus', 'wl-duration-short', 'wl-max-rps', 'wl-timeout', 'wl-fixed-seed'],
  'perf-bgn-result-04': ['tl-throughput-rate', 'tl-latency-duration', 'tl-knee', 'tl-errors-carry', 'tl-concurrent'],
  'perf-int-bottleneck-05': ['bn-app-bound', 'bn-db-innocent', 'bn-network-innocent', 'bn-measured-not-guessed', 'bn-percentile', 'bn-verify'],
  'perf-int-pagination-06': ['pg-offset-scans', 'pg-flat-example', 'pg-keyset', 'pg-index-helps', 'pg-count-extra', 'pg-bound'],
  'perf-int-cache-07': ['cache-amortises', 'cache-stale-stock', 'cache-hit-rate', 'cache-invalidate', 'cache-privacy', 'cache-tail'],
  'perf-int-error-08': ['err-concentrated', 'err-status-class', 'err-threshold', 'err-fast-fail', 'err-retry-policy', 'err-timeouts'],
  'perf-adv-nplus-09': ['nplus-shape', 'nplus-math', 'nplus-join-batch', 'nplus-scale', 'nplus-count'],
  'perf-adv-capacity-10': ['cap-knee', 'cap-safe-load', 'cap-latency-signal', 'cap-error-signal', 'cap-headroom', 'cap-conditions'],
  'perf-adv-spike-11': ['spike-shape', 'spike-recovery', 'spike-failure-mode', 'spike-same-env', 'spike-cap', 'spike-compare'],
  'perf-adv-soak-12': ['soak-slope', 'soak-candidate', 'soak-flat-errors', 'soak-windowed', 'soak-confirm', 'soak-bound'],
  // Security
  'sec-bgn-authn-01': ['cf-rate-limit', 'cf-captcha', 'cf-lockout', 'cf-leaked-corpus', 'cf-hide-detail', 'cf-logging'],
  'sec-bgn-input-02': ['param-separation', 'param-types', 'param-escaping', 'param-in-list', 'param-least-priv'],
  'sec-bgn-headers-03': ['hdr-nosniff', 'hdr-hsts', 'hdr-frame', 'hdr-referrer', 'hdr-corp', 'hdr-cache'],
  'sec-bgn-data-04': ['exp-hash', 'exp-token', 'exp-pii-bulk', 'exp-internal', 'exp-debug-flag', 'exp-membership'],
  'sec-int-bola-05': ['bola-two-accounts', 'bola-same-shape', 'bola-idor', 'bola-authn-vs-authz', 'bola-rate', 'bola-404-uniform'],
  'sec-int-session-06': ['tok-lif-revoke', 'tok-lif-ttl', 'tok-lif-hash', 'tok-lif-scope', 'tok-lif-rotation', 'tok-lif-audience'],
  'sec-int-escalation-07': ['esc-server-check', 'esc-direct', 'esc-role-from-db', 'esc-mass-assign', 'esc-audit', 'esc-default-deny', 'esc-error-oracle'],
  'sec-int-api-08': ['owasp-bola', 'owasp-rate', 'owasp-verbose', 'owasp-overshare', 'owasp-inventory', 'owasp-mass'],
  'sec-adv-authz-09': ['az-matrix', 'az-object-level', 'az-verb-level', 'az-negative', 'az-fail-closed', 'az-server-side'],
  'sec-adv-chain-10': ['chain-compound', 'chain-order', 'chain-repeat', 'chain-report', 'chain-fix-weakest', 'chain-data-class'],
  'sec-adv-sql-11': ['sqli-param', 'sqli-least-priv', 'sqli-error-hygiene', 'sqli-detect', 'sqli-second-order'],
  'sec-adv-xss-12': ['xss-encode', 'xss-context', 'xss-csp', 'xss-storage', 'xss-framework', 'xss-cookie'],
  // Microservices / event-driven
  'evt-bgn-guarantee-01': ['dg-atmost', 'dg-atleast', 'dg-exactly', 'dg-tradeoff', 'dg-steel', 'dg-poison'],
  'evt-bgn-idempotency-02': ['idem-key', 'idem-effect', 'idem-record', 'idem-natural', 'idem-increments', 'idem-window'],
  'evt-bgn-order-03': ['ord-seq', 'ord-guard', 'ord-partition', 'ord-delay', 'ord-buffer', 'ord-commutative'],
  'evt-bgn-dlq-04': ['dlq-poison', 'dlq-transient', 'dlq-data', 'dlq-alert', 'dlq-inspect'],
  'evt-int-retry-05': ['retry-exp', 'retry-jitter', 'retry-cap', 'retry-classify', 'retry-budget', 'retry-dlq-monitor'],
  'evt-int-duplicate-06': ['dup-check-first', 'dup-ack-anyway', 'dup-same-txn', 'dup-measure', 'dup-id-stable', 'dup-webhook'],
  'evt-int-eventual-07': ['ec-window', 'ec-read-concern', 'ec-monotonic', 'ec-ui-honest', 'ec-reconcile', 'ec-version'],
  'evt-int-webhook-08': ['wh-timeout-ambiguous', 'wh-retry', 'wh-duplicate', 'wh-2xx', 'wh-sign', 'wh-ack-fast'],
  'evt-adv-outbox-09': ['ob-dual-write', 'ob-same-txn', 'ob-relay', 'ob-cleanup', 'ob-order'],
  'evt-adv-outoforder-10': ['ooo-precondition', 'ooo-deadletter', 'ooo-audit', 'ooo-buffer', 'ooo-seq-check', 'ooo-same-partition'],
  'evt-adv-poison-11': ['poison-parse', 'poison-required', 'poison-timeout', 'poison-503', 'poison-taxonomy'],
  'evt-adv-audit-12': ['audit-1-sev', 'audit-2-sev', 'audit-3-sev', 'audit-order', 'audit-rerun', 'audit-rootcause'],
}

const ALL_EXERCISES = [...PERFORMANCE_EXERCISES, ...SECURITY_EXERCISES, ...EVENT_EXERCISES]
const BY_ID = new Map(ALL_EXERCISES.map((exercise) => [exercise.id, exercise]))

/** Resolve a runtime exercise definition (with answer key), or null. */
export function findLabExercise(id: string): LabExerciseRuntime | null {
  const exercise = BY_ID.get(id)
  const expected = EXPECTED[id]
  if (!exercise || !expected) {
    return null
  }
  return { id: exercise.id, title: exercise.title, expected }
}

/** Checklist id universe per exercise — used to reject out-of-set answers. */
export function labChecklistIds(id: string): readonly string[] | null {
  const exercise = BY_ID.get(id)
  return exercise ? exercise.checklist.map((item) => item.id) : null
}
