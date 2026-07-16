'use client';

import { Button } from '@/components/ui/button';
import { Play, Clock, Radio, Heart, Activity, Film } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useFavorites } from '@/hooks/use-favorites';
import { useState } from 'react';
import type { BasketballMatch } from '@/lib/basketball/types';
import { BasketballLiveClock } from '@/components/live-match-clock';
import BasketballMatchTracker from '@/components/basketball-match-tracker';
import StreamOptions from '@/components/stream-options';

interface BasketballMatchCardProps {
  match: BasketballMatch;
}

export default function BasketballMatchCard({ match }: BasketballMatchCardProps) {
  const { openPlayer, language } = useAppStore();
  const { toggleTeamFavorite, isTeamFavorite } = useFavorites();
  const [showTracker, setShowTracker] = useState(false);
  const [showStreamOptions, setShowStreamOptions] = useState(false);

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

  // Determine if match is about to start (within 30 min of kickoff)
  const isAboutToStart = (() => {
    if (!matchDate || isLive || isFinished) return false;
    const now = Date.now();
    const matchTime = matchDate.getTime();
    const diffMs = matchTime - now;
    return diffMs <= 30 * 60 * 1000 && diffMs > -5 * 60 * 1000;
  })();

  // Show "Watch" button only for live matches or matches about to start
  const canWatchLive = isLive || isAboutToStart;

  const handleWatchLive = () => {
    // Open stream options panel - it will fetch free streams from /api/streams
    setShowStreamOptions(true);
  };

  /** Open YouTube live search for this basketball match */
  const handleYoutubeLive = () => {
    const year = matchDate ? matchDate.getFullYear() : new Date().getFullYear();
    const query = encodeURIComponent(`${match.homeTeam} vs ${match.awayTeam} ${match.competition || 'NBA'} live ${year}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div
        className={`group relative rounded-2xl overflow-hidden transition-all duration-250 hover:translate-y-[-1px] ${
          isLive
            ? 'glass-card-basketball shadow-lg shadow-orange-500/5'
            : isFinished
            ? 'glass-card opacity-60 hover:opacity-80'
            : 'glass-card hover:shadow-md'
        }`}
      >
        {/* Live shimmer effect */}
        {isLive && <div className="absolute inset-0 shimmer pointer-events-none" />}

        <div className="relative px-4 py-4">
          {/* Top row: competition + date/time/status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-1 h-4 rounded-full ${isLive ? 'bg-orange-500' : isFinished ? 'bg-muted-foreground/20' : 'bg-orange-400/50'}`} />
              <span className="text-[11px] text-muted-foreground/40 font-semibold uppercase tracking-wide">
                {match.competition || t(language, 'nav.basketball')}
              </span>
            </div>
            {isLive ? (
              <BasketballLiveClock
                clockDisplay={match.clockDisplay}
                periodDisplay={match.periodDisplay}
              />
            ) : isFinished ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/50 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.03]">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-wider">{t(language, 'common.finished')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-orange-400/40" />
                <span className="text-[11px] font-semibold text-muted-foreground/50">
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
                  className="w-10 h-10 rounded-xl object-contain bg-secondary/30 dark:bg-white/[0.02] p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-secondary/30 dark:bg-white/[0.03] flex items-center justify-center text-[11px] font-bold shrink-0 text-orange-400/50">
                  {match.homeAbbreviation || match.homeTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className={`font-semibold text-[13px] truncate block leading-tight ${homeFav ? 'text-orange-400' : ''}`}>
                  {match.homeTeam}
                </span>
                {match.homeRecord && (
                  <span className="text-[10px] text-muted-foreground/30">{match.homeRecord}</span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.homeTeam, match.homeLogo); }}
                className="shrink-0 ml-auto opacity-30 hover:opacity-100 transition-opacity"
                title={homeFav ? t(language, 'favorites.removeFavorites') : t(language, 'favorites.addFavorites')}
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${homeFav ? 'fill-orange-400 text-orange-400' : 'text-muted-foreground hover:text-orange-400'}`} />
              </button>
            </div>

            {/* Score or VS */}
            <div className="flex flex-col items-center shrink-0 px-2 min-w-[60px]">
              {isLive ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tabular-nums text-orange-400 score-pulse-orange">{homeScore}</span>
                  <span className="text-xs text-muted-foreground/20 font-bold">:</span>
                  <span className="text-xl font-black tabular-nums text-orange-400 score-pulse-orange">{awayScore}</span>
                </div>
              ) : isFinished ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tabular-nums text-muted-foreground/50">{homeScore}</span>
                  <span className="text-xs text-muted-foreground/20 font-bold">:</span>
                  <span className="text-xl font-black tabular-nums text-muted-foreground/50">{awayScore}</span>
                </div>
              ) : (
                <div className="px-4 py-1.5 rounded-xl bg-secondary/30 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.04]">
                  <span className="text-xs font-bold text-muted-foreground/30 tracking-[0.2em]">VS</span>
                </div>
              )}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.awayTeam, match.awayLogo); }}
                className="shrink-0 opacity-30 hover:opacity-100 transition-opacity"
                title={awayFav ? t(language, 'favorites.removeFavorites') : t(language, 'favorites.addFavorites')}
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${awayFav ? 'fill-orange-400 text-orange-400' : 'text-muted-foreground hover:text-orange-400'}`} />
              </button>
              <div className="min-w-0 text-right">
                <span className={`font-semibold text-[13px] truncate block leading-tight ${awayFav ? 'text-orange-400' : ''}`}>
                  {match.awayTeam}
                </span>
                {match.awayRecord && (
                  <span className="text-[10px] text-muted-foreground/30">{match.awayRecord}</span>
                )}
              </div>
              {match.awayLogo ? (
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="w-10 h-10 rounded-xl object-contain bg-secondary/30 dark:bg-white/[0.02] p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-secondary/30 dark:bg-white/[0.03] flex items-center justify-center text-[11px] font-bold shrink-0 text-orange-400/50">
                  {match.awayAbbreviation || match.awayTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 pt-3 border-t border-border/20 dark:border-white/[0.03] flex gap-2">
            {canWatchLive ? (
              <>
                <Button
                  size="sm"
                  onClick={handleWatchLive}
                  className={`flex-1 h-9 gap-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                    isLive
                      ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20'
                      : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                  }`}
                >
                  {isLive ? (
                    <>
                      <Radio className="h-3.5 w-3.5 fill-current" />
                      {t(language, 'match.watchLive')}
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      {t(language, 'match.watch')}
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleYoutubeLive}
                  className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                  title="YouTube Live"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  <span className="hidden sm:inline">YT</span>
                </Button>
              </>
            ) : isFinished ? (
              <Button
                size="sm"
                onClick={() => setShowTracker(true)}
                className="flex-1 h-9 gap-2 text-xs font-semibold rounded-xl bg-secondary/50 dark:bg-white/[0.03] hover:bg-secondary dark:hover:bg-white/[0.06] text-foreground border border-border/30 dark:border-white/[0.04]"
              >
                <Activity className="h-3.5 w-3.5" />
                {t(language, 'match.seeSummary')}
              </Button>
            ) : (
              <div className="flex gap-2 flex-1">
                <Button
                  size="sm"
                  onClick={() => setShowStreamOptions(true)}
                  className="flex-1 h-9 gap-2 text-xs font-semibold rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 dark:border-orange-500/10"
                >
                  <Play className="h-3.5 w-3.5" />
                  {t(language, 'match.watch')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTracker(true)}
                  className="h-9 px-3 rounded-xl border-border/30 dark:border-white/[0.04] bg-transparent dark:bg-transparent hover:bg-secondary/50 dark:hover:bg-white/[0.04] text-xs gap-1 text-muted-foreground"
                >
                  <Activity className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {/* Match Tracker button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTracker(true)}
              className="h-9 px-3 rounded-xl border-border/30 dark:border-white/[0.04] bg-transparent dark:bg-transparent hover:bg-secondary/50 dark:hover:bg-white/[0.04] text-xs gap-1"
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(language, 'match.follow')}</span>
            </Button>
            {/* Highlights button — only for finished matches */}
            {isFinished && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const year = matchDate ? matchDate.getFullYear() : new Date().getFullYear();
                  const query = encodeURIComponent(`${match.homeTeam} vs ${match.awayTeam} ${match.competition || ''} highlights ${year}`);
                  window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener,noreferrer');
                }}
                className="h-9 px-3 rounded-xl border-border/30 dark:border-white/[0.04] bg-transparent dark:bg-transparent hover:bg-secondary/50 dark:hover:bg-white/[0.04] text-xs gap-1"
                title={t(language, 'match.highlights')}
              >
                <Film className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Basketball Match Tracker Overlay */}
        <BasketballMatchTracker
          isOpen={showTracker}
          onClose={() => setShowTracker(false)}
          match={match}
        />
      </div>

      {/* Stream Options Panel */}
      <StreamOptions
        isOpen={showStreamOptions}
        onClose={() => setShowStreamOptions(false)}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        competition={match.competition}
        sport="basketball"
        matchId={match.id}
      />
    </>
  );
}
