// Fetches the canonical practice seed once per browser session and caches it.
// The response is synthetic training data; fetching is same-origin only.

export const SEED_URL = '/datasets/meridian-outfitters.sql'

let cached: Promise<string> | null = null

export function fetchSeedSql(): Promise<string> {
  if (!cached) {
    cached = fetch(SEED_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`The practice dataset failed to load (HTTP ${response.status}). Check your connection and reload.`)
        }
        return response.text()
      })
      .catch((error: unknown) => {
        // Never poison the cache — HTTP errors AND network failures
        // both allow the next call to retry cleanly.
        cached = null
        if (error instanceof Error) {
          throw error
        }
        throw new Error('The practice dataset failed to load. Check your connection and try again.')
      })
  }
  return cached
}

/** Test-only: reset the memoized seed. */
export function __resetSeedCacheForTests(): void {
  cached = null
}
