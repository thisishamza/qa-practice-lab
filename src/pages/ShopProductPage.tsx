import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Product } from '../shared/commerce'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { ProductDetail } from '../features/shop/ProductDetail'
import { ProductLoading, ProductNotFound, ProductError } from '../features/shop/ProductStates'
import { fetchProduct, ShopApiError } from '../features/shop/api'

type ProductState =
  | { status: 'loading' }
  | { status: 'ready'; product: Product | null }
  | { status: 'error'; message: string }

export function ShopProductPage() {
  const { slug } = useParams<{ slug: string }>()

  // The result is keyed to the slug + attempt that produced it; a mismatch
  // means a fetch is in flight (loading state is derived, never stored).
  const [loaded, setLoaded] = useState<{ key: string; state: ProductState } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const fetchKey = `${slug ?? ''}#${attempt}`
  const state: ProductState = !slug
    ? { status: 'ready', product: null }
    : loaded && loaded.key === fetchKey
      ? loaded.state
      : { status: 'loading' }

  useEffect(() => {
    if (!slug) {
      return
    }

    const controller = new AbortController()

    fetchProduct(slug, controller.signal)
      .then((product) =>
        setLoaded({ key: fetchKey, state: { status: 'ready', product } }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({
          key: fetchKey,
          state: {
            status: 'error',
            message:
              error instanceof ShopApiError
                ? error.message
                : 'That product could not be loaded.',
          },
        })
      })

    return () => controller.abort()
  }, [slug, fetchKey])

  const product = state.status === 'ready' ? state.product : null
  useDocumentTitle(product ? product.name : 'Shop')

  const title =
    state.status === 'loading'
      ? 'Loading product…'
      : state.status === 'error'
        ? 'Product unavailable'
        : (product?.name ?? 'Product not found')

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Practice App' }, { label: 'Storefront', to: '/shop' },
          { label: title },
        ]}
      />

      <PageHeader
        eyebrow={
          product ? `Meridian Outfitters · ${product.categoryName}` : 'Meridian Outfitters'
        }
        title={title}
      />

      {state.status === 'loading' ? <ProductLoading /> : null}

      {state.status === 'error' ? (
        <ProductError message={state.message} onRetry={() => setAttempt((value) => value + 1)} />
      ) : null}

      {state.status === 'ready' && product === null ? <ProductNotFound /> : null}

      {product ? <ProductDetail product={product} /> : null}
    </div>
  )
}
