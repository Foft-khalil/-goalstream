import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/basketball/cache';

const CACHE_PREFIX = 'nba-team-detail';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NBAPlayer {
  id: string;
  name: string;
  position: string;
  number: number | null;
  age: number | null;
  height: string | null;
  weight: string | null;
  nationality: string | null;
  image: string | null;
}

interface NBATeamInfo {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string | null;
  color: string | null;
  venue: string | null;
  coach: string | null;
  founded: string | null;
  record: string | null;
  conference: string | null;
  division: string | null;
}

interface NBATeamMatch {
  id: string;
  opponent: string;
  opponentLogo: string | null;
  opponentAbbreviation: string | null;
  homeAway: 'home' | 'away';
  date: string;
  status: 'upcoming' | 'live' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
}

interface NBATeamStats {
  label: string;
  value: string | number;
}

interface NBATeamDetailResponse {
  team: NBATeamInfo | null;
  roster: NBAPlayer[];
  schedule: NBATeamMatch[];
  stats: NBATeamStats[];
  lastUpdated: string;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentNBASeasonYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // NBA season spans Oct-Jun, so from Jan-Jun the season started previous year
  // From Jul-Sep, the new season hasn't started yet, but use previous year too
  return month < 9 ? now.getFullYear() - 1 : now.getFullYear();
}

async function fetchJSON(url: string, timeout = 8000): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ─── Fetch team info ─────────────────────────────────────────────────────────

async function fetchNBATeamInfo(teamId: string): Promise<NBATeamInfo | null> {
  try {
    const data = await fetchJSON(
      `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/teams/${teamId}`
    );

    const info: NBATeamInfo = {
      id: String(data.id || teamId),
      name: data.displayName || data.name || '',
      shortName: data.shortDisplayName || data.abbreviation || '',
      abbreviation: data.abbreviation || '',
      logo: data.logos?.[0]?.href || null,
      color: data.color ? `#${data.color}` : null,
      venue: null,
      coach: null,
      founded: data.founded || null,
      record: data.record?.items?.[0]?.summary || null,
      conference: null,
      division: null,
    };

    // Extract venue
    if (data.venue && typeof data.venue === 'object') {
      const parts: string[] = [];
      if (data.venue.fullName) parts.push(data.venue.fullName);
      if (data.venue.address?.city) parts.push(data.venue.address.city);
      info.venue = parts.join(', ') || null;
    }

    // Extract coach
    if (data.coach && typeof data.coach === 'object') {
      const firstName = data.coach.firstName || '';
      const lastName = data.coach.lastName || '';
      if (firstName || lastName) {
        info.coach = `${firstName} ${lastName}`.trim();
      }
    }

    // Extract group info (conference/division)
    if (data.groups && typeof data.groups === 'object') {
      if (data.groups.parent?.name) {
        info.conference = data.groups.parent.name;
      }
      info.division = data.groups.name || null;
    }

    // Fetch record from separate endpoint
    try {
      const seasonYear = getCurrentNBASeasonYear();
      const recordData = await fetchJSON(
        `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${seasonYear}/types/2/teams/${teamId}/record`
      );
      const totalRecord = recordData?.items?.[0];
      if (totalRecord) {
        info.record = totalRecord.summary || null;
        // Try to determine conference from the stats
        if (!info.conference) {
          for (const item of recordData.items || []) {
            const stats = item.stats || [];
            const hasLeagueWinPct = stats.some((s: any) => s.name === 'leagueWinPercent');
            if (hasLeagueWinPct && item.summary) {
              // This is the overall record
            }
          }
        }
      }
    } catch {
      // Record fetch failed, use basic info
    }

    return info;
  } catch (err) {
    console.error('[NBA Team API] Error fetching team info:', err);
    return null;
  }
}

// ─── Fetch roster ────────────────────────────────────────────────────────────

async function fetchNBARoster(teamId: string): Promise<NBAPlayer[]> {
  try {
    const seasonYear = getCurrentNBASeasonYear();
    const data = await fetchJSON(
      `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${seasonYear}/teams/${teamId}/athletes`
    );

    const athletes = data.items || [];
    const roster: NBAPlayer[] = [];

    const fetches = athletes.slice(0, 20).map(async (item: any) => {
      try {
        const a = item.$ref ? await fetchJSON(item.$ref, 4000) : item;
        return {
          id: String(a.id || ''),
          name: a.displayName || a.name || '',
          position: a.position?.abbreviation || a.position?.displayName || '',
          number: a.jersey ? parseInt(a.jersey, 10) : null,
          age: a.age || null,
          height: a.displayHeight || null,
          weight: a.weight ? `${a.weight} lbs` : null,
          nationality: a.nationality || a.birthPlace?.country || null,
          image: a.headshot?.href || null,
        } as NBAPlayer;
      } catch {
        return null;
      }
    });

    const results = await Promise.allSettled(fetches);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        roster.push(result.value);
      }
    }

    return roster;
  } catch (err) {
    console.warn('[NBA Team API] Failed to fetch roster:', err);
    return [];
  }
}

