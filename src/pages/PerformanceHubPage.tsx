import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PERFORMANCE_EXERCISES } from '../data/performanceExercises'
import { LabHub } from '../features/labs/LabHub'

export function PerformanceHubPage() {
  useDocumentTitle('Performance Testing')
  return (
    <LabHub
      trackLabel="Performance testing"
      title="Performance Testing"
      description="Measure before you optimise — run bounded, same-origin load tests against the practice API, read percentiles honestly, and learn the baseline → load → stress → spike ladder with scored exercises and three seeded performance hunts."
      primaryAction={{ to: '/performance/workspace', label: 'Open the load runner' }}
      trackLink="/tracks/performance-testing"
      guideLink={{ to: '/guides/guide-performance-testing', label: 'Read the performance testing guide' }}
      capabilitiesTitle="What you can practise"
      capabilities={[
        {
          to: '/performance/workspace',
          title: 'A · Load runner',
          copy: 'Configurable VUs, ramp-up, duration and rate guard against a first-party endpoint allowlist — measured in your browser, never fabricated, never unbounded. p50/p90/p95/p99 honestly gated by sample size.',
        },
        {
          to: '/performance/exercises/perf-bgn-baseline-01',
          title: 'B · Scored exercises',
          copy: 'Twelve exercises: baseline, load, stress and spike design, percentile interpretation, bottleneck triage, cache reasoning, N+1 detection and capacity statements — all scored server-side.',
        },
        {
          to: '/scenarios',
          title: 'C · Three performance hunts',
          copy: 'A uniformly slow catalogue, deep-pagination degradation past page 3, and an N+1 list assembly — each reproducible with the runner, each isolated to your bug-hunt session.',
        },
      ]}
      introPanel={
        <>
          <p className="workspace-line">
            The workspace runs <strong>real requests</strong> from your browser to this site’s own API —
            nothing synthetic is dressed up as a measurement, and nothing outside the allowlist can be targeted.
          </p>
          <p className="workspace-line database-dataset-note">
            Terminology you will use constantly: <strong>baseline</strong> (unchanged-endpoint reference), <strong>load</strong> (expected
            traffic), <strong>stress</strong> (beyond expected, to find the knee), <strong>spike</strong> (abrupt jump), <strong>throughput</strong> (req/s),
            <strong> latency</strong> (per-request duration), <strong>error budget</strong> (tolerated failure share),
            <strong> saturation knee</strong> (where throughput flattens and latency keeps climbing).
          </p>
        </>
      }
      facts={[
        { key: 'Exercises', value: String(PERFORMANCE_EXERCISES.length) },
        { key: 'Bug hunts', value: '3' },
        { key: 'Runner caps', value: '8 VU · 30 s' },
        { key: 'Report', value: 'Markdown' },
      ]}
      howSteps={[
        { title: 'Pick the endpoint', detail: 'Only first-party GET endpoints are offered — the runner cannot be pointed elsewhere.' },
        { title: 'Choose the profile', detail: 'Baseline (1 VU), load (2–4 VU), stress (6–8 VU), spike (ramp to max fast), soak-lite (30 s window). Start low; earn the histogram.' },
        { title: 'Measure and read', detail: 'Read median and p95 together, plus throughput and the status-class split. p90+ needs at least 20 samples.' },
        { title: 'Report', detail: 'Download the Markdown report — measured values only, with the scope caveats printed on it.' },
      ]}
      exercises={PERFORMANCE_EXERCISES}
      facets={[
        { id: 'all', label: 'All' },
        { id: 'fundamentals', label: 'Fundamentals' },
        { id: 'workload', label: 'Workload' },
        { id: 'analysis', label: 'Analysis' },
        { id: 'capacity', label: 'Capacity' },
      ]}
      exerciseBasePath="/performance/exercises"
      huntScenarioPrefix="hunt-perf-"
    />
  )
}
