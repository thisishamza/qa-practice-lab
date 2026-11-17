// Pure grouping + summary helpers for the /progress dashboard (R3).
// Everything here derives from the GET /api/v1/practice/progress payload;
// nothing is fetched, scored or persisted. Kept in a .ts module so the
// view stays presentational and the logic is unit-testable.

import type { ProgressHuntEntry } from '../../shared/learning'

export type ProgressGroupId =
  | 'hunts'
  | 'database'
  | 'contract'
  | 'performance'
  | 'security'
  | 'events'

export interface ProgressGroup {
  id: ProgressGroupId
  title: string
  description: string
  entries: readonly ProgressHuntEntry[]
  hrefFor: (entry: ProgressHuntEntry) => string
}

export interface ProgressSectionSummary {
  total: number
  /** Entries with at least one attempt opened. */
  started: number
  /** Entries with at least one submitted report. */
  reported: number
  /** Entries whose sticky discovery flag is set. */
  discovered: number
  /** Entries whose latest attempt is still in progress. */
  inProgress: number
}

/** Per-entry aggregate used for section headers and defaults. */
export function summarizeEntries(
  entries: readonly ProgressHuntEntry[],
): ProgressSectionSummary {
  let started = 0
  let reported = 0
  let discovered = 0
  let inProgress = 0
  for (const entry of entries) {
    if (entry.attempts > 0) started += 1
    if (entry.lastSubmittedAt !== null) reported += 1
    if (entry.discovered) discovered += 1
    if (entry.status === 'in_progress') inProgress += 1
  }
  return { total: entries.length, started, reported, discovered, inProgress }
}

/**
 * Accessible, honest one-line summary for a collapsed section header,
 * e.g. "1 of 7 started · 1 reported · 1 discovered · 1 in progress".
 * Zero-activity sections read "Not started yet".
 */
export function summaryLabel(summary: ProgressSectionSummary): string {
  if (summary.started === 0) {
    return 'Not started yet'
  }
  const parts = [`${summary.started} of ${summary.total} started`, `${summary.reported} reported`]
  if (summary.inProgress > 0) {
    parts.push(`${summary.inProgress} in progress`)
  }
  parts.push(`${summary.discovered} discovered`)
  return parts.join(' · ')
}

/**
 * Whether a section starts expanded. Sections where the learner has opened
 * at least one attempt start expanded; untouched sections start collapsed
 * so the page never renders hundreds of rows by default.
 */
export function shouldStartOpen(entries: readonly ProgressHuntEntry[]): boolean {
  return entries.some((entry) => entry.attempts > 0)
}

const isDatabaseTarget = (id: string) => id.startsWith('sql-') || id.startsWith('hunt-db-')
const isContractTarget = (id: string) => id.startsWith('contract-') || id.startsWith('hunt-contract-')
const isPerformanceTarget = (id: string) => id.startsWith('perf-') || id.startsWith('hunt-perf-')
const isSecurityTarget = (id: string) => id.startsWith('sec-') || id.startsWith('hunt-sec-')
const isEventTarget = (id: string) => id.startsWith('evt-') || id.startsWith('hunt-event-')

const labTargets = (id: string) =>
  isDatabaseTarget(id) ||
  isContractTarget(id) ||
  isPerformanceTarget(id) ||
  isSecurityTarget(id) ||
  isEventTarget(id)

/**
 * Split the registry-ordered hunt list into the six display groups and
 * resolve each entry's destination: wired hunts link to their scenario
 * page; exercise entries link to their lab exercise route.
 */
export function splitProgressEntries(hunts: readonly ProgressHuntEntry[]): ProgressGroup[] {
  const scenarioHref = (entry: ProgressHuntEntry): string =>
    entry.scenarioId ? `/scenarios/${entry.scenarioId}` : ''
  const labHref = (prefix: string, exerciseBase: string) => (entry: ProgressHuntEntry): string =>
    entry.huntId.startsWith(prefix) ? scenarioHref(entry) : `${exerciseBase}/${entry.huntId}`

  const group = (
    id: ProgressGroupId,
    title: string,
    description: string,
    entries: readonly ProgressHuntEntry[],
    hrefFor: (entry: ProgressHuntEntry) => string,
  ): ProgressGroup => ({ id, title, description, entries, hrefFor })

  return [
    group(
      'hunts',
      'Bug hunts & shop exercises',
      'The wired exercises against the fictional Meridian Outfitters shop — open one to pick up where you left off.',
      hunts.filter((entry) => !labTargets(entry.huntId)),
      scenarioHref,
    ),
    group(
      'database',
      'Database Testing',
      'Your state on the SQL exercises and database bug hunts — practice happens in the isolated SQL lab.',
      hunts.filter((entry) => isDatabaseTarget(entry.huntId)),
      labHref('hunt-db-', '/database/exercises'),
    ),
    group(
      'contract',
      'Contract Testing',
      'Your state on the contract exercises and contract bug hunts — validate, diff and consumer-verify in the contract lab.',
      hunts.filter((entry) => isContractTarget(entry.huntId)),
      labHref('hunt-contract-', '/contract/exercises'),
    ),
    group(
      'performance',
      'Performance Testing',
      'Your state on the performance exercises and performance bug hunts — measure in the bounded load runner.',
      hunts.filter((entry) => isPerformanceTarget(entry.huntId)),
      labHref('hunt-perf-', '/performance/exercises'),
    ),
    group(
      'security',
      'Security Testing',
      'Your state on the security exercises and security bug hunts — inert demos, scored exercises and seeded defects.',
      hunts.filter((entry) => isSecurityTarget(entry.huntId)),
      labHref('hunt-sec-', '/security/exercises'),
    ),
    group(
      'events',
      'Microservices & Events',
      'Your state on the event-driven exercises and event bug hunts — practice happens in the deterministic simulator.',
      hunts.filter((entry) => isEventTarget(entry.huntId)),
      labHref('hunt-event-', '/microservices/exercises'),
    ),
  ]
}
