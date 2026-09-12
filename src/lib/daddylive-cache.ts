/**
 * DaddyLive Schedule + Channels Cache (shared module)
 *
 * SCHEDULE SOURCE (CRITICAL — Task 23):
 * The old `schedule-generated.json` on dlive.sx is a DEAD STATIC FILE
 * (last-modified 20 March 2025) — matching against it produced zero real
 * events, which caused the "competition fallback" to fire for EVERY match
 * and show generic live TV channels playing a DIFFERENT match than clicked.
 *
 * The REAL site now renders its full daily schedule server-side in the
 * homepage HTML (https://dlive.sx/, ~1.2 MB, ~830 events/day across all
 * sports). We parse it fresh:
 *   day block:    <div class="schedule__dayTitle">Saturday 12th Sep 2026 - Schedule Time UK GMT</div>
 *   category:     <div class="schedule__category"> … <div class="card__meta">USL Super League ⚽</div>
 *   event:        <div class="schedule__eventHeader" … data-title="… 22:00">
 *                   <span class="schedule__time" data-time="22:00">22:00</span>
 *                   <span class="schedule__eventTitle">⚽ 🇺🇸 USL Super League : Tampa Bay Sun 🇺🇸 vs Fort Lauderdale United 🇺🇸</span>
 *                 <div class="schedule__channels">
 *                   <a target="_blank" href="/watch.php?id=177" title="ESPN+ USA">ESPN+ USA</a>
 *
 * Channel ids from /watch.php?id=NNN map 1:1 to the embeddable player pages
 * /stream/stream-NNN.php (verified: watch.php?id=177 iframes stream-177.php
 * and itself exposes that embed code). The watch.php page is ~25 KB while
 * stream-NNN.php is ~640 KB — so we VALIDATE health through watch.php and
 * EMBED the stream page.
 *
 * This module holds the schedule + channels data caches so they can be warmed
 * up by any route (warmup, find-stream, daddylive). All routes import the SAME
 * cache instance, so warming it up once benefits all subsequent requests.
 */

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'text/html, application/json, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

const SCHEDULE_TTL = 2 * 60 * 1000;  // 2 minutes (fresh schedule is regenerated continuously)
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

