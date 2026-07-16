'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Shield, Tv, Play, ExternalLink, Youtube, Loader2, Globe, Zap, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface StreamOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  homeTeam: string;
  awayTeam: string;
  competition: string | null;
  sport: 'football' | 'basketball';
  matchId?: string;
}

interface StreamResult {
  name: string;
  url: string;
  lang?: string;
  langFlag?: string;
  source: string;
  type?: 'm3u8' | 'embed';
  channelLogo?: string;
  group?: string;
  eventTime?: string;
  eventName?: string;
}

/**
 * Get official broadcaster links based on competition
 */
function getOfficialBroadcasters(competition: string | null, sport: 'football' | 'basketball'): Array<{ name: string; url: string; icon: string }> {
  const comp = (competition || '').toLowerCase();
  const broadcasters: Array<{ name: string; url: string; icon: string }> = [];

  if (sport === 'football') {
    if (comp.includes('ligue 1') || comp.includes('ligue1')) {
      broadcasters.push({ name: 'DAZN (Ligue 1)', url: 'https://www.dazn.com/fr-FR/home', icon: '📺' });
      broadcasters.push({ name: 'beIN Sports', url: 'https://www.beinsports.com/fr/', icon: '📺' });
    }
    if (comp.includes('champions') || comp.includes('ucl')) {
      broadcasters.push({ name: 'Canal+ (UCL)', url: 'https://www.canalplus.com/', icon: '📺' });
    }
    if (comp.includes('premier') || comp.includes('eng.1')) {
      broadcasters.push({ name: 'Sky Sports', url: 'https://www.skysports.com/', icon: '📺' });
    }
    if (broadcasters.length === 0) {
      broadcasters.push({ name: 'DAZN', url: 'https://www.dazn.com/', icon: '📺' });
      broadcasters.push({ name: 'beIN Sports', url: 'https://www.beinsports.com/', icon: '📺' });
    }
  } else {
    if (comp.includes('nba')) {
      broadcasters.push({ name: 'NBA League Pass', url: 'https://www.nba.com/watch/league-pass', icon: '🏀' });
    }
    if (broadcasters.length === 0) {
      broadcasters.push({ name: 'NBA League Pass', url: 'https://www.nba.com/watch/league-pass', icon: '🏀' });
      broadcasters.push({ name: 'ESPN+', url: 'https://www.espn.com/espnplus/', icon: '📺' });
    }
  }

  return broadcasters;
}

/**
 * Check if a URL is a direct m3u8 HLS stream
 */
function isM3u8Url(url: string): boolean {
  return url.includes('.m3u8') || url.includes('m3u8');
}

/**
 * Get a proxied m3u8 URL that adds the proper Origin/Referer headers
 */
function getProxiedM3u8(url: string): string {
  if (!isM3u8Url(url)) return url;
  // Route through our stream-proxy which adds proper headers
  return `/api/stream-proxy?url=${encodeURIComponent(url)}`;
}

