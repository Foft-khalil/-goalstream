// Shared in-memory health status map for IPTV channels
// Used by both the health-cron route, the channels route, and the match-stream route

type HealthStatus = 'online' | 'offline';

interface HealthEntry {
  status: HealthStatus;
  timestamp: number; // When the health was last checked
}

// Health entries expire after 30 minutes — a stream might come back online
const HEALTH_TTL = 30 * 60 * 1000; // 30 minutes in ms

const healthMap = new Map<string, HealthEntry>();

/**
 * Check if a health entry has expired (older than TTL).
 */
function isExpired(entry: HealthEntry | undefined): boolean {
  if (!entry) return true;
  return Date.now() - entry.timestamp > HEALTH_TTL;
}

/**
 * Get the health status of a channel by its stream URL.
 * Returns 'unknown' if the channel has never been checked or the entry has expired.
 */
export function getChannelHealth(url: string): 'online' | 'offline' | 'unknown' {
  const entry = healthMap.get(url);
  if (!entry || isExpired(entry)) {
    // Clean up expired entry
    if (entry) healthMap.delete(url);
    return 'unknown';
  }
  return entry.status;
}

/**
 * Set the health status of a channel by its stream URL.
 * Timestamp is automatically recorded.
 */
export function setChannelHealth(url: string, status: 'online' | 'offline'): void {
  healthMap.set(url, { status, timestamp: Date.now() });
}

/**
 * Batch set health status for multiple channels.
 * Timestamp is automatically recorded for each entry.
 */
export function setChannelHealthBatch(results: Array<{ url: string; status: 'online' | 'offline' }>): void {
  const now = Date.now();
  for (const { url, status } of results) {
    healthMap.set(url, { status, timestamp: now });
  }
}

/**
 * Get health status for multiple URLs at once.
 * Expired entries are treated as 'unknown'.
 */
export function getChannelHealthBatch(urls: string[]): Map<string, 'online' | 'offline' | 'unknown'> {
  const results = new Map<string, 'online' | 'offline' | 'unknown'>();
  for (const url of urls) {
    results.set(url, getChannelHealth(url));
  }
  return results;
}

/**
 * Get a summary of all known health statuses.
 * Expired entries are excluded from the count.
 */
export function getHealthSummary(): { total: number; online: number; offline: number } {
  let online = 0;
  let offline = 0;
  const now = Date.now();

  for (const entry of healthMap.values()) {
    if (now - entry.timestamp > HEALTH_TTL) continue; // Skip expired
    if (entry.status === 'online') online++;
    else offline++;
  }

  return { total: online + offline, online, offline };
}

/**
 * Count how many of the given URLs are known to be online.
 * Expired entries are treated as 'unknown'.
 */
export function countOnline(urls: string[]): { online: number; offline: number; unknown: number } {
  let online = 0;
  let offline = 0;
  let unknown = 0;

  for (const url of urls) {
    const status = getChannelHealth(url);
    if (status === 'online') online++;
    else if (status === 'offline') offline++;
    else unknown++;
  }

  return { online, offline, unknown };
}
