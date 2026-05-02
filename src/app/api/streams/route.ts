import { NextRequest, NextResponse } from 'next/server';

// ─── Language flag emoji mapping ──────────────────────────────────────────────
const LANG_FLAGS: Record<string, string> = {
  English: '🇬🇧',
  Spanish: '🇪🇸',
  Italian: '🇮🇹',
  Italien: '🇮🇹',
  Deutch: '🇩🇪',
  French: '🇫🇷',
  Portuguese: '🇵🇹',
  Arabic: '🇸🇦',
};

// ─── Category ID mapping ─────────────────────────────────────────────────────
const SPORT_CATEGORY_IDS: Record<string, number[]> = {
  basketball: [4, 26],   // Basketball + NCAAB
  football: [9],          // Soccer
  soccer: [9],            // Alias
};

// ─── Kora-API types ──────────────────────────────────────────────────────────
interface KoraStream {
  url: string;
  lang: string;
}

interface KoraCategory {
  id: number;
  name: string;
  sport_code: string;
  image?: string;
}

interface KoraMatch {
  id: number;
  name: string;
  description: string;
  category: KoraCategory;
  logo_team1: string;
  logo_team2: string;
  begin_at: string;
  end_at: string;
  is_live: boolean;
  streams: KoraStream[];
}

interface KoraMatchesResponse {
  total: number;
  page: number;
  per_page: number;
  data: KoraMatch[];
}

// ─── Rojadirecta (pltvhd.com) types ─────────────────────────────────────────
interface RojaEmbedAttributes {
  embed_name: string;
  embed_iframe: string;
}

interface RojaEmbedData {
  id: number;
  attributes: RojaEmbedAttributes;
}

interface RojaCountryAttributes {
  name: string;
}

interface RojaCountryData {
  attributes: RojaCountryAttributes;
}

interface RojaDiaryAttributes {
  diary_description: string;
  diary_hour: string;
  date_diary: string;
  embeds: {
    data: RojaEmbedData[];
  };
  country: {
    data: RojaCountryData | null;
  };
}

interface RojaDiaryData {
  id: number;
  attributes: RojaDiaryAttributes;
}

interface RojaDiariesResponse {
  data: RojaDiaryData[];
}

// ─── In-memory cache with TTL ────────────────────────────────────────────────
interface CacheEntry {
  data: KoraMatch[];
  timestamp: number;
}

interface RojaCacheEntry {
  data: RojaDiaryData[];
  timestamp: number;
}

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const matchesCache = new Map<string, CacheEntry>();

const ROJA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const rojaCache = new Map<string, RojaCacheEntry>();

