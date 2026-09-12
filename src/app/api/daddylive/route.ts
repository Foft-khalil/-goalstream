import { NextRequest, NextResponse } from 'next/server';
import { matchEventStrict, detectSport, dateKey } from '@/lib/team-match';
import { fetchSchedule, fetchChannelsData } from '@/lib/daddylive-cache';
import { resolveChannelM3u8, buildHlsProxyUrl, mapWithConcurrency } from '@/lib/daddylive-resolve';

/**
 * DaddyLive API Route (Task 24 — clean, ad-free, CORRECT-match streams)
 *
 * CORRECT MATCH GUARANTEE: ONLY channels attached to THE event in DaddyLive's
 * fresh schedule (live homepage HTML) are returned, and BOTH team names of
 * the clicked match must match the event title (strict matching). The old
 * "competition fallback" (generic channels playing whatever is on air) was
 * removed — if no dedicated event exists we honestly return an empty list.
 *
 * NO ADS GUARANTEE: we NEVER embed the ad-infested DaddyLive pages. Every
 * channel is resolved SERVER-SIDE down to its raw HLS playlist
 * (daddylive-resolve.ts) and returned as a same-origin /api/hls-proxy URL
 * that our own hls.js player plays. The ad scripts (Clappr page, popups,
 * tab-unders, banners) are never loaded by any browser.
 *
 * NO DEAD CHANNELS GUARANTEE: resolution includes a REAL playlist check
 * (the master m3u8 must return a valid manifest right now) — a channel is
 * listed only if its actual stream is playable at request time.
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
  channelLogo: string;
  groupTitle: string;
  eventTime: string;
  eventName: string;
  sport: string;
  matchScore: number;
}

// Resolve at most this many best-matched channels (kept low to bound latency:
// each resolution fetches ~640 KB + 3 KB; results are cached ~hours).
const MAX_CHANNELS_TO_RESOLVE = 8;
const RESOLVE_CONCURRENCY = 3;

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
    const seenChannelIds = new Set<string>();

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
            if (!ch.channel_id || isUnusableId(ch.channel_id) || seenChannelIds.has(ch.channel_id)) continue;
            seenChannelIds.add(ch.channel_id);

            // Best-effort logo by exact channel name
            const chData = channelsByName.get((ch.channel_name || '').toLowerCase());
            const channelLogo = chData?.tvg_logo || '';
            const groupTitle = chData?.group_title || '';

            matchedStreams.push({
              channelName: ch.channel_name,
              channelId: ch.channel_id,
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

    // Best matches first, then cap the resolution work
    matchedStreams.sort((a, b) => {
      if (Math.abs(a.matchScore - b.matchScore) > 0.01) return b.matchScore - a.matchScore;
      if (sport) {
        const aSport = a.sport === sport ? 0 : 1;
        const bSport = b.sport === sport ? 0 : 1;
        if (aSport !== bSport) return aSport - bSport;
      }
      return 0;
    });
    const candidates = matchedStreams.slice(0, MAX_CHANNELS_TO_RESOLVE);

    // ── Resolve EVERY candidate to its raw HLS playlist (server-side). ──
    // Resolution doubles as the REAL health check: only channels whose master
    // playlist returns a valid manifest right now survive the filter below.
    let finalStreams: Array<MatchedStream & { resolved: NonNullable<Awaited<ReturnType<typeof resolveChannelM3u8>>> }> = [];

    if (candidates.length > 0) {
      const results = await mapWithConcurrency(candidates, RESOLVE_CONCURRENCY, async (stream) => {
        const resolved = await resolveChannelM3u8(stream.channelId);
        return { stream, resolved };
      });

      finalStreams = results
        .filter((r): r is { stream: MatchedStream; resolved: NonNullable<Awaited<ReturnType<typeof resolveChannelM3u8>>> } => !!r.resolved)
        .map((r) => ({ ...r.stream, resolved: r.resolved }));

      const removed = candidates.length - finalStreams.length;
      if (removed > 0) console.log(`[DaddyLive API] Removed ${removed} dead/unresolvable channels (no valid playlist)`);
    }

    console.log(`[DaddyLive API] Found ${finalStreams.length} clean HLS channels for "${homeTeam}" vs "${awayTeam}" (both-team match)`);
    return NextResponse.json({
      streams: finalStreams.map((s) => ({
        name: s.channelName,
        // Same-origin proxy URL — plays in OUR hls.js player. Zero ads.
        url: buildHlsProxyUrl(s.resolved.m3u8Url, s.resolved.referer, s.channelId),
        channelLogo: s.channelLogo,
        group: s.groupTitle,
        eventTime: s.eventTime,
        eventName: s.eventName,
        sport: s.sport,
        type: 'hls',
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

/** "Channel Not Listed#00" style placeholders and empty ids are unresolvable. */
function isUnusableId(id: string): boolean {
  const n = Number(id);
  return !Number.isFinite(n) || n <= 0;
}
