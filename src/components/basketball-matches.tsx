'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useAppStore, DateTab } from '@/lib/store';
import { t } from '@/lib/i18n';
import { formatShort, formatLong } from '@/lib/date-utils';
import { translations, Language } from '@/lib/i18n';
import BasketballMatchCard from '@/components/basketball-match-card';
import { Loader2, Calendar, RefreshCw, AlertCircle, Clock, Wifi, WifiOff, Sparkles, ChevronRight } from 'lucide-react';
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

/** Get very short weekday label (1-2 chars) for compact display */
function getMiniWeekday(date: Date, lang: Language): string {
  const weekdays = translations[lang].dates.weekdaysShort;
  const day = weekdays[date.getDay()];
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

export default function BasketballMatches() {
  const {
    basketballMatches,
    basketballLoading,
    basketballError,
    basketballLastUpdated,
    basketballDates,
    selectedBasketballDate,
    setSelectedBasketballDate,
    fetchBasketballMatches,
    language,
  } = useAppStore();

  const [countdown, setCountdown] = useState(60);
  const lastUpdatedRef = useRef<string | null>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  // Initial fetch on mount (only if no data yet — page.tsx pre-fetches today)
  const hasFetchedInitial = basketballMatches.length > 0 || basketballError !== null;
  useEffect(() => {
    if (!hasFetchedInitial) {
      fetchBasketballMatches();
    }
  }, [fetchBasketballMatches, hasFetchedInitial]);

  // Adaptive polling: 15s when live matches exist, 2 min otherwise
  const hasLive = basketballMatches.some(m => m.status === 'live');
  const pollInterval = hasLive ? 15 * 1000 : 120 * 1000;

  useEffect(() => {
    const interval = setInterval(() => {
      fetchBasketballMatches();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchBasketballMatches, pollInterval]);

  useEffect(() => {
    if (basketballLastUpdated !== lastUpdatedRef.current) {
      lastUpdatedRef.current = basketballLastUpdated;
    }
    const startTime = Date.now();
    const duration = hasLive ? 15 : 120;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setCountdown(Math.max(0, duration - elapsed));
    }, 1000);
    return () => clearInterval(timer);
  }, [basketballLastUpdated, hasLive]);

  const handleRetry = useCallback(() => {
    fetchBasketballMatches();
    setCountdown(60);
  }, [fetchBasketballMatches]);

  // Compute date keys for all tabs on-demand
  const dateKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    for (const tab of ALL_DATE_TABS) {
      keys[tab] = getDateForTab(tab);
    }
    return keys;
  }, []);

  // On-demand fetch when user switches to a date tab that has no matches
  const hasFetchedOnce = basketballMatches.length > 0 || basketballError !== null;
  useEffect(() => {
    if (!hasFetchedOnce) return;
    const dateKeyForTab = dateKeys[selectedBasketballDate];
    if (!dateKeyForTab) return;
    const hasMatchesForDate = basketballMatches.some((m) => isMatchOnDate(m.matchDate, dateKeyForTab));
    if (!hasMatchesForDate && !basketballLoading) {
      fetchBasketballMatches([dateKeyForTab]);
    }
  }, [selectedBasketballDate, dateKeys, basketballMatches, basketballLoading, fetchBasketballMatches, hasFetchedOnce]);

  // Filter matches by selected date tab — live matches always show regardless of date
  const dateKey = dateKeys[selectedBasketballDate] || getDateForTab('day0');
  const filteredMatches = useMemo(
    () => basketballMatches.filter((m) => m.status === 'live' || isMatchOnDate(m.matchDate, dateKey)),
    [basketballMatches, dateKey]
  );

  // Count per tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of ALL_DATE_TABS) {
      const dk = dateKeys[tab];
      if (dk) {
        counts[tab] = basketballMatches.filter((m) => m.status !== 'live' && isMatchOnDate(m.matchDate, dk)).length;
      }
    }
    return counts;
  }, [basketballMatches, dateKeys]);

  const liveMatches = filteredMatches.filter((m) => m.status === 'live');
  const upcomingMatches = filteredMatches.filter((m) => m.status === 'upcoming');
  const finishedMatches = filteredMatches.filter((m) => m.status === 'finished');

  // Group upcoming matches by competition
  const competitionGroups = upcomingMatches.reduce<Record<string, typeof upcomingMatches>>((acc, match) => {
    const comp = match.competition || 'Basketball';
    if (!acc[comp]) acc[comp] = [];
    acc[comp].push(match);
    return acc;
  }, {});

  // Group finished matches by competition
  const finishedGroups = finishedMatches.reduce<Record<string, typeof finishedMatches>>((acc, match) => {
    const comp = match.competition || 'Basketball';
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
      const isToday = offset === 0;
      const isTomorrow = offset === 1;
      const isPast = offset < 0;

      const dayNum = d.getDate();
      const miniDay = getMiniWeekday(d, language);
      const isFirstOfMonth = d.getDate() === 1;
      const monthNames = translations[language].dates.monthsLong;
      const monthLabel = isFirstOfMonth ? monthNames[d.getMonth()] : '';

      return {
        key: tab,
        offset,
        dateObj: d,
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
  }, [selectedBasketballDate]);

  // Get the formatted date for the header
  const headerDateStr = useMemo(() => {
    const idx = parseInt(selectedBasketballDate.replace('day', ''), 10);
    if (idx === 0) return t(language, 'common.today');
    if (idx === 1) return t(language, 'common.tomorrow');
    const d = new Date();
    d.setDate(d.getDate() + idx);
    return formatLong(d, language);
  }, [selectedBasketballDate, language]);

  // Loading state
  if (basketballLoading && basketballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 animate-ping opacity-60" />
        </div>
        <p className="text-base font-semibold mb-1">{t(language, 'common.loading')}</p>
        <p className="text-sm text-muted-foreground/60">...</p>
        <div className="flex items-center gap-1.5 mt-4">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  // Error state
  if (basketballError && basketballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <WifiOff className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{t(language, 'errors.cannotLoad')}</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">{basketballError}</p>
        <Button onClick={handleRetry} size="sm" className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
          <RefreshCw className="h-4 w-4" />
          {t(language, 'common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Date Tab Selector - Orange theme, scrollable calendar with 34 days */}
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
            const isActive = selectedBasketballDate === tab.key;
            const isToday = tab.offset === 0;

            return (
              <button
                key={tab.key}
                data-active={isActive}
                onClick={() => setSelectedBasketballDate(tab.key)}
                className={`flex-shrink-0 flex flex-col items-center justify-center px-2 py-1.5 rounded-lg text-sm font-medium transition-all relative min-w-[48px] ${
                  isActive
                    ? 'bg-orange-500/15 text-orange-600 shadow-sm'
                    : isToday
                      ? 'text-orange-500/80 hover:bg-orange-500/10'
                      : tab.isPast
                        ? 'text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {/* Month separator label on 1st of month */}
                {tab.monthLabel && (
                  <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${
                    isActive ? 'text-orange-500/70' : 'text-muted-foreground/40'
                  }`}>
                    {tab.monthLabel.substring(0, 3)}
                  </span>
                )}

                {/* Day number */}
                <span className={`font-bold leading-none ${
                  isToday ? 'text-[16px]' : 'text-[14px]'
                }`}>
                  {tab.dayNum}
                </span>

                {/* Mini weekday label */}
                <span className={`text-[9px] leading-none mt-0.5 ${
                  isActive ? 'text-orange-500/80 font-semibold' : isToday ? 'text-orange-500/60 font-semibold' : 'text-muted-foreground/50'
                }`}>
                  {isToday
                    ? t(language, 'common.today').substring(0, 3)
                    : tab.offset === 1
                      ? t(language, 'common.tomorrow').substring(0, 3)
                      : tab.miniDay
                  }
                </span>

                {/* Match count badge */}
                {tab.count > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-[8px] font-bold ${
                    isActive
                      ? 'bg-orange-500 text-white'
                      : isToday
                        ? 'bg-orange-500/60 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}

                {/* Active indicator */}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-orange-500" />
                )}

                {/* Today dot indicator (when not active) */}
                {isToday && !isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-500" />
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
            <span>🏀</span>
            {headerDateStr}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            {liveMatches.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-sm text-orange-500 font-semibold">
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
            disabled={basketballLoading}
            className="h-8 w-8 rounded-lg border-border/50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${basketballLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {basketballError && basketballMatches.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{basketballError}</span>
          <Button variant="ghost" size="sm" onClick={handleRetry} className="ml-auto h-5 px-2 text-[10px] text-red-400">
            {t(language, 'common.retry')}
          </Button>
        </div>
      )}

      {/* No matches for this date */}
      {filteredMatches.length === 0 && basketballMatches.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <span className="text-3xl">🏀</span>
          </div>
          <h3 className="text-base font-semibold mb-1">{t(language, 'common.noMatchesNow')}</h3>
          <p className="text-sm text-muted-foreground/60">
            {t(language, 'common.checkBackLater')}
          </p>
        </div>
      )}

      {/* ===== LIVE MATCHES ===== */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/15">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-xs font-bold text-orange-500 uppercase tracking-wide">{t(language, 'common.live')}</span>
            </div>
          </div>
          <div className="space-y-3">
            {liveMatches.map((match) => (
              <BasketballMatchCard key={match.id} match={match} />
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
              <BasketballMatchCard key={match.id} match={match} />
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
                  <BasketballMatchCard key={match.id} match={match} />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer info */}
      <div className="text-center text-[10px] text-muted-foreground/30 pt-1">
        NBA · NCAA · EuroLeague · WNBA — {t(language, 'common.update')} {hasLive ? '15s' : '2 min'}{hasLive ? ` (${t(language, 'common.live').toLowerCase()})` : ''}
      </div>
    </div>
  );
}
