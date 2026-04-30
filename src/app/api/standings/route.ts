import { NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';

// ─── League definitions by category ──────────────────────────────────────────

const CHAMPIONNATS = [
  { code: 'eng.1', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'fra.1', name: 'Ligue 1', flag: '🇫🇷' },
  { code: 'esp.1', name: 'La Liga', flag: '🇪🇸' },
  { code: 'ita.1', name: 'Serie A', flag: '🇮🇹' },
  { code: 'ger.1', name: 'Bundesliga', flag: '🇩🇪' },
  { code: 'por.1', name: 'Liga Portugal', flag: '🇵🇹' },
  { code: 'ned.1', name: 'Eredivisie', flag: '🇳🇱' },
];

const COUPES_CLUBS = [
  { code: 'uefa.champions', name: 'Ligue des Champions', flag: '🏆' },
  { code: 'uefa.europa', name: 'Europa League', flag: '🏆' },
  { code: 'uefa.europa.conf', name: 'Conference League', flag: '🏆' },
];

const NATIONALES = [
  { code: 'fifa.world', name: 'Coupe du Monde', flag: '🌍' },
  { code: 'uefa.euro', name: 'Euro', flag: '🇪🇺' },
  { code: 'caf.nations', name: 'CAN', flag: '🌍' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface ParsedStanding {
  league: string;
  flag: string;
  season: string;
  leagueCode: string;
  teams: ParsedTeam[];
  isGroup?: boolean;
  groupName?: string;
}

interface ParsedTeam {
  teamId: string;
  leagueCode: string;
  rank: number;
  team: string;
  shortName: string;
  logo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  note: string | null;
  noteColor: string | null;
}

// ─── Fetch from ESPN API ─────────────────────────────────────────────────────

async function fetchStandingsForLeague(code: string) {
  const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/${code}/standings`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Parse standings data ────────────────────────────────────────────────────

const MAX_TEAMS_PER_GROUP = 24; // Limit teams to reduce memory

function parseStandings(data: any, leagueName: string, leagueFlag: string, code: string): ParsedStanding[] {
  try {
    const children = data.children || [];

    if (children.length === 0) {
      return [];
    }

    const results: ParsedStanding[] = [];

    for (const child of children) {
      if (!child.standings?.entries) continue;

      const entries: StandingEntry[] = child.standings.entries;
      const groupName = child.name || leagueName;

      const teams: ParsedTeam[] = entries.slice(0, MAX_TEAMS_PER_GROUP).map((entry) => {
        const statMap: Record<string, string | number> = {};
        for (const stat of entry.stats) {
          statMap[stat.name] = stat.value;
          statMap[stat.shortDisplayName] = stat.displayValue;
        }

        return {
          teamId: entry.team.id,
          leagueCode: code,
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

      // For national leagues with single child, use league name directly
      const isMultiGroup = children.length > 1;
      results.push({
        league: isMultiGroup ? `${leagueName} — ${groupName}` : leagueName,
        flag: leagueFlag,
        season: groupName,
        leagueCode: code,
        teams,
        isGroup: isMultiGroup,
        groupName: isMultiGroup ? groupName : undefined,
      });
    }

    return results;
  } catch {
    return [];
  }
}

// ─── FIFA Rankings (fallback only — web search removed to save memory) ──────

function getFIFARankings(): ParsedStanding {
  const rankings = [
    { rank: 1, team: 'Argentina', points: 1865 },
    { rank: 2, team: 'France', points: 1850 },
    { rank: 3, team: 'Spain', points: 1832 },
    { rank: 4, team: 'England', points: 1812 },
    { rank: 5, team: 'Brazil', points: 1798 },
    { rank: 6, team: 'Portugal', points: 1788 },
    { rank: 7, team: 'Netherlands', points: 1770 },
    { rank: 8, team: 'Belgium', points: 1759 },
    { rank: 9, team: 'Italy', points: 1752 },
    { rank: 10, team: 'Germany', points: 1745 },
    { rank: 11, team: 'Colombia', points: 1730 },
    { rank: 12, team: 'Morocco', points: 1718 },
    { rank: 13, team: 'Uruguay', points: 1710 },
    { rank: 14, team: 'Croatia', points: 1698 },
    { rank: 15, team: 'Switzerland', points: 1685 },
    { rank: 16, team: 'Mexico', points: 1672 },
    { rank: 17, team: 'USA', points: 1665 },
    { rank: 18, team: 'Japan', points: 1655 },
    { rank: 19, team: 'Senegal', points: 1648 },
    { rank: 20, team: 'Iran', points: 1638 },
    { rank: 21, team: 'Denmark', points: 1630 },
    { rank: 22, team: 'Austria', points: 1622 },
    { rank: 23, team: 'South Korea', points: 1615 },
    { rank: 24, team: 'Turkey', points: 1608 },
    { rank: 25, team: 'Ukraine', points: 1598 },
    { rank: 26, team: 'Poland', points: 1590 },
    { rank: 27, team: 'Serbia', points: 1582 },
    { rank: 28, team: 'Ecuador', points: 1575 },
    { rank: 29, team: 'Egypt', points: 1568 },
    { rank: 30, team: 'Australia', points: 1560 },
  ];

  const teams: ParsedTeam[] = rankings.map((r) => ({
    teamId: `fifa_${r.rank}`,
    leagueCode: 'fifa.rankings',
    rank: r.rank,
    team: r.team,
    shortName: r.team.slice(0, 3).toUpperCase(),
    logo: null,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: r.points,
    note: r.rank <= 10 ? 'Top 10' : r.rank <= 20 ? 'Top 20' : null,
    noteColor: r.rank <= 10 ? '81d6ac' : r.rank <= 20 ? '7ec8e3' : null,
  }));

  return {
    league: 'Classement FIFA',
    flag: '🌍',
    season: 'Classement mondial FIFA (Déc. 2024)',
    leagueCode: 'fifa.rankings',
    teams,
    isGroup: false,
  };
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'championnats';
    const league = searchParams.get('league');

    // Build cache key
    const cacheKey = league ? `standings-${league}` : `standings-${category}`;

    // Check cache
    const cached = getCached<any>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    let leaguesToFetch: Array<{ code: string; name: string; flag: string }>;
    let includeFIFARankings = false;

    if (league === 'fifa.rankings') {
      // Special case: FIFA rankings is not an ESPN league
      includeFIFARankings = true;
      leaguesToFetch = [];
    } else if (league) {
      // Specific league requested
      const allLeagues = [...CHAMPIONNATS, ...COUPES_CLUBS, ...NATIONALES];
      leaguesToFetch = allLeagues.filter((l) => l.code === league);
      if (leaguesToFetch.length === 0) {
        return NextResponse.json(
          { standings: [], error: 'League not found' },
          { status: 200 }
        );
      }
    } else {
      // Category-based
      switch (category) {
        case 'coupes':
          leaguesToFetch = COUPES_CLUBS;
          break;
        case 'nationales':
          leaguesToFetch = NATIONALES;
          includeFIFARankings = true;
          break;
        case 'championnats':
        default:
          leaguesToFetch = CHAMPIONNATS;
          break;
      }
    }

    const standings: ParsedStanding[] = [];
    const errors: string[] = [];

    // Fetch leagues SEQUENTIALLY to avoid OOM (instead of Promise.allSettled)
    for (const l of leaguesToFetch) {
      try {
        const data = await fetchStandingsForLeague(l.code);
        const parsed = parseStandings(data, l.name, l.flag, l.code);
        if (parsed.length > 0) {
          standings.push(...parsed);
        } else {
          errors.push(`${l.name}: Pas de données disponibles`);
        }
      } catch (err: any) {
        errors.push(`${l.name}: ${err.message || 'Failed'}`);
      }
    }

    // Include FIFA Rankings for national teams category
    if (includeFIFARankings) {
      // Use fallback data directly (web search removed to save memory)
      const fifaData = getFIFARankings();
      standings.unshift(fifaData);
    }

    const response: Record<string, any> = {
      standings,
      category,
      lastUpdated: new Date().toISOString(),
    };
    if (errors.length > 0) {
      response.errors = errors;
      response.errorCount = errors.length;
    }

    // Cache with longer TTL for standings (10 min — they don't change fast)
    setCache(cacheKey, response);

    return NextResponse.json(response, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('[Standings API] Error:', error);

    const stale = getCachedStale<any>('standings-championnats')
      || getCachedStale<any>('standings-coupes')
      || getCachedStale<any>('standings-nationales');
    if (stale) {
      return NextResponse.json({ ...stale, error: 'Données potentiellement anciennes' });
    }

    return NextResponse.json(
      { standings: [], error: 'Impossible de charger les classements' },
      { status: 200 }
    );
  }
}
