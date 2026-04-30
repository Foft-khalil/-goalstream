'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, RefreshCw, Loader2, Circle, ArrowRightLeft, AlertTriangle, Tv, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

interface BasketballMatchEvent {
  id: string;
  type: 'field_goal' | 'three_pointer' | 'free_throw' | 'rebound' | 'assist' | 'turnover' |
        'foul' | 'technical_foul' | 'flagrant_foul' | 'ejection' | 'timeout' |
        'period_start' | 'period_end' | 'substitution' | 'jump_ball' | 'review';
  minute: string;
  period: string;
  team: string;
  teamLogo: string | null;
  player: string;
  assistPlayer?: string;
  playerIn?: string;
  detail?: string;
  homeScore: number;
  awayScore: number;
  scoringPlay: boolean;
}

interface BasketballMatchTrackerProps {
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
    homeAbbreviation?: string | null;
    awayAbbreviation?: string | null;
    status: string;
    competition: string | null;
    matchDate: string | null;
    periodDisplay?: string | null;
    clockDisplay?: string | null;
  };
}

// ─── Basketball Court SVG Component ───────────────────────────────────────────
function BasketballCourt({ possession, homeAbbr, awayAbbr, homeColor, awayColor }: {
  possession: 'home' | 'away' | null;
  homeAbbr: string;
  awayAbbr: string;
  homeColor: string;
  awayColor: string;
}) {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <svg viewBox="0 0 500 300" className="w-full h-auto rounded-xl overflow-hidden border border-border/30">
        {/* Court background */}
        <rect x="0" y="0" width="500" height="300" fill="#1a1a2e" />

        {/* Court outline */}
        <rect x="10" y="10" width="480" height="280" fill="none" stroke="#3d3d5c" strokeWidth="2" rx="2" />

        {/* Half court line */}
        <line x1="250" y1="10" x2="250" y2="290" stroke="#3d3d5c" strokeWidth="2" />

        {/* Center circle */}
        <circle cx="250" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="2" />
        <circle cx="250" cy="150" r="4" fill="#3d3d5c" />

        {/* Left key/paint */}
        <rect x="10" y="100" width="80" height="100" fill="rgba(255,107,0,0.06)" stroke="#3d3d5c" strokeWidth="1.5" />
        {/* Left basket circle */}
        <circle cx="40" cy="150" r="20" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />
        <circle cx="40" cy="150" r="3" fill="#ff6b00" opacity="0.6" />
        {/* Left free throw circle */}
        <circle cx="90" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="1" strokeDasharray="4 4" />
        {/* Left 3-point arc */}
        <path d="M 10 35 Q 170 35 170 150 Q 170 265 10 265" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />

        {/* Right key/paint */}
        <rect x="410" y="100" width="80" height="100" fill="rgba(34,197,94,0.06)" stroke="#3d3d5c" strokeWidth="1.5" />
        {/* Right basket circle */}
        <circle cx="460" cy="150" r="20" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />
        <circle cx="460" cy="150" r="3" fill="#22c55e" opacity="0.6" />
        {/* Right free throw circle */}
        <circle cx="410" cy="150" r="40" fill="none" stroke="#3d3d5c" strokeWidth="1" strokeDasharray="4 4" />
        {/* Right 3-point arc */}
        <path d="M 490 35 Q 330 35 330 150 Q 330 265 490 265" fill="none" stroke="#3d3d5c" strokeWidth="1.5" />

        {/* Possession indicator — glowing ball on the side with possession */}
        {possession === 'home' && (
          <>
            <circle cx="180" cy="150" r="8" fill="#ff6b00" opacity="0.9">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="180" cy="150" r="12" fill="none" stroke="#ff6b00" strokeWidth="1" opacity="0.4">
              <animate attributeName="r" values="10;16;10" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </>
        )}
        {possession === 'away' && (
          <>
            <circle cx="320" cy="150" r="8" fill="#22c55e" opacity="0.9">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="320" cy="150" r="12" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.4">
              <animate attributeName="r" values="10;16;10" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </>
        )}

        {/* Team labels */}
        <text x="60" y="25" fill={homeColor} fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          {homeAbbr}
        </text>
        <text x="440" y="25" fill={awayColor} fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          {awayAbbr}
        </text>

        {/* Possession label */}
        {possession && (
          <text x="250" y="285" fill={possession === 'home' ? homeColor : awayColor} fontSize="9" textAnchor="middle" fontFamily="sans-serif" opacity="0.7">
            Possession: {possession === 'home' ? homeAbbr : awayAbbr}
          </text>
        )}
      </svg>
    </div>
  );
}

