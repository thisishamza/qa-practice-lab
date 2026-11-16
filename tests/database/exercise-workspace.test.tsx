// SSR markup tests for the Phase 6 M2 exercise workspace. Static render
// proves structure, labelling and honest states; interaction itself lives
// in the browser verification pass.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ExerciseWorkspace } from '../../src/features/database/ExerciseWorkspace'
import { findSqlExercise, SQL_EXERCISES } from '../../src/data/sqlExercises'

function render(exerciseId: string) {
  const exercise = findSqlExercise(exerciseId)!
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [`/database/exercises/${exerciseId}`] },
      createElement(ExerciseWorkspace, { exercise }),
    ),
  )
}

describe('ExerciseWorkspace — instructions panel', () => {
  it('renders the QA framing, objective, task, tables and constraint chips', () => {
    const html = render('sql-bgn-where-02')
    expect(html).toContain('Instructions')
    expect(html).toContain('Learning objective')
    expect(html).toContain('Your task')
    expect(html).toContain('Tables')
    expect(html).toContain('products')
    expect(html).toContain('categories')
    expect(html).toContain('Worth knowing')
    expect(html).toContain('FOREIGN KEY')
    expect(html).toContain('CHECK')
  })

  it('renders the attempt chip and the reset control', () => {
    const html = render('sql-int-join-03')
    expect(html).toContain('Reset database')
    expect(html).toMatch(/in_progress|Not started|submitted/i)
  })

  it('marks QA-tracked exercises with the SQL-QA tag', () => {
    const html = render('sql-int-join-03')
    expect(html).toContain('SQL-QA-03')
  })

  it('shows the check-query disclosure note for post-state exercises and the fixture note for setup exercises', () => {
    const dml = render('sql-int-insert-11')
    expect(dml).toContain('Verification runs a fixed read-only check')
    const withSetup = render('sql-int-delete-13')
    expect(withSetup).toContain('scratch fixture is loaded')
  })

  it('renders the loading state before the sandbox is ready', () => {
    const html = render('sql-bgn-select-01')
    expect(html).toContain('Fetching the practice snapshot')
  })

  it('every exercise renders instructions without crashing', () => {
    for (const exercise of SQL_EXERCISES) {
      const html = render(exercise.id)
      expect(html.length).toBeGreaterThan(500)
      expect(html).toContain('Your task')
    }
  })
})
