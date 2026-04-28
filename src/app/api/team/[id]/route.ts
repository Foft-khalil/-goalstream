import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';
import ZAI from 'z-ai-web-dev-sdk';

const CACHE_PREFIX = 'team-detail';

const LEAGUE_NAMES: Record<string, string> = {
  'fra.1': 'Ligue 1',
  'eng.1': 'Premier League',
  'esp.1': 'La Liga',
  'ita.1': 'Serie A',
  'ger.1': 'Bundesliga',
  'por.1': 'Liga Portugal',
  'ned.1': 'Eredivisie',
};

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

/**
 * Get current season year for a league.
 * European football seasons span Aug-May, so from Jan-Jul the "current" season
 * started the previous year (e.g., Jan 2026 → season 2025-2026 → use 2025).
 */
function getCurrentSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // Jan-Jul: season started previous year; Aug-Dec: season started this year
  return month < 7 ? now.getFullYear() - 1 : now.getFullYear();
}

async function fetchJSON(url: string, timeout = 8000): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Parse score value from ESPN Site API format.
 * The Site API returns score as either:
 * - A simple string/number (older format)
 * - An object with { value: number, displayValue: string, ... } (current format)
 */
function parseScore(scoreData: any): number | null {
  if (scoreData == null) return null;
  if (typeof scoreData === 'number') return scoreData;
  if (typeof scoreData === 'string') {
    const parsed = parseInt(scoreData, 10);
    return isNaN(parsed) ? null : parsed;
  }
  if (typeof scoreData === 'object') {
    // Object format: { value: 0.0, displayValue: '0', ... }
    if (typeof scoreData.value === 'number') return Math.round(scoreData.value);
    if (typeof scoreData.displayValue === 'string') {
      const parsed = parseInt(scoreData.displayValue, 10);
      return isNaN(parsed) ? null : parsed;
    }
  }
  return null;
}

/**
 * Determine match status based on date.
 * ESPN Site API schedule returns status=null for all events,
 * so we determine status by comparing the match date to now.
 */
function determineMatchStatus(matchDate: string): 'upcoming' | 'live' | 'finished' {
  const matchTime = new Date(matchDate).getTime();
  const now = Date.now();

  // A football match lasts about 2 hours, add buffer
  const MATCH_DURATION = 3 * 60 * 60 * 1000; // 3 hours
  const PRE_MATCH = 30 * 60 * 1000; // 30 min before

  if (matchTime - PRE_MATCH > now) return 'upcoming';
  if (matchTime + MATCH_DURATION < now) return 'finished';
  return 'live';
}

