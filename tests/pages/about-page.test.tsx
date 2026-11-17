// Markup tests for the /about durability and learning-transparency sections
// (P4-M3 WP2).
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AboutPage } from '../../src/pages/AboutPage'

function render(hash = ''): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/about${hash}`]}>
      <AboutPage />
    </MemoryRouter>,
  )
}

describe('AboutPage — guest progress durability', () => {
  const html = render()

  it('explains progress is anonymous, temporary and seven days', () => {
    expect(html).toContain('anonymous practice session')
    expect(html).toContain('seven days')
    expect(html).toContain('temporary by design')
  })

  it('explains guest progress never transfers to an account', () => {
    expect(html).toContain('does not transfer to an account')
    expect(html).toContain('does not merge or migrate')
  })
})

describe('AboutPage — signed-in progress attribution', () => {
  const html = render()

  it('explains attribution happens at submission time', () => {
    expect(html).toContain('at the moment of submission')
    expect(html).toContain('synthetic training customer')
  })

  it('explains earlier guest activity stays session-bound and is never re-attributed', () => {
    expect(html).toContain('remain session-bound')
    expect(html).toContain('never re-attributed')
  })

  it('makes no automatic guest-to-customer migration claim', () => {
    expect(html).toContain('Signing in never merges or migrates')
  })

  it('states the accounts are fictional demo accounts', () => {
    expect(html).toContain('fictional demo accounts')
  })
})

describe('AboutPage — evaluation transparency', () => {
  const html = render('#evaluation')

  it('carries the evaluation section with a stable anchor', () => {
    expect(html).toContain('id="evaluation"')
    expect(html).toContain('Learning and evaluation')
  })

  it('publishes the rubric, verdict bands and discovery rules', () => {
    expect(html).toContain('Total: 100 points')
    expect(html).toContain('Solid report')
    expect(html).toContain('A high score does not automatically mean the defect was found')
    expect(html).toContain('Hints never lower your score')
  })
})

describe('AboutPage — synthetic environment', () => {
  const html = render()

  it('distinguishes the fictional environment from real commerce and payments', () => {
    expect(html).toContain('fictional')
    expect(html).toContain('nothing is really bought, paid for or shipped')
  })

  it('claims no real payments or registration', () => {
    expect(html).not.toContain('real payment')
    expect(html).toContain('no real registration')
  })
})

describe('AboutPage — accuracy of the build description', () => {
  const html = render()

  it('no longer claims the exercises are unimplemented', () => {
    expect(html).not.toContain('Every catalog entry is a placeholder')
    expect(html).not.toContain('The exercises are not')
  })

  it('describes the real, session-scoped progress page honestly', () => {
    expect(html).toContain('never sample data')
    expect(html).not.toContain('labelled demo figures')
  })

  it('no longer claims the health check is the only live API call', () => {
    expect(html).not.toContain('only live API request')
  })
})

describe('AboutPage — the evaluation anchor is keyboard-focusable', () => {
  const html = render('#evaluation')

  it('renders the evaluation section with tabindex="-1" so hash navigation can focus it', () => {
    expect(html).toContain('id="evaluation"')
    const section = /<section[^>]*id="evaluation"[^>]*>/.exec(html)?.[0] ?? ''
    expect(section).toContain('tabindex="-1"')
  })
})
