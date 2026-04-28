'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
          // Stream is offline - show visual feedback
          const { channels } = useAppStore.getState();
          useAppStore.setState({
            channels: channels.map((ch) =>
              ch.url === channel.url ? { ...ch, status: 'offline' as const } : ch
            ),
          });
        }
      }
    } catch {
      // If check fails, try playing anyway
      handleWatch();
    } finally {
      setTesting(false);
    }
  };

  // Status indicator
  const statusConfig = {
    online: { color: 'bg-green-500', icon: <Wifi className="h-3 w-3 text-green-500" />, label: 'Online' },
    offline: { color: 'bg-red-500', icon: <WifiOff className="h-3 w-3 text-red-400" />, label: 'Offline' },
    checking: { color: 'bg-yellow-500 animate-pulse', icon: <Loader2 className="h-3 w-3 text-yellow-400 animate-spin" />, label: 'Checking...' },
    unknown: { color: 'bg-gray-500', icon: null, label: 'Non testé' },
  };

  const status = channel.status || 'unknown';
  const config = statusConfig[status];
  const isOffline = status === 'offline';

  return (
    <Card className={`overflow-hidden border-border/50 backdrop-blur-sm hover:bg-card transition-all group ${isOffline ? 'bg-card/40 opacity-60' : 'bg-card/80'}`}>
      <div className="flex items-center gap-3 p-3">
        {/* Logo */}
        <div className="shrink-0 relative">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className={`w-12 h-12 rounded-lg object-contain bg-muted/50 p-1 group-hover:scale-105 transition-transform ${isOffline ? 'grayscale' : ''}`}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xs font-bold ${channel.logo ? 'hidden' : ''} ${isOffline ? 'grayscale' : ''}`}
          >
            <Tv2Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          {/* Status dot */}
          <div
            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${config.color}`}
            title={config.label}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className={`font-semibold text-sm truncate ${isOffline ? 'line-through decoration-red-400/50' : ''}`}>
              {channel.name}
            </h3>
            {config.icon}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {channel.group && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {channel.group}
              </Badge>
            )}
            {channel.country && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Globe className="h-2.5 w-2.5" />
                {channel.country.toUpperCase()}
              </span>
            )}
            {isOffline && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                Hors ligne
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleChannelFavorite({ name: channel.name, logo: channel.logo, url: channel.url, group: channel.group });
            }}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors"
            title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart className={`h-4 w-4 transition-colors ${isFav ? 'fill-green-500 text-green-500' : 'text-muted-foreground/40 hover:text-green-500'}`} />
          </button>
          {isOffline ? (
            <Button
              size="sm"
              onClick={handleQuickTest}
              disabled={testing}
              variant="outline"
              className="h-8 gap-1 text-xs shrink-0 border-red-400/30 text-red-400 hover:bg-red-500/10"
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wifi className="h-3 w-3" />
              )}
              {testing ? 'Test...' : 'Retester'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleWatch}
              className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700 text-white shrink-0"
            >
              <Play className="h-3 w-3 fill-current" />
              Regarder
            </Button>
          )}
        </div>
      </div>
    </Card>
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
