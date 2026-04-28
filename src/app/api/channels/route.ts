import { NextRequest, NextResponse } from 'next/server';
import { fetchSportsChannels, fetchCountryChannels } from '@/lib/iptv';
import { getChannelHealth } from '@/lib/channel-health';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const country = searchParams.get('country') || '';
    const group = searchParams.get('group')?.toLowerCase() || '';

    // Fetch channels from IPTV source
    let channels;
    if (country) {
      channels = await fetchCountryChannels(country);
    } else {
      channels = await fetchSportsChannels();
    }

    // Apply filters
    let filtered = channels;
    if (search) {
      filtered = filtered.filter(
        (ch) =>
          ch.name.toLowerCase().includes(search) ||
          ch.group.toLowerCase().includes(search)
      );
    }
    if (group) {
      filtered = filtered.filter((ch) => ch.group.toLowerCase().includes(group));
    }
    if (country && !search && !group) {
      // Already filtered by country from the fetch
    }

    // Sync channels to database (upsert)
    try {
      for (const ch of filtered.slice(0, 100)) {
        // Limit to first 100 to avoid overwhelming the database
        await db.channel.upsert({
          where: {
            name_url: {
              name: ch.name,
              url: ch.url,
            },
          },
          update: {
            tvgId: ch.tvgId || null,
            logo: ch.logo || null,
            group: ch.group || null,
            country: ch.country || null,
            lastChecked: new Date(),
            isActive: true,
          },
          create: {
            tvgId: ch.tvgId || null,
            name: ch.name,
            logo: ch.logo || null,
            group: ch.group || null,
            url: ch.url,
            country: ch.country || null,
            isActive: true,
            lastChecked: new Date(),
            source: ch.source || 'iptv-org',
          },
        });
      }
    } catch (dbError) {
      console.error('Error syncing channels to database:', dbError);
      // Don't fail the request if DB sync fails
    }

    // Enrich channels with health status from the shared map
    const enriched = filtered.map((ch) => ({
      ...ch,
      health: getChannelHealth(ch.url),
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Error in /api/channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}
