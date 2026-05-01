'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useAppStore, DateTab } from '@/lib/store';
import { formatFrShort, formatFrLong } from '@/lib/date-utils';
import MatchCard from '@/components/match-card';
import { Loader2, Zap, Calendar, RefreshCw, AlertCircle, Clock, Wifi, WifiOff, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Get YYYYMMDD string for a Date */
function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Get the YYYYMMDD for a given DateTab relative to today */
function getDateForTab(tab: DateTab): string {
  const offset = parseInt(tab.replace('day', ''), 10);
  const now = new Date();
  const target = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
  return formatDateYMD(target);
}

/** Check if a match's ISO date falls on a given YYYYMMDD date */
function isMatchOnDate(matchDate: string | null, ymd: string): boolean {
  if (!matchDate) return false;
  try {
    const d = new Date(matchDate);
    return formatDateYMD(d) === ymd;
  } catch {
    return false;
  }
}

/** All 7 date tabs */
const ALL_DATE_TABS: DateTab[] = ['day0', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6'];

export default function LiveMatches() {
  const {
    footballMatches,
    footballLoading,
    footballError,
    footballLastUpdated,
    footballDates,
    selectedDate,
    setSelectedDate,
    fetchFootballMatches,
  } = useAppStore();

  const [countdown, setCountdown] = useState(60);
  const lastUpdatedRef = useRef<string | null>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  // Initial fetch is handled by parent (page.tsx) with a delay to avoid OOM
  // Only poll for updates here
  const hasFetchedOnce = footballMatches.length > 0 || footballError !== null;

  // Adaptive polling: 15s when live matches exist, 2 min otherwise
  const hasLive = footballMatches.some(m => m.status === 'live');
  const pollInterval = hasLive ? 15 * 1000 : 120 * 1000;

  useEffect(() => {
    // Only start polling after first fetch has completed
    if (!hasFetchedOnce) return;
    const interval = setInterval(() => {
      // Only fetch today's matches during polling (memory-safe)
      const now = new Date();
      const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      fetchFootballMatches([today]);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchFootballMatches, pollInterval, hasFetchedOnce]);

  useEffect(() => {
    if (footballLastUpdated !== lastUpdatedRef.current) {
      lastUpdatedRef.current = footballLastUpdated;
    }
    const startTime = Date.now();
    const duration = hasLive ? 15 : 120;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setCountdown(Math.max(0, duration - elapsed));
    }, 1000);
    return () => clearInterval(timer);
  }, [footballLastUpdated, hasLive]);

  const handleRetry = useCallback(() => {
    const now = new Date();
    const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    fetchFootballMatches([today]);
    setCountdown(60);
  }, [fetchFootballMatches]);

  // Compute date keys for all 7 tabs
  const dateKeys = useMemo(() => {
    const keys: Record<DateTab, string> = {} as any;
    for (const tab of ALL_DATE_TABS) {
      keys[tab] = getDateForTab(tab);
    }
    return keys;
  }, []);

  // On-demand fetch when user switches to a date tab that has no matches
  useEffect(() => {
    const dateKey = dateKeys[selectedDate];
    const hasMatchesForDate = footballMatches.some((m) => isMatchOnDate(m.matchDate, dateKey));
    if (!hasMatchesForDate && !footballLoading) {
      fetchFootballMatches([dateKey]);
    }
  }, [selectedDate, dateKeys, footballMatches, footballLoading, fetchFootballMatches]);

  // Filter matches by selected date tab — live matches always show regardless of date
  const dateKey = dateKeys[selectedDate];
  const filteredMatches = useMemo(
    () => footballMatches.filter((m) => m.status === 'live' || isMatchOnDate(m.matchDate, dateKey)),
    [footballMatches, dateKey]
  );

  // Count per tab — don't count live matches from other days to avoid confusion
  const tabCounts = useMemo(() => {
    const counts: Record<DateTab, number> = {} as any;
    for (const tab of ALL_DATE_TABS) {
      counts[tab] = footballMatches.filter((m) => m.status !== 'live' && isMatchOnDate(m.matchDate, dateKeys[tab])).length;
    }
    return counts;
  }, [footballMatches, dateKeys]);

  const liveMatches = filteredMatches.filter((m) => m.status === 'live');
  const upcomingMatches = filteredMatches.filter((m) => m.status === 'upcoming');
  const finishedMatches = filteredMatches.filter((m) => m.status === 'finished');

  // Group upcoming matches by competition
  const competitionGroups = upcomingMatches.reduce<Record<string, typeof upcomingMatches>>((acc, match) => {
    const comp = match.competition || 'Football';
    if (!acc[comp]) acc[comp] = [];
    acc[comp].push(match);
    return acc;
  }, {});

  // Group finished matches by competition
  const finishedGroups = finishedMatches.reduce<Record<string, typeof finishedMatches>>((acc, match) => {
    const comp = match.competition || 'Football';
    if (!acc[comp]) acc[comp] = [];
    acc[comp].push(match);
    return acc;
  }, {});

  const countdownStr = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;

  // Tab labels with day info — uses deterministic French formatting to avoid hydration mismatch
  const dateTabs = useMemo(() => {
    return ALL_DATE_TABS.map((tab, idx) => {
      const d = new Date();
      d.setDate(d.getDate() + idx);
      const dayLabel = idx === 0
        ? "Aujourd'hui"
        : idx === 1
          ? 'Demain'
          : formatFrShort(d);
      const sublabel = idx === 0
        ? ''
        : formatFrShort(d);
      return {
        key: tab,
        label: dayLabel,
        sublabel,
        count: tabCounts[tab] || 0,
        dateObj: d,
      };
    });
  }, [tabCounts]);

  // Auto-scroll to active tab
  useEffect(() => {
    if (tabScrollRef.current) {
      const activeBtn = tabScrollRef.current.querySelector('[data-active="true"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDate]);

  // Get the formatted date for the header
  const selectedDateObj = useMemo(() => {
    const offset = parseInt(selectedDate.replace('day', ''), 10);
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  }, [selectedDate]);

  const headerDateStr = useMemo(() => {
    const idx = parseInt(selectedDate.replace('day', ''), 10);
    if (idx === 0) return formatFrLong(new Date());
    if (idx === 1) return `Demain — ${formatFrShort(selectedDateObj)}`;
    return formatFrLong(selectedDateObj);
  }, [selectedDate, selectedDateObj]);

  // Loading state
  if (footballLoading && footballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-green-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 animate-ping opacity-60" />
        </div>
        <p className="text-base font-semibold mb-1">Chargement des matchs</p>
        <p className="text-sm text-muted-foreground/60">Recherche sur 7 jours...</p>
        <div className="flex items-center gap-1.5 mt-4">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  // Error state
  if (footballError && footballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <WifiOff className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Impossible de charger</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">{footballError}</p>
        <Button onClick={handleRetry} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Date Tab Selector - Scrollable for 7 days */}
      <div className="relative">
        <div
          ref={tabScrollRef}
          className="flex items-center gap-1 overflow-x-auto scrollbar-hide bg-muted/40 rounded-xl p-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dateTabs.map((tab) => {
            const isActive = selectedDate === tab.key;
            return (
              <button
                key={tab.key}
                data-active={isActive}
                onClick={() => setSelectedDate(tab.key)}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-sm font-medium transition-all relative min-w-[72px] ${
                  isActive
                    ? 'bg-green-500/15 text-green-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <span className="text-[11px] font-semibold whitespace-nowrap">{tab.label}</span>
                {tab.key !== 'day0' && (
                  <span className={`text-[9px] ${isActive ? 'text-green-500/70' : 'text-muted-foreground/50'}`}>
                    {tab.sublabel}
                  </span>
                )}
                {tab.count > 0 && (
                  <span className={`absolute top-0.5 right-1 flex items-center justify-center min-w-[14px] h-4 px-0.5 rounded-full text-[9px] font-bold ${
                    isActive
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-green-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header with date info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold capitalize flex items-center gap-2">
            {headerDateStr}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            {liveMatches.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-green-500" />
                <span className="text-sm text-green-500 font-semibold">
                  {liveMatches.length} en direct
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {upcomingMatches.length + finishedMatches.length} match{(upcomingMatches.length + finishedMatches.length) !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">
            Maj {countdownStr}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRetry}
            disabled={footballLoading}
            className="h-8 w-8 rounded-lg border-border/50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${footballLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {footballError && footballMatches.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{footballError}</span>
          <Button variant="ghost" size="sm" onClick={handleRetry} className="ml-auto h-5 px-2 text-[10px] text-red-400">
            Réessayer
          </Button>
        </div>
      )}

      {/* No matches for this date */}
      {filteredMatches.length === 0 && footballMatches.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold mb-1">Aucun match ce jour</h3>
          <p className="text-sm text-muted-foreground/60">
            Pas de match prévu pour cette date
          </p>
        </div>
      )}

      {/* ===== LIVE MATCHES ===== */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/15">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-500 uppercase tracking-wide">En Direct</span>
            </div>
          </div>
          <div className="space-y-3">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* ===== UPCOMING MATCHES BY COMPETITION ===== */}
      {Object.entries(competitionGroups).map(([competition, matches]) => (
        <section key={competition}>
          {/* Competition header */}
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="h-px flex-1 bg-border/40" />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/30">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-semibold text-muted-foreground">{competition}</span>
              <span className="text-[10px] text-muted-foreground/50">{matches.length}</span>
            </div>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          {/* Match list */}
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      ))}

      {/* ===== FINISHED MATCHES BY COMPETITION ===== */}
      {Object.entries(finishedGroups).length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border/30">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">Terminés</span>
              <span className="text-[10px] text-muted-foreground/40">{finishedMatches.length}</span>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(finishedGroups).map(([competition, matches]) => (
              <div key={competition}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground/40">{competition}</span>
                  <div className="h-px flex-1 bg-border/20" />
                </div>
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer info */}
      <div className="text-center text-[10px] text-muted-foreground/30 pt-1">
        Programme sur 7 jours — mise à jour auto toutes les {hasLive ? '15s' : '2 min'}{hasLive ? ' (en direct)' : ''}
      </div>
    </div>
  );
}