function getCachedMatches(key: string): KoraMatch[] | null {
  const entry = matchesCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    matchesCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedMatches(key: string, data: KoraMatch[]): void {
  matchesCache.set(key, { data, timestamp: Date.now() });
}

function getCachedRojaDiaries(key: string): RojaDiaryData[] | null {
  const entry = rojaCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ROJA_CACHE_TTL_MS) {
    rojaCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedRojaDiaries(key: string, data: RojaDiaryData[]): void {
  rojaCache.set(key, { data, timestamp: Date.now() });
}

// ─── Fetch all matches from kora-api (with pagination) ──────────────────────
async function fetchAllMatches(categoryIds?: number[]): Promise<KoraMatch[]> {
  const cacheKey = categoryIds ? `matches-cats-${categoryIds.join(',')}` : 'matches-all';

  const cached = getCachedMatches(cacheKey);
  if (cached) {
    console.log(`[Streams API] Cache hit for key: ${cacheKey} (${cached.length} matches)`);
    return cached;
  }

  const allMatches: KoraMatch[] = [];
  let page = 1;
  const perPage = 200;
  let totalMatches = Infinity;

  try {
    while ((page - 1) * perPage < totalMatches) {
      const url = `https://ws.kora-api.space/api/matches?per_page=${perPage}&page=${page}`;
      console.log(`[Streams API] Fetching page ${page} from kora-api...`);

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn(`[Streams API] kora-api returned HTTP ${res.status}`);
        break;
      }

      const data: KoraMatchesResponse = await res.json();
      totalMatches = data.total;

      const filtered = categoryIds
        ? data.data.filter((m) => categoryIds.includes(m.category.id))
        : data.data;

      allMatches.push(...filtered);

      if (data.data.length < perPage) break;
      page++;
    }
  } catch (err) {
    console.warn('[Streams API] Error fetching from kora-api:', err);
  }

  console.log(`[Streams API] Fetched ${allMatches.length} matches from kora-api`);
  setCachedMatches(cacheKey, allMatches);
  return allMatches;
}

// ─── Fetch rojadirecta (tarjetaroja/pltvhd.com) streams ─────────────────────
async function fetchRojaDirectaStreams(
  homeTeam: string,
  awayTeam: string
): Promise<Array<{
  name: string;
  url: string;
  lang: string;
  langFlag: string;
  source: string;
}>> {
  const cacheKey = 'roja-diaries';

  try {
    // Check cache first
    let diaries = getCachedRojaDiaries(cacheKey);

    if (!diaries) {
      console.log('[Streams API] Fetching diaries from rojadirecta (pltvhd.com)...');
      const res = await fetch('https://pltvhd.com/diaries.json', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[Streams API] rojadirecta API returned HTTP ${res.status}`);
        return [];
      }

      const data: RojaDiariesResponse = await res.json();
      diaries = data.data || [];

      console.log(`[Streams API] Fetched ${diaries.length} diary entries from rojadirecta`);
      setCachedRojaDiaries(cacheKey, diaries);
    } else {
      console.log(`[Streams API] rojadirecta cache hit (${diaries.length} entries)`);
    }

    if (diaries.length === 0) {
      console.log('[Streams API] No diary entries from rojadirecta');
      return [];
    }

    // Generate team name variants for fuzzy matching
    const homeVariants = getTeamVariants(homeTeam);
    const awayVariants = getTeamVariants(awayTeam);

    const streams: Array<{
      name: string;
      url: string;
      lang: string;
      langFlag: string;
      source: string;
    }> = [];

    // Match diary entries against team names
    for (const diary of diaries) {
      const description = diary.attributes.diary_description;
      if (!description) continue;

      const homeInName = teamMatchesInName(homeVariants, description);
      const awayInName = teamMatchesInName(awayVariants, description);

      // Only include if at least one team matches
      if (!homeInName && !awayInName) continue;

      const embeds = diary.attributes.embeds?.data;
      if (!embeds || embeds.length === 0) continue;

      console.log(`[Streams API] rojadirecta match: "${description}" (${embeds.length} embeds)`);

      for (const embed of embeds) {
        const embedAttrs = embed.attributes;
        if (!embedAttrs.embed_iframe) continue;

        try {
          // Extract base64 "r" parameter from embed_iframe URL
          const iframePath = embedAttrs.embed_iframe;
          const rMatch = iframePath.match(/[?&]r=([^&]+)/);

          if (!rMatch) {
            console.warn(`[Streams API] No 'r' parameter found in embed_iframe: ${iframePath}`);
            continue;
          }

          // Decode the base64 parameter to get the actual stream URL
          const base64Value = rMatch[1];
          const decodedUrl = Buffer.from(base64Value, 'base64').toString('utf-8');

          // Resolve relative URLs
          let streamUrl = decodedUrl;
          if (decodedUrl.startsWith('/')) {
            streamUrl = `https://tvtvhd.com${decodedUrl}`;
          }

          // Determine language from country if available
          const countryName = diary.attributes.country?.data?.attributes?.name || '';
          const lang = mapCountryToLang(countryName);
          const langFlag = LANG_FLAGS[lang] || '🔴';

          streams.push({
            name: embedAttrs.embed_name || 'Unknown Channel',
            url: streamUrl,
            lang,
            langFlag,
            source: 'rojadirecta',
          });
        } catch (decodeErr) {
          console.warn('[Streams API] Error decoding rojadirecta embed:', decodeErr);
        }
      }
    }

    console.log(`[Streams API] rojadirecta found ${streams.length} streams for "${homeTeam}" vs "${awayTeam}"`);
    return streams;
  } catch (err) {
    console.warn('[Streams API] Error fetching from rojadirecta:', err);
    return [];
  }
}

