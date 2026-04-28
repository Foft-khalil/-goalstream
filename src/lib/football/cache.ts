/**
 * In-memory cache for football API data with TTL support.
 * Used to avoid excessive external API calls.
 */

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for non-live data
const LIVE_CACHE_TTL = 45 * 1000; // 45 seconds for live match data (fresher scores/clock)

const cache = new Map<string, CachedData<unknown>>();

/**
 * Get cached data if it exists and is not stale.
 * If hasLiveMatches is true, uses shorter TTL for fresher data.
 */
export function getCached<T>(key: string, hasLiveMatches?: boolean): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const ttl = hasLiveMatches ? LIVE_CACHE_TTL : CACHE_TTL;
  const age = Date.now() - entry.timestamp;
  if (age > ttl) {
    // Stale but we keep it for fallback
    return null;
  }

  return entry.data as T;
}

/**
 * Get cached data even if stale (for fallback on errors).
 */
export function getCachedStale<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.data as T;
}

/**
 * Set cache entry with current timestamp.
 */
export function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Get cache age in seconds (for debugging / headers).
 */
export function getCacheAge(key: string): number | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return Math.floor((Date.now() - entry.timestamp) / 1000);
}
