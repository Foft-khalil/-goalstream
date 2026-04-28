import { NextRequest, NextResponse } from 'next/server';
import { fetchSportsChannels } from '@/lib/iptv';
import ZAI from 'z-ai-web-dev-sdk';

/**
 * POST /api/match-stream - Find the best IPTV channel for a given match.
 * Uses web search to find the real broadcaster, then matches with IPTV channels.
 * Body: { homeTeam, awayTeam, competition, matchDate? }
 * Returns: { channels: Array<{ name, url, logo, group, relevance, broadcaster?: string }> }
 */

// Known competition → broadcaster mappings (fallback when web search is unavailable)
const COMPETITION_BROADCASTERS: Record<string, string[]> = {
  'ligue 1': ['Canal+', 'beIN Sports', 'DAZN', 'Amazon Prime', 'Canal+ Sport', 'Canal+ Foot'],
  'premier league': ['Sky Sports', 'BT Sport', 'TNT Sports', 'NBC Sports', 'Peacock', 'fuboTV'],
  'champions league': ['Canal+', 'beIN Sports', 'BT Sport', 'TNT Sports', 'Paramount+', 'CBS', 'RMC Sport'],
  'europa league': ['Canal+', 'beIN Sports', 'TNT Sports', 'Paramount+', 'RMC Sport'],
  'conference league': ['Canal+', 'beIN Sports', 'RMC Sport'],
  'la liga': ['beIN Sports', 'Movistar+', 'ESPN', 'DAZN', 'Viaplay'],
  'serie a': ['DAZN', 'Sky Sport', 'beIN Sports', 'Paramount+'],
  'bundesliga': ['Sky Sport', 'DAZN', 'ESPN+'],
  'liga portugal': ['Sport TV', 'Eleven Sports'],
  'eredivisie': ['ESPN', 'Viaplay'],
  'süper lig': ['beIN Sports', 'TRT Spor'],
  'brasileirão': ['Globo', 'SporTV', 'Premiere'],
  'liga profesional': ['ESPN', 'TNT Sports', 'TV Pública'],
  'liga mx': ['TUDN', 'Azteca', 'ESPN', 'ViX'],
  'mls': ['Apple TV', 'MLS Season Pass', 'ESPN', 'FOX Sports'],
  'saudi pro league': ['SSC', 'beIN Sports', 'Shahid'],
  'afc champions league': ['beIN Sports', 'J Sports'],
  'caf champions league': ['beIN Sports', 'Canal+', 'SuperSport'],
};

// Country-specific team → likely broadcaster country hint
const TEAM_COUNTRY_HINT: Record<string, string> = {
  // France
  'paris saint-germain': 'fr', 'psg': 'fr', 'marseille': 'fr', 'lyon': 'fr', 'lille': 'fr',
  'lens': 'fr', 'monaco': 'fr', 'rennes': 'fr', 'nice': 'fr', 'strasbourg': 'fr',
  'nantes': 'fr', 'montpellier': 'fr', 'bordeaux': 'fr', 'toulouse': 'fr',
  // England
  'manchester city': 'gb', 'manchester united': 'gb', 'liverpool': 'gb', 'arsenal': 'gb',
  'chelsea': 'gb', 'tottenham': 'gb', 'newcastle': 'gb', 'aston villa': 'gb',
  // Spain
  'real madrid': 'es', 'barcelona': 'es', 'atletico madrid': 'es', 'sevilla': 'es',
  'real betis': 'es', 'athletic bilbao': 'es', 'valencia': 'es', 'villarreal': 'es',
  // Italy
  'inter milan': 'it', 'ac milan': 'it', 'juventus': 'it', 'napoli': 'it', 'roma': 'it',
  'lazio': 'it', 'fiorentina': 'it', 'atalanta': 'it',
  // Germany
  'bayern munich': 'de', 'bayern': 'de', 'borussia dortmund': 'de', 'dortmund': 'de',
  'rb leipzig': 'de', 'leverkusen': 'de', 'schalke': 'de',
};

