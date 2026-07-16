'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Shield, Tv, Play, Loader2, Zap, AlertCircle, Radio } from 'lucide-react';
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
  isLive?: boolean;
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
 * Check if a URL is a direct m3u8 HLS stream
 */
function isM3u8Url(url: string): boolean {
  return url.includes('.m3u8') || url.includes('m3u8');
}

/**
 * Get a proxied m3u8 URL that adds the proper Origin/Referer headers
 * The stream-proxy auto-detects the correct Origin based on the URL domain
 */
function getProxiedM3u8(url: string): string {
  if (!isM3u8Url(url)) return url;
  return `/api/stream-proxy?url=${encodeURIComponent(url)}`;
}

// Domains known to be dead/seized — never show these to users
const DEAD_DOMAINS = [
  'streams.center',      // SEIZED by law enforcement
  'streamcenter.pro',    // SEIZED (same operator)
  'tvhd2.com',           // SEIZED
  'kora-api.top',        // All URLs point to seized domains
  'sportsonlinne.click', // Cloudflare JS challenge (unusable)
  'dlhd.click',          // DNS dead
];

/**
 * Check if a stream URL points to a dead/seized domain
 */
function isDeadStream(url: string): boolean {
  return DEAD_DOMAINS.some(d => url.includes(d));
}

