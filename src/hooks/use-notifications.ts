'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { useFavorites } from '@/hooks/use-favorites';
import type { BasketballMatch } from '@/lib/basketball/types';

const NOTIFIED_STORAGE_KEY = 'goalstream_notified_matches';
const NOTIFICATIONS_ENABLED_KEY = 'goalstream_notifications_enabled';
const CHECK_INTERVAL_MS = 60_000; // 60 seconds
const ALERT_BEFORE_MINUTES = 15;

interface UpcomingFavoriteMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string | null;
  minutesUntilKickoff: number;
}

function getNotifiedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(NOTIFIED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveNotifiedIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

function getNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

function saveNotificationsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
  } catch {
    // ignore
  }
}

function isFavoriteTeam(teamName: string, favoriteTeamNames: string[]): boolean {
  const lower = teamName.toLowerCase();
  return favoriteTeamNames.some((ft) => ft.toLowerCase() === lower);
}

function findUpcomingFavoriteMatches(
  footballMatches: { id: string; homeTeam: string; awayTeam: string; competition: string | null; matchDate: string | null; status: string }[],
  basketballMatches: BasketballMatch[],
  favoriteTeamNames: string[]
): UpcomingFavoriteMatch[] {
  const now = Date.now();
  const results: UpcomingFavoriteMatch[] = [];

  // Check football matches
  for (const match of footballMatches) {
    if (match.status !== 'upcoming' || !match.matchDate) continue;
    if (!isFavoriteTeam(match.homeTeam, favoriteTeamNames) && !isFavoriteTeam(match.awayTeam, favoriteTeamNames)) continue;

    const kickoff = new Date(match.matchDate).getTime();
    const diffMs = kickoff - now;
    const diffMin = diffMs / 60_000;

    if (diffMin > 0 && diffMin <= ALERT_BEFORE_MINUTES) {
      results.push({
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: match.competition,
        minutesUntilKickoff: Math.ceil(diffMin),
      });
    }
  }

  // Check basketball matches
  for (const match of basketballMatches) {
    if (match.status !== 'upcoming' || !match.matchDate) continue;
    if (!isFavoriteTeam(match.homeTeam, favoriteTeamNames) && !isFavoriteTeam(match.awayTeam, favoriteTeamNames)) continue;

    const kickoff = new Date(match.matchDate).getTime();
    const diffMs = kickoff - now;
    const diffMin = diffMs / 60_000;

    if (diffMin > 0 && diffMin <= ALERT_BEFORE_MINUTES) {
      results.push({
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: match.competition,
        minutesUntilKickoff: Math.ceil(diffMin),
      });
    }
  }

  return results;
}

function cleanOldNotifiedIds(ids: Set<string>, allMatchIds: Set<string>): Set<string> {
  const cleaned = new Set<string>();
  for (const id of ids) {
    if (allMatchIds.has(id)) {
      cleaned.add(id);
    }
  }
  return cleaned;
}

function getInitialPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

export function useNotifications() {
  const [permissionState, setPermissionState] = useState<NotificationPermission>(getInitialPermission);
  const [enabledSetting, setEnabledSetting] = useState(getNotificationsEnabled);
  const [upcomingFavoriteCount, setUpcomingFavoriteCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { footballMatches, basketballMatches } = useAppStore();
  const { favoriteTeams } = useFavorites();

  const favoriteTeamNames = favoriteTeams.map((t) => t.name);

  // Derive effective enabled state: setting must be on AND permission must be granted
  const notificationsEnabled = enabledSetting && permissionState === 'granted';

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const result = await Notification.requestPermission();
    setPermissionState(result);

    if (result === 'granted') {
      setEnabledSetting(true);
      saveNotificationsEnabled(true);
    } else {
      setEnabledSetting(false);
      saveNotificationsEnabled(false);
    }
  }, []);

  const toggleNotifications = useCallback(() => {
    if (permissionState !== 'granted') {
      requestPermission();
      return;
    }

    const newEnabled = !enabledSetting;
    setEnabledSetting(newEnabled);
    saveNotificationsEnabled(newEnabled);
  }, [permissionState, enabledSetting, requestPermission]);

  // Main check interval — uses refs to read latest state without re-creating effect
  const notificationsEnabledRef = useRef(notificationsEnabled);
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  useEffect(() => {
    const checkMatches = () => {
      if (!notificationsEnabledRef.current) {
        setUpcomingFavoriteCount(0);
        return;
      }

      const upcoming = findUpcomingFavoriteMatches(
        footballMatches,
        basketballMatches,
        favoriteTeamNames
      );

      setUpcomingFavoriteCount(upcoming.length);

      // Get already-notified IDs
      const notifiedIds = getNotifiedIds();

      // Build set of all current match IDs for cleanup
      const allMatchIds = new Set<string>();
      for (const m of footballMatches) allMatchIds.add(m.id);
      for (const m of basketballMatches) allMatchIds.add(m.id);

      // Clean old notified IDs
      const cleanedIds = cleanOldNotifiedIds(notifiedIds, allMatchIds);

      // Send notifications for new matches
      for (const match of upcoming) {
        if (!cleanedIds.has(match.id)) {
          try {
            const body = `${match.homeTeam} vs ${match.awayTeam} commence dans ${match.minutesUntilKickoff} min${match.competition ? ` — ${match.competition}` : ''}`;
            const notification = new Notification('GoalStream ⚽', {
              body,
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png',
              tag: match.id,
              requireInteraction: false,
            });

            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch {
            // Notification might fail in some environments
          }

          cleanedIds.add(match.id);
        }
      }

      saveNotifiedIds(cleanedIds);
    };

    // Run immediately
    checkMatches();

    // Then every 60 seconds
    intervalRef.current = setInterval(checkMatches, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [footballMatches, basketballMatches, favoriteTeamNames]);

  return {
    requestPermission,
    permissionState,
    notificationsEnabled,
    toggleNotifications,
    upcomingFavoriteCount,
  };
}
