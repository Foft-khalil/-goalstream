import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TrackerEvent {
  minute: number;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'penalty' | 'own_goal' | 'var' | 'half_start' | 'half_end';
  team: 'home' | 'away';
  player: string;
  assistBy?: string;
  substitutedPlayer?: string;
  detail?: string;
}

interface TrackerStat {
  name: string;
  home: string;
  away: string;
}

interface TrackerLineupPlayer {
  name: string;
  position?: string;
  number?: number;
}

interface TrackerLineup {
  home: TrackerLineupPlayer[];
  away: TrackerLineupPlayer[];
}

interface MatchTrackerData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number;
  awayScore: number;
  status: 'live' | 'upcoming' | 'finished';
  minute: number | null;
  displayClock: string | null;
  period: number | null;
  competition: string | null;
  events: TrackerEvent[];
  stats: TrackerStat[];
  lineups: TrackerLineup;
  lastUpdated: string;
}

interface MatchTrackerResponse {
  match: MatchTrackerData | null;
  lastUpdated: string;
  source: string;
  error?: string;
}

const CACHE_KEY_PREFIX = 'match-tracker';

// ─── ESPN API types (matching actual ESPN summary response) ─────────────────
interface ESPNCommentaryItem {
  sequence?: number;
  time?: { value?: number; displayValue?: string };
  text?: string;
  play?: {
    id?: string;
    type?: { id?: string; text?: string; type?: string };
    text?: string;
    shortText?: string;
    period?: { number?: number; displayValue?: string };
    clock?: { value?: number; displayValue?: string };
    team?: { id?: string; displayName?: string; abbreviation?: string; logo?: string };
    participants?: Array<{
      athlete?: { displayName?: string; position?: { abbreviation?: string }; id?: string };
      type?: string;
    }>;
    scoringPlay?: boolean;
    scoreValue?: number;
    awayScore?: number;
    homeScore?: number;
    yellowCard?: boolean;
    redCard?: boolean;
    substitution?: boolean;
    penaltyKick?: boolean;
    ownGoal?: boolean;
    review?: boolean;
  };
}

// Basketball plays have a slightly different structure
interface ESPNBasketballPlay {
  id?: string;
  sequenceNumber?: string;
  type?: { id?: string; text?: string };
  text?: string;
  period?: { number?: number; displayValue?: string };
  clock?: { value?: number; displayValue?: string };
  team?: { id?: string; displayName?: string };
  participants?: Array<{
    athlete?: { displayName?: string; id?: string };
  }>;
  scoringPlay?: boolean;
  scoreValue?: number;
  awayScore?: number;
  homeScore?: number;
}

interface ESPNSummaryResponse {
  header?: {
    competitions?: Array<{
      id?: string;
      competitors?: Array<{
        team: { id?: string; displayName?: string; abbreviation?: string; logo?: string; color?: string; shortDisplayName?: string };
        homeAway: 'home' | 'away';
        score?: string;
        records?: Array<{ summary?: string }>;
        winner?: boolean;
      }>;
      status?: {
        type: { name: string; state: string; description: string };
        displayClock?: string;
        period?: number;
      };
      date?: string;
    }>;
    league?: { name?: string; abbreviation?: string };
    season?: { year?: number; slug?: string };
    event?: { id?: string; name?: string; date?: string };
  };
  commentary?: Array<ESPNCommentaryItem>;
  plays?: Array<ESPNBasketballPlay>;
  boxscore?: {
    teams?: Array<{
      team?: { id?: string; abbreviation?: string; displayName?: string };
      statistics?: Array<{
        name?: string;
        label?: string;
        homeValue?: string;
        awayValue?: string;
      }>;
      lineup?: Array<{
        athlete?: { displayName?: string; position?: { abbreviation?: string }; jersey?: string };
        position?: { abbreviation?: string };
        formationPlace?: number;
        starter?: boolean;
      }>;
    }>;
  };
  statistics?: Array<{
    name?: string;
    label?: string;
    homeValue?: string;
    awayValue?: string;
  }>;
}

