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
import { fetchSchedule, fetchChannelsData } from '@/lib/daddylive-cache';

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

      // 403 / 401 / 5xx might mean Cloudflare or anti-bot is blocking from server
      // but stream may still work via the stream-proxy. Give benefit of the doubt.
      if (res.status === 403 || res.status === 401 || res.status >= 500) {
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

      const valid = res.ok || res.status === 403 || res.status >= 500; // 403/5xx = page likely exists
      streamHealthCache.set(url, { valid, timestamp: Date.now() });
      return valid;
    }
  } catch {
    // Network error / timeout — give the benefit of the doubt (proxy may still recover)
    return true;
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
            // For non-live: be more lenient (at least weak match on either team)
            const either = homeScore >= 0.4 || awayScore >= 0.4;
            if (!either && !bothWeak) continue;
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
              streamUrl = chData.stream_url;
              channelLogo = chData.tvg_logo;
              groupTitle = chData.group_title;
              channelName = ch.channel_name || chName;
            } else {
              // Channel not in channels data - provide the embed page URL via dlhd.st
              streamUrl = `https://dlhd.st/stream/stream-${ch.channel_id}.php`;
            }

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

    // Sort: m3u8 first (better UX), then by match score (highest first), then by sport relevance
    functionalStreams.sort((a, b) => {
      // m3u8 first
      const aIsM3u8 = a.streamUrl.includes('.m3u8') ? 0 : 1;
      const bIsM3u8 = b.streamUrl.includes('.m3u8') ? 0 : 1;
      if (aIsM3u8 !== bIsM3u8) return aIsM3u8 - bIsM3u8;

      // Then by match score (highest first)
      if (Math.abs(a.matchScore - b.matchScore) > 0.01) return b.matchScore - a.matchScore;

      // Then by sport match
      if (sport) {
        const aSport = a.sport === sport ? 0 : 1;
        const bSport = b.sport === sport ? 0 : 1;
        if (aSport !== bSport) return aSport - bSport;
      }
      return 0;
    });

    console.log(`[DaddyLive API] Found ${functionalStreams.length} streams (${validatedM3u8Streams.length} m3u8, ${embedStreams.length} embed) for "${homeTeam}" vs "${awayTeam}" (liveOnly=${liveOnly})`);

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
        const streamUrl = chData.stream_url;
        if (!streamUrl || isDeadUrl(streamUrl) || existingUrls.has(streamUrl)) continue;
        existingUrls.add(streamUrl);

        fallbackStreams.push({
          channelName: chName,
          channelId: '',
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
        // Validate fallback m3u8 streams too (lenient)
        const fallbackM3u8 = fallbackStreams.filter(s => s.streamUrl.includes('.m3u8'));
        let validatedFallback: MatchedStream[] = [];
        if (fallbackM3u8.length > 0 && fallbackM3u8.length <= 8) {
          const results = await Promise.allSettled(
            fallbackM3u8.map(async (stream) => ({ stream, isValid: await validateStreamHealth(stream.streamUrl) }))
          );
          validatedFallback = results
            .filter((r): r is PromiseFulfilledResult<{ stream: MatchedStream; isValid: boolean }> =>
              r.status === 'fulfilled' && r.value.isValid)
            .map(r => r.value.stream);
        } else {
          validatedFallback = fallbackM3u8;
        }

        // Combine: original first, then validated fallback m3u8, then fallback embeds
        finalStreams = [...functionalStreams, ...validatedFallback, ...fallbackStreams.filter(s => !s.streamUrl.includes('.m3u8'))];
        console.log(`[DaddyLive API] Added ${fallbackStreams.length} competition-fallback channels (total now ${finalStreams.length})`);
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
        type: s.streamUrl.includes('.m3u8') ? 'm3u8' : 'embed',
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
