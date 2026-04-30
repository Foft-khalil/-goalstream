import { create } from 'zustand';
import type { BasketballMatch } from '@/lib/basketball/types';

export type ViewType = 'live' | 'channels' | 'standings' | 'favorites' | 'basketball';
export type DateTab = 'today' | 'tomorrow' | 'dayAfter';

interface Channel {
  tvgId: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  country: string;
  source?: string;
  status?: 'online' | 'offline' | 'checking' | 'unknown';
}

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  competition: string | null;
  matchDate: string;
  streamUrl: string | null;
  channelName: string | null;
  channelLogo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FootballMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'live' | 'upcoming' | 'finished';
  minute: number | null;
  displayClock: string | null;
  period: number | null;
  statusDescription: string | null;
  isHalftime: boolean;
  lastUpdated: number | null;
  competition: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
  matchDate: string | null;
  streamUrl?: string | null;
  channelName?: string | null;
  channelLogo?: string | null;
}

// Cache for channel health status (persists across store updates)
const channelHealthCache = new Map<string, 'online' | 'offline'>();

interface AppState {
  // Navigation
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  // Player
  playerVisible: boolean;
  playerStreamUrl: string;
  playerChannelName: string;
  playerChannelLogo: string;
  playerAlternatives: Array<{ name: string; url: string; logo: string }>;
  openPlayer: (url: string, name: string, logo?: string, alternatives?: Array<{ name: string; url: string; logo: string }>) => void;
  closePlayer: () => void;

  // Channels
  channels: Channel[];
  channelsLoading: boolean;
  channelsError: string | null;
  fetchChannels: (search?: string, country?: string) => Promise<void>;

  // Channel health check
  checkingChannels: boolean;
  onlineOnly: boolean;
  setOnlineOnly: (value: boolean) => void;
  checkChannelsHealth: (channelUrls: string[]) => Promise<void>;

  // Matches (DB - used by admin dashboard)
  matches: Match[];
  matchesLoading: boolean;
  matchesError: string | null;
  fetchMatches: () => Promise<void>;

  // Football matches (API - real data)
  footballMatches: FootballMatch[];
  footballLoading: boolean;
  footballError: string | null;
  footballLastUpdated: string | null;
  footballDates: string[];
  selectedDate: DateTab;
  setSelectedDate: (date: DateTab) => void;
  fetchFootballMatches: (dates?: string[]) => Promise<void>;

  // Basketball matches (API - real data)
  basketballMatches: BasketballMatch[];
  basketballLoading: boolean;
  basketballError: string | null;
  basketballLastUpdated: string | null;
  basketballDates: string[];
  selectedBasketballDate: DateTab;
  setSelectedBasketballDate: (date: DateTab) => void;
  fetchBasketballMatches: (dates?: string[]) => Promise<void>;

  // Admin
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;

