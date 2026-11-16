// Controlled form for the API Lab console. Accessibility conventions match
// the bug-report form: every control labelled, `aria-invalid` on invalid
// fields, hints via `aria-describedby`, and a linked error summary on
// failed sends.
import {
  CONSOLE_METHODS,
  methodAllowsBody,
  validatePath,
  validateQuery,
  type ConsoleMethod,
  type HeaderRow,
} from '../../lib/api-lab'
import { Icon } from '../ui/Icon'

export interface ConsoleFormState {
  method: ConsoleMethod
  path: string
  query: string
  headers: HeaderRow[]
  body: string
}

export interface ConsoleFormErrors {
  path: string | null
  query: string | null
  headerIssues: Record<string, string>
  summary: string[]
}

interface ConsoleFormProps {
  form: ConsoleFormState
  errors: ConsoleFormErrors
  sending: boolean
  pathInputRef: React.RefObject<HTMLInputElement | null>
  onChange: (patch: Partial<ConsoleFormState>) => void
  onHeaderChange: (rowId: string, patch: Partial<HeaderRow>) => void
  onHeaderAdd: () => void
  onHeaderRemove: (rowId: string) => void
  onAddContentTypeHeader: () => void
  onSend: () => void
}

export function ConsoleForm({
  form,
  errors,
  sending,
  pathInputRef,
  onChange,
  onHeaderChange,
  onHeaderAdd,
  onHeaderRemove,
  onAddContentTypeHeader,
  onSend,
}: ConsoleFormProps) {
  const allowsBody = methodAllowsBody(form.method)
  const pathCheck = validatePath(form.path)
  const queryHint = validateQuery(form.query)
  const pathHasParams = /\{[^}]+\}/.test(form.path)

  return (
    <form
      className="api-lab-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      {errors.summary.length > 0 ? (
        <div className="form-error-summary" role="alert" tabIndex={-1} id="api-lab-error-summary">
          <h4>The request was not sent</h4>
          <ul>
            {errors.summary.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="api-lab-line">
        <div className="report-field api-lab-method">
          <label htmlFor="api-lab-method">Method</label>
          <select
            id="api-lab-method"
            value={form.method}
            onChange={(event) => onChange({ method: event.target.value as ConsoleMethod })}
          >
            {CONSOLE_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>

        <div className="report-field api-lab-path">
          <label htmlFor="api-lab-path">
            Path <span className="field-requirement">(same-origin, /api/v1 only)</span>
          </label>
          <input
            id="api-lab-path"
            ref={pathInputRef}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="/api/v1/products"
            value={form.path}
            aria-invalid={errors.path !== null || (!pathCheck.ok && form.path.length > 0)}
            aria-describedby="api-lab-path-hint"
            onChange={(event) => onChange({ path: event.target.value })}
          />
          <p className="field-hint" id="api-lab-path-hint">
            {pathHasParams
              ? 'Replace the {parameter} placeholders with real values, e.g. /api/v1/products/canvas-tote-bag.'
              : 'Only this origin’s /api/v1 endpoints can be called. External URLs are refused.'}
          </p>
          {errors.path !== null ? <p className="report-field-error">{errors.path}</p> : null}
        </div>
      </div>

      <div className="report-field">
        <label htmlFor="api-lab-query">
          Query string <span className="field-optional">(optional, without the leading ?)</span>
        </label>
        <input
          id="api-lab-query"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="perPage=3&sort=price_asc"
          value={form.query}
          aria-invalid={errors.query !== null}
          aria-describedby="api-lab-query-hint"
          onChange={(event) => onChange({ query: event.target.value })}
        />
        <p className="field-hint" id="api-lab-query-hint">
          Raw query parameters, exactly as they appear in the URL. Encode spaces as %20.
        </p>
        {errors.query !== null ? <p className="report-field-error">{errors.query}</p> : null}
        {!queryHint.ok && form.query.length > 0 && errors.query === null ? (
          <p className="report-field-error">{queryHint.error}</p>
        ) : null}
      </div>

      <fieldset className="api-lab-headers">
        <legend>Headers</legend>
        <p className="field-hint">
          Optional request headers. Newlines are not allowed; names follow RFC 7230 token rules.
        </p>
        <ul className="api-lab-header-list">
          {form.headers.map((row) => (
            <li key={row.id} className="api-lab-header-row">
              <div className="report-field">
                <label htmlFor={`header-name-${row.id}`} className="sr-only">
                  Header name
                </label>
                <input
                  id={`header-name-${row.id}`}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="X-Header-Name"
                  value={row.name}
                  aria-invalid={errors.headerIssues[row.id] !== undefined}
                  onChange={(event) => onHeaderChange(row.id, { name: event.target.value })}
                />
              </div>
              <div className="report-field">
                <label htmlFor={`header-value-${row.id}`} className="sr-only">
                  Header value
                </label>
                <input
                  id={`header-value-${row.id}`}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="value"
                  value={row.value}
                  aria-invalid={errors.headerIssues[row.id] !== undefined}
                  onChange={(event) => onHeaderChange(row.id, { value: event.target.value })}
                />
              </div>
              <button
                type="button"
                className="icon-button api-lab-header-remove"
                aria-label="Remove header row"
                onClick={() => onHeaderRemove(row.id)}
              >
                <Icon name="close" size={16} />
              </button>
              {errors.headerIssues[row.id] ? (
                <p className="report-field-error api-lab-header-error">{errors.headerIssues[row.id]}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="button-row">
          <button type="button" className="button button-secondary button-small" onClick={onHeaderAdd}>
            Add header
          </button>
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={onAddContentTypeHeader}
          >
            Content-Type: application/json
          </button>
        </div>
      </fieldset>

      <div className="report-field">
        <label htmlFor="api-lab-body">
          Body{' '}
          {allowsBody ? (
            <span className="field-optional">(optional JSON)</span>
          ) : (
            <span className="field-optional">(not sent for {form.method})</span>
          )}
        </label>
        <textarea
          id="api-lab-body"
          rows={5}
          spellCheck={false}
          placeholder={'{\n  "slug": "canvas-tote-bag",\n  "quantity": 1\n}'}
          value={form.body}
          disabled={!allowsBody}
          onChange={(event) => onChange({ body: event.target.value })}
        />
        {allowsBody ? (
          <p className="field-hint">
            JSON is sent verbatim. Add a Content-Type: application/json header if you want one — the
            lab API parses JSON regardless.
          </p>
        ) : null}
      </div>

      <div className="button-row">
        <button type="submit" className="button" disabled={sending} aria-busy={sending || undefined}>
          {sending ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </form>
  )
}
