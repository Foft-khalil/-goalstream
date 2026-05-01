'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, RefreshCw, Loader2, Circle, ArrowRightLeft, AlertTriangle, Tv, Clock, MapPin, Users, Trophy, BarChart3, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import DynamicBasketballCourt from '@/components/dynamic-basketball-court';

// ─── Types (must match API) ───────────────────────────────────────────────────
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

interface QuarterScore {
  period: number;
  label: string;
  homeScore: number;
  awayScore: number;
}

interface TeamStat {
  label: string;
  homeValue: string;
  awayValue: string;
}

interface TopPerformer {
  name: string;
  headshot?: string | null;
  teamAbbr: string;
  position?: string;
  value: string;
  category: string;
}

interface MatchSummary {
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeRecord: string | null;
  awayRecord: string | null;
  quarterScores: QuarterScore[];
  teamStats: TeamStat[];
  topPerformers: TopPerformer[];
  venue: string | null;
  attendance: string | null;
  matchDate: string | null;
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
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'stats' | 'players'>('timeline');
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
        if (data.summary) {
          setSummary(data.summary);
        }
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

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setEvents([]);
      setSummary(null);
      setError(null);
      setActiveTab('timeline');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  // Use summary data for accurate scores when available
  const homeScore = summary?.homeScore ?? match.homeScore ?? 0;
  const awayScore = summary?.awayScore ?? match.awayScore ?? 0;

  // Find latest score from events
  const latestEvent = events.length > 0 ? events[0] : null;
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

