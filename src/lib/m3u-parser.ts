// Simple lightweight M3U parser — replaces iptv-playlist-parser to avoid OOM crashes
// Only extracts the essential fields we need (name, logo, group, url)

export interface SimpleChannel {
  name: string;
  logo: string;
  group: string;
  url: string;
  tvgId: string;
  country: string;
}

/**
 * Parse an M3U playlist string into an array of channel objects.
 * Lightweight implementation that only extracts essential fields.
 * Limits output to maxChannels to prevent memory issues.
 */
export function parseM3U(text: string, maxChannels: number = 500): SimpleChannel[] {
  const lines = text.split('\n');
  const channels: SimpleChannel[] = [];

  let currentInfo: Partial<SimpleChannel> | null = null;

  for (let i = 0; i < lines.length && channels.length < maxChannels; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      currentInfo = {};

      // Extract tvg-id
      const idMatch = line.match(/tvg-id="([^"]*)"/);
      currentInfo.tvgId = idMatch ? idMatch[1] : '';

      // Extract tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      currentInfo.logo = logoMatch ? logoMatch[1] : '';

      // Extract group-title
      const groupMatch = line.match(/group-title="([^"]*)"/);
      currentInfo.group = groupMatch ? groupMatch[1] : '';

      // Extract tvg-country
      const countryMatch = line.match(/tvg-country="([^"]*)"/);
      currentInfo.country = countryMatch ? countryMatch[1] : '';

      // Extract channel name - it comes AFTER all the quoted attributes
      // The format is: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Channel Name
      // We need to find the last comma that's after all the quoted attributes
      const lastCommaIdx = line.lastIndexOf(',');
      if (lastCommaIdx !== -1 && lastCommaIdx > line.indexOf('#EXTINF:')) {
        currentInfo.name = line.substring(lastCommaIdx + 1).trim();
      } else {
        currentInfo.name = 'Unknown Channel';
      }

      // Clean up name - remove any trailing quotes or extra whitespace
      if (currentInfo.name) {
        currentInfo.name = currentInfo.name.replace(/^["']|["']$/g, '').trim();
      }
    } else if (line && !line.startsWith('#') && currentInfo) {
      // This is the URL line
      currentInfo.url = line;
      channels.push({
        name: currentInfo.name || 'Unknown Channel',
        logo: currentInfo.logo || '',
        group: currentInfo.group || 'General',
        url: currentInfo.url,
        tvgId: currentInfo.tvgId || '',
        country: currentInfo.country || '',
      });
      currentInfo = null;
    }
  }

  return channels;
}
