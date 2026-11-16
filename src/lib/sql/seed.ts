// Fetches the canonical practice seed once per browser session and caches it.
// The response is synthetic training data; fetching is same-origin only.

export const SEED_URL = '/datasets/meridian-outfitters.sql'

let cached: Promise<string> | null = null

export function fetchSeedSql(): Promise<string> {
  if (!cached) {
    cached = fetch(SEED_URL).then((response) => {
      if (!response.ok) {
        // Allow a retry after a transient failure instead of poisoning the cache.
        cached = null
        throw new Error(`The practice dataset failed to load (HTTP ${response.status}). Check your connection and reload.`)
      }
      return response.text()
    })
  }
  return cached
}

/** Test-only: reset the memoized seed. */
export function __resetSeedCacheForTests(): void {
  cached = null
}
