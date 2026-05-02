'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Globe, Radio, Loader2, Zap, Shield } from 'lucide-react';
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

interface StreamOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  homeTeam: string;
  awayTeam: string;
  competition: string | null;
  sport: 'football' | 'basketball';
}

export default function StreamOptions({
  isOpen,
  onClose,
  homeTeam,
  awayTeam,
  competition,
  sport,
}: StreamOptionsProps) {
  const { language, openPlayer } = useAppStore();
  const [koraStreams, setKoraStreams] = useState<KoraStreamResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  // Build external streaming site URLs
  const matchQuery = encodeURIComponent(`${homeTeam} vs ${awayTeam} ${competition || ''} live stream`);

  const externalSources: StreamSource[] = [
    {
      name: 'SportStream',
      url: `https://us-sport.eu/?s=${matchQuery}`,
      icon: <Zap className="h-4 w-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10 hover:bg-green-500/20',
      borderColor: 'border-green-500/30',
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
      } catch {
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

          {/* External streaming sites - PRIMARY option */}
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

          {/* Kora/Rojadirecta API streams - SECONDARY option */}
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
