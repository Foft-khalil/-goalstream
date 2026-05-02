import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';

// ─── Type definitions ─────────────────────────────────────────────────────────
export interface MatchEvent {
  id: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'period_start' | 'period_end' | 'var_review';
  minute: number;
  team: string;
  teamLogo: string | null;
  player: string;
  assistPlayer?: string;
  playerIn?: string;
  detail?: string;
  homeScore: number;
  awayScore: number;
}

// ─── Match Summary types ──────────────────────────────────────────────────────
export interface FootballTeamStat {
  label: string;
  homeValue: string;
  awayValue: string;
  homePercent?: number;
  awayPercent?: number;
}

export interface FootballTopPerformer {
  name: string;
  teamAbbr: string;
  position?: string;
  value: string;
  category: string;
}

export interface FootballMatchSummary {
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeForm: string | null;
  awayForm: string | null;
  teamStats: FootballTeamStat[];
  topPerformers: FootballTopPerformer[];
  venue: string | null;
  attendance: string | null;
  officials: string[];
  matchDate: string | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  homeLineup: TeamLineup | null;
  awayLineup: TeamLineup | null;
}

export interface LineupPlayer {
  id: string;
  name: string;
  shortName: string;
  jersey: string;
  position: string;     // abbreviation: G, D, M, F, etc.
  positionFull: string; // full name: Goalkeeper, Defender, etc.
  formationPlace: number;
  subbedIn: boolean;
  subbedOut: boolean;
}

export interface TeamLineup {
  teamAbbr: string;
  teamName: string;
  formation: string | null;
  starters: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface MatchEventsResponse {
  events: MatchEvent[];
  matchId: string;
  lastUpdated: string;
  summary?: FootballMatchSummary | null;
  error?: string;
}

// ─── ESPN league mapping ──────────────────────────────────────────────────────
const DEFAULT_LEAGUE = 'eng.1';

// ─── ESPN commentary API types ────────────────────────────────────────────────
interface ESPNCommentaryItem {
  id?: string;
  type?: {
    id?: string;
    name?: string;
    text?: string;
  };
  time?: {
    displayValue?: string;
    minute?: number;
  };
  play?: {
    type?: {
      id?: string;
      name?: string;
      text?: string;
    };
    participants?: Array<{
      athlete?: {
        displayName?: string;
        name?: string;
      };
      team?: {
        name?: string;
        abbreviation?: string;
        logo?: string;
      };
      type?: string;
    }>;
    score?: {
      home?: string;
      away?: string;
    };
  };
  team?: {
    name?: string;
    abbreviation?: string;
    logo?: string;
  };
  text?: string;
  scoringPlay?: boolean;
  penalty?: boolean;
  ownGoal?: boolean;
}

interface ESPNCommentary {
  items?: ESPNCommentaryItem[];
}

interface ESPNLineScore {
  value?: number;
  displayValue?: string;
  period?: { number?: number; displayValue?: string; abbreviation?: string };
}

interface ESPNHeaderCompetitor {
  team: {
    id?: string;
    name: string;
    abbreviation?: string;
    logo?: string;
    displayName?: string;
    logos?: Array<{ href?: string }>;
  };
  score?: string;
  homeAway: 'home' | 'away';
  winner?: boolean;
  records?: Array<{ summary?: string; type?: string }>;
  linescores?: ESPNLineScore[];
  statistics?: Array<{ name?: string; label?: string; displayValue?: string; value?: number }>;
}

interface ESPNBoxscoreTeamStat {
  name?: string;
  label?: string;
  displayValue?: string;
  value?: number;
}

interface ESPNBoxscoreTeam {
  team?: {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    logo?: string;
    logos?: Array<{ href?: string }>;
  };
  statistics?: ESPNBoxscoreTeamStat[];
}

interface ESPNFormEntry {
  team?: {
    id?: string;
    displayName?: string;
  };
  form?: string;
}

interface ESPNLeaderAthlete {
  displayValue?: string;
  value?: number;
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    position?: { abbreviation?: string };
    jersey?: string;
  };
}

