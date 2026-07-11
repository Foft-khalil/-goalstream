'use client';

import Hls from 'hls.js';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Loader2, RefreshCw, Tv, SkipForward, ExternalLink, Globe } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

type StreamStatus = 'loading' | 'ready' | 'error';

/**
 * Determine if a URL is an HLS stream (can be played with video element + hls.js)
 * vs an iframe embed URL (needs to be shown in an iframe)
 */
function isHlsUrl(url: string): boolean {
  return url.includes('.m3u8') || url.includes('m3u8');
}

/**
 * Check if a URL is a kora-api/embed-style stream that needs proxying.
 * These are URLs from providers like streams.center that contain nested iframes
 * and won't work directly in a sandboxed iframe.
 */
function needsProxy(url: string): boolean {
  const proxyDomains = [
    'streams.center',
    'kora-api.top',
    '000007.mov',
    'streamcenter.pro',
    'tvtvhd.com',
    'go4score.app',
    'smartagro.mov',
    'hes-goal.eu',
    'goalz.zip',
  ];
  return proxyDomains.some(domain => url.includes(domain));
}

/**
 * Convert a direct stream URL to our proxy URL.
 * This allows embed-style streams to work in our iframe by serving
 * them from our own domain (same method used by us-sport.eu).
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

/** External site URLs for fallback viewing */
const SPORTSTREAM_URL = 'https://us-sport.eu';
const ROJADIRECTA_URL = 'https://tarjetarojaenvivo.cx';
const HESGOAL_URL = 'https://hes-goal.eu';

