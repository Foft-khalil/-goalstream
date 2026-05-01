'use client';

import { useEffect, useState, useRef } from 'react';
import { t, Language } from '@/lib/i18n';

/**
 * LiveMatchClock — real-time ticking chronometer for football matches.
 *
 * Architecture (v2 — simplified & robust):
 * - We store a "base" ESPN value (total match seconds) and when we received it
 * - On every render, we calculate: baseSeconds + (Date.now() - baseTimestamp)
 * - A 1-second interval forces re-renders so the clock ticks
 * - When ESPN data changes, we update the base smoothly
 * - When the component re-renders from parent (new match data), the base
 *   is only updated if displayClock/period actually changed
 * - Halftime detection is cross-verified independently
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
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  if (parts.length === 1) {
    return (parseInt(parts[0], 10) || 0) * 60;
  }
  return 0;
}

/** Format 1965 seconds → "32:45" */
function formatClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Get period label based on language */
function getPeriodLabel(period: number | null, statusDescription: string | null, lang: Language = 'fr'): string | null {
  const desc = statusDescription?.toLowerCase() || '';
  if (period === 1 || desc.includes('1st') || desc.includes('first')) return t(lang, 'match.firstHalf');
  if (period === 2 || desc.includes('2nd') || desc.includes('second')) return t(lang, 'match.secondHalf');
  if (desc.includes('extra') || desc.includes('overtime') || desc.includes('prolongation')) return t(lang, 'match.extraTime');
  return null;
}

/**
 * Cross-verify halftime using multiple signals.
 * Does NOT trust isHalftime alone — "2nd Half" was previously misdetected.
 */
function isTrulyHalftime(
  period: number | null,
  statusDescription: string | null,
  isHalftimeProp: boolean,
): boolean {
  const desc = (statusDescription?.toLowerCase() || '').trim();

  // Period 2 = definitely 2nd half, not halftime
  if (period === 2) return false;
  // "2nd Half" / "second half" = playing, not halftime
  if (desc.includes('2nd') || desc.includes('second')) return false;
  // "1st Half" / "first half" = still playing 1st half
  if (desc.includes('1st') || desc.includes('first')) return false;

  // Explicit halftime indicators
  if (desc === 'halftime' || desc === 'half' || desc === 'mi-temps' || desc === 'midpoint') return true;

  // Trust API prop only if period isn't 2 and desc doesn't contradict
  if (isHalftimeProp && period !== 2) return true;

  return false;
}

/** Calculate total match seconds from ESPN data */
function calcEspnTotalSeconds(displayClock: string | null, minute: number | null, period: number | null): number {
  let periodSeconds = 0;
  if (displayClock) {
    periodSeconds = parseClockToSeconds(displayClock);
  } else if (minute != null) {
    if (period && period >= 2) {
      periodSeconds = Math.max(0, (minute - 45 * (period - 1)) * 60);
    } else {
      periodSeconds = minute * 60;
    }
  }
  const periodOffset = period && period > 1 ? 45 * (period - 1) : 0;
  return periodSeconds + periodOffset;
}

export default function LiveMatchClock({
  displayClock,
  period,
  statusDescription,
  isHalftime: isHalftimeProp,
  lastUpdated: _lastUpdated, // unused but kept for API compatibility
  minute,
}: LiveMatchClockProps) {
  // ─── State: tick counter to force re-renders every second ────────────────
  const [tick, setTick] = useState(0);

  // ─── Refs: stable across re-renders ──────────────────────────────────────
  // "Base" values: the ESPN-provided total seconds and the real-world time we received them
  const baseSecondsRef = useRef<number | null>(null); // null = not initialized yet
  const baseTimestampRef = useRef<number>(Date.now());

  // Track previous prop values to detect changes
  const prevDisplayClockRef = useRef<string | null>(null);
  const prevPeriodRef = useRef<number | null>(null);
  const prevMinuteRef = useRef<number | null>(null);

  // ─── 1-second tick interval (never cleared except on unmount) ────────────
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Verify halftime independently ──────────────────────────────────────
  const halftime = isTrulyHalftime(period, statusDescription, isHalftimeProp);

  // ─── Calculate ESPN total seconds from current props ────────────────────
  const espnTotal = calcEspnTotalSeconds(displayClock, minute, period);

  // ─── Update base when ESPN data changes ─────────────────────────────────
  // This runs in the render body (not in useEffect) so the new base is
  // immediately used for the current render's calculation.
  const clockChanged = displayClock !== prevDisplayClockRef.current;
  const periodChanged = period !== prevPeriodRef.current;
  const minuteChanged = minute !== prevMinuteRef.current;

  if (clockChanged || periodChanged || minuteChanged) {
    prevDisplayClockRef.current = displayClock;
    prevPeriodRef.current = period;
    prevMinuteRef.current = minute;

    // First time or ESPN data changed → snap to new ESPN value
    // When ESPN sends an update, we smoothly transition by updating our base
    if (baseSecondsRef.current === null) {
      // First render: snap directly
      baseSecondsRef.current = espnTotal;
      baseTimestampRef.current = Date.now();
    } else {
      // ESPN data changed mid-match:
      // We compare the new ESPN value with what we're currently showing.
      // If ESPN is ahead of us, snap forward. If behind (rare), also snap.
      // This prevents the clock from drifting too far from reality.
      const currentShown = baseSecondsRef.current + (halftime ? 0 : Math.max(0, Math.floor((Date.now() - baseTimestampRef.current) / 1000)));
      const diff = espnTotal - currentShown;

      // Only re-snap if there's a meaningful difference (>2 seconds)
      // This prevents tiny timestamp jitters from causing visible jumps
      if (Math.abs(diff) > 2) {
        baseSecondsRef.current = espnTotal;
        baseTimestampRef.current = Date.now();
      }
    }
  }

  // If still not initialized (shouldn't happen, but safety)
  if (baseSecondsRef.current === null) {
    baseSecondsRef.current = espnTotal;
    baseTimestampRef.current = Date.now();
  }

  // ─── Calculate current display time ─────────────────────────────────────
  const elapsedSinceBase = halftime
    ? 0
    : Math.max(0, Math.floor((Date.now() - baseTimestampRef.current) / 1000));

  let currentTotalSeconds = baseSecondsRef.current + elapsedSinceBase;

  // Cap at reasonable maximums
  const maxTotalSeconds = (period && period >= 2) ? 100 * 60 : 55 * 60;
  currentTotalSeconds = Math.min(currentTotalSeconds, maxTotalSeconds);

  // Derive display values
  const periodOffset = period && period > 1 ? 45 * (period - 1) : 0;
  const currentPeriodSeconds = Math.max(0, currentTotalSeconds - periodOffset);
  const totalMinute = Math.floor(currentTotalSeconds / 60);
  const clockStr = formatClock(currentPeriodSeconds);
  const periodLabel = getPeriodLabel(period, statusDescription);
  const isAddedTime = (period === 1 && currentPeriodSeconds > 45 * 60) ||
                      (period === 2 && currentPeriodSeconds > 45 * 60);
  const addedTimeMinute = isAddedTime ? Math.floor(currentPeriodSeconds / 60) - 45 : 0;

  // ─── HALFTIME DISPLAY ──────────────────────────────────────────────────
  if (halftime) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-bold text-amber-400 tracking-wide font-mono tabular-nums">
            45:00
          </span>
        </div>
        <span className="text-[10px] text-amber-500/60 font-semibold">
          {t('fr', 'football.halftime')}
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
