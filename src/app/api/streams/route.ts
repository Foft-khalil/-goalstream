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

  // Check cache first
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

      // Filter by category IDs if specified
      const filtered = categoryIds
        ? data.data.filter((m) => categoryIds.includes(m.category.id))
        : data.data;

      allMatches.push(...filtered);

      // If this page returned fewer than perPage results, we're done
      if (data.data.length < perPage) break;

      page++;
    }
  } catch (err) {
    console.warn('[Streams API] Error fetching from kora-api:', err);
    // Return whatever we have so far (could be partial)
  }

  console.log(`[Streams API] Fetched ${allMatches.length} matches from kora-api`);
  setCachedMatches(cacheKey, allMatches);
  return allMatches;
}

// ─── Fuzzy team name matching ────────────────────────────────────────────────

// Common suffixes/prefixes to strip for normalization
const TEAM_NAME_STRIP_PATTERNS = [
  /\bFC\b/gi,
  /\bCF\b/gi,
  /\bSC\b/gi,
  /\bAC\b/gi,
  /\bAS\b/gi,
  /\bSS\b/gi,
  /\bRC\b/gi,
  /\bCD\b/gi,
  /\bCA\b/gi,
  /\bSL\b/gi,
  /\bSD\b/gi,
  /\bSA\b/gi,
  /\bAFC\b/gi,
  /\bSFC\b/gi,
  /\bBFC\b/gi,
  /\bInc\b/gi,
  /\bClub\b/gi,
  /\bTeam\b/gi,
];

// Known abbreviations for fuzzy matching
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
  'san antonio spurs': ['spurs'],
};

function normalizeTeamName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Remove content in parentheses
  normalized = normalized.replace(/\([^)]*\)/g, '');
  // Strip common suffixes
  for (const pattern of TEAM_NAME_STRIP_PATTERNS) {
    normalized = normalized.replace(pattern, '');
  }
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  // Remove trailing/leading hyphens and dots
  normalized = normalized.replace(/[-.]+$/, '').trim();
  return normalized;
}

/**
 * Get all possible normalized variants of a team name for matching.
 */
function getTeamVariants(teamName: string): string[] {
  const normalized = normalizeTeamName(teamName);
  const variants = new Set<string>([normalized]);

  // Add the original lowercase
  variants.add(teamName.toLowerCase().trim());

  // Check known abbreviations
  const lower = teamName.toLowerCase().trim();
  for (const [key, values] of Object.entries(TEAM_ABBREVIATIONS)) {
    if (lower === key || normalized === key) {
      for (const v of values) {
        variants.add(v);
        variants.add(normalizeTeamName(v));
      }
    }
    // Also check if the input matches one of the abbreviation values
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

/**
 * Check if a team name appears in a match name using fuzzy matching.
 * The match name format is typically "Team1 vs Team2" or "Team1 at Team2".
 */
function teamMatchesInName(teamVariants: string[], matchName: string): boolean {
  const matchLower = matchName.toLowerCase();

  for (const variant of teamVariants) {
    if (!variant) continue;

    // Direct substring match
    if (matchLower.includes(variant)) {
      return true;
    }

    // Word-level matching: split the variant into words and check if most key words appear
    const variantWords = variant.split(/\s+/).filter(w => w.length > 2);
    if (variantWords.length > 1) {
      const matchCount = variantWords.filter(w => matchLower.includes(w)).length;
      // If most words match, consider it a match
      if (matchCount >= Math.ceil(variantWords.length * 0.6)) {
        return true;
      }
    }

    // Check for single-word match if the variant is long enough
    if (variant.length >= 4 && matchLower.includes(variant)) {
      return true;
    }
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

    // Determine category IDs to filter by
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
    console.log(`[Streams API] Home variants: ${homeVariants.join(', ')}`);
    console.log(`[Streams API] Away variants: ${awayVariants.join(', ')}`);

    // Find the best matching match
    let bestMatch: KoraMatch | null = null;
    let bestScore = 0;

    for (const match of matches) {
      let score = 0;

      const homeInName = teamMatchesInName(homeVariants, match.name);
      const awayInName = teamMatchesInName(awayVariants, match.name);

      // Both teams must match for a valid result
      if (homeInName) score += 50;
      if (awayInName) score += 50;

      // Bonus for live matches
      if (match.is_live) score += 10;

      // Bonus for having streams available
      if (match.streams && match.streams.length > 0) score += 5;

      // Bonus for more streams
      if (match.streams) score += Math.min(match.streams.length, 5);

      if (score > bestScore && homeInName && awayInName) {
        bestScore = score;
        bestMatch = match;
      }
    }

    if (!bestMatch) {
      // Try a more lenient match: at least one team matches
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

    console.log(`[Streams API] Found match: "${bestMatch.name}" with ${streams.length} streams (live: ${bestMatch.is_live})`);

    return NextResponse.json({
      streams,
      matchId: bestMatch.id,
      isLive: bestMatch.is_live,
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
      { status: 200 } // Return 200 with empty streams rather than 500 to be resilient
    );
  }
}
