'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useAppStore, DateTab } from '@/lib/store';
import { t } from '@/lib/i18n';
import { formatShort, formatLong } from '@/lib/date-utils';
import { translations, Language } from '@/lib/i18n';
import MatchCard from '@/components/match-card';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { Loader2, Zap, Calendar, RefreshCw, AlertCircle, Clock, Wifi, WifiOff, Sparkles, ChevronRight, ChevronLeft, Filter, Timer, ArrowRight } from 'lucide-react';
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

/** Format a countdown to a future date */
function formatCountdown(targetDate: Date, language: string): string {
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  if (diffMs <= 0) return '';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    if (remainingHours > 0) {
      return `${diffDays}j ${remainingHours}h`;
    }
    return `${diffDays}j`;
  }
  if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    if (remainingMins > 0) {
      return `${diffHours}h ${remainingMins}min`;
    }
    return `${diffHours}h`;
  }
  return `${diffMins}min`;
}

/** Format match time from ISO date */
function formatMatchTime(matchDate: string | null, language: string): string {
  if (!matchDate) return '';
  try {
    const d = new Date(matchDate);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  } catch {
    return '';
  }
}

/** Get very short weekday label (1-2 chars) for compact display */
function getMiniWeekday(date: Date, lang: Language): string {
  const weekdays = translations[lang].dates.weekdaysShort;
  const day = weekdays[date.getDay()];
  // Take first 2-3 chars for compact display
  return day.replace('.', '').substring(0, 3);
}

/** Date range: 3 days back + today + 30 days forward = 34 days total */
const DAYS_BACK = 3;
const DAYS_FORWARD = 30;

/** Generate all date tab keys dynamically */
function generateDateTabs(): DateTab[] {
  const tabs: DateTab[] = [];
  for (let i = -DAYS_BACK; i <= DAYS_FORWARD; i++) {
    tabs.push(`day${i}`);
  }
  return tabs;
}

