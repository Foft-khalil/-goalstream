import { NextRequest, NextResponse } from 'next/server';

/**
 * Stream Validation API
 *
 * Validates whether a stream URL is reachable and returns valid content.
 * Used by the frontend to filter out broken streams in real-time.
 *
 * POST /api/stream-validate
 * Body: { url: string }
 * Response: { valid: boolean, type?: string, reason?: string }
 */

// Cache for validation results (3 min TTL)
interface ValidationEntry {
  valid: boolean;
  type?: string;
  reason?: string;
  timestamp: number;
}
const validationCache = new Map<string, ValidationEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Accept': '*/*',
};

// Dead domains that should always be rejected
const DEAD_DOMAINS = [
  'streams.center',
  'streamcenter.pro',
  'tvhd2.com',
  'kora-api.top',
  'sportsonlinne.click',
  'dlhd.click',
];

function detectOrigin(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('newkso.ru')) return 'https://jxoxkplay.xyz';
    if (hostname.includes('fubo') || hostname.includes('fltvhd') || hostname.includes('futbolonlinehd')) return 'https://fltvhd.com';
    return '';
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url) {
      return NextResponse.json({ valid: false, reason: 'Missing url parameter' }, { status: 400 });
    }

    // Check dead domains
    if (DEAD_DOMAINS.some(d => url.includes(d))) {
      return NextResponse.json({ valid: false, reason: 'Dead domain' });
    }

    // Check cache
    const cached = validationCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        valid: cached.valid,
        type: cached.type,
        reason: cached.reason,
      });
    }

    const isM3u8 = url.includes('.m3u8');

    if (isM3u8) {
      // Validate m3u8 stream
      const origin = detectOrigin(url);
      const headers: Record<string, string> = {
        ...COMMON_HEADERS,
        ...(origin ? { 'Origin': origin, 'Referer': `${origin}/` } : {}),
      };

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
        });

        if (res.ok) {
          const text = await res.text();
          const isValid = text.includes('#EXTM3U') || text.includes('#EXTINF');

          const result = {
            valid: isValid,
            type: isValid ? 'm3u8' : undefined,
            reason: isValid ? undefined : 'Not a valid HLS playlist',
          };
          validationCache.set(url, { ...result, timestamp: Date.now() });
          return NextResponse.json(result);
        }

        // 403 from Cloudflare — stream might exist but is server-blocked
        // Let the client try via stream-proxy
        if (res.status === 403) {
          const result = { valid: true, type: 'm3u8', reason: 'Cloudflare protected' };
          validationCache.set(url, { ...result, timestamp: Date.now() });
          return NextResponse.json(result);
        }

        const result = { valid: false, reason: `HTTP ${res.status}` };
        validationCache.set(url, { ...result, timestamp: Date.now() });
        return NextResponse.json(result);
      } catch (err) {
        const result = { valid: false, reason: 'Network error' };
        validationCache.set(url, { ...result, timestamp: Date.now() });
        return NextResponse.json(result);
      }
    } else {
      // Validate embed URL — just check if it's reachable
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          headers: {
            ...COMMON_HEADERS,
            'Accept': 'text/html',
          },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
        });

        // Page exists (even 403 means Cloudflare is protecting it, page exists)
        if (res.ok || res.status === 403) {
          const result = { valid: true, type: 'embed' as const };
          validationCache.set(url, { ...result, timestamp: Date.now() });
          return NextResponse.json(result);
        }

        const result = { valid: false, reason: `HTTP ${res.status}` };
        validationCache.set(url, { ...result, timestamp: Date.now() });
        return NextResponse.json(result);
      } catch {
        const result = { valid: false, reason: 'Network error' };
        validationCache.set(url, { ...result, timestamp: Date.now() });
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    console.error('[Stream Validate] Error:', err);
    return NextResponse.json({ valid: false, reason: 'Server error' }, { status: 500 });
  }
}
