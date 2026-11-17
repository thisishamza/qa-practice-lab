import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { LoadingState, ErrorState } from '../components/ui/States'
import { validatePayload, ContractValidationError } from '../shared/contractValidation'
import { CONTRACT_FIXTURES, fixtureOperationSchema } from '../shared/contracts/index'
import type { ContractAssertion } from '../shared/contractTypes'
import type { OpenApiDocument } from '../features/api-reference/contract'
import { loadContract } from '../features/api-reference/contract'
import { AssertionList } from '../features/contract/AssertionList'
import { Icon } from '../components/ui/Icon'
import { PROVIDER_PRODUCT_V1_PAYLOAD } from '../shared/contracts/providerProduct'

const MAX_PASTE = 24 * 1024

const LIVE_OPERATIONS = [
  { id: 'Product', label: 'Product (GET /api/v1/products/{slug})' },
  { id: 'ProductListResponse', label: 'ProductListResponse (GET /api/v1/products)' },
  { id: 'CheckoutSummary', label: 'CheckoutSummary (GET /api/v1/checkout)' },
  { id: 'CheckoutRequest', label: 'CheckoutRequest (POST /api/v1/checkout)' },
  { id: 'OrderDetail', label: 'OrderDetail (GET /api/v1/orders/{reference})' },
] as const

const LIVE_EXAMPLES: Record<string, unknown> = {
  Product: PROVIDER_PRODUCT_V1_PAYLOAD,
  ProductListResponse: { data: [PROVIDER_PRODUCT_V1_PAYLOAD], page: 1, perPage: 12, total: 42, totalPages: 4 },
  CheckoutSummary: {
    data: [],
    itemCount: 0,
    subtotalCents: 0,
    totalCents: 0,
    currency: 'USD',
    checkoutable: false,
  },
  CheckoutRequest: {
    customerName: 'Amara Okafor',
    customerEmail: 'amara.okafor@example.com',
    shippingLine: '12 Aldermere Lane',
    shippingCity: 'Aldermere',
    shippingPostcode: 'AL1 1AA',
    paymentSimulation: 'approved',
  },
  OrderDetail: {
    reference: 'ORD-0A1B2C3D4E5F6078',
    status: 'placed',
    paymentStatus: 'approved',
    itemCount: 1,
    totalCents: 34900,
    currency: 'USD',
    createdAt: '2026-11-16T14:03:00Z',
    cancelledAt: null,
    customerName: 'Amara Okafor',
    customerEmail: 'amara.okafor@example.com',
    shippingLine: '12 Aldermere Lane',
    shippingCity: 'Aldermere',
    shippingPostcode: 'AL1 1AA',
    subtotalCents: 34900,
    items: [
      {
        id: 1,
        productId: 1,
        productSlug: 'ridgeline-2-person-tent',
        productName: 'Ridgeline 2-Person Tent',
        unitPriceCents: 34900,
        currency: 'USD',
        quantity: 1,
        lineTotalCents: 34900,
      },
    ],
  },
}

function fixtureStarter(fixtureId: string, operationId: string): string {
  const key = fixtureId.startsWith('ledger-') ? 'ledger-v1' : fixtureId
  switch (key) {
    case 'ledger-v1':
      switch (operationId) {
        case 'EntryListResponse':
          return JSON.stringify({ data: [], total: 0 }, null, 2)
        case 'CreateEntryRequest':
          return JSON.stringify(
            {
              entryId: 'LE-9Z8Y7X6W',
              amountCents: 12500,
              currency: 'USD',
              direction: 'credit',
              merchant: 'Meridian Settlement',
              postedAt: '2026-11-16T09:30:00Z',
            },
            null,
            2,
          )
        default:
          return JSON.stringify(
            {
              entryId: 'LE-0A1B2C3D',
              amountCents: 4250,
              currency: 'USD',
              direction: 'debit',
              status: 'posted',
              merchant: 'Ridgeline Outfitters',
              postedAt: '2026-11-16T00:00:00Z',
              settledAt: null,
            },
            null,
            2,
          )
      }
    case 'checkout-flow':
      switch (operationId) {
        case 'CheckoutSummary':
          return JSON.stringify(
            {
              items: [{ productSlug: 'ridgeline-2-person-tent', quantity: 1, unitPriceCents: 34900 }],
              totalCents: 34900,
              currency: 'USD',
            },
            null,
            2,
          )
        case 'CheckoutRequest':
          return JSON.stringify({ customerName: 'Amara Okafor', paymentSimulation: 'approved' }, null, 2)
        default:
          return JSON.stringify(
            {
              reference: 'ORD-0A1B2C3D4E5F6078',
              status: 'placed',
              totalCents: 71690,
              currency: 'USD',
              createdAt: '2026-11-16T14:03:00Z',
              cancelledAt: null,
              items: [
                {
                  productSlug: 'ridgeline-2-person-tent',
                  quantity: 2,
                  unitPriceCents: 34900,
                  lineTotalCents: 69800,
                },
              ],
            },
            null,
            2,
          )
      }
    default:
      return '{}'
  }
}

