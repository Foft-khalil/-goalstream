import { NextRequest, NextResponse } from 'next/server';
import { fetchSportsChannels, fetchCountryChannelsBatch, checkStreamsBatch, isSportsChannel, isLocalAffiliate } from '@/lib/iptv';
import { getChannelHealth, setChannelHealthBatch } from '@/lib/channel-health';
import ZAI from 'z-ai-web-dev-sdk';

/**
 * POST /api/match-stream - Find the best IPTV channel for a given match.
 * Uses web search to find the real broadcaster, then matches with IPTV channels.
 * Body: { homeTeam, awayTeam, competition, matchDate?, sport? }
 * Returns: { channels: Array<{ name, url, logo, group, relevance, broadcaster?, health? }> }
 */

// ─── Broadcaster database per competition ───────────────────────────────────────
// Each entry: competition keywords → array of { broadcaster, countries, priority }
// Countries: which country's IPTV channels to prioritize for this broadcaster
const COMPETITION_BROADCASTERS: Record<string, Array<{ broadcaster: string; countries: string[]; priority: number }>> = {
  // Football - French broadcasts (highest priority for French users)
  'ligue 1': [
    { broadcaster: 'Canal+', countries: ['fr'], priority: 10 },
    { broadcaster: 'Canal+ Sport', countries: ['fr'], priority: 10 },
    { broadcaster: 'Canal+ Foot', countries: ['fr'], priority: 10 },
    { broadcaster: 'DAZN', countries: ['fr'], priority: 9 },
    { broadcaster: "L'Equipe", countries: ['fr'], priority: 8 },
    { broadcaster: 'beIN Sports', countries: ['fr', 'ara'], priority: 7 },
    { broadcaster: 'Amazon Prime', countries: ['fr'], priority: 6 },
  ],
  'champions league': [
    { broadcaster: 'Canal+', countries: ['fr'], priority: 10 },
    { broadcaster: 'Canal+ Sport', countries: ['fr'], priority: 10 },
    { broadcaster: 'Canal+ Foot', countries: ['fr'], priority: 10 },
    { broadcaster: 'RMC Sport', countries: ['fr'], priority: 9 },
    { broadcaster: "L'Equipe", countries: ['fr'], priority: 8 },
    { broadcaster: 'beIN Sports', countries: ['ara', 'fr'], priority: 7 },
    { broadcaster: 'CBS Sports Golazo', countries: ['us'], priority: 6 },
    { broadcaster: 'Paramount+', countries: ['us'], priority: 5 },
    { broadcaster: 'TNT Sports', countries: ['gb'], priority: 5 },
    { broadcaster: 'DAZN', countries: ['de', 'es', 'it'], priority: 4 },
  ],
  'europa league': [
    { broadcaster: 'Canal+', countries: ['fr'], priority: 10 },
    { broadcaster: 'RMC Sport', countries: ['fr'], priority: 9 },
    { broadcaster: "L'Equipe", countries: ['fr'], priority: 8 },
    { broadcaster: 'beIN Sports', countries: ['ara', 'fr'], priority: 7 },
    { broadcaster: 'TNT Sports', countries: ['gb'], priority: 5 },
    { broadcaster: 'Paramount+', countries: ['us'], priority: 5 },
  ],
  'conference league': [
    { broadcaster: 'Canal+', countries: ['fr'], priority: 10 },
    { broadcaster: 'RMC Sport', countries: ['fr'], priority: 9 },
    { broadcaster: "L'Equipe", countries: ['fr'], priority: 8 },
    { broadcaster: 'beIN Sports', countries: ['ara', 'fr'], priority: 7 },
  ],
  'premier league': [
    { broadcaster: 'Sky Sports', countries: ['gb'], priority: 10 },
    { broadcaster: 'TNT Sports', countries: ['gb'], priority: 9 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 8 },
    { broadcaster: 'beIN Sports', countries: ['ara', 'fr'], priority: 7 },
    { broadcaster: 'NBC Sports', countries: ['us'], priority: 5 },
    { broadcaster: 'Peacock', countries: ['us'], priority: 5 },
    { broadcaster: 'DAZN', countries: ['de', 'es', 'it'], priority: 4 },
  ],
  'la liga': [
    { broadcaster: 'beIN Sports', countries: ['ara', 'fr'], priority: 10 },
    { broadcaster: 'Movistar+', countries: ['es'], priority: 9 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 7 },
    { broadcaster: 'ESPN', countries: ['us'], priority: 5 },
    { broadcaster: 'DAZN', countries: ['es', 'it'], priority: 4 },
  ],
  'serie a': [
    { broadcaster: 'DAZN', countries: ['it'], priority: 10 },
    { broadcaster: 'Sky Sport', countries: ['it'], priority: 9 },
    { broadcaster: 'beIN Sports', countries: ['ara', 'fr'], priority: 7 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 6 },
    { broadcaster: 'Paramount+', countries: ['us'], priority: 5 },
  ],
  'bundesliga': [
    { broadcaster: 'Sky Sport', countries: ['de'], priority: 10 },
    { broadcaster: 'DAZN', countries: ['de'], priority: 9 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 7 },
    { broadcaster: 'beIN Sports', countries: ['ara', 'fr'], priority: 6 },
    { broadcaster: 'ESPN+', countries: ['us'], priority: 4 },
  ],
  'liga portugal': [
    { broadcaster: 'Sport TV', countries: ['pt'], priority: 10 },
    { broadcaster: 'Eleven Sports', countries: ['pt'], priority: 9 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 5 },
  ],
  'eredivisie': [
    { broadcaster: 'ESPN', countries: ['nl'], priority: 10 },
    { broadcaster: 'Viaplay', countries: ['nl'], priority: 9 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 5 },
  ],
  'süper lig': [
    { broadcaster: 'beIN Sports', countries: ['ara', 'tr'], priority: 10 },
    { broadcaster: 'TRT Spor', countries: ['tr'], priority: 9 },
  ],
  'brasileirão': [
    { broadcaster: 'Globo', countries: ['br'], priority: 10 },
    { broadcaster: 'SporTV', countries: ['br'], priority: 9 },
    { broadcaster: 'Premiere', countries: ['br'], priority: 8 },
  ],
  'liga profesional': [
    { broadcaster: 'ESPN', countries: ['ar'], priority: 10 },
    { broadcaster: 'TNT Sports', countries: ['ar'], priority: 9 },
    { broadcaster: 'TV Pública', countries: ['ar'], priority: 8 },
  ],
  'liga mx': [
    { broadcaster: 'TUDN', countries: ['mx'], priority: 10 },
    { broadcaster: 'Azteca', countries: ['mx'], priority: 9 },
    { broadcaster: 'ESPN', countries: ['mx', 'us'], priority: 7 },
    { broadcaster: 'ViX', countries: ['mx'], priority: 6 },
  ],
  'mls': [
    { broadcaster: 'Apple TV', countries: ['us'], priority: 10 },
    { broadcaster: 'MLS Season Pass', countries: ['us'], priority: 9 },
    { broadcaster: 'ESPN', countries: ['us'], priority: 7 },
    { broadcaster: 'FOX Sports', countries: ['us'], priority: 6 },
  ],
  'saudi pro league': [
    { broadcaster: 'SSC', countries: ['sa'], priority: 10 },
    { broadcaster: 'beIN Sports', countries: ['ara'], priority: 8 },
    { broadcaster: 'Shahid', countries: ['sa'], priority: 7 },
  ],
  'afc champions league': [
    { broadcaster: 'beIN Sports', countries: ['ara'], priority: 10 },
    { broadcaster: 'J Sports', countries: ['jp'], priority: 8 },
  ],
  'caf champions league': [
    { broadcaster: 'beIN Sports', countries: ['ara'], priority: 10 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 8 },
    { broadcaster: 'SuperSport', countries: ['eg'], priority: 7 },
  ],
  // Basketball
  'nba': [
    { broadcaster: 'beIN Sports', countries: ['fr'], priority: 10 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 9 },
    { broadcaster: 'ESPN', countries: ['us'], priority: 8 },
    { broadcaster: 'TNT', countries: ['us'], priority: 7 },
    { broadcaster: 'ABC', countries: ['us'], priority: 7 },
    { broadcaster: 'NBA TV', countries: ['us'], priority: 6 },
    { broadcaster: 'NBA League Pass', countries: ['us'], priority: 5 },
  ],
  "ncaa men's basketball": [
    { broadcaster: 'ESPN', countries: ['us'], priority: 10 },
    { broadcaster: 'CBS', countries: ['us'], priority: 9 },
    { broadcaster: 'TBS', countries: ['us'], priority: 8 },
    { broadcaster: 'TNT', countries: ['us'], priority: 7 },
    { broadcaster: 'truTV', countries: ['us'], priority: 6 },
    { broadcaster: 'beIN Sports', countries: ['fr'], priority: 5 },
  ],
  'ncaa': [
    { broadcaster: 'ESPN', countries: ['us'], priority: 10 },
    { broadcaster: 'CBS', countries: ['us'], priority: 9 },
    { broadcaster: 'TBS', countries: ['us'], priority: 8 },
    { broadcaster: 'TNT', countries: ['us'], priority: 7 },
    { broadcaster: 'truTV', countries: ['us'], priority: 6 },
  ],
  'euroleague': [
    { broadcaster: 'EuroLeague TV', countries: ['fr', 'es', 'it'], priority: 10 },
    { broadcaster: 'beIN Sports', countries: ['fr'], priority: 9 },
    { broadcaster: 'Canal+', countries: ['fr'], priority: 8 },
    { broadcaster: 'Sport TV', countries: ['pt'], priority: 7 },
    { broadcaster: 'DAZN', countries: ['it', 'es'], priority: 6 },
  ],
  'wnba': [
    { broadcaster: 'ESPN', countries: ['us'], priority: 10 },
    { broadcaster: 'NBA TV', countries: ['us'], priority: 9 },
    { broadcaster: 'ABC', countries: ['us'], priority: 8 },
    { broadcaster: 'CBS Sports', countries: ['us'], priority: 7 },
  ],
};

