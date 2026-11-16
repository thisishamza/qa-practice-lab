interface SampleQuery {
  label: string
  sql: string
}

const SAMPLES: readonly SampleQuery[] = [
  {
    label: 'Preview the catalogue',
    sql: `SELECT p.name, c.name AS category, p.price_cents / 100.0 AS price
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.active = 1
ORDER BY p.name
LIMIT 5;`,
  },
  {
    label: 'Revenue by category',
    sql: `SELECT c.name AS category,
       SUM(oi.quantity * oi.unit_price_cents) / 100.0 AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN categories c ON c.id = p.category_id
GROUP BY c.name
ORDER BY revenue DESC;`,
  },
  {
    label: 'Latest orders with totals',
    sql: `SELECT order_number, status, total_cents / 100.0 AS total, placed_at
FROM orders
ORDER BY placed_at DESC
LIMIT 5;`,
  },
  {
    label: 'Orders without any items',
    sql: `SELECT o.order_number, o.status, o.total_cents / 100.0 AS total
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id);`,
  },
  {
    label: 'Duplicate customer emails (case-insensitive)',
    sql: `SELECT lower(email) AS email, COUNT(*) AS accounts
FROM customers
GROUP BY lower(email)
HAVING COUNT(*) > 1
ORDER BY accounts DESC;`,
  },
  {
    label: 'Stale pending orders',
    sql: `SELECT order_number, status, total_cents / 100.0 AS total, placed_at
FROM orders
WHERE status IN ('pending', 'placed')
  AND placed_at < '2026-10-17T00:00:00Z'
ORDER BY placed_at;`,
  },
]

interface SampleQueriesProps {
  onInsert: (sql: string) => void
  disabled?: boolean
}

/** Starter templates — clicking one replaces the editor contents. */
export function SampleQueries({ onInsert, disabled = false }: SampleQueriesProps) {
  return (
    <div className="sql-samples">
      <p className="sql-samples-title">Starter queries</p>
      <div className="sql-samples-list">
        {SAMPLES.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="sql-sample-button"
            disabled={disabled}
            onClick={() => onInsert(sample.sql)}
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  )
}
