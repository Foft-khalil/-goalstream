'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Trophy, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StandingTeam {
  rank: number;
  team: string;
  shortName: string;
  logo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  note: string | null;
  noteColor: string | null;
}

interface LeagueStanding {
  league: string;
  flag: string;
  season: string;
  teams: StandingTeam[];
}

interface StandingsData {
  standings: LeagueStanding[];
  lastUpdated: string;
  error?: string;
}

const LEAGUE_TABS = [
  { code: 'fra.1', name: 'Ligue 1', flag: '🇫🇷' },
  { code: 'eng.1', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'esp.1', name: 'La Liga', flag: '🇪🇸' },
  { code: 'ita.1', name: 'Serie A', flag: '🇮🇹' },
  { code: 'ger.1', name: 'Bundesliga', flag: '🇩🇪' },
  { code: 'por.1', name: 'Liga Portugal', flag: '🇵🇹' },
  { code: 'ned.1', name: 'Eredivisie', flag: '🇳🇱' },
];

function getNoteStyle(note: string | null, noteColor: string | null) {
  if (!note) return '';
  const c = noteColor?.toLowerCase() || '';
  if (c.includes('81d6ac') || c.includes('green') || note.toLowerCase().includes('champions')) {
    return 'bg-green-500/15 text-green-400 border-green-500/20';
  }
  if (c.includes('7ec8e3') || c.includes('blue') || note.toLowerCase().includes('europa') || note.toLowerCase().includes('conference')) {
    return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  }
  if (c.includes('f4a460') || c.includes('orange') || note.toLowerCase().includes('relegation')) {
    return 'bg-red-500/15 text-red-400 border-red-500/20';
  }
  return 'bg-muted/30 text-muted-foreground border-border/30';
}

export default function StandingsView() {
  const [activeLeague, setActiveLeague] = useState('fra.1');
  const [data, setData] = useState<StandingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set(['fra.1']));

  const fetchStandings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/standings');
      if (!res.ok) throw new Error('Échec du chargement');
      const json: StandingsData = await res.json();
      setData(json);
      if (json.error) setError(json.error);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  const toggleLeague = (code: string) => {
    setExpandedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-green-500" />
          </div>
        </div>
        <p className="text-base font-semibold mb-1">Chargement des classements</p>
        <p className="text-sm text-muted-foreground/60">Récupération des données...</p>
      </div>
    );
  }

  // Error state
  if (error && !data?.standings?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Impossible de charger</h3>
        <p className="text-sm text-muted-foreground mb-5">{error}</p>
        <Button onClick={fetchStandings} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  const standings = data?.standings || [];

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-green-500" />
            Classements
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {standings.length} championnat{standings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchStandings}
          disabled={loading}
          className="h-8 w-8 rounded-lg border-border/50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* League tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {LEAGUE_TABS.map((tab) => {
          const isActive = expandedLeagues.has(tab.code);
          return (
            <button
              key={tab.code}
              onClick={() => toggleLeague(tab.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : 'bg-muted/30 text-muted-foreground border border-border/20 hover:bg-muted/50'
              }`}
            >
              <span className="text-sm">{tab.flag}</span>
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {error && data?.standings?.length && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Standings tables */}
      {standings
        .filter((s) => expandedLeagues.has(LEAGUE_TABS.find((t) => t.name === s.league)?.code || ''))
        .map((league) => (
          <section key={league.league} className="space-y-0">
            {/* League header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{league.flag}</span>
              <div>
                <h3 className="text-sm font-bold">{league.league}</h3>
                <p className="text-[10px] text-muted-foreground/50">{league.season}</p>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/30 overflow-hidden bg-card/50">
              {/* Header */}
              <div className="grid grid-cols-[28px_1fr_32px_32px_32px_32px_40px] gap-0 px-2.5 py-2 bg-muted/30 border-b border-border/20 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                <span className="text-center">#</span>
                <span>Équipe</span>
                <span className="text-center">J</span>
                <span className="text-center">V</span>
                <span className="text-center">N</span>
                <span className="text-center">D</span>
                <span className="text-center font-bold">Pts</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/10">
                {league.teams.map((team) => (
                  <div
                    key={team.team}
                    className={`grid grid-cols-[28px_1fr_32px_32px_32px_32px_40px] gap-0 px-2.5 py-2 items-center text-xs hover:bg-muted/20 transition-colors ${
                      team.rank <= 3
                        ? 'bg-green-500/[0.03]'
                        : team.rank >= league.teams.length - 2
                        ? 'bg-red-500/[0.03]'
                        : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex justify-center">
                      {team.note ? (
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold border ${getNoteStyle(team.note, team.noteColor)}`}>
                          {team.rank}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 font-medium">{team.rank}</span>
                      )}
                    </div>

                    {/* Team */}
                    <div className="flex items-center gap-2 min-w-0">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt=""
                          className="w-5 h-5 rounded object-contain shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-5 h-5 rounded bg-muted/40 flex items-center justify-center text-[8px] font-bold shrink-0">
                          {team.shortName.slice(0, 2)}
                        </div>
                      )}
                      <span className="font-medium truncate text-[11px]">{team.shortName}</span>
                    </div>

                    {/* Stats */}
                    <span className="text-center text-muted-foreground tabular-nums">{team.played}</span>
                    <span className="text-center text-green-400/80 tabular-nums">{team.wins}</span>
                    <span className="text-center text-muted-foreground/60 tabular-nums">{team.draws}</span>
                    <span className="text-center text-red-400/60 tabular-nums">{team.losses}</span>
                    <span className="text-center font-black text-foreground tabular-nums">{team.points}</span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500/40" />
                  <span className="text-[9px] text-muted-foreground/50">Ligue des Champions</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500/40" />
                  <span className="text-[9px] text-muted-foreground/50">Europa / Conf.</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500/40" />
                  <span className="text-[9px] text-muted-foreground/50">Relégation</span>
                </div>
              </div>
            </div>
          </section>
        ))}

      {/* No standings selected */}
      {expandedLeagues.size === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">Sélectionnez un championnat ci-dessus</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground/30 pt-1">
        Classements — données ESPN
      </div>
    </div>
  );
}