type Source = { kind: 'fixture'; fixtureId: string; operationId: string } | { kind: 'live'; operationId: string }

export function ContractValidatePage() {
  useDocumentTitle('Contract Testing — Validate')
  const [searchParams] = useSearchParams()
  const [source, setSource] = useState<Source>(() => {
    const fixture = searchParams.get('fixture')
    const operation = searchParams.get('operation')
    if (fixture && CONTRACT_FIXTURES.some((entry) => entry.id === fixture)) {
      return {
        kind: 'fixture',
        fixtureId: fixture,
        operationId: operation ?? CONTRACT_FIXTURES.find((entry) => entry.id === fixture)?.operations[0]?.id ?? 'LedgerEntry',
      }
    }
    return { kind: 'live', operationId: 'Product' }
  })
  const [payloadText, setPayloadText] = useState(() => {
    const fixture = searchParams.get('fixture')
    if (fixture && CONTRACT_FIXTURES.some((entry) => entry.id === fixture)) {
      const operationId = searchParams.get('operation') ?? CONTRACT_FIXTURES.find((entry) => entry.id === fixture)?.operations[0]?.id ?? 'LedgerEntry'
      return fixtureStarter(fixture, operationId)
    }
    return JSON.stringify(LIVE_EXAMPLES[searchParams.get('operation') ?? 'Product'] ?? LIVE_EXAMPLES.Product, null, 2)
  })
  const [assertions, setAssertions] = useState<ContractAssertion[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const isLive = source.kind === 'live'
  const [tooLarge, setTooLarge] = useState(false)
  const [liveDoc, setLiveDoc] = useState<OpenApiDocument | null>(null)
  const [liveState, setLiveState] = useState<'idle' | 'loading' | 'ready' | 'error'>(() => (isLive ? 'loading' : 'idle'))
  const [liveError, setLiveError] = useState<string | null>(null)

  const fixture = !isLive ? CONTRACT_FIXTURES.find((entry) => entry.id === source.fixtureId) : null

  const [reloadToken, setReloadToken] = useState(0)

  // Fetch the served contract only on demand, only this literal URL.
  useEffect(() => {
    if (!isLive || liveDoc) {
      return
    }
    let cancelled = false
    loadContract()
      .then((doc) => {
        if (cancelled) return
        setLiveDoc(doc)
        setLiveState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLiveError(error instanceof Error ? error.message : 'The contract could not be loaded.')
        setLiveState('error')
      })
    return () => {
      cancelled = true
    }
    // reloadToken re-fires this effect for the Try again button.
  }, [isLive, liveDoc, reloadToken])

  const operations = isLive
    ? LIVE_OPERATIONS
    : (fixture?.operations ?? []).map((operation) => ({ id: operation.id, label: operation.label }))

  const schema = useMemo((): Record<string, unknown> | null => {
    if (isLive) {
      if (!liveDoc) {
        return null
      }
      return {
        ...liveDoc,
        $ref: `#/components/schemas/${source.operationId}`,
      } as unknown as Record<string, unknown>
    }
    const target = fixtureOperationSchema(source.fixtureId, source.operationId)
    return target?.schema ?? null
  }, [isLive, liveDoc, source])

  const onSourceChange = (fixtureId: string) => {
    if (fixtureId === 'live') {
      setSource({ kind: 'live', operationId: 'Product' })
      setPayloadText(JSON.stringify(LIVE_EXAMPLES.Product, null, 2))
    } else {
      const target = CONTRACT_FIXTURES.find((entry) => entry.id === fixtureId)
      const operationId = target?.operations[0]?.id ?? 'LedgerEntry'
      setSource({ kind: 'fixture', fixtureId, operationId })
      setPayloadText(fixtureStarter(fixtureId, operationId))
    }
    setAssertions(null)
    setParseError(null)
    setTooLarge(false)
  }

  const onOperationChange = (operationId: string) => {
    setSource((current) => (current.kind === 'live' ? { ...current, operationId } : { ...current, operationId }))
    if (!isLive) {
      setPayloadText(fixtureStarter(source.fixtureId, operationId))
    } else {
      setPayloadText(JSON.stringify(LIVE_EXAMPLES[operationId] ?? {}, null, 2))
    }
    setAssertions(null)
    setParseError(null)
    setTooLarge(false)
  }

  const onPayloadChange = (value: string) => {
    if (value.length > MAX_PASTE) {
      setTooLarge(true)
      return
    }
    setTooLarge(false)
    setPayloadText(value)
    setAssertions(null)
    setParseError(null)
  }

  const onValidate = () => {
    if (!schema) {
      return
    }
    let payload: unknown
    try {
      payload = JSON.parse(payloadText)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'The payload is not valid JSON.')
      setAssertions(null)
      return
    }
    setParseError(null)
    try {
      setAssertions(validatePayload(schema, payload))
    } catch (error) {
      if (error instanceof ContractValidationError) {
        setParseError(error.message)
        setAssertions(null)
        return
      }
      throw error
    }
  }

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Contract Testing', to: '/contract' },
          { label: 'Validate' },
        ]}
      />
      <PageHeader
        eyebrow="Contract testing · Capability A"
        title="Validate a payload"
        description="Pick a contract and an operation, paste a JSON payload, and read the assertion list — the exact keyword, path and value that failed. Validation runs in your browser against the same engine the server uses for scoring."
      />

      <Callout tone="info" title="Valid ≠ correct">
        This checks structure only — that the payload satisfies the documented contract. It does
        not certify the data means the right thing. Semantics are your job; shape is the
        contract&apos;s.
      </Callout>

      <div className="contract-workspace">
        <section className="workspace-panel" aria-labelledby="validate-input-title">
          <div className="workspace-head">
            <h2 id="validate-input-title" className="workspace-title">Payload</h2>
            <span className="workspace-status workspace-status-ok">
              <span className="workspace-dot" aria-hidden="true" />
              {isLive ? 'Live contract' : source.fixtureId}
            </span>
          </div>
          <div className="workspace-body">
            <div className="contract-form-row">
              <label className="contract-field">
                <span className="contract-field-label">Contract</span>
                <select
                  id="validate-source"
                  className="contract-select"
                  value={isLive ? 'live' : source.fixtureId}
                  onChange={(event) => onSourceChange(event.target.value)}
                >
                  <option value="live">Live platform contract (/openapi.json)</option>
                  {CONTRACT_FIXTURES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="contract-field">
                <span className="contract-field-label">Operation</span>
                <select
                  id="validate-operation"
                  className="contract-select"
                  value={source.operationId}
                  onChange={(event) => onOperationChange(event.target.value)}
                >
                  {operations.map((operation) => (
                    <option key={operation.id} value={operation.id}>
                      {operation.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {isLive && liveState === 'loading' ? <LoadingState label="Loading the contract…" /> : null}
            {isLive && liveState === 'error' ? (
              <ErrorState
                title="The contract could not be loaded"
                description={liveError ?? 'Unknown error'}
                action={
                  <button type="button" className="button" onClick={() => { setLiveState('loading'); setReloadToken((n) => n + 1) }}>
                    Try again
                  </button>
                }
              />
            ) : null}

            <label className="contract-field">
              <span className="contract-field-label">Payload</span>
              <textarea
                id="validate-payload"
                className="contract-textarea"
                spellCheck={false}
                value={payloadText}
                onChange={(event) => onPayloadChange(event.target.value)}
                aria-describedby="validate-payload-note"
              />
            </label>
            <p id="validate-payload-note" className="panel-note">
              JSON only — no YAML, no comments. Hard cap 24 KB. Rendering shows your text verbatim.
            </p>
            {tooLarge ? (
              <p className="contract-inline-error" role="alert">
                <Icon name="alert" size={16} /> The payload editor caps at 24 KB. Trim it and try again.
              </p>
            ) : null}
            {parseError ? (
              <p className="contract-inline-error" role="alert">
                <Icon name="alert" size={16} /> {parseError}
              </p>
            ) : null}
            <div className="button-row">
              <button type="button" className="button" onClick={onValidate} disabled={schema === null}>
                Validate
              </button>
              <Link className="button button-ghost" to="/contract/exercises/contract-bgn-required-01">
                Guided exercise: required fields
              </Link>
            </div>
          </div>
        </section>

        <section className="workspace-panel" aria-labelledby="validate-result-title" aria-live="polite">
          <div className="workspace-head">
            <h2 id="validate-result-title" className="workspace-title">Assertions</h2>
            {assertions !== null ? (
              <span className={`workspace-status ${assertions.length === 0 ? 'workspace-status-ok' : 'workspace-status-error'}`}>
                <span className="workspace-dot" aria-hidden="true" />
                {assertions.length === 0 ? 'Valid' : 'Invalid'}
              </span>
            ) : null}
          </div>
          <div className="workspace-body">
            {assertions === null ? (
              <p className="panel-note">Run validate — the failing keywords, paths and values will appear here.</p>
            ) : (
              <AssertionList assertions={assertions} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
