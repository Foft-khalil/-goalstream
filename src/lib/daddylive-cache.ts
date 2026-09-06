/**
 * DaddyLive Schedule + Channels Cache (shared module)
 *
 * This module holds the schedule + channels data caches so they can be warmed up
 * by any route (warmup, find-stream, daddylive). All routes import the SAME cache
 * instance, so warming it up once benefits all subsequent requests.
 */

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/html, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

const SCHEDULE_TTL = 2 * 60 * 1000;  // 2 minutes
const CHANNELS_TTL = 30 * 60 * 1000; // 30 minutes

// Module-level caches (shared across all routes in the same Node.js process)
// Use globalThis to survive HMR (Hot Module Replacement) in dev mode — without this,
// each route handler would get its own cache instance in dev mode, defeating the warmup.
const g = globalThis as unknown as {
  __dlScheduleCache?: Map<string, { data: any; timestamp: number }>;
  __dlChannelsCache?: Map<string, { data: any; timestamp: number }>;
};
if (!g.__dlScheduleCache) g.__dlScheduleCache = new Map();
if (!g.__dlChannelsCache) g.__dlChannelsCache = new Map();
export const scheduleCache = g.__dlScheduleCache;
export const channelsCache = g.__dlChannelsCache;

export interface DLChannelData {
  group_title: string;
  tvg_id: string;
  tvg_logo: string;
  channel_url: string;
  stream_url: string;
}

export interface DLEvent {
  time: string;
  event: string;
  channels: Array<{ channel_name: string; channel_id: string }>;
  channels2: Array<{ channel_name: string; channel_id: string }>;
}

/**
 * Fetch the DaddyLive schedule (cached for 2 minutes).
 */
export async function fetchSchedule(): Promise<Record<string, Record<string, DLEvent[]>>> {
  const cached = scheduleCache.get('schedule');
  if (cached && Date.now() - cached.timestamp < SCHEDULE_TTL) return cached.data;

  try {
    const res = await fetch('https://dlhd.st/schedule/schedule-generated.json', {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return cached?.data || {};
    const data = await res.json();
    scheduleCache.set('schedule', { data, timestamp: Date.now() });
    return data;
  } catch {
    return cached?.data || {};
  }
}

/**
 * Fetch the DaddyLive channels data (cached for 30 minutes).
 */
export async function fetchChannelsData(): Promise<Record<string, DLChannelData>> {
  const cached = channelsCache.get('channels');
  if (cached && Date.now() - cached.timestamp < CHANNELS_TTL) return cached.data;

  try {
    const res = await fetch(
      'https://raw.githubusercontent.com/nightah/daddylive/main/daddylive-channels-data.json',
      { headers: COMMON_HEADERS, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return cached?.data || {};
    const data = await res.json();
    const channels: Record<string, DLChannelData> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'GLOBAL_OPTIONS') continue;
      if (typeof value === 'object' && value !== null && 'stream_url' in (value as any)) {
        channels[key] = value as DLChannelData;
      }
    }
    channelsCache.set('channels', { data: channels, timestamp: Date.now() });
    return channels;
  } catch {
    return cached?.data || {};
  }
}

/**
 * Pre-warm both caches. Safe to call multiple times — only fetches if cache is cold/stale.
 * Returns true if both caches are now warm.
 */
export async function warmupCaches(): Promise<boolean> {
  try {
    const [schedule, channels] = await Promise.all([fetchSchedule(), fetchChannelsData()]);
    return Object.keys(schedule).length > 0 && Object.keys(channels).length > 0;
  } catch {
    return false;
  }
}
