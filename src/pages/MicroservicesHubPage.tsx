import { useDocumentTitle } from '../lib/useDocumentTitle'
import { EVENT_EXERCISES } from '../data/eventExercises'
import { LabHub } from '../features/labs/LabHub'

export function MicroservicesHubPage() {
  useDocumentTitle('Microservices & Event-Driven Testing')
  return (
    <LabHub
      trackLabel="Microservices & events"
      title="Microservices & Event-Driven Testing"
      description="Practise the failure modes of distributed systems in a deterministic, session-scoped simulation — publish events, process them, watch retries, duplicate delivery, dead letters, replay and eventual consistency, then hunt the seeded defects."
      primaryAction={{ to: '/microservices/simulator', label: 'Open the event simulator' }}
      trackLink="/tracks/async-testing"
      guideLink={{ to: '/guides/guide-event-driven-testing', label: 'Read the event-driven testing guide' }}
      capabilitiesTitle="What you can practise"
      capabilities={[
        {
          to: '/microservices/simulator',
          title: 'A · Event simulator',
          copy: 'Publish synthesized events into a three-service order pipeline (inventory → payment → notification/webhook). Process them, retry them, redeliver them, replay the dead letters, and read the correlated trace.',
        },
        {
          to: '/microservices/exercises/evt-bgn-guarantee-01',
          title: 'B · Scored exercises',
          copy: 'Twelve exercises across beginner, intermediate and advanced — delivery guarantees, idempotency, ordering, backoff, DLQ triage, outbox, poison messages and consistency audits, scored server-side.',
        },
        {
          to: '/scenarios',
          title: 'C · Three event bug hunts',
          copy: 'A non-idempotent payment consumer, a zero backoff collapse, and an unprepared-payment guard that skips out — each reproducible in the simulator, each isolated to your session.',
        },
      ]}
      introPanel={
        <>
          <p className="workspace-line">
            The lab simulates four fictional services — <strong>API Gateway</strong>, <strong>Order / Inventory</strong>,
            <strong> Payment</strong> and <strong>Notification</strong> (webhook) — on this site’s own database. It is a
            deterministic teaching harness, not a production broker: no network calls are made, every outcome is scripted.
          </p>
          <p className="workspace-line database-dataset-note">
            The pipeline: <code>order.created</code> → <code>inventory.reserved</code> → <code>payment.processed</code> →
            webhook delivery. Retry uses exponential backoff (1s → 2s → 4s → 8s). Duplicate delivery is safe by
            idempotent consumers in clean mode. Drills inject deterministic failures; bug hunts inject the seeded defects.
            Everything is yours alone — reset at any time.
          </p>
        </>
      }
      facts={[
        { key: 'Event types', value: '4' },
        { key: 'Exercises', value: String(EVENT_EXERCISES.length) },
        { key: 'Bug hunts', value: '3' },
        { key: 'Correlation ids', value: 'per order' },
      ]}
      howSteps={[
        { title: 'Publish', detail: 'Open the simulator and publish an order.created (try the inventory-delay drill for eventual consistency).' },
        { title: 'Process', detail: 'Press “Process due events” and watch the pipeline advance one step per run — backoff holds the retryable ones.' },
        { title: 'Break it on purpose', detail: 'Switch the drill to payment-transient, payment-always-fails, webhook-timeout or poison and observe retries, dead letters and duplicates.' },
        { title: 'Audit and reset', detail: 'Run the consistency check, open a correlation trace, then reset — the simulator returns to an empty, deterministic state.' },
      ]}
      exercises={EVENT_EXERCISES}
      facets={[
        { id: 'all', label: 'All' },
        { id: 'delivery', label: 'Delivery' },
        { id: 'consistency', label: 'Consistency' },
        { id: 'operations', label: 'Operations' },
      ]}
      exerciseBasePath="/microservices/exercises"
      huntScenarioPrefix="hunt-event-"
    />
  )
}
