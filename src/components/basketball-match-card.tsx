'use client';

import { Button } from '@/components/ui/button';
import { Clock, Heart, Activity } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useFavorites } from '@/hooks/use-favorites';
import { useState } from 'react';
import type { BasketballMatch } from '@/lib/basketball/types';
import { BasketballLiveClock } from '@/components/live-match-clock';
import BasketballMatchTracker from '@/components/basketball-match-tracker';

interface BasketballMatchCardProps {
  match: BasketballMatch;
}

export default function BasketballMatchCard({ match }: BasketballMatchCardProps) {
  const { language } = useAppStore();
  const { toggleTeamFavorite, isTeamFavorite } = useFavorites();
  const [showTracker, setShowTracker] = useState(false);

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;
  const matchDate = match.matchDate ? new Date(match.matchDate) : null;
  const timeStr = matchDate ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const dateStr = matchDate ? matchDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  const isToday = matchDate ? new Date().toDateString() === matchDate.toDateString() : false;
  const isTomorrow = matchDate ? new Date(Date.now() + 86400000).toDateString() === matchDate.toDateString() : false;
  const homeFav = isTeamFavorite(match.homeTeam);
  const awayFav = isTeamFavorite(match.awayTeam);

  return (
    <>
      <div
        className={`group relative rounded-2xl overflow-hidden transition-all duration-250 hover:translate-y-[-1px] ${
          isLive
            ? 'glass-card-basketball shadow-lg shadow-orange-500/10'
            : isFinished
            ? 'glass-card opacity-75 hover:opacity-100'
            : 'glass-card hover:shadow-md'
        }`}
      >
        {/* Live subtle gradient overlay */}
        {isLive && <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.03] to-transparent pointer-events-none" />}

        <div className="relative px-4 py-4">
          {/* Top row: competition + date/time/status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-1 h-4 rounded-full ${isLive ? 'bg-orange-500' : isFinished ? 'bg-muted-foreground/40' : 'bg-orange-400/60'}`} />
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
                {match.competition || t(language, 'nav.basketball')}
              </span>
            </div>
            {isLive ? (
              <BasketballLiveClock
                clockDisplay={match.clockDisplay}
                periodDisplay={match.periodDisplay}
              />
            ) : isFinished ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/50 dark:bg-white/[0.04] border border-border/40 dark:border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{t(language, 'common.finished')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-orange-400/60" />
                <span className="text-[11px] font-semibold text-muted-foreground/70">
                  {isToday ? `${t(language, 'common.today')} ${timeStr}` : isTomorrow ? `${t(language, 'common.tomorrow')} ${timeStr}` : `${dateStr} ${timeStr}`}
                </span>
              </div>
            )}
          </div>

          {/* Teams + Score row */}
          <div className="flex items-center gap-2">
            {/* Home team */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {match.homeLogo ? (
                <img
                  src={match.homeLogo}
                  alt={match.homeTeam}
                  className="w-10 h-10 rounded-xl object-contain bg-secondary/30 dark:bg-white/[0.04] p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-secondary/30 dark:bg-white/[0.04] flex items-center justify-center text-[11px] font-bold shrink-0 text-orange-400/60">
                  {match.homeAbbreviation || match.homeTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className={`font-semibold text-sm truncate block leading-tight ${homeFav ? 'text-orange-400' : 'text-foreground'}`}>
                  {match.homeTeam}
                </span>
                {match.homeRecord && (
                  <span className="text-[10px] text-muted-foreground/50">{match.homeRecord}</span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.homeTeam, match.homeLogo); }}
                className="shrink-0 ml-auto opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                title={homeFav ? t(language, 'favorites.removeFavorites') : t(language, 'favorites.addFavorites')}
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${homeFav ? 'fill-orange-400 text-orange-400 opacity-100' : 'text-muted-foreground hover:text-orange-400'}`} />
              </button>
            </div>

            {/* Score or VS */}
            <div className="flex flex-col items-center shrink-0 px-2 min-w-[72px]">
              {isLive ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[28px] font-black tabular-nums text-orange-400 score-pulse-orange leading-none">{homeScore}</span>
                  <span className="text-base text-orange-400/80 font-bold">-</span>
                  <span className="text-[28px] font-black tabular-nums text-orange-400 score-pulse-orange leading-none">{awayScore}</span>
                </div>
              ) : isFinished ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[28px] font-black tabular-nums text-foreground leading-none">{homeScore}</span>
                  <span className="text-base text-muted-foreground font-bold">-</span>
                  <span className="text-[28px] font-black tabular-nums text-foreground leading-none">{awayScore}</span>
                </div>
              ) : (
                <div className="px-4 py-1.5 rounded-xl bg-secondary/30 dark:bg-white/[0.04] border border-border/40 dark:border-white/[0.06]">
                  <span className="text-xs font-bold text-muted-foreground/50 tracking-[0.2em]">VS</span>
                </div>
              )}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.awayTeam, match.awayLogo); }}
                className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                title={awayFav ? t(language, 'favorites.removeFavorites') : t(language, 'favorites.addFavorites')}
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${awayFav ? 'fill-orange-400 text-orange-400 opacity-100' : 'text-muted-foreground hover:text-orange-400'}`} />
              </button>
              <div className="min-w-0 text-right">
                <span className={`font-semibold text-sm truncate block leading-tight ${awayFav ? 'text-orange-400' : 'text-foreground'}`}>
                  {match.awayTeam}
                </span>
                {match.awayRecord && (
                  <span className="text-[10px] text-muted-foreground/50">{match.awayRecord}</span>
                )}
              </div>
              {match.awayLogo ? (
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="w-10 h-10 rounded-xl object-contain bg-secondary/30 dark:bg-white/[0.04] p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-secondary/30 dark:bg-white/[0.04] flex items-center justify-center text-[11px] font-bold shrink-0 text-orange-400/60">
                  {match.awayAbbreviation || match.awayTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 pt-3 border-t border-border/30 dark:border-white/[0.06] flex gap-2">
            {isFinished && (
              <Button
                size="sm"
                onClick={() => setShowTracker(true)}
                className="flex-1 h-9 gap-2 text-xs font-semibold rounded-xl bg-secondary/50 dark:bg-white/[0.04] hover:bg-secondary dark:hover:bg-white/[0.08] text-foreground/80 border border-border/40 dark:border-white/[0.06]"
              >
                <Activity className="h-3.5 w-3.5" />
                {t(language, 'match.seeSummary')}
              </Button>
            )}
            {/* Match Tracker button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTracker(true)}
              className={`h-9 rounded-xl border-border/40 dark:border-white/[0.06] bg-transparent dark:bg-transparent hover:bg-secondary/50 dark:hover:bg-white/[0.04] text-xs gap-1 text-muted-foreground/70 ${isFinished ? 'px-3' : 'flex-1'}`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(language, 'match.follow')}</span>
            </Button>
          </div>
        </div>

        {/* Basketball Match Tracker Overlay */}
        <BasketballMatchTracker
          isOpen={showTracker}
          onClose={() => setShowTracker(false)}
          match={match}
        />
      </div>
    </>
  );
}
