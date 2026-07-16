import { NextRequest, NextResponse } from 'next/server';

/**
 * Auto-Find Stream API
 *
 * Finds the best working stream for a live match.
 * This is the "one-click play" endpoint: it searches all sources,
 * validates each stream, and returns the first one that actually works.
 *
 * GET /api/find-stream?homeTeam=X&awayTeam=Y&sport=football
 * Response: { found: boolean, stream?: { url, name, logo, type }, tried: number }
 */

// ─── Team matching (simplified, shared with daddylive route) ────────────────
function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function getTeamVariants(name: string): string[] {
  const normalized = normalizeTeamName(name);
  const variants = [normalized];
  const words = normalized.split(/\s+/);
  if (words.length > 1) variants.push(words[0]);
  if (words.length > 2) variants.push(words[words.length - 1]);
  if (normalized.length > 3) variants.push(normalized.substring(0, 3));

  const aliases: Record<string, string[]> = {
    'manchester city': ['man city', 'mancity'],
    'manchester united': ['man utd', 'manunited'],
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
    'inter miami': ['miami', 'inter miami cf'],
    'la galaxy': ['galaxy', 'los angeles galaxy'],
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

function cleanHtml(text: string): string {
  return text.replace(/<\/?span>/g, '').replace(/<\/?[^>]+>/g, '').trim();
}

function detectSport(eventName: string, category: string): string {
  const catLower = cleanHtml(category).toLowerCase();
  if (catLower.includes('soccer') || catLower.includes('football')) return 'football';
  if (catLower.includes('basketball') || catLower.includes('nba')) return 'basketball';
  return 'other';
}

// ─── Dead domains ──────────────────────────────────────────────────────────
const DEAD_DOMAINS = [
  'streams.center', 'streamcenter.pro', 'tvhd2.com',
  'kora-api.top', 'sportsonlinne.click', 'dlhd.click',
];

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
}

// ─── Cache ──────────────────────────────────────────────────────────────────
const scheduleCache = new Map<string, { data: any; timestamp: number }>();
const channelsCache = new Map<string, { data: any; timestamp: number }>();
const streamHealthCache = new Map<string, { valid: boolean; timestamp: number }>();

const SCHEDULE_TTL = 2 * 60 * 1000;
const CHANNELS_TTL = 30 * 60 * 1000;
const HEALTH_TTL = 3 * 60 * 1000;

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/html, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

// ─── Validate m3u8 stream (strict!) ──────────────────────────────────────
async function validateM3u8(url: string): Promise<boolean> {
  const cached = streamHealthCache.get(url);
  if (cached && Date.now() - cached.timestamp < HEALTH_TTL) return cached.valid;

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
      method: 'GET', headers, signal: AbortSignal.timeout(8000), redirect: 'follow',
    });

    let valid = false;
    if (res.ok) {
      const text = await res.text();
      valid = text.includes('#EXTM3U') || text.includes('#EXTINF');
    }
    // 403 = Cloudflare blocked but stream might exist — try to play via proxy
    if (res.status === 403) valid = true;

    streamHealthCache.set(url, { valid, timestamp: Date.now() });
    return valid;
  } catch {
    // Network error — strict: mark as invalid
    streamHealthCache.set(url, { valid: false, timestamp: Date.now() });
    return false;
  }
}

// ─── Fetch schedule ────────────────────────────────────────────────────────
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

// ─── Fetch channels data ──────────────────────────────────────────────────
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