// ─── ESPN play type IDs (football/soccer) ───────────────────────────────────
const PLAY_TYPE_GOAL = '70';
const PLAY_TYPE_YELLOW_CARD = '94';
const PLAY_TYPE_RED_CARD = '93';
const PLAY_TYPE_SUBSTITUTION = '76';
const PLAY_TYPE_VAR_CANCELLED = '172';
const PLAY_TYPE_DELETED_REVIEW = '175';
const PLAY_TYPE_END_REGULAR = '83';
const PLAY_TYPE_START_PERIOD = '84';

// ─── ESPN play type IDs (basketball) ────────────────────────────────────────
const BBALL_PLAY_SUBSTITUTION = '584';
const BBALL_PLAY_TECHNICAL_FOUL = '35';
const BBALL_PLAY_FLAGRANT_FOUL = '29';
const BBALL_PLAY_END_PERIOD = '412';
const BBALL_PLAY_END_GAME = '402';
const BBALL_PLAY_JUMPBALL = '615';
const BBALL_PLAY_TIMEOUT = '16';

// ─── Match ID to ESPN sport/league mapping ──────────────────────────────────
function parseMatchId(matchId: string): { espnId: string; sport: 'soccer' | 'basketball' } {
  if (matchId.startsWith('espn_bball_')) {
    return { espnId: matchId.replace('espn_bball_', ''), sport: 'basketball' };
  }
  if (matchId.startsWith('espn_')) {
    return { espnId: matchId.replace('espn_', ''), sport: 'soccer' };
  }
  return { espnId: matchId, sport: 'soccer' };
}

// ─── ESPN league codes for building the summary URL ─────────────────────────
const FOOTBALL_LEAGUE_PATHS = [
  'eng.1', 'fra.1', 'esp.1', 'ita.1', 'ger.1',
  'uefa.champions', 'uefa.europa', 'uefa.europa.conf',
  'por.1', 'ned.1', 'tur.1', 'bra.1', 'arg.1', 'mex.1',
  'usa.1', 'ksa.1', 'afc.champions', 'caf.champions',
  'conmebol.libertadores', 'conmebol.sudamericana', 'concacaf.champions',
  'fifa.world', 'uefa.euro', 'uefa.nations',
  'caf.nations', 'afc.asian.cup', 'concacaf.gold', 'fifa.friendly',
];

const BASKETBALL_LEAGUE_PATHS = [
  'nba', 'wnba', 'mens-college-basketball', 'womens-college-basketball',
];

/**
 * Try fetching ESPN summary data. We try multiple league paths since
 * we might not know the exact league from the match ID alone.
 */
async function fetchESPNSummary(
  espnId: string,
  sport: 'soccer' | 'basketball'
): Promise<ESPNSummaryResponse | null> {
  const leaguePaths = sport === 'basketball' ? BASKETBALL_LEAGUE_PATHS : FOOTBALL_LEAGUE_PATHS;

  // Try each league path in parallel batches
  const batchSize = 6;
  for (let i = 0; i < leaguePaths.length; i += batchSize) {
    const batch = leaguePaths.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (league) => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${espnId}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Check if we got meaningful data
        if (data.header?.competitions || data.commentary || data.boxscore) {
          return data as ESPNSummaryResponse;
        }
        throw new Error('Empty response');
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }
  }

  return null;
}

/**
 * Parse minute from ESPN clock displayValue like "2'", "45'+2'", "90:00"
 */
