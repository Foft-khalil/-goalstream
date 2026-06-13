import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  type: 'goal' | 'match_start' | 'upcoming' | 'score_change';
  sport: 'football' | 'basketball';
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  matchId?: string;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  cleanup: () => void;
}

const STORAGE_KEY = 'goalstream_notification_history';
const MAX_ITEMS = 20;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage(): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as NotificationItem[];
      // Filter out items older than 24h on load
      const now = Date.now();
      return parsed.filter((item) => now - item.timestamp < MAX_AGE_MS);
    }
  } catch(_e) {
    // ignore
  }
  return [];
}

function saveToStorage(items: NotificationItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch(_e) {
    // ignore
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: loadFromStorage(),
  unreadCount: loadFromStorage().filter((i) => !i.read).length,

  addNotification: (item) => {
    const newItem: NotificationItem = {
      ...item,
      id: generateId(),
      timestamp: Date.now(),
      read: false,
    };

    set((state) => {
      // Prepend new item, limit to MAX_ITEMS
      const updated = [newItem, ...state.items].slice(0, MAX_ITEMS);
      const unreadCount = updated.filter((i) => !i.read).length;
      saveToStorage(updated);
      return { items: updated, unreadCount };
    });
  },

  markAsRead: (id) => {
    set((state) => {
      const updated = state.items.map((item) =>
        item.id === id ? { ...item, read: true } : item
      );
      const unreadCount = updated.filter((i) => !i.read).length;
      saveToStorage(updated);
      return { items: updated, unreadCount };
    });
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.items.map((item) => ({ ...item, read: true }));
      saveToStorage(updated);
      return { items: updated, unreadCount: 0 };
    });
  },

  clearAll: () => {
    saveToStorage([]);
    set({ items: [], unreadCount: 0 });
  },

  cleanup: () => {
    set((state) => {
      const now = Date.now();
      const updated = state.items.filter((item) => now - item.timestamp < MAX_AGE_MS);
      const unreadCount = updated.filter((i) => !i.read).length;
      saveToStorage(updated);
      return { items: updated, unreadCount };
    });
  },
}));
