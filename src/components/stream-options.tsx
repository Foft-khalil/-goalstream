'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Shield, Tv, Play, Loader2, Zap, AlertCircle, Radio, CheckCircle2, Ban, RefreshCw } from 'lucide-react';
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
  score?: number;
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
  // Already proxied?
  if (url.startsWith('/api/stream-proxy')) return url;
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

type ValidationState = 'pending' | 'valid' | 'invalid';

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
  const [validationStates, setValidationStates] = useState<Record<string, ValidationState>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const cancelledRef = useRef(false);

  const fetchStreams = useCallback(async () => {
    if (!isOpen) return;

    setLoading(true);
    setApiError(null);
    setDaddyliveStreams([]);
    setRojaStreams([]);
    setValidationStates({});

    // Fetch from both sources in parallel
    const [daddyliveResult, rojaResult] = await Promise.allSettled([
      fetch(`/api/daddylive?homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}&sport=${sport}&competition=${encodeURIComponent(competition || '')}${isLive ? '&liveOnly=true' : ''}`)
        .then(r => r.json())
        .then(data => ((data.streams || []) as StreamResult[]).filter(s => !isDeadStream(s.url)))
        .catch(() => [] as StreamResult[]),

      fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam, awayTeam, competition: competition || '', sport, liveOnly: isLive }),
      })
        .then(r => r.json())
        .then(data => ((data.streams || []) as StreamResult[]).filter(s => !isDeadStream(s.url)))
        .catch(() => [] as StreamResult[]),
    ]);

    if (cancelledRef.current) return;

    if (daddyliveResult.status === 'fulfilled') {
      setDaddyliveStreams(daddyliveResult.value);
    }
    if (rojaResult.status === 'fulfilled') {
      setRojaStreams(rojaResult.value);
    }

    if (daddyliveResult.status === 'rejected' && rojaResult.status === 'rejected') {
      setApiError('Impossible de charger les flux. Vérifiez votre connexion.');
    }

    setLoading(false);
  }, [isOpen, homeTeam, awayTeam, competition, sport, isLive]);

  useEffect(() => {
    if (isOpen) {
      cancelledRef.current = false;
      // Fetching data when the modal opens is a legitimate effect pattern.
      // The setState calls inside fetchStreams are necessary to drive the loading state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStreams();
      return () => { cancelledRef.current = true; };
    }
  }, [isOpen, fetchStreams, retryCount]);

  // Validate m3u8 streams in the background AFTER loading
  useEffect(() => {
    if (loading) return;

    const allStreams = [...daddyliveStreams, ...rojaStreams];
    const m3u8Streams = allStreams.filter(s => isM3u8Url(s.url));
    if (m3u8Streams.length === 0) return;

    cancelledRef.current = false;
    const validateBatch = async () => {
      // Mark all m3u8 as pending first
      setValidationStates(prev => {
        const next = { ...prev };
        for (const s of m3u8Streams) if (!next[s.url]) next[s.url] = 'pending';
        return next;
      });

      // Validate in batches of 3
      for (let i = 0; i < m3u8Streams.length; i += 3) {
        if (cancelledRef.current) break;
        const batch = m3u8Streams.slice(i, i + 3);

        const results = await Promise.allSettled(
          batch.map(async (stream) => {
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
              // Benefit of the doubt
              return { url: stream.url, valid: true };
            }
          })
        );

        if (cancelledRef.current) break;

        setValidationStates(prev => {
          const next = { ...prev };
          for (const result of results) {
            if (result.status === 'fulfilled') {
              next[result.value.url] = result.value.valid ? 'valid' : 'invalid';
            }
          }
          return next;
        });

        // Small delay between batches
        if (!cancelledRef.current && i + 3 < m3u8Streams.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
    };

    validateBatch();
    return () => { cancelledRef.current = true; };
  }, [loading, daddyliveStreams, rojaStreams]);

  if (!isOpen) return null;

  // Combine and sort all streams: m3u8 first, then embed. Within each, by validation state then score.
  const allDaddy = daddyliveStreams;
  const allRoja = rojaStreams;

  const allM3u8Streams = [
    ...allDaddy.filter(s => s.type === 'm3u8' || isM3u8Url(s.url)),
    ...allRoja.filter(s => isM3u8Url(s.url)),
  ];

  // For live matches: include embed streams too (they play in-app via proxy-stream)
  // but rank them below m3u8 so user sees the best option first
  const allEmbedStreams = [
    ...allDaddy.filter(s => s.type === 'embed' && !isM3u8Url(s.url)),
    ...allRoja.filter(s => !isM3u8Url(s.url)),
  ];

  // Deduplicate by URL
  const dedupedM3u8 = allM3u8Streams.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i);
  const dedupedEmbed = allEmbedStreams.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i);

  // Sort: valid first, then pending, then invalid last. Within same state, higher score first.
  const stateRank = (url: string) => {
    const st = validationStates[url];
    if (st === 'valid') return 0;
    if (st === 'pending' || !st) return 1;
    return 2;
  };

  const byStateAndScore = (a: StreamResult, b: StreamResult) => {
    const ra = stateRank(a.url), rb = stateRank(b.url);
    if (ra !== rb) return ra - rb;
    return (b.score || 0) - (a.score || 0);
  };

  dedupedM3u8.sort(byStateAndScore);
  dedupedEmbed.sort(byStateAndScore);

  // Only HIDE streams that are confirmed invalid (state = 'invalid')
  const visibleM3u8 = dedupedM3u8.filter(s => validationStates[s.url] !== 'invalid');
  const visibleEmbed = isLive
    ? dedupedEmbed.filter(s => validationStates[s.url] !== 'invalid').slice(0, 4) // limit embeds for live
    : dedupedEmbed.filter(s => validationStates[s.url] !== 'invalid');

  const totalCandidates = visibleM3u8.length + visibleEmbed.length;
  const hasAnyStreams = totalCandidates > 0;

  /**
   * Play a stream IN-APP — NEVER redirect externally.
   * All streams are played through the video player:
   * - m3u8 streams → HLS.js via stream-proxy (auto-detects Origin)
   * - embed URLs → iframe via proxy-stream (server-side proxy removes X-Frame-Options)
   */
  const handlePlayStream = (stream: StreamResult) => {
    const url = stream.url;
    if (isM3u8Url(url)) {
      const proxiedUrl = getProxiedM3u8(url);
      openPlayer(proxiedUrl, stream.name, stream.channelLogo || undefined);
    } else {
      // Embed/iframe URL — play in-app via proxy-stream (no external redirect)
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
              <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                {homeTeam} vs {awayTeam}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!loading && hasAnyStreams && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRetryCount(c => c + 1)}
                className="h-8 px-2 rounded-lg hover:bg-secondary/50 gap-1 text-[10px] text-muted-foreground"
                title="Actualiser"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-secondary/50">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* m3u8 Streams — TOP PRIORITY, plays natively in-app */}
          {!loading && visibleM3u8.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Flux directs vérifiés
                <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-bold">
                  {visibleM3u8.length} FLUX
                </span>
              </h3>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                {visibleM3u8.map((stream, idx) => {
                  const state: ValidationState = validationStates[stream.url] || 'pending';
                  const isFallback = stream.source === 'competition-fallback';
                  return (
                    <button
                      key={`m3u8-${idx}`}
                      onClick={() => handlePlayStream(stream)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                        isFallback
                          ? 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/15'
                          : 'bg-emerald-500/8 hover:bg-emerald-500/15 border-emerald-500/20'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isFallback ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                        {stream.channelLogo ? (
                          <img src={stream.channelLogo} alt="" className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Play className={`h-5 w-5 ${isFallback ? 'text-amber-500' : 'text-emerald-500'} fill-current`} />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold truncate ${isFallback ? 'text-amber-400' : 'text-emerald-400'}`}>{stream.name}</span>
                          {state === 'valid' && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                              <span className="text-[8px] font-bold text-emerald-500">OK</span>
                            </span>
                          )}
                          {state === 'pending' && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10">
                              <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-500" />
                              <span className="text-[8px] font-bold text-amber-500">TEST</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stream.group && <span className="text-[10px] text-muted-foreground">{stream.group}</span>}
                          <span className="text-[10px] text-muted-foreground">{stream.eventName || `via ${stream.source}`}</span>
                          {stream.eventTime && <span className="text-[10px] text-muted-foreground">{stream.eventTime}</span>}
                        </div>
                      </div>
                      <Play className={`h-4 w-4 shrink-0 ${isFallback ? 'text-amber-500' : 'text-emerald-500'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Embed streams — played in-app via iframe proxy */}
          {!loading && visibleEmbed.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Radio className="h-3 w-3" />
                Flux intégrés
                <span className="ml-1 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 text-[8px] font-bold">
                  {visibleEmbed.length} FLUX
                </span>
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                {visibleEmbed.map((stream, idx) => {
                  const state: ValidationState = validationStates[stream.url] || 'pending';
                  return (
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
                          <span className="text-sm font-semibold text-sky-400 truncate">{stream.name}</span>
                          {state === 'valid' && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                              <span className="text-[8px] font-bold text-emerald-500">OK</span>
                            </span>
                          )}
                          {state === 'pending' && (
                            <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stream.langFlag && <span className="text-[10px] text-muted-foreground">{stream.langFlag} {stream.lang}</span>}
                          <span className="text-[10px] text-sky-500/60">via {stream.source}</span>
                        </div>
                      </div>
                      <Play className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-xs text-muted-foreground">Recherche de flux gratuits...</p>
            </div>
          )}

          {/* No streams found — DEFINITIVE unavailable state */}
          {!loading && !hasAnyStreams && !apiError && (
            <div className="flex flex-col items-center justify-center py-8 px-4 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Ban className="h-7 w-7 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Match non disponible</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed max-w-[280px]">
                  Aucune chaîne gratuite ne diffuse ce match actuellement.
                  Les flux cassés sont automatiquement masqués.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRetryCount(c => c + 1)}
                className="mt-2 gap-1.5 text-xs rounded-lg"
              >
                <RefreshCw className="h-3 w-3" />
                Réessayer
              </Button>
            </div>
          )}

          {/* Error state */}
          {apiError && !loading && (
            <div className="flex flex-col items-center justify-center py-8 px-4 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Erreur de chargement</p>
                <p className="text-[11px] text-muted-foreground mt-1">{apiError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRetryCount(c => c + 1)}
                className="mt-2 gap-1.5 text-xs rounded-lg"
              >
                <RefreshCw className="h-3 w-3" />
                Réessayer
              </Button>
            </div>
          )}

          {/* Info banner — explains the new behavior */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500/70 leading-relaxed">
              {isLive
                ? 'Lecture 100% dans l\'application — aucune redirection externe. Les flux sont testés en direct ; seuls les flux non fonctionnels sont masqués.'
                : 'Tous les flux sont lus directement dans l\'application. Les flux indisponibles sont automatiquement masqués.'
              }
            </p>
          </div>

          {/* Match info */}
          <div className="px-3 py-2 rounded-lg bg-secondary/15 dark:bg-white/[0.02] border border-border/10">
            <p className="text-[10px] text-muted-foreground text-center font-medium">
              {competition || t(language, 'match.friendly')} • {homeTeam} vs {awayTeam}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
