# Task 7 - Push Notifications for Favorite Team Matches

## Summary
Implemented browser push notifications that alert users when a match of their favorite teams is about to start (15 min before kickoff).

## Files Created
- `/home/z/my-project/src/hooks/use-notifications.ts` — Main notification hook

## Files Modified
- `/home/z/my-project/src/app/page.tsx` — Added bell icon button in header
- `/home/z/my-project/worklog.md` — Appended task log

## Key Implementation Details

### use-notifications.ts Hook
- Requests browser Notification permission
- Checks favorite teams (from useFavorites) against upcoming matches every 60 seconds
- Sends browser notification when favorite team's match starts within ≤15 minutes
- Notification format: "PSG vs Marseille commence dans 12 min — Ligue 1"
- Tracks notified match IDs in localStorage (`goalstream_notified_matches`) to prevent duplicates
- Cleans up old notified IDs when matches disappear from data
- On notification click, focuses the app window
- Persists enabled/disabled setting in localStorage (`goalstream_notifications_enabled`)
- Derives `notificationsEnabled` from both stored setting and browser permission state
- Returns: `requestPermission()`, `permissionState`, `notificationsEnabled`, `toggleNotifications()`, `upcomingFavoriteCount`

### page.tsx Changes
- Desktop: Bell/BellOff button next to install button in header
- Mobile: Bell/BellOff button next to hamburger menu
- Green Bell icon when enabled, muted BellOff when disabled
- Small pulsing green badge dot when upcoming favorite matches detected
- French tooltips: "Notifications activées" / "Activer les notifications"

## Lint Status
✅ All lint errors resolved (React hooks rules compliance)
