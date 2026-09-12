'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, RefreshCw, Loader2, Circle, Square, ArrowRightLeft, AlertTriangle, Eye, MapPin, Users, Clock, Trophy, BarChart3, Star, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import DynamicFootballPitch from '@/components/dynamic-football-pitch';

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface FootballTeamStat {
  label: string;
  homeValue: string;
  awayValue: string;
  homePercent?: number;
  awayPercent?: number;
}

interface FootballTopPerformer {
  name: string;
  teamAbbr: string;
  position?: string;
  value: string;
  category: string;
}

interface LineupPlayer {
  id: string;
  name: string;
  shortName: string;
  jersey: string;
  position: string;
  positionFull: string;
  formationPlace: number;
  subbedIn: boolean;
  subbedOut: boolean;
}

interface TeamLineup {
  teamAbbr: string;
  teamName: string;
  formation: string | null;
  starters: LineupPlayer[];
  substitutes: LineupPlayer[];
}

interface FootballMatchSummary {
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeForm: string | null;
  awayForm: string | null;
  teamStats: FootballTeamStat[];
  topPerformers: FootballTopPerformer[];
  homeLineup: TeamLineup | null;
  awayLineup: TeamLineup | null;
  venue: string | null;
  attendance: string | null;
  officials: string[];
  matchDate: string | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
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
      return <div className="w-3.5 h-5 rounded-[2px] bg-yellow-400 border border-yellow-500/50" />;
    case 'red_card':
      return <div className="w-3.5 h-5 rounded-[2px] bg-red-500 border border-red-600/50" />;
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

// Event label (i18n)
function eventLabel(type: MatchEvent['type'], language: string): string {
  switch (type) {
    case 'goal': return t(language, 'tracker.goal');
    case 'yellow_card': return t(language, 'tracker.yellowCard');
    case 'red_card': return t(language, 'tracker.redCard');
    case 'substitution': return t(language, 'tracker.substitution');
    case 'var_review': return 'VAR';
    case 'period_start': return t(language, 'tracker.start');
    case 'period_end': return t(language, 'tracker.end');
    default: return '';
  }
}

// ─── Form guide display ───────────────────────────────────────────────────────
function FormGuide({ form }: { form: string | null }) {
  if (!form) return null;

  const results = form.split('').slice(-5); // Last 5 results
  return (
    <div className="flex gap-0.5">
      {results.map((r, i) => (
        <div
          key={i}
          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white ${
            r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-yellow-500' : r === 'L' ? 'bg-red-500' : 'bg-muted'
          }`}
        >
          {r}
        </div>
      ))}
    </div>
  );
}

// ─── Position color helper ──────────────────────────────────────────────────
function positionColor(pos: string): string {
  const p = pos.toUpperCase();
  if (p === 'G' || p === 'GK') return 'bg-amber-500/15 text-amber-600 border-amber-500/20';
  if (p === 'D' || p === 'DF' || p === 'DEF') return 'bg-sky-500/15 text-sky-600 border-sky-500/20';
  if (p === 'M' || p === 'MF' || p === 'MID') return 'bg-green-500/15 text-green-600 border-green-500/20';
  if (p === 'F' || p === 'FW' || p === 'FWD') return 'bg-red-500/15 text-red-500 border-red-500/20';
  return 'bg-muted/30 text-muted-foreground border-border/20';
}

function positionLabel(pos: string, language: string): string {
  const p = pos.toUpperCase();
  if (p === 'G' || p === 'GK') return t(language, 'tracker.posGK');
  if (p === 'D' || p === 'DF' || p === 'DEF') return t(language, 'tracker.posDEF');
  if (p === 'M' || p === 'MF' || p === 'MID') return t(language, 'tracker.posMID');
  if (p === 'F' || p === 'FW' || p === 'FWD') return t(language, 'tracker.posFWD');
  return pos;
}

// ─── Team Lineup Card ──────────────────────────────────────────────────────
function TeamLineupCard({ lineup, teamLogo, isHome, language }: {
  lineup: TeamLineup;
  teamLogo: string | null;
  isHome: boolean;
  language: string;
}) {
  return (
    <div className="rounded-xl border border-border/20 bg-muted/10 overflow-hidden">
      {/* Team header */}
      <div className={`px-4 py-3 flex items-center justify-between ${isHome ? 'bg-green-500/5' : 'bg-sky-500/5'}`}>
        <div className="flex items-center gap-2.5">
          {teamLogo ? (
            <img src={teamLogo} alt="" className="w-7 h-7 rounded-lg object-contain bg-muted/40 p-0.5" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center text-[10px] font-bold">
              {lineup.teamAbbr.slice(0, 2)}
            </div>
          )}
          <div>
            <span className="text-sm font-bold">{lineup.teamName}</span>
          </div>
        </div>
        {lineup.formation && (
          <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${
            isHome ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-sky-500/10 border-sky-500/20 text-sky-600'
          }`}>
            {lineup.formation}
          </div>
        )}
      </div>

      {/* Starting XI */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-sm">⚽</span>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {t(language, 'tracker.startingXI')}
          </span>
          <span className="text-[10px] text-muted-foreground/50 ml-auto">{lineup.starters.length}</span>
        </div>
        <div className="space-y-1">
          {lineup.starters.map((player, idx) => (
            <div
              key={player.id}
              className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg transition-colors ${
                idx === 0 ? '' : 'hover:bg-muted/20'
              }`}
            >
              {/* Jersey number */}
              <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-muted-foreground">{player.jersey || '-'}</span>
              </div>

              {/* Player name */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium truncate block ${player.subbedOut ? 'line-through text-muted-foreground/50' : ''}`}>
                  {player.name}
                </span>
              </div>

              {/* Position badge */}
              <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${positionColor(player.position)}`}>
                {player.position || '?'}
              </div>

              {/* Sub indicator */}
              {player.subbedOut && (
                <span className="text-[10px] text-red-400/70 font-medium">↘</span>
              )}
              {player.subbedIn && (
                <span className="text-[10px] text-green-500/70 font-medium">↗</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Substitutes */}
      {lineup.substitutes.length > 0 && (
        <div className="px-4 pt-2 pb-3 border-t border-border/10">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-sm">🔄</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {t(language, 'tracker.substitutes')}
            </span>
            <span className="text-[10px] text-muted-foreground/50 ml-auto">{lineup.substitutes.length}</span>
          </div>
          <div className="space-y-1">
            {lineup.substitutes.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg hover:bg-muted/20 transition-colors"
              >
                {/* Jersey number */}
                <div className="w-7 h-7 rounded-lg bg-muted/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-muted-foreground/50">{player.jersey || '-'}</span>
                </div>

                {/* Player name */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium truncate block ${player.subbedIn ? '' : 'text-muted-foreground/70'}`}>
                    {player.name}
                  </span>
                </div>

                {/* Position badge */}
                <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${positionColor(player.position)} opacity-70`}>
                  {player.position || '?'}
                </div>

                {/* Sub indicator */}
                {player.subbedIn && (
                  <span className="text-[10px] text-green-500/70 font-medium">↗</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchTracker({ isOpen, onClose, match }: MatchTrackerProps) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [possession, setPossession] = useState<'home' | 'away' | null>(null);
  const [summary, setSummary] = useState<FootballMatchSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'stats' | 'players' | 'lineups'>('timeline');
  const { language } = useAppStore();
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
    if (c.includes('saudi')) return 'ksa.1';
    if (c.includes('afc champions')) return 'afc.champions';
    if (c.includes('caf champions')) return 'caf.champions';
    return 'eng.1';
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!match.id || !isOpen) return;

    setLoading(true);
    setError(null);

    try {
      const league = getLeagueCode(match.competition);
      const matchId = match.id.startsWith('espn_') ? match.id : `espn_${match.id}`;
      const res = await fetch(`/api/match-events?matchId=${encodeURIComponent(matchId)}&league=${encodeURIComponent(league)}`);

      if (!res.ok) throw new Error(t(language, 'tracker.serverError'));

      const data = await res.json();
      if (data.error && data.events.length === 0) {
        setError(data.error);
      } else {
        setEvents(data.events || []);
        setLastUpdated(data.lastUpdated);
        if (data.summary) {
          setSummary(data.summary);
        }
        // Determine possession from the latest event's team
        if (data.events && data.events.length > 0) {
          const latestEvt = data.events[data.events.length - 1];
          if (latestEvt.team) {
            const homeTeamLower = match.homeTeam.toLowerCase();
            const awayTeamLower = match.awayTeam.toLowerCase();
            const evtTeamLower = latestEvt.team.toLowerCase();
            if (evtTeamLower.includes(homeTeamLower) || homeTeamLower.includes(evtTeamLower)) {
              setPossession('home');
            } else if (evtTeamLower.includes(awayTeamLower) || awayTeamLower.includes(evtTeamLower)) {
              setPossession('away');
            }
          }
        }
      }
    } catch (err: any) {
      setError(t(language, 'tracker.cantLoadEvents'));
    } finally {
      setLoading(false);
    }
  }, [match.id, match.competition, isOpen, getLeagueCode, match.homeTeam, match.awayTeam]);

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
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const displayHomeScore = latestEvent ? latestEvent.homeScore : homeScore;
  const displayAwayScore = latestEvent ? latestEvent.awayScore : awayScore;

  // Determine winner
  const homeWins = isFinished && displayHomeScore > displayAwayScore;
  const awayWins = isFinished && displayAwayScore > displayHomeScore;
  const isDraw = isFinished && displayHomeScore === displayAwayScore;

  // Team abbreviations for pitch display
  const homeAbbr = match.homeTeam.slice(0, 3).toUpperCase();
  const awayAbbr = match.awayTeam.slice(0, 3).toUpperCase();

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
              ⚽ {match.competition || t(language, 'nav.matches')}
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
      <div className="bg-gradient-to-b from-muted/40 to-transparent px-4 py-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-4">
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
                <div className={`w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-bold ${homeWins ? 'ring-2 ring-green-500/40' : ''}`}>
                  {match.homeTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className={`text-sm font-bold text-center truncate w-full ${homeWins ? 'text-green-500' : ''}`}>
                {match.homeTeam}
              </span>
              <FormGuide form={summary?.homeForm || null} />
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-black tabular-nums ${isLive ? 'text-red-400' : homeWins ? 'text-green-500' : ''}`}>
                  {displayHomeScore}
                </span>
                <span className="text-xl text-muted-foreground/30 font-light">—</span>
                <span className={`text-4xl font-black tabular-nums ${isLive ? 'text-red-400' : awayWins ? 'text-green-500' : ''}`}>
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
                    <span className="text-[10px] font-semibold text-amber-500 ml-1">{t(language, 'tracker.halftime')}</span>
                  )}
                </div>
              )}
              {isFinished && (
                <span className="text-xs font-semibold text-muted-foreground mt-1">
                  {isDraw ? t(language, 'tracker.draw') : t(language, 'common.finished')}
                </span>
              )}
              {/* Half-time score */}
              {isFinished && summary && summary.halfTimeHome !== null && summary.halfTimeAway !== null && (
                <span className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {t(language, 'match.ht')}: {summary.halfTimeHome} - {summary.halfTimeAway}
                </span>
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
                <div className={`w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-bold ${awayWins ? 'ring-2 ring-green-500/40' : ''}`}>
                  {match.awayTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className={`text-sm font-bold text-center truncate w-full ${awayWins ? 'text-green-500' : ''}`}>
                {match.awayTeam}
              </span>
              <FormGuide form={summary?.awayForm || null} />
            </div>
          </div>

          {/* Dynamic Football Pitch Visualization */}
          <div className="mt-4">
            <DynamicFootballPitch
              homeAbbr={homeAbbr}
              awayAbbr={awayAbbr}
              homeColor="#ef4444"
              awayColor="#3b82f6"
              possession={possession}
              isLive={isLive}
              lastEventType={events.length > 0 ? events[events.length - 1].type : null}
              matchMinute={match.minute != null ? match.minute : (events.length > 0 ? events[events.length - 1].minute : null)}
              events={events.map(e => ({ type: e.type, minute: e.minute, team: e.team }))}
            />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border/30 px-4">
        <div className="max-w-lg mx-auto flex">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-green-500 text-green-500'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground'
            }`}
          >
            📋 {t(language, 'tracker.timeline')}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-green-500 text-green-500'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground'
            }`}
          >
            📊 {t(language, 'tracker.statistics')}
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'players'
                ? 'border-green-500 text-green-500'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground'
            }`}
          >
            ⭐ {t(language, 'tracker.keyPlayers')}
          </button>
          <button
            onClick={() => setActiveTab('lineups')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'lineups'
                ? 'border-green-500 text-green-500'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground'
            }`}
          >
            🏟️ {t(language, 'tracker.lineups')}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="max-w-lg mx-auto">

          {/* ── TIMELINE TAB ──────────────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <>
              {/* Section title */}
              <div className="flex items-center gap-2 mb-4 mt-2">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t(language, 'tracker.timelineMatch')}
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              {/* Loading state */}
              {loading && events.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
                  <p className="text-sm text-muted-foreground">{t(language, 'tracker.loadingEvents')}</p>
                </div>
              )}

              {/* Error state */}
              {error && events.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-400 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">{error}</p>
                  <Button onClick={fetchEvents} size="sm" variant="outline" className="gap-2">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t(language, 'common.retry')}
                  </Button>
                </div>
              )}

              {/* Events list */}
              {events.length > 0 && (
                <div className="space-y-1">
                  {events.map((event, idx) => {
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
                              {eventLabel(event.type, language)}
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
                                  ({t(language, 'tracker.assist')}: {event.assistPlayer})
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
                      ? t(language, 'tracker.eventsWillAppear')
                      : match.status === 'upcoming'
                        ? t(language, 'tracker.liveAtKickoff')
                        : t(language, 'tracker.noEvents')
                    }
                  </p>
                  {isLive && (
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {t(language, 'tracker.autoRefresh')}
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
                  <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
                  <p className="text-sm text-muted-foreground">{t(language, 'tracker.loadingStats')}</p>
                </div>
              )}

              {summary && summary.teamStats.length > 0 ? (
                <div className="mt-4 space-y-1">
                  {/* Team headers */}
                  <div className="flex items-center mb-2">
                    <div className="flex-1 text-center">
                      <span className="text-xs font-bold">{summary.homeAbbr || homeAbbr}</span>
                    </div>
                    <div className="w-28"></div>
                    <div className="flex-1 text-center">
                      <span className="text-xs font-bold">{summary.awayAbbr || awayAbbr}</span>
                    </div>
                  </div>

                  {summary.teamStats.map((stat, idx) => {
                    // Special handling for possession (show bar)
                    const isPossession = stat.label.toLowerCase().includes('possession');
                    const homeNum = parseFloat(stat.homeValue) || 0;
                    const awayNum = parseFloat(stat.awayValue) || 0;
                    const homeBetter = homeNum > awayNum;
                    const awayBetter = awayNum > homeNum;

                    return (
                      <div
                        key={`${stat.label}-${idx}`}
                        className="py-2.5 px-3 rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        {isPossession ? (
                          // Possession bar
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-sm font-bold tabular-nums ${homeBetter ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {stat.homeValue}
                              </span>
                              <span className="text-[11px] font-medium text-muted-foreground/70">{t(language, 'tracker.possession')}</span>
                              <span className={`text-sm font-bold tabular-nums ${awayBetter ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {stat.awayValue}
                              </span>
                            </div>
                            <div className="flex h-1.5 rounded-full overflow-hidden bg-muted/30">
                              <div
                                className="bg-green-500/60 rounded-l-full transition-all"
                                style={{ width: `${homeNum}%` }}
                              />
                              <div
                                className="bg-blue-500/60 rounded-r-full transition-all"
                                style={{ width: `${awayNum}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          // Regular stat row
                          <div className="flex items-center">
                            <div className={`flex-1 text-right text-sm font-semibold tabular-nums ${
                              homeBetter ? 'text-green-500' : 'text-muted-foreground'
                            }`}>
                              {stat.homeValue}
                            </div>
                            <div className="w-28 text-center">
                              <span className="text-[11px] font-medium text-muted-foreground/70">{stat.label}</span>
                            </div>
                            <div className={`flex-1 text-left text-sm font-semibold tabular-nums ${
                              awayBetter ? 'text-green-500' : 'text-muted-foreground'
                            }`}>
                              {stat.awayValue}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : !loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">{t(language, 'tracker.statsUnavailable')}</p>
                </div>
              ) : null}

              {/* Game Info */}
              {summary && (summary.venue || summary.attendance || summary.officials.length > 0) && (
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
                      <span className="text-xs text-muted-foreground">{Number(summary.attendance).toLocaleString()} {t(language, 'tracker.spectators')}</span>
                    </div>
                  )}
                  {summary.officials.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground/50">👤</span>
                      <span className="text-xs text-muted-foreground">{t(language, 'tracker.referee')}: {summary.officials.join(', ')}</span>
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
                  <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
                  <p className="text-sm text-muted-foreground">{t(language, 'tracker.loadingPlayers')}</p>
                </div>
              )}

              {summary && summary.topPerformers.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {/* Group by category */}
                  {['totalShots', 'accuratePasses', 'saves'].map(category => {
                    const performers = summary.topPerformers.filter(p => p.category === category);
                    if (performers.length === 0) return null;

                    const categoryLabel = category === 'totalShots' ? t(language, 'tracker.shots') :
                                         category === 'accuratePasses' ? t(language, 'tracker.accuratePasses') :
                                         category === 'saves' ? t(language, 'tracker.saves') : category;
                    const categoryIcon = category === 'totalShots' ? '🎯' :
                                        category === 'accuratePasses' ? '🤝' :
                                        category === 'saves' ? '🧤' : '⭐';

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
                                idx === 0 ? 'bg-green-500/5 border border-green-500/10' : 'bg-muted/20'
                              }`}
                            >
                              {/* Player initial */}
                              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-green-500">
                                  {performer.name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>

                              {/* Name & team */}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold truncate block">{performer.name}</span>
                                <span className="text-[10px] text-muted-foreground/60">
                                  {performer.teamAbbr}{performer.position ? ` · ${performer.position}` : ''}
                                </span>
                              </div>

                              {/* Value */}
                              <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/15">
                                <span className="text-sm font-bold tabular-nums text-green-500">{performer.value}</span>
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
                  <p className="text-sm text-muted-foreground">{t(language, 'tracker.playersUnavailable')}</p>
                </div>
              ) : null}

              {/* Match summary for finished games */}
              {isFinished && summary && (
                <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t(language, 'tracker.summary')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isDraw
                      ? `${t(language, 'tracker.draw')} ${displayHomeScore} - ${displayAwayScore}${summary.venue ? ` — ${summary.venue}` : ''}`
                      : `${homeWins ? match.homeTeam : match.awayTeam} ${t(language, 'tracker.winsMatch')} ${displayHomeScore} - ${displayAwayScore}${summary.venue ? ` — ${summary.venue}` : ''}`
                    }
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── LINEUPS TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'lineups' && (
            <>
              {loading && !summary?.homeLineup && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
                  <p className="text-sm text-muted-foreground">{t(language, 'tracker.loadingLineups')}</p>
                </div>
              )}

              {summary?.homeLineup && summary?.awayLineup ? (
                <div className="mt-4 space-y-5">
                  {/* Home Team Lineup */}
                  <TeamLineupCard
                    lineup={summary.homeLineup}
                    teamLogo={match.homeLogo}
                    isHome
                    language={language}
                  />

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border/30" />
                    <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase">VS</span>
                    <div className="h-px flex-1 bg-border/30" />
                  </div>

                  {/* Away Team Lineup */}
                  <TeamLineupCard
                    lineup={summary.awayLineup}
                    teamLogo={match.awayLogo}
                    isHome={false}
                    language={language}
                  />
                </div>
              ) : !loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Shirt className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">{t(language, 'tracker.noLineups')}</p>
                  {match.status === 'upcoming' && (
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {t(language, 'tracker.liveAtKickoff')}
                    </p>
                  )}
                </div>
              ) : null}
            </>
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
