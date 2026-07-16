import { NextRequest, NextResponse } from 'next/server';

/**
 * DaddyLive API Route
 *
 * Fetches free sports streams from DaddyLive (dlhd.st):
 * 1. Schedule JSON → maps events to channel IDs
 * 2. Channels Data JSON → maps channel IDs to direct m3u8 stream URLs
 *
 * All streams are returned as playable URLs:
 * - m3u8 URLs: played directly in-app via HLS.js through stream-proxy
 * - embed URLs: played in-app via proxy-stream iframe (no external redirects)
 *
 * Stream health is validated server-side: broken m3u8 streams are automatically filtered.
 */

// ─── Types ──────────────────────────────────────────────────────────────────
interface DLChannel {
  channel_name: string;
  channel_id: string;
}

interface DLEvent {
  time: string;
  event: string;
  channels: DLChannel[];
  channels2: DLChannel[];
}

interface DLChannelData {
  group_title: string;
  tvg_id: string;
  tvg_logo: string;
  channel_url: string;
  stream_url: string;
}

interface MatchedStream {
  channelName: string;
  channelId: string;
  streamUrl: string;
  channelLogo: string;
  groupTitle: string;
  eventTime: string;
  eventName: string;
  sport: string;
}

// ─── Cache ──────────────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const SCHEDULE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const CHANNELS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes (channels change less often)

const scheduleCache = new Map<string, CacheEntry<Record<string, Record<string, DLEvent[]>>>>();
const channelsCache = new Map<string, CacheEntry<Record<string, DLChannelData>>>();

// Stream health cache: URL → { valid, timestamp }
interface HealthEntry {
  valid: boolean;
  timestamp: number;
}
const streamHealthCache = new Map<string, HealthEntry>();
const HEALTH_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/html, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

// ─── Validate m3u8 stream health ─────────────────────────────────────────────
async function validateStreamHealth(url: string): Promise<boolean> {
  // Check cache first
  const cached = streamHealthCache.get(url);
  if (cached && Date.now() - cached.timestamp < HEALTH_CACHE_TTL) {
    return cached.valid;
  }

  try {
    // For m3u8 URLs, try a HEAD request first, then GET if needed
    const isM3u8 = url.includes('.m3u8');

    if (isM3u8) {
      // Determine the correct Origin header
      let origin = '';
      try {
        const hostname = new URL(url).hostname;
        if (hostname.includes('newkso.ru')) {
          origin = 'https://jxoxkplay.xyz';
        } else if (hostname.includes('fubo') || hostname.includes('fltvhd') || hostname.includes('futbolonlinehd')) {
          origin = 'https://fltvhd.com';
        }
      } catch {}

      const headers: Record<string, string> = {
        ...COMMON_HEADERS,
        'Accept': '*/*',
        ...(origin ? { 'Origin': origin, 'Referer': `${origin}/` } : {}),
      };

      const res = await fetch(url, {
        method: 'GET', // Some servers don't support HEAD
        headers,
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      });

      // Valid if we get 200 and it's an m3u8 or similar content
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const text = await res.text();
        const isValid = text.includes('#EXTM3U') || text.includes('#EXTINF') ||
                       contentType.includes('mpegurl') || contentType.includes('octet-stream');
        streamHealthCache.set(url, { valid: isValid, timestamp: Date.now() });
        return isValid;
      }

      // 403 might mean Cloudflare is blocking from server but stream exists
      // Don't mark as invalid - let the client try via proxy
      if (res.status === 403) {
        streamHealthCache.set(url, { valid: true, timestamp: Date.now() });
        return true;
      }

      streamHealthCache.set(url, { valid: false, timestamp: Date.now() });
      return false;
    } else {
      // For embed URLs, just check if the page is reachable
      const res = await fetch(url, {
        method: 'HEAD',
        headers: COMMON_HEADERS,
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      });

      const valid = res.ok || res.status === 403; // 403 = Cloudflare but page exists
      streamHealthCache.set(url, { valid, timestamp: Date.now() });
      return valid;
    }
  } catch {
    // Network error - might be temporary, give benefit of the doubt
    // Only mark as invalid if we've seen it fail before
    const cached = streamHealthCache.get(url);
    if (cached && !cached.valid) return false;
    // First failure - don't cache, let client try
    return true;
  }
}

