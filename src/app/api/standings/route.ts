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
  // NBA-specific fields
  winPct?: number;       // NBA win percentage (e.g., 0.750)
  gamesBehind?: number;  // NBA games behind conference leader (e.g., 3.5)
  conference?: string;   // 'Eastern' or 'Western' for NBA
}

// ─── Fetch from ESPN API ─────────────────────────────────────────────────────

const ESPN_PRIMARY_BASE = 'https://site.web.api.espn.com/apis/v2/sports/soccer';
const ESPN_FALLBACK_BASE = 'https://site.api.espn.com/apis/v2/sports/soccer';
const ESPN_NBA_PRIMARY = 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings';
const ESPN_NBA_FALLBACK = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

async function fetchStandingsForLeague(code: string) {
  const primaryUrl = `${ESPN_PRIMARY_BASE}/${code}/standings`;
  const fallbackUrl = `${ESPN_FALLBACK_BASE}/${code}/standings`;
  const timeout = 12000; // Reduced from 20s to 12s to reduce memory pressure

  // Helper to safely parse JSON with size limit
  async function safeParseJson(res: Response): Promise<any> {
    // Clone and check content-length to avoid parsing huge responses
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1_000_000) {
      // Response too large (>1MB) — skip to avoid memory issues
      console.warn(`[Standings API] Response too large for ${code}: ${contentLength} bytes, skipping`);
      return null;
    }
    return await res.json();
  }

  // Try primary URL first
  try {
    const res = await fetchWithTimeout(primaryUrl, timeout);
    if (res.ok) {
      const data = await safeParseJson(res);
      if (data) return data;
    }
    // If primary returns non-200 or data too large, try fallback
    console.warn(`[Standings API] Primary URL failed for ${code}, trying fallback...`);
  } catch (err: any) {
    console.warn(`[Standings API] Primary URL failed for ${code}: ${err.message}, trying fallback...`);
  }

  // Try fallback URL
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

const MAX_TEAMS_PER_GROUP = 36; // UEFA league phase has 36 teams in single table

