'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Trophy, RefreshCw, AlertCircle, Globe, Shield, Users, Calendar, Info, MapPin, Flag, ChevronDown, ChevronUp, Clock, Dribbble } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TeamDetailDialog from '@/components/team-detail-dialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StandingTeam {
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
  winPct?: number;
  gamesBehind?: number;
  conference?: string;
}

interface UpcomingEvent {
  date: string;
  event: string;
}

interface LeagueStanding {
  league: string;
  flag: string;
  season: string;
  leagueCode: string;
  teams: StandingTeam[];
  isGroup?: boolean;
  groupName?: string;
  placeholder?: boolean;
  placeholderMessage?: string;
  placeholderInfo?: Record<string, string>;
  upcomingEvents?: UpcomingEvent[];
}

interface StandingsData {
  standings: LeagueStanding[];
  category: string;
  lastUpdated: string;
  errors?: string[];
  errorCount?: number;
  error?: string;
}

// ─── Category definitions ────────────────────────────────────────────────────

type Category = 'championnats' | 'basketball' | 'coupes' | 'nationales';

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: 'championnats', label: 'Championnats', icon: <Trophy className="h-3.5 w-3.5" /> },
  { key: 'basketball', label: 'Basketball', icon: <Dribbble className="h-3.5 w-3.5" /> },
  { key: 'coupes', label: 'Coupes Clubs', icon: <Shield className="h-3.5 w-3.5" /> },
  { key: 'nationales', label: 'Éq. Nationales', icon: <Globe className="h-3.5 w-3.5" /> },
];

