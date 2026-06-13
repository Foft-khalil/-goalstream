'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { formatLong } from '@/lib/date-utils';
import { Language } from '@/lib/i18n';
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

/** Check if a match's ISO date falls on a given YYYYMMDD date */
function isMatchOnDate(matchDate: string | null, ymd: string): boolean {
  if (!matchDate) return false;
  try {
    const d = new Date(matchDate);
    return formatDateYMD(d) === ymd;
  } catch(_e) {
    return false;
  }
}

/** Get today's YYYYMMDD */
function getTodayYMD(): string {
  return formatDateYMD(new Date());
}

/** Date header label for a given YYYYMMDD */
function getDateLabel(ymd: string, language: Language): string {
  const today = getTodayYMD();
  const tomorrow = formatDateYMD(new Date(Date.now() + 86400000));
  const yesterday = formatDateYMD(new Date(Date.now() - 86400000));

  if (ymd === today) return t(language, 'common.today');
  if (ymd === tomorrow) return t(language, 'common.tomorrow');
  if (ymd === yesterday) {
    const d = new Date(Date.now() - 86400000);
    return formatLong(d, language);
  }

  const year = parseInt(ymd.substring(0, 4), 10);
  const month = parseInt(ymd.substring(4, 6), 10) - 1;
  const day = parseInt(ymd.substring(6, 8), 10);
  const d = new Date(year, month, day);
  return formatLong(d, language);
}

