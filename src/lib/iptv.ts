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
}

export async function fetchSportsChannels(): Promise<ParsedChannel[]> {
  // Use cache if less than 1 hour old
  if (cachedChannels.length > 0 && Date.now() - lastFetch < CACHE_DURATION) {
    return cachedChannels;
  }

  try {
    const res = await fetch('https://iptv-org.github.io/iptv/categories/sports.m3u', {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error('Failed to fetch playlist');

    const text = await res.text();
    const playlist = parser.parse(text);

    cachedChannels = playlist.items
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
      }));

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
      }));
  } catch (error) {
    console.error('Error fetching country channels:', error);
    return [];
  }
}
