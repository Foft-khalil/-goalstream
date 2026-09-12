import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeTeamName,
  getTeamVariants,
  teamMatchScore,
  cleanHtml,
  detectSport,
  isDeadUrl,
  dateKey,
} from '@/lib/team-match';
import { fetchSchedule, fetchChannelsData, buildEmbedUrl } from '@/lib/daddylive-cache';

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
 * Uses FUZZY team matching (token + substring scoring) so naming differences between
 * data sources don't cause matches to be missed.
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
  matchScore: number;
}

// Stream health cache: URL → { valid, timestamp } (local to this route)
// Use globalThis to survive HMR in dev mode.
interface HealthEntry {
  valid: boolean;
  timestamp: number;
}
const _g = globalThis as unknown as { __dlHealthCache?: Map<string, HealthEntry> };
if (!_g.__dlHealthCache) _g.__dlHealthCache = new Map();
const streamHealthCache = _g.__dlHealthCache;
const HEALTH_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/html, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

// ─── Validate a DaddyLive embed page — REAL health check ──────────────────────
// Method (validated by analysis): dlive.sx serves the REAL player page when the
// request carries ANY non-empty Referer; without one it serves an "Access Blocked"
// stub. The real player page embeds the nested "daddy" player iframe
// (…/premiumtv/daddyX.php?id=X). So: GET with a neutral third-party Referer and
// check the marker → this filters genuinely dead/offline channels server-side so
// the user never sees a broken "Disponible" channel.
async function validateEmbedHealth(url: string): Promise<boolean> {
  // Check cache first
  const cached = streamHealthCache.get(url);
  if (cached && Date.now() - cached.timestamp < HEALTH_CACHE_TTL) {
    return cached.valid;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...COMMON_HEADERS,
        // ANY non-empty referer unlocks the real player page (verified: google.com works)
        'Referer': 'https://www.google.com/',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    if (!res.ok) {
      streamHealthCache.set(url, { valid: false, timestamp: Date.now() });
      return false;
    }

    const text = await res.text();
    const valid =
      !text.includes('Access Blocked') &&
      (text.includes('daddy') || text.includes('premiumtv'));

    streamHealthCache.set(url, { valid, timestamp: Date.now() });
    return valid;
  } catch {
    // Network error / timeout — invalid (don't show broken channels)
    streamHealthCache.set(url, { valid: false, timestamp: Date.now() });
    return false;
  }
}

// ─── Fetch schedule + channels data: now imported from @/lib/daddylive-cache (shared module) ──
// This ensures find-stream, daddylive, and warmup routes share the SAME cache instance.

// ─── Match sport category from event name (re-exported from team-match lib) ──
// detectSport and helpers are imported from @/lib/team-match

