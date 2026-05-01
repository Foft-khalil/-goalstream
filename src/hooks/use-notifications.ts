'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { useFavorites } from '@/hooks/use-favorites';
import type { BasketballMatch } from '@/lib/basketball/types';
import type { FootballMatch } from '@/lib/football/types';

const NOTIFIED_STORAGE_KEY = 'goalstream_notified_matches';
const NOTIFIED_GOALS_KEY = 'goalstream_notified_goals';
const NOTIFICATIONS_ENABLED_KEY = 'goalstream_notifications_enabled';

// Settings keys
const NOTIFY_MATCH_START_KEY = 'goalstream_notify_match_start';
const NOTIFY_GOALS_KEY = 'goalstream_notify_goals';
const NOTIFY_FAVORITES_KEY = 'goalstream_notify_favorites';

const CHECK_INTERVAL_MS = 60_000; // 60 seconds
const ALERT_BEFORE_MINUTES = 15;

// ─── Settings helpers ─────────────────────────────────────────────

export interface NotificationSettings {
  notifyMatchStart: boolean;
  notifyGoals: boolean;
  notifyFavorites: boolean;
}

function getSetting(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? defaultValue : raw === 'true';
  } catch {
    return defaultValue;
  }
}

function saveSetting(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

export function getNotificationSettings(): NotificationSettings {
  return {
    notifyMatchStart: getSetting(NOTIFY_MATCH_START_KEY, true),
    notifyGoals: getSetting(NOTIFY_GOALS_KEY, true),
    notifyFavorites: getSetting(NOTIFY_FAVORITES_KEY, true),
  };
}

export function saveNotificationSettings(settings: NotificationSettings) {
  saveSetting(NOTIFY_MATCH_START_KEY, settings.notifyMatchStart);
  saveSetting(NOTIFY_GOALS_KEY, settings.notifyGoals);
  saveSetting(NOTIFY_FAVORITES_KEY, settings.notifyFavorites);
}

// ─── Notified IDs helpers ─────────────────────────────────────────

interface UpcomingFavoriteMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string | null;
  minutesUntilKickoff: number;
  sport: 'football' | 'basketball';
}

function getNotifiedIds(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveNotifiedIds(storageKey: string, ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...ids]));
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

// ─── Match start detection ────────────────────────────────────────

function findUpcomingFavoriteMatches(
  footballMatches: FootballMatch[],
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
        sport: 'football',
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
        sport: 'basketball',
      });
    }
  }

  return results;
}

// ─── Match status transition detection ────────────────────────────

function findMatchStarts(
  footballMatches: FootballMatch[],
  basketballMatches: BasketballMatch[],
  previousStatuses: Map<string, string>
): { id: string; homeTeam: string; awayTeam: string; competition: string | null; sport: 'football' | 'basketball' }[] {
  const results: { id: string; homeTeam: string; awayTeam: string; competition: string | null; sport: 'football' | 'basketball' }[] = [];

  for (const match of footballMatches) {
    const prev = previousStatuses.get(match.id);
    if (prev === 'upcoming' && match.status === 'live') {
      results.push({
        id: `kickoff-${match.id}`,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: match.competition,
        sport: 'football',
      });
    }
  }

  for (const match of basketballMatches) {
    const prev = previousStatuses.get(match.id);
    if (prev === 'upcoming' && match.status === 'live') {
      results.push({
        id: `tipoff-${match.id}`,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: match.competition,
        sport: 'basketball',
      });
    }
  }

  return results;
}

// ─── Goal / score change detection ────────────────────────────────

