/**
 * Type definitions for football match data.
 */

export type MatchStatus = 'live' | 'upcoming' | 'finished';

export interface FootballMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  minute: number | null;
  competition: string;
  homeLogo: string | null;
  awayLogo: string | null;
  matchDate: string | null;
  /** Stream URL from the database (if assigned) */
  streamUrl?: string | null;
  /** Channel name from the database (if assigned) */
  channelName?: string | null;
  /** Channel logo from the database (if assigned) */
  channelLogo?: string | null;
}

export interface FootballMatchesResponse {
  matches: FootballMatch[];
  lastUpdated: string;
  source: 'ai-search';
  error?: string;
  /** Dates that were fetched (YYYYMMDD format) */
  dates?: string[];
}

export interface MatchDetail extends FootballMatch {
  lineups?: {
    home: string[];
    away: string[];
  };
  events?: MatchEvent[];
  stats?: MatchStat[];
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'penalty' | 'own_goal' | 'var';
  team: 'home' | 'away';
  player: string;
  detail?: string;
}

export interface MatchStat {
  name: string;
  home: string;
  away: string;
}

export interface MatchDetailResponse {
  match: MatchDetail;
  lastUpdated: string;
  source: 'ai-search';
  error?: string;
}