interface ESPNLeaderCategory {
  name?: string;
  displayName?: string;
  leaders?: ESPNLeaderAthlete[];
}

interface ESPNTeamLeaders {
  team?: {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    logo?: string;
  };
  leaders?: ESPNLeaderCategory[];
}

interface ESPNRosterAthlete {
  id?: string;
  displayName?: string;
  shortName?: string;
  fullName?: string;
}

interface ESPNRosterPlayer {
  active?: boolean;
  starter?: boolean;
  jersey?: string;
  athlete?: ESPNRosterAthlete;
  position?: {
    name?: string;
    displayName?: string;
    abbreviation?: string;
  };
  formationPlace?: string | number;
  subbedIn?: boolean;
  subbedOut?: boolean;
  didNotPlay?: boolean;
}

interface ESPNTeamRoster {
  homeAway?: 'home' | 'away';
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
  };
  formation?: string;
  roster?: ESPNRosterPlayer[];
}

interface ESPNSummary {
  commentary?: ESPNCommentary | ESPNCommentaryItem[];
  header?: {
    id?: string;
    competitors?: ESPNHeaderCompetitor[];
    competitions?: Array<{
      date?: string;
      competitors?: ESPNHeaderCompetitor[];
    }>;
  };
  boxscore?: {
    teams?: ESPNBoxscoreTeam[];
    form?: ESPNFormEntry[];
    [key: string]: unknown;
  };
  leaders?: ESPNTeamLeaders[];
  rosters?: ESPNTeamRoster[];
  gameInfo?: {
    venue?: {
      fullName?: string;
      shortName?: string;
      address?: { city?: string; country?: string };
    };
    attendance?: number | string;
    officials?: Array<{ fullName?: string; displayName?: string }>;
  };
}

// ─── Cache TTL for live match events (10 seconds) ────────────────────────────
function getMatchEventsCache<T>(key: string): T | null {
  return getCached<T>(key, true);
}

