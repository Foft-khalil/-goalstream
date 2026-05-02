'use client';

import { Button } from '@/components/ui/button';
import { Play, Tv, Clock, Loader2, Radio, ChevronRight, Heart, Activity, ExternalLink, Globe } from 'lucide-react';
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

export interface FoundChannel {
  name: string;
  url: string;
  logo: string;
  group: string;
  relevance: number;
  broadcaster?: string;
  health?: 'online' | 'offline' | 'unknown';
}

export interface KoraStream {
  name: string;
  url: string;
  lang: string;
  langFlag: string;
  source: string;
}

export default function BasketballMatchCard({ match }: BasketballMatchCardProps) {
  const { openPlayer, language } = useAppStore();
  const { toggleTeamFavorite, isTeamFavorite } = useFavorites();
  const [findingStream, setFindingStream] = useState(false);
  const [foundChannels, setFoundChannels] = useState<FoundChannel[]>([]);
  const [koraStreams, setKoraStreams] = useState<KoraStream[]>([]);
  const [showChannels, setShowChannels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadcasterInfo, setBroadcasterInfo] = useState<string | null>(null);
  const [showTracker, setShowTracker] = useState(false);

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

  const findAndShowChannels = async () => {
    if (findingStream) return;
    setFindingStream(true);
    setShowChannels(true);
    setError(null);
    setKoraStreams([]);
    setFoundChannels([]);

    try {
      // ── Step 1: Try kora-api first (fast, direct streams) ──
      try {
        const koraRes = await fetch('/api/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            competition: match.competition,
            sport: 'basketball',
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (koraRes.ok) {
          const koraData = await koraRes.json();
          if (koraData.streams && koraData.streams.length > 0) {
            setKoraStreams(koraData.streams);
            setBroadcasterInfo(t(language, 'match.liveStreamAvailable', koraData.streams.length));
            setFindingStream(false);
            return; // Found streams — no need for IPTV fallback
          }
        }
      } catch {
        // kora-api failed, fall through to IPTV
      }

      // ── Step 2: IPTV fallback ──
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const res = await fetch('/api/match-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competition,
          matchDate: match.matchDate,
          sport: 'basketball',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) throw new Error('Failed to find channels');
      const data = await res.json();
      const channels = data.channels || [];
      setFoundChannels(channels);

      if (data.broadcasters && data.broadcasters.length > 0) {
        setBroadcasterInfo(data.broadcasters.join(', '));
      } else if (data.message) {
        setBroadcasterInfo(null);
      }

      if (channels.length === 0 && koraStreams.length === 0) {
        setError(t(language, 'match.noChannelFound'));
      }
    } catch (err) {
      console.error('Error finding channels:', err);
      setError(t(language, 'match.noChannelRetry'));
      setFoundChannels([]);
    } finally {
      setFindingStream(false);
    }
  };

  const handleSelectChannel = (channel: FoundChannel) => {
    openPlayer(
      channel.url,
      channel.name,
      channel.logo || undefined,
      foundChannels.filter((ch) => ch.url !== channel.url)
    );
  };

  const handleQuickPlay = async () => {
    if (findingStream) return;
    setFindingStream(true);
    setError(null);

    try {
      // ── Step 1: Try kora-api first (fast, direct streams) ──
      try {
        const koraRes = await fetch('/api/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            competition: match.competition,
            sport: 'basketball',
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (koraRes.ok) {
          const koraData = await koraRes.json();
          if (koraData.streams && koraData.streams.length > 0) {
            // Open the first kora stream in the player
            const first = koraData.streams[0];
            setKoraStreams(koraData.streams);
            setBroadcasterInfo(t(language, 'match.liveStreamAvailable', koraData.streams.length));
            openPlayer(first.url, `${first.langFlag} ${first.name}`, undefined);
            setFindingStream(false);
            return;
          }
        }
      } catch {
        // kora-api failed, fall through to IPTV
      }

      // ── Step 2: IPTV fallback ──
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const res = await fetch('/api/match-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competition,
          matchDate: match.matchDate,
          sport: 'basketball',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) throw new Error('Failed to find channels');
      const data = await res.json();
      const channels: FoundChannel[] = data.channels || [];

      if (data.broadcasters && data.broadcasters.length > 0) {
        setBroadcasterInfo(data.broadcasters.join(', '));
      }

      if (channels.length > 0) {
        const first = channels[0];
        const alternatives = channels.slice(1);
        openPlayer(first.url, first.name, first.logo || undefined, alternatives);
      } else {
        setError(t(language, 'match.noChannelFound'));
        setFoundChannels(channels);
        setShowChannels(true);
      }
    } catch (err) {
      console.error('Error finding channels:', err);
      setError(t(language, 'match.noChannelRetry'));
    } finally {
      setFindingStream(false);
    }
  };

  return (
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
              onClick={handleQuickPlay}
              disabled={findingStream}
              className={`flex-1 h-8 gap-2 text-xs font-semibold rounded-lg transition-all ${
                isLive
                  ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-600/20'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-600/20'
              }`}
            >
              {findingStream ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t(language, 'match.searching')}
                </>
              ) : isLive ? (
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
                if ((koraStreams.length > 0 || foundChannels.length > 0) && showChannels) {
                  setShowChannels(false);
                } else {
                  findAndShowChannels();
                }
              }}
              disabled={findingStream}
              className="h-8 px-3 rounded-lg border-border/40 text-xs"
            >
              <Tv className="h-3.5 w-3.5" />
            </Button>
          )}
          {canWatchLive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const query = encodeURIComponent(`${match.homeTeam} vs ${match.awayTeam} ${match.competition || ''} live stream`);
                window.open(`https://us-sport.eu/?s=${query}`, '_blank', 'noopener,noreferrer');
              }}
              className="h-8 px-3 rounded-lg border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs gap-1"
              title="Regarder sur SportStream"
            >
              <Globe className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Error message */}
        {error && !findingStream && (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-red-400/80 text-center">{error}</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  const query = encodeURIComponent(`${match.homeTeam} vs ${match.awayTeam} ${match.competition || ''} live stream`);
                  window.open(`https://us-sport.eu/?s=${query}`, '_blank', 'noopener,noreferrer');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors text-[10px] font-medium text-blue-400"
              >
                <Globe className="h-3 w-3" />
                SportStream
              </button>
              <button
                onClick={() => {
                  window.open('https://tarjetarojaenvivo.cx', '_blank', 'noopener,noreferrer');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors text-[10px] font-medium text-red-400"
              >
                <Globe className="h-3 w-3" />
                RojaDirecta
              </button>
            </div>
          </div>
        )}

        {/* Broadcaster info */}
        {broadcasterInfo && !error && (
          <div className="mt-2 flex items-center gap-1.5 justify-center">
            <Tv className="h-3 w-3 text-green-500/60" />
            <span className="text-[10px] text-green-500/70 font-medium">
              {t(language, 'match.broadcastOn')}: {broadcasterInfo}
            </span>
          </div>
        )}
      </div>

      {/* Channel/Stream Selector - slide down */}
      {showChannels && (koraStreams.length > 0 || foundChannels.length > 0) && (
        <div className="border-t border-border/20 bg-muted/20 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
              {koraStreams.length > 0 ? t(language, 'match.liveBroadcast') : t(language, 'channels.title')} ({koraStreams.length || foundChannels.length})
            </p>
            {broadcasterInfo && (
              <span className="text-[9px] text-green-500/60 font-medium">
                📺 {broadcasterInfo}
              </span>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {/* Kora API streams (primary — direct streaming links) */}
            {koraStreams.map((stream, idx) => (
              <button
                key={`kora-${idx}`}
                onClick={() => openPlayer(stream.url, `${stream.langFlag} ${stream.name}`, undefined)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left group/ch"
              >
                <div className="w-6 h-6 rounded bg-green-500/10 flex items-center justify-center shrink-0">
                  <ExternalLink className="h-3 w-3 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{stream.langFlag}</span>
                    <span className="text-xs font-medium truncate">{stream.lang} Stream</span>
                    <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-green-500/10">
                      <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[8px] font-bold text-green-600">{t(language, 'channels.direct')}</span>
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover/ch:text-green-500 transition-colors shrink-0" />
              </button>
            ))}
            {/* IPTV channels (fallback) */}
            {foundChannels.map((channel, idx) => (
              <button
                key={`${channel.name}-${idx}`}
                onClick={() => handleSelectChannel(channel)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left group/ch ${
                  channel.health === 'offline' ? 'opacity-40' : ''
                }`}
              >
                {channel.logo ? (
                  <img
                    src={channel.logo}
                    alt=""
                    className="w-6 h-6 rounded object-contain shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-muted/60 flex items-center justify-center shrink-0">
                    <Tv className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{channel.name}</span>
                    {channel.health === 'online' && (
                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-green-500/10">
                        <span className="w-1 h-1 rounded-full bg-green-500" />
                        <span className="text-[8px] font-bold text-green-600">{t(language, 'channels.online').toUpperCase()}</span>
                      </span>
                    )}
                    {channel.health === 'offline' && (
                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-500/10">
                        <span className="w-1 h-1 rounded-full bg-red-400" />
                        <span className="text-[8px] font-bold text-red-400">{t(language, 'channels.offline').toUpperCase()}</span>
                      </span>
                    )}
                  </div>
                  {channel.broadcaster && (
                    <span className="text-[9px] text-green-500/50">via {channel.broadcaster}</span>
                  )}
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover/ch:text-green-500 transition-colors shrink-0" />
              </button>
            ))}
          </div>

          {/* External streaming sites */}
          <div className="mt-2 pt-2 border-t border-border/10">
            <p className="text-[9px] text-muted-foreground/40 font-semibold uppercase tracking-wider mb-1.5">
              Sources externes
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  const query = encodeURIComponent(`${match.homeTeam} vs ${match.awayTeam} ${match.competition || ''} live stream`);
                  window.open(`https://us-sport.eu/?s=${query}`, '_blank', 'noopener,noreferrer');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors text-[10px] font-medium text-blue-400"
              >
                <Globe className="h-3 w-3" />
                SportStream
              </button>
              <button
                onClick={() => {
                  window.open('https://tarjetarojaenvivo.cx', '_blank', 'noopener,noreferrer');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors text-[10px] font-medium text-red-400"
              >
                <Globe className="h-3 w-3" />
                RojaDirecta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basketball Match Tracker Overlay */}
      <BasketballMatchTracker
        isOpen={showTracker}
        onClose={() => setShowTracker(false)}
        match={match}
      />
    </div>
  );
}