const ALL_DATE_TABS = generateDateTabs();

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
    selectedCompetition,
    setSelectedCompetition,
    language,
  } = useAppStore();

  const [countdown, setCountdown] = useState(60);
  const [loadStartedAt, setLoadStartedAt] = useState<number | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const lastUpdatedRef = useRef<string | null>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  // Track when loading starts to implement a max 8-second loading screen
  useEffect(() => {
    if (footballLoading && footballMatches.length === 0) {
      setLoadStartedAt((prev) => prev ?? Date.now());
    }
  }, [footballLoading, footballMatches.length]);

  // Force re-render after 8 seconds of loading to show empty state
  useEffect(() => {
    if (loadStartedAt !== null && footballLoading && footballMatches.length === 0) {
      const elapsed = Date.now() - loadStartedAt;
      const remaining = Math.max(0, 8000 - elapsed);
      const timer = setTimeout(() => {
        setForceUpdate((n) => n + 1);
      }, remaining + 100);
      return () => clearTimeout(timer);
    }
  }, [loadStartedAt, footballLoading, footballMatches.length, forceUpdate]);

  // Derive loadingTimeout: true if we've been loading for more than 8 seconds
  const loadingTimeout = loadStartedAt !== null && footballLoading && footballMatches.length === 0 && (Date.now() - loadStartedAt > 8000);

  // Clear loadStartedAt when loading finishes
  useEffect(() => {
    if (!footballLoading && loadStartedAt !== null) {
      setLoadStartedAt(null);
    }
  }, [footballLoading, loadStartedAt]);

  // Adaptive polling: 15s when live matches exist, 2 min otherwise
  const hasLive = footballMatches.some(m => m.status === 'live');
  const pollInterval = hasLive ? 15 * 1000 : 120 * 1000;
  const hasFetchedOnce = footballMatches.length > 0 || footballError !== null;

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

  // Pull-to-refresh integration
  const { pullDistance, isRefreshing, pullRef } = usePullRefresh({
    onRefresh: handleRetry,
    threshold: 60,
  });

  // Compute date keys for all tabs on-demand
  const dateKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    for (const tab of ALL_DATE_TABS) {
      keys[tab] = getDateForTab(tab);
    }
    return keys;
  }, []);

  // On-demand fetch when user switches to a date tab that has no matches
  useEffect(() => {
    const dateKey = dateKeys[selectedDate];
    if (!dateKey) return;
    const hasMatchesForDate = footballMatches.some((m) => isMatchOnDate(m.matchDate, dateKey));
    if (!hasMatchesForDate && !footballLoading) {
      fetchFootballMatches([dateKey]);
    }
  }, [selectedDate, dateKeys, footballMatches, footballLoading, fetchFootballMatches]);

  // Filter matches by selected date tab — live matches always show regardless of date
  const dateKey = dateKeys[selectedDate] || getDateForTab('day0');
  const dateFilteredMatches = useMemo(
    () => footballMatches.filter((m) => m.status === 'live' || isMatchOnDate(m.matchDate, dateKey)),
    [footballMatches, dateKey]
  );

  // Extract unique competitions from the current day's matches
  const uniqueCompetitions = useMemo(() => {
    const comps = new Set<string>();
    dateFilteredMatches.forEach((m) => {
      if (m.competition) comps.add(m.competition);
    });
    return Array.from(comps).sort();
  }, [dateFilteredMatches]);

  // Apply competition filter on top of date filter
  const filteredMatches = useMemo(
    () => selectedCompetition
      ? dateFilteredMatches.filter((m) => m.competition === selectedCompetition || m.status === 'live')
      : dateFilteredMatches,
    [dateFilteredMatches, selectedCompetition]
  );

  // Reset competition filter when it no longer exists in the current filtered matches
  useEffect(() => {
    if (selectedCompetition && !uniqueCompetitions.includes(selectedCompetition)) {
      setSelectedCompetition('');
    }
  }, [selectedCompetition, uniqueCompetitions, setSelectedCompetition]);

  // Count per tab — only for tabs that have been fetched
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of ALL_DATE_TABS) {
      const dk = dateKeys[tab];
      if (dk) {
        counts[tab] = footballMatches.filter((m) => m.status !== 'live' && isMatchOnDate(m.matchDate, dk)).length;
      }
    }
    return counts;
  }, [footballMatches, dateKeys]);

  const liveMatches = filteredMatches.filter((m) => m.status === 'live');
  const upcomingMatches = filteredMatches.filter((m) => m.status === 'upcoming');
  const finishedMatches = filteredMatches.filter((m) => m.status === 'finished');

  // Find the next upcoming match across ALL dates (not just selected date)
  const nextMatch = useMemo(() => {
    const now = new Date();
    const upcoming = footballMatches
      .filter((m) => m.status === 'upcoming' && m.matchDate && new Date(m.matchDate) > now)
      .sort((a, b) => {
        const dateA = a.matchDate ? new Date(a.matchDate).getTime() : Infinity;
        const dateB = b.matchDate ? new Date(b.matchDate).getTime() : Infinity;
        return dateA - dateB;
      });
    return upcoming[0] || null;
  }, [footballMatches]);

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

  // Build tab info array with compact display data
  const dateTabs = useMemo(() => {
    return ALL_DATE_TABS.map((tab) => {
      const offset = parseInt(tab.replace('day', ''), 10);
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const ymd = formatDateYMD(d);
      const isToday = offset === 0;
      const isTomorrow = offset === 1;
      const isPast = offset < 0;

      // Compact label: day number
      const dayNum = d.getDate();
      // Mini weekday
      const miniDay = getMiniWeekday(d, language);

      // Month label (show when it's the 1st of the month or today)
      const isFirstOfMonth = d.getDate() === 1;
      const monthNames = translations[language].dates.monthsLong;
      const monthLabel = isFirstOfMonth ? monthNames[d.getMonth()] : '';

      return {
        key: tab,
        offset,
        dateObj: d,
        ymd,
        isToday,
        isTomorrow,
        isPast,
        dayNum,
        miniDay,
        monthLabel,
        count: tabCounts[tab] || 0,
      };
    });
  }, [tabCounts, language]);

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
    if (idx === 0) return formatLong(new Date(), language);
    if (idx === 1) return `${t(language, 'common.tomorrow')} — ${formatShort(selectedDateObj, language)}`;
    if (idx === -1) return `${formatShort(selectedDateObj, language)}`;
    return formatLong(selectedDateObj, language);
  }, [selectedDate, selectedDateObj, language]);

  // Next match countdown string
  const nextMatchCountdown = useMemo(() => {
    if (!nextMatch?.matchDate) return '';
    return formatCountdown(new Date(nextMatch.matchDate), language);
  }, [nextMatch, language]);

  // ─── Loading state (max 8 seconds, then show empty state) ─────────────────
  if (footballLoading && footballMatches.length === 0 && !loadingTimeout) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-green-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 animate-ping opacity-60" />
        </div>
        <p className="text-base font-semibold mb-1">{t(language, 'common.loadingMatches')}</p>
        <p className="text-sm text-muted-foreground/60">...</p>
        <div className="flex items-center gap-1.5 mt-4">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  // Error state
  if (footballError && footballMatches.length === 0 && !loadingTimeout) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <WifiOff className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{t(language, 'errors.cannotLoad')}</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">{footballError}</p>
        <Button onClick={handleRetry} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
          <RefreshCw className="h-4 w-4" />
          {t(language, 'common.retry')}
        </Button>
      </div>
    );
  }

  // When loading timed out or no matches at all — show empty state with next match
  const showEmptyState = filteredMatches.length === 0 && (footballMatches.length > 0 || loadingTimeout || footballError);

  return (
    <div className="space-y-5 pb-4" ref={pullRef}>
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center transition-all duration-150 ease-out overflow-hidden"
          style={{ height: `${isRefreshing ? 40 : pullDistance}px`, opacity: Math.min(pullDistance / 40, 1) }}
        >
          <div className="flex items-center gap-2 text-green-500">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-xs font-medium">
              {isRefreshing
                ? t(language, 'standings.updating')
                : pullDistance >= 60
                  ? t(language, 'common.retry')
                  : '↓'
              }
            </span>
          </div>
        </div>
      )}

      {/* Date Tab Selector - Scrollable calendar with 34 days */}
      <div className="relative">
        {/* Left fade gradient */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-muted/40 to-transparent z-10 pointer-events-none rounded-l-xl" />
        {/* Right fade gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-muted/40 to-transparent z-10 pointer-events-none rounded-r-xl" />

        <div
          ref={tabScrollRef}
          className="flex items-stretch gap-0.5 overflow-x-auto bg-muted/40 rounded-xl p-1.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dateTabs.map((tab) => {
            const isActive = selectedDate === tab.key;
            const isToday = tab.offset === 0;
            const isTomorrow = tab.offset === 1;

            return (
              <button
                key={tab.key}
                data-active={isActive}
                onClick={() => setSelectedDate(tab.key)}
                className={`flex-shrink-0 flex flex-col items-center justify-center px-2 py-1.5 rounded-lg text-sm font-medium transition-all relative min-w-[48px] ${
                  isActive
                    ? 'bg-green-500/15 text-green-600 shadow-sm'
                    : isToday
                      ? 'text-green-500/80 hover:bg-green-500/10'
                      : tab.isPast
                        ? 'text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {/* Month separator label on 1st of month */}
                {tab.monthLabel && (
                  <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${
                    isActive ? 'text-green-500/70' : 'text-muted-foreground/40'
                  }`}>
                    {tab.monthLabel.substring(0, 3)}
                  </span>
                )}

                {/* Day number - larger for today */}
                <span className={`font-bold leading-none ${
                  isToday ? 'text-[16px]' : 'text-[14px]'
                }`}>
                  {tab.dayNum}
                </span>

                {/* Mini weekday label */}
                <span className={`text-[9px] leading-none mt-0.5 ${
                  isActive ? 'text-green-500/80 font-semibold' : isToday ? 'text-green-500/60 font-semibold' : 'text-muted-foreground/50'
                }`}>
                  {isToday
                    ? t(language, 'common.today').substring(0, 3)
                    : isTomorrow
                      ? t(language, 'common.tomorrow').substring(0, 3)
                      : tab.miniDay
                  }
                </span>

                {/* Match count badge */}
                {tab.count > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-[8px] font-bold ${
                    isActive
                      ? 'bg-green-500 text-white'
                      : isToday
                        ? 'bg-green-500/60 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}

                {/* Active indicator */}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-green-500" />
                )}

                {/* Today dot indicator (when not active) */}
                {isToday && !isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Competition Filter Bar */}
      {uniqueCompetitions.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setSelectedCompetition('')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              selectedCompetition === ''
                ? 'bg-green-500/15 text-green-600 border border-green-500/30'
                : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <Filter className="h-3 w-3" />
            {t(language, 'common.all')}
          </button>
          {uniqueCompetitions.map((comp) => (
            <button
              key={comp}
              onClick={() => setSelectedCompetition(comp === selectedCompetition ? '' : comp)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                selectedCompetition === comp
                  ? 'bg-green-500/15 text-green-600 border border-green-500/30'
                  : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {comp}
            </button>
          ))}
        </div>
      )}

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
                  {liveMatches.length} {t(language, 'common.live').toLowerCase()}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {upcomingMatches.length + finishedMatches.length} {t(language, 'nav.matches').toLowerCase()}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">
            {t(language, 'common.update')} {countdownStr}
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
            {t(language, 'common.retry')}
          </Button>
        </div>
      )}

      {/* ─── No matches state with next match info ─── */}
      {showEmptyState && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold mb-1">{t(language, 'common.noMatchesNow')}</h3>
          <p className="text-sm text-muted-foreground/60 mb-6">
            {t(language, 'common.checkBackLater')}
          </p>

          {/* Next upcoming match card */}
          {nextMatch && (
            <div className="w-full max-w-sm rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="h-4 w-4 text-green-500" />
                <span className="text-sm font-semibold text-green-500">{t(language, 'common.nextMatch')}</span>
                {nextMatchCountdown && (
                  <span className="ml-auto text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                    {nextMatchCountdown}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {nextMatch.homeLogo && (
                      <img src={nextMatch.homeLogo} alt="" className="w-6 h-6 object-contain" />
                    )}
                    <span className="text-sm font-semibold truncate">{nextMatch.homeTeam}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-0.5 px-2">
                  <span className="text-[10px] text-muted-foreground/60 uppercase font-bold">
                    {t(language, 'common.vs')}
                  </span>
                  {nextMatch.matchDate && (
                    <span className="text-xs font-bold text-green-500">
                      {formatMatchTime(nextMatch.matchDate, language)}
                    </span>
                  )}
                </div>

                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    {nextMatch.awayLogo && (
                      <img src={nextMatch.awayLogo} alt="" className="w-6 h-6 object-contain" />
                    )}
                    <span className="text-sm font-semibold truncate">{nextMatch.awayTeam}</span>
                  </div>
                </div>
              </div>

              {nextMatch.competition && (
                <div className="mt-3 pt-2 border-t border-border/20 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/50 font-medium">{nextMatch.competition}</span>
                  {nextMatch.matchDate && (
                    <span className="text-[10px] text-muted-foreground/50">
                      {formatShort(new Date(nextMatch.matchDate), language)}
                    </span>
                  )}
                </div>
              )}

              {/* Navigate to next match day */}
              {nextMatch.matchDate && (() => {
                const nextMatchYMD = formatDateYMD(new Date(nextMatch.matchDate));
                const nextTab = ALL_DATE_TABS.find(tab => dateKeys[tab] === nextMatchYMD);
                if (nextTab && nextTab !== selectedDate) {
                  return (
                    <button
                      onClick={() => setSelectedDate(nextTab)}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-semibold hover:bg-green-500/20 transition-all"
                    >
                      {t(language, 'common.nextMatch')}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* ===== LIVE MATCHES ===== */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/15">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-500 uppercase tracking-wide">{t(language, 'common.live')}</span>
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
              <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">{t(language, 'common.finished')}</span>
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
        {t(language, 'common.update')} {hasLive ? '15s' : '2 min'}{hasLive ? ` (${t(language, 'common.live').toLowerCase()})` : ''}
      </div>
    </div>
  );
}
