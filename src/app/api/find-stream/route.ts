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
import { getCompetitionChannels } from '@/lib/competition-channels';

/**
 * Auto-Find Stream API — DEFINITIVE VERSION
 *
 * For a live (or about-to-start) match, find the BEST working stream.
 *
 * Strategy:
 * 1. Search ALL days in the DaddyLive schedule (not just today/yesterday)
 *    because the schedule may use a different timezone. Boost today's score.
 * 2. Fuzzy team matching (token + substring scoring, not strict both-must-match)
 * 3. Lenient validation: 403 + network errors get the benefit of the doubt
 *    (the stream-proxy can usually recover them with proper Origin headers)
 * 4. Return BOTH the best verified stream AND all candidates as fallback
 *    so the UI can always offer a "Try this stream" option.
 *
 * GET /api/find-stream?homeTeam=X&awayTeam=Y&sport=football
 */

// ─── Types ──────────────────────────────────────────────────────────────────
interface DLChannel { channel_name: string; channel_id: string; }
interface DLEvent { time: string; event: string; channels: DLChannel[]; channels2: DLChannel[]; }
interface DLChannelData { group_title: string; tvg_id: string; tvg_logo: string; channel_url: string; stream_url: string; }

interface CandidateStream {
  name: string;
  url: string;
  logo: string;
  type: 'm3u8' | 'embed';
  source: string;
  score: number;          // team-match score for this event
  dayBoost: number;      // 1.0 if today, 0.8 if yesterday, 0.6 otherwise
  eventName: string;
}

// ─── Cache ───────────────────────────────────────────────────────────────────
const scheduleCache = new Map<string, { data: any; timestamp: number }>();
const channelsCache = new Map<string, { data: any; timestamp: number }>();
const streamHealthCache = new Map<string, { status: 'valid' | 'invalid' | 'unknown'; timestamp: number }>();

const SCHEDULE_TTL = 2 * 60 * 1000;
const CHANNELS_TTL = 30 * 60 * 1000;
const HEALTH_TTL = 3 * 60 * 1000;

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/html, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

// ─── Lenient m3u8 validation ────────────────────────────────────────────────
// Returns 'valid' (clearly works), 'invalid' (clearly broken), or 'unknown' (try via proxy)
async function validateM3u8(url: string): Promise<'valid' | 'invalid' | 'unknown'> {
  const cached = streamHealthCache.get(url);
  if (cached && Date.now() - cached.timestamp < HEALTH_TTL) return cached.status;

  try {
    let origin = '';
    try {
      const hostname = new URL(url).hostname;
      if (hostname.includes('newkso.ru')) origin = 'https://jxoxkplay.xyz';
      else if (hostname.includes('fubo') || hostname.includes('fltvhd') || hostname.includes('futbolonlinehd')) origin = 'https://fltvhd.com';
    } catch {}

    const headers: Record<string, string> = {
      ...COMMON_HEADERS, 'Accept': '*/*',
      ...(origin ? { 'Origin': origin, 'Referer': `${origin}/` } : {}),
    };

    const res = await fetch(url, {
      method: 'GET', headers, signal: AbortSignal.timeout(5000), redirect: 'follow',
    });

    let status: 'valid' | 'invalid' | 'unknown' = 'unknown';
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTM3U') || text.includes('#EXTINF')) status = 'valid';
      else if (text.length < 1000 && (text.includes('<html') || text.includes('Not Found') || text.includes('error'))) status = 'invalid';
      else status = 'valid'; // Got 200 with non-HTML content — probably playable
    } else if (res.status === 403 || res.status === 401) {
      // Cloudflare/anti-bot — let the proxy try
      status = 'unknown';
    } else if (res.status === 404 || res.status === 410) {
      status = 'invalid';
    } else {
      // 5xx, other 4xx — let the proxy try
      status = 'unknown';
    }

    streamHealthCache.set(url, { status, timestamp: Date.now() });
    return status;
  } catch {
    // Network error / timeout — DON'T mark invalid. The stream-proxy may still recover it.
    // Only cache for a short time so we retry on next request.
    streamHealthCache.set(url, { status: 'unknown', timestamp: Date.now() });
    return 'unknown';
  }
}

