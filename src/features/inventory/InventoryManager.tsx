// Staff-only inventory manager — the interactive half of /admin/inventory.
// The API enforces authorization; this component only renders what the
// server returns and never claims a restock worked before the response is
// in. Each row is its own mini form with inline errors and a single clear
// outcome region (role="status" for success, role="alert" for failure).

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AdminInventoryItem } from '../../shared/commerce'
import { MAX_ADJUSTMENT_NOTE_LENGTH, MAX_RESTOCK_QUANTITY } from '../../shared/commerce'
import { fetchStaffInventory, restockProduct, InventoryApiError } from './api'
import { stockStatusLabels } from '../../lib/shop'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; items: AdminInventoryItem[] }
  | { status: 'error'; message: string }

interface RowFeedback {
  kind: 'success' | 'error'
  message: string
}

function summaryLine(items: AdminInventoryItem[]): string {
  const low = items.filter((item) => item.stockStatus === 'low_stock').length
  const out = items.filter((item) => item.stockStatus === 'out_of_stock').length
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  return `${items.length} products · ${totalUnits.toLocaleString()} units on hand · ${low} low · ${out} out of stock`
}

export function InventoryManager() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [rowUnits, setRowUnits] = useState<Record<number, string>>({})
  const [rowNote, setRowNote] = useState<Record<number, string>>({})
  const [rowBusy, setRowBusy] = useState<number | null>(null)
  const [rowFeedback, setRowFeedback] = useState<Record<number, RowFeedback>>({})

  useEffect(() => {
    const controller = new AbortController()
    fetchStaffInventory(controller.signal)
      .then(({ items }) => setState({ status: 'ready', items }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          message:
            error instanceof InventoryApiError
              ? error.message
              : 'The staff inventory could not be loaded.',
        })
      })
    return () => controller.abort()
  }, [attempt])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  if (state.status === 'loading') {
    return <LoadingState label="Loading staff inventory…" />
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="The inventory could not be loaded"
        description={
          <>
            {state.message} If your staff session was revoked or suspended, sign in again.
          </>
        }
        action={
          <Button size="sm" onClick={retry}>
            <Icon name="reset" size={16} />
            Try again
          </Button>
        }
      />
    )
  }

  const normalized = query.trim().toLowerCase()
  const visible = normalized
    ? state.items.filter(
        (item) =>
          item.name.toLowerCase().includes(normalized) ||
          item.slug.includes(normalized) ||
          item.categoryName.toLowerCase().includes(normalized),
      )
    : state.items

  async function handleRestock(event: FormEvent<HTMLFormElement>, item: AdminInventoryItem) {
    event.preventDefault()
    const unitsRaw = rowUnits[item.productId] ?? ''
    const note = (rowNote[item.productId] ?? '').trim()

    const quantity = Number(unitsRaw)
    const clientError = (message: string) =>
      setRowFeedback((previous) => ({ ...previous, [item.productId]: { kind: 'error', message } }))

    if (unitsRaw.trim() === '') {
      clientError('Enter how many units to add.')
      return
    }
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
      clientError('Enter a whole number of units.')
      return
    }
    if (quantity < 1) {
      clientError('Restock at least 1 unit.')
      return
    }
    if (quantity > MAX_RESTOCK_QUANTITY) {
      clientError(`Restock at most ${MAX_RESTOCK_QUANTITY.toLocaleString()} units per adjustment.`)
      return
    }
    if (note.length > MAX_ADJUSTMENT_NOTE_LENGTH) {
      clientError(`Keep the note under ${MAX_ADJUSTMENT_NOTE_LENGTH} characters.`)
      return
    }

    setRowBusy(item.productId)
    setRowFeedback((previous) => {
      const next = { ...previous }
      delete next[item.productId]
      return next
    })

    try {
      const result = await restockProduct(item.productId, {
        quantity,
        ...(note ? { note } : {}),
      })
      // Only now does the UI show the new quantity — the server answered.
      setState((previous) =>
        previous.status === 'ready'
          ? {
              status: 'ready',
              items: previous.items.map((entry) =>
                entry.productId === result.inventory.productId ? result.inventory : entry,
              ),
            }
          : previous,
      )
      setRowUnits((previous) => ({ ...previous, [item.productId]: '' }))
      setRowNote((previous) => ({ ...previous, [item.productId]: '' }))
      setRowFeedback((previous) => ({
        ...previous,
        [item.productId]: {
          kind: 'success',
          message: `Restocked +${result.adjustment.quantityDelta} units — ${result.inventory.quantity.toLocaleString()} now on hand (recorded by adjustment #${result.adjustment.id}).`,
        },
      }))
    } catch (error) {
      const message =
        error instanceof InventoryApiError
          ? (error.fields?.quantity ?? error.fields?.note ?? error.message)
          : 'The restock could not be applied. Please try again.'
      setRowFeedback((previous) => ({
        ...previous,
        [item.productId]: { kind: 'error', message },
      }))
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <>
      <div className="admin-inventory-toolbar">
        <label className="admin-inventory-search">
          <span className="sr-only">Filter products by name, slug or category</span>
          <Icon name="search" size={16} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, slug or category…"
            autoComplete="off"
          />
        </label>
        <p className="catalogue-counts" role="status">
          {summaryLine(state.items)}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches that filter"
          description="No product name, slug or category contains that text. Clear the filter to see every product."
          icon="search"
        />
      ) : (
        <ul className="admin-inventory-list">
          {visible.map((item) => {
            const unitsId = `restock-units-${item.productId}`
            const noteId = `restock-note-${item.productId}`
            const feedbackId = `restock-feedback-${item.productId}`
            const feedback = rowFeedback[item.productId]
            const busy = rowBusy === item.productId
            const unitsValue = rowUnits[item.productId] ?? ''
            const noteValue = rowNote[item.productId] ?? ''

            return (
              <li key={item.productId} className="admin-inventory-row">
                <div className="admin-inventory-identity">
                  <Link className="admin-inventory-name" to={`/shop/products/${item.slug}`}>
                    {item.name}
                  </Link>
                  <p className="admin-inventory-meta">
                    {item.slug} · {item.categoryName}
                    {!item.active ? ' · Discontinued' : ''}
                  </p>
                  <span className={`stock-tag stock-${item.stockStatus}`}>
                    <span className="stock-dot" aria-hidden="true" />
                    {stockStatusLabels[item.stockStatus]}
                  </span>
                </div>

                <p className="admin-inventory-onhand" aria-label={`${item.quantity} units on hand`}>
                  <span className="admin-inventory-onhand-value">{item.quantity.toLocaleString()}</span>
                  <span className="admin-inventory-onhand-label">units on hand</span>
                </p>

                <form
                  className="admin-inventory-form"
                  noValidate
                  onSubmit={(event) => void handleRestock(event, item)}
                  aria-describedby={feedback ? feedbackId : undefined}
                >
                  <div className="admin-inventory-inputs">
                    <div className="admin-inventory-field">
                      <label htmlFor={unitsId}>Units to add</label>
                      <input
                        id={unitsId}
                        name="quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_RESTOCK_QUANTITY}
                        step={1}
                        required
                        disabled={busy}
                        value={unitsValue}
                        onChange={(event) =>
                          setRowUnits((previous) => ({
                            ...previous,
                            [item.productId]: event.target.value,
                          }))
                        }
                        aria-describedby={feedback ? feedbackId : undefined}
                        aria-invalid={feedback?.kind === 'error' ? true : undefined}
                      />
                    </div>
                    <div className="admin-inventory-field admin-inventory-field-note">
                      <label htmlFor={noteId}>
                        Note <span className="admin-inventory-optional">(optional)</span>
                      </label>
                      <input
                        id={noteId}
                        name="note"
                        type="text"
                        autoComplete="off"
                        maxLength={MAX_ADJUSTMENT_NOTE_LENGTH}
                        disabled={busy}
                        placeholder="e.g. stocktake recount"
                        value={noteValue}
                        onChange={(event) =>
                          setRowNote((previous) => ({
                            ...previous,
                            [item.productId]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" size="sm" loading={busy} disabled={busy}>
                    <Icon name="plus" size={16} />
                    {busy ? 'Restocking…' : 'Restock'}
                  </Button>
                  {feedback ? (
                    <p
                      id={feedbackId}
                      className={
                        feedback.kind === 'success' ? 'admin-inventory-success' : 'cart-line-note'
                      }
                      role={feedback.kind === 'success' ? 'status' : 'alert'}
                    >
                      <Icon
                        name={feedback.kind === 'success' ? 'check' : 'alert'}
                        size={16}
                      />
                      <span>{feedback.message}</span>
                    </p>
                  ) : null}
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
