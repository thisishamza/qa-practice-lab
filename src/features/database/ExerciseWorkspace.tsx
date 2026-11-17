// Exercise workspace (Phase 6 M2) — the /database/exercises/:exerciseId page body.
//
// Reuses the M1 SQL engine (browser worker, 3 s budget, reseed on demand)
// and the Phase 4 learning chrome (hint ladder, gated reveal, attempt chip).
// "Check work" never sends learner SQL to the server — it compares the
// most recent sandbox result (or the exercise's post-state check query, for
// DML/transaction exercises) against the compiled server-side spec.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SqlExerciseDef } from '../../data/sqlExercises'
import { SqlEditor } from '../../components/ui/SqlEditor'
import { Callout } from '../../components/ui/Callout'
import { Icon } from '../../components/ui/Icon'
import { Tag } from '../../components/ui/Tag'
import { SqlClient } from '../../lib/sql/client'
import { fetchSeedSql, SEED_URL } from '../../lib/sql/seed'
import { classify } from '../../lib/sql/classify'
import { SQL_LIMITS, type SchemaInfo, type SqlRunOutput } from '../../shared/sql'
import { ResultsTable, type RunOutcomeState } from './ResultsTable'
import { SchemaExplorer } from './SchemaExplorer'
import { HintLadder } from '../practice/HintLadder'
import { RevealPanel } from '../practice/RevealPanel'
import { AttemptStatusChip } from '../practice/AttemptStatusChip'
import { fetchAttempt } from '../practice/api'
import { evaluateSql, startSqlExercise } from './api'
import { serializeResultSets, totalRowsCopied, type CopyMode } from '../../lib/copy'
import { PracticeApiError } from '../practice/api'
import type { AttemptView } from '../../shared/learning'
import type { SqlEvaluateResponse } from '../../shared/sql'

type SeedState = 'loading' | 'ready' | 'error'

function starterSql(exercise: SqlExerciseDef): string {
  return `-- ${exercise.title}\n-- Tables: ${exercise.tables.join(', ')}\n`
}

