import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadRunner } from '../features/performance/LoadRunner'

export function PerformanceWorkspacePage() {
  useDocumentTitle('Performance workspace')
  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Performance Testing', to: '/performance' }, { label: 'Load runner' }]} />
      <PageHeader
        eyebrow="Practice · load runner"
        title="Bounded load runner"
        description="Send real requests from this browser to this site’s own API and read the latency honestly. VUs, duration, ramp-up and rate are hard-capped; every value on the report is measured, and the report prints its own limitations. Same-origin only — the runner cannot be pointed at anything else."
      />
      <LoadRunner />
    </div>
  )
}
