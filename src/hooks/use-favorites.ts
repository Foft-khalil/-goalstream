'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';

export interface FavoriteTeam {
  name: string;
  logo: string | null;
  addedAt: string;
}

export interface FavoriteChannel {
  name: string;
  logo: string;
  url: string;
  group: string;
  addedAt: string;
}

interface Favorites {
  teams: FavoriteTeam[];
  channels: FavoriteChannel[];
}

const STORAGE_KEY = 'goalstream_favorites';
const EMPTY_FAVORITES: Favorites = { teams: [], channels: [] };

// Keep an in-memory snapshot for useSyncExternalStore
let listeners: Array<() => void> = [];
let currentSnapshot: Favorites = EMPTY_FAVORITES;
let snapshotInitialized = false;

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): Favorites {
  if (!snapshotInitialized) {
    snapshotInitialized = true;
    currentSnapshot = loadFromStorage();
  }
  return currentSnapshot;
}

function getServerSnapshot(): Favorites {
  return EMPTY_FAVORITES;
}

function loadFromStorage(): Favorites {
  if (typeof window === 'undefined') return EMPTY_FAVORITES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return EMPTY_FAVORITES;
}

function saveToStorage(favs: Favorites) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  } catch {}
}

function updateSnapshot(favs: Favorites) {
  currentSnapshot = favs;
  saveToStorage(favs);
  for (const listener of listeners) {
    listener();
  }
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Team favorites
  const isTeamFavorite = useCallback(
    (teamName: string) => favorites.teams.some((t) => t.name.toLowerCase() === teamName.toLowerCase()),
    [favorites.teams]
  );

  const toggleTeamFavorite = useCallback((teamName: string, logo: string | null) => {
    const current = getSnapshot();
    const exists = current.teams.some((t) => t.name.toLowerCase() === teamName.toLowerCase());
    if (exists) {
      updateSnapshot({ ...current, teams: current.teams.filter((t) => t.name.toLowerCase() !== teamName.toLowerCase()) });
    } else {
      updateSnapshot({ ...current, teams: [...current.teams, { name: teamName, logo, addedAt: new Date().toISOString() }] });
    }
  }, []);

  const removeTeamFavorite = useCallback((teamName: string) => {
    const current = getSnapshot();
    updateSnapshot({
      ...current,
      teams: current.teams.filter((t) => t.name.toLowerCase() !== teamName.toLowerCase()),
    });
  }, []);

  // Channel favorites
  const isChannelFavorite = useCallback(
    (channelUrl: string) => favorites.channels.some((c) => c.url === channelUrl),
    [favorites.channels]
  );

  const toggleChannelFavorite = useCallback((channel: { name: string; logo: string; url: string; group: string }) => {
    const current = getSnapshot();
    const exists = current.channels.some((c) => c.url === channel.url);
    if (exists) {
      updateSnapshot({ ...current, channels: current.channels.filter((c) => c.url !== channel.url) });
    } else {
      updateSnapshot({ ...current, channels: [...current.channels, { ...channel, addedAt: new Date().toISOString() }] });
    }
  }, []);

  const removeChannelFavorite = useCallback((channelUrl: string) => {
    const current = getSnapshot();
    updateSnapshot({
      ...current,
      channels: current.channels.filter((c) => c.url !== channelUrl),
    });
  }, []);

  const clearAll = useCallback(() => {
    updateSnapshot(EMPTY_FAVORITES);
  }, []);

  return {
    favorites,
    loaded: true,
    // Teams
    favoriteTeams: favorites.teams,
    isTeamFavorite,
    toggleTeamFavorite,
    removeTeamFavorite,
    // Channels
    favoriteChannels: favorites.channels,
    isChannelFavorite,
    toggleChannelFavorite,
    removeChannelFavorite,
    // Utility
    clearAll,
    totalFavorites: favorites.teams.length + favorites.channels.length,
  };
}
