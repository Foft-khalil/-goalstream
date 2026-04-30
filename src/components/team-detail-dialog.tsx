'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, User, Trophy, Calendar, TrendingUp, Users, ChevronRight, Heart } from 'lucide-react';
import { useFavorites } from '@/hooks/use-favorites';

interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string | null;
  color: string | null;
  venue: string | null;
  coach: string | null;
  founded: string | null;
  leagueCode: string;
  leagueName: string;
}

interface Player {
  id: string;
  name: string;
  position: string;
  number: number | null;
  age: number | null;
  nationality: string | null;
  image: string | null;
}

interface TeamMatch {
  id: string;
  opponent: string;
  opponentLogo: string | null;
  homeAway: 'home' | 'away';
  date: string;
  status: 'upcoming' | 'live' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
}

interface TeamStats {
  label: string;
  value: string | number;
}

type TabType = 'info' | 'roster' | 'schedule';

const POSITION_ORDER: Record<string, number> = {
  GK: 0, G: 0,
  CB: 1, D: 1, DF: 1, DC: 1, DL: 1, DR: 1,
  LB: 1, RB: 1, LWB: 1, RWB: 1,
  CM: 2, M: 2, MF: 2, DM: 2, AM: 2,
  CDM: 2, CAM: 2, LM: 2, RM: 2,
  LW: 3, RW: 3, FW: 3, F: 3, ST: 3, CF: 3,
  SS: 3, WL: 3, WR: 3,
};

const POSITION_LABELS: Record<string, string> = {
  GK: 'Gardien', G: 'Gardien',
  CB: 'Défenseur', D: 'Défenseur', DF: 'Défenseur',
  LB: 'Arrière gauche', RB: 'Arrière droit',
  CM: 'Milieu', M: 'Milieu', MF: 'Milieu',
  CDM: 'Milieu déf.', CAM: 'Milieu off.',
  LM: 'Milieu gauche', RM: 'Milieu droit',
  LW: 'Ailier gauche', RW: 'Ailier droit',
  FW: 'Attaquant', F: 'Attaquant', ST: 'Buteur', CF: 'Avant-centre',
};

