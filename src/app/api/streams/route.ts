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

// ─── In-memory cache with TTL ────────────────────────────────────────────────
interface CacheEntry {
  data: KoraMatch[];
  timestamp: number;
}

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const matchesCache = new Map<string, CacheEntry>();

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

    if (matches.length === 0) {
      console.log('[Streams API] No matches found from kora-api');
      return NextResponse.json({
        streams: [],
        matchId: null,
        isLive: false,
        source: 'kora-api',
      });
    }

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
    // If no direct team match found, look for streams from the same competition
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
    // As a last resort, find any live match with streams from the same category
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

    if (!bestMatch || !bestMatch.streams || bestMatch.streams.length === 0) {
      console.log(`[Streams API] No matching match found for "${homeTeam}" vs "${awayTeam}"`);
      return NextResponse.json({
        streams: [],
        matchId: bestMatch?.id ?? null,
        isLive: bestMatch?.is_live ?? false,
        source: 'kora-api',
      });
    }

    // Build the streams response with language flags
    const streams = bestMatch.streams.map((stream) => ({
      name: `${stream.lang || 'Unknown'} Stream`,
      url: stream.url,
      lang: stream.lang || 'Unknown',
      langFlag: LANG_FLAGS[stream.lang] || '🌐',
      source: 'kora-api',
    }));

    // Determine match quality for the response
    const isExactMatch = bestScore >= 100; // Both teams matched
    const isCompetitionMatch = bestScore < 100 && bestScore > 0;

    console.log(`[Streams API] Found match: "${bestMatch.name}" with ${streams.length} streams (live: ${bestMatch.is_live}, exact: ${isExactMatch})`);

    return NextResponse.json({
      streams,
      matchId: bestMatch.id,
      matchName: bestMatch.name,
      isLive: bestMatch.is_live,
      isExactMatch,
      isCompetitionMatch: !isExactMatch,
      source: 'kora-api',
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
