// Shared in-memory health status map for IPTV channels
// Used by both the health-cron route, the channels route, and the match-stream route

type HealthStatus = 'online' | 'offline';

const healthMap = new Map<string, HealthStatus>();

/**
 * Get the health status of a channel by its stream URL.
 * Returns 'unknown' if the channel has never been checked.
 */
export function getChannelHealth(url: string): 'online' | 'offline' | 'unknown' {
  const status = healthMap.get(url);
  return status ?? 'unknown';
}

/**
 * Set the health status of a channel by its stream URL.
 */
export function setChannelHealth(url: string, status: 'online' | 'offline'): void {
  healthMap.set(url, status);
}

/**
 * Batch set health status for multiple channels.
 */
export function setChannelHealthBatch(results: Array<{ url: string; status: 'online' | 'offline' }>): void {
  for (const { url, status } of results) {
    healthMap.set(url, status);
  }
}

/**
 * Get health status for multiple URLs at once.
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
 */
export function getHealthSummary(): { total: number; online: number; offline: number } {
  let online = 0;
  let offline = 0;

  for (const status of healthMap.values()) {
    if (status === 'online') online++;
    else offline++;
  }

  return { total: healthMap.size, online, offline };
}

/**
 * Count how many of the given URLs are known to be online.
 */
export function countOnline(urls: string[]): { online: number; offline: number; unknown: number } {
  let online = 0;
  let offline = 0;
  let unknown = 0;

  for (const url of urls) {
    const status = healthMap.get(url);
    if (status === 'online') online++;
    else if (status === 'offline') offline++;
    else unknown++;
  }

  return { online, offline, unknown };
}
