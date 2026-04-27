'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import MatchCard from '@/components/match-card';
import { Loader2, Zap, Calendar, Trophy, RefreshCw, AlertCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LiveMatches() {
  const {
    footballMatches,
    footballLoading,
    footballError,
    footballLastUpdated,
    fetchFootballMatches,
  } = useAppStore();

  const [countdown, setCountdown] = useState(120); // 2 min countdown to next refresh
  const lastUpdatedRef = useRef<string | null>(null);

  // Fetch on mount
  useEffect(() => {
    fetchFootballMatches();
  }, [fetchFootballMatches]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFootballMatches();
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFootballMatches]);

  // Countdown timer - resets when lastUpdated changes
  useEffect(() => {
    // Reset countdown if lastUpdated changed
    if (footballLastUpdated !== lastUpdatedRef.current) {
      lastUpdatedRef.current = footballLastUpdated;
    }
    const startTime = Date.now();
    const duration = 120; // 2 minutes
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [footballLastUpdated]);

  const handleRetry = useCallback(() => {
    fetchFootballMatches();
    setCountdown(120);
  }, [fetchFootballMatches]);

  const liveMatches = footballMatches.filter((m) => m.status === 'live');
  const upcomingMatches = footballMatches.filter((m) => m.status === 'upcoming');
  const finishedMatches = footballMatches.filter((m) => m.status === 'finished');

  // Format last updated time
  const lastUpdatedStr = footballLastUpdated
    ? new Date(footballLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const countdownStr = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;

  // Loading state (first load, no data yet)
  if (footballLoading && footballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-green-500 mb-4" />
          <div className="absolute inset-0 h-10 w-10 animate-ping opacity-20">
            <Zap className="h-10 w-10 text-green-500" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">Chargement des matchs en direct...</p>
        <p className="text-xs text-muted-foreground/60">Recherche des scores en temps réel</p>
      </div>
    );
  }

  // Error state (no data)
  if (footballError && footballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <WifiOff className="h-12 w-12 text-red-500/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Erreur de chargement</h3>
        <p className="text-sm text-muted-foreground mb-4">{footballError}</p>
        <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  // No matches found
  if (footballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Trophy className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Aucun match trouvé</h3>
        <p className="text-sm text-muted-foreground mb-1">
          Aucun match trouvé pour aujourd&apos;hui.
        </p>
        <p className="text-xs text-muted-foreground/60 mb-4">
          Les matchs apparaîtront automatiquement quand ils seront disponibles.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
          <span className="text-xs text-muted-foreground/50">Prochaine vérification dans {countdownStr}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Status Bar - Last updated + Refresh */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {liveMatches.length > 0 ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-green-500 font-medium">En direct</span>
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              <span>Données du {lastUpdatedStr}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            Maj dans {countdownStr}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            disabled={footballLoading}
            className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3 w-3 ${footballLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Error banner (data available but refresh failed) */}
      {footballError && footballMatches.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Erreur de rafraîchissement : {footballError}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="ml-auto h-5 px-2 text-[10px] text-red-400 hover:text-red-300"
          >
            Réessayer
          </Button>
        </div>
      )}

      {/* Hero Banner - shown when there are live matches */}
      {liveMatches.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-900/40 via-green-800/30 to-emerald-900/40 border border-green-500/20 live-glow">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.5_0.2_145_/_20%),transparent_70%)]" />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">En Direct</span>
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">
                {liveMatches.length} match{liveMatches.length !== 1 ? 'es' : ''}
              </span>
            </div>
            {liveMatches.slice(0, 1).map((match) => (
              <div key={match.id} className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {match.homeLogo ? (
                    <img
                      src={match.homeLogo}
                      alt=""
                      className="w-12 h-12 rounded-full object-contain bg-muted/30 p-1"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center font-bold text-sm">
                      {match.homeTeam.slice(0, 2)}
                    </div>
                  )}
                  <span className="font-bold text-lg truncate">{match.homeTeam}</span>
                </div>
                <div className="text-center shrink-0">
                  <div className="text-2xl font-black tabular-nums">
                    <span className="text-green-400">{match.homeScore ?? 0}</span>
                    <span className="text-muted-foreground mx-1">:</span>
                    <span className="text-green-400">{match.awayScore ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[10px] text-red-400 font-bold animate-pulse">LIVE</span>
                    {match.minute != null && (
                      <span className="text-[10px] text-muted-foreground font-medium">{match.minute}&apos;</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                  <span className="font-bold text-lg truncate">{match.awayTeam}</span>
                  {match.awayLogo ? (
                    <img
                      src={match.awayLogo}
                      alt=""
                      className="w-12 h-12 rounded-full object-contain bg-muted/30 p-1"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center font-bold text-sm">
                      {match.awayTeam.slice(0, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {liveMatches[0]?.competition && (
              <div className="mt-2 text-center text-xs text-muted-foreground/70">
                {liveMatches[0].competition}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Matches */}
      {liveMatches.length > 1 && (
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Zap className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-bold">En Direct</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveMatches.slice(1).map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Matches */}
      {upcomingMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Calendar className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold">À venir</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
              {upcomingMatches.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Finished Matches */}
      {finishedMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-muted-foreground">Terminés</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
              {finishedMatches.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 opacity-70">
            {finishedMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
