'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  X,
  Users,
  TrendingUp,
  Calendar,
  Trophy,
  MapPin,
  Home,
  Plane,
  Target,
  Shield,
  Loader2,
  ChevronRight,
  CircleDot,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  nickname: string;
  color: string;
  alternateColor: string;
  logo: string;
  logoDark: string;
  standingSummary: string;
  league: string;
}

interface PlayerInfo {
  id: string;
  fullName: string;
  shortName: string;
  jersey: string;
  position: string;
  positionAbbr: string;
  age: number | null;
  height: string;
  weight: string;
  nationality: string;
  flag: string;
  dateOfBirth: string | null;
  photo: string;
}

interface TeamStats {
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  homePlayed: number;
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayPlayed: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  rank: number;
  streak: number;
  deductions: number;
}

interface MatchResult {
  id: string;
  date: string;
  homeTeam: string;
  homeTeamShort: string;
  homeLogo: string;
  homeScore: string;
  awayTeam: string;
  awayTeamShort: string;
  awayLogo: string;
  awayScore: string;
  status: 'played' | 'upcoming' | 'live';
  competition: string;
}

interface TeamDetailData {
  team: TeamInfo | null;
  stats: TeamStats | null;
  players: PlayerInfo[];
  recentResults: MatchResult[];
  upcomingMatches: MatchResult[];
  remainingMatches: number;
  totalSeasonMatches: number;
  error?: string;
}

// ─── League name map ────────────────────────────────────────────────────────
const LEAGUE_NAMES: Record<string, string> = {
  'fra.1': 'Ligue 1',
  'eng.1': 'Premier League',
  'esp.1': 'La Liga',
  'ita.1': 'Serie A',
  'ger.1': 'Bundesliga',
  'por.1': 'Liga Portugal',
  'ned.1': 'Eredivisie',
  'uefa.champions': 'Champions League',
  'uefa.europa': 'Europa League',
  'uefa.europa.conf': 'Conference League',
};

const LEAGUE_FLAGS: Record<string, string> = {
  'fra.1': '🇫🇷',
  'eng.1': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'esp.1': '🇪🇸',
  'ita.1': '🇮🇹',
  'ger.1': '🇩🇪',
  'por.1': '🇵🇹',
  'ned.1': '🇳🇱',
  'uefa.champions': '🏆',
  'uefa.europa': '🏆',
  'uefa.europa.conf': '🏆',
};

// ─── Position group labels ──────────────────────────────────────────────────
const POSITION_GROUPS: { key: string; label: string; positions: string[] }[] = [
  { key: 'gk', label: 'Gardiens', positions: ['G', 'GK', 'Goalkeeper'] },
  { key: 'def', label: 'Défenseurs', positions: ['D', 'DF', 'Defender', 'CB', 'LB', 'RB', 'WB'] },
  { key: 'mid', label: 'Milieux', positions: ['M', 'MF', 'Midfielder', 'CM', 'DM', 'AM', 'CDM', 'CAM'] },
  { key: 'fwd', label: 'Attaquants', positions: ['F', 'FW', 'Forward', 'ST', 'CF', 'LW', 'RW', 'WF'] },
];

function groupPlayers(players: PlayerInfo[]) {
  const groups: Record<string, PlayerInfo[]> = { gk: [], def: [], mid: [], fwd: [], other: [] };
  for (const player of players) {
    const pos = player.positionAbbr || player.position;
    let assigned = false;
    for (const group of POSITION_GROUPS) {
      if (group.positions.some((p) => pos === p || pos?.includes(p))) {
        groups[group.key].push(player);
        assigned = true;
        break;
      }
    }
    if (!assigned) groups.other.push(player);
  }
  return groups;
}

// ─── Format date ────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMatchDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Component ──────────────────────────────────────────────────────────────
interface TeamDetailProps {
  teamId: string | null;
  leagueCode: string | null;
  open: boolean;
  onClose: () => void;
}

