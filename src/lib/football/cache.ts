/**
 * In-memory cache for football API data with TTL support.
 * Used to avoid excessive external API calls.
 */

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes in milliseconds (short for live data freshness)

const cache = new Map<string, CachedData<unknown>>();

/**
 * Get cached data if it exists and is not stale.
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
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