// ─── GET handler ──────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('homeTeam') || '';
  const awayTeam = searchParams.get('awayTeam') || '';
  const sport = searchParams.get('sport') || 'football';

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ found: false, tried: 0 });
  }

  const homeVariants = getTeamVariants(homeTeam);
  const awayVariants = getTeamVariants(awayTeam);
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // Fetch schedule and channels in parallel
  const [schedule, channelsData] = await Promise.all([fetchSchedule(), fetchChannelsData()]);

  // Collect ALL candidate streams (both teams must match for live)
  const candidates: CandidateStream[] = [];

  for (const [dayKey, categories] of Object.entries(schedule)) {
    // Only today and yesterday
    if (dayKey !== todayKey && dayKey !== yesterdayKey) continue;

    for (const [category, events] of Object.entries(categories)) {
      const sportDetected = detectSport('', category);
      if (sport && sportDetected !== sport && sportDetected !== 'other') continue;

      for (const event of events) {
        const eventName = event.event || '';
        const homeMatch = teamMatchesInName(homeVariants, eventName);
        const awayMatch = teamMatchesInName(awayVariants, eventName);

        // Strict: BOTH teams must match
        if (!homeMatch || !awayMatch) continue;

        const allChannels = [...(event.channels || []), ...(event.channels2 || [])];

        for (const ch of allChannels) {
          if (DEAD_DOMAINS.some(d => ch.channel_name.toLowerCase().includes(d))) continue;

          const channelEntry = Object.entries(channelsData).find(([name, data]) => {
            return data.channel_url.includes(`stream-${ch.channel_id}.php`) ||
                   data.channel_url.includes(`stream_${ch.channel_id}`) ||
                   name.toLowerCase().includes(ch.channel_name.toLowerCase());
          });

          if (channelEntry) {
            const [chName, chData] = channelEntry;
            const streamUrl = chData.stream_url;
            if (DEAD_DOMAINS.some(d => streamUrl.includes(d))) continue;

            const isM3u8 = streamUrl.includes('.m3u8');
            candidates.push({
              name: ch.channel_name || chName,
              url: streamUrl,
              logo: chData.tvg_logo,
              type: isM3u8 ? 'm3u8' : 'embed',
              source: 'daddylive',
            });
          }
        }
      }
    }
  }

  // Sort: m3u8 first (best chance of working in-app)
  candidates.sort((a, b) => {
    if (a.type === 'm3u8' && b.type !== 'm3u8') return -1;
    if (a.type !== 'm3u8' && b.type === 'm3u8') return 1;
    return 0;
  });

  // Validate m3u8 streams one by one, return the FIRST one that works
  const m3u8Candidates = candidates.filter(c => c.type === 'm3u8');

  console.log(`[Find Stream] Found ${candidates.length} candidates (${m3u8Candidates.length} m3u8) for "${homeTeam}" vs "${awayTeam}"`);

  for (const candidate of m3u8Candidates) {
    const isValid = await validateM3u8(candidate.url);
    if (isValid) {
      const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(candidate.url)}`;
      console.log(`[Find Stream] ✅ Found working stream: ${candidate.name} (${candidate.url})`);

      // Also collect other valid m3u8 streams as alternatives
      const alternatives: Array<{ name: string; url: string; logo: string }> = [];

      const remainingM3u8 = m3u8Candidates.filter(c => c.url !== candidate.url).slice(0, 5);
      const altResults = await Promise.allSettled(
        remainingM3u8.map(async c => {
          const valid = await validateM3u8(c.url);
          return valid ? c : null;
        })
      );

      for (const result of altResults) {
        if (result.status === 'fulfilled' && result.value) {
          alternatives.push({
            name: result.value.name,
            url: `/api/stream-proxy?url=${encodeURIComponent(result.value.url)}`,
            logo: result.value.logo,
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
        alternatives,
        tried: m3u8Candidates.indexOf(candidate) + 1,
        totalCandidates: candidates.length,
      });
    }
  }

  // No m3u8 stream worked. Try to resolve embed streams to m3u8
  const embedCandidates = candidates.filter(c => c.type === 'embed' && !DEAD_DOMAINS.some(d => c.url.includes(d)));

  if (embedCandidates.length > 0) {
    for (const candidate of embedCandidates.slice(0, 3)) {
      try {
        const resolveRes = await fetch(`http://localhost:3000/api/resolve-stream?url=${encodeURIComponent(btoa(candidate.url))}`, {
          headers: COMMON_HEADERS,
          signal: AbortSignal.timeout(10000),
        });

        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.url && resolveData.url.includes('.m3u8')) {
            const isValid = await validateM3u8(resolveData.url);
            if (isValid) {
              const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(resolveData.url)}`;
              console.log(`[Find Stream] ✅ Resolved embed to working m3u8: ${candidate.name}`);

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
              });
            }
          }
        }
      } catch {
        // Skip this embed, try next
      }
    }
  }

  // Nothing worked
  console.log(`[Find Stream] ❌ No working stream found for "${homeTeam}" vs "${awayTeam}" (tried ${m3u8Candidates.length} m3u8 + ${Math.min(embedCandidates.length, 3)} embed)`);

  return NextResponse.json({
    found: false,
    tried: m3u8Candidates.length + Math.min(embedCandidates.length, 3),
    totalCandidates: candidates.length,
    // Return verified candidates so the frontend can still show them
    fallbackStreams: candidates.slice(0, 8).map(c => ({
      name: c.name,
      url: c.type === 'm3u8' ? `/api/stream-proxy?url=${encodeURIComponent(c.url)}` : c.url,
      logo: c.logo,
      type: c.type,
      source: c.source,
    })),
  });
}
