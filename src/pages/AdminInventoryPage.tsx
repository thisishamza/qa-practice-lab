// /admin/inventory — staff-only inventory tool for Meridian Outfitters.
//
// Authorization is enforced server-side on every /api/v1/admin/* call; this
// page only mirrors the outcome:
//   guest              → sign-in call to action (401 from the API)
//   signed-in customer → honest "staff required" state (403 staff_required)
//   staff              → the inventory manager
// Nothing here reveals staff data to non-staff users — the API answers 403
// before any row is returned.

import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { InventoryManager } from '../features/inventory/InventoryManager'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, LoadingState } from '../components/ui/States'
import { Icon } from '../components/ui/Icon'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function AdminInventoryPage() {
  useDocumentTitle('Inventory (staff)')
  const { loadState, customer, suspended } = useAuth()

  const signedIn = loadState.status === 'ready' && customer !== null
  const isStaff = signedIn && customer.role === 'staff' && customer.status === 'active'

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Practice App' },
          { label: 'Inventory (staff)' },
        ]}
      />

      <PageHeader
        eyebrow="Meridian Outfitters · Staff tools"
        title="Inventory"
        description="Current stock levels and restock controls for the fictional catalogue. Adjustments are atomic, validated and recorded in an immutable audit log."
      />

      <p className="catalogue-availability">
        Staff-only synthetic control · no real warehouse · every adjustment is audited
      </p>

      {loadState.status === 'loading' ? <LoadingState label="Checking your staff session…" /> : null}

      {loadState.status === 'error' ? (
        <EmptyState
          title="Your session could not be checked"
          description="The practice API did not answer. Check that it is running, then reload this page."
          icon="alert"
        />
      ) : null}

      {loadState.status === 'ready' && suspended ? (
        <EmptyState
          title="This account is suspended"
          description="The synthetic account you signed in with is suspended — the staff tool stays locked. Suspended demo accounts are an intended practice case; sign out and use another demo account."
          icon="lock"
          action={
            <Link className="button button-small" to="/login">
              <Icon name="lock" size={16} />
              Sign in with another demo account
            </Link>
          }
        />
      ) : null}

      {loadState.status === 'ready' && !signedIn && !suspended ? (
        <EmptyState
          title="Sign in with a staff account"
          description="The inventory tool is restricted to the synthetic staff account. Sign in with the staff fixture from the demo directory — ordinary customer accounts cannot restock."
          icon="lock"
          action={
            <Link className="button button-small" to="/login">
              <Icon name="lock" size={16} />
              Sign in with a demo account
            </Link>
          }
        />
      ) : null}

      {signedIn && !isStaff ? (
        <EmptyState
          title="Staff access required"
          description={`${customer.name} is signed in with a customer account, which cannot view or adjust inventory. Sign out and back in with the staff account to use this tool.`}
          icon="lock"
          action={
            <Link className="button button-small" to="/account">
              <Icon name="user" size={16} />
              Back to your account
            </Link>
          }
        />
      ) : null}

      {isStaff ? <InventoryManager /> : null}
    </div>
  )
}
