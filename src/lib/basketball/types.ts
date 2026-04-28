/**
 * Type definitions for basketball match data.
 */

export type MatchStatus = 'live' | 'upcoming' | 'finished';

export interface BasketballMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  /** Period display string: "Q1", "Q2", "Q3", "Q4", "HT", "OT", "OT2", etc. */
  periodDisplay: string | null;
  /** Current clock display: "7:32", "0:00", etc. */
  clockDisplay: string | null;
  /** Current period number (1-4 for quarters, 5+ for OT) */
  period: number | null;
  competition: string;
  homeLogo: string | null;
  awayLogo: string | null;
  /** Team abbreviations for compact display */
  homeAbbreviation: string | null;
  awayAbbreviation: string | null;
  /** Team records e.g. "42-18" */
  homeRecord: string | null;
  awayRecord: string | null;
  matchDate: string | null;
  streamUrl?: string | null;
  channelName?: string | null;
  channelLogo?: string | null;
}

export interface BasketballMatchesResponse {
  matches: BasketballMatch[];
  lastUpdated: string;
  source: 'espn-api';
  error?: string;
  /** Dates that were fetched (YYYYMMDD format) */
  dates?: string[];
}
