// Practice API token helper for the API Lab (P5-M2).
//
// Lets a signed-in synthetic customer mint a short-lived practice API
// token via POST /api/v1/auth/token and use it as an Authorization: Bearer
// header on subsequent console requests. Security posture:
//   - The raw token is held in this component's state only. It is never
//     written to localStorage, sessionStorage, the URL, request history or
//     the console log, and it disappears with a refresh — the UI says so.
//   - The token is shown exactly once (the 201 response); after that only
//     the header row carries it, for as long as the learner keeps it.
//   - "Use as Bearer header" is an explicit learner action; nothing is
//     attached automatically, and nothing ever leaves this origin.
//   - "Clear token" drops the in-memory token AND the Authorization row.
//   - The password is cleared from state after a successful mint.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import type { ApiTokenResponse } from '../../shared/commerce'

const TTL_OPTIONS = [15, 30, 60, 120, 300, 600, 900] as const
const DEFAULT_TTL = 900

export function TokenHelper({
  onApplyBearer,
  onClearBearer,
}: {
  /** Sets (or replaces) the console's Authorization header with the Bearer value. */
  onApplyBearer: (value: string) => void
  /** Removes every header row whose value exactly matches the given one. */
  onClearBearer: (exactValue: string) => void
}) {
  const { loadState, customer, suspended } = useAuth()
  const [password, setPassword] = useState('')
  const [ttl, setTtl] = useState<number>(DEFAULT_TTL)
  const [minting, setMinting] = useState(false)
  const [minted, setMinted] = useState<ApiTokenResponse | null>(null)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function clearToken() {
    if (minted) {
      onClearBearer(`Bearer ${minted.token}`)
    }
    setMinted(null)
    setApplied(false)
    setError(null)
    setCopied(false)
    setPassword('')
  }

  async function handleMint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!customer || minting) {
      return
    }
    setMinting(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/auth/token', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ email: customer.email, password, expiresInSeconds: ttl }),
      })
      if (!response.ok) {
        if (response.status === 401) {
          setError('The email address or password is not correct.')
        } else if (response.status === 403) {
          setError('This synthetic training account is suspended and cannot mint tokens.')
        } else if (response.status === 429) {
          setError('Too many failed sign-ins from this network. Wait a minute and try again.')
        } else if (response.status === 400) {
          setError('Provide the synthetic account password and a TTL between 15 and 900 seconds.')
        } else {
          setError('The token could not be minted. Try again.')
        }
        return
      }
      const body = (await response.json()) as ApiTokenResponse
      setMinted(body)
      setPassword('')
      setApplied(false)
      setCopied(false)
    } catch {
      setError('The token request failed before any response arrived. Check the API is running and try again.')
    } finally {
      setMinting(false)
    }
  }

  async function copyToken() {
    if (!minted) {
      return
    }
    try {
      await navigator.clipboard.writeText(minted.token)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="api-token-helper" aria-labelledby="api-token-helper-heading">
      <div className="api-token-helper-head">
        <h2 id="api-token-helper-heading">Practice API token</h2>
        <p className="api-token-helper-note">
          Synthetic and short-lived (15–900 seconds). The token is shown once and is never saved —
          refreshing the page clears it.
        </p>
      </div>

      {loadState.status === 'loading' ? (
        <p className="api-token-helper-note">Checking your session…</p>
      ) : null}

      {loadState.status !== 'loading' && (!customer || suspended) ? (
        <p className="api-token-helper-note">
          {suspended
            ? 'This synthetic account is suspended, so it cannot mint tokens. Sign out and sign in with an active demo account.'
            : 'Sign in as a synthetic demo account to mint a practice API token.'}{' '}
          {!suspended ? <Link to="/login">Go to sign in</Link> : null}
        </p>
      ) : null}

      {loadState.status !== 'loading' && customer && !suspended && !minted ? (
        <form className="api-token-helper-form" onSubmit={handleMint} noValidate={false}>
          <div className="api-token-helper-fields">
            <div className="report-field">
              <label htmlFor="api-token-email">Account</label>
              <input id="api-token-email" type="email" value={customer.email} readOnly disabled />
            </div>
            <div className="report-field">
              <label htmlFor="api-token-password">Password</label>
              <input
                id="api-token-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="api-token-password-hint"
                required
              />
              <p className="field-hint" id="api-token-password-hint">
                The synthetic demo password — the same one you use to sign in.
              </p>
            </div>
            <div className="report-field">
              <label htmlFor="api-token-ttl">Lifetime (seconds)</label>
              <select
                id="api-token-ttl"
                value={ttl}
                onChange={(event) => setTtl(Number(event.target.value))}
              >
                {TTL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? (
            <p className="report-field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="button-row">
            <button type="submit" className="button button-secondary button-small" disabled={minting} aria-busy={minting || undefined}>
              {minting ? 'Minting…' : 'Mint practice API token'}
            </button>
          </div>
        </form>
      ) : null}

      {minted ? (
        <div className="api-token-helper-minted">
          <p className="api-token-helper-note" id="api-token-once-note">
            Your token is shown <strong>once</strong> and is never saved anywhere. It expires{' '}
            {minted.expiresIn} seconds after minting ({minted.expiresAt}). Refreshing the page or
            clearing the token drops it permanently.
          </p>
          <div className="api-token-helper-value-row">
            <code className="api-token-value" aria-label="Practice API token (shown once)">
              {minted.token}
            </code>
            <div className="button-row">
              <button type="button" className="button button-ghost button-small" onClick={copyToken}>
                {copied ? 'Copied' : 'Copy token'}
              </button>
              <button
                type="button"
                className="button button-secondary button-small"
                aria-pressed={applied}
                onClick={() => {
                  if (applied) {
                    onClearBearer(`Bearer ${minted.token}`)
                    setApplied(false)
                  } else {
                    onApplyBearer(`Bearer ${minted.token}`)
                    setApplied(true)
                  }
                }}
              >
                {applied ? 'Remove Bearer header' : 'Use as Bearer header'}
              </button>
              <button type="button" className="button button-ghost button-small" onClick={clearToken}>
                Clear token
              </button>
            </div>
          </div>
          <p className="api-token-helper-note">
            The Bearer header is attached only to requests from this console, only to this origin’s
            /api/v1 endpoints, and only while this page keeps it. “Copy as curl” includes the header
            — treat the command as secret until the token expires.
          </p>
        </div>
      ) : null}
    </section>
  )
}
