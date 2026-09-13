import { NextRequest, NextResponse } from 'next/server';
import { decodeProxyParams, resolveChannelM3u8, buildHlsProxyUrl } from '@/lib/daddylive-resolve';

/**
 * HLS playlist proxy (Task 24 — clean, ad-free in-app playback)
 *
 * WHY: the upstream CDN only serves playlists to requests carrying the
 * premiumtv player-page Referer (browser fetches from our app can't set a
 * Referer for cross-origin playlists). This proxy injects it server-side.
 *
 * WHAT IT PROXIES: ONLY the tiny text playlists (master + variant, few KB).
 * Pre-signed video segments (absolute https URLs, CORS `*`) are rewritten to
 * stay direct — the browser pulls video data straight from the CDN, so this
 * route costs almost no bandwidth (a ~2 KB playlist fetch every ~4 s).
 *
 * SECURITY: the embedded page (Clappr + its ad scripts: spikertrepan,
 * histats, waust…) is NEVER loaded by any browser — resolution happens
 * server-side (daddylive-resolve.ts) and the user's browser only ever talks
 * to our origin and the raw segment CDN. Zero ads can reach the client.
 *
 * REFERER FALLBACK: the CDN's policy varies per channel/playlist level/edge
 * (origin vs full player-page URL vs dlive.sx). Every playlist request tries
 * the candidates in order and remembers which one worked for ~60 s, so live
 * playlist refreshes (every ~4 s) hit the right referer immediately.
 *
 * REWRITING RULES (playlist mode):
 *   - nested playlist URIs (…m3u8)              → routed back through this proxy
 *   - RELATIVE segment URIs (same-host CDN)     → proxied too (referer needed)
 *   - ABSOLUTE pre-signed segment URIs (R2 etc) → left direct (CORS `*`)
 *   - EXT-X-KEY / EXT-X-MAP / EXT-X-MEDIA URIs  → same rules
 *
 * SELF-HEALING: with `c=<channelId>`, an upstream 403/404/410 (or a non-manifest
 * body) triggers a forced re-resolution and a 302 to the fresh playlist URL,
 * so a stream that expires mid-playback heals itself transparently
 * (hls.js follows redirects).
 */

export const runtime = 'nodejs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// Remembers the referer that last worked per upstream URL (live playlists are
// re-fetched every ~4 s — avoid repeating the fallback dance every time).
const g = globalThis as unknown as { __hlsRefererHint?: Map<string, { referer: string; until: number }>; __hlsHealAt?: Map<string, number> };
if (!g.__hlsRefererHint) g.__hlsRefererHint = new Map();
if (!g.__hlsHealAt) g.__hlsHealAt = new Map();
const refererHint = g.__hlsRefererHint;
const lastHealAt = g.__hlsHealAt;
const HINT_TTL = 60_000;
// Minimum delay between self-heal attempts per channel — bounds the cost when
// the upstream CDN throttles whole windows (each heal = player-page fetch +
// redirect; a client retry storm must not turn into a heal storm).
const HEAL_MIN_INTERVAL = 6_000;

/** Ordered list of referers to try for a given playlist request. */
function refererCandidates(canonical: string): string[] {
  const list: string[] = [];
  const hint = refererHint.get(canonical);
  if (hint && Date.now() < hint.until) list.push(hint.referer);
  if (canonical) list.push(canonical);
  try {
    list.push(new URL(canonical).origin + '/');
  } catch {
    // ignore
  }
  list.push('https://dlive.sx/');
  return [...new Set(list)];
}

async function fetchUpstream(
  url: string,
  referers: string[],
  range: string | null
): Promise<{ res: Response; referer: string } | null> {
  // The upstream CDN sits behind multiple edges with inconsistent token
  // state: the SAME URL+referer alternates 403/200 across consecutive
  // requests (observed: 403 → 200 → 200). A single attempt therefore fails
  // ~half the time. Retry each candidate a few times with a short pause —
  // playlists are tiny text files, so this is cheap and fast.
  const MAX_ROUNDS = 3;
  let last: Response | null = null;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    for (const referer of referers) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': UA,
            Accept: '*/*',
            ...(referer ? { Referer: referer } : {}),
            ...(range ? { Range: range } : {}),
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        if (res.ok) {
          refererHint.set(url, { referer, until: Date.now() + HINT_TTL });
          return { res, referer };
        }
        last = res;
        // 403 → likely referer rejection or stale edge; try next candidate.
        // Other statuses (404/410/5xx) are not retryable — stop early.
        if (res.status !== 403) return { res, referer };
      } catch {
        // network/timeout — try next candidate
      }
    }
    // Brief pause before the next round (lets CDN edges converge)
    if (round < MAX_ROUNDS - 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return last ? { res: last, referer: referers[0] || '' } : null;
}

function isPlaylistUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url) || /m3u8/i.test(url);
}

