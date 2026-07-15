'use client';

import { useState } from 'react';
import { Play, Wifi, WifiOff, Globe, Loader2, AlertTriangle, Heart } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useFavorites } from '@/hooks/use-favorites';

interface ChannelCardProps {
  channel: {
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
    country: string;
    status?: 'online' | 'offline' | 'checking' | 'unknown';
  };
}

export default function ChannelCard({ channel }: ChannelCardProps) {
  const { openPlayer } = useAppStore();
  const { toggleChannelFavorite, isChannelFavorite } = useFavorites();
  const [testing, setTesting] = useState(false);
  const isFav = isChannelFavorite(channel.url);

  const handleWatch = () => {
    openPlayer(channel.url, channel.name, channel.logo || undefined);
  };

  const handleQuickTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTesting(true);
    try {
      const res = await fetch('/api/channels-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [channel.url] }),
      });
      if (res.ok) {
        const data = await res.json();
        const result = data[0];
        if (result?.status === 'online') {
          handleWatch();
        } else {
          const { channels } = useAppStore.getState();
          useAppStore.setState({
            channels: channels.map((ch) =>
              ch.url === channel.url ? { ...ch, status: 'offline' as const } : ch
            ),
          });
        }
      }
    } catch (_e) {
      handleWatch();
    } finally {
      setTesting(false);
    }
  };

  const status = channel.status || 'unknown';
  const isOffline = status === 'offline';
  const isChecking = status === 'checking';
  const isOnline = status === 'online';

  // Status dot configuration with glow colors
  const statusDotStyles: Record<string, string> = {
    online: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]',
    offline: 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.3)]',
    checking: 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.4)] animate-pulse',
    unknown: 'bg-white/15',
  };

  const statusIconMap: Record<string, React.ReactNode> = {
    online: <Wifi className="h-3 w-3 text-emerald-400" />,
    offline: <WifiOff className="h-3 w-3 text-red-400/60" />,
    checking: <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />,
    unknown: null,
  };

  const statusLabelMap: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    checking: 'Checking...',
    unknown: 'Non testé',
  };

  return (
    <div
      className={`
        group relative rounded-2xl transition-premium cursor-pointer
        bg-card dark:bg-white/[0.02] backdrop-blur-xl
        border border-border/40 dark:border-white/[0.04]
        hover:border-border dark:hover:border-white/[0.08] hover:-translate-y-0.5
        ${isOnline ? 'hover:shadow-[0_8px_24px_-8px_rgba(16,185,129,0.12)]' : 'hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)]'}
        ${isOffline ? 'opacity-45' : ''}
        ${isChecking ? 'shimmer' : ''}
      `}
      onClick={handleWatch}
    >
      {/* Emerald top-line accent for online channels */}
      {isOnline && (
        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
      )}

      <div className="flex items-center gap-3.5 p-3.5">
        {/* Logo */}
        <div className="relative shrink-0">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className={`
                w-11 h-11 rounded-xl object-contain bg-secondary/30 dark:bg-white/[0.03] p-1
                transition-transform duration-300 group-hover:scale-105
                ${isOffline ? 'grayscale' : ''}
              `}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`
              w-11 h-11 rounded-xl bg-secondary/30 dark:bg-white/[0.03] flex items-center justify-center
              ${channel.logo ? 'hidden' : ''}
              ${isOffline ? 'grayscale' : ''}
            `}
          >
            <Tv2Icon className="h-5 w-5 text-muted-foreground/30" />
          </div>

          {/* Status dot with glow */}
          <div
            className={`
              absolute -top-1 -right-1 w-3 h-3 rounded-full
              border-2 border-[hsl(var(--background))]
              ${statusDotStyles[status]}
            `}
            title={statusLabelMap[status]}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3
              className={`
                font-semibold text-[13px] truncate text-foreground
                ${isOffline ? 'line-through decoration-red-400/20' : ''}
              `}
            >
              {channel.name}
            </h3>
            {statusIconMap[status]}
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {channel.group && (
              <span className="
                inline-flex items-center rounded-md
                bg-secondary/50 dark:bg-white/[0.04] px-1.5 py-0.5
                text-[9px] font-medium text-muted-foreground/40
                border border-border/20 dark:border-white/[0.03]
              ">
                {channel.group}
              </span>
            )}
            {channel.country && (
              <span className="text-[9px] text-muted-foreground/30 flex items-center gap-0.5">
                <Globe className="h-2.5 w-2.5" />
                {channel.country.toUpperCase()}
              </span>
            )}
            {isOnline && (
              <span className="
                inline-flex items-center gap-0.5 rounded-md
                bg-emerald-400/8 px-1.5 py-0.5
                text-[9px] font-semibold text-emerald-400
                border border-emerald-400/8
              ">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
            {isOffline && (
              <span className="
                inline-flex items-center gap-0.5 rounded-md
                bg-red-400/8 px-1.5 py-0.5
                text-[9px] font-medium text-red-400/60
                border border-red-400/8
              ">
                <AlertTriangle className="h-2.5 w-2.5" />
                Hors ligne
              </span>
            )}
            {isChecking && (
              <span className="
                inline-flex items-center gap-0.5 rounded-md
                bg-amber-400/8 px-1.5 py-0.5
                text-[9px] font-medium text-amber-400
                border border-amber-400/8
              ">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Vérification
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Favorite button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleChannelFavorite({ name: channel.name, logo: channel.logo, url: channel.url, group: channel.group });
            }}
            className="
              h-8 w-8 flex items-center justify-center rounded-xl
              hover:bg-secondary/50 dark:hover:bg-white/[0.04] transition-all duration-200
            "
            title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart
              className={`
                h-3.5 w-3.5 transition-all duration-200
                ${isFav
                  ? 'fill-emerald-400 text-emerald-400 scale-110'
                  : 'text-white/15 hover:text-emerald-400/60 hover:scale-105'
                }
              `}
            />
          </button>

          {/* Play / Retry button */}
          {isOffline ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickTest(e);
              }}
              disabled={testing}
              className="
                h-8 px-2.5 gap-1 text-[10px] shrink-0
                inline-flex items-center justify-center rounded-xl font-medium
                border border-red-400/15 bg-red-400/5 text-red-400/60
                hover:bg-red-400/10 hover:border-red-400/25
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wifi className="h-3 w-3" />
              )}
              {testing ? '...' : 'Retry'}
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleWatch();
              }}
              className="
                h-8 px-3 gap-1.5 text-[11px] shrink-0
                inline-flex items-center justify-center rounded-xl font-semibold
                bg-gradient-to-r from-emerald-500 to-emerald-400
                text-white
                shadow-md shadow-emerald-500/20
                hover:shadow-emerald-500/35 hover:brightness-110
                active:scale-95
                transition-all duration-200
              "
            >
              <Play className="h-3 w-3 fill-current" />
              Watch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Tv2Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="15" x="2" y="7" rx="2" ry="2"/>
      <polyline points="17 2 12 7 7 2"/>
    </svg>
  );
}
