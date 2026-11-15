import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { fetchAccounts } from '../features/auth/api'
import type { DemoAccount } from '../shared/commerce'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadingState, ErrorState } from '../components/ui/States'
import { Callout } from '../components/ui/Callout'
import { Button } from '../components/ui/Button'
import { Tag } from '../components/ui/Tag'
import { Icon } from '../components/ui/Icon'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const fieldIds = { email: 'login-email', password: 'login-password' } as const

function initialErrors(): Record<string, string> {
  return {}
}

export function LoginPage() {
  useDocumentTitle('Sign in')
  const navigate = useNavigate()
  const { loadState, customer, signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<ReactNode>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [accountsAttempt, setAccountsAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchAccounts(controller.signal)
      .then((data) => {
        setAccounts(data)
        setAccountsError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setAccountsError(
          error instanceof Error ? error.message : 'The demo accounts could not be loaded.',
        )
      })
    return () => controller.abort()
  }, [accountsAttempt])

  function validate(): Record<string, string> {
    const found: Record<string, string> = {}
    if (!EMAIL_PATTERN.test(email.trim())) {
      found.email = 'Enter the email address of a demo account.'
    }
    if (password.length === 0) {
      found.password = 'Enter the password for the demo account.'
    }
    return found
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setNotice(null)
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }

    setBusy(true)
    setNotice(null)
    const outcome = await signIn(email.trim().toLowerCase(), password)
    setBusy(false)

    if (outcome.ok) {
      navigate('/account', { replace: true })
      return
    }
    if (outcome.suspended) {
      setNotice(
        <Callout tone="warning" title="That training account is suspended">
          {outcome.message} Try one of the active demo accounts on the right.
        </Callout>,
      )
      return
    }
    setNotice(
      <Callout tone="danger" title="Sign-in failed">
        {outcome.message}
      </Callout>,
    )
  }

  function fillEmail(nextEmail: string) {
    setEmail(nextEmail)
    setErrors((prev) => {
      const copy = { ...prev }
      delete copy.email
      return copy
    })
    passwordRef.current?.focus()
  }

  const signedIn = customer !== null
  const errorSummaryVisible = Object.keys(errors).length > 0

  return (
    <div className="stack">
      <Breadcrumbs
        items={[{ label: 'Dashboard', to: '/' }, { label: 'Sign in' }]}
      />

      <PageHeader
        eyebrow="Meridian Outfitters"
        title="Sign in"
        description="Practice the customer sign-in flow with synthetic accounts. This is a fictional training environment — authentication here checks a training fixture, never a real identity."
      />

      <p className="catalogue-availability">
        Fictional training accounts · synthetic data only · no real identity checks
      </p>

      {loadState.status === 'loading' ? (
        <LoadingState label="Checking your session…" />
      ) : null}

      {loadState.status === 'error' ? (
        <ErrorState
          title="Your account status could not be checked"
          description={loadState.message}
        />
      ) : null}

      {loadState.status === 'ready' && signedIn ? (
        <Callout tone="info" title="You are already signed in">
          You are signed in as <strong>{customer?.name}</strong> ({customer?.email}).{' '}
          <Link to="/account">Go to your account</Link> or sign out there first.
        </Callout>
      ) : null}

      {loadState.status === 'ready' && !signedIn ? (
        <div className="cart-layout">
          <form
            className="checkout-form"
            noValidate
            aria-label="Sign in form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <fieldset className="checkout-fieldset">
              <legend className="checkout-legend">Sign in</legend>
              <p className="checkout-hint">
                Use one of the fictional demo accounts. Passwords are documented in the project
                README (training-only) and must never be used for any real service.
              </p>

              {notice ? <div role="alert">{notice}</div> : null}

              {errorSummaryVisible ? (
                <div
                  className="checkout-error-summary"
                  role="alert"
                  tabIndex={-1}
                  ref={summaryRef}
                  aria-labelledby="login-error-title"
                >
                  <h2 id="login-error-title">There is a problem</h2>
                  <ul>
                    {errors.email ? (
                      <li>
                        <a href={`#${fieldIds.email}`}>{errors.email}</a>
                      </li>
                    ) : null}
                    {errors.password ? (
                      <li>
                        <a href={`#${fieldIds.password}`}>{errors.password}</a>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <div className="checkout-field">
                <label htmlFor={fieldIds.email}>Email</label>
                <input
                  id={fieldIds.email}
                  ref={emailRef}
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setErrors((prev) => {
                      if (!prev.email) return prev
                      const copy = { ...prev }
                      delete copy.email
                      return copy
                    })
                  }}
                  aria-invalid={errors.email ? 'true' : undefined}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                />
                {errors.email ? (
                  <p className="checkout-field-error" id="login-email-error">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="checkout-field">
                <label htmlFor={fieldIds.password}>Password</label>
                <input
                  id={fieldIds.password}
                  ref={passwordRef}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setErrors((prev) => {
                      if (!prev.password) return prev
                      const copy = { ...prev }
                      delete copy.password
                      return copy
                    })
                  }}
                  aria-invalid={errors.password ? 'true' : undefined}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
                {errors.password ? (
                  <p className="checkout-field-error" id="login-password-error">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <Button type="submit" disabled={busy}>
                <Icon name="lock" size={16} />
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </fieldset>
          </form>

          <aside className="demo-accounts" aria-label="Demo accounts">
            <h2 className="demo-accounts-title">Demo accounts</h2>
            <p className="demo-accounts-hint">
              Fictional accounts for practising sign-in, session handling and access control. No
              real people, addresses or credentials exist here.
            </p>

            {accountsError ? (
              <p className="demo-accounts-error" role="alert">
                {accountsError}{' '}
                <button
                  type="button"
                  className="demo-accounts-retry"
                  onClick={() => setAccountsAttempt((value) => value + 1)}
                >
                  Try again
                </button>
              </p>
            ) : null}

            {!accounts && !accountsError ? (
              <p className="demo-accounts-hint">Loading demo accounts…</p>
            ) : null}

            <ul className="demo-account-list">
              {accounts?.map((account) => (
                <li key={account.email} className="demo-account">
                  <div className="demo-account-main">
                    <span className="demo-account-name">{account.name}</span>
                    <span className="demo-account-email">{account.email}</span>
                  </div>
                  <div className="demo-account-meta">
                    <Tag tone={account.role === 'staff' ? 'in-design' : 'neutral'}>
                      {account.role === 'staff' ? 'Staff' : 'Customer'}
                    </Tag>
                    {account.status === 'suspended' ? (
                      <Tag tone="warn">Suspended</Tag>
                    ) : (
                      <Tag tone="ready">Active</Tag>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => fillEmail(account.email)}>
                    Use this email
                  </Button>
                </li>
              ))}
            </ul>
            <p className="demo-accounts-hint">
              Passwords are listed in the project README under “Training-only synthetic login
              credentials”. A suspended account is expected to be refused — that is part of the
              practice exercise.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