  // Search/Filter
  channelSearch: string;
  setChannelSearch: (search: string) => void;
  channelCountry: string;
  setChannelCountry: (country: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentView: 'live',
  setCurrentView: (view) => set({ currentView: view }),

  // Player
  playerVisible: false,
  playerStreamUrl: '',
  playerChannelName: '',
  playerChannelLogo: '',
  playerAlternatives: [],
  openPlayer: (url, name, logo, alternatives) =>
    set({
      playerVisible: true,
      playerStreamUrl: url,
      playerChannelName: name,
      playerChannelLogo: logo || '',
      playerAlternatives: alternatives || [],
    }),
  closePlayer: () =>
    set({
      playerVisible: false,
      playerStreamUrl: '',
      playerChannelName: '',
      playerChannelLogo: '',
      playerAlternatives: [],
    }),

  // Channels
  channels: [],
  channelsLoading: false,
  channelsError: null,
  fetchChannels: async (search?: string, country?: string) => {
    set({ channelsLoading: true, channelsError: null });
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (country) params.set('country', country);

      const res = await fetch(`/api/channels?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch channels');
      const data = await res.json();

      // Apply health status: prefer API-provided health, fall back to client cache
      const channelsWithStatus = data.map((ch: Channel & { health?: 'online' | 'offline' | 'unknown' }) => ({
        ...ch,
        status: ch.health || channelHealthCache.get(ch.url) || 'unknown',
      }));

      set({ channels: channelsWithStatus, channelsLoading: false });
    } catch (error: any) {
      set({ channelsError: error.message, channelsLoading: false });
    }
  },

  // Channel health check
  checkingChannels: false,
  onlineOnly: false,
  setOnlineOnly: (value) => set({ onlineOnly: value }),
  checkChannelsHealth: async (channelUrls: string[]) => {
    set({ checkingChannels: true });

    // Mark channels as "checking"
    const { channels } = get();
    set({
      channels: channels.map((ch) =>
        channelUrls.includes(ch.url) ? { ...ch, status: 'checking' as const } : ch
      ),
    });

    try {
      // Check in batches of 10
      for (let i = 0; i < channelUrls.length; i += 10) {
        const batch = channelUrls.slice(i, i + 10);
        const res = await fetch('/api/channels-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch }),
        });

        if (!res.ok) continue;

        const results: { url: string; status: 'online' | 'offline'; statusCode: number }[] =
          await res.json();

        // Update cache
        for (const result of results) {
          channelHealthCache.set(result.url, result.status);
        }

        // Update channel status in store
        const currentChannels = get().channels;
        set({
          channels: currentChannels.map((ch) => {
            const result = results.find((r) => r.url === ch.url);
            if (result) {
              return { ...ch, status: result.status };
            }
            return ch;
          }),
        });
      }
    } catch (error) {
      console.error('Error checking channels health:', error);
    } finally {
      set({ checkingChannels: false });
    }
  },

  // Matches (DB)
  matches: [],
  matchesLoading: false,
  matchesError: null,
  fetchMatches: async () => {
    set({ matchesLoading: true, matchesError: null });
    try {
      const res = await fetch('/api/matches');
      if (!res.ok) throw new Error('Failed to fetch matches');
      const data = await res.json();
      set({ matches: data, matchesLoading: false });
    } catch (error: any) {
      set({ matchesError: error.message, matchesLoading: false });
    }
  },

  // Football matches (API - real data)
  footballMatches: [],
  footballLoading: false,
  footballError: null,
  footballLastUpdated: null,
  footballDates: [],
  selectedDate: 'today',
  setSelectedDate: (date) => set({ selectedDate: date }),
  fetchFootballMatches: async (dates?: string[]) => {
    // Don't show loading spinner if we already have data (for background refreshes)
    const currentMatches = get().footballMatches;
    if (currentMatches.length === 0) {
      set({ footballLoading: true });
    }
    set({ footballError: null });
    try {
      const params = new URLSearchParams();
      if (dates && dates.length > 0) {
        params.set('dates', dates.join(','));
      }
      const url = `/api/football${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Échec du chargement des matchs');
      const data = await res.json();
      set({
        footballMatches: data.matches || [],
        footballLoading: false,
        footballLastUpdated: data.lastUpdated || new Date().toISOString(),
        footballDates: data.dates || [],
        footballError: data.error || null,
      });
    } catch (error: any) {
      // Keep existing data on error (don't wipe it)
      set({
        footballError: currentMatches.length > 0
          ? 'Mise à jour échouée — données en cache'
          : 'Échec du chargement des matchs',
        footballLoading: false,
      });
    }
  },

  // Basketball matches (API - real data)
  basketballMatches: [],
  basketballLoading: false,
  basketballError: null,
  basketballLastUpdated: null,
  basketballDates: [],
  selectedBasketballDate: 'today',
  setSelectedBasketballDate: (date) => set({ selectedBasketballDate: date }),
  fetchBasketballMatches: async (dates?: string[]) => {
    const currentMatches = get().basketballMatches;
    if (currentMatches.length === 0) {
      set({ basketballLoading: true });
    }
    set({ basketballError: null });
    try {
      const params = new URLSearchParams();
      if (dates && dates.length > 0) {
        params.set('dates', dates.join(','));
      }
      const url = `/api/basketball${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Échec du chargement des matchs de basketball');
      const data = await res.json();
      set({
        basketballMatches: data.matches || [],
        basketballLoading: false,
        basketballLastUpdated: data.lastUpdated || new Date().toISOString(),
        basketballDates: data.dates || [],
        basketballError: data.error || null,
      });
    } catch (error: any) {
      set({
        basketballError: currentMatches.length > 0
          ? 'Mise à jour échouée — données en cache'
          : 'Échec du chargement des matchs de basketball',
        basketballLoading: false,
      });
    }
  },

  // Admin
  isAdmin: false,
  setIsAdmin: (value) => set({ isAdmin: value }),

  // Search/Filter
  channelSearch: '',
  setChannelSearch: (search) => set({ channelSearch: search }),
  channelCountry: '',
  setChannelCountry: (country) => set({ channelCountry: country }),
}));