export function ExerciseWorkspace({ exercise }: { exercise: SqlExerciseDef }) {
  const [seedState, setSeedState] = useState<SeedState>('loading')
  const [seedError, setSeedError] = useState<string | null>(null)
  const [schema, setSchema] = useState<SchemaInfo | null>(null)
  const [sql, setSql] = useState(() => starterSql(exercise))
  const [output, setOutput] = useState<SqlRunOutput | null>(null)
  const [outcome, setOutcome] = useState<RunOutcomeState>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<AttemptView | null>(null)
  const [evaluation, setEvaluation] = useState<SqlEvaluateResponse | null>(null)
  const [checking, setChecking] = useState(false)
  const [revealNonce, setRevealNonce] = useState(0)
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const clientRef = useRef<SqlClient | null>(null)
  const seedRef = useRef<string | null>(null)

  const startLoad = useCallback(() => {
    const client = new SqlClient()
    clientRef.current?.dispose()
    clientRef.current = client
    return fetchSeedSql().then((seed) => {
      seedRef.current = seed
      return client.reset(seed).then(() => client)
    })
  }, [])

  const applySetup = useCallback(async (client: SqlClient) => {
    if (!exercise.setupSql) return
    const result = await client.run(exercise.setupSql)
    if (result.kind === 'timeout') {
      throw new Error('The exercise fixture took too long to load. Retry — it is a fixed, small script.')
    }
    if (!result.output.ok) {
      throw new Error('The exercise fixture failed to load. Retry; if it persists, report it on /practice.')
    }
  }, [exercise.setupSql])

  const retryLoad = useCallback(() => {
    setSeedState('loading')
    setSeedError(null)
    setOutput(null)
    setOutcome('idle')
    setEvaluation(null)
    setNotice(null)
    startLoad()
      .then(async (client) => {
        await applySetup(client)
        setSchema(await client.schema())
        setSeedState('ready')
        setNotice('Database reset — the exercise fixture is loaded.')
      })
      .catch((err: unknown) => {
        setSeedError(err instanceof Error ? err.message : 'The practice dataset failed to load.')
        setSeedState('error')
      })
  }, [startLoad, applySetup])

  useEffect(() => {
    let cancelled = false
    // Idempotent attempt creation — non-blocking; evaluation re-resolves it server-side.
    startSqlExercise(exercise.id)
      .then((view) => { if (!cancelled) setAttempt(view) })
      .catch(() => { /* shown as unavailable chip below */ })
    startLoad()
      .then(async (client) => {
        if (cancelled) return
        await applySetup(client)
        if (cancelled) return
        setSchema(await client.schema())
        setSeedState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSeedError(err instanceof Error ? err.message : 'The practice dataset failed to load.')
        setSeedState('error')
      })
    return () => {
      cancelled = true
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [startLoad, applySetup, exercise.id])

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
        setNotice('The database was reset to its exercise baseline.')
        try {
          setSchema(await client.schema())
        } catch {
          // best-effort schema refresh
        }
        return
      }
      setOutput(outcomeResult.output)
      setOutcome(outcomeResult.output.ok ? 'done' : 'failed')
      try {
        setSchema(await client.schema())
      } catch {
        // best-effort schema refresh
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
  }, [clientRef, outcome, sql])

  const resetDatabase = useCallback(() => {
    setNotice(null)
    setOutput(null)
    setOutcome('idle')
    setEvaluation(null)
    const client = clientRef.current
    if (!client) {
      retryLoad()
      return
    }
    setOutcome('running')
    void (async () => {
      try {
        const seed = seedRef.current ?? (await fetchSeedSql())
        seedRef.current = seed
        await client.reset(seed)
        await applySetup(client)
        setSchema(await client.schema())
        setOutput(null)
        setOutcome('idle')
        setNotice('Database reset — the exercise fixture is loaded.')
      } catch (err) {
        setSeedState('error')
        setSeedError(err instanceof Error ? err.message : 'The database failed to reset.')
      }
    })()
  }, [applySetup, retryLoad])

  const checkWork = useCallback(async () => {
    const client = clientRef.current
    if (!client || checking) return
    setNotice(null)
    setChecking(true)
    try {
      let columns: string[] | null = null
      let rows: (number | string | null)[][] = []
      let truncated = false
      if (exercise.checkSql) {
        const result = await client.run(exercise.checkSql)
        if (result.kind === 'timeout') {
          setNotice('The verification query exceeded the 3-second limit — simplify your workspace and try again.')
          return
        }
        const lastSet = result.output.resultSets[result.output.resultSets.length - 1]
        if (!result.output.ok || !lastSet || lastSet.columns.length === 0) {
          setNotice('The verification query failed — check your writes, then try again.')
          return
        }
        columns = lastSet.columns
        rows = lastSet.rows
        truncated = lastSet.truncated
      } else {
        const lastSet = output?.resultSets.filter((set) => set.columns.length > 0).at(-1)
        if (!output?.ok || !lastSet) {
          setNotice('Run a result-producing query first.')
          return
        }
        columns = lastSet.columns
        rows = lastSet.rows
        truncated = lastSet.truncated
      }
      if (!columns) return
      const response = await evaluateSql(exercise.id, { columns, rows, truncated })
      setEvaluation(response)
      // Refresh the attempt chip from the server (the stamp is server-side).
      fetchAttempt(exercise.id)
        .then(setAttempt)
        .catch(() => { /* chip keeps its previous value */ })
      setRevealNonce((n) => n + 1)
    } catch (err) {
      setNotice(
        err instanceof PracticeApiError
          ? err.message
          : 'The check could not be evaluated. Try again.',
      )
    } finally {
      setChecking(false)
    }
  }, [checking, exercise, output])

  const clearResults = useCallback(() => {
    setOutput(null)
    setOutcome('idle')
    setEvaluation(null)
    setNotice('Results cleared. Your SQL is unchanged.')
  }, [])

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
    <div className="exercise-layout">
      <aside className="workspace-panel exercise-instructions" aria-labelledby="exercise-instructions-title">
        <div className="workspace-head">
          <h2 id="exercise-instructions-title" className="workspace-title">Instructions</h2>
          <span className="workspace-status">
            <span className="workspace-dot" aria-hidden="true" />
            {exercise.difficulty}
          </span>
        </div>
        <div className="workspace-body">
          <p className="exercise-qa">{exercise.qaScenario}</p>
          {exercise.qaId ? (
            <Tag tone="warn" icon="bug">QA scenario · {exercise.qaId}</Tag>
          ) : null}
          <h3 className="exercise-subtitle">Learning objective</h3>
          <p className="exercise-line">{exercise.objective}</p>
          <h3 className="exercise-subtitle">Your task</h3>
          <p className="exercise-line">{exercise.task}</p>
          <h3 className="exercise-subtitle">Tables</h3>
          <div className="exercise-chip-row">
            {exercise.tables.map((table) => (
              <Tag key={table} tone="neutral">{table}</Tag>
            ))}
          </div>
          <h3 className="exercise-subtitle">Worth knowing</h3>
          <div className="exercise-chip-row">
            {exercise.relevantConstraints.map((chip) => (
              <Tag key={chip} tone="neutral">{chip}</Tag>
            ))}
          </div>
          <h3 className="exercise-subtitle">What good evidence looks like</h3>
          <p className="exercise-line exercise-evidence">{exercise.exampleEvidence}</p>
          {exercise.checkSql ? (
            <p className="exercise-note">
              Verification runs a fixed read-only check on your sandbox after your changes. It shows
              what to inspect — never the expected values.
            </p>
          ) : null}
          {exercise.setupSql ? (
            <p className="exercise-note">
              A scratch fixture is loaded with this exercise — it exists only in your browser database
              and is removed on reset.
            </p>
          ) : null}
          <div className="exercise-attempt-row">
            <AttemptStatusChip status={attempt?.status ?? 'none'} bestQualityScore={attempt?.bestQualityScore ?? null} />
            <button type="button" className="button button-ghost button-small" onClick={resetDatabase} disabled={outcome === 'running' || checking}>
              <Icon name="reset" size={16} />
              Reset database
            </button>
          </div>
        </div>
      </aside>

      <div className="exercise-workbench">
        {notice && (
          <p className="sql-notice" role="status">{notice}</p>
        )}

        {seedState === 'loading' && (
          <section className="workspace-panel sql-loading" aria-labelledby="exercise-loading-title">
            <div className="workspace-head">
              <h2 id="exercise-loading-title" className="workspace-title">Exercise database</h2>
              <span className="workspace-status"><span className="workspace-dot" aria-hidden="true" />Loading</span>
            </div>
            <div className="workspace-body">
              <p className="workspace-line">Fetching the practice snapshot ({SEED_URL})…</p>
            </div>
          </section>
        )}

        {seedState === 'error' && (
          <Callout tone="danger" title="The exercise database failed to load">
            {seedError ?? 'Unknown error.'} Check your connection, then{' '}
            <button type="button" className="button button-secondary button-small" onClick={retryLoad}>
              Retry
            </button>
          </Callout>
        )}

        {seedState === 'ready' && (
          <>
            <section className="workspace-panel sql-editor-panel" aria-labelledby="exercise-editor-title">
              <div className="workspace-head">
                <h2 id="exercise-editor-title" className="workspace-title">Your SQL</h2>
                <span className="workspace-status sql-version">
                  sqlite {schema?.sqliteVersion ?? '…'} · in-memory
                </span>
              </div>
              <div className="sql-editor-body">
                <SqlEditor
                  id="exercise-sql"
                  value={sql}
                  onChange={setSql}
                  onRun={() => void run()}
                  ariaDescribedBy="exercise-shortcuts"
                  minHeight={200}
                />
                <div className="sql-editor-toolbar">
                  <button type="button" className="button" onClick={() => void run()} disabled={outcome === 'running'}>
                    Run query
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => void checkWork()} disabled={outcome === 'running' || checking}>
                    {checking ? 'Checking…' : 'Check work'}
                  </button>
                  <button type="button" className="button button-ghost" onClick={resetDatabase} disabled={outcome === 'running' || checking}>
                    <Icon name="reset" size={16} />
                    Reset database
                  </button>
                </div>
                <p id="exercise-shortcuts" className="sql-shortcuts">
                  <kbd>Ctrl/⌘ + Enter</kbd> Run · <kbd>Esc</kbd> leave the editor · Check work compares your most recent result
                </p>
              </div>
            </section>

            <ResultsTable
              output={output}
              outcome={outcome}
              onCopyTsv={() => void copyResults('tsv')}
              onCopyCsv={() => void copyResults('csv')}
              onClear={clearResults}
            />

            {evaluation && (
              <section
                className={`exercise-verdict ${evaluation.passed ? 'exercise-verdict-pass' : 'exercise-verdict-fail'}`}
                aria-labelledby="exercise-verdict-title"
                aria-live="polite"
              >
                <div className="exercise-verdict-head">
                  <h2 id="exercise-verdict-title" className="exercise-verdict-title">
                    <Icon name={evaluation.passed ? 'check' : 'alert'} size={16} />
                    {evaluation.passed ? 'Passed' : 'Not yet'} · {evaluation.score}/100
                  </h2>
                </div>
                <ul className="exercise-checks">
                  {evaluation.checks.map((check) => (
                    <li key={check.id} className={check.passed ? 'exercise-check-pass' : 'exercise-check-fail'}>
                      <Icon name={check.passed ? 'check' : 'alert'} size={16} />
                      <span><strong>{check.id}</strong> — {check.message}</span>
                    </li>
                  ))}
                </ul>
                <p className="exercise-feedback">{evaluation.feedback}</p>
                {evaluation.passed ? (
                  <p className="exercise-feedback exercise-feedback-strong">
                    The solution reveal is now unlocked for this attempt — or file nothing further and move on.
                  </p>
                ) : null}
              </section>
            )}

            <section className="exercise-learning" aria-labelledby="exercise-learning-title">
              <h2 id="exercise-learning-title" className="content-title">Practice support</h2>
              <HintLadder huntId={exercise.id} />
              <RevealPanel huntId={exercise.id} refreshToken={revealNonce} />
            </section>

            <SchemaExplorer
              schema={schema}
              loading={outcome === 'running'}
              collapsed={explorerCollapsed}
              onToggleCollapsed={() => setExplorerCollapsed((value) => !value)}
            />
          </>
        )}

        <p className="sql-limits-footnote">
          Limits: {SQL_LIMITS.maxRowsPerStatement.toLocaleString()} rows per statement ·{' '}
          {SQL_LIMITS.maxStatementsPerRun} statements per run · {Math.round(SQL_LIMITS.maxQueryLength / 1024)} KB query text ·{' '}
          {SQL_LIMITS.runTimeoutMs / 1000}s per query. Reset always restores the exercise baseline.
        </p>
        <p className="exercise-exit">
          <Link className="button button-ghost button-small" to="/database">
            Back to all exercises
            <Icon name="arrow-right" size={16} />
          </Link>
        </p>
      </div>
    </div>
  )
}