export default function StreamOptions({
  isOpen,
  onClose,
  homeTeam,
  awayTeam,
  competition,
  sport,
  matchId,
}: StreamOptionsProps) {
  const { openPlayer, language } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [daddyliveStreams, setDaddyliveStreams] = useState<StreamResult[]>([]);
  const [koraStreams, setKoraStreams] = useState<StreamResult[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchStreams = useCallback(async () => {
    if (!isOpen) return;

    setLoading(true);
    setApiError(null);
    setDaddyliveStreams([]);
    setKoraStreams([]);

    // Fetch from BOTH sources in parallel
    const [daddyliveResult, koraResult] = await Promise.allSettled([
      // Source 1: DaddyLive (PRIMARY - has direct m3u8 streams)
      fetch(`/api/daddylive?homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}&sport=${sport}`)
        .then(r => r.json())
        .then(data => (data.streams || []) as StreamResult[])
        .catch(() => [] as StreamResult[]),

      // Source 2: kora-api + rojadirecta (SECONDARY)
      fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam, awayTeam, competition: competition || '', sport }),
      })
        .then(r => r.json())
        .then(data => (data.streams || []) as StreamResult[])
        .catch(() => [] as StreamResult[]),
    ]);

    if (daddyliveResult.status === 'fulfilled') {
      setDaddyliveStreams(daddyliveResult.value);
    }
    if (koraResult.status === 'fulfilled') {
      setKoraStreams(koraResult.value);
    }

    if (daddyliveResult.status === 'rejected' && koraResult.status === 'rejected') {
      setApiError('Impossible de charger les flux');
    }

    setLoading(false);
  }, [isOpen, homeTeam, awayTeam, competition, sport]);

  useEffect(() => {
    if (isOpen) {
      let cancelled = false;
      const doFetch = async () => {
        if (cancelled) return;
        await fetchStreams();
      };
      doFetch();
      return () => { cancelled = true; };
    }
  }, [isOpen, fetchStreams]);

  if (!isOpen) return null;

  const broadcasters = getOfficialBroadcasters(competition, sport);
  const year = new Date().getFullYear();

  // YouTube search URLs
  const youtubeLiveQuery = encodeURIComponent(`${homeTeam} vs ${awayTeam} ${competition || ''} live ${year}`);
  const youtubeLiveUrl = `https://www.youtube.com/results?search_query=${youtubeLiveQuery}`;

  // Merge all streams, DaddyLive first
  const allM3u8Streams = [
    ...daddyliveStreams.filter(s => s.type === 'm3u8' || isM3u8Url(s.url)),
    ...koraStreams.filter(s => isM3u8Url(s.url)),
  ];
  const allEmbedStreams = [
    ...daddyliveStreams.filter(s => s.type === 'embed' && !isM3u8Url(s.url)),
    ...koraStreams.filter(s => !isM3u8Url(s.url)),
  ];
  const hasAnyStreams = allM3u8Streams.length > 0 || allEmbedStreams.length > 0;

  /**
   * Play a stream
   */
  const handlePlayStream = (stream: StreamResult) => {
    const url = stream.url;

    if (isM3u8Url(url)) {
      // DaddyLive m3u8 streams are behind Cloudflare and need proper Origin/Referer
      // Try stream-proxy first, but if it fails, open via dlhd embed page
      // Route through our stream-proxy which adds the required headers
      const proxiedUrl = getProxiedM3u8(url);
      openPlayer(proxiedUrl, stream.name, stream.channelLogo || undefined);
    } else if (url.includes('dlhd.click') || url.includes('dlhd.st')) {
      // DaddyLive embed page — open in new tab (their player handles the stream)
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // Other embed URLs — try in video player for known domains
      const knownStreamDomains = ['streams.center', 'streamcenter.pro', 'fltvhd.com', 'go4score.app', 'smartagro.mov'];
      const isKnownDomain = knownStreamDomains.some(d => url.includes(d));

      if (isKnownDomain) {
        openPlayer(url, stream.name, stream.channelLogo || undefined);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in">
      <div className="bg-card border border-border/30 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border/20 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${sport === 'basketball' ? 'bg-orange-500/10' : 'bg-emerald-500/10'} flex items-center justify-center`}>
              <Tv className={`h-5 w-5 ${sport === 'basketball' ? 'text-orange-500' : 'text-emerald-500'}`} />
            </div>
            <div>
              <h2 className="font-bold text-sm">{t(language, 'stream.watchLive') || 'Regarder en direct'}</h2>
              <p className="text-[11px] text-muted-foreground/50 truncate max-w-[240px]">
                {homeTeam} vs {awayTeam}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-secondary/50">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Free m3u8 Streams — TOP PRIORITY (DaddyLive + others) */}
          {!loading && allM3u8Streams.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Flux gratuits en direct
                <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-bold">
                  {allM3u8Streams.length} FLUX
                </span>
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {allM3u8Streams.map((stream, idx) => (
                  <button
                    key={`m3u8-${idx}`}
                    onClick={() => handlePlayStream(stream)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/20 transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      {stream.channelLogo ? (
                        <img src={stream.channelLogo} alt="" className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <Play className="h-5 w-5 text-emerald-500 fill-emerald-500" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-400">{stream.name}</span>
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[8px] font-bold text-emerald-500">LIVE</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {stream.group && <span className="text-[10px] text-muted-foreground/30">{stream.group}</span>}
                        <span className="text-[10px] text-emerald-500/50">• via {stream.source}</span>
                        {stream.eventTime && <span className="text-[10px] text-muted-foreground/30">• {stream.eventTime}</span>}
                      </div>
                    </div>
                    <Play className="h-4 w-4 text-emerald-500/40 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Embed streams (secondary — from kora-api / rojadirecta) */}
          {!loading && allEmbedStreams.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-blue-500/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                Autres flux disponibles
              </h3>
              <div className="space-y-1.5">
                {allEmbedStreams.map((stream, idx) => (
                  <button
                    key={`embed-${idx}`}
                    onClick={() => handlePlayStream(stream)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-blue-500/8 border border-blue-500/10 transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Tv className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-blue-400">{stream.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {stream.langFlag && <span className="text-[10px] text-muted-foreground/40">{stream.langFlag} {stream.lang}</span>}
                        <span className="text-[10px] text-blue-500/30">• via {stream.source}</span>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-blue-500/20 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500/40" />
              <p className="text-xs text-muted-foreground/40">Recherche de flux gratuits...</p>
            </div>
          )}

          {/* No streams found */}
          {!loading && !hasAnyStreams && !apiError && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <AlertCircle className="h-6 w-6 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground/40 text-center">Aucun flux gratuit trouvé pour ce match</p>
            </div>
          )}

          {/* Error state */}
          {apiError && !loading && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
              <AlertCircle className="h-3.5 w-3.5 text-red-500/70 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-500/60 leading-relaxed">{apiError}</p>
            </div>
          )}

          {/* YouTube Live — Always available */}
          <div>
            <h3 className="text-[10px] font-bold text-red-500/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Youtube className="h-3 w-3" />
              YouTube Live
            </h3>
            <button
              onClick={() => window.open(youtubeLiveUrl, '_blank', 'noopener,noreferrer')}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-400">YouTube Live</span>
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] font-bold text-red-500">LIVE</span>
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/40 truncate">
                  Chercher en direct sur YouTube
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-red-500/20 shrink-0" />
            </button>
          </div>

          {/* Official Broadcasters */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Tv className="h-3 w-3" />
              Diffuseurs officiels
            </h3>
            <div className="space-y-1.5">
              {broadcasters.map((b, idx) => (
                <button
                  key={`broadcaster-${idx}`}
                  onClick={() => window.open(b.url, '_blank', 'noopener,noreferrer')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/40 dark:hover:bg-white/[0.03] border border-border/10 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-lg bg-secondary/30 dark:bg-white/[0.03] flex items-center justify-center shrink-0 text-lg">
                    {b.icon}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-sm font-medium text-muted-foreground/70">{b.name}</span>
                    <p className="text-[10px] text-muted-foreground/25 truncate">Diffusion officielle</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/15 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <Shield className="h-3.5 w-3.5 text-amber-500/70 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-500/60 leading-relaxed">
              {t(language, 'stream.disclaimer') || 'Les flux peuvent ne pas être disponibles dans toutes les régions.'}
            </p>
          </div>

          {/* Match info */}
          <div className="px-3 py-2 rounded-lg bg-secondary/15 dark:bg-white/[0.01] border border-border/10">
            <p className="text-[10px] text-muted-foreground/25 text-center font-medium">
              {competition || t(language, 'match.friendly')} • {homeTeam} vs {awayTeam}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