function parseStandings(data: any, leagueName: string, leagueFlag: string, code: string): ParsedStanding[] {
  try {
    const children = data.children || [];

    if (children.length === 0) {
      return [];
    }

    const results: ParsedStanding[] = [];

    // Limit number of groups to prevent memory issues with large competitions
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

      // Sort by points desc, then goal diff
      teams.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
      // Re-rank
      teams.forEach((t, i) => { t.rank = i + 1; });

      // For national leagues with single child, use league name directly
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

// ─── FIFA Rankings (fallback only — web search removed to save memory) ──────

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
  // Key qualified teams for World Cup 2026
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

  // Upcoming key matches / milestones
  const upcomingEvents = [
    { date: 'Mars 2026', event: 'Tirage au sort des groupes' },
    { date: '11 juin 2026', event: 'Match d\'ouverture — Mexico' },
    { date: '12-24 juin 2026', event: 'Phase de groupes (12 groupes)' },
    { date: '26 juin — 2 juil.', event: 'Phase de 32e de finale' },
    { date: '4-8 juil.', event: '16e de finale' },
    { date: '11-19 juil.', event: 'Quarts → Finale' },
  ];

  // Build qualified teams as pseudo-standings
  const teams: ParsedTeam[] = qualifiedTeams.map((t, i) => ({
    teamId: `wc2026_${i}`,
    leagueCode: 'fifa.world',
    rank: i + 1,
    team: t.name,
    shortName: t.name,
    logo: null,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
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
      'Statut': 'Qualifications en cours — tirage au sort en mars 2026',
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

// ─── NBA Standings ────────────────────────────────────────────────────────────

async function fetchNBAStandings(): Promise<ParsedStanding[]> {
  const timeout = 12000;

  async function safeParseJson(res: Response): Promise<any> {
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1_000_000) {
      console.warn('[Standings API] Response too large for NBA: ${contentLength} bytes, skipping');
      return null;
    }
    return await res.json();
  }

  let data: any = null;

  // Try primary URL first
  try {
    const res = await fetchWithTimeout(ESPN_NBA_PRIMARY, timeout);
    if (res.ok) {
      data = await safeParseJson(res);
    }
  } catch (err: any) {
    console.warn(`[Standings API] NBA primary URL failed: ${err.message}, trying fallback...`);
  }

  // Try fallback URL if primary failed
  if (!data) {
    try {
      const res = await fetchWithTimeout(ESPN_NBA_FALLBACK, timeout);
      if (res.ok) {
        data = await safeParseJson(res);
      }
    } catch (err: any) {
      console.warn(`[Standings API] NBA fallback URL failed: ${err.message}`);
    }
  }

  if (!data) {
    throw new Error('Impossible de charger les classements NBA');
  }

  const children = data.children || [];
  if (children.length === 0) {
    return [];
  }

  const results: ParsedStanding[] = [];

  for (const child of children) {
    if (!child.standings?.entries) continue;

    const conferenceName = child.name || 'Conference';
    const entries: StandingEntry[] = child.standings.entries;

    const teams: ParsedTeam[] = entries.slice(0, 16).map((entry) => {
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
        draws: 0, // NBA doesn't have draws
        losses: Number(statMap['losses'] || 0),
        goalsFor: Number(statMap['pointsFor'] || 0),
        goalsAgainst: Number(statMap['pointsAgainst'] || 0),
        goalDiff: Number(statMap['pointDifferential'] || 0),
        points: Math.round(winPct * 1000), // Use points field to sort by winPct
        note: entry.note?.description || null,
        noteColor: entry.note?.color || null,
        winPct,
        gamesBehind,
        conference: conferenceName.includes('Eastern') ? 'Eastern' : 'Western',
      };
    });

    // Sort by winPct desc (points field = winPct * 1000)
    teams.sort((a, b) => b.points - a.points);
    // Re-rank within conference
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

// ─── Friendly error messages for specific competitions ───────────────────────

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

    // Build cache key
    const cacheKey = league ? `standings-${league}` : `standings-${category}`;

    // Check cache
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

    // Competitions that are placeholders (not available from ESPN API)
    const PLACEHOLDER_CODES = new Set([
      'fifa.rankings', 'fifa.world', 'conmebol.america', 'afc.asian', 'concacaf.gold',
    ]);

    if (league === 'fifa.rankings') {
      includeFIFARankings = true;
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
    } else if (league) {
      // Specific league requested
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

    // Handle NBA standings separately
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

    // Fetch leagues SEQUENTIALLY to avoid OOM (instead of Promise.allSettled)
    for (const l of leaguesToFetch) {
      // Skip non-ESPN leagues in the fetch loop — handled by static data
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
      const fifaData = getFIFARankings();
      standings.unshift(fifaData);
    }

    // Include World Cup placeholder
    if (includeWorldCupPlaceholder) {
      const wcData = getWorldCupPlaceholder();
      // Insert after FIFA rankings if present, otherwise at the beginning
      if (includeFIFARankings) {
        standings.splice(1, 0, wcData);
      } else {
        standings.unshift(wcData);
      }
    }

    // Include Copa América placeholder
    if (includeCopaAmericaPlaceholder) {
      standings.push(getCopaAmericaPlaceholder());
    }

    // Include Asian Cup placeholder
    if (includeAsianCupPlaceholder) {
      standings.push(getAsianCupPlaceholder());
    }

    // Include Gold Cup placeholder
    if (includeGoldCupPlaceholder) {
      standings.push(getGoldCupPlaceholder());
    }

    const response: Record<string, any> = {
      standings,
      category,
      lastUpdated: new Date().toISOString(),
    };
    if (errors.length > 0) {
      response.errors = errors;
      response.errorCount = errors.length;
    }

    // Cache with longer TTL for standings (10 min — they don't change fast)
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
