import { NextRequest, NextResponse } from 'next/server';

/**
 * Working Channels API
 *
 * Returns ALL sports channels from IPTV-org that are CONFIRMED working
 * (playlist + segment validated through the stream-proxy).
 *
 * GET /api/working-channels?sport=football
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const _g = globalThis as unknown as { __workingChannelsCache?: Map<string, { data: any; timestamp: number }> };
if (!_g.__workingChannelsCache) _g.__workingChannelsCache = new Map();
const cache = _g.__workingChannelsCache;
const CACHE_TTL = 10 * 60 * 1000; // 10 min (validation takes 2+ min)

async function validateChannel(url: string): Promise<boolean> {
  try {
    const proxyUrl = `http://localhost:3000/api/stream-proxy?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxyUrl, { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': UA } });
    if (!r.ok) return false;
    const p = await r.text();
    if (!p.includes('#EXTM3U')) return false;
    // Reject HEVC-only streams (not playable in browsers)
    if ((p.includes('hvc1') || p.includes('hevc')) && !p.includes('avc1')) return false;

    const lines = p.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length === 0) return false;

    const first = lines[0];
    let segUrl: string | null = null;
    if (first.includes('/api/stream-proxy')) {
      const r2 = await fetch(`http://localhost:3000${first}`, { signal: AbortSignal.timeout(4000) });
      if (!r2.ok) return false;
      const p2 = await r2.text();
      const segs = p2.split('\n').map(l => l.trim()).filter(l => l.includes('/api/stream-proxy'));
      if (segs.length > 0) segUrl = `http://localhost:3000${segs[segs.length - 1]}`;
    } else if (first.startsWith('http')) {
      segUrl = `http://localhost:3000/api/stream-proxy?url=${encodeURIComponent(first)}`;
    }
    if (!segUrl) return false;
    const sr = await fetch(segUrl, { signal: AbortSignal.timeout(4000) });
    if (!sr.ok) return false;
    const buf = await sr.arrayBuffer();
    return buf.byteLength > 1000;
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  const sport = new URL(request.url).searchParams.get('sport') || 'football';

  const cached = cache.get(sport);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return NextResponse.json(cached.data);

  console.log('[Working Channels] Fetching + validating ALL sports channels...');
  try {
    const res = await fetch('https://iptv-org.github.io/iptv/categories/sports.m3u', {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return NextResponse.json({ channels: [] });
    const text = await res.text();
    const lines = text.split('\n');
    const all: Array<{ name: string; url: string; logo: string; group: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXTINF')) {
        const raw = lines[i];
        const name = raw.substring(raw.lastIndexOf(',') + 1).trim();
        const logo = raw.match(/tvg-logo="([^"]*)"/)?.[1] || '';
        const group = raw.match(/group-title="([^"]*)"/)?.[1] || 'Sports';
        const url = (lines[i + 1] || '').trim();
        if (url && url.startsWith('http')) all.push({ name, url, logo, group });
      }
    }

    console.log(`[Working Channels] ${all.length} channels — validating...`);
    const working: typeof all = [];
    const batchSize = 20;
    for (let i = 0; i < all.length; i += batchSize) {
      const batch = all.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(async ch => ({ ch, ok: await validateChannel(ch.url) })));
      for (const r of results) { if (r.status === 'fulfilled' && r.value.ok) working.push(r.value.ch); }
    }

    console.log(`[Working Channels] ${working.length}/${all.length} confirmed working`);
    const result = {
      channels: working.map(ch => ({
        name: ch.name, url: `/api/stream-proxy?url=${encodeURIComponent(ch.url)}`,
        channelLogo: ch.logo, group: ch.group, source: 'iptv-org', type: 'm3u8',
      })),
      total: working.length, tested: all.length,
    };
    cache.set(sport, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Working Channels] Error:', err);
    return NextResponse.json({ channels: [] });
  }
}
