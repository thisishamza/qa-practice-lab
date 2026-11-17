import { useState } from 'react'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'

/**
 * Inert demonstrations. NOTHING on this page executes attacker input:
 * - the SQL example is a string preview, never run against any database;
 * - the XSS example renders inside <iframe sandbox=""> (scripts disabled)
 *   into a throwaway document the parent cannot see into;
 * - the CSRF example narrates the attack; the button only annotates.
 */

function SqlDemo() {
  const [value, setValue] = useState("' OR '1'='1")
  const concatenated = `SELECT * FROM customers WHERE email = '${value}'`
  const parameterized = `SELECT * FROM customers WHERE email = ?  -- bound: ${JSON.stringify(value)}`
  return (
    <div className="demo-pair">
      <div className="demo-pane">
        <h3 className="sim-subtitle">A · String-built (never do this)</h3>
        <p className="panel-note">Type anything — this is a preview, executed nowhere:</p>
        <label className="contract-field" htmlFor="sqli-input">
          <span className="contract-field-label">Learner input</span>
          <input id="sqli-input" className="contract-textarea sim-number" type="text" value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <pre className="demo-annotated" aria-live="polite">{concatenated}</pre>
        <p className="panel-note">The input is now SQL syntax. What the database does with <code>{'\'1\'=\'1\' -- '}</code> shapes is anyone’s guess — that is the vulnerability class, not the payload.</p>
      </div>
      <div className="demo-pane">
        <h3 className="sim-subtitle">B · Parameterized (the control that works)</h3>
        <p className="panel-note">Same input, bound as a value. The database never parses it as syntax:</p>
        <pre className="demo-annotated" aria-live="polite">{parameterized}</pre>
        <p className="panel-note">Every character above is data to the driver. Injection has no door in this shape — that is the whole fix.</p>
      </div>
    </div>
  )
}

function XssDemo() {
  const [mode, setMode] = useState<'encoded' | 'raw'>('encoded')
  const payload = '<img src=x onerror="document.title = \'PWNED\'">'
  const srcDoc =
    mode === 'encoded'
      ? `<!doctype html><html><body style="font-family:sans-serif"><p>Escaped render:</p><p>&lt;img src=x onerror="document.title = &quot;PWNED&quot;"&gt;</p></body></html>`
      : `<!doctype html><html><body style="font-family:sans-serif"><p>Raw HTML render (inert iframe — scripts disabled):</p>${payload}<p>No dialog appeared. The iframe has sandbox="" — the handler never ran, and document.title stayed intact.</p></body></html>`
  return (
    <div className="demo-pair">
      <div className="demo-pane">
        <h3 className="sim-subtitle">The payload (inert)</h3>
        <pre className="demo-annotated">{payload}</pre>
        <p className="panel-note">
          <code>onerror</code> would fire only if the browser both parsed the tag and executed the handler. Here the iframe is sandboxed with no <code>allow-scripts</code>, so nothing executes — you can view it safely.
        </p>
        <div className="button-row">
          <button type="button" className="button button-secondary" onClick={() => setMode(mode === 'encoded' ? 'raw' : 'encoded')}>
            {mode === 'encoded' ? 'Compare: raw-HTML render' : 'Compare: encoded render'}
          </button>
        </div>
      </div>
      <div className="demo-pane">
        <h3 className="sim-subtitle">{mode === 'encoded' ? 'Escaped output (safe)' : 'Raw HTML output (still inert)'}</h3>
        <iframe className="demo-inert-frame" sandbox="" title="Inert XSS rendering comparison" srcDoc={srcDoc} />
        <p className="panel-note">
          Encoding at output is the control; the sandbox here is belt-and-braces for the demo. Real apps: encode per context (text, attribute, JS, URL), never interpolate raw input, and set <code>Content-Security-Policy: default-src &apos;self&apos;</code> as a layer.
        </p>
      </div>
    </div>
  )
}

