import { NextRequest, NextResponse } from 'next/server';

/**
 * DaddyLive Stream Resolver
 *
 * For channels not in the GitHub channels data, we try to guess the m3u8 URL
 * using known subdomain patterns. Each DaddyLive channel uses a subdomain
 * pattern like: https://{subdomain}.newkso.ru/{path}/premium{channelId}/mono.m3u8
 *
 * Known subdomain -> path mappings:
 *   windnew  -> wind
 *   ddy6new  -> ddy6
 *   zekonew  -> zeko
 *   dokko1new -> dokko1
 *   nfsnew   -> nfs
 *   ddh2new  -> ddh2
 *   wikinew  -> wiki
 *   top2new  -> top2
 *
 * The Origin/Referer must be set to https://jxoxkplay.xyz for Cloudflare bypass.
 * This is handled by our /api/stream-proxy on the frontend side.
 */

const SUBDOMAIN_PATTERNS = [
  { subdomain: 'zekonew', path: 'zeko' },
  { subdomain: 'windnew', path: 'wind' },
  { subdomain: 'ddy6new', path: 'ddy6' },
  { subdomain: 'dokko1new', path: 'dokko1' },
  { subdomain: 'nfsnew', path: 'nfs' },
  { subdomain: 'ddh2new', path: 'ddh2' },
  { subdomain: 'wikinew', path: 'wiki' },
  { subdomain: 'top2new', path: 'top2' },
];

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Origin': 'https://jxoxkplay.xyz',
  'Referer': 'https://jxoxkplay.xyz/',
};

// Cache for resolved m3u8 URLs (5 min TTL)
interface CacheEntry {
  url: string;
  timestamp: number;
}
const resolveCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return NextResponse.json({ error: 'Missing channelId parameter' }, { status: 400 });
  }

  // Check cache first
  const cached = resolveCache.get(channelId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      success: true,
      url: cached.url,
      type: 'm3u8',
      source: 'daddylive-resolve',
    });
  }

  // Try each subdomain pattern to find a working m3u8 URL
  const candidates = SUBDOMAIN_PATTERNS.map(p => ({
    url: `https://${p.subdomain}.newkso.ru/${p.path}/premium${channelId}/mono.m3u8`,
    subdomain: p.subdomain,
  }));

  // Try candidates in parallel with a short timeout
  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(candidate.url, {
          headers: COMMON_HEADERS,
          signal: controller.signal,
          redirect: 'follow',
        });

        clearTimeout(timeout);

        // Check if we got a valid m3u8 response
        if (res.ok) {
          const text = await res.text();
          if (text.includes('#EXTM3U') || text.includes('#EXTINF') || text.includes('.m3u8')) {
            return candidate.url;
          }
        }

        // 403 from Cloudflare often means the URL exists but needs browser-like access
        // Our stream-proxy can handle this on the frontend
        if (res.status === 403) {
          return candidate.url; // Return as potential match
        }

        return null;
      } catch {
        clearTimeout(timeout);
        return null;
      }
    })
  );

  // Find the first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      // Cache the resolved URL
      resolveCache.set(channelId, { url: result.value, timestamp: Date.now() });

      console.log(`[DaddyLive Resolve] Channel ${channelId} -> ${result.value}`);

      return NextResponse.json({
        success: true,
        url: result.value,
        type: 'm3u8',
        source: 'daddylive-resolve',
      });
    }
  }

  // If no m3u8 found, try fetching the dlhd.st page to extract the stream URL
  try {
    const pageUrl = `https://dlhd.st/stream/stream-${channelId}.php`;
    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': COMMON_HEADERS['User-Agent'],
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    if (pageRes.ok) {
      const html = await pageRes.text();

      // Look for m3u8 URLs in the page content
      const m3u8Regex = /https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;
      const m3u8Match = m3u8Regex.exec(html);

      if (m3u8Match) {
        const streamUrl = m3u8Match[0];
        resolveCache.set(channelId, { url: streamUrl, timestamp: Date.now() });

        console.log(`[DaddyLive Resolve] Channel ${channelId} -> ${streamUrl} (from page)`);

        return NextResponse.json({
          success: true,
          url: streamUrl,
          type: 'm3u8',
          source: 'daddylive-resolve',
        });
      }

      // Look for iframe src that might contain the stream
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let iframeMatch;
      while ((iframeMatch = iframeRegex.exec(html)) !== null) {
        const iframeSrc = iframeMatch[1];
        if (iframeSrc.includes('m3u8') || iframeSrc.includes('stream')) {
          console.log(`[DaddyLive Resolve] Channel ${channelId} -> iframe: ${iframeSrc}`);

          return NextResponse.json({
            success: true,
            url: iframeSrc,
            type: 'embed',
            source: 'daddylive-resolve',
          });
        }
      }
    }
  } catch (err) {
    console.warn(`[DaddyLive Resolve] Failed to fetch page for channel ${channelId}:`, err);
  }

  // Last resort: return the first candidate URL as a guess
  // The stream-proxy on the frontend will try to access it
  const guessedUrl = candidates[0].url;
  console.log(`[DaddyLive Resolve] Channel ${channelId} -> guessed: ${guessedUrl}`);

  return NextResponse.json({
    success: false,
    url: guessedUrl,
    type: 'm3u8',
    source: 'daddylive-resolve',
    guessed: true,
  });
}