// ─── Event icon component ─────────────────────────────────────────────────────
function EventIcon({ type }: { type: BasketballMatchEvent['type'] }) {
  switch (type) {
    case 'field_goal':
      return <span className="text-sm">🏀</span>;
    case 'three_pointer':
      return <span className="text-sm font-bold text-green-400">3️⃣</span>;
    case 'free_throw':
      return <span className="text-sm">🎯</span>;
    case 'rebound':
      return <span className="text-sm">↩️</span>;
    case 'assist':
      return <span className="text-sm">🤝</span>;
    case 'turnover':
      return <span className="text-sm">❌</span>;
    case 'foul':
      return <div className="w-3 h-4 rounded-[2px] bg-yellow-400 border border-yellow-500/50" />;
    case 'technical_foul':
      return <div className="w-3 h-4 rounded-[2px] bg-yellow-500 border border-yellow-600/50 flex items-center justify-center">
        <span className="text-[6px] font-black text-black">T</span>
      </div>;
    case 'flagrant_foul':
      return <div className="w-3 h-4 rounded-[2px] bg-red-500 border border-red-600/50 flex items-center justify-center">
        <span className="text-[6px] font-black text-white">F</span>
      </div>;
    case 'ejection':
      return <span className="text-sm">🟥</span>;
    case 'timeout':
      return <span className="text-sm">⏱️</span>;
    case 'substitution':
      return <ArrowRightLeft className="h-3.5 w-3.5 text-green-500" />;
    case 'jump_ball':
      return <span className="text-sm">⬆️</span>;
    case 'review':
      return <span className="text-sm">📺</span>;
    case 'period_start':
      return <Circle className="h-3 w-3 text-green-500 fill-green-500" />;
    case 'period_end':
      return <span className="text-sm">🏁</span>;
    default:
      return null;
  }
}

