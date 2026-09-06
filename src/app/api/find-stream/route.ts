import { NextRequest, NextResponse } from 'next/server';
import {
  getTeamVariants,
  teamMatchScore,
  detectSport,
  isDeadUrl,
  dateKey,
} from '@/lib/team-match';
import { getCompetitionChannels } from '@/lib/competition-channels';
import { fetchSchedule, fetchChannelsData, type DLChannelData, type DLEvent } from '@/lib/daddylive-cache';

/**
 * Auto-Find Stream API — INSTANT VERSION
 *
 * Returns the best stream candidate IMMEDIATELY without server-side validation.
 * The player's watchdog + HLS error handling do the validation in real-time.
 *
 * Strategy:
 * 1. Search the DaddyLive schedule for matching events (fuzzy match)
 * 2. Add competition-based fallback channels if schedule has no match
 * 3. Sort: m3u8 first, then by match score + day boost
 * 4. Return the BEST candidate as the primary stream + others as alternatives
 *
 * Total response time: ~50-200ms (was 2.8s+ with validation)
 *
 * GET /api/find-stream?homeTeam=X&awayTeam=Y&sport=football&competition=Premier League
 */

// ─── Types ──────────────────────────────────────────────────────────────────
interface CandidateStream {
  name: string;
  url: string;
  logo: string;
  type: 'm3u8' | 'embed';
  source: string;
  score: number;
  dayBoost: number;
  eventName: string;
}

