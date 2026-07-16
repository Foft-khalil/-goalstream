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
interface RojaCacheEntry {
  data: RojaDiaryData[];
  timestamp: number;
}

const ROJA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const rojaCache = new Map<string, RojaCacheEntry>();

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

// ─── Dead / seized domains filter ────────────────────────────────────────────
const DEAD_DOMAINS = [
  'streams.center',      // SEIZED by law enforcement
  'streamcenter.pro',    // SEIZED (same operator)
  'tvhd2.com',           // SEIZED
  'kora-api.top',        // All URLs point to seized domains
  'sportsonlinne.click', // Behind Cloudflare JS challenge (unusable server-side)
];

// ─── Fetch rojadirecta (tarjetaroja/pltvhd.com) streams ─────────────────────
async function fetchRojaDirectaStreams(
  homeTeam: string,
  awayTeam: string,
  liveOnly: boolean = false
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

      // When liveOnly: require BOTH teams to match (strict matching)
      if (liveOnly) {
        if (!homeInName || !awayInName) continue;
      } else {
        // Only include if at least one team matches
        if (!homeInName && !awayInName) continue;
      }

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
            // Use fltvhd.com as base (tvtvhd.com has been seized by law enforcement)
            streamUrl = `https://fltvhd.com${decodedUrl}`;
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

    // When a match is live, use strict matching (both teams must match)
    const liveOnly = body.liveOnly === true;

    // Fetch rojadirecta streams
    const rojaStreams = await fetchRojaDirectaStreams(homeTeam, awayTeam, liveOnly);

    // Filter out dead/seized domain streams
    const liveStreams = rojaStreams.filter(s => !DEAD_DOMAINS.some(d => s.url.includes(d)));

    if (liveStreams.length < rojaStreams.length) {
      const filtered = rojaStreams.length - liveStreams.length;
      console.log(`[Streams API] Filtered out ${filtered} stream(s) pointing to dead/seized domains`);
    }

    // Sort streams: prioritize resolvable domains and direct m3u8 links
    const RESOLVABLE_DOMAINS = ['fltvhd.com', 'futbolonlinehd.com'];
    const UNRESOLVABLE_DOMAINS = ['tvhd1.com'];

    liveStreams.sort((a, b) => {
      const aResolvable = RESOLVABLE_DOMAINS.some(d => a.url.includes(d));
      const bResolvable = RESOLVABLE_DOMAINS.some(d => b.url.includes(d));
      const aUnresolvable = UNRESOLVABLE_DOMAINS.some(d => a.url.includes(d));
      const bUnresolvable = UNRESOLVABLE_DOMAINS.some(d => b.url.includes(d));
      const aIsM3u8 = a.url.includes('.m3u8') || a.url.includes('m3u8');
      const bIsM3u8 = b.url.includes('.m3u8') || b.url.includes('m3u8');

      // Direct m3u8 URLs are best
      if (aIsM3u8 && !bIsM3u8) return -1;
      if (!aIsM3u8 && bIsM3u8) return 1;
      // Resolvable domains next
      if (aResolvable && !bResolvable) return -1;
      if (!aResolvable && bResolvable) return 1;
      // Unresolvable domains last
      if (!aUnresolvable && bUnresolvable) return -1;
      if (aUnresolvable && !bUnresolvable) return 1;
      return 0;
    });

    if (liveStreams.length === 0) {
      console.log(`[Streams API] No streams found for "${homeTeam}" vs "${awayTeam}"`);
      return NextResponse.json({
        streams: [],
        source: 'rojadirecta',
      });
    }

    console.log(`[Streams API] Found ${liveStreams.length} streams for "${homeTeam}" vs "${awayTeam}"`);

    return NextResponse.json({
      streams: liveStreams,
      source: 'rojadirecta',
    });
  } catch (err) {
    console.error('[Streams API] Error:', err);
    return NextResponse.json(
      {
        streams: [],
        source: 'rojadirecta',
        error: err instanceof Error ? err.message : 'Failed to fetch streams',
      },
      { status: 200 }
    );
  }
}
