import { createElement } from 'react'
// SSR markup tests for the playground page (loading branch — effects do not
// run during static render) and for the ResultsTable states driven by props.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { DatabasePlaygroundPage } from '../../src/pages/DatabasePlaygroundPage'
import { PracticeSessionProvider } from '../../src/features/practice/PracticeSessionProvider'
import { ResultsTable } from '../../src/features/database/ResultsTable'
import type { SqlRunOutput } from '../../src/shared/sql'

const noop = () => {}

function renderPage() {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(
        PracticeSessionProvider,
        null,
        createElement(DatabasePlaygroundPage),
      ),
    ),
  )
}

function makeOutput(overrides: Partial<SqlRunOutput> = {}): SqlRunOutput {
  return {
    ok: true,
    resultSets: [],
    elapsedMs: 3,
    error: null,
    ...overrides,
  }
}

function makeSet(overrides: Partial<SqlRunOutput['resultSets'][number]> = {}) {
  return {
    statementIndex: 0,
    statement: 'SELECT 1',
    columns: ['name', 'price_cents'],
    rows: [
      ['Ridgeline 2-Person Tent', 18999],
      ['Ember LED Lantern', 3299],
    ],
    rowCount: 2,
    truncated: false,
    changes: null,
    elapsedMs: 3,
    ...overrides,
  }
}

describe('DatabasePlaygroundPage (SSR, loading branch)', () => {
  it('renders the chrome and the isolation callout', () => {
    const markup = renderPage()
    expect(markup).toContain('SQL playground')
    expect(markup).toContain('Fetching the practice snapshot')
    expect(markup).toContain('Web Worker')
    expect(markup).toContain('synthetic')
  })

  it('shows the keyboard shortcuts hint', () => {
    const markup = renderPage()
    expect(markup).toContain('Ctrl/⌘ + Enter')
  })
})

describe('ResultsTable', () => {
  it('idle state explains how to run and that nothing leaves the page', () => {
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, { output: null, outcome: 'idle', onCopyTsv: noop, onCopyCsv: noop, onClear: noop }),
    )
    expect(markup).toContain('Nothing has run yet')
    expect(markup).toContain('nothing is sent to the server')
  })

  it('running state announces progress', () => {
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, { output: null, outcome: 'running', onCopyTsv: noop, onCopyCsv: noop, onClear: noop }),
    )
    expect(markup).toContain('Running')
  })

  it('timeout state explains the terminate + automatic reseed', () => {
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, { output: null, outcome: 'timeout', onCopyTsv: noop, onCopyCsv: noop, onClear: noop }),
    )
    expect(markup).toContain('3 second limit')
    expect(markup).toContain('reset')
  })

  it('renders result rows and status line for a successful run', () => {
    const output = makeOutput({ resultSets: [makeSet()], elapsedMs: 4 })
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, { output, outcome: 'done', onCopyTsv: noop, onCopyCsv: noop, onClear: noop }),
    )
    expect(markup).toContain('Ridgeline 2-Person Tent')
    expect(markup).toContain('18999')
    expect(markup).toContain('2 rows')
    expect(markup).toContain('4 ms')
  })

  it('renders the failing statement index and message on error', () => {
    const output = makeOutput({
      ok: false,
      error: { statementIndex: 1, message: 'no such table: orders_typo' },
      resultSets: [makeSet()],
    })
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, { output, outcome: 'failed', onCopyTsv: noop, onCopyCsv: noop, onClear: noop }),
    )
    expect(markup).toContain('Statement 2 failed')
    expect(markup).toContain('orders_typo')
    expect(markup).toContain('Statements before the failure completed')
  })

  it('notes truncated statements when the 1,000-row cap is hit', () => {
    const output = makeOutput({ resultSets: [makeSet({ truncated: true })] })
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, { output, outcome: 'done', onCopyTsv: noop, onCopyCsv: noop, onClear: noop }),
    )
    expect(markup).toContain('1,000-row cap')
  })

  it('renders DML-only statements as an affected-row summary', () => {
    const output = makeOutput({
      resultSets: [makeSet({ columns: [], rows: [], rowCount: 0, changes: 3, statement: 'UPDATE x' })],
    })
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, { output, outcome: 'done', onCopyTsv: noop, onCopyCsv: noop, onClear: noop }),
    )
    expect(markup).toContain('3 rows affected')
  })

  it('renders NULL distinctly from empty strings', () => {
    const output = makeOutput({ resultSets: [makeSet({ rows: [[null, 'phone']] })] })
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, { output, outcome: 'done', onCopyTsv: noop, onCopyCsv: noop, onClear: noop }),
    )
    expect(markup).toContain('NULL')
  })
})