// ─── GET handler — INSTANT response, no validation ──────────────────────────
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('homeTeam') || '';
  const awayTeam = searchParams.get('awayTeam') || '';
  const sport = searchParams.get('sport') || 'football';
  const competition = searchParams.get('competition') || '';

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ found: false, tried: 0, candidates: [] });
  }

  const homeVariants = getTeamVariants(homeTeam);
  const awayVariants = getTeamVariants(awayTeam);

  const now = new Date();
  const todayK = dateKey(now);
  const yesterdayK = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const tomorrowK = dateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  // Fetch schedule + channels in parallel
  const [schedule, channelsData] = await Promise.all([fetchSchedule(), fetchChannelsData()]);

  // Build a channel_id → channelData lookup map for O(1) access (was O(n) per channel lookup)
  // This is the key optimization: 729 channels × 900 lookups = 650k comparisons → 900 lookups
  const channelsById = new Map<string, { name: string; data: DLChannelData }>();
  const channelsByName = new Map<string, { name: string; data: DLChannelData }>();
  for (const [name, data] of Object.entries(channelsData)) {
    // Extract channel_id from channel_url patterns like "stream-1.php" or "stream_1"
    const match1 = data.channel_url.match(/stream-(\d+)\.php/);
    const match2 = data.channel_url.match(/stream_(\d+)/);
    const id = match1?.[1] || match2?.[1];
    if (id) channelsById.set(id, { name, data });
    channelsByName.set(name.toLowerCase(), { name, data });
  }

  const candidates: CandidateStream[] = [];
  const seenUrls = new Set<string>();

  // ── Phase 1: Search DaddyLive schedule for matching events (fuzzy match) ──
  for (const [dayKey, categories] of Object.entries(schedule)) {
    let dayBoost = 0.6;
    if (dayKey === todayK) dayBoost = 1.0;
    else if (dayKey === yesterdayK || dayKey === tomorrowK) dayBoost = 0.85;

    for (const [category, events] of Object.entries(categories)) {
      const sportDetected = detectSport('', category);
      if (sport && sportDetected !== sport && sportDetected !== 'other') continue;

      for (const event of events) {
        const eventName = event.event || '';
        const homeScore = teamMatchScore(homeVariants, eventName);
        const awayScore = teamMatchScore(awayVariants, eventName);

        const bothStrong = homeScore >= 0.5 && awayScore >= 0.5;
        const oneStrong = (homeScore >= 0.6 && awayScore >= 0.35) || (awayScore >= 0.6 && homeScore >= 0.35);
        const bothWeak = homeScore >= 0.35 && awayScore >= 0.35;
        if (!bothStrong && !oneStrong && !bothWeak) continue;

        const matchScore = (homeScore + awayScore) / 2;
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
            streamUrl = `https://dlhd.st/stream/stream-${ch.channel_id}.php`;
          }

          if (!streamUrl || isDeadUrl(streamUrl) || seenUrls.has(streamUrl)) continue;
          seenUrls.add(streamUrl);

          const isM3u8 = streamUrl.includes('.m3u8');
          candidates.push({
            name: channelName, url: streamUrl, logo: channelLogo,
            type: isM3u8 ? 'm3u8' : 'embed',
            source: 'daddylive',
            score: matchScore * dayBoost, dayBoost, eventName,
          });
        }
      }
    }
  }

  // ── Phase 2: Add competition-based fallback channels ──
  // Always add these as they cover the case where the schedule has no match for this competition
  const fallbackChannelNames = getCompetitionChannels(competition, sport as 'football' | 'basketball');
  for (const fc of fallbackChannelNames) {
    // O(1) lookup by name (was O(n) with Object.entries().find())
    const channelEntry = channelsByName.get(fc.name.toLowerCase());
    if (!channelEntry) continue;
    const { name: chName, data: chData } = channelEntry;
    const streamUrl = chData.stream_url;
    if (!streamUrl || isDeadUrl(streamUrl) || seenUrls.has(streamUrl)) continue;
    seenUrls.add(streamUrl);

    const isM3u8 = streamUrl.includes('.m3u8');
    candidates.push({
      name: chName, url: streamUrl, logo: chData.tvg_logo,
      type: isM3u8 ? 'm3u8' : 'embed',
      source: 'competition-fallback',
      score: 0.3, dayBoost: 1.0,
      eventName: fc.reason,
    });
  }

  // ── Phase 3: Sort — m3u8 first, then by score (schedule-match > fallback) ──
  candidates.sort((a, b) => {
    if (a.type === 'm3u8' && b.type !== 'm3u8') return -1;
    if (a.type !== 'm3u8' && b.type === 'm3u8') return 1;
    return b.score - a.score;
  });

  const m3u8Candidates = candidates.filter(c => c.type === 'm3u8');
  const elapsed = Date.now() - startTime;
  console.log(`[Find Stream] ${candidates.length} candidates (${m3u8Candidates.length} m3u8) for "${homeTeam}" vs "${awayTeam}" in ${elapsed}ms`);

  // ── Phase 4: Return the BEST m3u8 candidate as primary, rest as alternatives ──
  // NO validation here — the player's watchdog + HLS error handling do the validation.
  // This makes the response instant (~50-200ms instead of 2.8s+).
  if (m3u8Candidates.length > 0) {
    const primary = m3u8Candidates[0];
    const alternatives = m3u8Candidates.slice(1, 8).map(c => ({
      name: c.name,
      url: `/api/stream-proxy?url=${encodeURIComponent(c.url)}`,
      logo: c.logo,
    }));

    return NextResponse.json({
      found: true,
      stream: {
        url: `/api/stream-proxy?url=${encodeURIComponent(primary.url)}`,
        name: primary.name,
        logo: primary.logo,
        type: 'm3u8' as const,
      },
      alternatives,
      tried: 0, // 0 = no validation done (instant)
      totalCandidates: candidates.length,
      candidates: candidates.slice(0, 12).map(c => ({
        name: c.name,
        url: c.type === 'm3u8' ? `/api/stream-proxy?url=${encodeURIComponent(c.url)}` : c.url,
        logo: c.logo,
        type: c.type,
        source: c.source,
        score: c.score,
        eventName: c.eventName,
      })),
    });
  }

  // No m3u8 candidates — return all embed candidates so the player can try them
  if (candidates.length > 0) {
    return NextResponse.json({
      found: false,
      tried: 0,
      totalCandidates: candidates.length,
      candidates: candidates.slice(0, 12).map(c => ({
        name: c.name,
        url: c.type === 'm3u8' ? `/api/stream-proxy?url=${encodeURIComponent(c.url)}` : c.url,
        logo: c.logo,
        type: c.type,
        source: c.source,
        score: c.score,
        eventName: c.eventName,
      })),
    });
  }

  // Truly no candidates at all
  return NextResponse.json({
    found: false,
    tried: 0,
    totalCandidates: 0,
    candidates: [],
  });
}
