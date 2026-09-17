'use client';

import Hls from 'hls.js';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Loader2, RefreshCw, Tv, SkipForward, Globe, Wifi } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

type StreamStatus = 'loading' | 'ready' | 'error';

/**
 * Determine if a URL is an HLS stream (can be played with video element + hls.js)
 * vs an iframe embed URL (needs to be shown in an iframe)
 */
function isHlsUrl(url: string): boolean {
  // Our own playlist proxy always serves HLS manifests (Task 24 — clean streams)
  if (url.includes('/api/hls-proxy')) return true;
  return url.includes('.m3u8') || url.includes('m3u8');
}

/**
 * Determine if a URL needs to go through our server-side proxy.
 * ALL non-HLS URLs (anything that isn't an m3u8 stream) need proxying
 * because they are web pages that will be blocked by X-Frame-Options
 * or Content-Security-Policy frame-ancestors when loaded directly in an iframe.
 *
 * The proxy fetches the page server-side, strips blocking headers,
 * rewrites nested iframes to also go through the proxy, and serves
 * the content from our own domain.
 */
function needsProxy(url: string): boolean {
  // HLS streams don't need proxying — they play natively in the video element
  if (isHlsUrl(url)) return false;
  // Our own proxy URLs don't need re-proxying
  if (url.includes('/api/proxy-stream')) return false;
  // Known embed sites that DON'T set X-Frame-Options → load directly in iframe.
  //
  // Task 28 (Sep 2026): dlive.sx/watch.php?id=N is the BEST embed URL for
  // DaddyLive channels. When loaded DIRECTLY (not through proxy-stream) in
  // the user's browser:
  //   1. Browser fetches dlive.sx/watch.php from USER's IP
  //   2. Page has nested iframe → stream-N.php (same origin, loads fine)
  //   3. stream-N.php has iframe → tiestep.top/e/{slug} with Referer: dlive.sx
  //      (parent origin) → tiestep.top returns 200
  //   4. stream.js decodes _econfig → m3u8 URL, token bound to USER's IP
  //   5. Clappr fetches m3u8 from USER's IP → matches token → 200 OK → video
  //
  // This is the ONLY working approach: the m3u8 token is IP-bound to whoever
  // loaded the player page. Server-side proxying (sandbox IP) ≠ user's IP →
  // 403. Direct iframe load (user's IP) = m3u8 fetch (user's IP) → match.
  //
  // dlive.sx/watch.php pages DO include popunder ad scripts (greatdexchange.com
  // etc.) but they only fire on user click, not on autoplay load.
  const directLoadDomains: string[] = ['dlive.sx/watch.php'];
  if (directLoadDomains.some(d => url.includes(d))) return false;
  // Any other URL (web page / embed) needs proxying to bypass iframe restrictions
  return true;
}

/**
 * Convert a stream URL to our proxy URL.
 * For HLS (.m3u8) streams, returns the URL as-is (plays in video element).
 * For web page / embed URLs, routes through our server-side proxy
 * to bypass X-Frame-Options and frame-ancestors restrictions.
 */
function getProxiedUrl(url: string): string {
  if (!needsProxy(url)) return url;
  try {
    const encoded = btoa(url);
    return `/api/proxy-stream?url=${encodeURIComponent(encoded)}`;
  } catch(_e) {
    return url;
  }
}

