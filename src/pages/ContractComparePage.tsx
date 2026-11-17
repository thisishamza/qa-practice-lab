import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { Icon } from '../components/ui/Icon'
import { findContractFixture } from '../shared/contracts/index'
import { diffContracts } from '../shared/contractDiff'
import { ContractValidationError } from '../shared/contractValidation'
import type { ContractDiffResult, ContractLocus } from '../shared/contractTypes'
import { verdictLabel, verdictTone } from '../lib/contractVerdict'

const COMPATIBLE_FIXTURE_PAIRS = [
  { base: 'ledger-v1', candidate: 'ledger-v2-compatible', label: 'v1 → v2.0.0 (compatible release)' },
  { base: 'ledger-v1', candidate: 'ledger-v2-breaking', label: 'v1 → v2.0.0 (breaking release)' },
  { base: 'ledger-v1', candidate: 'ledger-v2-required', label: 'v1 → v2.1.0 (new required field)' },
] as const

export function ContractComparePage() {
  useDocumentTitle('Contract Testing — Compare')
  const [searchParams] = useSearchParams()
  const [pairIndex, setPairIndex] = useState<number>(() => {
    const base = searchParams.get('base')
    const candidate = searchParams.get('candidate')
    const found = COMPATIBLE_FIXTURE_PAIRS.findIndex((pair) => pair.base === base && pair.candidate === candidate)
    return found === -1 ? 1 : found
  })
  const [mode, setMode] = useState<'fixture' | 'inline'>(
    searchParams.get('candidate') === 'inline' ? 'inline' : 'fixture',
  )
  const [locus, setLocus] = useState<ContractLocus>(searchParams.get('locus') === 'request' ? 'request' : 'response')
  const [inlineSchemaText, setInlineSchemaText] = useState('')
  const [result, setResult] = useState<ContractDiffResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const pair = COMPATIBLE_FIXTURE_PAIRS[pairIndex]
  const base = findContractFixture(pair.base)
  const candidate = findContractFixture(pair.candidate)

  const onRun = useCallback(() => {
    if (!base) {
      return
    }
    let candidateSchema: unknown
    if (mode === 'inline') {
      try {
        candidateSchema = JSON.parse(inlineSchemaText)
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'The candidate schema is not valid JSON.')
        return
      }
    } else {
      candidateSchema = candidate?.schema
    }
    try {
      setResult(diffContracts(base.schema, candidateSchema, { locus }))
      setParseError(null)
    } catch (error) {
      if (error instanceof ContractValidationError) {
        setParseError(error.message)
        setResult(null)
        return
      }
      throw error
    }
  }, [base, candidate, mode, inlineSchemaText, locus])

  const findings = useMemo(() => result?.findings ?? [], [result])
  const grouped = useMemo(() => {
    const breaking = findings.filter((finding) => finding.classification === 'breaking')
    const review = findings.filter((finding) => finding.classification === 'review')
    const compatible = findings.filter((finding) => finding.classification === 'compatible')
    return [
      { key: 'breaking', label: `Breaking (${breaking.length})`, items: breaking },
      { key: 'review', label: `Review required (${review.length})`, items: review },
      { key: 'compatible', label: `Compatible (${compatible.length})`, items: compatible },
    ] as const
  }, [findings])

  const reportMarkdown = useCallback(() => {
    if (!result) {
      return ''
    }
    const lines = [
      `## Compatibility review — ${pair.label}`,
      `Verdict: ${verdictLabel(result.verdict)}`,
      `Locus: ${locus}`,
      '',
      ...findings.map(
        (finding) =>
          `- [${finding.classification.toUpperCase()}] ${finding.rule} ${finding.path} — ${finding.change} — consumer: ${finding.consumerImpact}`,
      ),
    ]
    return lines.join('\n')
  }, [findings, locus, pair.label, result])

  const copyReport = useCallback(() => {
    void navigator.clipboard?.writeText(reportMarkdown()).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }, [reportMarkdown])

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Contract Testing', to: '/contract' },
          { label: 'Compare' },
        ]}
      />
      <PageHeader
        eyebrow="Contract testing · Capability B"
        title="Compare two contracts"
        description="Pick a release pair (or paste a candidate schema), declare the locus, and get the verdict — BREAKING, BACKWARD-COMPATIBLE or REVIEW REQUIRED — with every finding carrying a rule id, a path, a change and both perspectives."
        actions={
          <Link className="button button-secondary" to="/contract/exercises/contract-adv-versioning-01">
            The full compatibility review exercise
            <Icon name="arrow-right" size={16} />
          </Link>
        }
      />

      <Callout tone="info" title="Any breaking finding means BREAKING">
        Precedence is breaking &gt; review &gt; compatible — enum widening is always review, and
        annotation-only deltas produce no findings at all. Compatibility is not decided by
        majority vote.
      </Callout>

      <div className="contract-workspace">
        <section className="workspace-panel" aria-labelledby="compare-input-title">
          <div className="workspace-head">
            <h2 id="compare-input-title" className="workspace-title">Base → candidate</h2>
          </div>
          <div className="workspace-body">
            <label className="contract-field">
              <span className="contract-field-label">Candidate source</span>
              <select id="compare-mode" className="contract-select" value={mode} onChange={(event) => setMode(event.target.value as 'fixture' | 'inline')}>
                <option value="fixture">A Ledger fixture (pairwise release)</option>
                <option value="inline">Paste a candidate schema</option>
              </select>
            </label>
            <label className="contract-field">
              <span className="contract-field-label">Locus</span>
              <select id="compare-locus" className="contract-select" value={locus} onChange={(event) => setLocus(event.target.value as ContractLocus)}>
                <option value="response">response (provider → consumer)</option>
                <option value="request">request (consumer → provider)</option>
              </select>
            </label>
            {mode === 'fixture' ? (
              <label className="contract-field">
                <span className="contract-field-label">Release pair</span>
                <select id="compare-pair" className="contract-select" value={pairIndex} onChange={(event) => setPairIndex(Number(event.target.value))}>
                  {COMPATIBLE_FIXTURE_PAIRS.map((entry, index) => (
                    <option key={entry.label} value={index}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="contract-field">
                <span className="contract-field-label">Candidate schema (JSON)</span>
                <textarea
                  id="compare-inline"
                  className="contract-textarea"
                  spellCheck={false}
                  placeholder="Paste the candidate document — full or partial schema."
                  value={inlineSchemaText}
                  onChange={(event) => setInlineSchemaText(event.target.value)}
                />
              </label>
            )}
            {parseError ? (
              <p className="contract-inline-error" role="alert">
                <Icon name="alert" size={16} /> {parseError}
              </p>
            ) : null}
            <div className="button-row">
              <button type="button" className="button" onClick={onRun}>
                Compare
              </button>
              {result ? (
                <button type="button" className="button button-ghost" onClick={copyReport}>
                  {copied ? 'Copied' : 'Copy as Markdown'}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="workspace-panel" aria-labelledby="compare-result-title" aria-live="polite">
          <div className="workspace-head">
            <h2 id="compare-result-title" className="workspace-title">Verdict &amp; findings</h2>
          </div>
          <div className="workspace-body">
            {result === null ? (
              <p className="panel-note">Run a comparison — the verdict and findings appear here.</p>
            ) : (
              <>
                <div className={`verdict-banner verdict-banner-${verdictTone(result.verdict)}`} role="status">
                  <div>
                    <p className="verdict-banner-title">{verdictLabel(result.verdict)}</p>
                    <p className="verdict-banner-copy">
                      {result.verdict === 'breaking'
                        ? 'This release rejects somebody’s existing traffic. Hold until consumers migrate.'
                        : result.verdict === 'review'
                          ? 'Nothing breaks outright, but a human signs off before this ships.'
                          : 'Every finding is additive or relaxing — safe to ship.'}
                    </p>
                  </div>
                </div>
                {grouped.map((group) =>
                  group.items.length === 0 ? null : (
                    <section key={group.key} className="findings-group" aria-label={group.label}>
                      <h3 className="findings-group-title">{group.label}</h3>
                      {group.items.map((finding, index) => (
                        <article key={`${finding.rule}|${finding.path}|${index}`} className="finding-item">
                          <div className="finding-item-head">
                            <span className="finding-rule">{finding.rule}</span>
                            <span className="finding-change">{finding.change}</span>
                          </div>
                          <code className="finding-path">{finding.path}</code>
                          <div className="finding-impacts">
                            <p className="finding-impact">
                              <span className="finding-impact-label">Consumer impact</span>
                              {finding.consumerImpact}
                            </p>
                            <p className="finding-impact">
                              <span className="finding-impact-label">Provider impact</span>
                              {finding.providerImpact}
                            </p>
                          </div>
                        </article>
                      ))}
                    </section>
                  ),
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
