'use client';

import Hls from 'hls.js';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

export default function VideoPlayer() {
  const { playerVisible, playerStreamUrl, playerChannelName, playerChannelLogo, closePlayer } =
    useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Derive loading/error state from stream URL changes
  const [streamState, setStreamState] = useState<{ url: string; status: 'loading' | 'ready' | 'error'; errorMsg?: string }>({
    url: '',
    status: 'loading',
  });

  const isLoading = playerVisible && playerStreamUrl && streamState.url === playerStreamUrl && streamState.status === 'loading';
  const error = playerVisible && playerStreamUrl && streamState.url === playerStreamUrl && streamState.status === 'error' ? streamState.errorMsg : null;

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  // Setup HLS player when stream URL changes
  useEffect(() => {
    if (!playerVisible || !videoRef.current || !playerStreamUrl) return;

    const video = videoRef.current;

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
      });

      hls.loadSource(playerStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStreamState({ url: playerStreamUrl, status: 'ready' });
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setStreamState({ url: playerStreamUrl, status: 'error', errorMsg: 'Network error - stream may be offline' });
              hls.destroy();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setStreamState({ url: playerStreamUrl, status: 'error', errorMsg: 'Media error - trying to recover...' });
              hls.recoverMediaError();
              break;
            default:
              setStreamState({ url: playerStreamUrl, status: 'error', errorMsg: 'Stream error - cannot play this channel' });
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playerStreamUrl;
      video.addEventListener('loadedmetadata', () => {
        setStreamState({ url: playerStreamUrl, status: 'ready' });
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      });
    } else {
      // HLS not supported - schedule state update via callback to avoid effect sync setState
      queueMicrotask(() => {
        setStreamState({ url: playerStreamUrl, status: 'error', errorMsg: 'HLS is not supported in this browser' });
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playerVisible, playerStreamUrl]);

  // Lock body scroll when player is open
  useEffect(() => {
    if (playerVisible) {
      document.body.style.overflow = 'hidden';
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
              <p className="text-white/80 text-sm">Loading stream...</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-3 text-center p-4">
              <div className="text-red-400 text-4xl">&#9888;</div>
              <p className="text-white font-medium">{error}</p>
              <p className="text-white/60 text-sm">This channel may be offline or unavailable</p>
              <Button variant="outline" onClick={closePlayer} className="mt-2">
                Go Back
              </Button>
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
