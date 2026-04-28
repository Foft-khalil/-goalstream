import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';
import type { FootballMatch, FootballMatchesResponse } from '@/lib/football/types';

// ─── ESPN API league codes ───────────────────────────────────────────────────
const ESPN_LEAGUES = [
  { code: 'eng.1', name: 'Premier League' },
  { code: 'fra.1', name: 'Ligue 1' },
  { code: 'esp.1', name: 'La Liga' },
  { code: 'ita.1', name: 'Serie A' },
  { code: 'ger.1', name: 'Bundesliga' },
  { code: 'uefa.champions', name: 'Champions League' },
  { code: 'uefa.europa', name: 'Europa League' },
  { code: 'uefa.europa.conf', name: 'Conference League' },
  { code: 'por.1', name: 'Liga Portugal' },
  { code: 'ned.1', name: 'Eredivisie' },
  { code: 'tur.1', name: 'Süper Lig' },
  { code: 'bra.1', name: 'Brasileirão' },
  { code: 'arg.1', name: 'Liga Profesional' },
  { code: 'mex.1', name: 'Liga MX' },
  { code: 'usa.1', name: 'MLS' },
  { code: 'saudi.1', name: 'Saudi Pro League' },
  { code: 'afc.champions', name: 'AFC Champions League' },
  { code: 'caf.champions', name: 'CAF Champions League' },
];

// ─── ESPN API types ──────────────────────────────────────────────────────────
interface ESPNCompetitor {
  team: {
    name: string;
    abbreviation: string;
    logo?: string;
    displayName?: string;
    shortDisplayName?: string;
  };
  score?: string;
  homeAway: 'home' | 'away';
  records?: Array<{ summary?: string }>;
}

interface ESPNStatus {
  type: {
    name: string;       // "status_in_progress" | "status_scheduled" | "status_complete" | etc.
    state: string;      // "in" | "pre" | "post"
    completed?: boolean;
    description: string; // "1st Half", "Halftime", "Full Time", etc.
  };
  displayClock?: string; // "45:00"
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
  }>;
  league?: { name?: string };
}

// ─── Date helpers ────────────────────────────────────────────────────────────
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

// ─── Parse ESPN data ─────────────────────────────────────────────────────────
function parseESPNMatch(event: ESPNEvent, leagueName: string): FootballMatch | null {
  try {
    const competition = event.competitions?.[0];
    if (!competition) return null;

    const homeComp = competition.competitors.find((c) => c.homeAway === 'home');
    const awayComp = competition.competitors.find((c) => c.homeAway === 'away');
    if (!homeComp || !awayComp) return null;

    const homeTeam = homeComp.team.displayName || homeComp.team.name;
    const awayTeam = awayComp.team.displayName || awayComp.team.name;

    // Determine status
    const state = event.status.type.state; // "in" = live, "pre" = upcoming, "post" = finished
    let status: FootballMatch['status'] = 'upcoming';
    let minute: number | null = null;

    // Detailed clock/period info from ESPN
    const displayClock = (state === 'in') ? (event.status.displayClock || null) : null;
    const period = (state === 'in') ? (event.status.period || null) : null;
    const statusDescription = event.status.type.description || null;
    const descLower = statusDescription?.toLowerCase() || '';
    const isHalftime = state === 'in' && (
      descLower === 'halftime' ||
      descLower === 'half' ||
      descLower === 'mi-temps' ||
      descLower === 'midpoint' ||
      (descLower.includes('half') &&
        !descLower.includes('1st') &&
        !descLower.includes('first') &&
        !descLower.includes('2nd') &&
        !descLower.includes('second'))
    );
    const lastUpdated = state === 'in' ? Date.now() : null;

    if (state === 'in') {
      status = 'live';
      // Parse minute from displayClock or period
      if (event.status.displayClock) {
        const parts = event.status.displayClock.split(':');
        if (parts.length === 2) {
          minute = parseInt(parts[0], 10);
          // Add period offset (period 2 = +45 min)
          if (event.status.period && event.status.period > 1) {
            minute += 45 * (event.status.period - 1);
          }
        }
      }
      // HT = 45
      if (isHalftime) {
        minute = 45;
      }
    } else if (state === 'post') {
      status = 'finished';
    }

    // Parse scores
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    if (state === 'in' || state === 'post') {
      homeScore = homeComp.score ? parseInt(homeComp.score, 10) : 0;
      awayScore = awayComp.score ? parseInt(awayComp.score, 10) : 0;
    }

    // Team logos
    const homeLogo = homeComp.team.logo || null;
    const awayLogo = awayComp.team.logo || null;

    return {
      id: `espn_${event.id}`,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status,
      minute,
      displayClock,
      period,
      statusDescription,
      isHalftime,
      lastUpdated,
      competition: leagueName,
      homeLogo,
      awayLogo,
      matchDate: event.date,
    };
  } catch {
    return null;
  }
}

