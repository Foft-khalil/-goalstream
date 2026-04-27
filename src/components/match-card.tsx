'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Tv, Clock, Loader2, Radio, ChevronRight } from 'lucide-react';
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

  const isLive = match.status === 'live';
  const matchDate = match.matchDate ? new Date(match.matchDate) : null;
  const timeStr = matchDate ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const handleWatch = () => {
    if (match.streamUrl) {
      openPlayer(match.streamUrl, match.channelName || `${match.homeTeam} vs ${match.awayTeam}`, match.channelLogo || undefined);
      return;
    }
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
    <div
      className={`group relative rounded-xl overflow-hidden transition-all duration-200 ${
        isLive
          ? 'bg-gradient-to-r from-red-950/30 via-card to-red-950/20 border border-red-500/20 shadow-lg shadow-red-500/5'
          : 'bg-card/80 border border-border/40 hover:border-border/70 hover:bg-card'
      }`}
    >
      <div className="px-4 py-3.5">
        {/* Top row: competition + time/status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-muted-foreground/60 font-medium">
            {match.competition || 'Amical'}
          </span>
          {isLive ? (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-bold text-red-500 tracking-wide">
                {match.minute != null ? `${match.minute}'` : 'LIVE'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground/40" />
              <span className="text-[11px] font-semibold text-muted-foreground">{timeStr}</span>
            </div>
          )}
        </div>

        {/* Teams row */}
        <div className="flex items-center gap-3">
          {/* Home team */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {match.homeLogo ? (
              <img
                src={match.homeLogo}
                alt={match.homeTeam}
                className="w-9 h-9 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-[11px] font-bold shrink-0">
                {match.homeTeam.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-sm truncate">{match.homeTeam}</span>
          </div>

          {/* Score or VS */}
          <div className="flex flex-col items-center shrink-0 px-1">
            {isLive ? (
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tabular-nums text-red-400">{match.homeScore ?? 0}</span>
                <span className="text-xs text-muted-foreground/40 font-medium">-</span>
                <span className="text-lg font-black tabular-nums text-red-400">{match.awayScore ?? 0}</span>
              </div>
            ) : (
              <div className="px-3 py-1 rounded-md bg-muted/40 border border-border/20">
                <span className="text-xs font-bold text-muted-foreground/60 tracking-wider">VS</span>
              </div>
            )}
          </div>

          {/* Away team */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <span className="font-semibold text-sm truncate text-right">{match.awayTeam}</span>
            {match.awayLogo ? (
              <img
                src={match.awayLogo}
                alt={match.awayTeam}
                className="w-9 h-9 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-[11px] font-bold shrink-0">
                {match.awayTeam.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Watch button */}
        <div className="mt-3 pt-2.5 border-t border-border/20">
          <Button
            size="sm"
            onClick={handleWatch}
            disabled={findingStream}
            className={`w-full h-8 gap-2 text-xs font-semibold rounded-lg transition-all ${
              isLive
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20'
                : 'bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-600/20'
            }`}
          >
            {findingStream ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Recherche...
              </>
            ) : isLive ? (
              <>
                <Radio className="h-3.5 w-3.5 fill-current" />
                Regarder en direct
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Regarder le match
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Channel Selector - slide down */}
      {showChannels && (
        <div className="border-t border-border/20 bg-muted/20 px-4 py-3">
          {findingStream ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-green-500" />
              <span>Recherche de canaux de diffusion...</span>
            </div>
          ) : foundChannels && foundChannels.length > 0 ? (
            <div>
              <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider mb-2">
                Chaînes disponibles
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {foundChannels.map((channel, idx) => (
                  <button
                    key={`${channel.name}-${idx}`}
                    onClick={() => handleSelectChannel(channel)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left group/ch"
                  >
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt=""
                        className="w-6 h-6 rounded object-contain shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded bg-muted/60 flex items-center justify-center shrink-0">
                        <Tv className="h-3 w-3 text-muted-foreground/50" />
                      </div>
                    )}
                    <span className="text-xs font-medium truncate flex-1">{channel.name}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover/ch:text-green-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : foundChannels && foundChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 py-1">Aucun canal trouvé pour ce match</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
