import { NextRequest, NextResponse } from 'next/server';

/**
 * DaddyLive API Route
 *
 * Fetches free sports streams from DaddyLive (dlhd.st):
 * 1. Schedule JSON → maps events to channel IDs
 * 2. Channels Data JSON → maps channel IDs to direct m3u8 stream URLs
 *
 * This provides working m3u8 streams for football, basketball, and all other sports.
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

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/html, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

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

    // Search through all days and categories
    for (const [dayKey, categories] of Object.entries(schedule)) {
      for (const [category, events] of Object.entries(categories)) {
        const sportDetected = detectSport('', category);

        // Filter by sport if specified
        if (sport && sportDetected !== sport && sportDetected !== 'other') continue;

        for (const event of events) {
          const eventName = event.event || '';
          const homeMatch = teamMatchesInName(homeVariants, eventName);
          const awayMatch = teamMatchesInName(awayVariants, eventName);

          if (!homeMatch && !awayMatch) continue;

          // Match score: both teams matched is best
          const score = (homeMatch ? 50 : 0) + (awayMatch ? 50 : 0);

          // Get channel streams
          const allChannels = [...(event.channels || []), ...(event.channels2 || [])];

          for (const ch of allChannels) {
            // Find the channel in channelsData by channel_id
            const channelEntry = Object.entries(channelsData).find(([name, data]) => {
              // Match by channel_id in the channel_url
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
              // Channel not in channels data - provide the embed page URL
              matchedStreams.push({
                channelName: ch.channel_name,
                channelId: ch.channel_id,
                streamUrl: `https://dlhd.click/stream/stream-${ch.channel_id}.php`,
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

    // Sort: exact matches first, then by sport relevance
    matchedStreams.sort((a, b) => {
      // Prioritize m3u8 streams over embed URLs
      const aM3u8 = a.streamUrl.includes('.m3u8') ? 0 : 1;
      const bM3u8 = b.streamUrl.includes('.m3u8') ? 0 : 1;
      if (aM3u8 !== bM3u8) return aM3u8 - bM3u8;

      // Then by sport match
      if (sport) {
        const aSport = a.sport === sport ? 0 : 1;
        const bSport = b.sport === sport ? 0 : 1;
        if (aSport !== bSport) return aSport - bSport;
      }
      return 0;
    });

    console.log(`[DaddyLive API] Found ${matchedStreams.length} streams for "${homeTeam}" vs "${awayTeam}"`);

    return NextResponse.json({
      streams: matchedStreams.map(s => ({
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
