'use client';

import { useAppStore, FootballMatch } from '@/lib/store';
import { useFavorites } from '@/hooks/use-favorites';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Tv, Heart, Star, Clock, Radio, Loader2, Trash2, WifiOff, X, ChevronRight, Zap, Users } from 'lucide-react';
import { useState } from 'react';

interface FoundChannel {
  name: string;
  url: string;
  logo: string;
  group: string;
  relevance: number;
}

function FavoriteMatchCard({ match }: { match: FootballMatch }) {
  const { openPlayer } = useAppStore();
  const { toggleTeamFavorite, isTeamFavorite } = useFavorites();
  const [findingStream, setFindingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLive = match.status === 'live';
  const matchDate = match.matchDate ? new Date(match.matchDate) : null;
  const timeStr = matchDate ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  // Determine date label
  const dateLabel = (() => {
    if (!matchDate) return '';
    const now = new Date();
    const matchYMD = `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, '0')}-${String(matchDate.getDate()).padStart(2, '0')}`;
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowYMD = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const dayAfterYMD = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;
    if (matchYMD === todayYMD) return "Aujourd'hui";
    if (matchYMD === tomorrowYMD) return 'Demain';
    if (matchYMD === dayAfterYMD) return 'Après-demain';
    return matchDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  })();

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
        }),
      });
      if (!res.ok) throw new Error('Failed to find channels');
      const data = await res.json();
      const channels: FoundChannel[] = data.channels || [];
      if (channels.length > 0) {
        const first = channels[0];
        openPlayer(first.url, first.name, first.logo || undefined, channels.slice(1));
      } else {
        setError('Aucune chaîne trouvée');
      }
    } catch {
      setError('Erreur lors de la recherche');
    } finally {
      setFindingStream(false);
    }
  };

  const homeFav = isTeamFavorite(match.homeTeam);
  const awayFav = isTeamFavorite(match.awayTeam);

  return (
    <div
      className={`group relative rounded-xl overflow-hidden transition-all duration-200 ${
        isLive
          ? 'bg-gradient-to-r from-red-950/30 via-card to-red-950/20 border border-red-500/20 shadow-lg shadow-red-500/5'
          : 'bg-card/80 border border-border/40 hover:border-border/70 hover:bg-card'
      }`}
    >
      <div className="px-4 py-3.5">
        {/* Competition + status */}
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
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground/40" />
              <span className="text-[11px] font-semibold text-muted-foreground">
                {dateLabel ? `${dateLabel} ` : ''}{timeStr}
              </span>
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="flex items-center gap-3">
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
            <span className={`font-semibold text-sm truncate ${homeFav ? 'text-green-500' : ''}`}>
              {match.homeTeam}
            </span>
            <button
              onClick={() => toggleTeamFavorite(match.homeTeam, match.homeLogo)}
              className="shrink-0 ml-auto"
              title={homeFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`h-3.5 w-3.5 transition-colors ${homeFav ? 'fill-green-500 text-green-500' : 'text-muted-foreground/30 hover:text-green-500'}`} />
            </button>
          </div>

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

          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <button
              onClick={() => toggleTeamFavorite(match.awayTeam, match.awayLogo)}
              className="shrink-0"
              title={awayFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`h-3.5 w-3.5 transition-colors ${awayFav ? 'fill-green-500 text-green-500' : 'text-muted-foreground/30 hover:text-green-500'}`} />
            </button>
            <span className={`font-semibold text-sm truncate text-right ${awayFav ? 'text-green-500' : ''}`}>
              {match.awayTeam}
            </span>
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
            onClick={handleQuickPlay}
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
                Regarder
              </>
            )}
          </Button>
          {error && !findingStream && (
            <div className="mt-2 text-[11px] text-red-400/80 text-center">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FavoriteChannelCard({ channel }: { channel: { name: string; logo: string; url: string; group: string } }) {
  const { openPlayer } = useAppStore();
  const { removeChannelFavorite } = useFavorites();

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card/80 border border-border/40 hover:border-border/70 hover:bg-card transition-all group">
      {/* Logo */}
      <div className="shrink-0">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-11 h-11 rounded-lg object-contain bg-muted/50 p-1 group-hover:scale-105 transition-transform"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
            <Tv className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate">{channel.name}</h3>
        {channel.group && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mt-1">
            {channel.group}
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          onClick={() => openPlayer(channel.url, channel.name, channel.logo || undefined)}
          className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
        >
          <Play className="h-3 w-3 fill-current" />
          <span className="hidden sm:inline">Regarder</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeChannelFavorite(channel.url)}
          className="h-8 w-8 text-muted-foreground/50 hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function FavoritesView() {
  const { footballMatches, footballLoading, fetchFootballMatches } = useAppStore();
  const { favoriteTeams, favoriteChannels, removeTeamFavorite, removeChannelFavorite, totalFavorites, clearAll } = useFavorites();
  const [confirmClear, setConfirmClear] = useState(false);

  // Filter matches that involve favorite teams
  const favoriteTeamNames = favoriteTeams.map((t) => t.name.toLowerCase());
  const relevantMatches = footballMatches.filter(
    (m) => favoriteTeamNames.includes(m.homeTeam.toLowerCase()) || favoriteTeamNames.includes(m.awayTeam.toLowerCase())
  );

  const liveMatches = relevantMatches.filter((m) => m.status === 'live');
  const upcomingMatches = relevantMatches.filter((m) => m.status === 'upcoming');
  const finishedMatches = relevantMatches.filter((m) => m.status === 'finished');

  const hasContent = totalFavorites > 0;

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Heart className="h-5 w-5 text-green-500 fill-green-500" />
            Mes Favoris
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {favoriteTeams.length} équipe{favoriteTeams.length !== 1 ? 's' : ''} · {favoriteChannels.length} chaîne{favoriteChannels.length !== 1 ? 's' : ''}
          </p>
        </div>
        {hasContent && (
          <div>
            {confirmClear ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { clearAll(); setConfirmClear(false); }}
                  className="h-7 text-[11px] gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Confirmer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClear(false)}
                  className="h-7 text-[11px]"
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClear(true)}
                className="h-7 text-[11px] gap-1 border-border/40 text-muted-foreground"
              >
                <Trash2 className="h-3 w-3" />
                Tout effacer
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasContent && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-600/10 flex items-center justify-center mb-4">
            <Star className="h-10 w-10 text-green-500/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Aucun favori</h3>
          <p className="text-sm text-muted-foreground/60 max-w-xs mb-4">
            Ajoutez vos équipes et chaînes préférées en appuyant sur l&apos;icône ❤️ pour un accès rapide
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/40">
            <div className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5" />
              <span>Appuyez sur ❤️</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              <span>Accès rapide</span>
            </div>
          </div>
        </div>
      )}

      {/* Favorite teams section */}
      {favoriteTeams.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/15">
              <Users className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-bold text-green-500 uppercase tracking-wide">
                Équipes favorites ({favoriteTeams.length})
              </span>
            </div>
          </div>
          
          {/* Team pills */}
          <div className="flex gap-2 flex-wrap mb-4">
            {favoriteTeams.map((team) => (
              <div
                key={team.name}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl bg-card/80 border border-border/40 hover:border-green-500/30 transition-all group/team"
              >
                {team.logo ? (
                  <img
                    src={team.logo}
                    alt={team.name}
                    className="w-6 h-6 rounded object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-muted/60 flex items-center justify-center text-[8px] font-bold">
                    {team.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold">{team.name}</span>
                <button
                  onClick={() => removeTeamFavorite(team.name)}
                  className="ml-0.5 opacity-40 group-hover/team:opacity-100 hover:text-red-400 transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Relevant matches */}
          {relevantMatches.length > 0 ? (
            <div className="space-y-3">
              {/* Live matches first */}
              {liveMatches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    EN DIRECT ({liveMatches.length})
                  </div>
                  {liveMatches.map((match) => (
                    <FavoriteMatchCard key={match.id} match={match} />
                  ))}
                </div>
              )}

              {/* Upcoming */}
              {upcomingMatches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    À VENIR ({upcomingMatches.length})
                  </div>
                  {upcomingMatches.map((match) => (
                    <FavoriteMatchCard key={match.id} match={match} />
                  ))}
                </div>
              )}

              {/* Finished */}
              {finishedMatches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/50 mt-1">
                    TERMINÉ ({finishedMatches.length})
                  </div>
                  {finishedMatches.map((match) => (
                    <FavoriteMatchCard key={match.id} match={match} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 px-4 text-center rounded-xl bg-muted/20 border border-border/20">
              <WifiOff className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground/60">Aucun match prévu pour vos équipes sur les 3 prochains jours</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Revenez plus tard !</p>
            </div>
          )}
        </section>
      )}

      {/* Favorite channels section */}
      {favoriteChannels.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/15">
              <Tv className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                Chaînes favorites ({favoriteChannels.length})
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {favoriteChannels.map((channel) => (
              <FavoriteChannelCard key={channel.url} channel={channel} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground/30 pt-1">
        Vos favoris sont sauvegardés localement sur votre appareil
      </div>
    </div>
  );
}
