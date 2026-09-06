import { NextRequest, NextResponse } from 'next/server';
import { fetchSportsChannels, isSportsChannel, type ParsedChannel } from '@/lib/iptv';

/**
 * IPTV Channel Search API — DEEP VALIDATION
 *
 * Searches IPTV-org playlists for channels matching a competition's broadcasters.
 * Each channel is validated through the stream-proxy with a DEEP check:
 *  - For master playlists: follows sub-playlist, then fetches first segment
 *  - For media playlists: fetches first segment directly
 *  - Only channels where BOTH playlist AND first segment return 200 are returned.
 *
 * This ensures "DISPONIBLE" really means the channel will play end-to-end.
 *
 * GET /api/iptv-channels?competition=Premier League&sport=football
 */

// ─── Competition → channel name keywords mapping ──────────────────────────
const COMPETITION_KEYWORDS: Record<string, { keywords: string[]; excludeKeywords?: string[] }> = {
  'premier league': {
    keywords: ['sky sports', 'tnt sport', 'premier sport', 'talksport', 'btsport'],
    excludeKeywords: ['news', 'racing', 'golf', 'tennis', 'cricket', 'darts'],
  },
  'la liga': {
    keywords: ['bein sport', 'movistar', '#vamos', 'gol', 'laliga', 'la liga'],
    excludeKeywords: ['news', 'nba', 'nfl'],
  },
  'serie a': {
    keywords: ['dazn', 'sky sport', 'tnt sport', 'premium', 'mediaset', 'rai sport', 'arena sport'],
    excludeKeywords: ['news', 'bundesliga'],
  },
  'bundesliga': {
    keywords: ['dazn', 'sky sport', 'euro sport', 'sport 1', 'arena sport', 'digi sport', 'go3'],
    excludeKeywords: ['news'],
  },
  'ligue 1': {
    keywords: ['canal+', 'canal +', 'bein sport', "l'equipe", 'equipe tv', 'rmc sport', 'prime video'],
    excludeKeywords: ['news', 'moto', 'rugby', 'cinema'],
  },
  'mls': {
    keywords: ['fox sport', 'espn', 'apple tv', 'mls', 'tsn', 'sportsnet'],
    excludeKeywords: ['news'],
  },
  'saudi pro league': {
    keywords: ['bein sport', 'ssc', 'saudi sport'],
    excludeKeywords: ['news'],
  },
  'champions league': {
    keywords: ['tnt sport', 'bein sport', 'canal+', 'movistar', 'prime video', 'dazn', 'golazo'],
    excludeKeywords: ['news'],
  },
  'europa league': {
    keywords: ['tnt sport', 'bein sport', 'canal+', 'movistar', 'prime video'],
    excludeKeywords: ['news'],
  },
  'nba': {
    keywords: ['nba tv', 'espn', 'tnt', 'nba league pass', 'fox sport'],
    excludeKeywords: ['news', 'golf'],
  },
  'euroleague': {
    keywords: ['euroleague', 'espn', 'bein sport', 'nova sport'],
    excludeKeywords: ['news'],
  },
  'ncaa': {
    keywords: ['espn', 'fox sport', 'cbssn', 'cbs sports', 'sec network'],
    excludeKeywords: ['news'],
  },
  'nws': {
    keywords: ['espn', 'cbs', 'nbc'],
    excludeKeywords: ['news'],
  },
  'primera ligue': {
    keywords: ['sport tv', 'benfica', 'porto'],
    excludeKeywords: ['news'],
  },
  'saudi': {
    keywords: ['bein sport', 'ssc', 'saudi'],
    excludeKeywords: ['news'],
  },
};

function getCompetitionKeywords(competition: string, sport: string): { keywords: string[]; excludeKeywords: string[] } {
  const c = (competition || '').toLowerCase();
  for (const [key, val] of Object.entries(COMPETITION_KEYWORDS)) {
    if (c.includes(key)) return val;
  }
  if (sport === 'basketball') {
    return { keywords: ['espn', 'nba tv', 'fox sport'], excludeKeywords: ['news'] };
  }
  return { keywords: ['espn', 'bein sport', 'sky sport', 'fox sport'], excludeKeywords: ['news'] };
}