// ─── Team → country mapping ────────────────────────────────────────────────────
const TEAM_COUNTRY_HINT: Record<string, string> = {
  // France
  'paris saint-germain': 'fr', 'psg': 'fr', 'paris sg': 'fr', 'marseille': 'fr', 'lyon': 'fr', 'lille': 'fr',
  'lens': 'fr', 'monaco': 'fr', 'rennes': 'fr', 'nice': 'fr', 'strasbourg': 'fr',
  'nantes': 'fr', 'montpellier': 'fr', 'bordeaux': 'fr', 'toulouse': 'fr',
  'reims': 'fr', 'brest': 'fr', 'le havre': 'fr', 'auxerre': 'fr',
  // England / Scotland
  'manchester city': 'gb', 'manchester united': 'gb', 'liverpool': 'gb', 'arsenal': 'gb',
  'chelsea': 'gb', 'tottenham': 'gb', 'newcastle': 'gb', 'aston villa': 'gb',
  'west ham': 'gb', 'brighton': 'gb', 'crystal palace': 'gb', 'fulham': 'gb',
  'wolves': 'gb', 'bournemouth': 'gb', 'nottingham forest': 'gb', 'everton': 'gb',
  'celtic': 'gb', 'rangers': 'gb',
  // Spain
  'real madrid': 'es', 'barcelona': 'es', 'atletico madrid': 'es', 'sevilla': 'es',
  'real betis': 'es', 'athletic bilbao': 'es', 'valencia': 'es', 'villarreal': 'es',
  'real sociedad': 'es', 'celta vigo': 'es', 'girona': 'es', 'mallorca': 'es',
  // Italy
  'inter milan': 'it', 'inter': 'it', 'ac milan': 'it', 'milan': 'it', 'juventus': 'it',
  'napoli': 'it', 'roma': 'it', 'lazio': 'it', 'fiorentina': 'it', 'atalanta': 'it',
  'bologna': 'it', 'torino': 'it', 'monza': 'it',
  // Germany
  'bayern munich': 'de', 'bayern': 'de', 'fc bayern': 'de', 'borussia dortmund': 'de', 'dortmund': 'de',
  'rb leipzig': 'de', 'leverkusen': 'de', 'bayer leverkusen': 'de', 'schalke': 'de', 'stuttgart': 'de',
  'wolfsburg': 'de', 'frankfurt': 'de', 'freiburg': 'de', 'hoffenheim': 'de',
  // Austria
  'rb salzburg': 'at', 'red bull salzburg': 'at', 'salzburg': 'at', 'sturm graz': 'at',
  // Portugal
  'benfica': 'pt', 'porto': 'pt', 'sporting': 'pt', 'sporting cp': 'pt', 'braga': 'pt',
  // Netherlands
  'ajax': 'nl', 'psv': 'nl', 'feyenoord': 'nl',
  // Belgium
  'club brugge': 'be', 'anderlecht': 'be',
  // Turkey
  'galatasaray': 'tr', 'fenerbahce': 'tr', 'besiktas': 'tr', 'trabzonspor': 'tr',
  // Ukraine
  'shakhtar': 'ua', 'dynamo kyiv': 'ua',
  // Switzerland
  'young boys': 'ch',
  // Serbia
  'red star': 'rs', 'partizan': 'rs',
  // Czech Republic
  'sparta prague': 'cz', 'slavia prague': 'cz',
  // Denmark
  'copenhagen': 'dk', 'brondby': 'dk',
  // Sweden
  'malmo': 'se',
  // Norway
  'bodo/glimt': 'no', 'rosenborg': 'no',
  // Israel
  'maccabi': 'il', 'hapoel': 'il',
  // Egypt
  'al ahly': 'eg',
  // Morocco
  'widad': 'ma', 'rajah': 'ma',
  // Tunisia
  'es tunis': 'tn',
  // South Africa
  'kaiser chiefs': 'za', 'orlando pirates': 'za', 'mamelodi': 'za',
  // Brazil
  'flamengo': 'br', 'palmeiras': 'br', 'sao paulo': 'br', 'corinthians': 'br',
  'gremio': 'br', 'internacional': 'br', 'fluminense': 'br', 'botafogo': 'br',
  // Argentina
  'boca juniors': 'ar', 'river plate': 'ar', 'racing club': 'ar', 'independiente': 'ar',
  // USA/MLS
  'inter miami': 'us', 'la galaxy': 'us', 'new york city': 'us', 'seattle sounders': 'us',
  // Saudi Arabia
  'al hilal': 'sa', 'al nassr': 'sa', 'al ittihad': 'sa', 'al ahli': 'sa',
};

