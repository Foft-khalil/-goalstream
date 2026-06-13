'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface UsePullRefreshOptions {
  /** Distance in px to trigger refresh (default: 60) */
  threshold?: number;
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void> | void;
  /** Max pull distance in px (default: 120) */
  maxPull?: number;
}

interface UsePullRefreshReturn {
  /** Current pull distance in px */
  pullDistance: number;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Ref to attach to the scrollable container — unused now, kept for compat */
  pullRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Pull-to-refresh hook that works with document-level scrolling.
 * 
 * Previous version was broken because it checked `container.scrollTop` on a
 * non-scrolling div, causing `scrollTop` to always be 0, which made the hook
 * think it was always at the top of the page and blocked native scrolling via
 * `preventDefault()`. 
 * 
 * This version:
 * - Uses `window.scrollY` to detect if the page is truly at the top
 * - Only intercepts touches when the page is scrolled to the very top (scrollY === 0)
 * - NEVER blocks upward scrolling — only intercepts downward pulls at the top
 * - Uses `{ passive: false }` ONLY when actively pulling down at the top
 */
export function usePullRefresh({
  threshold = 60,
  onRefresh,
  maxPull = 120,
}: UsePullRefreshOptions): UsePullRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const isAtTop = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Check if the page is scrolled to the top using window.scrollY
    // This is the correct way since our content scrolls at the document level
    isAtTop.current = window.scrollY <= 1;

    // Only activate pull-to-refresh if at the top of the page
    if (!isAtTop.current) {
      isDragging.current = false;
      return;
    }

    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;

      // If scrolling UP (negative diff), immediately release control
      // to allow native upward scrolling
      if (diff <= 0) {
        setPullDistance(0);
        isDragging.current = false;
        return;
      }

      // Re-check if page is still at top (could have scrolled during gesture)
      if (window.scrollY > 1) {
        setPullDistance(0);
        isDragging.current = false;
        return;
      }

      // Apply resistance (gets harder to pull as you go further)
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, maxPull);
      setPullDistance(distance);

      // Only prevent default when we're actively pulling down at the top
      // This prevents the page from bouncing while also allowing normal scroll
      if (diff > 10) {
        e.preventDefault();
      }
    },
    [isRefreshing, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;

    isDragging.current = false;

    // If pulled past threshold, trigger refresh
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Hold at threshold while refreshing

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    // Attach listeners to document since scrolling happens at document level
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullDistance,
    isRefreshing,
    pullRef: { current: null }, // No longer needed but kept for compatibility
  };
}
