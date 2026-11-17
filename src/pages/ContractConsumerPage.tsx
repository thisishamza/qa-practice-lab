import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { LoadingState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { usePracticeSession } from '../features/practice/usePracticeSession'
import { PROVIDER_PRODUCT_CRITICAL_FIELDS } from '../shared/contracts/providerProduct'
import { verifyConsumer } from '../features/contract/api'
import { AssertionList } from '../features/contract/AssertionList'
import type { ContractVerifyConsumerResponse } from '../shared/contractApi'

const CRITICAL_FIELD_TYPES: Record<string, string> = {
  slug: '{ "type": "string" }',
  name: '{ "type": "string" }',
  priceCents: '{ "type": "integer", "minimum": 0 }',
  currency: '{ "const": "USD" }',
  stockStatus: '{ "enum": ["in_stock", "low_stock", "out_of_stock"] }',
}

const FIXTURE_OPTIONS = [
  { id: 'provider-product-v1', label: 'provider-product-v1 (the documented provider)' },
  { id: 'provider-product-v2-compatible', label: 'provider-product-v2-compatible (additive — warehouseRank)' },
  { id: 'provider-product-v2-latest', label: 'provider-product-v2-latest (what v2 looks like today)' },
] as const

type FixtureId = (typeof FIXTURE_OPTIONS)[number]['id']

function scaffold(selected: readonly string[]): string {
  const properties = selected
    .map((field) => `    "${field}": ${CRITICAL_FIELD_TYPES[field]}`)
    .join(',\n')
  return `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": [${selected.map((field) => `"${field}"`).join(', ')}],
  "properties": {
${properties}
  }
}`
}

export function ContractConsumerPage() {
  useDocumentTitle('Contract Testing — Consumer verification')
  const [searchParams] = useSearchParams()
  const { loadState, mode, hunt } = usePracticeSession()
  const huntActive = mode === 'bug_hunt' && hunt?.id === 'hunt-contract-007'
  const [mode_, setMode_] = useState<'guided' | 'raw'>('guided')
  const [selected, setSelected] = useState<string[]>([...PROVIDER_PRODUCT_CRITICAL_FIELDS])
  const [expectationText, setExpectationText] = useState(() => scaffold([...PROVIDER_PRODUCT_CRITICAL_FIELDS]))
  const [fixtureId, setFixtureId] = useState<FixtureId>(
    searchParams.get('fixture') === 'provider-product-v2-compatible'
      ? 'provider-product-v2-compatible'
      : 'provider-product-v1',
  )
  const [result, setResult] = useState<ContractVerifyConsumerResponse | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const guidedScaffold = useMemo(() => scaffold(selected), [selected])

  const toggleField = (field: string) => {
    setSelected((current) => {
      const next = current.includes(field)
        ? current.filter((entry) => entry !== field)
        : [...current, field]
      return PROVIDER_PRODUCT_CRITICAL_FIELDS.filter((critical) => next.includes(critical))
    })
  }

  const effectiveExpectation = mode_ === 'guided' ? guidedScaffold : expectationText

  const onVerify = async () => {
    let expectation: unknown
    try {
      expectation = JSON.parse(effectiveExpectation)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'The expectation is not valid JSON.')
      return
    }
    setParseError(null)
    setBusy(true)
    setResult(null)
    try {
      const response = await verifyConsumer({ expectation, providerFixtureId: fixtureId })
      setResult(response)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'The expectation could not be verified.')
    } finally {
      setBusy(false)
    }
  }

  const copyExpectation = () => {
    void navigator.clipboard?.writeText(expectationText).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  if (loadState.status === 'loading') {
    return <LoadingState label="Loading the consumer workspace…" />
  }

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Contract Testing', to: '/contract' },
          { label: 'Consumer verification' },
        ]}
      />
      <PageHeader
        eyebrow="Contract testing · Capability C"
        title="Verify your expectation"
        description="Write the smallest schema your consumer actually reads — five critical fields, nothing else — verify it against the provider fixture, then swap to v2-latest and watch it fail. That failure is the reason contract tests exist."
        actions={
          <Link className="button button-secondary" to="/contract/exercises/contract-adv-consumer-expect-01">
            Guided exercise: write the expectation
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

      {huntActive ? (
        <Callout tone="warning" title="Bug-hunt mode — the provider is intentionally deviating">
          The v2 fixture in this session carries a drift (a renamed field and a re-cased enum).
          Your expectation is the pin — read the failing assertions, decide who moved, and keep
          the pin. Leaving the hunt restores the additive provider immediately.
        </Callout>
      ) : (
        <Callout tone="info" title="Valid ≠ correct">
          A passing verification proves the shape matches — not that the data is truthful.
          Contract tests pin interfaces; correctness lives elsewhere.
        </Callout>
      )}

      <div className="contract-workspace">
        <section className="workspace-panel" aria-labelledby="consumer-input-title">
          <div className="workspace-head">
            <h2 id="consumer-input-title" className="workspace-title">Expectation</h2>
            <span className="workspace-status workspace-status-ok">
              <span className="workspace-dot" aria-hidden="true" />
              {mode_ === 'guided' ? 'guided' : 'raw'}
            </span>
          </div>
          <div className="workspace-body">
            <div className="contract-form-row" role="group" aria-label="Editor mode">
              <button
                type="button"
                className={`filter-chip filter-chip-toggle${mode_ === 'guided' ? ' filter-chip-active' : ''}`}
                aria-pressed={mode_ === 'guided'}
                onClick={() => setMode_('guided')}
              >
                Guided (checklist)
              </button>
              <button
                type="button"
                className={`filter-chip filter-chip-toggle${mode_ === 'raw' ? ' filter-chip-active' : ''}`}
                aria-pressed={mode_ === 'raw'}
                onClick={() => setMode_('raw')}
              >
                Raw schema
              </button>
            </div>

            {mode_ === 'guided' ? (
              <>
                <p className="panel-note">Consumer-critical fields for <code>getProduct</code> — pin exactly what this consumer reads:</p>
                <div className="expectation-critical">
                  {PROVIDER_PRODUCT_CRITICAL_FIELDS.map((field) => (
                    <label key={field}>
                      <input
                        type="checkbox"
                        checked={selected.includes(field)}
                        onChange={() => toggleField(field)}
                      />
                      <code>{field}</code>
                    </label>
                  ))}
                </div>
                <pre className="expectation-preview" aria-label="Generated expectation">{guidedScaffold}</pre>
              </>
            ) : (
              <label className="contract-field">
                <span className="contract-field-label">Expectation (JSON Schema)</span>
                <textarea
                  id="expectation-raw"
                  className="contract-textarea"
                  spellCheck={false}
                  value={expectationText}
                  onChange={(event) => setExpectationText(event.target.value)}
                />
              </label>
            )}

            <label className="contract-field">
              <span className="contract-field-label">Provider fixture</span>
              <select
                id="provider-fixture"
                className="contract-select"
                value={fixtureId}
                onChange={(event) => setFixtureId(event.target.value as FixtureId)}
              >
                {FIXTURE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button type="button" className="button" onClick={onVerify} disabled={busy}>
                {busy ? 'Verifying…' : 'Verify'}
              </button>
              <button type="button" className="button button-ghost" onClick={copyExpectation}>
                {copied ? 'Copied' : 'Copy expectation'}
              </button>
            </div>
            {parseError ? (
              <p className="contract-inline-error" role="alert">
                <Icon name="alert" size={16} /> {parseError}
              </p>
            ) : null}
          </div>
        </section>

        <section className="workspace-panel" aria-labelledby="consumer-result-title" aria-live="polite">
          <div className="workspace-head">
            <h2 id="consumer-result-title" className="workspace-title">Verification</h2>
            {result ? (
              <span className={`workspace-status ${result.valid ? 'workspace-status-ok' : 'workspace-status-error'}`}>
                <span className="workspace-dot" aria-hidden="true" />
                {result.valid ? 'Holds' : 'Fails'}
              </span>
            ) : null}
          </div>
          <div className="workspace-body">
            {result === null ? (
              <p className="panel-note">
                Build the expectation on the left, then Verify — the assertion list appears here.
                Swap the provider fixture to watch the same expectation fail.
              </p>
            ) : (
              <>
                <p className="panel-note" role="status">
                  {result.valid
                    ? 'The expectation holds against this fixture — every assertion passes.'
                    : result.mismatchSummary ?? 'Assertions fail — see the list.'}
                </p>
                <AssertionList assertions={result.assertions} emptyLabel="The expectation holds — no assertions fired." />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