// ─── Map country name to language ────────────────────────────────────────────
function mapCountryToLang(country: string): string {
  const COUNTRY_LANG_MAP: Record<string, string> = {
    'Inglaterra': 'English',
    'España': 'Spanish',
    'Italia': 'Italian',
    'Alemania': 'Deutch',
    'Francia': 'French',
    'Portugal': 'Portuguese',
    'Brasil': 'Portuguese',
    'Argentina': 'Spanish',
    'México': 'Spanish',
    'Arabia Saudí': 'Arabic',
    'Estados Unidos': 'English',
    'Países Bajos': 'Deutch',
    'Turquía': 'English',
  };

  return COUNTRY_LANG_MAP[country] || 'Spanish'; // Default to Spanish for rojadirecta
}

// ─── Fuzzy team name matching ────────────────────────────────────────────────

const TEAM_NAME_STRIP_PATTERNS = [
  /\bFC\b/gi, /\bCF\b/gi, /\bSC\b/gi, /\bAC\b/gi, /\bAS\b/gi, /\bSS\b/gi,
  /\bRC\b/gi, /\bCD\b/gi, /\bCA\b/gi, /\bSL\b/gi, /\bSD\b/gi, /\bSA\b/gi,
  /\bAFC\b/gi, /\bSFC\b/gi, /\bBFC\b/gi, /\bInc\b/gi, /\bClub\b/gi, /\bTeam\b/gi,
];

const TEAM_ABBREVIATIONS: Record<string, string[]> = {
  'psg': ['paris saint-germain', 'paris sg', 'paris saint germain'],
  'paris saint-germain': ['psg', 'paris sg'],
  'manchester united': ['man utd', 'man united'],
  'manchester city': ['man city'],
  'bayern munich': ['bayern', 'fc bayern'],
  'bayern': ['bayern munich', 'fc bayern'],
  'borussia dortmund': ['dortmund', 'bvb'],
  'inter milan': ['inter', 'fc internazionale'],
  'ac milan': ['milan'],
  'real madrid': ['real'],
  'atletico madrid': ['atletico', 'athletico'],
  'crystal palace': ['palace'],
  'nottingham forest': ['nottm forest', 'forest'],
  'tottenham hotspur': ['tottenham', 'spurs'],
  'west ham united': ['west ham', 'hammers'],
  'brighton and hove albion': ['brighton'],
  'wolverhampton wanderers': ['wolves', 'wolverhampton'],
  'aston villa': ['villa'],
  'newcastle united': ['newcastle', 'newcastle utd'],
  'sheffield united': ['sheffield utd'],
  'leicester city': ['leicester'],
  'los angeles lakers': ['lakers', 'la lakers'],
  'los angeles clippers': ['clippers', 'la clippers'],
  'golden state warriors': ['warriors', 'gs warriors'],
  'oklahoma city thunder': ['okc thunder', 'thunder'],
  'san antonio spurs': ['spurs'],
  'new orleans pelicans': ['pelicans'],
  'washington wizards': ['wizards'],
  'houston rockets': ['rockets'],
  'boston celtics': ['celtics'],
  'miami heat': ['heat'],
  'milwaukee bucks': ['bucks'],
  'philadelphia 76ers': ['sixers', '76ers'],
  'dallas mavericks': ['mavs', 'mavericks'],
  'denver nuggets': ['nuggets'],
  'phoenix suns': ['suns'],
  'brooklyn nets': ['nets'],
  'chicago bulls': ['bulls'],
  'portland trail blazers': ['trail blazers', 'blazers'],
  'atlanta hawks': ['hawks'],
  'cleveland cavaliers': ['cavaliers'],
  'detroit pistons': ['pistons'],
  'indiana pacers': ['pacers'],
  'memphis grizzlies': ['grizzlies'],
  'minnesota timberwolves': ['timberwolves', 'wolves'],
  'sacramento kings': ['kings'],
  'toronto raptors': ['raptors'],
  'utah jazz': ['jazz'],
  'charlotte hornets': ['hornets'],
  'orlando magic': ['magic'],
  'new york knicks': ['knicks'],
  // Saudi Pro League teams
  'al hilal': ['hilal', 'al-hilal'],
  'al nassr': ['nassr', 'al-nassr', 'nassr riyadh'],
  'al ittihad': ['ittihad', 'al-ittihad', 'ittihad jeddah'],
  'al ahli': ['ahli', 'al-ahli', 'ahli jeddah'],
  'al shabab': ['shabab', 'al-shabab'],
  'al raed': ['raed', 'al-raed'],
  'al taawoun': ['taawoun', 'al-taawoun'],
  'damac': ['damac fc'],
  'abha': ['abha club'],
  'al fateh': ['fateh', 'al-fateh'],
  'al faisaly': ['faisaly', 'al-faisaly'],
  'hazen': ['hazen fc', 'al-hazen'],
  'al khaleej': ['khaleej', 'al-khaleej'],
  'al wehda': ['wehda', 'al-wehda', 'al wahda'],
  'al ridha': ['ridha', 'al-ridha'],
  // MLS teams
  'inter miami': ['miami', 'inter miami cf'],
  'la galaxy': ['galaxy', 'los angeles galaxy'],
  'new york city': ['nyc fc', 'new york city fc'],
  'seattle sounders': ['sounders'],
  'atlanta united': ['atlanta utd'],
  'portland timbers': ['timbers'],
  // More common teams
  'benfica': ['sl benfica', 'sporting lisbon'],
  'porto': ['fc porto'],
  'sporting cp': ['sporting lisbon', 'sporting clube'],
  'ajax': ['afc ajax'],
  'psv': ['psv eindhoven'],
  'feyenoord': ['feyenoord rotterdam'],
  'galatasaray': ['galatasaray sk'],
  'fenerbahce': ['fenerbahce sk'],
  'besiktas': ['besiktas jk'],
  'celtic': ['celtic fc'],
  'rangers': ['rangers fc'],
};