// ─── Fetch schedule ─────────────────────────────────────────────────────────
async function fetchSchedule(): Promise<Record<string, Record<string, DLEvent[]>>> {
  const cached = scheduleCache.get('schedule');
  if (cached && Date.now() - cached.timestamp < SCHEDULE_TTL) return cached.data;

  try {
    const res = await fetch('https://dlhd.st/schedule/schedule-generated.json', {
      headers: COMMON_HEADERS, signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return cached?.data || {};
    const data = await res.json();
    scheduleCache.set('schedule', { data, timestamp: Date.now() });
    return data;
  } catch { return cached?.data || {}; }
}

// ─── Fetch channels data ────────────────────────────────────────────────────
async function fetchChannelsData(): Promise<Record<string, DLChannelData>> {
  const cached = channelsCache.get('channels');
  if (cached && Date.now() - cached.timestamp < CHANNELS_TTL) return cached.data;

  try {
    const res = await fetch(
      'https://raw.githubusercontent.com/nightah/daddylive/main/daddylive-channels-data.json',
      { headers: COMMON_HEADERS, signal: AbortSignal.timeout(15000) }
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
  } catch { return cached?.data || {}; }
}

// ─── GET handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
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

  // Build day keys for boosting
  const now = new Date();
  const todayK = dateKey(now);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayK = dateKey(yesterday);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowK = dateKey(tomorrow);

  const [schedule, channelsData] = await Promise.all([fetchSchedule(), fetchChannelsData()]);

  const candidates: CandidateStream[] = [];
  const seenUrls = new Set<string>();

  for (const [dayKey, categories] of Object.entries(schedule)) {
    // Day boost: 1.0 for today, 0.85 for yesterday/tomorrow (covers tz edge cases), 0.6 otherwise
    let dayBoost = 0.6;
    if (dayKey === todayK) dayBoost = 1.0;
    else if (dayKey === yesterdayK || dayKey === tomorrowK) dayBoost = 0.85;

    for (const [category, events] of Object.entries(categories)) {
      const sportDetected = detectSport('', category);
      // Skip categories of a different sport (but allow 'other')
      if (sport && sportDetected !== sport && sportDetected !== 'other') continue;

      for (const event of events) {
        const eventName = event.event || '';
        const homeScore = teamMatchScore(homeVariants, eventName);
        const awayScore = teamMatchScore(awayVariants, eventName);

        // Fuzzy match threshold:
        // - Both teams score >= 0.5 → strong match (accept)
        // - One team >= 0.6 AND other >= 0.35 → good partial (accept)
        // - Both teams >= 0.35 → weak but plausible (accept with low priority)
        const bothStrong = homeScore >= 0.5 && awayScore >= 0.5;
        const oneStrong = (homeScore >= 0.6 && awayScore >= 0.35) || (awayScore >= 0.6 && homeScore >= 0.35);
        const bothWeak = homeScore >= 0.35 && awayScore >= 0.35;
        if (!bothStrong && !oneStrong && !bothWeak) continue;

        const matchScore = (homeScore + awayScore) / 2;
        const allChannels = [...(event.channels || []), ...(event.channels2 || [])];

        for (const ch of allChannels) {
          // Find channel data by channel_id (most reliable) or name
          const channelEntry = Object.entries(channelsData).find(([, data]) => {
            return data.channel_url.includes(`stream-${ch.channel_id}.php`) ||
                   data.channel_url.includes(`stream_${ch.channel_id}`);
          });

          let streamUrl = '';
          let channelLogo = '';
          let channelName = ch.channel_name;
          let groupTitle = '';

          if (channelEntry) {
            const [chName, chData] = channelEntry;
            streamUrl = chData.stream_url;
            channelLogo = chData.tvg_logo;
            groupTitle = chData.group_title;
            channelName = ch.channel_name || chName;
          } else {
            // Fallback to dlhd.st embed page (will be resolved client-side)
            streamUrl = `https://dlhd.st/stream/stream-${ch.channel_id}.php`;
          }

          if (!streamUrl || isDeadUrl(streamUrl)) continue;
          if (seenUrls.has(streamUrl)) continue;
          seenUrls.add(streamUrl);

          const isM3u8 = streamUrl.includes('.m3u8');
          candidates.push({
            name: channelName,
            url: streamUrl,
            logo: channelLogo,
            type: isM3u8 ? 'm3u8' : 'embed',
            source: 'daddylive',
            score: matchScore * dayBoost,
            dayBoost,
            eventName,
          });
        }
      }
    }
  }

  // Sort: m3u8 first, then by match score + day boost (highest first)
  candidates.sort((a, b) => {
    if (a.type === 'm3u8' && b.type !== 'm3u8') return -1;
    if (a.type !== 'm3u8' && b.type === 'm3u8') return 1;
    return b.score - a.score;
  });

  console.log(`[Find Stream] ${candidates.length} candidates for "${homeTeam}" vs "${awayTeam}" (sport=${sport})`);

  // ── Validate m3u8 candidates one-by-one. Return the FIRST one that's valid OR unknown. ──
  // 'unknown' streams get the benefit of the doubt (the proxy may still recover them).
  // Only skip streams confirmed 'invalid'.
  const m3u8Candidates = candidates.filter(c => c.type === 'm3u8');
  const alternatives: Array<{ name: string; url: string; logo: string }> = [];

  // Validate in PARALLEL for speed (max ~7s total regardless of candidate count)
  if (m3u8Candidates.length > 0) {
    const m3u8Results = await Promise.allSettled(
      m3u8Candidates.map(async c => ({ candidate: c, status: await validateM3u8(c.url) }))
    );
    // Pick first 'valid', or first 'unknown' if none 'valid'
    let chosen: { candidate: typeof m3u8Candidates[0]; status: string } | null = null;
    for (const r of m3u8Results) {
      if (r.status === 'fulfilled' && r.value.status === 'valid') { chosen = r.value; break; }
    }
    if (!chosen) {
      for (const r of m3u8Results) {
        if (r.status === 'fulfilled' && r.value.status === 'unknown') { chosen = r.value; break; }
      }
    }

    if (chosen) {
      const candidate = chosen.candidate;
      const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(candidate.url)}`;
      console.log(`[Find Stream] ✅ Playing ${candidate.name} (status=${chosen.status}, score=${candidate.score.toFixed(2)}, day=${candidate.dayBoost})`);

      // Collect alternatives from other valid/unknown candidates
      for (const r of m3u8Results) {
        if (r.status === 'fulfilled' && r.value.candidate !== candidate && r.value.status !== 'invalid') {
          alternatives.push({
            name: r.value.candidate.name,
            url: `/api/stream-proxy?url=${encodeURIComponent(r.value.candidate.url)}`,
            logo: r.value.candidate.logo,
          });
        }
      }

      return NextResponse.json({
        found: true,
        stream: {
          url: proxiedUrl,
          name: candidate.name,
          logo: candidate.logo,
          type: 'm3u8' as const,
        },
        alternatives: alternatives.slice(0, 5),
        tried: m3u8Candidates.length,
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
  }

  // No m3u8 was playable. Try resolving embed streams to m3u8 via resolve-stream
  const embedCandidates = candidates.filter(c => c.type === 'embed' && !isDeadUrl(c.url));

  if (embedCandidates.length > 0) {
    for (const candidate of embedCandidates.slice(0, 3)) {
      try {
        const resolveRes = await fetch(
          `http://localhost:3000/api/resolve-stream?url=${encodeURIComponent(btoa(candidate.url))}`,
          { headers: COMMON_HEADERS, signal: AbortSignal.timeout(10000) }
        );

        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.url && resolveData.url.includes('.m3u8')) {
            const status = await validateM3u8(resolveData.url);
            if (status !== 'invalid') {
              const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(resolveData.url)}`;
              console.log(`[Find Stream] ✅ Resolved embed → m3u8: ${candidate.name}`);
              return NextResponse.json({
                found: true,
                stream: {
                  url: proxiedUrl,
                  name: candidate.name,
                  logo: candidate.logo,
                  type: 'm3u8' as const,
                },
                alternatives: [],
                tried: m3u8Candidates.length + embedCandidates.indexOf(candidate) + 1,
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
          }
        }
      } catch { /* try next */ }
    }
  }

  // ── Nothing confirmed playable. Try competition-based fallback channels. ──
  // This handles the case where the DaddyLive schedule doesn't contain the specific
  // match (e.g., schedule is from a different date, or match simply not listed).
  // We pick channels that are likely to broadcast this competition.
  const fallbackChannelNames = getCompetitionChannels(competition, sport as 'football' | 'basketball');
  const fallbackCandidates: CandidateStream[] = [];

  for (const fc of fallbackChannelNames) {
    // Find the channel in channelsData by exact name (case-insensitive)
    const channelEntry = Object.entries(channelsData).find(([name]) => {
      return name.toLowerCase() === fc.name.toLowerCase();
    });
    if (!channelEntry) continue;
    const [chName, chData] = channelEntry;
    const streamUrl = chData.stream_url;
    if (!streamUrl || isDeadUrl(streamUrl) || seenUrls.has(streamUrl)) continue;
    seenUrls.add(streamUrl);

    const isM3u8 = streamUrl.includes('.m3u8');
    fallbackCandidates.push({
      name: chName,
      url: streamUrl,
      logo: chData.tvg_logo,
      type: isM3u8 ? 'm3u8' : 'embed',
      source: 'competition-fallback',
      score: 0.3, // lower than match-based (which are 0.4+)
      dayBoost: 1.0,
      eventName: `${fc.reason} (${competition || sport})`,
    });
  }

  // Merge fallback into candidates (existing candidates stay first if any)
  const allCandidates = [...candidates, ...fallbackCandidates];
  // Sort: m3u8 first, then by score
  allCandidates.sort((a, b) => {
    if (a.type === 'm3u8' && b.type !== 'm3u8') return -1;
    if (a.type !== 'm3u8' && b.type === 'm3u8') return 1;
    return b.score - a.score;
  });

  // Validate fallback m3u8 candidates in PARALLEL (much faster than sequential)
  const fallbackM3u8 = fallbackCandidates.filter(c => c.type === 'm3u8');
  if (fallbackM3u8.length > 0) {
    const validationResults = await Promise.allSettled(
      fallbackM3u8.map(async c => ({ candidate: c, status: await validateM3u8(c.url) }))
    );

    // Find the first valid/unknown (not invalid) — prefer 'valid'
    let chosen: CandidateStream | null = null;
    for (const r of validationResults) {
      if (r.status === 'fulfilled' && r.value.status === 'valid') {
        chosen = r.value.candidate;
        break;
      }
    }
    if (!chosen) {
      for (const r of validationResults) {
        if (r.status === 'fulfilled' && r.value.status === 'unknown') {
          chosen = r.value.candidate;
          break;
        }
      }
    }

    if (chosen) {
      const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(chosen.url)}`;
      console.log(`[Find Stream] ✅ Playing FALLBACK ${chosen.name} (status=${validationResults.find(r => r.status === 'fulfilled' && r.value.candidate === chosen)?.value?.status})`);

      // Collect alternatives from other valid/unknown fallback + existing candidates
      const alternatives: Array<{ name: string; url: string; logo: string }> = [];
      for (const r of validationResults) {
        if (r.status === 'fulfilled' && r.value.candidate !== chosen && r.value.status !== 'invalid') {
          alternatives.push({
            name: r.value.candidate.name,
            url: `/api/stream-proxy?url=${encodeURIComponent(r.value.candidate.url)}`,
            logo: r.value.candidate.logo,
          });
        }
      }

      return NextResponse.json({
        found: true,
        stream: {
          url: proxiedUrl,
          name: chosen.name,
          logo: chosen.logo,
          type: 'm3u8' as const,
        },
        alternatives: alternatives.slice(0, 5),
        tried: m3u8Candidates.length + Math.min(embedCandidates.length, 3) + fallbackM3u8.length,
        totalCandidates: allCandidates.length,
        candidates: allCandidates.slice(0, 12).map(c => ({
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
  }

  // ── Return ALL candidates (schedule + fallback) so the UI can show them as "try anyway". ──
  console.log(`[Find Stream] ⚠ No verified stream, returning ${allCandidates.length} candidates as fallback (${fallbackCandidates.length} from competition mapping)`);

  return NextResponse.json({
    found: false,
    tried: m3u8Candidates.length + Math.min(embedCandidates.length, 3) + fallbackM3u8.length,
    totalCandidates: allCandidates.length,
    // Return ALL candidates (including fallbacks) — UI will let user try them in-app
    candidates: allCandidates.slice(0, 12).map(c => ({
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
