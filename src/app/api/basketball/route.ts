import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/basketball/cache';
import type { BasketballMatch, BasketballMatchesResponse } from '@/lib/basketball/types';

// ─── ESPN Basketball league codes ──────────────────────────────────────────────
const ESPN_BASKETBALL_LEAGUES = [
  { code: 'nba', name: 'NBA', sport: 'basketball' },
  { code: 'mens-college-basketball', name: 'NCAA Men\'s Basketball', sport: 'basketball' },
  { code: 'euroleague', name: 'EuroLeague', sport: 'basketball' },
  { code: 'wnba', name: 'WNBA', sport: 'basketball' },
];

// ─── ESPN API types ────────────────────────────────────────────────────────────
interface ESPNCompetitor {
  team: {
    name: string;
    abbreviation: string;
    logo?: string;
    displayName?: string;
    shortDisplayName?: string;
    color?: string;
  };
  score?: string;
  records?: Array<{ summary?: string; type?: string }>;
  homeAway: 'home' | 'away';
}

interface ESPNStatus {
  type: {
    name: string;
    state: string; // "in" | "pre" | "post"
    completed?: boolean;
    description: string; // "1st Quarter", "Halftime", "Final", etc.
    detail?: string;
  };
  displayClock?: string; // "7:32"
  period?: number;
}

interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  status: ESPNStatus;
  competitions?: Array<{
    competitors: ESPNCompetitor[];
    type?: { group?: { name?: string } };
    broadcast?: string;
  }>;
  league?: { name?: string };
}

// ─── Date helpers ──────────────────────────────────────────────────────────────
function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function getDefaultDates(): string[] {
  const now = new Date();
  return [
    formatDateYMD(now),
    formatDateYMD(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    formatDateYMD(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)),
  ];
}

// ─── Period display helper ─────────────────────────────────────────────────────
function getPeriodDisplay(status: ESPNStatus): string {
  const period = status.period;
  const description = status.type.description?.toLowerCase() || '';

  if (description.includes('half') || description.includes('mi-temps')) {
    return 'MT';
  }

  if (period) {
    if (period <= 4) {
      // Q1-Q4 for NBA/WNBA, or 1H/2H for college
      if (description.includes('quarter') || description.includes('quart')) {
        return `Q${period}`;
      }
      // College basketball uses halves
      if (period === 1) return '1ère MT';
      if (period === 2) return '2ème MT';
      return `Q${period}`;
    }
    // Overtime
    const otNumber = period - 4;
    if (otNumber === 1) return 'OT';
    return `OT${otNumber}`;
  }

  return description || null;
}

// ─── Parse ESPN data ───────────────────────────────────────────────────────────
function parseESPNMatch(event: ESPNEvent, leagueName: string): BasketballMatch | null {
  try {
    const competition = event.competitions?.[0];
    if (!competition) return null;

    const homeComp = competition.competitors.find((c) => c.homeAway === 'home');
    const awayComp = competition.competitors.find((c) => c.homeAway === 'away');
    if (!homeComp || !awayComp) return null;

    const homeTeam = homeComp.team.displayName || homeComp.team.name;
    const awayTeam = awayComp.team.displayName || awayComp.team.name;

    // Determine status
    const state = event.status.type.state;
    let status: BasketballMatch['status'] = 'upcoming';

    if (state === 'in') {
      status = 'live';
    } else if (state === 'post') {
      status = 'finished';
    }

    // Period display
    const periodDisplay = status === 'live' ? getPeriodDisplay(event.status) : null;
    const clockDisplay = status === 'live' ? (event.status.displayClock || null) : null;
    const period = event.status.period || null;

    // Parse scores
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    if (state === 'in' || state === 'post') {
      homeScore = homeComp.score ? parseInt(homeComp.score, 10) : 0;
      awayScore = awayComp.score ? parseInt(awayComp.score, 10) : 0;
    }

    // Team records (e.g., "42-18")
    const homeRecord = homeComp.records?.find((r) => r.type === 'total')?.summary || null;
    const awayRecord = awayComp.records?.find((r) => r.type === 'total')?.summary || null;

    // Team logos
    const homeLogo = homeComp.team.logo || null;
    const awayLogo = awayComp.team.logo || null;

    // Abbreviations
    const homeAbbreviation = homeComp.team.abbreviation || null;
    const awayAbbreviation = awayComp.team.abbreviation || null;

    return {
      id: `espn_bball_${event.id}`,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status,
      periodDisplay,
      clockDisplay,
      period,
      competition: leagueName,
      homeLogo,
      awayLogo,
      homeAbbreviation,
      awayAbbreviation,
      homeRecord,
      awayRecord,
      matchDate: event.date,
    };
  } catch {
    return null;
  }
}