// ─── Broadcaster → IPTV channel name matching keywords ─────────────────────────
const BROADCASTER_TO_IPTV: Record<string, string[]> = {
  'canal+': ['canal+', 'canal plus', 'c+ sport', 'c+ foot', 'canal+ ligue 1', 'canal+ champions league', 'canal+ premier league'],
  'canal+ sport': ['canal+ sport', 'canal sport', 'c+ sport', 'canal+ liga', 'canal+ ligue 1', 'canal+ champions league'],
  'canal+ foot': ['canal+ foot', 'canal foot', 'c+ foot', 'canal+ ligue 1', 'canal+ champions league'],
  'bein sports': ['bein', 'bein sport', 'bein 1', 'bein 2', 'bein 3', 'bein 4', 'bein 5', 'bein 6', 'bein 7', 'bein 8', 'bein xtra', 'bein connect'],
  'dazn': ['dazn', 'dazn 1', 'dazn 2', 'dazn 3', 'dazn 4'],
  'sky sports': ['sky sport', 'sky sports', 'sky premier', 'sky football', 'sky futbol', 'sky pl', 'sky f1'],
  'sky sport': ['sky sport', 'sky sports', 'sky bundesliga', 'sky calcio'],
  'bt sport': ['bt sport', 'tnt sport'],
  'tnt sports': ['tnt sport', 'tnt sports', 'bt sport'],
  'rmc sport': ['rmc sport', 'rmc sport 1', 'rmc sport 2', 'rmc sport 3', 'rmc sport live', 'rmc'],
  "l'equipe": ['equipe', "l'equipe", 'la chaine l\'equipe', 'l equipe'],
  'amazon prime': ['amazon', 'prime video'],
  'movistar+': ['movistar', 'movistar+', 'movistar liga', 'movistar futbol', 'movistar deportes'],
  'espn': ['espn', 'espn 1', 'espn 2', 'espn 3', 'espn+', 'espn deportes', 'espn extra'],
  'paramount+': ['paramount'],
  'cbs': ['cbs sports', 'cbs golazo', 'cbs hq'],
  'cbs sports': ['cbs sports', 'cbs golazo', 'cbs hq', 'cbs sports hq', 'cbs sports golazo'],
  'cbs sports golazo': ['cbs golazo', 'golazo', 'cbs sports golazo', 'golazo network'],
  'nbc sports': ['nbc', 'nbc sports', 'nbcSN'],
  'fox sports': ['fox sport', 'fox soccer', 'fox deportes'],
  'apple tv': ['apple', 'mls'],
  'tudn': ['tudn', 'univision'],
  'sport tv': ['sport tv', 'sporting tv', 'sport tv1', 'sport tv2', 'sport tv3'],
  'eleven sports': ['eleven', 'eleven sport'],
  'viaplay': ['viaplay'],
  'globo': ['globo', 'spor tv'],
  'spor tv': ['spor tv', 'globo'],
  'ssC': ['ssc', 'saudi', 'saudi sport'],
  'trt spor': ['trt', 'trt spor', 'trt sport'],
  'superSport': ['supersport'],
  'j sports': ['j sport'],
  'azteca': ['azteca', 'tv azteca', 'azteca deportes'],
  'vix': ['vix'],
  'fubotv': ['fubo'],
  'peacock': ['peacock', 'nbc'],
  // Basketball-specific broadcasters
  'nba tv': ['nba tv', 'nba', 'nba league'],
  'nba league pass': ['nba', 'league pass'],
  'tnt': ['tnt', 'tnt sport'],
  'abc': ['abc', 'abc sports'],
  'tbs': ['tbs'],
  'trutv': ['trutv', 'tru tv'],
  'euroleague tv': ['euroleague'],
};