function CsrfDemo() {
  const [step, setStep] = useState(0)
  const steps = [
    'You sign in to the practice shop; the browser holds your session cookie for this origin.',
    'A third-party page (not this origin) renders a hidden auto-submitting form targeting /api/v1/checkout — it ships the cookie with the request because browsers attach cookies for the target origin.',
    'The server cannot distinguish "your page submitted this" from "a hostile page submitted this" by cookie alone — the cookie is ambient, not intentional.',
    'The defences: SameSite cookies (never sent cross-site), a CSRF token bound to the session and required by the form, and Origin/Referer verification. Test the defences, never the exploit — forgery-resistance is the thing to prove.',
  ]
  return (
    <div className="demo-pane">
      <h3 className="sim-subtitle">The attack, narrated</h3>
      <ol className="database-steps">
        {steps.slice(0, step + 1).map((text, index) => (
          <li key={index} className="database-step">
            <span className="database-step-index" aria-hidden="true">{index + 1}</span>
            <span className="database-step-copy"><span>{text}</span></span>
          </li>
        ))}
      </ol>
      {step < steps.length - 1 ? (
        <button type="button" className="button button-secondary" onClick={() => setStep((value) => value + 1)}>
          Next step
        </button>
      ) : (
        <button type="button" className="button button-ghost" onClick={() => setStep(0)}>Replay the walkthrough</button>
      )}
      <p className="panel-note">Nothing was submitted anywhere. The only thing this demo performs is reading.</p>
    </div>
  )
}

const HEADERS: ReadonlyArray<{ header: string; risk: string; note: string }> = [
  { header: 'X-Content-Type-Options: nosniff', risk: 'MIME-sniffing', note: 'Stops the browser second-guessing the declared content type.' },
  { header: 'Strict-Transport-Security', risk: 'Downgrade to HTTP', note: 'Pins the origin to HTTPS for the max-age window.' },
  { header: 'X-Frame-Options / frame-ancestors', risk: 'Clickjacking', note: 'Refuses framing; frame-ancestors is the modern CSP-native form.' },
  { header: 'Referrer-Policy: no-referrer', risk: 'URL leakage', note: 'Keeps tokens in query strings from leaving in Referer.' },
  { header: 'Content-Security-Policy', risk: 'XSS execution', note: 'default-src ’self’ blocks inline script execution as a second layer.' },
  { header: 'Cache-Control: no-store', risk: 'Shared-cache replay', note: 'Authenticated responses must never sit in a shared cache.' },
]

function HeadersDemo() {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <ul className="demo-pair" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {HEADERS.map((entry) => (
        <li key={entry.header} className="demo-pane">
          <button type="button" className="link-button" aria-expanded={open === entry.header} onClick={() => setOpen(open === entry.header ? null : entry.header)}>
            <code>{entry.header}</code>
          </button>
          <p className="panel-note" style={{ marginBottom: 0 }}>Reduces: {entry.risk}</p>
          {open === entry.header ? <p className="panel-note">{entry.note}</p> : null}
        </li>
      ))}
    </ul>
  )
}

export function SecurityDemosPage() {
  useDocumentTitle('Safe security demos')
  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Security Testing', to: '/security' }, { label: 'Safe demos' }]} />
      <PageHeader
        eyebrow="Learn · inert demonstrations"
        title="Security concepts, demonstrated without executing anything"
        description="Four demonstrations of the most-tested vulnerability classes. Every one of them is inert by construction: nothing here runs against a database, a browser engine penalty, or anyone’s account."
      />
      <Callout tone="warning" title="Synthetic environment only">
        These demos teach the shape of the problem. They are not scanning tools and must not be adapted into them. For the scored version of this material, see the{' '}
        <a className="text-link" href="/security">security exercise catalogue</a>.
      </Callout>

      <section className="content-section" aria-labelledby="demo-sqli-title">
        <h2 id="demo-sqli-title" className="database-section-title">1 · SQL injection: two channels, one door</h2>
        <SqlDemo />
      </section>

      <section className="content-section" aria-labelledby="demo-xss-title">
        <h2 id="demo-xss-title" className="database-section-title">2 · Cross-site scripting: encode the output</h2>
        <XssDemo />
      </section>

      <section className="content-section" aria-labelledby="demo-csrf-title">
        <h2 id="demo-csrf-title" className="database-section-title">3 · CSRF: ambient cookies vs intentional requests</h2>
        <CsrfDemo />
      </section>

      <section className="content-section" aria-labelledby="demo-headers-title">
        <h2 id="demo-headers-title" className="database-section-title">4 · Security headers: what each one buys</h2>
        <HeadersDemo />
      </section>
    </div>
  )
}
