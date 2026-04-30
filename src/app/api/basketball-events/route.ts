import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/basketball/cache';

// ─── Type definitions ─────────────────────────────────────────────────────────
export interface BasketballMatchEvent {
  id: string;
  type: 'field_goal' | 'three_pointer' | 'free_throw' | 'rebound' | 'assist' | 'turnover' |
        'foul' | 'technical_foul' | 'flagrant_foul' | 'ejection' | 'timeout' |
        'period_start' | 'period_end' | 'substitution' | 'jump_ball' | 'review';
  minute: string;       // e.g. "6:07" in Q2
  period: string;       // e.g. "1st Quarter", "2nd Quarter", "Halftime", "OT"
  team: string;
  teamLogo: string | null;
  player: string;
  assistPlayer?: string;
  playerIn?: string;
  detail?: string;
  homeScore: number;
  awayScore: number;
  scoringPlay: boolean;
}

export interface BasketballMatchEventsResponse {
  events: BasketballMatchEvent[];
  matchId: string;
  lastUpdated: string;
  possession?: 'home' | 'away' | null;
  error?: string;
}

// ─── ESPN API types ────────────────────────────────────────────────────────────
interface ESPNPlayParticipant {
  athlete?: {
    displayName?: string;
    name?: string;
  };
  team?: {
    name?: string;
    abbreviation?: string;
    logo?: string;
    displayName?: string;
  };
  type?: string;
}

interface ESPNPlayType {
  id?: string;
  name?: string;
  text?: string;
  abbreviation?: string;
}

interface ESPNPlay {
  type?: ESPNPlayType;
  participants?: ESPNPlayParticipant[];
  scoreValue?: number;
  scoringPlay?: boolean;
  period?: { number?: number; displayValue?: string };
  clock?: { displayValue?: string };
  team?: {
    id?: string;
    name?: string;
    abbreviation?: string;
    logo?: string;
    displayName?: string;
  };
  text?: string;
  homeScore?: number;
  awayScore?: number;
}

interface ESPNCommentaryItem {
  id?: string;
  play?: ESPNPlay;
  time?: string;
  period?: string;
  homeScore?: string;
  awayScore?: string;
  team?: {
    id?: string;
    name?: string;
    abbreviation?: string;
    logo?: string;
    displayName?: string;
  };
  text?: string;
  scoringPlay?: boolean;
  type?: ESPNPlayType;
}

interface ESPNHeaderCompetitor {
  team: {
    name: string;
    abbreviation?: string;
    logo?: string;
    displayName?: string;
  };
  score?: string;
  homeAway: 'home' | 'away';
  records?: Array<{ summary?: string }>;
}

interface ESPNSummary {
  commentary?: { items?: ESPNCommentaryItem[] };
  header?: {
    competitors?: ESPNHeaderCompetitor[];
    id?: string;
  };
  drives?: { current?: { team?: { id?: string } } };
  boxscore?: { players?: any[] };
}

// ─── Cache TTL ────────────────────────────────────────────────────────────────
const MATCH_EVENTS_TTL = 10 * 1000; // 10 seconds

function getMatchEventsCache<T>(key: string): T | null {
  return getCached<T>(key, true); // 15s TTL (closest to 10s)
}

// ─── Map ESPN play type to our event type ─────────────────────────────────────
function mapEventType(item: ESPNCommentaryItem): BasketballMatchEvent['type'] | null {
  const typeId = item.play?.type?.id || item.type?.id;
  const typeName = (item.play?.type?.text || item.play?.type?.name || item.type?.text || item.type?.name || '').toLowerCase();
  const abbreviation = (item.play?.type?.abbreviation || item.type?.abbreviation || '').toLowerCase();

  // Field goal (2-point)
  if (typeId === '42' || typeName.includes('field goal') || typeName.includes('field_goal') ||
      typeName.includes('2-point') || abbreviation === 'fg') {
    return 'field_goal';
  }
  // Three-pointer
  if (typeId === '43' || typeName.includes('three point') || typeName.includes('3-point') ||
      typeName.includes('three-point') || typeName.includes('3pt') || abbreviation === '3pt') {
    return 'three_pointer';
  }
  // Free throw
  if (typeId === '44' || typeName.includes('free throw') || typeName.includes('free_throw') || abbreviation === 'ft') {
    return 'free_throw';
  }
  // Rebound
  if (typeId === '45' || typeName.includes('rebound') || typeName.includes('rebond')) {
    return 'rebound';
  }
  // Assist
  if (typeId === '46' || typeName.includes('assist') || typeName.includes('passe décisive')) {
    return 'assist';
  }
  // Turnover
  if (typeId === '47' || typeName.includes('turnover') || typeName.includes('ball perdu') || abbreviation === 'to') {
    return 'turnover';
  }
  // Foul (regular)
  if (typeId === '48' || typeName.includes('foul') || typeName.includes('faute')) {
    if (typeName.includes('technical') || typeName.includes('technique')) return 'technical_foul';
    if (typeName.includes('flagrant')) return 'flagrant_foul';
    return 'foul';
  }
  // Technical foul
  if (typeName.includes('technical foul') || typeName.includes('faute technique')) {
    return 'technical_foul';
  }
  // Flagrant foul
  if (typeName.includes('flagrant foul') || typeName.includes('faute flagrante')) {
    return 'flagrant_foul';
  }
  // Ejection
  if (typeName.includes('eject') || typeName.includes('expuls')) {
    return 'ejection';
  }
  // Timeout
  if (typeId === '53' || typeName.includes('timeout') || typeName.includes('temps mort')) {
    return 'timeout';
  }
  // Substitution
  if (typeId === '54' || typeName.includes('substitution') || typeName.includes('remplacement') || typeName.includes('enters') || typeName.includes('exits')) {
    return 'substitution';
  }
  // Jump ball
  if (typeName.includes('jump ball') || typeName.includes('entre-deux')) {
    return 'jump_ball';
  }
  // Review
  if (typeName.includes('review') || typeName.includes('challenge') || typeName.includes('révision')) {
    return 'review';
  }
  // Period start/end
  if (typeName.includes('start') || typeName.includes('début') || typeName.includes('begin') || typeName.includes('kick off')) {
    return 'period_start';
  }
  if (typeName.includes('end') || typeName.includes('fin') || typeName.includes('halftime') || typeName.includes('mi-temps') ||
      typeName.includes('quarter end') || typeName.includes('end of')) {
    return 'period_end';
  }

  // Also check for scoring plays that didn't match specific type
  if (item.scoringPlay || item.play?.scoringPlay) {
    return 'field_goal'; // Default scoring type
  }

  return null;
}

