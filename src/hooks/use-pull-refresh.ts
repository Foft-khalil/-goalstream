'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

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
  /** Ref to attach to the scrollable container */
  pullRef: React.RefObject<HTMLDivElement | null>;
}

export function usePullRefresh({
  threshold = 60,
  onRefresh,
  maxPull = 120,
}: UsePullRefreshOptions): UsePullRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullRef = useRef<HTMLDivElement | null>(null);

  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = pullRef.current;
    if (!container) return;

    // Only activate if scrolled to the top
    if (container.scrollTop > 0) return;

    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current || isRefreshing) return;

      const container = pullRef.current;
      if (!container) return;

      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;

      // Only process downward pulls
      if (diff <= 0) {
        setPullDistance(0);
        return;
      }

      // Only if at the top of the scroll container
      if (container.scrollTop > 0) {
        setPullDistance(0);
        isDragging.current = false;
        return;
      }

      // Apply resistance (gets harder to pull as you go further)
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, maxPull);
      setPullDistance(distance);

      // Prevent default scrolling while pulling
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
    const container = pullRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullDistance,
    isRefreshing,
    pullRef,
  };
}
