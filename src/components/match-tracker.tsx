'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, RefreshCw, Loader2, Circle, Square, ArrowRightLeft, AlertTriangle, Eye, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

interface MatchEvent {
  id: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'period_start' | 'period_end' | 'var_review';
  minute: number;
  team: string;
  teamLogo: string | null;
  player: string;
  assistPlayer?: string;
  playerIn?: string;
  detail?: string;
  homeScore: number;
  awayScore: number;
}

interface MatchTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    homeLogo: string | null;
    awayLogo: string | null;
    status: string;
    competition: string | null;
    matchDate: string | null;
    displayClock?: string | null;
    period?: number | null;
    statusDescription?: string | null;
    isHalftime?: boolean;
    minute?: number | null;
  };
}

// Event icon component
function EventIcon({ type }: { type: MatchEvent['type'] }) {
  switch (type) {
    case 'goal':
      return <span className="text-base">⚽</span>;
    case 'yellow_card':
      return <div className="w-3.5 h-4.5 rounded-[2px] bg-yellow-400 border border-yellow-500/50" />;
    case 'red_card':
      return <div className="w-3.5 h-4.5 rounded-[2px] bg-red-500 border border-red-600/50" />;
    case 'substitution':
      return <ArrowRightLeft className="h-3.5 w-3.5 text-green-500" />;
    case 'var_review':
      return <Eye className="h-3.5 w-3.5 text-violet-500" />;
    case 'period_start':
      return <Circle className="h-3 w-3 text-green-500 fill-green-500" />;
    case 'period_end':
      return <Square className="h-3 w-3 text-red-400 fill-red-400" />;
    default:
      return null;
  }
}

// Event label in French
function eventLabel(type: MatchEvent['type']): string {
  switch (type) {
    case 'goal': return 'But';
    case 'yellow_card': return 'Carton jaune';
    case 'red_card': return 'Carton rouge';
    case 'substitution': return 'Remplacement';
    case 'var_review': return 'VAR';
    case 'period_start': return 'Début';
    case 'period_end': return 'Fin';
    default: return '';
  }
}

