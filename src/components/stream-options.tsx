'use client';

import { useState, useEffect } from 'react';
import { X, Tv, Loader2, ExternalLink, Radio, Info, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface StreamOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  homeTeam: string;
  awayTeam: string;
  competition?: string | null;
  sport?: 'football' | 'basketball';
  matchId?: string;
  isLive?: boolean;
}

interface StreamChannel {
  name: string;
  url: string;
  channelLogo?: string | null;
  group?: string | null;
  eventName?: string | null;
  source?: string;
  type?: string;
}

/**
 * StreamOptions — "Regarder" panel used for matches that don't have a direct
 * kora watch link. It lists the REAL broadcaster channels covering the match
 * (DaddyLive: Sky Sports, TNT Sports, beIN, ESPN, Nova…). Each entry is a real
 * <a> link that opens the channel's player page in a NEW TAB — exactly how
 * tarjetarojaenvivo.cx / hes-goal.click redirect their users. No in-app
 * playback: those player pages handle their own referer/geo logic in a real
 * browser tab, which is the only reliable way to play them.
 */
export default function StreamOptions({
  isOpen,
  onClose,
  homeTeam,
  awayTeam,
  competition,
  sport = 'football',
  isLive = false,
}: StreamOptionsProps) {
  const { language } = useAppStore();
  const [result, setResult] = useState<{ key: string; channels: StreamChannel[] } | null>(null);

  const fetchKey = isOpen ? `${homeTeam}|${awayTeam}|${sport}|${isLive}|${competition || ''}` : '';
  const isFresh = !!result && result.key === fetchKey;
  const loading = isOpen && !isFresh;
  const channels = isFresh ? result!.channels : [];
  const loaded = isFresh;

  // Fetch channels when the panel opens (async — never synchronously during render)
  useEffect(() => {
    if (!isOpen) return;
    const key = `${homeTeam}|${awayTeam}|${sport}|${isLive}|${competition || ''}`;
    if (result?.key === key) return; // already fetched for this match
    let cancelled = false;

    const params = new URLSearchParams({
      homeTeam,
      awayTeam,
      sport,
      liveOnly: String(isLive),
    });
    if (competition) params.set('competition', competition);

    fetch(`/api/daddylive?${params.toString()}`, { signal: AbortSignal.timeout(20000) })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        const list: StreamChannel[] = (data.streams || []).filter((s: StreamChannel) => !!s.url);
        // Dedupe by channel name (keep the highest-score entry = first in list)
        const seen = new Set<string>();
        const deduped = list.filter((s) => {
          const k = (s.name || '').toLowerCase().trim();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setResult({ key, channels: deduped });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, channels: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, homeTeam, awayTeam, competition, sport, isLive]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chaînes pour ${homeTeam} vs ${awayTeam}`}
        className="relative w-full sm:max-w-md max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-background border border-border dark:border-white/[0.08] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border/40 dark:border-white/[0.06] bg-gradient-to-b from-red-500/[0.06] to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold flex items-center gap-2 tracking-tight">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${isLive ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLive ? 'bg-red-500' : 'bg-emerald-500'}`} />
                </span>
                {isLive ? 'Chaînes en direct' : 'Chaînes du match'}
              </h2>
              <p className="text-xs text-muted-foreground/60 mt-1 truncate">
                {homeTeam} vs {awayTeam}
                {competition ? ` · ${competition}` : ''}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-secondary"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 max-h-[55vh] goalstream-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="h-7 w-7 text-emerald-400 animate-spin mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Recherche des chaînes qui diffusent ce match…</p>
            </div>
          )}

          {!loading && loaded && channels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mb-3">
                <Tv className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold">Aucune chaîne trouvée pour ce match</p>
              <p className="text-xs text-muted-foreground/50 mt-1.5">
                {isLive
                  ? 'Réessayez dans quelques instants — les chaînes apparaissent au coup d\u2019envoi.'
                  : 'Les chaînes seront disponibles au coup d\u2019envoi du match.'}
              </p>
            </div>
          )}

          {!loading && channels.length > 0 && (
            <div className="space-y-2">
              {/* Section label */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
                  <Radio className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Chaînes TV · {channels.length} disponible{channels.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/15 to-transparent" />
              </div>

              {channels.map((ch) => (
                <a
                  key={`${ch.name}-${ch.url}`}
                  href={ch.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group flex items-center gap-3 w-full p-3 rounded-2xl bg-secondary/30 dark:bg-white/[0.03] border border-border/40 dark:border-white/[0.06] hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.04] transition-all duration-200"
                >
                  {/* Logo */}
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-background/80 dark:bg-white/[0.04] flex items-center justify-center overflow-hidden">
                    {ch.channelLogo ? (
                      <img
                        src={ch.channelLogo}
                        alt={ch.name}
                        className="w-8 h-8 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <Tv className="h-5 w-5 text-emerald-400/70" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{ch.name}</p>
                    <p className="text-[10px] text-muted-foreground/50 font-medium mt-0.5">
                      {ch.source === 'competition-fallback' ? 'Chaîne de la compétition' : 'Diffuseur officiel'}
                      {ch.group ? ` · ${ch.group}` : ''}
                    </p>
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/15 uppercase tracking-wider">
                      Disponible
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:bg-emerald-500 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="shrink-0 px-5 py-3.5 border-t border-border/40 dark:border-white/[0.06] bg-secondary/20">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-snug text-muted-foreground/60">
              La chaîne s&apos;ouvre dans un <span className="font-semibold text-muted-foreground">nouvel onglet</span> sur le lecteur officiel.
              Si rien ne s&apos;ouvre, autorisez les pop-ups pour ce site.
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <ShieldCheck className="h-3 w-3 text-emerald-400/60" />
            <span className="text-[10px] text-muted-foreground/40">
              Redirection vers les vraies chaînes qui diffusent le match — comme tarjetaroja / hesgoal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
