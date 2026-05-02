# Task ID: 1 - Notification Center Implementation

## Work Completed

### 1. Created `/src/lib/notification-store.ts`
- Zustand store with `NotificationItem` interface (id, type, sport, title, body, timestamp, read, matchId)
- Methods: `addNotification`, `markAsRead`, `markAllAsRead`, `clearAll`, `cleanup`
- Persisted to localStorage key `goalstream_notification_history`
- Max 20 notifications stored, auto-pruned after 24h
- Cleanup runs on mount and filters expired items on load

### 2. Added translation keys to `/src/lib/i18n/translations.ts`
- Added 17 new keys to `notifications` section in all 5 languages (fr, en, ar, es, pt)
- New keys: title, noNotifications, noNotificationsDesc, markAllRead, clearAll, enableNotifs, openSettings, justNow, minutesAgo, hoursAgo, settingsTitle, settingsDesc, matchStart, matchStartDesc, goalsPoints, goalsPointsDesc, favoriteTeams, favoriteTeamsDesc
- Updated `Translations` interface with new fields

### 3. Created `/src/components/notification-center.tsx`
- Popover-based dropdown with header (title + unread badge + enable/disable switch)
- Notification list with icons (⚽/🏀/🏟️), title, body, timestamp
- ScrollArea with max-h-80 for long lists
- Empty state with Inbox icon when no notifications
- Footer with "Mark all as read" and "Clear all" buttons
- Settings button that calls `onOpenSettings` prop
- Full i18n support via `useAppStore().language`
- Relative time formatting (just now, X min ago, Xh ago)

### 4. Updated `/src/hooks/use-notifications.ts`
- Added import for `useNotificationStore`
- Added `useNotificationStore.getState().addNotification()` calls in 3 places:
  - When upcoming favorite match notification is sent (type: 'upcoming')
  - When match start notification is sent (type: 'match_start')
  - When goal/score notification is sent (type: 'goal')

### 5. i18n'd `/src/components/notification-settings.tsx`
- Replaced all hardcoded French strings with `t(language, ...)` calls
- Added `useAppStore()` import to get language
- Replaced: "Paramètres de notification", "Choisissez les types...", "Début de match", "Recevoir une notification...", "Buts & Points", "Équipes favorites", etc.

### 6. Updated `/src/app/page.tsx`
- Removed `BellOff` and `Settings2` from lucide-react imports
- Added `Popover`, `PopoverContent`, `PopoverTrigger` imports
- Added `NotificationCenter` and `useNotificationStore` imports
- Replaced desktop bell button with Popover wrapping bell + NotificationCenter
- Replaced mobile bell button with same Popover treatment
- Bell always shows `<Bell />` (not BellOff) - off state shown inside dropdown
- Red badge shows unread count (9+ cap) instead of green dot
- Removed separate Settings2 gear button - settings now in dropdown
- Removed unused `notificationsEnabled` and `toggleNotifications` from destructuring

### Verification
- ESLint passes with zero errors
- Dev server running without compilation errors
- Page loads successfully (HTTP 200)
