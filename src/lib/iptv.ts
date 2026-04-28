import parser from 'iptv-playlist-parser';

// Cache duration: 1 hour
const CACHE_DURATION = 3600 * 1000;
let cachedChannels: ParsedChannel[] = [];
let lastFetch = 0;

// Per-country channel caches
const countryCache = new Map<string, { channels: ParsedChannel[]; timestamp: number }>();

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
  // Primary sports playlist
  { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', label: 'sports' },
  // Football-specific category
  { url: 'https://iptv-org.github.io/iptv/categories/football.m3u', label: 'football' },
  // Country-specific playlists (more targeted than language playlists)
  { url: 'https://iptv-org.github.io/iptv/countries/fr.m3u', label: 'country-fr' },
  { url: 'https://iptv-org.github.io/iptv/countries/gb.m3u', label: 'country-gb' },
  { url: 'https://iptv-org.github.io/iptv/countries/de.m3u', label: 'country-de' },
  { url: 'https://iptv-org.github.io/iptv/countries/es.m3u', label: 'country-es' },
  { url: 'https://iptv-org.github.io/iptv/countries/it.m3u', label: 'country-it' },
  { url: 'https://iptv-org.github.io/iptv/countries/us.m3u', label: 'country-us' },
  { url: 'https://iptv-org.github.io/iptv/countries/pt.m3u', label: 'country-pt' },
  { url: 'https://iptv-org.github.io/iptv/countries/tr.m3u', label: 'country-tr' },
  { url: 'https://iptv-org.github.io/iptv/countries/br.m3u', label: 'country-br' },
  { url: 'https://iptv-org.github.io/iptv/countries/ar.m3u', label: 'country-ar' },
  // Language-specific playlists (supplementary)
  { url: 'https://iptv-org.github.io/iptv/languages/fra.m3u', label: 'fra' },
  { url: 'https://iptv-org.github.io/iptv/languages/eng.m3u', label: 'eng' },
  { url: 'https://iptv-org.github.io/iptv/languages/ara.m3u', label: 'ara' },
  { url: 'https://iptv-org.github.io/iptv/languages/spa.m3u', label: 'spa' },
  { url: 'https://iptv-org.github.io/iptv/languages/deu.m3u', label: 'deu' },
  { url: 'https://iptv-org.github.io/iptv/languages/ita.m3u', label: 'ita' },
  { url: 'https://iptv-org.github.io/iptv/languages/por.m3u', label: 'por' },
  { url: 'https://iptv-org.github.io/iptv/languages/tur.m3u', label: 'tur' },
];

// Country code mapping for team-based country lookups
export const COUNTRY_PLAYLIST_MAP: Record<string, string> = {
  fr: 'fr', gb: 'gb', us: 'us', de: 'de', es: 'es', it: 'it',
  br: 'br', ar: 'ar', mx: 'mx', pt: 'pt', nl: 'nl', tr: 'tr',
  sa: 'sa', eg: 'eg', jp: 'jp', kr: 'kr',
};

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

// Fetch channels by country with caching
export async function fetchCountryChannels(countryCode: string): Promise<ParsedChannel[]> {
  const lowerCode = countryCode.toLowerCase();

  // Check country cache first
  const cached = countryCache.get(lowerCode);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.channels;
  }

  try {
    const res = await fetch(`https://iptv-org.github.io/iptv/countries/${lowerCode}.m3u`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error('Failed to fetch country playlist');

    const text = await res.text();
    const playlist = parser.parse(text);

    const channels = playlist.items
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
        country: lowerCode,
        source: `country-${lowerCode}`,
      }));

    // Cache the result
    countryCache.set(lowerCode, { channels, timestamp: Date.now() });
    return channels;
  } catch (error) {
    console.error(`Error fetching country ${lowerCode} channels:`, error);
    // Return cached data if available, even if stale
    const staleCached = countryCache.get(lowerCode);
    return staleCached?.channels || [];
  }
}

