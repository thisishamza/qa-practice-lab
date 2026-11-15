// Minimal local bug-report capture (P3-M8). The learner writes the report;
// the export happens entirely in the browser as a markdown download — nothing
// is uploaded, stored on the server or scored. The reveal/scoring flow is
// Phase 4+; this deliberately collects no hunt id, defect id or session
// metadata. Copy is honest about that.

import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'

function asSection(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : '_Not filled in._'
}

export function BugReportExport() {
  const [title, setTitle] = useState('')
  const [what, setWhat] = useState('')
  const [expected, setExpected] = useState('')
  const [steps, setSteps] = useState('')
  const [busy, setBusy] = useState(false)

  const canExport = title.trim().length > 0

  function download() {
    if (!canExport) {
      return
    }
    setBusy(true)
    const report = [
      `# Bug report — ${title.trim()}`,
      '',
      '## What happened',
      '',
      asSection(what),
      '',
      '## Expected',
      '',
      asSection(expected),
      '',
      '## Steps to reproduce',
      '',
      asSection(steps),
      '',
      '---',
      'Reported from the Meridian Outfitters practice shop. This markdown file was',
      'generated locally in your browser; nothing was uploaded or stored anywhere.',
      '',
    ].join('\n')
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'bug-report.md'
    anchor.click()
    URL.revokeObjectURL(url)
    setBusy(false)
  }

  return (
    <form
      className="bug-report"
      onSubmit={(event) => {
        event.preventDefault()
        download()
      }}
    >
      <div className="bug-report-field">
        <label htmlFor="bug-report-title">Report title</label>
        <input
          id="bug-report-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="One line: what is broken?"
          autoComplete="off"
          required
        />
      </div>
      <div className="bug-report-field">
        <label htmlFor="bug-report-what">What happened</label>
        <textarea
          id="bug-report-what"
          rows={2}
          value={what}
          onChange={(event) => setWhat(event.target.value)}
          placeholder="What you observed, in plain words"
        />
      </div>
      <div className="bug-report-field">
        <label htmlFor="bug-report-expected">Expected</label>
        <textarea
          id="bug-report-expected"
          rows={2}
          value={expected}
          onChange={(event) => setExpected(event.target.value)}
          placeholder="What should happen instead"
        />
      </div>
      <div className="bug-report-field">
        <label htmlFor="bug-report-steps">Steps to reproduce</label>
        <textarea
          id="bug-report-steps"
          rows={3}
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          placeholder="1. …&#10;2. …&#10;3. …"
        />
      </div>
      <Button type="submit" variant="secondary" size="sm" disabled={!canExport} loading={busy}>
        <Icon name="book" size={15} />
        Download the report (.md)
      </Button>
      <p className="panel-note">
        Local export only — the file is generated in your browser and never uploaded. The
        practice lab does not grade or read it.
      </p>
    </form>
  )
}
