'use client';

import { useEffect, useState, useMemo } from 'react';

/**
 * LiveMatchClock — displays a real-time ticking chronometer for football matches.
 *
 * It extrapolates the ESPN displayClock forward in real-time between API updates,
 * giving the user a sense of how much time has passed.
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
 * Parse displayClock like "32:45" into total seconds.
 */
function parseClockToSeconds(clock: string): number {
  const parts = clock.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return 0;
}

/**
 * Format total seconds back into "MM:SS".
 */
function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Get the display minute from total elapsed seconds, accounting for period.
 */
function getDisplayMinute(totalSeconds: number, period: number | null): number {
  const baseMinute = Math.floor(totalSeconds / 60);
  // Add period offset: period 2 starts at 45:00
  if (period && period > 1) {
    return baseMinute + 45 * (period - 1);
  }
  return baseMinute;
}

/**
 * Get a French period label.
 */
function getPeriodLabel(period: number | null, isHalftime: boolean, statusDescription: string | null): string | null {
  if (isHalftime) return 'MT';

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
  const [tick, setTick] = useState(0);

  // Calculate the base seconds from the ESPN displayClock
  const baseSeconds = useMemo(() => {
    if (displayClock) {
      return parseClockToSeconds(displayClock);
    }
    // Fallback: use minute
    if (minute != null) {
      return minute * 60;
    }
    return 0;
  }, [displayClock, minute]);

  useEffect(() => {
    if (isHalftime) {
      // At halftime, no ticking needed
      return;
    }

    // Tick every second
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isHalftime]);

  // Calculate current elapsed time
  const elapsedSeconds = useMemo(() => {
    if (isHalftime) return baseSeconds;
    const updateAge = lastUpdated ? (Date.now() - lastUpdated) / 1000 : 0;
    return baseSeconds + Math.max(0, Math.floor(updateAge));
  }, [baseSeconds, lastUpdated, isHalftime, tick]);

  // Cap at reasonable values
  // 1st half: max ~48 min (45 + stoppage), 2nd half: max ~95 min
  const maxSeconds = (period === 1) ? 48 * 60 : 96 * 60;
  const cappedSeconds = Math.min(elapsedSeconds, maxSeconds);

  const displayMinute = getDisplayMinute(cappedSeconds, period);
  const clockStr = formatSeconds(cappedSeconds % 3600); // Reset for period display
  const periodLabel = getPeriodLabel(period, isHalftime, statusDescription);

  // Check for added time (over 45:00 in 1st half or over 90:00 in 2nd half)
  const isAddedTime = (period === 1 && cappedSeconds > 45 * 60) ||
                      (period === 2 && cappedSeconds > 90 * 60);

  if (isHalftime) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-bold text-amber-400 tracking-wide">
            MT
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/50 font-medium">
          Mi-temps
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] font-bold text-red-500 tracking-wide tabular-nums">
          {displayMinute}'
        </span>
      </div>
      {periodLabel && (
        <span className="text-[10px] text-muted-foreground/50 font-medium">
          {periodLabel}
        </span>
      )}
      {isAddedTime && (
        <span className="text-[9px] text-amber-500/70 font-semibold">
          +{displayMinute - (period === 1 ? 45 : 90)}
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