// ─── Parse period display ─────────────────────────────────────────────────────
function parsePeriod(item: ESPNCommentaryItem): string {
  // Try to get from play.period.displayValue first
  const periodDisplay = item.play?.period?.displayValue;
  if (periodDisplay) return periodDisplay;

  // Try from the raw text
  const text = (item.text || '').toLowerCase();
  if (text.includes('1st quarter') || text.includes('1er quart')) return '1st Quarter';
  if (text.includes('2nd quarter') || text.includes('2e quart')) return '2nd Quarter';
  if (text.includes('3rd quarter') || text.includes('3e quart')) return '3rd Quarter';
  if (text.includes('4th quarter') || text.includes('4e quart')) return '4th Quarter';
  if (text.includes('overtime') || text.includes('prolongation')) return 'OT';
  if (text.includes('halftime') || text.includes('mi-temps')) return 'Halftime';

  return '';
}

// ─── Parse ESPN commentary items into BasketballMatchEvent array ───────────────
function parseCommentaryItems(
  items: ESPNCommentaryItem[],
  homeTeam: ESPNHeaderCompetitor | null,
  awayTeam: ESPNHeaderCompetitor | null,
): BasketballMatchEvent[] {
  const events: BasketballMatchEvent[] = [];

  const homeTeamName = homeTeam?.team?.displayName || homeTeam?.team?.name || '';
  const awayTeamName = awayTeam?.team?.displayName || awayTeam?.team?.name || '';
  const homeTeamLogo = homeTeam?.team?.logo || null;
  const awayTeamLogo = awayTeam?.team?.logo || null;

  for (const item of items) {
    try {
      const eventType = mapEventType(item);
      if (!eventType) continue;

      // Get clock display
      const minute = item.play?.clock?.displayValue || '';
      const period = parsePeriod(item);

      // Determine team
      let team = '';
      let teamLogo: string | null = null;

      const participants = item.play?.participants;
      if (participants && participants.length > 0) {
        const firstTeam = participants[0].team;
        team = firstTeam?.displayName || firstTeam?.name || '';
        teamLogo = firstTeam?.logo || null;
      }

      if (!team && item.team) {
        team = item.team.displayName || item.team.name || '';
        teamLogo = item.team.logo || null;
      }

      if (!team && item.play?.team) {
        team = item.play.team.displayName || item.play.team.name || '';
        teamLogo = item.play.team.logo || null;
      }

      // Match team name to home/away
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

      // Get scores
      const homeScore = parseInt(String(item.homeScore ?? item.play?.homeScore ?? '0'), 10) || 0;
      const awayScore = parseInt(String(item.awayScore ?? item.play?.awayScore ?? '0'), 10) || 0;

      // Is this a scoring play?
      const scoringPlay = item.scoringPlay || item.play?.scoringPlay || false;

      // Get player name
      let player = '';
      if (participants && participants.length > 0) {
        player = participants[0].athlete?.displayName || participants[0].athlete?.name || '';
      }

      const event: BasketballMatchEvent = {
        id: item.id || `evt-${events.length}-${minute}-${eventType}`,
        type: eventType,
        minute,
        period,
        team,
        teamLogo,
        player,
        homeScore,
        awayScore,
        scoringPlay,
      };

      // Add assist player for scoring plays
      if ((eventType === 'field_goal' || eventType === 'three_pointer' || eventType === 'free_throw') && participants && participants.length > 1) {
        const assist = participants[1].athlete?.displayName || participants[1].athlete?.name || '';
        if (assist) event.assistPlayer = assist;
      }

      // Substitution: playerIn/playerOut
      if (eventType === 'substitution' && participants) {
        let playerOut = '';
        let playerIn = '';
        for (const p of participants) {
          const name = p.athlete?.displayName || p.athlete?.name || '';
          if (p.type === 'in' || (p.type && p.type.toLowerCase().includes('in'))) {
            playerIn = name;
          } else {
            playerOut = name || playerOut;
          }
        }
        event.player = playerOut || player;
        if (playerIn) event.playerIn = playerIn;
      }

      // Detail text
      const detailText = item.text || item.play?.type?.text || '';
      if (detailText) event.detail = detailText;

      events.push(event);
    } catch {
      // Skip malformed items
    }
  }

  // Sort by period + clock (reverse chronological for basketball — newest first)
  events.reverse();

  return events;
}

