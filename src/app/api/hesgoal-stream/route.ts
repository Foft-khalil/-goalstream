import { NextRequest, NextResponse } from 'next/server';

/**
 * HesGoal Stream Resolution API
 * 
 * Resolves a HesGoal/go4score stream page URL to a playable stream.
 * 
 * Flow:
 * 1. Receives a match ID (e.g., "30731")
 * 2. Fetches the go4score.app stream page for that match
 * 3. Extracts the embedded player iframe URL
 * 4. Follows the iframe chain to find the actual m3u8 stream URL
 * 5. Returns the playable URL (m3u8 or proxied embed)
 * 
 * The stream pages from go4score.app redirect through:
 *   go4score.app/?m=ID → iframe → streams.center/chX.php → hls.php → decrypt.php → m3u8
 * 
 * We use our existing /api/proxy-stream and /api/resolve-stream infrastructure
 * to handle the resolution chain.
 */

const STREAM_BASE = 'https://xyzhes-goal-eu.smartagro.mov/';

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ─── Cache ──────────────────────────────────────────────────────────────────
interface StreamCacheEntry {
  url: string;
  type: 'm3u8' | 'iframe';
  timestamp: number;
}

const STREAM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (streams expire)
const streamCache = new Map<string, StreamCacheEntry>();

// ─── Helper: find m3u8 URL in text ──────────────────────────────────────────
function findM3u8InText(text: string): string | null {
  const m3u8UrlRegex = /https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;
  const match = m3u8UrlRegex.exec(text);
  if (match) return match[0];

  // Try common CDN patterns
  const cdnPatterns = [
    /https?:\/\/[^\s"'<>\\]*mainstreams\.pro\/hls\/[^\s"'<>\\]*/gi,
    /https?:\/\/[^\s"'<>\\]*stream\.wреш[^\s"'<>\\]*/gi,
  ];

  for (const pattern of cdnPatterns) {
    const m = pattern.exec(text);
    if (m) return m[0];
  }

  return null;
}

// ─── Helper: find iframe src in HTML ────────────────────────────────────────
function findIframeSrc(html: string): string | null {
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/i;
  const match = iframeRegex.exec(html);
  return match ? match[1] : null;
}

// ─── Helper: resolve relative URL ───────────────────────────────────────────
function resolveUrl(target: string, baseUrl: string): string {
  if (target.startsWith('http://') || target.startsWith('https://')) return target;
  if (target.startsWith('//')) return `https:${target}`;
  try {
    const base = new URL(baseUrl);
    if (target.startsWith('/')) return `${base.origin}${target}`;
    const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
    return `${base.origin}${basePath}${target}`;
  } catch(_e) {
    return target;
  }
}

// ─── Deep resolve: follow iframe chains to find m3u8 ───────────────────────
async function deepResolve(
  url: string,
  depth: number = 0,
  maxDepth: number = 4,
  visited: Set<string> = new Set()
): Promise<{ url: string; type: 'm3u8' | 'iframe' } | null> {
  if (depth >= maxDepth) return null;
  if (visited.has(url)) return null;
  visited.add(url);

  try {
    console.log(`[HesGoal Stream] Resolving depth ${depth}: ${url}`);

    const res = await fetch(url, {
      headers: {
        ...COMMON_HEADERS,
        'Referer': url,
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    });

    if (!res.ok) {
      console.warn(`[HesGoal Stream] HTTP ${res.status} for ${url}`);
      return null;
    }

    const contentType = res.headers.get('content-type') || '';

    // If it's not HTML, check if it's an m3u8 playlist
    if (contentType.includes('mpegurl') || contentType.includes('x-mpegURL')) {
      return { url, type: 'm3u8' };
    }

    // If not HTML, skip
    if (!contentType.includes('text/html')) {
      return null;
    }

    const html = await res.text();

    // Check if m3u8 URL is directly in the page
    const m3u8 = findM3u8InText(html);
    if (m3u8) {
      console.log(`[HesGoal Stream] Found m3u8 at depth ${depth}: ${m3u8}`);
      return { url: m3u8, type: 'm3u8' };
    }

    // Check for iframe embed
    const iframeSrc = findIframeSrc(html);
    if (iframeSrc) {
      const resolvedIframe = resolveUrl(iframeSrc, url);
      console.log(`[HesGoal Stream] Found iframe at depth ${depth}: ${resolvedIframe}`);

      // Recursively resolve the iframe
      const result = await deepResolve(resolvedIframe, depth + 1, maxDepth, visited);
      if (result) return result;
    }

    // Check for JavaScript variables containing m3u8 URLs
    const jsPatterns = [
      /(?:var|const|let)\s+(?:source|src|url|hlsUrl|streamUrl|videoUrl|file)\s*=\s*["']([^"']*\.m3u8[^"']*)/gi,
      /(?:source|src|url):\s*["']([^"']*\.m3u8[^"']*)/gi,
    ];

    for (const pattern of jsPatterns) {
      const match = pattern.exec(html);
      if (match) {
        const m3u8Url = resolveUrl(match[1], url);
        console.log(`[HesGoal Stream] Found m3u8 in JS at depth ${depth}: ${m3u8Url}`);
        return { url: m3u8Url, type: 'm3u8' };
      }
    }

    // Check for base64-encoded URLs in the page
    const base64Pattern = /["']([A-Za-z0-9+/=]{20,})["']/g;
    let b64Match;
    while ((b64Match = base64Pattern.exec(html)) !== null) {
      try {
        const decoded = atob(b64Match[1]);
        if (decoded.startsWith('http') && decoded.includes('.m3u8')) {
          console.log(`[HesGoal Stream] Found base64-encoded m3u8 at depth ${depth}: ${decoded}`);
          return { url: decoded, type: 'm3u8' };
        }
      } catch(_e) {
        // Not valid base64, continue
      }
    }

    // If we found an iframe but couldn't resolve to m3u8, return the iframe URL for proxy playback
    if (iframeSrc) {
      const resolvedIframe = resolveUrl(iframeSrc, url);
      return { url: resolvedIframe, type: 'iframe' };
    }

    return null;
  } catch (err) {
    console.warn(`[HesGoal Stream] Error resolving ${url}:`, err);
    return null;
  }
}

// ─── GET handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('id');

    if (!matchId) {
      return NextResponse.json(
        { error: 'Missing match id parameter' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `stream-${matchId}`;
    const cached = streamCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STREAM_CACHE_TTL) {
      console.log(`[HesGoal Stream] Cache hit for match ${matchId}`);
      return NextResponse.json({
        url: cached.url,
        type: cached.type,
        matchId,
        cached: true,
      });
    }

    // Build the stream page URL
    const streamPageUrl = `${STREAM_BASE}?m=${matchId}&lang=en`;

    console.log(`[HesGoal Stream] Resolving stream for match ${matchId}: ${streamPageUrl}`);

    // Try deep resolution
    const result = await deepResolve(streamPageUrl);

    if (!result) {
      // If we can't resolve the m3u8, return the ORIGINAL stream page URL.
      // The video-player component will handle proxying internally via its
      // getProxiedUrl() function and try resolve-stream to extract the m3u8.
      console.log(`[HesGoal Stream] Could not resolve m3u8, returning original URL for match ${matchId}`);

      return NextResponse.json({
        url: streamPageUrl,
        type: 'iframe',
        matchId,
        note: 'Stream resolved to embed - video-player will proxy and resolve',
      });
    }

    // Cache the result
    streamCache.set(cacheKey, {
      url: result.url,
      type: result.type,
      timestamp: Date.now(),
    });

    console.log(`[HesGoal Stream] Resolved match ${matchId} to ${result.type}: ${result.url}`);

    return NextResponse.json({
      url: result.url,
      type: result.type,
      matchId,
    });
  } catch (err) {
    console.error('[HesGoal Stream] Error:', err);
    return NextResponse.json(
      { error: 'Failed to resolve stream' },
      { status: 500 }
    );
  }
}
