'use client';

import { useEffect, useState, useMemo, useRef } from 'react';

/**
 * LiveMatchClock — displays a real-time ticking chronometer for football matches.
 *
 * It extrapolates the ESPN displayClock forward in real-time between API updates,
 * giving the user a sense of how much time has elapsed with a running MM:SS display.
 *
 * Props:
 * - displayClock: ESPN's raw clock string, e.g. "32:45"
 * - period: ESPN period number (1 = 1st half, 2 = 2nd half)
 * - statusDescription: ESPN description like "1st Half", "Halftime", "2nd Half"
 * - isHalftime: whether the match is currently at halftime
 * - lastUpdated: timestamp (ms) when the data was last fetched
 * - minute: the calculated match minute from the API (for fallback)
 */

interface LiveMatchClockProps {
  displayClock: string | null;
  period: number | null;
  statusDescription: string | null;
  isHalftime: boolean;
  lastUpdated: number | null;
  minute: number | null;
}

/**
 * Parse displayClock like "32:45" into total seconds within the current period.
 */
function parseClockToSeconds(clock: string): number {
  const parts = clock.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return 0;
}

/**
 * Format total seconds into "MM:SS".
 */
function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Get a French period label.
 */
function getPeriodLabel(period: number | null, isHalftime: boolean, statusDescription: string | null): string | null {
  if (isHalftime) return 'MI-TEMPS';

  const desc = statusDescription?.toLowerCase() || '';

  if (period === 1 || desc.includes('1st') || desc.includes('first')) {
    return '1ère MT';
  }
  if (period === 2 || desc.includes('2nd') || desc.includes('second')) {
    return '2ème MT';
  }

  // Extra time / added time
  if (desc.includes('extra') || desc.includes('overtime') || desc.includes('prolongation')) {
    return 'PROL';
  }

  return null;
}

export default function LiveMatchClock({
  displayClock,
  period,
  statusDescription,
  isHalftime,
  lastUpdated,
  minute,
}: LiveMatchClockProps) {
  const [now, setNow] = useState(Date.now());
  const rafRef = useRef<number | null>(null);

  // Calculate the base seconds from the ESPN displayClock (within current period)
  const basePeriodSeconds = useMemo(() => {
    if (displayClock) {
      return parseClockToSeconds(displayClock);
    }
    // Fallback: use minute to derive period seconds
    if (minute != null) {
      if (period === 2) {
        // If in 2nd period, the minute is total, so period seconds = (minute - 45) * 60
        return Math.max(0, (minute - 45) * 60);
      }
      return minute * 60;
    }
    return 0;
  }, [displayClock, minute, period]);

  // Tick every second using requestAnimationFrame for smooth display
  useEffect(() => {
    if (isHalftime) {
      // At halftime, still tick to show how long halftime has been
      const timer = setInterval(() => {
        setNow(Date.now());
      }, 1000);
      return () => clearInterval(timer);
    }

    // Use setInterval for 1-second updates (more battery-friendly than rAF for this)
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isHalftime]);

  // Calculate how many seconds have elapsed since the last API update
  const elapsedSinceUpdate = lastUpdated ? Math.max(0, Math.floor((now - lastUpdated) / 1000)) : 0;

  // Current period elapsed seconds (extrapolated forward)
  const currentPeriodSeconds = basePeriodSeconds + (isHalftime ? 0 : elapsedSinceUpdate);

  // Cap at reasonable values per period
  // 1st half: max ~48 min (45 + stoppage), 2nd half: max ~48 min per period
  const maxPeriodSeconds = 48 * 60;
  const cappedPeriodSeconds = Math.min(currentPeriodSeconds, maxPeriodSeconds);

  // Total match minute (for display)
  const periodOffset = period && period > 1 ? 45 * (period - 1) : 0;
  const totalMinute = Math.floor(cappedPeriodSeconds / 60) + periodOffset;

  // Clock string shows the period time (MM:SS within the current half)
  const clockStr = formatClock(cappedPeriodSeconds);

  // Check for added time
  const isAddedTime = (period === 1 && cappedPeriodSeconds > 45 * 60) ||
                      (period === 2 && cappedPeriodSeconds > 45 * 60);
  const addedTimeMinute = isAddedTime
    ? Math.floor(cappedPeriodSeconds / 60) - 45
    : 0;

  const periodLabel = getPeriodLabel(period, isHalftime, statusDescription);

  // ─── HALFTIME DISPLAY ─────────────────────────────────────────────────
  if (isHalftime) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-bold text-amber-400 tracking-wide">
            45:00
          </span>
        </div>
        <span className="text-[10px] text-amber-500/60 font-semibold">
          Mi-temps
        </span>
      </div>
    );
  }

  // ─── LIVE CLOCK DISPLAY ──────────────────────────────────────────────
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