function normalizeTeamName(name: string): string {
  let normalized = name.toLowerCase().trim();
  normalized = normalized.replace(/\([^)]*\)/g, '');
  for (const pattern of TEAM_NAME_STRIP_PATTERNS) {
    normalized = normalized.replace(pattern, '');
  }
  normalized = normalized.replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/[-.]+$/, '').trim();
  return normalized;
}

function getTeamVariants(teamName: string): string[] {
  const normalized = normalizeTeamName(teamName);
  const variants = new Set<string>([normalized]);
  variants.add(teamName.toLowerCase().trim());

  const lower = teamName.toLowerCase().trim();
  for (const [key, values] of Object.entries(TEAM_ABBREVIATIONS)) {
    if (lower === key || normalized === key) {
      for (const v of values) {
        variants.add(v);
        variants.add(normalizeTeamName(v));
      }
    }
    if (values.some(v => lower === v || normalized === v)) {
      variants.add(key);
      variants.add(normalizeTeamName(key));
      for (const v of values) {
        variants.add(v);
        variants.add(normalizeTeamName(v));
      }
    }
  }

  return Array.from(variants).filter(Boolean);
}

function teamMatchesInName(teamVariants: string[], matchName: string): boolean {
  const matchLower = matchName.toLowerCase();

  for (const variant of teamVariants) {
    if (!variant) continue;
    if (matchLower.includes(variant)) return true;

    const variantWords = variant.split(/\s+/).filter(w => w.length > 2);
    if (variantWords.length > 1) {
      const matchCount = variantWords.filter(w => matchLower.includes(w)).length;
      if (matchCount >= Math.ceil(variantWords.length * 0.6)) return true;
    }

    if (variant.length >= 4 && matchLower.includes(variant)) return true;
  }

  return false;
}

// ─── Competition name to kora-api category matching ────────────────────────
// Maps our competition names to kora-api category names for fallback matching
const COMPETITION_TO_KORA_CATEGORY: Record<string, string[]> = {
  'ligue 1': ['ligue 1', 'ligue1', 'france ligue 1'],
  'premier league': ['premier league', 'premierleague', 'epl', 'english premier'],
  'la liga': ['la liga', 'laliga', 'spanish la liga', 'liga ea sports'],
  'serie a': ['serie a', 'seriea', 'italian serie a'],
  'bundesliga': ['bundesliga', 'german bundesliga'],
  'champions league': ['champions league', 'championsleague', 'ucl', 'uefa champions'],
  'europa league': ['europa league', 'europaleague', 'uel', 'uefa europa'],
  'conference league': ['conference league', 'uefa conference'],
  'liga portugal': ['liga portugal', 'portuguese liga', 'liga bwin'],
  'eredivisie': ['eredivisie', 'dutch eredivisie'],
  'süper lig': ['süper lig', 'super lig', 'turkish süper', 'turkish super'],
  'brasileirão': ['brasileirão', 'brasileirao', 'brazilian serie a', 'brasileiro'],
  'liga profesional': ['liga profesional', 'argentine liga', 'liga argentina'],
  'liga mx': ['liga mx', 'ligamx', 'mexican liga'],
  'mls': ['mls', 'major league soccer'],
  'saudi pro league': ['saudi pro league', 'saudi professional', 'saudi league', 'spl'],
  'afc champions league': ['afc champions', 'afc champions league'],
  'caf champions league': ['caf champions', 'caf champions league'],
  'nba': ['nba', 'national basketball'],
  'euroleague': ['euroleague', 'euro league'],
  'ncaa': ['ncaa', 'college basketball'],
  'fifa': ['fifa', 'world cup'],
};

