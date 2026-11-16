import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { Icon } from '../components/ui/Icon'
import { SqlEditor } from '../components/ui/SqlEditor'
import { ResultsTable, type RunOutcomeState } from '../features/database/ResultsTable'
import { SchemaExplorer } from '../features/database/SchemaExplorer'
import { SampleQueries } from '../features/database/SampleQueries'
import { SqlClient } from '../lib/sql/client'
import { fetchSeedSql, SEED_URL } from '../lib/sql/seed'
import { classify } from '../lib/sql/classify'
import { serializeResultSets, totalRowsCopied, type CopyMode } from '../lib/copy'
import { SQL_LIMITS, type SchemaInfo, type SqlRunOutput } from '../shared/sql'

const DEFAULT_SQL = `-- A first query against the Meridian Outfitters snapshot.
SELECT name, price_cents / 100.0 AS price
FROM products
WHERE category_id = 1 AND active = 1
ORDER BY price_cents DESC
LIMIT 5;`

type SeedState = 'loading' | 'ready' | 'error'
type MobileTab = 'editor' | 'results' | 'schema'

/**
 * Phase 6 M1 playground — isolated SQLite/WASM against the synthetic
 * Meridian Outfitters snapshot. Learner SQL executes only inside a Web
 * Worker; results never leave this page.
 */
