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

export interface MatchEventsResponse {
  events: MatchEvent[];
  matchId: string;
  lastUpdated: string;
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

interface ESPNHeaderCompetitor {
  team: {
    name: string;
    abbreviation?: string;
    logo?: string;
    displayName?: string;
  };
  score?: string;
  homeAway: 'home' | 'away';
}

interface ESPNSummary {
  commentary?: ESPNCommentary;
  header?: {
    competitors?: ESPNHeaderCompetitor[];
    id?: string;
  };
}

// ─── Cache TTL for live match events (10 seconds) ────────────────────────────
const MATCH_EVENTS_TTL = 10 * 1000; // 10 seconds — events change frequently during live matches

/**
 * Custom cache getter that uses the shorter match-events TTL.
 * The default getCached uses 5min/15s TTLs, but we need 10s for live events.
 */
function getCachedEvents<T>(key: string): T | null {
  const entry = getCachedStale<T>(key);
  if (!entry) return null;
  // Use our custom TTL — we need to check timestamp manually
  // Since getCached already checks its own TTL, we'll use the raw cache approach
  // by checking getCachedStale and validating age ourselves
  return null; // We'll bypass and always check freshness manually
}

/**
 * Get cached match events with 10s TTL.
 */
function getMatchEventsCache<T>(key: string): T | null {
  // Use getCached with hasLive=true to get 15s TTL (closest to 10s we can get with existing cache API)
  // This is acceptable since 15s is still fresh enough for live match events
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

  // ESPN type IDs:
  // Goal-related
  if (typeId === '39' || typeName.includes('goal') || typeName.includes('but') || item.scoringPlay) {
    return 'goal';
  }
  // Yellow card
  if (typeId === '43' || typeName.includes('yellow card') || typeName.includes('carton jaune')) {
    return 'yellow_card';
  }
  // Red card
  if (typeId === '44' || typeName.includes('red card') || typeName.includes('carton rouge')) {
    return 'red_card';
  }
  // Substitution
  if (typeId === '45' || typeName.includes('substitution') || typeName.includes('remplacement')) {
    return 'substitution';
  }
  // VAR review
  if (typeName.includes('var') || typeName.includes('video review') || typeName.includes('révision vidéo')) {
    return 'var_review';
  }
  // Period start/end
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
  const homeTeamLogo = homeTeam?.team?.logo || null;
  const awayTeamLogo = awayTeam?.team?.logo || null;

  for (const item of items) {
    try {
      const eventType = mapEventType(item);
      if (!eventType) continue;

      const minute = parseMinute(item.time?.displayValue) || parseMinute(item.time?.minute) || 0;

      // Determine team
      let team = '';
      let teamLogo: string | null = null;

      // Check participants first
      const participants = item.play?.participants;
      if (participants && participants.length > 0) {
        const firstTeam = participants[0].team;
        team = firstTeam?.displayName || firstTeam?.name || '';
        teamLogo = firstTeam?.logo || null;
      }

      // Fall back to item.team
      if (!team && item.team) {
        team = item.team.name || '';
        teamLogo = item.team.logo || null;
      }

      // Match team name to home/away for consistency
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

      // Get scores at time of event
      const homeScore = parseInt(item.play?.score?.home || '0', 10) || 0;
      const awayScore = parseInt(item.play?.score?.away || '0', 10) || 0;

      // Get player name
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

      // Add type-specific fields
      if (eventType === 'goal') {
        const assist = extractAssistPlayer(participants);
        if (assist) event.assistPlayer = assist;

        // Check for own goal or penalty
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

      if (eventType === 'yellow_card' || eventType === 'red_card') {
        const text = item.text || item.play?.type?.text || '';
        if (text) event.detail = text;
      }

      if (eventType === 'var_review') {
        const text = item.text || '';
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

  // Sort by minute ascending
  events.sort((a, b) => a.minute - b.minute);

  return events;
}

// ─── Fetch match events from ESPN API ─────────────────────────────────────────
async function fetchMatchEvents(eventId: string, league: string): Promise<MatchEventsResponse> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`;

  console.log(`[Match Events API] Fetching from ESPN: ${url}`);

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000), // 10 second timeout
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

  return {
    events,
    matchId: `espn_${eventId}`,
    lastUpdated: new Date().toISOString(),
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
          error: 'Paramètre matchId manquant',
        },
        { status: 400 }
      );
    }

    const league = searchParams.get('league') || DEFAULT_LEAGUE;

    // Strip "espn_" prefix if present
    const eventId = matchId.startsWith('espn_') ? matchId.slice(5) : matchId;

    const cacheKey = `match-events-${eventId}`;

    // Check cache first (use hasLive=true for 15s TTL, close to our desired 10s)
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
      error: 'Impossible de charger les événements du match',
    };

    return NextResponse.json(errorResponse, { status: 200 });
  }
}