export default function BasketballMatches() {
  const {
    basketballMatches,
    basketballLoading,
    basketballError,
    basketballLastUpdated,
    fetchBasketballMatches,
    language,
  } = useAppStore();

  const [countdown, setCountdown] = useState(60);
  const lastUpdatedRef = useRef<string | null>(null);

  // Infinite scroll state
  const [visibleCount, setVisibleCount] = useState(20);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const LOAD_INCREMENT = 15;

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => prev + LOAD_INCREMENT);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

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

  // ─── Group ALL matches by date ────────────────────────────────────
  const matchesByDate = useMemo(() => {
    const groups: { ymd: string; label: string; matches: typeof basketballMatches; isToday: boolean; isPast: boolean }[] = [];
    const todayYMD = getTodayYMD();
    const dateMap = new Map<string, typeof basketballMatches>();

    const nonLiveMatches = basketballMatches.filter(m => m.status !== 'live');

    nonLiveMatches.forEach(match => {
      const ymd = match.matchDate ? formatDateYMD(new Date(match.matchDate)) : 'unknown';
      if (!dateMap.has(ymd)) dateMap.set(ymd, []);
      dateMap.get(ymd)!.push(match);
    });

    const sortedDates = Array.from(dateMap.keys()).sort();

    for (const ymd of sortedDates) {
      const matches = dateMap.get(ymd)!;
      const isToday = ymd === todayYMD;
      const isPast = ymd < todayYMD;
      const label = getDateLabel(ymd, language);

      groups.push({ ymd, label, matches, isToday, isPast });
    }

    return groups;
  }, [basketballMatches, language]);

  // Live matches (always shown at top)
  const liveMatches = useMemo(
    () => basketballMatches.filter((m) => m.status === 'live'),
    [basketballMatches]
  );

  // Apply infinite scroll: count total non-live matches
  const totalNonLiveMatches = useMemo(() => {
    let total = 0;
    for (const group of matchesByDate) {
      total += group.matches.length;
    }
    return total;
  }, [matchesByDate]);

  const visibleMatchesByDate = useMemo(() => {
    let remaining = visibleCount;
    const result: typeof matchesByDate = [];

    for (const group of matchesByDate) {
      if (remaining <= 0) break;
      const take = Math.min(group.matches.length, remaining);
      result.push({
        ...group,
        matches: group.matches.slice(0, take),
      });
      remaining -= take;
    }

    return result;
  }, [matchesByDate, visibleCount]);

  const hasMoreMatches = visibleCount < totalNonLiveMatches;

  const countdownStr = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;

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

  const totalMatches = basketballMatches.length;

  return (
    <div className="space-y-5 pb-4">
      {/* Header with live count + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {liveMatches.length > 0 ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-orange-500">{liveMatches.length} {t(language, 'common.live').toLowerCase()}</span>
              </>
            ) : (
              <>
                <span>🏀</span>
                <span>{totalMatches} {t(language, 'nav.matches').toLowerCase()}</span>
              </>
            )}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            {liveMatches.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {totalMatches - liveMatches.length} {t(language, 'nav.matches').toLowerCase()}
              </span>
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

      {/* No matches state */}
      {basketballMatches.length === 0 && (
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

      {/* ===== LIVE MATCHES (always at top) ===== */}
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

      {/* ===== MATCHES GROUPED BY DATE ===== */}
      {visibleMatchesByDate.map((group) => {
        const upcoming = group.matches.filter(m => m.status === 'upcoming');
        const finished = group.matches.filter(m => m.status === 'finished');

        const upcomingByComp = upcoming.reduce<Record<string, typeof upcoming>>((acc, match) => {
          const comp = match.competition || 'Basketball';
          if (!acc[comp]) acc[comp] = [];
          acc[comp].push(match);
          return acc;
        }, {});

        const finishedByComp = finished.reduce<Record<string, typeof finished>>((acc, match) => {
          const comp = match.competition || 'Basketball';
          if (!acc[comp]) acc[comp] = [];
          acc[comp].push(match);
          return acc;
        }, {});

        return (
          <section key={group.ymd}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-3 sticky top-14 z-10 bg-background/90 backdrop-blur-sm py-1 -mx-1 px-1">
              <div className="flex items-center gap-2">
                {group.isToday ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span className="text-sm font-bold text-orange-500">{group.label}</span>
                  </div>
                ) : group.isPast ? (
                  <span className="text-sm font-semibold text-muted-foreground/60">{group.label}</span>
                ) : (
                  <span className="text-sm font-semibold text-foreground/80">{group.label}</span>
                )}
                <span className="text-[10px] text-muted-foreground/40 font-medium">
                  {group.matches.length} {t(language, 'nav.matches').toLowerCase()}
                </span>
              </div>
              <div className="h-px flex-1 bg-border/30" />
            </div>

            {/* Upcoming matches by competition */}
            {Object.entries(upcomingByComp).map(([competition, matches]) => (
              <div key={competition} className="mb-3">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="h-px flex-1 bg-border/30" />
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted/50 border border-border/20">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span className="text-[11px] font-semibold text-muted-foreground">{competition}</span>
                    <span className="text-[9px] text-muted-foreground/40">{matches.length}</span>
                  </div>
                  <div className="h-px flex-1 bg-border/30" />
                </div>
                <div className="space-y-2">
                  {matches.map((match) => (
                    <BasketballMatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            ))}

            {/* Finished matches by competition */}
            {Object.keys(finishedByComp).length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 border border-border/20">
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wide">{t(language, 'common.finished')}</span>
                    <span className="text-[9px] text-muted-foreground/30">{finished.length}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(finishedByComp).map(([competition, matches]) => (
                    <div key={competition}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-medium text-muted-foreground/30">{competition}</span>
                        <div className="h-px flex-1 bg-border/15" />
                      </div>
                      {matches.map((match) => (
                        <BasketballMatchCard key={match.id} match={match} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {/* Load more sentinel & match count */}
      {totalNonLiveMatches > 20 && (
        <div className="flex flex-col items-center gap-2 pt-2 pb-1">
          <div ref={loadMoreRef} className="h-1" />
          {hasMoreMatches && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500/60" />
              <span className="text-xs text-muted-foreground/60">
                {Math.min(visibleCount, totalNonLiveMatches)} / {totalNonLiveMatches} {t(language, 'nav.matches').toLowerCase()}
              </span>
            </div>
          )}
          {!hasMoreMatches && totalNonLiveMatches > 20 && (
            <span className="text-xs text-muted-foreground/40">
              {totalNonLiveMatches} {t(language, 'nav.matches').toLowerCase()}
            </span>
          )}
        </div>
      )}

      {/* Footer info */}
      <div className="text-center text-[10px] text-muted-foreground/30 pt-1">
        NBA · NCAA · EuroLeague · WNBA — {t(language, 'common.update')} {hasLive ? '15s' : '2 min'}{hasLive ? ` (${t(language, 'common.live').toLowerCase()})` : ''}
      </div>
    </div>
  );
}
