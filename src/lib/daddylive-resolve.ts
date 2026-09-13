/**
 * DaddyLive → clean HLS resolver (server-side, Task 24 — anti-ads guarantee)
 *
 * PROBLEM (user report): embedding the DaddyLive stream page
 * (dlive.sx/stream/stream-N.php) in an iframe showed AD PAGES inside the
 * player ("Alimentez votre chaîne…" popups, tab-unders, banners) and their
 * Clappr player often failed with hls:networkError_manifestParsingError.
 *
 * SOLUTION: never embed their ad-infested page. Resolve the chain SERVER-SIDE
 * down to the raw m3u8 playlist and play it in OUR OWN hls.js player:
 *
 *   1. https://dlive.sx/stream/stream-{id}.php        (~640 KB, Referer: dlive.sx)
 *        └─ <iframe src="https://{player-host}/premiumtv/daddyX.php?id={id}">
 *   2. https://{player-host}/premiumtv/daddyX.php?id={id}   (~3 KB, Referer: dlive.sx)
 *        └─ source: window.atob('<base64 m3u8 url>')
 *   3. https://{cdn-host}/…/secure/{hash}/{expiry}/premium{id}/index.m3u8
 *        └─ requires the player-page Referer (origin OR full URL depending on
 *          channel/edge — the proxy tries all candidates)
 *        └─ valid HLS master playlist; variant playlists embed PRE-SIGNED
 *          segment URLs (Cloudflare R2, CORS `*`) that the browser loads
 *          directly — our server never carries video traffic.
 *
 * CDN REALITY (verified by live testing, Varnish "403 Invalid Token"):
 * the playlist token is SHORT-LIVED (~15-20 s) and edges reject requests
 * inconsistently. The proxy therefore:
 *   - retries across referer candidates, and
 *   - on a 403 wall, CHEAPLY refreshes the token by re-fetching ONLY the
 *     3 KB player page (step 2) — the 640 KB stream page (step 1) is cached
 *     for hours and rarely re-fetched.
 *
 * The player-host / cdn-host / daddyX version rotate over time — everything
 * is extracted dynamically, nothing is hard-coded.
 */

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

const STREAM_PAGE_TIMEOUT = 15_000;
const PLAYER_PAGE_TIMEOUT = 8_000;


// Playlist (token) cache — deliberately short: upstream tokens live ~15-20 s.
const TOKEN_TTL_MS = 60_000;
// Player-page URL cache — stable for a long time (survives token rotations).
const PLAYER_PAGE_TTL_MS = 6 * 60 * 60 * 1000;
// Hard cap for the playlist-URL expiry parsed from the path (~3 h ahead)
const MAX_TTL_MS = 150 * 60 * 1000;

export interface ResolvedStream {
  /** Upstream master playlist URL (to be proxied through /api/hls-proxy) */
  m3u8Url: string;
  /** Canonical Referer (the premiumtv player page URL) */
  referer: string;
}

interface CacheEntry {
  resolved: ResolvedStream | null;
  until: number;
  playerPageUrl: string | null;
  playerPageUntil: number;
}

const g = globalThis as unknown as {
  __dlResolveCache?: Map<string, CacheEntry>;
  __dlResolveInflight?: Map<string, Promise<ResolvedStream | null>>;
};
if (!g.__dlResolveCache) g.__dlResolveCache = new Map();
if (!g.__dlResolveInflight) g.__dlResolveInflight = new Map();
const resolveCache = g.__dlResolveCache;
const inflight = g.__dlResolveInflight;

// ─── Helpers ────────────────────────────────────────────────────────────────

function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