// ─── HTML helpers ────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "Saturday 12th Sep 2026 - Schedule Time UK GMT" → "2026-09-12" */
function parseDayKey(title: string): string | null {
  const m = title.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (mon === undefined) return null;
  return `${m[3]}-${String(mon + 1).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

/** Today / yesterday / tomorrow as YYYY-MM-DD (UTC) — the schedule may be off by hours (UK time). */
function allowedDayKeys(): Set<string> {
  const now = new Date();
  const keys = new Set<string>();
  for (const off of [-1, 0, 1]) {
    const t = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + off
    ));
    keys.add(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * Parse the live schedule out of the dlive.sx homepage HTML.
 * Returns the same shape as the legacy JSON: { [dayKey]: { [category]: DLEvent[] } }
 * Only day blocks within today ± 1 are kept (the page sometimes contains a
 * stale leftover day block from a previous period — that data must NEVER be
 * matched against current matches).
 */
export function parseHomepageSchedule(html: string): Record<string, Record<string, DLEvent[]>> {
  const schedule: Record<string, Record<string, DLEvent[]>> = {};
  const allowed = allowedDayKeys();

  // Locate day blocks by their title markers
  const dayTitleRe = /schedule__dayTitle">([^<]+)</g;
  const dayPositions: Array<{ pos: number; title: string }> = [];
  let dm: RegExpExecArray | null;
  while ((dm = dayTitleRe.exec(html))) {
    dayPositions.push({ pos: dm.index, title: decodeEntities(dm[1]) });
  }

  for (let i = 0; i < dayPositions.length; i++) {
    const start = dayPositions[i].pos;
    const end = i + 1 < dayPositions.length ? dayPositions[i + 1].pos : html.length;
    const dayKey = parseDayKey(dayPositions[i].title);
    if (!dayKey || !allowed.has(dayKey)) continue;

    const chunk = html.slice(start, end);
    const catChunks = chunk.split(/<div class="schedule__category[" ]/);

    for (const catChunk of catChunks.slice(1)) {
      const catM = catChunk.match(/card__meta">([^<]+)</);
      const category = decodeEntities(catM ? catM[1] : 'Unknown');

      const eventChunks = catChunk.split(/<div class="schedule__event[" ]/);
      const events: DLEvent[] = [];

      for (const evChunk of eventChunks.slice(1)) {
        const titleM = evChunk.match(/schedule__eventTitle">([\s\S]*?)<\/span>/);
        if (!titleM) continue;

        // Channels: /watch.php?id=177 (current) or /stream/stream-177.php (legacy)
        const channels: Array<{ channel_name: string; channel_id: string }> = [];
        const linkRe = /href="\/(?:watch\.php\?id=(\d+)|stream\/stream-(\d+)\.php)"[^>]*title="([^"]*)"/g;
        let lm: RegExpExecArray | null;
        while ((lm = linkRe.exec(evChunk))) {
          channels.push({ channel_id: lm[1] || lm[2], channel_name: decodeEntities(lm[3]) });
        }
        // Events with "No channels." are useless for streaming — skip them.
        if (channels.length === 0) continue;

        const timeM = evChunk.match(/data-time="(\d{1,2}:\d{2})"/);
        events.push({
          time: timeM ? timeM[1] : '',
          event: decodeEntities(titleM[1].replace(/<[^>]+>/g, '')),
          channels,
          channels2: [],
        });
      }

      if (events.length > 0) {
        if (!schedule[dayKey]) schedule[dayKey] = {};
        // Merge if the same category appears twice within one day block
        if (schedule[dayKey][category]) schedule[dayKey][category].push(...events);
        else schedule[dayKey][category] = events;
      }
    }
  }

  return schedule;
}

/**
 * Fetch the DaddyLive schedule (cached for 2 minutes).
 * Source: live homepage HTML (see module docblock — the legacy JSON is stale).
 */
export async function fetchSchedule(): Promise<Record<string, Record<string, DLEvent[]>>> {
  const cached = scheduleCache.get('schedule');
  if (cached && Date.now() - cached.timestamp < SCHEDULE_TTL) return cached.data;

  try {
    const res = await fetch('https://dlive.sx/', {
      headers: {
        ...COMMON_HEADERS,
        // A referer avoids bot-gated variants of the page
        'Referer': 'https://www.google.com/',
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    });
    if (!res.ok) return cached?.data || {};
    const html = await res.text();
    const data = parseHomepageSchedule(html);
    if (Object.keys(data).length === 0) {
      // Parsing produced nothing usable — keep serving the last good copy if any
      return cached?.data || {};
    }
    scheduleCache.set('schedule', { data, timestamp: Date.now() });
    return data;
  } catch {
    return cached?.data || {};
  }
}

/**
 * Build the embeddable player page for a DaddyLive channel id.
 *
 * watch.php ids map 1:1 to stream ids (verified: watch.php?id=177 iframes
 * stream-177.php). We embed the stream page DIRECTLY (it is the raw player,
 * ~640 KB with ads) — exactly the page tarjetarojaenvivo-style sites embed:
 *   our iframe (referer = our origin, non-empty → real player, no X-Frame-Options)
 *   └─ dlive.sx/stream/stream-NNN.php
 *      └─ hamis…/premiumtv/daddyX.php?id=N (referer = dlive.sx → 200)
 *         └─ Clappr → m3u8 resolved client-side in the user's browser
 */
export function buildEmbedUrl(channelId: string | number): string {
  return `https://dlive.sx/stream/stream-${channelId}.php`;
}

/**
 * LIGHT health-check URL for a channel id (~25 KB vs ~640 KB).
 * Contains the player marker iff the channel exists — used by the routes'
 * validateEmbedHealth instead of downloading the full stream page.
 */
export function buildWatchUrl(channelId: string | number): string {
  return `https://dlive.sx/watch.php?id=${channelId}`;
}

/**
 * Fetch the DaddyLive channels data (cached for 30 minutes).
 *
 * NOTE (Task 23): this dataset is only used as a BEST-EFFORT logo/group
 * lookup now. The published copy is often stale (old numbering, dead
 * dlhd.click URLs) — never use its stream URLs, only tvg_logo/group_title,
 * and always resolved by exact channel NAME, not by id.
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
