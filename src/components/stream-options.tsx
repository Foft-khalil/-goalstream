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
  lang: string;
  langFlag: string;
  source: string;
}

interface StreamsApiResponse {
  streams: StreamResult[];
  matchId: number | null;
  matchName: string | null;
  isLive: boolean;
  isExactMatch?: boolean;
  isCompetitionMatch?: boolean;
  source: string;
  error?: string;
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
      broadcasters.push({ name: 'Paramount+', url: 'https://www.paramountplus.com/', icon: '📺' });
    }
    if (comp.includes('premier') || comp.includes('eng.1')) {
      broadcasters.push({ name: 'Sky Sports', url: 'https://www.skysports.com/', icon: '📺' });
      broadcasters.push({ name: 'Peacock (NBC)', url: 'https://www.peacocktv.com/', icon: '📺' });
    }
    if (comp.includes('la liga') || comp.includes('esp.1')) {
      broadcasters.push({ name: 'ESPN+', url: 'https://www.espn.com/espnplus/', icon: '📺' });
      broadcasters.push({ name: 'beIN Sports', url: 'https://www.beinsports.com/fr/', icon: '📺' });
    }
    if (comp.includes('serie a') || comp.includes('ita.1')) {
      broadcasters.push({ name: 'DAZN (Serie A)', url: 'https://www.dazn.com/', icon: '📺' });
    }
    if (comp.includes('bundesliga') || comp.includes('ger.1')) {
      broadcasters.push({ name: 'ESPN+', url: 'https://www.espn.com/espnplus/', icon: '📺' });
    }
    if (comp.includes('mls') || comp.includes('usa.1')) {
      broadcasters.push({ name: 'MLS Season Pass (Apple TV)', url: 'https://tv.apple.com/channel/mls', icon: '📺' });
    }
    if (broadcasters.length === 0) {
      broadcasters.push({ name: 'DAZN', url: 'https://www.dazn.com/', icon: '📺' });
      broadcasters.push({ name: 'beIN Sports', url: 'https://www.beinsports.com/', icon: '📺' });
      broadcasters.push({ name: 'ESPN+', url: 'https://www.espn.com/espnplus/', icon: '📺' });
    }
  } else {
    if (comp.includes('nba')) {
      broadcasters.push({ name: 'NBA League Pass', url: 'https://www.nba.com/watch/league-pass', icon: '🏀' });
      broadcasters.push({ name: 'NBA TV', url: 'https://www.nba.com/watch/nba-tv', icon: '🏀' });
    }
    if (comp.includes('euroleague') || comp.includes('euroleague')) {
      broadcasters.push({ name: 'EuroLeague TV', url: 'https://www.euroleaguebasketball.net/euroleague/watch/', icon: '🏀' });
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
  const [streams, setStreams] = useState<StreamResult[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ name: string | null; isExactMatch: boolean; isLive: boolean }>({
    name: null,
    isExactMatch: false,
    isLive: false,
  });

  const fetchStreams = useCallback(async () => {
    if (!isOpen) return;

    setLoading(true);
    setApiError(null);
    setStreams([]);

    try {
      const res = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam,
          awayTeam,
          competition: competition || '',
          sport,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data: StreamsApiResponse = await res.json();

      if (data.error) {
        setApiError(data.error);
      }

      setStreams(data.streams || []);
      setMatchInfo({
        name: data.matchName,
        isExactMatch: data.isExactMatch || false,
        isLive: data.isLive || false,
      });
    } catch (err: any) {
      console.error('[StreamOptions] Error fetching streams:', err);
      setApiError(err.message || 'Failed to fetch streams');
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, homeTeam, awayTeam, competition, sport]);

  useEffect(() => {
    if (isOpen) {
      fetchStreams();
    }
  }, [isOpen, fetchStreams]);

  if (!isOpen) return null;

  const broadcasters = getOfficialBroadcasters(competition, sport);
  const year = new Date().getFullYear();

  // YouTube search URLs
  const youtubeLiveQuery = encodeURIComponent(`${homeTeam} vs ${awayTeam} ${competition || ''} live ${year}`);
  const youtubeLiveUrl = `https://www.youtube.com/results?search_query=${youtubeLiveQuery}`;

  /**
   * Play a stream - either in-app video player (m3u8) or via proxy (embed)
   * The VideoPlayer component handles proxying internally via getProxiedUrl()
   */
  const handlePlayStream = (stream: StreamResult) => {
    const url = stream.url;

    if (isM3u8Url(url)) {
      // Direct m3u8 stream - play in-app
      openPlayer(url, stream.name, undefined);
    } else {
      // Embed URL - pass directly to video player; it will:
      // 1. Try resolve-stream to find m3u8 behind the embed
      // 2. Fall back to iframe with proxy if m3u8 can't be resolved
      // For unknown domains, open in new tab instead
      const knownStreamDomains = ['streams.center', 'streamcenter.pro', 'fltvhd.com', 'go4score.app', 'smartagro.mov', 'goalz.zip', 'futbolonlinehd.com', 'kora-api'];
      const isKnownDomain = knownStreamDomains.some(d => url.includes(d));

      if (isKnownDomain) {
        // Pass original URL - VideoPlayer handles proxying internally
        openPlayer(url, stream.name, undefined);
      } else {
        // Open in new tab
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  /**
   * Try to resolve a HesGoal stream for the match
   */
  const handleHesGoalStream = async () => {
    if (!matchId) return;

    try {
      const res = await fetch(`/api/hesgoal-stream?id=${matchId}`);
      if (!res.ok) throw new Error('Failed to resolve stream');
      const data = await res.json();

      if (data.url) {
        // Pass URL directly to video player - it handles proxying internally
        openPlayer(data.url, `HesGoal - ${homeTeam} vs ${awayTeam}`, undefined);
      }
    } catch (err) {
      console.error('[StreamOptions] Error resolving HesGoal stream:', err);
    }
  };

  // Separate streams by type for display ordering
  const m3u8Streams = streams.filter(s => isM3u8Url(s.url));
  const embedStreams = streams.filter(s => !isM3u8Url(s.url));

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
          {/* Free Streams from kora-api / rojadirecta — TOP PRIORITY */}
          {!loading && streams.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Flux gratuits en direct
                {matchInfo.isExactMatch && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-bold">MATCH EXACT</span>
                )}
              </h3>
              <div className="space-y-1.5">
                {/* M3U8 streams first (playable in-app) */}
                {m3u8Streams.map((stream, idx) => (
                  <button
                    key={`m3u8-${idx}`}
                    onClick={() => handlePlayStream(stream)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/20 transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Play className="h-5 w-5 text-emerald-500 fill-emerald-500" />
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
                        <span className="text-[10px] text-muted-foreground/40">{stream.langFlag} {stream.lang}</span>
                        <span className="text-[10px] text-emerald-500/50">• Lecture directe</span>
                      </div>
                    </div>
                    <Play className="h-4 w-4 text-emerald-500/40 shrink-0" />
                  </button>
                ))}

                {/* Embed streams (open via proxy or new tab) */}
                {embedStreams.map((stream, idx) => (
                  <button
                    key={`embed-${idx}`}
                    onClick={() => handlePlayStream(stream)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-500/8 border border-emerald-500/10 transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Tv className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-emerald-400">{stream.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/40">{stream.langFlag} {stream.lang}</span>
                        <span className="text-[10px] text-emerald-500/30">• via {stream.source}</span>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-emerald-500/20 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500/40" />
              <p className="text-xs text-muted-foreground/40">Recherche de flux en cours...</p>
            </div>
          )}

          {/* No streams found */}
          {!loading && streams.length === 0 && !apiError && (
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

          {/* HesGoal direct link (for football matches with matchId) */}
          {sport === 'football' && matchId && (
            <div>
              <h3 className="text-[10px] font-bold text-blue-500/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                HesGoal
              </h3>
              <button
                onClick={handleHesGoalStream}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-blue-500/8 border border-blue-500/10 transition-all duration-200 active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Globe className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className="text-sm font-semibold text-blue-400">Regarder sur HesGoal</span>
                  <p className="text-[10px] text-muted-foreground/30 truncate">Résolution automatique du flux</p>
                </div>
                <Play className="h-3.5 w-3.5 text-blue-500/20 shrink-0" />
              </button>
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
                    <p className="text-[10px] text-muted-foreground/25 truncate">
                      Diffusion officielle
                    </p>
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
              {t(language, 'stream.disclaimer') || 'Les flux peuvent ne pas être disponibles dans toutes les régions. Utilisez des sources officielles pour la meilleure qualité.'}
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