export default function VideoPlayer() {
  const { playerVisible, playerStreamUrl, playerChannelName, playerChannelLogo, playerAlternatives, closePlayer, openPlayer, language } =
    useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const retryCountRef = useRef(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const currentAltIndexRef = useRef(0);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);

  // Track ready/error state with associated URL so they auto-reset when URL changes
  const [readyUrl, setReadyUrl] = useState<string>('');
  const [errorInfo, setErrorInfo] = useState<{ url: string; msg: string } | null>(null);

  // Resolve-stream state: tracks whether we resolved an iframe URL to m3u8
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  // Iframe error/timeout state
  const [iframeError, setIframeError] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const iframeTimerRef = useRef<NodeJS.Timeout>();

  // The effective URL to play (resolved m3u8 takes priority over original URL)
  const effectiveUrl = resolvedUrl || playerStreamUrl;

  // Determine stream type based on the effective URL
  const isHls = effectiveUrl ? isHlsUrl(effectiveUrl) : true;
  const isIframe = effectiveUrl ? !isHlsUrl(effectiveUrl) : false;

  // For iframe streams, compute the actual URL to use (proxied if needed)
  const iframeSrc = useMemo(() => {
    if (!isIframe || !effectiveUrl) return '';
    return getProxiedUrl(effectiveUrl);
  }, [isIframe, effectiveUrl]);

  // For iframe streams, compute ready state directly instead of using an effect
  const iframeReady = isIframe && !!effectiveUrl;

  // Compute derived state - auto-reset when URL changes
  const streamReady = (isIframe ? iframeReady : (readyUrl === effectiveUrl && !!effectiveUrl));
  const streamError = errorInfo?.url === effectiveUrl ? errorInfo.msg : null;
  const isLoading = isHls && playerVisible && !!effectiveUrl && !streamReady && !streamError;

  // Reset resolve/iframe state when the original URL changes
  useEffect(() => {
    setResolvedUrl(null);
    setIsResolving(false);
    setIframeError(false);
    setIframeTimedOut(false);
  }, [playerStreamUrl]);

  // Resolve-stream: try to resolve iframe URLs to direct m3u8 in the background
  useEffect(() => {
    if (!playerVisible || !playerStreamUrl) return;
    // Only try resolving if it's an iframe URL (not already HLS)
    if (isHlsUrl(playerStreamUrl)) return;
    // SKIP DaddyLive (dlive.sx / hamis.romponalis.st) embeds — their m3u8 is
    // fetched client-side by the Clappr player from a Cloudflare-protected CDN
    // (xameleon.phantemlis.top) that returns 403 server-side. Server-side
    // resolution is impossible. The embed resolves the stream CLIENT-SIDE.
    if (playerStreamUrl.includes('dlive.sx') ||
        playerStreamUrl.includes('dlhd.st') ||
        playerStreamUrl.includes('hamis.romponalis.st')) return;
    // Don't re-resolve if we already have a resolved URL for this stream
    if (resolvedUrl) return;

    let cancelled = false;
    setIsResolving(true);

    const resolveStream = async () => {
      try {
        const res = await fetch('/api/resolve-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: playerStreamUrl }),
        });

        if (!res.ok) {
          console.warn('[VideoPlayer] resolve-stream returned non-OK:', res.status);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.resolved && data.type === 'hls' && data.resolvedUrl) {
          console.log('[VideoPlayer] Resolved to m3u8:', data.resolvedUrl);
          setResolvedUrl(data.resolvedUrl);
        } else {
          console.log('[VideoPlayer] Could not resolve to m3u8, falling back to iframe');
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[VideoPlayer] resolve-stream error:', err);
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    };

    resolveStream();
    return () => { cancelled = true; };
  }, [playerVisible, playerStreamUrl]);

  // Iframe timeout: show warning if iframe hasn't loaded after 45 seconds.
  // DaddyLive (dlive.sx) embeds use a multi-layered loading chain:
  //   dlive.sx/stream/stream-XXX.php → nested hamis.romponalis.st iframe →
  //   Clappr player → m3u8 fetch from CDN. This takes ~20-30s to fully resolve,
  //   so we use a generous 45s timeout (was 15s, which triggered false errors).
  useEffect(() => {
    if (!isIframe || !playerVisible || !effectiveUrl) return;

    setIframeError(false);
    setIframeTimedOut(false);

    iframeTimerRef.current = setTimeout(() => {
      setIframeTimedOut(true);
    }, 45000);

    return () => {
      if (iframeTimerRef.current) {
        clearTimeout(iframeTimerRef.current);
      }
    };
  }, [isIframe, playerVisible, effectiveUrl]);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  // Auto-switch to next alternative channel
  const tryNextChannel = useCallback(() => {
    const alternatives = playerAlternatives;
    if (!alternatives || alternatives.length === 0) return false;

    if (currentAltIndexRef.current < alternatives.length) {
      const next = alternatives[currentAltIndexRef.current];
      currentAltIndexRef.current += 1;
      console.log(`[VideoPlayer] Auto-switching to: ${next.name}`);
      retryCountRef.current = 0;
      openPlayer(next.url, next.name, next.logo || undefined, alternatives.filter((a) => a.url !== next.url));
      return true;
    }
    return false;
  }, [playerAlternatives, openPlayer]);

  // ── Background validation of alternatives ──
  // While the current channel is loading, validate all alternatives in parallel.
  // If a confirmed-VALID alternative is found AND the current channel hasn't started
  // playing yet, switch to the valid one immediately (skip the watchdog wait).
  const validAltUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!playerVisible || !playerAlternatives || playerAlternatives.length === 0) {
      validAltUrlRef.current = null;
      return;
    }

    let cancelled = false;
    validAltUrlRef.current = null;

    // Validate alternatives that are proxied HLS playlists
    const m3u8Alts = playerAlternatives.filter(
      (a) => a.url && (a.url.includes('stream-proxy') || a.url.includes('/api/hls-proxy'))
    );
    if (m3u8Alts.length === 0) return;

    // Extract the original m3u8 URL from the proxied URL for validation
    const extractOrigUrl = (proxied: string): string => {
      try {
        const u = new URL(proxied, window.location.origin);
        return u.searchParams.get('url') || u.searchParams.get('u') || proxied;
      } catch { return proxied; }
    };

    console.log(`[VideoPlayer] Background-validating ${m3u8Alts.length} alternatives`);

    // Validate all alternatives in parallel
    Promise.allSettled(
      m3u8Alts.map(async (alt) => {
        // hls-proxy URLs are same-origin playlists — validate through the
        // proxy itself (it injects the upstream Referer server-side).
        if (alt.url.includes('/api/hls-proxy')) {
          try {
            const res = await fetch(alt.url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) return { alt, valid: false, reason: `HTTP ${res.status}` };
            const txt = await res.text();
            return { alt, valid: txt.includes('#EXTM3U'), reason: 'playlist ok' };
          } catch {
            return { alt, valid: false, reason: 'proxy fetch failed' };
          }
        }
        const origUrl = extractOrigUrl(alt.url);
        try {
          const res = await fetch('/api/stream-validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: origUrl }),
            signal: AbortSignal.timeout(8000),
          });
          const data = await res.json();
          return { alt, valid: data.valid === true, reason: data.reason };
        } catch {
          // Network error — benefit of the doubt
          return { alt, valid: true, reason: 'network error (benefit of doubt)' };
        }
      })
    ).then((results) => {
      if (cancelled) return;

      // Find the FIRST confirmed-valid alternative (in original order)
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.valid) {
          validAltUrlRef.current = r.value.alt.url;
          console.log(`[VideoPlayer] ✓ Validated alternative: ${r.value.alt.name} (${r.value.reason})`);
          break;
        }
      }

      // If we found a valid alternative and the current channel hasn't started playing,
      // switch to it immediately (don't wait for the 5s watchdog)
      if (validAltUrlRef.current && !readyUrl) {
        const validAlt = m3u8Alts.find(a => a.url === validAltUrlRef.current);
        if (validAlt) {
          console.log(`[VideoPlayer] ⚡ Switching to pre-validated channel: ${validAlt.name}`);
          const remaining = playerAlternatives!.filter(a => a.url !== validAlt.url);
          openPlayer(validAlt.url, validAlt.name, validAlt.logo || undefined, remaining);
        }
      }
    });

    return () => { cancelled = true; };
  }, [playerVisible, playerAlternatives, openPlayer, readyUrl]);

  // Setup HLS player (only for HLS URLs, including resolved m3u8)
  useEffect(() => {
    if (!playerVisible || !videoRef.current || !effectiveUrl || !isHls) return;

    const video = videoRef.current;
    const currentUrl = effectiveUrl;

    // State auto-resets when URL changes (via derived computation above)
    retryCountRef.current = 0;

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
        // Generous timeouts: on a 403 wall the hls-proxy CHEAPLY refreshes the
        // upstream token server-side (player-page refetch ~1-3 s) and answers
        // with a 302 to the fresh playlist — hls.js follows transparently.
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 0,
        levelLoadingTimeOut: 12000,
        levelLoadingMaxRetry: 1,
        fragLoadingTimeOut: 8000,
        fragLoadingMaxRetry: 1,
      });

      hls.loadSource(currentUrl);
      hls.attachMedia(video);

      // Watchdog: if manifest not parsed within 11s, force-try next channel.
      // (Token self-healing inside the proxy can legitimately take ~3-6 s.)
      let manifestParsed = false;
      let hlsDestroyed = false;
      const watchdog = setTimeout(() => {
        if (!manifestParsed && !hlsDestroyed) {
          console.log('[VideoPlayer] Watchdog: 11s timeout, trying next channel');
          if (tryNextChannel()) return;
        }
      }, 11000);
      watchdogRef.current = watchdog;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        manifestParsed = true;
        if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
        setReadyUrl(currentUrl);
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          // Don't retry network errors — the stream-proxy returns 502 immediately for 403/Cloudflare,
          // and retrying just wastes time. Fall back to next channel instantly.
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[VideoPlayer] Fatal network error, falling back (no retry)');
              if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
              if (tryNextChannel()) return;
              setErrorInfo({ url: currentUrl, msg: t(language, 'player.streamUnavailable') });
              hlsDestroyed = true;
              hls.destroy();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Recover media error once
              if (retryCountRef.current < 1) {
                retryCountRef.current += 1;
                hls.recoverMediaError();
              } else {
                if (tryNextChannel()) return;
                setErrorInfo({ url: currentUrl, msg: t(language, 'player.playbackError') });
                hlsDestroyed = true;
                hls.destroy();
              }
              break;
            default:
              if (tryNextChannel()) return;
              setErrorInfo({ url: currentUrl, msg: t(language, 'player.playbackError') });
              hlsDestroyed = true;
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = currentUrl;
      const onLoaded = () => {
        setReadyUrl(currentUrl);
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      };
      const onError = () => {
        if (tryNextChannel()) return;
        setErrorInfo({ url: currentUrl, msg: t(language, 'player.streamUnavailableShort') });
      };
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);
    } else {
      if (!tryNextChannel()) {
        queueMicrotask(() => {
          setErrorInfo({ url: currentUrl, msg: t(language, 'player.hlsNotSupported') });
        });
      }
    }

    return () => {
      if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playerVisible, effectiveUrl, isHls, tryNextChannel, language]);

  // Lock body scroll when player is open
  useEffect(() => {
    if (playerVisible) {
      document.body.style.overflow = 'hidden';
      currentAltIndexRef.current = 0;
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [playerVisible]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleRetry = () => {
    retryCountRef.current = 0;
    setReadyUrl('');
    setErrorInfo(null);
    setResolvedUrl(null);
    setIframeError(false);
    setIframeTimedOut(false);
  };

  const handleSwitchChannel = (channel: { url: string; name: string; logo?: string }) => {
    retryCountRef.current = 0;
    openPlayer(channel.url, channel.name, channel.logo || undefined);
  };

  /** Manually try to resolve the current iframe URL to a direct m3u8 stream */
  const handleTryResolve = async () => {
    if (!playerStreamUrl || isResolving) return;
    setIframeError(false);
    setIframeTimedOut(false);
    setIsResolving(true);
    try {
      const res = await fetch('/api/resolve-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playerStreamUrl }),
      });
      const data = await res.json();
      if (data.resolved && data.type === 'hls' && data.resolvedUrl) {
        setResolvedUrl(data.resolvedUrl);
      }
    } catch(_e) {
      // Silently fail
    } finally {
      setIsResolving(false);
    }
  };

  if (!playerVisible) return null;

  const hasAlternatives = playerAlternatives && playerAlternatives.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
      {/* Header */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 pb-8 transition-opacity duration-300 ${showControls || isIframe ? 'opacity-100' : 'opacity-0'}`}
        onMouseMove={hideControlsAfterDelay}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={closePlayer}
            className="text-white/90 hover:bg-white/15 h-9 w-9 rounded-xl"
          >
            <X className="h-5 w-5" />
          </Button>
          {playerChannelLogo && (
            <img
              src={playerChannelLogo}
              alt=""
              className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-sm truncate">{playerChannelName}</h2>
            {isResolving && (
              <span className="text-amber-400/70 text-[10px] flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {t(language, 'player.resolvingStream')}
              </span>
            )}
            {!isResolving && isIframe && (
              <span className="text-emerald-400/60 text-[10px] flex items-center gap-1">
                <Wifi className="h-2.5 w-2.5" />
                {t(language, 'player.live')}
              </span>
            )}
          </div>
          {hasAlternatives && (
            <span className="text-white/30 text-[10px] font-medium">
              +{playerAlternatives.length} {t(language, 'player.otherChannels', playerAlternatives.length)}
            </span>
          )}
        </div>
      </div>

      {/* Video / Iframe content */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center relative"
        onMouseMove={hideControlsAfterDelay}
        onClick={isHls ? togglePlay : undefined}
      >
        {isIframe ? (
          /* Iframe-based stream — DaddyLive (tiestep.top) embed proxied
           * through /api/proxy-stream (Referer: dlive.sx injected server-side,
           * <base> tag stripped, anti-iframe-bust scripts removed, stream.js
           * re-routed through our proxy to bypass the ES-module CORS block).
           *
           * NO sandbox attribute: DaddyLive's stream.js actively detects
           * `sandbox` on the iframe element and refuses to play ("Sandbox
           * not allowed"). We accept the trade-off — popunder ad scripts
           * (greatdexchange.com etc.) CAN run and may open new tabs on
           * user click — because the alternative is no video at all.
           * Popunders require a click trigger, so loading + autoplaying
           * the video doesn't trigger them. */
          <iframe
            src={iframeSrc}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            title={`${t(language, 'player.liveStream')}: ${playerChannelName}`}
            referrerPolicy="no-referrer"
            onError={() => {
              console.warn('[VideoPlayer] iframe onError triggered');
              setIframeError(true);
            }}
          />
        ) : (
          /* HLS video element */
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Loading Overlay - only for HLS */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white/80 animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 animate-ping opacity-20" />
              </div>
              <div className="text-center">
                <p className="text-white text-sm font-semibold">{t(language, 'player.loadingStream')}</p>
                <p className="text-white/50 text-xs mt-1">{playerChannelName}</p>
                <p className="text-white/30 text-[10px] mt-2">{t(language, 'player.autoNextChannel')}</p>
                {playerAlternatives && playerAlternatives.length > 0 && (
                  <p className="text-emerald-400/60 text-[10px] mt-1">
                    Test de {playerAlternatives.length} autre{playerAlternatives.length > 1 ? 's' : ''} chaîne{playerAlternatives.length > 1 ? 's' : ''} en arrière-plan…
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Overlay (HLS & general errors) */}
        {streamError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-4">
            <div className="flex flex-col items-center gap-5 text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Tv className="h-8 w-8 text-red-400/80" />
              </div>
              <div>
                <p className="text-white font-bold text-base mb-1">{t(language, 'player.channelUnavailable')}</p>
                <p className="text-white/50 text-sm">{streamError}</p>
                <p className="text-white/25 text-xs mt-2">
                  {t(language, 'player.iptvUnstable')}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button onClick={handleRetry} className="bg-white/8 hover:bg-white/15 text-white gap-2 rounded-xl h-10">
                  <RefreshCw className="h-4 w-4" />
                  {t(language, 'player.retry')}
                </Button>

                {hasAlternatives && (
                  <div className="mt-2">
                    <p className="text-white/40 text-xs mb-2 font-medium">{t(language, 'player.otherChannelsLabel')}</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {playerAlternatives.map((ch, idx) => (
                        <button
                          key={`${ch.url}-${idx}`}
                          onClick={() => handleSwitchChannel(ch)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left"
                        >
                          {ch.logo ? (
                            <img
                              src={ch.logo}
                              alt=""
                              className="w-7 h-7 rounded-lg object-contain shrink-0 bg-white/5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                              <Tv className="h-3.5 w-3.5 text-white/40" />
                            </div>
                          )}
                          <span className="text-white text-sm truncate flex-1">{ch.name}</span>
                          <SkipForward className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button variant="outline" onClick={closePlayer} className="mt-1 border-white/10 text-white/60 hover:bg-white/5 rounded-xl h-10">
                  {t(language, 'player.back')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Iframe Error Overlay */}
        {iframeError && !streamError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-4">
            <div className="flex flex-col items-center gap-5 text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Tv className="h-8 w-8 text-red-400/80" />
              </div>
              <div>
                <p className="text-white font-bold text-base mb-1">{t(language, 'player.channelUnavailable')}</p>
                <p className="text-white/50 text-sm">{t(language, 'player.iframeError')}</p>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button onClick={handleRetry} className="bg-white/8 hover:bg-white/15 text-white gap-2 rounded-xl h-10">
                  <RefreshCw className="h-4 w-4" />
                  {t(language, 'player.retry')}
                </Button>

                <Button
                  onClick={handleTryResolve}
                  disabled={isResolving}
                  className="bg-white/8 hover:bg-white/15 text-white gap-2 rounded-xl h-10"
                >
                  {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  {t(language, 'player.tryDirectStream')}
                </Button>

                {hasAlternatives && (
                  <div className="mt-2">
                    <p className="text-white/40 text-xs mb-2 font-medium">{t(language, 'player.otherChannelsLabel')}</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {playerAlternatives.map((ch, idx) => (
                        <button
                          key={`err-${ch.url}-${idx}`}
                          onClick={() => handleSwitchChannel(ch)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left"
                        >
                          {ch.logo ? (
                            <img
                              src={ch.logo}
                              alt=""
                              className="w-7 h-7 rounded-lg object-contain shrink-0 bg-white/5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                              <Tv className="h-3.5 w-3.5 text-white/40" />
                            </div>
                          )}
                          <span className="text-white text-sm truncate flex-1">{ch.name}</span>
                          <SkipForward className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button variant="outline" onClick={closePlayer} className="mt-1 border-white/10 text-white/60 hover:bg-white/5 rounded-xl h-10">
                  {t(language, 'player.back')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Iframe Timeout Warning (non-blocking, appears at bottom) */}
        {iframeTimedOut && !iframeError && !streamError && isIframe && (
          <div className="absolute bottom-16 left-4 right-4 z-20 max-w-md mx-auto animate-fade-in">
            <div className="bg-amber-900/60 backdrop-blur-xl border border-amber-500/20 rounded-xl p-3">
              <p className="text-amber-200 text-xs font-medium mb-2.5">
                {t(language, 'player.iframeLoadTimeout')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleTryResolve}
                  disabled={isResolving}
                  className="bg-amber-700/40 hover:bg-amber-600/40 text-amber-100 gap-1.5 text-xs h-8 rounded-lg"
                >
                  {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                  {t(language, 'player.tryDirectStream')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleRetry}
                  className="bg-white/5 hover:bg-white/10 text-white/60 gap-1.5 text-xs h-8 rounded-lg"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t(language, 'player.retry')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Play/Pause Center Overlay - only for HLS */}
        {!isIframe && !isLoading && !streamError && (
          <div
            className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="text-white hover:bg-white/15 h-16 w-16 rounded-2xl"
            >
              {isPlaying ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10" />}
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Controls - only for HLS streams */}
      {isHls && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-8 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
          onMouseMove={hideControlsAfterDelay}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white/90 hover:bg-white/15 h-9 w-9 rounded-xl"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white/90 hover:bg-white/15 h-9 w-9 rounded-xl"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <span className="text-white/40 text-xs ml-2 font-medium truncate max-w-[200px]">{playerChannelName}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white/90 hover:bg-white/15 h-9 w-9 rounded-xl"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
