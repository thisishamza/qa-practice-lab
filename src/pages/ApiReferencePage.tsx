import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadingState, ErrorState } from '../components/ui/States'
import { ApiReferenceView } from '../features/api-reference/ApiReferenceView'
import { loadContract, type OpenApiDocument } from '../features/api-reference/contract'

type ContractState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; spec: OpenApiDocument }

export function ApiReferencePage() {
  useDocumentTitle('API Reference')
  const [state, setState] = useState<ContractState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadContract()
      .then((spec) => {
        if (!cancelled) {
          setState({ status: 'ready', spec })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The contract could not be loaded.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'API Reference' },
          ]}
        />
        <PageHeader eyebrow="Reference · OpenAPI" title="API Reference" />
        <LoadingState label="Loading the API contract…" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'API Reference' },
          ]}
        />
        <PageHeader eyebrow="Reference · OpenAPI" title="API Reference" />
        <ErrorState
          title="The contract could not be loaded"
          description={state.message}
          action={
            <Link className="button" to="/api-lab">
              Go to the API Lab instead
            </Link>
          }
        />
      </div>
    )
  }

  return <ApiReferenceView spec={state.spec} />
}