function b64urlDecode(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

/** Build a same-origin proxy URL for an upstream playlist. */
export function buildHlsProxyUrl(m3u8Url: string, referer: string, channelId?: string | number): string {
  const p = new URLSearchParams();
  p.set('u', b64urlEncode(m3u8Url));
  if (referer) p.set('r', b64urlEncode(referer));
  if (channelId !== undefined) p.set('c', String(channelId));
  return `/api/hls-proxy?${p.toString()}`;
}

/** Decode proxy params (also used by the hls-proxy route itself). */
export function decodeProxyParams(u: string, r: string | null): { url: string; referer: string } {
  let url = '';
  let referer = '';
  try {
    url = b64urlDecode(u);
  } catch {
    url = '';
  }
  if (r) {
    try {
      referer = b64urlDecode(r);
    } catch {
      referer = '';
    }
  }
  return { url, referer };
}

/** `/secure/{hash}/{epoch}/premium573/index.m3u8` → epoch in ms (or null) */
function playlistExpiryMs(m3u8Url: string): number | null {
  const m = m3u8Url.match(/\/secure\/[a-zA-Z0-9]{8,}\/(\d{9,13})\//);
  if (!m) return null;
  let v = Number(m[1]);
  if (v < 1e12) v *= 1000; // seconds → ms
  return v;
}

async function fetchText(
  url: string,
  referer: string,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        ...COMMON_HEADERS,
        ...(referer ? { Referer: referer } : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    const text = res.ok ? await res.text() : '';
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  }
}

/** Extract the m3u8 token URL from a premiumtv player page (~3 KB). */
function extractM3u8FromPlayerPage(html: string): string | null {
  const atobMatch = html.match(/atob\(\s*'([^']+)'\s*\)/);
  if (!atobMatch) return null;
  try {
    const m3u8Url = Buffer.from(atobMatch[1], 'base64').toString('utf8');
    return /^https?:\/\//i.test(m3u8Url) ? m3u8Url : null;
  } catch {
    return null;
  }
}


/** Full chain: heavy stream page (~640 KB) → player page → m3u8. */
async function resolveChain(channelId: string): Promise<{ resolved: ResolvedStream; playerPageUrl: string } | null> {
  const page = await fetchText(
    `https://dlive.sx/stream/stream-${channelId}.php`,
    'https://dlive.sx/',
    STREAM_PAGE_TIMEOUT
  );
  if (!page.ok) return null;

  const iframeMatch = page.text.match(/<iframe[^>]+src="(https:\/\/[^"]*premiumtv\/[^"]*\.php\?id=\d+)"/i);
  if (!iframeMatch) return null;
  const playerPageUrl = iframeMatch[1];

  const fromPlayer = await tokenFromPlayerPage(playerPageUrl);
  if (!fromPlayer) return null;
  return { resolved: fromPlayer, playerPageUrl };
}

/** Cheap token refresh: fetch ONLY the player page (~3 KB) → fresh m3u8 URL.
 *  Always lenient: the player page lives on a DIFFERENT host (hamis.…) than
 *  the playlist CDN (xameleon…) — it stays reachable even when the CDN
 *  throttles playlist requests. The proxy + client retries validate the
 *  resulting token implicitly; a rare dead token just costs one more cycle. */
async function tokenFromPlayerPage(playerPageUrl: string): Promise<ResolvedStream | null> {
  const playerPage = await fetchText(playerPageUrl, 'https://dlive.sx/', PLAYER_PAGE_TIMEOUT);
  if (!playerPage.ok) return null;

  const m3u8Url = extractM3u8FromPlayerPage(playerPage.text);
  if (!m3u8Url) return null;

  return { m3u8Url, referer: playerPageUrl };
}

/**
 * Resolve a DaddyLive channel id to a clean, validated m3u8 stream.
 * Returns null when the channel is dead / offline / unresolvable.
 * `force` bypasses the token cache (used by the proxy's self-healing when an
 * upstream URL starts returning 403/410 mid-playback) and prefers the CHEAP
 * player-page refresh; only falls back to the heavy stream page when the
 * player page itself is unknown or broken.
 */
export async function resolveChannelM3u8(
  channelId: string | number,
  force = false
): Promise<ResolvedStream | null> {
  const id = String(channelId);
  if (!id || id === '0' || id === '00') return null;

  const cached = resolveCache.get(id);
  if (!force && cached?.resolved && Date.now() < cached.until) {
    return cached.resolved;
  }

  // Deduplicate concurrent resolutions of the same channel
  const existing = inflight.get(id);
  if (existing) return existing;

  const task = (async (): Promise<ResolvedStream | null> => {
    const playerPageUrl = cached?.playerPageUrl ?? null;
    const playerPageFresh = cached && Date.now() < cached.playerPageUntil;

    // 1) CHEAP path — reuse the cached player page (3 KB per refresh)
    if (playerPageUrl && playerPageFresh) {
      const refreshed = await tokenFromPlayerPage(playerPageUrl);
      if (refreshed) {
        storeToken(id, playerPageUrl, refreshed);
        return refreshed;
      }
      // fall through to the full chain (player page may have rotated)
    }

    // 2) FULL chain — heavy stream page (~640 KB)
    const full = await resolveChain(id);
    if (full) {
      storeToken(id, full.playerPageUrl, full.resolved);
      return full.resolved;
    }

    // 3) Keep the player-page knowledge even when the stream is dead right
    //    now (match ended) — the channel may come back later.
    if (cached?.playerPageUrl) {
      resolveCache.set(id, {
        resolved: null,
        until: Date.now() + 60 * 1000,
        playerPageUrl: cached.playerPageUrl,
        playerPageUntil: cached.playerPageUntil,
      });
    } else {
      resolveCache.set(id, {
        resolved: null,
        until: Date.now() + 60 * 1000,
        playerPageUrl: null,
        playerPageUntil: 0,
      });
    }
    return null;
  })();

  inflight.set(id, task);
  try {
    return await task;
  } finally {
    inflight.delete(id);
  }
}

function storeToken(id: string, playerPageUrl: string, resolved: ResolvedStream) {
  // Token URLs embed an expiry timestamp (~3 h ahead) — but the Varnish
  // token in practice lives far shorter; refresh cheaply every TOKEN_TTL_MS.
  const exp = playlistExpiryMs(resolved.m3u8Url);
  let ttl = TOKEN_TTL_MS;
  if (exp && exp > Date.now()) {
    ttl = Math.min(Math.max(exp - Date.now() - 20 * 60 * 1000, TOKEN_TTL_MS), MAX_TTL_MS);
  } else if (exp && exp <= Date.now()) {
    ttl = 30 * 1000;
  }
  resolveCache.set(id, {
    resolved,
    until: Date.now() + ttl,
    playerPageUrl,
    playerPageUntil: Date.now() + PLAYER_PAGE_TTL_MS,
  });
}

/** Run an async mapper over items with bounded concurrency. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}
