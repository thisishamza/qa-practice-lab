// Presentational state contract for the /progress dashboard (P4-M3 WP1+WP2).
// Lives in a pure .ts module (not the .tsx view) so server-side and test
// projects without JSX can type-check modules that import it.

import type { ProgressResponse } from '../../shared/learning'

export type ProgressDashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  | {
      status: 'ready'
      data: ProgressResponse
      refreshing: boolean
      onRefresh: () => void
      /** Set when a refresh failed but a previously rendered payload is shown. */
      refreshError?: string | null
    }