// Fetch channels for multiple countries in parallel
export async function fetchCountryChannelsBatch(countryCodes: string[]): Promise<ParsedChannel[]> {
  if (countryCodes.length === 0) return [];

  const results = await Promise.allSettled(
    countryCodes.map((code) => fetchCountryChannels(code))
  );

  const allChannels: ParsedChannel[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      allChannels.push(...result.value);
    }
  }

  // Deduplicate by URL
  const seenUrls = new Set<string>();
  const deduped: ParsedChannel[] = [];
  for (const ch of allChannels) {
    if (!seenUrls.has(ch.url)) {
      seenUrls.add(ch.url);
      deduped.push(ch);
    }
  }

  return deduped;
}

/**
 * Check if a channel is likely a sports channel based on its name and group.
 * Used to filter out irrelevant matches (e.g., CBS local news affiliates).
 */
export function isSportsChannel(ch: { name: string; group: string }): boolean {
  const nameLower = ch.name.toLowerCase();
  const groupLower = (ch.group || '').toLowerCase();

  // Sports-related keywords
  const sportsKeywords = [
    'sport', 'espn', 'bein', 'dazn', 'canal+', 'c+ sport', 'c+ foot',
    'fox sport', 'sky sport', 'golazo', 'arena', 'setanta', 'supersport',
    'rmc sport', "l'equipe", 'equipe', 'football', 'soccer', 'futbol', 'basket',
    'nba', 'nfl', 'mlb', 'nhl', 'golf', 'tennis', 'fight', 'combat',
    'equidia', 'trace sport', 'fifa', 'directv sport', 'tdp',
    'liga', 'premier', 'champion', 'cup', 'olympic',
    'cbs sports', 'cbs golazo', 'nbc sports',
  ];

  // Check if name or group contains sports keywords
  for (const kw of sportsKeywords) {
    if (nameLower.includes(kw) || groupLower.includes(kw)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a channel name looks like a local TV affiliate (not a sports channel).
 * e.g., "CBS 2 Salt Lake City", "CBS News Baltimore", "NBC 4 New York" are local stations, not sports channels.
 */
export function isLocalAffiliate(name: string): boolean {
  const nameLower = name.toLowerCase();

  // Pattern: "CBS/ABC/NBC/FOX" followed by a number and city name (e.g., "CBS 2 Salt Lake City")
  const localNumberPattern = /\b(cbs|abc|nbc|fox|cw)\s+\d+/i;

  // Pattern: "CBS News <city>", "NBC News <city>", "ABC News <city>" (local news affiliates)
  const localNewsPattern = /\b(cbs|abc|nbc|fox|cw)\s+news\b/i;

  // Pattern: "CBS <number> <city>" (another common format)
  const localCallSign = /\b(k[wtvch]+\d*|w[abcn]b?c?\d*)\s/i;

  // Check for [Not 24/7] or [Geo-blocked] markers on non-sports channels
  const isUnreliable = name.includes('[Not 24/7]') || name.includes('[Geo-blocked]') || name.includes('[Geo-Blocked]');

  if (localNumberPattern.test(name) || localNewsPattern.test(name)) {
    return true;
  }

  // Unreliable non-sports channels
  if (isUnreliable && !isSportsChannel({ name, group: '' })) {
    return true;
  }

  return false;
}

// Quick health check for a single stream URL
// For HLS (.m3u8) streams, we try a GET with Range header since HEAD often fails
// For other streams, we use HEAD
export async function checkStreamHealth(url: string, timeoutMs: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const isHls = url.includes('.m3u8') || url.includes('m3u8');

    if (isHls) {
      // For HLS streams, try a GET with Range header to get just the first byte
      // Many HLS servers don't support HEAD requests
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Range': 'bytes=0-1',
          'User-Agent': 'Mozilla/5.0 (compatible; GoalStream/1.0)',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);
      // 200, 206 (Partial Content), or 302 (redirect) are all valid
      return res.ok || res.status === 206 || res.status === 302;
    } else {
      // For non-HLS streams, use HEAD
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GoalStream/1.0)',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);
      return res.ok;
    }
  } catch {
    return false;
  }
}

// Check multiple stream URLs in parallel
export async function checkStreamsBatch(
  urls: string[],
  concurrency: number = 5,
  timeoutMs: number = 6000
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Process in batches for controlled concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const healthy = await checkStreamHealth(url, timeoutMs);
        return { url, healthy };
      })
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.set(result.value.url, result.value.healthy);
      } else {
        results.set(batch[j], false);
      }
    }
  }

  return results;
}
