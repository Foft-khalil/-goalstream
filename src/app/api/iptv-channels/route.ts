import { NextRequest, NextResponse } from 'next/server';
import { fetchSportsChannels, isSportsChannel, type ParsedChannel } from '@/lib/iptv';

/**
 * IPTV Channel Search API
 *
 * Searches the IPTV-org playlists for channels matching a competition's broadcasters.
 * Each channel is validated through the stream-proxy (the actual playback path) —
 * only channels that return 200 + #EXTM3U are returned as "available".
 *
 * This is the DEFINITIVE way to find channels that ACTUALLY play, because we test
 * through the same proxy that the video player uses.
 *
 * GET /api/iptv-channels?competition=Premier League&sport=football
 */

// ─── Competition → channel name keywords mapping ──────────────────────────
const COMPETITION_KEYWORDS: Record<string, { keywords: string[]; excludeKeywords?: string[] }> = {
  'premier league': {
    keywords: ['sky sports', 'tnt sport', 'premier sport', 'talksport'],
    excludeKeywords: ['news', 'racing', 'golf', 'tennis', 'cricket', 'darts'],
  },
  'la liga': {
    keywords: ['bein sport', 'movistar', '#vamos', 'gol', 'laliga', 'la liga'],
    excludeKeywords: ['news', 'nba', 'nfl'],
  },
  'serie a': {
    keywords: ['dazn', 'sky sport', 'tnt sport', 'premium', 'mediaset', 'rai sport'],
    excludeKeywords: ['news', 'bundesliga'],
  },
  'bundesliga': {
    keywords: ['dazn', 'sky sport', 'euro sport', 'sport 1'],
    excludeKeywords: ['news'],
  },
  'ligue 1': {
    keywords: ['canal+', 'canal +', 'bein sport', "l'equipe", 'equipe tv', 'rmc sport', 'prime video'],
    excludeKeywords: ['news', 'moto', 'rugby'],
  },
  'mls': {
    keywords: ['fox sport', 'espn', 'apple tv', 'mls'],
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
    keywords: ['nba tv', 'espn', 'tnt', 'nba league pass'],
    excludeKeywords: ['news', 'golf'],
  },
  'euroleague': {
    keywords: ['euroleague', 'espn', 'bein sport', 'nova sport'],
    excludeKeywords: ['news'],
  },
  'ncaa': {
    keywords: ['espn', 'fox sport', 'cbssn', 'cbs sports'],
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

// ─── Validate a channel through the stream-proxy (real playback test) ──────
async function validateChannelViaProxy(url: string): Promise<boolean> {
  try {
    // Test through the stream-proxy — the SAME path the video player uses.
    // If this returns 200 + #EXTM3U, the channel will actually play when clicked.
    const proxyUrl = `http://localhost:3000/api/stream-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes('#EXTM3U') || text.includes('#EXTINF');
  } catch {
    return false;
  }
}

// ─── Cache ─────────────────────────────────────────────────────────────────
const _g = globalThis as unknown as { __iptvChannelsCache?: Map<string, { data: any; timestamp: number }> };
if (!_g.__iptvChannelsCache) _g.__iptvChannelsCache = new Map();
const cache = _g.__iptvChannelsCache;
const CACHE_TTL = 2 * 60 * 1000;

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

    // Validate each channel through the stream-proxy — only return channels that ACTUALLY work
    const validationResults = await Promise.allSettled(
      deduped.slice(0, 20).map(async (ch) => {
        const works = await validateChannelViaProxy(ch.url);
        return { channel: ch, works };
      })
    );

    const workingChannels = validationResults
      .filter((r): r is PromiseFulfilledResult<{ channel: ParsedChannel; works: boolean }> =>
        r.status === 'fulfilled' && r.value.works)
      .map(r => r.value.channel);

    console.log(`[IPTV Channels] ${workingChannels.length}/${validationResults.length} channels confirmed working via proxy`);

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
      tested: validationResults.length,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[IPTV Channels] Error:', err);
    return NextResponse.json({ channels: [], error: 'Failed to fetch IPTV channels' }, { status: 200 });
  }
}