function parseMinuteFromClock(displayValue: string | undefined, period: number | undefined): number {
  if (!displayValue) return 0;
  // Remove the ' character and parse
  const cleaned = displayValue.replace(/'/g, '').replace(/\+/g, ':').trim();
  const parts = cleaned.split(':');
  if (parts.length >= 1) {
    let min = parseInt(parts[0], 10);
    if (!isNaN(min) && period && period > 1) {
      min += 45 * (period - 1);
    }
    return isNaN(min) ? 0 : min;
  }
  return 0;
}

// ─── Parse ESPN summary into our tracker format ────────────────────────────
function parseESPNSummary(data: ESPNSummaryResponse, matchId: string): MatchTrackerData {
  const competition = data.header?.competitions?.[0];
  const homeComp = competition?.competitors?.find(c => c.homeAway === 'home');
  const awayComp = competition?.competitors?.find(c => c.homeAway === 'away');

  const homeTeam = homeComp?.team?.displayName || 'Home';
  const awayTeam = awayComp?.team?.displayName || 'Away';
  const homeLogo = homeComp?.team?.logo || null;
  const awayLogo = awayComp?.team?.logo || null;
  const homeScore = homeComp?.score ? parseInt(homeComp.score, 10) : 0;
  const awayScore = awayComp?.score ? parseInt(awayComp.score, 10) : 0;

  // Status
  const state = competition?.status?.type?.state;
  let status: MatchTrackerData['status'] = 'upcoming';
  if (state === 'in') status = 'live';
  else if (state === 'post') status = 'finished';

  // Period & clock
  const displayClock = competition?.status?.displayClock || null;
  const period = competition?.status?.period || null;

  let minute: number | null = null;
  if (displayClock && status === 'live') {
    const parts = displayClock.split(':');
    if (parts.length === 2) {
      minute = parseInt(parts[0], 10);
      if (period && period > 1) {
        minute += 45 * (period - 1);
      }
    }
  }

  const competitionName = data.header?.league?.name || null;

  // ─── Build team name → side mapping ─────────────────────────────────────
  const homeTeamDisplayName = homeComp?.team?.displayName || '';
  const awayTeamDisplayName = awayComp?.team?.displayName || '';
  const homeTeamId = homeComp?.team?.id;
  const awayTeamId = awayComp?.team?.id;

  // ─── Determine sport type ───────────────────────────────────────────────
  const isBasketball = matchId.startsWith('espn_bball_');

  // ─── Parse events ───────────────────────────────────────────────────────
  const events: TrackerEvent[] = [];

  if (isBasketball && data.plays) {
    // ─── Basketball events from data.plays ───────────────────────────────
    parseBasketballPlays(data.plays, events, homeTeamId, awayTeamId, homeTeamDisplayName, awayTeamDisplayName);
  } else if (data.commentary) {
    // ─── Football events from data.commentary ────────────────────────────
    parseFootballCommentary(data.commentary, events, homeTeamDisplayName, awayTeamDisplayName);
  }

  // Sort events by minute
  events.sort((a, b) => a.minute - b.minute);

  // ─── Parse stats ────────────────────────────────────────────────────────
  const stats: TrackerStat[] = [];

  if (data.boxscore?.teams) {
    const homeTeamBox = data.boxscore.teams.find(t => t.team?.id === homeTeamId);
    const awayTeamBox = data.boxscore.teams.find(t => t.team?.id === awayTeamId);

    if (isBasketball && homeTeamBox?.statistics && awayTeamBox?.statistics) {
      // Basketball stats format: each team has its own stats array
      // Stats are paired by index between home and away teams
      const homeStats = homeTeamBox.statistics;
      const awayStats = awayTeamBox.statistics;
      for (let i = 0; i < homeStats.length; i++) {
        const hStat = homeStats[i];
        const aStat = awayStats[i];
        if (hStat.label || aStat?.label) {
          stats.push({
            name: hStat.label || aStat?.label || '',
            home: hStat.displayValue || hStat.homeValue || '0',
            away: aStat?.displayValue || aStat?.awayValue || '0',
          });
        }
      }
    } else if (homeTeamBox?.statistics) {
      // Football stats format: homeValue/awayValue in each stat
      for (const stat of homeTeamBox.statistics) {
        if (stat.label) {
          const awayVal = awayTeamBox?.statistics?.find(s => s.name === stat.name)?.awayValue || '0';
          stats.push({
            name: stat.label,
            home: stat.homeValue || '0',
            away: awayVal,
          });
        }
      }
    }
  }

  if (stats.length === 0 && data.statistics) {
    for (const stat of data.statistics) {
      if (stat.label) {
        stats.push({
          name: stat.label,
          home: stat.homeValue || '0',
          away: stat.awayValue || '0',
        });
      }
    }
  }

  // ─── Parse lineups ──────────────────────────────────────────────────────
  const lineups: TrackerLineup = { home: [], away: [] };

  if (data.boxscore?.teams) {
    for (const teamData of data.boxscore.teams) {
      const isHome = teamData.team?.id === homeTeamId;
      const side = isHome ? 'home' : 'away';

      if (teamData.lineup && teamData.lineup.length > 0) {
        lineups[side] = teamData.lineup.map(p => ({
          name: p.athlete?.displayName || 'Unknown',
          position: p.athlete?.position?.abbreviation || p.position?.abbreviation || undefined,
          number: p.athlete?.jersey ? parseInt(p.athlete.jersey, 10) : undefined,
        }));
      }
    }
  }

  return {
    id: matchId,
    homeTeam,
    awayTeam,
    homeLogo,
    awayLogo,
    homeScore,
    awayScore,
    status,
    minute,
    displayClock,
    period,
    competition: competitionName,
    events,
    stats,
    lineups,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Parse football commentary ──────────────────────────────────────────────
function parseFootballCommentary(
  commentary: ESPNCommentaryItem[],
  events: TrackerEvent[],
  homeTeamDisplayName: string,
  awayTeamDisplayName: string,
): void {
  for (const item of commentary) {
    const play = item.play;
    if (!play) continue;

    const typeId = play.type?.id || '';
    const typeText = play.type?.text || '';
    const playPeriod = play.period?.number;
    const playClock = play.clock?.displayValue;

    // Determine team side
    const playTeam = play.team?.displayName || '';
    let teamSide: 'home' | 'away' = 'home';
    if (playTeam && awayTeamDisplayName && playTeam.toLowerCase() === awayTeamDisplayName.toLowerCase()) {
      teamSide = 'away';
    } else if (playTeam && homeTeamDisplayName && playTeam.toLowerCase() === homeTeamDisplayName.toLowerCase()) {
      teamSide = 'home';
    } else if (playTeam) {
      if (awayTeamDisplayName.toLowerCase().includes(playTeam.toLowerCase()) || playTeam.toLowerCase().includes(awayTeamDisplayName.toLowerCase())) {
        teamSide = 'away';
      }
    }

    const playMinute = parseMinuteFromClock(playClock, playPeriod);
    const participants = play.participants || [];
    const firstAthlete = participants[0]?.athlete?.displayName || '';
    const secondAthlete = participants[1]?.athlete?.displayName || '';

    if (typeId === PLAY_TYPE_GOAL) {
      const playText = (play.text || item.text || '').toLowerCase();
      const isPenalty = playText.includes('penalty') || playText.includes('penalti');
      const isOwnGoal = playText.includes('own goal') || playText.includes('csc') || playText.includes('contre son camp');

      events.push({
        minute: playMinute,
        type: isOwnGoal ? 'own_goal' : isPenalty ? 'penalty' : 'goal',
        team: teamSide,
        player: firstAthlete || extractPlayerFromText(play.text || item.text || ''),
        assistBy: secondAthlete || undefined,
        detail: isOwnGoal ? 'CSC' : isPenalty ? 'Penalty' : undefined,
      });
    } else if (typeId === PLAY_TYPE_YELLOW_CARD) {
      events.push({
        minute: playMinute,
        type: 'yellow_card',
        team: teamSide,
        player: firstAthlete || extractPlayerFromText(play.text || item.text || ''),
      });
    } else if (typeId === PLAY_TYPE_RED_CARD) {
      events.push({
        minute: playMinute,
        type: 'red_card',
        team: teamSide,
        player: firstAthlete || extractPlayerFromText(play.text || item.text || ''),
      });
    } else if (typeId === PLAY_TYPE_SUBSTITUTION) {
      events.push({
        minute: playMinute,
        type: 'substitution',
        team: teamSide,
        player: firstAthlete || extractPlayerFromText(play.text || item.text || ''),
        substitutedPlayer: secondAthlete || undefined,
        detail: firstAthlete && secondAthlete ? `${firstAthlete} \u21C4 ${secondAthlete}` : undefined,
      });
    } else if (typeId === PLAY_TYPE_VAR_CANCELLED) {
      events.push({
        minute: playMinute,
        type: 'var',
        team: teamSide,
        player: firstAthlete,
        detail: play.shortText || play.text || item.text || 'VAR - Décision annulée',
      });
    } else if (typeId === PLAY_TYPE_DELETED_REVIEW) {
      events.push({
        minute: playMinute,
        type: 'var',
        team: teamSide,
        player: firstAthlete,
        detail: play.shortText || play.text || item.text || 'But annulé par VAR',
      });
    } else if (typeId === PLAY_TYPE_END_REGULAR) {
      events.push({
        minute: playMinute,
        type: 'half_end',
        team: teamSide,
        player: '',
        detail: typeText || 'Fin de période',
      });
    } else if (typeId === PLAY_TYPE_START_PERIOD) {
      events.push({
        minute: playMinute,
        type: 'half_start',
        team: teamSide,
        player: '',
        detail: typeText || 'Début de période',
      });
    }
  }
}

// ─── Parse basketball plays ─────────────────────────────────────────────────
function parseBasketballPlays(
  plays: ESPNBasketballPlay[],
  events: TrackerEvent[],
  homeTeamId: string | undefined,
  awayTeamId: string | undefined,
  homeTeamDisplayName: string,
  awayTeamDisplayName: string,
): void {
  for (const play of plays) {
    const typeId = play.type?.id || '';
    const playPeriod = play.period?.number;
    const playClock = play.clock?.displayValue;

    // Determine team side
    const playTeamId = play.team?.id;
    let teamSide: 'home' | 'away' = 'home';
    if (playTeamId === awayTeamId) {
      teamSide = 'away';
    }

    // Calculate a "minute" for basketball (we'll use period + clock as the minute)
    // For basketball, we'll use a synthetic minute: period * 12 + (720 - seconds) / 60
    // But for simplicity, we'll just use the clock display value
    const playMinute = parseBasketballMinute(playClock, playPeriod);

    const firstAthlete = play.participants?.[0]?.athlete?.displayName || '';
    const playText = play.text || '';

    // Substitution
    if (typeId === BBALL_PLAY_SUBSTITUTION) {
      const secondAthlete = play.participants?.[1]?.athlete?.displayName || '';
      // Extract player names from text as fallback (ESPN basketball doesn't always include displayName)
      const extractedPlayers = extractBasketballSubNames(playText);
      const player1 = firstAthlete || extractedPlayers[0] || '';
      const player2 = secondAthlete || extractedPlayers[1] || '';
      events.push({
        minute: playMinute,
        type: 'substitution',
        team: teamSide,
        player: player1,
        substitutedPlayer: player2 || undefined,
        detail: player1 && player2 ? `${player1} \u21C4 ${player2}` : undefined,
      });
    }
    // Technical foul → yellow card equivalent
    else if (typeId === BBALL_PLAY_TECHNICAL_FOUL) {
      events.push({
        minute: playMinute,
        type: 'yellow_card',
        team: teamSide,
        player: firstAthlete || extractBasketballPlayerName(playText),
        detail: 'Technical Foul',
      });
    }
    // Flagrant foul → red card equivalent
    else if (typeId === BBALL_PLAY_FLAGRANT_FOUL) {
      events.push({
        minute: playMinute,
        type: 'red_card',
        team: teamSide,
        player: firstAthlete || extractBasketballPlayerName(playText),
        detail: 'Flagrant Foul',
      });
    }
    // Scoring plays (3-pointers and dunks only - to avoid overwhelming the timeline)
    else if (play.scoringPlay && play.scoreValue === 3) {
      events.push({
        minute: playMinute,
        type: 'goal',
        team: teamSide,
        player: firstAthlete || extractBasketballPlayerName(playText),
        detail: '3-pointer',
      });
    }
    // End of period
    else if (typeId === BBALL_PLAY_END_PERIOD) {
      events.push({
        minute: playMinute,
        type: 'half_end',
        team: 'home',
        player: '',
        detail: play.period?.displayValue || `Fin Q${playPeriod}`,
      });
    }
    // Start of game (jumpball)
    else if (typeId === BBALL_PLAY_JUMPBALL && playPeriod === 1) {
      events.push({
        minute: 0,
        type: 'half_start',
        team: 'home',
        player: '',
        detail: 'Début du match',
      });
    }
  }
}

/**
 * Parse basketball minute from clock and period.
 * For display purposes, we'll use Q + clock format.
 * Returns a synthetic minute number for sorting (period * 720 + elapsed_seconds).
 */
function parseBasketballMinute(clockDisplay: string | undefined, period: number | undefined): number {
  if (!clockDisplay || !period) return 0;
  // Clock format: "12:00" (minutes:seconds remaining in quarter)
  const parts = clockDisplay.split(':');
  if (parts.length === 2) {
    const minsRemaining = parseInt(parts[0], 10) || 0;
    const secsRemaining = parseInt(parts[1], 10) || 0;
    const totalSecsRemaining = minsRemaining * 60 + secsRemaining;
    const quarterLength = 720; // 12 minutes * 60 seconds
    const elapsed = quarterLength - totalSecsRemaining;
    // Return period-based minute for sorting (e.g., Q1=0-11, Q2=12-23, etc.)
    return (period - 1) * 12 + Math.floor(elapsed / 60);
  }
  return (period - 1) * 12;
}

/**
 * Extract player name from text like "Goal! Aston Villa 1, Chelsea 0. Douglas Luiz (Aston Villa)..."
 * or "Matty Cash (Aston Villa) is shown the yellow card..."
 */
function extractPlayerFromText(text: string): string {
  if (!text) return '';
  // Pattern: "Player Name (Team Name)" - extract the player name before parentheses
  const match = text.match(/^([A-ZÀ-Ö][a-zà-ö]+(?:\s+[A-ZÀ-Ö][a-zà-ö]+)*)\s*\(/);
  if (match) return match[1];
  // Pattern after "Goal!" - "Goal! Team X, Team Y. Player Name (Team)..."
  const goalMatch = text.match(/\.\s+([A-ZÀ-Ö][a-zà-ö]+(?:\s+[A-ZÀ-Ö][a-zà-ö]+)*)\s*\(/);
  if (goalMatch) return goalMatch[1];
  // Pattern: "Substitution, Team. Player1 replaces Player2..."
  const subMatch = text.match(/Substitution,.*?\.\s+([A-ZÀ-Ö][a-zà-ö]+(?:\s+[A-ZÀ-Ö][a-zà-ö]+)*)\s/);
  if (subMatch) return subMatch[1];
  return '';
}

/**
 * Extract player name from basketball play text like:
 * "OG Anunoby makes 25-foot three point jumper (Jalen Brunson assists)"
 * "Jalen Brunson makes driving layup"
 */
function extractBasketballPlayerName(text: string): string {
  if (!text) return '';
  // Pattern: "Player Name makes/misses..."
  const match = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)*)\s+(?:makes|misses|is|receives|called|shoots|hits|throws)/);
  if (match) return match[1];
  return '';
}

/**
 * Extract player names from basketball substitution text like:
 * "Isaiah Hartenstein replaces Mitchell Robinson"
 * "Substitution: Player1 replaces Player2"
 */
function extractBasketballSubNames(text: string): [string, string] {
  if (!text) return ['', ''];
  // Pattern: "Player1 replaces Player2"
  const match = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)*)\s+replaces\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)*)/);
  if (match) return [match[1], match[2]];
  return ['', ''];
}

