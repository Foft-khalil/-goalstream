import { NextResponse } from 'next/server';
import { fetchSportsChannels } from '@/lib/iptv';
import { setChannelHealth, getHealthSummary } from '@/lib/channel-health';

// Cooldown: won't run more than once per hour
const COOLDOWN_MS = 3600 * 1000;
let lastCronRun = 0;

// Batch size for parallel health checks
const BATCH_SIZE = 50;

// Timeout per HEAD request (ms)
const CHECK_TIMEOUT = 8000;

export async function GET() {
  const now = Date.now();

  // Enforce cooldown
  if (now - lastCronRun < COOLDOWN_MS) {
    const summary = getHealthSummary();
    return NextResponse.json({
      checked: 0,
      online: summary.online,
      offline: summary.offline,
      lastChecked: new Date(lastCronRun).toISOString(),
      cooldown: true,
      nextCheck: new Date(lastCronRun + COOLDOWN_MS).toISOString(),
    });
  }

  try {
    // Fetch all sports channels (from multiple sources)
    const channels = await fetchSportsChannels();

    if (channels.length === 0) {
      return NextResponse.json({
        checked: 0,
        online: 0,
        offline: 0,
        lastChecked: new Date().toISOString(),
        cooldown: false,
      });
    }

    // Check a batch of channels (up to BATCH_SIZE)
    const batch = channels.slice(0, BATCH_SIZE);
    const urls = batch.map((ch) => ch.url);

    // Run HEAD requests in parallel
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT);

          const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; GoalStream/1.0)',
            },
          });

          clearTimeout(timeout);

          const status: 'online' | 'offline' = res.ok ? 'online' : 'offline';
          setChannelHealth(url, status);
          return status;
        } catch {
          setChannelHealth(url, 'offline');
          return 'offline' as const;
        }
      })
    );

    // Tally results
    let online = 0;
    let offline = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value === 'online') online++;
        else offline++;
      } else {
        offline++;
      }
    }

    lastCronRun = Date.now();

    const summary = getHealthSummary();
    return NextResponse.json({
      checked: batch.length,
      online,
      offline,
      lastChecked: new Date(lastCronRun).toISOString(),
      cooldown: false,
      totalTracked: summary.total,
    });
  } catch (error) {
    console.error('Error in /api/channels-health-cron:', error);
    return NextResponse.json(
      { error: 'Failed to run health check' },
      { status: 500 }
    );
  }
}
