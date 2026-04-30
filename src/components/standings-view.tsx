'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Trophy, RefreshCw, AlertCircle, Globe, Shield, Users, Calendar, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TeamDetailDialog from '@/components/team-detail-dialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StandingTeam {
  teamId: string;
  leagueCode: string;
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
  leagueCode: string;
  teams: StandingTeam[];
  isGroup?: boolean;
  groupName?: string;
}

interface StandingsData {
  standings: LeagueStanding[];
  category: string;
  lastUpdated: string;
  errors?: string[];
  errorCount?: number;
  error?: string;
}

// ─── Category definitions ────────────────────────────────────────────────────

type Category = 'championnats' | 'coupes' | 'nationales';

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: 'championnats', label: 'Championnats', icon: <Trophy className="h-3.5 w-3.5" /> },
  { key: 'coupes', label: 'Coupes Clubs', icon: <Shield className="h-3.5 w-3.5" /> },
  { key: 'nationales', label: 'Éq. Nationales', icon: <Globe className="h-3.5 w-3.5" /> },
];

// League tabs per category
const LEAGUE_TABS: Record<Category, Array<{ code: string; name: string; flag: string }>> = {
  championnats: [
    { code: 'eng.1', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { code: 'fra.1', name: 'Ligue 1', flag: '🇫🇷' },
    { code: 'esp.1', name: 'La Liga', flag: '🇪🇸' },
    { code: 'ita.1', name: 'Serie A', flag: '🇮🇹' },
    { code: 'ger.1', name: 'Bundesliga', flag: '🇩🇪' },
    { code: 'por.1', name: 'Liga Portugal', flag: '🇵🇹' },
    { code: 'ned.1', name: 'Eredivisie', flag: '🇳🇱' },
  ],
  coupes: [
    { code: 'uefa.champions', name: 'Ligue des Champions', flag: '🏆' },
    { code: 'uefa.europa', name: 'Europa League', flag: '🏆' },
    { code: 'uefa.europa.conf', name: 'Conference League', flag: '🏆' },
  ],
  nationales: [
    { code: 'fifa.rankings', name: 'Classement FIFA', flag: '🌍' },
    { code: 'fifa.world', name: 'Coupe du Monde', flag: '🏆' },
    { code: 'uefa.euro', name: 'Euro', flag: '🇪🇺' },
    { code: 'caf.nations', name: 'CAN', flag: '🌍' },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNoteStyle(note: string | null, noteColor: string | null) {
  if (!note) return '';
  const c = noteColor?.toLowerCase() || '';
  const n = note.toLowerCase();
  if (c.includes('81d6ac') || c.includes('green') || n.includes('champions') || n.includes('top 10') || n.includes('qualif') || n.includes('advance') || n.includes('round of')) {
    return 'bg-green-500/15 text-green-400 border-green-500/20';
  }
  if (c.includes('7ec8e3') || c.includes('blue') || n.includes('europa') || n.includes('conference') || n.includes('playoff')) {
    return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  }
  if (c.includes('f4a460') || c.includes('orange') || n.includes('relegation')) {
    return 'bg-red-500/15 text-red-400 border-red-500/20';
  }
  return 'bg-muted/30 text-muted-foreground border-border/30';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StandingsView() {
  const [activeCategory, setActiveCategory] = useState<Category>('championnats');
  const [data, setData] = useState<Record<Category, StandingsData | null>>({
    championnats: null,
    coupes: null,
    nationales: null,
  });
  const [loading, setLoading] = useState<Record<Category, boolean>>({
    championnats: false,
    coupes: false,
    nationales: false,
  });
  const [selectedLeague, setSelectedLeague] = useState<string>('fra.1');
  const [selectedTeam, setSelectedTeam] = useState<{
    teamId: string;
    leagueCode: string;
    teamName: string;
    teamLogo: string | null;
  } | null>(null);

  // Fetch standings for a category on demand
  // For memory efficiency, fetch one league at a time instead of the whole category
  const fetchStandings = useCallback(async (category: Category) => {
    setLoading((prev) => ({ ...prev, [category]: true }));
    try {
      const leagues = LEAGUE_TABS[category];
      const allStandings: LeagueStanding[] = [];
      const allErrors: string[] = [];
      
      // Fetch each league individually to avoid OOM
      for (const league of leagues) {
        try {
          const res = await fetch(`/api/standings?league=${league.code}`);
          if (!res.ok) throw new Error('Échec du chargement');
          const json: StandingsData = await res.json();
          if (json.standings.length > 0) {
            allStandings.push(...json.standings);
          }
          if (json.errors) allErrors.push(...json.errors);
        } catch {
          // Continue with other leagues even if one fails
        }
      }
      
      const json: StandingsData = {
        standings: allStandings,
        category,
        lastUpdated: new Date().toISOString(),
        errors: allErrors.length > 0 ? allErrors : undefined,
        errorCount: allErrors.length > 0 ? allErrors.length : undefined,
      };
      setData((prev) => ({ ...prev, [category]: json }));
    } catch (err: any) {
      setData((prev) => ({
        ...prev,
        [category]: {
          standings: [],
          category,
          lastUpdated: new Date().toISOString(),
          error: err.message,
        },
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [category]: false }));
    }
  }, []);

  // Fetch only the current category on mount (sequential to avoid OOM)
  useEffect(() => {
    fetchStandings('championnats');
  }, [fetchStandings]);

  // Fetch other categories on demand when tab is selected
  useEffect(() => {
    if (activeCategory !== 'championnats' && !data[activeCategory] && !loading[activeCategory]) {
      fetchStandings(activeCategory);
    }
  }, [activeCategory, data, loading, fetchStandings]);

  // Handle category tab change
  const handleCategoryChange = (category: Category) => {
    setActiveCategory(category);
    // Auto-select first league of the category
    const firstCode = LEAGUE_TABS[category][0]?.code;
    if (firstCode) {
      setSelectedLeague(firstCode);
    }
  };

  const handleTeamClick = (team: StandingTeam) => {
    setSelectedTeam({
      teamId: team.teamId,
      leagueCode: team.leagueCode,
      teamName: team.team,
      teamLogo: team.logo,
    });
  };

  // Current category data
  const currentData = data[activeCategory];
  const currentLoading = loading[activeCategory];
  const currentTabs = LEAGUE_TABS[activeCategory];
  const standings = currentData?.standings || [];
  const isFIFARankings = activeCategory === 'nationales';

  // Get standings for the currently selected league
  const selectedStandings = standings.filter((s) => s.leagueCode === selectedLeague);

  // Count teams for each league tab
  const getTeamCount = (code: string) => {
    return standings.filter((s) => s.leagueCode === code).reduce((sum, s) => sum + s.teams.length, 0);
  };

  // Loading state (only show full loading for the initial load of current category)
  if (currentLoading && !currentData) {
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
            {standings.length} classement{standings.length !== 1 ? 's' : ''} · Cliquez sur une équipe
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchStandings(activeCategory)}
          disabled={currentLoading}
          className="h-8 w-8 rounded-lg border-border/50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${currentLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          const catData = data[cat.key];
          const catLoading = loading[cat.key];
          const teamCount = catData?.standings?.reduce((sum, s) => sum + s.teams.length, 0) || 0;
          return (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-green-500/15 text-green-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
              {catLoading && !catData && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {!catLoading && teamCount > 0 && (
                <span className="text-[10px] text-green-500/60">{teamCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* League sub-tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {currentTabs.map((tab) => {
          const isSelected = selectedLeague === tab.code;
          const teamCount = getTeamCount(tab.code);
          return (
            <button
              key={tab.code}
              onClick={() => setSelectedLeague(tab.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : 'bg-muted/30 text-muted-foreground border border-border/20 hover:bg-muted/50'
              }`}
            >
              <span className="text-sm">{tab.flag}</span>
              <span>{tab.name}</span>
              {teamCount > 0 && (
                <span className="text-[10px] text-muted-foreground/50">({teamCount})</span>
              )}
              {teamCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading overlay for refresh */}
      {currentLoading && currentData && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/5 border border-green-500/10 text-xs text-green-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Mise à jour en cours...</span>
        </div>
      )}

      {/* Error banner */}
      {currentData?.error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{currentData.error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchStandings(activeCategory)}
            className="ml-auto h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
          >
            Réessayer
          </Button>
        </div>
      )}

      {/* Warnings (partial errors) */}
      {currentData?.errors && currentData.errors.length > 0 && (
        <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/15 text-xs text-amber-500">
          {currentData.errors.map((err, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Selected league standings */}
      {selectedStandings.length > 0 ? (
        selectedStandings.map((league) => (
          <section key={`${league.leagueCode}-${league.groupName || 'all'}`} className="space-y-0">
            {/* League header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{league.flag}</span>
              <div className="flex-1">
                <h3 className="text-sm font-bold">{league.league}</h3>
                <p className="text-[10px] text-muted-foreground/50">{league.season}</p>
              </div>
              {league.isGroup && selectedStandings.length > 1 && (
                <span className="text-[10px] text-muted-foreground/40">
                  {selectedStandings.indexOf(league) + 1}/{selectedStandings.length} groupes
                </span>
              )}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/30 overflow-hidden bg-card/50">
              {/* Header */}
              <div className={`grid gap-0 px-2.5 py-2 bg-muted/30 border-b border-border/20 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider ${
                isFIFARankings && league.leagueCode === 'fifa.rankings'
                  ? 'grid-cols-[28px_1fr_60px]'
                  : 'grid-cols-[28px_1fr_32px_32px_32px_32px_40px]'
              }`}>
                <span className="text-center">#</span>
                <span>Équipe</span>
                {isFIFARankings && league.leagueCode === 'fifa.rankings' ? (
                  <span className="text-center">Points</span>
                ) : (
                  <>
                    <span className="text-center">J</span>
                    <span className="text-center">V</span>
                    <span className="text-center">N</span>
                    <span className="text-center">D</span>
                    <span className="text-center font-bold">Pts</span>
                  </>
                )}
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/10">
                {league.teams.map((team) => (
                  <div
                    key={team.team}
                    onClick={() => handleTeamClick(team)}
                    className={`grid gap-0 px-2.5 py-2 items-center text-xs hover:bg-green-500/5 transition-colors cursor-pointer ${
                      isFIFARankings && league.leagueCode === 'fifa.rankings'
                        ? 'grid-cols-[28px_1fr_60px]'
                        : 'grid-cols-[28px_1fr_32px_32px_32px_32px_40px]'
                    } ${
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
                      <span className="font-medium truncate text-[11px] hover:text-green-500 transition-colors">{team.shortName}</span>
                    </div>

                    {/* Stats */}
                    {isFIFARankings && league.leagueCode === 'fifa.rankings' ? (
                      <span className="text-center font-black text-foreground tabular-nums">{team.points}</span>
                    ) : (
                      <>
                        <span className="text-center text-muted-foreground tabular-nums">{team.played}</span>
                        <span className="text-center text-green-400/80 tabular-nums">{team.wins}</span>
                        <span className="text-center text-muted-foreground/60 tabular-nums">{team.draws}</span>
                        <span className="text-center text-red-400/60 tabular-nums">{team.losses}</span>
                        <span className="text-center font-black text-foreground tabular-nums">{team.points}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend - adaptive per category */}
              {activeCategory === 'championnats' && (
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
              )}
              {activeCategory === 'coupes' && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500/40" />
                    <span className="text-[9px] text-muted-foreground/50">Qualifié tour suivant</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500/40" />
                    <span className="text-[9px] text-muted-foreground/50">Barrages</span>
                  </div>
                </div>
              )}
              {activeCategory === 'nationales' && selectedLeague === 'fifa.rankings' && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/10 border-t border-border/10">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500/40" />
                    <span className="text-[9px] text-muted-foreground/50">Top 10</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500/40" />
                    <span className="text-[9px] text-muted-foreground/50">Top 20</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        ))
      ) : !currentLoading ? (
        /* No data for selected league */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {selectedLeague === 'fifa.world' ? (
            <>
              <Trophy className="h-12 w-12 text-amber-500/30 mb-3" />
              <p className="text-sm font-semibold mb-1">Coupe du Monde 2026</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs">
                Les groupes et le calendrier de la Coupe du Monde 2026 seront disponibles prochainement.
                Cliquez sur les équipes du classement pour voir leurs détails.
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground mb-1">Aucune donnée disponible</p>
              <p className="text-xs text-muted-foreground/60">Les données ne sont pas encore disponibles pour cette compétition</p>
              <Button
                onClick={() => fetchStandings(activeCategory)}
                size="sm"
                className="mt-3 gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Réessayer
              </Button>
            </>
          )}
        </div>
      ) : null}

      {/* Loading for selected league */}
      {currentLoading && selectedStandings.length === 0 && currentData && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500 mb-3" />
          <p className="text-sm text-muted-foreground">Chargement en cours...</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground/30 pt-1">
        Classements — données ESPN · Cliquez sur une équipe pour voir les détails
      </div>

      {/* Team Detail Dialog */}
      {selectedTeam && (
        <TeamDetailDialog
          teamId={selectedTeam.teamId}
          leagueCode={selectedTeam.leagueCode}
          teamName={selectedTeam.teamName}
          teamLogo={selectedTeam.teamLogo}
          open={!!selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
