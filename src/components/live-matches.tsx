'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import MatchCard from '@/components/match-card';
import { Loader2, Zap, Calendar, Trophy, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LiveMatches() {
  const {
    footballMatches,
    footballLoading,
    footballError,
    footballLastUpdated,
    fetchFootballMatches,
  } = useAppStore();

  // Fetch on mount
  useEffect(() => {
    fetchFootballMatches();
  }, [fetchFootballMatches]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFootballMatches();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFootballMatches]);

  const handleRetry = useCallback(() => {
    fetchFootballMatches();
  }, [fetchFootballMatches]);

  const liveMatches = footballMatches.filter((m) => m.status === 'live');
  const upcomingMatches = footballMatches.filter((m) => m.status === 'upcoming');
  const finishedMatches = footballMatches.filter((m) => m.status === 'finished');

  // Format last updated time
  const lastUpdatedStr = footballLastUpdated
    ? new Date(footballLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // Loading state (first load, no data yet)
  if (footballLoading && footballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-4" />
        <p className="text-sm text-muted-foreground">Chargement des matchs en direct...</p>
      </div>
    );
  }

  // Error state (no data)
  if (footballError && footballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-red-500/50 mb-4" />
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
        <p className="text-sm text-muted-foreground mb-4">
          Aucun match trouvé aujourd&apos;hui. Revenez plus tard pour les scores en direct !
        </p>
        <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Last updated indicator */}
      {lastUpdatedStr && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Dernière mise à jour : {lastUpdatedStr}</span>
          </div>
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
      )}

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
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-900/40 via-green-800/30 to-emerald-900/40 border border-green-500/20 p-5 live-glow">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.5_0.2_145_/_20%),transparent_70%)]" />
          <div className="relative z-10">
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
                    <img src={match.homeLogo} alt="" className="w-12 h-12 rounded-full object-contain bg-muted/30 p-1" />
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
                    <img src={match.awayLogo} alt="" className="w-12 h-12 rounded-full object-contain bg-muted/30 p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center font-bold text-sm">
                      {match.awayTeam.slice(0, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