function checkGoalNotifications(
  footballMatches: FootballMatch[],
  basketballMatches: BasketballMatch[],
  previousScores: Map<string, { home: number; away: number }>,
  notifiedGoalIds: Set<string>
): {
  newNotifiedIds: Set<string>;
  newPreviousScores: Map<string, { home: number; away: number }>;
  goals: { matchId: string; homeTeam: string; awayTeam: string; scoringTeam: string; homeScore: number; awayScore: number; minute: string; sport: 'football' | 'basketball'; goalKey: string }[];
} {
  const newNotifiedIds = new Set(notifiedGoalIds);
  const newPreviousScores = new Map(previousScores);
  const goals: { matchId: string; homeTeam: string; awayTeam: string; scoringTeam: string; homeScore: number; awayScore: number; minute: string; sport: 'football' | 'basketball'; goalKey: string }[] = [];

  // Check football matches
  for (const match of footballMatches) {
    if (match.status !== 'live') {
      // Remove from tracking when match is no longer live
      newPreviousScores.delete(match.id);
      continue;
    }

    const currentHome = match.homeScore ?? 0;
    const currentAway = match.awayScore ?? 0;
    const prev = previousScores.get(match.id);

    if (prev) {
      // Home team scored
      if (currentHome > prev.home) {
        const goalKey = `goal-${match.id}-${currentHome}-${currentAway}-home`;
        if (!newNotifiedIds.has(goalKey)) {
          goals.push({
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            scoringTeam: match.homeTeam,
            homeScore: currentHome,
            awayScore: currentAway,
            minute: match.minute != null ? `${match.minute}'` : '',
            sport: 'football',
            goalKey,
          });
          newNotifiedIds.add(goalKey);
        }
      }

      // Away team scored
      if (currentAway > prev.away) {
        const goalKey = `goal-${match.id}-${currentHome}-${currentAway}-away`;
        if (!newNotifiedIds.has(goalKey)) {
          goals.push({
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            scoringTeam: match.awayTeam,
            homeScore: currentHome,
            awayScore: currentAway,
            minute: match.minute != null ? `${match.minute}'` : '',
            sport: 'football',
            goalKey,
          });
          newNotifiedIds.add(goalKey);
        }
      }
    }

    // Update previous scores
    newPreviousScores.set(match.id, { home: currentHome, away: currentAway });
  }

  // Check basketball matches
  for (const match of basketballMatches) {
    if (match.status !== 'live') {
      newPreviousScores.delete(match.id);
      continue;
    }

    const currentHome = match.homeScore ?? 0;
    const currentAway = match.awayScore ?? 0;
    const prev = previousScores.get(match.id);

    if (prev) {
      // Home team scored points
      if (currentHome > prev.home) {
        const goalKey = `bgoal-${match.id}-${currentHome}-${currentAway}-home`;
        if (!newNotifiedIds.has(goalKey)) {
          goals.push({
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            scoringTeam: match.homeTeam,
            homeScore: currentHome,
            awayScore: currentAway,
            minute: match.periodDisplay ?? '',
            sport: 'basketball',
            goalKey,
          });
          newNotifiedIds.add(goalKey);
        }
      }

      // Away team scored points
      if (currentAway > prev.away) {
        const goalKey = `bgoal-${match.id}-${currentHome}-${currentAway}-away`;
        if (!newNotifiedIds.has(goalKey)) {
          goals.push({
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            scoringTeam: match.awayTeam,
            homeScore: currentHome,
            awayScore: currentAway,
            minute: match.periodDisplay ?? '',
            sport: 'basketball',
            goalKey,
          });
          newNotifiedIds.add(goalKey);
        }
      }
    }

    // Update previous scores
    newPreviousScores.set(match.id, { home: currentHome, away: currentAway });
  }

  return { newNotifiedIds, newPreviousScores, goals };
}

// ─── Cleanup helpers ──────────────────────────────────────────────

function cleanOldNotifiedIds(ids: Set<string>, allMatchIds: Set<string>): Set<string> {
  const cleaned = new Set<string>();
  for (const id of ids) {
    if (allMatchIds.has(id)) {
      cleaned.add(id);
    }
  }
  return cleaned;
}

