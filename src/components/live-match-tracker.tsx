'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore, MatchTrackerData, TrackerEvent } from '@/lib/store';
import LiveMatchClock from '@/components/live-match-clock';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  X,
  Loader2,
  CircleDot,
  AlertTriangle,
  ArrowRightLeft,
  Monitor,
  BarChart3,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  ShieldAlert,
  Trophy,
} from 'lucide-react';

// ─── Event type icon & color mapping ────────────────────────────────────────
function getEventIcon(type: TrackerEvent['type']) {
  switch (type) {
    case 'goal':
    case 'penalty':
      return <CircleDot className="h-4 w-4 text-green-500" />;
    case 'own_goal':
      return <CircleDot className="h-4 w-4 text-red-400" />;
    case 'yellow_card':
      return <div className="w-3.5 h-5 rounded-sm bg-yellow-400 border border-yellow-500" />;
    case 'red_card':
      return <div className="w-3.5 h-5 rounded-sm bg-red-500 border border-red-600" />;
    case 'substitution':
      return <ArrowRightLeft className="h-4 w-4 text-blue-400" />;
    case 'var':
      return <Monitor className="h-4 w-4 text-violet-400" />;
    case 'half_start':
      return <Clock className="h-4 w-4 text-emerald-400" />;
    case 'half_end':
      return <Clock className="h-4 w-4 text-amber-400" />;
    default:
      return <CircleDot className="h-4 w-4 text-muted-foreground" />;
  }
}

function getEventLabel(type: TrackerEvent['type']): string {
  switch (type) {
    case 'goal': return 'But';
    case 'penalty': return 'But (Penalty)';
    case 'own_goal': return 'CSC';
    case 'yellow_card': return 'Carton jaune';
    case 'red_card': return 'Carton rouge';
    case 'substitution': return 'Remplacement';
    case 'var': return 'VAR';
    case 'half_start': return 'Début';
    case 'half_end': return 'Fin';
    default: return type;
  }
}

function getEventBg(type: TrackerEvent['type']): string {
  switch (type) {
    case 'goal':
    case 'penalty':
      return 'bg-green-500/10 border-green-500/20';
    case 'own_goal':
      return 'bg-red-500/10 border-red-500/20';
    case 'yellow_card':
      return 'bg-yellow-500/10 border-yellow-500/20';
    case 'red_card':
      return 'bg-red-500/10 border-red-500/20';
    case 'substitution':
      return 'bg-blue-500/10 border-blue-500/20';
    case 'var':
      return 'bg-violet-500/10 border-violet-500/20';
    default:
      return 'bg-muted/30 border-border/30';
  }
}

