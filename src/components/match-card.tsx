'use client';

import { Button } from '@/components/ui/button';
import { Play, Clock, Radio, Heart, Activity, Share } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useFavorites } from '@/hooks/use-favorites';
import { useState } from 'react';
import LiveMatchClock from '@/components/live-match-clock';
import MatchTracker from '@/components/match-tracker';
import StreamOptions from '@/components/stream-options';

interface MatchCardProps {
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeLogo: string | null;
    awayLogo: string | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    competition: string | null;
    matchDate: string | null;
    streamUrl?: string | null;
    channelName?: string | null;
    channelLogo?: string | null;
    minute?: number | null;
    displayClock?: string | null;
    period?: number | null;
    statusDescription?: string | null;
    isHalftime?: boolean;
    lastUpdated?: number | null;
  };
}

export default function MatchCard({ match }: MatchCardProps) {
  const { language } = useAppStore();
  const { toggleTeamFavorite, isTeamFavorite } = useFavorites();
  const [showTracker, setShowTracker] = useState(false);
  const [showStreamOptions, setShowStreamOptions] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

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

  const canWatchLive = isLive || isAboutToStart;

  const isBasketballSport = match.competition?.toLowerCase().includes('basketball') || match.competition?.toLowerCase().includes('nba') || match.competition?.toLowerCase().includes('euroleague');
  const sportType = isBasketballSport ? 'basketball' : 'football';

  const handleShare = async () => {
    const hScore = match.homeScore ?? 0;
    const aScore = match.awayScore ?? 0;
    const scorePart = match.status === 'live' || match.status === 'finished'
      ? `${hScore} - ${aScore}`
      : 'vs';
    const shareText = `⚽ ${match.homeTeam} ${scorePart} ${match.awayTeam} | ${match.competition || ''} | GoalStream`;

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch(_e) { /* User cancelled */ }
    }

    let copied = false;
    try {
      await navigator.clipboard.writeText(shareText);
      copied = true;
    } catch(_e) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch(_e) { /* failed */ }
    }

    if (copied) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  return (
    <>
      <div
        className={`group relative rounded-2xl overflow-hidden transition-all duration-250 hover:translate-y-[-1px] ${
          isLive
            ? 'glass-card-live shadow-lg shadow-red-500/10'
            : isFinished
            ? 'glass-card opacity-75 hover:opacity-100'
            : 'glass-card hover:shadow-md'
        }`}
      >
        {/* Live subtle gradient overlay instead of shimmer for clarity */}
        {isLive && <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.03] to-transparent pointer-events-none" />}

        <div className="relative px-4 py-4">
          {/* Top row: competition + status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-1 h-4 rounded-full ${isLive ? 'bg-red-500' : isFinished ? 'bg-muted-foreground/40' : 'bg-emerald-500/60'}`} />
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide truncate max-w-[180px]">
                {match.competition || t(language, 'match.friendly')}
              </span>
            </div>
            {isLive ? (
              <LiveMatchClock
                displayClock={match.displayClock != null ? match.displayClock : null}
                period={match.period != null ? match.period : null}
                statusDescription={match.statusDescription != null ? match.statusDescription : null}
                isHalftime={match.isHalftime != null ? match.isHalftime : false}
                lastUpdated={match.lastUpdated != null ? match.lastUpdated : null}
                minute={match.minute != null ? match.minute : null}
              />
            ) : isFinished ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/50 dark:bg-white/[0.04] border border-border/40 dark:border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">{t(language, 'common.finished')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-emerald-500/60" />
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
                <div className="w-10 h-10 rounded-xl bg-secondary/30 dark:bg-white/[0.04] flex items-center justify-center text-[11px] font-bold shrink-0 text-muted-foreground/60">
                  {match.homeTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className={`font-semibold text-sm truncate block leading-tight ${homeFav ? 'text-emerald-400' : 'text-foreground'}`}>{match.homeTeam}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.homeTeam, match.homeLogo); }}
                className="shrink-0 ml-auto opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                title={homeFav ? t(language, 'favorites.removeFavorites') : t(language, 'favorites.addFavorites')}
              >
                <Heart className={`h-3.5 w-3.5 transition-colors ${homeFav ? 'fill-emerald-400 text-emerald-400 opacity-100' : 'text-muted-foreground hover:text-emerald-400'}`} />
              </button>
            </div>

            {/* Score or VS */}
            <div className="flex flex-col items-center shrink-0 px-2 min-w-[72px]">
              {isLive ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[28px] font-black tabular-nums text-red-400 score-pulse leading-none">{homeScore}</span>
                  <span className="text-base text-red-400/80 font-bold">-</span>
                  <span className="text-[28px] font-black tabular-nums text-red-400 score-pulse leading-none">{awayScore}</span>
                </div>
              ) : isFinished ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[28px] font-black tabular-nums text-foreground leading-none">{homeScore}</span>
                  <span className="text-base text-muted-foreground font-bold">-</span>
                  <span className="text-[28px] font-black tabular-nums text-foreground leading-none">{awayScore}</span>
                </div>
              ) : (
                <div className="px-4 py-1.5 rounded-xl bg-secondary/30 dark:bg-white/[0.04] border border-border/40 dark:border-white/[0.06]">
                  <span className="text-xs font-bold text-muted-foreground/70 tracking-[0.2em]">VS</span>
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
                <Heart className={`h-3.5 w-3.5 transition-colors ${awayFav ? 'fill-emerald-400 text-emerald-400 opacity-100' : 'text-muted-foreground hover:text-emerald-400'}`} />
              </button>
              <div className="min-w-0 text-right">
                <span className={`font-semibold text-sm truncate block leading-tight ${awayFav ? 'text-emerald-400' : 'text-foreground'}`}>{match.awayTeam}</span>
              </div>
              {match.awayLogo ? (
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="w-10 h-10 rounded-xl object-contain bg-secondary/30 dark:bg-white/[0.04] p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-secondary/30 dark:bg-white/[0.04] flex items-center justify-center text-[11px] font-bold shrink-0 text-muted-foreground/60">
                  {match.awayTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 pt-3 border-t border-border/30 dark:border-white/[0.06] flex gap-2">
            {isLive && match.streamUrl ? (
              /* Direct redirection to the real player page — same method as
                 hes-goal.click / tarjetarojaenvivo.cx: a real link opens the
                 match player (with the real broadcaster channels) in a new tab */
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex-1 h-9 inline-flex items-center justify-center gap-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-lg shadow-red-600/20 transition-all duration-200"
              >
                <Radio className="h-3.5 w-3.5 fill-current" />
                {t(language, 'match.watchLive')}
              </a>
            ) : isFinished ? (
              <Button
                size="sm"
                onClick={() => setShowTracker(true)}
                className="flex-1 h-9 gap-2 text-xs font-semibold rounded-xl bg-secondary/50 dark:bg-white/[0.04] hover:bg-secondary dark:hover:bg-white/[0.08] text-foreground/80 border border-border/40 dark:border-white/[0.06]"
              >
                <Activity className="h-3.5 w-3.5" />
                {t(language, 'match.seeSummary')}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowStreamOptions(true)}
                className={`flex-1 h-9 gap-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                  canWatchLive
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 dark:border-emerald-500/10'
                }`}
              >
                {canWatchLive ? (
                  <>
                    <Radio className="h-3.5 w-3.5 fill-current" />
                    {t(language, 'match.watchLive')}
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    {t(language, 'match.watch')}
                  </>
                )}
              </Button>
            )}
            {/* Match Tracker button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTracker(true)}
              className="h-9 px-3 rounded-xl border-border/40 dark:border-white/[0.06] bg-transparent dark:bg-transparent hover:bg-secondary/50 dark:hover:bg-white/[0.04] text-xs gap-1 text-muted-foreground/70"
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(language, 'match.follow')}</span>
            </Button>
            {/* Share button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="h-9 px-3 rounded-xl border-border/40 dark:border-white/[0.06] bg-transparent dark:bg-transparent hover:bg-secondary/50 dark:hover:bg-white/[0.04] text-xs gap-1 text-muted-foreground/70"
              title={t(language, 'match.share')}
            >
              <Share className="h-3.5 w-3.5" />
              {shareCopied && <span className="text-emerald-400 text-[10px]">{t(language, 'match.copied')}</span>}
            </Button>
          </div>
        </div>

        {/* Match Tracker Overlay */}
        <MatchTracker
          isOpen={showTracker}
          onClose={() => setShowTracker(false)}
          match={match}
        />
      </div>

      {/* Channel selection panel — real broadcaster links (new tab) */}
      <StreamOptions
        isOpen={showStreamOptions}
        onClose={() => setShowStreamOptions(false)}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        competition={match.competition}
        sport={sportType}
        matchId={match.id}
        isLive={isLive}
      />
    </>
  );
}