// ─── Fetch from ESPN API for a specific date ─────────────────────────────────
async function fetchESPNMatchesForDate(date: string): Promise<FootballMatch[]> {
  const allMatches: FootballMatch[] = [];
  const errors: string[] = [];

  // Fetch all leagues in parallel (batches of 5 to be nice)
  const batchSize = 5;
  for (let i = 0; i < ESPN_LEAGUES.length; i += batchSize) {
    const batch = ESPN_LEAGUES.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (league) => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${date}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
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
    console.warn(`[Football API] ${errors.length} league fetch errors for date ${date}:`, errors);
  }

  return allMatches;
}

// ─── Fetch from ESPN API (multi-date) ────────────────────────────────────────
async function fetchESPNMatches(dates: string[]): Promise<FootballMatch[]> {
  // Fetch all dates in parallel
  const results = await Promise.allSettled(
    dates.map((date) => fetchESPNMatchesForDate(date))
  );

  const allMatches: FootballMatch[] = [];
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

// ─── GET handler ─────────────────────────────────────────────────────────────
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
      ? `football-matches-${dates[0]}`
      : `football-matches-3day`;

    // Check cache first — use shorter TTL if there are live matches in cached data
    const cachedPrev = getCachedStale<FootballMatchesResponse>(cacheKey);
    const hasLive = cachedPrev?.matches?.some(m => m.status === 'live') ?? false;
    const cached = getCached<FootballMatchesResponse>(cacheKey, hasLive);
    if (cached) {
      const age = getCacheAge(cacheKey);
      // Update lastUpdated and live match clocks to current time so client chronometers don't drift
      const now = Date.now();
      const freshMatches = cached.matches.map(m => {
        if (m.status === 'live') {
          return { ...m, lastUpdated: now };
        }
        return m;
      });
      const freshResponse = { ...cached, matches: freshMatches, lastUpdated: new Date(now).toISOString() };
      console.log(`[Football API] Returning cached data (age: ${age}s, ${freshMatches.length} matches, live: ${hasLive})`);
      return NextResponse.json(freshResponse, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    console.log(`[Football API] Cache miss, fetching from ESPN API for dates: ${dates.join(', ')}...`);
    const matches = await fetchESPNMatches(dates);

    const response: FootballMatchesResponse = {
      matches,
      lastUpdated: new Date().toISOString(),
      source: 'ai-search',
      dates,
    };

    setCache(cacheKey, response);

    console.log(`[Football API] Returning ${matches.length} fresh matches for dates: ${dates.join(', ')}`);
    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Football API] Error fetching match data:', error);

    // Try stale cache
    const stale = getCachedStale<FootballMatchesResponse>('football-matches-3day')
      || getCachedStale<FootballMatchesResponse>('football-matches');
    if (stale) {
      console.log('[Football API] Returning stale cache due to error');
      return NextResponse.json(
        { ...stale, error: 'Les données peuvent être anciennes' },
        { headers: { 'X-Cache': 'STALE' } }
      );
    }

    const emptyResponse: FootballMatchesResponse = {
      matches: [],
      lastUpdated: new Date().toISOString(),
      source: 'ai-search',
      error: error instanceof Error ? error.message : 'Impossible de charger les données',
    };

    return NextResponse.json(emptyResponse, { status: 200 });
  }
}
