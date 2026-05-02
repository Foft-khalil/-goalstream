import { NextResponse } from 'next/server';

// ─── Cache ──────────────────────────────────────────────────────────────────
const teamCache = new Map<string, { data: TeamDetailResponse; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 min

// ─── League code mapping ────────────────────────────────────────────────────
const LEAGUE_MAP: Record<string, string> = {
  'fra.1': 'fra.1',
  'eng.1': 'eng.1',
  'esp.1': 'esp.1',
  'ita.1': 'ita.1',
  'ger.1': 'ger.1',
  'por.1': 'por.1',
  'ned.1': 'ned.1',
  'tur.1': 'tur.1',
  'bra.1': 'bra.1',
  'arg.1': 'arg.1',
  'mex.1': 'mex.1',
  'uefa.champions': 'uefa.champions',
  'uefa.europa': 'uefa.europa',
  'uefa.europa.conf': 'uefa.europa.conf',
  'conmebol.libertadores': 'conmebol.libertadores',
  'conmebol.sudamericana': 'conmebol.sudamericana',
  'concacaf.champions': 'concacaf.champions',
  'afc.champions': 'afc.champions',
  'caf.champions': 'caf.champions',
  'usa.1': 'usa.1',
  'saudi.1': 'ksa.1',
  'ksa.1': 'ksa.1',
  'fifa.world': 'fifa.world',
  'uefa.euro': 'uefa.euro',
  'uefa.nations': 'uefa.nations',
  'caf.nations': 'caf.nations',
  'afc.asian.cup': 'afc.asian.cup',
  'concacaf.gold': 'concacaf.gold',
  'conmebol.america': 'conmebol.america',
  'fifa.confederations': 'fifa.confederations',
  'fifa.cwc': 'fifa.cwc',
  'fifa.friendly': 'fifa.friendly',
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  nickname: string;
  color: string;
  alternateColor: string;
  logo: string;
  logoDark: string;
  standingSummary: string;
  league: string;
}

interface PlayerInfo {
  id: string;
  fullName: string;
  shortName: string;
  jersey: string;
  position: string;
  positionAbbr: string;
  age: number | null;
  height: string;
  weight: string;
  nationality: string;
  flag: string;
  dateOfBirth: string | null;
  photo: string;
}

interface TeamStats {
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  homePlayed: number;
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayPlayed: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  rank: number;
  streak: number;
  deductions: number;
}

interface MatchResult {
  id: string;
  date: string;
  homeTeam: string;
  homeTeamShort: string;
  homeLogo: string;
  homeScore: string;
  awayTeam: string;
  awayTeamShort: string;
  awayLogo: string;
  awayScore: string;
  status: 'played' | 'upcoming' | 'live';
  competition: string;
}

interface TeamDetailResponse {
  team: TeamInfo;
  stats: TeamStats | null;
  players: PlayerInfo[];
  recentResults: MatchResult[];
  upcomingMatches: MatchResult[];
  remainingMatches: number;
  totalSeasonMatches: number;
  source: 'espn-api';
  error?: string;
}

// ─── Parse helpers ──────────────────────────────────────────────────────────
function parseTeamInfo(teamData: any, leagueCode: string): TeamInfo {
  return {
    id: String(teamData.id || ''),
    name: teamData.displayName || teamData.name || '',
    shortName: teamData.shortDisplayName || teamData.name || '',
    abbreviation: teamData.abbreviation || '',
    nickname: teamData.nickname || '',
    color: teamData.color || '',
    alternateColor: teamData.alternateColor || '',
    logo: teamData.logos?.[0]?.href || '',
    logoDark: teamData.logos?.[1]?.href || teamData.logos?.[0]?.href || '',
    standingSummary: teamData.standingSummary || '',
    league: leagueCode,
  };
}

function parseTeamStats(recordData: any): TeamStats | null {
  try {
    const items = recordData?.items || [];
    const totalItem = items.find((i: any) => i.type === 'total');
    if (!totalItem) return null;

    const statsMap = new Map(
      totalItem.stats.map((s: any) => [s.name, s.value ?? 0])
    );

    return {
      gamesPlayed: Math.round(statsMap.get('gamesPlayed') ?? 0),
      wins: Math.round(statsMap.get('wins') ?? 0),
      draws: Math.round(statsMap.get('ties') ?? 0),
      losses: Math.round(statsMap.get('losses') ?? 0),
      goalsFor: Math.round(statsMap.get('pointsFor') ?? 0),
      goalsAgainst: Math.round(statsMap.get('pointsAgainst') ?? 0),
      goalDifference: Math.round(statsMap.get('pointDifferential') ?? 0),
      points: Math.round(statsMap.get('points') ?? 0),
      homePlayed: Math.round(statsMap.get('homeGamesPlayed') ?? 0),
      homeWins: Math.round(statsMap.get('homeWins') ?? 0),
      homeDraws: Math.round(statsMap.get('homeTies') ?? 0),
      homeLosses: Math.round(statsMap.get('homeLosses') ?? 0),
      homeGoalsFor: Math.round(statsMap.get('homePointsFor') ?? 0),
      homeGoalsAgainst: Math.round(statsMap.get('homePointsAgainst') ?? 0),
      awayPlayed: Math.round(statsMap.get('awayGamesPlayed') ?? 0),
      awayWins: Math.round(statsMap.get('awayWins') ?? 0),
      awayDraws: Math.round(statsMap.get('awayTies') ?? 0),
      awayLosses: Math.round(statsMap.get('awayLosses') ?? 0),
      awayGoalsFor: Math.round(statsMap.get('awayPointsFor') ?? 0),
      awayGoalsAgainst: Math.round(statsMap.get('awayPointsAgainst') ?? 0),
      rank: Math.round(statsMap.get('rank') ?? 0),
      streak: Math.round(statsMap.get('streak') ?? 0),
      deductions: Math.round(statsMap.get('deductions') ?? 0),
    };
  } catch {
    return null;
  }
}

function parsePlayer(athlete: any): PlayerInfo {
  return {
    id: String(athlete.id || ''),
    fullName: athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim(),
    shortName: athlete.shortName || athlete.displayName || '',
    jersey: athlete.jersey || '',
    position: athlete.position?.name || '',
    positionAbbr: athlete.position?.abbreviation || '',
    age: athlete.age || null,
    height: athlete.displayHeight || '',
    weight: athlete.displayWeight || '',
    nationality: athlete.citizenship || athlete.citizenshipCountry?.name || '',
    flag: athlete.flag?.href || '',
    dateOfBirth: athlete.dateOfBirth || null,
    photo: athlete.headshot?.href || '',
  };
}

function parseMatchResult(event: any): MatchResult | null {
  try {
    const comp = event.competitions?.[0];
    if (!comp) return null;

    const competitors = comp.competitors || [];
    const home = competitors.find((c: any) => c.homeAway === 'home');
    const away = competitors.find((c: any) => c.homeAway === 'away');
    if (!home || !away) return null;

    const compStatus = comp.status?.type?.state || '';
    let status: MatchResult['status'] = 'upcoming';
    if (compStatus === 'post') status = 'played';
    else if (compStatus === 'in') status = 'live';

    // Also determine by date if status is empty
    if (!compStatus) {
      const eventDate = new Date(event.date);
      const now = new Date();
      if (eventDate < now) status = 'played';
      else status = 'upcoming';
    }

    const homeScore = home.score;
    const awayScore = away.score;
    const homeScoreStr = typeof homeScore === 'object' ? homeScore?.displayValue || '' : String(homeScore || '');
    const awayScoreStr = typeof awayScore === 'object' ? awayScore?.displayValue || '' : String(awayScore || '');

    return {
      id: String(event.id || ''),
      date: event.date || '',
      homeTeam: home.team?.displayName || home.team?.name || '',
      homeTeamShort: home.team?.shortDisplayName || home.team?.name || '',
      homeLogo: home.team?.logos?.[0]?.href || home.team?.logo || '',
      homeScore: homeScoreStr,
      awayTeam: away.team?.displayName || away.team?.name || '',
      awayTeamShort: away.team?.shortDisplayName || away.team?.name || '',
      awayLogo: away.team?.logos?.[0]?.href || away.team?.logo || '',
      awayScore: awayScoreStr,
      status,
      competition: comp.type?.group?.name || event.league?.name || '',
    };
  } catch {
    return null;
  }
}

// ─── Fetch team data ────────────────────────────────────────────────────────
async function fetchTeamDetail(
  teamId: string,
  leagueCode: string
): Promise<TeamDetailResponse> {
  const league = LEAGUE_MAP[leagueCode] || leagueCode;

  // 1. Fetch team info + record + nextEvent
  const teamRes = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
  );
  if (!teamRes.ok) throw new Error(`Team API HTTP ${teamRes.status}`);
  const teamData = await teamRes.json();
  const teamObj = teamData.team || teamData;

  const teamInfo = parseTeamInfo(teamObj, league);
  const stats = parseTeamStats(teamObj.record);

  // Parse nextEvent (upcoming matches from team endpoint)
  const nextEvents = teamObj.nextEvent || [];

  // 2. Fetch roster
  let players: PlayerInfo[] = [];
  try {
    const rosterRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}/roster`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    );
    if (rosterRes.ok) {
      const rosterData = await rosterRes.json();
      const athletes = rosterData.athletes || [];
      players = athletes.map(parsePlayer);
    }
  } catch (err) {
    console.warn(`[Team API] Roster fetch failed for ${teamId}:`, err);
  }

  // 3. Fetch schedule
  let allMatches: MatchResult[] = [];
  try {
    const scheduleRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}/schedule`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    );
    if (scheduleRes.ok) {
      const scheduleData = await scheduleRes.json();
      const events = scheduleData.events || [];
      for (const event of events) {
        const match = parseMatchResult(event);
        if (match) allMatches.push(match);
      }
    }
  } catch (err) {
    console.warn(`[Team API] Schedule fetch failed for ${teamId}:`, err);
  }

  // Also add nextEvent matches that aren't already in the schedule
  for (const ne of nextEvents) {
    const match = parseMatchResult(ne);
    if (match && !allMatches.find((m) => m.id === match.id)) {
      allMatches.push(match);
    }
  }

  // Sort matches by date descending (most recent first)
  allMatches.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  // Split into recent results and upcoming
  const now = Date.now();
  const recentResults: MatchResult[] = [];
  const upcomingMatches: MatchResult[] = [];

  for (const match of allMatches) {
    if (match.status === 'upcoming') {
      upcomingMatches.push(match);
    } else {
      recentResults.push(match);
    }
  }

  // Sort upcoming by date ascending (next match first)
  upcomingMatches.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : Infinity;
    const dateB = b.date ? new Date(b.date).getTime() : Infinity;
    return dateA - dateB;
  });

  // Calculate remaining matches
  const totalSeasonMatches = stats?.gamesPlayed
    ? stats.gamesPlayed + upcomingMatches.length
    : allMatches.length;
  const remainingMatches = upcomingMatches.length;

  return {
    team: teamInfo,
    stats,
    players,
    recentResults,
    upcomingMatches,
    remainingMatches,
    totalSeasonMatches,
    source: 'espn-api',
  };
}

// ─── GET handler ────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('id');
    const leagueCode = searchParams.get('league');

    if (!teamId || !leagueCode) {
      return NextResponse.json(
        { error: 'Paramètres id et league requis' },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `${leagueCode}:${teamId}`;
    const cached = teamCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Team API] Cache hit for ${cacheKey}`);
      return NextResponse.json(cached.data);
    }

    console.log(`[Team API] Fetching team ${teamId} from ${leagueCode}`);
    const result = await fetchTeamDetail(teamId, leagueCode);

    // Cache
    teamCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Team API] Error:', error);
    return NextResponse.json(
      {
        team: null,
        stats: null,
        players: [],
        recentResults: [],
        upcomingMatches: [],
        remainingMatches: 0,
        totalSeasonMatches: 0,
        source: 'espn-api',
        error: error instanceof Error ? error.message : 'Impossible de charger les données de l\'équipe',
      },
      { status: 200 }
    );
  }
}