export default function MatchTracker({ isOpen, onClose, match }: MatchTrackerProps) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { openPlayer } = useAppStore();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Derive league from match competition
  const getLeagueCode = useCallback((competition: string | null): string => {
    if (!competition) return 'eng.1';
    const c = competition.toLowerCase();
    if (c.includes('ligue 1')) return 'fra.1';
    if (c.includes('premier league')) return 'eng.1';
    if (c.includes('la liga')) return 'esp.1';
    if (c.includes('serie a')) return 'ita.1';
    if (c.includes('bundesliga')) return 'ger.1';
    if (c.includes('champions league')) return 'uefa.champions';
    if (c.includes('europa league') && !c.includes('conference')) return 'uefa.europa';
    if (c.includes('conference league')) return 'uefa.europa.conf';
    if (c.includes('liga portugal')) return 'por.1';
    if (c.includes('eredivisie')) return 'ned.1';
    if (c.includes('süper lig')) return 'tur.1';
    if (c.includes('brasileir')) return 'bra.1';
    if (c.includes('liga profesional')) return 'arg.1';
    if (c.includes('liga mx')) return 'mex.1';
    if (c.includes('mls')) return 'usa.1';
    if (c.includes('saudi')) return 'saudi.1';
    if (c.includes('afc champions')) return 'afc.champions';
    if (c.includes('caf champions')) return 'caf.champions';
    return 'eng.1'; // Default
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!match.id || !isOpen) return;

    setLoading(true);
    setError(null);

    try {
      const league = getLeagueCode(match.competition);
      const matchId = match.id.startsWith('espn_') ? match.id : `espn_${match.id}`;
      const res = await fetch(`/api/match-events?matchId=${encodeURIComponent(matchId)}&league=${encodeURIComponent(league)}`);

      if (!res.ok) throw new Error('Erreur serveur');

      const data = await res.json();
      if (data.error && data.events.length === 0) {
        setError(data.error);
      } else {
        setEvents(data.events || []);
        setLastUpdated(data.lastUpdated);
      }
    } catch (err: any) {
      setError('Impossible de charger les événements');
    } finally {
      setLoading(false);
    }
  }, [match.id, match.competition, isOpen, getLeagueCode]);

  // Fetch on open, and poll every 15s for live matches
  useEffect(() => {
    if (!isOpen) return;

    fetchEvents();

    const isLive = match.status === 'live';
    if (isLive) {
      pollRef.current = setInterval(fetchEvents, 15000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isOpen, match.status, fetchEvents]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;

  // Determine if match is about to start (within 30 min of kickoff)
  const isAboutToStart = (() => {
    if (!match.matchDate || isLive || isFinished) return false;
    const matchDate = new Date(match.matchDate);
    const now = Date.now();
    const diffMs = matchDate.getTime() - now;
    return diffMs <= 30 * 60 * 1000 && diffMs > -5 * 60 * 1000;
  })();

  // Only show watch button for live or about-to-start matches
  const canWatchLive = isLive || isAboutToStart;

  // Find latest score from events
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const displayHomeScore = latestEvent ? latestEvent.homeScore : homeScore;
  const displayAwayScore = latestEvent ? latestEvent.awayScore : awayScore;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-lg border-b border-border/30 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-500">LIVE</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground font-medium">
              {match.competition || 'Match'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchEvents}
              disabled={loading}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Score Banner */}
      <div className="bg-gradient-to-b from-muted/40 to-transparent px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-4">
            {/* Home team */}
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              {match.homeLogo ? (
                <img
                  src={match.homeLogo}
                  alt={match.homeTeam}
                  className="w-12 h-12 rounded-xl object-contain bg-muted/40 p-1"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-bold">
                  {match.homeTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-bold text-center truncate w-full">{match.homeTeam}</span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-black tabular-nums ${isLive ? 'text-red-400' : ''}`}>
                  {displayHomeScore}
                </span>
                <span className="text-xl text-muted-foreground/30 font-light">—</span>
                <span className={`text-4xl font-black tabular-nums ${isLive ? 'text-red-400' : ''}`}>
                  {displayAwayScore}
                </span>
              </div>
              {isLive && match.displayClock && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-green-500">
                    {match.displayClock}
                  </span>
                  {match.isHalftime && (
                    <span className="text-[10px] font-semibold text-amber-500 ml-1">MI-TEMPS</span>
                  )}
                </div>
              )}
              {match.status === 'finished' && (
                <span className="text-xs font-semibold text-muted-foreground mt-1">Terminé</span>
              )}
              {match.status === 'upcoming' && match.matchDate && (
                <span className="text-xs font-semibold text-muted-foreground mt-1">
                  {new Date(match.matchDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Away team */}
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              {match.awayLogo ? (
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="w-12 h-12 rounded-xl object-contain bg-muted/40 p-1"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-bold">
                  {match.awayTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-bold text-center truncate w-full">{match.awayTeam}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Match Timeline */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="max-w-lg mx-auto">
          {/* Section title */}
          <div className="flex items-center gap-2 mb-4 mt-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Chronologie du match
            </span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          {/* Loading state */}
          {loading && events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
              <p className="text-sm text-muted-foreground">Chargement des événements...</p>
            </div>
          )}

          {/* Error state */}
          {error && events.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-400 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{error}</p>
              <Button onClick={fetchEvents} size="sm" variant="outline" className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            </div>
          )}

          {/* Events list */}
          {events.length > 0 && (
            <div className="space-y-1">
              {events.map((event, idx) => {
                const isHome = event.team.toLowerCase().includes(match.homeTeam.toLowerCase()) ||
                  match.homeTeam.toLowerCase().includes(event.team.toLowerCase());
                const isAway = event.team.toLowerCase().includes(match.awayTeam.toLowerCase()) ||
                  match.awayTeam.toLowerCase().includes(event.team.toLowerCase());

                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 py-3 px-4 rounded-xl transition-colors ${
                      event.type === 'goal'
                        ? 'bg-green-500/5 border border-green-500/10'
                        : event.type === 'red_card'
                          ? 'bg-red-500/5 border border-red-500/10'
                          : event.type === 'var_review'
                            ? 'bg-violet-500/5 border border-violet-500/10'
                            : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Minute */}
                    <div className="flex-shrink-0 w-10 text-right">
                      <span className="text-xs font-bold tabular-nums text-muted-foreground">
                        {event.minute}&apos;
                      </span>
                    </div>

                    {/* Timeline dot */}
                    <div className="flex-shrink-0 flex flex-col items-center pt-0.5">
                      <EventIcon type={event.type} />
                    </div>

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold ${
                          event.type === 'goal' ? 'text-green-600' :
                          event.type === 'red_card' ? 'text-red-500' :
                          event.type === 'yellow_card' ? 'text-yellow-600' :
                          event.type === 'var_review' ? 'text-violet-500' :
                          'text-foreground'
                        }`}>
                          {eventLabel(event.type)}
                        </span>
                        {event.detail && (
                          <span className="text-[10px] text-muted-foreground/60 font-medium">
                            ({event.detail})
                          </span>
                        )}
                      </div>

                      {/* Player info */}
                      {event.player && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {event.teamLogo && (
                            <img src={event.teamLogo} alt="" className="w-4 h-4 rounded object-contain" />
                          )}
                          <span className="text-sm font-medium truncate">{event.player}</span>
                          {event.assistPlayer && (
                            <span className="text-xs text-muted-foreground/60">
                              (passe décisive: {event.assistPlayer})
                            </span>
                          )}
                          {event.playerIn && event.type === 'substitution' && (
                            <span className="text-xs text-green-500/70 flex items-center gap-0.5">
                              <ArrowRightLeft className="h-2.5 w-2.5" />
                              {event.playerIn}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Team name if not matching player */}
                      {!event.player && event.team && (
                        <span className="text-xs text-muted-foreground">{event.team}</span>
                      )}
                    </div>

                    {/* Score at this point */}
                    {event.type === 'goal' && (
                      <div className="flex-shrink-0 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/15">
                        <span className="text-xs font-bold tabular-nums text-green-600">
                          {event.homeScore} - {event.awayScore}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* No events */}
          {!loading && !error && events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Circle className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {isLive
                  ? 'Les événements apparaîtront ici en temps réel'
                  : match.status === 'upcoming'
                    ? 'Le suivi en direct sera disponible au coup d\'envoi'
                    : 'Aucun événement disponible pour ce match'
                }
              </p>
              {isLive && (
                <p className="text-xs text-muted-foreground/50 mt-1">
                  Mise à jour automatique toutes les 15 secondes
                </p>
              )}
            </div>
          )}

          {/* Watch live button — only for live or about-to-start matches */}
          {canWatchLive && (
            <div className="mt-6">
              <Button
                className={`w-full gap-2 h-10 font-semibold ${
                  isLive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
                onClick={async () => {
                  try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 45000);

                    const res = await fetch('/api/match-stream', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        homeTeam: match.homeTeam,
                        awayTeam: match.awayTeam,
                        competition: match.competition,
                        matchDate: match.matchDate,
                        sport: 'football',
                      }),
                      signal: controller.signal,
                    });

                    clearTimeout(timeout);

                    if (res.ok) {
                      const data = await res.json();
                      const channels = data.channels || [];
                      if (channels.length > 0) {
                        const first = channels[0];
                        const alternatives = channels.slice(1);
                        openPlayer(
                          first.url,
                          first.name,
                          first.logo || undefined,
                          alternatives
                        );
                        onClose();
                      }
                    }
                  } catch (err) {
                    console.error('Error finding stream from tracker:', err);
                  }
                }}
              >
                <Tv className="h-4 w-4" />
                {isLive ? 'Regarder en direct' : 'Regarder le match'}
              </Button>
            </div>
          )}

          {/* Finished match info */}
          {isFinished && (
            <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Résumé du match</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Ce match est terminé. Consultez la chronologie ci-dessus pour les événements du match.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom safe area */}
      <div className="sticky bottom-0 bg-background/90 backdrop-blur-lg border-t border-border/20 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/40">
            {lastUpdated ? `Dernière maj: ${new Date(lastUpdated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
          </span>
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 text-xs">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