// Broadcaster name → IPTV channel name matching keywords
const BROADCASTER_TO_IPTV: Record<string, string[]> = {
  'canal+': ['canal+', 'canal plus', 'canal+ sport', 'canal+ foot', 'canal+ liga'],
  'bein sports': ['bein', 'bein sport', 'bein 1', 'bein 2', 'bein 3', 'bein 4', 'bein 5', 'bein 6', 'bein 7', 'bein 8'],
  'dazn': ['dazn', 'dazn 1', 'dazn 2'],
  'sky sports': ['sky sport', 'sky sports', 'sky premier', 'sky football', 'sky futbol'],
  'bt sport': ['bt sport', 'tnt sport'],
  'tnt sports': ['tnt sport', 'bt sport'],
  'rmc sport': ['rmc sport'],
  'amazon prime': ['amazon', 'prime video'],
  'movistar+': ['movistar', 'movistar+', 'movistar liga'],
  'espn': ['espn', 'espn 1', 'espn 2', 'espn 3', 'espn+', 'espn deportes'],
  'paramount+': ['paramount'],
  'cbs': ['cbs', 'cbs sports'],
  'nbc sports': ['nbc', 'nbc sports'],
  'fox sports': ['fox sport', 'fox soccer'],
  'apple tv': ['apple', 'mls'],
  'tudn': ['tudn', 'univision'],
  'sport tv': ['sport tv', 'sporting tv'],
  'eleven sports': ['eleven', 'eleven sport'],
  'viaplay': ['viaplay'],
  'globo': ['globo', 'spor tv'],
  'ssC': ['ssc', 'saudi'],
  'trt spor': ['trt', 'trt spor'],
  'superSport': ['supersport'],
  'j sports': ['j sport'],
  'azteca': ['azteca', 'tv azteca'],
  'vix': ['vix'],
  'fubotv': ['fubo'],
  'peacock': ['peacock', 'nbc'],
};

function getCountryForTeams(homeTeam: string, awayTeam: string): string | null {
  const h = homeTeam.toLowerCase();
  const a = awayTeam.toLowerCase();
  for (const [team, country] of Object.entries(TEAM_COUNTRY_HINT)) {
    if (h.includes(team) || a.includes(team)) return country;
  }
  return null;
}

/**
 * Use web search to find the actual broadcaster for a specific match.
 */
