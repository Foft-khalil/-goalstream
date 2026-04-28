import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';

const CACHE_PREFIX = 'team-detail';

interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string | null;
  color: string | null;
  venue: string | null;
  coach: string | null;
  founded: string | null;
  leagueCode: string;
  leagueName: string;
}

interface Player {
  id: string;
  name: string;
  position: string;
  number: number | null;
  age: number | null;
  nationality: string | null;
  image: string | null;
}

interface TeamMatch {
  id: string;
  opponent: string;
  opponentLogo: string | null;
  homeAway: 'home' | 'away';
  date: string;
  status: 'upcoming' | 'live' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
}

interface TeamStats {
  label: string;
  value: string | number;
}

interface TeamDetailResponse {
  team: TeamInfo | null;
  roster: Player[];
  schedule: TeamMatch[];
  form: string[];
  stats: TeamStats[];
  lastUpdated: string;
  error?: string;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchTeamInfo(teamId: string, leagueCode: string): Promise<{ info: TeamInfo; roster: Player[] } | null> {
  try {
    // Use ESPN Core API for richer data
    const data = await fetchJSON(
      `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${leagueCode}/teams/${teamId}`
    );

    const info: TeamInfo = {
      id: data.id || teamId,
      name: data.displayName || data.name || '',
      shortName: data.shortDisplayName || data.abbreviation || '',
      abbreviation: data.abbreviation || '',
      logo: data.logos?.[0]?.href || null,
      color: data.color || null,
      venue: null,
      coach: null,
      founded: null,
      leagueCode,
      leagueName: '',
    };

    // Extract venue
    if (data.venue) {
      if (typeof data.venue === 'object' && data.venue.fullName) {
        info.venue = data.venue.fullName;
        if (data.venue.address?.city) {
          info.venue = `${data.venue.fullName}, ${data.venue.address.city}`;
        }
      }
    }

    // Fetch coach from coaches $ref
    if (data.coaches?.$ref) {
      try {
        const coachesData = await fetchJSON(data.coaches.$ref);
        const coachList = coachesData.items || [];
        if (coachList.length > 0) {
          const coachRef = coachList[0];
          // Coach data might be inline or need another fetch
          if (coachRef.firstName || coachRef.lastName || coachRef.displayName) {
            info.coach = coachRef.displayName || `${coachRef.firstName || ''} ${coachRef.lastName || ''}`.trim();
          } else if (coachRef.$ref) {
            try {
              const coachDetail = await fetchJSON(coachRef.$ref);
              info.coach = coachDetail.displayName || `${coachDetail.firstName || ''} ${coachDetail.lastName || ''}`.trim() || null;
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[Team API] Failed to fetch coach:', err);
      }
    }

    // Fetch roster from athletes $ref
    const roster: Player[] = [];
    if (data.athletes?.$ref) {
      try {
        const athletesData = await fetchJSON(data.athletes.$ref);
        const athleteItems = athletesData.items || [];

        // Athletes might be inline or have $ref
        for (const item of athleteItems) {
          try {
            const a = item.$ref ? await fetchJSON(item.$ref) : item;
            roster.push({
              id: String(a.id || ''),
              name: a.displayName || a.name || '',
              position: a.position?.abbreviation || a.position?.displayName || '',
              number: a.jersey ? parseInt(a.jersey, 10) : null,
              age: a.age || null,
              nationality: a.nationality || a.birthPlace?.country || null,
              image: a.headshot?.href || null,
            });
          } catch {
            // Skip individual athlete if fetch fails
            continue;
          }
        }
      } catch (err) {
        console.warn('[Team API] Failed to fetch roster:', err);
      }
    }

    return { info, roster };
  } catch (err) {
    console.error('[Team API] Error fetching team info:', err);
    return null;
  }
}

async function fetchTeamSchedule(teamId: string, leagueCode: string): Promise<TeamMatch[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/teams/${teamId}/schedule`;
    const data = await fetchJSON(url);

    const events = data.events || [];
    const matches: TeamMatch[] = [];

    for (const event of events) {
      try {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const competitors = competition.competitors || [];
        const homeComp = competitors.find((c: any) => c.homeAway === 'home');
        const awayComp = competitors.find((c: any) => c.homeAway === 'away');
        if (!homeComp || !awayComp) continue;

        const isHome = homeComp.team.id === teamId;
        const opponent = isHome ? awayComp : homeComp;
        const state = event.status?.type?.state || 'pre';

        let status: TeamMatch['status'] = 'upcoming';
        if (state === 'in') status = 'live';
        else if (state === 'post') status = 'finished';

        const homeScore = homeComp.score ? parseInt(homeComp.score, 10) : null;
        const awayScore = awayComp.score ? parseInt(awayComp.score, 10) : null;

        matches.push({
          id: `espn_${event.id}`,
          opponent: opponent.team.displayName || opponent.team.name || '',
          opponentLogo: opponent.team.logo || opponent.team.logos?.[0]?.href || null,
          homeAway: isHome ? 'home' : 'away',
          date: event.date,
          status,
          homeScore,
          awayScore,
          competition: event.league?.name || competition.type?.group?.name || leagueCode,
        });
      } catch {
        continue;
      }
    }

    return matches;
  } catch (err) {
    console.error('[Team API] Error fetching schedule:', err);
    return [];
  }
}

function computeFormAndStats(schedule: TeamMatch[]): { form: string[]; stats: TeamStats[] } {
  const finished = schedule.filter((m) => m.status === 'finished');
  const last5 = finished.slice(-5);

  const form: string[] = last5.map((m) => {
    const isHome = m.homeAway === 'home';
    const teamGoals = isHome ? m.homeScore : m.awayScore;
    const oppGoals = isHome ? m.awayScore : m.homeScore;
    if (teamGoals == null || oppGoals == null) return 'D';
    if (teamGoals > oppGoals) return 'W';
    if (teamGoals < oppGoals) return 'L';
    return 'D';
  });

  const wins = finished.filter((m) => {
    const isHome = m.homeAway === 'home';
    const tg = isHome ? m.homeScore : m.awayScore;
    const og = isHome ? m.awayScore : m.homeScore;
    return tg != null && og != null && tg > og;
  }).length;

  const draws = finished.filter((m) => {
    const isHome = m.homeAway === 'home';
    const tg = isHome ? m.homeScore : m.awayScore;
    const og = isHome ? m.awayScore : m.homeScore;
    return tg != null && og != null && tg === og;
  }).length;

  const losses = finished.filter((m) => {
    const isHome = m.homeAway === 'home';
    const tg = isHome ? m.homeScore : m.awayScore;
    const og = isHome ? m.awayScore : m.homeScore;
    return tg != null && og != null && tg < og;
  }).length;

  const goalsFor = finished.reduce((sum, m) => {
    const isHome = m.homeAway === 'home';
    return sum + ((isHome ? m.homeScore : m.awayScore) || 0);
  }, 0);

  const goalsAgainst = finished.reduce((sum, m) => {
    const isHome = m.homeAway === 'home';
    return sum + ((isHome ? m.awayScore : m.homeScore) || 0);
  }, 0);

  const stats: TeamStats[] = [
    { label: 'Matchs joués', value: finished.length },
    { label: 'Victoires', value: wins },
    { label: 'Nuls', value: draws },
    { label: 'Défaites', value: losses },
    { label: 'Buts marqués', value: goalsFor },
    { label: 'Buts encaissés', value: goalsAgainst },
    { label: 'Diff. de buts', value: goalsFor - goalsAgainst },
    { label: 'Moy. buts/match', value: finished.length > 0 ? (goalsFor / finished.length).toFixed(2) : '0' },
  ];

  return { form, stats };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { searchParams } = new URL(request.url);
    const leagueCode = searchParams.get('league') || 'eng.1';

    const cacheKey = `${CACHE_PREFIX}-${id}-${leagueCode}`;

    // Check cache
    const cached = getCached<TeamDetailResponse>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    // Fetch team info + roster (from Core API)
    const teamData = await fetchTeamInfo(id, leagueCode);
    if (!teamData) {
      return NextResponse.json(
        { team: null, roster: [], schedule: [], form: [], stats: [], lastUpdated: new Date().toISOString(), error: 'Équipe introuvable' },
        { status: 200 }
      );
    }

    // Fetch schedule (from Site API)
    const schedule = await fetchTeamSchedule(id, leagueCode);

    // Compute form and stats
    const { form, stats } = computeFormAndStats(schedule);

    const response: TeamDetailResponse = {
      team: teamData.info,
      roster: teamData.roster,
      schedule,
      form,
      stats,
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 10 minutes (team data changes infrequently)
    setCache(cacheKey, response);

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Team API] Error:', error);

    const { searchParams } = new URL(request.url);
    const leagueCode = searchParams.get('league') || 'eng.1';
    const cacheKey = `${CACHE_PREFIX}-${id}-${leagueCode}`;
    const stale = getCachedStale<TeamDetailResponse>(cacheKey);
    if (stale) {
      return NextResponse.json({ ...stale, error: 'Données potentiellement anciennes' });
    }

    return NextResponse.json(
      { team: null, roster: [], schedule: [], form: [], stats: [], lastUpdated: new Date().toISOString(), error: 'Impossible de charger les données' },
      { status: 200 }
    );
  }
}