// ─── Fetch schedule from dlhd.st ────────────────────────────────────────────
async function fetchSchedule(): Promise<Record<string, Record<string, DLEvent[]>>> {
  const cacheKey = 'schedule';
  const cached = scheduleCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SCHEDULE_CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log('[DaddyLive API] Fetching schedule...');
    const res = await fetch('https://dlhd.st/schedule/schedule-generated.json', {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[DaddyLive API] Schedule returned HTTP ${res.status}`);
      return cached?.data || {};
    }

    const data = await res.json();
    scheduleCache.set(cacheKey, { data, timestamp: Date.now() });
    console.log(`[DaddyLive API] Fetched schedule with ${Object.keys(data).length} days`);
    return data;
  } catch (err) {
    console.warn('[DaddyLive API] Error fetching schedule:', err);
    return cached?.data || {};
  }
}

// ─── Fetch channels data from GitHub ────────────────────────────────────────
async function fetchChannelsData(): Promise<Record<string, DLChannelData>> {
  const cacheKey = 'channels';
  const cached = channelsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CHANNELS_CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log('[DaddyLive API] Fetching channels data...');
    const res = await fetch(
      'https://raw.githubusercontent.com/nightah/daddylive/main/daddylive-channels-data.json',
      {
        headers: COMMON_HEADERS,
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      console.warn(`[DaddyLive API] Channels data returned HTTP ${res.status}`);
      return cached?.data || {};
    }

    const data = await res.json();

    // Remove GLOBAL_OPTIONS key as it's not a channel
    const channels: Record<string, DLChannelData> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'GLOBAL_OPTIONS') continue;
      if (typeof value === 'object' && value !== null && 'stream_url' in (value as any)) {
        channels[key] = value as DLChannelData;
      }
    }

    channelsCache.set(cacheKey, { data: channels, timestamp: Date.now() });
    console.log(`[DaddyLive API] Fetched ${Object.keys(channels).length} channels`);
    return channels;
  } catch (err) {
    console.warn('[DaddyLive API] Error fetching channels data:', err);
    return cached?.data || {};
  }
}

// ─── Sport category mapping ────────────────────────────────────────────────
const SPORT_CATEGORIES: Record<string, string[]> = {
  football: ['Soccer', 'Football'],
  basketball: ['Basketball', 'NBA'],
};

// ─── Clean HTML from category names ─────────────────────────────────────────
function cleanHtml(text: string): string {
  return text.replace(/<\/?span>/g, '').replace(/<\/?[^>]+>/g, '').trim();
}

// ─── Team name matching helpers ─────────────────────────────────────────────
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTeamVariants(name: string): string[] {
  const normalized = normalizeTeamName(name);
  const variants = [normalized];

  // Split by common separators
  const words = normalized.split(/\s+/);

  // Add first word (e.g., "Manchester" from "Manchester City")
  if (words.length > 1) variants.push(words[0]);

  // Add last word
  if (words.length > 2) variants.push(words[words.length - 1]);

  // Add abbreviation (first 3 letters)
  if (normalized.length > 3) variants.push(normalized.substring(0, 3));

  // Common team name aliases
  const aliases: Record<string, string[]> = {
    'manchester city': ['man city', 'mancity'],
    'manchester united': ['man utd', 'manunited', 'man utd'],
    'tottenham': ['spurs'],
    'real madrid': ['realmadrid'],
    'barcelona': ['barca'],
    'bayern munich': ['bayern', 'fc bayern'],
    'psg': ['paris saint-germain', 'paris sg'],
    'borussia dortmund': ['bvb', 'dortmund'],
    'atl madrid': ['atletico', 'atletico madrid'],
    'inter milan': ['inter', 'fc internazionale'],
    'ac milan': ['milan'],
    'juventus': ['juve'],
    'liverpool': ['reds'],
    'chelsea': ['blues'],
    'arsenal': ['gunners'],
  };

  for (const [key, values] of Object.entries(aliases)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      variants.push(...values);
    }
  }

  return [...new Set(variants)];
}

function teamMatchesInName(variants: string[], name: string): boolean {
  const nameLower = normalizeTeamName(name);
  return variants.some(v => {
    if (v.length < 3) return false;
    return nameLower.includes(v) || v.includes(nameLower);
  });
}

// ─── Match sport category from event name ───────────────────────────────────
function detectSport(eventName: string, category: string): string {
  const catLower = cleanHtml(category).toLowerCase();
  if (catLower.includes('soccer') || catLower.includes('football')) return 'football';
  if (catLower.includes('basketball') || catLower.includes('nba')) return 'basketball';
  if (catLower.includes('tennis')) return 'tennis';
  if (catLower.includes('mma') || catLower.includes('ufc') || catLower.includes('boxing')) return 'fighting';
  if (catLower.includes('hockey') || catLower.includes('nhl')) return 'hockey';
  if (catLower.includes('baseball') || catLower.includes('mlb')) return 'baseball';
  if (catLower.includes('cricket')) return 'cricket';
  if (catLower.includes('rugby')) return 'rugby';
  if (catLower.includes('golf')) return 'golf';

  // Fallback: check event name
  const nameLower = eventName.toLowerCase();
  if (nameLower.includes(' nba ') || nameLower.includes('basketball') || nameLower.includes(' ncaa ')) return 'basketball';
  if (nameLower.includes(' premier league') || nameLower.includes(' la liga') || nameLower.includes(' serie a') || nameLower.includes(' bundesliga') || nameLower.includes(' champions league')) return 'football';

  return 'other';
}

// ─── GET handler: Search for streams ────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const homeTeam = searchParams.get('homeTeam') || '';
    const awayTeam = searchParams.get('awayTeam') || '';
    const sport = searchParams.get('sport') || ''; // 'football' or 'basketball'
    const liveOnly = searchParams.get('liveOnly') === 'true'; // strict: both teams must match

    // Fetch schedule and channels data in parallel
    const [schedule, channelsData] = await Promise.all([
      fetchSchedule(),
      fetchChannelsData(),
    ]);

    if (Object.keys(schedule).length === 0 || Object.keys(channelsData).length === 0) {
      return NextResponse.json({
        streams: [],
        source: 'daddylive',
        error: 'Could not fetch DaddyLive data',
      });
    }

    const homeVariants = getTeamVariants(homeTeam);
    const awayVariants = getTeamVariants(awayTeam);

    const matchedStreams: MatchedStream[] = [];

    // Determine today's date key for filtering
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Search through all days and categories
    for (const [dayKey, categories] of Object.entries(schedule)) {
      // When liveOnly, only search today's and yesterday's schedule (live matches)
      if (liveOnly) {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        if (dayKey !== todayKey && dayKey !== yesterdayKey) continue;
      }

      for (const [category, events] of Object.entries(categories)) {
        const sportDetected = detectSport('', category);

        // Filter by sport if specified
        if (sport && sportDetected !== sport && sportDetected !== 'other') continue;

        for (const event of events) {
          const eventName = event.event || '';
          const homeMatch = teamMatchesInName(homeVariants, eventName);
          const awayMatch = teamMatchesInName(awayVariants, eventName);

          // When liveOnly: require BOTH teams to match (strict matching for live matches)
          if (liveOnly) {
            if (!homeMatch || !awayMatch) continue;
          } else {
            if (!homeMatch && !awayMatch) continue;
          }

          // Get channel streams
          const allChannels = [...(event.channels || []), ...(event.channels2 || [])];

          for (const ch of allChannels) {
            // Find the channel in channelsData by channel_id
            const channelEntry = Object.entries(channelsData).find(([name, data]) => {
              return data.channel_url.includes(`stream-${ch.channel_id}.php`) ||
                     data.channel_url.includes(`stream_${ch.channel_id}`) ||
                     name.toLowerCase().includes(ch.channel_name.toLowerCase());
            });

            if (channelEntry) {
              const [chName, chData] = channelEntry;
              matchedStreams.push({
                channelName: ch.channel_name || chName,
                channelId: ch.channel_id,
                streamUrl: chData.stream_url,
                channelLogo: chData.tvg_logo,
                groupTitle: chData.group_title,
                eventTime: event.time,
                eventName,
                sport: sportDetected,
              });
            } else {
              // Channel not in channels data - provide the embed page URL via dlhd.st
              matchedStreams.push({
                channelName: ch.channel_name,
                channelId: ch.channel_id,
                streamUrl: `https://dlhd.st/stream/stream-${ch.channel_id}.php`,
                channelLogo: '',
                groupTitle: '',
                eventTime: event.time,
                eventName,
                sport: sportDetected,
              });
            }
          }
        }
      }
    }

    // Categorize streams by type
    const m3u8Streams = matchedStreams.filter(s => s.streamUrl.includes('.m3u8'));
    const embedStreams = matchedStreams.filter(s => !s.streamUrl.includes('.m3u8'));

    // Validate m3u8 streams in parallel (with concurrency limit)
    // Only validate if there aren't too many (to avoid long response times)
    let validatedM3u8Streams: MatchedStream[];

    if (m3u8Streams.length > 0 && m3u8Streams.length <= 10) {
      console.log(`[DaddyLive API] Validating ${m3u8Streams.length} m3u8 streams...`);

      const validationResults = await Promise.allSettled(
        m3u8Streams.map(async (stream) => {
          const isValid = await validateStreamHealth(stream.streamUrl);
          return { stream, isValid };
        })
      );

      validatedM3u8Streams = validationResults
        .filter((r): r is PromiseFulfilledResult<{ stream: MatchedStream; isValid: boolean }> =>
          r.status === 'fulfilled' && r.value.isValid
        )
        .map(r => r.value.stream);

      const removedCount = m3u8Streams.length - validatedM3u8Streams.length;
      if (removedCount > 0) {
        console.log(`[DaddyLive API] Removed ${removedCount} broken m3u8 streams`);
      }
    } else if (m3u8Streams.length > 10) {
      // Too many streams - skip validation to avoid timeout, return all
      // The client-side validation will catch broken ones
      validatedM3u8Streams = m3u8Streams;
    } else {
      validatedM3u8Streams = [];
    }

    // Combine: validated m3u8 first, then embed URLs
    const functionalStreams = [...validatedM3u8Streams, ...embedStreams];

    // Sort: m3u8 first (better UX), then by sport relevance
    functionalStreams.sort((a, b) => {
      // m3u8 first
      const aIsM3u8 = a.streamUrl.includes('.m3u8') ? 0 : 1;
      const bIsM3u8 = b.streamUrl.includes('.m3u8') ? 0 : 1;
      if (aIsM3u8 !== bIsM3u8) return aIsM3u8 - bIsM3u8;

      // Then by sport match
      if (sport) {
        const aSport = a.sport === sport ? 0 : 1;
        const bSport = b.sport === sport ? 0 : 1;
        if (aSport !== bSport) return aSport - bSport;
      }
      return 0;
    });

    console.log(`[DaddyLive API] Found ${functionalStreams.length} streams (${validatedM3u8Streams.length} m3u8, ${embedStreams.length} embed) for "${homeTeam}" vs "${awayTeam}"`);

    return NextResponse.json({
      streams: functionalStreams.map(s => ({
        name: s.channelName,
        url: s.streamUrl,
        channelLogo: s.channelLogo,
        group: s.groupTitle,
        eventTime: s.eventTime,
        eventName: s.eventName,
        sport: s.sport,
        type: s.streamUrl.includes('.m3u8') ? 'm3u8' : 'embed',
        source: 'daddylive',
      })),
      source: 'daddylive',
    });
  } catch (err) {
    console.error('[DaddyLive API] Error:', err);
    return NextResponse.json(
      { streams: [], source: 'daddylive', error: 'Failed to fetch DaddyLive streams' },
      { status: 200 }
    );
  }
}
