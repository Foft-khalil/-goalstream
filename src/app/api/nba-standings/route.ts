import { NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/basketball/cache';

const CACHE_KEY = 'nba-standings';

// ─── ESPN NBA Standings types ────────────────────────────────────────────────

interface ESPNStandingsEntry {
  team: {
    id: string;
    uid: string;
    abbreviation: string;
    displayName: string;
    shortDisplayName: string;
    logos?: Array<{ href: string; width: number; height: number }>;
    color?: string;
  };
  stats?: Array<{
    name: string;
    value: number;
    displayValue: string;
    shortDisplayName: string;
  }>;
  notes?: Array<{
    type: string;
    rank: number;
    description: string;
    color: string;
  }>;
}

interface ESPNStandingsGroup {
  name: string;
  abbreviation?: string;
  standings: {
    entries: ESPNStandingsEntry[];
  };
}

interface ESPNStandingsResponse {
  children: ESPNStandingsGroup[];
}

// ─── Parsed NBA team type ────────────────────────────────────────────────────

export interface NBAStandingTeam {
  teamId: string;
  abbreviation: string;
  team: string;
  shortName: string;
  logo: string | null;
  color: string | null;
  conference: 'East' | 'West';
  division: string;
  rank: number;
  wins: number;
  losses: number;
  percentage: string;
  gamesBehind: string;
  homeRecord: string;
  awayRecord: string;
  l10Record: string;
  streak: string;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  clincher: string | null;
}

// ─── NBA team color fallback map ─────────────────────────────────────────────

const NBA_TEAM_COLORS: Record<string, string> = {
  ATL: '#E03A3E', BOS: '#007A33', BKN: '#000000', CHA: '#1D1160',
  CHI: '#CE1141', CLE: '#860038', DAL: '#00538C', DEN: '#0E2240',
  DET: '#C8102E', GSW: '#1D428A', HOU: '#CE1141', IND: '#002D62',
  LAC: '#C8102E', LAL: '#552583', MEM: '#5D76A9', MIA: '#98002E',
  MIL: '#00471B', MIN: '#0C2340', NOP: '#0C2340', NYK: '#006BB6',
  OKC: '#007AC1', ORL: '#0077C0', PHI: '#006BB6', PHX: '#1D1160',
  POR: '#E03A3E', SAC: '#5A2D81', SA: '#C4CED4', TOR: '#CE1141',
  UTA: '#002B5C', WAS: '#002B5C',
};

// ─── Fetch and parse ─────────────────────────────────────────────────────────

async function fetchNBAStandings(): Promise<{ east: NBAStandingTeam[]; west: NBAStandingTeam[] }> {
  const url = 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings';
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: ESPNStandingsResponse = await res.json();

  const east: NBAStandingTeam[] = [];
  const west: NBAStandingTeam[] = [];

  for (const group of data.children || []) {
    // Determine conference from group name
    const groupName = group.name?.toLowerCase() || '';
    let conference: 'East' | 'West' | null = null;
    if (groupName.includes('eastern') || groupName.includes('east')) conference = 'East';
    else if (groupName.includes('western') || groupName.includes('west')) conference = 'West';

    const entries = group.standings?.entries || [];
    for (const entry of entries) {
      const statMap: Record<string, number | string> = {};
      for (const stat of entry.stats || []) {
        statMap[stat.name] = stat.value;
        statMap[stat.shortDisplayName] = stat.displayValue;
      }

      const team = entry.team;
      const parsed: NBAStandingTeam = {
        teamId: team.id,
        abbreviation: team.abbreviation || '',
        team: team.displayName || team.shortDisplayName || '',
        shortName: team.shortDisplayName || team.abbreviation || '',
        logo: team.logos?.[0]?.href || null,
        color: team.color ? `#${team.color}` : NBA_TEAM_COLORS[team.abbreviation] || null,
        conference: conference || 'East',
        division: group.name || '',
        rank: Number(statMap['playoffSeed'] || statMap['rank'] || 0),
        wins: Number(statMap['wins'] || 0),
        losses: Number(statMap['losses'] || 0),
        percentage: String(statMap['LPCT'] || statMap['leagueWinPercent'] || statMap['Win %'] || statMap['Pct'] || '.000'),
        gamesBehind: String(statMap['GB'] || statMap['gamesBehind'] || '-'),
        homeRecord: String(statMap['HOME'] || statMap['Home'] || '-'),
        awayRecord: String(statMap['ROAD'] || statMap['Away'] || '-'),
        l10Record: String(statMap['L10'] || statMap['l10'] || '-'),
        streak: String(statMap['STRK'] || statMap['Streak'] || statMap['strk'] || '-'),
        pointsFor: Number(String(statMap['pointsFor'] || statMap['PF'] || 0).replace(/,/g, '')),
        pointsAgainst: Number(String(statMap['pointsAgainst'] || statMap['PA'] || 0).replace(/,/g, '')),
        pointDiff: Number(String(statMap['pointDifferential'] || statMap['DIFF'] || statMap['differential'] || 0).replace(/,/g, '')),
        clincher: entry.notes?.[0]?.description || null,
      };

      if (conference === 'East') east.push(parsed);
      else if (conference === 'West') west.push(parsed);
      else east.push(parsed);
    }
  }

  // Sort by rank then win percentage
  const sortFn = (a: NBAStandingTeam, b: NBAStandingTeam) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const pctA = a.wins / Math.max(a.wins + a.losses, 1);
    const pctB = b.wins / Math.max(b.wins + b.losses, 1);
    return pctB - pctA;
  };

  east.sort(sortFn);
  west.sort(sortFn);

  // Re-rank
  east.forEach((t, i) => { t.rank = i + 1; });
  west.forEach((t, i) => { t.rank = i + 1; });

  return { east, west };
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Check cache
    const cached = getCached<{ east: NBAStandingTeam[]; west: NBAStandingTeam[] }>(CACHE_KEY);
    if (cached) {
      const age = getCacheAge(CACHE_KEY);
      return NextResponse.json(
        { ...cached, lastUpdated: new Date().toISOString() },
        { headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) } }
      );
    }

    const standings = await fetchNBAStandings();
    const response = { ...standings, lastUpdated: new Date().toISOString() };

    // Cache for 10 minutes
    setCache(CACHE_KEY, standings);

    return NextResponse.json(response, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('[NBA Standings API] Error:', error);

    const stale = getCachedStale<{ east: NBAStandingTeam[]; west: NBAStandingTeam[] }>(CACHE_KEY);
    if (stale) {
      return NextResponse.json({
        ...stale,
        lastUpdated: new Date().toISOString(),
        error: 'Data may be outdated',
      });
    }

    return NextResponse.json(
      { east: [], west: [], lastUpdated: new Date().toISOString(), error: 'Failed to load NBA standings' },
      { status: 200 }
    );
  }
}
