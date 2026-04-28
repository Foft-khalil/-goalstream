import parser from 'iptv-playlist-parser';

// Cache duration: 1 hour
const CACHE_DURATION = 3600 * 1000;
let cachedChannels: ParsedChannel[] = [];
let lastFetch = 0;

export interface ParsedChannel {
  tvgId: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  country: string;
  source: string;
}

// Multiple M3U playlist sources (ordered by priority — sports first)
const IPTV_SOURCES = [
  { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', label: 'sports' },
  { url: 'https://iptv-org.github.io/iptv/languages/fra.m3u', label: 'fra' },
  { url: 'https://iptv-org.github.io/iptv/languages/eng.m3u', label: 'eng' },
  { url: 'https://iptv-org.github.io/iptv/languages/ara.m3u', label: 'ara' },
  { url: 'https://iptv-org.github.io/iptv/languages/spa.m3u', label: 'spa' },
];

function parsePlaylistItems(items: any[], sourceLabel: string): ParsedChannel[] {
  return items
    .filter(
      (ch: any) =>
        ch.url &&
        (ch.url.endsWith('.m3u8') ||
          ch.url.includes('m3u8') ||
          ch.url.includes('.ts') ||
          ch.url.startsWith('http'))
    )
    .map((ch: any) => ({
      tvgId: ch.tvg?.id || '',
      name: ch.name || 'Unknown Channel',
      logo: ch.tvg?.logo || '',
      group: ch.group?.title || 'Sports',
      url: ch.url,
      country: ch.tvg?.country || '',
      source: sourceLabel,
    }));
}

export async function fetchSportsChannels(): Promise<ParsedChannel[]> {
  // Use cache if less than 1 hour old
  if (cachedChannels.length > 0 && Date.now() - lastFetch < CACHE_DURATION) {
    return cachedChannels;
  }

  try {
    // Fetch all sources in parallel
    const results = await Promise.allSettled(
      IPTV_SOURCES.map(async (src) => {
        try {
          const res = await fetch(src.url, {
            next: { revalidate: 3600 },
          });
          if (!res.ok) throw new Error(`Failed to fetch ${src.label}`);
          const text = await res.text();
          const playlist = parser.parse(text);
          return parsePlaylistItems(playlist.items, src.label);
        } catch (err) {
          console.error(`Error fetching ${src.label} playlist:`, err);
          return [] as ParsedChannel[];
        }
      })
    );

    // Collect successful results (sources are in priority order)
    const allChannels: ParsedChannel[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        allChannels.push(...result.value);
      }
    }

    // Deduplicate by URL — first seen wins (sports source has priority since it's first)
    const seenUrls = new Set<string>();
    const deduped: ParsedChannel[] = [];
    for (const ch of allChannels) {
      if (!seenUrls.has(ch.url)) {
        seenUrls.add(ch.url);
        deduped.push(ch);
      }
    }

    cachedChannels = deduped;
    lastFetch = Date.now();
    return cachedChannels;
  } catch (error) {
    console.error('Error fetching IPTV channels:', error);
    return cachedChannels; // Return stale cache on error
  }
}

// Fetch channels by country
export async function fetchCountryChannels(countryCode: string): Promise<ParsedChannel[]> {
  try {
    const res = await fetch(`https://iptv-org.github.io/iptv/countries/${countryCode}.m3u`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error('Failed to fetch country playlist');

    const text = await res.text();
    const playlist = parser.parse(text);

    return playlist.items
      .filter(
        (ch: any) =>
          ch.url &&
          (ch.url.endsWith('.m3u8') ||
            ch.url.includes('m3u8') ||
            ch.url.includes('.ts') ||
            ch.url.startsWith('http'))
      )
      .map((ch: any) => ({
        tvgId: ch.tvg?.id || '',
        name: ch.name || 'Unknown Channel',
        logo: ch.tvg?.logo || '',
        group: ch.group?.title || 'General',
        url: ch.url,
        country: countryCode,
        source: `country-${countryCode}`,
      }));
  } catch (error) {
    console.error('Error fetching country channels:', error);
    return [];
  }
}