export default function VideoPlayer() {
  // language is used for i18n throughout this component
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
  // Don't block initial render — show iframe immediately while resolving
  useEffect(() => {
    if (!playerVisible || !playerStreamUrl) return;
    // Only try resolving if it's an iframe URL (not already HLS)
    if (isHlsUrl(playerStreamUrl)) return;
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

  // Iframe timeout: show warning if iframe hasn't loaded after 15 seconds
  useEffect(() => {
    if (!isIframe || !playerVisible || !effectiveUrl) return;

    setIframeError(false);
    setIframeTimedOut(false);

    iframeTimerRef.current = setTimeout(() => {
      setIframeTimedOut(true);
    }, 15000);

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
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 1,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 1,
        fragLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 1,
      });

      hls.loadSource(currentUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setReadyUrl(currentUrl);
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCountRef.current < 1) {
                retryCountRef.current += 1;
                hls.startLoad();
              } else {
                if (tryNextChannel()) return;
                setErrorInfo({ url: currentUrl, msg: t(language, 'player.streamUnavailable') });
                hls.destroy();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              if (tryNextChannel()) return;
              setErrorInfo({ url: currentUrl, msg: t(language, 'player.playbackError') });
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
      // Silently fail — user can still use iframe or external sites
    } finally {
      setIsResolving(false);
    }
  };

  /** Render external site fallback buttons (HesGoal, SportStream & RojaDirecta) */
  const renderExternalSiteButtons = () => (
    <div className="flex flex-col gap-1.5 w-full max-w-xs mt-2">
      <p className="text-white/50 text-xs mb-1">{t(language, 'player.watchElsewhere')}</p>
      <a
        href={HESGOAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/15 rounded-lg transition-colors text-left"
      >
        <Tv className="h-4 w-4 text-green-400 shrink-0" />
        <span className="text-white text-sm truncate flex-1">HesGoal</span>
        <ExternalLink className="h-3.5 w-3.5 text-white/40 shrink-0" />
      </a>
      <a
        href={SPORTSTREAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/15 rounded-lg transition-colors text-left"
      >
        <Globe className="h-4 w-4 text-blue-400 shrink-0" />
        <span className="text-white text-sm truncate flex-1">SportStream</span>
        <ExternalLink className="h-3.5 w-3.5 text-white/40 shrink-0" />
      </a>
      <a
        href={ROJADIRECTA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/15 rounded-lg transition-colors text-left"
      >
        <Globe className="h-4 w-4 text-red-400 shrink-0" />
        <span className="text-white text-sm truncate flex-1">RojaDirecta</span>
        <ExternalLink className="h-3.5 w-3.5 text-white/40 shrink-0" />
      </a>
    </div>
  );

  if (!playerVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls || isIframe ? 'opacity-100' : 'opacity-0'}`}
        onMouseMove={hideControlsAfterDelay}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={closePlayer}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
          {playerChannelLogo && (
            <img
              src={playerChannelLogo}
              alt=""
              className="w-8 h-8 rounded object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <h2 className="text-white font-semibold text-lg truncate">{playerChannelName}</h2>
          {isIframe && !isResolving && (
            <span className="text-green-400/80 text-xs ml-2 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {t(language, 'player.live')}
            </span>
          )}
          {isResolving && (
            <span className="text-amber-400/80 text-xs ml-2 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t(language, 'player.resolvingStream')}
            </span>
          )}
          {playerAlternatives && playerAlternatives.length > 0 && (
            <span className="text-white/40 text-xs ml-auto">
              {t(language, 'player.otherChannels', playerAlternatives.length)}
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
          /* Iframe-based stream (e.g. from kora-api via proxy) */
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 text-white animate-spin" />
              <p className="text-white/80 text-sm">{t(language, 'player.loadingStream')}</p>
              <p className="text-white/40 text-xs">{t(language, 'player.autoNextChannel')}</p>
            </div>
          </div>
        )}

        {/* Error Overlay (HLS & general errors) */}
        {streamError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <Tv className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg mb-1">{t(language, 'player.channelUnavailable')}</p>
                <p className="text-white/60 text-sm">{streamError}</p>
                <p className="text-white/40 text-xs mt-2">
                  {t(language, 'player.iptvUnstable')}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button onClick={handleRetry} className="bg-white/10 hover:bg-white/20 text-white gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {t(language, 'player.retry')}
                </Button>

                {playerAlternatives && playerAlternatives.length > 0 && (
                  <div className="mt-2">
                    <p className="text-white/50 text-xs mb-2">{t(language, 'player.otherChannelsLabel')}</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {playerAlternatives.map((ch, idx) => (
                        <button
                          key={`${ch.url}-${idx}`}
                          onClick={() => handleSwitchChannel(ch)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/15 rounded-lg transition-colors text-left"
                        >
                          {ch.logo ? (
                            <img
                              src={ch.logo}
                              alt=""
                              className="w-6 h-6 rounded object-contain shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center shrink-0">
                              <Tv className="h-3 w-3 text-white/50" />
                            </div>
                          )}
                          <span className="text-white text-sm truncate flex-1">{ch.name}</span>
                          <SkipForward className="h-3.5 w-3.5 text-white/40 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* External site buttons */}
                {renderExternalSiteButtons()}

                <Button variant="outline" onClick={closePlayer} className="mt-1 border-white/20 text-white hover:bg-white/10">
                  {t(language, 'player.back')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Iframe Error Overlay */}
        {iframeError && !streamError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <Tv className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg mb-1">{t(language, 'player.channelUnavailable')}</p>
                <p className="text-white/60 text-sm">{t(language, 'player.iframeError')}</p>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button onClick={handleRetry} className="bg-white/10 hover:bg-white/20 text-white gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {t(language, 'player.retry')}
                </Button>

                <Button
                  onClick={handleTryResolve}
                  disabled={isResolving}
                  className="bg-white/10 hover:bg-white/20 text-white gap-2"
                >
                  {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  {t(language, 'player.tryDirectStream')}
                </Button>

                {playerAlternatives && playerAlternatives.length > 0 && (
                  <div className="mt-2">
                    <p className="text-white/50 text-xs mb-2">{t(language, 'player.otherChannelsLabel')}</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {playerAlternatives.map((ch, idx) => (
                        <button
                          key={`err-${ch.url}-${idx}`}
                          onClick={() => handleSwitchChannel(ch)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/15 rounded-lg transition-colors text-left"
                        >
                          {ch.logo ? (
                            <img
                              src={ch.logo}
                              alt=""
                              className="w-6 h-6 rounded object-contain shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center shrink-0">
                              <Tv className="h-3 w-3 text-white/50" />
                            </div>
                          )}
                          <span className="text-white text-sm truncate flex-1">{ch.name}</span>
                          <SkipForward className="h-3.5 w-3.5 text-white/40 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* External site buttons */}
                {renderExternalSiteButtons()}

                <Button variant="outline" onClick={closePlayer} className="mt-1 border-white/20 text-white hover:bg-white/10">
                  {t(language, 'player.back')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Iframe Timeout Warning (non-blocking, appears at bottom) */}
        {iframeTimedOut && !iframeError && !streamError && isIframe && (
          <div className="absolute bottom-16 left-4 right-4 z-20 max-w-md mx-auto">
            <div className="bg-amber-900/80 backdrop-blur-sm border border-amber-500/30 rounded-lg p-3">
              <p className="text-amber-200 text-sm font-medium mb-2">
                {t(language, 'player.iframeLoadTimeout')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleTryResolve}
                  disabled={isResolving}
                  className="bg-amber-700/60 hover:bg-amber-600/60 text-amber-100 gap-1.5 text-xs h-8"
                >
                  {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                  {t(language, 'player.tryDirectStream')}
                </Button>
                <a
                  href={HESGOAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="bg-green-700/60 hover:bg-green-600/60 text-green-100 gap-1.5 text-xs h-8">
                    <ExternalLink className="h-3 w-3" />
                    HesGoal
                  </Button>
                </a>
                <a
                  href={SPORTSTREAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="bg-amber-700/60 hover:bg-amber-600/60 text-amber-100 gap-1.5 text-xs h-8">
                    <ExternalLink className="h-3 w-3" />
                    SportStream
                  </Button>
                </a>
                <a
                  href={ROJADIRECTA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="bg-amber-700/60 hover:bg-amber-600/60 text-amber-100 gap-1.5 text-xs h-8">
                    <ExternalLink className="h-3 w-3" />
                    RojaDirecta
                  </Button>
                </a>
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
              className="text-white hover:bg-white/20 h-16 w-16"
            >
              {isPlaying ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10" />}
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Controls - only for HLS streams */}
      {isHls && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
          onMouseMove={hideControlsAfterDelay}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
