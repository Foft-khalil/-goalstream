import { NextRequest, NextResponse } from 'next/server';

/**
 * Resolve Embed URL → direct m3u8
 *
 * Fetches an embed page (from kora-api / sportsonliine.click / gozowatch.top)
 * and extracts the direct m3u8 URL that the page's player (Clappr/HLS.js) uses.
 *
 * This avoids iframe embedding — we get the direct m3u8 and play it with HLS.js.
 *
 * GET /api/resolve-embed?url=<embed_page_url>
 */

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const _g = globalThis as unknown as { __resolveEmbedCache?: Map<string, { data: any; timestamp: number }> };
if (!_g.__resolveEmbedCache) _g.__resolveEmbedCache = new Map();
const cache = _g.__resolveEmbedCache;
const CACHE_TTL = 30 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || '';
  if (!url) return NextResponse.json({ m3u8Url: null, error: 'Missing url' });

  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return NextResponse.json(cached.data);

  console.log(`[Resolve Embed] Resolving: ${url}`);

  try {
    const res = await fetch(url, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(8000), redirect: 'follow' });
    if (!res.ok) return NextResponse.json({ m3u8Url: null, error: `HTTP ${res.status}` });
    const html = await res.text();

    // Strategy 1: Clappr.Player source: "..." or sourceUrl = "..."
    const clapprMatch = html.match(/(?:sourceUrl|source)\s*[:=]\s*["']([^"']+)["']/i);
    if (clapprMatch) {
      const m3u8Url = clapprMatch[1];
      console.log(`[Resolve Embed] Clappr source: ${m3u8Url}`);
      if (await verifyM3u8(m3u8Url, url)) {
        const result = { m3u8Url };
        cache.set(url, { data: result, timestamp: Date.now() });
        return NextResponse.json(result);
      }
    }

    // Strategy 2: Direct m3u8 URL in HTML
    const m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
    if (m3u8Match) {
      const m3u8Url = m3u8Match[0];
      console.log(`[Resolve Embed] Direct m3u8: ${m3u8Url}`);
      if (await verifyM3u8(m3u8Url, url)) {
        const result = { m3u8Url };
        cache.set(url, { data: result, timestamp: Date.now() });
        return NextResponse.json(result);
      }
    }

    // Strategy 3: Follow iframe and look for m3u8 inside
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch) {
      const iframeUrl = iframeMatch[1];
      console.log(`[Resolve Embed] Following iframe: ${iframeUrl.slice(0, 80)}`);
      try {
        const iframeRes = await fetch(iframeUrl, { headers: { ...COMMON_HEADERS, Referer: url }, signal: AbortSignal.timeout(5000) });
        if (iframeRes.ok) {
          const iframeHtml = await iframeRes.text();
          // m3u8 in iframe
          const iframeM3u8 = iframeHtml.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
          if (iframeM3u8 && await verifyM3u8(iframeM3u8[0], iframeUrl)) {
            const result = { m3u8Url: iframeM3u8[0] };
            cache.set(url, { data: result, timestamp: Date.now() });
            return NextResponse.json(result);
          }
          // Clappr source in iframe
          const iframeClappr = iframeHtml.match(/source\s*:\s*["']([^"']+)["']/i);
          if (iframeClappr && await verifyM3u8(iframeClappr[1], iframeUrl)) {
            const result = { m3u8Url: iframeClappr[1] };
            cache.set(url, { data: result, timestamp: Date.now() });
            return NextResponse.json(result);
          }
        }
      } catch {}
    }

    return NextResponse.json({ m3u8Url: null, error: 'No m3u8 found' });
  } catch (err) {
    console.error('[Resolve Embed] Error:', err);
    return NextResponse.json({ m3u8Url: null, error: 'Failed' });
  }
}

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
