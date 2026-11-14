import type { ReactNode } from 'react'
import type { IconName } from '../../data/types'

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  tracks: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  ),
  scenarios: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a3 3 0 0 1 6 0" />
      <path d="M9 11h6M9 15h6" />
    </>
  ),
  guides: (
    <>
      <path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2Z" />
      <path d="M4 19a2 2 0 0 1 2-2h12" />
    </>
  ),
  progress: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      <path d="m17 6 3-3 2 2" />
    </>
  ),
  practice: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </>
  ),
  manual: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a3 3 0 0 1 6 0" />
      <path d="M9 11h6M9 15h6" />
    </>
  ),
  api: (
    <>
      <path d="M9 3v5M15 3v5" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8Z" />
      <path d="M12 17v4" />
    </>
  ),
  ui: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  'api-automation': (
    <>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
      <path d="m13 6-2 12" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  contract: (
    <>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5" />
      <path d="m9.5 14 2 2 4-4" />
    </>
  ),
  performance: (
    <>
      <path d="M4 19a8 8 0 1 1 16 0" />
      <path d="m12 19 4.5-5.5" />
      <circle cx="12" cy="19" r="1.2" />
    </>
  ),
  security: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  microservices: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </>
  ),
  async: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  auth: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9M17 17l2-2M14 14l2-2" />
    </>
  ),
  accessibility: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 7v6" />
      <path d="m5 10 7 2 7-2" />
      <path d="m9 21 3-6 3 6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
  'arrow-right': <path d="M4 12h16M14 6l6 6-6 6" />,
  book: (
    <>
      <path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2Z" />
      <path d="M8 7h6" />
    </>
  ),
  bug: (
    <>
      <rect x="8" y="8" width="8" height="12" rx="4" />
      <path d="M8 12H4M20 12h-4M8 16H4M20 16h-4M12 8V5M9 5l3 2 3-2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  ),
  'panel-left': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  )
}
