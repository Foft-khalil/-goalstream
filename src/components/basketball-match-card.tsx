'use client';

import { Button } from '@/components/ui/button';
import { Play, Clock, Radio, Heart, Activity, Globe, Film } from 'lucide-react';
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
    setShowStreamOptions(true);
  };

  return (
    <>
      <div
        className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:translate-y-[-1px] ${
          isLive
            ? 'glass-card-basketball shadow-lg shadow-orange-500/5'
            : isFinished
            ? 'glass-card opacity-70 hover:opacity-90'
            : 'glass-card hover:border-white/10'
        }`}
      >
        {/* Live shimmer effect */}
        {isLive && <div className="absolute inset-0 shimmer pointer-events-none" />}

        <div className="relative px-4 py-4">
          {/* Top row: competition + date/time/status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-1 h-4 rounded-full ${isLive ? 'bg-orange-500' : isFinished ? 'bg-muted-foreground/30' : 'bg-orange-400/60'}`} />
              <span className="text-[11px] text-muted-foreground/50 font-semibold uppercase tracking-wide">
                {match.competition || t(language, 'nav.basketball')}
              </span>
            </div>
            {isLive ? (
              <BasketballLiveClock
                clockDisplay={match.clockDisplay}
                periodDisplay={match.periodDisplay}
              />
            ) : isFinished ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card dark:bg-white/[0.03] border border-border dark:border-white/[0.04]">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">{t(language, 'common.finished')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-orange-400/50" />
                <span className="text-[11px] font-semibold text-muted-foreground/60">
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
                  className="w-10 h-10 rounded-xl object-contain bg-card dark:bg-white/[0.03] p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-card dark:bg-white/[0.04] flex items-center justify-center text-[11px] font-bold shrink-0 text-orange-400/60">
                  {match.homeAbbreviation || match.homeTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className={`font-semibold text-[13px] truncate block leading-tight ${homeFav ? 'text-orange-400' : ''}`}>
                  {match.homeTeam}
                </span>
                {match.homeRecord && (
                  <span className="text-[10px] text-muted-foreground/40">{match.homeRecord}</span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.homeTeam, match.homeLogo); }}
                className="shrink-0 ml-auto opacity-40 hover:opacity-100 transition-opacity"
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
                  <span className="text-xs text-muted-foreground/30 font-bold">:</span>
                  <span className="text-xl font-black tabular-nums text-orange-400 score-pulse-orange">{awayScore}</span>
                </div>
              ) : isFinished ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tabular-nums text-muted-foreground/60">{homeScore}</span>
                  <span className="text-xs text-muted-foreground/30 font-bold">:</span>
                  <span className="text-xl font-black tabular-nums text-muted-foreground/60">{awayScore}</span>
                </div>
              ) : (
                <div className="px-4 py-1.5 rounded-xl bg-card dark:bg-white/[0.03] border border-border dark:border-white/[0.05]">
                  <span className="text-xs font-bold text-muted-foreground/40 tracking-[0.2em]">VS</span>
                </div>
              )}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.awayTeam, match.awayLogo); }}
                className="shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                title={awayFav ? t(language, 'favorites.removeFavorites') : t(language, 'favorites.addFavorites')}
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${awayFav ? 'fill-orange-400 text-orange-400' : 'text-muted-foreground hover:text-orange-400'}`} />
              </button>
              <div className="min-w-0 text-right">
                <span className={`font-semibold text-[13px] truncate block leading-tight ${awayFav ? 'text-orange-400' : ''}`}>
                  {match.awayTeam}
                </span>
                {match.awayRecord && (
                  <span className="text-[10px] text-muted-foreground/40">{match.awayRecord}</span>
                )}
              </div>
              {match.awayLogo ? (
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="w-10 h-10 rounded-xl object-contain bg-card dark:bg-white/[0.03] p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-card dark:bg-white/[0.04] flex items-center justify-center text-[11px] font-bold shrink-0 text-orange-400/60">
                  {match.awayAbbreviation || match.awayTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 pt-3 border-t border-border dark:border-white/[0.04] flex gap-2">
            {canWatchLive ? (
              <Button
                size="sm"
                onClick={handleWatchLive}
                className={`flex-1 h-9 gap-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                  isLive
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/25'
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25'
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
            ) : isFinished ? (
              <Button
                size="sm"
                onClick={() => setShowTracker(true)}
                className="flex-1 h-9 gap-2 text-xs font-semibold rounded-xl bg-card dark:bg-white/[0.04] hover:bg-accent dark:bg-white/[0.07] text-foreground border border-border dark:border-white/[0.06]"
              >
                <Activity className="h-3.5 w-3.5" />
                {t(language, 'match.seeSummary')}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowTracker(true)}
                className="flex-1 h-9 gap-2 text-xs font-semibold rounded-xl bg-card dark:bg-white/[0.03] hover:bg-accent dark:bg-white/[0.06] text-muted-foreground border border-border dark:border-white/[0.05]"
              >
                <Activity className="h-3.5 w-3.5" />
                {t(language, 'match.followMatch')}
              </Button>
            )}
            {/* Match Tracker button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTracker(true)}
              className="h-9 px-3 rounded-xl border-border dark:border-white/[0.06] bg-secondary dark:bg-white/[0.02] hover:bg-accent dark:bg-white/[0.05] text-xs gap-1"
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(language, 'match.follow')}</span>
            </Button>
            {/* SportStream external link */}
            {canWatchLive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const query = encodeURIComponent(`${match.homeTeam} vs ${match.awayTeam} ${match.competition || ''} live stream`);
                  window.open(`https://us-sport.eu/?s=${query}`, '_blank', 'noopener,noreferrer');
                }}
                className="h-9 px-3 rounded-xl border-sky-500/20 text-sky-400 hover:bg-sky-500/10 text-xs gap-1"
                title="SportStream"
              >
                <Globe className="h-3.5 w-3.5" />
              </Button>
            )}
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
                className="h-9 px-3 rounded-xl border-border dark:border-white/[0.06] bg-secondary dark:bg-white/[0.02] hover:bg-accent dark:bg-white/[0.05] text-xs gap-1"
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
      />
    </>
  );
}
