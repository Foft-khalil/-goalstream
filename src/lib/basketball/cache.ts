/**
 * In-memory cache for basketball API data with TTL support.
 */

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for non-live data
const LIVE_CACHE_TTL = 15 * 1000; // 15 seconds for live match data

const cache = new Map<string, CachedData<unknown>>();

export function getCached<T>(key: string, hasLiveMatches?: boolean): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const ttl = hasLiveMatches ? LIVE_CACHE_TTL : CACHE_TTL;
  const age = Date.now() - entry.timestamp;
  if (age > ttl) return null;

  return entry.data as T;
}

export function getCachedStale<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function getCacheAge(key: string): number | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return Math.floor((Date.now() - entry.timestamp) / 1000);
}
