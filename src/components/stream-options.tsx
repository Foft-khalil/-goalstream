'use client';

import { useState, useEffect } from 'react';
import { X, Tv, Loader2, Radio, Info, ShieldCheck, Play } from 'lucide-react';
import { useAppStore } from '@/lib/store';

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
  eventTime?: string | null;
  source?: string;
  type?: string;
}

/** Strip emojis/flags & trailing time from a DaddyLive event title
 *  (e.g. "⚽ 🇺🇸 USL Super League : Tampa Bay Sun 🇺🇸 vs Fort Lauderdale United 🇺🇸 22:00"
 *  → "USL Super League : Tampa Bay Sun vs Fort Lauderdale United"). */
function cleanEventName(name: string): string {
  return (name || '')
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0E}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\d{1,2}:\d{2}\s*$/, '')
    .trim();
}

/**
 * StreamOptions — « Regarder » panel with CLEAN IN-APP PLAYBACK (Task 24).
 *
 * Every channel returned by /api/daddylive is a same-origin /api/hls-proxy
 * URL resolved server-side from the raw HLS playlist. Clicking a channel
 * hands it to the global VideoPlayer (hls.js) — the ad-infested DaddyLive
 * pages are NEVER loaded by the browser, so no ad pages/popups can appear,
 * and every listed channel was validated against its live playlist seconds
 * earlier (no dead channels) and is attached to THIS exact fixture in the
 * DaddyLive schedule (no wrong match).
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
  const { openPlayer } = useAppStore();
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

    fetch(`/api/daddylive?${params.toString()}`, { signal: AbortSignal.timeout(30000) })
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

  /** Play this channel in the global clean player, with the other channels
   *  as auto-failover alternatives (all pre-validated HLS proxy URLs). */
  const handlePlayChannel = (ch: StreamChannel) => {
    const others = channels
      .filter((c) => c.url !== ch.url)
      .map((c) => ({ name: c.name, url: c.url, logo: c.channelLogo || '' }));
    // Close this panel first — the global player sits at a lower z-index and
    // must be the top-most layer once playback starts.
    onClose();
    openPlayer(ch.url, ch.name, ch.channelLogo || undefined, others);
  };

  // ─── Channel selection panel ─────────────────────────────────────────────
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
            <button
              onClick={onClose}
              className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-secondary flex items-center justify-center"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 max-h-[55vh] goalstream-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="h-7 w-7 text-emerald-400 animate-spin mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Recherche des chaînes qui diffusent ce match…</p>
              <p className="text-[11px] text-muted-foreground/40 mt-1">Vérification des flux en direct</p>
            </div>
          )}

          {!loading && loaded && channels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mb-3">
                <Tv className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold">Aucune chaîne ne diffuse ce match pour le moment</p>
              <p className="text-xs text-muted-foreground/50 mt-1.5">
                Aucune chaîne dédiée à ce match n&apos;a été trouvée dans le programme
                DaddyLive. Réessayez au coup d&apos;envoi ou pendant la rencontre — la liste
                se met à jour automatiquement.
              </p>
            </div>
          )}

          {!loading && channels.length > 0 && (
            <div className="space-y-2">
              {/* Section label */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
                  <Radio className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Chaînes TV · {channels.length} disponible{channels.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/15 to-transparent" />
              </div>

              {/* Dedicated-match confirmation — these channels broadcast THIS fixture,
                  straight from DaddyLive's per-event schedule (never generic channels) */}
              {cleanEventName(channels[0]?.eventName || '') && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 mb-3">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-snug text-emerald-100/80 dark:text-emerald-200/80">
                    Chaînes qui diffusent <span className="font-semibold text-emerald-600 dark:text-emerald-300">ce match</span>
                    {' '}(programme DaddyLive{channels[0]?.eventTime ? ` · ${channels[0].eventTime} heure UK` : ''}) :
                    <span className="block text-emerald-700/50 dark:text-emerald-100/50 mt-0.5 truncate">{cleanEventName(channels[0].eventName)}</span>
                  </p>
                </div>
              )}

              {channels.map((ch) => (
                <button
                  key={`${ch.name}-${ch.url}`}
                  onClick={() => handlePlayChannel(ch)}
                  className="group flex items-center gap-3 w-full p-3 text-left rounded-2xl bg-secondary/30 dark:bg-white/[0.03] border border-border/40 dark:border-white/[0.06] hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.04] transition-all duration-200 cursor-pointer"
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
                      Diffuse ce match en direct
                      {ch.group ? ` · ${ch.group}` : ''}
                    </p>
                  </div>

                  {/* Action — plays IN-APP via dlive.sx iframe (user's IP matches token) */}
                  <div className="shrink-0 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20 group-hover:bg-red-500 transition-colors">
                      <Play className="h-3.5 w-3.5 text-white fill-current" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="shrink-0 px-5 py-3.5 border-t border-border/40 dark:border-white/[0.06] bg-secondary/20">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-snug text-muted-foreground/60">
              La chaîne se lance <span className="font-semibold text-muted-foreground">directement dans l&apos;application</span> — sans publicité, sans renvoi vers un autre site.
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <ShieldCheck className="h-3 w-3 text-emerald-400/60" />
            <span className="text-[10px] text-muted-foreground/40">
              Flux testés à la seconde · seules les chaînes diffusant ce match sont listées
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
