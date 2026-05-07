/**
 * localStorage boot-cache with per-collection TTL.
 *
 * Purpose: rehydrate React state instantly on startup so there is no
 * empty-UI flash while the Firestore onSnapshot listener connects.
 * The real-time listener always wins — cache is only for cold-start speed.
 *
 * TTL strategy (industry standard for collaborative desktop apps):
 *  - Volatile data (events, tracker entries): 24 h
 *  - Semi-static config (subcalendars, trackers, countdowns): 7 days
 *  - User/member profiles: 1 h (handled by AuthContext separately)
 *
 * Cache keys are scoped per spaceId so switching spaces never shows
 * stale data from a previous space.
 */

export const CACHE_TTL = {
  events:         24 * 60 * 60 * 1000,      // 24 h
  subCalendars:    7 * 24 * 60 * 60 * 1000, // 7 days
  trackers:        7 * 24 * 60 * 60 * 1000, // 7 days
  trackerEntries: 24 * 60 * 60 * 1000,      // 24 h
  countdowns:      7 * 24 * 60 * 60 * 1000, // 7 days
  kanbanBoards:    7 * 24 * 60 * 60 * 1000, // 7 days
  kanbanColumns:   7 * 24 * 60 * 60 * 1000, // 7 days
  kanbanCards:    24 * 60 * 60 * 1000,      // 24 h
} as const

export type CacheKey = keyof typeof CACHE_TTL

interface CacheEntry<T> {
  data: T
  cachedAt: number
  spaceId: string
}

function storageKey(collection: CacheKey, spaceId: string) {
  return `cache:${collection}:${spaceId}`
}

/** Write data to localStorage cache with a timestamp. */
export function writeCache<T>(collection: CacheKey, spaceId: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now(), spaceId }
    localStorage.setItem(storageKey(collection, spaceId), JSON.stringify(entry))
  } catch {
    // Storage quota exceeded or unavailable — silent fail, cache is best-effort
  }
}

/**
 * Read from cache. Returns null if:
 *  - Nothing cached
 *  - Data is older than the collection's TTL
 *  - spaceId doesn't match (different space)
 */
export function readCache<T>(collection: CacheKey, spaceId: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(collection, spaceId))
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (entry.spaceId !== spaceId) return null
    if (Date.now() - entry.cachedAt > CACHE_TTL[collection]) {
      localStorage.removeItem(storageKey(collection, spaceId))
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

/** Immediately evict a collection's cache entry (call on any write). */
export function invalidateCache(collection: CacheKey, spaceId: string): void {
  try {
    localStorage.removeItem(storageKey(collection, spaceId))
  } catch {}
}

/** Evict all cache entries for a space (e.g. on sign-out). */
export function clearSpaceCache(spaceId: string): void {
  const keys = Object.keys(CACHE_TTL) as CacheKey[]
  keys.forEach(k => invalidateCache(k, spaceId))
}