export default function TeamDetail({ teamId, leagueCode, open, onClose }: TeamDetailProps) {
  const [data, setData] = useState<TeamDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'players' | 'stats' | 'matches'>('info');

  // Fetch team data when dialog opens
  useEffect(() => {
    if (!open || !teamId || !leagueCode) return;
    let cancelled = false;

    const loadTeam = async () => {
      setLoading(true);
      setData(null);
      setActiveTab('info');
      try {
        const res = await fetch(`/api/team?id=${teamId}&league=${leagueCode}`);
        const result = await res.json();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setData({ team: null, stats: null, players: [], recentResults: [], upcomingMatches: [], remainingMatches: 0, totalSeasonMatches: 0, error: 'Erreur réseau' });
          setLoading(false);
        }
      }
    };

    loadTeam();
    return () => { cancelled = true; };
  }, [open, teamId, leagueCode]);

  // Reset when closed — use callback pattern to avoid synchronous setState in effect
  const handleClose = useCallback(() => {
    setData(null);
    setLoading(false);
    onClose();
  }, [onClose]);

  // Clear stale data when dialog closes
  useEffect(() => {
    if (!open && data !== null) {
      // Defer the state reset to avoid synchronous setState in effect
      const timer = requestAnimationFrame(() => {
        setData(null);
        setLoading(false);
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [open, data]);

  const team = data?.team;
  const stats = data?.stats;
  const players = data?.players || [];
  const recentResults = data?.recentResults || [];
  const upcomingMatches = data?.upcomingMatches || [];
  const playerGroups = groupPlayers(players);
  const teamColor = team?.color || '22c55e';

  const tabs = [
    { key: 'info' as const, label: 'Infos', icon: <Trophy className="h-3.5 w-3.5" /> },
    { key: 'players' as const, label: 'Joueurs', icon: <Users className="h-3.5 w-3.5" /> },
    { key: 'stats' as const, label: 'Stats', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: 'matches' as const, label: 'Matchs', icon: <Calendar className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {team ? team.name : 'Détails de l\'équipe'}
        </DialogTitle>

        {/* Team header */}
        <div
          className="relative px-5 pt-5 pb-4"
          style={{
            background: `linear-gradient(135deg, #${teamColor}22 0%, transparent 60%)`,
          }}
        >
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: `#${teamColor}` }} />
            </div>
          )}

          {team && (
            <div className="flex items-start gap-4">
              {team.logo && (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-16 h-16 rounded-xl object-contain bg-white/10 p-1 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-extrabold tracking-tight">{team.name}</h2>
                {team.nickname && team.nickname !== team.name && (
                  <p className="text-sm text-muted-foreground">{team.nickname}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {LEAGUE_FLAGS[team.league] || ''} {LEAGUE_NAMES[team.league] || team.league}
                  </Badge>
                  {team.standingSummary && (
                    <Badge
                      className="text-[10px] font-bold text-white border-0"
                      style={{ backgroundColor: `#${teamColor}` }}
                    >
                      {team.standingSummary}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {data?.error && !team && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {data.error}
            </div>
          )}
        </div>

        {/* Tab navigation */}
        {team && (
          <>
            <div className="flex border-b border-border/30 px-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all border-b-2 ${
                    activeTab === tab.key
                      ? 'border-current text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  style={activeTab === tab.key ? { borderColor: `#${teamColor}`, color: `#${teamColor}` } : {}}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.key === 'players' && players.length > 0 && (
                    <span className="ml-0.5 text-[10px] opacity-60">({players.length})</span>
                  )}
                  {tab.key === 'matches' && (
                    <span className="ml-0.5 text-[10px] opacity-60">
                      ({recentResults.length + upcomingMatches.length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <ScrollArea className="max-h-[60vh]">
              {/* ─── INFO TAB ─────────────────────────────────────────────── */}
              {activeTab === 'info' && (
                <div className="p-5 space-y-4">
                  {/* Quick stats cards */}
                  {stats && (
                    <div className="grid grid-cols-3 gap-2">
                      <StatCard label="Points" value={stats.points} color={`#${teamColor}`} />
                      <StatCard label="Matchs" value={stats.gamesPlayed} />
                      <StatCard
                        label="Diff."
                        value={`${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}`}
                        className={stats.goalDifference > 0 ? 'text-emerald-400' : stats.goalDifference < 0 ? 'text-red-400' : ''}
                      />
                    </div>
                  )}

                  {/* Remaining matches */}
                  {data && (
                    <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Calendar className="h-3.5 w-3.5 inline mr-1" />
                          Matchs restants
                        </span>
                        <span className="text-lg font-extrabold" style={{ color: `#${teamColor}` }}>
                          {data.remainingMatches}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: stats
                                ? `${Math.min(100, Math.round((stats.gamesPlayed / Math.max(data.totalSeasonMatches, 1)) * 100))}%`
                                : '0%',
                              backgroundColor: `#${teamColor}`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {stats?.gamesPlayed || 0}/{data.totalSeasonMatches || '?'} joués
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Season summary */}
                  {stats && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Résumé de la saison
                      </h3>
                      <div className="grid grid-cols-7 gap-1 text-center text-xs">
                        <div className="bg-muted/30 rounded-lg p-2">
                          <div className="font-extrabold text-emerald-400">{stats.wins}</div>
                          <div className="text-[9px] text-muted-foreground">Victoires</div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <div className="font-extrabold text-yellow-400">{stats.draws}</div>
                          <div className="text-[9px] text-muted-foreground">Nuls</div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <div className="font-extrabold text-red-400">{stats.losses}</div>
                          <div className="text-[9px] text-muted-foreground">Défaites</div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <div className="font-extrabold">{stats.goalsFor}</div>
                          <div className="text-[9px] text-muted-foreground">BP</div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <div className="font-extrabold">{stats.goalsAgainst}</div>
                          <div className="text-[9px] text-muted-foreground">BC</div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <div className="font-extrabold">{stats.points}</div>
                          <div className="text-[9px] text-muted-foreground">Pts</div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <div className={`font-extrabold ${stats.goalDifference > 0 ? 'text-emerald-400' : stats.goalDifference < 0 ? 'text-red-400' : ''}`}>
                            {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
                          </div>
                          <div className="text-[9px] text-muted-foreground">DB</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Next match preview */}
                  {upcomingMatches.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Prochain match
                      </h3>
                      <MatchCard match={upcomingMatches[0]} teamId={team.id} />
                    </div>
                  )}
                </div>
              )}

              {/* ─── PLAYERS TAB ──────────────────────────────────────────── */}
              {activeTab === 'players' && (
                <div className="p-4 space-y-4">
                  {players.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Effectif non disponible
                    </div>
                  ) : (
                    POSITION_GROUPS.map((group) => {
                      const groupPlayers = playerGroups[group.key];
                      if (!groupPlayers || groupPlayers.length === 0) return null;
                      return (
                        <div key={group.key}>
                          <h3 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 px-1">
                            {group.label} ({groupPlayers.length})
                          </h3>
                          <div className="space-y-1">
                            {groupPlayers.map((player) => (
                              <div
                                key={player.id}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/20 transition-colors"
                              >
                                {/* Jersey number */}
                                <span className="w-7 text-center text-xs font-extrabold" style={{ color: `#${teamColor}` }}>
                                  {player.jersey || '-'}
                                </span>
                                {/* Flag + Name */}
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {player.flag && (
                                    <img src={player.flag} alt="" className="w-4 h-3 rounded-sm object-cover shrink-0" />
                                  )}
                                  <span className="text-sm font-medium truncate">{player.fullName}</span>
                                </div>
                                {/* Position */}
                                <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                                  {player.positionAbbr || player.position}
                                </span>
                                {/* Age */}
                                {player.age && (
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {player.age} ans
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ─── STATS TAB ────────────────────────────────────────────── */}
              {activeTab === 'stats' && (
                <div className="p-5 space-y-4">
                  {!stats ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Statistiques non disponibles
                    </div>
                  ) : (
                    <>
                      {/* Win rate */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Taux de victoire
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-4 rounded-full overflow-hidden bg-muted flex">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${(stats.wins / Math.max(stats.gamesPlayed, 1)) * 100}%` }}
                            />
                            <div
                              className="h-full bg-yellow-500 transition-all"
                              style={{ width: `${(stats.draws / Math.max(stats.gamesPlayed, 1)) * 100}%` }}
                            />
                            <div
                              className="h-full bg-red-500 transition-all"
                              style={{ width: `${(stats.losses / Math.max(stats.gamesPlayed, 1)) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-emerald-400">
                            {Math.round((stats.wins / Math.max(stats.gamesPlayed, 1)) * 100)}%
                          </span>
                        </div>
                        <div className="flex gap-3 text-[10px]">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />V {stats.wins}</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />N {stats.draws}</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />D {stats.losses}</span>
                        </div>
                      </div>

                      {/* Home vs Away */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Home className="h-3 w-3 inline mr-1" />
                          Domicile vs Extérieur
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/30 rounded-xl p-3 space-y-1.5">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase">Domicile</div>
                            <div className="text-lg font-extrabold" style={{ color: `#${teamColor}` }}>
                              {stats.homeWins}V {stats.homeDraws}N {stats.homeLosses}D
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {stats.homeGoalsFor} BP / {stats.homeGoalsAgainst} BC
                            </div>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3 space-y-1.5">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                              <Plane className="h-3 w-3" /> Extérieur
                            </div>
                            <div className="text-lg font-extrabold" style={{ color: `#${teamColor}` }}>
                              {stats.awayWins}V {stats.awayDraws}N {stats.awayLosses}D
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {stats.awayGoalsFor} BP / {stats.awayGoalsAgainst} BC
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Goals stats */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Target className="h-3 w-3 inline mr-1" />
                          Buts
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-muted/30 rounded-xl p-3 text-center">
                            <div className="text-lg font-extrabold">{stats.goalsFor}</div>
                            <div className="text-[10px] text-muted-foreground">Marqués</div>
                            <div className="text-[10px] text-muted-foreground">
                              {(stats.goalsFor / Math.max(stats.gamesPlayed, 1)).toFixed(1)}/m
                            </div>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3 text-center">
                            <div className="text-lg font-extrabold">{stats.goalsAgainst}</div>
                            <div className="text-[10px] text-muted-foreground">Encaissés</div>
                            <div className="text-[10px] text-muted-foreground">
                              {(stats.goalsAgainst / Math.max(stats.gamesPlayed, 1)).toFixed(1)}/m
                            </div>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3 text-center">
                            <div className={`text-lg font-extrabold ${stats.goalDifference > 0 ? 'text-emerald-400' : stats.goalDifference < 0 ? 'text-red-400' : ''}`}>
                              {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
                            </div>
                            <div className="text-[10px] text-muted-foreground">Différence</div>
                          </div>
                        </div>
                      </div>

                      {/* Average points per game */}
                      <div className="bg-muted/30 rounded-xl p-3 space-y-1">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Moyenne de points par match</div>
                        <div className="text-2xl font-extrabold" style={{ color: `#${teamColor}` }}>
                          {(stats.points / Math.max(stats.gamesPlayed, 1)).toFixed(2)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── MATCHES TAB ──────────────────────────────────────────── */}
              {activeTab === 'matches' && (
                <div className="p-4 space-y-4">
                  {/* Upcoming matches */}
                  {upcomingMatches.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Matchs à venir ({upcomingMatches.length})
                      </h3>
                      <div className="space-y-1.5">
                        {upcomingMatches.map((match) => (
                          <MatchCard key={match.id} match={match} teamId={team?.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent results */}
                  {recentResults.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        Résultats récents
                      </h3>
                      <div className="space-y-1.5">
                        {recentResults.slice(0, 10).map((match) => (
                          <MatchCard key={match.id} match={match} teamId={team?.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {recentResults.length === 0 && upcomingMatches.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Aucun match disponible
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, color, className }: { label: string; value: string | number; color?: string; className?: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-3 text-center">
      <div className={`text-xl font-extrabold ${className || ''}`} style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function MatchCard({ match, teamId }: { match: MatchResult; teamId?: string }) {
  const isHome = match.homeTeamShort && teamId;
  const homeWon = match.status === 'played' && match.homeScore && match.awayScore &&
    parseInt(match.homeScore) > parseInt(match.awayScore);
  const awayWon = match.status === 'played' && match.homeScore && match.awayScore &&
    parseInt(match.awayScore) > parseInt(match.homeScore);

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
      {/* Date */}
      <span className="text-[10px] text-muted-foreground w-14 shrink-0 text-center font-medium">
        {formatMatchDate(match.date)}
      </span>

      {/* Teams + Score */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Home */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className={`text-xs font-medium truncate ${homeWon ? 'font-bold' : ''}`}>{match.homeTeamShort}</span>
          {match.homeLogo && (
            <img src={match.homeLogo} alt="" className="w-5 h-5 rounded-sm object-contain shrink-0" />
          )}
        </div>

        {/* Score */}
        <div className="flex items-center gap-1 shrink-0">
          {match.status === 'upcoming' ? (
            <span className="text-[10px] text-muted-foreground font-medium px-1">vs</span>
          ) : (
            <span className="text-xs font-extrabold px-1.5 py-0.5 rounded bg-muted/50">
              {match.homeScore}-{match.awayScore}
            </span>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {match.awayLogo && (
            <img src={match.awayLogo} alt="" className="w-5 h-5 rounded-sm object-contain shrink-0" />
          )}
          <span className={`text-xs font-medium truncate ${awayWon ? 'font-bold' : ''}`}>{match.awayTeamShort}</span>
        </div>
      </div>
    </div>
  );
}
