'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Radio, Loader2, Zap, Shield, Tv, Play, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface KoraStreamResult {
  name: string;
  url: string;
  lang: string;
  langFlag: string;
  source: string;
}

interface HesGoalStreamResult {
  url: string;
  type: 'm3u8' | 'iframe';
  matchId: string;
  cached?: boolean;
  note?: string;
}

interface StreamOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  homeTeam: string;
  awayTeam: string;
  competition: string | null;
  sport: 'football' | 'basketball';
  /** Optional: hes-goal match ID if we already have it */
  hesgoalMatchId?: string | null;
}

export default function StreamOptions({
  isOpen,
  onClose,
  homeTeam,
  awayTeam,
  competition,
  sport,
  hesgoalMatchId,
}: StreamOptionsProps) {
  const { language, openPlayer } = useAppStore();
  const [koraStreams, setKoraStreams] = useState<KoraStreamResult[]>([]);
  const [hesgoalStream, setHesgoalStream] = useState<HesGoalStreamResult | null>(null);
  const [hesgoalLoading, setHesgoalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [playingHesgoal, setPlayingHesgoal] = useState(false);
  const [autoPlayAttempted, setAutoPlayAttempted] = useState(false);

  // Fetch hesgoal stream URL (direct playable stream)
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setHesgoalLoading(true);

    const fetchHesgoalStream = async () => {
      try {
        // First try to find the match on HesGoal if we don't have the ID
        let matchId = hesgoalMatchId;

        if (!matchId) {
          // Search for the match in today's HesGoal data
          const res = await fetch('/api/hesgoal', {
            signal: AbortSignal.timeout(8000),
          });

          if (res.ok && !cancelled) {
            const data = await res.json();
            const matches = data.matches || [];

            // Find the matching match by team names
            const homeLower = homeTeam.toLowerCase();
            const awayLower = awayTeam.toLowerCase();

            const found = matches.find((m: { homeTeam: string; awayTeam: string; hasStream: boolean }) => {
              const mHome = m.homeTeam.toLowerCase();
              const mAway = m.awayTeam.toLowerCase();
              // Fuzzy match: check if key words from team names appear
              const homeWords = homeLower.split(/\s+/).filter((w: string) => w.length > 3);
              const awayWords = awayLower.split(/\s+/).filter((w: string) => w.length > 3);
              const homeMatch = homeWords.some((w: string) => mHome.includes(w)) || mHome.includes(homeLower) || homeLower.includes(mHome);
              const awayMatch = awayWords.some((w: string) => mAway.includes(w)) || mAway.includes(awayLower) || awayLower.includes(mAway);
              return homeMatch && awayMatch && m.hasStream;
            });

            if (found) {
              matchId = found.id;
            }
          }
        }

        if (!matchId || cancelled) {
          if (!cancelled) setHesgoalLoading(false);
          return;
        }

        // Now resolve the stream URL
        const streamRes = await fetch(`/api/hesgoal-stream?id=${matchId}`, {
          signal: AbortSignal.timeout(15000),
        });

        if (streamRes.ok && !cancelled) {
          const streamData = await streamRes.json();
          if (streamData.url) {
            setHesgoalStream(streamData);
          }
        }
      } catch(_e) {
        // Silently fail
      } finally {
        if (!cancelled) {
          setHesgoalLoading(false);
        }
      }
    };

    fetchHesgoalStream();
    return () => { cancelled = true; };
  }, [isOpen, homeTeam, awayTeam, hesgoalMatchId]);

  // Fetch kora-api streams
  useEffect(() => {
    if (!isOpen || searchDone) return;

    let cancelled = false;
    setLoading(true);

    const fetchStreams = async () => {
      try {
        const res = await fetch('/api/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeTeam,
            awayTeam,
            competition,
            sport,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (data.streams && data.streams.length > 0 && !cancelled) {
          setKoraStreams(data.streams);
        }
      } catch(_e) {
        // Silently fail
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSearchDone(true);
        }
      }
    };

    fetchStreams();
    return () => { cancelled = true; };
  }, [isOpen, homeTeam, awayTeam, competition, sport, searchDone]);

  // Auto-play: When hesgoal stream is found, automatically start playing it
  useEffect(() => {
    if (!isOpen || autoPlayAttempted) return;
    if (hesgoalStream && !hesgoalLoading) {
      setAutoPlayAttempted(true);
      handlePlayHesgoalStream();
    }
  }, [isOpen, hesgoalStream, hesgoalLoading, autoPlayAttempted]);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setSearchDone(false);
      setKoraStreams([]);
      setHesgoalStream(null);
      setPlayingHesgoal(false);
      setAutoPlayAttempted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePlayDirectStream = (url: string, name: string) => {
    if (url.includes('.m3u8') || url.includes('m3u8')) {
      // Direct HLS stream — play in our video player
      openPlayer(url, name);
      onClose();
    } else if (url.startsWith('/api/proxy-stream')) {
      // Already proxied URL — play in our video player as iframe
      openPlayer(url, name);
      onClose();
    } else {
      // Any other URL — route through our proxy to bypass iframe restrictions
      try {
        const encoded = btoa(url);
        const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(encoded)}`;
        openPlayer(proxyUrl, name);
        onClose();
      } catch(_e) {
        // If proxy fails, show error (no external redirect)
      }
    }
  };

  const handlePlayHesgoalStream = () => {
    if (!hesgoalStream) return;
    setPlayingHesgoal(true);

    const streamName = `HesGoal — ${homeTeam} vs ${awayTeam}`;

    if (hesgoalStream.type === 'm3u8') {
      // Direct HLS stream — play in our video player
      openPlayer(hesgoalStream.url, streamName);
      onClose();
    } else if (hesgoalStream.url.startsWith('/api/proxy-stream')) {
      // Already proxied URL — play in our video player as iframe
      openPlayer(hesgoalStream.url, streamName);
      onClose();
    } else {
      // Try proxying the embed URL to play in-app
      try {
        const encoded = btoa(hesgoalStream.url);
        const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(encoded)}`;
        openPlayer(proxyUrl, streamName);
        onClose();
      } catch(_e) {
        // If proxy fails, do nothing (no external redirect)
      }
    }

    setPlayingHesgoal(false);
  };

  const hasAnyStream = hesgoalStream || koraStreams.length > 0;
  const isSearching = hesgoalLoading || loading;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in">
      <div className="bg-card border border-border/30 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border/20 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Radio className="h-5 w-5 text-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-sm">{t(language, 'stream.watchLive')}</h2>
              <p className="text-[11px] text-muted-foreground/50 truncate max-w-[240px]">
                {homeTeam} vs {awayTeam}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-secondary/50">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <Shield className="h-3.5 w-3.5 text-amber-500/70 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-500/60 leading-relaxed">
              {t(language, 'stream.disclaimer')}
            </p>
          </div>

          {/* HesGoal Direct Stream — TOP PRIORITY when available */}
          {(hesgoalStream || hesgoalLoading) && (
            <div>
              <h3 className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Tv className="h-3 w-3" />
                {t(language, 'stream.hesgoalLive')}
              </h3>
              {hesgoalLoading ? (
                <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  <span className="text-[11px] text-emerald-500/60">{t(language, 'stream.resolvingStream')}</span>
                </div>
              ) : hesgoalStream ? (
                <button
                  onClick={handlePlayHesgoalStream}
                  disabled={playingHesgoal}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    {playingHesgoal ? (
                      <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
                    ) : (
                      <Play className="h-5 w-5 text-emerald-500 fill-current" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-400">HesGoal Live</span>
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-bold text-emerald-500">HD</span>
                      </span>
                      {hesgoalStream.type === 'm3u8' && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-[8px] font-bold text-blue-400">HLS</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 truncate">
                      {hesgoalStream.type === 'm3u8'
                        ? t(language, 'stream.directPlayback')
                        : t(language, 'stream.embedPlayback')}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-emerald-500/20 shrink-0" />
                </button>
              ) : null}
            </div>
          )}

          {/* Kora/Rojadirecta API streams — SECONDARY option */}
          {(koraStreams.length > 0 || loading) && (
            <div>
              <h3 className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-2.5">
                {t(language, 'stream.directStreams')}
              </h3>
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/20">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                  <span className="text-[11px] text-muted-foreground/40">{t(language, 'stream.searchingStreams')}</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {koraStreams.map((stream, idx) => (
                    <button
                      key={`kora-${idx}`}
                      onClick={() => handlePlayDirectStream(stream.url, `${stream.langFlag} ${stream.name}`)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-secondary/40 dark:hover:bg-white/[0.03] transition-colors duration-200 text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/8 flex items-center justify-center shrink-0">
                        {stream.source === 'rojadirecta' ? (
                          <Radio className="h-3.5 w-3.5 text-orange-500" />
                        ) : (
                          <Zap className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{stream.langFlag}</span>
                          <span className="text-xs font-medium truncate">{stream.name}</span>
                          {stream.source === 'rojadirecta' ? (
                            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-500/8">
                              <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                              <span className="text-[7px] font-bold text-orange-500">LIVE</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-500/8">
                              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[7px] font-bold text-emerald-600">{t(language, 'channels.direct')}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <Play className="h-3 w-3 text-muted-foreground/20 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No streams found state */}
          {!isSearching && !hasAnyStream && searchDone && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-xl bg-secondary/30 dark:bg-white/[0.02] flex items-center justify-center mx-auto mb-3">
                <Radio className="h-6 w-6 text-muted-foreground/20" />
              </div>
              <p className="text-sm text-muted-foreground/40 font-medium">{t(language, 'stream.noStreamsFound') || 'No streams available'}</p>
              <p className="text-[11px] text-muted-foreground/25 mt-1">
                {t(language, 'stream.tryAgainLater') || 'Streams may become available closer to kickoff'}
              </p>
            </div>
          )}

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
