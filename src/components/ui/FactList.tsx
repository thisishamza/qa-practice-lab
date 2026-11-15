import type { ReactNode } from 'react'

export interface FactItem {
  label: ReactNode
  value: ReactNode
}

/**
 * Test-report style fact rows: mono key on the left, value on the right,
 * hairline row dividers. Renders a real description list.
 */
export function FactList({ items, className }: { items: FactItem[]; className?: string }) {
  return (
    <dl className={['fact-list', className].filter(Boolean).join(' ')}>
      {items.map((item, index) => (
        <div key={index}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
