'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Trophy, RefreshCw, AlertCircle, Globe, Users, Calendar, Info, MapPin, Flag, ChevronDown, ChevronUp, Clock, Dribbble, Award, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TeamDetailDialog from '@/components/team-detail-dialog';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';

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

// ─── Top Scorers Types ─────────────────────────────────────────────────────────

interface TopScorer {
  rank: number;
  name: string;
  team: string;
  teamLogo: string | null;
  goals: number;
  assists: number;
  played: number;
}

// ─── Category definitions ────────────────────────────────────────────────────

type Category = 'championnats' | 'basketball' | 'coupes' | 'nationales' | 'feminines';

// Category keys for i18n lookup
const CATEGORY_KEYS: Record<Category, string> = {
  championnats: 'standings.championships',
  basketball: 'standings.basketball',
  coupes: 'standings.clubCups',
  nationales: 'standings.nationalTeams',
  feminines: 'standings.women',
};

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  championnats: <Trophy className="h-3.5 w-3.5" />,
  basketball: <Dribbble className="h-3.5 w-3.5" />,
  coupes: <Award className="h-3.5 w-3.5" />,
  nationales: <Globe className="h-3.5 w-3.5" />,
  feminines: <Users className="h-3.5 w-3.5" />,
};

const CATEGORIES: Category[] = ['championnats', 'basketball', 'coupes', 'nationales', 'feminines'];

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
    { code: 'ksa.1', name: 'Saudi Pro League', flag: '🇸🇦' },
    { code: 'tur.1', name: 'Süper Lig', flag: '🇹🇷' },
    { code: 'usa.1', name: 'MLS', flag: '🇺🇸' },
    { code: 'bra.1', name: 'Brasileirão', flag: '🇧🇷' },
    { code: 'arg.1', name: 'Liga Profesional', flag: '🇦🇷' },
    { code: 'mex.1', name: 'Liga MX', flag: '🇲🇽' },
    { code: 'sco.1', name: 'Scottish Prem.', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
    { code: 'bel.1', name: 'Jupiler Pro League', flag: '🇧🇪' },
    { code: 'gre.1', name: 'Super League', flag: '🇬🇷' },
  ],
  basketball: [
    { code: 'nba', name: 'NBA', flag: '🏀' },
  ],
  coupes: [
    { code: 'uefa.champions', name: 'Champions League', flag: '🏆' },
    { code: 'uefa.europa', name: 'Europa League', flag: '🏆' },
    { code: 'uefa.europa.conf', name: 'Conference League', flag: '🏆' },
    { code: 'conmebol.libertadores', name: 'Copa Libertadores', flag: '🌎' },
    { code: 'conmebol.sudamericana', name: 'Copa Sudamericana', flag: '🌎' },
    { code: 'afc.champions', name: 'AFC Champions League', flag: '🌏' },
    { code: 'caf.champions', name: 'CAF Champions League', flag: '🌍' },
  ],
  nationales: [
    { code: 'fifa.rankings', name: 'FIFA Ranking', flag: '🌍' },
    { code: 'fifa.world', name: 'World Cup', flag: '🏆' },
    { code: 'uefa.euro', name: 'Euro', flag: '🇪🇺' },
    { code: 'uefa.nations', name: 'Nations League', flag: '🇪🇺' },
    { code: 'conmebol.america', name: 'Copa América', flag: '🌎' },
    { code: 'concacaf.gold', name: 'Gold Cup', flag: '🇺🇸' },
    { code: 'afc.asian', name: 'Asian Cup', flag: '🌏' },
    { code: 'caf.nations', name: 'AFCON', flag: '🌍' },
  ],
  feminines: [
    { code: 'eng.w.1', name: 'WSL', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { code: 'fra.w.1', name: 'Première Ligue', flag: '🇫🇷' },
    { code: 'esp.w.1', name: 'Liga F', flag: '🇪🇸' },
    { code: 'ned.w.1', name: 'Vrouw. Eredivisie', flag: '🇳🇱' },
    { code: 'usa.nwsl', name: 'NWSL', flag: '🇺🇸' },
    { code: 'aus.w.1', name: 'A-League Women', flag: '🇦🇺' },
    { code: 'can.w.nsl', name: 'Northern SL', flag: '🇨🇦' },
    { code: 'usa.w.usl.1', name: 'USL Super League', flag: '🇺🇸' },
    { code: 'uefa.wchampions', name: 'W. Champions L.', flag: '🏆' },
    { code: 'fifa.wwc', name: 'W. World Cup', flag: '🏆' },
    { code: 'uefa.w.nations', name: 'W. Nations L.', flag: '🇪🇺' },
    { code: 'uefa.weuro', name: 'W. Euro', flag: '🇪🇺' },
    { code: 'concacaf.w.gold', name: 'W Gold Cup', flag: '🇺🇸' },
    { code: 'conmebol.america.femenina', name: 'Copa Amér. Fem.', flag: '🌎' },
    { code: 'afc.w.asian.cup', name: 'W. Asian Cup', flag: '🌏' },
    { code: 'caf.w.nations', name: 'W. AFCON', flag: '🌍' },
    { code: 'fifa.friendly.w', name: 'W. Friendly', flag: '🌍' },
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

// ─── Competition Info Card (for placeholders like World Cup, Copa América, etc.) ──

function WorldCupInfoCard({ placeholder, language }: { placeholder: LeagueStanding; language: string }) {
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
          {placeholder.flag || '🏆'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-amber-200">{placeholder.league}</h3>
          <p className="text-[10px] text-amber-300/60">{placeholder.season}</p>
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
            <span className="text-[10px] font-bold text-amber-300/70 uppercase tracking-wider">{t(language, 'standings.schedule')}</span>
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
              {t(language, 'standings.qualifiedTeams')} ({teams.length})
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
                  {t(language, 'common.showLess')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  {t(language, 'standings.otherTeams', teams.length - 10)}
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
  language,
}: {
  league: LeagueStanding;
  isFIFARankings: boolean;
  isCoupesCategory: boolean;
  isNBA: boolean;
  activeCategory: Category;
  onTeamClick: (team: StandingTeam) => void;
  language: string;
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
            {league.teams.length} {t(language, 'standings.teams')}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/30 overflow-hidden bg-card/50">
        {/* Header */}
        <div className={`grid gap-0 px-2.5 py-2 bg-muted/30 border-b border-border/20 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider ${getGridCols()}`}>
          <span className="text-center">#</span>
          <span>{t(language, 'standings.team')}</span>
          {isFIFARank ? (
            <span className="text-center">{t(language, 'standings.points')}</span>
          ) : isNBATable ? (
            <>
              <span className="text-center">{t(language, 'standings.wins')}</span>
              <span className="text-center">{t(language, 'standings.losses')}</span>
              <span className="text-center">{t(language, 'standings.winPct')}</span>
              <span className="text-center">{t(language, 'standings.gamesBehind')}</span>
            </>
          ) : (
            <>
              <span className="text-center">{t(language, 'standings.played')}</span>
              <span className="text-center">{t(language, 'standings.won')}</span>
              <span className="text-center">{t(language, 'standings.drawn')}</span>
              <span className="text-center">{t(language, 'standings.lost')}</span>
              <span className="text-center font-bold">{t(language, 'standings.points')}</span>
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
                {t(language, 'common.showLess')}
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                {t(language, 'standings.showNextTeams', league.teams.length - INITIAL_SHOW)}
              </>
            )}
          </button>
        )}

        {/* Legend - adaptive per category */}
        {activeCategory === 'championnats' && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.championsLeague')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.europaConf')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.relegation')}</span>
            </div>
          </div>
        )}
        {activeCategory === 'feminines' && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.championsLeague')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.relegation')}</span>
            </div>
          </div>
        )}
        {isNBATable && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.playoffs')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.playIn')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.eliminated')}</span>
            </div>
          </div>
        )}
        {isCoupesCategory && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.qualified')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.barrages')}</span>
            </div>
          </div>
        )}
        {activeCategory === 'nationales' && league.leagueCode === 'fifa.rankings' && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.top10')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/40" />
              <span className="text-[9px] text-muted-foreground/50">{t(language, 'standings.top20')}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Top Scorers Table ─────────────────────────────────────────────────────────

function TopScorersTable({
  scorers,
  language,
}: {
  scorers: TopScorer[];
  language: string;
}) {
  return (
    <section className="space-y-0">
      {/* Table */}
      <div className="rounded-xl border border-border/30 overflow-hidden bg-card/50">
        {/* Header */}
        <div className="grid grid-cols-[28px_1fr_60px_40px_40px_40px] gap-0 px-2.5 py-2 bg-muted/30 border-b border-border/20 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          <span className="text-center">#</span>
          <span>{t(language, 'standings.player')}</span>
          <span>{t(language, 'standings.team')}</span>
          <span className="text-center">{t(language, 'standings.matchesPlayed')}</span>
          <span className="text-center">{t(language, 'standings.goals')}</span>
          <span className="text-center">{t(language, 'standings.assists')}</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/10">
          {scorers.map((scorer) => (
            <div
              key={`${scorer.name}-${scorer.rank}`}
              className="grid grid-cols-[28px_1fr_60px_40px_40px_40px] gap-0 px-2.5 py-2.5 items-center text-xs hover:bg-green-500/5 transition-colors"
            >
              {/* Rank */}
              <div className="flex justify-center">
                {scorer.rank <= 3 ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    {scorer.rank}
                  </span>
                ) : (
                  <span className="text-muted-foreground/50 font-medium">{scorer.rank}</span>
                )}
              </div>

              {/* Player name */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-green-500">
                    {scorer.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <span className="font-medium truncate text-[11px]">{scorer.name}</span>
              </div>

              {/* Team */}
              <div className="flex items-center gap-1.5 min-w-0">
                {scorer.teamLogo ? (
                  <img
                    src={scorer.teamLogo}
                    alt=""
                    className="w-4 h-4 rounded object-contain shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null}
                <span className="text-muted-foreground/60 truncate text-[10px]">{scorer.team}</span>
              </div>

              {/* Stats */}
              <span className="text-center text-muted-foreground/60 tabular-nums">{scorer.played}</span>
              <span className="text-center font-bold text-green-400 tabular-nums">{scorer.goals}</span>
              <span className="text-center text-muted-foreground/70 tabular-nums">{scorer.assists}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500/40" />
            <span className="text-[9px] text-muted-foreground/50">Top 3</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50">⚽ {t(language, 'standings.goals')} · 🅰️ {t(language, 'standings.assists')}</span>
          </div>
        </div>
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
  language,
}: {
  leagueCode: string;
  leagueName: string;
  onRetry: () => void;
  retrying: boolean;
  language: string;
}) {
  // Placeholder competitions
  const PLACEHOLDER_CODES = ['fifa.world', 'conmebol.america', 'afc.asian', 'concacaf.gold', 'fifa.friendly.w'];
  if (PLACEHOLDER_CODES.includes(leagueCode)) {
    const compMessages: Record<string, string> = {
      'fifa.world': t(language, 'standings.worldCupMessage'),
      'conmebol.america': t(language, 'standings.copaAmericaMessage'),
      'afc.asian': t(language, 'standings.asianCupMessage'),
      'concacaf.gold': t(language, 'standings.goldCupMessage'),
      'fifa.friendly.w': t(language, 'standings.womenFriendlyMessage'),
    };
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Trophy className="h-12 w-12 text-amber-500/30 mb-3" />
        <p className="text-sm font-semibold mb-1">{leagueName}</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          {compMessages[leagueCode] || t(language, 'standings.dataUnavailable')}
        </p>
      </div>
    );
  }

  // Specific messages per competition type
  const getEmptyMessage = () => {
    switch (leagueCode) {
      case 'uefa.champions':
      case 'uefa.europa':
      case 'uefa.europa.conf':
      case 'conmebol.libertadores':
      case 'conmebol.sudamericana':
      case 'afc.champions':
      case 'caf.champions':
        return t(language, 'standings.competitionPaused', leagueName);
      case 'uefa.euro':
      case 'uefa.nations':
        return t(language, 'standings.groupsNotFormed');
      case 'caf.nations':
        return t(language, 'standings.competitionPaused', leagueName);
      case 'ksa.1':
      default:
        return t(language, 'standings.dataUnavailable');
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
        {retrying ? t(language, 'common.loading') : t(language, 'common.retry')}
      </Button>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StandingsView() {
  const { language } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<Category>('championnats');
  const [data, setData] = useState<Record<Category, StandingsData | null>>({
    championnats: null,
    basketball: null,
    coupes: null,
    nationales: null,
    feminines: null,
  });
  const [loading, setLoading] = useState<Record<Category, boolean>>({
    championnats: false,
    basketball: false,
    coupes: false,
    nationales: false,
    feminines: false,
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
  const [activeSubTab, setActiveSubTab] = useState<'standings' | 'scorers'>('standings');
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [topScorersLoading, setTopScorersLoading] = useState(false);
  const [topScorersError, setTopScorersError] = useState<string | null>(null);

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
          if (!res.ok) throw new Error(t(language, 'errors.loadFailed'));
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
            message: t(language, 'errors.loadFailed'),
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
  }, [language]);

  // Retry a single league
  const retryLeague = useCallback(async (leagueCode: string, leagueName: string) => {
    setRetryingLeague(leagueCode);
    try {
      const res = await fetch(`/api/standings?league=${leagueCode}`);
      if (!res.ok) throw new Error(t(language, 'errors.loadFailed'));
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
  }, [activeCategory, language]);

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
    setActiveSubTab('standings');
    // Auto-select first league of the category
    const firstCode = LEAGUE_TABS[category][0]?.code;
    if (firstCode) {
      setSelectedLeague(firstCode);
    }
  };

  // Fetch top scorers when sub-tab or selected league changes
  useEffect(() => {
    if (activeSubTab !== 'scorers') return;
    if (activeCategory === 'basketball') return; // No top scorers for basketball

    const fetchTopScorers = async () => {
      setTopScorersLoading(true);
      setTopScorersError(null);
      try {
        const res = await fetch(`/api/top-scorers?league=${encodeURIComponent(selectedLeague)}`);
        if (!res.ok) throw new Error('Failed to fetch top scorers');
        const data = await res.json();
        setTopScorers(data.scorers || []);
        if ((!data.scorers || data.scorers.length === 0) && data.error) {
          setTopScorersError(data.error);
        }
      } catch {
        setTopScorersError(t(language, 'standings.dataUnavailable'));
        setTopScorers([]);
      } finally {
        setTopScorersLoading(false);
      }
    };
    fetchTopScorers();
  }, [activeSubTab, selectedLeague, language]);

  // Reset sub-tab when category changes to basketball
  useEffect(() => {
    if (activeCategory === 'basketball') {
      setActiveSubTab('standings');
    }
  }, [activeCategory]);

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
        <p className="text-base font-semibold mb-1">{t(language, 'standings.loadingStandings')}</p>
        <p className="text-sm text-muted-foreground/60">{t(language, 'standings.fetchingData')}</p>
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
            {t(language, 'standings.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {standings.length} {t(language, 'standings.ranking')}{standings.length !== 1 ? 's' : ''} · {t(language, 'standings.clickTeam')}
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
        {CATEGORIES.map((catKey) => {
          const isActive = activeCategory === catKey;
          const catData = data[catKey];
          const catLoading = loading[catKey];
          const teamCount = catData?.standings?.reduce((sum, s) => sum + (s.placeholder ? 0 : s.teams.length), 0) || 0;
          return (
            <button
              key={catKey}
              onClick={() => handleCategoryChange(catKey)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-green-500/15 text-green-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {CATEGORY_ICONS[catKey]}
              <span>{t(language, CATEGORY_KEYS[catKey])}</span>
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
              onClick={() => { setSelectedLeague(tab.code); }}
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

      {/* Standings / Top Scorers sub-tab toggle — only for non-basketball categories */}
      {activeCategory !== 'basketball' && (
        <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
          <button
            onClick={() => setActiveSubTab('standings')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === 'standings'
                ? 'bg-card text-foreground shadow-sm border border-border/30'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Trophy className="h-3 w-3" />
            {t(language, 'standings.title')}
          </button>
          <button
            onClick={() => setActiveSubTab('scorers')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === 'scorers'
                ? 'bg-card text-foreground shadow-sm border border-border/30'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Target className="h-3 w-3" />
            {t(language, 'standings.topScorers')}
          </button>
        </div>
      )}

      {/* Loading overlay for refresh */}
      {currentLoading && currentData && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/5 border border-green-500/10 text-xs text-green-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{t(language, 'standings.updating')}</span>
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
            {t(language, 'common.retry')}
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

      {/* Standings / Top Scorers content */}
      {activeSubTab === 'scorers' && activeCategory !== 'basketball' ? (
        /* Top Scorers view */
        topScorersLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">{t(language, 'standings.loadingLeague')}</p>
          </div>
        ) : topScorersError && topScorers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground mb-1">{t(language, 'standings.topScorers')}</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs">{topScorersError}</p>
          </div>
        ) : topScorers.length > 0 ? (
          <TopScorersTable scorers={topScorers} language={language} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">{t(language, 'standings.dataUnavailable')}</p>
          </div>
        )
      ) : (
        /* Standings view (original) */
        <>
      {/* Selected league standings */}
      {selectedStandings.length > 0 ? (
        selectedStandings.map((league) => {
          // If this is a placeholder (World Cup), render the info card
          if (league.placeholder) {
            return <WorldCupInfoCard key={league.leagueCode} placeholder={league} language={language} />;
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
              language={language}
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
          language={language}
        />
      ) : null}

      {/* Per-league error indicators with retry */}
      {selectedLeagueError && !currentLoading && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{t(language, 'standings.loadError', selectedLeagueError.name)}</span>
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
          <p className="text-sm text-muted-foreground">{t(language, 'standings.loadingLeague')}</p>
        </div>
      )}
      </>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground/30 pt-1">
        {t(language, 'favorites.savedLocally')}
      </div>

      {/* Team Detail Dialog */}
      <TeamDetailDialog
        teamId={selectedTeam?.teamId ?? null}
        leagueCode={selectedTeam?.leagueCode ?? ''}
        teamName={selectedTeam?.teamName ?? ''}
        teamLogo={selectedTeam?.teamLogo ?? null}
        open={!!selectedTeam}
        onClose={() => setSelectedTeam(null)}
      />
    </div>
  );
}
