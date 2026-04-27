'use client';

import Hls from 'hls.js';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Loader2, RefreshCw, Tv, SkipForward } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

type StreamStatus = 'loading' | 'ready' | 'error';

export default function VideoPlayer() {
  const { playerVisible, playerStreamUrl, playerChannelName, playerChannelLogo, playerAlternatives, closePlayer, openPlayer } =
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

  // Compute derived state - auto-reset when URL changes
  const streamReady = readyUrl === playerStreamUrl && !!playerStreamUrl;
  const streamError = errorInfo?.url === playerStreamUrl ? errorInfo.msg : null;
  const isLoading = playerVisible && !!playerStreamUrl && !streamReady && !streamError;

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

  // Reset state when URL changes - use a key approach instead of setState in effect
  const streamKey = useMemo(() => playerStreamUrl, [playerStreamUrl]);

  // Setup HLS player
  useEffect(() => {
    if (!playerVisible || !videoRef.current || !playerStreamUrl) return;

    const video = videoRef.current;
    const currentUrl = playerStreamUrl;

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
                setErrorInfo({ url: currentUrl, msg: 'Flux indisponible — chaîne probablement hors ligne' });
                hls.destroy();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              if (tryNextChannel()) return;
              setErrorInfo({ url: currentUrl, msg: 'Erreur de lecture — ce flux ne peut pas être lu' });
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
        setErrorInfo({ url: currentUrl, msg: 'Flux indisponible' });
      };
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);
    } else {
      if (!tryNextChannel()) {
        queueMicrotask(() => {
          setErrorInfo({ url: currentUrl, msg: 'HLS non supporté par ce navigateur' });
        });
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playerVisible, streamKey, tryNextChannel]);

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
  };

  const handleSwitchChannel = (channel: { url: string; name: string; logo?: string }) => {
    retryCountRef.current = 0;
    openPlayer(channel.url, channel.name, channel.logo || undefined);
  };

  if (!playerVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
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
          {playerAlternatives && playerAlternatives.length > 0 && (
            <span className="text-white/40 text-xs ml-auto">
              +{playerAlternatives.length} autre{playerAlternatives.length > 1 ? 's' : ''} chaîne{playerAlternatives.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Video */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center relative"
        onMouseMove={hideControlsAfterDelay}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          onClick={(e) => e.stopPropagation()}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 text-white animate-spin" />
              <p className="text-white/80 text-sm">Chargement du flux...</p>
              <p className="text-white/40 text-xs">Si la chaîne ne charge pas, on essaie la suivante automatiquement</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <Tv className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg mb-1">Chaîne indisponible</p>
                <p className="text-white/60 text-sm">{error}</p>
                <p className="text-white/40 text-xs mt-2">
                  Les flux IPTV gratuits sont souvent instables.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button onClick={handleRetry} className="bg-white/10 hover:bg-white/20 text-white gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </Button>

                {playerAlternatives && playerAlternatives.length > 0 && (
                  <div className="mt-2">
                    <p className="text-white/50 text-xs mb-2">Autres chaînes :</p>
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

                <Button variant="outline" onClick={closePlayer} className="mt-1 border-white/20 text-white hover:bg-white/10">
                  Retour
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Play/Pause Center Overlay */}
        {!isLoading && !error && (
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

      {/* Bottom Controls */}
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
    </div>
  );
}