// ─── GET handler ────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const cacheKey = `${CACHE_KEY_PREFIX}-${id}`;

    // Check cache first - short TTL for live matches
    const cached = getCached<MatchTrackerResponse>(cacheKey);
    if (cached && cached.match) {
      const age = getCacheAge(cacheKey);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    const { espnId, sport } = parseMatchId(id);

    console.log(`[Match Tracker API] Fetching ESPN summary for ${espnId} (${sport})...`);

    const summaryData = await fetchESPNSummary(espnId, sport);

    if (!summaryData) {
      const stale = getCachedStale<MatchTrackerResponse>(cacheKey);
      if (stale) {
        return NextResponse.json(
          { ...stale, error: 'Données potentiellement anciennes' },
          { headers: { 'X-Cache': 'STALE' } }
        );
      }

      return NextResponse.json({
        match: null,
        lastUpdated: new Date().toISOString(),
        source: 'espn-summary',
        error: 'Données de match non disponibles',
      });
    }

    const trackerData = parseESPNSummary(summaryData, id);

    const response: MatchTrackerResponse = {
      match: trackerData,
      lastUpdated: new Date().toISOString(),
      source: 'espn-summary',
    };

    setCache(cacheKey, response);

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Match Tracker API] Error:', error);

    const cacheKey = `${CACHE_KEY_PREFIX}-${id}`;
    const stale = getCachedStale<MatchTrackerResponse>(cacheKey);
    if (stale) {
      return NextResponse.json(
        { ...stale, error: 'Données potentiellement anciennes' },
        { headers: { 'X-Cache': 'STALE' } }
      );
    }

    return NextResponse.json({
      match: null,
      lastUpdated: new Date().toISOString(),
      source: 'espn-summary',
      error: error instanceof Error ? error.message : 'Impossible de charger les données du match',
    });
  }
}
