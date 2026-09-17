'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { formatShort, formatLong } from '@/lib/date-utils';
import { Language } from '@/lib/i18n';
import BasketballMatchCard from '@/components/basketball-match-card';
import {
  Loader2, Calendar, RefreshCw, AlertCircle, WifiOff,
  ChevronLeft, ChevronRight, ChevronDown, Filter,
  Radio, Clock, CheckCircle2, CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { useHydrated } from '@/hooks/use-hydrated';

/* ─── Date helpers ────────────────────────────────────────────────────── */

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function getTodayYMD(): string {
  return formatDateYMD(new Date());
}

function ymdForOffset(offset: number): string {
  return formatDateYMD(new Date(Date.now() + offset * 86400000));
}

function offsetFromYMD(ymd: string): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = [parseInt(ymd.slice(0, 4)), parseInt(ymd.slice(4, 6)) - 1, parseInt(ymd.slice(6, 8))];
  const target = new Date(y, m, d);
  target.setHours(0, 0, 0, 0);
  const offset = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (offset < -3 || offset > 14) return null;
  return offset;
}

function isMatchOnDate(matchDate: string | null, ymd: string): boolean {
  if (!matchDate) return false;
  try {
    return formatDateYMD(new Date(matchDate)) === ymd;
  } catch (_e) {
    return false;
  }
}

function dayLabel(offset: number, language: Language): string {
  if (offset === 0) return t(language, 'common.today');
  if (offset === 1) return t(language, 'common.tomorrow');
  if (offset === -1) return t(language, 'common.yesterday');
  const d = new Date(Date.now() + offset * 86400000);
  return formatLong(d, language);
}

function dayChipLabel(offset: number, language: Language): string {
  if (offset === 0) return t(language, 'common.today');
  if (offset === 1) return t(language, 'common.tomorrow');
  if (offset === -1) return t(language, 'common.yesterday');
  const d = new Date(Date.now() + offset * 86400000);
  return formatShort(d, language);
}

function dayDateNumber(offset: number, language: Language): string {
  const d = new Date(Date.now() + offset * 86400000);
  return formatLong(d, language);
}

const MIN_OFFSET = -3;
const MAX_OFFSET = 14;

/* ─── Component ────────────────────────────────────────────────────────── */

