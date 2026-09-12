import { NextRequest, NextResponse } from 'next/server';
import {
  matchEventStrict,
  detectSport,
  isDeadUrl,
  dateKey,
} from '@/lib/team-match';
import { fetchSchedule, buildEmbedUrl, type DLEvent } from '@/lib/daddylive-cache';

/**
 * Auto-Find Stream API — INSTANT VERSION
 *
 * Returns the best stream candidate IMMEDIATELY without server-side validation.
 * The player's watchdog + HLS error handling do the validation in real-time.
 *
 * Strategy (Task 23 — anti "wrong match" guarantee):
 * 1. Search the DaddyLive fresh schedule for events where BOTH team names match
 * 2. Sort by match score + day boost
 * 3. Return the BEST candidate as the primary stream + others as alternatives
 * (No generic competition fallback — channels must be dedicated to this fixture.)
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

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ found: false, tried: 0, candidates: [] });
  }

  const now = new Date();
  const todayK = dateKey(now);
  const yesterdayK = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const tomorrowK = dateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  // Fetch schedule
  const schedule = await fetchSchedule();

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

        // BOTH teams must match strictly — channels must belong to THIS fixture
        const strict = matchEventStrict(homeTeam, awayTeam, eventName);
        if (!strict.ok) continue;

        const matchScore = (strict.home + strict.away) / 2;
        const allChannels = [...(event.channels || []), ...(event.channels2 || [])];

        for (const ch of allChannels) {
          // Always the embeddable dlive.sx player page (client-side m3u8)
          const streamUrl = buildEmbedUrl(ch.channel_id);
          if (!streamUrl || isDeadUrl(streamUrl) || seenUrls.has(streamUrl)) continue;
          seenUrls.add(streamUrl);

          candidates.push({
            name: ch.channel_name, url: streamUrl, logo: '',
            type: 'embed',
            source: 'daddylive',
            score: matchScore * dayBoost, dayBoost, eventName,
          });
        }
      }
    }
  }

  // ── Sort by score ──
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
