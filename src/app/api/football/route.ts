import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';
import type { FootballMatch, FootballMatchesResponse } from '@/lib/football/types';

// ─── ESPN API league codes ───────────────────────────────────────────────────
// Primary leagues: always fetched
const ESPN_LEAGUES_PRIMARY = [
  { code: 'fra.1', name: 'Ligue 1' },
  { code: 'eng.1', name: 'Premier League' },
  { code: 'esp.1', name: 'La Liga' },
  { code: 'ita.1', name: 'Serie A' },
  { code: 'ger.1', name: 'Bundesliga' },
  { code: 'uefa.champions', name: 'Champions League' },
  { code: 'uefa.europa', name: 'Europa League' },
  { code: 'uefa.europa.conf', name: 'Conference League' },
  { code: 'usa.1', name: 'MLS' },
  { code: 'ksa.1', name: 'Saudi Pro League' },
];

// Extended leagues: fetched on demand (leagues=extended or leagues=all)
const ESPN_LEAGUES_EXTENDED = [
  { code: 'por.1', name: 'Liga Portugal' },
  { code: 'ned.1', name: 'Eredivisie' },
  { code: 'tur.1', name: 'Süper Lig' },
  { code: 'bra.1', name: 'Brasileirão' },
  { code: 'arg.1', name: 'Liga Profesional' },
  { code: 'mex.1', name: 'Liga MX' },
  { code: 'afc.champions', name: 'AFC Champions League' },
  { code: 'caf.champions', name: 'CAF Champions League' },
  { code: 'sco.1', name: 'Scottish Premiership' },
  { code: 'bel.1', name: 'Jupiler Pro League' },
  { code: 'gre.1', name: 'Super League Greece' },
  { code: 'concacaf.champions', name: 'CONCACAF Champions Cup' },
  { code: 'conmebol.libertadores', name: 'Copa Libertadores' },
  { code: 'conmebol.sudamericana', name: 'Copa Sudamericana' },
];

// Women's leagues: always fetched alongside primary
const ESPN_LEAGUES_WOMEN = [
  { code: 'eng.w.1', name: "Women's Super League" },
  { code: 'fra.w.1', name: 'Première Ligue' },
  { code: 'esp.w.1', name: 'Liga F' },
  { code: 'ned.w.1', name: 'Vrouwen Eredivisie' },
  { code: 'usa.nwsl', name: 'NWSL' },
  { code: 'aus.w.1', name: 'A-League Women' },
  { code: 'can.w.nsl', name: 'Northern Super League' },
  { code: 'usa.w.usl.1', name: 'USL Super League' },
  { code: 'uefa.wchampions', name: "Women's Champions League" },
  { code: 'fifa.friendly.w', name: "Women's Friendly" },
];

// Women's tournament leagues: fetched on demand (leagues=extended or leagues=all)
const ESPN_LEAGUES_WOMEN_TOURNAMENTS = [
  { code: 'uefa.w.nations', name: "Women's Nations League" },
  { code: 'uefa.weuro', name: "Women's Euro" },
  { code: 'concacaf.w.gold', name: 'W Gold Cup' },
  { code: 'conmebol.america.femenina', name: 'Copa América Femenina' },
  { code: 'afc.w.asian.cup', name: "Women's Asian Cup" },
  { code: 'caf.w.nations', name: "Women's AFCON" },
  { code: 'fifa.wwc', name: "Women's World Cup" },
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
    name: string;
    state: string;
    completed?: boolean;
    description: string;
  };
  displayClock?: string;
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
  // Include yesterday to catch late-night matches that are still live
  return [
    formatDateYMD(new Date(now.getTime() - 24 * 60 * 60 * 1000)), // yesterday
    formatDateYMD(now), // today
    formatDateYMD(new Date(now.getTime() + 24 * 60 * 60 * 1000)), // tomorrow
    formatDateYMD(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)), // day+2
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

    const state = event.status.type.state;
    let status: FootballMatch['status'] = 'upcoming';
    let minute: number | null = null;

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
      if (event.status.displayClock) {
        const parts = event.status.displayClock.split(':');
        if (parts.length === 2) {
          minute = parseInt(parts[0], 10);
          if (event.status.period && event.status.period > 1) {
            minute += 45 * (event.status.period - 1);
          }
        }
      }
      if (isHalftime) {
        minute = 45;
      }
    } else if (state === 'post') {
      status = 'finished';
    }

    let homeScore: number | null = null;
    let awayScore: number | null = null;
    if (state === 'in' || state === 'post') {
      homeScore = homeComp.score ? parseInt(homeComp.score, 10) : 0;
      awayScore = awayComp.score ? parseInt(awayComp.score, 10) : 0;
    }

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

