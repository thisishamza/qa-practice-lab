import { createElement } from 'react'
// SSR markup tests for the Database Testing hub.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { DatabaseHubPage } from '../../src/pages/DatabaseHubPage'

function render() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(DatabaseHubPage)),
  )
}

describe('DatabaseHubPage', () => {
  it('renders the page chrome and primary action', () => {
    const markup = render()
    expect(markup).toContain('Database Testing')
    expect(markup).toContain('SQL playground')
    expect(markup).toContain('href="/database/playground"')
    expect(markup).toContain('Meridian Outfitters')
  })

  it('shows the dataset facts card', () => {
    const markup = render()
    expect(markup).toContain('1,419')
    expect(markup).toContain('SQLite')
    expect(markup).toContain('~120 KB')
  })

  it('links the exercise catalogue and the database bug hunts', () => {
    const markup = render()
    expect(markup).toContain('Exercises')
    expect(markup).toContain('Database bug hunts')
    expect(markup).toContain('/database/exercises/')
  })

  it('links to the track and scenario catalogue', () => {
    const markup = render()
    expect(markup).toContain('href="/tracks/database-testing"')
    expect(markup).toContain('href="/practice"')
  })
})