// ─── Fetch from ESPN API for a specific date ───────────────────────────────────
async function fetchESPNBasketballMatchesForDate(date: string): Promise<BasketballMatch[]> {
  const allMatches: BasketballMatch[] = [];
  const errors: string[] = [];

  // Fetch all leagues in parallel (batches of 3)
  const batchSize = 3;
  for (let i = 0; i < ESPN_BASKETBALL_LEAGUES.length; i += batchSize) {
    const batch = ESPN_BASKETBALL_LEAGUES.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (league) => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.code}/scoreboard?dates=${date}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${league.code}`);
        const data = await res.json();
        return { league, data };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { league, data } = result.value;
        const events: ESPNEvent[] = data.events || [];
        for (const event of events) {
          const match = parseESPNMatch(event, league.name);
          // Include all matches including finished for past days
          if (match) {
            allMatches.push(match);
          }
        }
      } else {
        errors.push(result.reason?.message || 'Unknown error');
      }
    }
  }

  if (errors.length > 0) {
    console.warn(`[Basketball API] ${errors.length} league fetch errors for date ${date}:`, errors);
  }

  return allMatches;
}

// ─── Fetch from ESPN API (multi-date) ─────────────────────────────────────────
async function fetchESPNBasketballMatches(dates: string[]): Promise<BasketballMatch[]> {
  // Fetch all dates in parallel
  const results = await Promise.allSettled(
    dates.map((date) => fetchESPNBasketballMatchesForDate(date))
  );

  const allMatches: BasketballMatch[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allMatches.push(...result.value);
    }
  }

  // Deduplicate by team names
  const seen = new Set<string>();
  const deduped = allMatches.filter((match) => {
    const key = `${match.homeTeam.toLowerCase()}|${match.awayTeam.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: live first, then upcoming by time, then finished
  const statusOrder = { live: 0, upcoming: 1, finished: 2 };
  deduped.sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    if (statusDiff !== 0) return statusDiff;
    const dateA = a.matchDate ? new Date(a.matchDate).getTime() : Infinity;
    const dateB = b.matchDate ? new Date(b.matchDate).getTime() : Infinity;
    return dateA - dateB;
  });

  return deduped;
}

// ─── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Parse date/dates params
    const dateParam = searchParams.get('date');
    const datesParam = searchParams.get('dates');

    let dates: string[];
    if (datesParam) {
      dates = datesParam.split(',').filter(Boolean);
    } else if (dateParam) {
      dates = [dateParam];
    } else {
      // Default: 3 days (today + tomorrow + day after)
      dates = getDefaultDates();
    }

    // Cache key based on dates
    const cacheKey = dates.length === 1
      ? `basketball-matches-${dates[0]}`
      : `basketball-matches-3day`;

    // Check cache first — use shorter TTL if there are live matches
    const cachedPrev = getCachedStale<BasketballMatchesResponse>(cacheKey);
    const hasLive = cachedPrev?.matches?.some(m => m.status === 'live') ?? false;
    const cached = getCached<BasketballMatchesResponse>(cacheKey, hasLive);
    if (cached) {
      const age = getCacheAge(cacheKey);
      // IMPORTANT: Do NOT reset lastUpdated on cache hits!
      // Same reason as football route — resetting causes client clock to jump backwards.
      console.log(`[Basketball API] Returning cached data (age: ${age}s, ${cached.matches.length} matches, live: ${hasLive})`);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    console.log(`[Basketball API] Cache miss, fetching from ESPN API for dates: ${dates.join(', ')}...`);
    const matches = await fetchESPNBasketballMatches(dates);

    const response: BasketballMatchesResponse = {
      matches,
      lastUpdated: new Date().toISOString(),
      source: 'espn-api',
      dates,
    };

    setCache(cacheKey, response);

    console.log(`[Basketball API] Returning ${matches.length} fresh matches for dates: ${dates.join(', ')}`);
    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Basketball API] Error fetching match data:', error);

    // Try stale cache
    const stale = getCachedStale<BasketballMatchesResponse>('basketball-matches-3day')
      || getCachedStale<BasketballMatchesResponse>('basketball-matches');
    if (stale) {
      console.log('[Basketball API] Returning stale cache due to error');
      return NextResponse.json(
        { ...stale, error: 'Les données peuvent être anciennes' },
        { headers: { 'X-Cache': 'STALE' } }
      );
    }

    const emptyResponse: BasketballMatchesResponse = {
      matches: [],
      lastUpdated: new Date().toISOString(),
      source: 'espn-api',
      error: error instanceof Error ? error.message : 'Impossible de charger les données',
    };

    return NextResponse.json(emptyResponse, { status: 200 });
  }
}
