'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Tv, Clock, Loader2, Radio } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useState } from 'react';

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
  const [findingStream, setFindingStream] = useState(false);
  const [foundChannels, setFoundChannels] = useState<Array<{ name: string; url: string; logo: string; group: string; relevance: number }> | null>(null);
  const [showChannels, setShowChannels] = useState(false);

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
      openPlayer(match.streamUrl, match.channelName || `${match.homeTeam} vs ${match.awayTeam}`, match.channelLogo || undefined);
      return;
    }
    // Find channels for this match
    findAndShowChannels();
  };

  const findAndShowChannels = async () => {
    if (findingStream) return;
    setFindingStream(true);
    setShowChannels(true);
    try {
      const res = await fetch('/api/match-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competition,
        }),
      });

      if (!res.ok) throw new Error('Failed to find channels');
      const data = await res.json();
      setFoundChannels(data.channels || []);
    } catch (err) {
      console.error('Error finding channels:', err);
      setFoundChannels([]);
    } finally {
      setFindingStream(false);
    }
  };

  const handleSelectChannel = (channel: { name: string; url: string; logo: string }) => {
    openPlayer(channel.url, channel.name, channel.logo || undefined);
    setShowChannels(false);
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

        {/* Date & Watch Button */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <span className="text-xs text-muted-foreground">{dateStr}</span>

          <Button
            size="sm"
            onClick={handleWatch}
            disabled={findingStream}
            className={`h-7 gap-1.5 text-xs text-white ${
              match.status === 'live'
                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {findingStream ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Recherche...
              </>
            ) : match.status === 'live' ? (
              <>
                <Radio className="h-3 w-3 fill-current" />
                Regarder en direct
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current" />
                Regarder
              </>
            )}
          </Button>
        </div>

        {/* Channel Selector - shown when searching for streams */}
        {showChannels && (
          <div className="mt-3 pt-3 border-t border-border/30">
            {findingStream ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Recherche de canaux de diffusion...</span>
              </div>
            ) : foundChannels && foundChannels.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                  <Tv className="h-3 w-3" />
                  Canaux disponibles ({foundChannels.length})
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {foundChannels.map((channel, idx) => (
                    <button
                      key={`${channel.name}-${idx}`}
                      onClick={() => handleSelectChannel(channel)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/50 hover:bg-muted/80 border border-border/30 transition-colors text-left"
                    >
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt=""
                          className="w-6 h-6 rounded object-contain shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                          <Tv className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate block">{channel.name}</span>
                        {channel.group && (
                          <span className="text-[10px] text-muted-foreground truncate block">{channel.group}</span>
                        )}
                      </div>
                      <Play className="h-3 w-3 text-green-500 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : foundChannels && foundChannels.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Tv className="h-3.5 w-3.5" />
                <span>Aucun canal de diffusion trouvé pour ce match</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Channel Info (if already assigned) */}
        {match.channelName && match.streamUrl && !showChannels && (
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
