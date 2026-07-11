'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Globe, Radio, Loader2, Zap, Shield, Tv, Play } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface StreamSource {
  name: string;
  url: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  priority: number; // Lower = shown first
}

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

  // Build external streaming site URLs
  const matchQuery = encodeURIComponent(`${homeTeam} vs ${awayTeam} ${competition || ''} live stream`);

  const externalSources: StreamSource[] = [
    {
      name: 'HesGoal',
      url: `https://hes-goal.eu/`,
      icon: <Tv className="h-4 w-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10 hover:bg-green-500/20',
      borderColor: 'border-green-500/30',
      description: t(language, 'stream.hesgoalDesc'),
      priority: 0, // Highest priority
    },
    {
      name: 'SportStream',
      url: `https://us-sport.eu/?s=${matchQuery}`,
      icon: <Zap className="h-4 w-4" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      description: t(language, 'stream.sportStreamDesc'),
      priority: 1,
    },
    {
      name: 'RojaDirecta',
      url: 'https://tarjetarojaenvivo.cx',
      icon: <Radio className="h-4 w-4" />,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10 hover:bg-red-500/20',
      borderColor: 'border-red-500/30',
      description: t(language, 'stream.rojaDirectaDesc'),
      priority: 2,
    },
  ];

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
        // Silently fail — external sites are still available
      } finally {
        if (!cancelled) {
          setHesgoalLoading(false);
        }
      }
    };

    fetchHesgoalStream();
    return () => { cancelled = true; };
  }, [isOpen, homeTeam, awayTeam, hesgoalMatchId]);

  // Fetch kora-api streams (these might have direct stream page URLs)
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
        // Silently fail — external sites are the primary option
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

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setSearchDone(false);
      setKoraStreams([]);
      setHesgoalStream(null);
      setPlayingHesgoal(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePlayDirectStream = (url: string, name: string) => {
    // Only try embedding if it's a direct m3u8 URL
    if (url.includes('.m3u8') || url.includes('m3u8')) {
      openPlayer(url, name);
      onClose();
    } else {
      // For non-HLS URLs, open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
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
      // Proxied embed URL — play in our video player as iframe
      openPlayer(hesgoalStream.url, streamName);
      onClose();
    } else {
      // External URL — open in new tab
      window.open(hesgoalStream.url, '_blank', 'noopener,noreferrer');
    }

    setPlayingHesgoal(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-card border border-border/40 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border/30 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Radio className="h-5 w-5 text-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-base">{t(language, 'stream.watchLive')}</h2>
              <p className="text-xs text-muted-foreground/70 truncate max-w-[240px]">
                {homeTeam} vs {awayTeam}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <Shield className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-500/80 leading-relaxed">
              {t(language, 'stream.disclaimer')}
            </p>
          </div>

          {/* HesGoal Direct Stream — TOP PRIORITY when available */}
          {(hesgoalStream || hesgoalLoading) && (
            <div>
              <h3 className="text-xs font-semibold text-green-500/80 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Tv className="h-3.5 w-3.5" />
                {t(language, 'stream.hesgoalLive')}
              </h3>
              {hesgoalLoading ? (
                <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-green-500/5 border border-green-500/20">
                  <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                  <span className="text-xs text-green-500/70">{t(language, 'stream.resolvingStream')}</span>
                </div>
              ) : hesgoalStream ? (
                <button
                  onClick={handlePlayHesgoalStream}
                  disabled={playingHesgoal}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                    {playingHesgoal ? (
                      <Loader2 className="h-5 w-5 text-green-500 animate-spin" />
                    ) : (
                      <Play className="h-5 w-5 text-green-500 fill-current" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-green-400">HesGoal Live</span>
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/15">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[8px] font-bold text-green-500">HD</span>
                      </span>
                      {hesgoalStream.type === 'm3u8' && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-[8px] font-bold text-blue-400">HLS</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 truncate">
                      {hesgoalStream.type === 'm3u8'
                        ? t(language, 'stream.directPlayback')
                        : t(language, 'stream.embedPlayback')}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-green-500/30 shrink-0" />
                </button>
              ) : null}
            </div>
          )}

          {/* External streaming sites — SECONDARY option */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2.5">
              {t(language, 'stream.streamingSites')}
            </h3>
            <div className="space-y-2">
              {externalSources.map((source) => (
                <button
                  key={source.name}
                  onClick={() => handleOpenLink(source.url)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${source.bgColor} border ${source.borderColor} transition-all active:scale-[0.98]`}
                >
                  <div className={`w-9 h-9 rounded-lg ${source.bgColor} flex items-center justify-center ${source.color} shrink-0`}>
                    {source.icon}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${source.color}`}>{source.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 truncate">{source.description}</p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Kora/Rojadirecta API streams — TERTIARY option */}
          {(koraStreams.length > 0 || loading) && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2.5">
                {t(language, 'stream.directStreams')}
              </h3>
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/30">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground/50">{t(language, 'stream.searchingStreams')}</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {koraStreams.map((stream, idx) => (
                    <button
                      key={`kora-${idx}`}
                      onClick={() => handlePlayDirectStream(stream.url, `${stream.langFlag} ${stream.name}`)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center shrink-0">
                        {stream.source === 'rojadirecta' ? (
                          <Radio className="h-3.5 w-3.5 text-orange-500" />
                        ) : (
                          <Globe className="h-3.5 w-3.5 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{stream.langFlag}</span>
                          <span className="text-xs font-medium truncate">{stream.name}</span>
                          {stream.source === 'rojadirecta' ? (
                            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-500/10">
                              <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                              <span className="text-[7px] font-bold text-orange-500">LIVE</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-green-500/10">
                              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-[7px] font-bold text-green-600">{t(language, 'channels.direct')}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Match info */}
          <div className="px-3 py-2.5 rounded-lg bg-muted/20 border border-border/10">
            <p className="text-[10px] text-muted-foreground/40 text-center">
              {competition || t(language, 'match.friendly')} • {homeTeam} vs {awayTeam}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
