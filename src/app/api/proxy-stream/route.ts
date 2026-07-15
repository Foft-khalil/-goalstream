import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for streaming embed URLs.
 *
 * Why: Stream providers like streams.center embed their player in nested iframes
 * (chX.php → hls.php → decrypt.php → actual m3u8). When we load these directly
 * in a sandboxed iframe, the nested iframes are blocked by browser security policies.
 * Additionally, cross-origin fetch() calls from our domain to streams.center fail
 * due to CORS restrictions.
 *
 * This proxy solves the problem by:
 * 1. Fetching the embed page content server-side (no iframe restrictions)
 * 2. Serving it from our own domain (avoids referrer/X-Frame-Options blocks)
 * 3. Removing referrer-blocking scripts that redirect away
 * 4. Rewriting nested iframe URLs AND fetch() URLs to also go through the proxy
 * 5. Proxying POST requests to decrypt.php and similar endpoints
 *
 * This is the same method used by us-sport.eu (they use /stream0.php?token=BASE64)
 *
 * Usage:
 *   GET  /api/proxy-stream?url=BASE64_ENCODED_URL
 *   POST /api/proxy-stream?url=BASE64_ENCODED_URL  (forwards body to upstream)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const encodedUrl = searchParams.get('url');

  if (!encodedUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let targetUrl: string;
  try {
    targetUrl = atob(decodeURIComponent(encodedUrl));
  } catch(_e) {
    try {
      targetUrl = atob(encodedUrl);
    } catch(_e) {
      return NextResponse.json({ error: 'Invalid base64 url parameter' }, { status: 400 });
    }
  }

  // Validate URL format
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  try {
    console.log(`[Proxy Stream] GET fetching: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': targetUrl,
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`[Proxy Stream] Upstream returned ${response.status} for ${targetUrl}`);
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || '';

    // If not HTML, just pass through the response (e.g. JS, CSS, images)
    if (!contentType.includes('text/html')) {
      const body = await response.arrayBuffer();
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    let html = await response.text();

    // Parse the base URL for rewriting
    const baseUrl = new URL(targetUrl);
    const baseOrigin = baseUrl.origin;
    const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

    // ── Step 1: Remove referrer-blocking and anti-iframe-breakout scripts ──────
    // Remove scripts that check document.referrer and redirect away
    html = html.replace(
      /<script\s+language="JavaScript">\s*var\s+b\s*=\s*['"][^'"]*['"];\s*if\s*\(\s*document\.referrer[^<]*<\/script>/gi,
      ''
    );

    // Remove anti-iframe-breakout scripts (various patterns)
    html = html.replace(
      /if\s*\(\s*window\s*==\s*window\.top\s*\)\s*document\.location\s*=\s*['"][^'"]*['"]/gi,
      '/* removed top-frame redirect */'
    );
    html = html.replace(
      /if\s*\(\s*window\s*!==\s*window\.top\s*\)[^;]*;/gi,
      '/* removed frame-busting script */'
    );
    html = html.replace(
      /if\s*\(\s*window\.top\s*!==\s*window\.self\s*\)[^;]*;/gi,
      '/* removed frame-busting script */'
    );
    html = html.replace(
      /if\s*\(\s*window\.self\s*!==\s*window\.top\s*\)[^;]*;/gi,
      '/* removed frame-busting script */'
    );
    html = html.replace(
      /window\.top\.location\s*=\s*['"][^'"]*['"]/gi,
      '/* removed top-location redirect */'
    );
    html = html.replace(
      /window\.top\.location\.href\s*=\s*['"][^'"]*['"]/gi,
      '/* removed top-location redirect */'
    );
    html = html.replace(
      /window\.top\.location\.replace\s*\([^)]*\)/gi,
      '/* removed top-location replace */'
    );
    html = html.replace(
      /parent\.location\s*=\s*['"][^'"]*['"]/gi,
      '/* removed parent-location redirect */'
    );
    html = html.replace(
      /parent\.location\.href\s*=\s*['"][^'"]*['"]/gi,
      '/* removed parent-location redirect */'
    );

    // Remove entire <script> blocks that bust out of frames
    html = html.replace(
      /<script[^>]*>\s*if\s*\(\s*(?:window\.(?:top|self)|top\s*[!=]==?\s*self)[^<]*<\/script>/gi,
      ''
    );

    // ── Step 2: Rewrite protocol-relative URLs (//domain/path) ───────────────
    html = html.replace(
      /(<iframe[^>]+src=["'])(\/\/)([^"']*)(["'])/gi,
      `$1https://$3$4`
    );
    html = html.replace(
      /(<script[^>]+src=["'])(\/\/)([^"']*)(["'])/gi,
      `$1https://$3$4`
    );
    html = html.replace(
      /(<link[^>]+href=["'])(\/\/)([^"']*)(["'])/gi,
      `$1https://$3$4`
    );

    // ── Step 3: Rewrite root-relative URLs (/path) ───────────────────────────
    html = html.replace(
      /(<iframe[^>]+src=["'])(\/[^"']*)(["'])/gi,
      `$1${baseOrigin}$2$3`
    );
    html = html.replace(
      /(<script[^>]+src=["'])(\/[^"']*)(["'])/gi,
      `$1${baseOrigin}$2$3`
    );
    html = html.replace(
      /(<link[^>]+href=["'])(\/[^"']*)(["'])/gi,
      `$1${baseOrigin}$2$3`
    );

    // ── Step 4: Route ALL external iframe URLs through our proxy ────────────────
    // This ensures that any iframe (from any domain) is served through our proxy,
    // bypassing X-Frame-Options and frame-ancestors restrictions from upstream.
    html = html.replace(
      /(<iframe[^>]+src=["'])(https?:\/\/[^"']+)(["'])/gi,
      (_match, prefix: string, url: string, suffix: string) => {
        // Don't proxy URLs that are already going through our proxy
        if (url.includes('/api/proxy-stream')) return `${prefix}${url}${suffix}`;
        // Don't proxy same-origin URLs
        if (url.startsWith('/') || url.startsWith('./')) return `${prefix}${url}${suffix}`;
        const proxyUrl = `/api/proxy-stream?url=${btoa(url)}`;
        return `${prefix}${proxyUrl}${suffix}`;
      }
    );

    // ── Step 5: Rewrite fetch() calls to use proxy ──────────────────────────
    // The player makes fetch('decrypt.php', {...}) and similar API calls which
    // need to be proxied to avoid CORS issues. We rewrite fetch() URLs that
    // point to the upstream domain to go through our proxy.
    html = html.replace(
      /fetch\s*\(\s*['"]([^'"]+)['"]/gi,
      (_match: string, fetchUrl: string) => {
        // Skip data: URLs, blob: URLs, and already-proxied URLs
        if (fetchUrl.startsWith('data:') || fetchUrl.startsWith('blob:') || fetchUrl.includes('/api/proxy-stream')) {
          return _match;
        }
        // Skip absolute URLs to other domains (only proxy same-origin fetches)
        if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
          // Only proxy if it's to the same origin as the upstream page
          if (!fetchUrl.startsWith(baseOrigin)) return _match;
        }
        // Resolve relative URL to absolute
        let absoluteUrl: string;
        if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
          absoluteUrl = fetchUrl;
        } else if (fetchUrl.startsWith('//')) {
          absoluteUrl = `https:${fetchUrl}`;
        } else if (fetchUrl.startsWith('/')) {
          absoluteUrl = `${baseOrigin}${fetchUrl}`;
        } else {
          absoluteUrl = `${baseOrigin}${basePath}${fetchUrl}`;
        }
        return `fetch('/api/proxy-stream?url=${btoa(absoluteUrl)}'`;
      }
    );

    // ── Step 5b: Rewrite XMLHttpRequest.open() calls to use proxy ─────────────
    // Some players use XHR instead of fetch()
    html = html.replace(
      /\.open\s*\(\s*['"](?:GET|POST)['"]\s*,\s*['"]([^'"]+)['"]/gi,
      (_match: string, xhrUrl: string) => {
        if (xhrUrl.startsWith('data:') || xhrUrl.startsWith('blob:') || xhrUrl.includes('/api/proxy-stream')) {
          return _match;
        }
        if (xhrUrl.startsWith('http://') || xhrUrl.startsWith('https://')) {
          if (!xhrUrl.startsWith(baseOrigin)) return _match;
        }
        let absoluteUrl: string;
        if (xhrUrl.startsWith('http://') || xhrUrl.startsWith('https://')) {
          absoluteUrl = xhrUrl;
        } else if (xhrUrl.startsWith('//')) {
          absoluteUrl = `https:${xhrUrl}`;
        } else if (xhrUrl.startsWith('/')) {
          absoluteUrl = `${baseOrigin}${xhrUrl}`;
        } else {
          absoluteUrl = `${baseOrigin}${basePath}${xhrUrl}`;
        }
        return `.open('GET', '/api/proxy-stream?url=${btoa(absoluteUrl)}'`;
      }
    );

    // ── Step 6: Inject a <base> tag for remaining relative URLs ──────────────
    if (!html.includes('<base')) {
      html = html.replace(
        /<head([^>]*)>/i,
        `<base href="${baseUrl.href}" target="_self">$1`
      );
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Frame-Options': 'ALLOWALL',
        'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *; frame-ancestors 'self' *",
      },
    });
  } catch (err) {
    console.error('[Proxy Stream] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stream content' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - forwards POST requests to the upstream server.
 * Used by the decrypt.php endpoint to get the actual m3u8 stream URL.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const encodedUrl = searchParams.get('url');

  if (!encodedUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let targetUrl: string;
  try {
    targetUrl = atob(decodeURIComponent(encodedUrl));
  } catch(_e) {
    try {
      targetUrl = atob(encodedUrl);
    } catch(_e) {
      return NextResponse.json({ error: 'Invalid base64 url parameter' }, { status: 400 });
    }
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  try {
    // Forward the request body
    const body = await request.text();
    const contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded';

    console.log(`[Proxy Stream] POST forwarding to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': targetUrl,
        'Origin': new URL(targetUrl).origin,
      },
      body,
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    const responseBody = await response.text();

    console.log(`[Proxy Stream] POST response: ${response.status} (${responseBody.length} bytes)`);

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/plain',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (err) {
    console.error('[Proxy Stream] POST Error:', err);
    return NextResponse.json(
      { error: 'Failed to forward request' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler - CORS preflight support
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
