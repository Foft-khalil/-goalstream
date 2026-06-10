import { NextResponse } from 'next/server';
import { getCached, getCachedStale, setCache, getCacheAge } from '@/lib/football/cache';

// ─── League definitions by category ──────────────────────────────────────────

const CHAMPIONNATS = [
  { code: 'eng.1', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'fra.1', name: 'Ligue 1', flag: '🇫🇷' },
  { code: 'esp.1', name: 'La Liga', flag: '🇪🇸' },
  { code: 'ita.1', name: 'Serie A', flag: '🇮🇹' },
  { code: 'ger.1', name: 'Bundesliga', flag: '🇩🇪' },
  { code: 'por.1', name: 'Liga Portugal', flag: '🇵🇹' },
  { code: 'ned.1', name: 'Eredivisie', flag: '🇳🇱' },
  { code: 'ksa.1', name: 'Saudi Pro League', flag: '🇸🇦' },
  { code: 'tur.1', name: 'Süper Lig', flag: '🇹🇷' },
  { code: 'usa.1', name: 'MLS', flag: '🇺🇸' },
  { code: 'bra.1', name: 'Brasileirão', flag: '🇧🇷' },
  { code: 'arg.1', name: 'Liga Profesional', flag: '🇦🇷' },
  { code: 'mex.1', name: 'Liga MX', flag: '🇲🇽' },
  { code: 'sco.1', name: 'Scottish Premiership', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { code: 'bel.1', name: 'Jupiler Pro League', flag: '🇧🇪' },
  { code: 'gre.1', name: 'Super League', flag: '🇬🇷' },
];

const COUPES_CLUBS = [
  { code: 'uefa.champions', name: 'Ligue des Champions', flag: '🏆' },
  { code: 'uefa.europa', name: 'Europa League', flag: '🏆' },
  { code: 'uefa.europa.conf', name: 'Conference League', flag: '🏆' },
  { code: 'conmebol.libertadores', name: 'Copa Libertadores', flag: '🌎' },
  { code: 'conmebol.sudamericana', name: 'Copa Sudamericana', flag: '🌎' },
  { code: 'afc.champions', name: 'AFC Champions League', flag: '🌏' },
  { code: 'caf.champions', name: 'CAF Champions League', flag: '🌍' },
];

const NATIONALES = [
  { code: 'fifa.rankings', name: 'Classement FIFA', flag: '🌍' },
  { code: 'fifa.world', name: 'Coupe du Monde', flag: '🏆' },
  { code: 'fifa.friendly', name: 'Match Amical', flag: '🤝' },
  { code: 'uefa.euro', name: 'Euro', flag: '🇪🇺' },
  { code: 'uefa.nations', name: 'Ligue des Nations', flag: '🇪🇺' },
  { code: 'conmebol.america', name: 'Copa América', flag: '🌎' },
  { code: 'concacaf.gold', name: 'Gold Cup', flag: '🇺🇸' },
  { code: 'afc.asian', name: 'Coupe d\'Asie', flag: '🌏' },
  { code: 'caf.nations', name: 'CAN', flag: '🌍' },
];

const FEMININES = [
  { code: 'eng.w.1', name: "Women's Super League", flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'fra.w.1', name: 'Première Ligue', flag: '🇫🇷' },
  { code: 'esp.w.1', name: 'Liga F', flag: '🇪🇸' },
  { code: 'ned.w.1', name: 'Vrouwen Eredivisie', flag: '🇳🇱' },
  { code: 'usa.nwsl', name: 'NWSL', flag: '🇺🇸' },
  { code: 'aus.w.1', name: 'A-League Women', flag: '🇦🇺' },
  { code: 'can.w.nsl', name: 'Northern Super League', flag: '🇨🇦' },
  { code: 'usa.w.usl.1', name: 'USL Super League', flag: '🇺🇸' },
  { code: 'uefa.wchampions', name: "Women's Champions League", flag: '🏆' },
  { code: 'fifa.wwc', name: "Women's World Cup", flag: '🏆' },
  { code: 'uefa.w.nations', name: "Women's Nations League", flag: '🇪🇺' },
  { code: 'uefa.weuro', name: "Women's Euro", flag: '🇪🇺' },
  { code: 'concacaf.w.gold', name: 'W Gold Cup', flag: '🇺🇸' },
  { code: 'conmebol.america.femenina', name: 'Copa América Femenina', flag: '🌎' },
  { code: 'afc.w.asian.cup', name: "Women's Asian Cup", flag: '🌏' },
  { code: 'caf.w.nations', name: "Women's AFCON", flag: '🌍' },
  { code: 'fifa.friendly.w', name: "Women's Friendly", flag: '🌍' },
];

// New sports league definitions
const MOTOR_SPORT = [
  { code: 'f1', name: 'Formule 1', flag: '🏎️' },
];

const MOTORSPORTS = [
  { code: 'nascar-cup', name: 'NASCAR Cup', flag: '🏁' },
  { code: 'indycar', name: 'IndyCar', flag: '🇺🇸' },
  { code: 'moto-gp', name: 'MotoGP', flag: '🏍️' },
];

const CRICKET = [
  { code: 'ipl', name: 'IPL', flag: '🇮🇳' },
  { code: 'bbl', name: 'Big Bash', flag: '🇦🇺' },
  { code: 'psl', name: 'PSL', flag: '🇵🇰' },
  { code: 'sa20', name: 'SA20', flag: '🇿🇦' },
  { code: 'cpl', name: 'CPL', flag: '🌎' },
  { code: 'icc.wc', name: 'ICC World Cup', flag: '🏆' },
];

const RUGBY = [
  { code: '6nations', name: 'Six Nations', flag: '🇪🇺' },
  { code: 'prem.rugby', name: 'Premiership', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'urc', name: 'URC', flag: '🇪🇺' },
  { code: 'sr', name: 'Super Rugby', flag: '🌏' },
  { code: 'trc', name: 'The Rugby Champ.', flag: '🌎' },
  { code: 'nrl', name: 'NRL', flag: '🇦🇺' },
];

const OTHER = [
  { code: 'nfl', name: 'NFL', flag: '🏈' },
  { code: 'college-football', name: 'NCAA Football', flag: '🏈' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface StandingEntry {
  team: {
    id: string;
    displayName: string;
    shortDisplayName: string;
    abbreviation: string;
    logos?: Array<{ href: string }>;
  };
  note?: {
    color: string;
    description: string;
    rank: number;
  };
  stats: Array<{
    name: string;
    shortDisplayName: string;
    value: number;
    displayValue: string;
  }>;
}

interface UpcomingEvent {
  date: string;
  event: string;
}

interface ParsedStanding {
  league: string;
  flag: string;
  season: string;
  leagueCode: string;
  teams: ParsedTeam[];
  isGroup?: boolean;
  groupName?: string;
  placeholder?: boolean;
  placeholderMessage?: string;
  placeholderInfo?: Record<string, string>;
  upcomingEvents?: UpcomingEvent[];
}

interface ParsedTeam {
  teamId: string;
  leagueCode: string;
  rank: number;
  team: string;
  shortName: string;
  logo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  note: string | null;
  noteColor: string | null;
  // NBA/MLB-specific fields
  winPct?: number;       // Win percentage (e.g., 0.750)
  gamesBehind?: number;  // Games behind conference leader (e.g., 3.5)
  conference?: string;   // Conference name
  // NHL-specific fields
  otLosses?: number;     // NHL overtime losses
  // NFL-specific fields
  ties?: number;          // NFL ties
  // General
  streak?: string;        // Win/loss streak display
}

// ─── Fetch from ESPN API ─────────────────────────────────────────────────────

const ESPN_PRIMARY_BASE = 'https://site.web.api.espn.com/apis/v2/sports/soccer';
const ESPN_FALLBACK_BASE = 'https://site.api.espn.com/apis/v2/sports/soccer';
const ESPN_NBA_PRIMARY = 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings';
const ESPN_NBA_FALLBACK = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';

// New sport ESPN API URLs
const ESPN_MLB_PRIMARY = 'https://site.web.api.espn.com/apis/v2/sports/baseball/mlb/standings';
const ESPN_MLB_FALLBACK = 'https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings';
const ESPN_NHL_PRIMARY = 'https://site.web.api.espn.com/apis/v2/sports/hockey/nhl/standings';
const ESPN_NHL_FALLBACK = 'https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings';
const ESPN_NFL_PRIMARY = 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings';
const ESPN_NFL_FALLBACK = 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings';
const ESPN_CFB_PRIMARY = 'https://site.web.api.espn.com/apis/v2/sports/football/college-football/standings';
const ESPN_CFB_FALLBACK = 'https://site.api.espn.com/apis/v2/sports/football/college-football/standings';
const ESPN_F1_PRIMARY = 'https://site.web.api.espn.com/apis/v2/sports/racing/f1/standings';
const ESPN_F1_FALLBACK = 'https://site.api.espn.com/apis/v2/sports/racing/f1/standings';

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

// Generic ESPN fetch with primary/fallback pattern
async function fetchESPNData(primaryUrl: string, fallbackUrl: string, label: string): Promise<any> {
  const timeout = 12000;

  async function safeParseJson(res: Response): Promise<any> {
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1_000_000) {
      console.warn(`[Standings API] Response too large for ${label}: ${contentLength} bytes, skipping`);
      return null;
    }
    return await res.json();
  }

  let data: any = null;

  try {
    const res = await fetchWithTimeout(primaryUrl, timeout);
    if (res.ok) {
      data = await safeParseJson(res);
    }
  } catch (err: any) {
    console.warn(`[Standings API] ${label} primary URL failed: ${err.message}, trying fallback...`);
  }

  if (!data) {
    try {
      const res = await fetchWithTimeout(fallbackUrl, timeout);
      if (res.ok) {
        data = await safeParseJson(res);
      }
    } catch (err: any) {
      console.warn(`[Standings API] ${label} fallback URL failed: ${err.message}`);
    }
  }

  return data;
}

async function fetchStandingsForLeague(code: string) {
  const primaryUrl = `${ESPN_PRIMARY_BASE}/${code}/standings`;
  const fallbackUrl = `${ESPN_FALLBACK_BASE}/${code}/standings`;
  const timeout = 12000;

  async function safeParseJson(res: Response): Promise<any> {
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1_000_000) {
      console.warn(`[Standings API] Response too large for ${code}: ${contentLength} bytes, skipping`);
      return null;
    }
    return await res.json();
  }

  try {
    const res = await fetchWithTimeout(primaryUrl, timeout);
    if (res.ok) {
      const data = await safeParseJson(res);
      if (data) return data;
    }
    console.warn(`[Standings API] Primary URL failed for ${code}, trying fallback...`);
  } catch (err: any) {
    console.warn(`[Standings API] Primary URL failed for ${code}: ${err.message}, trying fallback...`);
  }

  try {
    const res = await fetchWithTimeout(fallbackUrl, timeout);
    if (res.ok) {
      const data = await safeParseJson(res);
      if (data) return data;
      throw new Error('Réponse trop volumineuse');
    }
    throw new Error(`HTTP ${res.status} des deux sources ESPN`);
  } catch (err: any) {
    if (err.message?.includes('HTTP') || err.message?.includes('volumineuse')) throw err;
    throw new Error(`Impossible de contacter ESPN pour ${code}: ${err.message || 'Timeout'}`);
  }
}

// ─── Parse standings data ────────────────────────────────────────────────────

const MAX_TEAMS_PER_GROUP = 36;

function parseStandings(data: any, leagueName: string, leagueFlag: string, code: string): ParsedStanding[] {
  try {
    const children = data.children || [];
    if (children.length === 0) return [];

    const results: ParsedStanding[] = [];
    const MAX_GROUPS = 12;

    for (const child of children.slice(0, MAX_GROUPS)) {
      if (!child.standings?.entries) continue;

      const entries: StandingEntry[] = child.standings.entries;
      const groupName = child.name || leagueName;

      const teams: ParsedTeam[] = entries.slice(0, MAX_TEAMS_PER_GROUP).map((entry) => {
        const statMap: Record<string, string | number> = {};
        for (const stat of entry.stats) {
          statMap[stat.name] = stat.value;
          statMap[stat.shortDisplayName] = stat.displayValue;
        }

        return {
          teamId: entry.team.id,
          leagueCode: code,
          rank: entry.note?.rank ?? 0,
          team: entry.team.displayName,
          shortName: entry.team.shortDisplayName || entry.team.abbreviation,
          logo: entry.team.logos?.[0]?.href || null,
          played: Number(statMap['gamesPlayed'] || 0),
          wins: Number(statMap['wins'] || 0),
          draws: Number(statMap['ties'] || 0),
          losses: Number(statMap['losses'] || 0),
          goalsFor: Number(statMap['pointsFor'] || 0),
          goalsAgainst: Number(statMap['pointsAgainst'] || 0),
          goalDiff: Number(statMap['pointDifferential'] || 0),
          points: Number(statMap['points'] || 0),
          note: entry.note?.description || null,
          noteColor: entry.note?.color || null,
        };
      });

      teams.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
      teams.forEach((t, i) => { t.rank = i + 1; });

      const isMultiGroup = children.length > 1;
      results.push({
        league: isMultiGroup ? `${leagueName} — ${groupName}` : leagueName,
        flag: leagueFlag,
        season: groupName,
        leagueCode: code,
        teams,
        isGroup: isMultiGroup,
        groupName: isMultiGroup ? groupName : undefined,
      });
    }

    return results;
  } catch {
    return [];
  }
}

// ─── FIFA Rankings ────────────────────────────────────────────────────────────

function getFIFARankings(): ParsedStanding {
  const rankings = [
    { rank: 1, team: 'Argentina', flag: '🇦🇷', points: 1865 },
    { rank: 2, team: 'France', flag: '🇫🇷', points: 1850 },
    { rank: 3, team: 'Spain', flag: '🇪🇸', points: 1832 },
    { rank: 4, team: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', points: 1812 },
    { rank: 5, team: 'Brazil', flag: '🇧🇷', points: 1798 },
    { rank: 6, team: 'Portugal', flag: '🇵🇹', points: 1788 },
    { rank: 7, team: 'Netherlands', flag: '🇳🇱', points: 1770 },
    { rank: 8, team: 'Belgium', flag: '🇧🇪', points: 1759 },
    { rank: 9, team: 'Italy', flag: '🇮🇹', points: 1752 },
    { rank: 10, team: 'Germany', flag: '🇩🇪', points: 1745 },
    { rank: 11, team: 'Colombia', flag: '🇨🇴', points: 1730 },
    { rank: 12, team: 'Morocco', flag: '🇲🇦', points: 1718 },
    { rank: 13, team: 'Uruguay', flag: '🇺🇾', points: 1710 },
    { rank: 14, team: 'Croatia', flag: '🇭🇷', points: 1698 },
    { rank: 15, team: 'Switzerland', flag: '🇨🇭', points: 1685 },
    { rank: 16, team: 'Mexico', flag: '🇲🇽', points: 1672 },
    { rank: 17, team: 'USA', flag: '🇺🇸', points: 1665 },
    { rank: 18, team: 'Japan', flag: '🇯🇵', points: 1655 },
    { rank: 19, team: 'Senegal', flag: '🇸🇳', points: 1648 },
    { rank: 20, team: 'Iran', flag: '🇮🇷', points: 1638 },
    { rank: 21, team: 'Denmark', flag: '🇩🇰', points: 1630 },
    { rank: 22, team: 'Austria', flag: '🇦🇹', points: 1622 },
    { rank: 23, team: 'South Korea', flag: '🇰🇷', points: 1615 },
    { rank: 24, team: 'Turkey', flag: '🇹🇷', points: 1608 },
    { rank: 25, team: 'Ukraine', flag: '🇺🇦', points: 1598 },
    { rank: 26, team: 'Poland', flag: '🇵🇱', points: 1590 },
    { rank: 27, team: 'Serbia', flag: '🇷🇸', points: 1582 },
    { rank: 28, team: 'Ecuador', flag: '🇪🇨', points: 1575 },
    { rank: 29, team: 'Egypt', flag: '🇪🇬', points: 1568 },
    { rank: 30, team: 'Australia', flag: '🇦🇺', points: 1560 },
  ];

  const teams: ParsedTeam[] = rankings.map((r) => ({
    teamId: `fifa_${r.rank}`,
    leagueCode: 'fifa.rankings',
    rank: r.rank,
    team: r.team,
    shortName: r.flag + ' ' + r.team,
    logo: null,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: r.points,
    note: r.rank <= 10 ? 'Top 10' : r.rank <= 20 ? 'Top 20' : null,
    noteColor: r.rank <= 10 ? '81d6ac' : r.rank <= 20 ? '7ec8e3' : null,
  }));

  return {
    league: 'Classement FIFA',
    flag: '🌍',
    season: 'Classement mondial FIFA (Avril 2025)',
    leagueCode: 'fifa.rankings',
    teams,
    isGroup: false,
  };
}

// ─── World Cup 2026 Placeholder ──────────────────────────────────────────────

function getWorldCupPlaceholder(): ParsedStanding {
  const qualifiedTeams = [
    { name: '🇺🇸 États-Unis', region: 'Concacaf' },
    { name: '🇨🇦 Canada', region: 'Concacaf' },
    { name: '🇲🇽 Mexique', region: 'Concacaf' },
    { name: '🇯🇵 Japon', region: 'AFC' },
    { name: '🇰🇷 Corée du Sud', region: 'AFC' },
    { name: '🇮🇷 Iran', region: 'AFC' },
    { name: '🇦🇷 Argentine', region: 'CONMEBOL' },
    { name: '🇧🇷 Brésil', region: 'CONMEBOL' },
    { name: '🇪🇨 Équateur', region: 'CONMEBOL' },
    { name: '🇵🇾 Paraguay', region: 'CONMEBOL' },
    { name: '🇺🇾 Uruguay', region: 'CONMEBOL' },
    { name: '🇨🇴 Colombie', region: 'CONMEBOL' },
    { name: '🇫🇷 France', region: 'UEFA' },
    { name: '🇪🇸 Espagne', region: 'UEFA' },
    { name: '🇬🇧 Angleterre', region: 'UEFA' },
    { name: '🇩🇪 Allemagne', region: 'UEFA' },
    { name: '🇵🇹 Portugal', region: 'UEFA' },
    { name: '🇳🇱 Pays-Bas', region: 'UEFA' },
    { name: '🇮🇹 Italie', region: 'UEFA' },
    { name: '🇧🇪 Belgique', region: 'UEFA' },
    { name: '🇨🇭 Suisse', region: 'UEFA' },
    { name: '🇩🇰 Danemark', region: 'UEFA' },
    { name: '🇦🇹 Autriche', region: 'UEFA' },
    { name: '🇹🇷 Turquie', region: 'UEFA' },
    { name: '🇲🇦 Maroc', region: 'CAF' },
    { name: '🇪🇬 Égypte', region: 'CAF' },
    { name: '🇸🇳 Sénégal', region: 'CAF' },
    { name: '🇨🇲 Cameroun', region: 'CAF' },
    { name: '🇳🇬 Nigeria', region: 'CAF' },
    { name: '🇦🇺 Australie', region: 'AFC' },
  ];

  const upcomingEvents = [
    { date: 'Mars 2026', event: 'Tirage au sort des groupes' },
    { date: '11 juin 2026', event: 'Match d\'ouverture — Mexico' },
    { date: '12-24 juin 2026', event: 'Phase de groupes (12 groupes)' },
    { date: '26 juin — 2 juil.', event: 'Phase de 32e de finale' },
    { date: '4-8 juil.', event: '16e de finale' },
    { date: '11-19 juil.', event: 'Quarts → Finale' },
  ];

  const teams: ParsedTeam[] = qualifiedTeams.map((t, i) => ({
    teamId: `wc2026_${i}`,
    leagueCode: 'fifa.world',
    rank: i + 1,
    team: t.name,
    shortName: t.name,
    logo: null,
    played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    note: t.region,
    noteColor: null,
  }));

  return {
    league: 'Coupe du Monde FIFA 2026',
    flag: '🏆',
    season: 'Prochaine édition',
    leagueCode: 'fifa.world',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'Les groupes et le calendrier de la Coupe du Monde 2026 seront disponibles après le tirage au sort.',
    placeholderInfo: {
      'Pays hôtes': '🇺🇸 États-Unis, 🇨🇦 Canada, 🇲🇽 Mexique',
      'Dates': '11 juin — 19 juillet 2026',
      'Équipes': '48 (première édition à 48 équipes)',
      'Groupes': '12 groupes de 4 équipes',
      'Format': 'Phase de groupes → 32e de finale → Finale',
      'Stades': '16 stades dans 3 pays',
      'Statut': '11 juin — 19 juillet 2026 · Suivez les matchs en direct !',
    },
    upcomingEvents,
  };
}

// ─── Copa América Placeholder ────────────────────────────────────────────────

function getCopaAmericaPlaceholder(): ParsedStanding {
  const teams: ParsedTeam[] = [
    { rank: 1, team: 'Argentine', shortName: '🇦🇷 Argentine', logo: null, teamId: 'ca_arg', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: 'Tenant du titre', noteColor: '81d6ac' },
    { rank: 2, team: 'Brésil', shortName: '🇧🇷 Brésil', logo: null, teamId: 'ca_bra', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 3, team: 'Colombie', shortName: '🇨🇴 Colombie', logo: null, teamId: 'ca_col', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 4, team: 'Uruguay', shortName: '🇺🇾 Uruguay', logo: null, teamId: 'ca_uru', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 5, team: 'Équateur', shortName: '🇪🇨 Équateur', logo: null, teamId: 'ca_ecu', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 6, team: 'Paraguay', shortName: '🇵🇾 Paraguay', logo: null, teamId: 'ca_par', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 7, team: 'Chili', shortName: '🇨🇱 Chili', logo: null, teamId: 'ca_chi', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 8, team: 'Pérou', shortName: '🇵🇪 Pérou', logo: null, teamId: 'ca_per', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 9, team: 'Venezuela', shortName: '🇻🇪 Venezuela', logo: null, teamId: 'ca_ven', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 10, team: 'Bolivie', shortName: '🇧🇴 Bolivie', logo: null, teamId: 'ca_bol', leagueCode: 'conmebol.america', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
  ];
  return {
    league: 'Copa América',
    flag: '🌎',
    season: 'Prochaine édition — 2028',
    leagueCode: 'conmebol.america',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'La prochaine Copa América aura lieu en 2028. Les groupes et le calendrier seront communiqués ultérieurement.',
    placeholderInfo: {
      'Dernière édition': '2024 — Vainqueur: Argentine 🇦🇷',
      'Prochaine édition': '2028',
      'Format': '16 équipes — Phase de groupes puis élimination directe',
      'Participants': '10 CONMEBOL + 6 invités CONCACAF',
    },
  };
}

// ─── Asian Cup Placeholder ───────────────────────────────────────────────────

function getAsianCupPlaceholder(): ParsedStanding {
  const teams: ParsedTeam[] = [
    { rank: 1, team: 'Qatar', shortName: '🇶🇦 Qatar', logo: null, teamId: 'ac_qat', leagueCode: 'afc.asian', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: 'Tenant du titre', noteColor: '81d6ac' },
    { rank: 2, team: 'Japon', shortName: '🇯🇵 Japon', logo: null, teamId: 'ac_jpn', leagueCode: 'afc.asian', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 3, team: 'Corée du Sud', shortName: '🇰🇷 Corée du Sud', logo: null, teamId: 'ac_kor', leagueCode: 'afc.asian', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 4, team: 'Iran', shortName: '🇮🇷 Iran', logo: null, teamId: 'ac_irn', leagueCode: 'afc.asian', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 5, team: 'Arabie Saoudite', shortName: '🇸🇦 Arabie Saoudite', logo: null, teamId: 'ac_ksa', leagueCode: 'afc.asian', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 6, team: 'Australie', shortName: '🇦🇺 Australie', logo: null, teamId: 'ac_aus', leagueCode: 'afc.asian', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 7, team: 'Ouzbékistan', shortName: '🇺🇿 Ouzbékistan', logo: null, teamId: 'ac_uzb', leagueCode: 'afc.asian', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 8, team: 'Iraq', shortName: '🇮🇶 Iraq', logo: null, teamId: 'ac_irq', leagueCode: 'afc.asian', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
  ];
  return {
    league: 'Coupe d\'Asie AFC',
    flag: '🌏',
    season: 'Prochaine édition — 2027',
    leagueCode: 'afc.asian',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'La prochaine Coupe d\'Asie aura lieu en 2027 en Arabie Saoudite. Les qualifications sont en cours.',
    placeholderInfo: {
      'Dernière édition': '2023 — Vainqueur: Qatar 🇶🇦',
      'Prochaine édition': '2027 — Arabie Saoudite 🇸🇦',
      'Format': '24 équipes — Phase de groupes puis élimination directe',
      'Statut': 'Qualifications en cours',
    },
  };
}

// ─── Gold Cup Placeholder ────────────────────────────────────────────────────

function getGoldCupPlaceholder(): ParsedStanding {
  const teams: ParsedTeam[] = [
    { rank: 1, team: 'États-Unis', shortName: '🇺🇸 États-Unis', logo: null, teamId: 'gc_usa', leagueCode: 'concacaf.gold', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: 'Tenant du titre', noteColor: '81d6ac' },
    { rank: 2, team: 'Mexique', shortName: '🇲🇽 Mexique', logo: null, teamId: 'gc_mex', leagueCode: 'concacaf.gold', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 3, team: 'Canada', shortName: '🇨🇦 Canada', logo: null, teamId: 'gc_can', leagueCode: 'concacaf.gold', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 4, team: 'Costa Rica', shortName: '🇨🇷 Costa Rica', logo: null, teamId: 'gc_crc', leagueCode: 'concacaf.gold', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 5, team: 'Jamaïque', shortName: '🇯🇲 Jamaïque', logo: null, teamId: 'gc_jam', leagueCode: 'concacaf.gold', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 6, team: 'Honduras', shortName: '🇭🇳 Honduras', logo: null, teamId: 'gc_hon', leagueCode: 'concacaf.gold', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 7, team: 'Panama', shortName: '🇵🇦 Panama', logo: null, teamId: 'gc_pan', leagueCode: 'concacaf.gold', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 8, team: 'Trinité-et-Tobago', shortName: '🇹🇹 Trinité-et-Tobago', logo: null, teamId: 'gc_tto', leagueCode: 'concacaf.gold', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
  ];
  return {
    league: 'Gold Cup CONCACAF',
    flag: '🇺🇸',
    season: 'Prochaine édition — 2027',
    leagueCode: 'concacaf.gold',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'La prochaine Gold Cup aura lieu en 2027. Les détails seront communiqués ultérieurement.',
    placeholderInfo: {
      'Dernière édition': '2025 — Vainqueur: États-Unis 🇺🇸',
      'Prochaine édition': '2027',
      'Format': '16 équipes — Phase de groupes puis élimination directe',
      'Participants': 'Équipes CONCACAF + invités',
    },
  };
}

// ─── Women's Friendlies Placeholder ──────────────────────────────────────────

function getWomenFriendliesPlaceholder(): ParsedStanding {
  const teams: ParsedTeam[] = [
    { rank: 1, team: 'France 🇫🇷', shortName: '🇫🇷 France', logo: null, teamId: 'wf_fra', leagueCode: 'fifa.friendly.w', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 2, team: 'Angleterre 🏴󠁧󠁢󠁥󠁮󠁧󠁿', shortName: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre', logo: null, teamId: 'wf_eng', leagueCode: 'fifa.friendly.w', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 3, team: 'Espagne 🇪🇸', shortName: '🇪🇸 Espagne', logo: null, teamId: 'wf_esp', leagueCode: 'fifa.friendly.w', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 4, team: 'Allemagne 🇩🇪', shortName: '🇩🇪 Allemagne', logo: null, teamId: 'wf_ger', leagueCode: 'fifa.friendly.w', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 5, team: 'États-Unis 🇺🇸', shortName: '🇺🇸 États-Unis', logo: null, teamId: 'wf_usa', leagueCode: 'fifa.friendly.w', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 6, team: 'Brésil 🇧🇷', shortName: '🇧🇷 Brésil', logo: null, teamId: 'wf_bra', leagueCode: 'fifa.friendly.w', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 7, team: 'Japon 🇯🇵', shortName: '🇯🇵 Japon', logo: null, teamId: 'wf_jpn', leagueCode: 'fifa.friendly.w', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 8, team: 'Canada 🇨🇦', shortName: '🇨🇦 Canada', logo: null, teamId: 'wf_can', leagueCode: 'fifa.friendly.w', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
  ];
  return {
    league: "Matchs Amicaux Féminins",
    flag: '🌍',
    season: 'International — Fenêtres FIFA 2026',
    leagueCode: 'fifa.friendly.w',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: "Les matchs amicaux n'ont pas de classement. Consultez les résultats dans l'onglet Matchs.",
    placeholderInfo: {
      'Prochaine fenêtre': '6–9 juin 2026',
      'Format': 'Matchs amicaux internationaux — pas de classement',
      'Équipes': 'Sélections nationales féminines',
      'Statut': 'Consultez les matchs en direct dans l\'onglet Matchs',
    },
  };
}

// ─── Men's Friendlies Placeholder ──────────────────────────────────────────

function getMenFriendliesPlaceholder(): ParsedStanding {
  const teams: ParsedTeam[] = [
    { rank: 1, team: 'France 🇫🇷', shortName: '🇫🇷 France', logo: null, teamId: 'mf_fra', leagueCode: 'fifa.friendly', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 2, team: 'Argentine 🇦🇷', shortName: '🇦🇷 Argentine', logo: null, teamId: 'mf_arg', leagueCode: 'fifa.friendly', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 3, team: 'Espagne 🇪🇸', shortName: '🇪🇸 Espagne', logo: null, teamId: 'mf_esp', leagueCode: 'fifa.friendly', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 4, team: 'Allemagne 🇩🇪', shortName: '🇩🇪 Allemagne', logo: null, teamId: 'mf_ger', leagueCode: 'fifa.friendly', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 5, team: 'Brésil 🇧🇷', shortName: '🇧🇷 Brésil', logo: null, teamId: 'mf_bra', leagueCode: 'fifa.friendly', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 6, team: 'Angleterre 🏴󠁧󠁢󠁥󠁮󠁧󠁿', shortName: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre', logo: null, teamId: 'mf_eng', leagueCode: 'fifa.friendly', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 7, team: 'Portugal 🇵🇹', shortName: '🇵🇹 Portugal', logo: null, teamId: 'mf_por', leagueCode: 'fifa.friendly', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 8, team: 'Maroc 🇲🇦', shortName: '🇲🇦 Maroc', logo: null, teamId: 'mf_mar', leagueCode: 'fifa.friendly', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
  ];
  return {
    league: 'Matchs Amicaux Internationaux',
    flag: '🤝',
    season: 'International — Fenêtres FIFA 2026',
    leagueCode: 'fifa.friendly',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: "Les matchs amicaux n'ont pas de classement. Consultez les résultats dans l'onglet Matchs.",
    placeholderInfo: {
      'Prochaine fenêtre': 'Mars 2026 (23–31 mars)',
      'Format': 'Matchs amicaux internationaux — pas de classement',
      'Équipes': 'Sélections nationales masculines',
      'Statut': 'Consultez les matchs en direct dans l\'onglet Matchs',
    },
  };
}

// ─── NBA Standings ────────────────────────────────────────────────────────────

async function fetchNBAStandings(): Promise<ParsedStanding[]> {
  const data = await fetchESPNData(ESPN_NBA_PRIMARY, ESPN_NBA_FALLBACK, 'NBA');
  if (!data) throw new Error('Impossible de charger les classements NBA');

  const children = data.children || [];
  if (children.length === 0) return [];

  const results: ParsedStanding[] = [];

  for (const child of children) {
    if (!child.standings?.entries) continue;

    const conferenceName = child.name || 'Conference';
    const entries: StandingEntry[] = child.standings.entries;

    const teams: ParsedTeam[] = entries.slice(0, 16).map((entry: StandingEntry) => {
      const statMap: Record<string, string | number> = {};
      for (const stat of entry.stats) {
        statMap[stat.name] = stat.value;
        statMap[stat.shortDisplayName] = stat.displayValue;
      }

      const winPct = Number(statMap['winPercent'] || 0);
      const gamesBehind = Number(statMap['gamesBehind'] || 0);

      return {
        teamId: entry.team.id,
        leagueCode: 'nba',
        rank: entry.note?.rank ?? 0,
        team: entry.team.displayName,
        shortName: entry.team.shortDisplayName || entry.team.abbreviation,
        logo: entry.team.logos?.[0]?.href || null,
        played: Number(statMap['gamesPlayed'] || 0),
        wins: Number(statMap['wins'] || 0),
        draws: 0,
        losses: Number(statMap['losses'] || 0),
        goalsFor: Number(statMap['pointsFor'] || 0),
        goalsAgainst: Number(statMap['pointsAgainst'] || 0),
        goalDiff: Number(statMap['pointDifferential'] || 0),
        points: Math.round(winPct * 1000),
        note: entry.note?.description || null,
        noteColor: entry.note?.color || null,
        winPct,
        gamesBehind,
        conference: conferenceName.includes('Eastern') ? 'Eastern' : 'Western',
      };
    });

    teams.sort((a, b) => b.points - a.points);
    teams.forEach((t, i) => { t.rank = i + 1; });

    results.push({
      league: `NBA — ${conferenceName}`,
      flag: '🏀',
      season: conferenceName,
      leagueCode: 'nba',
      teams,
      isGroup: true,
      groupName: conferenceName,
    });
  }

  return results;
}

// ─── MLB Standings ────────────────────────────────────────────────────────────

async function fetchMLBStandings(): Promise<ParsedStanding[]> {
  const data = await fetchESPNData(ESPN_MLB_PRIMARY, ESPN_MLB_FALLBACK, 'MLB');
  if (!data) throw new Error('Impossible de charger les classements MLB');

  const children = data.children || [];
  if (children.length === 0) return [];

  const results: ParsedStanding[] = [];

  for (const child of children) {
    if (!child.standings?.entries) continue;

    const leagueName = child.name || 'League';
    const entries: StandingEntry[] = child.standings.entries;

    const teams: ParsedTeam[] = entries.slice(0, 16).map((entry: StandingEntry) => {
      const statMap: Record<string, string | number> = {};
      for (const stat of entry.stats) {
        statMap[stat.name] = stat.value;
        statMap[stat.shortDisplayName] = stat.displayValue;
      }

      const winPct = Number(statMap['winPercent'] || 0);
      const gamesBehind = Number(statMap['gamesBehind'] || 0);

      return {
        teamId: entry.team.id,
        leagueCode: 'mlb',
        rank: entry.note?.rank ?? 0,
        team: entry.team.displayName,
        shortName: entry.team.shortDisplayName || entry.team.abbreviation,
        logo: entry.team.logos?.[0]?.href || null,
        played: Number(statMap['gamesPlayed'] || 0),
        wins: Number(statMap['wins'] || 0),
        draws: 0,
        losses: Number(statMap['losses'] || 0),
        goalsFor: Number(statMap['pointsFor'] || 0),
        goalsAgainst: Number(statMap['pointsAgainst'] || 0),
        goalDiff: Number(statMap['pointDifferential'] || 0),
        points: Math.round(winPct * 1000),
        note: entry.note?.description || null,
        noteColor: entry.note?.color || null,
        winPct,
        gamesBehind,
        conference: leagueName.includes('American') ? 'AL' : 'NL',
      };
    });

    teams.sort((a, b) => b.points - a.points);
    teams.forEach((t, i) => { t.rank = i + 1; });

    results.push({
      league: `MLB — ${leagueName}`,
      flag: '⚾',
      season: leagueName,
      leagueCode: 'mlb',
      teams,
      isGroup: true,
      groupName: leagueName,
    });
  }

  return results;
}

// ─── NHL Standings ────────────────────────────────────────────────────────────

async function fetchNHLStandings(): Promise<ParsedStanding[]> {
  const data = await fetchESPNData(ESPN_NHL_PRIMARY, ESPN_NHL_FALLBACK, 'NHL');
  if (!data) throw new Error('Impossible de charger les classements NHL');

  const children = data.children || [];
  if (children.length === 0) return [];

  const results: ParsedStanding[] = [];

  for (const child of children) {
    if (!child.standings?.entries) continue;

    const conferenceName = child.name || 'Conference';
    const entries: StandingEntry[] = child.standings.entries;

    const teams: ParsedTeam[] = entries.slice(0, 16).map((entry: StandingEntry) => {
      const statMap: Record<string, string | number> = {};
      for (const stat of entry.stats) {
        statMap[stat.name] = stat.value;
        statMap[stat.shortDisplayName] = stat.displayValue;
      }

      const otLosses = Number(statMap['otLosses'] || 0);
      const points = Number(statMap['points'] || 0);
      const gamesBehind = Number(statMap['gamesBehind'] || 0);

      return {
        teamId: entry.team.id,
        leagueCode: 'nhl',
        rank: entry.note?.rank ?? 0,
        team: entry.team.displayName,
        shortName: entry.team.shortDisplayName || entry.team.abbreviation,
        logo: entry.team.logos?.[0]?.href || null,
        played: Number(statMap['gamesPlayed'] || 0),
        wins: Number(statMap['wins'] || 0),
        draws: otLosses,
        losses: Number(statMap['losses'] || 0),
        goalsFor: Number(statMap['pointsFor'] || 0),
        goalsAgainst: Number(statMap['pointsAgainst'] || 0),
        goalDiff: Number(statMap['pointDifferential'] || 0),
        points,
        note: entry.note?.description || null,
        noteColor: entry.note?.color || null,
        otLosses,
        gamesBehind,
        conference: conferenceName.includes('Eastern') ? 'Eastern' : 'Western',
      };
    });

    teams.sort((a, b) => b.points - a.points);
    teams.forEach((t, i) => { t.rank = i + 1; });

    results.push({
      league: `NHL — ${conferenceName}`,
      flag: '🏒',
      season: conferenceName,
      leagueCode: 'nhl',
      teams,
      isGroup: true,
      groupName: conferenceName,
    });
  }

  return results;
}

// ─── NFL Standings ────────────────────────────────────────────────────────────

async function fetchNFLStandings(): Promise<ParsedStanding[]> {
  const data = await fetchESPNData(ESPN_NFL_PRIMARY, ESPN_NFL_FALLBACK, 'NFL');
  if (!data) throw new Error('Impossible de charger les classements NFL');

  const children = data.children || [];
  if (children.length === 0) return [];

  const results: ParsedStanding[] = [];

  for (const child of children) {
    if (!child.standings?.entries) continue;

    const conferenceName = child.name || 'Conference';
    const entries: StandingEntry[] = child.standings.entries;

    const teams: ParsedTeam[] = entries.slice(0, 16).map((entry: StandingEntry) => {
      const statMap: Record<string, string | number> = {};
      for (const stat of entry.stats) {
        statMap[stat.name] = stat.value;
        statMap[stat.shortDisplayName] = stat.displayValue;
      }

      const winPct = Number(statMap['winPercent'] || 0);
      const gamesBehind = Number(statMap['gamesBehind'] || 0);
      const ties = Number(statMap['ties'] || 0);
      const gamesPlayed = Number(statMap['gamesPlayed'] || 0);

      return {
        teamId: entry.team.id,
        leagueCode: 'nfl',
        rank: entry.note?.rank ?? 0,
        team: entry.team.displayName,
        shortName: entry.team.shortDisplayName || entry.team.abbreviation,
        logo: entry.team.logos?.[0]?.href || null,
        played: gamesPlayed,
        wins: Number(statMap['wins'] || 0),
        draws: ties,
        losses: Number(statMap['losses'] || 0),
        goalsFor: Number(statMap['pointsFor'] || 0),
        goalsAgainst: Number(statMap['pointsAgainst'] || 0),
        goalDiff: Number(statMap['pointDifferential'] || 0),
        points: Math.round(winPct * 1000),
        note: entry.note?.description || null,
        noteColor: entry.note?.color || null,
        winPct,
        gamesBehind,
        ties,
        conference: conferenceName.includes('AFC') ? 'AFC' : 'NFC',
      };
    });

    teams.sort((a, b) => b.points - a.points);
    teams.forEach((t, i) => { t.rank = i + 1; });

    results.push({
      league: `NFL — ${conferenceName}`,
      flag: '🏈',
      season: conferenceName,
      leagueCode: 'nfl',
      teams,
      isGroup: true,
      groupName: conferenceName,
    });
  }

  return results;
}

// ─── College Football Standings ───────────────────────────────────────────────

async function fetchCollegeFootballStandings(): Promise<ParsedStanding[]> {
  const data = await fetchESPNData(ESPN_CFB_PRIMARY, ESPN_CFB_FALLBACK, 'CFB');
  if (!data) throw new Error('Impossible de charger les classements NCAA Football');

  const children = data.children || [];
  if (children.length === 0) return [];

  const results: ParsedStanding[] = [];
  const MAX_GROUPS = 12;

  for (const child of children.slice(0, MAX_GROUPS)) {
    if (!child.standings?.entries) continue;

    const conferenceName = child.name || 'Conference';
    const entries: StandingEntry[] = child.standings.entries;

    const teams: ParsedTeam[] = entries.slice(0, 16).map((entry: StandingEntry) => {
      const statMap: Record<string, string | number> = {};
      for (const stat of entry.stats) {
        statMap[stat.name] = stat.value;
        statMap[stat.shortDisplayName] = stat.displayValue;
      }

      const winPct = Number(statMap['winPercent'] || 0);
      const gamesBehind = Number(statMap['gamesBehind'] || 0);
      const ties = Number(statMap['ties'] || 0);

      return {
        teamId: entry.team.id,
        leagueCode: 'college-football',
        rank: entry.note?.rank ?? 0,
        team: entry.team.displayName,
        shortName: entry.team.shortDisplayName || entry.team.abbreviation,
        logo: entry.team.logos?.[0]?.href || null,
        played: Number(statMap['gamesPlayed'] || 0),
        wins: Number(statMap['wins'] || 0),
        draws: ties,
        losses: Number(statMap['losses'] || 0),
        goalsFor: Number(statMap['pointsFor'] || 0),
        goalsAgainst: Number(statMap['pointsAgainst'] || 0),
        goalDiff: Number(statMap['pointDifferential'] || 0),
        points: Math.round(winPct * 1000),
        note: entry.note?.description || null,
        noteColor: entry.note?.color || null,
        winPct,
        gamesBehind,
        ties,
      };
    });

    teams.sort((a, b) => b.points - a.points);
    teams.forEach((t, i) => { t.rank = i + 1; });

    results.push({
      league: `NCAA Football — ${conferenceName}`,
      flag: '🏈',
      season: conferenceName,
      leagueCode: 'college-football',
      teams,
      isGroup: true,
      groupName: conferenceName,
    });
  }

  return results;
}

// ─── F1 Standings ─────────────────────────────────────────────────────────────

async function fetchF1Standings(): Promise<ParsedStanding[]> {
  const data = await fetchESPNData(ESPN_F1_PRIMARY, ESPN_F1_FALLBACK, 'F1');
  if (!data) throw new Error('Impossible de charger les classements F1');

  const children = data.children || [];
  if (children.length === 0) return [];

  const results: ParsedStanding[] = [];

  for (const child of children) {
    if (!child.standings?.entries) continue;

    const standingType = child.name || 'Standings';
    const entries = child.standings.entries;

    const teams: ParsedTeam[] = entries.slice(0, 25).map((entry: any) => {
      // F1 driver entries use `athlete` field, constructor entries use `team` field
      const isDriver = !!entry.athlete;
      const entity = isDriver ? entry.athlete : entry.team;

      const statMap: Record<string, string | number> = {};
      for (const stat of entry.stats) {
        statMap[stat.name] = stat.value;
        statMap[stat.shortDisplayName] = stat.displayValue;
      }

      const pts = Number(statMap['championshipPts'] || statMap['points'] || 0);
      const rank = Number(statMap['rank'] || entry.note?.rank || 0);

      return {
        teamId: entity?.id || `f1_${rank}`,
        leagueCode: 'f1',
        rank,
        team: entity?.displayName || 'Unknown',
        shortName: isDriver
          ? (entity?.shortName || entity?.displayName || '???')
          : (entity?.shortDisplayName || entity?.displayName || '???'),
        logo: isDriver
          ? (entity?.flag?.href || entity?.headshot?.href || null)
          : (entity?.logos?.[0]?.href || null),
        played: 0,
        wins: Number(statMap['wins'] || 0),
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: pts,
        note: isDriver ? 'Driver' : 'Constructor',
        noteColor: isDriver ? '7ec8e3' : '81d6ac',
      };
    });

    teams.sort((a, b) => a.rank - b.rank || b.points - a.points);

    results.push({
      league: `F1 — ${standingType}`,
      flag: '🏎️',
      season: standingType,
      leagueCode: 'f1',
      teams,
      isGroup: true,
      groupName: standingType,
    });
  }

  return results;
}

// ─── NASCAR Cup Placeholder ──────────────────────────────────────────────────

function getNASCARPlaceholder(): ParsedStanding {
  const drivers = [
    { name: 'Ryan Blaney', shortName: '🇺🇸 Blaney' },
    { name: 'William Byron', shortName: '🇺🇸 Byron' },
    { name: 'Kyle Larson', shortName: '🇺🇸 Larson' },
    { name: 'Denny Hamlin', shortName: '🇺🇸 Hamlin' },
    { name: 'Chase Elliott', shortName: '🇺🇸 Elliott' },
    { name: 'Martin Truex Jr.', shortName: '🇺🇸 Truex Jr.' },
    { name: 'Ross Chastain', shortName: '🇺🇸 Chastain' },
    { name: 'Christopher Bell', shortName: '🇺🇸 Bell' },
    { name: 'Tyler Reddick', shortName: '🇺🇸 Reddick' },
    { name: 'Joey Logano', shortName: '🇺🇸 Logano' },
  ];

  const teams: ParsedTeam[] = drivers.map((d, i) => ({
    teamId: `nascar_${i}`,
    leagueCode: 'nascar-cup',
    rank: i + 1,
    team: d.name,
    shortName: d.shortName,
    logo: null,
    played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    note: null, noteColor: null,
  }));

  return {
    league: 'NASCAR Cup Series',
    flag: '🏁',
    season: 'Hors saison',
    leagueCode: 'nascar-cup',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'Les classements NASCAR Cup ne sont pas disponibles actuellement — hors saison.',
    placeholderInfo: {
      'Champion en titre': 'Ryan Blaney 🇺🇸',
      'Prochaine saison': '2026',
      'Format': '36 courses — Playoffs Chase',
      'Statut': 'Hors saison — classements disponibles en février',
    },
  };
}

// ─── IndyCar Placeholder ─────────────────────────────────────────────────────

function getIndyCarPlaceholder(): ParsedStanding {
  const drivers = [
    { name: 'Álex Palou', shortName: '🇪🇸 Palou' },
    { name: 'Scott Dixon', shortName: '🇳🇿 Dixon' },
    { name: 'Josef Newgarden', shortName: '🇺🇸 Newgarden' },
    { name: 'Patricio O\'Ward', shortName: '🇲🇽 O\'Ward' },
    { name: 'Will Power', shortName: '🇦🇺 Power' },
    { name: 'Colton Herta', shortName: '🇺🇸 Herta' },
  ];

  const teams: ParsedTeam[] = drivers.map((d, i) => ({
    teamId: `indy_${i}`,
    leagueCode: 'indycar',
    rank: i + 1,
    team: d.name,
    shortName: d.shortName,
    logo: null,
    played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    note: null, noteColor: null,
  }));

  return {
    league: 'IndyCar Series',
    flag: '🇺🇸',
    season: 'Hors saison',
    leagueCode: 'indycar',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'Les classements IndyCar ne sont pas disponibles actuellement — hors saison.',
    placeholderInfo: {
      'Champion en titre': 'Álex Palou 🇪🇸',
      'Prochaine saison': '2026',
      'Format': '17 courses — incl. Indianapolis 500',
      'Statut': 'Hors saison — classements disponibles en mars',
    },
  };
}

// ─── MotoGP Placeholder ──────────────────────────────────────────────────────

function getMotoGPPlaceholder(): ParsedStanding {
  const riders = [
    { name: 'Jorge Martín', shortName: '🇪🇸 Martín' },
    { name: 'Francesco Bagnaia', shortName: '🇮🇹 Bagnaia' },
    { name: 'Marc Márquez', shortName: '🇪🇸 Márquez' },
    { name: 'Enea Bastianini', shortName: '🇮🇹 Bastianini' },
    { name: 'Brad Binder', shortName: '🇿🇦 Binder' },
    { name: 'Pedro Acosta', shortName: '🇪🇸 Acosta' },
  ];

  const teams: ParsedTeam[] = riders.map((r, i) => ({
    teamId: `motogp_${i}`,
    leagueCode: 'moto-gp',
    rank: i + 1,
    team: r.name,
    shortName: r.shortName,
    logo: null,
    played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    note: null, noteColor: null,
  }));

  return {
    league: 'MotoGP',
    flag: '🏍️',
    season: 'Hors saison',
    leagueCode: 'moto-gp',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'Les classements MotoGP ne sont pas disponibles actuellement — hors saison.',
    placeholderInfo: {
      'Champion en titre': 'Jorge Martín 🇪🇸',
      'Prochaine saison': '2026',
      'Format': '20+ Grand Prix — Sprint + Course',
      'Statut': 'Hors saison — classements disponibles en mars',
    },
  };
}

// ─── IPL Placeholder ──────────────────────────────────────────────────────────

function getIPLPlaceholder(): ParsedStanding {
  const teams: ParsedTeam[] = [
    { rank: 1, team: 'Kolkata Knight Riders', shortName: '🇮🇳 KKR', logo: null, teamId: 'ipl_kkr', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: 'Tenant du titre', noteColor: '81d6ac' },
    { rank: 2, team: 'Chennai Super Kings', shortName: '🇮🇳 CSK', logo: null, teamId: 'ipl_csk', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 3, team: 'Mumbai Indians', shortName: '🇮🇳 MI', logo: null, teamId: 'ipl_mi', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 4, team: 'Royal Challengers Bengaluru', shortName: '🇮🇳 RCB', logo: null, teamId: 'ipl_rcb', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 5, team: 'Rajasthan Royals', shortName: '🇮🇳 RR', logo: null, teamId: 'ipl_rr', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 6, team: 'Sunrisers Hyderabad', shortName: '🇮🇳 SRH', logo: null, teamId: 'ipl_srh', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 7, team: 'Delhi Capitals', shortName: '🇮🇳 DC', logo: null, teamId: 'ipl_dc', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 8, team: 'Punjab Kings', shortName: '🇮🇳 PBKS', logo: null, teamId: 'ipl_pbks', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 9, team: 'Lucknow Super Giants', shortName: '🇮🇳 LSG', logo: null, teamId: 'ipl_lsg', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 10, team: 'Gujarat Titans', shortName: '🇮🇳 GT', logo: null, teamId: 'ipl_gt', leagueCode: 'ipl', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
  ];

  return {
    league: 'IPL — Indian Premier League',
    flag: '🇮🇳',
    season: 'Hors saison',
    leagueCode: 'ipl',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'Les classements IPL ne sont pas disponibles actuellement — hors saison.',
    placeholderInfo: {
      'Champion en titre': 'Kolkata Knight Riders 🇮🇳',
      'Prochaine saison': 'IPL 2026 (mars-mai)',
      'Format': '10 équipes — Phase de groupes + Playoffs',
      'Statut': 'Hors saison — classements disponibles en mars',
    },
  };
}

// ─── Six Nations Placeholder ─────────────────────────────────────────────────

function getSixNationsPlaceholder(): ParsedStanding {
  const teams: ParsedTeam[] = [
    { rank: 1, team: 'France', shortName: '🇫🇷 France', logo: null, teamId: '6n_fra', leagueCode: '6nations', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 2, team: 'Ireland', shortName: '🇮🇪 Ireland', logo: null, teamId: '6n_ire', leagueCode: '6nations', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 3, team: 'England', shortName: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', logo: null, teamId: '6n_eng', leagueCode: '6nations', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 4, team: 'Scotland', shortName: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland', logo: null, teamId: '6n_sco', leagueCode: '6nations', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 5, team: 'Wales', shortName: '🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales', logo: null, teamId: '6n_wal', leagueCode: '6nations', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
    { rank: 6, team: 'Italy', shortName: '🇮🇹 Italy', logo: null, teamId: '6n_ita', leagueCode: '6nations', played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, note: null, noteColor: null },
  ];

  return {
    league: 'Six Nations',
    flag: '🇪🇺',
    season: 'Prochaine édition — 2026',
    leagueCode: '6nations',
    teams,
    isGroup: false,
    placeholder: true,
    placeholderMessage: 'Les classements du Tournoi des Six Nations ne sont pas disponibles actuellement.',
    placeholderInfo: {
      'Prochaine édition': 'Février-Mars 2026',
      'Format': '6 équipes — Tournoi toutes rondes',
      'Statut': 'Hors saison — classements disponibles en février',
    },
  };
}

// ─── UFC Rankings Placeholder ────────────────────────────────────────────────

function getUFCRankingsPlaceholder(): ParsedStanding[] {
  const weightClasses = [
    {
      name: "Women's Bantamweight",
      code: 'w-bw',
      fighters: [
        { name: 'Julianna Peña', shortName: '🇺🇸 Peña' },
        { name: 'Raquel Pennington', shortName: '🇺🇸 Pennington' },
        { name: 'Kayla Harrison', shortName: '🇺🇸 Harrison' },
        { name: 'Holly Holm', shortName: '🇺🇸 Holm' },
        { name: 'Ketlen Vieira', shortName: '🇧🇷 Vieira' },
      ],
    },
    {
      name: "Women's Flyweight",
      code: 'w-flw',
      fighters: [
        { name: 'Valentina Shevchenko', shortName: '🇰🇬 Shevchenko' },
        { name: 'Manon Fiorot', shortName: '🇫🇷 Fiorot' },
        { name: 'Erin Blanchfield', shortName: '🇺🇸 Blanchfield' },
        { name: 'Maycee Barber', shortName: '🇺🇸 Barber' },
        { name: 'Natália Silva', shortName: '🇧🇷 Silva' },
      ],
    },
    {
      name: 'Heavyweight',
      code: 'hw',
      fighters: [
        { name: 'Jon Jones', shortName: '🇺🇸 Jones' },
        { name: 'Tom Aspinall', shortName: '🇬🇧 Aspinall' },
        { name: 'Stipe Miocic', shortName: '🇺🇸 Miocic' },
        { name: 'Ciryl Gane', shortName: '🇫🇷 Gane' },
        { name: 'Alexander Volkov', shortName: '🇷🇺 Volkov' },
      ],
    },
    {
      name: 'Light Heavyweight',
      code: 'lhw',
      fighters: [
        { name: 'Alex Pereira', shortName: '🇧🇷 Pereira' },
        { name: 'Magomed Ankalaev', shortName: '🇷🇺 Ankalaev' },
        { name: 'Jiri Prochazka', shortName: '🇨🇿 Prochazka' },
        { name: 'Jamahal Hill', shortName: '🇺🇸 Hill' },
        { name: 'Jan Błachowicz', shortName: '🇵🇱 Błachowicz' },
      ],
    },
    {
      name: 'Middleweight',
      code: 'mw',
      fighters: [
        { name: 'Dricus du Plessis', shortName: '🇿🇦 du Plessis' },
        { name: 'Sean Strickland', shortName: '🇺🇸 Strickland' },
        { name: 'Israel Adesanya', shortName: '🇳🇿 Adesanya' },
        { name: 'Robert Whittaker', shortName: '🇦🇺 Whittaker' },
        { name: 'Khamzat Chimaev', shortName: '🇸🇪 Chimaev' },
      ],
    },
    {
      name: 'Welterweight',
      code: 'ww',
      fighters: [
        { name: 'Belal Muhammad', shortName: '🇺🇸 Muhammad' },
        { name: 'Shavkat Rakhmonov', shortName: '🇰🇿 Rakhmonov' },
        { name: 'Kamaru Usman', shortName: '🇳🇬 Usman' },
        { name: 'Leon Edwards', shortName: '🇬🇧 Edwards' },
        { name: 'Jack Della Maddalena', shortName: '🇦🇺 Maddalena' },
      ],
    },
    {
      name: 'Lightweight',
      code: 'lw',
      fighters: [
        { name: 'Islam Makhachev', shortName: '🇷🇺 Makhachev' },
        { name: 'Arman Tsarukyan', shortName: '🇦🇲 Tsarukyan' },
        { name: 'Dustin Poirier', shortName: '🇺🇸 Poirier' },
        { name: 'Justin Gaethje', shortName: '🇺🇸 Gaethje' },
        { name: 'Charles Oliveira', shortName: '🇧🇷 Oliveira' },
      ],
    },
    {
      name: 'Featherweight',
      code: 'fw',
      fighters: [
        { name: 'Ilia Topuria', shortName: '🇬🇪 Topuria' },
        { name: 'Alexander Volkanovski', shortName: '🇦🇺 Volkanovski' },
        { name: 'Brian Ortega', shortName: '🇺🇸 Ortega' },
        { name: 'Yair Rodríguez', shortName: '🇲🇽 Rodríguez' },
        { name: 'Movsar Evloev', shortName: '🇷🇺 Evloev' },
      ],
    },
    {
      name: 'Bantamweight',
      code: 'bw',
      fighters: [
        { name: 'Merab Dvalishvili', shortName: '🇬🇪 Dvalishvili' },
        { name: 'Sean O\'Malley', shortName: '🇺🇸 O\'Malley' },
        { name: 'Umar Nurmagomedov', shortName: '🇷🇺 Nurmagomedov' },
        { name: 'Petr Yan', shortName: '🇷🇺 Yan' },
        { name: 'Deiveson Figueiredo', shortName: '🇧🇷 Figueiredo' },
      ],
    },
    {
      name: 'Flyweight',
      code: 'flw',
      fighters: [
        { name: 'Alexandre Pantoja', shortName: '🇧🇷 Pantoja' },
        { name: 'Kai Kara-France', shortName: '🇳🇿 Kara-France' },
        { name: 'Amir Albazi', shortName: '🇮🇶 Albazi' },
        { name: 'Brandon Moreno', shortName: '🇲🇽 Moreno' },
        { name: 'Tatsuro Taira', shortName: '🇯🇵 Taira' },
      ],
    },
  ];

  return weightClasses.map((wc) => ({
    league: `UFC — ${wc.name}`,
    flag: '🥊',
    season: wc.name,
    leagueCode: 'ufc.rankings',
    teams: wc.fighters.map((f, i) => ({
      teamId: `ufc_${wc.code}_${i}`,
      leagueCode: 'ufc.rankings',
      rank: i + 1,
      team: f.name,
      shortName: f.shortName,
      logo: null,
      played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
      note: i === 0 ? 'Champion' : null,
      noteColor: i === 0 ? '81d6ac' : null,
    })),
    isGroup: true,
    groupName: wc.name,
    placeholder: true,
    placeholderMessage: `Classement UFC ${wc.name} — données non disponibles en temps réel.`,
    placeholderInfo: {
      'Organisation': 'UFC (Ultimate Fighting Championship)',
      'Catégorie': wc.name,
      'Statut': 'Classements indicatifs — mis à jour après chaque événement',
    },
  }));
}

// ─── Boxing Rankings Placeholder ─────────────────────────────────────────────

function getBoxingRankingsPlaceholder(): ParsedStanding[] {
  const weightClasses = [
    {
      name: 'Heavyweight (+200 lbs)',
      code: 'hw',
      fighters: [
        { name: 'Oleksandr Usyk', shortName: '🇺🇦 Usyk' },
        { name: 'Tyson Fury', shortName: '🇬🇧 Fury' },
        { name: 'Anthony Joshua', shortName: '🇬🇧 Joshua' },
        { name: 'Zhilei Zhang', shortName: '🇨🇳 Zhang' },
        { name: 'Joseph Parker', shortName: '🇳🇿 Parker' },
      ],
    },
    {
      name: 'Light Heavyweight (175 lbs)',
      code: 'lhw',
      fighters: [
        { name: 'Dmitry Bivol', shortName: '🇷🇺 Bivol' },
        { name: 'Artur Beterbiev', shortName: '🇷🇺 Beterbiev' },
        { name: 'David Benavídez', shortName: '🇺🇸 Benavídez' },
      ],
    },
    {
      name: 'Super Middleweight (168 lbs)',
      code: 'smw',
      fighters: [
        { name: 'Canelo Álvarez', shortName: '🇲🇽 Canelo' },
        { name: 'David Benavídez', shortName: '🇺🇸 Benavídez' },
        { name: 'Jermall Charlo', shortName: '🇺🇸 Charlo' },
      ],
    },
    {
      name: 'Welterweight (147 lbs)',
      code: 'ww',
      fighters: [
        { name: 'Terence Crawford', shortName: '🇺🇸 Crawford' },
        { name: 'Errol Spence Jr.', shortName: '🇺🇸 Spence Jr.' },
        { name: 'Jaron Ennis', shortName: '🇺🇸 Ennis' },
      ],
    },
    {
      name: 'Lightweight (135 lbs)',
      code: 'lw',
      fighters: [
        { name: 'Gervonta Davis', shortName: '🇺🇸 Davis' },
        { name: 'Vasiliy Lomachenko', shortName: '🇺🇦 Lomachenko' },
        { name: 'Devin Haney', shortName: '🇺🇸 Haney' },
        { name: 'Shakur Stevenson', shortName: '🇺🇸 Stevenson' },
      ],
    },
  ];

  return weightClasses.map((wc) => ({
    league: `Boxing — ${wc.name}`,
    flag: '🥊',
    season: wc.name,
    leagueCode: 'boxing.rankings',
    teams: wc.fighters.map((f, i) => ({
      teamId: `boxing_${wc.code}_${i}`,
      leagueCode: 'boxing.rankings',
      rank: i + 1,
      team: f.name,
      shortName: f.shortName,
      logo: null,
      played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
      note: i === 0 ? 'Champion' : null,
      noteColor: i === 0 ? '81d6ac' : null,
    })),
    isGroup: true,
    groupName: wc.name,
    placeholder: true,
    placeholderMessage: `Classement boxing ${wc.name} — données indicatives.`,
    placeholderInfo: {
      'Organisation': 'WBA / WBC / IBF / WBO',
      'Catégorie': wc.name,
      'Statut': 'Classements indicatifs — multiples organismes de sanction',
    },
  }));
}

// ─── Friendly error messages ─────────────────────────────────────────────────

function getFriendlyErrorMessage(code: string, leagueName: string, originalError: string): string {
  switch (code) {
    case 'uefa.euro':
      return `${leagueName}: Les données de l'Euro ne sont pas encore disponibles pour le prochain tournoi`;
    case 'uefa.nations':
      return `${leagueName}: Les données de la Ligue des Nations ne sont pas disponibles — la compétition est peut-être entre deux éditions`;
    case 'caf.nations':
      return `${leagueName}: Les données de la CAN ne sont pas disponibles actuellement`;
    case 'uefa.champions':
      return `${leagueName}: Les données ne sont pas disponibles — la compétition est peut-être en pause`;
    case 'uefa.europa':
      return `${leagueName}: Les données ne sont pas disponibles — la compétition est peut-être en pause`;
    case 'uefa.europa.conf':
      return `${leagueName}: Les données ne sont pas disponibles — la compétition est peut-être en pause`;
    case 'conmebol.libertadores':
      return `${leagueName}: Les données ne sont pas disponibles actuellement — la compétition est peut-être en pause entre les phases`;
    case 'conmebol.sudamericana':
      return `${leagueName}: Les données ne sont pas disponibles actuellement — la compétition est peut-être en pause entre les phases`;
    case 'afc.champions':
      return `${leagueName}: Les données ne sont pas disponibles actuellement — la compétition est peut-être en pause entre les phases`;
    case 'caf.champions':
      return `${leagueName}: Les données ne sont pas disponibles actuellement — la compétition est peut-être en pause entre les phases`;
    case 'conmebol.america':
      return `${leagueName}: La Copa América n'a pas de classement en cours — le prochain tournoi sera en 2028`;
    case 'concacaf.gold':
      return `${leagueName}: La Gold Cup n'a pas de classement en cours — le prochain tournoi sera en 2027`;
    case 'afc.asian':
      return `${leagueName}: La Coupe d'Asie n'a pas de classement en cours — le prochain tournoi sera en 2027`;
    case 'ksa.1':
      return `${leagueName}: Les données ne sont pas disponibles actuellement`;
    case 'fifa.friendly.w':
      return `${leagueName}: Les matchs amicaux n'ont pas de classement — consultez les résultats dans l'onglet Matchs`;
    case 'fifa.friendly':
      return `${leagueName}: Les matchs amicaux n'ont pas de classement — consultez les résultats dans l'onglet Matchs`;
    case 'fifa.wwc':
      return `${leagueName}: Les données de la Coupe du Monde Féminine ne sont pas disponibles actuellement — la prochaine édition aura lieu en 2027`;
    case 'uefa.weuro':
      return `${leagueName}: Les données du Championnat d'Europe Féminin ne sont pas disponibles actuellement`;
    case 'uefa.w.nations':
      return `${leagueName}: Les données de la Ligue des Nations Féminine ne sont pas disponibles — la compétition est peut-être entre deux éditions`;
    case 'concacaf.w.gold':
      return `${leagueName}: Les données de la W Gold Cup ne sont pas disponibles actuellement`;
    case 'conmebol.america.femenina':
      return `${leagueName}: Les données de la Copa América Femenina ne sont pas disponibles actuellement`;
    case 'afc.w.asian.cup':
      return `${leagueName}: Les données de la Coupe d'Asie Féminine ne sont pas disponibles actuellement`;
    case 'caf.w.nations':
      return `${leagueName}: Les données de la CAN Féminine ne sont pas disponibles actuellement`;
    case 'uefa.wchampions':
      return `${leagueName}: Les données de la Ligue des Champions Féminine ne sont pas disponibles — la compétition est peut-être en pause`;
    default:
      return `${leagueName}: ${originalError || 'Données non disponibles'}`;
  }
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'championnats';
    const league = searchParams.get('league');

    const cacheKey = league ? `standings-${league}` : `standings-${category}`;

    const cached = getCached<any>(cacheKey);
    if (cached) {
      const age = getCacheAge(cacheKey);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
      });
    }

    let leaguesToFetch: Array<{ code: string; name: string; flag: string }>;
    let includeFIFARankings = false;
    let includeWorldCupPlaceholder = false;
    let includeCopaAmericaPlaceholder = false;
    let includeAsianCupPlaceholder = false;
    let includeGoldCupPlaceholder = false;
    let includeWomenFriendliesPlaceholder = false;
    let includeMenFriendliesPlaceholder = false;

    // Competitions that are placeholders (not available from ESPN API or handled separately)
    const PLACEHOLDER_CODES = new Set([
      'fifa.rankings', 'fifa.world', 'fifa.friendly', 'conmebol.america', 'afc.asian', 'concacaf.gold', 'fifa.friendly.w',
      // New placeholder codes
      'nascar-cup', 'indycar', 'moto-gp',
      'ipl', 'bbl', 'psl', 'sa20', 'cpl', 'icc.wc',
      '6nations', 'prem.rugby', 'urc', 'sr', 'trc', 'nrl',
      'ufc.rankings', 'boxing.rankings',
    ]);

    // Specific league routing
    if (league === 'fifa.rankings') {
      includeFIFARankings = true;
      leaguesToFetch = [];
    } else if (league === 'fifa.friendly') {
      includeMenFriendliesPlaceholder = true;
      leaguesToFetch = [];
    } else if (league === 'fifa.friendly.w') {
      includeWomenFriendliesPlaceholder = true;
      leaguesToFetch = [];
    } else if (league === 'fifa.world') {
      includeWorldCupPlaceholder = true;
      leaguesToFetch = [];
    } else if (league === 'conmebol.america') {
      includeCopaAmericaPlaceholder = true;
      leaguesToFetch = [];
    } else if (league === 'afc.asian') {
      includeAsianCupPlaceholder = true;
      leaguesToFetch = [];
    } else if (league === 'concacaf.gold') {
      includeGoldCupPlaceholder = true;
      leaguesToFetch = [];
    } else if (league === 'nba') {
      leaguesToFetch = [];
    } else if (league === 'mlb') {
      leaguesToFetch = [];
    } else if (league === 'nhl') {
      leaguesToFetch = [];
    } else if (league === 'nfl') {
      leaguesToFetch = [];
    } else if (league === 'college-football') {
      leaguesToFetch = [];
    } else if (league === 'f1') {
      leaguesToFetch = [];
    } else if (league === 'nascar-cup') {
      leaguesToFetch = [];
    } else if (league === 'indycar') {
      leaguesToFetch = [];
    } else if (league === 'moto-gp') {
      leaguesToFetch = [];
    } else if (league === 'ipl') {
      leaguesToFetch = [];
    } else if (league === '6nations') {
      leaguesToFetch = [];
    } else if (league === 'ufc.rankings') {
      leaguesToFetch = [];
    } else if (league === 'boxing.rankings') {
      leaguesToFetch = [];
    } else if (league) {
      if (PLACEHOLDER_CODES.has(league)) {
        leaguesToFetch = [];
      } else {
        const allLeagues = [...CHAMPIONNATS, ...COUPES_CLUBS, ...NATIONALES, ...FEMININES];
        leaguesToFetch = allLeagues.filter((l) => l.code === league);
        if (leaguesToFetch.length === 0) {
          return NextResponse.json(
            { standings: [], error: 'Compétition non trouvée' },
            { status: 200 }
          );
        }
      }
    } else {
      // Category-based
      switch (category) {
        case 'basketball':
          leaguesToFetch = [];
          break;
        case 'mlb':
          leaguesToFetch = [];
          break;
        case 'nhl':
          leaguesToFetch = [];
          break;
        case 'motorSport':
          leaguesToFetch = [];
          break;
        case 'motorsports':
          leaguesToFetch = [];
          break;
        case 'cricket':
          leaguesToFetch = [];
          break;
        case 'rugby':
          leaguesToFetch = [];
          break;
        case 'mma':
          leaguesToFetch = [];
          break;
        case 'boxing':
          leaguesToFetch = [];
          break;
        case 'other':
          leaguesToFetch = [];
          break;
        case 'coupes':
          leaguesToFetch = COUPES_CLUBS;
          break;
        case 'nationales':
          leaguesToFetch = NATIONALES;
          includeFIFARankings = true;
          includeWorldCupPlaceholder = true;
          includeCopaAmericaPlaceholder = true;
          includeAsianCupPlaceholder = true;
          includeGoldCupPlaceholder = true;
          break;
        case 'feminines':
          leaguesToFetch = FEMININES;
          break;
        case 'championnats':
        default:
          leaguesToFetch = CHAMPIONNATS;
          break;
      }
    }

    const standings: ParsedStanding[] = [];
    const errors: string[] = [];

    // ── NBA ──
    if (league === 'nba' || category === 'basketball') {
      try {
        const nbaData = await fetchNBAStandings();
        if (nbaData.length > 0) {
          standings.push(...nbaData);
        } else {
          errors.push('NBA: Classements non disponibles');
        }
      } catch (err: any) {
        errors.push(`NBA: ${err.message || 'Échec du chargement'}`);
      }
    }

    // ── MLB ──
    if (league === 'mlb' || category === 'mlb') {
      try {
        const mlbData = await fetchMLBStandings();
        if (mlbData.length > 0) {
          standings.push(...mlbData);
        } else {
          errors.push('MLB: Classements non disponibles');
        }
      } catch (err: any) {
        errors.push(`MLB: ${err.message || 'Échec du chargement'}`);
      }
    }

    // ── NHL ──
    if (league === 'nhl' || category === 'nhl') {
      try {
        const nhlData = await fetchNHLStandings();
        if (nhlData.length > 0) {
          standings.push(...nhlData);
        } else {
          errors.push('NHL: Classements non disponibles');
        }
      } catch (err: any) {
        errors.push(`NHL: ${err.message || 'Échec du chargement'}`);
      }
    }

    // ── NFL ──
    if (league === 'nfl' || category === 'other') {
      try {
        const nflData = await fetchNFLStandings();
        if (nflData.length > 0) {
          standings.push(...nflData);
        } else {
          errors.push('NFL: Classements non disponibles');
        }
      } catch (err: any) {
        errors.push(`NFL: ${err.message || 'Échec du chargement'}`);
      }
    }

    // ── College Football ──
    if (league === 'college-football' || category === 'other') {
      try {
        const cfbData = await fetchCollegeFootballStandings();
        if (cfbData.length > 0) {
          standings.push(...cfbData);
        } else {
          errors.push('NCAA Football: Classements non disponibles');
        }
      } catch (err: any) {
        errors.push(`NCAA Football: ${err.message || 'Échec du chargement'}`);
      }
    }

    // ── F1 ──
    if (league === 'f1' || category === 'motorSport') {
      try {
        const f1Data = await fetchF1Standings();
        if (f1Data.length > 0) {
          standings.push(...f1Data);
        } else {
          errors.push('F1: Classements non disponibles');
        }
      } catch (err: any) {
        errors.push(`F1: ${err.message || 'Échec du chargement'}`);
      }
    }

    // ── NASCAR Cup ──
    if (league === 'nascar-cup' || category === 'motorsports') {
      standings.push(getNASCARPlaceholder());
    }

    // ── IndyCar ──
    if (league === 'indycar' || category === 'motorsports') {
      standings.push(getIndyCarPlaceholder());
    }

    // ── MotoGP ──
    if (league === 'moto-gp' || category === 'motorsports') {
      standings.push(getMotoGPPlaceholder());
    }

    // ── Cricket: IPL ──
    if (league === 'ipl' || category === 'cricket') {
      standings.push(getIPLPlaceholder());
    }

    // ── Rugby: Six Nations ──
    if (league === '6nations' || category === 'rugby') {
      standings.push(getSixNationsPlaceholder());
    }

    // ── UFC Rankings ──
    if (league === 'ufc.rankings' || category === 'mma') {
      standings.push(...getUFCRankingsPlaceholder());
    }

    // ── Boxing Rankings ──
    if (league === 'boxing.rankings' || category === 'boxing') {
      standings.push(...getBoxingRankingsPlaceholder());
    }

    // Fetch soccer leagues SEQUENTIALLY to avoid OOM
    for (const l of leaguesToFetch) {
      if (PLACEHOLDER_CODES.has(l.code)) {
        continue;
      }

      try {
        const data = await fetchStandingsForLeague(l.code);
        const parsed = parseStandings(data, l.name, l.flag, l.code);
        if (parsed.length > 0) {
          standings.push(...parsed);
        } else {
          errors.push(getFriendlyErrorMessage(l.code, l.name, 'Pas de données disponibles'));
        }
      } catch (err: any) {
        errors.push(getFriendlyErrorMessage(l.code, l.name, err.message || 'Échec du chargement'));
      }
    }

    // Include FIFA Rankings for national teams category
    if (includeFIFARankings) {
      standings.unshift(getFIFARankings());
    }

    // Include World Cup placeholder
    if (includeWorldCupPlaceholder) {
      const wcData = getWorldCupPlaceholder();
      if (includeFIFARankings) {
        standings.splice(1, 0, wcData);
      } else {
        standings.unshift(wcData);
      }
    }

    if (includeCopaAmericaPlaceholder) {
      standings.push(getCopaAmericaPlaceholder());
    }

    if (includeAsianCupPlaceholder) {
      standings.push(getAsianCupPlaceholder());
    }

    if (includeGoldCupPlaceholder) {
      standings.push(getGoldCupPlaceholder());
    }

    if (includeWomenFriendliesPlaceholder) {
      standings.push(getWomenFriendliesPlaceholder());
    }

    if (includeMenFriendliesPlaceholder) {
      standings.push(getMenFriendliesPlaceholder());
    }

    const response: Record<string, any> = {
      standings,
      cached: false,
      generatedAt: new Date().toISOString(),
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.errorCount = errors.length;
    }

    // Cache with longer TTL for standings (10 min)
    setCache(cacheKey, response);

    return NextResponse.json(response, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('[Standings API] Error:', error);

    const stale = getCachedStale<any>('standings-championnats')
      || getCachedStale<any>('standings-coupes')
      || getCachedStale<any>('standings-nationales')
      || getCachedStale<any>('standings-basketball')
      || getCachedStale<any>('standings-nba');
    if (stale) {
      return NextResponse.json({ ...stale, error: 'Données potentiellement anciennes' });
    }

    return NextResponse.json(
      { standings: [], error: 'Impossible de charger les classements' },
      { status: 200 }
    );
  }
}
