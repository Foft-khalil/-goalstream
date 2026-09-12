import { NextRequest, NextResponse } from 'next/server';

/**
 * HesGoal API Proxy
 *
 * Fetches live football match data from kora-api.space (same API used by hes-goal.eu)
 * and transforms it into the app's FootballMatch format.
 *
 * API Endpoint:
 *   GET https://ws.kora-api.space/api/matches/{YYYY-MM-DD}/1?t={YYYYMMDDHHmm}
 *
 * The "1" is the sport type (1 = football).
 * The "t" parameter is a cache-busting timestamp in YYYYMMDDHHmm format.
 */

// ─── Constants ──────────────────────────────────────────────────────────────
const KORA_API_BASE = 'https://ws.kora-api.space';
const TEAM_IMG_BASE = 'https://cdn.kora-api.space/uploads/team/';
const LEAGUE_IMG_BASE = 'https://cdn.kora-api.space/uploads/league/';

/**
 * Watch-link configuration — replicates the method used by hes-goal.click &
 * tarjetarojaenvivo.cx: each kora match exposes a per-match player page hosted on
 * a rotating "live domain" (e.g. enerexa.online). Opening that URL in a new tab
 * plays the match with the REAL broadcaster channels (beIN Sport 1, TNT 1,
 * USA Network, etc.) switchable inside the player.
 *
 * The kora API provides `live_domain` / `redirect_domain` per match; when absent
 * we fall back to the same defaults hes-goal.click uses at runtime.
 */
const DEFAULT_LIVE_DOMAIN = 'enerexa.online';
const WATCH_LANG = 'fr';

// ─── In-memory cache (60-second TTL) ────────────────────────────────────────
interface CacheEntry {
  matches: FootballMatchTransformed[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const cache = new Map<string, CacheEntry>();

// ─── Types ──────────────────────────────────────────────────────────────────
/** Raw match object from kora-api.space */
interface KoraMatch {
  id: string;
  page_id?: string;
  page?: number;
  category?: string;
  sitemap?: number;
  api_matche_id?: string;
  status: number; // 1 = live, 2 = finished, 0/3 = upcoming
  date?: string;
  time: string;
  score: string;
  home_score?: string;
  away_score?: string;
  league?: string;
  league_en: string;
  league_logo: string;
  home?: string;
  home_en: string;
  home_logo: string;
  away?: string;
  away_en: string;
  away_logo: string;
  tv?: string;
  selected?: string;
  english?: string;
  has_channels?: string; // "1" or "0"
  event?: string;
  event_desc?: string;
  active?: string; // "1" or "0"
  redirect_url?: string;
  redirect_domain?: string | null;
  redirect_domain_ids?: string[];
  live_domain?: string | null;
  edges?: string[];
  edge_domain?: string | null;
  ext_domain?: string | null;
  ar_ext_links?: string[];
  en_ext_links?: string[];
}

/** Transformed match matching the app's FootballMatch interface */
interface FootballMatchTransformed {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'live' | 'upcoming' | 'finished';
  minute: number | null;
  displayClock: string | null;
  period: number | null;
  statusDescription: string | null;
  isHalftime: boolean;
  lastUpdated: number | null;
  competition: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
  matchDate: string | null;
  streamUrl: string | null;
  channelName: string | null;
  channelLogo: string | null;
  // Kept for backward compatibility with existing consumers (match-card, stream-options)
  hasStream?: boolean;
  league?: string;
  leagueLogo?: string;
  date?: string;
  time?: string;
  score?: string;
  category?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Map kora-api status number to our status string */
function mapStatus(status: number): 'live' | 'finished' | 'upcoming' {
  if (status === 1) return 'live';
  if (status === 2) return 'finished';
  return 'upcoming';
}

/** Parse kora score string like "2 - 1" into [home, away] numbers */
function parseScore(score: string): [number | null, number | null] {
  if (!score || score === '-' || score.trim() === '') return [null, null];

  const parts = score.split('-').map((s) => s.trim());
  if (parts.length !== 2) return [null, null];

  const home = parseInt(parts[0], 10);
  const away = parseInt(parts[1], 10);

  if (isNaN(home) || isNaN(away)) return [null, null];
  return [home, away];
}

/** Build full team logo URL */
function teamLogoUrl(logo: string): string | null {
  if (!logo) return null;
  if (logo.startsWith('http')) return logo;
  return `${TEAM_IMG_BASE}${logo}`;
}

/** Build full league logo URL */
function leagueLogoUrl(logo: string): string {
  if (!logo) return '';
  if (logo.startsWith('http')) return logo;
  return `${LEAGUE_IMG_BASE}${logo}`;
}

/** Build cache-busting timestamp in YYYYMMDDHHmm format */
function buildTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}${h}${min}`;
}

/** Get today's date in YYYY-MM-DD format */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Build the watch URL for a match — the final player page hes-goal.click users
 * land on after the kora.html bridge redirect:
 *   kora.html?m={id}&lang=fr&d={live_domain}  →  https://{live_domain}/?m={id}&lang=fr
 * We link to the final destination directly (fewer hops, same result).
 */
function buildStreamUrl(m: KoraMatch): string {
  const liveDomain = m.live_domain || DEFAULT_LIVE_DOMAIN;
  return `https://${liveDomain}/?m=${m.id}&lang=${WATCH_LANG}`;
}

/** Transform a KoraMatch into our FootballMatchTransformed format */
function transformMatch(m: KoraMatch, targetDate: string): FootballMatchTransformed {
  const mappedStatus = mapStatus(m.status);
  const [homeScore, awayScore] = parseScore(m.score);
  const isLive = mappedStatus === 'live';
  const hasStream = isLive && m.active === '1' && m.has_channels === '1';

  return {
    id: m.id,
    homeTeam: m.home_en || m.home || '',
    awayTeam: m.away_en || m.away || '',
    homeScore,
    awayScore,
    status: mappedStatus,
    minute: null, // kora doesn't provide minute info
    displayClock: mappedStatus === 'upcoming' ? (m.time || null) : null,
    period: null,
    statusDescription: null,
    isHalftime: false,
    lastUpdated: Date.now(),
    competition: m.league_en || m.league || null,
    homeLogo: teamLogoUrl(m.home_logo),
    awayLogo: teamLogoUrl(m.away_logo),
    matchDate: targetDate || null,
    streamUrl: hasStream ? buildStreamUrl(m) : null,
    channelName: hasStream ? 'HesGoal' : null,
    channelLogo: null,
    // Backward compatibility fields
    hasStream,
    league: m.league_en || m.league || '',
    leagueLogo: leagueLogoUrl(m.league_logo),
    date: m.date || targetDate,
    time: m.time || '',
    score: m.score !== '-' ? m.score : '',
    category: m.category || '',
  };
}

// ─── Fetch matches for a date ───────────────────────────────────────────────
async function fetchMatchesForDate(date: string): Promise<KoraMatch[]> {
  const timestamp = buildTimestamp();
  const url = `${KORA_API_BASE}/api/matches/${date}/1?t=${timestamp}`;

  console.log(`[HesGoal API] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!res.ok) {
      console.warn(`[HesGoal API] kora-api returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const matches: KoraMatch[] = data.matches || data.data || [];

    console.log(`[HesGoal API] Fetched ${matches.length} matches for ${date}`);
    return matches;
  } catch (err) {
    console.warn('[HesGoal API] Error fetching from kora-api:', err);
    return [];
  }
}

// ─── GET handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // YYYY-MM-DD format
    const matchIdParam = searchParams.get('id'); // specific match lookup