// ─── Fetch schedule ──────────────────────────────────────────────────────────

async function fetchNBASchedule(teamId: string): Promise<NBATeamMatch[]> {
  try {
    const data = await fetchJSON(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`
    );

    const events = data.events || [];
    const matches: NBATeamMatch[] = [];

    for (const event of events) {
      try {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const competitors = competition.competitors || [];
        const homeComp = competitors.find((c: any) => c.homeAway === 'home');
        const awayComp = competitors.find((c: any) => c.homeAway === 'away');
        if (!homeComp || !awayComp) continue;

        const isHome = String(homeComp.team.id) === String(teamId);
        const opponent = isHome ? awayComp : homeComp;
        const matchDate = event.date;

        const state = event.status?.type?.state;
        let status: 'upcoming' | 'live' | 'finished' = 'upcoming';
        if (state === 'in') status = 'live';
        else if (state === 'post') status = 'finished';

        let homeScore: number | null = null;
        let awayScore: number | null = null;
        if (status === 'live' || status === 'finished') {
          homeScore = homeComp.score ? parseInt(homeComp.score, 10) : null;
          awayScore = awayComp.score ? parseInt(awayComp.score, 10) : null;
        }

        matches.push({
          id: `nba_${event.id}`,
          opponent: opponent.team.displayName || opponent.team.name || '',
          opponentLogo: opponent.team.logo || null,
          opponentAbbreviation: opponent.team.abbreviation || null,
          homeAway: isHome ? 'home' : 'away',
          date: matchDate,
          status,
          homeScore,
          awayScore,
        });
      } catch {
        continue;
      }
    }

    matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return matches;
  } catch (err) {
    console.error('[NBA Team API] Error fetching schedule:', err);
    return [];
  }
}

// ─── Compute stats ───────────────────────────────────────────────────────────

function computeNBAStats(schedule: NBATeamMatch[], roster: NBAPlayer[]): NBATeamStats[] {
  const finished = schedule.filter((m) => m.status === 'finished');

  const wins = finished.filter((m) => {
    const isHome = m.homeAway === 'home';
    const tg = isHome ? m.homeScore : m.awayScore;
    const og = isHome ? m.awayScore : m.homeScore;
    return tg != null && og != null && tg > og;
  }).length;

  const losses = finished.filter((m) => {
    const isHome = m.homeAway === 'home';
    const tg = isHome ? m.homeScore : m.awayScore;
    const og = isHome ? m.awayScore : m.homeScore;
    return tg != null && og != null && tg < og;
  }).length;

  const totalGames = wins + losses;
  const pct = totalGames > 0 ? (wins / totalGames).toFixed(3).replace(/^0/, '') : '.000';

  const ptsFor = finished.reduce((sum, m) => {
    const isHome = m.homeAway === 'home';
    return sum + ((isHome ? m.homeScore : m.awayScore) || 0);
  }, 0);

  const ptsAgainst = finished.reduce((sum, m) => {
    const isHome = m.homeAway === 'home';
    return sum + ((isHome ? m.awayScore : m.homeScore) || 0);
  }, 0);

  return [
    { label: 'GP', value: totalGames },
    { label: 'W-L', value: `${wins}-${losses}` },
    { label: 'Pct', value: pct },
    { label: 'PPG', value: totalGames > 0 ? (ptsFor / totalGames).toFixed(1) : '0' },
    { label: 'OPPG', value: totalGames > 0 ? (ptsAgainst / totalGames).toFixed(1) : '0' },
    { label: 'Diff', value: ptsFor - ptsAgainst },
    { label: 'Roster', value: roster.length },
  ];
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const cacheKey = `${CACHE_PREFIX}-${id}`;

    const cached = getCached<NBATeamDetailResponse>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    const [teamInfo, roster, schedule] = await Promise.all([
      fetchNBATeamInfo(id),
      fetchNBARoster(id),
      fetchNBASchedule(id),
    ]);

    if (!teamInfo) {
      return NextResponse.json(
        {
          team: null,
          roster: [],
          schedule: [],
          stats: [],
          lastUpdated: new Date().toISOString(),
          error: 'Team not found',
        },
        { status: 200 }
      );
    }

    const stats = computeNBAStats(schedule, roster);

    const response: NBATeamDetailResponse = {
      team: teamInfo,
      roster,
      schedule,
      stats,
      lastUpdated: new Date().toISOString(),
    };

    setCache(cacheKey, response);

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[NBA Team API] Error:', error);

    const stale = getCachedStale<NBATeamDetailResponse>(`${CACHE_PREFIX}-${id}`);
    if (stale) {
      return NextResponse.json({ ...stale, error: 'Data may be outdated' });
    }

    return NextResponse.json(
      {
        team: null,
        roster: [],
        schedule: [],
        stats: [],
        lastUpdated: new Date().toISOString(),
        error: 'Failed to load team data',
      },
      { status: 200 }
    );
  }
}