// ─── Determine possession ─────────────────────────────────────────────────────
function determinePossession(data: ESPNSummary, homeTeam: ESPNHeaderCompetitor | null): 'home' | 'away' | null {
  // Try from drives (NBA-specific)
  const currentDriveTeam = data.drives?.current?.team?.id;
  if (currentDriveTeam) {
    if (homeTeam && homeTeam.team && String(homeTeam.team.id) === String(currentDriveTeam)) {
      return 'home';
    }
    return 'away';
  }

  // Try from last commentary item's team
  const items = data.commentary?.items || [];
  if (items.length > 0) {
    const lastItem = items[0]; // ESPN returns newest first
    const teamId = lastItem.team?.id || lastItem.play?.team?.id;
    if (teamId && homeTeam?.team) {
      if (String(homeTeam.team.id) === String(teamId)) return 'home';
      return 'away';
    }
  }

  return null;
}

// ─── Fetch match events from ESPN API ─────────────────────────────────────────
async function fetchBasketballMatchEvents(eventId: string, league: string): Promise<BasketballMatchEventsResponse> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/summary?event=${eventId}`;

  console.log(`[Basketball Events API] Fetching from ESPN: ${url}`);

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`ESPN API returned ${res.status}`);
  }

  const data: ESPNSummary = await res.json();

  // Extract team info from header
  const competitors = data.header?.competitors || [];
  const homeTeam = competitors.find(c => c.homeAway === 'home') || null;
  const awayTeam = competitors.find(c => c.homeAway === 'away') || null;

  // Extract commentary items
  const commentaryItems = data.commentary?.items || [];

  // Parse into our event format
  const events = parseCommentaryItems(commentaryItems, homeTeam, awayTeam);

  // Determine possession
  const possession = determinePossession(data, homeTeam);

  return {
    events,
    matchId: `espn_${eventId}`,
    lastUpdated: new Date().toISOString(),
    possession,
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
          possession: null,
          error: 'Paramètre matchId manquant',
        },
        { status: 400 }
      );
    }

    const league = searchParams.get('league') || 'nba';

    // Strip "espn_" prefix if present
    const eventId = matchId.startsWith('espn_') ? matchId.slice(5) : matchId;

    const cacheKey = `basketball-events-${eventId}`;

    // Check cache first
    const cached = getMatchEventsCache<BasketballMatchEventsResponse>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      console.log(`[Basketball Events API] Returning cached events for ${eventId} (age: ${age}s, ${cached.events.length} events)`);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    console.log(`[Basketball Events API] Cache miss, fetching from ESPN for event: ${eventId}, league: ${league}`);

    // Fetch from ESPN
    const result = await fetchBasketballMatchEvents(eventId, league);

    // Cache the result
    setCache(cacheKey, result);

    console.log(`[Basketball Events API] Returning ${result.events.length} events for event ${eventId}`);
    return NextResponse.json(result, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('[Basketball Events API] Error fetching match events:', error);

    const matchId = request.nextUrl.searchParams.get('matchId') || '';
    const eventId = matchId.startsWith('espn_') ? matchId.slice(5) : matchId;

    // Try stale cache
    const cacheKey = `basketball-events-${eventId}`;
    const stale = getCachedStale<BasketballMatchEventsResponse>(cacheKey);
    if (stale) {
      console.log('[Basketball Events API] Returning stale cache due to error');
      return NextResponse.json(
        { ...stale, error: 'Les données peuvent être anciennes' },
        { headers: { 'X-Cache': 'STALE' }, status: 200 }
      );
    }

    // Return empty events with error — always 200 to prevent client crashes
    const errorResponse: BasketballMatchEventsResponse = {
      events: [],
      matchId,
      lastUpdated: new Date().toISOString(),
      possession: null,
      error: 'Impossible de charger les événements du match',
    };

    return NextResponse.json(errorResponse, { status: 200 });
  }
}
