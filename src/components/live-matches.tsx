'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import MatchCard from '@/components/match-card';
import { Loader2, Zap, Calendar, Trophy, SoccerBall } from 'lucide-react';
import { seedMatches } from '@/lib/seed-client';

export default function LiveMatches() {
  const { matches, matchesLoading, fetchMatches } = useAppStore();
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Auto-seed if no matches
  useEffect(() => {
    if (!matchesLoading && matches.length === 0) {
      const doSeed = async () => {
        setSeeding(true);
        try {
          await seedMatches();
          await fetchMatches();
        } finally {
          setSeeding(false);
        }
      };
      doSeed();
    }
  }, [matchesLoading, matches.length, fetchMatches]);

  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'upcoming');
  const finishedMatches = matches.filter((m) => m.status === 'finished');

  if (matchesLoading && matches.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Trophy className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No matches found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Loading sample matches...
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Hero Banner - shown when there are live matches */}
      {liveMatches.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-900/40 via-green-800/30 to-emerald-900/40 border border-green-500/20 p-5 live-glow">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.5_0.2_145_/_20%),transparent_70%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live Now</span>
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
                  <span className="text-[10px] text-muted-foreground">LIVE</span>
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
            <h2 className="text-lg font-bold">More Live</h2>
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
            <h2 className="text-lg font-bold">Upcoming</h2>
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
            <h2 className="text-lg font-bold text-muted-foreground">Finished</h2>
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
