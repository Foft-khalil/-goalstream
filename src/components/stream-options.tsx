'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Tv, Loader2, Radio, Info, ShieldCheck, ChevronLeft, Play, Wifi } from 'lucide-react';
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
  eventTime?: string | null;
  source?: string;
  type?: string;
}

type PlayerPhase = 'connecting' | 'ready' | 'stuck';

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
 * StreamOptions — « Regarder » panel with IN-APP PLAYBACK.
 *
 * Method: exactly what the reference sites (tarjetarojaenvivo.cx & co) do —
 * the DaddyLive stream page (dlive.sx/stream/stream-XXX.php) is embedded in an
 * iframe INSIDE the app. The chain then works natively, like on those sites:
 *   our iframe (referer = our origin, non-empty → passes the "Access Blocked" gate)
 *   └─ dlive.sx stream page (serves the real player, no X-Frame-Options)
 *      └─ hamis.romponalis.st/premiumtv/daddy4.php?id=X (referer = dlive.sx → 200)
 *         └─ Clappr player → m3u8 loaded client-side in the user's browser
 *
 * IMPORTANT: the iframe MUST keep a referrer (never "no-referrer") — DaddyLive
 * blocks requests without one. The sandbox blocks top-navigation and pop-ups
 * so the ad-heavy page can never hijack the app. NO external redirect: the
 * video plays inside this overlay.
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
  const [activeChannel, setActiveChannel] = useState<StreamChannel | null>(null);
  const [phase, setPhase] = useState<PlayerPhase>('connecting');
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearPhaseTimer = () => {
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  };

  // Reset player state when the panel closes — "adjust state during render"
  // pattern (documented alternative to setState-in-effect). Timer cleanup is
  // handled by the watchdog effect below.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (!isOpen) {
      setActiveChannel(null);
      setPhase('connecting');
    }
  }

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

    fetch(`/api/daddylive?${params.toString()}`, { signal: AbortSignal.timeout(25000) })
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

  // Player stuck-watchdog: if the stream page never even loads within 25 s,
  // show the "try another channel" hint. (Timer = external system; the phase
  // itself is set from the click handler / iframe onLoad.)
  useEffect(() => {
    if (!activeChannel) {
      clearPhaseTimer();
      return;
    }
    phaseTimerRef.current = setTimeout(() => setPhase('stuck'), 25000);
    return clearPhaseTimer;
  }, [activeChannel]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeChannel) setActiveChannel(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, activeChannel]);

  if (!isOpen) return null;

  // ─── In-app player layer ─────────────────────────────────────────────────
  if (activeChannel) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={`Lecture de ${activeChannel.name}`}>
        {/* Player header */}
        <div className="shrink-0 flex items-center gap-2 px-3 sm:px-4 h-14 bg-black border-b border-white/10 text-white">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActiveChannel(null)}
            className="h-9 gap-1.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white text-xs font-semibold"
          >
            <ChevronLeft className="h-4 w-4" />
            Chaînes
          </Button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-sm font-bold truncate flex items-center justify-center gap-2">
              <span className={`relative flex h-2 w-2 shrink-0 ${isLive ? '' : 'hidden'}`}>
                <span className="absolute inline-flex h-full w-full rounded-full opacity-60 bg-red-500 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              {activeChannel.name}
            </p>
            <p className="text-[10px] text-white/40 truncate">{homeTeam} vs {awayTeam}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-9 w-9 shrink-0 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Fermer le lecteur"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Video area — DaddyLive embed, played INSIDE the app (no redirect) */}
        <div className="flex-1 relative bg-black min-h-0">
          <iframe
            key={activeChannel.url}
            src={activeChannel.url}
            title={activeChannel.name}
            className="absolute inset-0 w-full h-full border-0"
            // Keep a referrer (our origin): DaddyLive blocks referer-less requests.
            referrerPolicy="origin"
            // Block the ad-heavy page from hijacking our tab or opening pop-ups,
            // while letting its own player scripts run on its own origin.
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              // Page loaded — give the inner player a moment, then drop the spinner
              if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
              phaseTimerRef.current = setTimeout(() => setPhase('ready'), 4000);
            }}
          />

          {/* Connecting overlay */}
          {phase !== 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 pointer-events-none">
              <Loader2 className="h-9 w-9 text-red-500 animate-spin mb-4" />
              <p className="text-sm font-semibold text-white/90">Connexion à {activeChannel.name}…</p>
              <p className="text-xs text-white/40 mt-1.5">Le flux démarre dans quelques secondes</p>
            </div>
          )}

          {/* Stuck hint — the stream may be offline; propose another channel */}
          {phase === 'stuck' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] sm:w-auto">
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur">
                <Wifi className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="text-xs text-white/70 flex-1 min-w-0">
                  Rien ne s&apos;affiche ? Cette chaîne est peut-être saturée — essayez-en une autre.
                </p>
                <Button
                  size="sm"
                  onClick={() => setActiveChannel(null)}
                  className="h-8 shrink-0 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  Changer
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Player footer */}
        <div className="shrink-0 px-4 py-2.5 bg-black border-t border-white/10 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-emerald-400/60" />
          <span className="text-[10px] text-white/35">
            Lecture intégrée dans l&apos;application · aucune redirection
          </span>
        </div>
      </div>
    );
  }

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
              <p className="text-[11px] text-muted-foreground/40 mt-1">Vérification des flux en cours</p>
            </div>
          )}

          {!loading && loaded && channels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mb-3">
                <Tv className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold">Aucune chaîne ne diffuse ce match pour le moment</p>
              <p className="text-xs text-muted-foreground/50 mt-1.5">
                Nous n&apos;affichons que des chaînes dédiées à ce match — jamais une chaîne
                qui diffuse un autre match. La liste se met à jour automatiquement : réessayez
                au coup d&apos;envoi ou pendant la rencontre.
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
                    Chaînes TV · {channels.length} vérifiée{channels.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/15 to-transparent" />
              </div>

              {/* Dedicated-match confirmation — these channels broadcast THIS fixture,
                  straight from DaddyLive's per-event schedule (never generic channels) */}
              {cleanEventName(channels[0]?.eventName || '') && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 mb-3">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-snug text-emerald-100/80">
                    Chaînes qui diffusent <span className="font-semibold text-emerald-300">ce match</span>
                    {' '}(programme vérifié{channels[0]?.eventTime ? ` · ${channels[0].eventTime} heure UK` : ''}) :
                    <span className="block text-emerald-100/50 mt-0.5 truncate">{cleanEventName(channels[0].eventName)}</span>
                  </p>
                </div>
              )}

              {channels.map((ch) => (
                <button
                  key={`${ch.name}-${ch.url}`}
                  onClick={() => {
                    setPhase('connecting');
                    setActiveChannel(ch);
                  }}
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

                  {/* Action — plays IN-APP */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/15 uppercase tracking-wider">
                      Vérifiée
                    </span>
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
              La chaîne se lance <span className="font-semibold text-muted-foreground">directement dans l&apos;application</span> — aucun renvoi vers un autre site.
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <ShieldCheck className="h-3 w-3 text-emerald-400/60" />
            <span className="text-[10px] text-muted-foreground/40">
              Flux vérifiés automatiquement · seules les chaînes diffusant ce match sont listées
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
