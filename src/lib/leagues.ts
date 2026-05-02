/**
 * Centralized league/competition configuration for GoalStream.
 * Used by standings API, standings UI, team detail API, and match APIs.
 */

export interface LeagueConfig {
  code: string;
  name: string;
  flag: string;
  category: 'domestic' | 'international_club' | 'international_team';
  region?: string;
  hasGroups?: boolean; // Champions League, etc. have group-stage standings
}

// ─── Domestic Leagues ─────────────────────────────────────────────────────────
export const DOMESTIC_LEAGUES: LeagueConfig[] = [
  { code: 'eng.1', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'domestic', region: 'Europe' },
  { code: 'fra.1', name: 'Ligue 1', flag: '🇫🇷', category: 'domestic', region: 'Europe' },
  { code: 'esp.1', name: 'La Liga', flag: '🇪🇸', category: 'domestic', region: 'Europe' },
  { code: 'ita.1', name: 'Serie A', flag: '🇮🇹', category: 'domestic', region: 'Europe' },
  { code: 'ger.1', name: 'Bundesliga', flag: '🇩🇪', category: 'domestic', region: 'Europe' },
  { code: 'por.1', name: 'Liga Portugal', flag: '🇵🇹', category: 'domestic', region: 'Europe' },
  { code: 'ned.1', name: 'Eredivisie', flag: '🇳🇱', category: 'domestic', region: 'Europe' },
  { code: 'sco.1', name: 'Scottish Premiership', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', category: 'domestic', region: 'Europe' },
  { code: 'bel.1', name: 'Pro League', flag: '🇧🇪', category: 'domestic', region: 'Europe' },
  { code: 'tur.1', name: 'Süper Lig', flag: '🇹🇷', category: 'domestic', region: 'Europe' },
  { code: 'sau.1', name: 'Saudi Pro League', flag: '🇸🇦', category: 'domestic', region: 'Asia' },
  { code: 'bra.1', name: 'Série A', flag: '🇧🇷', category: 'domestic', region: 'South America' },
  { code: 'arg.1', name: 'Liga Profesional', flag: '🇦🇷', category: 'domestic', region: 'South America' },
  { code: 'mex.1', name: 'Liga MX', flag: '🇲🇽', category: 'domestic', region: 'North America' },
  { code: 'usa.1', name: 'MLS', flag: '🇺🇸', category: 'domestic', region: 'North America' },
];

// ─── International Club Competitions ───────────────────────────────────────────
export const INTERNATIONAL_CLUB: LeagueConfig[] = [
  { code: 'uefa.champions', name: 'Ligue des Champions', flag: '🏆', category: 'international_club', region: 'Europe', hasGroups: true },
  { code: 'uefa.europa', name: 'Europa League', flag: '🏆', category: 'international_club', region: 'Europe', hasGroups: true },
  { code: 'uefa.europa.conf', name: 'Conference League', flag: '🏆', category: 'international_club', region: 'Europe', hasGroups: true },
];

// ─── International National Teams ─────────────────────────────────────────────
// Note: FIFA Rankings are fetched via web search (no ESPN standings API)
export const INTERNATIONAL_TEAM: LeagueConfig[] = [
  { code: 'fifa.rankings', name: 'Classement FIFA', flag: '🌍', category: 'international_team', region: 'World' },
];

// ─── All leagues combined ─────────────────────────────────────────────────────
export const ALL_LEAGUES: LeagueConfig[] = [
  ...DOMESTIC_LEAGUES,
  ...INTERNATIONAL_CLUB,
  ...INTERNATIONAL_TEAM,
];

// ─── Lookup helpers ────────────────────────────────────────────────────────────
const leagueByCode = new Map(ALL_LEAGUES.map((l) => [l.code, l]));

export function getLeagueByCode(code: string): LeagueConfig | undefined {
  return leagueByCode.get(code);
}

export function getLeagueName(code: string): string {
  return leagueByCode.get(code)?.name ?? code;
}

export function getLeaguesByCategory(category: LeagueConfig['category']): LeagueConfig[] {
  return ALL_LEAGUES.filter((l) => l.category === category);
}