function getCountryForTeams(homeTeam: string, awayTeam: string): string[] {
  const h = homeTeam.toLowerCase();
  const a = awayTeam.toLowerCase();
  const countries = new Set<string>();

  for (const [team, country] of Object.entries(TEAM_COUNTRY_HINT)) {
    if (h.includes(team) || a.includes(team)) {
      countries.add(country);
    }
  }

  // Always include France as a default for French-speaking users
  countries.add('fr');

  return Array.from(countries);
}

/**
 * Use web search to find the actual broadcaster for a specific match.
 */
async function findBroadcasterViaSearch(
  homeTeam: string,
  awayTeam: string,
  competition: string,
  sport: string = 'football'
): Promise<string[]> {
  try {
    const sdk = await ZAI.create();
    const sportLabel = sport === 'basketball' ? 'basketball' : 'football';

    // Search in French for French broadcasting context
    const results = await sdk.functions.invoke('web_search', {
      query: `${homeTeam} vs ${awayTeam} ${competition} ${sportLabel} chaine TV diffusion direct streaming 2025`,
      num: 5,
      recency_days: 7,
    });

    if (!results || results.length === 0) return [];

    const snippets = results.map((r: any) => r.snippet).join('\n');

    const chatResponse = await sdk.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en diffusion sportive française et internationale. À partir des résultats de recherche, identifie les chaînes de TV qui diffusent ce match. Retourne UNIQUEMENT les noms des chaînes séparés par des virgules (ex: "Canal+, beIN Sports, RMC Sport"). Si tu ne peux pas déterminer, retourne "Inconnu". N'ajoute aucune explication.`,
        },
        {
          role: 'user',
          content: `Match: ${homeTeam} vs ${awayTeam}\nCompétition: ${competition}\nSport: ${sportLabel}\n\nRésultats de recherche:\n${snippets}`,
        },
      ],
    });

    const response = chatResponse?.choices?.[0]?.message?.content?.trim();
    if (!response || response === 'Inconnu' || response === 'Unknown') return [];

    return response.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 1);
  } catch (err) {
    console.warn('[Match Stream API] Web search for broadcaster failed:', err);
    return [];
  }
}

/**
 * Get known broadcasters for a competition with country priority.
 */
function getKnownBroadcasters(competition: string): Array<{ broadcaster: string; countries: string[]; priority: number }> {
  const compLower = competition.toLowerCase();
  for (const [key, broadcasters] of Object.entries(COMPETITION_BROADCASTERS)) {
    if (compLower.includes(key)) return broadcasters;
  }
  return [];
}

/**
 * Find IPTV channels that match broadcaster names.
 * Now includes country-aware priority boosting.
 */
