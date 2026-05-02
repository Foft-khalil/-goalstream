import { NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopScorer {
  rank: number;
  name: string;
  team: string;
  teamLogo: string | null;
  goals: number;
  assists: number;
  played: number;
}

// ─── ESPN Core API Leaders ───────────────────────────────────────────────────

const ESPN_CORE_BASE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues';

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  return fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Get the current season year for a league from the standings API
 */
async function getCurrentSeason(league: string): Promise<number> {
  try {
    const res = await fetchWithTimeout(
      `https://site.web.api.espn.com/apis/v2/sports/soccer/${league}/standings`,
      8000
    );
    if (res.ok) {
      const data = await res.json();
      const seasons = data.seasons || [];
      if (seasons.length > 0) {
        return seasons[0].year || new Date().getFullYear();
      }
    }
  } catch {
    // Fallback to current year
  }
  return new Date().getFullYear();
}

/**
 * Fetch athlete details (name) from the ESPN Core API ref URL
 */
async function fetchAthleteName(refUrl: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(refUrl, 5000);
    if (res.ok) {
      const data = await res.json();
      return data.displayName || data.shortName || 'Unknown';
    }
  } catch {
    // Fallback
  }
  return 'Unknown';
}

/**
 * Fetch team details (name, logo) from the ESPN Core API ref URL
 */
async function fetchTeamDetails(refUrl: string): Promise<{ name: string; logo: string | null }> {
  try {
    const res = await fetchWithTimeout(refUrl, 5000);
    if (res.ok) {
      const data = await res.json();
      return {
        name: data.shortDisplayName || data.abbreviation || data.displayName || '',
        logo: data.logos?.[0]?.href || null,
      };
    }
  } catch {
    // Fallback
  }
  return { name: '', logo: null };
}

async function fetchTopScorersForLeague(league: string): Promise<TopScorer[]> {
  const timeout = 15000;
  const season = await getCurrentSeason(league);

  // The ESPN Core API uses: /v2/sports/soccer/leagues/{league}/seasons/{season}/types/1/leaders
  // We try current season and previous season as fallback
  for (const seasonYear of [season, season - 1]) {
    try {
      const url = `${ESPN_CORE_BASE}/${league}/seasons/${seasonYear}/types/1/leaders?limit=20`;
      const res = await fetchWithTimeout(url, timeout);

      if (!res.ok) continue;

      const data = await res.json();
      const categories = data.categories || [];

      if (!Array.isArray(categories) || categories.length === 0) continue;

      // Find the "goalsLeaders" category which has the combined data (goals, assists, matches)
      const goalsLeadersCat = categories.find(
        (cat: any) => cat.name === 'goalsLeaders' || cat.name === 'Goals Leaders'
      );
      const goalsCat = categories.find(
        (cat: any) => cat.name === 'goals' || cat.name === 'Goals'
      );
      const assistsCat = categories.find(
        (cat: any) => cat.name === 'assistsLeaders' || cat.name === 'Assists Leaders'
      );

      // Use goalsLeaders category if available (has richer data with displayValue parsing)
      const primaryCat = goalsLeadersCat || goalsCat;
      if (!primaryCat) continue;

      const leaders = primaryCat.leaders || [];
      if (!Array.isArray(leaders) || leaders.length === 0) continue;

      // Build a map of athlete refs to assist values from the assists category
      const assistMap = new Map<string, number>();
      if (assistsCat) {
        for (const leader of (assistsCat.leaders || [])) {
          const athleteRef = leader.athlete?.$ref || '';
          const athleteId = athleteRef.split('/athletes/')[1]?.split('?')[0] || '';
          if (athleteId) {
            assistMap.set(athleteId, leader.value || 0);
          }
        }
      }

      // Parse top scorers - we need to fetch athlete names and team details
      // But to avoid too many API calls, we'll parse from displayValue first
      const scorers: TopScorer[] = [];

      for (let i = 0; i < Math.min(leaders.length, 20); i++) {
        const leader = leaders[i];
        const athleteRef: string = leader.athlete?.$ref || '';
        const teamRef: string = leader.team?.$ref || '';
        const athleteId = athleteRef.split('/athletes/')[1]?.split('?')[0] || '';

        // Parse displayValue which has format like "Matches: 38, Goals: 29" or just "29"
        const displayValue = leader.displayValue || '';
        const shortDisplayValue = leader.shortDisplayValue || '';

        let goals = leader.value || 0;
        let assists = assistMap.get(athleteId) || 0;
        let played = 0;

        // Parse from displayValue for richer data
        const matchesMatch = displayValue.match(/Matches:\s*(\d+)/i) ||
                            shortDisplayValue.match(/M:\s*(\d+)/i);
        const goalsMatch = displayValue.match(/Goals:\s*(\d+)/i) ||
                          shortDisplayValue.match(/G:\s*(\d+)/i);
        const assistsMatch = displayValue.match(/Assists:\s*(\d+)/i) ||
                            shortDisplayValue.match(/A:\s*(\d+)/i);

        if (matchesMatch) played = parseInt(matchesMatch[1], 10);
        if (goalsMatch) goals = parseInt(goalsMatch[1], 10);
        if (assistsMatch) assists = parseInt(assistsMatch[1], 10);

        // Fetch athlete name and team details (with reasonable concurrency limits)
        let athleteName = 'Unknown';
        let teamName = '';
        let teamLogo: string | null = null;

        try {
          const [nameResult, teamResult] = await Promise.all([
            fetchAthleteName(athleteRef),
            fetchTeamDetails(teamRef),
          ]);
          athleteName = nameResult;
          teamName = teamResult.name;
          teamLogo = teamResult.logo;
        } catch {
          // Use fallback values
        }

        scorers.push({
          rank: i + 1,
          name: athleteName,
          team: teamName,
          teamLogo,
          goals,
          assists,
          played,
        });
      }

      if (scorers.length > 0) return scorers;
    } catch (err: any) {
      console.warn(`[Top Scorers API] Failed for ${league} season ${seasonYear}: ${err.message}`);
    }
  }

  throw new Error(`Impossible de charger les meilleurs buteurs pour ${league}`);
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const league = searchParams.get('league');

    if (!league) {
      return NextResponse.json(
        { scorers: [], error: 'Paramètre league requis' },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `top-scorers-${league}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    const scorers = await fetchTopScorersForLeague(league);

    const response = {
      scorers,
      league,
      lastUpdated: new Date().toISOString(),
    };

    // Cache with same TTL as standings (5 min)
    setCache(cacheKey, response);

    return NextResponse.json(response, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('[Top Scorers API] Error:', error);

    const league = new URL(request.url).searchParams.get('league');
    const stale = league ? getCachedStale<any>(`top-scorers-${league}`) : null;
    if (stale) {
      return NextResponse.json({ ...stale, error: 'Données potentiellement anciennes' });
    }

    return NextResponse.json(
      { scorers: [], error: 'Impossible de charger les meilleurs buteurs' },
      { status: 200 }
    );
  }
}
