# Task 1: Fix GoalStream App Crash on Load

## Problem
ALL sections showed "Impossible de charger - Échec du chargement des matchs" error on page load. The app was completely unusable because 3 concurrent API fetches (`/api/football`, `/api/basketball`, `/api/channels`) fired simultaneously on mount, overloading the dev server. The `/api/channels` route was especially expensive due to `db.channel.upsert` in a loop for every channel on every request.

## Changes Made

### Fix 1: `src/app/page.tsx` — Stagger API calls, remove channels from mount
- Removed `fetchChannels()` from the initial `useEffect` (channels load only when user navigates to Channels tab)
- Staggered football and basketball fetches: football fires immediately, basketball is delayed by 1.5s
- Removed `fetchChannels` from useEffect dependencies

### Fix 2: `src/lib/store.ts` — Retry logic and better error handling
- `fetchFootballMatches`: Added retry-once logic (2s delay, then retry before showing error). User-friendly error message instead of raw error.
- `fetchBasketballMatches`: Same retry-once logic with user-friendly error message.
- `fetchChannels`: On failure, just sets channels to empty array instead of setting error state (channels are non-critical for main view).

### Fix 3: `src/app/api/channels/route.ts` — Remove DB upsert on every read
- Removed the entire `db.channel.upsert` loop that was syncing up to 100 channels to the database on every GET request
- Removed the `import { db } from '@/lib/db'` import
- The channels API now just fetches from IPTV sources, applies filters, enriches with health status, and returns data — no database writes

### Fix 4: `src/components/live-matches.tsx` — Resilient error state
- Added auto-retry `useEffect` that triggers `fetchFootballMatches()` 5 seconds after an error occurs (placed before early returns to comply with React hooks rules)
- Changed error UI from full-page (py-24, large red icon) to softer inline message (py-16, amber icon instead of red)
- Added "Nouvelle tentative automatique..." hint text below the error message

### Fix 5: `src/components/basketball-matches.tsx` — Same resilient error state
- Same auto-retry after 5 seconds as football
- Same softer error UI with amber icon and auto-retry hint

### Fix 6: `src/components/channels-list.tsx` — Fetch on tab view
- Added `fetchChannels` to the useEffect dependency array so it properly triggers on initial mount
- Channels are now only fetched when the user navigates to the Channels tab (component mounts), not on page load

### Translation: `src/lib/i18n/translations.ts`
- Added `live.autoRetry` key to all 4 languages (fr, en, ar, es)

## Lint Result
✅ `bun run lint` passes with no errors