function competitionMatchesKoraCategory(competition: string, koraCategoryName: string): boolean {
  const compLower = competition.toLowerCase();
  const catLower = koraCategoryName.toLowerCase();

  for (const [compKey, catKeys] of Object.entries(COMPETITION_TO_KORA_CATEGORY)) {
    if (compLower.includes(compKey)) {
      return catKeys.some(ck => catLower.includes(ck) || ck.includes(catLower));
    }
  }

  // Direct substring match between competition and category name
  if (compLower.length > 3 && catLower.length > 3) {
    if (compLower.includes(catLower) || catLower.includes(compLower)) return true;
  }

  return false;
}

// ─── POST handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeTeam, awayTeam, competition, sport } = body as {
      homeTeam?: string;
      awayTeam?: string;
      competition?: string;
      sport?: string;
    };

    if (!homeTeam || !awayTeam) {
      return NextResponse.json(
        { error: 'homeTeam and awayTeam are required', streams: [] },
        { status: 400 }
      );
    }

    const sportLower = (sport || 'football').toLowerCase();
    const categoryIds = SPORT_CATEGORY_IDS[sportLower];

    // Fetch matches from kora-api
    const matches = await fetchAllMatches(categoryIds);

    // ─── Kora-API matching logic ──────────────────────────────────────────
    let koraStreams: Array<{
      name: string;
      url: string;
      lang: string;
      langFlag: string;
      source: string;
    }> = [];
    let koraMatchId: number | null = null;
    let koraIsLive = false;
    let koraMatchName: string | null = null;
    let koraIsExactMatch = false;
    let koraIsCompetitionMatch = false;

    if (matches.length === 0) {
      console.log('[Streams API] No matches found from kora-api');
    } else {
      // Generate team name variants for fuzzy matching
      const homeVariants = getTeamVariants(homeTeam);
      const awayVariants = getTeamVariants(awayTeam);

      console.log(`[Streams API] Searching for: "${homeTeam}" vs "${awayTeam}" (${sportLower})`);

      // ─── Step 1: Try exact team name matching (best quality) ──────────────
      let bestMatch: KoraMatch | null = null;
      let bestScore = 0;

      for (const match of matches) {
        let score = 0;

        const homeInName = teamMatchesInName(homeVariants, match.name);
        const awayInName = teamMatchesInName(awayVariants, match.name);

        if (homeInName) score += 50;
        if (awayInName) score += 50;
        if (match.is_live) score += 10;
        if (match.streams && match.streams.length > 0) score += 5;
        if (match.streams) score += Math.min(match.streams.length, 5);

        if (score > bestScore && homeInName && awayInName) {
          bestScore = score;
          bestMatch = match;
        }
      }

      // ─── Step 2: Try partial team name matching (one team matches) ────────
      if (!bestMatch) {
        for (const match of matches) {
          const homeInName = teamMatchesInName(homeVariants, match.name);
          const awayInName = teamMatchesInName(awayVariants, match.name);

          if ((homeInName || awayInName) && match.streams && match.streams.length > 0) {
            const score = (homeInName ? 50 : 0) + (awayInName ? 50 : 0) + (match.is_live ? 10 : 0);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = match;
            }
          }
        }
      }

      // ─── Step 3: Try competition/category matching ───────────────────────
      if (!bestMatch && competition) {
        console.log(`[Streams API] Trying competition matching for: "${competition}"`);

        let bestCompMatch: KoraMatch | null = null;
        let bestCompScore = 0;

        for (const match of matches) {
          if (!match.streams || match.streams.length === 0) continue;

          const catMatches = competitionMatchesKoraCategory(competition, match.category.name);

          if (catMatches) {
            let score = match.streams.length * 5;
            if (match.is_live) score += 20; // Strongly prefer live matches
            score += 10; // Base score for category match

            if (score > bestCompScore) {
              bestCompScore = score;
              bestCompMatch = match;
            }
          }
        }

        if (bestCompMatch) {
          bestMatch = bestCompMatch;
          console.log(`[Streams API] Found competition match: "${bestCompMatch.name}" (${bestCompMatch.category.name})`);
        }
      }

      // ─── Step 4: Try any live match with streams from the same sport ──────
      if (!bestMatch) {
        const liveWithStreams = matches.filter(m => m.is_live && m.streams && m.streams.length > 0);
        if (liveWithStreams.length > 0) {
          // Prefer matches from the same category if competition matches
          if (competition) {
            const categoryMatch = liveWithStreams.find(m =>
              competitionMatchesKoraCategory(competition, m.category.name)
            );
            if (categoryMatch) bestMatch = categoryMatch;
          }
          // If still no match, take the first live match with most streams
          if (!bestMatch) {
            bestMatch = liveWithStreams.sort((a, b) => (b.streams?.length || 0) - (a.streams?.length || 0))[0];
          }
        }
      }

      if (bestMatch && bestMatch.streams && bestMatch.streams.length > 0) {
        // Build the streams response with language flags
        koraStreams = bestMatch.streams.map((stream) => ({
          name: `${stream.lang || 'Unknown'} Stream`,
          url: stream.url,
          lang: stream.lang || 'Unknown',
          langFlag: LANG_FLAGS[stream.lang] || '🌐',
          source: 'kora-api',
        }));

        koraMatchId = bestMatch.id;
        koraIsLive = bestMatch.is_live;
        koraMatchName = bestMatch.name;

        // Determine match quality for the response
        koraIsExactMatch = bestScore >= 100; // Both teams matched
        koraIsCompetitionMatch = bestScore < 100 && bestScore > 0;

        console.log(`[Streams API] kora-api match: "${bestMatch.name}" with ${koraStreams.length} streams (live: ${bestMatch.is_live}, exact: ${koraIsExactMatch})`);
      } else {
        console.log(`[Streams API] No matching match found from kora-api for "${homeTeam}" vs "${awayTeam}"`);
      }
    }

    // ─── Fetch rojadirecta streams ────────────────────────────────────────
    const rojaStreams = await fetchRojaDirectaStreams(homeTeam, awayTeam);

    // ─── Merge results ────────────────────────────────────────────────────
    const allStreams = [...koraStreams, ...rojaStreams];

    // Determine primary source
    let primarySource = 'kora-api';
    if (koraStreams.length === 0 && rojaStreams.length > 0) {
      primarySource = 'rojadirecta';
    } else if (koraStreams.length > 0 && rojaStreams.length > 0) {
      primarySource = 'kora-api+rojadirecta';
    }

    if (allStreams.length === 0) {
      console.log(`[Streams API] No streams found from any source for "${homeTeam}" vs "${awayTeam}"`);
      return NextResponse.json({
        streams: [],
        matchId: koraMatchId,
        matchName: koraMatchName,
        isLive: koraIsLive,
        source: 'kora-api',
      });
    }

    console.log(`[Streams API] Total: ${allStreams.length} streams (kora-api: ${koraStreams.length}, rojadirecta: ${rojaStreams.length}) for "${homeTeam}" vs "${awayTeam}"`);

    return NextResponse.json({
      streams: allStreams,
      matchId: koraMatchId,
      matchName: koraMatchName,
      isLive: koraIsLive,
      isExactMatch: koraIsExactMatch,
      isCompetitionMatch: koraIsCompetitionMatch,
      source: primarySource,
    });
  } catch (err) {
    console.error('[Streams API] Error:', err);
    return NextResponse.json(
      {
        streams: [],
        matchId: null,
        isLive: false,
        source: 'kora-api',
        error: err instanceof Error ? err.message : 'Failed to fetch streams',
      },
      { status: 200 }
    );
  }
}
