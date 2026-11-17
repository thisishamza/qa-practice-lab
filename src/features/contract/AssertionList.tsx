// Shared assertion list renderer (Phase 7). Every plane — hub workspaces,
// exercise pages, consumer verification — renders the same structured list:
// path · keyword · expected · actual · why. Monospace for values, theme-safe,
// copy-as-JSON affordance, no raw JSON blobs rendered inline.

import { useCallback, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import type { ContractAssertion } from '../../shared/contractTypes'

export function AssertionList({
  assertions,
  emptyLabel = 'No assertions — the payload satisfies the contract.',
}: {
  assertions: readonly ContractAssertion[]
  emptyLabel?: string
}) {
  const [copied, setCopied] = useState(false)

  const copyJson = useCallback(() => {
    const text = JSON.stringify(assertions, null, 2)
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }, [assertions])

  if (assertions.length === 0) {
    return (
      <p className="assertion-list-empty" role="status">
        <Icon name="check" size={16} /> {emptyLabel}
      </p>
    )
  }

  return (
    <div className="assertion-list">
      <div className="assertion-list-head">
        <p className="assertion-list-title" role="heading" aria-level={3}>
          {assertions.length} {assertions.length === 1 ? 'assertion' : 'assertions'} failed
        </p>
        <button type="button" className="button button-ghost button-sm" onClick={copyJson}>
          {copied ? 'Copied' : 'Copy as JSON'}
        </button>
      </div>
      <ol className="assertion-items">
        {assertions.map((assertion, index) => (
          <li key={`${assertion.path}|${assertion.keyword}|${index}`} className="assertion-item">
            <div className="assertion-item-head">
              <code className="assertion-path">{assertion.path}</code>
              <span className="assertion-keyword">{assertion.keyword}</span>
            </div>
            <dl className="assertion-item-body">
              <div>
                <dt>Expected</dt>
                <dd>
                  <code>{assertion.expected}</code>
                </dd>
              </div>
              <div>
                <dt>Actual</dt>
                <dd>
                  <code>{assertion.actual}</code>
                </dd>
              </div>
            </dl>
            <p className="assertion-message">{assertion.message}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