function matchBroadcasterToIPTV(
  broadcasters: Array<{ broadcaster: string; countries: string[]; priority: number }>,
  iptvChannels: Array<{ name: string; url: string; logo: string; group: string; country: string; source: string }>,
  teamCountries: string[],
  sport: string = 'football'
): Array<{ name: string; url: string; logo: string; group: string; country: string; relevance: number; matchedBroadcaster: string; health?: string }> {
  const results: Array<{ name: string; url: string; logo: string; group: string; country: string; relevance: number; matchedBroadcaster: string; health?: string }> = [];

  // Blacklist: channel names that should never appear in sports results
  const sportsBlacklist = [
    'combat', 'strongman', 'freesports', 'poker', 'casino', 'lottery',
    'racing.com', 'horse', 'dog racing', 'wrestling', 'boxing',
    'fitness', 'gym', 'workout', 'yoga', 'outdoors', 'hunting', 'fishing',
  ];

  for (const bcast of broadcasters) {
    const bLower = bcast.broadcaster.toLowerCase();
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
      const groupLower = (ch.group || '').toLowerCase();
      const isMatch = keywords.some(kw => nameLower.includes(kw) || groupLower.includes(kw));

      if (isMatch) {
        // Skip blacklisted channel types
        const isBlacklisted = sportsBlacklist.some(bl => nameLower.includes(bl));
        if (isBlacklisted) continue;

        // Skip DAZN Combat (not football/basketball)
        if (nameLower.includes('dazn') && nameLower.includes('combat')) continue;

        // Skip channels with "Canal" but not "Canal+" or "C+" (e.g., "Canal 32" is not Canal+)
        if (keywords.some(kw => kw.includes('canal+') || kw.includes('c+') || kw.includes('canal sport') || kw.includes('canal foot'))) {
          if (nameLower.includes('canal') &&
              !nameLower.includes('canal+') && !nameLower.includes('c+') &&
              !nameLower.includes('canal plus') && !nameLower.includes('canal sport') &&
              !nameLower.includes('canal foot') && !nameLower.includes('canal liga')) {
            continue; // "Canal 32", "Canal 6", etc. are NOT Canal+
          }
          // Also reject channels matching the pattern "Canal <number>" (e.g., Canal 6, Canal 7, Canal 10, Canal 13, Canal 26)
          if (/\bcanal\s+\d+/i.test(ch.name)) {
            continue;
          }
        }

        let relevance = bcast.priority * 10; // Base score from competition priority

        // HLS streams get a big bonus (they actually work with our player)
        if (ch.url.includes('.m3u8') || ch.url.includes('m3u8')) relevance += 15;
        // HTTPS bonus
        if (ch.url.startsWith('https')) relevance += 5;

        // Country match bonus — if the channel's source matches a team country
        const channelSource = (ch.source || '').toLowerCase();
        const channelCountry = (ch.country || '').toLowerCase();
        for (const teamCountry of teamCountries) {
          if (channelSource.includes(teamCountry) || channelCountry === teamCountry) {
            relevance += 20; // Big bonus for country-matched channels
          }
        }

        // If the broadcaster's countries match the team countries, extra bonus
        for (const bcastCountry of bcast.countries) {
          if (teamCountries.includes(bcastCountry)) {
            relevance += 10;
            break;
          }
        }

        // Check health status from the health map
        const healthStatus = getChannelHealth(ch.url);
        if (healthStatus === 'online') relevance += 25;
        if (healthStatus === 'offline') relevance -= 30; // Heavy penalty for known-dead channels

        // Avoid duplicates
        if (!results.find(r => r.url === ch.url)) {
          results.push({ ...ch, relevance, matchedBroadcaster: bcast.broadcaster, health: healthStatus });
        }
      }
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeTeam, awayTeam, competition, matchDate, sport } = body;
    const isBasketball = sport === 'basketball';

    if (!homeTeam || !awayTeam) {
      return NextResponse.json(
        { error: 'homeTeam and awayTeam are required' },
        { status: 400 }
      );
    }

    // ─── Step 1: Determine team countries ────────────────────────────────────
    const teamCountries = getCountryForTeams(homeTeam, awayTeam);

    // ─── Step 2: Fetch channels from multiple sources in parallel ────────────
    let baseChannels: Awaited<ReturnType<typeof fetchSportsChannels>> = [];
    let countryChannels: Awaited<ReturnType<typeof fetchCountryChannelsBatch>> = [];

    try {
      [baseChannels, countryChannels] = await Promise.all([
        fetchSportsChannels().catch((err) => {
          console.warn('[Match Stream API] Failed to fetch base channels:', err);
          return [] as Awaited<ReturnType<typeof fetchSportsChannels>>;
        }),
        fetchCountryChannelsBatch(teamCountries).catch((err) => {
          console.warn('[Match Stream API] Failed to fetch country channels:', err);
          return [] as Awaited<ReturnType<typeof fetchCountryChannelsBatch>>;
        }),
      ]);
    } catch (err) {
      console.warn('[Match Stream API] Channel fetch error:', err);
    }

    // Merge base channels + country-specific channels, deduplicate
    const seenUrls = new Set<string>();
    const allChannels: typeof baseChannels = [];

    // Country channels first (higher priority for this match)
    for (const ch of countryChannels) {
      if (!seenUrls.has(ch.url)) {
        seenUrls.add(ch.url);
        allChannels.push(ch);
      }
    }
    // Then base channels
    for (const ch of baseChannels) {
      if (!seenUrls.has(ch.url)) {
        seenUrls.add(ch.url);
        allChannels.push(ch);
      }
    }

    if (allChannels.length === 0) {
      return NextResponse.json({ channels: [], message: 'No channels available' });
    }

    const compLower = (competition || '').toLowerCase();

    // ─── Step 3: Find the real broadcaster via web search (with timeout) ──────
    // Web search is optional - don't let it block the response for too long
    let searchBroadcasters: string[] = [];
    try {
      searchBroadcasters = await Promise.race([
        findBroadcasterViaSearch(homeTeam, awayTeam, competition || '', sport || 'football'),
        new Promise<string[]>(resolve => setTimeout(() => resolve([]), 8000)), // 8s timeout for web search
      ]);
    } catch {
      // Web search failed, continue without it
    }

    // ─── Step 4: Get known broadcasters for this competition (structured) ────
    const knownBroadcasters = getKnownBroadcasters(compLower);

    // Combine search results with known broadcasters
    // If web search found broadcasters, merge them with known ones (search results get priority boost)
    const combinedBroadcasters: Array<{ broadcaster: string; countries: string[]; priority: number }> = [];

    // Add search-found broadcasters with high priority
    for (const bName of searchBroadcasters) {
      const existing = knownBroadcasters.find(b => b.broadcaster.toLowerCase() === bName.toLowerCase());
      if (existing) {
        combinedBroadcasters.push({ ...existing, priority: existing.priority + 5 }); // Boost for being confirmed by search
      } else {
        // Determine likely countries from the broadcaster name
        const countries = guessCountriesForBroadcaster(bName, teamCountries);
        combinedBroadcasters.push({ broadcaster: bName, countries, priority: 12 });
      }
    }

    // Add known broadcasters not already included
    for (const kb of knownBroadcasters) {
      if (!combinedBroadcasters.find(cb => cb.broadcaster.toLowerCase() === kb.broadcaster.toLowerCase())) {
        combinedBroadcasters.push(kb);
      }
    }

    // If no broadcasters found at all, create generic sports ones
    if (combinedBroadcasters.length === 0) {
      combinedBroadcasters.push(
        { broadcaster: 'Canal+', countries: ['fr'], priority: 8 },
        { broadcaster: 'beIN Sports', countries: ['fr', 'ara'], priority: 7 },
        { broadcaster: 'ESPN', countries: ['us'], priority: 5 },
      );
    }

    // ─── Step 4.5: Filter out irrelevant channels ────────────────────────────
    // Remove local TV affiliates (e.g., "CBS 2 Salt Lake City") that aren't sports channels
    // Also remove channels with [Not 24/7] or [Geo-blocked] that aren't sports
    const filteredChannels = allChannels.filter(ch => {
      // Always keep sports channels
      if (isSportsChannel(ch)) return true;
      // Remove local affiliates
      if (isLocalAffiliate(ch.name)) return false;
      // Remove geo-blocked non-sports channels
      if (ch.name.includes('[Geo-blocked]') || ch.name.includes('[Geo-Blocked]')) return false;
      // Keep other channels for potential keyword matching
      return true;
    });

    // ─── Step 5: Match broadcasters to IPTV channels ────────────────────────
    const broadcasterMatches = matchBroadcasterToIPTV(combinedBroadcasters, filteredChannels, teamCountries, sport || 'football');

    // ─── Step 6: Also do keyword-based matching (legacy, as backup) ──────────
    const sportKeywords = isBasketball
      ? ['basketball', 'basket', 'nba', 'bball']
      : ['football', 'soccer', 'futbol'];
    const searchTerms = [
      ...getCompetitionKeywords(compLower),
      ...sportKeywords,
    ].filter(Boolean);

    // Blacklist for keyword matching too
    const keywordBlacklist = [
      'combat', 'strongman', 'freesports', 'poker', 'casino', 'lottery',
      'racing.com', 'horse', 'dog racing', 'wrestling', 'boxing',
      'fitness', 'gym', 'workout', 'yoga', 'outdoors', 'hunting', 'fishing',
      'more than sports', 'world of freesports',
    ];

    const keywordMatches = filteredChannels.map((ch) => {
      const nameLower = ch.name.toLowerCase();
      const groupLower = (ch.group || '').toLowerCase();

      // Skip blacklisted channels
      if (keywordBlacklist.some(bl => nameLower.includes(bl))) {
        return { name: ch.name, url: ch.url, logo: ch.logo, group: ch.group, country: ch.country, relevance: 0, health: getChannelHealth(ch.url) };
      }

      // Skip "Canal 32", "Canal 6", etc. that aren't Canal+
      if (nameLower.includes('canal') && !nameLower.includes('canal+') && !nameLower.includes('c+') && !nameLower.includes('canal plus') && !nameLower.includes('canal sport') && !nameLower.includes('canal foot') && !nameLower.includes('canal liga')) {
        // Don't match generic "canal" keyword for non-Canal+ channels
        // Also reject pattern "Canal <number>" (Canal 6, Canal 7, Canal 10, Canal 13, Canal 26, etc.)
        if (/\bcanal\s+\d+/i.test(ch.name)) continue;
      }

      let score = 0;

      const isHls = ch.url.includes('.m3u8') || ch.url.includes('m3u8');
      if (isHls) score += 5;

      for (const term of searchTerms) {
        if (!term) continue;
        // Skip generic "canal" keyword matching for non-Canal+ channels
        if (term === 'canal' && nameLower.includes('canal') && !nameLower.includes('canal+') && !nameLower.includes('c+') && !nameLower.includes('canal plus') && !nameLower.includes('canal sport') && !nameLower.includes('canal foot') && !nameLower.includes('canal liga')) continue;

        if (nameLower.includes(term)) {
          score += term.length > 3 ? 10 : 5;
        }
        if (groupLower.includes(term)) {
          score += 3;
        }
      }

      // Country match bonus for keyword matches too
      const channelSource = (ch.source || '').toLowerCase();
      for (const tc of teamCountries) {
        if (channelSource.includes(tc)) score += 8;
      }

      if (!ch.url.startsWith('https')) score -= 2;

      // Health check
      const healthStatus = getChannelHealth(ch.url);
      if (healthStatus === 'online') score += 10;
      if (healthStatus === 'offline') score -= 20;

      return {
        name: ch.name,
        url: ch.url,
        logo: ch.logo,
        group: ch.group,
        country: ch.country,
        relevance: score,
        health: healthStatus,
      };
    }).filter((ch) => ch.relevance > 0)
      .sort((a, b) => {
        const aHls = a.url.includes('.m3u8') || a.url.includes('m3u8') ? 1 : 0;
        const bHls = b.url.includes('.m3u8') || b.url.includes('m3u8') ? 1 : 0;
        if (bHls !== aHls) return bHls - aHls;
        return b.relevance - a.relevance;
      });

    // ─── Step 7: Merge results (broadcaster matches first, then keyword) ─────
    // Also add general sports channels from the team countries as fallback
    const seenResultUrls = new Set<string>();
    const merged: Array<{ name: string; url: string; logo: string; group: string; relevance: number; broadcaster?: string; health?: string }> = [];

    // Add broadcaster matches first (highest priority)
    for (const ch of broadcasterMatches) {
      // Skip local affiliates even in broadcaster matches
      if (isLocalAffiliate(ch.name) && !isSportsChannel(ch)) continue;

      if (!seenResultUrls.has(ch.url)) {
        seenResultUrls.add(ch.url);
        merged.push({
          name: ch.name,
          url: ch.url,
          logo: ch.logo,
          group: ch.group,
          relevance: ch.relevance,
          broadcaster: ch.matchedBroadcaster,
          health: ch.health,
        });
      }
    }

    // Add keyword matches
    for (const ch of keywordMatches) {
      if (isLocalAffiliate(ch.name) && !isSportsChannel({ name: ch.name, group: ch.group })) continue;

      // Skip non-sports channels from keyword matching unless they have a broadcaster match
      if (!isSportsChannel({ name: ch.name, group: ch.group }) && ch.relevance < 20) continue;

      if (!seenResultUrls.has(ch.url)) {
        seenResultUrls.add(ch.url);
        merged.push({
          name: ch.name,
          url: ch.url,
          logo: ch.logo,
          group: ch.group,
          relevance: ch.relevance,
          health: ch.health,
        });
      }
    }

    // ─── Step 7.5: Add known free sports channels directly ────────────────────
    // These are channels that are known to be available on free IPTV and show sports
    const knownFreeSportsKeywords: Record<string, string[]> = {
      'football': ['equipe', 'golazo', 'fifa', 'futbol', 'sportdigital', 'ert sport', 'ct sport', 'fox sport', 'espn', 'bein'],
      'basketball': ['espn', 'nba', 'bein', 'equipe'],
    };

    const freeSportsKeywords = knownFreeSportsKeywords[isBasketball ? 'basketball' : 'football'] || [];
    const freeSportsChannels = allChannels.filter(ch => {
      const nameLower = ch.name.toLowerCase();
      // Must be a sports channel
      if (!isSportsChannel(ch)) return false;
      // Must match a known free sports keyword
      return freeSportsKeywords.some(kw => nameLower.includes(kw));
    });

    for (const ch of freeSportsChannels) {
      if (seenResultUrls.has(ch.url)) continue;
      if (isLocalAffiliate(ch.name)) continue;
      // Skip blacklisted
      const nameLower = ch.name.toLowerCase();
      if (['combat', 'strongman', 'freesports', 'poker', 'horse'].some(bl => nameLower.includes(bl))) continue;

      seenResultUrls.add(ch.url);
      const healthStatus = getChannelHealth(ch.url);
      merged.push({
        name: ch.name,
        url: ch.url,
        logo: ch.logo,
        group: ch.group,
        relevance: 50, // Medium-high base for known free sports channels
        health: healthStatus,
      });
    }

    // Add country-specific sports channels as additional fallback
    const countrySportsChannels = countryChannels
      .filter(ch => isSportsChannel(ch) && !isLocalAffiliate(ch.name))
      .filter(ch => !seenResultUrls.has(ch.url));

    for (const ch of countrySportsChannels) {
      seenResultUrls.add(ch.url);
      merged.push({
        name: ch.name,
        url: ch.url,
        logo: ch.logo,
        group: ch.group,
        relevance: 5, // Low base relevance
        health: getChannelHealth(ch.url),
      });
    }

    // ─── Step 8: Real-time health check on top candidates ────────────────────
    // Check top 8 channels with a timeout to avoid blocking the response too long
    const topCandidates = merged.slice(0, 8);
    const urlsToCheck = topCandidates
      .filter(ch => ch.health !== 'online') // Skip already-known-online channels
      .map(ch => ch.url);

    if (urlsToCheck.length > 0) {
      try {
        // Race health checks against a 6s timeout
        const healthResults = await Promise.race([
          checkStreamsBatch(urlsToCheck, 4, 4000),
          new Promise<Map<string, boolean>>(resolve => setTimeout(() => resolve(new Map()), 6000)),
        ]);

        // Persist health results to the shared channel-health map
        const healthBatchEntries: Array<{ url: string; status: 'online' | 'offline' }> = [];
        for (const [url, isOnline] of healthResults) {
          healthBatchEntries.push({ url, status: isOnline ? 'online' : 'offline' });
        }
        setChannelHealthBatch(healthBatchEntries);

        // Update health info and adjust relevance
        for (const ch of merged) {
          if (healthResults.has(ch.url)) {
            const isOnline = healthResults.get(ch.url)!;
            ch.health = isOnline ? 'online' : 'offline';
            if (isOnline) ch.relevance += 15;
            else ch.relevance -= 25;
          }
        }

        // Re-sort by relevance after health checks
        merged.sort((a, b) => b.relevance - a.relevance);
      } catch (err) {
        console.warn('[Match Stream API] Health check batch failed:', err);
        // Continue without health check results
      }
    }

    // Log key channel availability
    const equipeMerged = merged.find(c => c.name.toLowerCase().includes('equipe'));
    const golazoMerged = merged.find(c => c.name.toLowerCase().includes('golazo'));
    console.log('[Match Stream] Key channels - Equipe:', equipeMerged?.health || 'N/A', '| Golazo:', golazoMerged?.health || 'N/A');

    // ─── Step 9: Final results — sort by combined score ──────────────────────
    // Prioritize online channels strongly — dead streams should be at the bottom
    // Sort by a combined score: relevance from matching + health bonus
    const finalScore = (ch: typeof merged[0]) => {
      let score = ch.relevance;
      // Health bonus — strongly favor online channels
      if (ch.health === 'online') score += 50;
      if (ch.health === 'offline') score -= 100; // Very heavy penalty — dead streams are useless
      // Broadcaster match is a big positive signal
      if (ch.broadcaster) score += 15;
      // Geo-blocked penalty — these channels usually don't work
      if (ch.name.includes('[Geo-blocked]') || ch.name.includes('[Geo-Blocked]')) score -= 80;
      // Not 24/7 penalty
      if (ch.name.includes('[Not 24/7]')) score -= 20;
      // Non-sports channel with a broadcaster match penalty
      if (!isSportsChannel({ name: ch.name, group: ch.group }) && ch.broadcaster) score -= 30;
      return score;
    };

    // Sort all channels by the combined score (not by health groups)
    merged.sort((a, b) => finalScore(b) - finalScore(a));

    // Cap maximum offline channels shown to 3
    let offlineCount = 0;
    const finalChannels = merged.filter(ch => {
      if (ch.health === 'offline') {
        offlineCount++;
        if (offlineCount > 3) return false;
      }
      return true;
    }).slice(0, 12);

    // Add "Hors ligne" label to offline channels
    for (const ch of finalChannels) {
      if (ch.health === 'offline') {
        ch.name = ch.name + ' ⛔ Hors ligne';
      }
    }

    // If no specific match found, return country-specific sports channels
    if (finalChannels.length === 0) {
      const generalSports = allChannels
        .filter((ch) => {
          const nameLower = ch.name.toLowerCase();
          const groupLower = (ch.group || '').toLowerCase();
          return nameLower.includes('sport') || groupLower.includes('sport');
        })
        .slice(0, 10)
        .map((ch) => ({
          name: ch.name,
          url: ch.url,
          logo: ch.logo,
          group: ch.group,
          relevance: 0,
          health: getChannelHealth(ch.url),
        }));

      if (generalSports.length > 0) {
        return NextResponse.json({
          channels: generalSports,
          message: 'Chaînes sportives générales',
        });
      }

      // Last resort: first 5 channels
      return NextResponse.json({
        channels: allChannels.slice(0, 5).map((ch) => ({
          name: ch.name,
          url: ch.url,
          logo: ch.logo,
          group: ch.group,
          relevance: 0,
          health: getChannelHealth(ch.url),
        })),
        message: 'Aucune chaîne spécifique trouvée',
      });
    }

    // Build response message
    const broadcasterNames = searchBroadcasters.length > 0
      ? searchBroadcasters
      : combinedBroadcasters.slice(0, 3).map(b => b.broadcaster);

    const onlineCount = finalChannels.filter(ch => ch.health === 'online').length;
    const broadcasterInfo = broadcasterNames.length > 0
      ? `Diffusé sur: ${broadcasterNames.join(', ')}`
      : '';

    return NextResponse.json({
      channels: finalChannels,
      message: `${finalChannels.length} chaîne(s) trouvée(s)${onlineCount > 0 ? ` · ${onlineCount} en ligne` : ''}${broadcasterInfo ? ` · ${broadcasterInfo}` : ''}`,
      broadcasters: broadcasterNames.length > 0 ? broadcasterNames : undefined,
    });
  } catch (error) {
    console.error('[Match Stream API] Error:', error);
    // Return 200 with error message so the client can display it properly
    // (returning 500 causes the fetch to throw, showing "Erreur lors de la recherche")
    return NextResponse.json({
      channels: [],
      message: 'Erreur temporaire — veuillez réessayer',
      error: 'Failed to find channels',
    });
  }
}

