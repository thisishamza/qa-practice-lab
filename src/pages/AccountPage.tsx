import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadingState, EmptyState, ErrorState } from '../components/ui/States'
import { Callout } from '../components/ui/Callout'
import { Button } from '../components/ui/Button'
import { Tag } from '../components/ui/Tag'
import { FactList } from '../components/ui/FactList'
import { Icon } from '../components/ui/Icon'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useState } from 'react'

function memberSinceLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function AccountPage() {
  useDocumentTitle('Account')
  const { loadState, customer, suspended, refresh, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="stack">
      <Breadcrumbs
        items={[{ label: 'Dashboard', to: '/' }, { label: 'Account' }]}
      />

      <PageHeader
        eyebrow="Meridian Outfitters"
        title="Account"
        description="Your synthetic customer profile. Everything here is fictional training data — no real identity, address or order exists."
        actions={
          customer ? (
            <Button
              variant="secondary"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              <Icon name="logout" size={16} />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          ) : undefined
        }
      />

      <p className="catalogue-availability">
        Synthetic account · fictional address · nothing leaves this training app
      </p>

      {loadState.status === 'loading' ? <LoadingState label="Checking your session…" /> : null}

      {loadState.status === 'error' ? (
        <ErrorState
          title="Your account could not be loaded"
          description={`${loadState.message} Check that the practice API is running, then try again.`}
          action={
            <Button size="sm" onClick={refresh}>
              <Icon name="reset" size={15} />
              Try again
            </Button>
          }
        />
      ) : null}

      {loadState.status === 'ready' && suspended ? (
        <Callout tone="warning" title="This training account is suspended">
          Your session is signed in, but the synthetic account was suspended — every protected
          customer resource will refuse it. Sign out below and choose an active demo account
          instead.
          <span className="button-row" style={{ marginTop: '0.5rem' }}>
            <Button variant="secondary" disabled={signingOut} onClick={() => void handleSignOut()}>
              <Icon name="logout" size={16} />
              Sign out
            </Button>
          </span>
        </Callout>
      ) : null}

      {loadState.status === 'ready' && !suspended && !customer ? (
        <EmptyState
          title="You’re browsing as a guest"
          description="Guests can browse the shop, fill the cart and complete a practice checkout without an account. Sign in with a fictional demo account to see a customer profile and order history."
          icon="user"
          action={
            <Link className="button button-small" to="/login">
              <Icon name="lock" size={15} />
              Sign in with a demo account
            </Link>
          }
        />
      ) : null}

      {loadState.status === 'ready' && customer ? (
        <>
          <div className="account-grid">
            <section className="account-card" aria-labelledby="account-profile-heading">
              <h2 id="account-profile-heading" className="demo-accounts-title">
                Profile
              </h2>
              <FactList
                items={[
                  { label: 'Name', value: customer.name },
                  { label: 'Email', value: customer.email },
                  {
                    label: 'Role',
                    value: customer.role === 'staff' ? 'Staff (synthetic)' : 'Customer',
                  },
                  {
                    label: 'Status',
                    value: (
                      <Tag tone={customer.status === 'active' ? 'ready' : 'warn'}>
                        {customer.status === 'active' ? 'Active' : 'Suspended'}
                      </Tag>
                    ),
                  },
                  { label: 'Member since', value: memberSinceLabel(customer.memberSince) },
                ]}
              />
            </section>

            <section className="account-card" aria-labelledby="account-address-heading">
              <h2 id="account-address-heading" className="demo-accounts-title">
                Synthetic address
              </h2>
              <p className="account-address">
                {customer.name}
                <br />
                {customer.addressLine}
                <br />
                {customer.addressCity} {customer.addressPostcode}
              </p>
              <p className="demo-accounts-hint">
                Invented for this fictional storefront. Never a real address.
              </p>
            </section>
          </div>

          <div className="button-row">
            <Link className="button" to="/account/orders">
              <Icon name="clock" size={16} />
              View order history
            </Link>
            <Link className="button button-secondary" to="/shop">
              <Icon name="shop" size={16} />
              Continue shopping
            </Link>
          </div>
        </>
      ) : null}
    </div>
  )
}