async function fetchTeamInfo(
  teamId: string,
  leagueCode: string
): Promise<{ info: TeamInfo; roster: Player[] } | null> {
  try {
    const seasonYear = getCurrentSeasonYear();

    // Use ESPN Core API for team basic info
    const data = await fetchJSON(
      `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${leagueCode}/teams/${teamId}`
    );

    const info: TeamInfo = {
      id: String(data.id || teamId),
      name: data.displayName || data.name || '',
      shortName: data.shortDisplayName || data.abbreviation || '',
      abbreviation: data.abbreviation || '',
      logo: data.logos?.[0]?.href || null,
      color: data.color || null,
      venue: null,
      coach: null,
      founded: data.founded || null,
      leagueCode,
      leagueName: LEAGUE_NAMES[leagueCode] || leagueCode,
    };

    // Extract venue (inline data)
    if (data.venue && typeof data.venue === 'object') {
      const parts: string[] = [];
      if (data.venue.fullName) parts.push(data.venue.fullName);
      if (data.venue.address?.city) parts.push(data.venue.address.city);
      info.venue = parts.join(', ') || null;
    }

    // Fetch coach using web search (ESPN Core API coach data is unreliable/outdated)
    // Run this in parallel with roster fetching below
    const coachPromise = (async (): Promise<string | null> => {
      try {
        const sdk = await ZAI.create();
        const results = await sdk.functions.invoke('web_search', {
          query: `${info.name} current coach manager 2025-2026`,
          num: 3,
          recency_days: 90,
        });
        if (results && results.length > 0) {
          // Use LLM to extract the coach name from search snippets
          const snippets = results.map((r: any) => r.snippet).join('\n');
          const chatResponse = await sdk.chat.completions.create({
            messages: [
              {
                role: 'system',
                content: 'You are a football data extractor. Extract ONLY the current head coach/manager name from the search results. Return ONLY the full name, nothing else. If you cannot determine the coach, return "Unknown".',
              },
              {
                role: 'user',
                content: `Team: ${info.name}\nLeague: ${info.leagueName}\nSearch results:\n${snippets}`,
              },
            ],
          });
          const coachName = chatResponse?.choices?.[0]?.message?.content?.trim();
          if (coachName && coachName !== 'Unknown' && coachName.length > 2 && coachName.length < 60) {
            return coachName;
          }
        }
      } catch (err) {
        console.warn('[Team API] Web search coach failed:', err);
      }
      return null;
    })();

    // Fetch roster from season-specific athletes endpoint
    const roster: Player[] = [];
    try {
      const athletesUrl = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${leagueCode}/seasons/${seasonYear}/teams/${teamId}/athletes`;
      const athletesData = await fetchJSON(athletesUrl);
      const athleteItems = athletesData.items || [];

      // Fetch athletes in parallel (max 30, with short timeout)
      const fetches = athleteItems.slice(0, 30).map(async (item: any) => {
        try {
          const a = item.$ref ? await fetchJSON(item.$ref, 4000) : item;
          return {
            id: String(a.id || ''),
            name: a.displayName || a.name || '',
            position: a.position?.abbreviation || a.position?.displayName || '',
            number: a.jersey ? parseInt(a.jersey, 10) : null,
            age: a.age || null,
            nationality: a.nationality || a.birthPlace?.country || null,
            image: a.headshot?.href || null,
          } as Player;
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
    } catch (err) {
      console.warn('[Team API] Failed to fetch roster:', err);
    }

    // Await coach result (ran in parallel with roster)
    const coachResult = await coachPromise;
    if (coachResult) info.coach = coachResult;

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
    const now = Date.now();
    const matches: TeamMatch[] = [];

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

        // Determine status from date (ESPN Site API returns status=null)
        const status = determineMatchStatus(matchDate);

        // Parse scores from the object format
        const rawHomeScore = parseScore(homeComp.score);
        const rawAwayScore = parseScore(awayComp.score);

        // Only show scores for past/live matches; hide scores for upcoming
        // (ESPN pre-populates scores for future matches which are projections)
        let homeScore: number | null = null;
        let awayScore: number | null = null;

        if (status === 'finished' || status === 'live') {
          homeScore = rawHomeScore;
          awayScore = rawAwayScore;
        }

        // Get competition name
        const competitionName =
          event.league?.name ||
          competition.type?.group?.name ||
          competition.competitionType?.name ||
          '';

        matches.push({
          id: `espn_${event.id}`,
          opponent: opponent.team.displayName || opponent.team.name || '',
          opponentLogo: opponent.team.logo || opponent.team.logos?.[0]?.href || null,
          homeAway: isHome ? 'home' : 'away',
          date: matchDate,
          status,
          homeScore,
          awayScore,
          competition: competitionName,
        });
      } catch {
        continue;
      }
    }

    // Sort by date ascending
    matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return matches;
  } catch (err) {
    console.error('[Team API] Error fetching schedule:', err);
    return [];
  }
}

function computeFormAndStats(schedule: TeamMatch[]): { form: string[]; stats: TeamStats[] } {
  const finished = schedule.filter((m) => m.status === 'finished');
  // Take last 5 finished matches for form
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
    {
      label: 'Moy. buts/match',
      value: finished.length > 0 ? (goalsFor / finished.length).toFixed(2) : '0',
    },
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

    // Fetch team info + roster (from Core API) and schedule (from Site API) in parallel
    const [teamData, schedule] = await Promise.all([
      fetchTeamInfo(id, leagueCode),
      fetchTeamSchedule(id, leagueCode),
    ]);

    if (!teamData) {
      return NextResponse.json(
        {
          team: null,
          roster: [],
          schedule,
          form: [],
          stats: [],
          lastUpdated: new Date().toISOString(),
          error: 'Équipe introuvable',
        },
        { status: 200 }
      );
    }

    // Compute form and stats from schedule
    const { form, stats } = computeFormAndStats(schedule);

    const response: TeamDetailResponse = {
      team: teamData.info,
      roster: teamData.roster,
      schedule,
      form,
      stats,
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 5 minutes
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
      {
        team: null,
        roster: [],
        schedule: [],
        form: [],
        stats: [],
        lastUpdated: new Date().toISOString(),
        error: 'Impossible de charger les données',
      },
      { status: 200 }
    );
  }
}