/**
 * Guess likely countries for a broadcaster based on its name.
 */
function guessCountriesForBroadcaster(broadcaster: string, teamCountries: string[]): string[] {
  const bLower = broadcaster.toLowerCase();
  const countryMap: Record<string, string[]> = {
    'canal': ['fr'], 'rmc': ['fr'], 'bein': ['fr', 'ara'], 'dazn': ['de', 'it', 'es'],
    'sky': ['gb', 'de', 'it'], 'movistar': ['es'], 'espn': ['us'], 'cbs': ['us'],
    'nbc': ['us'], 'fox': ['us'], 'paramount': ['us'], 'tnt': ['gb', 'us'],
    'sport tv': ['pt'], 'eleven': ['pt'], 'viaplay': ['nl'],
    'globo': ['br'], 'spor tv': ['br'], 'tudn': ['mx'], 'azteca': ['mx'],
    'trt': ['tr'], 'ssc': ['sa'], 'supersport': ['eg'], 'nba': ['us'],
  };

  for (const [key, countries] of Object.entries(countryMap)) {
    if (bLower.includes(key)) return countries;
  }

  return teamCountries;
}

/**
 * Get keywords for a competition name
 */
function getCompetitionKeywords(comp: string): string[] {
  const keywords: string[] = [];

  const compMap: Record<string, string[]> = {
    // Football
    'ligue 1': ['ligue 1', 'l1', 'canal+', 'bein', 'amazon', 'dazn'],
    'premier league': ['premier league', 'pl', 'sky sports', 'bt sport', 'nbc'],
    'champions league': ['champions league', 'ucl', 'canal+', 'bein', 'bt sport', 'rmc sport'],
    'europa league': ['europa league', 'uel', 'canal+', 'rmc sport'],
    'conference league': ['conference league', 'canal+', 'rmc sport'],
    'la liga': ['la liga', 'liga', 'movistar', 'bein', 'espn'],
    'serie a': ['serie a', 'dazn', 'sky sport'],
    'bundesliga': ['bundesliga', 'sky sport', 'dazn'],
    'world cup': ['world cup', 'fifa', 'coupe du monde'],
    'africa cup': ['africa cup', 'can', 'afcon', 'bein'],
    'cup': ['cup', 'coupe'],
    // Basketball
    'nba': ['nba', 'espn', 'tnt', 'nba tv', 'league pass', 'bein'],
    'ncaa': ['ncaa', 'espn', 'cbs', 'tbs', 'march madness'],
    'euroleague': ['euroleague', 'euroleague tv', 'bein', 'canal+'],
    'wnba': ['wnba', 'nba tv', 'espn'],
  };

  for (const [key, values] of Object.entries(compMap)) {
    if (comp.includes(key)) {
      keywords.push(...values);
    }
  }

  return keywords;
}
