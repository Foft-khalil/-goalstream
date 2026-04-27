'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Tv, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface MatchCardProps {
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeLogo: string | null;
    awayLogo: string | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    competition: string | null;
    matchDate: string | null;
    streamUrl?: string | null;
    channelName?: string | null;
    channelLogo?: string | null;
    minute?: number | null;
  };
}

export default function MatchCard({ match }: MatchCardProps) {
  const { openPlayer } = useAppStore();

  const statusConfig: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; pulse: boolean }> = {
    live: { label: 'LIVE', variant: 'destructive', pulse: true },
    upcoming: { label: 'À VENIR', variant: 'secondary', pulse: false },
    finished: { label: 'TERMINÉ', variant: 'outline', pulse: false },
  };

  const config = statusConfig[match.status] || statusConfig.upcoming;
  const matchDate = match.matchDate ? new Date(match.matchDate) : null;
  const timeStr = matchDate ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const dateStr = matchDate ? matchDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : '';

  const handleWatch = () => {
    if (match.streamUrl) {
      openPlayer(match.streamUrl, match.channelName || match.homeTeam + ' vs ' + match.awayTeam, match.channelLogo || undefined);
    }
  };

  return (
    <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm hover:bg-card transition-colors">
      {/* Competition & Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/30">
        <span className="text-xs text-muted-foreground font-medium truncate">
          {match.competition || 'Amical'}
        </span>
        <div className="flex items-center gap-1.5">
          {match.status === 'live' && match.minute != null && (
            <span className="text-[10px] text-red-400 font-semibold tabular-nums">
              {match.minute}&apos;
            </span>
          )}
          <Badge
            variant={config.variant}
            className={`text-[10px] px-2 py-0 h-5 font-bold ${config.pulse ? 'animate-pulse' : ''}`}
          >
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Teams & Score */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Home Team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {match.homeLogo ? (
              <img
                src={match.homeLogo}
                alt={match.homeTeam}
                className="w-10 h-10 rounded-full object-contain bg-muted/50 p-1 shrink-0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                {match.homeTeam.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-sm truncate">{match.homeTeam}</span>
          </div>

          {/* Score / Time */}
          <div className="flex flex-col items-center shrink-0 px-2">
            {match.status === 'live' || match.status === 'finished' ? (
              <div className="text-xl font-bold tabular-nums">
                <span className={match.status === 'live' ? 'text-destructive' : ''}>
                  {match.homeScore ?? 0}
                </span>
                <span className="text-muted-foreground mx-1">-</span>
                <span className={match.status === 'live' ? 'text-destructive' : ''}>
                  {match.awayScore ?? 0}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Clock className="h-4 w-4 text-muted-foreground mb-0.5" />
                <span className="text-sm font-semibold">{timeStr}</span>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="font-semibold text-sm truncate">{match.awayTeam}</span>
            {match.awayLogo ? (
              <img
                src={match.awayLogo}
                alt={match.awayTeam}
                className="w-10 h-10 rounded-full object-contain bg-muted/50 p-1 shrink-0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                {match.awayTeam.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Date & Stream Info */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <span className="text-xs text-muted-foreground">{dateStr}</span>

          {match.streamUrl ? (
            <Button
              size="sm"
              onClick={handleWatch}
              className="h-7 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
            >
              <Play className="h-3 w-3 fill-current" />
              Regarder
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Tv className="h-3 w-3" />
              Pas de flux
            </span>
          )}
        </div>

        {/* Channel Info */}
        {match.channelName && match.streamUrl && (
          <div className="flex items-center gap-2 mt-2">
            {match.channelLogo && (
              <img
                src={match.channelLogo}
                alt=""
                className="w-4 h-4 rounded object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <span className="text-xs text-muted-foreground">{match.channelName}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
