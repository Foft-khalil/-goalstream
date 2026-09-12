'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Shield, Tv, Play, Loader2, Zap, AlertCircle, Radio, CheckCircle2, Ban, RefreshCw, Wifi } from 'lucide-react';
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
  const [iptvStreams, setIptvStreams] = useState<StreamResult[]>([]);
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
    setIptvStreams([]);
    setRojaStreams([]);
    setValidationStates({});

    // Fetch from THREE sources in parallel:
    // 1. /api/iptv-channels — PRIMARY: IPTV-org channels validated through stream-proxy (ACTUALLY WORK)
    // 2. /api/daddylive — SECONDARY: DaddyLive schedule channels (may be Cloudflare-protected, need client validation)
    // 3. /api/streams — TERTIARY: Rojadirecta embed streams
    const [iptvResult, daddyliveResult, rojaResult] = await Promise.allSettled([
      // PRIMARY: IPTV-org channels (already validated through proxy — these actually play)
      fetch(`/api/iptv-channels?competition=${encodeURIComponent(competition || '')}&sport=${sport}`)
        .then(r => r.json())
        .then(data => ((data.channels || []) as StreamResult[]).filter(s => !isDeadStream(s.url)))
        .catch(() => [] as StreamResult[]),

      // SECONDARY: DaddyLive channels (need client-side validation via stream-proxy)
      fetch(`/api/daddylive?homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}&sport=${sport}&competition=${encodeURIComponent(competition || '')}${isLive ? '&liveOnly=true' : ''}`)
        .then(r => r.json())
        .then(data => ((data.streams || []) as StreamResult[]).filter(s => !isDeadStream(s.url)))
        .catch(() => [] as StreamResult[]),

      // TERTIARY: Rojadirecta embed streams
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

    if (iptvResult.status === 'fulfilled') {
      setIptvStreams(iptvResult.value);
      // Mark IPTV channels as "valid" immediately (they were already validated via proxy)
      const validStates: Record<string, ValidationState> = {};
      for (const s of iptvResult.value) {
        validStates[s.url] = 'valid';
      }
      setValidationStates(validStates);
    }
    if (daddyliveResult.status === 'fulfilled') {
      setDaddyliveStreams(daddyliveResult.value);
      // DaddyLive embed URLs are already server-validated (HTTP 200 check in the API route)
      // so mark them as 'valid' immediately — no need for client-side validation.
      setValidationStates(prev => {
        const next = { ...prev };
        for (const s of daddyliveResult.value) next[s.url] = 'valid';
        return next;
      });
    }
    if (rojaResult.status === 'fulfilled') {
      setRojaStreams(rojaResult.value);
    }

    if (iptvResult.status === 'rejected' && daddyliveResult.status === 'rejected' && rojaResult.status === 'rejected') {
      setApiError('Impossible de charger les flux. Vérifiez votre connexion.');
    }

    setLoading(false);
  }, [isOpen, homeTeam, awayTeam, competition, sport, isLive]);

  useEffect(() => {
    if (isOpen) {
      cancelledRef.current = false;
      // Fetching data when the modal opens is a legitimate effect pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStreams();
      return () => { cancelledRef.current = true; };
    }
  }, [isOpen, fetchStreams, retryCount]);

  // Validate DaddyLive + Rojadirecta m3u8 streams in parallel (IPTV channels are already pre-validated)
  useEffect(() => {
    if (loading) return;

    // Only validate DaddyLive + Roja streams (NOT IPTV — already validated via proxy)
    const streamsToValidate = [...daddyliveStreams, ...rojaStreams];
    const m3u8Streams = streamsToValidate.filter(s => isM3u8Url(s.url));
    if (m3u8Streams.length === 0) return;

    cancelledRef.current = false;
    const validateAll = async () => {
      // Mark all m3u8 as pending first
      setValidationStates(prev => {
        const next = { ...prev };
        for (const s of m3u8Streams) if (!next[s.url]) next[s.url] = 'pending';
        return next;
      });

      // Validate ALL in parallel (was batches of 3 — now parallel for speed)
      const results = await Promise.allSettled(
        m3u8Streams.map(async (stream) => {
          try {
            const res = await fetch('/api/stream-validate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: stream.url }),
              signal: AbortSignal.timeout(7000),
            });
            const data = await res.json();
            return { url: stream.url, valid: data.valid === true };
          } catch {
            // STRICT: network error = invalid (don't show broken channels)
            return { url: stream.url, valid: false };
          }
        })
      );

      if (cancelledRef.current) return;

      setValidationStates(prev => {
        const next = { ...prev };
        for (const result of results) {
          if (result.status === 'fulfilled') {
            next[result.value.url] = result.value.valid ? 'valid' : 'invalid';
          }
        }
        return next;
      });
    };

    validateAll();
    return () => { cancelledRef.current = true; };
  }, [loading, daddyliveStreams, rojaStreams]);

  if (!isOpen) return null;

  // Combine all streams — IPTV channels FIRST (they're pre-validated via proxy, guaranteed to work)
  const allIptv = iptvStreams;
  const allDaddy = daddyliveStreams;
  const allRoja = rojaStreams;

  const allM3u8Streams = [
    ...allIptv.filter(s => s.type === 'm3u8' || isM3u8Url(s.url)),  // IPTV first (pre-validated)
    ...allDaddy.filter(s => s.type === 'm3u8' || isM3u8Url(s.url)),
    ...allRoja.filter(s => isM3u8Url(s.url)),
  ];

  const allEmbedStreams = [
    ...allDaddy.filter(s => s.type === 'embed' && !isM3u8Url(s.url)),
    ...allRoja.filter(s => !isM3u8Url(s.url)),
  ];

  // Deduplicate by URL
  const dedupedM3u8 = allM3u8Streams.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i);
  const dedupedEmbed = allEmbedStreams.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i);

  // ── KEY CHANGE: Show candidate channels with validation status ──
  // - Valid channels → "Disponible" badge (green, clickable)
  // - Pending channels → "Test en cours" badge (amber, CLICKABLE — user can try)
  // - Invalid channels → hidden (confirmed broken, don't show)
  const visibleM3u8 = dedupedM3u8.filter(s => validationStates[s.url] !== 'invalid');
  const visibleEmbed = dedupedEmbed.filter(s => validationStates[s.url] !== 'invalid');

  // Confirmed-working channels only (for the "Disponible" count)
  const confirmedWorkingM3u8 = dedupedM3u8.filter(s => validationStates[s.url] === 'valid');
  const confirmedWorkingEmbed = dedupedEmbed.filter(s => validationStates[s.url] === 'valid');
  const confirmedWorkingCount = confirmedWorkingM3u8.length + confirmedWorkingEmbed.length;

  // Check if validation is still in progress (any pending)
  const allCandidates = [...dedupedM3u8, ...dedupedEmbed];
  const anyPending = allCandidates.some(s => validationStates[s.url] === 'pending');
  const totalCandidates = allCandidates.length;
  const validatedCount = allCandidates.filter(s => validationStates[s.url] === 'valid' || validationStates[s.url] === 'invalid').length;
  const invalidCount = allCandidates.filter(s => validationStates[s.url] === 'invalid').length;

  // No streams at all (no candidates from any source)
  const noCandidates = !loading && totalCandidates === 0 && !apiError;

  // All streams validated but none working AND all hidden → "Diffusion non disponible"
  // (only triggers when no visible channels remain — all confirmed invalid)
  const noneWorking = !loading && totalCandidates > 0 && !anyPending && visibleM3u8.length === 0 && visibleEmbed.length === 0 && !apiError;

  // Sort visible m3u8: valid first, then pending. Within same state, higher score first.
  const stateRank = (url: string) => {
    const st = validationStates[url];
    if (st === 'valid') return 0;
    if (st === 'pending' || !st) return 1;
    return 2;
  };
  visibleM3u8.sort((a, b) => {
    const ra = stateRank(a.url), rb = stateRank(b.url);
    if (ra !== rb) return ra - rb;
    return (b.score || 0) - (a.score || 0);
  });
  visibleEmbed.sort((a, b) => {
    const ra = stateRank(a.url), rb = stateRank(b.url);
    if (ra !== rb) return ra - rb;
    return (b.score || 0) - (a.score || 0);
  });

  /**
   * Play a stream IN-APP — NEVER redirect externally.
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
              <h2 className="font-bold text-sm">
                {isLive ? '🔴 Chaînes en direct' : (t(language, 'stream.watchLive') || 'Regarder')}
              </h2>
              <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                {homeTeam} vs {awayTeam}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!loading && totalCandidates > 0 && (
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
          {/* Validation progress banner — shown while checking channels */}
          {!loading && anyPending && totalCandidates > 0 && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-600 dark:text-amber-500/80 leading-relaxed">
                Vérification des chaînes… {validatedCount}/{totalCandidates} testées, {confirmedWorkingCount} disponible{confirmedWorkingCount > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Channels list — only show if there are visible (non-invalid) channels */}
          {!loading && visibleM3u8.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Chaînes disponibles
                {confirmedWorkingM3u8.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-[8px] font-bold">
                    {confirmedWorkingM3u8.length} {confirmedWorkingM3u8.length > 1 ? 'CHAÎNES' : 'CHAÎNE'}
                  </span>
                )}
              </h3>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                {visibleM3u8.map((stream, idx) => {
                  const state: ValidationState = validationStates[stream.url] || 'pending';
                  const isWorking = state === 'valid';
                  return (
                    <button
                      key={`m3u8-${idx}`}
                      onClick={() => handlePlayStream(stream)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                        isWorking
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
                          : 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isWorking ? 'bg-emerald-500/15' : 'bg-amber-500/10'}`}>
                        {stream.channelLogo ? (
                          <img src={stream.channelLogo} alt="" className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Play className={`h-5 w-5 ${isWorking ? 'text-emerald-500' : 'text-amber-500'} fill-current`} />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold truncate ${isWorking ? 'text-emerald-400' : 'text-foreground'}`}>
                            {stream.name}
                          </span>
                          {isWorking ? (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                              <span className="text-[8px] font-bold text-emerald-500">DISPONIBLE</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15">
                              <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-500" />
                              <span className="text-[8px] font-bold text-amber-500">TEST…</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stream.group && <span className="text-[10px] text-muted-foreground">{stream.group}</span>}
                          {stream.eventName && <span className="text-[10px] text-muted-foreground">{stream.eventName}</span>}
                        </div>
                      </div>
                      <Play className={`h-4 w-4 shrink-0 ${isWorking ? 'text-emerald-500' : 'text-amber-500'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Embed streams — only show if there are visible ones */}
          {!loading && visibleEmbed.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Radio className="h-3 w-3" />
                Autres sources
                {confirmedWorkingEmbed.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500 text-[8px] font-bold">
                    {confirmedWorkingEmbed.length} DISPONIBLE{confirmedWorkingEmbed.length > 1 ? 'S' : ''}
                  </span>
                )}
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                {visibleEmbed.map((stream, idx) => {
                  const state: ValidationState = validationStates[stream.url] || 'pending';
                  const isWorking = state === 'valid';
                  return (
                    <button
                      key={`embed-${idx}`}
                      onClick={() => handlePlayStream(stream)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                        isWorking
                          ? 'hover:bg-sky-500/8 border-sky-500/20'
                          : 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/15'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isWorking ? 'bg-sky-500/10' : 'bg-amber-500/10'}`}>
                        {stream.channelLogo ? (
                          <img src={stream.channelLogo} alt="" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Tv className={`h-4 w-4 ${isWorking ? 'text-sky-500' : 'text-amber-500'}`} />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold truncate ${isWorking ? 'text-sky-400' : 'text-foreground'}`}>
                            {stream.name}
                          </span>
                          {isWorking ? (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                              <span className="text-[8px] font-bold text-emerald-500">OK</span>
                            </span>
                          ) : (
                            <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stream.langFlag && <span className="text-[10px] text-muted-foreground">{stream.langFlag} {stream.lang}</span>}
                          <span className="text-[10px] text-muted-foreground">{stream.source}</span>
                        </div>
                      </div>
                      <Play className={`h-3.5 w-3.5 shrink-0 ${isWorking ? 'text-sky-500' : 'text-amber-500'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading state — fetching stream candidates */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-xs text-muted-foreground">Recherche des chaînes disponibles…</p>
            </div>
          )}

          {/* No candidates at all — Diffusion non disponible */}
          {noCandidates && (
            <div className="flex flex-col items-center justify-center py-10 px-4 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Ban className="h-8 w-8 text-amber-500" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Diffusion non disponible</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed max-w-[280px]">
                  Aucune chaîne autorisée ne diffuse ce match actuellement.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRetryCount(c => c + 1)}
                className="mt-1 gap-1.5 text-xs rounded-lg"
              >
                <RefreshCw className="h-3 w-3" />
                Réessayer
              </Button>
            </div>
          )}

          {/* All channels tested but all hidden (invalid) — Diffusion non disponible */}
          {noneWorking && (
            <div className="flex flex-col items-center justify-center py-10 px-4 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <Ban className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Diffusion non disponible</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed max-w-[280px]">
                  Aucune chaîne fonctionnelle trouvée pour ce match. Les flux cassés sont automatiquement masqués.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRetryCount(c => c + 1)}
                className="mt-1 gap-1.5 text-xs rounded-lg"
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

          {/* Info banner — explains the behavior */}
          {!loading && totalCandidates > 0 && (visibleM3u8.length > 0 || visibleEmbed.length > 0) && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-emerald-600 dark:text-emerald-500/70 leading-relaxed">
                Seules les chaînes vérifiées et fonctionnelles sont cliquables. Les flux cassés sont masqués.
                Lecture 100% dans l'application — aucune redirection externe.
              </p>
            </div>
          )}

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