// ─── Fetch a single league for a single date ────────────────────────────────
async function fetchLeague(league: typeof ESPN_LEAGUES_PRIMARY[0], date: string): Promise<FootballMatch[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${date}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const events: ESPNEvent[] = data.events || [];
    return events.map(e => parseESPNMatch(e, league.name)).filter(Boolean) as FootballMatch[];
  } catch {
    return [];
  }
}

// ─── Fetch from ESPN API for a specific date (sequential, memory-safe) ──────
async function fetchESPNMatchesForDate(date: string, includeAllLeagues: boolean): Promise<FootballMatch[]> {
  const allMatches: FootballMatch[] = [];
  const errors: string[] = [];

  const leagues = includeAllLeagues
    ? [...ESPN_LEAGUES_PRIMARY, ...ESPN_LEAGUES_EXTENDED, ...ESPN_LEAGUES_WOMEN, ...ESPN_LEAGUES_WOMEN_TOURNAMENTS]
    : [...ESPN_LEAGUES_PRIMARY, ...ESPN_LEAGUES_WOMEN];

  // Fetch leagues in batches of 3 for speed while staying memory-safe
  const batchSize = 3;
  for (let i = 0; i < leagues.length; i += batchSize) {
    const batch = leagues.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (league) => {
        return await fetchLeague(league, date);
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allMatches.push(...result.value);
      } else {
        errors.push(result.reason?.message || 'Unknown error');
      }
    }

    // Add 200ms delay between batches to reduce memory spikes
    if (i + batchSize < leagues.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (errors.length > 0) {
    console.warn(`[Football API] ${errors.length} league fetch errors for date ${date}:`, errors);
  }

  return allMatches;
}

// ─── Fetch from ESPN API (multi-date, sequential to avoid OOM) ──────────────
async function fetchESPNMatches(dates: string[], includeAllLeagues: boolean): Promise<FootballMatch[]> {
  // Fetch dates SEQUENTIALLY (not parallel) to avoid OOM crashes
  // Each date fetches 8 primary leagues in batches of 2 = 4 batches (or 18 if all)
  // Parallel dates would triple the concurrent connections
  const allMatches: FootballMatch[] = [];

  for (const date of dates) {
    try {
      const dayMatches = await fetchESPNMatchesForDate(date, includeAllLeagues);
      allMatches.push(...dayMatches);
    } catch {
      // Continue with other dates even if one fails
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

    const dateParam = searchParams.get('date');
    const datesParam = searchParams.get('dates');

    let dates: string[];
    if (datesParam) {
      dates = datesParam.split(',').filter(Boolean).slice(0, 7); // Max 7 dates (full week)
    } else if (dateParam) {
      dates = [dateParam];
    } else {
      // Default: yesterday + today + tomorrow + day+2 (catches late-night live matches)
      dates = getDefaultDates();
    }

    const cacheKey = dates.length === 1
      ? `football-matches-${dates[0]}`
      : `football-matches-${dates.length}day`;

    // Check cache first
    const cachedPrev = getCachedStale<FootballMatchesResponse>(cacheKey);
    const hasLive = cachedPrev?.matches?.some(m => m.status === 'live') ?? false;
    const cached = getCached<FootballMatchesResponse>(cacheKey, hasLive);
    if (cached) {
      const age = getCacheAge(cacheKey);
      console.log(`[Football API] Returning cached data (age: ${age}s, ${cached.matches.length} matches, live: ${hasLive})`);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    // Check if all leagues should be fetched (on demand)
    const includeAllLeagues = searchParams.get('leagues') === 'all' || searchParams.get('leagues') === 'extended';

    console.log(`[Football API] Cache miss, fetching from ESPN API for dates: ${dates.join(', ')}${includeAllLeagues ? ' (all leagues)' : ' (primary leagues)'}...`);

    // Race the fetch against a 30s global timeout to prevent server hangs
    const matches = await Promise.race([
      fetchESPNMatches(dates, includeAllLeagues),
      new Promise<FootballMatch[]>((resolve) =>
        setTimeout(() => resolve([]), 30000)
      ),
    ]);

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
    const stale = getCachedStale<FootballMatchesResponse>('football-matches-7day')
      || getCachedStale<FootballMatchesResponse>('football-matches-3day')
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
