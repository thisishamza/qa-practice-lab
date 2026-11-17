// Slim, contextual indicator of the current Practice App mode (P3-M7).
// Rendered only on the Meridian commerce surfaces (storefront, cart,
// checkout, orders, shop-side account/admin/login) where the mode actually
// changes behaviour; QA labs elsewhere never show it. Semantics:
// role="status" so mode changes are announced politely; never colour alone —
// icon + text + label always.

import { Link } from 'react-router-dom'
import { usePracticeSession } from './usePracticeSession'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'

export function ModeBanner() {
  const { loadState, mode, hunt, busy, actionError, refresh, resetSession } =
    usePracticeSession()

  if (loadState.status === 'loading') {
    // Reserved space to avoid a layout jump once the session resolves.
    return <div className="mode-banner mode-banner-loading" aria-hidden="true" />
  }

  if (loadState.status === 'error') {
    return (
      <div className="mode-banner mode-banner-error" role="status">
        <Icon name="alert" size={16} />
        <span className="mode-banner-text">
          Practice mode unavailable — {loadState.message}
        </span>
        <Button variant="ghost" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    )
  }

  if (mode === 'bug_hunt' && hunt) {
    return (
      <div className="mode-banner mode-banner-hunt" role="status">
        <Icon name="bug" size={16} />
        <span className="mode-banner-text">
          <strong>Bug-hunt mode</strong> — {hunt.title}. Deliberate defects are
          enabled — find and report unexpected behaviour.
          {hunt.id.startsWith('hunt-contract-')
            ? ' The provider is intentionally deviating; the behaviour is not the spec right now.'
            : null}
        </span>
        <Button
          variant="ghost"
          size="sm"
          loading={busy === 'reset'}
          onClick={() => void resetSession()}
        >
          Reset to clean
        </Button>
        {actionError ? (
          <span className="mode-banner-error-text" role="alert">
            {actionError}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mode-banner mode-banner-clean" role="status">
      <Icon name="check" size={16} />
      <span className="mode-banner-text">
        <strong>Clean mode</strong> — shop normally. The commerce app behaves as
        specified; no deliberate defects are enabled.
      </span>
      <Link className="mode-banner-link" to="/practice">
        Hunt controls
        <Icon name="arrow-right" size={16} />
      </Link>
    </div>
  )
}