// ─── Deep validation through the stream-proxy ─────────────────────────────
// Returns true only if:
//   1. The playlist (master or media) returns 200 + #EXTM3U
//   2. For master playlists: the first sub-playlist also returns 200 + #EXTM3U
//   3. A .ts segment is reachable and returns 200 with video content
async function validateChannelDeep(url: string): Promise<boolean> {
  try {
    // Step 1: Fetch the top-level playlist via stream-proxy
    const proxyUrl = `http://localhost:3000/api/stream-proxy?url=${encodeURIComponent(url)}`;
    const r1 = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!r1.ok) return false;
    const p1 = await r1.text();
    if (!p1.includes('#EXTM3U')) return false;

    // Find the first URL line (could be a sub-playlist OR a segment)
    const lines = p1.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length === 0) return false;

    const firstLine = lines[0];
    // Resolve relative/rewritten URL to absolute through the proxy
    const resolveUrl = (line: string): string => {
      if (line.startsWith('/api/stream-proxy')) return `http://localhost:3000${line}`;
      if (line.startsWith('http')) return `http://localhost:3000/api/stream-proxy?url=${encodeURIComponent(line)}`;
      return ''; // relative URL not rewritten by proxy — skip
    };

    const firstUrl = resolveUrl(firstLine);
    if (!firstUrl) return false;

    // Step 2: Fetch the first URL. If it's a sub-playlist (.m3u8), follow it. If it's a segment (.ts), verify it.
    const isSubPlaylist = firstLine.includes('.m3u8') || !firstLine.includes('.ts');
    if (isSubPlaylist) {
      // Follow sub-playlist
      const r2 = await fetch(firstUrl, {
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!r2.ok) return false;
      const p2 = await r2.text();
      if (!p2.includes('#EXTM3U')) return false;

      // Find first segment in sub-playlist
      const segLines = p2.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      for (const seg of segLines.slice(0, 3)) {
        if (seg.includes('.ts')) {
          const segUrl = resolveUrl(seg);
          if (!segUrl) continue;
          const sr = await fetch(segUrl, {
            signal: AbortSignal.timeout(4000),
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          if (sr.ok) {
            const ct = sr.headers.get('content-type') || '';
            const buf = await sr.arrayBuffer();
            return buf.byteLength > 1000 && (ct.includes('mp2t') || ct.includes('video') || ct.includes('octet-stream') || ct === '');
          }
        }
      }
      return false;
    } else {
      // Direct segment — verify it
      const sr = await fetch(firstUrl, {
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!sr.ok) return false;
      const ct = sr.headers.get('content-type') || '';
      const buf = await sr.arrayBuffer();
      return buf.byteLength > 1000 && (ct.includes('mp2t') || ct.includes('video') || ct.includes('octet-stream') || ct === '');
    }
  } catch {
    return false;
  }
}

// ─── Cache (globalThis for HMR persistence) ────────────────────────────────
const _g = globalThis as unknown as { __iptvChannelsCache?: Map<string, { data: any; timestamp: number }> };
if (!_g.__iptvChannelsCache) _g.__iptvChannelsCache = new Map();
const cache = _g.__iptvChannelsCache;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (deep validation is expensive, cache longer)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const competition = searchParams.get('competition') || '';
  const sport = searchParams.get('sport') || 'football';

  const cacheKey = `${sport}:${competition}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  console.log(`[IPTV Channels] Searching for competition="${competition}" sport=${sport}`);

  try {
    const allChannels = await fetchSportsChannels();
    if (allChannels.length === 0) {
      return NextResponse.json({ channels: [], note: 'No IPTV channels available' });
    }

    const { keywords, excludeKeywords } = getCompetitionKeywords(competition, sport);

    // Filter channels by name matching keywords
    const matchedChannels = allChannels.filter(ch => {
      const name = (ch.name || '').toLowerCase();
      const group = (ch.group || '').toLowerCase();

      if (!isSportsChannel(ch) && !keywords.some(k => name.includes(k))) return false;
      const matches = keywords.some(k => name.includes(k) || group.includes(k));
      if (!matches) return false;
      for (const ex of excludeKeywords) {
        if (name.includes(ex)) return false;
      }
      if (!ch.url || !ch.url.startsWith('http')) return false;
      return true;
    });

    // Deduplicate by URL
    const seen = new Set<string>();
    const deduped = matchedChannels.filter(ch => {
      if (seen.has(ch.url)) return false;
      seen.add(ch.url);
      return true;
    });

    console.log(`[IPTV Channels] Found ${deduped.length} candidate channels (keywords: ${keywords.join(', ')})`);

    // DEEP validation: playlist + first segment. Only channels that fully play are returned.
    // Validate in parallel with high concurrency (10 at a time) for speed.
    const channelsToValidate = deduped.slice(0, 30);
    const workingChannels: ParsedChannel[] = [];
    const batchSize = 10;
    for (let i = 0; i < channelsToValidate.length; i += batchSize) {
      const batch = channelsToValidate.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (ch) => {
          const works = await validateChannelDeep(ch.url);
          return { channel: ch, works };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.works) {
          workingChannels.push(r.value.channel);
        }
      }
      // Early exit if we have enough working channels (5+)
      if (workingChannels.length >= 5) break;
    }

    console.log(`[IPTV Channels] ${workingChannels.length} channels CONFIRMED FULLY PLAYABLE (playlist + segment)`);

    const result = {
      channels: workingChannels.map(ch => ({
        name: ch.name,
        url: `/api/stream-proxy?url=${encodeURIComponent(ch.url)}`,
        channelLogo: ch.logo,
        group: ch.group,
        source: 'iptv-org',
        type: 'm3u8',
      })),
      total: workingChannels.length,
      tested: channelsToValidate.length,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[IPTV Channels] Error:', err);
    return NextResponse.json({ channels: [], error: 'Failed to fetch IPTV channels' }, { status: 200 });
  }
}