// League tabs per category
const LEAGUE_TABS: Record<Category, Array<{ code: string; name: string; flag: string }>> = {
  championnats: [
    { code: 'eng.1', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { code: 'fra.1', name: 'Ligue 1', flag: '🇫🇷' },
    { code: 'esp.1', name: 'La Liga', flag: '🇪🇸' },
    { code: 'ita.1', name: 'Serie A', flag: '🇮🇹' },
    { code: 'ger.1', name: 'Bundesliga', flag: '🇩🇪' },
    { code: 'por.1', name: 'Liga Portugal', flag: '🇵🇹' },
    { code: 'ned.1', name: 'Eredivisie', flag: '🇳🇱' },
  ],
  basketball: [
    { code: 'nba', name: 'NBA', flag: '🏀' },
  ],
  coupes: [
    { code: 'uefa.champions', name: 'Ligue des Champions', flag: '🏆' },
    { code: 'uefa.europa', name: 'Europa League', flag: '🏆' },
    { code: 'uefa.europa.conf', name: 'Conference League', flag: '🏆' },
  ],
  nationales: [
    { code: 'fifa.rankings', name: 'Classement FIFA', flag: '🌍' },
    { code: 'fifa.world', name: 'Coupe du Monde', flag: '🏆' },
    { code: 'uefa.euro', name: 'Euro', flag: '🇪🇺' },
    { code: 'caf.nations', name: 'CAN', flag: '🌍' },
  ],
};

// ─── Per-league error tracking ───────────────────────────────────────────────

interface LeagueError {
  code: string;
  name: string;
  message: string;
  retrying: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNoteStyle(note: string | null, noteColor: string | null) {
  if (!note) return '';
  const c = noteColor?.toLowerCase() || '';
  const n = note.toLowerCase();
  if (c.includes('81d6ac') || c.includes('green') || n.includes('champions') || n.includes('top 10') || n.includes('qualif') || n.includes('advance') || n.includes('round of')) {
    return 'bg-green-500/15 text-green-400 border-green-500/20';
  }
  if (c.includes('7ec8e3') || c.includes('blue') || n.includes('europa') || n.includes('conference') || n.includes('playoff') || n.includes('top 20')) {
    return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  }
  if (c.includes('f4a460') || c.includes('orange') || n.includes('relegation')) {
    return 'bg-red-500/15 text-red-400 border-red-500/20';
  }
  return 'bg-muted/30 text-muted-foreground border-border/30';
}

// ─── World Cup Info Card ─────────────────────────────────────────────────────

function WorldCupInfoCard({ placeholder }: { placeholder: LeagueStanding }) {
  const info = placeholder.placeholderInfo || {};
  const events = placeholder.upcomingEvents || [];
  const teams = placeholder.teams || [];
  const [showAllTeams, setShowAllTeams] = useState(false);
  const displayedTeams = showAllTeams ? teams : teams.slice(0, 10);

  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/15">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-xl">
          🏆
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-amber-200">Coupe du Monde FIFA 2026</h3>
          <p className="text-[10px] text-amber-300/60">Prochaine édition · 48 équipes · 3 pays hôtes</p>
        </div>
      </div>

      {/* Info grid */}
      <div className="px-4 py-3 space-y-2.5">
        {Object.entries(info).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="text-[10px] font-semibold text-amber-300/50 min-w-[70px] pt-0.5">{key}</span>
            <span className="text-xs text-foreground/80">{value}</span>
          </div>
        ))}
      </div>

      {/* Upcoming Events / Schedule */}
      {events.length > 0 && (
        <div className="px-4 py-3 border-t border-amber-500/10">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="h-3.5 w-3.5 text-amber-400/70" />
            <span className="text-[10px] font-bold text-amber-300/70 uppercase tracking-wider">Calendrier</span>
          </div>
          <div className="space-y-1.5">
            {events.map((ev, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-amber-300/60 min-w-[90px] shrink-0">{ev.date}</span>
                <span className="text-xs text-foreground/70">{ev.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qualified Teams */}
      {teams.length > 0 && (
        <div className="px-4 py-3 border-t border-amber-500/10">
          <div className="flex items-center gap-1.5 mb-2">
            <Flag className="h-3.5 w-3.5 text-amber-400/70" />
            <span className="text-[10px] font-bold text-amber-300/70 uppercase tracking-wider">
              Équipes qualifiées ({teams.length})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {displayedTeams.map((team) => (
              <div
                key={team.teamId}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/5 border border-amber-500/10"
              >
                <span className="text-xs font-medium text-foreground/80 truncate">{team.shortName}</span>
                {team.note && (
                  <span className="text-[8px] text-amber-300/50 shrink-0">{team.note}</span>
                )}
              </div>
            ))}
          </div>
          {teams.length > 10 && (
            <button
              onClick={() => setShowAllTeams(!showAllTeams)}
              className="mt-2 flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-300/80 transition-colors"
            >
              {showAllTeams ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Voir moins
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Voir les {teams.length - 10} autres équipes
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Message */}
      {placeholder.placeholderMessage && (
        <div className="px-4 py-2.5 bg-amber-500/5 border-t border-amber-500/10">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-amber-400/60 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/70">{placeholder.placeholderMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Standings Table with Show More ──────────────────────────────────────────

function StandingsTable({
  league,
  isFIFARankings,
  isCoupesCategory,
  isNBA,
  activeCategory,
  onTeamClick,
}: {
  league: LeagueStanding;
  isFIFARankings: boolean;
  isCoupesCategory: boolean;
  isNBA: boolean;
  activeCategory: Category;
  onTeamClick: (team: StandingTeam) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 12; // Show first 12 by default
  const isLeaguePhase = league.teams.length > INITIAL_SHOW;
  const displayedTeams = showAll ? league.teams : league.teams.slice(0, INITIAL_SHOW);

  const isFIFARank = isFIFARankings && league.leagueCode === 'fifa.rankings';
  const isNBATable = isNBA && league.leagueCode === 'nba';

  // Grid columns for different table types
  const getGridCols = () => {
    if (isFIFARank) return 'grid-cols-[28px_1fr_60px]';
    if (isNBATable) return 'grid-cols-[28px_1fr_32px_32px_48px_40px]';
    return 'grid-cols-[28px_1fr_32px_32px_32px_32px_40px]';
  };

  // Format NBA win percentage (e.g., 0.806 → .806)
  const formatWinPct = (pct: number | undefined) => {
    if (pct === undefined || pct === 0) return '.000';
    return pct < 1 ? `.${String(pct.toFixed(3)).split('.')[1]}` : '1.000';
  };

  // Format games behind (0 → "-")
  const formatGamesBehind = (gb: number | undefined) => {
    if (gb === undefined || gb === 0) return '-';
    return gb % 1 === 0 ? String(gb) : gb.toFixed(1);
  };

  return (
    <section className="space-y-0">
      {/* League header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{league.flag}</span>
        <div className="flex-1">
          <h3 className="text-sm font-bold">{league.league}</h3>
          <p className="text-[10px] text-muted-foreground/50">{league.season}</p>
        </div>
        {isLeaguePhase && (
          <span className="text-[10px] text-amber-400/60 font-medium">
            {league.teams.length} équipes
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/30 overflow-hidden bg-card/50">
        {/* Header */}
        <div className={`grid gap-0 px-2.5 py-2 bg-muted/30 border-b border-border/20 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider ${getGridCols()}`}>
          <span className="text-center">#</span>
          <span>Équipe</span>
          {isFIFARank ? (
            <span className="text-center">Points</span>
          ) : isNBATable ? (
            <>
              <span className="text-center">W</span>
              <span className="text-center">L</span>
              <span className="text-center">PCT</span>
              <span className="text-center">GB</span>
            </>
          ) : (
            <>
              <span className="text-center">J</span>
              <span className="text-center">V</span>
              <span className="text-center">N</span>
              <span className="text-center">D</span>
              <span className="text-center font-bold">Pts</span>
            </>
          )}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/10">
          {displayedTeams.map((team) => (
            <div
              key={team.team}
              onClick={() => onTeamClick(team)}
              className={`grid gap-0 px-2.5 py-2 items-center text-xs hover:bg-green-500/5 transition-colors cursor-pointer ${getGridCols()} ${
                team.note && (team.note.toLowerCase().includes('qualif') || team.note.toLowerCase().includes('champions') || team.note.toLowerCase().includes('top 10') || team.note.toLowerCase().includes('advance') || team.note.toLowerCase().includes('round of') || team.note.toLowerCase().includes('clinched playoff') || team.note.toLowerCase().includes('clinched'))
                  ? 'bg-green-500/[0.03]'
                  : team.note && (team.note.toLowerCase().includes('relegation') || team.note.toLowerCase().includes('eliminated'))
                  ? 'bg-red-500/[0.03]'
                  : team.note && (team.note.toLowerCase().includes('play-in') || team.note.toLowerCase().includes('playoff'))
                  ? 'bg-blue-500/[0.03]'
                  : ''
              }`}
            >
              {/* Rank */}
              <div className="flex justify-center">
                {team.note ? (
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold border ${getNoteStyle(team.note, team.noteColor)}`}>
                    {team.rank}
                  </span>
                ) : (
                  <span className="text-muted-foreground/50 font-medium">{team.rank}</span>
                )}
              </div>

              {/* Team */}
              <div className="flex items-center gap-2 min-w-0">
                {team.logo ? (
                  <img
                    src={team.logo}
                    alt=""
                    className="w-5 h-5 rounded object-contain shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-5 h-5 rounded bg-muted/40 flex items-center justify-center text-[8px] font-bold shrink-0">
                    {team.shortName.slice(0, 2)}
                  </div>
                )}
                <span className="font-medium truncate text-[11px] hover:text-green-500 transition-colors">{team.shortName}</span>
              </div>

              {/* Stats */}
              {isFIFARank ? (
                <span className="text-center font-black text-foreground tabular-nums">{team.points}</span>
              ) : isNBATable ? (
                <>
                  <span className="text-center text-green-400/80 tabular-nums">{team.wins}</span>
                  <span className="text-center text-red-400/60 tabular-nums">{team.losses}</span>
                  <span className="text-center font-bold text-foreground tabular-nums">{formatWinPct(team.winPct)}</span>
                  <span className="text-center text-muted-foreground tabular-nums">{formatGamesBehind(team.gamesBehind)}</span>
                </>
              ) : (
                <>
                  <span className="text-center text-muted-foreground tabular-nums">{team.played}</span>
                  <span className="text-center text-green-400/80 tabular-nums">{team.wins}</span>
                  <span className="text-center text-muted-foreground/60 tabular-nums">{team.draws}</span>
                  <span className="text-center text-red-400/60 tabular-nums">{team.losses}</span>
                  <span className="text-center font-black text-foreground tabular-nums">{team.points}</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Show More / Less for league phase */}
        {isLeaguePhase && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-colors border-t border-border/10"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Voir moins
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Voir les {league.teams.length - INITIAL_SHOW} équipes suivantes
              </>
            )}
          </button>
        )}

        {/* Legend - adaptive per category */}
        {activeCategory === 'championnats' && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Ligue des Champions</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Europa / Conf.</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Relégation</span>
            </div>
          </div>
        )}
        {isNBATable && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Playoffs</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Play-In</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Éliminé</span>
            </div>
          </div>
        )}
        {isCoupesCategory && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Qualifié tour suivant</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Barrages</span>
            </div>
          </div>
        )}
        {activeCategory === 'nationales' && league.leagueCode === 'fifa.rankings' && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Top 10</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/40" />
              <span className="text-[9px] text-muted-foreground/50">Top 20</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Empty State per League ──────────────────────────────────────────────────

function EmptyLeagueState({
  leagueCode,
  leagueName,
  onRetry,
  retrying,
}: {
  leagueCode: string;
  leagueName: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  // World Cup is handled by the placeholder card, not this component
  if (leagueCode === 'fifa.world') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Trophy className="h-12 w-12 text-amber-500/30 mb-3" />
        <p className="text-sm font-semibold mb-1">Coupe du Monde 2026</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          Les groupes et le calendrier ne sont pas encore formés. Consultez le classement FIFA pour voir les meilleures équipes du monde.
        </p>
      </div>
    );
  }

  // Specific messages per competition type
  const getEmptyMessage = () => {
    switch (leagueCode) {
      case 'uefa.champions':
        return 'Les phases de groupes de la Ligue des Champions ne sont pas encore disponibles. La compétition reprend avec les phases à élimination directe.';
      case 'uefa.europa':
        return 'Les données de l\'Europa League ne sont pas disponibles actuellement. La compétition est peut-être en pause entre les phases.';
      case 'uefa.europa.conf':
        return 'Les données de la Conference League ne sont pas disponibles actuellement. La compétition est peut-être en pause entre les phases.';
      case 'uefa.euro':
        return 'Les groupes de l\'Euro ne sont pas encore formés pour la prochaine édition. Consultez le classement FIFA pour suivre les équipes.';
      case 'caf.nations':
        return 'Les données de la CAN ne sont pas disponibles actuellement. Les phases de qualification sont peut-être en cours.';
      default:
        return 'Les données ne sont pas encore disponibles pour cette compétition. Réessayez dans quelques minutes.';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
      <p className="text-sm font-semibold text-muted-foreground mb-1">{leagueName}</p>
      <p className="text-xs text-muted-foreground/60 max-w-xs">{getEmptyMessage()}</p>
      <Button
        onClick={onRetry}
        disabled={retrying}
        size="sm"
        className="mt-3 gap-2 bg-green-600 hover:bg-green-700 text-white"
      >
        {retrying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {retrying ? 'Chargement...' : 'Réessayer'}
      </Button>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StandingsView() {
  const [activeCategory, setActiveCategory] = useState<Category>('championnats');
  const [data, setData] = useState<Record<Category, StandingsData | null>>({
    championnats: null,
    basketball: null,
    coupes: null,
    nationales: null,
  });
  const [loading, setLoading] = useState<Record<Category, boolean>>({
    championnats: false,
    basketball: false,
    coupes: false,
    nationales: false,
  });
  const [selectedLeague, setSelectedLeague] = useState<string>('fra.1');
  const [selectedTeam, setSelectedTeam] = useState<{
    teamId: string;
    leagueCode: string;
    teamName: string;
    teamLogo: string | null;
  } | null>(null);
  const [leagueErrors, setLeagueErrors] = useState<LeagueError[]>([]);
  const [retryingLeague, setRetryingLeague] = useState<string | null>(null);

  // Fetch standings for a category on demand
  const fetchStandings = useCallback(async (category: Category) => {
    setLoading((prev) => ({ ...prev, [category]: true }));
    setLeagueErrors([]);
    try {
      const leagues = LEAGUE_TABS[category];
      const allStandings: LeagueStanding[] = [];
      const allErrors: string[] = [];
      const newLeagueErrors: LeagueError[] = [];
      
      // Fetch each league individually to avoid OOM
      for (const league of leagues) {
        try {
          const res = await fetch(`/api/standings?league=${league.code}`);
          if (!res.ok) throw new Error('Échec du chargement');
          const json: StandingsData = await res.json();
          if (json.standings.length > 0) {
            allStandings.push(...json.standings);
          }
          if (json.errors) allErrors.push(...json.errors);
        } catch {
          // Track per-league errors for retry functionality
          newLeagueErrors.push({
            code: league.code,
            name: league.name,
            message: 'Échec du chargement',
            retrying: false,
          });
        }
      }
      
      setLeagueErrors(newLeagueErrors);

      const json: StandingsData = {
        standings: allStandings,
        category,
        lastUpdated: new Date().toISOString(),
        errors: allErrors.length > 0 ? allErrors : undefined,
        errorCount: allErrors.length > 0 ? allErrors.length : undefined,
      };
      setData((prev) => ({ ...prev, [category]: json }));
    } catch (err: any) {
      setData((prev) => ({
        ...prev,
        [category]: {
          standings: [],
          category,
          lastUpdated: new Date().toISOString(),
          error: err.message,
        },
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [category]: false }));
    }
  }, []);

  // Retry a single league
  const retryLeague = useCallback(async (leagueCode: string, leagueName: string) => {
    setRetryingLeague(leagueCode);
    try {
      const res = await fetch(`/api/standings?league=${leagueCode}`);
      if (!res.ok) throw new Error('Échec du chargement');
      const json: StandingsData = await res.json();

      setData((prev) => {
        const categoryData = prev[activeCategory];
        if (!categoryData) return prev;

        // Remove old data for this league and replace with new
        const filtered = categoryData.standings.filter((s) => s.leagueCode !== leagueCode);
        const newStandings = [...filtered, ...json.standings];

        return {
          ...prev,
          [activeCategory]: {
            ...categoryData,
            standings: newStandings,
            errors: categoryData.errors?.filter((e) => !e.startsWith(leagueName)),
            errorCount: categoryData.errors ? Math.max(0, (categoryData.errorCount || 0) - 1) : undefined,
          },
        };
      });

      // Remove the league from errors list
      setLeagueErrors((prev) => prev.filter((e) => e.code !== leagueCode));
    } catch {
      // Still failed, keep the error
    } finally {
      setRetryingLeague(null);
    }
  }, [activeCategory]);

  // Fetch only the current category on mount (sequential to avoid OOM)
  useEffect(() => {
    fetchStandings('championnats');
  }, [fetchStandings]);

  // Fetch other categories on demand when tab is selected
  useEffect(() => {
    if (activeCategory !== 'championnats' && !data[activeCategory] && !loading[activeCategory]) {
      fetchStandings(activeCategory);
    }
  }, [activeCategory, data, loading, fetchStandings]);

  // Handle category tab change
  const handleCategoryChange = (category: Category) => {
    setActiveCategory(category);
    // Auto-select first league of the category
    const firstCode = LEAGUE_TABS[category][0]?.code;
    if (firstCode) {
      setSelectedLeague(firstCode);
    }
  };

  const handleTeamClick = (team: StandingTeam) => {
    setSelectedTeam({
      teamId: team.teamId,
      leagueCode: team.leagueCode,
      teamName: team.team,
      teamLogo: team.logo,
    });
  };

  // Current category data
  const currentData = data[activeCategory];
  const currentLoading = loading[activeCategory];
  const currentTabs = LEAGUE_TABS[activeCategory];
  const standings = currentData?.standings || [];
  const isFIFARankings = activeCategory === 'nationales';
  const isCoupesCategory = activeCategory === 'coupes';
  const isNBA = activeCategory === 'basketball';

  // Get standings for the currently selected league
  const selectedStandings = standings.filter((s) => s.leagueCode === selectedLeague);

  // Check if selected league has a placeholder (World Cup)
  const placeholderStanding = selectedStandings.find((s) => s.placeholder);

  // Check if selected league is in the error list
  const selectedLeagueError = leagueErrors.find((e) => e.code === selectedLeague);

  // Count teams for each league tab
  const getTeamCount = (code: string) => {
    return standings.filter((s) => s.leagueCode === code && !s.placeholder).reduce((sum, s) => sum + s.teams.length, 0);
  };

  // Loading state (only show full loading for the initial load of current category)
  if (currentLoading && !currentData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-green-500" />
          </div>
        </div>
        <p className="text-base font-semibold mb-1">Chargement des classements</p>
        <p className="text-sm text-muted-foreground/60">Récupération des données...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-green-500" />
            Classements
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {standings.length} classement{standings.length !== 1 ? 's' : ''} · Cliquez sur une équipe
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchStandings(activeCategory)}
          disabled={currentLoading}
          className="h-8 w-8 rounded-lg border-border/50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${currentLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          const catData = data[cat.key];
          const catLoading = loading[cat.key];
          const teamCount = catData?.standings?.reduce((sum, s) => sum + (s.placeholder ? 0 : s.teams.length), 0) || 0;
          return (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-green-500/15 text-green-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
              {catLoading && !catData && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {!catLoading && teamCount > 0 && (
                <span className="text-[10px] text-green-500/60">{teamCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* League sub-tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {currentTabs.map((tab) => {
          const isSelected = selectedLeague === tab.code;
          const teamCount = getTeamCount(tab.code);
          const hasError = leagueErrors.some((e) => e.code === tab.code);
          const isPlaceholder = standings.some((s) => s.leagueCode === tab.code && s.placeholder);
          return (
            <button
              key={tab.code}
              onClick={() => setSelectedLeague(tab.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : hasError
                  ? 'bg-red-500/5 text-red-400 border border-red-500/10 hover:bg-red-500/10'
                  : 'bg-muted/30 text-muted-foreground border border-border/20 hover:bg-muted/50'
              }`}
            >
              <span className="text-sm">{tab.flag}</span>
              <span>{tab.name}</span>
              {teamCount > 0 && (
                <span className="text-[10px] text-muted-foreground/50">({teamCount})</span>
              )}
              {teamCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
              {isPlaceholder && !hasError && teamCount === 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
              {hasError && (
                <AlertCircle className="h-3 w-3 text-red-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading overlay for refresh */}
      {currentLoading && currentData && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/5 border border-green-500/10 text-xs text-green-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Mise à jour en cours...</span>
        </div>
      )}

      {/* Error banner */}
      {currentData?.error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{currentData.error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchStandings(activeCategory)}
            className="ml-auto h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
          >
            Réessayer
          </Button>
        </div>
      )}

      {/* Warnings (partial errors) */}
      {currentData?.errors && currentData.errors.length > 0 && (
        <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/15 text-xs text-amber-500">
          {currentData.errors.map((err, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Selected league standings */}
      {selectedStandings.length > 0 ? (
        selectedStandings.map((league) => {
          // If this is a placeholder (World Cup), render the info card
          if (league.placeholder) {
            return <WorldCupInfoCard key={league.leagueCode} placeholder={league} />;
          }

          return (
            <StandingsTable
              key={`${league.leagueCode}-${league.groupName || 'all'}`}
              league={league}
              isFIFARankings={isFIFARankings}
              isCoupesCategory={isCoupesCategory}
              isNBA={isNBA}
              activeCategory={activeCategory}
              onTeamClick={handleTeamClick}
            />
          );
        })
      ) : !currentLoading ? (
        /* No data for selected league */
        <EmptyLeagueState
          leagueCode={selectedLeague}
          leagueName={currentTabs.find((t) => t.code === selectedLeague)?.name || selectedLeague}
          onRetry={() => retryLeague(
            selectedLeague,
            currentTabs.find((t) => t.code === selectedLeague)?.name || selectedLeague
          )}
          retrying={retryingLeague === selectedLeague}
        />
      ) : null}

      {/* Per-league error indicators with retry */}
      {selectedLeagueError && !currentLoading && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Erreur lors du chargement de {selectedLeagueError.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => retryLeague(selectedLeagueError.code, selectedLeagueError.name)}
            disabled={retryingLeague === selectedLeagueError.code}
            className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
          >
            {retryingLeague === selectedLeagueError.code ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}

      {/* Loading for selected league */}
      {currentLoading && selectedStandings.length === 0 && currentData && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
          <p className="text-sm text-muted-foreground">Chargement en cours...</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground/30 pt-1">
        Classements — données ESPN · Cliquez sur une équipe pour voir les détails
      </div>

      {/* Team Detail Dialog */}
      {selectedTeam && (
        <TeamDetailDialog
          teamId={selectedTeam.teamId}
          leagueCode={selectedTeam.leagueCode}
          teamName={selectedTeam.teamName}
          teamLogo={selectedTeam.teamLogo}
          open={!!selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