function FormBadge({ result }: { result: string }) {
  const config = {
    W: 'bg-green-500/20 text-green-400 border-green-500/30',
    D: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    L: 'bg-red-500/20 text-red-400 border-red-500/30',
  }[result] || 'bg-muted text-muted-foreground';

  const label = { W: 'V', D: 'N', L: 'D' }[result] || result;

  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold border ${config}`}>
      {label}
    </span>
  );
}

interface TeamDetailDialogProps {
  teamId: string | null;
  leagueCode: string;
  teamName: string;
  teamLogo: string | null;
  open: boolean;
  onClose: () => void;
}

export default function TeamDetailDialog({
  teamId,
  leagueCode,
  teamName,
  teamLogo,
  open,
  onClose,
}: TeamDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [schedule, setSchedule] = useState<TeamMatch[]>([]);
  const [form, setForm] = useState<string[]>([]);
  const [stats, setStats] = useState<TeamStats[]>([]);
  const { toggleTeamFavorite, isTeamFavorite } = useFavorites();

  const isFav = isTeamFavorite(teamName);

  const fetchTeamDetail = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/${teamId}?league=${leagueCode}&name=${encodeURIComponent(teamName)}`);
      if (!res.ok) throw new Error('Échec du chargement');
      const data = await res.json();
      if (data.error && !data.team) {
        setError(data.error);
      } else {
        setTeam(data.team);
        setRoster(data.roster || []);
        setSchedule(data.schedule || []);
        setForm(data.form || []);
        setStats(data.stats || []);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [teamId, leagueCode]);

  useEffect(() => {
    if (open && teamId) {
      setActiveTab('info');
      fetchTeamDetail();
    }
  }, [open, teamId, fetchTeamDetail]);

  // Group roster by position
  const groupedRoster = roster.reduce<Record<string, Player[]>>((acc, player) => {
    const pos = player.position || 'AUT';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(player);
    return acc;
  }, {});

  // Sort position groups
  const sortedPositions = Object.entries(groupedRoster).sort(([a], [b]) => {
    return (POSITION_ORDER[a] ?? 99) - (POSITION_ORDER[b] ?? 99);
  });

  // Split schedule
  const upcomingMatches = schedule.filter((m) => m.status === 'upcoming');
  const finishedMatches = schedule.filter((m) => m.status === 'finished').reverse(); // Most recent first
  const liveMatches = schedule.filter((m) => m.status === 'live');

  const tabs: { key: TabType; icon: React.ReactNode; label: string; count?: number }[] = [
    { key: 'info', icon: <Trophy className="h-3.5 w-3.5" />, label: 'Infos' },
    { key: 'roster', icon: <Users className="h-3.5 w-3.5" />, label: 'Effectif', count: roster.length },
    { key: 'schedule', icon: <Calendar className="h-3.5 w-3.5" />, label: 'Calendrier', count: upcomingMatches.length },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogTitle className="sr-only">Détails de l'équipe {teamName}</DialogTitle>

        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-border/20">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="shrink-0">
              {teamLogo ? (
                <img
                  src={teamLogo}
                  alt={teamName}
                  className="w-16 h-16 rounded-2xl object-contain bg-muted/40 p-1.5"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center text-xl font-black">
                  {teamName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name + Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold truncate">{teamName}</h2>
                <button
                  onClick={() => toggleTeamFavorite(teamName, teamLogo)}
                  className="shrink-0"
                  title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Heart className={`h-5 w-5 transition-colors ${isFav ? 'fill-green-500 text-green-500' : 'text-muted-foreground/40 hover:text-green-500'}`} />
                </button>
              </div>
              {team?.leagueName && (
                <p className="text-xs text-muted-foreground mt-0.5">{team.leagueName}</p>
              )}

              {/* Form */}
              {form.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider mr-1">Forme</span>
                  {form.map((r, i) => (
                    <FormBadge key={i} result={r} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-muted/30 rounded-lg p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex-1 justify-center ${
                  activeTab === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count != null && tab.count > 0 && (
                  <span className="text-[10px] text-muted-foreground/50">({tab.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
              <p className="text-sm text-muted-foreground">Chargement des données...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <Button onClick={fetchTeamDetail} size="sm" variant="outline" className="gap-1.5">
                <Loader2 className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            </div>
          ) : (
            <>
              {/* ===== INFO TAB ===== */}
              {activeTab === 'info' && team && (
                <div className="space-y-4">
                  {/* Key info */}
                  <div className="grid grid-cols-2 gap-3">
                    {team.venue && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border/20">
                        <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold tracking-wider">Stade</p>
                          <p className="text-xs font-medium mt-0.5">{team.venue}</p>
                        </div>
                      </div>
                    )}
                    {team.coach && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border/20">
                        <User className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold tracking-wider">Entraineur</p>
                          <p className="text-xs font-medium mt-0.5">{team.coach}</p>
                        </div>
                      </div>
                    )}
                    {team.founded && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border/20">
                        <Calendar className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold tracking-wider">Fondé</p>
                          <p className="text-xs font-medium mt-0.5">{team.founded}</p>
                        </div>
                      </div>
                    )}
                    {team.abbreviation && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border/20">
                        <Trophy className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase font-semibold tracking-wider">Abréviation</p>
                          <p className="text-xs font-medium mt-0.5">{team.abbreviation}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  {stats.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Statistiques de saison
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {stats.map((stat) => (
                          <div key={stat.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/15 border border-border/15">
                            <span className="text-[11px] text-muted-foreground">{stat.label}</span>
                            <span className="text-xs font-bold tabular-nums">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No info fallback */}
                  {!team.venue && !team.coach && !team.founded && stats.length === 0 && (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Trophy className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground/60">Informations limitées pour cette équipe</p>
                    </div>
                  )}
                </div>
              )}

              {/* ===== ROSTER TAB ===== */}
              {activeTab === 'roster' && (
                <div className="space-y-4">
                  {roster.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Users className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground/60">Effectif non disponible</p>
                    </div>
                  ) : (
                    sortedPositions.map(([position, players]) => (
                      <div key={position}>
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">
                          {POSITION_LABELS[position] || position} ({players.length})
                        </h3>
                        <div className="space-y-1">
                          {players.map((player) => (
                            <div
                              key={player.id || player.name}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/20 transition-colors"
                            >
                              {/* Number or avatar */}
                              {player.number != null ? (
                                <span className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                  {player.number}
                                </span>
                              ) : (
                                <span className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                                  {player.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{player.name}</p>
                                {player.nationality && (
                                  <p className="text-[10px] text-muted-foreground/50 truncate">{player.nationality}</p>
                                )}
                              </div>
                              {/* Age */}
                              {player.age && (
                                <span className="text-[10px] text-muted-foreground/40 tabular-nums">{player.age} ans</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ===== SCHEDULE TAB ===== */}
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  {/* Live matches */}
                  {liveMatches.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        EN DIRECT
                      </h3>
                      <div className="space-y-1.5">
                        {liveMatches.map((m) => (
                          <MatchRow key={m.id} match={m} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming */}
                  {upcomingMatches.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        À VENIR ({upcomingMatches.length})
                      </h3>
                      <div className="space-y-1.5">
                        {upcomingMatches.slice(0, 10).map((m) => (
                          <MatchRow key={m.id} match={m} />
                        ))}
                        {upcomingMatches.length > 10 && (
                          <p className="text-[10px] text-muted-foreground/40 text-center mt-1">
                            +{upcomingMatches.length - 10} autres matchs
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Finished */}
                  {finishedMatches.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                        TERMINÉ ({finishedMatches.length})
                      </h3>
                      <div className="space-y-1.5">
                        {finishedMatches.slice(0, 8).map((m) => (
                          <MatchRow key={m.id} match={m} />
                        ))}
                        {finishedMatches.length > 8 && (
                          <p className="text-[10px] text-muted-foreground/40 text-center mt-1">
                            +{finishedMatches.length - 8} autres matchs
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {schedule.length === 0 && (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Calendar className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground/60">Calendrier non disponible</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MatchRow({ match }: { match: TeamMatch }) {
  const matchDate = new Date(match.date);
  const dateStr = matchDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const timeStr = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isUpcoming = match.status === 'upcoming';
  const isHome = match.homeAway === 'home';

  // Determine score from team perspective
  const teamGoals = isHome ? match.homeScore : match.awayScore;
  const oppGoals = isHome ? match.awayScore : match.homeScore;

  const resultColor = isFinished && teamGoals != null && oppGoals != null
    ? teamGoals > oppGoals
      ? 'text-green-400'
      : teamGoals < oppGoals
        ? 'text-red-400'
        : 'text-amber-400'
    : '';

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
      isLive ? 'bg-red-500/5 border border-red-500/15' : 'hover:bg-muted/15'
    }`}>
      {/* Date */}
      <div className="w-12 shrink-0 text-center">
        <p className="text-[10px] font-semibold text-muted-foreground">{dateStr}</p>
        <p className="text-[10px] text-muted-foreground/50">{timeStr}</p>
      </div>

      {/* Home/Away badge */}
      <Badge variant={isHome ? 'default' : 'secondary'} className="text-[8px] px-1.5 py-0 h-4 shrink-0">
        {isHome ? 'DOM' : 'EXT'}
      </Badge>

      {/* Opponent */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {match.opponentLogo ? (
          <img
            src={match.opponentLogo}
            alt=""
            className="w-5 h-5 rounded object-contain shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-5 h-5 rounded bg-muted/40 flex items-center justify-center text-[7px] font-bold shrink-0">
            {match.opponent.slice(0, 2)}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium truncate">{match.opponent}</span>
          {match.competition && isUpcoming && (
            <span className="text-[9px] text-muted-foreground/40 truncate">{match.competition}</span>
          )}
        </div>
      </div>

      {/* Score */}
      {isLive ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold tabular-nums text-red-400">
            {match.homeScore ?? 0} - {match.awayScore ?? 0}
          </span>
        </div>
      ) : isFinished && teamGoals != null && oppGoals != null ? (
        <span className={`text-xs font-bold tabular-nums shrink-0 ${resultColor}`}>
          {teamGoals} - {oppGoals}
        </span>
      ) : (
        <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
      )}
    </div>
  );
}
