import { NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';

const CACHE_KEY = 'standings';

const LEAGUES = [
  { code: 'eng.1', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'fra.1', name: 'Ligue 1', flag: '🇫🇷' },
  { code: 'esp.1', name: 'La Liga', flag: '🇪🇸' },
  { code: 'ita.1', name: 'Serie A', flag: '🇮🇹' },
  { code: 'ger.1', name: 'Bundesliga', flag: '🇩🇪' },
  { code: 'por.1', name: 'Liga Portugal', flag: '🇵🇹' },
  { code: 'ned.1', name: 'Eredivisie', flag: '🇳🇱' },
];

interface StandingEntry {
  team: {
    id: string;
    displayName: string;
    shortDisplayName: string;
    abbreviation: string;
    logos?: Array<{ href: string }>;
  };
  note?: {
    color: string;
    description: string;
    rank: number;
  };
  stats: Array<{
    name: string;
    shortDisplayName: string;
    value: number;
    displayValue: string;
  }>;
}

async function fetchStandingsForLeague(code: string) {
  const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/${code}/standings`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parseStandings(data: any, leagueName: string, leagueFlag: string) {
  try {
    const children = data.children || [];
    const season = children[0];
    if (!season?.standings?.entries) return null;

    const entries: StandingEntry[] = season.standings.entries;
    const seasonName = season.name || leagueName;

    const teams = entries.map((entry) => {
      const statMap: Record<string, string | number> = {};
      for (const stat of entry.stats) {
        statMap[stat.name] = stat.value;
        statMap[stat.shortDisplayName] = stat.displayValue;
      }

      return {
        rank: entry.note?.rank ?? 0,
        team: entry.team.displayName,
        shortName: entry.team.shortDisplayName || entry.team.abbreviation,
        logo: entry.team.logos?.[0]?.href || null,
        played: Number(statMap['gamesPlayed'] || 0),
        wins: Number(statMap['wins'] || 0),
        draws: Number(statMap['ties'] || 0),
        losses: Number(statMap['losses'] || 0),
        goalsFor: Number(statMap['pointsFor'] || 0),
        goalsAgainst: Number(statMap['pointsAgainst'] || 0),
        goalDiff: Number(statMap['pointDifferential'] || 0),
        points: Number(statMap['points'] || 0),
        note: entry.note?.description || null,
        noteColor: entry.note?.color || null,
      };
    });

    // Sort by points desc, then goal diff
    teams.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);

    // Re-rank
    teams.forEach((t, i) => { t.rank = i + 1; });

    return { league: leagueName, flag: leagueFlag, season: seasonName, teams };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const league = searchParams.get('league');

    // Check cache
    const cacheKey = league ? `${CACHE_KEY}-${league}` : CACHE_KEY;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    const leaguesToFetch = league
      ? LEAGUES.filter((l) => l.code === league)
      : LEAGUES;

    // Fetch all in parallel
    const results = await Promise.allSettled(
      leaguesToFetch.map(async (l) => {
        const data = await fetchStandingsForLeague(l.code);
        return parseStandings(data, l.name, l.flag);
      })
    );

    const standings = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value);

    const errors = results.filter((r) => r.status === 'rejected').length;

    const response: Record<string, any> = { standings, lastUpdated: new Date().toISOString() };
    if (errors > 0) response.errors = `${errors} league(s) failed to load`;

    setCache(cacheKey, response);

    return NextResponse.json(response, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('[Standings API] Error:', error);

    const stale = getCachedStale<any>(CACHE_KEY);
    if (stale) {
      return NextResponse.json({ ...stale, error: 'Données potentiellement anciennes' });
    }

    return NextResponse.json(
      { standings: [], error: 'Impossible de charger les classements' },
      { status: 200 }
    );
  }
}
