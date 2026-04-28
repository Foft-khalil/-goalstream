// Shared in-memory health status map for IPTV channels
// Used by both the health-cron route and the channels route

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
