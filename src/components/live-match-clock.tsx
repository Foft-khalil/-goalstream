'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';

/**
 * LiveMatchClock — real-time ticking chronometer for football matches.
 *
 * Architecture:
 * - When ESPN data arrives (displayClock + lastUpdated), we "snap" to that value
 * - Between ESPN updates, the clock ticks forward every second
 * - When a new ESPN update arrives, we snap to the new value (smooth transition)
 * - If the user was away (tab hidden), the clock catches up instantly
 *
 * The component does NOT trust `isHalftime` blindly — it cross-checks with
 * `period` and `statusDescription` because ESPN sends "2nd Half" which
 * contains "half" and was previously misdetected as halftime.
 */

interface LiveMatchClockProps {
  displayClock: string | null;
  period: number | null;
  statusDescription: string | null;
  isHalftime: boolean;
  lastUpdated: number | null;
  minute: number | null;
}

/** Parse "32:45" → 1965 seconds */
function parseClockToSeconds(clock: string): number {
  const parts = clock.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return 0;
}

/** Format 1965 seconds → "32:45" */
function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Get French period label */
function getPeriodLabel(period: number | null, statusDescription: string | null): string | null {
  const desc = statusDescription?.toLowerCase() || '';
  if (period === 1 || desc.includes('1st') || desc.includes('first')) return '1ère MT';
  if (period === 2 || desc.includes('2nd') || desc.includes('second')) return '2ème MT';
  if (desc.includes('extra') || desc.includes('overtime') || desc.includes('prolongation')) return 'PROL';
  return null;
}

/**
 * Cross-verify halftime using multiple signals.
 * Does NOT trust isHalftime alone.
 */
function isTrulyHalftime(
  period: number | null,
  statusDescription: string | null,
  isHalftimeProp: boolean,
): boolean {
  const desc = (statusDescription?.toLowerCase() || '').trim();

  // Period 2 = definitely 2nd half
  if (period === 2) return false;
  // "2nd Half" / "second half" = playing, not halftime
  if (desc.includes('2nd') || desc.includes('second')) return false;
  // "1st Half" / "first half" = still playing 1st half
  if (desc.includes('1st') || desc.includes('first')) return false;

  // Explicit halftime
  if (desc === 'halftime' || desc === 'half' || desc === 'mi-temps' || desc === 'midpoint') return true;

  // Trust API prop only if period isn't 2 and desc doesn't contradict
  if (isHalftimeProp && period !== 2) return true;

  return false;
}

