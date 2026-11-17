import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { SimulatorConsole } from '../features/microservices/SimulatorConsole'

export function MicroservicesSimulatorPage() {
  useDocumentTitle('Event simulator')
  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Microservices & Event-Driven Testing', to: '/microservices' }, { label: 'Simulator' }]} />
      <PageHeader
        eyebrow="Practice · simulator"
        title="Event-driven order pipeline simulator"
        description="A deterministic, session-scoped simulation of the order pipeline — inventory reservation, payment capture, notification and webhook delivery — with retries, duplicates, dead letters, replay and a consistency audit. This is a teaching harness on this site’s database, not a production message broker: every outcome is scripted, nothing touches a network."
      />
      <SimulatorConsole />
    </div>
  )
}
