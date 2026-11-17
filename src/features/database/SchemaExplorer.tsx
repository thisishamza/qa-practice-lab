import { useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import type { SchemaInfo, SchemaTable } from '../../shared/sql'

interface SchemaExplorerProps {
  schema: SchemaInfo | null
  loading: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
}

function TableSection({ table }: { table: SchemaTable }) {
  const [open, setOpen] = useState(false)
  const pkColumns = table.columns.filter((column) => column.primaryKey).map((c) => c.name)

  return (
    <div className="schema-table">
      <button
        type="button"
        className="schema-table-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} className="schema-table-icon" />
        <span className="schema-table-name">{table.name}</span>
        <span className="schema-table-meta">{table.columns.length} cols{pkColumns.length > 0 ? ` · PK ${pkColumns.join(', ')}` : ''}</span>
      </button>
      {open && (
        <div className="schema-table-body">
          <table className="schema-column-table" aria-label={`${table.name} columns`}>
            <thead>
              <tr><th scope="col">Column</th><th scope="col">Type</th><th scope="col">Null</th><th scope="col">Key</th></tr>
            </thead>
            <tbody>
              {table.columns.map((column) => (
                <tr key={column.name}>
                  <td className="schema-col-name">{column.name}</td>
                  <td className="schema-col-type">{column.type || '—'}</td>
                  <td>{column.notNull ? 'NOT NULL' : 'NULL'}</td>
                  <td>
                    {column.primaryKey ? <span className="schema-badge schema-badge-pk">PK</span> : null}
                    {column.defaultValue !== null ? <span className="schema-badge schema-badge-default" title={`DEFAULT ${column.defaultValue}`}>def</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {table.indexes.length > 0 && (
            <div className="schema-group">
              <p className="schema-group-title">Indexes</p>
              <ul className="schema-list">
                {table.indexes.map((index) => (
                  <li key={index.name} className="schema-list-item">
                    <code>{index.name}</code>
                    <span className="schema-list-detail">
                      ({index.columns.join(', ')}){index.unique ? ' · UNIQUE' : ''}{index.partial ? ' · partial' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {table.foreignKeys.length > 0 && (
            <div className="schema-group">
              <p className="schema-group-title">Foreign keys</p>
              <ul className="schema-list">
                {table.foreignKeys.map((fk, index) => (
                  <li key={index} className="schema-list-item">
                    <code>{fk.from}</code>
                    <span className="schema-list-detail">→ {fk.table}.{fk.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {table.constraints.length > 0 && (
            <div className="schema-group">
              <p className="schema-group-title">Constraints</p>
              <ul className="schema-list">
                {table.constraints.map((constraint, index) => (
                  <li key={index} className="schema-list-item">
                    <span className="schema-badge">{constraint.kind}</span>
                    <code className="schema-check-text">{constraint.detail}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="schema-ddl">
            <summary>View DDL</summary>
            <pre>{table.ddl}</pre>
          </details>
        </div>
      )}
    </div>
  )
}

/**
 * Schema explorer for the playground. Table list with collapsible detail:
 * columns (PK / NOT NULL / defaults), indexes, foreign keys, constraints and
 * the table DDL. Data comes from the worker's `schema` response.
 */
export function SchemaExplorer({ schema, loading, collapsed, onToggleCollapsed }: SchemaExplorerProps) {
  return (
    <aside className="workspace-panel sql-explorer-panel" aria-labelledby="sql-explorer-title">
      <div className="workspace-head">
        <h2 id="sql-explorer-title" className="workspace-title">Schema explorer</h2>
        <div className="sql-explorer-actions">
          <span className="workspace-status workspace-status-ok sql-explorer-count">
            {schema ? `${schema.tables.length} tables` : '—'}
          </span>
          <button
            type="button"
            className="button button-ghost button-small"
            aria-expanded={!collapsed}
            aria-controls="sql-explorer-body"
            onClick={onToggleCollapsed}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div id="sql-explorer-body" className="sql-explorer-body">
          {loading && <p className="sql-status" role="status">Reading the schema…</p>}
          {!loading && !schema && (
            <p className="sql-status" role="status">The schema is not loaded yet.</p>
          )}
          {schema && (
            <div className="schema-table-list">
              <p className="schema-version-line">sqlite {schema.sqliteVersion} · in-memory snapshot</p>
              {schema.tables.map((table) => (
                <TableSection key={table.name} table={table} />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
