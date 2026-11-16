import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { Icon } from '../components/ui/Icon'
import { ConsoleForm, type ConsoleFormErrors, type ConsoleFormState } from '../components/api-lab/ConsoleForm'
import { ResponsePanel, type ConsoleResponseState } from '../components/api-lab/ResponsePanel'
import { RequestHistory } from '../components/api-lab/RequestHistory'
import { TokenHelper } from '../components/api-lab/TokenHelper'
import {
  addHistoryEntry,
  assertSameOriginApiUrl,
  buildCurlCommand,
  buildHeaders,
  buildRequestTarget,
  methodAllowsBody,
  readCappedText,
  validatePath,
  validateQuery,
  CONSOLE_METHODS,
  emptyHeaderRow,
  type ConsoleMethod,
  type HistoryEntry,
} from '../lib/api-lab'

const EMPTY_ERRORS: ConsoleFormErrors = {
  path: null,
  query: null,
  headerIssues: {},
  summary: [],
}

export function ApiLabPage() {
  useDocumentTitle('API Lab')
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<ConsoleFormState>(() => ({
    method: 'GET',
    path: '/api/v1/products',
    query: 'perPage=3',
    headers: [emptyHeaderRow(crypto.randomUUID())],
    body: '',
  }))
  const [errors, setErrors] = useState<ConsoleFormErrors>(EMPTY_ERRORS)
  const [sending, setSending] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [response, setResponse] = useState<ConsoleResponseState | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const pathInputRef = useRef<HTMLInputElement | null>(null)
  const prefillApplied = useRef(false)

  // Deep links ("Open in API Lab" from the reference and scenario pages):
  // apply method/path/query once, on mount. Invalid values are still shown
  // so the validation can explain what is wrong.
  useEffect(() => {
    if (prefillApplied.current) {
      return
    }
    prefillApplied.current = true
    const method = searchParams.get('method')?.toUpperCase()
    const path = searchParams.get('path')
    const query = searchParams.get('query')
    setForm((previous) => {
      const next = { ...previous }
      if (method && (CONSOLE_METHODS as readonly string[]).includes(method)) {
        next.method = method as ConsoleMethod
      }
      if (path !== null && path.trim().length > 0) {
        const check = validatePath(path)
        next.path = check.ok ? check.value : path.trim()
      }
      if (query !== null) {
        const check = validateQuery(query)
        if (check.ok) {
          next.query = check.value
        }
      }
      return next
    })
  }, [searchParams])

  function patchForm(patch: Partial<ConsoleFormState>) {
    setForm((previous) => ({ ...previous, ...patch }))
    setErrors((previous) => ({ ...previous, summary: [] }))
  }

  function handleHeaderChange(rowId: string, patch: Partial<{ name: string; value: string }>) {
    setForm((previous) => ({
      ...previous,
      headers: previous.headers.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }))
  }

  function handleHeaderAdd() {
    setForm((previous) => ({
      ...previous,
      headers: [...previous.headers, emptyHeaderRow(crypto.randomUUID())],
    }))
  }

  function handleHeaderRemove(rowId: string) {
    setForm((previous) => ({
      ...previous,
      headers: previous.headers.filter((row) => row.id !== rowId),
    }))
  }

  function handleApplyBearer(value: string) {
    setForm((previous) => {
      const existing = previous.headers.find(
        (row) => row.name.trim().toLowerCase() === 'authorization',
      )
      if (existing) {
        return {
          ...previous,
          headers: previous.headers.map((row) =>
            row.id === existing.id ? { ...row, value } : row,
          ),
        }
      }
      return {
        ...previous,
        headers: [...previous.headers, { id: crypto.randomUUID(), name: 'Authorization', value }],
      }
    })
  }

  function handleClearBearer(exactValue: string) {
    setForm((previous) => {
      const headers = previous.headers.filter((row) => row.value.trim() !== exactValue)
      if (headers.length === previous.headers.length) {
        return previous
      }
      return {
        ...previous,
        headers: headers.length > 0 ? headers : [emptyHeaderRow(crypto.randomUUID())],
      }
    })
  }

  function handleAddContentTypeHeader() {
    setForm((previous) => {
      const existing = previous.headers.find(
        (row) => row.name.trim().toLowerCase() === 'content-type',
      )
      if (existing) {
        return {
          ...previous,
          headers: previous.headers.map((row) =>
            row.id === existing.id ? { ...row, value: 'application/json' } : row,
          ),
        }
      }
      return {
        ...previous,
        headers: [
          ...previous.headers,
          { id: crypto.randomUUID(), name: 'Content-Type', value: 'application/json' },
        ],
      }
    })
  }

  const send = useCallback(async () => {
    const pathCheck = validatePath(form.path)
    const queryCheck = validateQuery(form.query)
    const { headers, issues } = buildHeaders(form.headers)

    const headerIssues: Record<string, string> = {}
    const summary: string[] = []
    if (!pathCheck.ok) {
      summary.push(pathCheck.error)
    }
    if (!queryCheck.ok) {
      summary.push(queryCheck.error)
    }
    for (const issue of issues) {
      headerIssues[issue.rowId] = issue.message
      summary.push(issue.message)
    }
    setErrors({
      path: pathCheck.ok ? null : pathCheck.error,
      query: queryCheck.ok ? null : queryCheck.error,
      headerIssues,
      summary,
    })
    if (summary.length > 0) {
      requestAnimationFrame(() => {
        document.getElementById('api-lab-error-summary')?.focus()
      })
      return
    }

    const target = buildRequestTarget(
      (pathCheck as { ok: true; value: string }).value,
      (queryCheck as { ok: true; value: string }).value,
    )
    const href = assertSameOriginApiUrl(target, window.location.origin)
    if (!href.ok) {
      setErrors({
        path: null,
        query: null,
        headerIssues: {},
        summary: [href.error],
      })
      return
    }

    const bodyText = form.body
    setSending(true)
    setRequestError(null)
    const start = performance.now()
    try {
      const init: RequestInit = {
        method: form.method,
        credentials: 'same-origin',
        headers,
      }
      if (methodAllowsBody(form.method) && bodyText.trim().length > 0) {
        init.body = bodyText
      }
      const response = await fetch(href.value, init)
      const raw = await readCappedText(response)
      const elapsedMs = performance.now() - start

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, name) => {
        responseHeaders[name] = value
      })

      const curl = buildCurlCommand({
        method: form.method,
        origin: window.location.origin,
        path: (pathCheck as { ok: true; value: string }).value,
        query: (queryCheck as { ok: true; value: string }).value,
        headers,
        body: bodyText,
      })

      setResponse({
        status: response.status,
        statusText: response.statusText,
        elapsedMs,
        headers: responseHeaders,
        body: raw.text,
        bodyClipped: raw.clipped,
        bodyByteLength: raw.byteLength,
        curl,
      })
      setHistory((previous) =>
        addHistoryEntry(previous, {
          id: crypto.randomUUID(),
          method: form.method,
          target,
          status: response.status,
          elapsedMs,
          at: Date.now(),
        }),
      )
    } catch (error) {
      setResponse(null)
      setRequestError(
        error instanceof Error
          ? `The request failed before any response arrived (${error.message}).`
          : 'The request failed before any response arrived.',
      )
    } finally {
      setSending(false)
    }
  }, [form])

  function handleReplay(entry: HistoryEntry) {
    const queryIndex = entry.target.indexOf('?')
    const path = queryIndex === -1 ? entry.target : entry.target.slice(0, queryIndex)
    const query = queryIndex === -1 ? '' : entry.target.slice(queryIndex + 1)
    setForm((previous) => ({ ...previous, method: entry.method, path, query }))
    setRequestError(null)
    pathInputRef.current?.focus()
  }

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'API Lab' },
        ]}
      />

      <PageHeader
        eyebrow="Workshop · same-origin /api/v1"
        title="API Lab"
        description="Fire real requests at the live Meridian Outfitters practice API — status, headers, timing and body, without leaving the lab. Copy any request as curl for your terminal."
        actions={
          <Link className="button button-secondary" to="/api-reference">
            <Icon name="contract" size={16} />
            API Reference
          </Link>
        }
      />

      <Callout tone="neutral" title="What this console can and cannot do">
        Same-origin only: requests go to this app’s <code>/api/v1</code> endpoints and nowhere
        else — external URLs are refused. Your cookies flow automatically, nothing you type is
        saved beyond this page, and response bodies are shown as inert text. Request bodies and
        credentials are never written to browser storage.
      </Callout>

      <TokenHelper onApplyBearer={handleApplyBearer} onClearBearer={handleClearBearer} />

      {requestError ? (
        <Callout tone="danger" title="Request failed">
          {requestError}
        </Callout>
      ) : null}

      <div className="api-lab-layout">
        <ConsoleForm
          form={form}
          errors={errors}
          sending={sending}
          pathInputRef={pathInputRef}
          onChange={patchForm}
          onHeaderChange={handleHeaderChange}
          onHeaderAdd={handleHeaderAdd}
          onHeaderRemove={handleHeaderRemove}
          onAddContentTypeHeader={handleAddContentTypeHeader}
          onSend={send}
        />
        <ResponsePanel response={response} />
      </div>

      <RequestHistory
        entries={history}
        onReplay={handleReplay}
        onClear={() => setHistory([])}
      />
    </div>
  )
}
