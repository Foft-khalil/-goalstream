import { NextResponse } from 'next/server';
import { fetchSportsChannels } from '@/lib/iptv';

/**
 * GET /api/warm-cache - Pre-load IPTV channel cache.
 * Call this on app startup so the first "Watch Live" click is fast.
 * Returns the number of channels loaded.
 */
export async function GET() {
  try {
    const channels = await fetchSportsChannels(true);
    return NextResponse.json({
      status: 'ok',
      channelsLoaded: channels.length,
      message: `Cache warmed with ${channels.length} sports channels`,
    });
  } catch (error) {
    console.error('[Warm Cache] Error:', error);
    return NextResponse.json({
      status: 'error',
      channelsLoaded: 0,
      message: 'Failed to warm cache',
    }, { status: 500 });
  }
}