/** Rewrite every playlist URI according to the rules above. */
function rewritePlaylist(text: string, upstreamUrl: string, referer: string, channelId?: string): string {
  const absolutize = (uri: string): string => {
    try {
      return new URL(uri, upstreamUrl).toString();
    } catch {
      return uri;
    }
  };

  const wrap = (uri: string): string => {
    if (!uri) return uri;
    const absolute = absolutize(uri);
    const isNestedPlaylist = /\.m3u8(\?|#|$)/i.test(absolute) || /m3u8/i.test(absolute);
    const isRelative = !/^https?:\/\//i.test(uri);
    if (isNestedPlaylist || isRelative) {
      return buildHlsProxyUrl(absolute, referer, channelId);
    }
    // Absolute segment URL (pre-signed, CORS-enabled) — load direct from CDN
    return absolute;
  };

  return text
    .split(/\r?\n/)
    .map((line) => {
      const s = line.trim();
      if (!s) return line;
      if (s.startsWith('#')) {
        // Rewrite URI="…" attributes on tags that reference resources
        if (/^\s*#(EXT-X-KEY|EXT-X-SESSION-KEY|EXT-X-MAP|EXT-X-MEDIA|EXT-X-I-FRAME-STREAM-INF)/i.test(s)) {
          return line.replace(/URI="([^"]*)"/g, (_m, uri: string) => `URI="${wrap(uri)}"`);
        }
        return line;
      }
      // Non-comment line = a URI (master variant or media segment)
      return wrap(s);
    })
    .join('\n');
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const u = sp.get('u');
  const r = sp.get('r');
  const c = sp.get('c') || undefined;

  if (!u) return new NextResponse('Missing u parameter', { status: 400 });

  const { url: upstreamUrl, referer: canonicalReferer } = decodeProxyParams(u, r);
  if (!upstreamUrl || !/^https?:\/\//i.test(upstreamUrl)) {
    return new NextResponse('Invalid u parameter', { status: 400 });
  }

  const looksLikePlaylist = isPlaylistUrl(upstreamUrl);
  const referers = refererCandidates(canonicalReferer);
  const range = request.headers.get('range');
  // `h=1` marks a request that ALREADY followed a self-heal redirect — never
  // heal again within the same client fetch chain (loop breaker).
  const alreadyHealed = sp.get('h') === '1';

  const outcome = await fetchUpstream(upstreamUrl, referers, range);

  // ── Self-healing: playlist gone (expired token / rotated CDN) → re-resolve.
  // NOTE: covers BOTH failure shapes — an explicit upstream 403/404/410 AND a
  // total network failure (the CDN throttles by RESETTING connections during
  // hot windows, which makes every attempt throw and leaves `outcome` null). ──
  const status = outcome?.res.status ?? 0;
  const needsHeal =
    !outcome ||
    ((status === 403 || status === 404 || status === 410) && looksLikePlaylist);
  if (needsHeal && c && !alreadyHealed) {
    const prevHeal = lastHealAt.get(c) || 0;
    if (Date.now() - prevHeal < HEAL_MIN_INTERVAL) {
      console.log(`[hls-proxy] heal throttled for ${c} (too soon)`);
    } else {
      lastHealAt.set(c, Date.now());
      try {
        const fresh = await resolveChannelM3u8(c, true);
        console.log(`[hls-proxy] self-heal for ${c}: ${fresh ? 'fresh token' : 'FAILED'}`);
        // Only redirect when resolution actually produced something new —
        // otherwise we'd loop on a channel whose chain is genuinely broken.
        if (fresh && (fresh.m3u8Url !== upstreamUrl || fresh.referer !== canonicalReferer)) {
          // NextResponse.redirect requires an ABSOLUTE URL (Response.redirect
          // throws "Invalid URL" on relative paths) — resolve against our origin.
          const proxyUrl = buildHlsProxyUrl(fresh.m3u8Url, fresh.referer, c) + '&h=1';
          const target = new URL(proxyUrl, request.nextUrl.origin);
          return NextResponse.redirect(target, 302);
        }
      } catch (e) {
        console.warn('[hls-proxy] self-heal error:', e);
        // fall through to the error response below
      }
    }
  }

  if (!outcome) return new NextResponse('Upstream fetch failed', { status: 502 });
  const upstream = outcome.res;

  if (!upstream.ok) {
    return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') || '';

  // ── Playlist mode: fetch text, rewrite URIs, serve ──
  if (looksLikePlaylist || contentType.includes('mpegurl')) {
    let text: string;
    try {
      text = await upstream.text();
    } catch {
      return new NextResponse('Upstream read failed', { status: 502 });
    }

    if (!text.includes('#EXTM3U')) {
      // Not a real manifest (error page / challenge) — heal if possible
      if (c) {
        try {
          const fresh = await resolveChannelM3u8(c, true);
          if (fresh && (fresh.m3u8Url !== upstreamUrl || fresh.referer !== canonicalReferer)) {
            const target = new URL(buildHlsProxyUrl(fresh.m3u8Url, fresh.referer, c), request.nextUrl.origin);
            return NextResponse.redirect(target, 302);
          }
        } catch {
          // ignore
        }
      }
      return new NextResponse('Upstream returned invalid manifest', { status: 502 });
    }

    const rewritten = rewritePlaylist(text, upstream.url || upstreamUrl, canonicalReferer, c);
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // ── Media (segment / key) passthrough: stream the body with the referer ──
  const headers = new Headers();
  headers.set('Content-Type', contentType || 'video/mp2t');
  headers.set('Cache-Control', 'public, max-age=30');
  headers.set('Access-Control-Allow-Origin', '*');
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len);
  const cr = upstream.headers.get('content-range');
  if (cr) headers.set('Content-Range', cr);
  const ar = upstream.headers.get('accept-ranges');
  if (ar) headers.set('Accept-Ranges', ar);

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