  // Determine winner for finished matches
  const homeWins = isFinished && displayHomeScore > displayAwayScore;
  const awayWins = isFinished && displayAwayScore > displayHomeScore;

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
                  className={`w-12 h-12 rounded-xl object-contain bg-muted/40 p-1 ${homeWins ? 'ring-2 ring-green-500/40' : ''}`}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className={`w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-sm font-bold text-orange-500 ${homeWins ? 'ring-2 ring-green-500/40' : ''}`}>
                  {homeAbbr}
                </div>
              )}
              <span className={`text-sm font-bold text-center truncate w-full ${homeWins ? 'text-green-500' : ''}`}>
                {match.homeTeam}
              </span>
              {summary?.homeRecord && (
                <span className="text-[10px] text-muted-foreground/50">{summary.homeRecord}</span>
              )}
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-black tabular-nums ${isLive ? 'text-orange-400' : homeWins ? 'text-green-500' : ''}`}>
                  {displayHomeScore}
                </span>
                <span className="text-xl text-muted-foreground/30 font-light">—</span>
                <span className={`text-4xl font-black tabular-nums ${isLive ? 'text-orange-400' : awayWins ? 'text-green-500' : ''}`}>
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
                  className={`w-12 h-12 rounded-xl object-contain bg-muted/40 p-1 ${awayWins ? 'ring-2 ring-green-500/40' : ''}`}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className={`w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-sm font-bold text-green-500 ${awayWins ? 'ring-2 ring-green-500/40' : ''}`}>
                  {awayAbbr}
                </div>
              )}
              <span className={`text-sm font-bold text-center truncate w-full ${awayWins ? 'text-green-500' : ''}`}>
                {match.awayTeam}
              </span>
              {summary?.awayRecord && (
                <span className="text-[10px] text-muted-foreground/50">{summary.awayRecord}</span>
              )}
            </div>
          </div>

          {/* Quarter-by-quarter scores table */}
          {summary && summary.quarterScores.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground/50">
                    <th className="text-left py-1 px-2 font-medium w-16"></th>
                    {summary.quarterScores.map(q => (
                      <th key={q.label} className="text-center py-1 px-1.5 font-medium min-w-[32px]">{q.label}</th>
                    ))}
                    <th className="text-center py-1 px-2 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/20">
                    <td className="py-1.5 px-2 font-semibold text-left flex items-center gap-1">
                      {summary.homeLogo ? (
                        <img src={summary.homeLogo} alt="" className="w-4 h-4 rounded object-contain" />
                      ) : null}
                      {summary.homeAbbr || homeAbbr}
                    </td>
                    {summary.quarterScores.map(q => (
                      <td key={`h-${q.label}`} className="text-center py-1.5 px-1.5 tabular-nums">{q.homeScore}</td>
                    ))}
                    <td className={`text-center py-1.5 px-2 font-bold tabular-nums ${homeWins ? 'text-green-500' : ''}`}>{summary.homeScore}</td>
                  </tr>
                  <tr className="border-t border-border/20">
                    <td className="py-1.5 px-2 font-semibold text-left flex items-center gap-1">
                      {summary.awayLogo ? (
                        <img src={summary.awayLogo} alt="" className="w-4 h-4 rounded object-contain" />
                      ) : null}
                      {summary.awayAbbr || awayAbbr}
                    </td>
                    {summary.quarterScores.map(q => (
                      <td key={`a-${q.label}`} className="text-center py-1.5 px-1.5 tabular-nums">{q.awayScore}</td>
                    ))}
                    <td className={`text-center py-1.5 px-2 font-bold tabular-nums ${awayWins ? 'text-green-500' : ''}`}>{summary.awayScore}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Dynamic Basketball Court Visualization */}
          <DynamicBasketballCourt
            possession={possession}
            homeAbbr={homeAbbr}
            awayAbbr={awayAbbr}
            homeColor="#ff6b00"
            awayColor="#22c55e"
            isLive={isLive}
            lastEventType={events.length > 0 ? events[0].type : null}
            clockDisplay={match.clockDisplay ?? null}
            periodDisplay={match.periodDisplay ?? null}
            events={events.map(e => ({ type: e.type, minute: e.minute, period: e.period, team: e.team, scoringPlay: e.scoringPlay }))}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border/30 px-4">
        <div className="max-w-lg mx-auto flex">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground'
            }`}
          >
            📋 Chronologie
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground'
            }`}
          >
            📊 Statistiques
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'players'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground'
            }`}
          >
            ⭐ Joueurs clés
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="max-w-lg mx-auto">

          {/* ── TIMELINE TAB ──────────────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <>
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
                <div className="space-y-1 mt-3">
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
            </>
          )}

          {/* ── STATS TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'stats' && (
            <>
              {loading && !summary && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-3" />
                  <p className="text-sm text-muted-foreground">Chargement des statistiques...</p>
                </div>
              )}

              {summary && summary.teamStats.length > 0 ? (
                <div className="mt-4 space-y-1">
                  {/* Team headers */}
                  <div className="flex items-center mb-2">
                    <div className="flex-1 text-center">
                      <span className="text-xs font-bold">{summary.homeAbbr || homeAbbr}</span>
                    </div>
                    <div className="w-24"></div>
                    <div className="flex-1 text-center">
                      <span className="text-xs font-bold">{summary.awayAbbr || awayAbbr}</span>
                    </div>
                  </div>

                  {summary.teamStats.map((stat, idx) => {
                    // Determine which side is "winning" this stat
                    const homeNum = parseFloat(stat.homeValue) || 0;
                    const awayNum = parseFloat(stat.awayValue) || 0;
                    const homeBetter = homeNum > awayNum;
                    const awayBetter = awayNum > homeNum;

                    return (
                      <div
                        key={`${stat.label}-${idx}`}
                        className="flex items-center py-2.5 px-3 rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        <div className={`flex-1 text-right text-sm font-semibold tabular-nums ${
                          homeBetter ? 'text-green-500' : 'text-muted-foreground'
                        }`}>
                          {stat.homeValue}
                        </div>
                        <div className="w-24 text-center">
                          <span className="text-[11px] font-medium text-muted-foreground/70">{stat.label}</span>
                        </div>
                        <div className={`flex-1 text-left text-sm font-semibold tabular-nums ${
                          awayBetter ? 'text-green-500' : 'text-muted-foreground'
                        }`}>
                          {stat.awayValue}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Statistiques non disponibles</p>
                </div>
              ) : null}

              {/* Game Info */}
              {summary && (summary.venue || summary.attendance) && (
                <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/20 space-y-2">
                  {summary.venue && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground">{summary.venue}</span>
                    </div>
                  )}
                  {summary.attendance && (
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground">{Number(summary.attendance).toLocaleString('fr-FR')} spectateurs</span>
                    </div>
                  )}
                  {summary.matchDate && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(summary.matchDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── PLAYERS TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'players' && (
            <>
              {loading && !summary && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-3" />
                  <p className="text-sm text-muted-foreground">Chargement des joueurs clés...</p>
                </div>
              )}

              {summary && summary.topPerformers.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {/* Group by category */}
                  {['points', 'rebounds', 'assists'].map(category => {
                    const performers = summary.topPerformers.filter(p => p.category === category);
                    if (performers.length === 0) return null;

                    const categoryLabel = category === 'points' ? 'Points' :
                                         category === 'rebounds' ? 'Rebonds' : 'Passes décisives';
                    const categoryIcon = category === 'points' ? '🏀' :
                                        category === 'rebounds' ? '↩️' : '🤝';

                    return (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">{categoryIcon}</span>
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{categoryLabel}</span>
                          <div className="h-px flex-1 bg-border/30" />
                        </div>
                        <div className="space-y-1.5">
                          {performers.map((performer, idx) => (
                            <div
                              key={`${performer.name}-${category}`}
                              className={`flex items-center gap-3 py-2.5 px-3 rounded-xl ${
                                idx === 0 ? 'bg-orange-500/5 border border-orange-500/10' : 'bg-muted/20'
                              }`}
                            >
                              {/* Headshot or placeholder */}
                              {performer.headshot ? (
                                <img
                                  src={performer.headshot}
                                  alt={performer.name}
                                  className="w-8 h-8 rounded-full object-cover bg-muted/40"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              {!performer.headshot && (
                                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-orange-500">
                                    {performer.name.split(' ').map(n => n[0]).join('')}
                                  </span>
                                </div>
                              )}

                              {/* Name & team */}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold truncate block">{performer.name}</span>
                                <span className="text-[10px] text-muted-foreground/60">
                                  {performer.teamAbbr}{performer.position ? ` · ${performer.position}` : ''}
                                </span>
                              </div>

                              {/* Value */}
                              <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/15">
                                <span className="text-sm font-bold tabular-nums text-orange-500">{performer.value}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Star className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Données des joueurs non disponibles</p>
                </div>
              ) : null}

              {/* Season series info if available */}
              {isFinished && summary && (
                <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Résumé</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {homeWins ? match.homeTeam : match.awayTeam} remporte le match {displayHomeScore} - {displayAwayScore}
                    {summary.venue ? ` à ${summary.venue}` : ''}.
                  </p>
                </div>
              )}
            </>
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