// ─── GET handler: Search for streams ────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const homeTeam = searchParams.get('homeTeam') || '';
    const awayTeam = searchParams.get('awayTeam') || '';
    const sport = searchParams.get('sport') || ''; // 'football' or 'basketball'
    const competition = searchParams.get('competition') || '';
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

    // Build O(1) lookup maps for channels (was O(n) per channel with Object.entries().find())
    const channelsById = new Map<string, { name: string; data: DLChannelData }>();
    const channelsByName = new Map<string, { name: string; data: DLChannelData }>();
    for (const [name, data] of Object.entries(channelsData)) {
      const match1 = data.channel_url.match(/stream-(\d+)\.php/);
      const match2 = data.channel_url.match(/stream_(\d+)/);
      const id = match1?.[1] || match2?.[1];
      if (id) channelsById.set(id, { name, data });
      channelsByName.set(name.toLowerCase(), { name, data });
    }

    const homeVariants = getTeamVariants(homeTeam);
    const awayVariants = getTeamVariants(awayTeam);

    const matchedStreams: MatchedStream[] = [];
    const seenUrls = new Set<string>();

    // Determine today's date key for filtering (UTC)
    const now = new Date();
    const todayKey = dateKey(now);
    const yesterdayKey = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const tomorrowKey = dateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    // Search through ALL days and categories (boost today/yesterday/tomorrow for live)
    for (const [dayKey, categories] of Object.entries(schedule)) {
      // When liveOnly, only consider today / yesterday / tomorrow (covers timezone edge cases)
      if (liveOnly) {
        if (dayKey !== todayKey && dayKey !== yesterdayKey && dayKey !== tomorrowKey) continue;
      }

      let dayBoost = 0.6;
      if (dayKey === todayKey) dayBoost = 1.0;
      else if (dayKey === yesterdayKey || dayKey === tomorrowKey) dayBoost = 0.85;

      for (const [category, events] of Object.entries(categories)) {
        const sportDetected = detectSport('', category);

        // Filter by sport if specified
        if (sport && sportDetected !== sport && sportDetected !== 'other') continue;

        for (const event of events) {
          const eventName = event.event || '';
          const homeScore = teamMatchScore(homeVariants, eventName);
          const awayScore = teamMatchScore(awayVariants, eventName);

          // Fuzzy matching thresholds
          const bothStrong = homeScore >= 0.5 && awayScore >= 0.5;
          const oneStrong = (homeScore >= 0.6 && awayScore >= 0.35) || (awayScore >= 0.6 && homeScore >= 0.35);
          const bothWeak = homeScore >= 0.35 && awayScore >= 0.35;

          if (liveOnly) {
            // For live: require a reasonable match (don't show totally unrelated channels)
            if (!bothStrong && !oneStrong) continue;
          } else {
            // For non-live: require at least ONE solid team-name hit. The old weak
            // thresholds (0.35) produced false positives like kids/entertainment
            // channels ("Nick JR USA") on upcoming matches.
            const oneSolid = homeScore >= 0.5 || awayScore >= 0.5;
            if (!oneSolid && !bothWeak) continue;
          }

          const matchScore = ((homeScore + awayScore) / 2) * dayBoost;

          // Get channel streams
          const allChannels = [...(event.channels || []), ...(event.channels2 || [])];

          for (const ch of allChannels) {
            // O(1) lookup by channel_id (was O(n) with Object.entries().find())
            const channelEntry = channelsById.get(ch.channel_id);

            let streamUrl = '';
            let channelLogo = '';
            let channelName = ch.channel_name;
            let groupTitle = '';

            if (channelEntry) {
              const { name: chName, data: chData } = channelEntry;
              channelLogo = chData.tvg_logo;
              groupTitle = chData.group_title;
              channelName = ch.channel_name || chName;
            }
            // ALWAYS use the embeddable player page on dlive.sx.
            // The raw m3u8 URLs on newkso.ru are Cloudflare-blocked when fetched
            // server-side, but the embed page (dlive.sx/stream/stream-XXX.php)
            // resolves the stream CLIENT-SIDE in the browser — this is exactly
            // how tarjetarojaenvivo.cx and similar aggregators embed DaddyLive.
            streamUrl = buildEmbedUrl(ch.channel_id);

            if (!streamUrl || isDeadUrl(streamUrl) || seenUrls.has(streamUrl)) continue;
            seenUrls.add(streamUrl);

            matchedStreams.push({
              channelName: channelName,
              channelId: ch.channel_id,
              streamUrl,
              channelLogo,
              groupTitle,
              eventTime: event.time,
              eventName,
              sport: sportDetected,
              matchScore,
            });
          }
        }
      }
    }

    // All streams now use DaddyLive's embeddable player page (dlive.sx/stream/stream-XXX.php).
    // REAL health check: with a neutral third-party Referer, dlive.sx serves the real
    // player page (contains the nested daddy iframe); dead/offline channels serve an
    // "Access Blocked" stub instead. Filter BEFORE returning so the user only ever
    // sees working channels.
    const functionalStreams = [...matchedStreams];
    if (functionalStreams.length > 0) {
      const results = await Promise.allSettled(
        functionalStreams.map(async (stream) => ({
          stream,
          valid: await validateEmbedHealth(stream.streamUrl),
        }))
      );
      const validStreams = results
        .filter(
          (r): r is PromiseFulfilledResult<{ stream: MatchedStream; valid: boolean }> =>
            r.status === 'fulfilled' && r.value.valid
        )
        .map((r) => r.value.stream);
      const removed = functionalStreams.length - validStreams.length;
      if (removed > 0) console.log(`[DaddyLive API] Removed ${removed} dead/offline channels (Access Blocked or no player)`);
      functionalStreams.length = 0;
      functionalStreams.push(...validStreams);
    }

    // Sort by match score (highest first), then by sport relevance
    functionalStreams.sort((a, b) => {
      if (Math.abs(a.matchScore - b.matchScore) > 0.01) return b.matchScore - a.matchScore;
      if (sport) {
        const aSport = a.sport === sport ? 0 : 1;
        const bSport = b.sport === sport ? 0 : 1;
        if (aSport !== bSport) return aSport - bSport;
      }
      return 0;
    });

    console.log(`[DaddyLive API] Found ${functionalStreams.length} embed streams for "${homeTeam}" vs "${awayTeam}" (liveOnly=${liveOnly})`);
    // ── Competition-based fallback ──
    // If we found very few (or zero) match-specific streams, add channels that are likely
    // to broadcast this competition. This handles the case where the DaddyLive schedule is
    // from a different date (stale) or the match simply isn't listed.
    let finalStreams = functionalStreams;
    if (functionalStreams.length < 3) {
      const { getCompetitionChannels } = await import('@/lib/competition-channels');
      const fallbackChannelNames = getCompetitionChannels(competition, sport as 'football' | 'basketball');
      const existingUrls = new Set(functionalStreams.map(s => s.streamUrl));
      const fallbackStreams: MatchedStream[] = [];

      for (const fc of fallbackChannelNames) {
        // O(1) lookup by name (was O(n) with Object.entries().find())
        const channelEntry = channelsByName.get(fc.name.toLowerCase());
        if (!channelEntry) continue;
        const { name: chName, data: chData } = channelEntry;
        // Extract channel id from channel_url (e.g. stream/stream-521.php -> 521)
        const idMatch = chData.channel_url.match(/stream-(\d+)\.php/);
        if (!idMatch) continue;
        const streamUrl = buildEmbedUrl(idMatch[1]);
        if (!streamUrl || isDeadUrl(streamUrl) || existingUrls.has(streamUrl)) continue;
        existingUrls.add(streamUrl);

        fallbackStreams.push({
          channelName: chName,
          channelId: idMatch[1],
          streamUrl,
          channelLogo: chData.tvg_logo,
          groupTitle: chData.group_title,
          eventTime: '',
          eventName: fc.reason,
          sport: sport as string,
          matchScore: 0.3,
        });
      }

      if (fallbackStreams.length > 0) {
        // Validate fallback channels with the SAME real health check — a dead
        // fallback channel must never reach the UI (that's what caused the old
        // "Disponible but broken" list).
        const validatedFallbacks: MatchedStream[] = [];
        const fbResults = await Promise.allSettled(
          fallbackStreams.map(async (s) => ({ s, valid: await validateEmbedHealth(s.streamUrl) }))
        );
        for (const r of fbResults) {
          if (r.status === 'fulfilled' && r.value.valid) validatedFallbacks.push(r.value.s);
        }
        const fbRemoved = fallbackStreams.length - validatedFallbacks.length;
        if (fbRemoved > 0) console.log(`[DaddyLive API] Removed ${fbRemoved} dead competition-fallback channels`);
        finalStreams = [...functionalStreams, ...validatedFallbacks];
        console.log(`[DaddyLive API] Added ${validatedFallbacks.length} alive competition-fallback channels (total now ${finalStreams.length})`);
      }
    }

    return NextResponse.json({
      streams: finalStreams.map(s => ({
        name: s.channelName,
        url: s.streamUrl,
        channelLogo: s.channelLogo,
        group: s.groupTitle,
        eventTime: s.eventTime,
        eventName: s.eventName,
        sport: s.sport,
        type: 'embed',
        source: s.matchScore < 0.35 ? 'competition-fallback' : 'daddylive',
        score: s.matchScore,
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
