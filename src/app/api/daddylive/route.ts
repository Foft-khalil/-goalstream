import { NextRequest, NextResponse } from 'next/server';
import {
  matchEventStrict,
  detectSport,
  isDeadUrl,
  dateKey,
} from '@/lib/team-match';
import { fetchSchedule, fetchChannelsData, buildEmbedUrl, buildWatchUrl } from '@/lib/daddylive-cache';

/**
 * DaddyLive API Route (Task 23 — anti "wrong match" guarantee)
 *
 * ONLY returns channels that are attached to THE event in DaddyLive's fresh
 * schedule (the live homepage HTML) where BOTH team names of the clicked
 * match match the event title. Those channels are DaddyLive's own per-event
 * broadcaster list — i.e. streams actually dedicated to THIS match, so the
 * user sees the match they clicked, never some other game that happens to
 * be on air.
 *
 * The old "competition fallback" (generic channels like Sky Sports PL /
 * BeIN USA / ESPN USA when no event matched) was REMOVED: it was the direct
 * cause of "I clicked match A but a different match is playing". If no
 * dedicated event exists we honestly return an empty list instead.
 *
 * Stream health is validated server-side through the light watch.php page
 * (~25 KB, contains the player marker iff the channel exists) so the user
 * never sees a dead channel.
 */

// ─── Types ──────────────────────────────────────────────────────────────────
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
  'Accept': 'text/html, application/json, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

// ─── Validate a DaddyLive channel — REAL health check via light watch page ────
// watch.php?id=N is ~25 KB and contains the player marker ('daddy') iff the
// channel exists; dead/offline ids render a stub without it. (The full embed
// page stream-NNN.php is ~640 KB — we don't download it server-side anymore.)
// The health cache key is the channel id (not the URL) since watch & stream
// pages share existence.
async function validateChannelHealth(channelId: string): Promise<boolean> {
  const cacheKey = `watch:${channelId}`;
  const cached = streamHealthCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HEALTH_CACHE_TTL) {
    return cached.valid;
  }

  try {
    const res = await fetch(buildWatchUrl(channelId), {
      method: 'GET',
      headers: {
        ...COMMON_HEADERS,
        // A neutral referer — mirrors how the browser will load it in-app
        'Referer': 'https://www.google.com/',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    if (!res.ok) {
      streamHealthCache.set(cacheKey, { valid: false, timestamp: Date.now() });
      return false;
    }

    const text = await res.text();
    const valid = text.includes('daddy') || text.includes('premiumtv');

    streamHealthCache.set(cacheKey, { valid, timestamp: Date.now() });
    return valid;
  } catch {
    // Network error / timeout — invalid (don't show broken channels)
    streamHealthCache.set(cacheKey, { valid: false, timestamp: Date.now() });
    return false;
  }
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

    if (Object.keys(schedule).length === 0) {
      return NextResponse.json({
        streams: [],
        source: 'daddylive',
        error: 'Could not fetch DaddyLive schedule',
      });
    }

    // Best-effort logo/group lookup by exact channel NAME (the published
    // channels dataset uses old ids — never resolve it by id).
    const channelsByName = new Map<string, DLChannelData>();
    for (const [name, data] of Object.entries(channelsData)) {
      channelsByName.set(name.toLowerCase(), data);
    }

    const matchedStreams: MatchedStream[] = [];
    const seenUrls = new Set<string>();

    // Determine today's date key for filtering (UTC)
    const now = new Date();
    const todayKey = dateKey(now);
    const yesterdayKey = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const tomorrowKey = dateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    // Search through the fresh day blocks (today ± 1, timezone edge cases)
    for (const [dayKey, categories] of Object.entries(schedule)) {
      if (dayKey !== todayKey && dayKey !== yesterdayKey && dayKey !== tomorrowKey) continue;

      let dayBoost = 0.6;
      if (dayKey === todayKey) dayBoost = 1.0;
      else if (dayKey === yesterdayKey || dayKey === tomorrowKey) dayBoost = 0.85;

      for (const [category, events] of Object.entries(categories)) {
        const sportDetected = detectSport('', category);

        // Filter by sport if specified ('other' categories may hold valid events)
        if (sport && sportDetected !== sport && sportDetected !== 'other') continue;

        for (const event of events) {
          const eventName = event.event || '';

          // ── ANTI WRONG-MATCH GUARANTEE (strict matching) ──
          // BOTH team names must match the event title via token coverage /
          // full-name rules (league prefixes stripped, generic words ignored).
          // A channel is only ever attached to an event that IS this fixture —
          // the user sees the match they clicked, never another game.
          const strict = matchEventStrict(homeTeam, awayTeam, eventName);
          if (!strict.ok) continue;

          const matchScore = ((strict.home + strict.away) / 2) * dayBoost;

          // Get channel streams
          const allChannels = [...(event.channels || []), ...(event.channels2 || [])];

          for (const ch of allChannels) {
            // Always embed the player page on dlive.sx (client-side m3u8
            // resolution — the same chain the reference sites use).
            const streamUrl = buildEmbedUrl(ch.channel_id);

            if (!streamUrl || isDeadUrl(streamUrl) || seenUrls.has(streamUrl)) continue;
            seenUrls.add(streamUrl);

            // Best-effort logo by exact channel name
            const chData = channelsByName.get((ch.channel_name || '').toLowerCase());
            const channelLogo = chData?.tvg_logo || '';
            const groupTitle = chData?.group_title || '';

            matchedStreams.push({
              channelName: ch.channel_name,
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

    // REAL health check on every candidate channel (light watch.php page).
    // Filter BEFORE returning so the user only ever sees working channels.
    let finalStreams = [...matchedStreams];
    if (finalStreams.length > 0) {
      const results = await Promise.allSettled(
        finalStreams.map(async (stream) => ({
          stream,
          valid: await validateChannelHealth(stream.channelId),
        }))
      );
      const validStreams = results
        .filter(
          (r): r is PromiseFulfilledResult<{ stream: MatchedStream; valid: boolean }> =>
            r.status === 'fulfilled' && r.value.valid
        )
        .map((r) => r.value.stream);
      const removed = finalStreams.length - validStreams.length;
      if (removed > 0) console.log(`[DaddyLive API] Removed ${removed} dead/offline channels (no player page)`);
      finalStreams = validStreams;
    }

    // Sort by match score (highest first), then by sport relevance
    finalStreams.sort((a, b) => {
      if (Math.abs(a.matchScore - b.matchScore) > 0.01) return b.matchScore - a.matchScore;
      if (sport) {
        const aSport = a.sport === sport ? 0 : 1;
        const bSport = b.sport === sport ? 0 : 1;
        if (aSport !== bSport) return aSport - bSport;
      }
      return 0;
    });

    console.log(`[DaddyLive API] Found ${finalStreams.length} dedicated channels for "${homeTeam}" vs "${awayTeam}" (both-team match)`);
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
        source: 'daddylive',
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