async function findBroadcasterViaSearch(
  homeTeam: string,
  awayTeam: string,
  competition: string
): Promise<string[]> {
  try {
    const sdk = await ZAI.create();
    const results = await sdk.functions.invoke('web_search', {
      query: `${homeTeam} vs ${awayTeam} ${competition} TV channel broadcast live stream 2025`,
      num: 5,
      recency_days: 7,
    });

    if (!results || results.length === 0) return [];

    const snippets = results.map((r: any) => r.snippet).join('\n');

    const chatResponse = await sdk.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a sports broadcasting expert. Given search results about a football match, identify the TV channels/networks that will broadcast or are broadcasting this match. Return ONLY the channel names separated by commas (e.g., "Canal+, beIN Sports, RMC Sport"). If you cannot determine the broadcaster, return "Unknown". Do not add any explanation.`,
        },
        {
          role: 'user',
          content: `Match: ${homeTeam} vs ${awayTeam}\nCompetition: ${competition}\n\nSearch results:\n${snippets}`,
        },
      ],
    });

    const response = chatResponse?.choices?.[0]?.message?.content?.trim();
    if (!response || response === 'Unknown') return [];

    return response.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 1);
  } catch (err) {
    console.warn('[Match Stream API] Web search for broadcaster failed:', err);
    return [];
  }
}

/**
 * Get known broadcasters for a competition (fallback).
 */
function getKnownBroadcasters(competition: string): string[] {
  const compLower = competition.toLowerCase();
  for (const [key, broadcasters] of Object.entries(COMPETITION_BROADCASTERS)) {
    if (compLower.includes(key)) return broadcasters;
  }
  return [];
}

/**
 * Find IPTV channels that match broadcaster names.
 */
function matchBroadcasterToIPTV(
  broadcasters: string[],
  iptvChannels: Array<{ name: string; url: string; logo: string; group: string; country: string }>
): Array<{ name: string; url: string; logo: string; group: string; country: string; relevance: number; matchedBroadcaster: string }> {
  const results: Array<{ name: string; url: string; logo: string; group: string; country: string; relevance: number; matchedBroadcaster: string }> = [];

  for (const broadcaster of broadcasters) {
    const bLower = broadcaster.toLowerCase();
    // Find IPTV keywords for this broadcaster
    let keywords: string[] = [bLower];
    for (const [bcastKey, kwList] of Object.entries(BROADCASTER_TO_IPTV)) {
      if (bLower.includes(bcastKey) || bcastKey.includes(bLower)) {
        keywords = kwList;
        break;
      }
    }

    // Find matching IPTV channels
    for (const ch of iptvChannels) {
      const nameLower = ch.name.toLowerCase();
      const isMatch = keywords.some(kw => nameLower.includes(kw));
      if (isMatch) {
        // Score: HLS bonus + broadcaster match bonus
        let relevance = 20; // High base for broadcaster matches
        if (ch.url.includes('.m3u8') || ch.url.includes('m3u8')) relevance += 10;
        if (ch.url.startsWith('https')) relevance += 3;

        // Avoid duplicates
        if (!results.find(r => r.url === ch.url)) {
          results.push({ ...ch, relevance, matchedBroadcaster: broadcaster });
        }
      }
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeTeam, awayTeam, competition, matchDate } = body;

    if (!homeTeam || !awayTeam) {
      return NextResponse.json(
        { error: 'homeTeam and awayTeam are required' },
        { status: 400 }
      );
    }

    // Fetch all sports channels
    const channels = await fetchSportsChannels();

    if (channels.length === 0) {
      return NextResponse.json({ channels: [], message: 'No channels available' });
    }

    const homeLower = homeTeam.toLowerCase();
    const awayLower = awayTeam.toLowerCase();
    const compLower = (competition || '').toLowerCase();

    // ─── Step 1: Find the real broadcaster via web search ─────────────────────
    const searchBroadcasters = await findBroadcasterViaSearch(homeTeam, awayTeam, competition || '');

    // ─── Step 2: Get known broadcasters for this competition (fallback) ───────
    const knownBroadcasters = getKnownBroadcasters(compLower);

    // Combine and deduplicate broadcasters
    const allBroadcasters = [...new Set([...searchBroadcasters, ...knownBroadcasters])];

    // ─── Step 3: Match broadcasters to IPTV channels ─────────────────────────
    const broadcasterMatches = matchBroadcasterToIPTV(allBroadcasters, channels);

    // ─── Step 4: Also do keyword-based matching (legacy, as backup) ───────────
    const searchTerms = [
      homeLower,
      awayLower,
      ...getCompetitionKeywords(compLower),
      'sport', 'football', 'soccer', 'foot', 'futbol',
    ].filter(Boolean);

    const keywordMatches = channels.map((ch) => {
      const nameLower = ch.name.toLowerCase();
      const groupLower = (ch.group || '').toLowerCase();
      let score = 0;

      const isHls = ch.url.includes('.m3u8') || ch.url.includes('m3u8');
      if (isHls) score += 5;

      for (const term of searchTerms) {
        if (!term) continue;
        if (nameLower.includes(term)) {
          score += term.length > 3 ? 10 : 5;
        }
        if (groupLower.includes(term)) {
          score += 3;
        }
      }

      // Penalty for non-HTTPS URLs
      if (!ch.url.startsWith('https')) score -= 2;

      return {
        name: ch.name,
        url: ch.url,
        logo: ch.logo,
        group: ch.group,
        country: ch.country,
        relevance: score,
      };
    }).filter((ch) => ch.relevance > 0)
      .sort((a, b) => {
        const aHls = a.url.includes('.m3u8') || a.url.includes('m3u8') ? 1 : 0;
        const bHls = b.url.includes('.m3u8') || b.url.includes('m3u8') ? 1 : 0;
        if (bHls !== aHls) return bHls - aHls;
        return b.relevance - a.relevance;
      });

    // ─── Step 5: Merge results (broadcaster matches first, then keyword) ─────
    const seenUrls = new Set<string>();
    const merged: Array<{ name: string; url: string; logo: string; group: string; relevance: number; broadcaster?: string }> = [];

    // Add broadcaster matches first (highest priority)
    for (const ch of broadcasterMatches) {
      if (!seenUrls.has(ch.url)) {
        seenUrls.add(ch.url);
        merged.push({
          name: ch.name,
          url: ch.url,
          logo: ch.logo,
          group: ch.group,
          relevance: ch.relevance,
          broadcaster: ch.matchedBroadcaster,
        });
      }
    }

    // Add keyword matches
    for (const ch of keywordMatches) {
      if (!seenUrls.has(ch.url)) {
        seenUrls.add(ch.url);
        merged.push({
          name: ch.name,
          url: ch.url,
          logo: ch.logo,
          group: ch.group,
          relevance: ch.relevance,
        });
      }
    }

    // Limit to 8 channels
    const finalChannels = merged.slice(0, 8);

    // If no specific match found, return general sports channels
    if (finalChannels.length === 0) {
      const generalSports = channels
        .filter((ch) => ch.name.toLowerCase().includes('sport') || ch.group.toLowerCase().includes('sport'))
        .slice(0, 8)
        .map((ch) => ({
          name: ch.name,
          url: ch.url,
          logo: ch.logo,
          group: ch.group,
          relevance: 0,
        }));

      if (generalSports.length > 0) {
        return NextResponse.json({
          channels: generalSports,
          message: 'Chaînes sportives générales',
        });
      }

      // Last resort: first 5 channels
      return NextResponse.json({
        channels: channels.slice(0, 5).map((ch) => ({
          name: ch.name,
          url: ch.url,
          logo: ch.logo,
          group: ch.group,
          relevance: 0,
        })),
        message: 'Aucune chaîne spécifique trouvée',
      });
    }

    // Build response message
    const broadcasterInfo = searchBroadcasters.length > 0
      ? `Diffusé sur: ${searchBroadcasters.join(', ')}`
      : '';

    return NextResponse.json({
      channels: finalChannels,
      message: `${finalChannels.length} chaîne(s) trouvée(s)${broadcasterInfo ? ` · ${broadcasterInfo}` : ''}`,
      broadcasters: searchBroadcasters.length > 0 ? searchBroadcasters : undefined,
    });
  } catch (error) {
    console.error('[Match Stream API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to find channels', channels: [] },
      { status: 500 }
    );
  }
}

/**
 * Get keywords for a competition name
 */
function getCompetitionKeywords(comp: string): string[] {
  const keywords: string[] = [];

  const compMap: Record<string, string[]> = {
    'ligue 1': ['ligue 1', 'l1', 'canal', 'bein', 'amazon'],
    'premier league': ['premier league', 'pl', 'sky sports', 'bt sport', 'nbc'],
    'champions league': ['champions league', 'ucl', 'canal', 'bein', 'bt sport'],
    'europa league': ['europa league', 'uel'],
    'la liga': ['la liga', 'liga', 'movistar', 'bein', 'espn'],
    'serie a': ['serie a', 'dazn', 'sky sport'],
    'bundesliga': ['bundesliga', 'sky sport', 'dazn'],
    'world cup': ['world cup', 'fifa', 'coupe du monde'],
    'africa cup': ['africa cup', 'can', 'afcon', 'bein'],
    'cup': ['cup', 'coupe'],
  };

  for (const [key, values] of Object.entries(compMap)) {
    if (comp.includes(key)) {
      keywords.push(...values);
    }
  }

  return keywords;
}
