import { NextRequest, NextResponse } from 'next/server';

/**
 * Stream Proxy for m3u8 HLS streams
 *
 * Some m3u8 stream URLs (like DaddyLive's) require specific Origin/Referer
 * headers to bypass Cloudflare protection. This proxy adds those headers
 * server-side and forwards the response to the client.
 *
 * Usage:
 *   GET /api/stream-proxy?url=ENCODED_M3U8_URL&origin=ENCODED_ORIGIN_URL
 */

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

// ─── Auto-detect the correct Origin header based on m3u8 URL domain ────────
function detectOrigin(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // fltvhd.com / fubo18.com / futbolonlinehd.com streams
    if (hostname.includes('fubo') || hostname.includes('fltvhd') || hostname.includes('futbolonlinehd')) {
      return 'https://fltvhd.com';
    }
    // DaddyLive / newkso.ru streams
    if (hostname.includes('newkso.ru')) {
      return 'https://jxoxkplay.xyz';
    }
    // Default: try without origin (some servers reject wrong origin)
    return '';
  } catch {
    return '';
  }
}

// ─── Cache for m3u8 playlists (short TTL) ───────────────────────────────────
interface CacheEntry {
  body: string;
  contentType: string;
  timestamp: number;
}

const M3U8_CACHE_TTL = 30 * 1000; // 30 seconds
const m3u8Cache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const encodedUrl = searchParams.get('url');
  const encodedOrigin = searchParams.get('origin');

  if (!encodedUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(encodedUrl);
  } catch {
    try {
      targetUrl = atob(encodedUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 });
    }
  }

  let originUrl = '';
  if (encodedOrigin) {
    try {
      originUrl = decodeURIComponent(encodedOrigin);
    } catch {
      try {
        originUrl = atob(encodedOrigin);
      } catch {
        // Keep empty, will auto-detect below
      }
    }
  }

  // Auto-detect origin if not explicitly provided
  if (!originUrl) {
    originUrl = detectOrigin(targetUrl);
  }

  // Check cache for m3u8 playlists
  const cacheKey = targetUrl;
  const cached = m3u8Cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < M3U8_CACHE_TTL) {
    return new NextResponse(cached.body, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    console.log(`[Stream Proxy] Fetching: ${targetUrl}`);

    const headers: Record<string, string> = {
      ...COMMON_HEADERS,
      'Accept': '*/*',
      ...(originUrl ? {
        'Origin': originUrl,
        'Referer': `${originUrl}/`,
      } : {}),
    };

    const response = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`[Stream Proxy] Upstream returned ${response.status} for ${targetUrl}`);
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || '';

    // For m3u8 playlists, rewrite segment URLs to go through our proxy
    if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8')) {
      let playlist = await response.text();

      // Rewrite relative URLs in the playlist to absolute
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      // Rewrite lines that contain segment URLs
      playlist = playlist.split('\n').map(line => {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (trimmed.startsWith('#') || trimmed === '') return line;

        // If it's a relative URL, make it absolute
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          const absoluteUrl = trimmed.startsWith('/') 
            ? `${new URL(targetUrl).origin}${trimmed}`
            : `${baseUrl}${trimmed}`;
          
          // Route through our proxy
          return originUrl
            ? `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}&origin=${encodeURIComponent(originUrl)}`
            : `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}`;
        }

        // If it's an absolute URL to a different domain, route through proxy
        try {
          const segmentUrl = new URL(trimmed);
          const targetDomain = new URL(targetUrl).hostname;
          if (segmentUrl.hostname !== targetDomain || segmentUrl.hostname.includes('newkso.ru') || segmentUrl.hostname.includes('.m3u8')) {
            return originUrl
              ? `/api/stream-proxy?url=${encodeURIComponent(trimmed)}&origin=${encodeURIComponent(originUrl)}`
              : `/api/stream-proxy?url=${encodeURIComponent(trimmed)}`;
          }
        } catch {
          // Not a valid URL, leave as-is
        }

        return line;
      }).join('\n');

      // Cache the playlist
      m3u8Cache.set(cacheKey, {
        body: playlist,
        contentType: 'application/vnd.apple.mpegurl',
        timestamp: Date.now(),
      });

      return new NextResponse(playlist, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // For video segments and other binary content, pass through directly
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[Stream Proxy] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stream' },
      { status: 500 }
    );
  }
}
