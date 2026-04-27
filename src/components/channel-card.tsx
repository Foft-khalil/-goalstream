'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Wifi, WifiOff, Globe } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface ChannelCardProps {
  channel: {
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
    country: string;
  };
}

export default function ChannelCard({ channel }: ChannelCardProps) {
  const { openPlayer } = useAppStore();

  const handleWatch = () => {
    openPlayer(channel.url, channel.name, channel.logo || undefined);
  };

  return (
    <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm hover:bg-card transition-all group">
      <div className="flex items-center gap-3 p-3">
        {/* Logo */}
        <div className="shrink-0">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-12 h-12 rounded-lg object-contain bg-muted/50 p-1 group-hover:scale-105 transition-transform"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xs font-bold ${channel.logo ? 'hidden' : ''}`}
          >
            <Tv2Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{channel.name}</h3>
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
          </div>
        </div>

        {/* Watch Button */}
        <Button
          size="sm"
          onClick={handleWatch}
          className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700 text-white shrink-0"
        >
          <Play className="h-3 w-3 fill-current" />
          Watch
        </Button>
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