export function DatabasePlaygroundPage() {
  useDocumentTitle('SQL playground')

  const [seedState, setSeedState] = useState<SeedState>('loading')
  const [seedError, setSeedError] = useState<string | null>(null)
  const [schema, setSchema] = useState<SchemaInfo | null>(null)
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [output, setOutput] = useState<SqlRunOutput | null>(null)
  const [outcome, setOutcome] = useState<RunOutcomeState>('idle')
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor')
  const [notice, setNotice] = useState<string | null>(null)
  const clientRef = useRef<SqlClient | null>(null)
  const seedRef = useRef<string | null>(null)

  // Kick off a load against a fresh client. Shared by the mount effect and
  // the Retry button; setState happens only in promise callbacks.
  const startLoad = useCallback(() => {
    const client = new SqlClient()
    clientRef.current?.dispose()
    clientRef.current = client
    return fetchSeedSql().then((seed) => {
      seedRef.current = seed
      return client.reset(seed)
    })
  }, [])

  const handleLoadFailure = useCallback((err: unknown) => {
    seedRef.current = null
    clientRef.current?.dispose()
    clientRef.current = null
    setSchema(null)
    setSeedError(err instanceof Error ? err.message : 'The practice dataset failed to load.')
    setSeedState('error')
  }, [])

  const retryLoad = useCallback(() => {
    setSeedState('loading')
    setSeedError(null)
    startLoad()
      .then((loaded) => {
        setSchema(loaded)
        setSeedState('ready')
      })
      .catch(handleLoadFailure)
  }, [startLoad, handleLoadFailure])

  useEffect(() => {
    let cancelled = false
    startLoad()
      .then((loaded) => {
        if (cancelled) return
        setSchema(loaded)
        setSeedState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        handleLoadFailure(err)
      })
    return () => {
      cancelled = true
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [startLoad, handleLoadFailure])

  const run = useCallback(async () => {
    const client = clientRef.current
    if (!client || outcome === 'running') return
    const text = sql.trim()
    if (text.length === 0) {
      setNotice('Write a query first.')
      return
    }
    const classification = classify(sql)
    if (!classification.ok) {
      setOutput({
        ok: false,
        resultSets: [],
        elapsedMs: 0,
        error: { statementIndex: -1, message: classification.issues.join(' ') },
      })
      setOutcome('failed')
      return
    }
    setNotice(null)
    setOutcome('running')
    try {
      const outcomeResult = await client.run(sql)
      if (outcomeResult.kind === 'timeout') {
        setOutput(null)
        setOutcome('timeout')
        setNotice('The database was reset to the original practice snapshot.')
        try {
          setSchema(await client.schema())
        } catch {
          // Schema refresh is best-effort after a hard reset.
        }
        return
      }
      setOutput(outcomeResult.output)
      setOutcome(outcomeResult.output.ok ? 'done' : 'failed')
      try {
        setSchema(await client.schema())
      } catch {
        // Schema refresh is best-effort; the next successful run refreshes it.
      }
    } catch (err) {
      setOutput({
        ok: false,
        resultSets: [],
        elapsedMs: 0,
        error: { statementIndex: -1, message: err instanceof Error ? err.message : 'The query failed.' },
      })
      setOutcome('failed')
    }
  }, [outcome, sql])

  const resetDatabase = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    setOutcome('running')
    try {
      // Worker recreation happens inside reset(); memory from prior state is dropped.
      const seed = seedRef.current ?? (await fetchSeedSql())
      seedRef.current = seed
      const loaded = await client.reset(seed)
      setSchema(loaded)
      setOutput(null)
      setOutcome('idle')
      setNotice('Database reset — the original practice snapshot is restored.')
    } catch (err) {
      setSeedState('error')
      setSeedError(err instanceof Error ? err.message : 'The database failed to reset.')
    }
  }, [])

  const clearResults = useCallback(() => {
    setOutput(null)
    setOutcome('idle')
    setNotice('Results cleared. Your SQL is unchanged.')
  }, [])

  const clearEditor = useCallback(() => {
    if (sql.trim().length > 0 && !window.confirm('Clear the SQL editor?')) return
    setSql('')
    setNotice(null)
  }, [sql])

  const copyResults = useCallback(
    async (mode: CopyMode) => {
      if (!output) return
      const sets = output.resultSets
      const text = serializeResultSets(sets, mode)
      try {
        await navigator.clipboard.writeText(text)
        setNotice(`Copied ${totalRowsCopied(sets)} row${totalRowsCopied(sets) === 1 ? '' : 's'} as ${mode.toUpperCase()}.`)
      } catch {
        setNotice('Copy failed — select the table and copy it manually.')
      }
    },
    [output],
  )

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Database Testing', to: '/database' },
          { label: 'Playground' },
        ]}
      />

      <PageHeader
        eyebrow="Practice · Database"
        title="SQL playground"
        description="An isolated SQLite database in this page — Meridian Outfitters, synthetic data, full freedom. Write SQL, inspect results, reset whenever you want. Nothing is sent to the server."
        actions={
          <Link className="button button-secondary" to="/database">
            <Icon name="database" size={16} />
            About this dataset
          </Link>
        }
      />

      <Callout tone="neutral" title="Why this cannot touch the real thing">
        Queries execute inside a Web Worker against an in-memory SQLite build — there is no connection
        from this page to the platform database, and no path for a query to leave it. The data is
        synthetic (Meridian Outfitters, fictional customers and payments). Reset re-creates the database
        from the frozen snapshot, and the 3-second limit kills runaway queries automatically.
      </Callout>

      <p id="sql-shortcuts" className="sql-shortcuts">
        <kbd>Ctrl/⌘ + Enter</kbd> Run · <kbd>Tab</kbd> indent · <kbd>Esc</kbd> leave the editor
      </p>

      {notice && (
        <p className="sql-notice" role="status">{notice}</p>
      )}

      {seedState === 'loading' && (
        <section className="workspace-panel sql-loading" aria-labelledby="sql-loading-title">
          <div className="workspace-head">
            <h2 id="sql-loading-title" className="workspace-title">Practice database</h2>
            <span className="workspace-status"><span className="workspace-dot" aria-hidden="true" />Loading</span>
          </div>
          <div className="workspace-body">
            <p className="workspace-line">Fetching the practice snapshot ({SEED_URL})…</p>
          </div>
        </section>
      )}

      {seedState === 'error' && (
        <Callout tone="danger" title="The practice dataset failed to load">
          {seedError ?? 'Unknown error.'} Check your connection, then{' '}
          <button type="button" className="button button-secondary button-small" onClick={retryLoad}>
            Retry
          </button>
        </Callout>
      )}

      {seedState === 'ready' && (
        <>
          <div className="sql-tabs" role="tablist" aria-label="Playground panels">
            {([
              ['editor', 'Editor'],
              ['results', 'Results'],
              ['schema', 'Schema'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                role="tab"
                id={`sql-tab-${tab}`}
                aria-selected={mobileTab === tab}
                aria-controls={`sql-pane-${tab}`}
                className={`sql-tab${mobileTab === tab ? ' sql-tab-active' : ''}`}
                onClick={() => setMobileTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="sql-workbench" data-tab={mobileTab}>
            <section
              className="workspace-panel sql-editor-panel"
              id="sql-pane-editor"
              role="tabpanel"
              aria-labelledby="sql-tab-editor"
              aria-label="SQL editor"
            >
              <div className="workspace-head">
                <h2 className="workspace-title">Query</h2>
                <span className="workspace-status sql-version">
                  sqlite {schema?.sqliteVersion ?? '…'} · in-memory
                </span>
              </div>
              <div className="sql-editor-body">
                <SqlEditor
                  id="playground-sql"
                  value={sql}
                  onChange={setSql}
                  onRun={() => void run()}
                  ariaDescribedBy="sql-shortcuts"
                  minHeight={220}
                />
                <div className="sql-editor-toolbar">
                  <button type="button" className="button" onClick={() => void run()} disabled={outcome === 'running'}>
                    Run query
                  </button>
                  <button type="button" className="button button-ghost" onClick={clearEditor} disabled={outcome === 'running'}>
                    Clear editor
                  </button>
                  <button type="button" className="button button-ghost" onClick={() => void resetDatabase()} disabled={outcome === 'running'}>
                    <Icon name="reset" size={16} />
                    Reset database
                  </button>
                </div>
              </div>
              <SampleQueries onInsert={(text) => { setSql(text); setNotice(null) }} disabled={outcome === 'running'} />
            </section>

            <div className="sql-pane-results" id="sql-pane-results" role="tabpanel" aria-labelledby="sql-tab-results">
              <ResultsTable
                output={output}
                outcome={outcome}
                onCopyTsv={() => void copyResults('tsv')}
                onCopyCsv={() => void copyResults('csv')}
                onClear={clearResults}
              />
            </div>

            <SchemaExplorer
              schema={schema}
              loading={outcome === 'running'}
              collapsed={explorerCollapsed}
              onToggleCollapsed={() => setExplorerCollapsed((value) => !value)}
            />
          </div>
        </>
      )}

      {outcome === 'idle' && seedState === 'ready' && (
        <p className="sql-limits-footnote">
          Limits: {SQL_LIMITS.maxRowsPerStatement.toLocaleString()} rows per statement ·{' '}
          {SQL_LIMITS.maxStatementsPerRun} statements per run · {Math.round(SQL_LIMITS.maxQueryLength / 1024)} KB query text ·{' '}
          {(SQL_LIMITS.maxResultBytes / 1_048_576).toFixed(0)} MB results · {SQL_LIMITS.runTimeoutMs / 1000}s per query.
          Reset always restores the original snapshot.
        </p>
      )}
    </div>
  )
}
