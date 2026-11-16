import { createElement } from 'react'
// SSR markup tests for the schema explorer.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SchemaExplorer } from '../../src/features/database/SchemaExplorer'
import type { SchemaInfo } from '../../src/shared/sql'

const noop = () => {}

const schema: SchemaInfo = {
  sqliteVersion: '3.54.1',
  tables: [
    {
      name: 'orders',
      ddl: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, customer_id INTEGER NOT NULL REFERENCES customers(id), status TEXT NOT NULL)',
      columns: [
        { name: 'id', type: 'INTEGER', notNull: true, primaryKey: true, defaultValue: null },
        { name: 'order_number', type: 'TEXT', notNull: true, primaryKey: false, defaultValue: null },
        { name: 'status', type: 'TEXT', notNull: true, primaryKey: false, defaultValue: null },
      ],
      indexes: [
        { name: 'idx_orders_customer', columns: ['customer_id'], unique: false, partial: false },
      ],
      foreignKeys: [{ from: 'customer_id', table: 'customers', to: 'id' }],
      constraints: [
        { kind: 'unique', detail: 'order_number' },
        { kind: 'check', detail: "status IN ('pending','placed')" },
      ],
    },
  ],
}

describe('SchemaExplorer', () => {
  it('renders the table toggle and version line with details collapsed by default', () => {
    const markup = renderToStaticMarkup(
      createElement(SchemaExplorer, { schema, loading: false, collapsed: false, onToggleCollapsed: noop }),
    )
    expect(markup).toContain('Schema explorer')
    expect(markup).toContain('1 tables')
    expect(markup).toContain('sqlite 3.54.1')
    expect(markup).toContain('orders')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('3 cols · PK id')
  })

  it('expands nothing by default but exposes the toggle with aria-expanded', () => {
    const markup = renderToStaticMarkup(
      createElement(SchemaExplorer, { schema, loading: false, collapsed: false, onToggleCollapsed: noop }),
    )
    expect(markup).toContain('aria-expanded="false"')
  })

  it('hides the body entirely when collapsed', () => {
    const markup = renderToStaticMarkup(
      createElement(SchemaExplorer, { schema, loading: false, collapsed: true, onToggleCollapsed: noop }),
    )
    expect(markup).toContain('Expand')
    expect(markup).not.toContain('idx_orders_customer')
  })

  it('shows the loading state while the schema is in flight', () => {
    const markup = renderToStaticMarkup(
      createElement(SchemaExplorer, { schema: null, loading: true, collapsed: false, onToggleCollapsed: noop }),
    )
    expect(markup).toContain('Reading the schema')
  })
})
