import { Link } from 'react-router-dom'
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'

/** Loading row for the product route; the page header owns the h1. */
export function ProductLoading() {
  return <LoadingState label="Loading product…" />
}

/** 404 view — the slug is unknown to the API or the product is inactive. */
export function ProductNotFound() {
  return (
    <EmptyState
      title="We could not find that product"
      description="It may have been renamed, retired from the catalogue, or the link may be wrong."
      icon="shop"
      action={
        <Link className="button" to="/shop">
          Back to the shop
        </Link>
      }
    />
  )
}

/** Network/HTTP failure view with a retry path. */
export function ProductError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <ErrorState
      title="That product could not be loaded"
      description={message}
      action={
        <Button size="sm" onClick={onRetry}>
          <Icon name="reset" size={16} />
          Try again
        </Button>
      }
    />
  )
}
