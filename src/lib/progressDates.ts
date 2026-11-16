// Date formatting for the progress dashboard (P4-M3 WP1). Pure and
// unit-testable; every formatter falls back to the raw string when the
// stored value is not a parseable ISO timestamp, so a bad row never
// crashes the page.

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** “16 Nov 2026, 14:03” — used for submission timestamps. */
export function formatProgressDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return DATE_TIME_FORMAT.format(date)
}

/** “16 Nov 2026” — used for last-submitted dates. */
export function formatProgressDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return DATE_FORMAT.format(date)
}
