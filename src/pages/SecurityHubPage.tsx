import { useDocumentTitle } from '../lib/useDocumentTitle'
import { SECURITY_EXERCISES } from '../data/securityExercises'
import { LabHub } from '../features/labs/LabHub'

export function SecurityHubPage() {
  useDocumentTitle('Security Testing')
  return (
    <LabHub
      trackLabel="Security testing"
      title="Security Testing"
      description="Probe a synthetic target built like the real one and learn to think like the attacker — safely. Authentication, authorization, sessions, input handling, headers, exposure and API risks, with inert demos, scored exercises and three seeded security hunts."
      primaryAction={{ to: '/security/demos', label: 'Open the safe demos' }}
      trackLink="/tracks/security-testing"
      guideLink={{ to: '/guides/guide-security-testing', label: 'Read the security testing guide' }}
      capabilitiesTitle="What you can practise"
      capabilities={[
        {
          to: '/security/demos',
          title: 'A · Inert demonstrations',
          copy: 'SQL-injection parameterization preview, a sandboxed (scripts disabled) XSS rendering pane, and a CSRF walkthrough — concepts demonstrated without executing anything.',
        },
        {
          to: '/security/exercises/sec-bgn-authn-01',
          title: 'B · Scored exercises',
          copy: 'Twelve exercises across beginner, intermediate and advanced — BOLA, sessions, token lifecycle, privilege escalation, headers, exposure, rate limiting and OWASP API triage, scored server-side.',
        },
        {
          to: '/scenarios',
          title: 'C · Three security hunts',
          copy: 'An overshared profile response, an unenforced login failure budget, and internal diagnostics leaking into a 422 — reproducible in your session, gone on reset.',
        },
      ]}
      introPanel={
        <>
          <p className="workspace-line">
            Everything here is <strong>synthetic and isolated</strong>: fictional accounts, the practice shop, no third-party
            targets, no payload execution. The hunts activate only in your bug-hunt session and leave clean mode untouched.
          </p>
          <p className="workspace-line database-dataset-note">
            Severity model (used in every report): <strong>Critical</strong> — account takeover or money movement ·
            <strong> High</strong> — unauthorized access to another user’s data · <strong>Medium</strong> — contained disclosure or weakened control ·
            <strong> Low</strong> — hygiene/observability. Evidence beats adjectives: steps, observed vs expected, impact, remediation.
          </p>
        </>
      }
      facts={[
        { key: 'Exercises', value: String(SECURITY_EXERCISES.length) },
        { key: 'Bug hunts', value: '3' },
        { key: 'Demos', value: '4 (inert)' },
        { key: 'Severity', value: 'Critical–Low' },
      ]}
      howSteps={[
        { title: 'Walk the demos', detail: 'See parameterization vs escaping side-by-side, an inert XSS payload render and a CSRF request — nothing executes.' },
        { title: 'Attack the shop (gently)', detail: 'The three hunts reproduce real classes — overexposure, broken brute-force protection, verbose errors — in your session only.' },
        { title: 'Prove it', detail: 'File the structured bug report for your hunt: reproduction steps, observed vs expected, impact, remediation — scored on evidence, not keywords.' },
        { title: 'Ship the fix', detail: 'Walk the remediation with the gated solution panel; re-verify in clean mode.' },
      ]}
      exercises={SECURITY_EXERCISES}
      facets={[
        { id: 'all', label: 'All' },
        { id: 'authn-authz', label: 'AuthN / AuthZ' },
        { id: 'input', label: 'Input & output' },
        { id: 'config', label: 'Configuration' },
        { id: 'api', label: 'API risks' },
      ]}
      exerciseBasePath="/security/exercises"
      huntScenarioPrefix="hunt-sec-"
    />
  )
}