function cleanOldGoalIds(
  goalIds: Set<string>,
  footballMatches: FootballMatch[],
  basketballMatches: BasketballMatch[]
): Set<string> {
  const liveMatchIds = new Set<string>();
  for (const m of footballMatches) {
    if (m.status === 'live') liveMatchIds.add(m.id);
  }
  for (const m of basketballMatches) {
    if (m.status === 'live') liveMatchIds.add(m.id);
  }

  const cleaned = new Set<string>();
  for (const id of goalIds) {
    // Keep IDs that are for currently live matches or recent (non-goal) IDs
    // Goal IDs format: goal-{matchId}-{home}-{away}-{side} or bgoal-{matchId}-{home}-{away}-{side}
    const parts = id.split('-');
    if (parts.length >= 4) {
      const matchId = parts.slice(1, -2).join('-');
      // Keep if match is still live, otherwise remove to prevent unbounded growth
      if (liveMatchIds.has(matchId)) {
        cleaned.add(id);
      }
    } else {
      // Keep non-standard format IDs
      cleaned.add(id);
    }
  }
  return cleaned;
}

function getInitialPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

// ─── Main hook ────────────────────────────────────────────────────

export function useNotifications() {
  const [permissionState, setPermissionState] = useState<NotificationPermission>(getInitialPermission);
  const [enabledSetting, setEnabledSetting] = useState(getNotificationsEnabled);
  const [upcomingFavoriteCount, setUpcomingFavoriteCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for tracking previous state across polling cycles
  const previousScoresRef = useRef<Map<string, { home: number; away: number }>>(new Map());
  const previousStatusesRef = useRef<Map<string, string>>(new Map());

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

  const updateSettings = useCallback((newSettings: NotificationSettings) => {
    setSettings(newSettings);
    saveNotificationSettings(newSettings);
  }, []);

  // Keep refs in sync
  const notificationsEnabledRef = useRef(notificationsEnabled);
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const footballMatchesRef = useRef(footballMatches);
  useEffect(() => {
    footballMatchesRef.current = footballMatches;
  }, [footballMatches]);

  const basketballMatchesRef = useRef(basketballMatches);
  useEffect(() => {
    basketballMatchesRef.current = basketballMatches;
  }, [basketballMatches]);

  const favoriteTeamNamesRef = useRef(favoriteTeamNames);
  useEffect(() => {
    favoriteTeamNamesRef.current = favoriteTeamNames;
  }, [favoriteTeamNames]);

  // Initialize previous scores from current live matches on first load
  useEffect(() => {
    const scores = new Map<string, { home: number; away: number }>();
    for (const match of footballMatches) {
      if (match.status === 'live') {
        scores.set(match.id, { home: match.homeScore ?? 0, away: match.awayScore ?? 0 });
      }
    }
    for (const match of basketballMatches) {
      if (match.status === 'live') {
        scores.set(match.id, { home: match.homeScore ?? 0, away: match.awayScore ?? 0 });
      }
    }
    previousScoresRef.current = scores;

    // Initialize previous statuses
    const statuses = new Map<string, string>();
    for (const match of footballMatches) {
      statuses.set(match.id, match.status);
    }
    for (const match of basketballMatches) {
      statuses.set(match.id, match.status);
    }
    previousStatusesRef.current = statuses;
  // Only run once on mount (we use refs for subsequent updates)
  }, []);

  // Main check interval
  useEffect(() => {
    const checkMatches = () => {
      if (!notificationsEnabledRef.current) {
        setUpcomingFavoriteCount(0);
        return;
      }

      const currentSettings = settingsRef.current;
      const currentFootball = footballMatchesRef.current;
      const currentBasketball = basketballMatchesRef.current;
      const currentFavNames = favoriteTeamNamesRef.current;

      // ── 1. Favorite upcoming matches ──
      const upcomingFavorites = findUpcomingFavoriteMatches(
        currentFootball,
        currentBasketball,
        currentFavNames
      );
      setUpcomingFavoriteCount(upcomingFavorites.length);

      if (currentSettings.notifyFavorites) {
        const notifiedIds = getNotifiedIds(NOTIFIED_STORAGE_KEY);

        // Build set of all current match IDs for cleanup
        const allMatchIds = new Set<string>();
        for (const m of currentFootball) allMatchIds.add(m.id);
        for (const m of currentBasketball) allMatchIds.add(m.id);

        // Clean old notified IDs
        const cleanedIds = cleanOldNotifiedIds(notifiedIds, allMatchIds);

        // Send notifications for new favorite matches
        for (const match of upcomingFavorites) {
          if (!cleanedIds.has(match.id)) {
            try {
              const icon = match.sport === 'basketball' ? '🏀' : '⚽';
              const body = `${match.homeTeam} vs ${match.awayTeam} commence dans ${match.minutesUntilKickoff} min${match.competition ? ` — ${match.competition}` : ''}`;
              const notification = new Notification(`GoalStream ${icon}`, {
                body,
                icon: '/icon-192.png?v=2',
                badge: '/icon-192.png?v=2',
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

        saveNotifiedIds(NOTIFIED_STORAGE_KEY, cleanedIds);
      }

      // ── 2. Match start notifications (kickoff / tip-off) ──
      if (currentSettings.notifyMatchStart) {
        const matchStarts = findMatchStarts(
          currentFootball,
          currentBasketball,
          previousStatusesRef.current
        );

        const notifiedStartIds = getNotifiedIds(NOTIFIED_STORAGE_KEY);
        let updatedStartIds = new Set(notifiedStartIds);

        for (const start of matchStarts) {
          if (!updatedStartIds.has(start.id)) {
            try {
              const isFootball = start.sport === 'football';
              const title = isFootball ? '🏟️ Kick-off!' : '🏀 Tip-off!';
              const body = `${start.homeTeam} vs ${start.awayTeam} commence maintenant${start.competition ? ` — ${start.competition}` : ''}`;
              const notification = new Notification(title, {
                body,
                icon: '/icon-192.png?v=2',
                badge: '/icon-192.png?v=2',
                tag: start.id,
                requireInteraction: false,
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            } catch {
              // Notification might fail
            }

            updatedStartIds.add(start.id);
          }
        }

        saveNotifiedIds(NOTIFIED_STORAGE_KEY, updatedStartIds);
      }

      // ── 3. Goal / score notifications ──
      if (currentSettings.notifyGoals) {
        const notifiedGoalIds = getNotifiedIds(NOTIFIED_GOALS_KEY);

        const { newNotifiedIds, newPreviousScores, goals } = checkGoalNotifications(
          currentFootball,
          currentBasketball,
          previousScoresRef.current,
          notifiedGoalIds
        );

        // Send goal notifications
        for (const goal of goals) {
          try {
            const isFootball = goal.sport === 'football';
            const title = isFootball ? '⚽ BUT!' : '🏀 Points!';
            const body = `${goal.scoringTeam}: ${goal.homeScore} - ${goal.awayScore}${goal.minute ? ` (${goal.minute})` : ''}`;
            const tag = `goal-${goal.matchId}-${goal.homeScore}-${goal.awayScore}`;
            const notification = new Notification(title, {
              body,
              icon: '/icon-192.png?v=2',
              badge: '/icon-192.png?v=2',
              tag,
              requireInteraction: false,
            });

            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch {
            // Notification might fail
          }
        }

        // Clean old goal notification IDs for non-live matches
        const cleanedGoalIds = cleanOldGoalIds(newNotifiedIds, currentFootball, currentBasketball);
        saveNotifiedIds(NOTIFIED_GOALS_KEY, cleanedGoalIds);

        // Update previous scores ref
        previousScoresRef.current = newPreviousScores;
      } else {
        // Even if goal notifications are off, track scores for when they're turned back on
        const { newPreviousScores } = checkGoalNotifications(
          currentFootball,
          currentBasketball,
          previousScoresRef.current,
          new Set() // Don't actually track notified IDs, just update scores
        );
        previousScoresRef.current = newPreviousScores;
      }

      // ── 4. Update previous statuses ──
      const newStatuses = new Map<string, string>();
      for (const match of currentFootball) {
        newStatuses.set(match.id, match.status);
      }
      for (const match of currentBasketball) {
        newStatuses.set(match.id, match.status);
      }
      previousStatusesRef.current = newStatuses;
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
  // We intentionally depend on the data arrays so the check runs when data updates
  }, [footballMatches, basketballMatches, favoriteTeamNames, settings]);

  return {
    requestPermission,
    permissionState,
    notificationsEnabled,
    toggleNotifications,
    upcomingFavoriteCount,
    settings,
    updateSettings,
  };
}
