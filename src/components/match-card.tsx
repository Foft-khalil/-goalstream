'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Tv, Clock, Loader2, Radio, Heart, Activity, ExternalLink, Globe, Share, Film } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useFavorites } from '@/hooks/use-favorites';
import { useState, useMemo } from 'react';
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
  const { openPlayer, language, hesgoalMatches } = useAppStore();
  const { toggleTeamFavorite, isTeamFavorite } = useFavorites();
  const [showTracker, setShowTracker] = useState(false);
  const [showStreamOptions, setShowStreamOptions] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [hesgoalResolving, setHesgoalResolving] = useState(false);

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

  // Auto-detect HesGoal stream for live football matches from store data
  // (fetched once centrally in page.tsx instead of per-card API calls)
  const hesgoalMatchId = useMemo(() => {
    if (!isLive) return null;
    if (match.competition?.toLowerCase().includes('basketball') || match.competition?.toLowerCase().includes('nba')) return null;

    const homeLower = match.homeTeam.toLowerCase();
    const awayLower = match.awayTeam.toLowerCase();

    const found = hesgoalMatches.find((hm) => {
      if (!hm.hasStream) return false;
      const mHome = hm.homeTeam.toLowerCase();
      const mAway = hm.awayTeam.toLowerCase();
      const homeWords = homeLower.split(/\s+/).filter((w: string) => w.length > 3);
      const awayWords = awayLower.split(/\s+/).filter((w: string) => w.length > 3);
      const homeMatch = homeWords.some((w: string) => mHome.includes(w)) || mHome.includes(homeLower) || homeLower.includes(mHome);
      const awayMatch = awayWords.some((w: string) => mAway.includes(w)) || mAway.includes(awayLower) || awayLower.includes(mAway);
      return homeMatch && awayMatch;
    });

    return found ? found.id : null;
  }, [isLive, match.homeTeam, match.awayTeam, match.competition, hesgoalMatches]);

  // Determine if match is about to start (within 30 min of kickoff)
  const isAboutToStart = (() => {
    if (!matchDate || isLive || isFinished) return false;
    const now = Date.now();
    const matchTime = matchDate.getTime();
    const diffMs = matchTime - now;
    // Show "Regarder" button if match starts within 30 minutes
    return diffMs <= 30 * 60 * 1000 && diffMs > -5 * 60 * 1000;
  })();

  // Show "Regarder" button only for live matches or matches about to start
  const canWatchLive = isLive || isAboutToStart;

  const isBasketballSport = match.competition?.toLowerCase().includes('basketball') || match.competition?.toLowerCase().includes('nba') || match.competition?.toLowerCase().includes('euroleague');
  const sportType = isBasketballSport ? 'basketball' : 'football';

  const handleWatchLive = () => {
    // If we have a direct m3u8 stream URL, try playing it directly
    if (match.streamUrl && (match.streamUrl.includes('.m3u8') || match.streamUrl.includes('m3u8'))) {
      openPlayer(match.streamUrl, match.channelName || `${match.homeTeam} vs ${match.awayTeam}`, match.channelLogo || undefined);
      return;
    }
    // Otherwise, show the stream options panel with external links
    setShowStreamOptions(true);
  };

  const handleShare = async () => {
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;
    const scorePart = match.status === 'live' || match.status === 'finished'
      ? `${homeScore} - ${awayScore}`
      : 'vs';
    const shareText = `⚽ ${match.homeTeam} ${scorePart} ${match.awayTeam} | ${match.competition || ''} | GoalStream`;

    // Try native share first
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch(_e) {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Try clipboard API, then fallback to execCommand
    let copied = false;
    try {
      await navigator.clipboard.writeText(shareText);
      copied = true;
    } catch(_e) {
      // Clipboard API blocked — fallback to execCommand
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
      } catch(_e) {
        // execCommand also failed
      }
    }

    if (copied) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  return (
    <>
      <div
        className={`group relative rounded-xl overflow-hidden transition-all duration-200 ${
          isLive
            ? 'bg-gradient-to-r from-red-950/30 via-card to-red-950/20 border border-red-500/20 shadow-lg shadow-red-500/5'
            : 'bg-card/80 border border-border/40 hover:border-border/70 hover:bg-card'
        }`}
      >
        <div className="px-4 py-3.5">
          {/* Top row: competition + date/time/status */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-muted-foreground/60 font-medium">
              {match.competition || t(language, 'match.friendly')}
            </span>
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
                <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {match.homeTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className={`font-semibold text-sm truncate ${homeFav ? 'text-green-500' : ''}`}>{match.homeTeam}</span>
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
                  <span className="text-lg font-black tabular-nums text-red-400">{homeScore}</span>
                  <span className="text-xs text-muted-foreground/40 font-medium">-</span>
                  <span className="text-lg font-black tabular-nums text-red-400">{awayScore}</span>
                </div>
              ) : isFinished ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black tabular-nums text-muted-foreground">{homeScore}</span>
                  <span className="text-xs text-muted-foreground/40 font-medium">-</span>
                  <span className="text-lg font-black tabular-nums text-muted-foreground">{awayScore}</span>
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
              <span className={`font-semibold text-sm truncate text-right ${awayFav ? 'text-green-500' : ''}`}>{match.awayTeam}</span>
              {match.awayLogo ? (
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="w-9 h-9 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {match.awayTeam.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons + Match Tracker */}
          <div className="mt-3 pt-2.5 border-t border-border/20 flex gap-2">
            {canWatchLive ? (
              <Button
                size="sm"
                onClick={handleWatchLive}
                className={`flex-1 h-8 gap-2 text-xs font-semibold rounded-lg transition-all ${
                  isLive
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20'
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
            {/* Share button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="h-8 px-3 rounded-lg border-border/40 text-xs gap-1"
              title={t(language, 'match.share')}
            >
              <Share className="h-3.5 w-3.5" />
              {shareCopied && <span className="text-green-500 text-[10px]">{t(language, 'match.copied')}</span>}
            </Button>
            {/* Quick HesGoal play button — only for live matches with HesGoal stream detected */}
            {canWatchLive && hesgoalMatchId && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (hesgoalResolving) return;
                  setHesgoalResolving(true);
                  try {
                    const res = await fetch(`/api/hesgoal-stream?id=${hesgoalMatchId}`, {
                      signal: AbortSignal.timeout(15000),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.url) {
                        const streamName = `HesGoal — ${match.homeTeam} vs ${match.awayTeam}`;
                        openPlayer(data.url, streamName);
                      }
                    }
                  } catch(_e) {
                    // Fallback to stream options
                    setShowStreamOptions(true);
                  } finally {
                    setHesgoalResolving(false);
                  }
                }}
                disabled={hesgoalResolving}
                className="h-8 px-3 rounded-lg border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs gap-1"
                title="HesGoal Live"
              >
                {hesgoalResolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tv className="h-3.5 w-3.5" />}
              </Button>
            )}
            {/* Quick external streaming site button */}
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
          </div>
        </div>

        {/* Match Tracker Overlay */}
        <MatchTracker
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
        sport={sportType}
        hesgoalMatchId={hesgoalMatchId}
      />
    </>
  );
}
