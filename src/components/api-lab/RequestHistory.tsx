// Request history for the API Lab: the last 10 exchanges, held in component
// state only. Nothing is written to localStorage, sessionStorage or
// cookies; the list clears on refresh by design.
import { formatElapsed, type HistoryEntry } from '../../lib/api-lab'

export function RequestHistory({
  entries,
  onReplay,
  onClear,
}: {
  entries: HistoryEntry[]
  onReplay: (entry: HistoryEntry) => void
  onClear: () => void
}) {
  if (entries.length === 0) {
    return (
      <section className="api-history" aria-labelledby="api-history-heading">
        <div className="api-history-head">
          <h2 id="api-history-heading">History</h2>
        </div>
        <p className="api-history-empty">
          Requests you send appear here — the 10 most recent only. History lives in this page and
          is cleared when you refresh; it is never saved anywhere.
        </p>
      </section>
    )
  }

  return (
    <section className="api-history" aria-labelledby="api-history-heading">
      <div className="api-history-head">
        <h2 id="api-history-heading">History</h2>
        <button type="button" className="button button-ghost button-small" onClick={onClear}>
          Clear history
        </button>
      </div>
      <p className="api-history-note">Kept in this page only — cleared on refresh, never saved.</p>
      <ol className="api-history-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="api-history-entry"
              onClick={() => onReplay(entry)}
              title="Load this request back into the form"
            >
              <span className={`method-chip method-${entry.method.toLowerCase()}`}>
                {entry.method}
              </span>
              <span className="api-history-target">{entry.target}</span>
              <span className="api-history-meta">
                <span className="status-chip status-info">{entry.status}</span>
                {formatElapsed(entry.elapsedMs)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