// ─── Stat bar component ──────────────────────────────────────────────────────
function StatBar({ name, home, away }: { name: string; home: string; away: string }) {
  // Parse numeric values for bar width
  const homeNum = parseFloat(home.replace('%', '').replace(',', '.'));
  const awayNum = parseFloat(away.replace('%', '').replace(',', '.'));
  const isNumeric = !isNaN(homeNum) && !isNaN(awayNum) && (homeNum + awayNum) > 0;
  const homePct = isNumeric ? (homeNum / (homeNum + awayNum)) * 100 : 50;

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold tabular-nums text-foreground">{home}</span>
        <span className="text-xs text-muted-foreground font-medium">{name}</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{away}</span>
      </div>
      {isNumeric && (
        <div className="flex h-1.5 rounded-full overflow-hidden bg-muted/60">
          <div
            className="bg-green-500/70 rounded-l-full transition-all duration-500"
            style={{ width: `${homePct}%` }}
          />
          <div
            className="bg-red-500/70 rounded-r-full transition-all duration-500"
            style={{ width: `${100 - homePct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Lineup section ──────────────────────────────────────────────────────────
function LineupSection({
  teamName,
  teamLogo,
  players,
  isHome,
}: {
  teamName: string;
  teamLogo: string | null;
  players: Array<{ name: string; position?: string; number?: number }>;
  isHome: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayPlayers = expanded ? players : players.slice(0, 11);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {teamLogo ? (
          <img src={teamLogo} alt="" className="w-5 h-5 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-5 h-5 rounded bg-muted/60 flex items-center justify-center text-[8px] font-bold">
            {teamName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="text-xs font-semibold">{teamName}</span>
      </div>
      <div className="space-y-1">
        {displayPlayers.map((player, idx) => (
          <div key={`${player.name}-${idx}`} className={`flex items-center gap-2 py-1 px-2 rounded-md ${isHome ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
            {player.number !== undefined && (
              <span className="text-[10px] font-bold text-muted-foreground/60 w-5 text-center tabular-nums">{player.number}</span>
            )}
            <span className="text-xs font-medium flex-1 truncate">{player.name}</span>
            {player.position && (
              <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4 font-bold">
                {player.position}
              </Badge>
            )}
          </div>
        ))}
      </div>
      {players.length > 11 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-[10px] text-muted-foreground/60 h-6"
        >
          {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          {expanded ? 'Voir moins' : `Voir ${players.length - 11} remplaçants`}
        </Button>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function LiveMatchTracker() {
  const {
    trackerOpen,
    trackerMatchId,
    trackerData,
    trackerLoading,
    trackerError,
    closeTracker,
    fetchTrackerData,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('events');
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data when tracker opens
  useEffect(() => {
    if (trackerOpen && trackerMatchId) {
      fetchTrackerData(trackerMatchId);
    }
  }, [trackerOpen, trackerMatchId, fetchTrackerData]);

  // Auto-refresh for live matches
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (trackerOpen && trackerData?.status === 'live' && trackerMatchId) {
      refreshIntervalRef.current = setInterval(() => {
        fetchTrackerData(trackerMatchId);
      }, 30000); // Refresh every 30s for live matches
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [trackerOpen, trackerData?.status, trackerMatchId, fetchTrackerData]);

  const handleRefresh = async () => {
    if (!trackerMatchId || refreshing) return;
    setRefreshing(true);
    await fetchTrackerData(trackerMatchId);
    setTimeout(() => setRefreshing(false), 500);
  };

  // Determine if this is basketball
  const isBasketball = trackerMatchId?.startsWith('espn_bball_');

  return (
    <Dialog open={trackerOpen} onOpenChange={(open) => { if (!open) closeTracker(); }}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {trackerData ? `${trackerData.homeTeam} vs ${trackerData.awayTeam} — Suivi en direct` : 'Suivi de match en direct'}
        </DialogTitle>

        {/* ─── Header: Score Board ─────────────────────────────────────────── */}
        <div className={`relative px-5 pt-5 pb-4 ${
          trackerData?.status === 'live'
            ? isBasketball
              ? 'bg-gradient-to-br from-orange-950/40 via-card to-orange-950/20'
              : 'bg-gradient-to-br from-red-950/40 via-card to-red-950/20'
            : 'bg-gradient-to-br from-muted/30 via-card to-muted/20'
        }`}>
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={closeTracker}
            className="absolute top-3 right-3 h-7 w-7 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>

          {trackerLoading && !trackerData ? (
            // Loading state
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
              <p className="text-sm text-muted-foreground">Chargement du suivi en direct...</p>
            </div>
          ) : trackerError && !trackerData ? (
            // Error state
            <div className="flex flex-col items-center justify-center py-10">
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{trackerError}</p>
              <Button size="sm" onClick={handleRefresh} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <RefreshCw className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            </div>
          ) : trackerData ? (
            // Match data
            <>
              {/* Competition badge */}
              <div className="flex items-center justify-center gap-2 mb-3">
                {trackerData.competition && (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-semibold bg-muted/60">
                    <Trophy className="h-2.5 w-2.5 mr-1 text-amber-500" />
                    {trackerData.competition}
                  </Badge>
                )}
              </div>

              {/* Score board */}
              <div className="flex items-center justify-center gap-4">
                {/* Home team */}
                <div className="flex flex-col items-center gap-1.5 w-24">
                  {trackerData.homeLogo ? (
                    <img
                      src={trackerData.homeLogo}
                      alt={trackerData.homeTeam}
                      className="w-12 h-12 rounded-xl object-contain bg-muted/30 p-1"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-sm font-bold">
                      {trackerData.homeTeam.slice(0, 3).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-center leading-tight truncate w-full">{trackerData.homeTeam}</span>
                </div>

                {/* Score */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-3">
                    <span className={`text-4xl font-black tabular-nums ${
                      trackerData.status === 'live'
                        ? isBasketball ? 'text-orange-400' : 'text-red-400'
                        : 'text-foreground'
                    }`}>
                      {trackerData.homeScore}
                    </span>
                    <span className="text-lg text-muted-foreground/30 font-light">-</span>
                    <span className={`text-4xl font-black tabular-nums ${
                      trackerData.status === 'live'
                        ? isBasketball ? 'text-orange-400' : 'text-red-400'
                        : 'text-foreground'
                    }`}>
                      {trackerData.awayScore}
                    </span>
                  </div>
                  {/* Live indicator */}
                  {trackerData.status === 'live' && (
                    <div className="flex items-center gap-1.5 mt-1">
                      {isBasketball ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                          <span className="text-[11px] font-bold text-orange-500 tracking-wide">
                            {trackerData.period && trackerData.period <= 4 ? `Q${trackerData.period}` : `OT${(trackerData.period ?? 5) - 4}`}
                          </span>
                          {trackerData.displayClock && (
                            <span className="text-[11px] font-semibold text-orange-400 tabular-nums">{trackerData.displayClock}</span>
                          )}
                        </>
                      ) : (
                        <LiveMatchClock
                          minute={trackerData.minute}
                          status={trackerData.status}
                          displayClock={trackerData.displayClock}
                          period={trackerData.period}
                          lastUpdated={trackerData.lastUpdated}
                        />
                      )}
                    </div>
                  )}
                  {trackerData.status === 'finished' && (
                    <Badge variant="secondary" className="text-[10px] mt-1 font-bold">Terminé</Badge>
                  )}
                  {trackerData.status === 'upcoming' && (
                    <Badge variant="secondary" className="text-[10px] mt-1 font-bold bg-blue-500/10 text-blue-500 border-blue-500/20">À venir</Badge>
                  )}
                </div>

                {/* Away team */}
                <div className="flex flex-col items-center gap-1.5 w-24">
                  {trackerData.awayLogo ? (
                    <img
                      src={trackerData.awayLogo}
                      alt={trackerData.awayTeam}
                      className="w-12 h-12 rounded-xl object-contain bg-muted/30 p-1"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-sm font-bold">
                      {trackerData.awayTeam.slice(0, 3).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-center leading-tight truncate w-full">{trackerData.awayTeam}</span>
                </div>
              </div>

              {/* Quick event summary (goals only) */}
              {trackerData.events.filter(e => e.type === 'goal' || e.type === 'penalty' || e.type === 'own_goal').length > 0 && (
                <div className="flex justify-between mt-3 px-2">
                  <div className="flex flex-col gap-0.5 items-start">
                    {trackerData.events
                      .filter(e => (e.type === 'goal' || e.type === 'penalty' || e.type === 'own_goal') && e.team === 'home')
                      .map((e, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground/70 font-medium">
                          {e.player} {e.minute}&apos;
                          {e.type === 'penalty' && ' (P)'}
                          {e.type === 'own_goal' && ' (CSC)'}
                        </span>
                      ))}
                  </div>
                  <div className="flex flex-col gap-0.5 items-end">
                    {trackerData.events
                      .filter(e => (e.type === 'goal' || e.type === 'penalty' || e.type === 'own_goal') && e.team === 'away')
                      .map((e, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground/70 font-medium">
                          {e.minute}&apos; {e.player}
                          {e.type === 'penalty' && ' (P)'}
                          {e.type === 'own_goal' && ' (CSC)'}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ─── Content Tabs ────────────────────────────────────────────────── */}
        {trackerData && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-2 border-b border-border/30">
              <TabsList className="w-full h-9 bg-transparent p-0 gap-1">
                <TabsTrigger value="events" className="flex-1 h-8 text-xs font-semibold data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600 rounded-md gap-1">
                  <CircleDot className="h-3 w-3" />
                  Événements
                  {trackerData.events.length > 0 && (
                    <span className="text-[9px] text-muted-foreground/50">({trackerData.events.length})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="stats" className="flex-1 h-8 text-xs font-semibold data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600 rounded-md gap-1">
                  <BarChart3 className="h-3 w-3" />
                  Stats
                </TabsTrigger>
                <TabsTrigger value="lineups" className="flex-1 h-8 text-xs font-semibold data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600 rounded-md gap-1">
                  <Users className="h-3 w-3" />
                  Compos
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 max-h-[45vh]">
              {/* ─── Events Tab ─────────────────────────────────────────── */}
              <TabsContent value="events" className="p-4 m-0">
                {trackerData.events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Clock className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground/60 font-medium">
                      {trackerData.status === 'live'
                        ? 'En attente d\'événements...'
                        : trackerData.status === 'upcoming'
                          ? 'Le match n\'a pas encore commencé'
                          : 'Aucun événement disponible pour ce match'}
                    </p>
                    {trackerData.status === 'live' && (
                      <p className="text-[10px] text-muted-foreground/40 mt-1">Mise à jour automatique toutes les 30 secondes</p>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border/40" />

                    <div className="space-y-1">
                      {trackerData.events.map((event, idx) => (
                        <div
                          key={`${event.minute}-${event.type}-${idx}`}
                          className={`relative flex items-start gap-3 px-3 py-2 rounded-lg border ${getEventBg(event.type)} transition-colors`}
                        >
                          {/* Timeline dot */}
                          <div className="relative z-10 mt-0.5 shrink-0">
                            {getEventIcon(event.type)}
                          </div>

                          {/* Event content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold tabular-nums text-muted-foreground/60">{event.minute}&apos;</span>
                              <Badge
                                variant="secondary"
                                className={`text-[9px] px-1.5 py-0 h-4 font-bold ${
                                  event.team === 'home'
                                    ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
                                    : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
                                }`}
                              >
                                {event.team === 'home' ? trackerData.homeTeam.slice(0, 3).toUpperCase() : trackerData.awayTeam.slice(0, 3).toUpperCase()}
                              </Badge>
                              <span className="text-[10px] font-semibold text-muted-foreground">{getEventLabel(event.type)}</span>
                            </div>
                            {event.player && (
                              <p className="text-xs font-semibold mt-0.5 truncate">{event.player}</p>
                            )}
                            {event.assistBy && (
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                Passe décisive : {event.assistBy}
                              </p>
                            )}
                            {event.substitutedPlayer && (
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                ⇄ {event.substitutedPlayer}
                              </p>
                            )}
                            {event.detail && event.type !== 'penalty' && event.type !== 'own_goal' && (
                              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{event.detail}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ─── Stats Tab ──────────────────────────────────────────── */}
              <TabsContent value="stats" className="p-4 m-0">
                {trackerData.stats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground/60 font-medium">
                      Statistiques non disponibles
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1">
                      Disponibles généralement pendant les matchs en direct
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0 divide-y divide-border/20">
                    {trackerData.stats.map((stat, idx) => (
                      <StatBar key={`${stat.name}-${idx}`} name={stat.name} home={stat.home} away={stat.away} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ─── Lineups Tab ────────────────────────────────────────── */}
              <TabsContent value="lineups" className="p-4 m-0">
                {trackerData.lineups.home.length === 0 && trackerData.lineups.away.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground/60 font-medium">
                      Compositions non disponibles
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1">
                      Généralement publiées 1 heure avant le coup d&apos;envoi
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <LineupSection
                      teamName={trackerData.homeTeam}
                      teamLogo={trackerData.homeLogo}
                      players={trackerData.lineups.home}
                      isHome
                    />
                    <Separator className="bg-border/30" />
                    <LineupSection
                      teamName={trackerData.awayTeam}
                      teamLogo={trackerData.awayLogo}
                      players={trackerData.lineups.away}
                      isHome={false}
                    />
                  </div>
                )}
              </TabsContent>
            </ScrollArea>

            {/* ─── Footer ───────────────────────────────────────────────── */}
            <div className="px-4 py-2 border-t border-border/20 bg-muted/10 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {trackerData.status === 'live' && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] text-muted-foreground/50">Auto-refresh 30s</span>
                  </>
                )}
                <span className="text-[9px] text-muted-foreground/30">
                  Source: ESPN
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={trackerLoading}
                className="h-6 px-2 text-[10px] gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