export default function StreamOptions({
  isOpen,
  onClose,
  homeTeam,
  awayTeam,
  competition,
  sport,
  matchId,
  isLive = false,
}: StreamOptionsProps) {
  const { openPlayer, language } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [daddyliveStreams, setDaddyliveStreams] = useState<StreamResult[]>([]);
  const [rojaStreams, setRojaStreams] = useState<StreamResult[]>([]);
  const [validatingStreams, setValidatingStreams] = useState<Set<string>>(new Set());
  const [invalidStreams, setInvalidStreams] = useState<Set<string>>(new Set());
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchStreams = useCallback(async () => {
    if (!isOpen) return;

    setLoading(true);
    setApiError(null);
    setDaddyliveStreams([]);
    setRojaStreams([]);
    setInvalidStreams(new Set());

    // Fetch from both sources in parallel
    // When match is live, use strict matching (both teams must match) + only current day
    const [daddyliveResult, rojaResult] = await Promise.allSettled([
      // Source 1: DaddyLive (m3u8 streams + embed fallbacks)
      fetch(`/api/daddylive?homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}&sport=${sport}${isLive ? '&liveOnly=true' : ''}`)
        .then(r => r.json())
        .then(data => ((data.streams || []) as StreamResult[]).filter(s => !isDeadStream(s.url)))
        .catch(() => [] as StreamResult[]),

      // Source 2: rojadirecta (resolvable embed URLs)
      fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam, awayTeam, competition: competition || '', sport, liveOnly: isLive }),
      })
        .then(r => r.json())
        .then(data => ((data.streams || []) as StreamResult[]).filter(s => !isDeadStream(s.url)))
        .catch(() => [] as StreamResult[]),
    ]);

    if (daddyliveResult.status === 'fulfilled') {
      setDaddyliveStreams(daddyliveResult.value);
    }
    if (rojaResult.status === 'fulfilled') {
      setRojaStreams(rojaResult.value);
    }

    if (daddyliveResult.status === 'rejected' && rojaResult.status === 'rejected') {
      setApiError('Impossible de charger les flux');
    }

    setLoading(false);
  }, [isOpen, homeTeam, awayTeam, competition, sport, isLive]);

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

  // Validate streams in the background after loading
  useEffect(() => {
    if (loading) return;

    const allStreams = [
      ...daddyliveStreams,
      ...rojaStreams,
    ];

    if (allStreams.length === 0) return;

    // Only validate m3u8 streams (embed URLs are validated client-side via the player)
    const m3u8Streams = allStreams.filter(s => isM3u8Url(s.url));

    if (m3u8Streams.length === 0) return;

    let cancelled = false;
    const validateBatch = async () => {
      // Validate m3u8 streams in batches of 3 to not overwhelm the server
      for (let i = 0; i < m3u8Streams.length; i += 3) {
        if (cancelled) break;
        const batch = m3u8Streams.slice(i, i + 3);

        const results = await Promise.allSettled(
          batch.map(async (stream) => {
            setValidatingStreams(prev => new Set(prev).add(stream.url));
            try {
              const res = await fetch('/api/stream-validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: stream.url }),
                signal: AbortSignal.timeout(8000),
              });
              const data = await res.json();
              return { url: stream.url, valid: data.valid === true };
            } catch {
              return { url: stream.url, valid: false };
            } finally {
              setValidatingStreams(prev => {
                const next = new Set(prev);
                next.delete(stream.url);
                return next;
              });
            }
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && !result.value.valid) {
            setInvalidStreams(prev => new Set(prev).add(result.value.url));
          }
        }

        // Small delay between batches
        if (!cancelled && i + 3 < m3u8Streams.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    };

    validateBatch();
    return () => { cancelled = true; };
  }, [loading, daddyliveStreams, rojaStreams]);

  if (!isOpen) return null;

  // Filter out invalid streams
  const validDaddy = daddyliveStreams.filter(s => !invalidStreams.has(s.url));
  const validRoja = rojaStreams.filter(s => !invalidStreams.has(s.url));

  // Merge all streams: m3u8 first (best quality, plays natively), then embed
  const allM3u8Streams = [
    ...validDaddy.filter(s => s.type === 'm3u8' || isM3u8Url(s.url)),
    ...validRoja.filter(s => isM3u8Url(s.url)),
  ];

  // For live matches: DON'T show embed streams (they redirect externally)
  // Only show m3u8 streams that play natively in-app
  const allEmbedStreams = isLive ? [] : [
    ...validDaddy.filter(s => s.type === 'embed' && !isM3u8Url(s.url)),
    ...validRoja.filter(s => !isM3u8Url(s.url)),
  ];
  const hasAnyStreams = allM3u8Streams.length > 0 || allEmbedStreams.length > 0;

  /**
   * Play a stream IN-APP — NEVER redirect externally
   * All streams are played through the video player:
   * - m3u8 streams → HLS.js via stream-proxy
   * - embed URLs → iframe via proxy-stream (server-side proxy removes X-Frame-Options)
   */
  const handlePlayStream = (stream: StreamResult) => {
    const url = stream.url;

    if (isM3u8Url(url)) {
      // Direct m3u8 stream — play through stream-proxy (auto-detects Origin)
      const proxiedUrl = getProxiedM3u8(url);
      openPlayer(proxiedUrl, stream.name, stream.channelLogo || undefined);
    } else {
      // Embed/iframe URL — play in-app via proxy-stream
      // The video-player component will:
      // 1. Try to resolve to m3u8 via /api/resolve-stream
      // 2. If that fails, load in an iframe via /api/proxy-stream
      openPlayer(url, stream.name, stream.channelLogo || undefined);
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
              <h2 className="font-bold text-sm">{isLive ? (t(language, 'stream.watchLive') || 'Regarder en direct') : (t(language, 'stream.watchLive') || 'Regarder')}</h2>
              <p className="text-[11px] text-muted-foreground/60 truncate max-w-[240px]">
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
          {/* m3u8 Streams — TOP PRIORITY, plays natively in-app */}
          {!loading && allM3u8Streams.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Flux directs en direct
                <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-bold">
                  {allM3u8Streams.length} FLUX
                </span>
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {allM3u8Streams.map((stream, idx) => {
                  const isValidating = validatingStreams.has(stream.url);
                  return (
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
                          {isValidating && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stream.group && <span className="text-[10px] text-muted-foreground/30">{stream.group}</span>}
                          <span className="text-[10px] text-emerald-500/50">via {stream.source}</span>
                          {stream.eventTime && <span className="text-[10px] text-muted-foreground/30">{stream.eventTime}</span>}
                        </div>
                      </div>
                      <Play className="h-4 w-4 text-emerald-500/40 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Embed streams — played in-app via iframe proxy */}
          {!loading && allEmbedStreams.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-sky-500/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Radio className="h-3 w-3" />
                Flux intégrés
                <span className="ml-1 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 text-[8px] font-bold">
                  {allEmbedStreams.length} FLUX
                </span>
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {allEmbedStreams.map((stream, idx) => (
                  <button
                    key={`embed-${idx}`}
                    onClick={() => handlePlayStream(stream)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-sky-500/8 border border-sky-500/10 transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                      {stream.channelLogo ? (
                        <img src={stream.channelLogo} alt="" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <Tv className="h-4 w-4 text-sky-500" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-sky-400">{stream.name}</span>
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-500/10">
                          <Radio className="h-2.5 w-2.5 text-sky-500" />
                          <span className="text-[8px] font-bold text-sky-500/70">EMBED</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {stream.langFlag && <span className="text-[10px] text-muted-foreground/40">{stream.langFlag} {stream.lang}</span>}
                        <span className="text-[10px] text-sky-500/30">via {stream.source}</span>
                      </div>
                    </div>
                    <Play className="h-3.5 w-3.5 text-sky-500/40 shrink-0" />
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

          {/* Info banner */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <Radio className="h-3.5 w-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
            <p className="text-[10px] text-emerald-500/60 leading-relaxed">
              {isLive
                ? 'Uniquement les flux directs vérifiés qui fonctionnent dans l\'application. Les flux cassés sont automatiquement supprimés.'
                : 'Tous les flux sont lus directement dans l\'application. Les flux indisponibles sont automatiquement masqués.'
              }
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