export default function LiveMatchClock({
  displayClock,
  period,
  statusDescription,
  isHalftime: isHalftimeProp,
  lastUpdated,
  minute,
}: LiveMatchClockProps) {
  // ─── Local clock state ─────────────────────────────────────────────────
  // We track the "snap time" — the total seconds we should be displaying right now.
  // When new ESPN data arrives, we snap to the new value.
  // Between snaps, we tick forward every second.

  const [localNow, setLocalNow] = useState(Date.now());
  const prevDisplayClockRef = useRef<string | null>(null);
  const prevPeriodRef = useRef<number | null>(null);
  const snapTimeRef = useRef<number>(0); // total seconds at the moment of the last snap
  const snapRealTimeRef = useRef<number>(Date.now()); // real-world time of the last snap

  // Verify halftime independently
  const effectiveHalftime = useMemo(
    () => isTrulyHalftime(period, statusDescription, isHalftimeProp),
    [period, statusDescription, isHalftimeProp]
  );

  // ─── Calculate base seconds from ESPN displayClock ──────────────────────
  const espnPeriodSeconds = useMemo(() => {
    if (displayClock) {
      return parseClockToSeconds(displayClock);
    }
    if (minute != null) {
      if (period && period >= 2) {
        return Math.max(0, (minute - 45 * (period - 1)) * 60);
      }
      return minute * 60;
    }
    return 0;
  }, [displayClock, minute, period]);

  const espnTotalSeconds = useMemo(() => {
    const periodOffset = period && period > 1 ? 45 * (period - 1) : 0;
    return espnPeriodSeconds + periodOffset;
  }, [espnPeriodSeconds, period]);

  // ─── Snap to ESPN value when data changes ──────────────────────────────
  // When displayClock or period changes, we know ESPN sent new data.
  // We snap our clock to the new value and record when we snapped.

  const snapToESPN = useCallback(() => {
    snapTimeRef.current = espnTotalSeconds;
    snapRealTimeRef.current = Date.now();
  }, [espnTotalSeconds]);

  // Detect when ESPN data actually changes
  useEffect(() => {
    if (
      prevDisplayClockRef.current !== displayClock ||
      prevPeriodRef.current !== period
    ) {
      prevDisplayClockRef.current = displayClock;
      prevPeriodRef.current = period;
      snapToESPN();
    }
  }, [displayClock, period, snapToESPN]);

  // ─── Tick every second ─────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Calculate current display time ────────────────────────────────────
  // Time elapsed since the last snap (in seconds)
  const elapsedSinceSnap = Math.max(0, Math.floor((localNow - snapRealTimeRef.current) / 1000));

  // Current total seconds = snap value + elapsed time since snap
  // During halftime, the clock does NOT advance
  let currentTotalSeconds = snapTimeRef.current + (effectiveHalftime ? 0 : elapsedSinceSnap);

  // Cap: 1st half max ~50 min total, 2nd half max ~95 min total
  const maxTotalSeconds = (period && period >= 2) ? 95 * 60 : 50 * 60;
  currentTotalSeconds = Math.min(currentTotalSeconds, maxTotalSeconds);

  // Derive display values
  const periodOffset = period && period > 1 ? 45 * (period - 1) : 0;
  const currentPeriodSeconds = Math.max(0, currentTotalSeconds - periodOffset);
  const totalMinute = Math.floor(currentTotalSeconds / 60);
  const clockStr = formatClock(currentPeriodSeconds);
  const periodLabel = getPeriodLabel(period, statusDescription);
  const isAddedTime = currentPeriodSeconds > 45 * 60;
  const addedTimeMinute = isAddedTime ? Math.floor(currentPeriodSeconds / 60) - 45 : 0;

  // ─── HALFTIME DISPLAY ──────────────────────────────────────────────────
  if (effectiveHalftime) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-bold text-amber-400 tracking-wide font-mono tabular-nums">
            45:00
          </span>
        </div>
        <span className="text-[10px] text-amber-500/60 font-semibold">
          Mi-temps
        </span>
      </div>
    );
  }

  // ─── LIVE CLOCK DISPLAY ────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-1.5">
      {/* Main chronometer */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[12px] font-black text-red-500 tracking-wide tabular-nums font-mono">
          {totalMinute}&apos;
        </span>
      </div>

      {/* Period clock (MM:SS within current half) */}
      <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
        {clockStr}
      </span>

      {/* Period label */}
      {periodLabel && (
        <span className="text-[9px] text-muted-foreground/40 font-semibold">
          {periodLabel}
        </span>
      )}

      {/* Added time indicator */}
      {isAddedTime && (
        <span className="text-[9px] text-amber-500/80 font-bold">
          +{addedTimeMinute}&apos;
        </span>
      )}
    </div>
  );
}

/**
 * Basketball live clock with countdown ticking.
 */
export function BasketballLiveClock({
  clockDisplay,
  periodDisplay,
}: {
  clockDisplay: string | null;
  periodDisplay: string | null;
}) {
  if (!clockDisplay && !periodDisplay) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-[11px] font-bold text-orange-500 tracking-wide">LIVE</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
      {periodDisplay && (
        <span className="text-[11px] font-bold text-orange-500 tracking-wide">
          {periodDisplay}
        </span>
      )}
      {clockDisplay && clockDisplay !== '0:00' && (
        <span className="text-[11px] font-semibold text-orange-400/80 tabular-nums">
          {clockDisplay}
        </span>
      )}
    </div>
  );
}