// ─── Event label in French ────────────────────────────────────────────────────
function eventLabel(type: BasketballMatchEvent['type']): string {
  switch (type) {
    case 'field_goal': return 'Panier';
    case 'three_pointer': return '3 points';
    case 'free_throw': return 'Lancé franc';
    case 'rebound': return 'Rebond';
    case 'assist': return 'Passe décisive';
    case 'turnover': return 'Ball perdu';
    case 'foul': return 'Faute';
    case 'technical_foul': return 'Faute technique';
    case 'flagrant_foul': return 'Faute flagrante';
    case 'ejection': return 'Expulsion';
    case 'timeout': return 'Temps mort';
    case 'substitution': return 'Remplacement';
    case 'jump_ball': return 'Entre-deux';
    case 'review': return 'Révision vidéo';
    case 'period_start': return 'Début';
    case 'period_end': return 'Fin';
    default: return '';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BasketballMatchTracker({ isOpen, onClose, match }: BasketballMatchTrackerProps) {
  const [events, setEvents] = useState<BasketballMatchEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [possession, setPossession] = useState<'home' | 'away' | null>(null);
  const { openPlayer } = useAppStore();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Derive league from match competition
  const getLeagueCode = useCallback((competition: string | null): string => {
    if (!competition) return 'nba';
    const c = competition.toLowerCase();
    if (c.includes('nba')) return 'nba';
    if (c.includes('euroleague')) return 'euroleague';
    if (c.includes('ncaa') || c.includes('college')) return 'mens-college-basketball';
    if (c.includes('wnba')) return 'wnba';
    return 'nba';
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!match.id || !isOpen) return;

    setLoading(true);
    setError(null);

    try {
      const league = getLeagueCode(match.competition);
      const matchId = match.id.startsWith('espn_') ? match.id : `espn_${match.id}`;
      const res = await fetch(`/api/basketball-events?matchId=${encodeURIComponent(matchId)}&league=${encodeURIComponent(league)}`);

      if (!res.ok) throw new Error('Erreur serveur');

      const data = await res.json();
      if (data.error && data.events.length === 0) {
        setError(data.error);
      } else {
        setEvents(data.events || []);
        setLastUpdated(data.lastUpdated);
        setPossession(data.possession || null);
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

  // Find latest score from events
  const latestEvent = events.length > 0 ? events[0] : null; // Newest first
  const displayHomeScore = latestEvent ? latestEvent.homeScore : homeScore;
  const displayAwayScore = latestEvent ? latestEvent.awayScore : awayScore;

  // Team abbreviations
  const homeAbbr = match.homeAbbreviation || match.homeTeam.slice(0, 3).toUpperCase();
  const awayAbbr = match.awayAbbreviation || match.awayTeam.slice(0, 3).toUpperCase();

  // Determine if match is about to start
  const isAboutToStart = (() => {
    if (!match.matchDate || isLive || isFinished) return false;
    const matchDate = new Date(match.matchDate);
    const now = Date.now();
    const diffMs = matchDate.getTime() - now;
    return diffMs <= 30 * 60 * 1000 && diffMs > -5 * 60 * 1000;
  })();

  const canWatchLive = isLive || isAboutToStart;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-lg border-b border-border/30 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] font-bold text-orange-500">LIVE</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              🏀 {match.competition || 'Basketball'}
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

      {/* Score Banner + Court */}
      <div className="bg-gradient-to-b from-muted/40 to-transparent px-4 py-4">
        <div className="max-w-lg mx-auto">
          {/* Score banner */}
          <div className="flex items-center justify-center gap-4 mb-4">
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
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-sm font-bold text-orange-500">
                  {homeAbbr}
                </div>
              )}
              <span className="text-sm font-bold text-center truncate w-full">{match.homeTeam}</span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-black tabular-nums ${isLive ? 'text-orange-400' : ''}`}>
                  {displayHomeScore}
                </span>
                <span className="text-xl text-muted-foreground/30 font-light">—</span>
                <span className={`text-4xl font-black tabular-nums ${isLive ? 'text-orange-400' : ''}`}>
                  {displayAwayScore}
                </span>
              </div>
              {/* Live clock display */}
              {isLive && (match.clockDisplay || match.periodDisplay) && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-xs font-bold text-orange-500">
                    {match.periodDisplay || ''}{match.clockDisplay && match.clockDisplay !== '0:00' ? ` ${match.clockDisplay}` : ''}
                  </span>
                </div>
              )}
              {isFinished && (
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
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-sm font-bold text-green-500">
                  {awayAbbr}
                </div>
              )}
              <span className="text-sm font-bold text-center truncate w-full">{match.awayTeam}</span>
            </div>
          </div>

          {/* Basketball Court Visualization */}
          <BasketballCourt
            possession={possession}
            homeAbbr={homeAbbr}
            awayAbbr={awayAbbr}
            homeColor="#ff6b00"
            awayColor="#22c55e"
          />
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
              <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-3" />
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
              {events.map((event) => {
                const isHome = event.team.toLowerCase().includes(match.homeTeam.toLowerCase()) ||
                  match.homeTeam.toLowerCase().includes(event.team.toLowerCase());

                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 py-3 px-4 rounded-xl transition-colors ${
                      event.scoringPlay
                        ? 'bg-orange-500/5 border border-orange-500/10'
                        : event.type === 'flagrant_foul' || event.type === 'ejection'
                          ? 'bg-red-500/5 border border-red-500/10'
                          : event.type === 'technical_foul'
                            ? 'bg-yellow-500/5 border border-yellow-500/10'
                            : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Clock + Period */}
                    <div className="flex-shrink-0 w-16 text-right">
                      <span className="text-xs font-bold tabular-nums text-muted-foreground">
                        {event.minute || '—'}
                      </span>
                      {event.period && (
                        <span className="block text-[9px] text-muted-foreground/50 truncate">
                          {event.period}
                        </span>
                      )}
                    </div>

                    {/* Timeline dot */}
                    <div className="flex-shrink-0 flex flex-col items-center pt-0.5">
                      <EventIcon type={event.type} />
                    </div>

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold ${
                          event.scoringPlay ? 'text-orange-500' :
                          event.type === 'technical_foul' ? 'text-yellow-600' :
                          event.type === 'flagrant_foul' || event.type === 'ejection' ? 'text-red-500' :
                          event.type === 'foul' ? 'text-yellow-600' :
                          'text-foreground'
                        }`}>
                          {eventLabel(event.type)}
                        </span>
                        {event.detail && (
                          <span className="text-[10px] text-muted-foreground/60 font-medium truncate max-w-[200px]">
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
                              (passe: {event.assistPlayer})
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

                      {/* Team name if no player */}
                      {!event.player && event.team && (
                        <span className="text-xs text-muted-foreground">{event.team}</span>
                      )}
                    </div>

                    {/* Score at this point for scoring plays */}
                    {event.scoringPlay && (
                      <div className="flex-shrink-0 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/15">
                        <span className="text-xs font-bold tabular-nums text-orange-500">
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
              <span className="text-4xl mb-3">🏀</span>
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
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
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
                        sport: 'basketball',
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
                        openPlayer(first.url, first.name, first.logo || undefined, alternatives);
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
