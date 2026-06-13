import { NextRequest, NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/basketball/cache';

// ─── Type definitions ─────────────────────────────────────────────────────────
export interface BasketballMatchEvent {
  id: string;
  type: 'field_goal' | 'three_pointer' | 'free_throw' | 'rebound' | 'assist' | 'turnover' |
        'foul' | 'technical_foul' | 'flagrant_foul' | 'ejection' | 'timeout' |
        'period_start' | 'period_end' | 'substitution' | 'jump_ball' | 'review';
  minute: string;
  period: string;
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

// ─── Match Summary types ──────────────────────────────────────────────────────
export interface QuarterScore {
  period: number;
  label: string; // "Q1", "Q2", "Q3", "Q4", "OT"
  homeScore: number;
  awayScore: number;
}

export interface TeamStat {
  label: string;
  homeValue: string;
  awayValue: string;
}

export interface TopPerformer {
  name: string;
  headshot?: string | null;
  teamAbbr: string;
  position?: string;
  value: string;
  category: string; // "points", "rebounds", "assists"
}

export interface MatchSummary {
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeRecord: string | null;
  awayRecord: string | null;
  quarterScores: QuarterScore[];
  teamStats: TeamStat[];
  topPerformers: TopPerformer[];
  venue: string | null;
  attendance: string | null;
  matchDate: string | null;
}

export interface BasketballMatchEventsResponse {
  events: BasketballMatchEvent[];
  matchId: string;
  lastUpdated: string;
  possession?: 'home' | 'away' | null;
  summary?: MatchSummary | null;
  error?: string;
}

// ─── ESPN API types ────────────────────────────────────────────────────────────
interface ESPNPlayParticipant {
  athlete?: {
    id?: string;
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
    color?: string;
    logos?: Array<{ href?: string }>;
  };
  score?: string;
  homeAway: 'home' | 'away';
  winner?: boolean;
  records?: Array<{ summary?: string; type?: string }>;
  linescores?: ESPNLineScore[];
}

interface ESPNBoxscoreTeamStat {
  label?: string;
  displayValue?: string;
  name?: string;
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

interface ESPNLeaderAthlete {
  displayValue?: string;
  value?: number;
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    headshot?: { href?: string };
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
    logos?: Array<{ href?: string }>;
  };
  leaders?: ESPNLeaderCategory[];
}

interface ESPNSummary {
  commentary?: { items?: ESPNCommentaryItem[] };
  plays?: ESPNPlay[];
  header?: {
    id?: string;
    competitions?: Array<{
      date?: string;
      competitors?: ESPNHeaderCompetitor[];
    }>;
  };
  drives?: { current?: { team?: { id?: string } } };
  boxscore?: {
    teams?: ESPNBoxscoreTeam[];
    players?: Array<{
      team?: {
        id?: string;
        displayName?: string;
      };
      statistics?: Array<{
        labels?: string[];
        athletes?: Array<{
          athlete?: {
            id?: string;
            displayName?: string;
          };
          stats?: string[];
        }>;
      }>;
    }>;
  };
  leaders?: ESPNTeamLeaders[];
  gameInfo?: {
    venue?: {
      fullName?: string;
      address?: { city?: string; state?: string };
    };
    attendance?: number | string;
  };
}

// ─── Cache TTL ────────────────────────────────────────────────────────────────
const MATCH_EVENTS_TTL = 10 * 1000; // 10 seconds

function getMatchEventsCache<T>(key: string): T | null {
  return getCached<T>(key, true); // 15s TTL (closest to 10s)
}

// ─── Map ESPN play type to our event type ─────────────────────────────────────
function mapPlayType(play: ESPNPlay): BasketballMatchEvent['type'] | null {
  const typeId = play.type?.id;
  const typeName = (play.type?.text || '').toLowerCase();
  const scoreValue = play.scoreValue || 0;

  // Three-pointer (check before field goal — ESPN uses "Jump Shot" for both)
  if (scoreValue === 3 || typeId === '92' && typeName.includes('three') ||
      typeName.includes('three point') || typeName.includes('3-point') ||
      typeName.includes('3pt') || typeName.includes('three-point')) {
    return 'three_pointer';
  }
  // Field goal (2-point shot)
  if (typeId === '92' || typeName.includes('jump shot') || typeName.includes('field goal') ||
      typeName.includes('2-point') || typeName.includes('layup') || typeName.includes('dunk') ||
      typeName.includes('hook shot') || typeName.includes('fadeaway') ||
      typeName.includes('bank shot') || typeName.includes('pullup') ||
      typeName.includes('step back') || typeName.includes('floating')) {
    if (scoreValue === 3) return 'three_pointer';
    return 'field_goal';
  }
  // Free throw
  if (typeId === '93' || typeName.includes('free throw') || typeName.includes('free_throw')) {
    return 'free_throw';
  }
  // Rebound
  if (typeId === '94' || typeName.includes('rebound') || typeName.includes('rebond')) {
    return 'rebound';
  }
  // Turnover
  if (typeId === '95' || typeName.includes('turnover') || typeName.includes('bad pass') ||
      typeName.includes('ball perdu') || typeName.includes('steal') || typeName.includes('lost ball')) {
    return 'turnover';
  }
  // Foul
  if (typeId === '96' || typeName.includes('foul') || typeName.includes('faute')) {
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
  if (typeId === '98' || typeName.includes('timeout') || typeName.includes('temps mort')) {
    return 'timeout';
  }
  // Substitution
  if (typeId === '99' || typeName.includes('substitution') || typeName.includes('enters') ||
      typeName.includes('returns') || typeName.includes('leaves')) {
    return 'substitution';
  }
  // Jump ball
  if (typeName.includes('jumpball') || typeName.includes('jump ball') || typeName.includes('entre-deux')) {
    return 'jump_ball';
  }
  // Review
  if (typeName.includes('review') || typeName.includes('challenge') || typeName.includes('révision')) {
    return 'review';
  }
  // Period start/end
  if (typeName.includes('start') || typeName.includes('début') || typeName.includes('begin')) {
    return 'period_start';
  }
  if (typeName.includes('end') || typeName.includes('fin') || typeName.includes('halftime') ||
      typeName.includes('mi-temps') || typeName.includes('quarter end') || typeName.includes('end of')) {
    return 'period_end';
  }

  // Scoring play that didn't match specific type
  if (play.scoringPlay) {
    return scoreValue === 3 ? 'three_pointer' : 'field_goal';
  }

  return null;
}

// ─── Map commentary item type (fixes missing mapEventType) ────────────────────
function mapCommentaryEventType(item: ESPNCommentaryItem): BasketballMatchEvent['type'] | null {
  const typeName = (item.type?.text || item.text || '').toLowerCase();
  const isScoring = item.scoringPlay || item.play?.scoringPlay || false;

  if (typeName.includes('three point') || typeName.includes('3-point') || typeName.includes('3pt')) return 'three_pointer';
  if (typeName.includes('jump shot') || typeName.includes('field goal') || typeName.includes('layup') ||
      typeName.includes('dunk') || typeName.includes('hook shot') || typeName.includes('fadeaway')) {
    return isScoring ? 'field_goal' : null;
  }
  if (typeName.includes('free throw')) return 'free_throw';
  if (typeName.includes('rebound')) return 'rebound';
  if (typeName.includes('turnover') || typeName.includes('steal') || typeName.includes('bad pass')) return 'turnover';
  if (typeName.includes('flagrant foul')) return 'flagrant_foul';
  if (typeName.includes('technical foul')) return 'technical_foul';
  if (typeName.includes('foul')) return 'foul';
  if (typeName.includes('eject')) return 'ejection';
  if (typeName.includes('timeout') || typeName.includes('temps mort')) return 'timeout';
  if (typeName.includes('substitution') || typeName.includes('enters') || typeName.includes('returns')) return 'substitution';
  if (typeName.includes('jump ball') || typeName.includes('jumpball')) return 'jump_ball';
  if (typeName.includes('review') || typeName.includes('challenge')) return 'review';
  if (typeName.includes('start') || typeName.includes('begin')) return 'period_start';
  if (typeName.includes('end') || typeName.includes('halftime') || typeName.includes('mi-temps')) return 'period_end';

  if (isScoring) return 'field_goal';

  // Try via the embedded play
  if (item.play) return mapPlayType(item.play);

  return null;
}

// ─── Parse period display ─────────────────────────────────────────────────────
function parsePeriod(item: ESPNCommentaryItem): string {
  const periodDisplay = item.play?.period?.displayValue;
  if (periodDisplay) return periodDisplay;

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
  const homeTeamLogo = homeTeam?.team?.logos?.[0]?.href || homeTeam?.team?.logo || null;
  const awayTeamLogo = awayTeam?.team?.logos?.[0]?.href || awayTeam?.team?.logo || null;

  for (const item of items) {
    try {
      const eventType = mapCommentaryEventType(item);
      if (!eventType) continue;

      const minute = item.play?.clock?.displayValue || '';
      const period = parsePeriod(item);

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

      const homeScore = parseInt(String(item.homeScore ?? item.play?.homeScore ?? '0'), 10) || 0;
      const awayScore = parseInt(String(item.awayScore ?? item.play?.awayScore ?? '0'), 10) || 0;
      const scoringPlay = item.scoringPlay || item.play?.scoringPlay || false;

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

      if ((eventType === 'field_goal' || eventType === 'three_pointer' || eventType === 'free_throw') && participants && participants.length > 1) {
        const assist = participants[1].athlete?.displayName || participants[1].athlete?.name || '';
        if (assist) event.assistPlayer = assist;
      }

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

      const detailText = item.text || item.play?.type?.text || '';
      if (detailText) event.detail = detailText;

      events.push(event);
    } catch(_e) {
      // Skip malformed items
    }
  }

  events.reverse();
  return events;
}

// ─── Determine possession ─────────────────────────────────────────────────────
function determinePossession(data: ESPNSummary, homeTeam: ESPNHeaderCompetitor | null): 'home' | 'away' | null {
  const currentDriveTeam = data.drives?.current?.team?.id;
  if (currentDriveTeam) {
    if (homeTeam && homeTeam.team && String(homeTeam.team.id) === String(currentDriveTeam)) {
      return 'home';
    }
    return 'away';
  }

  const items = data.commentary?.items || [];
  if (items.length > 0) {
    const lastItem = items[0];
    const teamId = lastItem.team?.id || lastItem.play?.team?.id;
    if (teamId && homeTeam?.team) {
      if (String(homeTeam.team.id) === String(teamId)) return 'home';
      return 'away';
    }
  }

  return null;
}

// ─── Parse match summary from ESPN data ───────────────────────────────────────
function parseMatchSummary(data: ESPNSummary): MatchSummary | null {
  try {
    const competitors = data.header?.competitions?.[0]?.competitors || [];
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

    // Records
    const homeRecord = homeComp.records?.find(r => r.type === 'total')?.summary || null;
    const awayRecord = awayComp.records?.find(r => r.type === 'total')?.summary || null;

    // Quarter-by-quarter scores from linescores
    const quarterScores: QuarterScore[] = [];
    const homeLinescores = homeComp.linescores || [];
    const awayLinescores = awayComp.linescores || [];
    const maxPeriods = Math.max(homeLinescores.length, awayLinescores.length);

    for (let i = 0; i < maxPeriods; i++) {
      const homeLS = homeLinescores[i];
      const awayLS = awayLinescores[i];
      const periodNum = homeLS?.period?.number || awayLS?.period?.number || (i + 1);
      const periodLabel = periodNum <= 4 ? `Q${periodNum}` : `OT${periodNum - 4}`;

      quarterScores.push({
        period: periodNum,
        label: periodLabel,
        homeScore: homeLS?.value ?? 0,
        awayScore: awayLS?.value ?? 0,
      });
    }

    // Team stats from boxscore.teams
    const teamStats: TeamStat[] = [];
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
      // Key stats to show (translated to French)
      const keyStatNames: Record<string, string> = {
        'FG': 'Tirs',
        'Field Goal %': '% Tirs',
        '3PT': '3 Points',
        'Three Point %': '% 3Pts',
        'FT': 'Lancés francs',
        'Free Throw %': '% LFrancs',
        'Rebounds': 'Rebonds',
        'Offensive Rebounds': 'Reb. off.',
        'Defensive Rebounds': 'Reb. déf.',
        'Assists': 'Passes dec.',
        'Steals': 'Interceptions',
        'Blocks': 'Contres',
        'Turnovers': 'Ballons perdus',
        'Total Turnovers': 'Total BP',
        'Fouls': 'Fautes',
        'Technical Fouls': 'Fautes tech.',
        'Fast Break Points': 'Pts contre-attaque',
        'Points in Paint': 'Pts dans la raquette',
        'Largest Lead': 'Plus grand écart',
      };

      const homeStats = homeBoxTeam.statistics;
      const awayStats = awayBoxTeam.statistics;
      const statCount = Math.min(homeStats.length, awayStats.length);

      for (let i = 0; i < statCount; i++) {
        const homeStat = homeStats[i];
        const awayStat = awayStats[i];
        const label = homeStat.label || homeStat.name || '';
        const frenchLabel = keyStatNames[label] || label;

        // Only include important stats (skip niche ones)
        if (keyStatNames[label]) {
          teamStats.push({
            label: frenchLabel,
            homeValue: homeStat.displayValue || '',
            awayValue: awayStat.displayValue || '',
          });
        }
      }
    }

    // Top performers from leaders
    const topPerformers: TopPerformer[] = [];
    const leadersData = data.leaders || [];

    for (const teamLeader of leadersData) {
      const teamAbbr = teamLeader.team?.abbreviation || '';
      const categories = teamLeader.leaders || [];

      for (const category of categories) {
        const catName = category.name || '';
        const catDisplay = catName === 'points' ? 'Points' :
                          catName === 'rebounds' ? 'Rebonds' :
                          catName === 'assists' ? 'Passes dec.' : catName;

        for (const leader of category.leaders || []) {
          const athlete = leader.athlete;
          if (athlete?.displayName && leader.displayValue) {
            topPerformers.push({
              name: athlete.displayName,
              headshot: athlete.headshot?.href || null,
              teamAbbr,
              position: athlete.position?.abbreviation,
              value: leader.displayValue,
              category: catName,
            });
          }
        }
      }
    }

    // Game info
    const venue = data.gameInfo?.venue?.fullName || null;
    const attendance = data.gameInfo?.attendance ? String(data.gameInfo.attendance) : null;
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
      homeRecord,
      awayRecord,
      quarterScores,
      teamStats,
      topPerformers,
      venue,
      attendance,
      matchDate,
    };
  } catch (err) {
    console.error('[Basketball Events API] Error parsing match summary:', err);
    return null;
  }
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

  // Extract team info from header.competitions[0].competitors
  const competitors = data.header?.competitions?.[0]?.competitors || data.header?.competitions || [];
  const homeTeam = competitors.find(c => c.homeAway === 'home') || null;
  const awayTeam = competitors.find(c => c.homeAway === 'away') || null;

  const homeTeamName = homeTeam?.team?.displayName || homeTeam?.team?.name || '';
  const awayTeamName = awayTeam?.team?.displayName || awayTeam?.team?.name || '';
  const homeTeamLogo = homeTeam?.team?.logos?.[0]?.href || homeTeam?.team?.logo || null;
  const awayTeamLogo = awayTeam?.team?.logos?.[0]?.href || awayTeam?.team?.logo || null;
  const homeTeamId = homeTeam?.team?.id || '';
  const awayTeamId = awayTeam?.team?.id || '';

  // Build player name lookup from boxscore
  const playerNames = new Map<string, string>();
  const boxscorePlayers = data.boxscore?.players || [];
  for (const teamData of boxscorePlayers) {
    const stats = teamData.statistics || [];
    for (const stat of stats) {
      const athletes = stat.athletes || [];
      for (const a of athletes) {
        const id = a.athlete?.id;
        const name = a.athlete?.displayName;
        if (id && name) {
          playerNames.set(String(id), name);
        }
      }
    }
  }

  // Parse events — prefer 'plays' array (NBA summary format), fall back to 'commentary'
  const events: BasketballMatchEvent[] = [];

  if (data.plays && data.plays.length > 0) {
    for (const play of data.plays) {
      try {
        const eventType = mapPlayType(play);
        if (!eventType) continue;

        const minute = play.clock?.displayValue || '';
        const period = play.period?.displayValue || '';
        const scoringPlay = play.scoringPlay || false;
        const homeScore = play.homeScore || 0;
        const awayScore = play.awayScore || 0;

        let team = '';
        let teamLogo: string | null = null;
        const playTeamId = play.team?.id;
        if (playTeamId) {
          if (String(playTeamId) === String(homeTeamId)) {
            team = homeTeamName;
            teamLogo = homeTeamLogo;
          } else if (String(playTeamId) === String(awayTeamId)) {
            team = awayTeamName;
            teamLogo = awayTeamLogo;
          }
        }

        let player = '';
        let assistPlayer = '';
        const participants = play.participants || [];
        if (participants.length > 0) {
          const firstId = participants[0].athlete?.id;
          if (firstId) {
            player = playerNames.get(String(firstId)) || '';
          }
          if (participants.length > 1 && (eventType === 'field_goal' || eventType === 'three_pointer' || eventType === 'free_throw')) {
            const secondId = participants[1].athlete?.id;
            if (secondId) {
              assistPlayer = playerNames.get(String(secondId)) || '';
            }
          }
        }

        if (!player && play.text) {
          const match = play.text.match(/^([A-Z][a-z]+ [A-Z][a-zA-Z\-]+)/);
          if (match) player = match[1];
        }

        let playerIn = '';
        if (eventType === 'substitution' && play.text) {
          const enterMatch = play.text.match(/([A-Z][a-z]+ [A-Z][a-zA-Z\-]+)\s+enters?\s+.*for\s+([A-Z][a-z]+ [A-Z][a-zA-Z\-]+)/i);
          if (enterMatch) {
            playerIn = enterMatch[1];
            player = enterMatch[2];
          } else {
            const returnMatch = play.text.match(/([A-Z][a-z]+ [A-Z][a-zA-Z\-]+)\s+returns/);
            if (returnMatch) {
              player = returnMatch[1];
            }
          }
        }

        const event: BasketballMatchEvent = {
          id: String(play.id || `evt-${events.length}-${minute}-${eventType}`),
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

        if (assistPlayer) event.assistPlayer = assistPlayer;
        if (playerIn) event.playerIn = playerIn;

        const detailText = play.text || play.type?.text || '';
        if (detailText) event.detail = detailText;

        events.push(event);
      } catch(_e) {
        // Skip malformed plays
      }
    }
  } else if (data.commentary?.items && data.commentary.items.length > 0) {
    const commentaryEvents = parseCommentaryItems(data.commentary.items, homeTeam, awayTeam);
    events.push(...commentaryEvents);
  }

  // Determine possession
  const possession = determinePossession(data, homeTeam);

  // Parse match summary (quarter scores, team stats, top performers)
  const summary = parseMatchSummary(data);

  console.log(`[Basketball Events API] Parsed ${events.length} events (plays: ${data.plays?.length || 0}, commentary: ${data.commentary?.items?.length || 0}), summary: ${summary ? 'yes' : 'no'}`);

  return {
    events,
    matchId: `espn_${eventId}`,
    lastUpdated: new Date().toISOString(),
    possession,
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
          possession: null,
          summary: null,
          error: 'Paramètre matchId manquant',
        },
        { status: 400 }
      );
    }

    const league = searchParams.get('league') || 'nba';

    // Strip "espn_bball_" or "espn_" prefix if present
    let eventId = matchId;
    if (eventId.startsWith('espn_bball_')) {
      eventId = eventId.slice(11);
    } else if (eventId.startsWith('espn_')) {
      eventId = eventId.slice(5);
    }

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
    let eventId = matchId;
    if (eventId.startsWith('espn_bball_')) {
      eventId = eventId.slice(11);
    } else if (eventId.startsWith('espn_')) {
      eventId = eventId.slice(5);
    }

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
      summary: null,
      error: 'Impossible de charger les événements du match',
    };

    return NextResponse.json(errorResponse, { status: 200 });
  }
}