export default function BasketballMatches() {
  const {
    basketballMatches,
    basketballLoading,
    basketballError,
    basketballLastUpdated,
    selectedBasketballDate,
    setSelectedBasketballDate,
    fetchBasketballMatches,
    language,
  } = useAppStore();

  /* ── State ─────────────────────────────────────────────────────────── */
  const [countdown, setCountdown] = useState(60);
  const lastUpdatedRef = useRef<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [visibleUpcoming, setVisibleUpcoming] = useState(30);
  const [visibleFinished, setVisibleFinished] = useState(15);
  const [selectedCompetition, setSelectedCompetitionLocal] = useState('');

  const loadMoreRef = useRef<HTMLDivElement>(null);

  /* ── Selected day offset ──────────────────────────────────────────── */
  const selectedOffset = useMemo(() => {
    if (!selectedBasketballDate) return 0;
    const m = /^day(-?\d+)$/.exec(selectedBasketballDate);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= MIN_OFFSET && n <= MAX_OFFSET) return n;
    }
    return 0;
  }, [selectedBasketballDate]);

  const setSelectedOffset = useCallback((offset: number) => {
    const clamped = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, offset));
    setSelectedBasketballDate(`day${clamped}`);
    setShowFinished(false);
    setVisibleUpcoming(30);
    setVisibleFinished(15);
  }, [setSelectedBasketballDate]);

  /* ── Adapt polling ────────────────────────────────────────────────── */
  const hasLive = basketballMatches.some((m) => m.status === 'live');
  const pollInterval = hasLive ? 15 * 1000 : 120 * 1000;

  useEffect(() => {
    const interval = setInterval(() => {
      fetchBasketballMatches([getTodayYMD()]);
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
    fetchBasketballMatches([getTodayYMD()]);
    setCountdown(60);
  }, [fetchBasketballMatches]);

  /* ── Match partitioning ───────────────────────────────────────────── */
  const liveMatches = useMemo(
    () => basketballMatches.filter((m) => m.status === 'live'),
    [basketballMatches]
  );

  const selectedYMD = useMemo(() => ymdForOffset(selectedOffset), [selectedOffset]);

  const dayMatches = useMemo(
    () => basketballMatches.filter((m) => isMatchOnDate(m.matchDate, selectedYMD) && m.status !== 'live'),
    [basketballMatches, selectedYMD]
  );

  const dayUpcoming = useMemo(
    () => dayMatches
      .filter((m) => m.status === 'upcoming')
      .sort((a, b) => (a.matchDate ?? '').localeCompare(b.matchDate ?? '')),
    [dayMatches]
  );

  const dayFinished = useMemo(
    () => dayMatches
      .filter((m) => m.status === 'finished')
      .sort((a, b) => (b.matchDate ?? '').localeCompare(a.matchDate ?? '')),
    [dayMatches]
  );

  /* ── Competition filter ───────────────────────────────────────────── */
  const uniqueCompetitions = useMemo(() => {
    const comps = new Set<string>();
    basketballMatches.forEach((m) => {
      if (m.competition) comps.add(m.competition);
    });
    return Array.from(comps).sort();
  }, [basketballMatches]);

  const filterFn = useCallback(
    (m: typeof basketballMatches[number]) => !selectedCompetition || m.competition === selectedCompetition,
    [selectedCompetition]
  );

  const filteredLive = useMemo(() => liveMatches.filter(filterFn), [liveMatches, filterFn]);
  const filteredUpcoming = useMemo(() => dayUpcoming.filter(filterFn), [dayUpcoming, filterFn]);
  const filteredFinished = useMemo(() => dayFinished.filter(filterFn), [dayFinished, filterFn]);

  /* ── Infinite scroll for upcoming ────────────────────────────────── */
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleUpcoming((p) => p + 20);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [selectedOffset, selectedCompetition]);

  /* ── Derived ──────────────────────────────────────────────────────── */
  const countdownStr = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;
  const dayHasAnything = filteredLive.length + filteredUpcoming.length + filteredFinished.length > 0;

  /* ── Loading state ────────────────────────────────────────────────── */
  if (basketballLoading && basketballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/8 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 animate-ping opacity-30" />
        </div>
        <p className="text-sm font-bold mb-1">{t(language, 'common.loadingMatches')}</p>
        <div className="flex items-center gap-1.5 mt-3">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  if (basketballError && basketballMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/8 flex items-center justify-center mb-4">
          <WifiOff className="h-7 w-7 text-red-400/70" />
        </div>
        <h3 className="text-base font-bold mb-2">{t(language, 'errors.cannotLoad')}</h3>
        <p className="text-sm text-muted-foreground/40 mb-5 max-w-xs">{basketballError}</p>
        <Button onClick={handleRetry} size="sm" className="gap-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-600/15">
          <RefreshCw className="h-4 w-4" />
          {t(language, 'common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* === DATE NAVIGATION === */}
      <DateNavigationBar
        selectedOffset={selectedOffset}
        onSelect={setSelectedOffset}
        language={language}
      />

      {/* === COMPETITION FILTER === */}
      {uniqueCompetitions.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide" style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}>
          <button
            onClick={() => setSelectedCompetitionLocal('')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-200 whitespace-nowrap ${
              selectedCompetition === ''
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/15'
                : 'bg-secondary/30 dark:bg-white/[0.02] text-muted-foreground/45 border border-border/20 dark:border-white/[0.03] hover:bg-secondary/50 dark:hover:bg-white/[0.04] hover:text-foreground'
            }`}
          >
            <Filter className="h-3 w-3" />
            {t(language, 'common.all')}
          </button>
          {uniqueCompetitions.map((comp) => (
            <button
              key={comp}
              onClick={() => setSelectedCompetitionLocal(comp === selectedCompetition ? '' : comp)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-200 whitespace-nowrap ${
                selectedCompetition === comp
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/15'
                  : 'bg-secondary/30 dark:bg-white/[0.02] text-muted-foreground/45 border border-border/20 dark:border-white/[0.03] hover:bg-secondary/50 dark:hover:bg-white/[0.04] hover:text-foreground'
              }`}
            >
              {comp}
            </button>
          ))}
        </div>
      )}

      {/* === REFRESH HEADER === */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 font-medium">
          {filteredLive.length > 0 && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                {filteredLive.length} {t(language, 'common.live').toLowerCase()}
              </span>
              <span className="text-muted-foreground/30">·</span>
            </>
          )}
          <span>
            {filteredUpcoming.length + filteredFinished.length} {t(language, 'nav.matches').toLowerCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums font-medium">{countdownStr}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRetry}
            disabled={basketballLoading}
            className="h-7 w-7 rounded-xl border-border/20 dark:border-white/[0.04] bg-transparent dark:bg-transparent hover:bg-secondary/50 dark:hover:bg-white/[0.04]"
          >
            <RefreshCw className={`h-3 w-3 ${basketballLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* === ERROR BANNER === */}
      {basketballError && basketballMatches.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-400 glass-card">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{basketballError}</span>
          <Button variant="ghost" size="sm" onClick={handleRetry} className="ml-auto h-5 px-2 text-[10px] text-red-400 hover:bg-red-500/10">
            {t(language, 'common.retry')}
          </Button>
        </div>
      )}

      {/* === EMPTY STATE === */}
      {basketballMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary/30 dark:bg-white/[0.02] flex items-center justify-center mb-4 border border-border/20 dark:border-white/[0.03]">
            <Calendar className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-bold mb-1">{t(language, 'common.noMatchesNow')}</h3>
          <p className="text-xs text-muted-foreground/50">{t(language, 'common.checkBackLater')}</p>
        </div>
      )}

      {/* === LIVE SECTION === */}
      {filteredLive.length > 0 && (
        <Section
          icon={<Radio className="h-3.5 w-3.5 text-orange-400" />}
          accent="orange"
          label={t(language, 'common.liveNow')}
          count={filteredLive.length}
        >
          <div className="space-y-3">
            {filteredLive.map((match) => (
              <BasketballMatchCard key={match.id} match={match} />
            ))}
          </div>
        </Section>
      )}

      {/* === UPCOMING === */}
      {filteredUpcoming.length > 0 && (
        <Section
          icon={<Clock className="h-3.5 w-3.5 text-orange-400" />}
          accent="orange"
          label={selectedOffset === 0
            ? t(language, 'common.todayUpcoming')
            : selectedOffset > 0
              ? t(language, 'common.upcomingMatches')
              : t(language, 'common.dayMatches')}
          count={filteredUpcoming.length}
        >
          <div className="space-y-3">
            {filteredUpcoming.slice(0, visibleUpcoming).map((match) => (
              <BasketballMatchCard key={match.id} match={match} />
            ))}
          </div>
          {visibleUpcoming < filteredUpcoming.length && (
            <div ref={loadMoreRef} className="flex justify-center pt-2">
              <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-orange-400/40" />
                {Math.min(visibleUpcoming, filteredUpcoming.length)} / {filteredUpcoming.length}
              </span>
            </div>
          )}
        </Section>
      )}

      {/* === FINISHED (collapsed by default) === */}
      {filteredFinished.length > 0 && (
        <Section
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/60" />}
          accent="muted"
          label={t(language, 'common.finishedMatches')}
          count={filteredFinished.length}
          collapsible
          collapsed={!showFinished}
          onToggle={() => {
            setShowFinished((v) => !v);
            setVisibleFinished(15);
          }}
        >
          {showFinished && (
            <div className="space-y-3">
              {filteredFinished.slice(0, visibleFinished).map((match) => (
                <BasketballMatchCard key={match.id} match={match} />
              ))}
              {visibleFinished < filteredFinished.length && (
                <button
                  onClick={() => setVisibleFinished((v) => v + 30)}
                  className="w-full text-center py-2 text-[11px] font-semibold text-muted-foreground/60 hover:text-orange-400 transition-colors"
                >
                  + {filteredFinished.length - visibleFinished} {t(language, 'nav.matches').toLowerCase()}
                </button>
              )}
            </div>
          )}
        </Section>
      )}

      {/* === EMPTY STATE PER DAY === */}
      {!dayHasAnything && basketballMatches.length > 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary/30 dark:bg-white/[0.02] flex items-center justify-center mb-3 border border-border/20 dark:border-white/[0.03]">
            <CalendarDays className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-bold mb-1">{t(language, 'common.noMatchesDay')}</h3>
          <p className="text-xs text-muted-foreground/50">{dayDateNumber(selectedOffset, language)}</p>
        </div>
      )}

      {/* === FOOTER === */}
      <div className="text-center text-[10px] text-muted-foreground/60 pt-1 font-medium">
        {t(language, 'common.update')} {hasLive ? '15s' : '2 min'}{hasLive ? ` (${t(language, 'common.live').toLowerCase()})` : ''}
      </div>
    </div>
  );
}

/* ─── Section wrapper ──────────────────────────────────────────────────── */

function Section({
  icon, accent, label, count, children, collapsible = false, collapsed = false, onToggle,
}: {
  icon: React.ReactNode;
  accent: 'orange' | 'muted';
  label: string;
  count: number;
  children?: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const accentBg = accent === 'orange'
    ? 'bg-orange-500/8 border-orange-500/10'
    : 'bg-secondary/30 dark:bg-white/[0.02] border-border/20 dark:border-white/[0.03]';
  const accentText = accent === 'orange' ? 'text-orange-400' : 'text-muted-foreground/60';
  const accentLine = accent === 'orange' ? 'from-orange-500/15' : 'from-border/30 dark:from-white/[0.06]';

  return (
    <section>
      <button
        type="button"
        onClick={collapsible ? onToggle : undefined}
        disabled={!collapsible}
        className={`w-full flex items-center gap-2.5 mb-3 ${collapsible ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      >
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${accentBg}`}>
          {icon}
          <span className={`text-[10px] font-bold uppercase tracking-wider ${accentText}`}>{label}</span>
          <span className="text-[10px] text-muted-foreground/70 font-semibold">· {count}</span>
        </div>
        <div className={`h-px flex-1 bg-gradient-to-r ${accentLine} to-transparent`} />
        {collapsible && (
          <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        )}
      </button>
      {children}
    </section>
  );
}

/* ─── Date Navigation Bar ──────────────────────────────────────────────── */

function DateNavigationBar({
  selectedOffset, onSelect, language,
}: {
  selectedOffset: number;
  onSelect: (offset: number) => void;
  language: Language;
}) {
  const hydrated = useHydrated();
  const quickChips = [-1, 0, 1, 2, 3];
  const [pickerOpen, setPickerOpen] = useState(false);
  const todayYMD = getTodayYMD();

  const selectedDateValue = useMemo(() => {
    const ymd = ymdForOffset(selectedOffset);
    return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  }, [selectedOffset]);

  const handleDateChange = useCallback((value: string) => {
    const ymd = value.replace(/-/g, '');
    const off = offsetFromYMD(ymd);
    if (off !== null) onSelect(off);
    setPickerOpen(false);
  }, [onSelect, setPickerOpen]);

  return (
    <div className="sticky top-14 z-20 -mx-4 px-3 py-2 bg-background/85 backdrop-blur-xl border-b border-border/20 dark:border-white/[0.04]">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelect(selectedOffset - 1)}
          disabled={selectedOffset <= MIN_OFFSET}
          className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/40 dark:bg-white/[0.03] border border-border/20 dark:border-white/[0.04] text-muted-foreground/70 hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide" style={{ touchAction: 'pan-x' }}>
          {quickChips.map((off) => {
            const isActive = off === selectedOffset;
            const isToday = off === 0;
            return (
              <button
                key={off}
                onClick={() => onSelect(off)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-orange-500/12 text-orange-400 border border-orange-500/20 shadow-sm shadow-orange-500/10'
                    : 'bg-secondary/20 dark:bg-white/[0.02] text-muted-foreground/60 border border-transparent hover:bg-secondary/50 dark:hover:bg-white/[0.04] hover:text-foreground'
                }`}
              >
                {isToday && (
                  <span className={`inline-flex items-center justify-center w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-orange-400' : 'bg-orange-500/50'}`} />
                )}
                {dayChipLabel(off, language)}
              </button>
            );
          })}

          {selectedOffset > 3 && (
            <button
              onClick={() => onSelect(selectedOffset)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-orange-500/12 text-orange-400 border border-orange-500/20"
            >
              {dayChipLabel(selectedOffset, language)}
            </button>
          )}
        </div>

        {hydrated ? (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/40 dark:bg-white/[0.03] border border-border/20 dark:border-white/[0.04] text-muted-foreground/70 hover:text-orange-400 hover:border-orange-500/20 transition-all"
                aria-label={t(language, 'common.pickDate')}
                title={t(language, 'common.pickDate')}
              >
                <Calendar className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-3">
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-foreground/80">{t(language, 'common.pickDate')}</p>
                <input
                  type="date"
                  value={selectedDateValue}
                  min={`${todayYMD.slice(0, 4)}-${todayYMD.slice(4, 6)}-${(parseInt(todayYMD.slice(6, 8)) - 3).toString().padStart(2, '0')}`}
                  onChange={(e) => e.target.value && handleDateChange(e.target.value)}
                  className="bg-secondary/30 dark:bg-white/[0.04] border border-border/30 dark:border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-orange-500/30"
                />
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-secondary/40 dark:bg-white/[0.03] border border-border/20 dark:border-white/[0.04]" />
        )}

        <button
          onClick={() => onSelect(selectedOffset + 1)}
          disabled={selectedOffset >= MAX_OFFSET}
          className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/40 dark:bg-white/[0.03] border border-border/20 dark:border-white/[0.04] text-muted-foreground/70 hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-medium">
        <CalendarDays className="h-3 w-3" />
        <span>{dayDateNumber(selectedOffset, language)}</span>
      </div>
    </div>
  );
}