// ─── Parse minute from ESPN time display ──────────────────────────────────────
function parseMinute(timeValue: string | number | undefined): number {
  if (typeof timeValue === 'number') return timeValue;
  if (typeof timeValue === 'string') {
    const match = timeValue.match(/^(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

// ─── Map ESPN play type to our event type ─────────────────────────────────────
function mapEventType(item: ESPNCommentaryItem): MatchEvent['type'] | null {
  const typeId = item.play?.type?.id || item.type?.id;
  const typeName = (item.play?.type?.text || item.play?.type?.name || item.type?.text || item.type?.name || '').toLowerCase();

  if (typeId === '39' || typeName.includes('goal') || typeName.includes('but') || item.scoringPlay) {
    return 'goal';
  }
  if (typeId === '43' || typeName.includes('yellow card') || typeName.includes('carton jaune')) {
    return 'yellow_card';
  }
  if (typeId === '44' || typeName.includes('red card') || typeName.includes('carton rouge')) {
    return 'red_card';
  }
  if (typeId === '45' || typeName.includes('substitution') || typeName.includes('remplacement')) {
    return 'substitution';
  }
  if (typeName.includes('var') || typeName.includes('video review') || typeName.includes('révision vidéo')) {
    return 'var_review';
  }
  if (typeName.includes('start') || typeName.includes('début') || typeName.includes('kick off') || typeName.includes('coup d\'envoi')) {
    return 'period_start';
  }
  if (typeName.includes('end') || typeName.includes('fin') || typeName.includes('half time') || typeName.includes('mi-temps') || typeName.includes('full time') || typeName.includes('fin du match')) {
    return 'period_end';
  }

  return null;
}

// ─── Extract player name from participants ────────────────────────────────────
type ESPNPlayParticipants = NonNullable<ESPNCommentaryItem['play']>['participants'];

function extractPlayerName(participants: ESPNPlayParticipants, type?: string): string {
  if (!participants || participants.length === 0) return '';
  const first = participants[0];
  return first.athlete?.displayName || first.athlete?.name || '';
}

function extractAssistPlayer(participants: ESPNPlayParticipants): string | undefined {
  if (!participants || participants.length < 2) return undefined;
  const second = participants[1];
  const name = second.athlete?.displayName || second.athlete?.name || '';
  return name || undefined;
}

function extractSubstitution(subParticipants: ESPNPlayParticipants): { playerOut: string; playerIn: string } {
  let playerOut = '';
  let playerIn = '';
  if (subParticipants) {
    for (const p of subParticipants) {
      const name = p.athlete?.displayName || p.athlete?.name || '';
      if (p.type === 'in' || (p.type && p.type.toLowerCase().includes('in'))) {
        playerIn = name;
      } else {
        playerOut = name || playerOut;
      }
    }
  }
  return { playerOut, playerIn };
}

// ─── Parse ESPN commentary items into MatchEvent array ────────────────────────
function parseCommentaryItems(
  items: ESPNCommentaryItem[],
  homeTeam: ESPNHeaderCompetitor | null,
  awayTeam: ESPNHeaderCompetitor | null,
): MatchEvent[] {
  const events: MatchEvent[] = [];

  const homeTeamName = homeTeam?.team?.displayName || homeTeam?.team?.name || '';
  const awayTeamName = awayTeam?.team?.displayName || awayTeam?.team?.name || '';
  const homeTeamLogo = homeTeam?.team?.logos?.[0]?.href || homeTeam?.team?.logo || null;
  const awayTeamLogo = awayTeam?.team?.logos?.[0]?.href || awayTeam?.team?.logo || null;

  for (const item of items) {
    try {
      const eventType = mapEventType(item);
      if (!eventType) continue;

      const minute = parseMinute(item.time?.displayValue) || parseMinute(item.time?.minute) || 0;

      let team = '';
      let teamLogo: string | null = null;

      const participants = item.play?.participants;
      if (participants && participants.length > 0) {
        const firstTeam = participants[0].team;
        team = firstTeam?.name || '';
        teamLogo = firstTeam?.logo || null;
      }

      if (!team && item.team) {
        team = item.team.name || '';
        teamLogo = item.team.logo || null;
      }

      if (team && homeTeamName && awayTeamName) {
        const teamLower = team.toLowerCase();
        const homeLower = homeTeamName.toLowerCase();
        const awayLower = awayTeamName.toLowerCase();
        if (teamLower.includes(homeLower) || homeLower.includes(teamLower)) {
          team = homeTeamName;
          teamLogo = homeTeamLogo;
        } else if (teamLower.includes(awayLower) || awayLower.includes(teamLower)) {
          team = awayTeamName;
          teamLogo = awayTeamLogo;
        }
      }

      const homeScore = parseInt(item.play?.score?.home || '0', 10) || 0;
      const awayScore = parseInt(item.play?.score?.away || '0', 10) || 0;

      const player = extractPlayerName(participants);

      const event: MatchEvent = {
        id: item.id || `evt-${events.length}-${minute}-${eventType}`,
        type: eventType,
        minute,
        team,
        teamLogo,
        player,
        homeScore,
        awayScore,
      };

      if (eventType === 'goal') {
        const assist = extractAssistPlayer(participants);
        if (assist) event.assistPlayer = assist;
        const detail: string[] = [];
        if (item.ownGoal) detail.push('CSC');
        if (item.penalty) detail.push('Penalty');
        if (item.play?.type?.text && item.play.type.text.toLowerCase().includes('own')) detail.push('CSC');
        if (item.play?.type?.text && item.play.type.text.toLowerCase().includes('penalty')) detail.push('Penalty');
        if (detail.length > 0) event.detail = detail.join(' — ');
      }

      if (eventType === 'substitution') {
        const { playerOut, playerIn: subPlayerIn } = extractSubstitution(participants);
        event.player = playerOut || player;
        if (subPlayerIn) event.playerIn = subPlayerIn;
      }

      if (eventType === 'yellow_card' || eventType === 'red_card' || eventType === 'var_review') {
        const text = item.text || item.play?.type?.text || '';
        if (text) event.detail = text;
      }

      if (eventType === 'period_start' || eventType === 'period_end') {
        const text = item.text || item.play?.type?.text || '';
        if (text) event.detail = text;
      }

      events.push(event);
    } catch {
      // Skip malformed items
    }
  }

  events.sort((a, b) => a.minute - b.minute);
  return events;
}

// ─── Parse match summary from ESPN data ───────────────────────────────────────
function parseMatchSummary(data: ESPNSummary): FootballMatchSummary | null {
  try {
    // Get competitors from header
    const competitors = data.header?.competitions?.[0]?.competitors || data.header?.competitors || [];
    const homeComp = competitors.find(c => c.homeAway === 'home');
    const awayComp = competitors.find(c => c.homeAway === 'away');

    if (!homeComp || !awayComp) return null;

    const homeScore = parseInt(homeComp.score || '0', 10) || 0;
    const awayScore = parseInt(awayComp.score || '0', 10) || 0;
    const homeTeam = homeComp.team?.displayName || homeComp.team?.name || '';
    const awayTeam = awayComp.team?.displayName || awayComp.team?.name || '';
    const homeAbbr = homeComp.team?.abbreviation || '';
    const awayAbbr = awayComp.team?.abbreviation || '';
    const homeLogo = homeComp.team?.logos?.[0]?.href || homeComp.team?.logo || null;
    const awayLogo = awayComp.team?.logos?.[0]?.href || awayComp.team?.logo || null;

    // Half-time scores from linescores
    let halfTimeHome: number | null = null;
    let halfTimeAway: number | null = null;
    const homeLinescores = homeComp.linescores || [];
    const awayLinescores = awayComp.linescores || [];
    if (homeLinescores.length >= 1) {
      halfTimeHome = homeLinescores[0].value ?? null;
    }
    if (awayLinescores.length >= 1) {
      halfTimeAway = awayLinescores[0].value ?? null;
    }

    // Team form
    let homeForm: string | null = null;
    let awayForm: string | null = null;
    const formData = data.boxscore?.form || [];
    if (Array.isArray(formData)) {
      for (const entry of formData) {
        const teamId = String(entry.team?.id || '');
        if (teamId === String(homeComp.team?.id)) homeForm = entry.form || null;
        if (teamId === String(awayComp.team?.id)) awayForm = entry.form || null;
      }
    }

    // Team stats from boxscore.teams
    const teamStats: FootballTeamStat[] = [];
    const boxscoreTeams = data.boxscore?.teams || [];
    const homeBoxTeam = boxscoreTeams.find(t => {
      const teamId = t.team?.id;
      return teamId && String(teamId) === String(homeComp.team?.id);
    });
    const awayBoxTeam = boxscoreTeams.find(t => {
      const teamId = t.team?.id;
      return teamId && String(teamId) === String(awayComp.team?.id);
    });

    if (homeBoxTeam?.statistics && awayBoxTeam?.statistics) {
      // Key stats with French labels
      const statTranslations: Record<string, string> = {
        'possession': 'Possession',
        'shots': 'Tirs',
        'shotsOnTarget': 'Tirs cadrés',
        'shotsOnGoal': 'Tirs cadrés',
        'onGoal': 'Tirs cadrés',
        'cornerKicks': 'Corners',
        'fouls': 'Fautes',
        'yellowCards': 'Cartons jaunes',
        'redCards': 'Cartons rouges',
        'offsides': 'Hors-jeu',
        'saves': 'Arrêts',
        'passes': 'Passes',
        'accuratePasses': 'Passes réussies',
        'passAccuracy': 'Précision passes',
        'totalShots': 'Tirs total',
      };

      const homeStats = homeBoxTeam.statistics;
      const awayStats = awayBoxTeam.statistics;
      const statCount = Math.min(homeStats.length, awayStats.length);

      for (let i = 0; i < statCount; i++) {
        const homeStat = homeStats[i];
        const awayStat = awayStats[i];
        const statName = (homeStat.name || homeStat.label || '').toLowerCase();
        const label = statTranslations[statName] || homeStat.label || homeStat.name || '';

        teamStats.push({
          label,
          homeValue: homeStat.displayValue || '',
          awayValue: awayStat.displayValue || '',
          homePercent: homeStat.value ?? undefined,
          awayPercent: awayStat.value ?? undefined,
        });
      }
    }

    // Top performers from leaders
    const topPerformers: FootballTopPerformer[] = [];
    const leadersData = data.leaders || [];

    for (const teamLeader of leadersData) {
      const teamAbbr = teamLeader.team?.abbreviation || '';
      const categories = teamLeader.leaders || [];

      for (const category of categories) {
        const catName = category.name || '';
        const catDisplay = catName === 'totalShots' ? 'Tirs' :
                          catName === 'accuratePasses' ? 'Passes réussies' :
                          catName === 'saves' ? 'Arrêts' :
                          category.displayName || catName;

        for (const leader of category.leaders || []) {
          const athlete = leader.athlete;
          if (athlete?.displayName && leader.displayValue) {
            topPerformers.push({
              name: athlete.displayName,
              teamAbbr,
              position: athlete.position?.abbreviation,
              value: leader.displayValue,
              category: catName,
            });
          }
        }
      }
    }

    // Lineups from rosters
    let homeLineup: TeamLineup | null = null;
    let awayLineup: TeamLineup | null = null;

    const rostersData = data.rosters || [];
    for (const rosterTeam of rostersData) {
      const isHome = rosterTeam.homeAway === 'home';
      const teamAbbr = rosterTeam.team?.abbreviation || (isHome ? homeAbbr : awayAbbr);
      const teamName = rosterTeam.team?.displayName || (isHome ? homeTeam : awayTeam);
      const formation = rosterTeam.formation || null;

      const starters: LineupPlayer[] = [];
      const substitutes: LineupPlayer[] = [];

      for (const p of rosterTeam.roster || []) {
        const player: LineupPlayer = {
          id: p.athlete?.id || `p-${Math.random().toString(36).slice(2)}`,
          name: p.athlete?.displayName || p.athlete?.fullName || '',
          shortName: p.athlete?.shortName || p.athlete?.displayName?.split(' ').map((n, i, arr) => i === arr.length - 1 ? n : n[0] + '.').join(' ') || '',
          jersey: p.jersey || '',
          position: p.position?.abbreviation || '',
          positionFull: p.position?.displayName || p.position?.name || '',
          formationPlace: typeof p.formationPlace === 'number' ? p.formationPlace : parseInt(String(p.formationPlace || '0'), 10) || 0,
          subbedIn: p.subbedIn || false,
          subbedOut: p.subbedOut || false,
        };

        if (p.starter) {
          starters.push(player);
        } else {
          substitutes.push(player);
        }
      }

      // Sort starters by formationPlace
      starters.sort((a, b) => a.formationPlace - b.formationPlace);

      const lineup: TeamLineup = {
        teamAbbr,
        teamName,
        formation,
        starters,
        substitutes,
      };

      if (isHome) {
        homeLineup = lineup;
      } else {
        awayLineup = lineup;
      }
    }

    // Game info
    const venue = data.gameInfo?.venue?.fullName || null;
    const attendance = data.gameInfo?.attendance ? String(data.gameInfo.attendance) : null;
    const officials = (data.gameInfo?.officials || []).map(o => o.fullName || o.displayName || '').filter(Boolean);
    const matchDate = data.header?.competitions?.[0]?.date || null;

    return {
      homeScore,
      awayScore,
      homeTeam,
      awayTeam,
      homeAbbr,
      awayAbbr,
      homeLogo,
      awayLogo,
      homeForm,
      awayForm,
      teamStats,
      topPerformers,
      venue,
      attendance,
      officials,
      matchDate,
      halfTimeHome,
      halfTimeAway,
      homeLineup,
      awayLineup,
    };
  } catch (err) {
    console.error('[Match Events API] Error parsing match summary:', err);
    return null;
  }
}

// ─── Fetch match events from ESPN API ─────────────────────────────────────────
async function fetchMatchEvents(eventId: string, league: string): Promise<MatchEventsResponse> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`;

  console.log(`[Match Events API] Fetching from ESPN: ${url}`);

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`ESPN API returned ${res.status}`);
  }

  const data: ESPNSummary = await res.json();

  // Extract team info from header
  const competitors = data.header?.competitions?.[0]?.competitors || data.header?.competitors || [];
  const homeTeam = competitors.find(c => c.homeAway === 'home') || null;
  const awayTeam = competitors.find(c => c.homeAway === 'away') || null;

  // Extract commentary items — handle both array and object format
  let commentaryItems: ESPNCommentaryItem[] = [];
  if (Array.isArray(data.commentary)) {
    commentaryItems = data.commentary;
  } else if (data.commentary?.items) {
    commentaryItems = data.commentary.items;
  }

  // Parse into our event format
  const events = parseCommentaryItems(commentaryItems, homeTeam, awayTeam);

  // Parse match summary
  const summary = parseMatchSummary(data);

  console.log(`[Match Events API] Parsed ${events.length} events, summary: ${summary ? 'yes' : 'no'}`);

  return {
    events,
    matchId: `espn_${eventId}`,
    lastUpdated: new Date().toISOString(),
    summary,
  };
}

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const matchId = searchParams.get('matchId');
    if (!matchId) {
      return NextResponse.json(
        {
          events: [],
          matchId: '',
          lastUpdated: new Date().toISOString(),
          summary: null,
          error: 'Paramètre matchId manquant',
        },
        { status: 400 }
      );
    }

    const league = searchParams.get('league') || DEFAULT_LEAGUE;

    // Strip "espn_" prefix if present
    const eventId = matchId.startsWith('espn_') ? matchId.slice(5) : matchId;

    const cacheKey = `match-events-${eventId}`;

    // Check cache first
    const cached = getMatchEventsCache<MatchEventsResponse>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      console.log(`[Match Events API] Returning cached events for ${eventId} (age: ${age}s, ${cached.events.length} events)`);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    console.log(`[Match Events API] Cache miss, fetching from ESPN for event: ${eventId}, league: ${league}`);

    // Fetch from ESPN
    const result = await fetchMatchEvents(eventId, league);

    // Cache the result
    setCache(cacheKey, result);

    console.log(`[Match Events API] Returning ${result.events.length} events for event ${eventId}`);
    return NextResponse.json(result, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Match Events API] Error fetching match events:', error);

    const matchId = request.nextUrl.searchParams.get('matchId') || '';
    const eventId = matchId.startsWith('espn_') ? matchId.slice(5) : matchId;

    // Try stale cache
    const cacheKey = `match-events-${eventId}`;
    const stale = getCachedStale<MatchEventsResponse>(cacheKey);
    if (stale) {
      console.log('[Match Events API] Returning stale cache due to error');
      return NextResponse.json(
        { ...stale, error: 'Les données peuvent être anciennes' },
        { headers: { 'X-Cache': 'STALE' }, status: 200 }
      );
    }

    // Return empty events with error — always 200 to prevent client crashes
    const errorResponse: MatchEventsResponse = {
      events: [],
      matchId,
      lastUpdated: new Date().toISOString(),
      summary: null,
      error: 'Impossible de charger les événements du match',
    };

    return NextResponse.json(errorResponse, { status: 200 });
  }
}
