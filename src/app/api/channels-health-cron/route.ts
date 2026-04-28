import { NextResponse } from 'next/server';
import { fetchSportsChannels, fetchCountryChannels } from '@/lib/iptv';
import { setChannelHealth, getHealthSummary } from '@/lib/channel-health';

// Cooldown: won't run more than once per hour
const COOLDOWN_MS = 3600 * 1000;
let lastCronRun = 0;

// Batch size for parallel health checks
const BATCH_SIZE = 100;

// Timeout per HEAD request (ms)
const CHECK_TIMEOUT = 6000;

// Countries to check for sports channels
const COUNTRY_CODES = ['fr', 'gb', 'de', 'es', 'it'];

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
    // Fetch all sports channels + country-specific sports channels
    const [sportsChannels, ...countryChannelArrays] = await Promise.all([
      fetchSportsChannels(),
      ...COUNTRY_CODES.map((code) =>
        fetchCountryChannels(code).catch(() => [])
      ),
    ]);

    // Combine and deduplicate
    const allChannelsMap = new Map<string, typeof sportsChannels[0]>();
    for (const ch of sportsChannels) {
      if (!allChannelsMap.has(ch.url)) allChannelsMap.set(ch.url, ch);
    }
    for (const countryChannels of countryChannelArrays) {
      for (const ch of countryChannels) {
        if (!allChannelsMap.has(ch.url)) allChannelsMap.set(ch.url, ch);
      }
    }

    const allChannels = Array.from(allChannelsMap.values());

    if (allChannels.length === 0) {
      return NextResponse.json({
        checked: 0,
        online: 0,
        offline: 0,
        lastChecked: new Date().toISOString(),
        cooldown: false,
      });
    }

    // Prioritize sports channels + channels with "sport" in the name/group
    const sportsFirst = allChannels.sort((a, b) => {
      const aSport = (a.group || '').toLowerCase().includes('sport') || (a.name || '').toLowerCase().includes('sport') ? 0 : 1;
      const bSport = (b.group || '').toLowerCase().includes('sport') || (b.name || '').toLowerCase().includes('sport') ? 0 : 1;
      return aSport - bSport;
    });

    // Check a batch of channels (up to BATCH_SIZE)
    const batch = sportsFirst.slice(0, BATCH_SIZE);
    const urls = batch.map((ch) => ch.url);

    // Run HEAD requests in parallel batches of 10
    let online = 0;
    let offline = 0;
    const batchSize = 10;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batchUrls = urls.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batchUrls.map(async (url) => {
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

      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value === 'online') online++;
          else offline++;
        } else {
          offline++;
        }
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
