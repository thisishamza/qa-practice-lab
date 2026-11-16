// Response viewer for the API Lab: status line, elapsed time, headers
// table and the (byte-capped, text-only) body. Nothing here ever renders
// HTML from the network — the body appears as escaped text inside <pre>.
import { useState } from 'react'
import { formatElapsed, tryPrettyJson } from '../../lib/api-lab'

export interface ConsoleResponseState {
  status: number
  statusText: string
  elapsedMs: number
  headers: Record<string, string>
  body: string
  bodyClipped: boolean
  bodyByteLength: number
  curl: string
}

export function ResponsePanel({
  response,
}: {
  response: ConsoleResponseState | null
}) {
  const [copied, setCopied] = useState<'body' | 'curl' | null>(null)

  function flash(kind: 'body' | 'curl') {
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 2000)
  }

  async function copyText(text: string, kind: 'body' | 'curl') {
    try {
      await navigator.clipboard.writeText(text)
      flash(kind)
    } catch {
      // Clipboard unavailable (permissions or insecure context) — keep the
      // button honest instead of pretending it worked.
      setCopied(null)
    }
  }

  if (!response) {
    return (
      <section className="api-response api-response-empty" aria-labelledby="api-response-heading">
        <h2 id="api-response-heading">Response</h2>
        <p className="api-response-placeholder">
          Send a request to see the raw answer here — status line, elapsed time, headers and body.
          Try <code>GET /api/v1/products</code> with <code>perPage=3&amp;sort=price_asc</code> to
          start, then probe <code>page=0</code>, <code>perPage=999</code> and
          <code>sort=bogus</code> to watch the documented capping behaviour.
        </p>
      </section>
    )
  }

  const pretty = tryPrettyJson(response.body)
  const family = response.status >= 200 && response.status < 300 ? 'ok' : 'warn'
  const headerEntries = Object.entries(response.headers).sort(([a], [b]) => a.localeCompare(b))

  return (
    <section className="api-response" aria-labelledby="api-response-heading">
      <div className="api-response-head">
        <h2 id="api-response-heading">Response</h2>
        <div className="api-response-actions">
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={() => copyText(pretty.text, 'body')}
          >
            {copied === 'body' ? 'Copied' : 'Copy body'}
          </button>
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={() => copyText(response.curl, 'curl')}
          >
            {copied === 'curl' ? 'Copied' : 'Copy as curl'}
          </button>
        </div>
      </div>

      <div className="api-response-statusline" role="status">
        <span className={`status-chip status-${family}`}>
          {response.status} {response.statusText}
        </span>
        <span className="api-response-elapsed">{formatElapsed(response.elapsedMs)}</span>
        {response.bodyClipped ? (
          <span className="api-response-clipped">
            Body clipped at 64 KB for display — the server answer was larger.
          </span>
        ) : null}
      </div>

      {headerEntries.length > 0 ? (
        <details className="api-response-headers" open>
          <summary>Headers ({headerEntries.length})</summary>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Response headers">
            <table className="property-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {headerEntries.map(([name, value]) => (
                  <tr key={name}>
                    <th scope="row">
                      <code>{name}</code>
                    </th>
                    <td>
                      <code>{value}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <pre className="api-response-body" tabIndex={0} aria-label="Response body">
        {pretty.text.length > 0 ? pretty.text : '(empty body)'}
      </pre>
    </section>
  )
}
