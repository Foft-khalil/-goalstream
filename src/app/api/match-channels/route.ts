import { NextRequest, NextResponse } from 'next/server';

/**
 * Match Channels API — DEFINITIVE VERSION
 *
 * Calls kora-api per-match endpoint, resolves each embed to direct m3u8.
 * GET /api/match-channels?matchId=31358&lang=en
 */

const KORA_API_MATCH = 'https://ws.kora-api.top/api/matche';
const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

const _g = globalThis as unknown as { __matchChannelsCache?: Map<string, { data: any; timestamp: number }> };
if (!_g.__matchChannelsCache) _g.__matchChannelsCache = new Map();
const cache = _g.__matchChannelsCache;
const CACHE_TTL = 60 * 1000;

async function verifyM3u8(url: string, referer: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { ...COMMON_HEADERS, Referer: referer },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes('#EXTM3U');
  } catch { return false; }
}

// Resolve embed page → direct m3u8 URL
async function resolveEmbed(embedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(embedUrl, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Strategy 1: Clappr sourceUrl/source = "..."
    const clappr = html.match(/(?:sourceUrl|source)\s*[:=]\s*["']([^"']+)["']/i);
    if (clappr && await verifyM3u8(clappr[1], embedUrl)) return clappr[1];

    // Strategy 2: Direct m3u8 URL in HTML
    const m3u8 = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
    if (m3u8 && await verifyM3u8(m3u8[0], embedUrl)) return m3u8[0];

    // Strategy 3: Follow iframe
    const iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframe) {
      try {
        const iRes = await fetch(iframe[1], {
          headers: { ...COMMON_HEADERS, Referer: embedUrl },
          signal: AbortSignal.timeout(5000),
        });
        if (iRes.ok) {
          const iHtml = await iRes.text();
          const iM3u8 = iHtml.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
          if (iM3u8 && await verifyM3u8(iM3u8[0], iframe[1])) return iM3u8[0];
          const iClappr = iHtml.match(/(?:sourceUrl|source)\s*[:=]\s*["']([^"']+)["']/i);
          if (iClappr && await verifyM3u8(iClappr[1], iframe[1])) return iClappr[1];
        }
      } catch {}
    }
    return null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('matchId') || '';
  const lang = searchParams.get('lang') || 'en';
  if (!matchId) return NextResponse.json({ channels: [] });

  const cacheKey = `${matchId}:${lang}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return NextResponse.json(cached.data);

  console.log(`[Match Channels] Fetching for match ${matchId}`);
  try {
    const res = await fetch(`${KORA_API_MATCH}/${matchId}/${lang}?t=${Date.now()}`, {
      headers: COMMON_HEADERS, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ channels: [] });
    const matchData = await res.json();
    if (!matchData.channels || matchData.channels.length === 0) {
      return NextResponse.json({ channels: [], match: { home: matchData.home_en, away: matchData.away_en } });
    }

    console.log(`[Match Channels] ${matchData.channels.length} channels found`);

    // Return channels — each is loaded via creatoriva.online proxy (like hes-goal.click)
    // creatoriva.online's JavaScript fetches kora-api, creates Clappr player, plays stream.
    // We serve it through our proxy-stream (strips X-Frame-Options: SAMEORIGIN).
    const channels = matchData.channels.map((ch: any, idx: number) => {
      const type = ch.type || 'HLS';
      const link = ch.link || '';
      const edge = Number(ch.edge) || 0;
      const name = ch.server_name || `Server ${idx + 1}`;
      if (!link) return null;

      // HLS type: direct m3u8 — play via stream-proxy
      if (type === 'HLS' && link.includes('.m3u8')) {
        return { name, url: `/api/stream-proxy?url=${encodeURIComponent(link)}`, type: 'm3u8', source: 'kora-api' };
      }

      // Landscape/Frame type with edge=0: load the embed page directly in iframe.
      // sportsonliine.click and gozowatch.top have NO X-Frame-Options.
      // The browser executes the JavaScript (Clappr player) and plays the stream.
      if ((type === 'Landscape' || type === 'Frame') && edge === 0) {
        return { name, url: link, type: 'embed', source: 'kora-api' };
      }

      return null;
    }).filter((c: any) => c !== null);

    console.log(`[Match Channels] ${channels.length}/${matchData.channels.length} channels returned`);

    const result = {
      channels,
      match: { home: matchData.home_en, away: matchData.away_en, league: matchData.league_en },
    };
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Match Channels] Error:', err);
    return NextResponse.json({ channels: [] });
  }
}
