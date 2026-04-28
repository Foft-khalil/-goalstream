'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Tv, Clock, Loader2, Radio, ChevronRight, Heart } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useFavorites } from '@/hooks/use-favorites';
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

export interface FoundChannel {
  name: string;
  url: string;
  logo: string;
  group: string;
  relevance: number;
  broadcaster?: string;
}

export default function MatchCard({ match }: MatchCardProps) {
  const { openPlayer } = useAppStore();
  const { toggleTeamFavorite, isTeamFavorite } = useFavorites();
  const [findingStream, setFindingStream] = useState(false);
  const [foundChannels, setFoundChannels] = useState<FoundChannel[]>([]);
  const [showChannels, setShowChannels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadcasterInfo, setBroadcasterInfo] = useState<string | null>(null);

  const isLive = match.status === 'live';
  const matchDate = match.matchDate ? new Date(match.matchDate) : null;
  const timeStr = matchDate ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const dateStr = matchDate ? matchDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  const isToday = matchDate ? new Date().toDateString() === matchDate.toDateString() : false;
  const isTomorrow = matchDate ? new Date(Date.now() + 86400000).toDateString() === matchDate.toDateString() : false;
  const homeFav = isTeamFavorite(match.homeTeam);
  const awayFav = isTeamFavorite(match.awayTeam);

  const handleWatch = async () => {
    if (match.streamUrl) {
      // Direct stream URL available
      openPlayer(match.streamUrl, match.channelName || `${match.homeTeam} vs ${match.awayTeam}`, match.channelLogo || undefined);
      return;
    }
    // Find channels for this match
    await findAndShowChannels();
  };

  const findAndShowChannels = async () => {
    if (findingStream) return;
    setFindingStream(true);
    setShowChannels(true);
    setError(null);
    try {
      const res = await fetch('/api/match-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competition,
          matchDate: match.matchDate,
        }),
      });

      if (!res.ok) throw new Error('Failed to find channels');
      const data = await res.json();
      const channels = data.channels || [];
      setFoundChannels(channels);

      // Show broadcaster info if available
      if (data.broadcasters && data.broadcasters.length > 0) {
        setBroadcasterInfo(data.broadcasters.join(', '));
      } else if (data.message) {
        setBroadcasterInfo(null);
      }

      if (channels.length === 0) {
        setError('Aucune chaîne trouvée');
      }
    } catch (err) {
      console.error('Error finding channels:', err);
      setError('Erreur lors de la recherche');
      setFoundChannels([]);
    } finally {
      setFindingStream(false);
    }
  };

  const handleSelectChannel = (channel: FoundChannel) => {
    // Open player with this channel AND pass all found channels as alternatives
    openPlayer(
      channel.url,
      channel.name,
      channel.logo || undefined,
      foundChannels.filter((ch) => ch.url !== channel.url)
    );
  };

  // Try to auto-play the first channel directly
  const handleQuickPlay = async () => {
    if (findingStream) return;
    setFindingStream(true);
    setError(null);
    try {
      const res = await fetch('/api/match-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competition,
          matchDate: match.matchDate,
        }),
      });

      if (!res.ok) throw new Error('Failed to find channels');
      const data = await res.json();
      const channels: FoundChannel[] = data.channels || [];

      // Store broadcaster info
      if (data.broadcasters && data.broadcasters.length > 0) {
        setBroadcasterInfo(data.broadcasters.join(', '));
      }

      if (channels.length > 0) {
        // Open player with first channel, pass rest as alternatives
        const first = channels[0];
        const alternatives = channels.slice(1);
        openPlayer(first.url, first.name, first.logo || undefined, alternatives);
      } else {
        setError('Aucune chaîne trouvée');
        // Show channel picker so user can see the result
        setFoundChannels(channels);
        setShowChannels(true);
      }
    } catch (err) {
      console.error('Error finding channels:', err);
      setError('Erreur lors de la recherche');
    } finally {
      setFindingStream(false);
    }
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
        {/* Top row: competition + date/time/status */}
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
              <span className="text-[11px] font-semibold text-muted-foreground">
                {isToday ? `Aujourd'hui ${timeStr}` : isTomorrow ? `Demain ${timeStr}` : `${dateStr} ${timeStr}`}
              </span>
            </div>
          )}
        </div>

        {/* Teams row */}
        <div className="flex items-center gap-3">
          {/* Home team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
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
            <span className={`font-semibold text-sm truncate ${homeFav ? 'text-green-500' : ''}`}>{match.homeTeam}</span>
            <button
              onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.homeTeam, match.homeLogo); }}
              className="shrink-0 ml-auto"
              title={homeFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`h-3.5 w-3.5 transition-colors ${homeFav ? 'fill-green-500 text-green-500' : 'text-muted-foreground/30 hover:text-green-500'}`} />
            </button>
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
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); toggleTeamFavorite(match.awayTeam, match.awayLogo); }}
              className="shrink-0"
              title={awayFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`h-3.5 w-3.5 transition-colors ${awayFav ? 'fill-green-500 text-green-500' : 'text-muted-foreground/30 hover:text-green-500'}`} />
            </button>
            <span className={`font-semibold text-sm truncate text-right ${awayFav ? 'text-green-500' : ''}`}>{match.awayTeam}</span>
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

        {/* Watch buttons */}
        <div className="mt-3 pt-2.5 border-t border-border/20 flex gap-2">
          <Button
            size="sm"
            onClick={handleQuickPlay}
            disabled={findingStream}
            className={`flex-1 h-8 gap-2 text-xs font-semibold rounded-lg transition-all ${
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
                Regarder
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (foundChannels.length > 0 && showChannels) {
                setShowChannels(false);
              } else {
                handleWatch();
              }
            }}
            disabled={findingStream}
            className="h-8 px-3 rounded-lg border-border/40 text-xs"
          >
            <Tv className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Error message */}
        {error && !findingStream && (
          <div className="mt-2 text-[11px] text-red-400/80 text-center">
            {error}
          </div>
        )}

        {/* Broadcaster info */}
        {broadcasterInfo && !error && (
          <div className="mt-2 flex items-center gap-1.5 justify-center">
            <Tv className="h-3 w-3 text-green-500/60" />
            <span className="text-[10px] text-green-500/70 font-medium">
              Diffusé sur: {broadcasterInfo}
            </span>
          </div>
        )}
      </div>

      {/* Channel Selector - slide down */}
      {showChannels && foundChannels.length > 0 && (
        <div className="border-t border-border/20 bg-muted/20 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
              Chaînes disponibles ({foundChannels.length})
            </p>
            {broadcasterInfo && (
              <span className="text-[9px] text-green-500/60 font-medium">
                📺 {broadcasterInfo}
              </span>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
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
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">{channel.name}</span>
                  {channel.broadcaster && (
                    <span className="text-[9px] text-green-500/50">via {channel.broadcaster}</span>
                  )}
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover/ch:text-green-500 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
