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

  // Show "Regarder" button only for live matches or matches about to start
  const canWatchLive = isLive || isAboutToStart;

  const handleWatchLive = () => {
    setShowStreamOptions(true);
  };

  return (
    <>
      <div
        className={`group relative rounded-xl overflow-hidden transition-all duration-200 ${
          isLive
            ? 'bg-gradient-to-r from-orange-950/30 via-card to-orange-950/20 border border-orange-500/20 shadow-lg shadow-orange-500/5'
            : 'bg-card/80 border border-border/40 hover:border-border/70 hover:bg-card'
        }`}
      >
        <div className="px-4 py-3.5">
          {/* Top row: competition + date/time/status */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-muted-foreground/60 font-medium flex items-center gap-1">
              🏀 {match.competition || t(language, 'nav.basketball')}
            </span>
            {isLive ? (
              <BasketballLiveClock
                clockDisplay={match.clockDisplay}
                periodDisplay={match.periodDisplay}
              />
            ) : isFinished ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50 border border-border/30">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{t(language, 'common.finished')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {isToday ? `${t(language, 'common.today')} ${timeStr}` : isTomorrow ? `${t(language, 'common.tomorrow')} ${timeStr}` : `${dateStr} ${timeStr}`}
                </span>
              </div>
            )}
          </div>

          {/* Teams row */}
          <div className="flex items-center gap-3">
            {/* Home team */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {match.homeLogo ? (
                <img
                  src={match.homeLogo}
                  alt={match.homeTeam}
                  className="w-9 h-9 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-[11px] font-bold shrink-0 text-orange-500">
                  {match.homeAbbreviation || match.homeTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className={`font-semibold text-sm truncate block ${homeFav ? 'text-green-500' : ''}`}>
                  {match.homeTeam}
                </span>
                {match.homeRecord && (
                  <span className="text-[10px] text-muted-foreground/50">{match.homeRecord}</span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.homeTeam, match.homeLogo); }}
                className="shrink-0 ml-auto"
                title={homeFav ? t(language, 'favorites.removeFavorites') : t(language, 'favorites.addFavorites')}
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${homeFav ? 'fill-green-500 text-green-500' : 'text-muted-foreground/30 hover:text-green-500'}`} />
              </button>
            </div>

            {/* Score or VS */}
            <div className="flex flex-col items-center shrink-0 px-1">
              {isLive ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black tabular-nums text-orange-400">{match.homeScore ?? 0}</span>
                  <span className="text-xs text-muted-foreground/40 font-medium">-</span>
                  <span className="text-lg font-black tabular-nums text-orange-400">{match.awayScore ?? 0}</span>
                </div>
              ) : isFinished ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black tabular-nums text-muted-foreground">{match.homeScore ?? 0}</span>
                  <span className="text-xs text-muted-foreground/40 font-medium">-</span>
                  <span className="text-lg font-black tabular-nums text-muted-foreground">{match.awayScore ?? 0}</span>
                </div>
              ) : (
                <div className="px-3 py-1 rounded-md bg-muted/40 border border-border/20">
                  <span className="text-xs font-bold text-muted-foreground/60 tracking-wider">VS</span>
                </div>
              )}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.awayTeam, match.awayLogo); }}
                className="shrink-0"
                title={awayFav ? t(language, 'favorites.removeFavorites') : t(language, 'favorites.addFavorites')}
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${awayFav ? 'fill-green-500 text-green-500' : 'text-muted-foreground/30 hover:text-green-500'}`} />
              </button>
              <div className="min-w-0 text-right">
                <span className={`font-semibold text-sm truncate block ${awayFav ? 'text-green-500' : ''}`}>
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
                  className="w-9 h-9 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-[11px] font-bold shrink-0 text-orange-500">
                  {match.awayAbbreviation || match.awayTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 pt-2.5 border-t border-border/20 flex gap-2">
            {canWatchLive ? (
              <Button
                size="sm"
                onClick={handleWatchLive}
                className={`flex-1 h-8 gap-2 text-xs font-semibold rounded-lg transition-all ${
                  isLive
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-600/20'
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-600/20'
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
                className="flex-1 h-8 gap-2 text-xs font-semibold rounded-lg bg-muted/60 hover:bg-muted/80 text-foreground border border-border/30"
              >
                <Activity className="h-3.5 w-3.5" />
                {t(language, 'match.seeSummary')}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowTracker(true)}
                className="flex-1 h-8 gap-2 text-xs font-semibold rounded-lg bg-muted/40 hover:bg-muted/60 text-muted-foreground border border-border/20"
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
              className="h-8 px-3 rounded-lg border-border/40 text-xs gap-1"
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(language, 'match.follow')}</span>
            </Button>
            {canWatchLive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const query = encodeURIComponent(`${match.homeTeam} vs ${match.awayTeam} ${match.competition || ''} live stream`);
                  window.open(`https://us-sport.eu/?s=${query}`, '_blank', 'noopener,noreferrer');
                }}
                className="h-8 px-3 rounded-lg border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs gap-1"
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
                className="h-8 px-3 rounded-lg border-border/40 text-xs gap-1"
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