    const targetDate = dateParam || getTodayDate();

    // ─── Single match lookup ────────────────────────────────────────────
    if (matchIdParam) {
      const cacheKey = `match-${matchIdParam}-${targetDate}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        const found = cached.matches.find((m) => m.id === matchIdParam);
        if (found) {
          return NextResponse.json({ match: found });
        }
      }

      // Fetch all matches for the date and find the specific one
      const koraMatches = await fetchMatchesForDate(targetDate);
      const found = koraMatches.find((m) => m.id === matchIdParam);

      if (!found) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      }

      const transformed = transformMatch(found, targetDate);

      // Cache the full list so subsequent lookups benefit
      const allTransformed = koraMatches
        .filter((m) => m.category === 'Soccer' || m.category === 'soccer' || !m.category)
        .map((m) => transformMatch(m, targetDate));
      cache.set(cacheKey, { matches: allTransformed, timestamp: Date.now() });

      return NextResponse.json({ match: transformed });
    }

    // ─── Date-based match list ──────────────────────────────────────────
    const cacheKey = `date-${targetDate}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[HesGoal API] Cache hit for ${targetDate} (${cached.matches.length} matches)`);
      return NextResponse.json({
        matches: cached.matches,
        date: targetDate,
        liveCount: cached.matches.filter((m) => m.status === 'live').length,
      });
    }

    // Fetch from kora-api
    const koraMatches = await fetchMatchesForDate(targetDate);

    // Filter to only football/soccer matches
    const soccerMatches = koraMatches.filter(
      (m) => m.category === 'Soccer' || m.category === 'soccer' || !m.category
    );

    // Transform to our format
    const matches: FootballMatchTransformed[] = soccerMatches.map((m) =>
      transformMatch(m, targetDate)
    );

    // Sort: live first, then upcoming, then finished
    matches.sort((a, b) => {
      const order = { live: 0, upcoming: 1, finished: 2 };
      return order[a.status] - order[b.status];
    });

    // Cache the result
    cache.set(cacheKey, { matches, timestamp: Date.now() });

    console.log(`[HesGoal API] Returning ${matches.length} matches for ${targetDate}`);

    return NextResponse.json({
      matches,
      date: targetDate,
      liveCount: matches.filter((m) => m.status === 'live').length,
    });
  } catch (err) {
    console.error('[HesGoal API] Error:', err);
    // Return empty matches array on failure (graceful error handling)
    return NextResponse.json({
      matches: [],
      date: new Date().toISOString().split('T')[0],
      liveCount: 0,
      error: 'Failed to fetch match data',
    });
  }
}
