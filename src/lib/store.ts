import { create } from 'zustand';

export type ViewType = 'live' | 'channels' | 'admin';

interface Channel {
  tvgId: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  country: string;
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

interface AppState {
  // Navigation
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  // Player
  playerVisible: boolean;
  playerStreamUrl: string;
  playerChannelName: string;
  playerChannelLogo: string;
  openPlayer: (url: string, name: string, logo?: string) => void;
  closePlayer: () => void;

  // Channels
  channels: Channel[];
  channelsLoading: boolean;
  channelsError: string | null;
  fetchChannels: (search?: string, country?: string) => Promise<void>;

  // Matches
  matches: Match[];
  matchesLoading: boolean;
  matchesError: string | null;
  fetchMatches: () => Promise<void>;

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
  openPlayer: (url, name, logo) =>
    set({
      playerVisible: true,
      playerStreamUrl: url,
      playerChannelName: name,
      playerChannelLogo: logo || '',
    }),
  closePlayer: () =>
    set({
      playerVisible: false,
      playerStreamUrl: '',
      playerChannelName: '',
      playerChannelLogo: '',
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
      set({ channels: data, channelsLoading: false });
    } catch (error: any) {
      set({ channelsError: error.message, channelsLoading: false });
    }
  },

  // Matches
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

  // Admin
  isAdmin: false,
  setIsAdmin: (value) => set({ isAdmin: value }),

  // Search/Filter
  channelSearch: '',
  setChannelSearch: (search) => set({ channelSearch: search }),
  channelCountry: '',
  setChannelCountry: (country) => set({ channelCountry: country }),
}));
