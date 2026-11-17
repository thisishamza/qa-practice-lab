import { Callout } from '../../components/ui/Callout'
import { Icon } from '../../components/ui/Icon'
import type { SqlCell, SqlResultSet, SqlRunOutput } from '../../shared/sql'

export type RunOutcomeState = 'idle' | 'running' | 'done' | 'timeout' | 'failed'

interface ResultsTableProps {
  output: SqlRunOutput | null
  outcome: RunOutcomeState
  onCopyTsv: () => void
  onCopyCsv: () => void
  onClear: () => void
}

function CellContent({ value }: { value: SqlCell }) {
  if (value === null) {
    return <span className="sql-null">NULL</span>
  }
  return <>{value}</>
}

function SetGrid({ set }: { set: SqlResultSet }) {
  if (set.columns.length === 0) {
    return (
      <p className="sql-dml-line">
        Statement {set.statementIndex + 1} — {set.changes ?? 0} row{set.changes === 1 ? '' : 's'} affected
        <span className="sql-dml-time"> · {set.elapsedMs} ms</span>
      </p>
    )
  }
  return (
    <div className="sql-results-scroll" tabIndex={0} role="region" aria-label={`Statement ${set.statementIndex + 1} results`}>
      <table className="sql-results-table">
        <thead>
          <tr>
            {set.columns.map((column, index) => (
              <th key={index} scope="col">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {set.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={typeof cell === 'number' ? 'sql-cell-num' : undefined}>
                  <CellContent value={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Results area for the playground. Renders every row-returning set in the
 * batch, the exact failing statement on error, the timeout state, and the
 * empty state. All values are rendered as text — nothing is ever injected.
 */
export function ResultsTable({ output, outcome, onCopyTsv, onCopyCsv, onClear }: ResultsTableProps) {
  const sets = output?.resultSets ?? []
  const totalRows = sets.reduce((acc, set) => acc + (set.columns.length > 0 ? set.rowCount : 0), 0)
  const truncations = sets.filter((set) => set.truncated).length
  const returnedNoRows =
    outcome === 'done' &&
    output?.ok === true &&
    sets.some((s) => s.columns.length > 0) &&
    sets.filter((s) => s.columns.length > 0).every((s) => s.rows.length === 0)

  return (
    <section className="workspace-panel sql-results-panel" aria-labelledby="sql-results-title">
      <div className="workspace-head">
        <h2 id="sql-results-title" className="workspace-title">Results</h2>
        <div className="sql-results-actions">
          <button type="button" className="button button-ghost button-small" onClick={onCopyTsv} disabled={sets.length === 0 || outcome === 'running'}>
            Copy TSV
          </button>
          <button type="button" className="button button-ghost button-small" onClick={onCopyCsv} disabled={sets.length === 0 || outcome === 'running'}>
            Copy CSV
          </button>
          <button type="button" className="button button-ghost button-small" onClick={onClear} disabled={sets.length === 0 && outcome !== 'failed' && outcome !== 'timeout'}>
            Clear
          </button>
        </div>
      </div>

      <div className="sql-results-body">
        {outcome === 'idle' && (
          <div className="sql-empty-state">
            <p className="sql-empty-title">Nothing has run yet</p>
            <p className="sql-empty-detail">
              Write a query and press <kbd>Run</kbd> (or <kbd>Ctrl/⌘ + Enter</kbd>). Results stay in this page —
              nothing is sent to the server, and Reset always restores the original practice snapshot.
            </p>
          </div>
        )}

        {outcome === 'running' && (
          <p className="sql-status" role="status">Running…</p>
        )}

        {outcome === 'timeout' && (
          <Callout tone="danger" title="Query exceeded the 3 second limit">
            The worker was terminated and the database was automatically reset to the original practice
            snapshot. Your SQL text is still in the editor — narrow the query (add WHERE/LIMIT, sample
            with <code>strftime</code>, or add an index inside the transaction) and try again.
          </Callout>
        )}

        {output?.error && (
          <>
            <Callout tone="danger" title="The query failed">
              <span role="alert">
                {output.error.statementIndex >= 0
                  ? `Statement ${output.error.statementIndex + 1} failed: `
                  : ''}
                {output.error.message}
              </span>
            </Callout>
            {sets.length > 0 && (
              <p className="sql-status sql-status-note">
                Statements before the failure completed — their results are shown below.
              </p>
            )}
          </>
        )}

        {outcome === 'done' && output?.ok && (
          <p className="sql-status" role="status">
            {`${totalRows} row${totalRows === 1 ? '' : 's'}`}
            {' · '}
            {output.elapsedMs} ms
            {truncations > 0 ? ` · truncated in ${truncations} statement${truncations === 1 ? '' : 's'} (1,000-row cap)` : ' · not truncated'}
          </p>
        )}

        {returnedNoRows && (
          <p className="sql-status" role="status">The query returned 0 rows.</p>
        )}

        {truncations > 0 && (
          <p className="sql-status sql-status-note">
            <Icon name="alert" size={16} className="sql-status-icon" />
            Result sets are capped at 1,000 rows per statement. Refine the query (WHERE, LIMIT) to see the rest.
          </p>
        )}

        {sets.map((set, index) => (
          <div key={index} className="sql-statement-result">
            {set.columns.length > 0 && (
              <p className="sql-statement-head">
                Statement {set.statementIndex + 1} · {set.rowCount} row{set.rowCount === 1 ? '' : 's'} · {set.elapsedMs} ms
                {set.truncated ? ' · truncated' : ''}
              </p>
            )}
            <SetGrid set={set} />
          </div>
        ))}
      </div>
    </section>
  )
}
