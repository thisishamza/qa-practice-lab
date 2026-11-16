// Presentational shell of the API reference. Everything renders from the
// fetched OpenAPI document, so what learners read is always the served
// contract. No network access happens here — the page component loads the
// spec and hands it down.
import { Link } from 'react-router-dom'
import type {
  OpenApiDocument,
  Endpoint,
  EndpointGroup,
  PropertyRow,
} from './contract'
import { buildEndpointGroups, countOperations } from './contract'
import { renderDescription } from './renderDescription'
import { Breadcrumbs, SectionHeader } from '../../components/ui/PageChrome'
import { PageHeader } from '../../components/ui/PageHeader'
import { Callout } from '../../components/ui/Callout'
import { Icon } from '../../components/ui/Icon'

const TAG_TITLES: Record<string, string> = {
  catalogue: 'Catalogue',
  cart: 'Cart',
  checkout: 'Checkout',
  orders: 'Orders',
  auth: 'Authentication',
  account: 'Account',
  admin: 'Admin (staff)',
  practice: 'Practice & learning',
}

function MethodChip({ method }: { method: Endpoint['method'] }) {
  return <span className={`method-chip method-${method}`}>{method.toUpperCase()}</span>
}

function StatusChip({ status }: { status: string }) {
  const family = status.startsWith('2') ? 'ok' : status.startsWith('4') || status.startsWith('5') ? 'warn' : 'info'
  return <span className={`status-chip status-${family}`}>{status}</span>
}

function PropertyTable({ rows, caption }: { rows: PropertyRow[]; caption: string }) {
  if (rows.length === 0) {
    return null
  }
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={caption}>
      <table className="property-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Property</th>
            <th scope="col">Type</th>
            <th scope="col">Required</th>
            <th scope="col">Constraints &amp; notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">
                <code>{row.name}</code>
              </th>
              <td>
                <code>{row.type}</code>
              </td>
              <td>{row.required ? 'Yes' : 'No'}</td>
              <td>{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const labLink = `/api-lab?method=${endpoint.method.toUpperCase()}&path=${encodeURIComponent(endpoint.path)}`

  return (
    <article className="api-endpoint" aria-labelledby={`endpoint-${endpoint.operationId}`}>
      <div className="api-endpoint-head">
        <MethodChip method={endpoint.method} />
        <code className="api-endpoint-path">{endpoint.path}</code>
        {endpoint.isInternal ? (
          <span className="status-chip status-warn">Operator-only · internal</span>
        ) : null}
        {endpoint.isStaff && !endpoint.isInternal ? (
          <span className="status-chip status-info">Staff only</span>
        ) : null}
        {!endpoint.isStaff && endpoint.isProtected ? (
          <span className="status-chip status-info">Sign-in required</span>
        ) : null}
      </div>
      <h3 className="api-endpoint-summary" id={`endpoint-${endpoint.operationId}`}>
        {endpoint.summary}
      </h3>
      <div className="api-endpoint-description">{renderDescription(endpoint.description)}</div>

      {endpoint.parameters.length > 0 ? (
        <div className="api-endpoint-block">
          <h4>Parameters</h4>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Parameters">
            <table className="property-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">In</th>
                  <th scope="col">Type</th>
                  <th scope="col">Required</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.parameters.map((parameter) => (
                  <tr key={`${parameter.location}-${parameter.name}`}>
                    <th scope="row">
                      <code>{parameter.name}</code>
                    </th>
                    <td>{parameter.location}</td>
                    <td>
                      <code>{parameter.type}</code>
                    </td>
                    <td>{parameter.required ? 'Yes' : 'No'}</td>
                    <td>{parameter.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {endpoint.requestBody ? (
        <div className="api-endpoint-block">
          <h4>
            Request body{' '}
            <span className="api-optional">
              {endpoint.requestBodyRequired ? 'required · application/json' : 'optional · application/json'}
            </span>
          </h4>
          <PropertyTable
            rows={endpoint.requestBody}
            caption={`Request body properties for ${endpoint.method.toUpperCase()} ${endpoint.path}`}
          />
        </div>
      ) : null}

      <div className="api-endpoint-block">
        <h4>Responses</h4>
        <ul className="response-list">
          {endpoint.responses.map((response) => (
            <li key={response.status}>
              <StatusChip status={response.status} />
              <span>{response.description}</span>
            </li>
          ))}
        </ul>
        {endpoint.successResponseSchema ? (
          <details className="response-shape">
            <summary>Response shape (success)</summary>
            <PropertyTable
              rows={endpoint.successResponseSchema}
              caption={`Success response properties for ${endpoint.method.toUpperCase()} ${endpoint.path}`}
            />
          </details>
        ) : null}
      </div>

      <div className="api-endpoint-actions">
        <Link className="button button-secondary button-small" to={labLink}>
          <Icon name="api" size={16} />
          Open in API Lab
        </Link>
      </div>
    </article>
  )
}

function GroupSection({ group }: { group: EndpointGroup }) {
  const title = TAG_TITLES[group.tag] ?? `${group.tag.charAt(0).toUpperCase()}${group.tag.slice(1)}`
  return (
    <section className="api-group" aria-labelledby={`api-group-${group.tag}`}>
      <SectionHeader
        id={`api-group-${group.tag}`}
        title={title}
        description={group.description}
      />
      <div className="api-endpoint-list">
        {group.endpoints.map((endpoint) => (
          <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
        ))}
      </div>
    </section>
  )
}

export function ApiReferenceView({ spec }: { spec: OpenApiDocument }) {
  const groups = buildEndpointGroups(spec)
  const operationCount = countOperations(spec)

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'API Reference' },
        ]}
      />

      <PageHeader
        eyebrow={`Reference · OpenAPI ${spec.openapi}`}
        title="API Reference"
        description="The documented contract for every /api/v1 route — methods, parameters, request and response shapes, status codes and error envelopes. Learn the contract here, then challenge it in the API Lab."
        actions={
          <>
            <a className="button button-secondary" href="/openapi.json" download="openapi.json">
              <Icon name="book" size={17} />
              Download openapi.json
            </a>
            <Link className="button" to="/api-lab">
              <Icon name="api" size={17} />
              Open the API Lab
            </Link>
          </>
        }
      />

      <Callout tone="info" title="How to use this reference">
        {operationCount} operations across {groups.length} groups, documented exactly as the server
        answers today. Every error response carries the documented envelope{' '}
        <code>{'{ "error": string, "message": string }'}</code>. Money is integer cents in fictional
        USD. Sign-in uses the lab’s synthetic demo accounts — cookie-based, or a short-lived Bearer
        token minted from the API Lab’s token helper (it is accepted anywhere this contract accepts the
        <code>mpl_customer</code> cookie). Endpoint parameters marked {'"Staff only"'} need the synthetic
        staff account. The Meridian Outfitters API is a training target; nothing here touches real
        payments or real identities.
      </Callout>

      <div className="api-group-list">
        {groups.map((group) => (
          <GroupSection key={group.tag} group={group} />
        ))}
      </div>

      <Callout tone="neutral" title="The contract is the promise">
        This page documents the <em>expected</em> behaviour of each route. It never reveals which
        browser session carries which exercise, and it contains no internal identifiers. If the API
        answers differently from what you see here, capture the difference — that is exactly the
        kind of evidence the exercises train you to report.
      </Callout>
    </div>
  )
}
